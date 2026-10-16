"""Web API testleri: FastAPI TestClient + monkeypatch + sahte DNS/taşıyıcı. Dış ağa çıkmaz."""
import importlib.util
import logging
import socket
import ssl
import subprocess
import threading
import time
from pathlib import Path
from types import SimpleNamespace as NS

import httpx
import pytest
from fastapi.testclient import TestClient

import kazi.cli as cli
import kazi.extract as ex
from kazi import core, safety, web
from kazi.core import FetchError, Page
from kazi.web import create_app

TOKEN = "t0ken-" + "x" * 24
PUBLIC = "93.184.216.34"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
HTML = ("<html><head><title>Ana Sayfa</title></head><body><article><h1>Merhaba Dünya</h1><p>%s</p></article>"
        "<a href='/iki'>iki</a></body></html>" % ("Bu bir deneme paragrafıdır. " * 20))
INTERNAL = ["http://127.0.0.1/", "http://10.0.0.1/", "http://169.254.169.254/latest/meta-data/", "http://[::1]/",
            "http://0x7f000001/", "http://2130706433/", "http://localhost/", "localhost:8000",
            "http://kullanici:sifre@127.0.0.1/", "http://example.com@127.0.0.1/", "file:///etc/passwd"]


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    for v in ("KAZI_ALLOW_PRIVATE", "KAZI_ALLOW_JS", "KAZI_TOKEN", "ANTHROPIC_API_KEY"):
        monkeypatch.delenv(v, raising=False)


@pytest.fixture
def public_dns(monkeypatch):
    def fake(host, port, type=0):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (PUBLIC, port))]

    monkeypatch.setattr(safety, "_resolve", fake)


@pytest.fixture
def modules(monkeypatch):
    """modules("playwright") → yalnızca bunlar kurulu görünür (playwright, anthropic); gerisi gerçek."""
    real = importlib.util.find_spec

    def set_have(*have):
        monkeypatch.setattr(web.importlib.util, "find_spec",
                            lambda n, *a: (object() if n in have else None) if n in ("playwright", "anthropic") else real(n, *a))

    return set_have


@pytest.fixture
def static(tmp_path):
    (tmp_path / "index.html").write_text("<!doctype html><title>kazi</title><p>merhaba</p>", encoding="utf-8")
    return tmp_path


@pytest.fixture
def app(static):
    return create_app(token=TOKEN, static_dir=static)


@pytest.fixture
def client(app):
    return TestClient(app, headers=AUTH, raise_server_exceptions=False)


@pytest.fixture
def anon(app):
    return TestClient(app, raise_server_exceptions=False)


class Calls:
    """web.scrape yerine geçer: çağrıları kaydeder, hazır Page ya da istisna döndürür."""

    def __init__(self, monkeypatch, result=None):
        self.result, self.calls = result or Page(url="https://example.com/", markdown="# Merhaba", title="Başlık",
                                                links=["https://example.com/a"], status=200), []
        monkeypatch.setattr(web, "scrape", self)

    def __call__(self, url, **kw):
        self.calls.append((url, kw))
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


# ---- açık uçlar ----

def test_health_needs_no_token(anon):
    r = anon.get("/api/health")
    assert r.status_code == 200 and r.json() == {"ok": True}


def test_index_served_without_token(anon):
    r = anon.get("/")
    assert r.status_code == 200 and "text/html" in r.headers["content-type"] and "merhaba" in r.text


def test_missing_index_is_turkish_json_404(tmp_path):
    r = TestClient(create_app(token=TOKEN, static_dir=tmp_path)).get("/")
    assert r.status_code == 404 and "arayüz" in r.json()["error"].lower()


def test_default_app_serves_packaged_index():
    r = TestClient(create_app(token=TOKEN)).get("/")
    assert r.status_code == 200 and "<html" in r.text.lower()


def test_static_files_are_public(static):
    (static / "app.js").write_text("console.log(1)", encoding="utf-8")
    c = TestClient(create_app(token=TOKEN, static_dir=static))
    assert c.get("/static/app.js").status_code == 200


# ---- kimlik ----

@pytest.mark.parametrize("path", ["/api/scrape", "/api/map", "/api/extract"])
@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer yanlis"}, {"Authorization": "Bearer "},
                                     {"Authorization": "Bearer"}, {"Authorization": f"Basic {TOKEN}"},
                                     {"Authorization": TOKEN}, {"Authorization": f"Bearer {TOKEN}x"},
                                     {"Authorization": f"Bearer {TOKEN[:-1]}"}])
def test_missing_or_wrong_token_is_401(anon, path, headers):
    r = anon.post(path, json={"url": "https://example.com"}, headers=headers)
    assert r.status_code == 401 and r.json()["error"] and r.headers["www-authenticate"] == "Bearer"


def test_default_deny_for_unknown_paths(anon, client):
    for p in ("/api/yok", "/gizli", "/api/scrape/", "/openapi.json", "/docs"):
        assert anon.get(p).status_code == 401, p
    assert client.get("/api/yok").status_code == 404
    assert client.get("/openapi.json").status_code == 404  # otomatik belge yok


