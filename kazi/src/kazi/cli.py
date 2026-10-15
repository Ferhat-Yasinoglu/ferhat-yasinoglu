import argparse
import json
import re
import sys
from pathlib import Path

from .core import crawl, map_site, scrape


def _slug(url: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", re.sub(r"^https?://", "", url.lower())).strip("-")[:100] or "index"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="kazi", description="Web sayfalarını temiz Markdown'a çevirir.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("scrape", help="tek sayfa → Markdown")
    s.add_argument("url")
    s.add_argument("--js", action="store_true", help="Playwright ile render et")
    s.add_argument("--full", action="store_true", help="ana içerikle sınırlama")
    s.add_argument("--json", action="store_true", help="JSON çıktı")

    m = sub.add_parser("map", help="sitedeki URL'leri listele")
    m.add_argument("url")
    m.add_argument("--limit", type=int, default=200)

    c = sub.add_parser("crawl", help="siteyi tara")
    c.add_argument("url")
    c.add_argument("--limit", type=int, default=20)
    c.add_argument("--depth", type=int, default=2)
    c.add_argument("--include", help="URL regex'i (sadece eşleşenler)")
    c.add_argument("--exclude", help="URL regex'i (eşleşenleri atla)")
    c.add_argument("--js", action="store_true")
    c.add_argument("--no-robots", action="store_true")
    c.add_argument("--out", help="her sayfayı bu klasöre .md olarak yaz")

    a = ap.parse_args(argv)

    if a.cmd == "scrape":
        p = scrape(a.url, js=a.js, only_main=not a.full)
        if a.json:
            print(json.dumps({"url": p.url, "title": p.title, "markdown": p.markdown,
                              "links": p.links, "status": p.status}, ensure_ascii=False, indent=2))
        else:
            print(p.markdown)
    elif a.cmd == "map":
        for u in map_site(a.url, limit=a.limit):
            print(u)
    else:
        out = Path(a.out) if a.out else None
        if out:
            out.mkdir(parents=True, exist_ok=True)
        for p in crawl(a.url, limit=a.limit, depth=a.depth, include=a.include,
                       exclude=a.exclude, js=a.js, respect_robots=not a.no_robots):
            if out:
                (out / f"{_slug(p.url)}.md").write_text(f"# {p.title or p.url}\n\n<{p.url}>\n\n{p.markdown}\n")
                print(f"✓ {p.url}", file=sys.stderr)
            else:
                print(f"\n\n<!-- {p.url} -->\n\n{p.markdown}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
