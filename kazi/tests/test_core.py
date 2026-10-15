import httpx
import pytest
from test_pdf import make_pdf  # elle üretilen minimal PDF (pytest tests/ dizinini sys.path'e ekler)

import kazi.core as core
from kazi.core import crawl, extract_links, scrape

HOME = """<html><head><title>Ana</title></head><body><nav><a href="/a">A</a>
<a href="/b#x">B</a><a href="https://dis.example/z">dış</a><a href="/logo.png">img</a></nav>
<article><h1>Merhaba</h1><p>%s</p></article></body></html>"""
BODY = "Bu bir deneme paragrafıdır. " * 20


def handler(req: httpx.Request) -> httpx.Response:
    path = req.url.path
    if path == "/robots.txt":
        return httpx.Response(200, text="User-agent: *\nDisallow: /b\n")
    if path in ("/", "/a", "/b"):
        return httpx.Response(200, text=HOME % BODY)
    return httpx.Response(404)


@pytest.fixture
def client():
    return httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=True)


def test_extract_links_filters():
    links = extract_links(HOME % "x", "https://s.test/")
    assert "https://s.test/a" in links and "https://s.test/b" in links
    assert not any(l.endswith(".png") for l in links)


def test_scrape_markdown(client):
    p = scrape("https://s.test/", client=client)
    assert "Merhaba" in p.markdown and p.status == 200


def test_crawl_respects_robots_and_site(monkeypatch):
    monkeypatch.setattr(core, "_client", lambda timeout=30.0: httpx.Client(
        transport=httpx.MockTransport(handler), follow_redirects=True))
    urls = [p.url for p in crawl("https://s.test/", limit=10, delay=0)]
    assert "https://s.test/" in urls and "https://s.test/a" in urls
    assert "https://s.test/b" not in urls  # robots.txt
    assert not any("dis.example" in u for u in urls)


# --- PDF entegrasyonu ---------------------------------------------------------------------------
PDF = make_pdf(["Birinci sayfa metni", "Ikinci sayfa metni"], title="Rapor")


def pdf_client(body=PDF, ctype="application/pdf", status=200):
    def h(req):
        return httpx.Response(status, content=body, headers={"Content-Type": ctype} if ctype else {})
    return httpx.Client(transport=httpx.MockTransport(h), follow_redirects=True)


def test_scrape_pdf_by_content_type():
    p = scrape("https://s.test/rapor.pdf", client=pdf_client())
    assert p.markdown == "## Sayfa 1\n\nBirinci sayfa metni\n\n## Sayfa 2\n\nIkinci sayfa metni"
    assert p.title == "Rapor" and p.links == [] and p.status == 200 and p.url == "https://s.test/rapor.pdf"


@pytest.mark.parametrize("ctype", ["Application/PDF; charset=binary", "application/x-pdf", "application/octet-stream", "text/html", None])
def test_scrape_pdf_by_signature_or_odd_content_type(ctype):
    # %PDF- imzası varsa Content-Type ne olursa olsun PDF sayılır
    assert "## Sayfa 1" in scrape("https://s.test/indir", client=pdf_client(ctype=ctype)).markdown


def test_scrape_pdf_follows_redirect_and_reports_final_url():
    def h(req):
        if req.url.path == "/kisa":
            return httpx.Response(302, headers={"Location": "/dosya.pdf"})
        return httpx.Response(200, content=PDF, headers={"Content-Type": "application/pdf"})
    c = httpx.Client(transport=httpx.MockTransport(h), follow_redirects=True)
    p = scrape("https://s.test/kisa", client=c)
    assert p.url == "https://s.test/dosya.pdf" and "Birinci sayfa" in p.markdown


def test_scrape_fake_pdf_raises_runtime_error():
    # .pdf diye HTML hata sayfası dönen sunucu: Content-Type PDF ama gövde değil
    with pytest.raises(RuntimeError, match="PDF olarak okunamadı.*PDF değil"):
        scrape("https://s.test/a.pdf", client=pdf_client(body=b"<html>404</html>"))


def test_scrape_pdf_error_status_does_not_parse():
    p = scrape("https://s.test/a.pdf", client=pdf_client(body=b"<html>yok</html>", status=404))
    assert p.status == 404 and p.markdown == ""


