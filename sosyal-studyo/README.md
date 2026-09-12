# Sosyal Stüdyo

Sosyal medya otomasyon stüdyosu: akışlar, kişiler ve puanlar, toplu mesaj, büyüme araçları,
AI ajan, fikir/senaryo/kanca/karusel/video araçları ve analitik. Çerçevesiz, derleme adımsız
bir PWA; sunucu gerektiren kısımlar Cloudflare Worker'da (ücretsiz katman).

**Neden var:** İlk sürüm 5 Eylül 2026'da bir bilgisayarda yazılıp geçici bir tünelle açıldı,
GitHub'a hiç gitmedi ve kayboldu. Bu sürüm bu depoda yaşar, GitHub Pages'te yayınlanır ve
veriler tek tıkla yedeklenir. Depoya girmeyen kod yok sayılır.

## Çalıştırma

```bash
cd sosyal-studyo
npm install          # yalnız geliştirme bağımlılıkları (vitest, fake-indexeddb)
npm run sun          # http://localhost:8787/  — uygulama app/ klasöründen sunulur
npm test             # motor, depo, yedek testleri
npm run kontrol      # statik denetimler (RTL, innerHTML, saf modüller)
```

Tarayıcıda `?nosw=1` ile service worker atlanır (yerel geliştirmede önbellek karışmasın).

## İki mod

| | Yerel | Bağlı |
|---|---|---|
| Veri | IndexedDB (bu cihaz) | Cloudflare D1 (senin hesabın) + tarayıcı önbelleği |
| Kanallar | yok (simülatör) | Telegram, Instagram, WhatsApp |
| AI | kapalı | Worker üzerinden (Anthropic ya da Workers AI) |
| Yedek | JSON indir/paylaş | D1 dışa aktarım + JSON |

Uygulama yerel modda Worker'sız tam işlevlidir: akış kur, simülatörde dene, kişileri yönet,
içerik üret, yedek al. Worker yalnızca kanalları ve AI'ı ekler.

## Dosyalar

```
app/                      PWA (GitHub Pages'e olduğu gibi kopyalanır)
  index.html sw.js manifest.webmanifest 404.html
  css/                    tokenlar · bileşenler · uygulama (yalnız mantıksal özellikler, RTL)
  js/uygulama.js          giriş: depo, dil, menü, yönlendirici
  js/cekirdek/            yönlendirici, dom, modal, bildirim, durum, tema
  js/depo/                IndexedDB deposu, bellek deposu, yedek, tohum
  js/paylasilan/          SAF modüller — tarayıcı ve Worker aynı dosyayı çalıştırır
    akis/adimlar.js       15 adım tipi ve doğrulama
    akis/kosucu.js        akış koşucusu (durum makinesi, yan etkisiz)
    akis/tetikleyici.js   olay → tetikleyici eşleme, öncelik kuralları
    kurallar.js           yorum/mesaj kural motoru (reply-bot mirası)
    kanallar.js           kanal yetenekleri ve dürüst etiketler
    sema/                 şema sürümü, göçler, yedek belgesi (SHA-256)
  js/sayfalar/            20 sayfa modülü
  data/                   örnek kurallar (27, dört dil), hazır kancalar (30)
  i18n/                   de/en/fa sözlükleri (TR kaynak kodda)
worker/                   Cloudflare Worker (webhook'lar, D1, AI proxy)
test/birim/               vitest
tools/                    sun.mjs (statik sunucu), kontrol.mjs, site-index.html
```

## Kanal gerçekliği

Etiketler kodda sabittir (`paylasilan/kanallar.js`) ve arayüzde görünür:

- **Çalışır** — Telegram tamamen; kendi Instagram profesyonel hesabında DM, yorum→DM, yoruma yanıt, gizleme; WhatsApp Cloud API (şablon kurallarıyla).
- **Meta onayı gerekir** — Instagram yorum webhook'u (onaysız gecikmeli polling ile çalışır), başka işletmelerin hesapları.
- **Platform izin vermiyor** — Instagram'da gerçek toplu mesaj (yalnız 24 saat penceresi açık kişilere), TikTok DM/yorum otomasyonu (yalnız içerik araçları).
- **Prova** — Worker varsayılan olarak hiçbir dış gönderim yapmaz; hesap "CANLI" yazılarak açılır.

## Yedek

Ayarlar → Yedek → "Yedeği indir". Belge kanonik JSON + SHA-256 sağlama toplamı taşır; kesik ya da
bozuk dosya içe aktarılmaz. Gizli anahtar, blob'lar ve kuyruklar yedeğe asla girmez. 7 günden eski
ya da 20 değişiklik biriktiyse uygulama hatırlatır.

## Güvenlik

- Tarayıcıya hiçbir API anahtarı inmez; Meta/Telegram/Anthropic anahtarları yalnız `wrangler secret`.
- CSP: script yalnız bu siteden; dış bağlantı yalnız https (Worker); `innerHTML` yok (`tools/kontrol.mjs` denetler).
- Worker fail-closed: D1 ya da secret eksikse 503, hiçbir isteğe cevap yok.
- Yönetici anahtarı istenirse yalnız bu cihazın IndexedDB'sinde durur; yedeğe girmez.

## Yasaklar

- Geçici tünel (trycloudflare, ngrok) ile "yayın" yok. Yayın adresi GitHub Pages; Worker adresi workers.dev.
- Yayınlanmış şema göçü düzenlenmez; yeni sürüm = yeni göç.
