import httpx
import pytest

import kazi.search as search_mod
from kazi.search import SearchError, search

KEY = "SECRET-KEY-123"
VARS = ("BRAVE_API_KEY", "TAVILY_API_KEY", "SEARXNG_URL")


def brave_body(n):
    return {"web": {"results": [{"title": f"T{i}", "url": f"https://s.test/{i}", "description": f"d{i}"}
                                for i in range(n)]}}


def tavily_body(n):
    return {"query": "q", "results": [{"title": f"T{i}", "url": f"https://s.test/{i}", "content": f"d{i}",
                                       "score": 0.9} for i in range(n)]}


def searx_body(n):
    return {"query": "q", "results": [{"title": f"T{i}", "url": f"https://s.test/{i}", "content": f"d{i}"}
                                      for i in range(n)]}


# arka uç -> (env değişkeni, değer, gizli kısım, gövde üretici)
CASES = {
    "brave": ("BRAVE_API_KEY", KEY, KEY, brave_body),
    "tavily": ("TAVILY_API_KEY", KEY, KEY, tavily_body),
    "searxng": ("SEARXNG_URL", "http://kullanici:PAROLA9@searx.test:8080", "PAROLA9", searx_body),
}
ALL = list(CASES)


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for v in VARS:
        monkeypatch.delenv(v, raising=False)


def use(monkeypatch, name):
    var, val, secret, body = CASES[name]
    monkeypatch.setenv(var, val)
    return secret, body


def make(handler):
    calls = []

    def wrapped(req):
        calls.append(req)
        return handler(req)

    return httpx.Client(transport=httpx.MockTransport(wrapped)), calls


def reply(status=200, **kw):
    return lambda req: httpx.Response(status, **kw)


# --- ortak davranış (her arka uç) ---

@pytest.mark.parametrize("name", ALL)
def test_basic_shape(monkeypatch, name):
    _, body = use(monkeypatch, name)
    c, calls = make(reply(json=body(3)))
    res = search("kazi", backend=name, client=c)
    assert res == [{"title": f"T{i}", "url": f"https://s.test/{i}", "snippet": f"d{i}"} for i in range(3)]
    assert len(calls) == 1


@pytest.mark.parametrize("name", ALL)
def test_limit_truncates(monkeypatch, name):
    _, body = use(monkeypatch, name)
    c, _ = make(reply(json=body(10)))
    res = search("kazi", limit=2, backend=name, client=c)
    assert [r["url"] for r in res] == ["https://s.test/0", "https://s.test/1"]
    assert len(search("kazi", backend=name, client=c)) == 5  # varsayılan limit


@pytest.mark.parametrize("name", ALL)
def test_limit_capped_at_20(monkeypatch, name):
    _, body = use(monkeypatch, name)
    c, _ = make(reply(json=body(30)))
    assert len(search("kazi", limit=50, backend=name, client=c)) == 20


@pytest.mark.parametrize("name", ALL)
def test_fewer_results_than_limit(monkeypatch, name):
    _, body = use(monkeypatch, name)
    c, _ = make(reply(json=body(2)))
    assert len(search("kazi", limit=9, backend=name, client=c)) == 2


@pytest.mark.parametrize("name", ALL)
def test_empty_results(monkeypatch, name):
    _, body = use(monkeypatch, name)
    c, _ = make(reply(json=body(0)))
    assert search("kazi", backend=name, client=c) == []


@pytest.mark.parametrize("name", ALL)
def test_items_without_usable_url_skipped(monkeypatch, name):
    _, body = use(monkeypatch, name)
    data = body(3)
    rows = data["web"]["results"] if name == "brave" else data["results"]
    rows[0].pop("url")
    rows[1]["url"] = "javascript:alert(1)"
    rows.insert(0, "metin")
    c, _ = make(reply(json=data))
    res = search("kazi", backend=name, client=c)
    assert [r["url"] for r in res] == ["https://s.test/2"]


@pytest.mark.parametrize("name", ALL)
def test_missing_title_and_snippet(monkeypatch, name):
    use(monkeypatch, name)
    row = {"url": "https://s.test/x"}
    c, _ = make(reply(json={"web": {"results": [row]}} if name == "brave" else {"results": [row]}))
    assert search("kazi", backend=name, client=c) == [{"title": "https://s.test/x", "url": "https://s.test/x", "snippet": ""}]


