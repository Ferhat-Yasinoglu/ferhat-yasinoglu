"""kazi web: telefondan kullanılabilir arayüz ve API (kazi serve)."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import importlib.util
import ipaddress
import logging
import math
import os
import re
import sys
import threading
import time
from collections import deque
from pathlib import Path

import httpx
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import Headers, MutableHeaders
from starlette.exceptions import HTTPException as StarletteHTTPException

from .core import FetchError, map_site, scrape
from .safety import MAX_URL, UnsafeURL, check_url, guarded_client, redirect_check

STATIC = Path(__file__).parent / "static"
MAX_BODY = 64 * 1024
MAX_PAGE_BYTES = 3 * 2**20  # web'de indirilen tek yanıt; çekirdekteki 50 MB ücretsiz barındırmanın 512 MB belleğini doldurur
MAX_LINKS = 2000
LIMITED = ("/api/scrape", "/api/map", "/api/extract")
LOG = logging.getLogger("kazi.web")
_SCHEME = re.compile(r"[a-zA-Z][a-zA-Z0-9+.\-]*://")
_TOKEN_OK = re.compile(r"[\x21-\x7e]+")
_KEYLIKE = re.compile(r"sk-[A-Za-z0-9_\-]{8,}")
_PATH = re.compile(r"(?<![\w:/.\-])/(?:[\w.\-+@]+/)+[\w.\-+]*")
_GENERIC = {400: "İstek okunamadı.", 401: "Giriş gerekli.", 404: "Böyle bir adres yok.",
            405: "Bu adres bu yöntemi desteklemiyor.", 413: "İstek çok büyük."}
_NO_JS = "Bu sunucuda JavaScript'li sayfa açma kapalı. Seçeneği kapatıp tekrar deneyin."
_BAD_TOKEN = ("KAZI_TOKEN'da boşluk ve Türkçe harf (ç, ğ, ı, ö, ş, ü) olmamalı. "
              "Yalnızca İngilizce harf, rakam ve - _ gibi işaretler kullanın.")
_FETCH = {
    "tls_cert": "Sitenin güvenlik sertifikası geçersiz ya da süresi dolmuş. Güvenlik için açılmadı.",
    "tls": "Siteyle güvenli bağlantı (https) kurulamadı. Adres http:// ile başlıyorsa onu yazın.",
    "refused": "Siteye bağlanılamadı. Adresi kontrol edin; site kapalı olabilir.",
    "timeout": "Site geç yanıt verdi. Biraz sonra tekrar deneyin.",
    "net": "Siteyle bağlantı kurulamadı ya da koptu. Biraz sonra tekrar deneyin.",
    "hops": "Site sayfayı çok fazla yere yönlendirdi; açılamadı.",
    "decode": "Sitenin gönderdiği içerik bozuk; okunamadı.",
    "big": f"Sayfa çok büyük (en fazla {MAX_PAGE_BYTES // 2**20} MB). Daha küçük bir sayfa deneyin.",
    "pdf": "Bu PDF dosyası okunamadı. Dosya bozuk ya da şifreli olabilir.",
}
_NO_TOKEN = ("KAZI_TOKEN tanımlı değil; sunucu başlamaz. Bir şifre belirleyin: "
             "export KAZI_TOKEN=\"$(python -c 'import secrets; print(secrets.token_urlsafe(24))')\" "
             "(yalnızca bu bilgisayarda denemek için: kazi serve --host 127.0.0.1 --no-auth)")


class Err(Exception):
    """Kullanıcıya {"error": mesaj} olarak dönen hata."""

    def __init__(self, status: int, message: str, headers: dict[str, str] | None = None):
        super().__init__(message)
        self.status, self.message, self.headers = status, message, headers


class ScrapeIn(BaseModel):
    url: str = Field(max_length=MAX_URL)
    js: bool = False
    full: bool = False


class MapIn(BaseModel):
    url: str = Field(max_length=MAX_URL)
    limit: int = Field(100, ge=1, le=500)


class ExtractIn(BaseModel):
    url: str = Field(max_length=MAX_URL)
    prompt: str | None = Field(None, max_length=4000)
    schema_: dict | None = Field(None, alias="schema")


def _int_env(name: str, default: int) -> int:
    try:
        n = int(os.environ.get(name, ""))
    except ValueError:
        return default
    return n if n > 0 else default


def _local_host(host: str | None) -> bool:
    """Host başlığı ya da --host değeri bu bilgisayarı mı gösteriyor (localhost, 127.x, ::1)?"""
    h = (host or "").strip().lower()
    name = h[1:].split("]")[0] if h.startswith("[") else (h.rsplit(":", 1)[0] if h.count(":") == 1 else h)
    try:
        return ipaddress.ip_address(name).is_loopback
    except ValueError:
        return name == "localhost"


def _normalize(url: str) -> str:
    """Telefondan yapıştırılan 'site.com/sayfa' gibi adreslere https:// ekler."""
    u = url.strip()
    if u.startswith("//"):
        return "https:" + u
    return u if _SCHEME.match(u) else "https://" + u