def test_get_on_post_endpoint_is_405_with_turkish_error(client):
    r = client.get("/api/scrape")
    assert r.status_code == 405 and r.json() == {"error": "Bu adres bu yöntemi desteklemiyor."}


def test_valid_token_case_insensitive_scheme(anon, monkeypatch, public_dns):
    Calls(monkeypatch)
    for scheme in ("Bearer", "bearer", "BEARER"):
        r = anon.post("/api/scrape", json={"url": "https://example.com"}, headers={"Authorization": f"{scheme} {TOKEN}"})
        assert r.status_code == 200, scheme


def test_token_compared_with_compare_digest(monkeypatch, anon, public_dns):
    Calls(monkeypatch)
    seen = []
    real = web.hmac.compare_digest
    monkeypatch.setattr(web.hmac, "compare_digest", lambda a, b: seen.append((a, b)) or real(a, b))
    anon.post("/api/scrape", json={"url": "https://example.com"}, headers=AUTH)
    anon.post("/api/scrape", json={"url": "https://example.com"}, headers={"Authorization": "Bearer yanlis"})
    assert len(seen) == 2 and all(len(a) == len(b) == 32 for a, b in seen)  # sha256 özetleri: uzunluk sızmaz


def test_repeated_wrong_tokens_are_slowed_down_but_the_right_one_always_works(app, monkeypatch, public_dns):
    Calls(monkeypatch)
    c = TestClient(app, raise_server_exceptions=False)
    wrong = {"Authorization": "Bearer x"}
    for _ in range(10):
        assert c.post("/api/scrape", json={"url": "https://a.com"}, headers=wrong).status_code == 401
    r = c.post("/api/scrape", json={"url": "https://a.com"}, headers=wrong)
    assert r.status_code == 429 and int(r.headers["retry-after"]) > 0 and "error" in r.json()
    assert c.post("/api/scrape", json={"url": "https://a.com"}, headers=AUTH).status_code == 200  # sahibi kilitlenmez
    assert c.get("/api/features", headers=AUTH).status_code == 200
    assert c.get("/api/health").status_code == 200


def test_requests_without_credentials_are_not_failed_logins(app, monkeypatch, public_dns):
    """Botlar (/.env, /wp-login.php) ve tarayıcı simgesi istekleri yanlış giriş sayılmaz; hepsi aynı IP görünse de."""
    Calls(monkeypatch)
    c = TestClient(app, raise_server_exceptions=False)
    for p in ["/.env", "/wp-login.php", "/admin", "/.git/config", "/phpmyadmin", "/robots.txt", "/sitemap.xml",
              "/xmlrpc.php", "/login", "/api/users", "/apple-touch-icon.png"] * 3:
        assert c.get(p).status_code == 401
    assert c.post("/api/scrape", json={"url": "https://a.com"}, headers=AUTH).status_code == 200
    wrong = {"Authorization": "Bearer x"}  # sayaç sıfırdan başlar: 10 yanlış deneme hâlâ 401
    assert [c.get("/x", headers=wrong).status_code for _ in range(11)] == [401] * 10 + [429]


# ---- scrape ----

def test_scrape_contract(client, monkeypatch, public_dns):
    s = Calls(monkeypatch)
    r = client.post("/api/scrape", json={"url": "https://example.com/"})
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/json")
    assert r.json() == {"url": "https://example.com/", "title": "Başlık", "markdown": "# Merhaba",
                        "links": ["https://example.com/a"], "status": 200}
    url, kw = s.calls[0]
    assert url == "https://example.com/" and kw["js"] is False and kw["only_main"] is True
    assert kw["check"] is safety.redirect_check and isinstance(kw["client"], httpx.Client)
    assert kw["max_bytes"] == web.MAX_PAGE_BYTES == 3 * 2**20


def test_scrape_full_flag_and_url_normalised(client, monkeypatch, public_dns):
    s = Calls(monkeypatch)
    client.post("/api/scrape", json={"url": "  example.com/yol?a=1  ", "full": True})
    client.post("/api/scrape", json={"url": "//example.org/x"})
    assert s.calls[0][0] == "https://example.com/yol?a=1" and s.calls[0][1]["only_main"] is False
    assert s.calls[1][0] == "https://example.org/x"


def test_scrape_real_core_through_pinned_transport(client, monkeypatch, public_dns):
    seen = []

    class Inner(httpx.BaseTransport):
        def handle_request(self, request):
            seen.append(request)
            return httpx.Response(200, headers={"content-type": "text/html; charset=utf-8"}, content=HTML.encode())

    monkeypatch.setattr(safety, "_inner_transport", lambda: Inner())
    r = client.post("/api/scrape", json={"url": "https://example.com/"})
    assert r.status_code == 200
    d = r.json()
    assert d["title"] and "Merhaba Dünya" in d["markdown"] and d["links"] == ["https://example.com/iki"]
    assert d["url"] == "https://example.com/" and d["status"] == 200
    assert seen[0].url.host == PUBLIC and seen[0].headers["host"] == "example.com"


