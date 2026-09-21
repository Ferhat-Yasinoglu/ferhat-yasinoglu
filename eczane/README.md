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

## Adres

`main`'e giren her değişiklik GitHub Pages'e çıkar:

**<https://ferhat-yasinoglu.github.io/ferhat-yasinoglu/eczane/>**

Telefonda açılıp "ana ekrana ekle" denince uygulama gibi kurulur ve ondan sonra
internetsiz de açılır. Adres herkese açık, **veri değil**: her cihaz yalnız kendi
kayıtlarını görür, adresi bilen kimse kimsenin hastalarına erişemez. Antet de
kodda gömülü değil, her hekim Ayarlar'dan kendi bilgilerini girer.

Yayın `.github/workflows/site.yml` ile yapılır. Service worker'ın önbellek
anahtarı dağıtımın kısa SHA'sıyla damgalanır (`sw.js` içindeki `__SURUM__`);
bu olmadan tarayıcı eski dosyaları süresiz tutar ve güncelleme hekime ulaşmaz.

## Çalıştırma

```bash
cd eczane
npm install          # yalnız geliştirme bağımlılıkları (vitest, fake-indexeddb, jsqr)
npm run sun          # http://localhost:8788/  — uygulama app/ klasöründen sunulur
npm test             # alan mantığı, depo, reçete ve yedek testleri
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
| **Panel** | Bugün yazılan reçeteler, son reçeteler, son hastalar, sayaçlar |
| **İlaçlar** | Künye: ad, etken madde, şekil, doz, barkod, üretici; muadil bulma |
| **Hastalar** | Kayıt, alerjiler, kronik hastalıklar, sürekli ilaçlar, reçete geçmişi |
| **Reçete yazma** | Hasta ve ilaç seçimi, tanı/ICD, kullanım ve süre; alerji ve çift etken madde uyarıları |
| **Reçete kâğıdı** | Doktorun kullandığı basılı kâğıdın aynısı: mavi antet (ad, ünvan şeridi), hizmet satırları, sabıka şeridi, Name/Age/Date şeridi, solda Clinical sütunu (BP · PR · RR · BW · Temperature), sağda ℞ alanı, altta rozetler ve iletişim |
| **Boş kâğıt** | Aynı kâğıdı boş bastırıp elle doldurma — tomar halinde çıkar, alanlar çizgili gelir |
| **Gönderme** | WhatsApp, e-posta, panoya kopyalama ve cihazın kendi paylaşma penceresi |
| **Doğrulama** | Her reçete kâğıda basılan sekiz harflik bir kod taşır; kâğıtta oynanmışsa kod tutmaz |
| **Ayarlar** | Reçete anteti, para birimi, kâğıt boyutu, QR içeriği, yedek al/geri yükle, örnek veri, depolama durumu, tema |

**Stok takibi yok, bilerek.** Hasta ilacını dışarıdaki eczaneden kendi alıyor;
hekimin elinde kutu durmuyor, neyin verildiğini de bilemiyor. Bu yüzden ilaç
kaydı yalnız reçeteye doğru yazabilmek için var (ad, etken madde, şekil, doz) ve
reçete kaydedilip basıldığında iş bitiyor. Depo, karşılama ve "kaç kutu kaldı"
uygulamada hiç yok — olsaydı her gün doldurulması gereken, dolduruldukça da
yanlışlaşan bir defter olurdu.

**Kâğıt, doktorun hâlihazırda kullandığı basılı reçetenin birebir aynısı.**
Antetteki her satır (ad, ünvan şeridi, slogan, hizmetler, ilgi alanları, sabıka,
adres, telefon, alt rozetler) Ayarlar'dan girilir; kâğıt kimseye gömülü değildir,
başka bir hekim kendi bilgilerini yazınca kendi kâğıdı çıkar.

**İki türlü çalışır.** Doktor ya uygulamadan doldurup basar, ya da boş kâğıdı
tomar halinde bastırıp üzerine kalemle yazar; ikisi de aynı antetle çıkar.
Dolu basılan kâğıtta bile girilmemiş klinik ölçümler çizgi olarak basılır —
sonradan elle tamamlanabilsin diye. Renkli basmak mürekkep yiyorsa Ayarlar'da
"sade" stili var: aynı düzen, siyah-beyaz.

Zemin renkleri `print-color-adjust: exact` ile basılır; bu olmadan tarayıcı
bütün dolguları atıyor ve kâğıt bembeyaz iniyor.

**QR kodu kendi ürettiğimiz koddur** (`paylasilan/qr.js`); dışarıdan kütüphane
yok, çevrimdışı çalışır. İçeriği ayarlardan seçilir: doktorun WhatsApp bağlantısı
(hasta okutup yazar) ya da reçetenin metni (okutunca telefonda açılır).
Doğruluğu bağımsız bir QR çözücüyle test ediliyor.

## Arayüz

**Yazı tipi Vazirmatn** (`app/yazi/`, OFL lisansı, tek değişken dosya 111 KB).
Sistem yazı tipleri Arap harflerini genelde ikinci sınıf taşıyor: harf
yükseklikleri oynuyor, nokta kümeleri birbirine giriyor, kalın gerektiğinde
kalınlık sahteleniyor. Yazı tipi service worker'ın önbelleğinde, ilk açılıştan
sonra çevrimdışı da geliyor; inene kadar metin sistem yazı tipiyle görünür
kalıyor (`font-display: swap`). Reçete kâğıdı da bu yazı tipini kullanıyor.

Arap yazısı Latin'den daha çok satır aralığı ister — harfler satırın altına ve
üstüne uzanıyor — bu yüzden gövde satır aralığı 1.62.

Panel geniş ekranda iki sütun, sayaçlar beşi bir satırda; telefonda sayaçlar
ikişerli, sayfa eylemleri ızgarada (asıl eylem tam satır). Önceki düzende
beşinci sayaç alt satıra tek başına düşüyor, yanında kocaman bir boşluk
kalıyordu; telefonda dört kocaman kutuyu geçmeden içeriğe ulaşılamıyordu.

Düzen yalnız mantıksal yön özellikleriyle kurulu (`margin-inline-start` gibi),
bu yüzden sağdan sola akış kendiliğinden çıkıyor — ayrı bir RTL sayfası yok.
`npm run kontrol` fiziksel yön özelliği kullanıldığında uyarıyor.

## Sahteciliğe karşı

Her reçete kaydedilirken bir **doğrulama kodu** alır: reçetenin kanonik özetinin,
cihaza özel gizli bir anahtarla üretilmiş HMAC-SHA256'sının ilk beş baytı,
karıştırılması kolay harfler (0/O, 1/I) atılarak sekiz harfe indirilmiş hali —
`249M-8Z5G`. Kod hem kâğıda basılır hem QR'a girer.

Eczane QR'ı okutup metni Ayarlar'daki **"نسخه را بررسی کن"** kutusuna yapıştırır.
Kâğıtta ilaç, adet, doz ya da hasta adı değiştirilmişse kod tutmaz.

Ne yakalar, ne yakalamaz — dürüst sınırlar:

| Tehdit | Durum |
|---|---|
| Kâğıtta adedi/dozu/ilacı değiştirmek | **Yakalanır** — özet değişir, kod tutmaz |
| Sıfırdan sahte reçete uydurmak | **Yakalanır** — gizli anahtar olmadan geçerli kod üretilemez |
| Geçerli bir reçeteyi fotokopiyle çoğaltmak | **Yakalanmaz** — kod da kopyalanır. Ancak reçete numarası eczanede not edilirse görülür |
| Başka bir eczanenin doğrulaması | Doğrulama doktorun kendi cihazında yapılır. Eczane şüphelenirse metni doktora gönderir, doktor beş saniyede bakar |

Anahtar cihazda üretilir, ayarlarda durur ve **yedeğe girer** — doktor cihaz
değiştirirse yedekten gelen anahtarla eski reçeteler doğrulanmaya devam eder.
Anahtar yedekten de kaybolursa eski kodlar bir daha doğrulanamaz; yedek dosyası
bu yüzden hasta bilgisi kadar bu anahtarı da korur.

Kod reçetenin kanonik özetinden üretilir; aynı reçete yeniden basıldığında
kod değişmez.

## Yapılacaklar

- [x] İskelet: depo, yönlendirici, tema, bileşenler
- [x] İlaçlar
- [x] Hastalar
- [x] Reçete yazma (hasta + ilaç satırları, alerji ve çift etken madde uyarıları)
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
(`paylasilan/recete.js` içindeki `OLCUMLER`). Kâğıtta bunların etiketleri
İngilizce durur (BP · PR · RR · BW · Temperature) — basılı kâğıt da böyle ve
bunlar hekimlikte evrensel kısaltmalar.

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
    depo/                 sema · depo · idb · recete · dogrulama · yedek · ornek
    paylasilan/           saf alan mantığı: ilac · hasta · recete · qr · dogrulama ·
                          tarih · metin · kimlik
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
