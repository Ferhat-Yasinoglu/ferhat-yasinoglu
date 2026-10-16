"""CLI testleri: yerel http.server (127.0.0.1) + sahte Anthropic istemcisi. Dış ağa çıkmaz."""
import io
import json
import os
import re
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from types import SimpleNamespace as NS

import httpx
import pytest
from test_pdf import make_pdf

import kazi
import kazi.core as core
from kazi.cli import _filename, _slug, main

PDF = make_pdf(["Birinci sayfa metni", "Ikinci sayfa metni"], title="Rapor")
SCAN = make_pdf([None], title="Tarama")
HTML = ("<html><head><title>Ana Sayfa</title></head><body><article><h1>Merhaba Dünya</h1><p>%s</p></article>"
        "</body></html>" % ("Bu bir deneme paragrafıdır. " * 20))
DATA = {"baslik": "Rapor", "fiyat": 12.5}
SCHEMA = {"type": "object", "properties": {"baslik": {"type": "string"}, "fiyat": {"type": "number"}}}


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype):
        data = body if isinstance(body, bytes) else body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        s, path = self.server, self.path.split("?")[0]
        s.seen.append(self.path)
        base = f"http://127.0.0.1:{s.server_address[1]}"
        if path == "/search":
            items = [("Ana sayfa", "/a", "Ana sayfa özeti"), ("Rapor PDF", "/rapor.pdf", ""),
                     ("Kayıp", "/gone", "yok"), ("Sahte PDF", "/sahte.pdf", "bozuk"), ("Tarama", "/tarama.pdf", "")]
            results = [{"title": t, "url": base + u, "content": c} for t, u, c in items]
            self._send(200, json.dumps({"results": [] if "q=bos" in self.path else results}), "application/json")
        elif path == "/a":
            self._send(200, HTML, "text/html; charset=utf-8")
        elif path == "/rapor.pdf":
            self._send(200, PDF, "application/pdf")
        elif path == "/tarama.pdf":
            self._send(200, SCAN, "application/pdf")
        elif path == "/sahte.pdf":
            self._send(200, "<html>hata sayfası</html>", "application/pdf")
        else:
            self._send(404, "<html>yok</html>", "text/html")


@pytest.fixture(scope="module")
def site():
    s = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    s.daemon_threads = True
    s.seen = []
    threading.Thread(target=s.serve_forever, daemon=True).start()
    s.base = f"http://127.0.0.1:{s.server_address[1]}"
    yield s
    s.shutdown()
    s.server_close()


@pytest.fixture(autouse=True)
def env(monkeypatch):
    for v in ("BRAVE_API_KEY", "TAVILY_API_KEY", "SEARXNG_URL", "KAZI_MODEL"):
        monkeypatch.delenv(v, raising=False)
    monkeypatch.setenv("NO_PROXY", "127.0.0.1,localhost")  # yerel sunucuya vekil olmadan
    monkeypatch.setenv("no_proxy", "127.0.0.1,localhost")


class FakeClient:
    def __init__(self, data=DATA):
        self.data, self.calls, self.messages = data, [], self

    def create(self, **kw):
        self.calls.append(kw)
        return NS(stop_reason="tool_use", content=[NS(type="tool_use", name="emit", input=self.data)])


@pytest.fixture
def fake(monkeypatch):
    c = FakeClient()
    monkeypatch.setattr("kazi.extract._make_client", lambda: c)
    return c


def run(capsys, *argv):
    code = main(list(argv))
    out, err = capsys.readouterr()
    return code, out, err


def sent_text(fake) -> str:
    return fake.calls[0]["messages"][0]["content"]


# --- scrape -----------------------------------------------------------------------------------------
def test_scrape_pdf_url(site, capsys):
    code, out, err = run(capsys, "scrape", site.base + "/rapor.pdf")
    assert code == 0 and err == ""
    assert out.startswith("## Sayfa 1\n\nBirinci sayfa metni") and "## Sayfa 2" in out


def test_scrape_pdf_json(site, capsys):
    code, out, _ = run(capsys, "scrape", site.base + "/rapor.pdf", "--json")
    d = json.loads(out)
    assert code == 0 and d["title"] == "Rapor" and d["links"] == [] and d["status"] == 200
    assert d["url"] == site.base + "/rapor.pdf" and "Ikinci sayfa metni" in d["markdown"]