@pytest.mark.parametrize("name", ALL)
def test_html_stripped_from_text(monkeypatch, name):
    use(monkeypatch, name)
    row = {"title": "<b>Python</b> &amp; kazi", "url": "https://s.test/x",
           "description": "a <strong>kalın</strong>\n  metin &quot;x&quot; 1 < 2", "content": "a <strong>kalın</strong>\n  metin &quot;x&quot; 1 < 2"}
    c, _ = make(reply(json={"web": {"results": [row]}} if name == "brave" else {"results": [row]}))
    r = search("kazi", backend=name, client=c)[0]
    assert r["title"] == "Python & kazi"
    assert r["snippet"] == 'a kalın metin "x" 1 < 2'


@pytest.mark.parametrize("name", ALL)
@pytest.mark.parametrize("status,frag", [(429, "kota"), (500, "sunucu hatası"), (502, "sunucu hatası"), (418, "HTTP 418")])
def test_http_errors(monkeypatch, name, status, frag):
    secret, _ = use(monkeypatch, name)
    c, _ = make(reply(status, text="hata"))
    with pytest.raises(SearchError, match=frag) as ei:
        search("kazi", backend=name, client=c)
    assert str(ei.value).startswith(f"{name}:") and secret not in str(ei.value)


@pytest.mark.parametrize("name", ["brave", "tavily"])
@pytest.mark.parametrize("status", [401, 403])
def test_auth_errors_hint_key(monkeypatch, name, status):
    use(monkeypatch, name)
    c, _ = make(reply(status, json={"detail": {"error": "Unauthorized: missing or invalid API key."}}))
    with pytest.raises(SearchError) as ei:
        search("kazi", backend=name, client=c)
    assert "anahtar geçersiz" in str(ei.value) and f"HTTP {status}" in str(ei.value)
    assert "Unauthorized: missing or invalid API key." in str(ei.value)


@pytest.mark.parametrize("name", ALL)
@pytest.mark.parametrize("resp", [
    dict(text="<html>merhaba</html>"),
    dict(text=""),
    dict(json=[1, 2]),
    dict(json="metin"),
])
def test_bad_body(monkeypatch, name, resp):
    use(monkeypatch, name)
    c, _ = make(reply(**resp))
    with pytest.raises(SearchError, match=r"JSON değil|beklenmeyen yanıt biçimi"):
        search("kazi", backend=name, client=c)


@pytest.mark.parametrize("name", ALL)
def test_results_wrong_type(monkeypatch, name):
    use(monkeypatch, name)
    bad = {"web": {"results": "yok"}} if name == "brave" else {"results": {"a": 1}}
    c, _ = make(reply(json=bad))
    with pytest.raises(SearchError, match="beklenmeyen yanıt biçimi"):
        search("kazi", backend=name, client=c)


@pytest.mark.parametrize("name", ALL)
def test_timeout_and_connect_errors(monkeypatch, name):
    use(monkeypatch, name)

    def boom_timeout(req):
        raise httpx.ReadTimeout("")

    def boom_connect(req):
        raise httpx.ConnectError("Name or service not known")

    c, _ = make(boom_timeout)
    with pytest.raises(SearchError, match="zaman aşımı"):
        search("kazi", backend=name, client=c)
    c, _ = make(boom_connect)
    with pytest.raises(SearchError, match="bağlanılamadı.*ConnectError.*Name or service not known"):
        search("kazi", backend=name, client=c)


# --- gizli bilgi sızıntısı ---

