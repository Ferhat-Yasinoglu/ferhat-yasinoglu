"""kazi search: Brave, Tavily ya da SearXNG ile web araması."""
from __future__ import annotations

import html
import os
import re
from urllib.parse import urlparse

import httpx

UA = "kazi/0.1 (personal use)"
MAX_LIMIT = 20
BACKENDS = {"brave": "BRAVE_API_KEY", "tavily": "TAVILY_API_KEY", "searxng": "SEARXNG_URL"}
_SETUP = (
    "Arama arka ucu yapılandırılmamış. Şunlardan birini ayarlayın:\n"
    "  export BRAVE_API_KEY=...    (https://brave.com/search/api/)\n"
    "  export TAVILY_API_KEY=...   (https://tavily.com)\n"
    "  export SEARXNG_URL=http://localhost:8080   (kendi SearXNG sunucunuz; JSON biçimi açık olmalı)"
)
_SEARX_HINT = "SearXNG örneğinde JSON biçimi kapalı olabilir (settings.yml: search.formats içine json ekleyin)."
_TAG = re.compile(r"</?[a-zA-Z][^>]*>")
_KEY_OK = re.compile(r"[\x21-\x7e]+")
_CTRL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f-\x9f]")  # ESC dahil: terminale kaçış dizisi gitmesin


class SearchError(RuntimeError):
    """search() çalışma hatası: arka uç ya da anahtar yok, ağ/HTTP hatası, bozuk yanıt."""


def _env(name: str) -> str:
    return os.environ.get(name, "").strip()


def _key(var: str) -> str:
    k = _env(var)
    if not _KEY_OK.fullmatch(k):
        raise SearchError(f"{var} geçersiz karakter içeriyor (boşluksuz ASCII olmalı); değeri yeniden kopyalayın.")
    return k


def _clean(s) -> str:
    return " ".join(_CTRL.sub("", html.unescape(_TAG.sub("", s))).split()) if isinstance(s, str) else ""


def _scrub(text: str, secrets: list[str]) -> str:
    for s in secrets:
        if s:
            text = text.replace(s, "***")
    return text


def _api_msg(r: httpx.Response, secrets: list[str]) -> str:
    """Sağlayıcının hata iletisi (kısa, tek satır, gizlilerden arındırılmış)."""
    text = ""
    try:
        d = r.json()
    except ValueError:
        d = None
    if isinstance(d, dict):
        for k in ("detail", "error", "message", "description"):
            v = d.get(k)
            if isinstance(v, dict):
                v = v.get("error") or v.get("message") or v.get("detail")
            if isinstance(v, str) and v.strip():
                text = v
                break
    return _scrub(_clean(text or r.text), secrets)[:200]


def _call(name: str, secrets: list[str], client: httpx.Client, method: str, url, hint: str = "", **kw) -> dict:
    kw.setdefault("follow_redirects", False)  # özel başlıklar (anahtar) başka adrese gitmesin
    try:
        r = client.request(method, url, **kw)
    except httpx.TimeoutException:
        raise SearchError(f"{name}: istek zaman aşımına uğradı.") from None
    except httpx.HTTPError as e:
        # httpx iletileri başlık değerini içerebilir: gizlileri sil, zinciri kes
        raise SearchError(f"{name}: bağlanılamadı ({type(e).__name__}: {_scrub(str(e), secrets)}).") from None
    if not r.is_success:
        c = r.status_code
        if c in (401, 403):
            what = f"erişim reddedildi (HTTP {c}). {hint}".strip() if hint else f"anahtar geçersiz ya da yetkisiz (HTTP {c})."
        elif c == 429:
            what = "hız ya da kota sınırı aşıldı (HTTP 429); biraz sonra tekrar deneyin."
        elif c >= 500:
            what = f"sunucu hatası (HTTP {c})."
        else:
            what = f"HTTP {c}."
        msg = _api_msg(r, secrets)
        raise SearchError(f"{name}: {what}" + (f" Sağlayıcı: {msg}" if msg else ""))
    try:
        data = r.json()
    except ValueError:
        raise SearchError(f"{name}: yanıt JSON değil. {hint}".strip()) from None
    if not isinstance(data, dict):
        raise SearchError(f"{name}: beklenmeyen yanıt biçimi.")
    return data


def _items(name: str, raw, snippet: str, limit: int) -> list[dict]:
    if not isinstance(raw, list):
        raise SearchError(f"{name}: beklenmeyen yanıt biçimi.")
    out = []
    for it in raw:
        url = it.get("url") if isinstance(it, dict) else None
        url = _CTRL.sub("", url).strip() if isinstance(url, str) else ""
        if urlparse(url).scheme not in ("http", "https"):
            continue
        out.append({"title": _clean(it.get("title")) or url, "url": url, "snippet": _clean(it.get(snippet))})
        if len(out) >= limit:
            break
    return out