def test_scrape_html_still_works(site, capsys):
    code, out, err = run(capsys, "scrape", site.base + "/a")
    assert code == 0 and "Merhaba Dünya" in out and err == ""


def test_scrape_scanned_pdf_warns_but_succeeds(site, capsys):
    code, out, err = run(capsys, "scrape", site.base + "/tarama.pdf")
    assert code == 0 and out.strip() == "" and "metin bulunamadı" in err


def test_scrape_fake_pdf_is_clean_error(site, capsys):
    code, out, err = run(capsys, "scrape", site.base + "/sahte.pdf")
    assert code == 1 and out == ""
    assert err.startswith("kazi: ") and "PDF olarak okunamadı" in err and "Traceback" not in err


# --- extract ----------------------------------------------------------------------------------------
def test_extract_url_with_schema_and_prompt(site, fake, tmp_path, capsys):
    sf = tmp_path / "s.json"
    sf.write_text(json.dumps(SCHEMA))
    code, out, err = run(capsys, "extract", site.base + "/a", "--schema", str(sf), "--prompt", "başlığı bul")
    assert code == 0 and err == "" and json.loads(out) == DATA
    kw = fake.calls[0]
    assert kw["tools"][0]["input_schema"]["properties"] == SCHEMA["properties"]
    assert "Merhaba Dünya" in sent_text(fake) and "başlığı bul" in sent_text(fake)


def test_extract_without_schema_is_freeform(site, fake, capsys):
    code, out, _ = run(capsys, "extract", site.base + "/a")
    assert code == 0 and json.loads(out) == DATA
    assert fake.calls[0]["tools"][0]["input_schema"] == {"type": "object"}


def test_extract_model_flag_and_env(site, fake, monkeypatch, capsys):
    run(capsys, "extract", site.base + "/a", "--model", "claude-haiku-4-5")
    monkeypatch.setenv("KAZI_MODEL", "claude-from-env")
    run(capsys, "extract", site.base + "/a")
    assert [c["model"] for c in fake.calls] == ["claude-haiku-4-5", "claude-from-env"]


def test_extract_pdf_url_feeds_pdf_text_to_model(site, fake, capsys):
    code, out, _ = run(capsys, "extract", site.base + "/rapor.pdf")
    assert code == 0 and json.loads(out) == DATA
    assert "## Sayfa 2\n\nIkinci sayfa metni" in sent_text(fake)


def test_extract_local_files(tmp_path, fake, capsys):
    (tmp_path / "r.pdf").write_bytes(PDF)
    (tmp_path / "s.html").write_text(HTML, encoding="utf-8")
    (tmp_path / "n.md").write_text("# Not\n\nÖzel içerik çğş\n", encoding="utf-8")
    for name, needle in (("r.pdf", "Birinci sayfa metni"), ("s.html", "Merhaba Dünya"), ("n.md", "Özel içerik çğş")):
        fake.calls.clear()
        code, out, _ = run(capsys, "extract", str(tmp_path / name))
        assert code == 0 and json.loads(out) == DATA and needle in sent_text(fake), name


def test_extract_stdin(fake, monkeypatch, capsys):
    monkeypatch.setattr(sys, "stdin", io.StringIO("# Başlık\n\nstdin'den gelen metin\n"))
    code, out, _ = run(capsys, "extract", "-")
    assert code == 0 and json.loads(out) == DATA and "stdin'den gelen metin" in sent_text(fake)


def test_extract_truncation_warning_goes_to_stderr(tmp_path, fake, capsys):
    f = tmp_path / "buyuk.md"
    f.write_text("satır metni\n" * 20_000, encoding="utf-8")  # 240k karakter > MAX_CHARS
    code, out, err = run(capsys, "extract", str(f))
    assert code == 0 and json.loads(out) == DATA  # stdout hâlâ saf JSON
    assert "uyarı:" in err and "kırpıldı" in err


