"""kazi çekirdeği: scrape, map, crawl."""
from __future__ import annotations

import codecs
import os
import re
import ssl
import time
import urllib.robotparser
from collections import deque
from contextlib import nullcontext
from dataclasses import dataclass, field
from html import unescape
from pathlib import Path
from typing import Callable
from urllib.parse import urldefrag, urljoin, urlparse

import httpx
import trafilatura
from trafilatura.utils import decode_file

UA = "kazi/0.1 (personal use)"
MAX_BYTES = 50 * 1024 * 1024  # açılmış (gzip sonrası) tek yanıt gövdesi
MAX_SECONDS = 120.0  # tek yanıtı indirmenin toplam süre sınırı (httpx zaman aşımı okuma başınadır)
MAX_REDIRECTS = 10
_HREF = re.compile(r"""<a\s[^<>]*?href\s*=\s*["']([^"'#][^"']*)["']""", re.I)
_PDF_VIEWER = re.compile(r"""<embed[^<>]*type=["']application/pdf""", re.I)
_LOC = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>", re.I)
_META_CHARSET = re.compile(rb"""<meta[^>]{0,500}?charset\s*=\s*["']?\s*([A-Za-z0-9_.:-]+)""", re.I)
_CODEC = {"iso8859-1": "cp1252", "ascii": "cp1252", "iso8859-9": "cp1254", "utf-8": "utf-8-sig"}  # WHATWG eşlemesi
_HTML_START = re.compile(r"<(?:!doctype\s+html|html|head|body)\b", re.I)
_PLAIN = ("text/plain", "text/markdown", "text/x-markdown", "text/csv", "application/json")
_SKIP_EXT = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".css", ".js",
             ".zip", ".gz", ".mp4", ".mp3", ".woff", ".woff2", ".xml", ".json")
_DROP_HEADERS = {"content-encoding", "content-length", "transfer-encoding"}


class FetchError(RuntimeError):
    """İndirme hatası; kind: tls_cert, tls, refused, timeout, net, hops, decode, big, pdf (boşsa genel)."""

    def __init__(self, message: str, kind: str = ""):
        super().__init__(message)
        self.kind = kind


@dataclass
class Page:
    url: str
    markdown: str
    title: str | None = None
    links: list[str] = field(default_factory=list)
    status: int = 200


def _client(timeout: float = 30.0) -> httpx.Client:
    return httpx.Client(headers={"User-Agent": UA}, follow_redirects=True, timeout=timeout)


def _check_url(url: str) -> None:
    try:
        u = httpx.URL(url)
    except httpx.InvalidURL as e:
        raise RuntimeError(f"Geçersiz URL ({url}): {e}") from e
    if u.scheme not in ("http", "https") or not u.host:
        raise RuntimeError(f"{url} geçersiz: URL http:// ya da https:// ile başlamalı.")


def _read(client: httpx.Client, url: str, check: Callable[[str], str | None] | None = None,
          max_bytes: int | None = None) -> httpx.Response:
    """GET; gövde max_bytes (varsayılan MAX_BYTES; açılmış bayt) ve MAX_SECONDS ile sınırlı. check verilirse
    yönlendirmeler elle izlenir ve her hedef check(url) ile sorulur (None: serbest, metin: engel nedeni)."""
    cap = max_bytes or MAX_BYTES
    deadline = time.monotonic() + MAX_SECONDS
    for _ in range(MAX_REDIRECTS + 1):
        with client.stream("GET", url, follow_redirects=check is None) as r:
            loc = r.headers.get("location") if check and r.is_redirect else None
            if loc is None:
                buf = bytearray()
                for chunk in r.iter_bytes():
                    buf += chunk
                    if len(buf) > cap:
                        raise FetchError(f"{url} yanıtı {cap // 2**20} MB sınırını aştı.", "big")
                    if time.monotonic() > deadline:
                        raise FetchError(f"{url} indirmesi {MAX_SECONDS:.0f} sn sınırını aştı.", "timeout")
                headers = [(k, v) for k, v in r.headers.multi_items() if k.lower() not in _DROP_HEADERS]
                return httpx.Response(r.status_code, headers=headers, content=bytes(buf), request=r.request)
        try:
            nxt = urljoin(str(r.url), loc)
        except ValueError as e:
            raise RuntimeError(f"{url} geçersiz yönlendirme: {e}") from e
        why = check(nxt)
        if why:
            raise RuntimeError(f"yönlendirme {nxt} adresine gidiyor: {why}")
        url = nxt
    raise FetchError(f"{url} çok fazla yönlendirme (>{MAX_REDIRECTS}).", "hops")


