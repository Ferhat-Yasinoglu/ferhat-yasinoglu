import argparse
import json
import logging
import os
import re
import sys
from pathlib import Path

import httpx

from . import extract_data
from .core import Page, crawl, map_site, scrape, scrape_file
from .search import BACKENDS, search


def _slug(url: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", re.sub(r"^https?://", "", url.lower())).strip("-")[:100] or "index"


def _filename(url: str, used: set[str]) -> str:
    """_slug çakışırsa (/a/b ve /a-b, uzun URL'lerin kesilmesi) -2, -3 ... ekler; sayfalar üst üste yazılmaz."""
    base, name, i = _slug(url), _slug(url), 1
    while name in used:
        i += 1
        name = f"{base}-{i}"
    used.add(name)
    return f"{name}.md"


def _warn(msg: str) -> None:
    print(f"uyarı: {msg}", file=sys.stderr)


def _utf8_streams() -> None:
    """Yerel ayar UTF-8 değilken (LC_ALL=C) Türkçe çıktı patlamasın: boru/dosyaya UTF-8, terminalde '?' basılır."""
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(errors="replace") if s.isatty() else s.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError, OSError):
            pass


def _why_empty(source: str) -> str:
    if re.match(r"https?://", source, re.I):
        return "(taranmış PDF olabilir; OCR yok. Sayfa JS ile yükleniyorsa --js deneyin)"
    if source.lower().endswith(".pdf"):
        return "(taranmış PDF olabilir; OCR yok)"
    return "(kaynak boş)"


def _load(source: str, js: bool, full: bool) -> Page:
    """URL → scrape, '-' → stdin (Markdown/metin), diğerleri yerel dosya (.pdf, .html, .md, .txt)."""
    if re.match(r"https?://", source, re.I):
        return scrape(source, js=js, only_main=not full)
    if source == "-":
        return Page(url="stdin", markdown=sys.stdin.read())
    return scrape_file(source, only_main=not full)


def _read_schema(path: str) -> dict:
    try:
        schema = json.loads(Path(path).read_text(encoding="utf-8"))
    except OSError as e:
        raise ValueError(f"Şema dosyası okunamadı ({path}): {e.strerror or e}") from e
    except json.JSONDecodeError as e:
        raise ValueError(f"Şema dosyası geçerli JSON değil ({path}): {e}") from e
    if not isinstance(schema, dict):
        raise ValueError(f"Şema bir JSON nesnesi olmalı ({path}).")
    return schema


def _extract_client():
    """Anahtar ve paket eksikse sayfayı indirmeden önce haber ver."""
    try:
        from .extract import _make_client
    except ModuleNotFoundError as e:
        if e.name != "anthropic":
            raise
        raise RuntimeError("extract için: pip install 'kazi[extract]'") from e
    return _make_client()


def _cmd_extract(a) -> int:
    schema = _read_schema(a.schema) if a.schema else None
    client = _extract_client()
    page = _load(a.source, a.js, a.full)
    if page.status >= 400:
        raise RuntimeError(f"{page.url} HTTP {page.status} döndü.")
    if not page.markdown.strip():
        raise RuntimeError(f"{page.url} içinde metin bulunamadı {_why_empty(a.source)}.")
    r = extract_data(page.markdown, schema=schema, prompt=a.prompt, model=a.model, client=client)
    for w in r["warnings"]:
        _warn(w)
    print(json.dumps(r["data"], ensure_ascii=False, indent=2))
    return 0