def test_extract_scanned_pdf_errors_without_calling_model(site, fake, capsys):
    code, out, err = run(capsys, "extract", site.base + "/tarama.pdf")
    assert code == 1 and out == "" and "metin bulunamadı" in err and fake.calls == []


def test_extract_http_error_page_errors_without_calling_model(site, fake, capsys):
    code, _, err = run(capsys, "extract", site.base + "/yok")
    assert code == 1 and "HTTP 404" in err and fake.calls == []


def test_extract_missing_file(fake, capsys):
    code, _, err = run(capsys, "extract", "olmayan.pdf")
    assert code == 1 and "Dosya bulunamadı" in err and "http" in err and fake.calls == []


@pytest.mark.parametrize("content, msg", [("{bozuk", "geçerli JSON değil"), ("[1, 2]", "JSON nesnesi olmalı"), (None, "okunamadı")])
def test_extract_bad_schema_file(tmp_path, fake, capsys, content, msg):
    sf = tmp_path / "s.json"
    if content is not None:
        sf.write_text(content)
    code, out, err = run(capsys, "extract", str(tmp_path / "x.md"), "--schema", str(sf))
    assert code == 1 and out == "" and msg in err and "Traceback" not in err and fake.calls == []


def test_extract_without_api_key(site, monkeypatch, capsys):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    code, out, err = run(capsys, "extract", site.base + "/a")
    assert code == 1 and out == "" and "ANTHROPIC_API_KEY" in err


def test_extract_without_anthropic_package(site, monkeypatch, capsys):
    monkeypatch.setitem(sys.modules, "anthropic", None)
    monkeypatch.delitem(sys.modules, "kazi.extract", raising=False)
    code, _, err = run(capsys, "extract", site.base + "/a")
    assert code == 1 and "kazi[extract]" in err


# --- search -----------------------------------------------------------------------------------------
@pytest.fixture
def searx(site, monkeypatch):
    monkeypatch.setenv("SEARXNG_URL", site.base)
    site.seen.clear()
    return site


def test_search_text_output(searx, capsys):
    code, out, err = run(capsys, "search", "kahve makinesi", "--limit", "3")
    assert code == 0 and err == ""
    lines = out.splitlines()
    assert lines[0] == "1. Ana sayfa" and lines[1] == f"   {searx.base}/a" and lines[2] == "   Ana sayfa özeti"
    assert "2. Rapor PDF" in out and "3. Kayıp" in out and "4." not in out
    q = next(p for p in searx.seen if p.startswith("/search"))
    assert "q=kahve" in q and "format=json" in q


def test_search_json(searx, capsys):
    code, out, _ = run(capsys, "search", "x", "--json", "--limit", "2")
    d = json.loads(out)
    assert code == 0 and [r["title"] for r in d] == ["Ana sayfa", "Rapor PDF"]
    assert set(d[0]) == {"title", "url", "snippet"}


def test_search_scrape_handles_html_pdf_and_failures(searx, capsys):
    code, out, err = run(capsys, "search", "x", "--scrape", "--limit", "4")
    assert code == 0
    assert f"<!-- {searx.base}/a -->" in out and "Merhaba Dünya" in out
    assert f"<!-- {searx.base}/rapor.pdf -->" in out and "## Sayfa 1\n\nBirinci sayfa metni" in out
    assert "✗" in err and "HTTP 404" in err and "PDF olarak okunamadı" in err
    assert "/gone -->" not in out and "/sahte.pdf -->" not in out


def test_search_scrape_json_marks_errors(searx, capsys):
    code, out, _ = run(capsys, "search", "x", "--scrape", "--json", "--limit", "4")
    by = {r["title"]: r for r in json.loads(out)}
    assert code == 0
    assert "Merhaba Dünya" in by["Ana sayfa"]["markdown"] and "Birinci sayfa" in by["Rapor PDF"]["markdown"]
    assert "HTTP 404" in by["Kayıp"]["error"] and "markdown" not in by["Kayıp"]
    assert "PDF olarak okunamadı" in by["Sahte PDF"]["error"]


def test_search_no_results(searx, capsys):
    code, out, err = run(capsys, "search", "bos")
    assert code == 0 and out == "" and "sonuç bulunamadı" in err
    code, out, _ = run(capsys, "search", "bos", "--json")
    assert code == 0 and json.loads(out) == []