def test_scrape_scanned_pdf_returns_empty_markdown_with_title():
    p = scrape("https://s.test/tarama.pdf", client=pdf_client(body=make_pdf([None], title="Tarama")))
    assert p.markdown == "" and p.title == "Tarama"


def test_html_with_pdf_word_is_not_treated_as_pdf():
    # PDF yapısını anlatan HTML: gövdede "%PDF-" geçer ama imza başta değildir
    body = HOME % (BODY + " Her PDF dosyası %PDF-1.7 satırıyla başlar. ")
    c = httpx.Client(transport=httpx.MockTransport(lambda req: httpx.Response(200, html=body)))
    p = scrape("https://s.test/", client=c)
    assert "Merhaba" in p.markdown and "%PDF-1.7" in p.markdown


def test_fetch_html_keeps_three_tuple_signature(client):
    html, status, final = core._fetch_html("https://s.test/", client)
    assert "<title>Ana</title>" in html and status == 200 and final == "https://s.test/"


def test_crawl_includes_pdf_pages(monkeypatch):
    def h(req):
        if req.url.path == "/robots.txt":
            return httpx.Response(404)
        if req.url.path == "/rapor.pdf":
            return httpx.Response(200, content=PDF, headers={"Content-Type": "application/pdf"})
        return httpx.Response(200, text=HOME.replace('<a href="/a">', '<a href="/rapor.pdf">') % BODY)
    monkeypatch.setattr(core, "_client", lambda timeout=30.0: httpx.Client(
        transport=httpx.MockTransport(h), follow_redirects=True))
    pages = {p.url: p for p in crawl("https://s.test/", limit=10, delay=0)}
    assert "## Sayfa 2" in pages["https://s.test/rapor.pdf"].markdown
    assert "Merhaba" in pages["https://s.test/"].markdown


# JS yolu: PDF URL'sinde Playwright PDF görüntüleyici sarmalayıcısı döndürür ya da (headless_shell) indirmeye çalışır.
VIEWER = '<html><body><embed name="X" src="about:blank" type="application/pdf" internalid="X"></body></html>'


def test_js_pdf_viewer_falls_back_to_http_bytes(monkeypatch):
    monkeypatch.setattr(core, "_fetch_js", lambda url: (VIEWER, 200, url))
    p = scrape("https://s.test/rapor.pdf", js=True, client=pdf_client())
    assert "## Sayfa 1" in p.markdown and p.title == "Rapor"


def test_js_download_error_falls_back_to_http_bytes(monkeypatch):
    def boom(url):
        raise RuntimeError(f"{url} JS ile indirilemedi: Page.goto: Download is starting")
    monkeypatch.setattr(core, "_fetch_js", boom)
    assert "## Sayfa 2" in scrape("https://s.test/rapor.pdf", js=True, client=pdf_client()).markdown


def test_js_other_errors_are_not_swallowed(monkeypatch):
    def boom(url):
        raise RuntimeError(f"{url} JS ile indirilemedi: net::ERR_CONNECTION_REFUSED")
    monkeypatch.setattr(core, "_fetch_js", boom)
    with pytest.raises(RuntimeError, match="ERR_CONNECTION_REFUSED"):
        scrape("https://s.test/", js=True, client=pdf_client())


def test_js_page_embedding_pdf_keeps_js_html_when_http_is_not_pdf(monkeypatch):
    # <embed type=application/pdf> içeren sıradan bir sayfa: HTTP yanıtı PDF değilse JS çıktısı korunur
    page = HOME % BODY + VIEWER
    monkeypatch.setattr(core, "_fetch_js", lambda url: (page, 200, url))
    p = scrape("https://s.test/a", js=True, client=httpx.Client(transport=httpx.MockTransport(
        lambda req: httpx.Response(200, text="<html>statik</html>"))))
    assert "Merhaba" in p.markdown


def test_js_normal_page_never_touches_http(monkeypatch):
    monkeypatch.setattr(core, "_fetch_js", lambda url: (HOME % BODY, 200, url))
    def no_http(req):
        raise AssertionError("HTTP isteği yapılmamalıydı")
    p = scrape("https://s.test/", js=True, client=httpx.Client(transport=httpx.MockTransport(no_http)))
    assert "Merhaba" in p.markdown


