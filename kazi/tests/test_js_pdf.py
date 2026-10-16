"""js=True + PDF: gerçek Chromium (Playwright) ve yerel http.server; dış ağa çıkmaz."""
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from test_pdf import make_pdf

pytest.importorskip("playwright.sync_api")

from kazi.core import _fetch_js, scrape  # noqa: E402

PDF = make_pdf(["Tarayicidan gelen PDF metni"], title="JS PDF")
PAGE = ("<!doctype html><html><head><title>Sayfa</title></head><body><main id='a'><p>bos</p></main>"
        "<script>document.getElementById('a').innerHTML = '<article><h1>Baslik</h1><p>' + 'JSILE-' + '7788 ' "
        "+ 've yeterince uzun bir metin. '.repeat(15) + '</p></article>';</script></body></html>")


class _H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        body, ctype = (PDF, "application/pdf") if self.path == "/rapor.pdf" else (PAGE.encode(), "text/html; charset=utf-8")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


@pytest.fixture(scope="module")
def base():
    s = ThreadingHTTPServer(("127.0.0.1", 0), _H)
    s.daemon_threads = True
    threading.Thread(target=s.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{s.server_address[1]}"
    try:
        _fetch_js(url + "/")
    except RuntimeError as e:
        s.shutdown()
        if "Executable doesn't exist" in str(e) or "playwright install" in str(e):
            pytest.skip(f"Chromium yok: {e}")
        raise
    yield url
    s.shutdown()
    s.server_close()


def test_scrape_pdf_url_with_js(base):
    p = scrape(base + "/rapor.pdf", js=True)
    assert p.markdown == "## Sayfa 1\n\nTarayicidan gelen PDF metni" and p.title == "JS PDF"
    assert p.url == base + "/rapor.pdf" and p.status == 200


def test_scrape_normal_page_with_js_still_runs_script(base):
    p = scrape(base + "/sayfa", js=True)
    assert "JSILE-7788" in p.markdown
