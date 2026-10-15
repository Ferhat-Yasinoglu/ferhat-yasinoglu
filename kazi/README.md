# kazi

Kişisel kullanım için küçük bir Firecrawl benzeri: web sayfalarını ve PDF'leri temiz Markdown'a çevirir,
Claude ile şemaya göre JSON veri çıkarır, web'de arar.

## Kurulum

```bash
pip install -e .                  # scrape, map, crawl, PDF, search
pip install -e '.[extract]'       # + extract (Claude; anthropic paketi)
pip install -e '.[js]' && playwright install chromium    # + JS sayfaları (--js)
```

Bağımlılık tercihleri:
- **pypdf zorunlu**: küçük, saf Python; `scrape` PDF görünce sessizce bozulmasın diye çekirdekte.
- **anthropic isteğe bağlı (`extract`)**: ağır (içe aktarması ~1 sn, pydantic vb. getirir) ve API anahtarı ister;
  scrape/crawl/search kullananlara yük olmasın diye extra. Kurulu değilse `kazi extract` ne yapacağını söyler.
- **playwright isteğe bağlı (`js`)**: zaten ayrı bir tarayıcı indirmesi (`playwright install chromium`) gerektirir.
- AES şifreli (ama parolasız açılan) PDF'ler için ayrıca `pip install cryptography` gerekir; yoksa anlaşılır bir hata verir.

## Kullanım

```bash
kazi scrape https://site.com/sayfa            # tek sayfa → Markdown
kazi scrape https://site.com/rapor.pdf        # PDF otomatik: Content-Type ya da %PDF- imzasından anlaşılır
kazi scrape https://site.com --json           # url, title, markdown, links, status
kazi scrape https://site.com --js             # Playwright ile render (PDF URL'leri de çalışır)
kazi map https://site.com --limit 100         # URL listesi (sitemap.xml + ana sayfa linkleri)
kazi crawl https://site.com --limit 50 --depth 2 --include '/docs/' --out cikti/

kazi extract https://site.com/urun --schema sema.json --prompt "ürün adı ve fiyatı"
kazi extract rapor.pdf --prompt "bulguları listele"      # yerel .pdf .html .htm .md .txt
kazi scrape https://site.com/x | kazi extract - --schema sema.json   # "-" = stdin (Markdown/metin)

kazi search "kahve makinesi önerisi" --limit 5            # başlık, URL, özet
kazi search "kahve makinesi" --backend tavily --json
kazi search "kahve makinesi" --scrape                     # sonuç sayfalarını da Markdown'a çevirir (PDF dahil)
```

- **PDF**: her sayfa `## Sayfa N` bloğu olur (N gerçek sayfa no); başlık PDF üstverisinden gelir (`--json` çıktısında `title`).
  Linkler çıkarılmaz. Metni olmayan (taranmış) PDF boş Markdown verir ve stderr'e uyarı yazar; OCR yoktur.
  PDF olmayan ya da bozuk dosya, parola korumalı PDF temiz bir hata mesajıyla (çıkış kodu 1) biter.
- **extract**: stdout'a yalnızca JSON basar (`| jq` ile kullanılabilir); uyarılar (örn. içerik 150 000 karakterden uzun, kırpıldı)
  stderr'e gider. `--schema` bir JSON Schema dosyasıdır (`type: object`); verilmezse Claude anahtar adlarını kendisi seçer.
  Model: `--model` > `$KAZI_MODEL` > `claude-sonnet-5-5`.