def test_search_without_backend_configured(capsys, monkeypatch):
    monkeypatch.delenv("SEARXNG_URL", raising=False)
    code, out, err = run(capsys, "search", "x")
    assert code == 1 and out == "" and "BRAVE_API_KEY" in err and "Traceback" not in err


def test_search_backend_without_its_key(searx, capsys):
    code, _, err = run(capsys, "search", "x", "--backend", "brave")
    assert code == 1 and "BRAVE_API_KEY" in err


def test_search_bad_limit_and_backend(searx, capsys):
    code, _, err = run(capsys, "search", "x", "--limit", "0")
    assert code == 1 and "limit" in err
    with pytest.raises(SystemExit) as e:
        main(["search", "x", "--backend", "google"])
    assert e.value.code == 2


# --- paket API'si -----------------------------------------------------------------------------------
def test_package_exports_and_module_names_not_shadowed():
    import kazi.extract
    import kazi.search as search_mod

    assert {"scrape", "crawl", "map_site", "extract_data", "search_web"} <= set(kazi.__all__)
    assert kazi.search_web is search_mod.search and search_mod.SearchError is kazi.SearchError
    assert hasattr(kazi.extract, "ExtractError")  # kazi.extract hâlâ modül


def test_extract_data_api(fake):
    r = kazi.extract_data("# Başlık\n\nmetin", schema=SCHEMA, prompt="çıkar")
    assert r["data"] == DATA and r["truncated"] is False and r["warnings"] == []
    assert fake.calls[0]["tools"][0]["input_schema"]["properties"] == SCHEMA["properties"]


def test_search_web_api(searx):
    r = kazi.search_web("x", limit=2)
    assert [x["title"] for x in r] == ["Ana sayfa", "Rapor PDF"]


def test_search_scrape_warns_when_page_has_no_text(searx, capsys):
    code, out, err = run(capsys, "search", "x", "--scrape", "--json", "--limit", "5")
    by = {r["title"]: r for r in json.loads(out)}
    assert code == 0 and by["Tarama"]["markdown"] == "" and "error" not in by["Tarama"]
    assert "/tarama.pdf: metin bulunamadı" in err


# --- hatalar: traceback yerine `kazi: ...` ---------------------------------------------------------------
@pytest.mark.parametrize("argv", [
    ("scrape", "http://a.test:abc/"), ("map", "http://a.test:abc/"), ("crawl", "http://a.test:abc/"),
    ("scrape", "example.com"), ("crawl", "x.pdf"), ("map", "ftp://a.test/"),
    ("crawl", "http://127.0.0.1:1/", "--include", "("), ("crawl", "http://127.0.0.1:1/", "--exclude", "["),
])
def test_bad_url_or_regex_is_clean_error_and_fast(argv, capsys):
    t = time.monotonic()
    code, out, err = run(capsys, *argv)
    assert code == 1 and out == "" and err.startswith("kazi: ") and "Traceback" not in err
    assert time.monotonic() - t < 2  # kalıcı hata yeniden denenmez (eskiden 7 sn)


def test_extract_bad_url_is_clean_error(fake, capsys):
    code, _, err = run(capsys, "extract", "http://a.test:abc/")
    assert code == 1 and err.startswith("kazi: ") and "Geçersiz URL" in err and fake.calls == []


@pytest.mark.parametrize("exc", [httpx.InvalidURL("Invalid port"), re.error("kötü regex")])
def test_main_catches_invalid_url_and_regex_errors_from_anywhere(monkeypatch, capsys, exc):
    def boom(*a, **k):
        raise exc
    monkeypatch.setattr("kazi.cli.scrape", boom)
    code, out, err = run(capsys, "scrape", "http://a.test/")
    assert code == 1 and out == "" and err.startswith("kazi: ") and "Traceback" not in err


def test_keyboard_interrupt_is_quiet_exit_130(monkeypatch, capsys):
    def boom(*a, **k):
        raise KeyboardInterrupt
    monkeypatch.setattr("kazi.cli.scrape", boom)
    code, out, err = run(capsys, "scrape", "http://a.test/")
    assert code == 130 and out == "" and err == "kazi: iptal edildi.\n"