@pytest.mark.parametrize("code,word", [(404, "bulunamadı"), (403, "izin vermedi"), (429, "çok fazla"), (503, "hata veriyor"), (418, "418")])
def test_upstream_http_errors_become_turkish_errors(client, monkeypatch, public_dns, code, word):
    Calls(monkeypatch, Page(url="https://example.com/", markdown="", status=code))
    r = client.post("/api/scrape", json={"url": "https://example.com/"})
    assert r.status_code == 502 and word in r.json()["error"] and list(r.json()) == ["error"]


def test_empty_page_is_200_with_empty_markdown(client, monkeypatch, public_dns):
    Calls(monkeypatch, Page(url="https://example.com/", markdown="", status=200))
    r = client.post("/api/scrape", json={"url": "https://example.com/"})
    assert r.status_code == 200 and r.json()["markdown"] == ""


# ---- js ----

def test_js_is_off_by_default(client, monkeypatch, public_dns, modules):
    modules("playwright")
    s = Calls(monkeypatch)
    r = client.post("/api/scrape", json={"url": "https://example.com/", "js": True})
    assert r.status_code == 403 and "JavaScript" in r.json()["error"] and "KAZI_" not in r.json()["error"]
    assert s.calls == []


def test_js_allowed_with_env(client, monkeypatch, public_dns, modules):
    modules("playwright")
    s = Calls(monkeypatch)
    monkeypatch.setenv("KAZI_ALLOW_JS", "1")
    assert client.post("/api/scrape", json={"url": "https://example.com/", "js": True}).status_code == 200
    assert s.calls[0][1]["js"] is True and s.calls[0][1]["check"] is safety.redirect_check
    monkeypatch.setenv("KAZI_ALLOW_JS", "yes")
    assert client.post("/api/scrape", json={"url": "https://example.com/", "js": True}).status_code == 403


def test_js_refused_when_playwright_is_missing(client, monkeypatch, public_dns, modules):
    modules()  # KAZI_ALLOW_JS=1 ama Playwright yok: tarayıcı hatası yerine baştan anlaşılır ret
    s = Calls(monkeypatch)
    monkeypatch.setenv("KAZI_ALLOW_JS", "1")
    r = client.post("/api/scrape", json={"url": "https://example.com/", "js": True})
    assert r.status_code == 403 and "pip" not in r.json()["error"] and s.calls == []


# ---- özellikler (arayüz neyi göstereceğini buradan öğrenir) ----

def test_features_need_token(anon):
    assert anon.get("/api/features").status_code == 401


def test_features_report_only_what_really_works(client, monkeypatch, modules):
    modules("playwright", "anthropic")
    assert client.get("/api/features").json() == {"js": False, "extract": False}
    monkeypatch.setenv("KAZI_ALLOW_JS", "1")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-0000000000")
    assert client.get("/api/features").json() == {"js": True, "extract": True}
    modules()  # ayarlar açık ama paketler kurulu değil
    assert client.get("/api/features").json() == {"js": False, "extract": False}
    modules("anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "   ")
    assert client.get("/api/features").json() == {"js": False, "extract": False}


# ---- SSRF ----

@pytest.mark.parametrize("url", INTERNAL)
@pytest.mark.parametrize("path", ["/api/scrape", "/api/map", "/api/extract"])
def test_internal_urls_rejected_before_any_download(client, monkeypatch, path, url):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-0000000000")
    monkeypatch.setattr(ex, "_make_client", lambda: NS())
    s = Calls(monkeypatch)
    m = []
    monkeypatch.setattr(web, "map_site", lambda *a, **k: m.append(a))
    r = client.post(path, json={"url": url, "prompt": "x"})
    assert r.status_code == 400 and list(r.json()) == ["error"]
    assert s.calls == [] and m == []


def test_ssrf_error_does_not_reveal_address_details(client):
    r = client.post("/api/scrape", json={"url": "http://169.254.169.254/latest/meta-data/"})
    assert r.status_code == 400 and "169.254" not in r.text and "güvenlik" in r.json()["error"]


def test_real_loopback_server_is_never_contacted(client):
    hits = []

    def serve():
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        s.listen(5)
        s.settimeout(1.5)
        ready.append(s.getsockname()[1])
        try:
            while True:
                c, _ = s.accept()
                hits.append(c.recv(100))
                c.close()
        except OSError:
            pass
        finally:
            s.close()

    ready = []
    t = threading.Thread(target=serve, daemon=True)
    t.start()
    while not ready:
        time.sleep(0.01)
    for host in ("127.0.0.1", "localhost", "2130706433", "0x7f000001"):
        assert client.post("/api/scrape", json={"url": f"http://{host}:{ready[0]}/"}).status_code == 400
        assert client.post("/api/map", json={"url": f"http://{host}:{ready[0]}/"}).status_code == 400
    t.join(3)
    assert hits == []


def _redirecting(monkeypatch, target, dns_table=None):
    seen = []

    def fake(host, port, type=0):
        ips = {"intranet.test": "10.0.0.5", **(dns_table or {})}.get(host, PUBLIC)
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ips, port))]

    class Inner(httpx.BaseTransport):
        def handle_request(self, request):
            seen.append(request)
            return httpx.Response(302, headers={"Location": target})

    monkeypatch.setattr(safety, "_resolve", fake)
    monkeypatch.setattr(safety, "_inner_transport", lambda: Inner())
    return seen