def _cmd_search(a) -> int:
    results = search(a.query, limit=a.limit, backend=a.backend)
    if not results:
        _warn("sonuç bulunamadı.")
    if a.scrape:
        for r in results:
            try:
                p = scrape(r["url"], js=a.js)
                if p.status >= 400:
                    raise RuntimeError(f"{p.url} HTTP {p.status} döndü.")
            except (RuntimeError, ValueError, httpx.InvalidURL) as e:
                r["error"] = str(e)
                print(f"✗ {e}", file=sys.stderr)
                continue
            r["markdown"] = p.markdown
            if not p.markdown:
                _warn(f"{r['url']}: metin bulunamadı.")
    if a.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    elif a.scrape:
        for r in results:
            if "markdown" in r:
                print(f"\n\n<!-- {r['url']} -->\n\n{r['markdown']}")
    else:
        for i, r in enumerate(results, 1):
            print(f"{i}. {r['title']}\n   {r['url']}" + (f"\n   {r['snippet']}" if r["snippet"] else ""))
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="kazi", description="Web sayfalarını temiz Markdown'a çevirir.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("scrape", help="tek sayfa → Markdown (PDF otomatik)")
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

    e = sub.add_parser("extract", help="sayfadan/dosyadan Claude ile JSON veri çıkar (ANTHROPIC_API_KEY gerekir)")
    e.add_argument("source", help="URL, yerel dosya (.pdf .html .md .txt) ya da - (stdin)")
    e.add_argument("--schema", help="JSON Schema dosyası (type: object)")
    e.add_argument("--prompt", help="ne çıkarılacağını anlatan istem")
    e.add_argument("--model", help="model (varsayılan: $KAZI_MODEL ya da claude-sonnet-5-5)")
    e.add_argument("--js", action="store_true", help="URL'yi Playwright ile render et")
    e.add_argument("--full", action="store_true", help="ana içerikle sınırlama")

    q = sub.add_parser("search", help="web araması (BRAVE_API_KEY, TAVILY_API_KEY ya da SEARXNG_URL gerekir)")
    q.add_argument("query")
    q.add_argument("--limit", type=int, default=5)
    q.add_argument("--backend", choices=sorted(BACKENDS), help="varsayılan: ortamda tanımlı ilk arka uç")
    q.add_argument("--scrape", action="store_true", help="sonuç sayfalarını da Markdown'a çevir")
    q.add_argument("--js", action="store_true", help="--scrape ile sayfaları Playwright ile render et")
    q.add_argument("--json", action="store_true", help="JSON çıktı")

    a = ap.parse_args(argv)
    logging.getLogger("pypdf").setLevel(logging.ERROR)
    _utf8_streams()

    try:
        if a.cmd == "extract":
            return _cmd_extract(a)
        if a.cmd == "search":
            return _cmd_search(a)
        if a.cmd == "scrape":
            p = scrape(a.url, js=a.js, only_main=not a.full)
            if p.status >= 400:
                raise RuntimeError(f"{p.url} HTTP {p.status} döndü.")
            if a.json:
                print(json.dumps({"url": p.url, "title": p.title, "markdown": p.markdown,
                                  "links": p.links, "status": p.status}, ensure_ascii=False, indent=2))
            else:
                print(p.markdown)
            if not p.markdown:
                _warn(f"metin bulunamadı {_why_empty(a.url)}.")
        elif a.cmd == "map":
            for u in map_site(a.url, limit=a.limit):
                print(u)
        else:
            out = Path(a.out) if a.out else None
            if out:
                out.mkdir(parents=True, exist_ok=True)
            used, skipped, n = set(), [], 0

            def on_skip(u: str, why: str) -> None:
                skipped.append(why)
                print(f"✗ {u}: {why}", file=sys.stderr)

            for p in crawl(a.url, limit=a.limit, depth=a.depth, include=a.include, exclude=a.exclude,
                           js=a.js, respect_robots=not a.no_robots, on_skip=on_skip):
                n += 1
                if out:
                    (out / _filename(p.url, used)).write_text(
                        f"# {p.title or p.url}\n\n<{p.url}>\n\n{p.markdown}\n", encoding="utf-8")
                    print(f"✓ {p.url}", file=sys.stderr)
                else:
                    print(f"\n\n<!-- {p.url} -->\n\n{p.markdown}")
            if skipped and not n:
                hint = " (robots.txt'i yok saymak için --no-robots)" if any("robots" in w for w in skipped) else ""
                raise RuntimeError(f"hiç sayfa alınamadı{hint}.")
            if skipped:
                _warn(f"{len(skipped)} sayfa atlandı.")
    except KeyboardInterrupt:
        print("kazi: iptal edildi.", file=sys.stderr)
        return 130
    except BrokenPipeError:  # `| head`: okuyan kapandı, hata değil
        try:
            os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())  # çıkışta flush hatası vermesin
        except (AttributeError, ValueError, OSError):
            pass
        return 0
    except (RuntimeError, ValueError, OSError, httpx.InvalidURL, re.error) as e:
        print(f"kazi: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
