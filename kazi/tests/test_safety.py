"""SSRF koruması testleri: adres reddi, DNS sabitleme, yönlendirme. Dış ağa çıkmaz (sahte DNS + yerel sunucu)."""
import ipaddress
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import httpx
import pytest

from kazi import safety
from kazi.safety import UnsafeURL, check_url, guarded_client, redirect_check

PUBLIC = "93.184.216.34"


@pytest.fixture(autouse=True)
def _strict(monkeypatch):
    monkeypatch.delenv("KAZI_ALLOW_PRIVATE", raising=False)


def dns(monkeypatch, table, calls=None):
    """Sahte getaddrinfo: table {ad: [ip, ...]} ya da çağrı sırasına göre liste-listesi."""

    def fake(host, port, type=0):
        if calls is not None:
            calls.append(host)
        ips = table[host] if isinstance(table, dict) else table.pop(0)
        if not ips:
            raise socket.gaierror(-2, "Name or service not known")
        return [(socket.AF_INET6 if ":" in ip else socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, port)) for ip in ips]

    monkeypatch.setattr(safety, "_resolve", fake)


BLOCKED = [
    "http://127.0.0.1/", "http://127.0.0.1:8000/x", "http://10.1.2.3/", "http://172.16.0.1/", "http://172.31.255.255/",
    "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data/", "http://100.64.0.1/", "http://100.127.255.255/",
    "http://0.0.0.0/", "http://224.0.0.1/", "http://240.0.0.1/", "http://255.255.255.255/", "http://192.0.2.1/",
    "http://[::1]/", "http://[::]/", "http://[fe80::1]/", "http://[fc00::1]/", "http://[fd00::1]/",
    "http://[::ffff:127.0.0.1]/", "http://[::ffff:7f00:1]/", "http://[::ffff:169.254.169.254]/", "http://[::127.0.0.1]/",
    "http://[64:ff9b::7f00:1]/", "http://[2002:7f00:1::]/", "http://[2001:db8::1]/", "http://[ff02::1]/",
    "http://0x7f000001/", "http://0x7f.0.0.1/", "http://2130706433/", "http://017700000001/", "http://127.1/",
    "http://0/", "http://127.0.0.1./", "http://2852039166/", "http://0xa9fea9fe/",
    "http://localhost/", "http://LOCALHOST:8000/", "http://localhost./", "http://app.localhost/", "http://x.local/",
    "http://metadata.google.internal/", "http://printer.localdomain/",
    "http://kullanici:sifre@127.0.0.1/", "http://user@127.0.0.1/", "http://example.com@127.0.0.1/",
    "http://127.0.0.1:80@example.com/", "http://example.com\\@127.0.0.1/", "http://127.0.0.1%2e/",
    "http://example.com:pw@10.0.0.1/",
]


@pytest.mark.parametrize("url", BLOCKED)
def test_internal_addresses_rejected(url):
    with pytest.raises(UnsafeURL):
        check_url(url)


@pytest.mark.parametrize("url", ["file:///etc/passwd", "ftp://example.com/", "gopher://example.com/", "javascript:alert(1)",
                                 "data:text/html,hi", "example.com", "", "   ", "http://", "http:///x", "https://:80/",
                                 "http://1.2.3.4.5/", "http://4294967296/", "http://[::1/", "http://a b/",
                                 "http://example.com/\nHost: x", "http://example.com/\x00", "http://" + "a" * 3000 + ".com/"])
def test_malformed_or_non_http_rejected(url):
    with pytest.raises(UnsafeURL):
        check_url(url)


def test_messages_are_turkish_and_do_not_leak_ip():
    for url in ("http://169.254.169.254/", "http://[::1]/", "http://10.9.8.7/"):
        with pytest.raises(UnsafeURL) as e:
            check_url(url)
        assert "güvenlik" in str(e.value)
        assert not any(x in str(e.value) for x in ("169.254", "::1", "10.9.8.7"))


@pytest.mark.parametrize("url,ip", [("http://8.8.8.8/", "8.8.8.8"), ("https://1.1.1.1:8443/x?y=1", "1.1.1.1"),
                                    ("https://[2606:4700:4700::1111]/", "2606:4700:4700::1111"),
                                    ("http://134744072/", "8.8.8.8"), ("http://0x08080808/", "8.8.8.8")])
def test_public_literals_allowed(url, ip):
    assert check_url(url) == [ip]