@pytest.mark.parametrize("target", ["http://169.254.169.254/latest/meta-data/", "http://intranet.test/admin",
                                    "http://[::1]:8000/", "http://0x7f000001/", "//127.0.0.1/x"])
def test_scrape_redirect_to_internal_network_is_stopped(client, monkeypatch, target):
    seen = _redirecting(monkeypatch, target)
    r = client.post("/api/scrape", json={"url": "https://example.com/"})
    assert r.status_code in (400, 502) and "güvenlik" in r.json()["error"]
    assert [q.url.host for q in seen] == [PUBLIC]  # iç adrese tek istek bile gitmedi


def test_map_redirect_to_internal_network_is_stopped(client, monkeypatch):
    seen = _redirecting(monkeypatch, "http://10.0.0.1/")  # map_site check kullanmaz: taşıyıcı katmanı tutar
    r = client.post("/api/map", json={"url": "https://example.com/"})
    assert r.status_code in (400, 502) and "error" in r.json()
    assert seen and all(q.url.host == PUBLIC for q in seen)


def test_dns_rebinding_is_stopped_end_to_end(client, monkeypatch):
    answers = [[PUBLIC], ["127.0.0.1"], ["127.0.0.1"]]  # kontrol anında genel, bağlanırken iç adres

    def fake(host, port, type=0):
        ips = answers.pop(0) if len(answers) > 1 else answers[0]
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, port)) for ip in ips]

    seen = []

    class Inner(httpx.BaseTransport):
        def handle_request(self, request):
            seen.append(request)
            return httpx.Response(200, content=b"x")

    monkeypatch.setattr(safety, "_resolve", fake)
    monkeypatch.setattr(safety, "_inner_transport", lambda: Inner())
    r = client.post("/api/scrape", json={"url": "https://rebind.example/"})
    assert r.status_code in (400, 502) and "güvenlik" in r.json()["error"] and seen == []


def test_links_in_response_are_capped(client, monkeypatch, public_dns):
    links = [f"https://example.com/{i}" for i in range(web.MAX_LINKS + 500)]
    Calls(monkeypatch, Page(url="https://example.com/", markdown="# x", links=links, status=200))
    r = client.post("/api/scrape", json={"url": "https://example.com/"})
    assert r.status_code == 200 and r.json()["links"] == links[:web.MAX_LINKS]


# ---- ağ / TLS / boyut hataları: sade Türkçe, bekletmeden ----

def _chained(outer, inner):
    outer.__cause__ = inner
    return outer


def _inner_raises(monkeypatch, make):
    class Inner(httpx.BaseTransport):
        def handle_request(self, request):
            raise make()

    monkeypatch.setattr(safety, "_inner_transport", lambda: Inner())


@pytest.mark.parametrize("kind", list(web._FETCH))
def test_fetch_error_kinds_become_plain_turkish(client, monkeypatch, public_dns, kind):
    Calls(monkeypatch, FetchError("https://example.com/ indirilemedi: [Errno 111] Connection refused", kind))
    r = client.post("/api/scrape", json={"url": "https://example.com/"})
    assert r.status_code == 502 and r.json() == {"error": web._FETCH[kind]} and "Errno" not in r.text


@pytest.mark.parametrize("make,word,slept", [
    (lambda: _chained(httpx.ConnectError("[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: Hostname mismatch"),
                      ssl.SSLCertVerificationError(1, "certificate verify failed")), "sertifikası", []),
    (lambda: _chained(httpx.ConnectError("[SSL: WRONG_VERSION_NUMBER] wrong version number"),
                      ssl.SSLError(1, "[SSL: WRONG_VERSION_NUMBER] wrong version number")), "https", []),
    (lambda: _chained(httpx.ConnectError("[Errno 111] Connection refused"), ConnectionRefusedError(111, "Connection refused")),
     "bağlanılamadı", []),
    (lambda: httpx.ReadTimeout("timed out"), "geç yanıt verdi", [1, 2]),
    (lambda: httpx.ReadError("peer closed"), "koptu", [1, 2]),
])
def test_real_core_network_errors_are_plain_turkish_and_not_retried_when_pointless(
        client, monkeypatch, public_dns, make, word, slept):
    sleeps = []
    monkeypatch.setattr(core.time, "sleep", sleeps.append)
    _inner_raises(monkeypatch, make)
    r = client.post("/api/scrape", json={"url": "https://example.com/"})
    assert r.status_code == 502 and word in r.json()["error"]
    for raw in ("SSL", "Errno", "timed out", "peer closed", "_ssl.c", "Connection refused"):
        assert raw not in r.text, raw
    assert sleeps == slept  # sertifika ve bağlantı reddi bekletmez; zaman aşımı/kopma 1+2 sn dener


def test_oversized_page_is_refused_with_plain_message(client, monkeypatch, public_dns):
    class Inner(httpx.BaseTransport):
        def handle_request(self, request):
            return httpx.Response(200, headers={"content-type": "text/html"}, content=b"x" * (web.MAX_PAGE_BYTES + 1))

    monkeypatch.setattr(safety, "_inner_transport", lambda: Inner())
    r = client.post("/api/scrape", json={"url": "https://example.com/"})
    assert r.status_code == 502 and r.json() == {"error": web._FETCH["big"]} and "3 MB" in r.json()["error"]