@pytest.mark.parametrize("name", ALL)
def test_secret_never_in_errors(monkeypatch, capsys, name):
    secret, _ = use(monkeypatch, name)

    def echo_status(req):  # sağlayıcı gizliyi hata gövdesinde geri yankılıyor
        return httpx.Response(401 if name != "searxng" else 403, json={"error": f"bad token {secret} given"})

    def echo_exc(req):  # taşıma hatası gizliyi iletiye koyuyor
        raise httpx.ConnectError(f"proxy reddetti: {secret}")

    for h in (echo_status, echo_exc, reply(500, text=f"x {secret} y")):
        c, _ = make(h)
        with pytest.raises(SearchError) as ei:
            search("kazi", backend=name, client=c)
        assert secret not in str(ei.value) and secret not in repr(ei.value)
        assert ei.value.__cause__ is None and (ei.value.__context__ is None or ei.value.__suppress_context__)
    out = capsys.readouterr()
    assert secret not in out.out + out.err


def test_secret_in_unresponsive_engine_names_scrubbed_not_needed_but_safe(monkeypatch):
    use(monkeypatch, "searxng")
    c, _ = make(reply(json={"results": [], "unresponsive_engines": [["google", "CAPTCHA"], ["bing", "timeout"]]}))
    with pytest.raises(SearchError, match=r"google/CAPTCHA, bing/timeout") as ei:
        search("kazi", backend="searxng", client=c)
    assert "PAROLA9" not in str(ei.value)


@pytest.mark.parametrize("name", ["brave", "tavily"])
@pytest.mark.parametrize("bad", ["abc\ndef", "abc def", "anahtar-ğ", "ab\rc"])
def test_bad_key_chars_rejected_before_request(monkeypatch, name, bad):
    var = CASES[name][0]
    monkeypatch.setenv(var, "  " + bad + "  ")
    c, calls = make(reply(json={}))
    with pytest.raises(SearchError, match=var) as ei:
        search("kazi", backend=name, client=c)
    assert bad.strip() not in str(ei.value) and not calls


def test_key_whitespace_trimmed(monkeypatch):
    monkeypatch.setenv("BRAVE_API_KEY", f"  {KEY}\n")
    c, calls = make(reply(json=brave_body(1)))
    search("kazi", client=c)
    assert calls[0].headers["X-Subscription-Token"] == KEY


# --- brave'e özgü istek biçimi ---

def test_brave_request(monkeypatch):
    use(monkeypatch, "brave")
    c, calls = make(reply(json=brave_body(1)))
    search("  python kazıyıcı  ", limit=7, backend="brave", client=c)
    req = calls[0]
    assert req.method == "GET" and req.url.host == "api.search.brave.com" and req.url.path == "/res/v1/web/search"
    assert req.url.params["q"] == "python kazıyıcı" and req.url.params["count"] == "7"
    assert req.headers["X-Subscription-Token"] == KEY and req.headers["Accept"] == "application/json"
    assert KEY not in str(req.url)


def test_brave_count_capped(monkeypatch):
    use(monkeypatch, "brave")
    c, calls = make(reply(json=brave_body(1)))
    search("kazi", limit=99, backend="brave", client=c)
    assert calls[0].url.params["count"] == "20"


def test_brave_no_web_key_is_empty(monkeypatch):
    use(monkeypatch, "brave")
    c, _ = make(reply(json={"type": "search", "query": {"original": "x"}}))
    assert search("kazi", backend="brave", client=c) == []


def test_brave_web_wrong_type(monkeypatch):
    use(monkeypatch, "brave")
    c, _ = make(reply(json={"web": []}))
    with pytest.raises(SearchError, match="beklenmeyen"):
        search("kazi", backend="brave", client=c)


def test_brave_error_message_surfaced(monkeypatch):
    use(monkeypatch, "brave")
    body = {"type": "ErrorResponse", "error": {"id": "x", "status": 422, "code": "VALIDATION", "detail": "Query too long"}}
    c, _ = make(reply(422, json=body))
    with pytest.raises(SearchError, match=r"HTTP 422\. Sağlayıcı: Query too long"):
        search("kazi", backend="brave", client=c)


def test_no_redirect_follow_for_key_bearing_backends(monkeypatch):
    use(monkeypatch, "brave")
    c, calls = make(lambda req: httpx.Response(302, headers={"Location": "https://baska.test/x"}))
    with pytest.raises(SearchError, match="HTTP 302"):
        search("kazi", backend="brave", client=c)
    assert len(calls) == 1  # yönlendirme izlenmedi, X-Subscription-Token başka adrese gitmedi


# --- tavily'ye özgü ---