def _net_kind(e: BaseException) -> str:
    """httpx hatasının nedeni (FetchError.kind): zincirdeki ssl/soket hatalarına bakar."""
    chain, c = [], e
    while c is not None and len(chain) < 8:
        chain.append(c)
        c = c.__cause__ or c.__context__
    if any(isinstance(c, ssl.SSLCertVerificationError) for c in chain):
        return "tls_cert"
    if any(isinstance(c, ssl.SSLError) for c in chain):
        return "tls"
    if any(isinstance(c, ConnectionRefusedError) for c in chain):
        return "refused"
    return "timeout" if isinstance(e, httpx.TimeoutException) else "net"


def _get(url: str, client: httpx.Client, retries: int = 2, check: Callable[[str], str | None] | None = None,
         max_bytes: int | None = None) -> httpx.Response:
    _check_url(url)
    last: Exception | None = None
    for i in range(retries + 1):
        try:
            r = _read(client, url, check, max_bytes)
            if r.status_code >= 500 and i < retries:
                time.sleep(2**i)
                continue
            return r
        except httpx.InvalidURL as e:
            raise RuntimeError(f"{url} indirilemedi: geçersiz URL ({e})") from e
        except (httpx.UnsupportedProtocol, httpx.TooManyRedirects, httpx.DecodingError) as e:  # tekrar denemek anlamsız
            kind = {httpx.TooManyRedirects: "hops", httpx.DecodingError: "decode"}.get(type(e), "")
            raise FetchError(f"{url} indirilemedi: {e}", kind) from e
        except httpx.HTTPError as e:
            last = e
            if _net_kind(e) in ("tls_cert", "tls", "refused"):  # sertifika/bağlantı reddi: tekrar denemek bekletmekten başka işe yaramaz
                break
            if i < retries:
                time.sleep(2**i)
    raise FetchError(f"{url} indirilemedi: {last}", _net_kind(last)) from last


def _ctype(r: httpx.Response) -> str:
    return r.headers.get("content-type", "").split(";")[0].strip().lower()


def _is_pdf(r: httpx.Response) -> bool:
    return _ctype(r) in ("application/pdf", "application/x-pdf") or r.content.startswith(b"%PDF-")


def _is_plain(r: httpx.Response) -> bool:
    return _ctype(r) in _PLAIN or _ctype(r).endswith("+json")


def _codec(name: str | None) -> str | None:
    try:
        n = codecs.lookup(name).name if name else None
        b"a".decode(n or "utf-8", errors="replace")  # rot13, hex gibi metin olmayan codec'leri ele
    except (LookupError, ValueError):
        return None
    return _CODEC.get(n, n)


def _decode(data: bytes, charset: str | None = None, html: bool = True) -> str:
    """Bayt → metin: BOM, başlıktaki charset, UTF-8; html ise ayrıca <meta charset> ve tahmin."""
    if data.startswith((codecs.BOM_UTF32_LE, codecs.BOM_UTF32_BE)):
        return data.decode("utf-32", errors="replace")
    if data.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        return data.decode("utf-16", errors="replace")
    enc = _codec(charset)
    if enc is None:
        try:
            return data.decode("utf-8-sig")
        except UnicodeDecodeError:
            pass
        m = _META_CHARSET.search(data[:4096]) if html else None
        enc = _codec(m.group(1).decode("ascii")) if m else None
        if enc is None and html:
            return decode_file(data, MAX_BYTES)
    return data.decode(enc or "utf-8", errors="replace")