def test_broken_pipe_is_not_an_error(monkeypatch, capsys):
    def boom(*a, **k):
        raise BrokenPipeError(32, "Broken pipe")
    monkeypatch.setattr("kazi.cli.crawl", boom)
    code, out, err = run(capsys, "crawl", "http://a.test/")
    assert code == 0 and out == "" and err == ""


def test_scrape_http_error_status_is_an_error(site, capsys):
    for extra in ((), ("--json",)):
        code, out, err = run(capsys, "scrape", site.base + "/yok", *extra)
        assert code == 1 and out == "" and "HTTP 404" in err and err.startswith("kazi: ")
    code, out, err = run(capsys, "map", site.base + "/yok")
    assert code == 1 and out == "" and "HTTP 404" in err


def test_scrape_plain_text_url(monkeypatch, capsys):
    mock_site(monkeypatch, {"/r.md": (200, "# Not\n\nham metin çğş\n", "text/markdown")})
    code, out, err = run(capsys, "scrape", "http://a.test/r.md")
    assert code == 0 and out == "# Not\n\nham metin çğş\n\n" and err == ""


# --- boş içerik ipuçları -----------------------------------------------------------------------------------
def test_empty_local_source_hint_does_not_mention_pdf_or_js(tmp_path, fake, monkeypatch, capsys):
    (tmp_path / "bos.md").write_text("")
    code, _, err = run(capsys, "extract", str(tmp_path / "bos.md"))
    assert code == 1 and "metin bulunamadı" in err and "kaynak boş" in err and "PDF" not in err and "--js" not in err
    monkeypatch.setattr(sys, "stdin", io.StringIO(""))
    code, _, err = run(capsys, "extract", "-")
    assert code == 1 and "stdin içinde metin bulunamadı (kaynak boş)" in err and fake.calls == []
    (tmp_path / "tarama.pdf").write_bytes(SCAN)
    code, _, err = run(capsys, "extract", str(tmp_path / "tarama.pdf"))
    assert code == 1 and "taranmış PDF olabilir" in err and "--js" not in err


# --- extract: anahtar/paket denetimi indirmeden önce -----------------------------------------------------------
def test_extract_missing_key_fails_before_any_request(site, monkeypatch, capsys):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    n = len(site.seen)
    code, _, err = run(capsys, "extract", site.base + "/a")
    assert code == 1 and "ANTHROPIC_API_KEY" in err and len(site.seen) == n
    code, _, err = run(capsys, "extract", "http://127.0.0.1:1/")  # erişilemeyen URL'de de asıl neden söylenir
    assert code == 1 and "ANTHROPIC_API_KEY" in err


def test_extract_missing_package_fails_before_any_request(site, monkeypatch, capsys):
    monkeypatch.setitem(sys.modules, "anthropic", None)
    monkeypatch.delitem(sys.modules, "kazi.extract", raising=False)
    n = len(site.seen)
    code, _, err = run(capsys, "extract", site.base + "/a")
    assert code == 1 and "kazi[extract]" in err and len(site.seen) == n


# --- crawl: --out dosya adları, atlananların bildirimi -------------------------------------------------------
def pg(path, *links):
    nav = "".join(f'<a href="{h}">bağlantı</a>' for h in links)
    return (f"<html><head><title>Sayfa {path}</title></head><body><nav>{nav}</nav><article><h1>Başlık {path}</h1>"
            f"<p>{path} sayfasının içeriği. {'Bu bir deneme paragrafıdır. ' * 20}</p></article></body></html>")


def mock_site(monkeypatch, routes, robots=None):
    """core._client'ı sahte siteyle değiştirir. routes: {yol: (durum, gövde[, içerik türü])}; olmayan yol 404."""
    def h(req):
        if req.url.path == "/robots.txt":
            return httpx.Response(404) if robots is None else httpx.Response(200, text=robots)
        status, body, *ctype = routes.get(req.url.path, (404, "yok"))
        return httpx.Response(status, content=body.encode(), headers={"Content-Type": ctype[0] if ctype else "text/html; charset=utf-8"})
    monkeypatch.setattr(core, "_client", lambda timeout=30.0: httpx.Client(
        transport=httpx.MockTransport(h), follow_redirects=True))