def test_tavily_request(monkeypatch):
    use(monkeypatch, "tavily")
    c, calls = make(reply(json=tavily_body(1)))
    search("kazi", limit=4, backend="tavily", client=c)
    req = calls[0]
    assert req.method == "POST" and str(req.url) == "https://api.tavily.com/search"
    assert req.headers["Authorization"] == f"Bearer {KEY}"
    assert req.headers["Content-Type"] == "application/json"
    import json
    assert json.loads(req.content) == {"query": "kazi", "max_results": 4}
    assert KEY not in req.content.decode()


def test_tavily_results_key_missing_is_error(monkeypatch):
    use(monkeypatch, "tavily")
    c, _ = make(reply(json={"query": "x"}))
    with pytest.raises(SearchError, match="beklenmeyen"):
        search("kazi", backend="tavily", client=c)


def test_tavily_plan_limit_message(monkeypatch):
    use(monkeypatch, "tavily")
    msg = "This request exceeds your plan's set usage limit."
    c, _ = make(reply(432, json={"detail": {"error": msg}}))
    with pytest.raises(SearchError, match="HTTP 432") as ei:
        search("kazi", backend="tavily", client=c)
    assert msg in str(ei.value)


# --- searxng'ye özgü ---

@pytest.mark.parametrize("url,path", [
    ("http://searx.test:8080", "/search"),
    ("http://searx.test:8080/", "/search"),
    ("http://searx.test:8080/search", "/search"),
    ("http://searx.test:8080/search/", "/search"),
    ("https://alan.test/searx", "/searx/search"),
])
def test_searxng_request(monkeypatch, url, path):
    monkeypatch.setenv("SEARXNG_URL", url)
    c, calls = make(reply(json=searx_body(1)))
    search("kazı kütüphane", backend="searxng", client=c)
    req = calls[0]
    assert req.method == "GET" and req.url.path == path
    assert req.url.params["q"] == "kazı kütüphane" and req.url.params["format"] == "json"
    assert "Authorization" not in req.headers


def test_searxng_keeps_existing_query_and_basic_auth(monkeypatch):
    monkeypatch.setenv("SEARXNG_URL", "https://kullanici:PAROLA9@searx.test/?token=abc123")
    c, calls = make(reply(json=searx_body(1)))
    search("kazi", backend="searxng", client=c)
    req = calls[0]
    assert req.url.params["token"] == "abc123" and req.url.params["format"] == "json"
    assert req.headers["Authorization"].startswith("Basic ")


def test_searxng_url_secrets_scrubbed(monkeypatch):
    monkeypatch.setenv("SEARXNG_URL", "https://kullanici:PAROLA9@searx.test/?token=abc123xyz")

    def boom(req):
        raise httpx.ConnectError(f"{req.url} bağlanamadı")

    c, _ = make(boom)
    with pytest.raises(SearchError) as ei:
        search("kazi", backend="searxng", client=c)
    assert "PAROLA9" not in str(ei.value) and "abc123xyz" not in str(ei.value)


def test_searxng_follows_redirect(monkeypatch):
    monkeypatch.setenv("SEARXNG_URL", "http://searx.test")

    def handler(req):
        if req.url.scheme == "http":
            return httpx.Response(301, headers={"Location": str(req.url.copy_with(scheme="https"))})
        return httpx.Response(200, json=searx_body(2))

    c, calls = make(handler)  # istemci follow_redirects=False; istek başına açılır
    assert len(search("kazi", backend="searxng", client=c)) == 2 and len(calls) == 2


@pytest.mark.parametrize("resp,frag", [
    (dict(status=403, text="Forbidden"), "json biçimi kapalı|JSON biçimi kapalı"),
    (dict(status=200, text="<html><body>Arama</body></html>"), "JSON biçimi kapalı"),
])
def test_searxng_json_disabled_hint(monkeypatch, resp, frag):
    monkeypatch.setenv("SEARXNG_URL", "http://searx.test")
    c, _ = make(lambda req: httpx.Response(resp["status"], text=resp["text"]))
    with pytest.raises(SearchError, match=frag):
        search("kazi", backend="searxng", client=c)