# --- yerel dosya ----------------------------------------------------------------------------------
def test_scrape_file_pdf_html_and_text(tmp_path):
    (tmp_path / "r.pdf").write_bytes(PDF)
    (tmp_path / "imzali").write_bytes(PDF)  # uzantısız ama %PDF-
    (tmp_path / "s.html").write_text(HOME % BODY, encoding="utf-8")
    (tmp_path / "n.md").write_text("# Not\n\nçğş içerik\n", encoding="utf-8")
    assert "## Sayfa 1" in core.scrape_file(str(tmp_path / "r.pdf")).markdown
    assert core.scrape_file(str(tmp_path / "r.pdf")).title == "Rapor"
    assert "## Sayfa 2" in core.scrape_file(str(tmp_path / "imzali")).markdown
    assert "Merhaba" in core.scrape_file(str(tmp_path / "s.html")).markdown
    md = core.scrape_file(str(tmp_path / "n.md"))
    assert md.markdown == "# Not\n\nçğş içerik\n" and md.url.startswith("file://")


def test_scrape_file_errors(tmp_path):
    with pytest.raises(RuntimeError, match="Dosya bulunamadı"):
        core.scrape_file(str(tmp_path / "yok.pdf"))
    (tmp_path / "bozuk.pdf").write_bytes(b"bu pdf degil")
    with pytest.raises(RuntimeError, match="PDF olarak okunamadı"):
        core.scrape_file(str(tmp_path / "bozuk.pdf"))


# --- sağlamlaştırma: yönlendirme, robots, sınırlar, kodlama ------------------------------------------
import gzip
import sys
import threading
import time
import types
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from kazi.core import map_site


def page(*hrefs, text=BODY):
    nav = "".join(f'<a href="{h}">bağlantı</a>' for h in hrefs)
    return (f"<html><head><title>Sayfa</title></head><body><nav>{nav}</nav>"
            f"<article><h1>Başlık</h1><p>{text}</p></article></body></html>")


def serve(monkeypatch, handler):
    """crawl/map_site/scrape'in kullandığı istemciyi sahte siteyle değiştirir; istek günlüğü döner (host+yol)."""
    log = []

    def h(req):
        log.append(f"{req.url.host}{req.url.path}")
        return handler(req)

    monkeypatch.setattr(core, "_client", lambda timeout=30.0: httpx.Client(
        transport=httpx.MockTransport(h), follow_redirects=True))
    return log


def mk(handler):
    return httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=True)


def apex_to_www(req):
    return httpx.Response(301, headers={"Location": f"http://www.a.test{req.url.path}"})


def test_crawl_follows_links_after_apex_to_www_redirect(monkeypatch):
    def h(req):
        if req.url.host == "a.test":
            return apex_to_www(req)
        if req.url.path == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(200, html=page("/x", "http://www.a.test/y"))
    serve(monkeypatch, h)
    urls = [p.url for p in crawl("http://a.test/", limit=10, delay=0)]
    assert urls == ["http://www.a.test/", "http://www.a.test/x", "http://www.a.test/y"]


def test_map_site_after_apex_to_www_redirect(monkeypatch):
    def h(req):
        if req.url.host == "a.test":
            return apex_to_www(req)
        if req.url.path == "/sitemap.xml":
            return httpx.Response(200, text="<urlset><url><loc>http://www.a.test/s?a=1&amp;b=2</loc></url></urlset>")
        return httpx.Response(200, html=page("/x"))
    serve(monkeypatch, h)
    assert map_site("http://a.test/") == ["http://www.a.test/s?a=1&b=2", "http://www.a.test/x"]


def test_crawl_start_redirect_checks_robots_of_new_host(monkeypatch):
    def h(req):
        if req.url.host == "a.test":
            return httpx.Response(404) if req.url.path == "/robots.txt" else apex_to_www(req)
        if req.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nDisallow: /\n")
        return httpx.Response(200, html=page())
    log = serve(monkeypatch, h)
    skipped = []
    assert list(crawl("http://a.test/", delay=0, on_skip=lambda u, w: skipped.append(w))) == []
    assert "www.a.test/" not in log and "robots.txt" in skipped[0]