def test_filename_never_collides():
    used = set()
    names = [_filename(u, used) for u in ("http://a.test/a/b", "http://a.test/a-b", "http://a.test/A/B", "http://a.test/a/b")]
    assert names == ["a-test-a-b.md", "a-test-a-b-2.md", "a-test-a-b-3.md", "a-test-a-b-4.md"]
    long1, long2 = "http://a.test/" + "x" * 150 + "1", "http://a.test/" + "x" * 150 + "2"
    assert _slug(long1) == _slug(long2) and _filename(long1, used) != _filename(long2, used)


def test_crawl_out_writes_one_file_per_page_even_when_slugs_collide(monkeypatch, tmp_path, capsys):
    paths = ["/a/b", "/a?b=1", "/a-b", "/Docs", "/docs", "/" + "u" * 120 + "1", "/" + "u" * 120 + "2"]
    routes = {"/": (200, pg("/", *paths))} | {p.split("?")[0]: (200, pg(p)) for p in paths}
    mock_site(monkeypatch, routes)
    code, _, err = run(capsys, "crawl", "http://a.test/", "--out", str(tmp_path / "c"), "--depth", "1", "--limit", "20", "--no-robots")
    files = sorted((tmp_path / "c").iterdir())
    assert code == 0 and err.count("✓") == len(paths) + 1 and len(files) == len(paths) + 1
    texts = [f.read_text(encoding="utf-8") for f in files]
    assert all(t.startswith("# ") and "Başlık" in t for t in texts)
    assert len({t.splitlines()[2] for t in texts}) == len(texts)  # her dosya kendi URL'sini taşır


def test_crawl_reports_skipped_pages_and_summary(monkeypatch, capsys):
    mock_site(monkeypatch, {"/": (200, pg("/", "/ok", "/yok", "/bos")), "/ok": (200, pg("/ok")),
                            "/bos": (200, "<html><body></body></html>")})
    code, out, err = run(capsys, "crawl", "http://a.test/", "--depth", "1")
    assert code == 0 and "<!-- http://a.test/ok -->" in out
    assert "✗ http://a.test/yok: HTTP 404" in err and "✗ http://a.test/bos: metin bulunamadı" in err
    assert "uyarı: 2 sayfa atlandı." in err


def test_crawl_with_nothing_fetched_is_an_error_with_hint(monkeypatch, capsys):
    mock_site(monkeypatch, {"/gizli": (200, pg("/gizli"))}, robots="User-agent: *\nDisallow: /gizli\n")
    code, out, err = run(capsys, "crawl", "http://a.test/gizli")
    assert code == 1 and out == "" and "robots.txt izin vermiyor" in err and "--no-robots" in err
    code, out, _ = run(capsys, "crawl", "http://a.test/gizli", "--no-robots")
    assert code == 0 and "gizli sayfasının içeriği" in out


# --- çıktı kodlaması yerel ayardan bağımsız -----------------------------------------------------------------
def _ascii_env():
    env = {k: v for k, v in os.environ.items() if k not in ("PYTHONIOENCODING", "PYTHONUTF8", "LANG", "LC_ALL")}
    return {**env, "LC_ALL": "C", "PYTHONUTF8": "0", "PYTHONCOERCECLOCALE": "0"}


def test_non_utf8_locale_still_writes_turkish_to_pipe_and_files(site, tmp_path):
    r = subprocess.run([sys.executable, "-m", "kazi.cli", "scrape", site.base + "/a"], env=_ascii_env(),
                       capture_output=True, timeout=60)
    assert r.returncode == 0 and "Merhaba Dünya" in r.stdout.decode("utf-8"), r.stderr
    out = tmp_path / "c"
    r = subprocess.run([sys.executable, "-m", "kazi.cli", "crawl", site.base + "/a", "--depth", "0", "--out", str(out)],
                       env=_ascii_env(), capture_output=True, timeout=60)
    (f,) = out.iterdir()
    assert r.returncode == 0 and "Merhaba Dünya" in f.read_text(encoding="utf-8"), r.stderr
