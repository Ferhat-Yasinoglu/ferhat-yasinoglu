# الحاج داکتر فدامحمد «احسان» — تانیتم سایت

Tek sayfa, tek dilde (Farsça/Deri, sağdan sola) bir klinik tanıtım sitesi. Çerçevesiz,
derleme adımsız: düz HTML, CSS, JS. `sosyal-studyo`/`shafa` ile aynı depoda yaşayan
ayrı bir proje.

## Çalıştırma

```bash
cd doktor-sitesi
npm install       # yalnız geliştirme bağımlılığı (vitest)
npm run sun       # http://localhost:8788/
npm test          # yapısal denetimler (vitest)
npm run kontrol   # statik denetim: mantıksal CSS özellikleri, innerHTML yok
```

`index.html` doğrudan `file://` ile de açılır (dış bağımlılık, fetch ya da build adımı yok).

## Neler gerçek, neler yer tutucu

WhatsApp'tan gelen bilgilerle dolduruldu:

- İsim, unvan, uzmanlık (dahiliye + çocuk hastalıkları), sonoğrafi/EKG becerisi
- "Hakkımda" bölümündeki hastane/klinik geçmişi (Hayatülnisa Hastanesi, Haydari
  Teşhis Kliniği — Mezar-ı Şerif; Kunduz Bölge Hastanesi)
- Telefon: `0791 448 001` — `tel:` ve `wa.me` bağlantılarında `+93791448001` olarak kullanıldı
- Adres: verilen metin aynen kullanıldı ("بندر روضهٔ مبارک، فرهاد، ملتون")

Hâlâ yer tutucu, gerçek bilgiyle değiştirilmeli:

- **Çalışma saatleri** (`#saatler`): Pzt–Cuma 09:00–17:00, Cmt 09:00–13:00, Pazar
  kapalı — tahmini, doğrulanmadı.
- **Harita**: `#iletisim` içindeki `.harita-yer-tutucu` notu — adres netleşince
  Google Haritalar gömme linki (`<iframe>`) buraya eklenebilir.
- **Fotoğraf**: `img/doktor-yer-tutucu.svg` çizilmiş bir simge; gerçek bir
  fotoğrafla değiştirilebilir (`index.html`'de `.kahraman-gorsel img`).
- **E-posta yok**: iletişim bilinçli olarak yalnız telefon + WhatsApp üzerinden
  kuruldu (bkz. aşağıdaki not).

## Neden form yok, WhatsApp var

İlk sürümde bir randevu formu vardı (mailto: ile açılan). Gerçek bilgilerde
e-posta adresi verilmediği ve bu bölgede telefon/WhatsApp'ın çok daha
gerçekçi bir iletişim yolu olduğu için form kaldırıldı; yerine `tel:` ve
`wa.me` bağlantıları kondu. İkisi de saf `<a href>` — JavaScript kapalıyken
bile çalışır.

## Özelleştirme

- **Renkler**: `css/tokenlar.css` içindeki `--primer`, `--vurgu` vb. değişkenler.
- **Metin**: `index.html` içinde doğrudan Farsça — çeviri/sözlük sistemi yok,
  tek dil olduğu için metni yerinde değiştirmek yeterli.
- **İkonlar**: `index.html` içine gömülü, elle çizilmiş basit SVG'ler (dış
  ikon kütüphanesi yok).
- **Tema**: sağ üstteki güneş/ay düğmesi aydınlık/koyu temayı değiştirir,
  tercih `localStorage`'da kalır; sistem tercihi de otomatik uygulanır.

## Dosyalar

```
index.html          tek sayfa: kahraman, hakkımda, hizmetler, saatler, iletişim
css/tokenlar.css     tasarım tokenları (renk, boşluk, gölge) — aydınlık + koyu tema
css/stil.css         yerleşim ve bileşenler — yalnız mantıksal özellikler (RTL)
js/on-yukleme.js     senkron: tema boyanmadan yerleşir (FOUC yok)
js/ana.js            tema anahtarı, mobil menü, alt bilgi yılı
test/site.test.js    yapısal denetim (vitest): çapa hedefleri, tel/wa.me linkleri
tools/kontrol.mjs    statik denetim: fiziksel yön özelliği yok, innerHTML yok
tools/sun.mjs        bağımlılıksız yerel sunucu (yalnız geliştirme için)
```

## RTL notu

Sayfa `dir="rtl"` sabit (tek dil, Farsça). Tüm CSS mantıksal özelliklerle
yazıldı (`margin-inline-*`, `padding-inline-*`, `text-align: start/end`),
`tools/kontrol.mjs` bunu denetler. Telefon numarası ve saat aralıkları gibi
LTR içerik (rakamlar) `dir="ltr"` ile sarmalandı — aksi halde çift sayı
içeren bir aralık ("09:00 – 17:00") RTL bağlamda görsel olarak ters döner.

## Yayınlama

Şu an bu proje yalnız bu depoda bir klasör olarak duruyor, GitHub Pages'e
bağlı değil. `shafa` ve `sosyal-studyo` `.github/workflows/site.yml` üzerinden
tek bir Pages sitesine birlikte yayınlanıyor (bir depoda yalnız bir Pages
sitesi olabildiği için); bu üçüncü projeyi aynı yere eklemek o paylaşılan
yayın hattına dokunmak demek, o yüzden bilerek yapılmadı. İstenirse ayrı bir
adımda ya `site.yml`'e üçüncü proje olarak eklenir ya da kendi ayrı deposuna
taşınır.