def test_crawl_start_redirect_target_is_not_yielded_twice(monkeypatch):
    def h(req):
        p = req.url.path
        if p == "/robots.txt":
            return httpx.Response(404)
        if p == "/":
            return httpx.Response(302, headers={"Location": "/en/"})
        return httpx.Response(200, html=page("/en/", "/en/x"))
    serve(monkeypatch, h)
    assert [p.url for p in crawl("http://a.test/", limit=2, delay=0)] == ["http://a.test/en/", "http://a.test/en/x"]


def test_crawl_does_not_yield_page_reached_through_two_urls(monkeypatch):
    def h(req):
        p = req.url.path
        if p == "/robots.txt":
            return httpx.Response(404)
        if p == "/eski":
            return httpx.Response(301, headers={"Location": "/yeni"})
        return httpx.Response(200, html=page("/eski", "/yeni"))
    serve(monkeypatch, h)
    assert [p.url for p in crawl("http://a.test/", delay=0)] == ["http://a.test/", "http://a.test/yeni"]


def test_crawl_redirect_into_robots_disallowed_area_is_not_fetched(monkeypatch):
    def h(req):
        p = req.url.path
        if p == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nDisallow: /private/\n")
        if p == "/go":
            return httpx.Response(302, headers={"Location": "/private/secret"})
        if p == "/private/secret":
            return httpx.Response(200, html=page(text="GIZLI-BOLUM " * 40))
        return httpx.Response(200, html=page("/go", "/private/direct"))
    log = serve(monkeypatch, h)
    skipped = []
    pages = list(crawl("http://a.test/", delay=0, on_skip=lambda u, w: skipped.append((u, w))))
    assert [p.url for p in pages] == ["http://a.test/"]
    assert not any("/private/" in l for l in log)
    assert any(u.endswith("/go") and "robots.txt" in w for u, w in skipped)


def test_crawl_does_not_follow_redirect_to_other_host(monkeypatch):
    def h(req):
        if req.url.path == "/robots.txt":
            return httpx.Response(404)
        if req.url.path == "/go":
            return httpx.Response(302, headers={"Location": "http://127.0.0.1:9/ic"})
        if req.url.host == "127.0.0.1":
            return httpx.Response(200, html=page(text="DAHILI " * 60))
        return httpx.Response(200, html=page("/go"))
    log = serve(monkeypatch, h)
    skipped = []
    pages = list(crawl("http://a.test/", delay=0, on_skip=lambda u, w: skipped.append(w)))
    assert [p.url for p in pages] == ["http://a.test/"]
    assert not any(l.startswith("127.0.0.1") for l in log) and "başka bir site" in skipped[0]


@pytest.mark.parametrize("robots", [lambda req: httpx.Response(503), httpx.ReadTimeout("zaman aşımı")], ids=["5xx", "ag-hatasi"])
def test_crawl_robots_5xx_or_unreachable_disallows_everything(monkeypatch, robots):
    monkeypatch.setattr(core.time, "sleep", lambda s: None)

    def h(req):
        if req.url.path == "/robots.txt":
            if isinstance(robots, Exception):
                raise robots
            return robots(req)
        return httpx.Response(200, html=page("/private/x"))
    log = serve(monkeypatch, h)
    skipped = []
    assert list(crawl("http://a.test/", delay=0, on_skip=lambda u, w: skipped.append(w))) == []
    assert set(log) == {"a.test/robots.txt"} and "robots.txt alınamadı" in skipped[0] and "--no-robots" in skipped[0]
    # --no-robots (respect_robots=False) yine çalışır
    assert [p.url for p in crawl("http://a.test/", limit=1, delay=0, respect_robots=False)] == ["http://a.test/"]


def test_crawl_robots_404_allows_everything(monkeypatch):
    def h(req):
        return httpx.Response(404) if req.url.path == "/robots.txt" else httpx.Response(200, html=page("/private/x"))
    serve(monkeypatch, h)
    assert len(list(crawl("http://a.test/", delay=0))) == 2


def test_crawl_request_count_is_bounded_even_when_no_page_counts(monkeypatch):
    def h(req):
        if req.url.path == "/robots.txt":
            return httpx.Response(404)
        base = req.url.path.rstrip("/")
        return httpx.Response(200, html="<html><body>" + "".join(f'<a href="{base}/{i}"></a>' for i in range(30)) + "</body></html>")
    log = serve(monkeypatch, h)
    assert list(crawl("http://a.test/", limit=3, depth=5, delay=0)) == []
    assert len([l for l in log if not l.endswith("robots.txt")]) <= 3 * 3 + 10