def test_broken_pdf_and_redirect_loops_are_plain_turkish(client, monkeypatch, public_dns):
    class Inner(httpx.BaseTransport):
        def handle_request(self, request):
            if request.url.path == "/loop":
                return httpx.Response(302, headers={"Location": "/loop"})
            return httpx.Response(200, headers={"content-type": "application/pdf"}, content=b"%PDF-1.4 bozuk")

    monkeypatch.setattr(safety, "_inner_transport", lambda: Inner())
    r = client.post("/api/scrape", json={"url": "https://example.com/a.pdf"})
    assert r.status_code == 502 and r.json() == {"error": web._FETCH["pdf"]} and "startxref" not in r.text
    r = client.post("/api/scrape", json={"url": "https://example.com/loop"})
    assert r.status_code == 502 and r.json() == {"error": web._FETCH["hops"]}


# ---- HEAD ----

def test_head_works_on_health_and_index_for_uptime_monitors(anon):
    r = anon.head("/api/health")
    assert r.status_code == 200 and r.content == b"" and r.headers["cache-control"] == "no-store"
    r = anon.head("/")
    assert r.status_code == 200 and "text/html" in r.headers["content-type"] and r.content == b""
    assert anon.head("/api/scrape").status_code == 401  # herkese açık olan yalnız bu ikisi


# ---- map ----

def test_map_contract_and_limit(client, monkeypatch, public_dns):
    got = []
    monkeypatch.setattr(web, "map_site", lambda url, limit, client, max_bytes: got.append((url, limit, client, max_bytes)) or ["https://example.com/a"])
    assert client.post("/api/map", json={"url": "example.com"}).json() == {"urls": ["https://example.com/a"]}
    client.post("/api/map", json={"url": "https://example.com", "limit": 7})
    assert [(g[0], g[1]) for g in got] == [("https://example.com", 100), ("https://example.com", 7)]
    assert isinstance(got[0][2], httpx.Client) and got[0][3] == web.MAX_PAGE_BYTES


@pytest.mark.parametrize("limit", [0, -1, 501, "x", 1.5, None])
def test_map_limit_validated(client, limit):
    assert client.post("/api/map", json={"url": "https://example.com", "limit": limit}).status_code == 422


# ---- extract ----

def fake_extract(monkeypatch, result=None, boom=None):
    calls = []

    def extract(markdown, schema=None, prompt=None, model=None, client=None, max_chars=0):
        calls.append(NS(markdown=markdown, schema=schema, prompt=prompt, client=client))
        if boom:
            raise boom
        return result or {"data": {"baslik": "Merhaba"}, "model": "m", "truncated": False, "warnings": ["uyarı 1"]}

    monkeypatch.setattr(ex, "extract", extract)
    monkeypatch.setattr(ex, "_make_client", lambda: "istemci")
    return calls


def test_extract_without_api_key_is_503_and_downloads_nothing(client, monkeypatch, public_dns):
    s = Calls(monkeypatch)
    r = client.post("/api/extract", json={"url": "https://example.com", "prompt": "fiyat"})
    assert r.status_code == 503 and "ANTHROPIC_API_KEY" in r.json()["error"] and s.calls == []


def test_extract_contract(client, monkeypatch, public_dns):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-0000000000")
    s = Calls(monkeypatch)
    calls = fake_extract(monkeypatch)
    schema = {"type": "object", "properties": {"baslik": {"type": "string"}}}
    r = client.post("/api/extract", json={"url": "https://example.com", "prompt": "başlığı çıkar", "schema": schema})
    assert r.status_code == 200 and r.json() == {"data": {"baslik": "Merhaba"}, "warnings": ["uyarı 1"]}
    assert (calls[0].markdown, calls[0].schema, calls[0].prompt, calls[0].client) == ("# Merhaba", schema, "başlığı çıkar", "istemci")
    assert s.calls[0][1]["check"] is safety.redirect_check and s.calls[0][1]["max_bytes"] == web.MAX_PAGE_BYTES
    r = client.post("/api/extract", json={"url": "https://example.com", "prompt": "", "schema": None})
    assert r.status_code == 200 and calls[1].schema is None and calls[1].prompt == ""


def test_extract_bad_schema_and_empty_page(client, monkeypatch, public_dns):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-0000000000")
    Calls(monkeypatch)
    fake_extract(monkeypatch, boom=ValueError("iç ayrıntı /root/gizli.py"))
    r = client.post("/api/extract", json={"url": "https://example.com", "schema": {"type": "array"}})
    assert r.status_code == 400 and "Şema" in r.json()["error"] and "gizli" not in r.text
    Calls(monkeypatch, Page(url="https://example.com/", markdown="  ", status=200))
    r = client.post("/api/extract", json={"url": "https://example.com", "prompt": "x"})
    assert r.status_code == 422 and "metin" in r.json()["error"]