@pytest.mark.parametrize("val", ["gizli.test:8080", "ftp://gizli.test", "http://", "https:///yol"])
def test_searxng_url_invalid(monkeypatch, val):
    monkeypatch.setenv("SEARXNG_URL", val)
    c, calls = make(reply(json=searx_body(1)))
    with pytest.raises(SearchError, match="SEARXNG_URL") as ei:
        search("kazi", backend="searxng", client=c)
    assert not calls and "gizli" not in str(ei.value)


def test_searxng_blank_url_is_undefined(monkeypatch):
    monkeypatch.setenv("SEARXNG_URL", "   ")
    c, _ = make(reply(json=searx_body(1)))
    with pytest.raises(SearchError, match="tanımlı değil"):
        search("kazi", backend="searxng", client=c)


def test_searxng_empty_ok_with_healthy_engines(monkeypatch):
    monkeypatch.setenv("SEARXNG_URL", "http://searx.test")
    c, _ = make(reply(json={"results": [], "unresponsive_engines": []}))
    assert search("kazi", backend="searxng", client=c) == []


def test_searxng_results_win_over_dead_engines(monkeypatch):
    monkeypatch.setenv("SEARXNG_URL", "http://searx.test")
    body = searx_body(2) | {"unresponsive_engines": [["google", "CAPTCHA"]]}
    c, _ = make(reply(json=body))
    assert len(search("kazi", backend="searxng", client=c)) == 2


# --- arka uç seçimi ---

def test_auto_picks_first_ready(monkeypatch):
    monkeypatch.setenv("SEARXNG_URL", "http://searx.test")
    monkeypatch.setenv("TAVILY_API_KEY", KEY)
    c, calls = make(reply(json=tavily_body(1)))
    search("kazi", client=c)
    assert calls[0].url.host == "api.tavily.com"  # brave yok → tavily, searxng'den önce

    monkeypatch.setenv("BRAVE_API_KEY", KEY)
    c, calls = make(reply(json=brave_body(1)))
    search("kazi", client=c)
    assert calls[0].url.host == "api.search.brave.com"


def test_auto_only_searxng(monkeypatch):
    monkeypatch.setenv("SEARXNG_URL", "http://searx.test")
    c, calls = make(reply(json=searx_body(1)))
    search("kazi", client=c)
    assert calls[0].url.host == "searx.test"


def test_empty_env_values_do_not_count(monkeypatch):
    monkeypatch.setenv("BRAVE_API_KEY", "   ")
    monkeypatch.setenv("TAVILY_API_KEY", "")
    c, calls = make(reply(json={}))
    with pytest.raises(SearchError, match="yapılandırılmamış"):
        search("kazi", client=c)
    assert not calls


def test_no_backend_gives_setup_hint():
    c, calls = make(reply(json={}))
    with pytest.raises(SearchError) as ei:
        search("kazi", client=c)
    msg = str(ei.value)
    assert all(v in msg for v in VARS) and "export" in msg and not calls


def test_explicit_backend_without_credentials(monkeypatch):
    monkeypatch.setenv("BRAVE_API_KEY", KEY)  # başkası hazır olsa da istenen arka uç şart
    c, calls = make(reply(json={}))
    with pytest.raises(SearchError, match="tavily için TAVILY_API_KEY tanımlı değil") as ei:
        search("kazi", backend="tavily", client=c)
    assert KEY not in str(ei.value) and not calls


def test_backend_name_normalized(monkeypatch):
    use(monkeypatch, "brave")
    c, _ = make(reply(json=brave_body(1)))
    assert len(search("kazi", backend=" Brave ", client=c)) == 1


def test_unknown_backend():
    c, _ = make(reply(json={}))
    with pytest.raises(ValueError, match="brave, tavily, searxng"):
        search("kazi", backend="bing", client=c)


@pytest.mark.parametrize("q", ["", "   ", None, 5])
def test_bad_query(monkeypatch, q):
    use(monkeypatch, "brave")
    c, calls = make(reply(json=brave_body(1)))
    with pytest.raises(ValueError, match="sorgu"):
        search(q, backend="brave", client=c)
    assert not calls


