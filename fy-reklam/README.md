# FY Reklam

Ürünleri (Dawayar, Shafa, Nüsha, Zamin, NetStore, Mini Dakhl, Sosyal Stüdyo, Açık Defter, botflow-mcp, FY kursu)
tanıtan **Instagram ve Facebook gönderilerini tasarlayan, metnini yazan ve paylaşan iki kişilik stüdyo**.
Tasarım dili FY Ajans'ın v3 «Yeşil»i (aynı tokenlar, Geist + Geist Mono + Instrument Serif, Dari için Vazirmatn).
Çerçevesiz, derleme adımsız PWA + Cloudflare Worker. Plan ve kararlar: [PLAN.md](PLAN.md).

## Ne yapar

| Adım | Ne |
|---|---|
| Projeler | On ürün kartı. Metinler ürünlerin kendi README'lerinden; sayfada olmayan vaat ya da rakam yazılmaz. |
| Tasarla | Biçim (kare 1:1 · dikey 4:5 · hikâye 9:16), şablon (başlık · özellikler · akış), içerik dili (TR/DE/EN/FA, Dari sağdan sola), başlık (`*vurgu*` serif italik kireç), alt metin, özellikler, çağrı; canlı önizleme. |
| Metin | Kanca / değer / çağrı / etiketler. Canlı denetim: ≤2.200 karakter, ≤30 etiket, ≤20 @etiketleme, emoji ≤1, bağırma yok, baskı kalıbı yok, 4–5 niş etiket, Instagram'da bağlantı uyarısı; «daha fazla» kesmesiyle önizleme. |
| Paylaş | JPEG (yazı tipleri gömülü SVG → canvas, 1080 px), **indir** · telefonun **paylaşım menüsü** · **metni kopyala** · **Business Suite**; Worker bağlıysa **Instagram'a yayınla** / **Facebook'a yayınla** (PROVA etiketiyle). |
| Kayıt | Kim, ne zaman, hangi ürün, hangi kanal, sonuç. Ortak liste (Worker) + bu cihaz. |
| Daha | Dil (TR/Dari), tema (gece/gündüz), bağlantı doktoru, hesap, **Meta kurulum rehberi** (onay kutulu). |

## İki kip

| | Yerel | Bağlı |
|---|---|---|
| Giriş | yok | Google ile; yalnız `REKLAMCILAR` secret'ındaki iki Gmail |
| Tasarla · Metin · İndir · Paylaş · Kopyala | çalışır | çalışır |
| Doğrudan yayınla | kapalı | Instagram + Facebook Sayfası (PROVA=1 iken dış gönderim yok) |
| Kayıt | bu cihaz (IndexedDB) | ortak (Durable Object) + bu cihaz |

Uygulama Worker'a ulaşamazsa kendiliğinden yerel kipe düşer; hiçbir anahtar tarayıcıya inmez.

## Çalıştırma

```bash
npm install
npm run yerel        # http://localhost:8796 — uygulama + API aynı kökenden; Google'sız geliştirme girişi, PROVA
npm test             # metin kuralları, şablon SVG, sunucu (giriş, kayıt, görsel, yayın, CORS)
npm run kontrol      # statik denetim: sözlük (TR=Dari), innerHTML yok, mantıksal CSS, SW kabuğu, CSP, ürün kataloğu
npm run ekran        # Playwright: telefon + masaüstü ekran görüntüleri ve üretilen JPEG'ler → ekran/ (göz kontrolü)
```

Geliştirme girişinde `sahip@ornek.af` ve `arkadas@ornek.af` yöneticidir. Tarayıcıda `?nosw=1` gerekmez: service worker
localhost'ta kaydedilmez.

## Dosyalar