def _brave(q: str, limit: int, client: httpx.Client) -> list[dict]:
    key = _key("BRAVE_API_KEY")
    data = _call("brave", [key], client, "GET", "https://api.search.brave.com/res/v1/web/search",
                 params={"q": q, "count": limit},
                 headers={"Accept": "application/json", "X-Subscription-Token": key})
    web = data.get("web", {})  # sonuç yoksa "web" alanı hiç gelmeyebilir
    if not isinstance(web, dict):
        raise SearchError("brave: beklenmeyen yanıt biçimi.")
    return _items("brave", web.get("results", []), "description", limit)


def _tavily(q: str, limit: int, client: httpx.Client) -> list[dict]:
    key = _key("TAVILY_API_KEY")
    data = _call("tavily", [key], client, "POST", "https://api.tavily.com/search",
                 json={"query": q, "max_results": limit},
                 headers={"Authorization": f"Bearer {key}"})
    return _items("tavily", data.get("results"), "content", limit)


def _searxng(q: str, limit: int, client: httpx.Client) -> list[dict]:
    raw = _env("SEARXNG_URL")
    if not re.match(r"https?://[^/\s]", raw, re.I):
        raise SearchError("SEARXNG_URL http:// ya da https:// ile başlamalı (örn. http://localhost:8080).")
    try:
        u = httpx.URL(raw)
    except httpx.InvalidURL:
        raise SearchError("SEARXNG_URL geçersiz.") from None
    path = u.path.rstrip("/")
    u = u.copy_with(path=path if path.endswith("/search") else path + "/search")
    u = u.copy_merge_params({"q": q, "format": "json"})  # request(params=) URL'deki mevcut sorguyu siler
    tokens = [v for _, v in httpx.URL(raw).params.multi_items() if len(v) >= 4]  # jeton tek başına da sızmasın
    secrets = [raw, u.password or "", u.query.decode("ascii", "replace"), *tokens]  # URL'de kullanıcı:parola ya da jeton olabilir
    data = _call("searxng", secrets, client, "GET", u, hint=_SEARX_HINT, follow_redirects=True)
    out = _items("searxng", data.get("results"), "content", limit)
    dead = data.get("unresponsive_engines")
    if not out and isinstance(dead, list) and dead:
        names = ", ".join(_clean("/".join(map(str, d)) if isinstance(d, (list, tuple)) else str(d)) for d in dead[:5])
        raise SearchError(f"searxng: sonuç yok, motorlar yanıt vermedi ({names}).")
    return out


_RUN = {"brave": _brave, "tavily": _tavily, "searxng": _searxng}


def _pick(backend: str | None) -> str:
    if backend is not None:
        name = str(backend).strip().lower()
        if name not in BACKENDS:
            raise ValueError(f"Bilinmeyen arama arka ucu. Seçenekler: {', '.join(BACKENDS)}.")
        if not _env(BACKENDS[name]):
            raise SearchError(f"{name} için {BACKENDS[name]} tanımlı değil. Ayarlayın: export {BACKENDS[name]}=...")
        return name
    for name, var in BACKENDS.items():
        if _env(var):
            return name
    raise SearchError(_SETUP)


def search(query: str, limit: int = 5, backend: str | None = None, client: httpx.Client | None = None) -> list[dict]:
    """Web araması → [{"title", "url", "snippet"}, ...] (sağlayıcı sırasıyla).

    backend: "brave" | "tavily" | "searxng"; verilmezse bu sırayla ortamda anahtarı (SEARXNG_URL) tanımlı ilki.
    limit: 1..20 (daha büyüğü 20'ye indirilir; arka uç daha az sonuç verirse o kadar döner).
    Hatalar: SearchError (RuntimeError alt sınıfı); boş query, limit < 1 ya da bilinmeyen backend için ValueError.
    Anahtarlar hiçbir iletiye yazılmaz.
    """
    if not isinstance(query, str) or not query.strip():
        raise ValueError("Arama sorgusu boş.")
    if not isinstance(limit, int) or limit < 1:
        raise ValueError("limit en az 1 olmalı.")
    name = _pick(backend)
    own = client is None
    client = client or httpx.Client(headers={"User-Agent": UA}, timeout=20.0)
    try:
        return _RUN[name](query.strip(), min(limit, MAX_LIMIT), client)
    finally:
        if own:
            client.close()