def _scrub(text: object, *secrets: str) -> str:
    """Hata metninden gizli değerleri, anahtar benzeri dizileri ve dosya yollarını çıkarır."""
    t = " ".join(str(text).split())
    for s in secrets:
        if s:
            t = t.replace(s, "***")
    return _PATH.sub("<yol>", _KEYLIKE.sub("***", t))[:300]


def _js_on() -> bool:
    """JS modu açık mı: KAZI_ALLOW_JS=1 ve Playwright kurulu."""
    return os.environ.get("KAZI_ALLOW_JS") == "1" and importlib.util.find_spec("playwright") is not None


def _extract_on() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY", "").strip()) and importlib.util.find_spec("anthropic") is not None


def _status_msg(code: int) -> str:
    if code in (401, 403):
        return f"Site bu sayfayı açmaya izin vermedi (HTTP {code}). Bazı siteler otomatik erişimi engeller."
    if code in (404, 410):
        return f"Sayfa bulunamadı (HTTP {code}). Adresi kontrol edin."
    if code == 429:
        return "Site çok fazla istek geldiğini söyledi (HTTP 429). Biraz sonra tekrar deneyin."
    if code >= 500:
        return f"Site şu an hata veriyor (HTTP {code}). Biraz sonra tekrar deneyin."
    return f"Site sayfayı vermedi (HTTP {code})."


def _invalid(exc: RequestValidationError) -> str:
    for e in exc.errors():
        loc = [str(x) for x in e.get("loc", ()) if x != "body"]
        field, kind = (loc[0] if loc else ""), e.get("type", "")
        if kind == "json_invalid":
            return "İstek JSON olarak okunamadı."
        if field and kind == "missing":
            return f"'{field}' alanı gerekli."
        if field and kind.startswith("string_too_long"):
            return f"'{field}' alanı çok uzun."
        if field:
            return f"'{field}' alanı geçersiz."
    return "İstek geçersiz."


class _Limiter:
    """Kayan pencere: pencere içinde en çok `limit` kayıt. hit() beklenecek saniyeyi döndürür (0: serbest)."""

    def __init__(self, limit: int, window: float):
        self.limit, self.window, self.hits = limit, window, {}

    def wait(self, key: str) -> float:
        q = self.hits.get(key)
        now = time.monotonic()
        while q and q[0] <= now - self.window:
            q.popleft()
        return q[0] + self.window - now if q and len(q) >= self.limit else 0.0

    def hit(self, key: str) -> float:
        if (w := self.wait(key)) > 0:
            return w
        if len(self.hits) > 1000:
            self.hits = {k: q for k, q in self.hits.items() if q and q[-1] > time.monotonic() - self.window}
        self.hits.setdefault(key, deque()).append(time.monotonic())
        return 0.0


async def _read_body(receive):
    buf = bytearray()
    while True:
        m = await receive()
        if m["type"] != "http.request":
            return bytes(buf)
        buf += m.get("body", b"")
        if len(buf) > MAX_BODY:
            return None
        if not m.get("more_body"):
            return bytes(buf)


def _replay(body: bytes, receive):
    sent = False

    async def r():
        nonlocal sent
        if sent:
            return await receive()
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    return r