- **search**: `--backend` verilmezse ortamda tanımlı ilk arka uç seçilir (sırayla brave, tavily, searxng).
  Hata veren sonuç sayfaları `--scrape` ile atlanır (stderr'e `✗` yazılır), `--json` çıktısında `error` alanı olur.
- **crawl**: ilk sayfa yönlendirilirse (örn. `site.com` → `www.site.com`) site, yönlendirmenin vardığı adrestir. Sonraki
  yönlendirmeler adım adım izlenir; robots.txt'in yasakladığı ya da başka siteye giden hedefe gidilmez. robots.txt 5xx
  verir ya da erişilemezse (RFC 9309) hiçbir sayfa alınmaz; `--no-robots` ile yok sayılır. `--limit` alınan sayfa
  sayısıdır, yapılan istek sayısı `limit*3+10` ile sınırlıdır. Atlanan sayfalar (robots, HTTP hatası, boş, indirilemedi)
  stderr'e `✗ URL: neden` olarak yazılır; hiç sayfa alınamazsa çıkış kodu 1 olur. `--out` altında aynı adı üreten
  URL'ler `-2`, `-3` ... ekiyle ayrılır.
- **map**: sitemap index'in alt sitemap'leri (aynı site, en çok 20 dosya) açılır; başlangıç sayfası HTTP hatası verirse hata olur.
- `text/plain`, Markdown ve JSON URL'leri olduğu gibi döner. Sayfa kodlaması başlıktan, `<meta charset>`'ten ya da tahminle bulunur.
- Bir yanıt en çok 50 MB (açılmış bayt) ve 120 sn olabilir; PDF'ler 5000 sayfa / 10 milyon karakter / 60 sn ile sınırlıdır
  (aşılırsa Markdown'ın sonuna kırpıldığını söyleyen bir satır eklenir).
- `scrape` HTTP 4xx/5xx yanıtında, `crawl` hiç sayfa alamazsa hata verir. Hatalar traceback yerine `kazi: ...` satırı ve
  çıkış kodu 1 ile biter; Ctrl-C çıkış kodu 130, `| head` sessiz çıkış (0).

### Ortam değişkenleri

| Değişken | Ne için |
|---|---|
| `ANTHROPIC_API_KEY` | `extract` (zorunlu) |
| `KAZI_MODEL` | `extract` için varsayılan modeli değiştirir |
| `BRAVE_API_KEY` | `search`: Brave Search API |
| `TAVILY_API_KEY` | `search`: Tavily |
| `SEARXNG_URL` | `search`: kendi SearXNG sunucunuz (örn. `http://localhost:8080`; `settings.yml` içinde JSON biçimi açık olmalı) |
| `KAZI_NO_SANDBOX` | `--js`: `1` ise Chromium sandbox'sız açılır (konteyner gibi sandbox'ın çalışmadığı ortamlar) |

`search` anahtarları hata iletilerinden silinir; kazi hiçbir şeyi loglamaz.

### Python'dan

```python
from kazi import scrape, crawl, map_site, extract_data, search_web

page = scrape("https://site.com/rapor.pdf")          # Page(url, markdown, title, links, status)
r = extract_data(page.markdown, schema={"type": "object", "properties": {"baslik": {"type": "string"}}},
                 prompt="başlığı çıkar")             # {"data": {...}, "model", "truncated", "warnings"}
hits = search_web("sorgu", limit=5)                  # [{"title", "url", "snippet"}, ...]
```

`extract_data` / `search_web` adları bilerek seçildi: `kazi.extract` ve `kazi.search` modül adları olarak kalsın
(paket düzeyinde `search` adı modülü gölgeler ve `import kazi.search as m` fonksiyon döndürür).
Hatalar `RuntimeError` alt sınıflarıdır (`kazi.extract.ExtractError`, `kazi.SearchError`).

## Yapılanlar
- scrape / map / crawl, Markdown çıktı (trafilatura); crawl robots.txt'e uyar, istekler arası bekler, 5xx'te yeniden dener
- Aynı alan adıyla sınırlı tarama, `--include/--exclude` regex filtresi
- PDF → Markdown (scrape, crawl ve `--js` yolunda otomatik)
- `extract`: Claude ile şemaya göre JSON (URL, PDF, HTML, Markdown, stdin)
- `search`: Brave, Tavily ya da SearXNG; isteğe bağlı sonuç sayfalarını kazıma

## Yapılmayanlar (sonraki adımlar)
- OCR: taranmış/görüntü PDF'ten metin çıkmaz. PDF'te tablo/başlık tespiti ve link çıkarma yok; çok sütunlu düzenler düz metne iner.
- `extract` çıktısını şemaya göre **doğrulamaz** (jsonschema ya da strict tool use yok), 150 000 karakterden uzun içeriği
  parçalamak yerine kırpar. Varsayılan modelin (belgelere göre) zorunlu `tool_choice`'u reddettiği varsayımıyla araç
  çağrısı yönlendirmeyle istenir; gelmezse bir kez yeniden denenir. Bu davranış canlı API ile doğrulanmadı.
- `search`: yalnızca web sonuçları (haber/görsel yok), yeniden deneme yok (ücretli API'de çift faturalamamak için).
  `scrape` ve `search --scrape` robots.txt'e bakmaz (yalnızca `crawl` bakar).
- JS render: DOM 0.7 sn sessiz kalana kadar beklenir (en çok 5 sn); yükleme bittikten sonra uzun sessizlikten sonra
  gelen içerik kaçabilir. Sabit değer, CLI'den ayarlanamaz. Chromium sandbox açık başlar; **root'ta** (konteynerlerde
  genelde böyledir) ya da `KAZI_NO_SANDBOX=1` iken `--no-sandbox` ile açılır. Bu modda güvenmediğiniz sitelerde `--js`
  kullanmayın (yalıtılmış bir VM/konteyner dışında renderer açığı sizin yetkinizle çalışır). `--js` ile yönlendirmeler tarayıcıda
  izlenir: robots/aynı-site denetimi yönlendirme tamamlandıktan sonra yapılır (içerik çıktıya girmez, ama istek yapılmış olur).
- Bot korumalı siteler için proxy/anti-bot (kapsam dışı)
- Gerçek Anthropic / Brave / Tavily / SearXNG servisleriyle uçtan uca deneme yapılmadı; testler yerel sahte sunucu ve sahte istemci kullanır.

## Test

```bash
pip install -e '.[dev]' && pytest
```

`dev` extra'sı anthropic ve cryptography'yi de getirir (extract ve AES-PDF testleri için). JS testleri playwright ve bir
Chromium gerektirir; kurulu değilse atlanır. Testler dış ağa çıkmaz (yerel `127.0.0.1` sunucusu, `httpx.MockTransport`, sahte istemci).