def _fetch(url: str, client: httpx.Client, js: bool = False, retries: int = 2,
           check: Callable[[str], str | None] | None = None,
           max_bytes: int | None = None) -> tuple[str, int, str, bytes | None, bool]:
    """(html, status, son_url, pdf, düz_metin). Yanıt PDF ise pdf ham bayttır (html boş), değilse None;
    düz_metin True ise html aslında text/plain, Markdown ya da JSON gövdesidir."""
    _check_url(url)
    html = None
    if js:
        try:
            html, status, final = _fetch_js(url, check=check) if check else _fetch_js(url)
        except RuntimeError as e:
            if "Download is starting" not in str(e):  # headless_shell PDF'i indirmeye çalışır
                raise
        if html is not None and not _PDF_VIEWER.search(html):
            return html, status, final, None, False
        # tam Chromium PDF görüntüleyici sarmalayıcısı döndürdü: gerçek baytlar HTTP ile alınır
    r = _get(url, client, retries, check, max_bytes)
    if _is_pdf(r):
        return "", r.status_code, str(r.url), r.content, False
    if html is not None:  # PDF değilmiş, JS çıktısı geçerli
        return html, status, final, None, False
    plain = _is_plain(r)
    text = _decode(r.content, r.charset_encoding, html=not plain)
    if plain and _HTML_START.search(text[:1024]):  # text/plain diye HTML sunan sunucular
        plain, text = False, _decode(r.content, r.charset_encoding)
    return text, r.status_code, str(r.url), None, plain


def _fetch_html(url: str, client: httpx.Client, js: bool = False, retries: int = 2) -> tuple[str, int, str]:
    """(html, status, son_url). js=True ise Playwright ile render eder."""
    return _fetch(url, client, js, retries)[:3]


def _fetch_js(url: str, timeout: float = 30.0, settle: float = 0.7,
              check: Callable[[str], str | None] | None = None) -> tuple[str, int, str]:
    """Playwright ile render: load, sınırlı networkidle, sonra DOM `settle` sn durulana kadar bekler.
    Chromium sandbox'ı açık başlar; root'ta ya da KAZI_NO_SANDBOX=1 iken kapalıdır (root'ta açılamaz).
    check verilirse tarayıcının yaptığı her http(s) isteği (yönlendirme adımları, alt kaynaklar) check(url) ile sorulur."""
    import glob

    try:
        from playwright.sync_api import Error as PWError
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        raise RuntimeError("JS render için: pip install 'kazi[js]' && playwright install chromium") from e
    quiet = """([quiet, cap]) => new Promise(done => {
        let t, mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(end, quiet); });
        const c = setTimeout(end, cap);
        function end() { mo.disconnect(); clearTimeout(t); clearTimeout(c); done(); }
        mo.observe(document, {subtree: true, childList: true, characterData: true, attributes: true});
        t = setTimeout(end, quiet);
    })"""
    ms = int(timeout * 1000)
    sandbox = getattr(os, "geteuid", lambda: 1)() != 0 and not os.environ.get("KAZI_NO_SANDBOX")
    try:
        with sync_playwright() as p:
            try:
                b = p.chromium.launch(chromium_sandbox=sandbox)
            except PWError:
                base = os.environ.get("PLAYWRIGHT_BROWSERS_PATH") or os.path.expanduser("~/.cache/ms-playwright")
                exes = sorted(glob.glob(os.path.join(base, "chromium-*", "chrome-linux*", "chrome")), reverse=True)
                if not exes:
                    raise
                b = p.chromium.launch(executable_path=exes[0], chromium_sandbox=sandbox)
            try:
                pg = b.new_page(user_agent=UA)
                pg.set_default_timeout(ms)
                resp = _guarded_goto(pg, url, check) if check else pg.goto(url, wait_until="load")
                cap = min(ms, 5000)
                try:
                    pg.wait_for_load_state("networkidle", timeout=cap)
                except PWError:
                    pass  # long-poll/websocket: networkidle hiç gelmeyebilir, eldeki DOM ile devam
                try:
                    pg.evaluate(quiet, [int(settle * 1000), cap])
                except PWError:
                    pass  # sayfa bu sırada başka adrese gezindi
                return pg.content(), (resp.status if resp else 200), pg.url
            finally:
                b.close()
    except PWError as e:
        hint = " (sandbox açılamadıysa, güvendiğiniz ortamda KAZI_NO_SANDBOX=1 deneyin)" if sandbox and "sandbox" in str(e).lower() else ""
        raise RuntimeError(f"{url} JS ile indirilemedi: {str(e).strip().splitlines()[0]}{hint}") from e