class _Gate:
    """ASGI katmanı: kimlik (varsayılan: yasak), deneme/istek sınırı, gövde boyutu, güvenlik başlıkları."""

    def __init__(self, app, digest: bytes | None, rate: int):
        self.app, self.digest = app, digest
        self.rate, self.fails = _Limiter(rate, 60), _Limiter(10, 60)

    def _ok(self, auth: str | None) -> bool:
        scheme, _, cred = (auth or "").partition(" ")
        given = hashlib.sha256(cred.strip().encode("latin-1", "ignore")).digest()
        return hmac.compare_digest(given, self.digest) and scheme.lower() == "bearer"

    @staticmethod
    def _public(method: str, path: str) -> bool:
        return (method in ("GET", "HEAD") and (path in ("/", "/api/health", "/favicon.ico") or path.startswith("/static/")))

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path, method = scope["path"], scope["method"]

        async def out(msg):
            if msg["type"] == "http.response.start":
                msg.setdefault("headers", [])
                h = MutableHeaders(scope=msg)
                h["X-Content-Type-Options"] = "nosniff"
                h["Referrer-Policy"] = "no-referrer"
                h["X-Frame-Options"] = "DENY"
                if path.startswith("/api/"):
                    h["Cache-Control"] = "no-store"
            await send(msg)

        async def refuse(status: int, message: str, wait: float = 0.0):
            hdr = {"Retry-After": str(math.ceil(wait))} if wait else None
            if status == 401:
                hdr = {"WWW-Authenticate": "Bearer"}
            await JSONResponse({"error": message}, status_code=status, headers=hdr)(scope, receive, out)

        headers = Headers(scope=scope)
        key = (scope.get("client") or ("?",))[0]
        if self.digest is None and not _local_host(headers.get("host")):
            return await refuse(403, "Kimliksiz mod yalnızca bu bilgisayardan kullanılabilir.")
        if self.digest is not None and not self._public(method, path) and not self._ok(headers.get("authorization")):
            # Doğru şifre kilide takılmaz. Yalnız yanlış şifre denemesi sayılır; başlıksız istek (bot, tarayıcı
            # simgesi, tanımsız yol) sayılmaz: vekil arkasında herkes tek IP görünse de sahibi dışarıda kalmaz.
            if "authorization" in headers and (w := self.fails.hit(key)) > 0:
                return await refuse(429, "Çok fazla hatalı giriş denemesi. Biraz sonra tekrar deneyin.", w)
            return await refuse(401, "Giriş gerekli: geçerli şifre (token) girin.")
        if method == "POST" and path in LIMITED:
            if (w := self.rate.hit(key)) > 0:
                return await refuse(429, f"Çok fazla istek. {math.ceil(w)} saniye sonra tekrar deneyin.", w)
            cl = headers.get("content-length", "")
            if cl and not (cl.isascii() and cl.isdigit() and int(cl) <= MAX_BODY):
                return await refuse(413, "İstek çok büyük.")
            body = await _read_body(receive)
            if body is None:
                return await refuse(413, "İstek çok büyük.")
            receive = _replay(body, receive)
        await self.app(scope, receive, out)


