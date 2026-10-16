# kazi

Kişisel kullanım için küçük bir Firecrawl benzeri: web sayfalarını ve PDF'leri temiz Markdown'a çevirir,
Claude ile şemaya göre JSON veri çıkarır, web'de arar.

## Kurulum

```bash
pip install -e .                  # scrape, map, crawl, PDF, search
pip install -e '.[extract]'       # + extract (Claude; anthropic paketi)
pip install -e '.[js]' && playwright install chromium    # + JS sayfaları (--js)
pip install -e '.[web]'           # + web arayüzü (kazi serve)
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
- **map**: sitemap index'in alt sitemap'leri (aynı site, en çok 20 dosya) açılır; `--limit` kadar adres bulununca okuma durur;
  başlangıç sayfası HTTP hatası verirse hata olur.
- `text/plain`, Markdown ve JSON URL'leri olduğu gibi döner. Sayfa kodlaması başlıktan, `<meta charset>`'ten ya da tahminle bulunur.
- Bir yanıt en çok 50 MB (açılmış bayt; `serve`'de 3 MB) ve 120 sn olabilir; PDF'ler 5000 sayfa / 10 milyon karakter / 60 sn ile sınırlıdır
  (aşılırsa Markdown'ın sonuna kırpıldığını söyleyen bir satır eklenir).
- `scrape` HTTP 4xx/5xx yanıtında, `crawl` hiç sayfa alamazsa hata verir. Hatalar traceback yerine `kazi: ...` satırı ve
  çıkış kodu 1 ile biter; Ctrl-C çıkış kodu 130, `| head` sessiz çıkış (0).

### Web arayüzü (telefondan)

Adres yapıştır, sayfanın temiz Markdown'ı ekranda. Sekmeler: sayfayı çevir, adresleri listele, bilgi çıkar
(`ANTHROPIC_API_KEY` yoksa bu sekme görünmez; JS kutusu da yalnız sunucuda JS açıksa görünür).

```bash
pip install -e '.[web,extract]'
export KAZI_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(24))')"   # giriş şifresi
kazi serve --host 0.0.0.0 --port 8000      # tarayıcıda http://BILGISAYAR:8000, şifreyi bir kez girin
kazi serve --host 127.0.0.1 --no-auth      # yalnız bu bilgisayarda, şifresiz
```

- `KAZI_TOKEN` olmadan sunucu **başlamaz** (tek istisna: `--host 127.0.0.1 --no-auth`). Şifrede boşluk ve Türkçe harf olamaz.
  Şifreyi `.env` dosyasında tutacaksanız `.env` git'te yok sayılır; yine de GitHub'a yüklemeyin.
- API: `GET /api/health`, `GET /api/features` (şifre gerekir), `POST /api/scrape`, `/api/map`, `/api/extract`;
  başlık `Authorization: Bearer <KAZI_TOKEN>`. Hata: HTTP 4xx/5xx ve `{"error": "<kısa Türkçe mesaj>"}`.
- Web'de bir yanıt en çok 3 MB olabilir (çekirdekteki 50 MB yerine; yapay ölçüm: her 22 baytta bir link olan 3 MB'lık sayfada tepe bellek ~430 MB, düz metin sayfada ~100 MB); yanıta en çok 2000 link konur.
- Giriş: yanlış şifre dakikada 10 kez denenebilir, sonra yanlış denemeler 429 alır; doğru şifre hiçbir zaman kilitlenmez.
- SSRF koruması: iç ağ ve özel adresler açılmaz (`KAZI_ALLOW_PRIVATE=1` yalnız testler/yerel deneme için).
- Docker/Render ile yayınlamak için bkz. [DEPLOY.md](DEPLOY.md) (telefondan adım adım rehber, sorun giderme tablosu).

### Ortam değişkenleri

| Değişken | Ne için |
|---|---|
| `ANTHROPIC_API_KEY` | `extract` (zorunlu) |
| `KAZI_MODEL` | `extract` için varsayılan modeli değiştirir |
| `BRAVE_API_KEY` | `search`: Brave Search API |
| `TAVILY_API_KEY` | `search`: Tavily |
| `SEARXNG_URL` | `search`: kendi SearXNG sunucunuz (örn. `http://localhost:8080`; `settings.yml` içinde JSON biçimi açık olmalı) |
| `KAZI_NO_SANDBOX` | `--js`: `1` ise Chromium sandbox'sız açılır (konteyner gibi sandbox'ın çalışmadığı ortamlar) |
| `KAZI_TOKEN` | `serve`: giriş şifresi (zorunlu; boşluksuz, Türkçe harfsiz, en az 16 karakter önerilir) |
| `KAZI_ALLOW_JS` | `serve`: `1` ise arayüzde JS seçeneği açılır (Playwright de kurulu olmalı; varsayılan kapalı) |
| `KAZI_ALLOW_PRIVATE` | `serve`: `1` ise iç ağ/özel adres denetimi kapanır (yalnız test ve yerel deneme) |
| `KAZI_MAX_CONCURRENT`, `KAZI_RATE_PER_MIN`, `KAZI_TIMEOUT` | `serve`: aynı anda en çok sayfa (3), dakikada en çok istek (30), bir istek en çok kaç saniye (90) |

`search` anahtarları hata iletilerinden silinir; kazi anahtarları ve şifreleri hiçbir yere yazmaz. `serve` yalnızca
indirme hatalarının (şifre ve dosya yolları silinmiş) kısa metnini loglar; ekrana ise yalnız sade Türkçe mesaj gider.

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
  `serve` JS modunda tarayıcının her isteği ve WebSocket bağlantısı adres denetiminden geçer (Playwright 1.48+).
- Bot korumalı siteler için proxy/anti-bot (kapsam dışı)
- Gerçek Anthropic / Brave / Tavily / SearXNG servisleriyle uçtan uca deneme yapılmadı; testler yerel sahte sunucu ve sahte istemci kullanır.

## Test

```bash
pip install -e '.[dev]' && pytest
```

`dev` extra'sı anthropic ve cryptography'yi de getirir (extract ve AES-PDF testleri için). JS testleri playwright ve bir
Chromium gerektirir; kurulu değilse atlanır. Testler dış ağa çıkmaz (yerel `127.0.0.1` sunucusu, `httpx.MockTransport`, sahte istemci).