def _guarded_goto(pg, url: str, check: Callable[[str], str | None]):
    """goto + adres denetimi: tarayıcının her isteği (WebSocket dahil) check'ten geçer. Chromium sayfa yönlendirmelerini route'a
    göstermeden kendi izlediği için bunları biz izleriz (yanıt yönlendirmesiz alınır, yeni adrese yeniden gidilir)."""
    from playwright.sync_api import Error as PWError

    hops: list[str] = []

    def handler(route):
        req = route.request
        if not req.url.startswith(("http://", "https://")):
            return route.continue_()
        if check(req.url) is not None:
            return route.abort()
        if not req.is_navigation_request():
            return route.continue_()
        try:
            r = route.fetch(max_redirects=0)
        except PWError:
            return route.abort()
        loc = r.headers.get("location")
        if 300 <= r.status < 400 and loc:
            if req.frame != pg.main_frame:
                return route.abort()
            hops.append(urljoin(req.url, loc))
            return route.fulfill(status=200, content_type="text/html", body="")
        route.fulfill(response=r)

    def ws_handler(ws):  # WebSocket el sıkışmaları pg.route'tan geçmez. Engellenen sunucuya hiç bağlanılmaz
        if check(re.sub(r"^ws", "http", ws.url, count=1)) is None:
            ws.connect_to_server()

    pg.route("**/*", handler)
    pg.route_web_socket("**/*", ws_handler)
    for _ in range(MAX_REDIRECTS + 1):
        resp = pg.goto(url, wait_until="load")
        if not hops:
            return resp
        url = hops.pop()
    raise RuntimeError(f"{url} çok fazla yönlendirme (>{MAX_REDIRECTS}).")


def extract_links(html: str, base: str) -> list[str]:
    out, seen = [], set()
    for href in _HREF.findall(html):
        href = unescape(href).strip()
        try:
            u = urldefrag(urljoin(base, href))[0]
            scheme = urlparse(u).scheme
        except ValueError:  # örn. http://[bozuk
            continue
        if href.startswith("#") or scheme not in ("http", "https") or u.lower().endswith(_SKIP_EXT) or u in seen:
            continue
        seen.add(u)
        out.append(u)
    return out


def _page_from_html(html: str, final: str, status: int, only_main: bool) -> Page:
    md = trafilatura.extract(
        html, output_format="markdown", include_links=True, include_tables=True,
        favor_recall=not only_main, url=final,
    ) or ""
    meta = trafilatura.extract_metadata(html)
    return Page(url=final, markdown=md, title=meta.title if meta else None,
                links=extract_links(html, final), status=status)


def _page_from_pdf(data: bytes, final: str, status: int) -> Page:
    from .pdf import pdf_to_markdown

    try:
        md, title = pdf_to_markdown(data)
    except ValueError as e:
        raise FetchError(f"{final} PDF olarak okunamadı: {e}", "pdf") from e
    return Page(url=final, markdown=md, title=title, status=status)


def scrape(url: str, js: bool = False, only_main: bool = True, client: httpx.Client | None = None,
           check: Callable[[str], str | None] | None = None, max_bytes: int | None = None) -> Page:
    """Tek sayfa → Markdown. js=True: Playwright. only_main=False: daha çok metin (favor_recall). PDF otomatik
    çevrilir; text/plain, Markdown ve JSON yanıtlar olduğu gibi döner. check: yönlendirme hedefi denetimi,
    max_bytes: yanıt boyut sınırı (bkz. _read)."""
    own = client is None
    client = client or _client()
    try:
        html, status, final, pdf, plain = _fetch(url, client, js=js, check=check, max_bytes=max_bytes)
    finally:
        if own:
            client.close()
    if pdf is not None:
        return _page_from_pdf(pdf, final, status) if status < 400 else Page(url=final, markdown="", status=status)
    if plain:
        return Page(url=final, markdown=html, status=status)
    return _page_from_html(html, final, status, only_main)


