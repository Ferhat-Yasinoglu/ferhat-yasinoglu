# Eczane Yönetim

İlaç stoğu, hasta kayıtları ve reçete takibi için çerçevesiz, derleme adımsız bir PWA.
Bütün veriler tarayıcıda (IndexedDB) durur: sunucu yok, hesap yok, hiçbir kayıt
cihazdan çıkmaz. İnternet olmadan da tam çalışır.

**Arayüz dili فارسی'dir** ve sayfa sağdan sola akar — CSS baştan beri yalnız
mantıksal yön özellikleri kullandığı için düzen kendiliğinden dönüyor, ayrı bir
RTL sayfası yok. Çoklu dil şimdilik kapalı; altyapı duruyor, yeni bir dil
eklemek `DILLER`'e bir satır ve `app/i18n/<kod>.json` dosyası eklemekten ibaret.

**Neden böyle:** Hasta verisi hassas veri. En güvenli sunucu, olmayan sunucudur —
bu yüzden veri cihazda tutulur ve tek güvence yedektir. Uygulama yedek almayı
hatırlatır, yedek tek JSON dosyasıdır.

## Çalıştırma

```bash
cd eczane
npm install          # yalnız geliştirme bağımlılıkları (vitest, fake-indexeddb, jsqr)
npm run sun          # http://localhost:8788/  — uygulama app/ klasöründen sunulur
npm test             # alan mantığı, depo, stok ve yedek testleri
npm run kontrol      # statik denetimler (mantıksal CSS, innerHTML yok, saf modüller)
npm run deneme       # gerçek tarayıcıda uçtan uca deneme (playwright kuruluysa)
```

Tarayıcıda `?nosw=1` ile service worker atlanır (yerel geliştirmede önbellek karışmasın).

`npm run deneme` playwright ister; proje bağımlılığı değildir (tarayıcı indirmesi ağır),
kurulu değilse betik kendini atlar:
`npm i -D playwright && npx playwright install chromium`.

## Ne yapar

| Bölüm | İçerik |
|---|---|
| **Panel** | Stok uyarıları, son kullanma tarihi yaklaşanlar, bekleyen reçeteler, sayaçlar |
| **İlaçlar** | Künye, barkod, etken madde, fiyat, raf; stok ve SKT uyarıları; muadil bulma |
| **Stok hareketleri** | Mal girişi, iade, sayım düzeltmesi, fire — her değişiklik geçmişe yazılır |
| **Hastalar** | Kayıt, alerjiler, kronik hastalıklar, sürekli ilaçlar, reçete geçmişi |
| **Reçete yazma** | Hasta ve ilaç seçimi, tanı/ICD, kullanım ve süre; alerji, stok, son kullanma ve çift etken madde uyarıları |
| **Karşılama** | Satır satır verildi / kısmi / verilemedi (sebepli); verilen stoktan düşer, geri alınınca iade edilir |
| **Reçete kâğıdı** | Antetli çıktı (A4/A5): solda klinik ölçüm sütunu (BP · PR · RR · BW · Ateş), sağda ℞ alanı, altta QR ve imza kutusu |
| **Boş kâğıt** | Aynı kâğıdı boş bastırıp elle doldurma — tomar halinde çıkar, alanlar çizgili gelir |
| **Gönderme** | WhatsApp, e-posta, panoya kopyalama ve cihazın kendi paylaşma penceresi |
| **Ayarlar** | Reçete anteti, para birimi, kâğıt boyutu, QR içeriği, yedek al/geri yükle, örnek veri, depolama durumu, tema |

**Reçete ile stok tek elden yürür.** Karşılamada verilen her kutu bir stok
hareketi bırakır ve hareket reçete numarasıyla etiketlenir; satır geri alınınca
iade hareketiyle stoğa döner. "Ne verildi" reçetede, "stok neden düştü" hareket
geçmişinde durur ve ikisi hep birbirini tutar.

**Kâğıt iki türlü çalışır.** Doktor ya uygulamadan doldurup basar, ya da boş
kâğıdı tomar halinde bastırıp üzerine kalemle yazar; ikisi de aynı antetle çıkar.
Dolu basılan kâğıtta bile girilmemiş klinik ölçümler çizgi olarak basılır —
sonradan elle tamamlanabilsin diye.

**QR kodu kendi ürettiğimiz koddur** (`paylasilan/qr.js`); dışarıdan kütüphane
yok, çevrimdışı çalışır. İçeriği ayarlardan seçilir: doktorun WhatsApp bağlantısı
(hasta okutup yazar) ya da reçetenin metni (okutunca telefonda açılır).
Doğruluğu bağımsız bir QR çözücüyle test ediliyor.

**Stok yalnız hareketle değişir.** İlaç kartındaki stok alanı elle düzenlenmez;
mal girişi, sayım, fire ya da reçete karşılama üzerinden değişir ve her işlem
öncesi/sonrası stoğuyla birlikte kaydedilir. "Stok neden 3'e düştü?" sorusunun
cevabı her zaman kayıtlıdır. Stoğu eksiye düşüren işlem reddedilir.

## Yapılacaklar