@pytest.mark.parametrize("limit", [0, -1, "5", 2.5, None])
def test_bad_limit(monkeypatch, limit):
    use(monkeypatch, "brave")
    c, calls = make(reply(json=brave_body(1)))
    with pytest.raises(ValueError, match="limit"):
        search("kazi", limit=limit, backend="brave", client=c)
    assert not calls


# --- istemci yaşam döngüsü ---

def test_own_client_is_closed_and_ascii_ua(monkeypatch):
    use(monkeypatch, "brave")
    made, real = [], httpx.Client

    def fake(**kw):
        c = real(transport=httpx.MockTransport(reply(json=brave_body(1))), **kw)
        made.append(c)
        return c

    monkeypatch.setattr(search_mod.httpx, "Client", fake)
    assert len(search("kazi")) == 1
    c = made[0]
    assert c.is_closed and not c.follow_redirects
    assert c.headers["User-Agent"].isascii() and c.headers["User-Agent"].startswith("kazi/")


def test_own_client_closed_on_error(monkeypatch):
    use(monkeypatch, "brave")
    made, real = [], httpx.Client

    def fake(**kw):
        c = real(transport=httpx.MockTransport(reply(500, text="x")), **kw)
        made.append(c)
        return c

    monkeypatch.setattr(search_mod.httpx, "Client", fake)
    with pytest.raises(SearchError):
        search("kazi")
    assert made[0].is_closed


def test_given_client_left_open(monkeypatch):
    use(monkeypatch, "brave")
    c, _ = make(reply(json=brave_body(1)))
    search("kazi", client=c)
    assert not c.is_closed


# --- gerçek soket: yerel http.server (dış ağ yok) ---

def test_searxng_against_local_http_server(monkeypatch):
    import json
    import threading
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from urllib.parse import parse_qs, urlparse

    seen = {}

    class H(BaseHTTPRequestHandler):
        def do_GET(self):
            u = urlparse(self.path)
            seen.update(path=u.path, q=parse_qs(u.query), ua=self.headers["User-Agent"])
            body = json.dumps(searx_body(6)).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *a):
            pass

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        monkeypatch.setenv("SEARXNG_URL", f"http://127.0.0.1:{srv.server_port}")
        res = search("yerel sunucu", limit=3)  # backend=None, client=None: tüm gerçek yol
    finally:
        srv.shutdown()
        srv.server_close()
    assert [r["url"] for r in res] == [f"https://s.test/{i}" for i in range(3)]
    assert seen["path"] == "/search" and seen["q"] == {"q": ["yerel sunucu"], "format": ["json"]}
    assert seen["ua"].startswith("kazi/") and seen["ua"].isascii()


def test_searxng_token_value_alone_is_scrubbed(monkeypatch):
    monkeypatch.setenv("SEARXNG_URL", "http://kullanici:PAROLA9@searx.test/?token=abc123xyz&x=1")
    c, _ = make(reply(500, json={"error": "bad token abc123xyz for user kullanici:PAROLA9"}))
    with pytest.raises(SearchError) as ei:
        search("kazi", backend="searxng", client=c)
    msg = str(ei.value)
    assert "abc123xyz" not in msg and "PAROLA9" not in msg and "HTTP 500" in msg and "bad token" in msg


@pytest.mark.parametrize("name", ALL)
def test_control_characters_are_stripped_from_results(monkeypatch, name):
    import re

    _, body = use(monkeypatch, name)
    item = {"title": "Tarif \x1b]0;PWNED-TITLE\x07\x1b[2J", "url": "https://s.test/p\x1b[31m",
            "description": "ozet \x1b[41mkirmizi &#27;[1m \x9b0m", "content": "ozet \x1b[41mkirmizi &#27;[1m \x9b0m"}
    payload = {"web": {"results": [item]}} if name == "brave" else {"results": [item]}
    c, _ = make(reply(json=payload))
    (r,) = search("kazi", backend=name, client=c)
    assert not re.search(r"[\x00-\x08\x0b-\x1f\x7f-\x9f]", r["title"] + r["url"] + r["snippet"])
    assert r["title"].startswith("Tarif") and r["url"].startswith("https://s.test/p") and "kirmizi" in r["snippet"]