def test_hostname_checked_by_resolved_addresses(monkeypatch):
    dns(monkeypatch, {"ok.test": [PUBLIC, "2606:4700:4700::1111"], "mixed.test": [PUBLIC, "10.0.0.5"],
                      "meta.test": ["169.254.169.254"], "loop.test": ["127.0.0.1"], "six.test": ["::1"],
                      "mapped.test": ["::ffff:127.0.0.1"], "cgnat.test": ["100.64.1.1"], "gone.test": []})
    assert check_url("https://ok.test/a") == [PUBLIC, "2606:4700:4700::1111"]
    for host in ("mixed.test", "meta.test", "loop.test", "six.test", "mapped.test", "cgnat.test"):
        with pytest.raises(UnsafeURL, match="güvenlik"):
            check_url(f"http://{host}/")
    with pytest.raises(UnsafeURL, match="bulunamadı"):
        check_url("http://gone.test/")


def test_resolver_sees_unicode_host_as_punycode(monkeypatch):
    calls = []
    dns(monkeypatch, {"xn--bcher-kva.example": [PUBLIC]}, calls)
    assert check_url("https://bücher.example/") == [PUBLIC]
    assert calls == ["xn--bcher-kva.example"]


def test_allow_private_only_relaxes_addresses(monkeypatch):
    monkeypatch.setenv("KAZI_ALLOW_PRIVATE", "1")
    assert check_url("http://127.0.0.1:8000/") == ["127.0.0.1"]
    assert check_url("http://2130706433/") == ["127.0.0.1"]
    dns(monkeypatch, {"localhost": ["127.0.0.1"]})
    assert check_url("http://localhost:3000/") == ["127.0.0.1"]
    for url in ("file:///etc/passwd", "http://u:p@127.0.0.1/", "http://[::1/"):
        with pytest.raises(UnsafeURL):
            check_url(url)
    monkeypatch.setenv("KAZI_ALLOW_PRIVATE", "0")
    with pytest.raises(UnsafeURL):
        check_url("http://127.0.0.1/")


def test_redirect_check_returns_reason_or_none(monkeypatch):
    assert redirect_check("http://127.0.0.1/") and "güvenlik" in redirect_check("http://127.0.0.1/")
    assert redirect_check("ftp://x/") is not None
    assert redirect_check("http://8.8.8.8/") is None


@pytest.mark.parametrize("host,ip", [("2130706433", "127.0.0.1"), ("0x7f000001", "127.0.0.1"), ("017700000001", "127.0.0.1"),
                                     ("127.1", "127.0.0.1"), ("0x7f.1", "127.0.0.1"), ("10.1.1", "10.1.0.1"),
                                     ("1.2.3.4", "1.2.3.4"), ("1.2.3.4.", "1.2.3.4"), ("0", "0.0.0.0"), ("1.0x", "1.0.0.0")])
def test_loose_ipv4_parsing(host, ip):
    assert safety._ipv4_loose(host) == ipaddress.IPv4Address(ip)


@pytest.mark.parametrize("host", ["example.com", "a.b.c.d.e", "xn--bcher-kva.example", "localhost"])
def test_names_are_not_ipv4(host):
    assert safety._ipv4_loose(host) is None


@pytest.mark.parametrize("host", ["1.2.3.4.5", "256.1.1.1", "4294967296", "08", "example.1", "1.2.3.256"])
def test_numeric_looking_but_invalid_rejected(host):
    with pytest.raises(UnsafeURL):
        safety._ipv4_loose(host)


# ---- PinnedTransport: bağlantı doğrulanmış IP'ye sabitlenir ----

class Inner(httpx.BaseTransport):
    def __init__(self, script):
        self.script, self.seen = script, []

    def handle_request(self, request):
        self.seen.append(request)
        r = self.script(request, len(self.seen))
        if isinstance(r, Exception):
            raise r
        return r


@pytest.fixture
def inner(monkeypatch):
    def make(script):
        t = Inner(script)
        monkeypatch.setattr(safety, "_inner_transport", lambda: t)
        return t

    return make


def ok(request, n):
    return httpx.Response(200, content=b"tamam")


def test_connection_pinned_to_validated_ip_keeping_host_and_sni(monkeypatch, inner):
    dns(monkeypatch, {"site.test": [PUBLIC]})
    t = inner(ok)
    with guarded_client() as c:
        r = c.get("https://site.test/a?x=1")
    seen = t.seen[0]
    assert (seen.url.host, seen.url.path, seen.url.query) == (PUBLIC, "/a", b"x=1")
    assert seen.headers["host"] == "site.test"
    assert seen.extensions["sni_hostname"] == "site.test"
    assert str(r.url) == "https://site.test/a?x=1" and r.text == "tamam"  # çağırana özgün adres görünür