def test_crawl_reports_skips_and_ignores_links_of_error_pages(monkeypatch):
    def h(req):
        p = req.url.path
        if p == "/robots.txt":
            return httpx.Response(404)
        if p == "/":
            return httpx.Response(200, html=page("/yok", "/bos", "/kesik"))
        if p == "/yok":
            return httpx.Response(404, html=page("/c", "/d"))
        if p == "/bos":
            return httpx.Response(200, html="<html><body></body></html>")
        raise httpx.ConnectError("reddedildi")
    log = serve(monkeypatch, h)
    monkeypatch.setattr(core.time, "sleep", lambda s: None)
    skipped = {}
    pages = list(crawl("http://a.test/", delay=0, on_skip=lambda u, w: skipped.update({u: w})))
    assert [p.url for p in pages] == ["http://a.test/"]
    assert skipped["http://a.test/yok"] == "HTTP 404" and skipped["http://a.test/bos"] == "metin bulunamadı"
    assert "indirilemedi" in skipped["http://a.test/kesik"]
    assert "a.test/c" not in log and "a.test/d" not in log


def test_crawl_reports_blocked_start_page(monkeypatch):
    def h(req):
        if req.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nDisallow: /private\n")
        return httpx.Response(200, html=page())
    log = serve(monkeypatch, h)
    skipped = []
    assert list(crawl("http://a.test/private", delay=0, on_skip=lambda u, w: skipped.append((u, w)))) == []
    assert skipped == [("http://a.test/private", "robots.txt izin vermiyor")] and log == ["a.test/robots.txt"]


def test_crawl_bad_arguments_fail_early_with_clear_errors(monkeypatch):
    log = serve(monkeypatch, lambda req: httpx.Response(200, html=page()))
    with pytest.raises(ValueError, match="--include geçerli bir regex değil"):
        list(crawl("http://a.test/", include="["))
    with pytest.raises(ValueError, match="--exclude geçerli bir regex değil"):
        list(crawl("http://a.test/", exclude="("))
    for bad in ("http://a.test:abc/", "example.com", "ftp://a.test/"):
        with pytest.raises(RuntimeError, match="URL"):
            list(crawl(bad))
        with pytest.raises(RuntimeError, match="URL"):
            map_site(bad)
    assert log == []


def test_crawl_include_exclude_depth_and_limit(monkeypatch):
    def h(req):
        p = req.url.path
        if p == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(200, html=page("/docs/a", "/blog/b", "/docs/c") if p == "/" else page(f"{p}/deep"))
    serve(monkeypatch, h)
    urls = [p.url for p in crawl("http://a.test/", depth=1, include="/docs/", delay=0)]
    assert urls == ["http://a.test/", "http://a.test/docs/a", "http://a.test/docs/c"]
    urls = [p.url for p in crawl("http://a.test/", depth=1, exclude="/docs/", delay=0)]
    assert urls == ["http://a.test/", "http://a.test/blog/b"]
    assert [p.url for p in crawl("http://a.test/", depth=0, delay=0)] == ["http://a.test/"]
    assert len(list(crawl("http://a.test/", limit=2, delay=0))) == 2


def test_extract_links_skips_malformed_href():
    html = '<a href="http://[bad">x</a><a href="/ok">y</a><a href="http://[::1">z</a>'
    assert extract_links(html, "http://a.test/") == ["http://a.test/ok"]


@pytest.mark.parametrize("href", ["/p?a=1&amp;b=2", "/p?a=1&#38;b=2", "/p?a=1&#x26;b=2"])
def test_extract_links_decodes_html_entities(href):
    assert extract_links(f'<a href="{href}">x</a>', "http://a.test/") == ["http://a.test/p?a=1&b=2"]
    assert extract_links('<a href="&#35;ust">x</a>', "http://a.test/") == []


def test_scrape_and_crawl_survive_malformed_href(monkeypatch):
    def h(req):
        if req.url.path == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(200, html=page("http://[bad", "/ok", "/x\x01y") if req.url.path == "/" else page())
    serve(monkeypatch, h)
    assert "Başlık" in scrape("http://a.test/", client=mk(h)).markdown
    skipped = []
    pages = list(crawl("http://a.test/", delay=0, on_skip=lambda u, w: skipped.append(w)))
    assert [p.url for p in pages] == ["http://a.test/", "http://a.test/ok"]
    assert len(skipped) == 1 and "Geçersiz URL" in skipped[0]