```
app/                      PWA (Cloudflare Pages'e olduğu gibi kopyalanır)
  index.html sw.js manifest.webmanifest
  css/tokenlar.css        FY Ajans v3 tokenları birebir (renk üçlüleri, yazı tipleri, köşe, hareket; gündüz teması; RTL)
  css/uygulama.css        cam kart, hap, düğme, alan, çip, menü, önizleme, reveal — yalnız mantıksal yön özellikleri
  js/ana.js               giriş: kip tespiti, hash yönlendirici, menü, View Transitions
  js/api.js ayar.js       Worker ile konuşma (Bearer), adresler
  js/depo.js              IndexedDB: taslaklar ve bu cihazın kaydı
  js/i18n.js sozluk.js    arayüz dili TR + Dari (kontrol.mjs eşitliği denetler)
  js/simge.js             elle çizilmiş çizgi simgeler (ürünler + arayüz)
  js/rehber.js            Meta kurulum rehberinin içeriği (TR + Dari)
  js/paylasilan/          SAF modüller — tarayıcı, Worker ve testler aynı dosyayı okur
    urunler.js            ürün kataloğu (ad, renk, simge, adres, 4 dilde özet/özellik/çağrı/etiket, kitle)
    metin.js              gönderi metni: birleştir, say, denetle (marka sesi + platform sınırları)
  js/sablon/cizim.js      SVG şablonlar (başlık · özellikler · akış), satır kırma, RTL, yazı tipi gömme, JPEG üretimi
  js/ekranlar/            giris · projeler · tasarla · metin · paylas · taslaklar · kayit · daha · kurulum · ortak
sunucu/                   Cloudflare Worker + tek SQLite Durable Object
  worker.js               yollar, CORS allowlist, tek yanıt sarmalayıcı
  reklam.js               şema (oturumlar, kayitlar, gorseller) ve DO sınıfı
  google.js               Google ID token doğrulama (JWKS, RS256; bağımlılıksız)
  meta.js                 Graph API adaptörü: Facebook /photos ve /feed, Instagram kap → durum → yayın, karusel, kota, hata sözlüğü
  cekirdek.js             yardımcılar ve gövde doğrulayıcıları
  yerel.mjs               yerel sunucu (node:sqlite ile DO taklidi)
  wrangler.toml
test/                     vitest (app + sunucu)
tools/                    kontrol.mjs · ekran.mjs · sun.mjs
```

## Tasarım

Ajans sitesinin v3 «Yeşil» dili: nötr gece siyahı zemin (`--ink-0…3`), tek vurgu kireç `#c0f244`, cam kartlar,
eş aralıklı «sistem sesi» etiketleri, italik serif vurgu kelimesi, FY harfleri. Tokenlar `app/css/tokenlar.css`
içinde fy-ajans `css/src/style.css` ile aynı adlarla durur; biri değişince öbürü de değişmeli. Üretilen görseller
aynı dili taşır: üstte marka etiketi, altta FY harfleri + `@farhad___yaqoobi` + ürün adresi; ürün rengi ikincil vurgu.

Hareketi azalt ayarında hiçbir şey kıpırdamaz. Dari'de bütün düzen sağdan sola döner (yalnız mantıksal CSS).
`innerHTML` yok; her metin `textContent` ile girer.

## Sunucu (API)

Her yanıt `Cache-Control: no-store`, `nosniff`, CORS yalnız `IZINLI_KOKENLER`. Hata biçimi `{ hata: <kod>, … }`.