def test_port_and_ipv6_literal(monkeypatch, inner):
    t = inner(ok)
    with guarded_client() as c:
        c.get("http://[2606:4700:4700::1111]:8080/x")
    seen = t.seen[0]
    assert (seen.url.host, seen.url.port) == ("2606:4700:4700::1111", 8080)
    assert "sni_hostname" not in seen.extensions


def test_dns_rebinding_between_check_and_connect_is_caught(monkeypatch, inner):
    dns(monkeypatch, [[PUBLIC], ["169.254.169.254"]])  # önce genel, bağlanırken iç adres
    t = inner(ok)
    assert check_url("http://rebind.test/") == [PUBLIC]
    with guarded_client() as c, pytest.raises(UnsafeURL, match="güvenlik"):
        c.get("http://rebind.test/")
    assert t.seen == []


def test_every_hop_is_checked_literal_redirect(monkeypatch, inner):
    dns(monkeypatch, {"site.test": [PUBLIC]})
    t = inner(lambda req, n: httpx.Response(302, headers={"Location": "http://169.254.169.254/latest/meta-data/"}))
    with guarded_client() as c, pytest.raises(UnsafeURL):
        c.get("http://site.test/")
    assert len(t.seen) == 1  # ikinci adım iç adrese hiç gönderilmedi


@pytest.mark.parametrize("target", ["http://0x7f000001:8080/", "http://[::1]/", "http://intranet.test/x", "//10.0.0.1/",
                                    "http://localhost/admin", "ftp://site.test/x"])
def test_redirects_to_internal_targets_blocked(monkeypatch, inner, target):
    dns(monkeypatch, {"site.test": [PUBLIC], "intranet.test": ["10.0.0.5"], "localhost": ["127.0.0.1"]})
    t = inner(lambda req, n: httpx.Response(302, headers={"Location": target}) if n == 1 else httpx.Response(200))
    with guarded_client() as c, pytest.raises(Exception) as e:
        c.get("http://site.test/")
    assert isinstance(e.value, UnsafeURL) or "Unsupported" in type(e.value).__name__ or isinstance(e.value, httpx.UnsupportedProtocol)
    assert len(t.seen) == 1


def test_relative_and_public_redirects_still_work(monkeypatch, inner):
    dns(monkeypatch, {"site.test": [PUBLIC], "www.site.test": ["93.184.216.35"]})

    def script(req, n):
        if n == 1:
            return httpx.Response(301, headers={"Location": "/yeni"})
        if n == 2:
            return httpx.Response(302, headers={"Location": "https://www.site.test/son"})
        return httpx.Response(200, content=b"son")

    t = inner(script)
    with guarded_client() as c:
        r = c.get("http://site.test/eski")
    assert str(r.url) == "https://www.site.test/son"
    assert [(q.url.host, q.headers["host"]) for q in t.seen] == [
        (PUBLIC, "site.test"), (PUBLIC, "site.test"), ("93.184.216.35", "www.site.test")]


def test_falls_back_to_next_ip_on_connect_error(monkeypatch, inner):
    dns(monkeypatch, {"two.test": ["2606:4700:4700::1111", PUBLIC]})
    t = inner(lambda req, n: httpx.ConnectError("ağ yok") if n == 1 else httpx.Response(200, content=b"v4"))
    with guarded_client() as c:
        assert c.get("http://two.test/").text == "v4"
    assert [q.url.host for q in t.seen] == ["2606:4700:4700::1111", PUBLIC]


def test_timeout_is_not_retried_on_other_ips(monkeypatch, inner):
    dns(monkeypatch, {"two.test": [PUBLIC, "93.184.216.35"]})
    t = inner(lambda req, n: httpx.ConnectTimeout("zaman aşımı"))
    with guarded_client() as c, pytest.raises(httpx.ConnectTimeout):
        c.get("http://two.test/")
    assert len(t.seen) == 1


def test_allow_private_passes_requests_through_untouched(monkeypatch, inner):
    monkeypatch.setenv("KAZI_ALLOW_PRIVATE", "1")
    t = inner(ok)
    with guarded_client() as c:
        c.get("http://127.0.0.1:9/x")
    assert str(t.seen[0].url) == "http://127.0.0.1:9/x" and "sni_hostname" not in t.seen[0].extensions


def test_guarded_client_ignores_environment_proxies(monkeypatch, inner):
    monkeypatch.setenv("HTTP_PROXY", "http://proxy.invalid:3128")
    monkeypatch.setenv("HTTPS_PROXY", "http://proxy.invalid:3128")
    dns(monkeypatch, {"site.test": [PUBLIC]})
    t = inner(ok)
    with guarded_client() as c:
        assert c.get("http://site.test/").text == "tamam"
    assert len(t.seen) == 1