def create_app(token: str | None = None, no_auth: bool = False, static_dir: str | Path | None = None,
               max_concurrent: int | None = None, rate_per_min: int | None = None,
               timeout: float | None = None) -> FastAPI:
    """token yoksa KAZI_TOKEN okunur; ikisi de yoksa (no_auth olmadıkça) RuntimeError: sunucu başlamaz."""
    token = (token if token is not None else os.environ.get("KAZI_TOKEN", "")).strip()
    if not no_auth:
        if not token:
            raise RuntimeError(_NO_TOKEN)
        if not _TOKEN_OK.fullmatch(token):
            raise RuntimeError(_BAD_TOKEN)
    static = Path(static_dir) if static_dir else STATIC
    slots = threading.BoundedSemaphore(max_concurrent or _int_env("KAZI_MAX_CONCURRENT", 3))
    limit = timeout or float(_int_env("KAZI_TIMEOUT", 90))
    running: set[asyncio.Future] = set()

    app = FastAPI(title="kazi", docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(_Gate, digest=None if no_auth else hashlib.sha256(token.encode()).digest(),
                       rate=rate_per_min or _int_env("KAZI_RATE_PER_MIN", 30))

    def reap(t: asyncio.Future) -> None:
        running.discard(t)
        if not t.cancelled():
            t.exception()

    def failure(e: Exception) -> Err:
        if isinstance(e, Err):
            return e
        if isinstance(e, UnsafeURL):
            return Err(400, str(e))
        if isinstance(e, httpx.InvalidURL):
            return Err(400, "Adres geçersiz.")
        if isinstance(e, FetchError) and e.kind in _FETCH:
            LOG.warning("indirme hatası (%s): %s", e.kind, _scrub(e, token))
            return Err(502, _FETCH[e.kind])
        if isinstance(e, RuntimeError):
            return Err(502, _scrub(e, token, os.environ.get("ANTHROPIC_API_KEY", "")) or "Sayfa açılamadı.")
        LOG.error("beklenmeyen hata: %s", type(e).__name__)
        return Err(500, "Beklenmeyen bir hata oldu. Biraz sonra tekrar deneyin.")

    async def work(fn):
        """fn'i eşzamanlılık sınırı ve süre sınırıyla thread'de çalıştırır. Süre dolsa da thread bitene kadar yer tutar."""
        if not slots.acquire(blocking=False):
            raise Err(503, "Sunucu şu an başka işlerle meşgul. Birkaç saniye sonra tekrar deneyin.", {"Retry-After": "5"})

        def job():
            try:
                return fn()
            finally:
                slots.release()

        task = asyncio.ensure_future(run_in_threadpool(job))
        running.add(task)
        task.add_done_callback(reap)
        done, _ = await asyncio.wait({task}, timeout=limit)
        if not done:
            raise Err(504, "Sayfa çok geç yanıt verdi; işlem durduruldu. Daha sonra tekrar deneyin.")
        try:
            return task.result()
        except Exception as e:
            raise failure(e) from None

    @app.exception_handler(Err)
    async def _err(request, exc: Err):
        return JSONResponse({"error": exc.message}, status_code=exc.status, headers=exc.headers)

    @app.exception_handler(StarletteHTTPException)
    async def _http(request, exc: StarletteHTTPException):
        return JSONResponse({"error": _GENERIC.get(exc.status_code, "İstek yapılamadı.")},
                            status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def _bad(request, exc: RequestValidationError):
        return JSONResponse({"error": _invalid(exc)}, status_code=422)

    @app.exception_handler(Exception)
    async def _boom(request, exc: Exception):
        LOG.error("beklenmeyen hata: %s %s", request.url.path, type(exc).__name__)
        return JSONResponse({"error": "Beklenmeyen bir hata oldu. Biraz sonra tekrar deneyin."}, status_code=500)

    @app.api_route("/api/health", methods=["GET", "HEAD"])
    async def health():
        return {"ok": True}

    @app.get("/api/features")
    async def features():
        """Arayüzün hangi seçenekleri göstereceği: bu sunucuda gerçekten çalışanlar."""
        return {"js": _js_on(), "extract": _extract_on()}

    @app.post("/api/scrape")
    async def api_scrape(body: ScrapeIn):
        if body.js and not _js_on():
            raise Err(403, _NO_JS)
        url = _normalize(body.url)

        def job():
            check_url(url)
            with guarded_client() as c:
                return scrape(url, js=body.js, only_main=not body.full, client=c, check=redirect_check,
                              max_bytes=MAX_PAGE_BYTES)

        page = await work(job)
        if page.status >= 400:
            raise Err(502, _status_msg(page.status))
        return {"url": page.url, "title": page.title, "markdown": page.markdown, "links": page.links[:MAX_LINKS],
                "status": page.status}

    @app.post("/api/map")
    async def api_map(body: MapIn):
        url = _normalize(body.url)

        def job():
            check_url(url)
            with guarded_client() as c:
                return map_site(url, limit=body.limit, client=c, max_bytes=MAX_PAGE_BYTES)

        return {"urls": await work(job)}

    @app.post("/api/extract")
    async def api_extract(body: ExtractIn):
        if not os.environ.get("ANTHROPIC_API_KEY", "").strip():
            raise Err(503, "Veri çıkarma bu sunucuda kapalı: ANTHROPIC_API_KEY ayarlanmamış.")
        url = _normalize(body.url)

        def job():
            try:
                from .extract import _make_client, extract
            except ModuleNotFoundError as e:
                if e.name != "anthropic":
                    raise
                raise Err(503, "Veri çıkarma bu sunucuda kurulu değil (pip install 'kazi[extract]').") from None
            check_url(url)
            client = _make_client()
            with guarded_client() as c:
                page = scrape(url, client=c, check=redirect_check, max_bytes=MAX_PAGE_BYTES)
            if page.status >= 400:
                raise Err(502, _status_msg(page.status))
            if not page.markdown.strip():
                raise Err(422, "Sayfada okunacak metin bulunamadı.")
            try:
                r = extract(page.markdown, schema=body.schema_, prompt=body.prompt, client=client)
            except ValueError:
                raise Err(400, "Şema geçerli değil: bir JSON nesnesi (type: object) olmalı.") from None
            return {"data": r["data"], "warnings": r["warnings"]}

        return await work(job)

    @app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
    async def index():
        f = static / "index.html"
        if not f.is_file():
            raise Err(404, "Arayüz dosyası bulunamadı (static/index.html).")
        return FileResponse(f, headers={"Cache-Control": "no-cache"})

    app.mount("/static", StaticFiles(directory=static, check_dir=False), name="static")
    return app


def serve(host: str = "0.0.0.0", port: int = 8000, no_auth: bool = False) -> None:
    if no_auth and not _local_host(host):
        raise RuntimeError("--no-auth yalnızca --host 127.0.0.1 ile kullanılabilir (kimliksiz sunucu ağa açılmaz).")
    app = create_app(no_auth=no_auth)
    if no_auth:
        print("uyarı: kimlik denetimi kapalı; sunucu yalnızca bu bilgisayardan erişilebilir.", file=sys.stderr)
    elif len(os.environ.get("KAZI_TOKEN", "").strip()) < 16:
        print("uyarı: KAZI_TOKEN kısa; en az 16 karakterlik rastgele bir şifre kullanın.", file=sys.stderr)
    import uvicorn

    uvicorn.run(app, host=host, port=port, server_header=False)