def test_link_regexes_are_linear_on_hostile_html():
    t = time.monotonic()
    assert extract_links("<a " * 60_000, "http://a.test/") == []
    assert not core._PDF_VIEWER.search("<embed " * 40_000)
    assert time.monotonic() - t < 2


# --- _get: yeniden deneme -------------------------------------------------------------------------------
@pytest.fixture
def sleeps(monkeypatch):
    out = []
    monkeypatch.setattr(core.time, "sleep", out.append)
    return out


def test_get_retries_connect_errors_without_sleeping_after_last_try(sleeps):
    calls = []

    def h(req):
        calls.append(1)
        raise httpx.ConnectError("reddedildi")
    with pytest.raises(RuntimeError, match="indirilemedi: reddedildi"):
        core._get("http://a.test/", mk(h))
    assert len(calls) == 3 and sleeps == [1, 2]


def test_get_retries_5xx_until_success_and_returns_last_5xx(sleeps):
    codes = iter([503, 503, 200])
    assert core._get("http://a.test/", mk(lambda req: httpx.Response(next(codes)))).status_code == 200
    assert sleeps == [1, 2]
    sleeps.clear()
    assert core._get("http://a.test/", mk(lambda req: httpx.Response(503))).status_code == 503
    assert sleeps == [1, 2]


def test_get_does_not_retry_permanent_errors(sleeps):
    calls = []

    def h(req):
        calls.append(1)
        raise httpx.UnsupportedProtocol("ftp?")
    with pytest.raises(RuntimeError, match="indirilemedi"):
        core._get("http://a.test/", mk(h))
    assert len(calls) == 1 and sleeps == []
    loop = mk(lambda req: httpx.Response(302, headers={"Location": "/"}))
    with pytest.raises(RuntimeError, match="redirect"):
        core._get("http://a.test/", loop)
    assert sleeps == []


@pytest.mark.parametrize("url, msg", [("example.com", "http://"), ("x.pdf", "http://"), ("http://a.test:abc/", "Geçersiz URL"),
                                      ("http://[::1/", "Geçersiz URL"), ("http://a.test/x\x01y", "Geçersiz URL")])
def test_scrape_bad_urls_fail_fast_with_runtime_error(sleeps, url, msg):
    def h(req):
        raise AssertionError("istek yapılmamalıydı")
    with pytest.raises(RuntimeError, match=msg):
        scrape(url, client=mk(h))
    assert sleeps == []


def test_get_redirect_with_check_is_followed_by_hand_and_bounded(monkeypatch):
    chain = iter(range(100))
    h = lambda req: httpx.Response(302, headers={"Location": f"/{next(chain)}"})
    seen = []
    with pytest.raises(RuntimeError, match="çok fazla yönlendirme"):
        core._get("http://a.test/", mk(h), check=lambda u: seen.append(u))
    assert len(seen) == core.MAX_REDIRECTS + 1
    with pytest.raises(RuntimeError, match="engel"):
        core._get("http://a.test/", mk(h), check=lambda u: "engel")
    with pytest.raises(RuntimeError, match="geçersiz yönlendirme"):
        core._get("http://a.test/", mk(lambda req: httpx.Response(302, headers={"Location": "http://[bad"})), check=lambda u: None)