def scrape_file(path: str, only_main: bool = True) -> Page:
    """Yerel dosya → Page: PDF (.pdf ya da %PDF- imzalı), .html/.htm ya da düz metin/Markdown."""
    p = Path(path)
    if not p.is_file():
        raise RuntimeError(f"Dosya bulunamadı: {path} (URL ise http:// ya da https:// ile başlamalı)")
    data, url, ext = p.read_bytes(), p.resolve().as_uri(), p.suffix.lower()
    if data.startswith(b"%PDF-") or ext == ".pdf":
        return _page_from_pdf(data, url, 200)
    if ext in (".html", ".htm"):
        return _page_from_html(_decode(data), url, 200, only_main)
    return Page(url=url, markdown=_decode(data, html=False))


def _same_site(a: str, b: str) -> bool:
    try:
        return urlparse(a).netloc.lower() == urlparse(b).netloc.lower()
    except ValueError:
        return False


def _robots(url: str, client: httpx.Client) -> urllib.robotparser.RobotFileParser:
    """RFC 9309: 200 → kurallar, 4xx → serbest, 5xx ya da erişilemez → hepsi yasak (rp.unavailable = neden)."""
    p = urlparse(url)
    rp = urllib.robotparser.RobotFileParser()
    rp.unavailable = None
    try:
        r = _get(f"{p.scheme}://{p.netloc}/robots.txt", client, retries=1)
        rp.parse(_decode(r.content, r.charset_encoding, html=False).splitlines() if r.status_code == 200 else [])
        if r.status_code >= 500:
            rp.unavailable = f"HTTP {r.status_code}"
    except RuntimeError as e:
        rp.unavailable = str(e)
    if rp.unavailable:
        rp.parse(["User-agent: *", "Disallow: /"])
    return rp


def _sitemap_urls(start: str, client: httpx.Client, max_files: int = 20, limit: int | None = None,
                  keep: Callable[[str], bool] | None = None, max_bytes: int | None = None) -> list[str]:
    """sitemap.xml'deki sayfa URL'leri; sitemap index'in alt sitemap'leri (aynı site, en çok max_files dosya) açılır.
    keep verilirse yalnız onu geçenler alınır; limit'e ulaşılınca okuma durur (dev sitemap belleği doldurmasın)."""
    p = urlparse(start)
    todo = [f"{p.scheme}://{p.netloc}/sitemap.xml"]
    seen, out = set(todo), {}
    while todo:
        try:
            r = _get(todo.pop(0), client, retries=0, max_bytes=max_bytes)
        except RuntimeError:
            continue
        if r.status_code != 200:
            continue
        text = _decode(r.content, r.charset_encoding, html=False)
        index = "<sitemapindex" in text[:4096].lower()
        for m in _LOC.finditer(text):
            u = unescape(m.group(1))
            if not index:
                if keep is None or keep(u):
                    out[u] = None
                    if limit and len(out) >= limit:
                        return list(out)
            elif u not in seen and len(seen) < max_files and _same_site(u, start):
                seen.add(u)
                todo.append(u)
    return list(out)


