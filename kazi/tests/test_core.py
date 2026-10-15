import httpx
import pytest

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
    import kazi.core as core
    monkeypatch.setattr(core, "_client", lambda timeout=30.0: httpx.Client(
        transport=httpx.MockTransport(handler), follow_redirects=True))
    urls = [p.url for p in crawl("https://s.test/", limit=10, delay=0)]
    assert "https://s.test/" in urls and "https://s.test/a" in urls
    assert "https://s.test/b" not in urls  # robots.txt
    assert not any("dis.example" in u for u in urls)