# ---- gerçek soketler ----

class _H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        self.server.seen.append((self.path, self.headers.get("Host")))
        body = b"yerel-sunucu"
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


@pytest.fixture
def local():
    srv = ThreadingHTTPServer(("127.0.0.1", 0), _H)
    srv.seen = []
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield srv
    srv.shutdown()
    srv.server_close()


def test_real_socket_to_loopback_is_refused_and_never_connects(local):
    port = local.server_address[1]
    for host in ("127.0.0.1", "localhost", "2130706433", "0x7f000001"):
        with guarded_client() as c, pytest.raises(UnsafeURL):
            c.get(f"http://{host}:{port}/gizli")
    assert local.seen == []


def test_real_socket_pinned_connection_sends_original_host_header(monkeypatch, local):
    port = local.server_address[1]
    dns(monkeypatch, {"genel.test": ["127.0.0.1"]})
    monkeypatch.setattr(safety, "why_blocked", lambda ip: None)  # yalnızca gerçek bağlantıyı denemek için
    with guarded_client() as c:
        r = c.get(f"http://genel.test:{port}/yol?a=1")
    assert r.text == "yerel-sunucu"
    assert local.seen == [("/yol?a=1", f"genel.test:{port}")]


# ---- Playwright (JS) yolu: tarayıcının her isteği check'ten geçer ----

def test_js_fetch_blocks_requests_rejected_by_check(local, monkeypatch):
    pytest.importorskip("playwright.sync_api")
    from kazi.core import _fetch_js

    class Page(_H):
        def do_GET(self):
            self.server.seen.append(self.path)
            if self.path == "/":
                body = (b"<html><body><p id=r>bekliyor</p><script>"
                        b"fetch('/ic').then(()=>r.textContent='ACIL'+'DI').catch(()=>r.textContent='ENGEL'+'LENDI')"
                        b"</script></body></html>")
            elif self.path in ("/git", "/eski"):
                self.send_response(302)
                self.send_header("Location", "/ic" if self.path == "/git" else "/")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            else:
                body = b"gizli"
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    srv = ThreadingHTTPServer(("127.0.0.1", 0), Page)
    srv.seen = []
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    check = lambda u: "yasak" if u.endswith("/ic") else None  # noqa: E731
    try:
        html, status, _ = _fetch_js(base + "/", check=check)
        assert "ENGELLENDI" in html and "ACILDI" not in html
        with pytest.raises(RuntimeError):
            _fetch_js(base + "/git", check=check)
        assert "/ic" not in srv.seen  # yönlendirme hedefi tarayıcıya hiç ulaşmadı
        html, status, final = _fetch_js(base + "/eski", check=check)  # zararsız yönlendirme izlenir
        assert final == base + "/" and status == 200 and "ENGELLENDI" in html
        html, _, _ = _fetch_js(base + "/")  # check yoksa davranış değişmez
        assert "ACILDI" in html
    finally:
        srv.shutdown()
        srv.server_close()


def test_js_fetch_checks_websocket_handshakes_too(monkeypatch):
    """pg.route WebSocket'i görmez: iç adrese WS bağlantısı da check'ten geçmeli (engellenen sunucuya hiç ulaşmaz)."""
    pytest.importorskip("playwright.sync_api")
    from kazi.core import _fetch_js

    class Page(_H):
        def do_GET(self):
            if self.headers.get("Upgrade", "").lower() == "websocket":
                self.server.ws.append(self.path)
                self.send_response(400)  # el sıkışma tamamlanmaz; tarayıcı hata görür
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            body = (b"<html><body><p id=r>bekliyor</p><script>"
                    b"for (const p of ['/ws-bad', '/ws-ok']) { const w = new WebSocket('ws://' + location.host + p);"
                    b"w.onerror = () => {}; }"
                    b"</script></body></html>")
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    srv = ThreadingHTTPServer(("127.0.0.1", 0), Page)
    srv.ws = []
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    asked = []

    def check(u):
        asked.append(u)
        return "yasak" if u.endswith("/ws-bad") else None

    try:
        _fetch_js(base + "/", check=check)
        assert srv.ws == ["/ws-ok"]  # engellenen WS sunucuya hiç ulaşmadı, izin verilen ulaştı
        assert base + "/ws-bad" in asked and base + "/ws-ok" in asked  # ws:// → http:// olarak soruldu
        srv.ws.clear()
        _fetch_js(base + "/")  # check yoksa davranış değişmez
        assert sorted(srv.ws) == ["/ws-bad", "/ws-ok"]
    finally:
        srv.shutdown()
        srv.server_close()