# --- boyut ve süre sınırı (gerçek soket) ----------------------------------------------------------------
class _Hostile(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        if self.path == "/bomb":
            body = gzip.compress(b"a" * 8_000_000)
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:  # /drip: bitmeyen yavaş gövde
            self.end_headers()
            try:
                for _ in range(200):
                    self.wfile.write(b"x")
                    self.wfile.flush()
                    time.sleep(0.05)
            except OSError:
                pass


@pytest.fixture(scope="module")
def hostile():
    s = ThreadingHTTPServer(("127.0.0.1", 0), _Hostile)
    s.daemon_threads = True
    threading.Thread(target=s.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{s.server_address[1]}"
    s.shutdown()
    s.server_close()


def test_gzip_bomb_is_cut_at_decompressed_size_limit(hostile, monkeypatch):
    monkeypatch.setattr(core, "MAX_BYTES", 2**20)
    with core._client(timeout=5) as c, pytest.raises(RuntimeError, match="1 MB sınırını aştı"):
        core._get(hostile + "/bomb", c)


def test_slow_drip_response_is_cut_at_total_time_limit(hostile, monkeypatch):
    monkeypatch.setattr(core, "MAX_SECONDS", 0.4)
    t = time.monotonic()
    with core._client(timeout=5) as c, pytest.raises(RuntimeError, match="sn sınırını aştı"):
        core._get(hostile + "/drip", c)
    assert time.monotonic() - t < 3


def test_normal_gzip_response_is_still_decoded(monkeypatch):
    body = gzip.compress(page().encode())
    r = core._get("http://a.test/", mk(lambda req: httpx.Response(
        200, headers={"Content-Encoding": "gzip", "Content-Type": "text/html"}, content=body)))
    assert "Başlık" in r.text and "content-encoding" not in r.headers


# --- kodlama ve düz metin ----------------------------------------------------------------------------------
TR = "Türkçe içerik ğüşıöç ĞÜŞİÖÇ. " * 20


def tr_page(meta):
    return (f"<html><head>{meta}<title>Çişli Çağrı</title></head><body><article><h1>Çişli Çağrı</h1>"
            f"<p>{TR}</p></article></body></html>").encode("cp1254")


@pytest.mark.parametrize("meta, ctype", [
    ('<meta http-equiv="Content-Type" content="text/html; charset=windows-1254">', "text/html"),
    ('<meta charset="iso-8859-9">', "text/html"),
    ("", "text/html; charset=windows-1254"),
])
def test_scrape_decodes_non_utf8_pages(meta, ctype):
    c = mk(lambda req: httpx.Response(200, content=tr_page(meta), headers={"Content-Type": ctype}))
    p = scrape("http://a.test/", client=c)
    assert p.title == "Çişli Çağrı" and "Türkçe içerik ğüşıöç ĞÜŞİÖÇ" in p.markdown and "�" not in p.markdown


def test_scrape_file_decodes_non_utf8_html_like_http(tmp_path):
    f = tmp_path / "eski.html"
    f.write_bytes(tr_page('<meta charset="iso-8859-9">'))
    p = core.scrape_file(str(f))
    assert p.title == "Çişli Çağrı" and "ğüşıöç" in p.markdown


def test_hostile_meta_charset_does_not_crash():
    html = b'<html><head><meta charset="hex_codec"></head><body><article><p>' + b"\xe7a\xf0 " * 80 + b"</p></article></body></html>"
    p = scrape("http://a.test/", client=mk(lambda req: httpx.Response(200, content=html, headers={"Content-Type": "text/html"})))
    assert isinstance(p.markdown, str)


@pytest.mark.parametrize("ctype", ["text/plain; charset=utf-8", "text/markdown", "application/json", "application/ld+json"])
def test_scrape_returns_plain_text_and_json_as_is(ctype):
    body = "# Başlık\n\nHam *Markdown* ğüş.\n"
    p = scrape("http://a.test/r.md", client=mk(lambda req: httpx.Response(200, content=body.encode(), headers={"Content-Type": ctype})))
    assert p.markdown == body and p.links == [] and p.status == 200 and p.url == "http://a.test/r.md"


def test_scrape_html_served_as_text_plain_is_still_parsed_as_html():
    p = scrape("https://s.test/", client=mk(lambda req: httpx.Response(200, content=(HOME % BODY).encode(), headers={"Content-Type": "text/plain"})))
    assert "Merhaba" in p.markdown and "https://s.test/a" in p.links


@pytest.mark.parametrize("enc", ["utf-16", "utf-16-be", "utf-32", "utf-8-sig"])
def test_scrape_file_text_with_bom(tmp_path, enc):
    f = tmp_path / "a.txt"
    raw = "merhaba dünya çğş\n".encode(enc)
    f.write_bytes(b"\xfe\xff" + raw if enc == "utf-16-be" else raw)
    assert core.scrape_file(str(f)).markdown == "merhaba dünya çğş\n"


# --- map_site: sitemap -----------------------------------------------------------------------------------------
def test_map_site_unescapes_sitemap_and_follows_sitemap_index(monkeypatch):
    def h(req):
        p = req.url.path
        if p == "/sitemap.xml":
            return httpx.Response(200, text="<sitemapindex><sitemap><loc>http://a.test/sitemap-1.xml</loc></sitemap>"
                                            "<sitemap><loc>http://evil.test/s.xml</loc></sitemap></sitemapindex>")
        if p == "/sitemap-1.xml":
            return httpx.Response(200, text="<urlset><url><loc>http://a.test/p1</loc></url><url><loc> http://a.test/p?a=1&amp;b=2 </loc></url>"
                                            "<url><loc>http://other.test/z</loc></url></urlset>")
        return httpx.Response(200, html=page("/home-link"))
    log = serve(monkeypatch, h)
    assert map_site("http://a.test/") == ["http://a.test/p1", "http://a.test/p?a=1&b=2", "http://a.test/home-link"]
    assert not any(l.startswith("evil.test") for l in log)
    assert map_site("http://a.test/", limit=1) == ["http://a.test/p1"]
    assert map_site("http://a.test/", use_sitemap=False) == ["http://a.test/home-link"]


def test_map_site_http_errors(monkeypatch, sleeps):
    serve(monkeypatch, lambda req: httpx.Response(404, html=page("/x")))
    with pytest.raises(RuntimeError, match="HTTP 404"):
        map_site("http://a.test/")

    def sitemap_only(req):
        if req.url.path == "/sitemap.xml":
            return httpx.Response(200, text="<urlset><url><loc>http://a.test/p1</loc></url></urlset>")
        raise httpx.ConnectError("reddedildi")
    serve(monkeypatch, sitemap_only)
    assert map_site("http://a.test/") == ["http://a.test/p1"]
    serve(monkeypatch, lambda req: (_ for _ in ()).throw(httpx.ConnectError("reddedildi")))
    with pytest.raises(RuntimeError, match="indirilemedi"):
        map_site("http://a.test/")


# --- JS: Chromium sandbox -----------------------------------------------------------------------------------------
def fake_playwright(monkeypatch, error="stop"):
    launches = []

    class PWError(Exception):
        pass

    class Chromium:
        @staticmethod
        def launch(**kw):
            launches.append(kw)
            raise PWError(error)

    class CM:
        def __enter__(self):
            return types.SimpleNamespace(chromium=Chromium)

        def __exit__(self, *a):
            return False

    mod = types.ModuleType("playwright.sync_api")
    mod.Error, mod.sync_playwright = PWError, CM
    pkg = types.ModuleType("playwright")
    pkg.sync_api = mod
    monkeypatch.setitem(sys.modules, "playwright", pkg)
    monkeypatch.setitem(sys.modules, "playwright.sync_api", mod)
    return launches


def test_chromium_sandbox_on_unless_root_or_opted_out(monkeypatch):
    launches = fake_playwright(monkeypatch)
    monkeypatch.delenv("KAZI_NO_SANDBOX", raising=False)
    monkeypatch.setattr(core.os, "geteuid", lambda: 1000, raising=False)
    with pytest.raises(RuntimeError, match="JS ile indirilemedi"):
        core._fetch_js("http://a.test/")
    assert launches and all(kw["chromium_sandbox"] is True for kw in launches)
    launches.clear()
    monkeypatch.setenv("KAZI_NO_SANDBOX", "1")
    with pytest.raises(RuntimeError):
        core._fetch_js("http://a.test/")
    assert launches and all(kw["chromium_sandbox"] is False for kw in launches)
    launches.clear()
    monkeypatch.delenv("KAZI_NO_SANDBOX")
    monkeypatch.setattr(core.os, "geteuid", lambda: 0, raising=False)  # root'ta sandbox açılamaz
    with pytest.raises(RuntimeError):
        core._fetch_js("http://a.test/")
    assert launches and all(kw["chromium_sandbox"] is False for kw in launches)


def test_chromium_sandbox_failure_hints_opt_out(monkeypatch):
    fake_playwright(monkeypatch, error="No usable sandbox! Update your kernel")
    monkeypatch.delenv("KAZI_NO_SANDBOX", raising=False)
    monkeypatch.setattr(core.os, "geteuid", lambda: 1000, raising=False)
    with pytest.raises(RuntimeError, match="KAZI_NO_SANDBOX=1"):
        core._fetch_js("http://a.test/")