- [x] İskelet: depo, yönlendirici, tema, bileşenler
- [x] İlaçlar ve stok hareketleri
- [x] Hastalar
- [x] Reçete yazma (hasta + ilaç satırları, alerji ve stok uyarıları)
- [x] Reçete karşılama: satır satır "verildi / verilmedi", stoğa otomatik düşme
- [x] Reçete yazdırma (A4/A5, antetli)
- [x] Farsça arayüz ve sağdan sola düzen
- [x] Reçete kâğıdı: antet, klinik ölçüm sütunu, QR, boş kâğıt
- [x] WhatsApp / e-posta ile gönderme
- [ ] Reçete başlık alanlarının gözden geçirilmesi (aşağıya bak)
- [ ] Reçeteyi dosya (PDF/görsel) olarak gönderme — şu an metin olarak gidiyor,
      kâğıt görünümü için "Yazdır → PDF" kullanılıyor

### Reçete alanları

Şu an standart bir küme kullanılıyor: reçete no (gün içinde kendiliğinden artar,
elle de yazılabilir), tarih, reçete türü (normal/kırmızı/yeşil/mor/turuncu),
hasta, tanı, tanı kodu (ICD-10), protokol no, reçete notu; doktor adı, ünvanı,
diploma no ve kurumu Ayarlar'dan gelir ve kaydedilirken reçeteye işlenir.
Satırda: ilaç, adet, kullanım şekli, süre, not.

Klinik ölçümler ayrı tutulur: kan basıncı, nabız, solunum, kilo, ateş
(`paylasilan/recete.js` içindeki `OLCUMLER`).

Alan eklemek için üç yer: `paylasilan/recete.js` içindeki `bosRecete`,
`sayfalar/recete-yeni.js` içindeki form ızgarası ve `kagit.js` içindeki kâğıt
düzeni. Yeni bir arayüz metni eklediğinde `npm run kontrol` sözlüklerde karşılığı
olup olmadığını söyler.

## Dosyalar

```
app/                      PWA (statik olarak olduğu gibi sunulur)
  index.html sw.js manifest.webmanifest
  css/                    tokenlar · bilesenler · uygulama · yazdirma
  i18n/                   fa.json (arayüzün bütün metni burada)
  js/
    uygulama.js           giriş: depo, dil, menü, arama, yönlendirici
    i18n.js               t() ve sözlük yükleme
    hatalar.js            hata, doğrulama ve uyarı kodlarının arayüz metni
    kagit.js              reçete kâğıdı (dolu ve boş hali) + yazdırma
    cekirdek/             dom · yonlendirici · modal · bildirim · simge · tema
    depo/                 sema · depo · idb · stok · recete · yedek · ornek
    paylasilan/           saf alan mantığı: ilac · hasta · recete · qr · tarih · metin · kimlik
    sayfalar/             panel · ilaclar · ilac · hastalar · hasta ·
                          receteler · recete-yeni · recete · ayarlar · bulunamadi
test/                     vitest
tools/                    sun (statik sunucu) · kontrol (statik denetim) · tarayici (uçtan uca)
```

### Kurallar

- `paylasilan/` saf kalır: DOM yok, depo yok, `node:` yok. Testler buradan başlar.
- `innerHTML` kullanılmaz; her metin `textContent` üzerinden yazılır.
- CSS'te yalnız mantıksal yön özellikleri (`inset-inline-start`, `margin-inline`…).
- Sayfa modülü sözleşmesi: `export default { baslik, cizim(kok, ctx) → temizleyici|void }`.
- Kayıtlar zarflıdır: `id, rev, olusturuldu, guncellendi, silindi`. Silme mezar taşıdır —
  yedek geri yüklenirken silinmiş kayıt dirilmesin diye.
- Arayüz metni `t(anahtar, 'Türkçe karşılık')` ile yazılır. Türkçe metin çeviri
  değil yedektir: sözlükte anahtar yoksa ekran boş kalmasın diye durur.
  `npm run kontrol` her anahtarın sözlükte karşılığı olduğunu denetler, tarayıcı
  denemesi de ekranda Türkçe kalmadığını ayrıca doğrular.
- **Saf modüller cümle kurmaz.** Doğrulama, hata, uyarı ve "3 gün önce" gibi
  göreli tarihler `paylasilan/` ve `depo/` içinde **kod** olarak döner; metne
  çevirme işi `hatalar.js`'tedir. Böylece alan mantığı dilden bağımsız kalır ve
  hiçbir hata mesajı çevrilmeden ekrana düşmez.

## Sınırlar

- **e-Reçete / Medula entegrasyonu yoktur.** Resmî kurum kimliği gerektirir. Bu uygulama
  kendi içinde çalışan bir kayıt ve takip sistemidir; çıktısı yazdırılabilir reçetedir.
- Veri tek cihazdadır. Başka cihaza geçmek için yedek dosyası taşınır.
- Tarayıcı verisi temizlenirse kayıtlar silinir. Düzenli yedek şart.
- Yedek dosyası şifresiz JSON'dur ve hasta bilgisi içerir; güvenli bir yerde saklanmalı.
- Reçete WhatsApp ve e-postaya **metin** olarak gider. Tarayıcıdan sunucusuz
  dosya eki oluşturulamadığı için kâğıt görünümü isteniyorsa "Yazdır → PDF olarak
  kaydet" ile dosya alınıp elle eklenir.