def test_extract_api_failure_is_502_without_key_leak(client, monkeypatch, public_dns):
    key = "sk-ant-api03-SECRETKEYSECRETKEY"
    monkeypatch.setenv("ANTHROPIC_API_KEY", key)
    Calls(monkeypatch)
    fake_extract(monkeypatch, boom=ex.ExtractError(f"Anthropic API hatası (500): kötü anahtar {key} reddedildi"))
    r = client.post("/api/extract", json={"url": "https://example.com", "prompt": "x"})
    assert r.status_code == 502 and key not in r.text and "SECRETKEY" not in r.text and "Anthropic API hatası" in r.json()["error"]


# ---- hata sızıntısı ----

def test_runtime_errors_are_scrubbed(client, monkeypatch, public_dns):
    Calls(monkeypatch, RuntimeError(f"indirilemedi: {TOKEN} sk-ant-abcdefghijkl /root/.cache/ms-playwright/chromium/chrome çöktü"))
    r = client.post("/api/scrape", json={"url": "https://example.com/"})
    assert r.status_code == 502
    body = r.text
    assert TOKEN not in body and "sk-ant" not in body and "/root" not in body and "ms-playwright" not in body
    assert "indirilemedi" in r.json()["error"]


def test_unexpected_exceptions_return_generic_500(client, monkeypatch, public_dns, caplog):
    Calls(monkeypatch, KeyError("ic-anahtar-/etc/passwd"))
    with caplog.at_level(logging.DEBUG):
        r = client.post("/api/scrape", json={"url": "https://example.com/"})
    assert r.status_code == 500 and r.json() == {"error": "Beklenmeyen bir hata oldu. Biraz sonra tekrar deneyin."}
    assert "passwd" not in r.text and "passwd" not in caplog.text and "KeyError" in caplog.text


def test_validation_errors_do_not_echo_input(client):
    secret = "GIZLI" * 1000
    r = client.post("/api/scrape", json={"url": secret})
    assert r.status_code == 422 and "GIZLI" not in r.text and r.json() == {"error": "'url' alanı çok uzun."}
    r = client.post("/api/scrape", json={"url": ["GIZLI"]})
    assert r.status_code == 422 and "GIZLI" not in r.text
    assert client.post("/api/scrape", json={}).json() == {"error": "'url' alanı gerekli."}
    assert client.post("/api/scrape", content=b"{bad", headers={"content-type": "application/json"}).status_code == 422
    assert client.post("/api/scrape", json=["x"]).status_code == 422


def test_deeply_nested_json_is_rejected_cleanly(client):
    r = client.post("/api/extract", content=b"[" * 30000 + b"]" * 30000, headers={"content-type": "application/json"})
    assert r.status_code in (400, 422) and list(r.json()) == ["error"]
    assert "Traceback" not in r.text


def test_token_never_logged_or_printed(app, monkeypatch, public_dns, caplog, capsys):
    Calls(monkeypatch)
    c = TestClient(app, raise_server_exceptions=False)
    with caplog.at_level(logging.DEBUG):
        c.post("/api/scrape", json={"url": "https://example.com/"}, headers=AUTH)
        c.post("/api/scrape", json={"url": "https://example.com/"}, headers={"Authorization": "Bearer yanlis-token-123"})
        c.post("/api/scrape", json={"url": "http://127.0.0.1/"}, headers=AUTH)
        c.get("/api/health", headers=AUTH)
    out = capsys.readouterr()
    for text in (caplog.text, out.out, out.err):
        assert TOKEN not in text and "yanlis-token-123" not in text


# ---- sınırlar ----

def test_request_size_limit(client, public_dns, monkeypatch):
    Calls(monkeypatch)
    big = {"url": "https://example.com/", "prompt": "a" * (web.MAX_BODY + 10)}
    r = client.post("/api/extract", json=big)
    assert r.status_code == 413 and r.json() == {"error": "İstek çok büyük."}
    r = client.post("/api/scrape", content=b"a" * (web.MAX_BODY + 1), headers={"content-type": "application/json"})
    assert r.status_code == 413


def test_request_size_limit_without_content_length(client, monkeypatch, public_dns):
    Calls(monkeypatch)

    def chunks():
        for _ in range(200):
            yield b" " * 1024

    r = client.post("/api/scrape", content=chunks(), headers={"content-type": "application/json"})
    assert r.status_code == 413
    ok = client.post("/api/scrape", content=iter([b'{"url": "https://exa', b'mple.com/"}']), headers={"content-type": "application/json"})
    assert ok.status_code == 200


def test_url_length_limit(client):
    r = client.post("/api/scrape", json={"url": "https://example.com/" + "a" * 2100})
    assert r.status_code == 422 and "çok uzun" in r.json()["error"]


def test_rate_limit(static, monkeypatch, public_dns):
    Calls(monkeypatch)
    c = TestClient(create_app(token=TOKEN, static_dir=static, rate_per_min=3), headers=AUTH)
    codes = [c.post("/api/scrape", json={"url": "https://example.com/"}).status_code for _ in range(5)]
    assert codes == [200, 200, 200, 429, 429]
    r = c.post("/api/scrape", json={"url": "https://example.com/"})
    assert int(r.headers["retry-after"]) >= 1 and "saniye" in r.json()["error"]
    assert c.get("/api/health").status_code == 200