```
GET  /v1/durum                 { ok, surum, gelistirme, istemciKimligi, prova, kanallar:{ facebook:{bagli}, instagram:{bagli} } }
POST /v1/giris                 { kimlik: <Google ID token> } → { jeton, kullanici } | 401 kimlik | 403 yetki | 429 oran | 503 yapilandirma
POST /v1/gelistirme/giris      yalnız yerel (GELISTIRME=1); yayında 404
POST /v1/cikis                 Bearer
GET  /v1/kayit?sinir=100       Bearer → { kayitlar }          POST /v1/kayit { urun, kanal, bicim, baslik } → { kayit }
POST /v1/gorsel                Bearer, image/jpeg ≤ 1,9 MB → { id, adres }   (415 gorsel_turu · 413 gorsel_buyuk)
GET  /g/<id>.jpg               herkese açık, image/jpeg, immutable; 7 gün sonra silinir — Meta buradan çeker
GET  /robots.txt               facebookexternalhit için /g/ açık, gerisi kapalı
GET  /v1/kanallar              Bearer → { prova, facebook:{ bagli, sayfaId }, instagram:{ bagli, igId, yol, kota } }
POST /v1/yayinla               Bearer { kanal: instagram|facebook, gorseller:[id…], metin, altMetin, urun, baslik }
                               → { kayit, sonuc:{ dis_id, prova } } | 409 tekrar | 422 gorsel_yok · cok_gorsel · metin_uzun · kanal_kapali
                               | 429 kota | 502 { hata:'meta', kod: yeniden_baglan · izin · oran · gorsel · bekle · tekrar · kimlik_dogrulama · meta }
```

- **PROVA** (`PROVA="1"`, varsayılan): yayın isteği kayda «prova» olarak düşer, Meta'ya hiçbir istek gitmez. Canlı:
  GitHub Variable `PROVA=0` ve iş akışını yeniden çalıştır.
- **Token'lar** yalnız Cloudflare secret'ında: `META_SAYFA_TOKEN` (Sayfa, süresiz), `META_SAYFA_ID`, `META_IG_ID`,
  `META_APP_SECRET` (appsecret_proof), isteğe bağlı `META_KULLANICI_TOKEN` (uzun ömürlü kullanıcı token'ı; Instagram
  kap durum sorgusu bununla), isteğe bağlı `META_IG_TOKEN` (Instagram Login yolu → graph.instagram.com).
  Graph çağrılarında token `Authorization: Bearer` başlığında; hata mesajlarından token süzülür; gövde/jeton loglanmaz.
- **Tekrar**: aynı kanalda son 24 saatte aynı metin yayınlandıysa 409 (Facebook 506 «Duplicate Post» reddini önler).
- **Görsel**: tarayıcı yalnız yayınlarken yükler; sunucu sihirli baytı (FF D8 FF) ve boyutu denetler; adres rastgele.

## Meta kurulumu (bir kez, sahip)

Adım adım ve onay kutulu hâli uygulamada: **Daha → Meta kurulum rehberi**. Kısaca:

1. Instagram hesabı **profesyonel ve herkese açık**. Bir **Facebook Sayfası** olsun, Instagram ona bağlı, ikisi aynı
   işletme portföyünde (Business Suite için de şart). Sayfada kimlik doğrulaması / 2FA tamam.
