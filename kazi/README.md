# kazi

Kişisel kullanım için küçük bir Firecrawl benzeri: web sayfalarını temiz Markdown'a çevirir.

```bash
pip install -e .            # JS sayfaları için: pip install -e '.[js]' && playwright install chromium

kazi scrape https://site.com/sayfa            # tek sayfa → Markdown
kazi scrape https://site.com --json           # url, title, markdown, links
kazi scrape https://site.com --js             # Playwright ile render
kazi map https://site.com --limit 100         # URL listesi (sitemap.xml + ana sayfa linkleri)
kazi crawl https://site.com --limit 50 --depth 2 --include '/docs/' --out cikti/
```

Python'dan: `from kazi import scrape, crawl, map_site`

## Yapılanlar
- scrape / map / crawl, Markdown çıktı (trafilatura)
- robots.txt'e uyar, istekler arası bekler, 5xx'te yeniden dener
- Aynı alan adıyla sınırlı, `--include/--exclude` regex filtresi

## Yapılmayanlar (sonraki adımlar)
- PDF desteği, Claude ile şemaya göre `extract`, `search`
- Bot korumalı siteler için proxy/anti-bot (kapsam dışı)

Test: `pip install -e '.[dev]' && pytest`