def test_concurrency_limit_returns_503(static, monkeypatch, public_dns):
    gate, started = threading.Event(), threading.Event()

    def slow(url, **kw):
        started.set()
        gate.wait(10)
        return Page(url=url, markdown="tamam", status=200)

    monkeypatch.setattr(web, "scrape", slow)
    with TestClient(create_app(token=TOKEN, static_dir=static, max_concurrent=1), headers=AUTH) as c:
        first = []
        t = threading.Thread(target=lambda: first.append(c.post("/api/scrape", json={"url": "https://example.com/"})))
        t.start()
        assert started.wait(5)
        r = c.post("/api/scrape", json={"url": "https://example.org/"})
        assert r.status_code == 503 and r.headers["retry-after"] == "5" and "meşgul" in r.json()["error"]
        gate.set()
        t.join(5)
        assert first[0].status_code == 200
        assert c.post("/api/scrape", json={"url": "https://example.org/"}).status_code == 200  # yer geri verildi


def test_timeout_returns_504_and_slot_stays_taken_until_thread_ends(static, monkeypatch, public_dns):
    gate = threading.Event()

    def stuck(url, **kw):
        gate.wait(10)
        return Page(url=url, markdown="geç", status=200)

    monkeypatch.setattr(web, "scrape", stuck)
    with TestClient(create_app(token=TOKEN, static_dir=static, max_concurrent=1, timeout=0.3), headers=AUTH) as c:
        r = c.post("/api/scrape", json={"url": "https://example.com/"})
        assert r.status_code == 504 and "geç yanıt" in r.json()["error"]
        assert c.post("/api/scrape", json={"url": "https://example.com/"}).status_code == 503  # thread hâlâ çalışıyor
        gate.set()
        for _ in range(100):
            if c.post("/api/scrape", json={"url": "https://example.com/"}).status_code == 200:
                break
            time.sleep(0.05)
        else:
            pytest.fail("yer geri verilmedi")


def test_security_headers(client, anon):
    r = client.get("/api/health")
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
    assert r.headers["cache-control"] == "no-store" and r.headers["referrer-policy"] == "no-referrer"
    assert anon.get("/").headers["x-content-type-options"] == "nosniff"


# ---- başlatma ----

def test_refuses_to_start_without_token():
    with pytest.raises(RuntimeError, match="KAZI_TOKEN"):
        create_app()


@pytest.mark.parametrize("value", ["", "   ", "\n"])
def test_blank_token_env_is_missing(monkeypatch, value):
    monkeypatch.setenv("KAZI_TOKEN", value)
    with pytest.raises(RuntimeError, match="KAZI_TOKEN"):
        create_app()


def test_token_from_env_and_charset(monkeypatch, static):
    monkeypatch.setenv("KAZI_TOKEN", "  " + TOKEN + "\n")
    c = TestClient(create_app(static_dir=static))
    assert c.get("/api/yok", headers=AUTH).status_code == 404  # boşluklar kırpıldı, token geçerli
    for bad in ("iki kelime", "şifre-türkçe", "şifremgüçlü123456789"):
        with pytest.raises(RuntimeError, match="Türkçe harf") as e:
            create_app(token=bad)
        assert "ASCII" not in str(e.value)
    create_app(token="Ab+/=_-.~!" * 3)  # Render'ın ürettiği base64 şifreler de geçerli


def test_no_auth_app_is_open_but_only_for_local_hosts(static):
    app = create_app(no_auth=True, static_dir=static)
    local = TestClient(app, base_url="http://127.0.0.1:8000", raise_server_exceptions=False)
    assert local.post("/api/scrape", json={"url": "http://127.0.0.1/"}).status_code == 400  # 401 değil: kimlik yok
    assert TestClient(app, base_url="http://localhost:8000").get("/api/health").status_code == 200
    assert TestClient(app, base_url="http://[::1]:8000").get("/api/health").status_code == 200
    for host in ("evil.example", "192.168.1.5:8000", "127.0.0.1.evil.example"):
        r = TestClient(app, base_url="http://" + host).get("/api/health")  # DNS rebinding / dışarıdan erişim
        assert r.status_code == 403, host


@pytest.mark.parametrize("host,ok", [("127.0.0.1", True), ("localhost", True), ("::1", True), ("127.0.0.2", True),
                                     ("0.0.0.0", False), ("192.168.1.2", False), ("10.0.0.1", False), ("example.com", False),
                                     ("", False), ("::", False)])
def test_serve_no_auth_only_on_loopback(monkeypatch, host, ok):
    import uvicorn

    ran = []
    monkeypatch.setattr(uvicorn, "run", lambda app, **kw: ran.append(kw))
    if ok:
        web.serve(host, 8123, no_auth=True)
        assert ran == [{"host": host, "port": 8123, "server_header": False}]
    else:
        with pytest.raises(RuntimeError, match="--no-auth"):
            web.serve(host, 8123, no_auth=True)
        assert ran == []