2. developers.facebook.com → **Business** türü uygulama → ürün **Facebook Login for Business**. Instagram ve Facebook
   Sayfası birlikte isteniyorsa tek yol bu (bir uygulama ya Facebook Login ya Instagram Login kullanır, ikisini birden
   değil). İzinler: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`,
   `instagram_content_publish`. **Standard Access yeter**; App Review ve Business Verification yalnız başkalarının
   hesapları için.
3. Roller: sen Administrator, reklamcı arkadaşın **Tester** (normal Facebook hesabı; Meta «çalışan ya da anlaşma» şartı
   koyar, bir paragraf yeter). Arkadaşın Meta'da OAuth yapmaz: FY Reklam'a Google ile girer, Worker senin bağlantınla
   gönderir, kayıtta onun adı yazar.
4. Basic Settings (gizlilik politikası URL'si, hizmet şartları, simge, kategori, e-posta) → uygulama **Live**.
   Development modunda Sayfaya API ile atılan gönderi yalnız rol sahiplerine görünür.
5. Graph API Explorer: kullanıcı token'ı → uzun ömürlü (`fb_exchange_token`) → `/me/accounts` → Sayfa token'ı (süresiz)
   + `instagram_business_account`. Secret'lara yaz (aşağıda). Kullanıcı token'ı ≈60 günde yenilenmezse yeni Sayfa
   token'ı türetilemez; 190 hatasında «yeniden bağlan».
6. Bilgisayardan curl ile tek görselle kanıt (kap → FINISHED → yayın; `/photos`); çıkış yapılmış tarayıcıdan görünürlük;
   sonra ikisini sil. Gerçek hata kodlarını buraya tarihle yaz.

**B planı (Sayfa açmak istemezsen):** Instagram için *Instagram API with Instagram Login* (`instagram_business_basic` +
`instagram_business_content_publish`, 60 günlük token → `META_IG_TOKEN`), Facebook için Business Suite ile elle.

## Yayın

| Ne | Nereye | İş akışı |
|---|---|---|
| Uygulama | https://fy-reklam.pages.dev | `.github/workflows/fy-reklam-yayin.yml` (main'e `fy-reklam/app/**` push) |
| Sunucu | https://fy-reklam-sunucu.ferhatyasinoglu.workers.dev | `.github/workflows/fy-reklam-sunucu.yml` (sunucu değişince) |
| Testler | — | `.github/workflows/fy-reklam.yml` (PR ve push) |

GitHub → Settings → Secrets and variables → Actions:

- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `REKLAMCILAR` (iki Gmail, virgülle),
  `META_SAYFA_TOKEN`, `META_SAYFA_ID`, `META_IG_ID`, `META_APP_SECRET`; isteğe bağlı `META_KULLANICI_TOKEN`, `META_IG_TOKEN`.
- Variables: `GOOGLE_ISTEMCI` (Google Cloud OAuth «Web application» istemci kimliği; *Authorized JavaScript origins*
  listesinde `https://fy-reklam.pages.dev`), `PROVA` (`1` prova, `0` canlı).

Secret yoksa iş akışları uyarı verip dağıtmadan biter. Worker adresi değişirse `app/js/ayar.js` (YAYIN) ve
`app/index.html` CSP `connect-src` birlikte değişir (`npm run kontrol` denetler).

Bu klasör şimdilik profil deposunun içinde (`botflow-mcp/` gibi). Önerilen: kendi gizli deposuna taşımak
(`git subtree split -P fy-reklam`), iş akışlarından `paths` ve `working-directory` satırlarını silmek. Kodda hiçbir
anahtar ya da liste yok; herkese açık durması zararsız, ama Meta uygulama kimliği ve kullanım kayıtları gizli depoda
daha rahat durur.

## Dürüst etiketler

Kanal kartları ve bu tablo kodda tek yerdedir; ürün sözü Meta'nın gerçek kurallarına bağlıdır.

- **Çalışır** — Instagram (kendi profesyonel hesabın) ve Facebook Sayfası, Meta kurulumu bitince; PROVA'dan canlıya
  iki adım.
- **Elle** — JPEG indir, telefondan paylaş, metni kopyala, Business Suite: her zaman, sunucusuz da.
- **Platform izin vermiyor** — Facebook kişisel profile API ile gönderi; Instagram'da zamanlama (kendi kuyruğumuz sonra).
- **Meta onayı gerekir** — başkalarının hesapları (App Review + Business Verification): kapsam dışı.
- **Sonra** — karusel yayını arayüzde (adaptörde var), OAuth «Bağlan», token yenileme, kuyruk, Reels/Story.

## Yasaklar

- Anahtar, token, Gmail listesi hiçbir dosyaya yazılmaz; yalnız GitHub Secrets → `wrangler secret put`.
- Gerçek müşteri verisi (ad, telefon, hasta/ilaç kaydı) görsele girmez; ekran görüntüleri demo veriyle alınır.
- Katalogda olmayan vaat, rakam ya da fiyat gönderiye yazılmaz. Fiyat ve WhatsApp FY Merkez `urun-bilgi` ucundan
  canlı okunacak (sonra); o zamana kadar metinde fiyat yok.
