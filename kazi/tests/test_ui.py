"""Arayüz testleri: gerçek uvicorn (yerel) + Chromium (Playwright), telefon boyutunda. Dış ağa çıkmaz."""
import glob
import os
import threading
import time

import pytest

pytest.importorskip("playwright.sync_api")
pytest.importorskip("uvicorn")

import uvicorn  # noqa: E402
from playwright.sync_api import Error as PWError  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

from kazi import web  # noqa: E402
from kazi.core import FetchError, Page  # noqa: E402

TOKEN = "t0ken-" + "x" * 24
EMPTY = Page(url="https://example.com/", markdown="", status=200)


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    for v in ("KAZI_ALLOW_PRIVATE", "KAZI_ALLOW_JS", "KAZI_TOKEN", "ANTHROPIC_API_KEY"):
        monkeypatch.delenv(v, raising=False)
    monkeypatch.setattr(web, "check_url", lambda url: ["93.184.216.34"])  # DNS'e çıkma


@pytest.fixture
def base(monkeypatch):
    server = uvicorn.Server(uvicorn.Config(web.create_app(token=TOKEN), host="127.0.0.1", port=0, log_level="warning"))
    t = threading.Thread(target=server.run, daemon=True)
    t.start()
    for _ in range(200):
        if server.started:
            break
        time.sleep(0.05)
    assert server.started
    yield f"http://127.0.0.1:{server.servers[0].sockets[0].getsockname()[1]}"
    server.should_exit = True
    t.join(5)


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        sandbox = os.geteuid() != 0
        try:
            b = p.chromium.launch(chromium_sandbox=sandbox)
        except PWError:
            base_dir = os.environ.get("PLAYWRIGHT_BROWSERS_PATH") or os.path.expanduser("~/.cache/ms-playwright")
            exes = sorted(glob.glob(os.path.join(base_dir, "chromium-*", "chrome-linux*", "chrome")), reverse=True)
            if not exes:
                pytest.skip("Chromium kurulu değil")
            b = p.chromium.launch(executable_path=exes[0], chromium_sandbox=sandbox)
        yield b
        b.close()


def open_page(browser, base, token=TOKEN):
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    if token:
        ctx.add_init_script(f"try {{ localStorage.setItem('kazi_token', {token!r}); }} catch (e) {{}}")
    pg = ctx.new_page()
    pg.goto(base + "/")
    return pg


def scrape(pg, url="ornek.com/yazi"):
    pg.fill("#u-scrape", url)
    pg.click("#b-scrape")


def test_default_setup_hides_js_box_and_extract_tab(browser, base, monkeypatch):
    monkeypatch.setattr(web, "scrape", lambda *a, **k: EMPTY)
    pg = open_page(browser, base)
    pg.wait_for_selector("#app:not([hidden])")
    pg.wait_for_function("fetch('/api/features', {headers: {Authorization: 'Bearer ' + localStorage.getItem('kazi_token')}}).then(r => r.ok)")
    assert pg.is_hidden("#l-js") and pg.is_hidden("#t-extract")
    assert pg.is_visible("#t-scrape") and pg.is_visible("#t-map")
    text = pg.inner_text("body")
    assert "Menü ve alt kısımlar da gelir" not in text and "Daha fazla yazı al" in text and "JavaScript'li" not in text
    assert pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth")  # yatay kayma yok
    scrape(pg)
    pg.wait_for_selector("#msg-scrape.err")
    msg = pg.inner_text("#msg-scrape")
    assert "okunacak yazı çıkmadı" in msg and "JavaScript" not in msg and "KAZI_" not in msg


def test_enabled_server_shows_js_box_extract_tab_and_js_hint(browser, base, monkeypatch):
    monkeypatch.setenv("KAZI_ALLOW_JS", "1")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-0000000000")
    sent = []

    def fake(url, **kw):
        sent.append(kw)
        return EMPTY

    monkeypatch.setattr(web, "scrape", fake)
    pg = open_page(browser, base)
    pg.wait_for_selector("#l-js:not([hidden])")
    pg.wait_for_selector("#t-extract:not([hidden])")
    pg.check("#o-js")
    scrape(pg)
    pg.wait_for_selector("#msg-scrape.err")
    assert "JavaScript'li site" in pg.inner_text("#msg-scrape") and sent[0]["js"] is True
    pg.click("#t-extract")
    assert pg.is_visible("#p-extract") and pg.is_hidden("#p-scrape")


def test_network_errors_show_plain_turkish_on_screen(browser, base, monkeypatch):
    def refused(url, **kw):
        raise FetchError("http://127.0.0.1:9/x indirilemedi: [Errno 111] Connection refused", "refused")

    monkeypatch.setattr(web, "scrape", refused)
    pg = open_page(browser, base)
    pg.wait_for_selector("#app:not([hidden])")
    scrape(pg, "http://ornek.com/")
    pg.wait_for_selector("#msg-scrape.err")
    msg = pg.inner_text("#msg-scrape")
    assert msg == web._FETCH["refused"] and "Errno" not in msg


def test_wrong_saved_password_goes_back_to_login_right_away(browser, base):
    pg = open_page(browser, base, token="eski-sifre-" + "y" * 20)
    pg.wait_for_selector("#login:not([hidden])")
    assert "Şifre kabul edilmedi" in pg.inner_text("#login-msg") and pg.is_hidden("#app")


def test_tab_keys_skip_hidden_extract_tab(browser, base):
    pg = open_page(browser, base)
    pg.wait_for_selector("#app:not([hidden])")
    pg.wait_for_function("document.getElementById('t-extract').hidden === true")
    pg.focus("#t-map")
    pg.keyboard.press("ArrowRight")  # son sekmeden başa döner; gizli sekmeye gitmez
    assert pg.get_attribute("#t-scrape", "aria-selected") == "true" and pg.get_attribute("#t-extract", "aria-selected") == "false"
