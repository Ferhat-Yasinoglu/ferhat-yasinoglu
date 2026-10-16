"""JS render testleri: yerel http.server + gerçek Chromium (Playwright). Dış ağa çıkmaz."""
import json
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import httpx
import pytest

pytest.importorskip("playwright.sync_api")

from kazi.core import UA, _fetch_js, scrape  # noqa: E402

SENTINEL = "JSILE-YAZILDI-4242"
SENT = "Bu cümle sayfaya yalnızca JavaScript çalışınca eklenir. " * 12
STATIC = "Yükleniyor"


def _article(title: str) -> str:
    return f"<article><h1>{title}</h1><p>{SENT}</p><p>{SENT}</p></article>"


def _js(text: str) -> str:
    """Metni JS ifadesine böler; sentinel kaynak HTML'de bitişik geçmesin (yoksa yanlış pozitif olur)."""
    return "+".join(json.dumps(text[i:i + 4]) for i in range(0, len(text), 4))


def _page(script: str, extra: str = "") -> str:
    return (f'<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>JS Sayfası</title></head>'
            f'<body><main id="app"><p>{STATIC}</p></main>{extra}<script>{script}</script></body></html>')


FETCH = ("fetch('/api/icerik').then(r => r.json()).then(d => {"
         "document.getElementById('app').innerHTML = d.html;});")
CHAIN = ("setTimeout(() => {const a = document.getElementById('app'); a.innerHTML = '<p>iskelet</p>';"
         "setTimeout(() => {a.innerHTML = %s;}, 400);}, 400);" % _js(_article(SENTINEL)))
LONGPOLL = (f"document.getElementById('app').innerHTML = {_js(_article(SENTINEL))};"
            "fetch('/asili').catch(() => {});")


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="text/html; charset=utf-8", headers=()):
        data = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        for k, v in headers:
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        s = self.server
        s.seen.append((self.path, self.headers.get("User-Agent")))
        if self.path == "/":
            self._send(200, _page(FETCH))
        elif self.path == "/api/icerik":
            self._send(200, json.dumps({"html": _article(SENTINEL)}), "application/json")
        elif self.path == "/zincir":
            self._send(200, _page(CHAIN))
        elif self.path == "/uzun":
            self._send(200, _page(LONGPOLL))
        elif self.path in ("/asili", "/askida"):
            s.stop.wait(30)
        elif self.path == "/yonlendir":
            self._send(302, "", headers=[("Location", "/")])
        elif self.path == "/yok":
            self._send(404, _page("", "<p>Sayfa bulunamadı</p>"))
        else:
            self._send(404, "")


@pytest.fixture(scope="module")
def srv():
    s = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    s.daemon_threads = True
    s.seen, s.stop = [], threading.Event()
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()
    s.base = f"http://127.0.0.1:{s.server_address[1]}"
    yield s
    s.stop.set()
    s.shutdown()
    s.server_close()


@pytest.fixture(scope="module")
def base(srv):
    try:
        _fetch_js(srv.base + "/yok")
    except RuntimeError as e:
        if "Executable doesn't exist" in str(e) or "playwright install" in str(e):
            pytest.skip(f"Chromium yok: {e}")
        raise
    return srv.base


@pytest.fixture
def plain():
    return httpx.Client(headers={"User-Agent": UA}, trust_env=False, follow_redirects=True)


def test_js_true_returns_dom_written_by_script(base):
    p = scrape(base + "/", js=True)
    assert SENTINEL in p.markdown and "yalnızca JavaScript çalışınca eklenir" in p.markdown
    assert p.status == 200 and p.url == base + "/"


def test_js_false_does_not_run_script(base, plain):
    p = scrape(base + "/", js=False, client=plain)
    assert SENTINEL not in p.markdown and "JavaScript çalışınca" not in p.markdown
    assert SENTINEL not in plain.get(base + "/").text


def test_js_waits_for_chained_timers(base):
    html, _, _ = _fetch_js(base + "/zincir")
    assert SENTINEL in html


def test_js_sends_kazi_user_agent(base, srv):
    srv.seen.clear()
    _fetch_js(base + "/")
    assert ("/", UA) in srv.seen


def test_js_returns_final_url_and_status(base):
    html, status, final = _fetch_js(base + "/yonlendir")
    assert status == 200 and final == base + "/" and "<article" in html
    html, status, final = _fetch_js(base + "/yok")
    assert status == 404 and "Sayfa bulunamadı" in html


def test_js_does_not_block_on_open_connection(base):
    t = time.monotonic()
    html, status, _ = _fetch_js(base + "/uzun", timeout=3)
    assert SENTINEL in html and status == 200
    assert time.monotonic() - t < 15  # networkidle hiç gelmese de sınırlı bekler


def test_js_timeout_raises_runtime_error(base):
    with pytest.raises(RuntimeError, match="JS ile indirilemedi"):
        _fetch_js(base + "/askida", timeout=1)


def test_js_connection_refused_raises_runtime_error(base):
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    with pytest.raises(RuntimeError, match="JS ile indirilemedi"):
        _fetch_js(f"http://127.0.0.1:{port}/", timeout=5)
