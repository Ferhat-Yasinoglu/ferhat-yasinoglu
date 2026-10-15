"""kazi çekirdeği: scrape, map, crawl."""
from __future__ import annotations

import re
import time
import urllib.robotparser
from collections import deque
from dataclasses import dataclass, field
from urllib.parse import urldefrag, urljoin, urlparse

import httpx
import trafilatura

UA = "kazi/0.1 (personal use)"
_HREF = re.compile(r"""<a\s[^>]*?href\s*=\s*["']([^"'#][^"']*)["']""", re.I)
_SKIP_EXT = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".css", ".js",
             ".zip", ".gz", ".mp4", ".mp3", ".woff", ".woff2", ".xml", ".json")


@dataclass
class Page:
    url: str
    markdown: str
    title: str | None = None
    links: list[str] = field(default_factory=list)
    status: int = 200


def _client(timeout: float = 30.0) -> httpx.Client:
    return httpx.Client(headers={"User-Agent": UA}, follow_redirects=True, timeout=timeout)


def _fetch_html(url: str, client: httpx.Client, js: bool = False, retries: int = 2) -> tuple[str, int, str]:
    """(html, status, son_url). js=True ise Playwright ile render eder."""
    if js:
        return _fetch_js(url)
    last: Exception | None = None
    for i in range(retries + 1):
        try:
            r = client.get(url)
            if r.status_code >= 500 and i < retries:
                time.sleep(2**i)
                continue
            return r.text, r.status_code, str(r.url)
        except httpx.HTTPError as e:
            last = e
            time.sleep(2**i)
    raise RuntimeError(f"{url} indirilemedi: {last}")


def _fetch_js(url: str) -> tuple[str, int, str]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        raise RuntimeError("JS render için: pip install 'kazi[js]' && playwright install chromium") from e
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(user_agent=UA)
        resp = pg.goto(url, wait_until="networkidle")
        html, final = pg.content(), pg.url
        status = resp.status if resp else 200
        b.close()
    return html, status, final


def extract_links(html: str, base: str) -> list[str]:
    out, seen = [], set()
    for href in _HREF.findall(html):
        u = urldefrag(urljoin(base, href.strip()))[0]
        if urlparse(u).scheme not in ("http", "https") or u.lower().endswith(_SKIP_EXT) or u in seen:
            continue
        seen.add(u)
        out.append(u)
    return out


def scrape(url: str, js: bool = False, only_main: bool = True, client: httpx.Client | None = None) -> Page:
    """Tek sayfa → Markdown. js=True: Playwright. only_main=False: sayfanın tamamı."""
    own = client is None
    client = client or _client()
    try:
        html, status, final = _fetch_html(url, client, js=js)
    finally:
        if own:
            client.close()
    md = trafilatura.extract(
        html, output_format="markdown", include_links=True, include_tables=True,
        favor_recall=not only_main, url=final,
    ) or ""
    meta = trafilatura.extract_metadata(html)
    return Page(url=final, markdown=md, title=meta.title if meta else None,
                links=extract_links(html, final), status=status)


def _same_site(a: str, b: str) -> bool:
    return urlparse(a).netloc.lower() == urlparse(b).netloc.lower()


def _robots(url: str, client: httpx.Client) -> urllib.robotparser.RobotFileParser:
    p = urlparse(url)
    rp = urllib.robotparser.RobotFileParser()
    try:
        r = client.get(f"{p.scheme}://{p.netloc}/robots.txt")
        rp.parse(r.text.splitlines() if r.status_code == 200 else [])
    except httpx.HTTPError:
        rp.parse([])
    return rp


def _sitemap_urls(start: str, client: httpx.Client) -> list[str]:
    p = urlparse(start)
    try:
        r = client.get(f"{p.scheme}://{p.netloc}/sitemap.xml")
        if r.status_code == 200:
            return re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", r.text)
    except httpx.HTTPError:
        pass
    return []


def map_site(url: str, limit: int = 200, use_sitemap: bool = True) -> list[str]:
    """Sayfaları indirmeden (sitemap varsa onunla, yoksa sadece ana sayfa linkleriyle) URL listesi."""
    with _client() as c:
        found: dict[str, None] = {}
        if use_sitemap:
            for u in _sitemap_urls(url, c):
                if _same_site(u, url) and not u.endswith(".xml"):
                    found[u] = None
        if len(found) < limit:
            page = scrape(url, client=c)
            for u in page.links:
                if _same_site(u, url):
                    found[u] = None
        return list(found)[:limit]


def crawl(url: str, limit: int = 20, depth: int = 2, include: str | None = None,
          exclude: str | None = None, delay: float = 0.5, js: bool = False,
          respect_robots: bool = True):
    """Genişlik öncelikli tarama; sayfaları geldikçe üretir (generator)."""
    inc = re.compile(include) if include else None
    exc = re.compile(exclude) if exclude else None
    with _client() as c:
        rp = _robots(url, c) if respect_robots else None
        queue = deque([(urldefrag(url)[0], 0)])
        seen = {queue[0][0]}
        n = 0
        while queue and n < limit:
            cur, d = queue.popleft()
            if rp and not rp.can_fetch(UA, cur):
                continue
            try:
                page = scrape(cur, js=js, client=c)
            except RuntimeError:
                continue
            if page.status < 400 and page.markdown:
                n += 1
                yield page
            if d < depth:
                for l in page.links:
                    if l in seen or not _same_site(l, url):
                        continue
                    if (inc and not inc.search(l)) or (exc and exc.search(l)):
                        continue
                    seen.add(l)
                    queue.append((l, d + 1))
            time.sleep(delay)