def map_site(url: str, limit: int = 200, use_sitemap: bool = True, client: httpx.Client | None = None,
             max_bytes: int | None = None) -> list[str]:
    """Sayfaları indirmeden (sitemap varsa onunla, yoksa sadece ana sayfa linkleriyle) URL listesi.
    Başlangıç URL'si yönlendirilirse (örn. apex → www) site, yönlendirmenin vardığı adrestir.
    client verilirse tüm istekler onunla yapılır ve kapatılmaz; max_bytes her indirmenin boyut sınırıdır."""
    _check_url(url)
    with (nullcontext(client) if client else _client()) as c:
        page, err = None, None
        try:
            page = scrape(url, client=c, max_bytes=max_bytes)
        except RuntimeError as e:
            err = e
        origin = page.url if page else url
        found: dict[str, None] = {}
        if use_sitemap:
            keep = lambda u: _same_site(u, origin) and not u.endswith(".xml")  # noqa: E731
            for u in _sitemap_urls(origin, c, limit=limit, keep=keep, max_bytes=max_bytes):
                found[u] = None
        if page and page.status < 400:
            for u in page.links:
                if _same_site(u, origin):
                    found[u] = None
        if not found:
            if err:
                raise err
            if page.status >= 400:
                raise RuntimeError(f"{page.url} HTTP {page.status} döndü.")
        return list(found)[:limit]


def _regex(pattern: str | None, flag: str) -> re.Pattern | None:
    try:
        return re.compile(pattern) if pattern else None
    except re.error as e:
        raise ValueError(f"{flag} geçerli bir regex değil: {e}") from e


def crawl(url: str, limit: int = 20, depth: int = 2, include: str | None = None,
          exclude: str | None = None, delay: float = 0.5, js: bool = False,
          respect_robots: bool = True, on_skip: Callable[[str, str], None] | None = None):
    """Genişlik öncelikli tarama; sayfaları geldikçe üretir (generator).

    Aynı site: ilk sayfanın yönlendirmeden sonraki adresidir (apex → www). Yönlendirmeler her adımda robots.txt ve
    aynı-site denetiminden geçer (ilk sayfa için yalnızca robots). limit alınan sayfa sayısıdır; yapılan istek
    sayısı ise limit*3+10 ile sınırlıdır. Atlanan sayfalar on_skip(url, neden) ile bildirilir.
    """
    skip = on_skip or (lambda u, why: None)
    inc, exc = _regex(include, "--include"), _regex(exclude, "--exclude")
    _check_url(url)
    max_tries = limit * 3 + 10
    with _client() as c:
        origin = url
        rps: dict[str, urllib.robotparser.RobotFileParser] = {}

        def blocked(u: str, start: bool = False) -> str | None:
            if not start and not _same_site(u, origin):
                return "başka bir siteye yönlendiriyor"
            if respect_robots:
                p = urlparse(u)
                key = f"{p.scheme}://{p.netloc}".lower()
                rp = rps.get(key) or rps.setdefault(key, _robots(u, c))
                if rp.unavailable:
                    return f"robots.txt alınamadı ({rp.unavailable}); --no-robots ile yok sayılabilir"
                if not rp.can_fetch(UA, u):
                    return "robots.txt izin vermiyor"
            return None

        queue = deque([(urldefrag(url)[0], 0)])
        seen = {queue[0][0]}
        visited: set[str] = set()
        n = tries = 0
        while queue and n < limit and tries < max_tries:
            cur, d = queue.popleft()
            why = blocked(cur, d == 0)
            if why:
                skip(cur, why)
                continue
            if tries:
                time.sleep(delay)
            tries += 1
            try:
                page = scrape(cur, js=js, client=c, check=lambda u, first=d == 0: blocked(u, first))
            except RuntimeError as e:
                skip(cur, str(e))
                continue
            final = urldefrag(page.url)[0]
            why = blocked(final, d == 0) if final != cur else None
            if why:
                skip(cur, f"{final} adresine yönlendi: {why}")
                continue
            if d == 0:
                origin = final
            seen.add(final)
            if final in visited:  # başka bir adres aynı sayfaya yönlendirmiş
                continue
            visited.add(final)
            if page.status >= 400:
                skip(final, f"HTTP {page.status}")
                continue
            if page.markdown:
                n += 1
                yield page
            else:
                skip(final, "metin bulunamadı")
            if d < depth:
                for l in page.links:
                    if l in seen or not _same_site(l, origin):
                        continue
                    if (inc and not inc.search(l)) or (exc and exc.search(l)):
                        continue
                    if len(queue) + tries >= max_tries:
                        break
                    seen.add(l)
                    queue.append((l, d + 1))