def test_serve_requires_token_and_warns_when_short(monkeypatch, capsys):
    import uvicorn

    ran = []
    monkeypatch.setattr(uvicorn, "run", lambda app, **kw: ran.append((app, kw)))
    with pytest.raises(RuntimeError, match="KAZI_TOKEN"):
        web.serve("0.0.0.0", 8000)
    assert ran == []
    monkeypatch.setenv("KAZI_TOKEN", "kisa")
    web.serve("0.0.0.0", 8000)
    assert ran[0][1]["host"] == "0.0.0.0" and "kısa" in capsys.readouterr().err
    monkeypatch.setenv("KAZI_TOKEN", TOKEN)
    web.serve("0.0.0.0", 8000)
    assert "kısa" not in capsys.readouterr().err


# ---- CLI: kazi serve ----

@pytest.fixture
def served(monkeypatch):
    calls = []
    monkeypatch.setattr(web, "serve", lambda host, port, no_auth: calls.append((host, port, no_auth)))
    return calls


def test_cli_serve_defaults_and_port_env(served, monkeypatch):
    monkeypatch.delenv("PORT", raising=False)
    assert cli.main(["serve"]) == 0
    monkeypatch.setenv("PORT", "9123")
    assert cli.main(["serve"]) == 0
    assert cli.main(["serve", "--port", "7000", "--host", "127.0.0.1", "--no-auth"]) == 0
    assert served == [("0.0.0.0", 8000, False), ("0.0.0.0", 9123, False), ("127.0.0.1", 7000, True)]


@pytest.mark.parametrize("port", ["abc", "0", "70000"])
def test_cli_serve_bad_port_env(served, monkeypatch, capsys, port):
    monkeypatch.setenv("PORT", port)
    assert cli.main(["serve"]) == 1 and served == []
    assert capsys.readouterr().err.startswith("kazi: ")


def test_cli_serve_refusals(monkeypatch, capsys):
    monkeypatch.delenv("KAZI_TOKEN", raising=False)
    import uvicorn

    ran = []
    monkeypatch.setattr(uvicorn, "run", lambda *a, **k: ran.append(1))
    assert cli.main(["serve"]) == 1
    assert "KAZI_TOKEN" in capsys.readouterr().err
    assert cli.main(["serve", "--no-auth", "--host", "0.0.0.0"]) == 1
    assert "--no-auth" in capsys.readouterr().err
    assert cli.main(["serve", "--no-auth"]) == 1  # varsayılan host 0.0.0.0: kimliksiz açılmaz
    assert ran == []


# ---- depo dosyaları ----

ROOT = Path(__file__).parent.parent


def test_env_files_are_git_ignored_but_the_example_is_not():
    lines = (ROOT / ".gitignore").read_text(encoding="utf-8").split()
    assert {".env", ".env.*", "!.env.example"} <= set(lines)
    probe = subprocess.run(["git", "check-ignore", "-q", ".env"], cwd=ROOT, capture_output=True)
    if probe.returncode > 1:
        pytest.skip("git deposu değil")
    assert probe.returncode == 0
    assert subprocess.run(["git", "check-ignore", "-q", ".env.example"], cwd=ROOT).returncode == 1


def test_deploy_guide_quotes_the_messages_users_really_see():
    guide = (ROOT / "DEPLOY.md").read_text(encoding="utf-8")
    code = (ROOT / "src/kazi/web.py").read_text(encoding="utf-8") + (ROOT / "src/kazi/static/index.html").read_text(encoding="utf-8")
    code = code.replace("\\'", "'")
    typed = [
        "Şifre kabul edilmedi. Şifreyi yeniden girin, sonra işlemi tekrar deneyin.",
        "Şifrede geçersiz bir karakter var. Boşluk ve Türkçe harf olmamalı.",
        "Çok fazla hatalı giriş denemesi. Biraz sonra tekrar deneyin.",
        "Sunucu şu an başka işlerle meşgul. Birkaç saniye sonra tekrar deneyin.",
        "Sayfa çok geç yanıt verdi; işlem durduruldu. Daha sonra tekrar deneyin.",
        "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
        "Sunucu çok geç cevap verdi. Biraz sonra tekrar deneyin.",
        "Bu sayfadan okunacak yazı çıkmadı. Adres bir resim ya da dosya olabilir, ya da site yazıyı sonradan yüklüyordur "
        "(bu sunucu onu okuyamaz). Başka bir adres deneyin.",
    ]
    for msg in typed:  # kodda da, rehberde de birebir aynı
        assert msg in code, msg
        assert msg in guide, msg
    built = [web._status_msg(403), web._status_msg(404), web._status_msg(503), safety.DENY, *web._FETCH.values()]
    for msg in built:
        assert msg in guide, msg
    assert "Çok fazla istek. 20 saniye sonra tekrar deneyin." in guide
    assert "Çok fazla istek. {math.ceil(w)} saniye sonra tekrar deneyin." in code
    assert web._BAD_TOKEN.split(" Yalnızca")[0] in guide


def test_readme_documents_the_web_ui():
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    for word in ("kazi serve", "KAZI_TOKEN", "--no-auth", "DEPLOY.md", ".[web"):
        assert word in readme, word
