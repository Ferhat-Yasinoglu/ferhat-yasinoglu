# Shafa — Reçete

Klinikte çalışan bir hekim için reçete yazma ve hasta kaydı: çerçevesiz,
derleme adımsız bir PWA.
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

**<https://ferhat-yasinoglu.github.io/ferhat-yasinoglu/shafa/app/>**

Tanıtım sayfası bir üstte: <https://ferhat-yasinoglu.github.io/ferhat-yasinoglu/shafa/>

Uygulama önce `/eczane/` adresindeydi. Orası artık taşındı sayfası: hekimin
telefonundaki kurulu uygulama ve yer imi oraya baktığı için silinmedi,
yeni adrese yönlendiriyor. Yanındaki `sw.js` eski service worker'ı kapatıyor —
o olmasa eski uygulama önbellekten açılmaya devam eder ve yönlendirme hiç
görünmezdi. Veriler taşınmadı çünkü taşınmasına gerek yok: IndexedDB yola değil
kaynağa (origin) bağlı, iki adres de aynı alan adında.

Telefonda açılıp "ana ekrana ekle" denince uygulama gibi kurulur ve ondan sonra
internetsiz de açılır. Adres herkese açık, **veri değil**: her cihaz yalnız kendi
kayıtlarını görür, adresi bilen kimse kimsenin hastalarına erişemez. Antet de
kodda gömülü değil, her hekim Ayarlar'dan kendi bilgilerini girer.

Yayın `.github/workflows/site.yml` ile yapılır. Service worker'ın önbellek
anahtarı dağıtımın kısa SHA'sıyla damgalanır (`sw.js` içindeki `__SURUM__`);
bu olmadan tarayıcı eski dosyaları süresiz tutar ve güncelleme hekime ulaşmaz.

## Tanıtım sayfası

`tanitim/index.html` — tek dosya, derleme yok, çerçeve yok. Koyu tema, Dari, RTL.
Sıra: kahraman · güvence şeridi · 7 numaralı özellik kartı · «چگونه کار می‌کند»
dört adım · reçete kâğıdı · sahtecilik tablosu · tarife · **indirme** · sorular · kapanış.

### İndirme bölümü neden sekme

Örnek alınan site (`dakhlak.pamircode.com`) her işletim sistemi için **kurulum
dosyası** indirtiyor: Windows sekmesinde "دانلود برای ویندوز — نسخه 1.0.15"
diye bir EXE. Shafa'nın indirilecek bir dosyası yok; tarayıcıdan kurulan bir
web uygulaması. Bu yüzden sekmelerin altında dosya değil **o cihazın kurulum
tarifi** var: Android'de "kur" düğmesi, iPhone'da Safari → Share → Add to Home
Screen, masaüstünde adres çubuğundaki kurulum simgesi.

Bu bir eksiklik değil, farklı bir dağıtım biçimi — ve sayfa bunu gizlemiyor,
"به جای فایل نصبی، از خود مرورگر نصب می‌شود" diye açıkça yazıyor. Gerçekten
EXE/APK indirtmek isteniyorsa uygulamanın Tauri (masaüstü) ve TWA (Android)
ile paketlenmesi gerekir; iOS'ta Apple yan yükleme vermediği için o sekme her
hâlükârda "ana ekrana ekle" kalır.

### Sekmelerin kuralları

- Panolar HTML'de **açık** kurulur; gizlemeyi yalnız JS yapar. JS çalışmazsa
  dört tarif de alt alta okunur — içerik hiçbir durumda erişilemez olmaz.
- Ziyaretçinin kendi cihazının sekmesi açılır; tanınmayan cihazda Android'de kalır.
- Seçili sekme dar ekranda şeridin dışında kalırsa şerit kaydırılır — ama
  `scrollIntoView` ile **değil**: o sayfanın kendisini de kaydırıyor ve ziyaretçi
  tanıtımı baştan değil indirme bölümünden görüyordu (ölçüldü: `scrollY` 0 yerine
  7486). Onun yerine yalnız şeridin `scrollLeft`'i fark kadar oynatılıyor.
  `npm run site` açılışta `scrollY === 0` olduğunu ayrıca denetliyor.

### Sürüm rozeti

İndirme bölümü "نسخه 1.0.0" yazıyor. Bu sayı elle yazıldığı için uygulama sürümü
yükselince sessizce geride kalır. `npm run kontrol` rozeti `uygulama.js`'teki
`UYGULAMA_SURUMU` ile karşılaştırıyor: ikisi ayrışırsa denetim patlar.
Sürüm yükseltmek tek satır — `js/uygulama.js`; rozet peşinden gelir.

### Ekran görüntüleri

```bash
node tools/gorsel-uret.mjs      # panel.jpg, mobil.png ve recete.jpg'yi yeniden üretir
```

Elle alınan görüntüler sessizce eskiyor: tanıtımdaki panel görüntüsü örnek hastalar
Dari'ye çevrilmeden önce alınmıştı ve Afgan hekime aylarca **«Ayşe Yılmaz,
Mehmet Demir, Zeynep Kaya»** gösterdi. Hiçbir test bunu yakalamadı, çünkü
görüntü bir ikili dosya.

Araç uygulamayı **koyu temada** açıyor (tanıtım sayfası koyu), örnek veriyi
yüklüyor ve 14 güne yayılmış sabit dağılımla 28 örnek reçete yazıyor. Üç görüntü:

| Dosya | Ne gösteriyor |
|---|---|
| `panel.jpg` | **1536×1024 — tasarımın çizildiği ölçü**, bilgisayarda giriş sayfası, yani reçete sayfası: örnek hasta, ölçümler, tanı ve iki ilaç formdan tıklanarak girilmiş, sağdaki kâğıt onlarla dolu ve dibine kadar görünüyor (1600×1000'de kâğıdın dibi ve alt şerit kesiliyordu). Tanıtımın açılış görüntüsü; yanındaki metin de «مریض را انتخاب کنید، دواها را اضافه کنید…» diyor. Adı eski (panel) |
| `mobil.png` | Telefonda panel (`#/panel`): sayaçlar ve 14 günlük grafik |
| `recete.jpg` | Basılan kâğıdın kendisi, **açık temada, yalnız kâğıt**. Kayıtlı bir örnek reçeteden basıldığı gibi kuruluyor: numarası ve doğrulama kodu var, ekrandaki düzenleme işaretleri (kesik çerçeveli «+» satırları) yok |

Panel ve kâğıt JPEG: PNG olarak panel 1 MB, kâğıt 720 KB'tı ve panel sayfanın
ilk ekranında hemen yükleniyor. Tanıtım yavaş bağlantıdaki hekim için.

Reçete satırlarında doz/kullanım alanı boş bırakılıyor: bu depo ilaç
**adlarının** sözlüğü, tedavi tarifi değil.

Yedek hatırlatma bandı (`.bant`) görüntüye girmesin diye örnek veri yazıldıktan
sonra "yedek alındı" işaretleniyor — ve araç bandın gerçekten yok olduğunu
denetliyor, sessizce fotoğrafa girmesin diye.

Kâğıt görüntüsü eskiden elle alınıyordu ve kâğıt yeniden tasarlanınca eski
kâğıdı göstermeye devam etti — panelin başına gelenin aynısı. Artık o
da araçta. Araç bir kutu, takvim ya da bildirim görüntüye girecekse durur.

`npm run kontrol` HTML'deki `width`/`height` ile dosyanın gerçek ölçüsünü
karşılaştırıyor. Bu olmasa 1280×900 yazan etiket 1600×1000'lik görüntüyü ezer
ya da sayfa yüklenirken zıplardı.

### Sayfada bilerek olmayanlar

- **Ekip / "تیم ما" bölümü yok.** Depo herkese açık; hekimin adı, telefonu ve
  adresi buraya yazılamaz. Bu bilgiler yalnız cihazdaki Ayarlar'da durur.
- **Fiyat yazmıyor.** İkinci sürüm paralı olacak ama rakam belli değil; belli
  olmadan sayfaya sayı yazılmıyor. Tarife kartı "به زودی" diyor.
- **Google hesabına yedek sayılmıyor.** Uygulamada var, sitede reklamı yok.
  Onay ekranı "Testing" modunda olduğu sürece yalnız test listesindeki adresler
  (en çok 100) giriş yapabiliyor; siteyi görüp indiren bir hekim düğmeye bassa
  Google onu reddediyor. Bir süre sayfa bunu bir "imkân" diye saydı —
  verilmeyen bir sözdü. Özellik kartı, tarife satırı ve "iki cihazı nasıl
  birleştiririm" sorusunun Google'lı cevabı kaldırıldı; o sorunun cevabı artık
  bugün **herkeste** çalışan yol: dosya yedeğini öbür cihaza taşımak.

  Gizlilik sorusundaki *«در تنظیمات یک امکان اختیاری هم هست»* cümlesi **duruyor**:
  uygulamada gerçekten var, ve "معلومات دستگاه را ترک نمی‌کند" derken bunu
  söylememek eksik bilgi olurdu.

  Onay ekranı yayına alınınca geri konabilir — ya da özellik ikinci sürümde
  paralı tarifeye alınabilir.

## Çalıştırma

```bash
cd shafa
npm install          # yalnız geliştirme bağımlılıkları (vitest, fake-indexeddb, jsqr)
npm run sun          # http://localhost:8788/  — uygulama app/ klasöründen sunulur
npm run yerel        # aynısı + hesap API'si /v1/ altında (sunucu/yerel.mjs, bellekte)
npm test             # alan mantığı, depo, reçete ve yedek testleri
npm run kontrol      # statik denetimler (mantıksal CSS, innerHTML yok, saf modüller)
npm run deneme       # gerçek tarayıcıda uçtan uca deneme (playwright kuruluysa; CI koşmuyor, elle)
npm run site         # yayın düzenini kurup gerçek tarayıcıda dener
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
| **Reçete yazma** | Solda form, sağda canlı kâğıt: hasta ve ilaç seçimi, ölçümler, belirti/tanı/ICD ve laboratuvar çiple, kullanım ve süre; alerji ve çift etken madde uyarıları; şablonlar, Ctrl+S |
| **Reçete kâğıdı** | Üç stil (modern / klasik / sade): antet (ad, ünvan), hizmet satırları, sabıka şeridi, Name/Age/Date/No şeridi, solda Clinical sütunu (BP · PR · RR · BW · Temperature · SpO2 · Height · Blood Gr.), sağda ℞ alanı, hat ve imza, altta rozetler ve iletişim |
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

## Marka ve arayüz

**Adı Shafa** (شفا — şifa). İşaret ℞'dir: reçetenin evrensel sembolü, harf
değil çizgi olarak kuruldu (gövde, kâse, çapraz kuyruk) — font kullanılsaydı
cihazdan cihaza değişirdi. 16 pikselde de okunuyor, tek renkli sürümü kâğıt
için var (`app/img/`).

**Giriş sayfası reçete kâğıdı.** Hekimler öyle istedi ve doğrusu da o:
uygulamanın günlük işi reçete yazmak. `/` artık `kagit-yaz.js`'e gidiyor,
panel menüye indi.

Bunun bir tuzağı vardı: **«uygulama boş» karşılaması yalnız paneldeydi.** Giriş
sayfası değişince yeni kuran hekim boş bir kâğıda düşüyordu — ne hasta, ne dava,
ne de nereden başlayacağını söyleyen bir şey. Karşılama reçete sayfasına da
kondu; deneme boş kurulumda onun çıktığını ve «hasta ekle» yolunu gösterdiğini
denetliyor.

**Menü sırası hekimlerin sırası:** reçete, hasta, dava — sonra reçete listesi.
Telefondaki alt çubuk bu dördü. «Reçeteler» dördüncü kutuda bilerek: hekim
yazdığı reçeteyi en çok oradan arıyor (eczane telefon edince, hasta geri
gelince), menüye gömülmesi günlük işi yavaşlatırdı.

Geri kalanı (panel, boş kâğıt, tanılar, laboratuvar, raporlar, ayarlar) üst
köşedeki **☰** ile açılan çekmecede. Çekmece için **ayrı bir telefon menüsü
yazılmadı**: dar ekranda gizlenen kenar çubuğunun kendisi kayarak geliyor.
Böylece tek menü var — sıra, sayaçlar ve aktif işaret iki yerde ayrı ayrı
tutulmuyor.

Kayma animasyonu ancak hekim ☰'ye **bir kez bastıktan sonra** açılıyor: yoksa
geniş ekrandan dar ekrana geçildiği anda medya sorgusu da bir değer değişimi
sayılıyor ve çekmece bir kez görünüp kayarak kapanıyordu.

**Renk petrol mavisi ve turkuaz** (reçete sayfasının tasarımından). Uygulamayı hekim muayene sırasında, hastayla
konuşurken, çoğu zaman telefonda kullanıyor; bu yüzden palet sakin ve dikkat
çeken tek şey uyarılar. Karanlık tema gece nöbeti için.

**Hareket ölçülü.** Tek bir yay eğrisi bütün arayüzde, süreler 120–320 ms:
sayfa girişi, liste satırlarının sırayla belirmesi, sayaçların sıfırdan
sayması, grafik sütunlarının yükselmesi, modalin yaylanarak açılması, düğmenin
basılınca hafifçe küçülmesi. Hepsi `prefers-reduced-motion` ile kapanıyor.
Arayüz "animasyonlu" değil, çevik hissetsin diye kısa tutuldu.

**Panelde grafik var:** son 14 günün reçete sayısı. Dışarıdan kütüphane yok,
yalnız div'ler ve CSS. Sıfır olan gün ince bir çizgi olarak duruyor ki "veri
yok" ile "o gün yazılmamış" birbirine karışmasın.

Yazı tipleri ve simgeler aşağıda, «Reçete sayfası» başlığında.

Arap yazısı Latin'den daha çok satır aralığı ister — harfler satırın altına ve
üstüne uzanıyor — bu yüzden gövde satır aralığı 1.62.

Panel geniş ekranda iki sütun, sayaçlar beşi bir satırda; telefonda sayaçlar
ikişerli, sayfa eylemleri ızgarada (asıl eylem tam satır). Önceki düzende
beşinci sayaç alt satıra tek başına düşüyor, yanında kocaman bir boşluk
kalıyordu; telefonda dört kocaman kutuyu geçmeden içeriğe ulaşılamıyordu.

Düzen yalnız mantıksal yön özellikleriyle kurulu (`margin-inline-start` gibi),
bu yüzden sağdan sola akış kendiliğinden çıkıyor — ayrı bir RTL sayfası yok.
`npm run kontrol` fiziksel yön özelliği kullanıldığında uyarıyor.

## Reçete sayfası

Reçete sayfası (`#/recete/kagit`, giriş sayfası) bir tasarım görselinden birebir
kuruldu. Bilgisayarda **solda hekimin doldurduğu form, sağda canlı kâğıt**:
formda yazılan her şey kâğıda anında düşüyor, kâğıttaki alana dokunmak da aynı
kutuyu açıyor. Form tek panel: başlık bandı, hasta kartı (hasta, yaş, şemsi
tarih, numara), Clinical kartı (sekiz ölçüm), ℞ satırları (belirti, tanı, dava,
laboratuvar, not) ve ilaç tablosu; altta پاک کردن · پیش نمایش · ذخیره و چاپ.
Ctrl+S yalnız kaydeder. İki sütun ancak form 620 px alabildiğinde, yani 1280 px
ve üstünde; 861–1279 arasında form tam genişlikte, kâğıt altında. Telefonda
(≤ 860 px) her şey sağdan sola, kenar çubuğu sağdan açılan çekmece.

**Yön tek blokta.** `<html dir="rtl">` değişmedi. Tasarımdaki yerleşim
(kenar çubuğu solda, Clinical ℞'nin solunda, asıl düğme kâğıdın yanında)
yalnız yerleşim kaplarına `direction` vererek kuruldu ve masaüstünün yönle
ilgili bütün kuralları `app/css/uygulama.css` sonundaki **tek**
`@media screen and (min-width: 861px)` bloğunda. Blok silinirse düzen bugünkü
aynalanmış sağdan sola hâline döner — geri dönüş yolu budur. Başka yerde yeni
`[dir="rtl"]`/`[dir="ltr"]` seçici yazılmaz (hesaplanan yöne değil `<html dir>`'e
bakar); blokta `direction: rtl` yalnız ebeveynin yerleştirdiği yapraklara
veriliyor, kenar payı taşıyan yazıda `unicode-bidi: plaintext` kullanılıyor.

**Yazı tipleri, çizimler, simgeler** — hepsi depoda, CDN yok:

- **Vazirmatn** (`app/yazi/vazirmatn.woff2`, OFL, `OFL.txt`): arayüzün ve
  kâğıdın yazı tipi, tek değişken dosya. Sistem yazı tipleri Arap harflerini
  genelde ikinci sınıf taşıyor (harf yükseklikleri oynuyor, noktalar birbirine
  giriyor). Service worker'ın önbelleğinde; inene kadar `font-display: swap`.
- **Kalam 700** (`app/yazi/kalam-700.woff2`, OFL, `OFL-Kalam.txt`): kâğıttaki
  tek el yazısı satırı ("Healthy Life Brighter Tomorrow"). Yalnız ASCII'ye
  indirilmiş 12 KB'lık bir alt küme.
- **℞ işareti ve «سلامت سرمایهٔ زندگی است» hattı** yazı tipi dosyası değil:
  Noto Serif ve Noto Nastaliq Urdu'dan alınmış satır içi SVG yolları
  (`app/js/cekirdek/cizimler.js`, OFL, `app/yazi/OFL-Noto.txt`). Yazı tipiyle
  basılsaydı cihazdan cihaza değişirdi.
- **Dolgulu simgelerin bir kısmı bootstrap-icons 1.13.1'den** (MIT): yol
  verisi `app/js/cekirdek/simge.js` içinde satır içi, her girdi `// bi: <ad>`
  ile işaretli; lisans `app/js/cekirdek/bootstrap-icons-LICENSE.txt`. Paket
  bağımlılık olarak eklenmedi.

**Tasarımdan bilerek ayrılan yerler:**

- Sözcükler Dari: «مریض» (بیمار değil), «دوا». Tasarımdaki bazı sözcükler
  İran Farsçası.
- Menü sırası hekimlerin sırası (reçete, hasta, dava, reçete listesi…),
  tasarımınki değil.
- Clinical'da sekizinci satır **Blood Gr.** (formda da kâğıtta da): hastanın
  künyesinden geliyor, tasarımda yok.
- Kâğıttaki imza çizgisinin altında «امضا» yazıyor.
- Alt şeritteki sürüm görselden değil koddaki sabitten: `'v' + UYGULAMA_SURUMU`.
- Clinical sütununun altındaki resim tasarımdaki fotoğraf değil, vektör bir
  çizim (stetoskop ve kalp); hekim Ayarlar'dan kendi fotoğrafını koyabiliyor.
- Kâğıtta «Age» simgesi kum saati: tasarımdaki açık kitabın yaşla ilgisi yok.

**Ekran ve deneme.** `npm run deneme` (`tools/tarayici.mjs`) sayfanın
yerleşimini tasarımın ölçüleriyle, klavyeyle gezinmeyi, dört kâğıt stilinin
A4'e tek sayfada sığmasını (≤ 272 mm) ve ekranda Türkçe kalmadığını
denetliyor. **CI'da çalışmıyor** (Playwright proje bağımlılığı değil): CI
yalnız `kontrol` ve `test` koşuyor. Arayüze dokunan her değişiklikten sonra
elle çalıştırılmalı; `-- --ekran <klasör>` ekran görüntülerini de bırakıyor.
Portlar ortam değişkeniyle değişiyor (`DENEME_PORT`, `GORSEL_PORT`,
`SITE_PORT`): aynı makinede iki deneme birbirinin sunucusuna çarpmasın.

## Reçete kâğıdı

Üç stil var, Ayarlar'dan seçilir:

| Stil | Ne zaman |
|---|---|
| **Modern** (varsayılan) | Tasarımdaki kâğıt: dalgalı turkuaz antet, kadüse ve aile amblemi, kartuşlu vecize, tek kutuda Name/Age/Date/No, açık turkuaz Clinical paneli, dalgalı ayak ve rozetler |
| **Klasik** | Hekimin hâlihazırda kullandığı basılı kâğıdın aynısı: koyu mavi antet, renk bantları |
| **Sade** | Siyah-beyaz, en az mürekkep |

Üçü de aynı düzeni taşıyor — alanların yeri, QR ve doğrulama kodu değişmiyor.
Üçünde de Clinical satırları ve hasta şeridi tek satır; deneme dolu ve boş
kâğıtta bunu ayrıca ölçüyor.
Antetteki her satır (ad, ünvan, slogan, hizmetler, sabıka, adres, telefon, alt
rozetler) Ayarlar'dan girilir; kâğıt kimseye gömülü değildir, başka bir hekim
kendi bilgilerini yazınca kendi kâğıdı çıkar.

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

İki cihazın anahtarı bir araya gelince (eşitlemede ya da başka bir cihazın
yedeği yüklenince) biri aktif kalır, **kaybeden silinmez**: `eskiAnahtarlar`a
düşer. Yeni kodlar hep aktif anahtarla üretilir, denetim ise sırayla hepsini
dener — yoksa eşitlemenin ilk gününde cihazlardan birinin o güne dek bastığı
bütün reçeteler "TUTMUYOR" derdi.

Kod reçetenin kanonik özetinden üretilir; aynı reçete yeniden basıldığında
kod değişmez.

## Hesap sunucusu (`sunucu/`)

Kullanıcı adı + parolalı hesap için küçük bir Cloudflare Worker. Google yedeğinin
yerini alacak; istemci tarafı sonraki adımlarda bağlanıyor, o zamana kadar
uygulama sunucuya hiç istek atmıyor. Düz ES modülleri, bağımlılık yok, derleme yok.

| Dosya | Ne yapar |
|---|---|
| `worker.js` | yönlendirici + tek yanıt sarmalayıcısı; Durable Object sınıfları `Hesap` ve `Sinir` |
| `cekirdek.js` | saf mantık: yalnız DO'nun KV depolama arayüzü ve WebCrypto |
| `yerel.mjs` | Node'da aynı kod: `app/`'i ve `/v1/`'i aynı kökenden sunar, DO'lar bellekte |
| `wrangler.toml` | ad, DO bağları, `v1` göçü (SQLite), `IZINLI_KOKENLER` |
| `../app/js/paylasilan/hesap-kurallari.js` | kullanıcı adı/parola/kurtarma kodu normalleştirme ve kuralları — istemciyle ORTAK |

**Sunucu neyi hiç görmez:** parolayı, kasa anahtarını (K), kurtarma kodunu, açık
kaydı. Cihaz parolalardan `giris`/`kurtarma` anahtarlarını türetir (PBKDF2 +
HKDF); sunucu bunların bile yalnız tuzlu SHA-256 özetini saklar. K sunucuda
yalnız sarılmış (AES-GCM ile şifreli) durur, kasa da şifreli baytlardır.
**Neyi görür:** kullanıcı adı, IP adresleri, istek zamanları, kasa boyu. Bir
sızıntıda saldırganın tek yolu parola başına 600 bin turluk PBKDF2 denemesidir:
zayıf parola düşer (parola kuralları bunun için sıkı). Silinen hesabın
şifreli kopyası Cloudflare'in yedeklerinde 30 güne kadar kalabilir.

### API (`/v1/`)

Kimlik gövdeleri küçük JSON (≤ 4 KB), anahtarlar b64url (32 bayt), sarılı K
`{ iv, veri }` (base64). Hata gövdesi her zaman `{ hata: '<kod>' }`, 429'da `bekle` (sn).

| Uç | Yetki | Gövde | Başarı | Hatalar |
|---|---|---|---|---|
| `GET durum` | – | – | `{ ok: true }` | – |
| `POST kayit` | – | `kullanici, davet, giris, kurtarma, sarili, kurtarmaSarili` | 201 `{ jeton }` | 400 `gecersiz`, 403 `davet`/`kayit_kapali`, 409 `alinmis`, 429 `cok_istek` |
| `POST giris` | – | `kullanici, giris` | `{ jeton, sarili }` | 401 `yanlis` (bilinmeyen adda da aynısı), 429 `kilitli`/`cok_istek` |
| `POST kurtar/ac` | – | `kullanici, kurtarma` | `{ kurtarmaSarili }` | 401 `yanlis`, 429 |
| `POST kurtar/bitir` | – | `kullanici, kurtarma, giris, sarili, yeniKurtarma, yeniKurtarmaSarili` | `{ jeton }` — bütün oturumlar düşer, eski kod geçmez | 400, 401, 429 |
| `POST kurtarma/yenile` | Bearer | `giris, yeniKurtarma, yeniKurtarmaSarili` | `{ ok: true }` | 401 `yanlis`/`oturum`, 429 |
| `POST parola` | Bearer | `giris, yeniGiris, yeniSarili` | `{ jeton }` — öbür oturumlar düşer | 401, 429 |
| `POST cikis` | Bearer | – | `{ ok: true }` | – |
| `POST hesap/sil` | Bearer | `giris` | `{ ok: true }` | 401, 429 |
| `GET veri/surum` | Bearer | – | `{ surum }` (`""` = kasa yok) | 401 |
| `GET veri` | Bearer | – | ham kasa baytları, `X-Surum` başlığı; kasa yoksa 204 | 401 |
| `PUT veri` | Bearer | ham kasa baytları + `If-Match: "<surum>"` (`""` = ilk yazma) | `{ surum }` | 400 (If-Match yok / `{"bicim":"shafa-kasa"` ile başlamıyor), 409 `cakisma`, 413 `buyuk`, 429 `cok_istek` |

Her yanıtta — hata, 500 ve 503 dahil — CORS (yalnız `IZINLI_KOKENLER`; localhost
yalnız `yerel.mjs --gelistirme` ile), `Cache-Control: no-store` ve `nosniff` var:
başlıksız bir hata tarayıcıda "internet yok" gibi görünürdü. Depolama/kota
istisnası `503 { hata: 'kota' }`, beklenmeyen hata `500 { hata: 'sunucu' }` olur.
Gövde ve `Authorization` hiçbir yerde loglanmaz.

**Jeton** `<b64url(kullanıcı adı)>.<b64url(32 rastgele bayt)>`: ilk parça yalnız
Worker'ın hangi hesabın DO'suna gideceğini seçmesi için; DO jetonun tamamının
özetini arar, oynanmış önek hiçbir oturumla eşleşmez.

**Depolama** (Hesap DO, `idFromName(kullanıcı adı)`, yalnız kayıtla oluşur):
`hesap`, `oturum:<özet>` (365 gün boşta kalınca düşer, en çok 20), `veri:bas`
(`{ surum, parca, boy }`) + `veri:p:<i>` (≤ 1,9 MB parçalar; SQLite DO'da anahtar +
değer sınırı 2 MB), `yazim` (tempo). Kasa yazımında sürüm denetimi, bütün
parçalar, başlık ve artık parçaların silinmesi **aralarında await olmayan tek
blokta**: okuyan yarım kasa görmez, aynı sürüme iki yazmadan biri 409 alır.
Worker kasa gövdesine dokunmaz, DO'ya akış olarak aktarır (ücretsiz planda
istek başına 10 ms CPU).

### Sınırlar

- **Hesap kilidi** (`Sinir`, `u:<SHA-256(ad)>`): ilk 10 deneme serbest, sonra
  60 sn × 2^(n−10), en çok 1 saat; doğru giriş sıfırlar; 24 saat boşta kalan
  sayaç alarmla silinir. Her deneme sonucu beklenmeden sayılır: aynı anda
  gönderilen 30 denemeden yalnız 10'u parolaya ulaşır (önce denetleyip sonra
  saymak paralel saldırıda sınırı boşa çıkarırdı). Jetonlu işlemlerde oturum
  sayaçtan önce denetlenir; geçersiz jetonla kimse bir hesabı kilitleyemez. `giris`, `parola`, `hesap/sil`, `kurtarma/yenile`'ye
  uygulanır, kurtarmaya uygulanmaz (120 bitlik kod tahminle bulunmaz). Var olan
  ve olmayan ad aynı yoldan geçer. **Açık oturumları durdurmaz**: adı bilen biri
  hekimin çalışan cihazlarını kilitleyemez.
- **IP** (16 bellek parçası, depoya yazmaz; IPv6 /64'e indirgenir): kimlik
  denemeleri 10 dakikada 60, kayıt saatte 20.
- **Kayıt**: `DAVET_KODU` secret'ı olmadan kapalı (403 `kayit_kapali`); günde en
  çok 300 kayıt (tek sayaç).
- **Kasa**: en çok 20 MB (Content-Length'ten de okurken sayarak da); hesap başına
  iki yazma arası 5 sn, günde en çok 1000 yazma.

**Ücretsiz plan hesabı** (sosyal-studyo ile aynı Cloudflare hesabı, Worker
istekleri ortak): günde 100 bin Worker isteği, 100 bin DO isteği, 100 bin satır
yazma, toplam 5 GB. Bir yükleme ≈ (parça + 2) satır. gzip'li tipik bir kasa
1–2 MB, yani 3–4 satır; 100 hekim × günde 30 yükleme ≈ 12 bin satır. Ön
kontrol (`veri/surum`) bir Worker + bir DO isteği; 100 hekim × günde 50 ≈ 5 bin.
Depolama en kötü durumda 100 × 20 MB = 2 GB.

### Çalıştırma ve deneme

```bash
DAVET_KODU=deneme npm run yerel           # http://localhost:8788/ — uygulama + /v1/
DAVET_KODU=deneme node sunucu/yerel.mjs 9000 --gelistirme   # başka porttaki sayfaya CORS izni
npx vitest run test/sunucu test/hesap-kurallari           # yalnız sunucu testleri (npm test de koşar)
```

`yerel.mjs` Worker kodunu değiştirmeden çalıştırır; DO'ların yerine bellekte
bir taklit geçer (SQLite DO'nun 2 MB ve 128 anahtar sınırlarını o da uygular).
İstemci IP'sini soketten alır, istekle gelen `CF-Connecting-IP`'yi siler.
Birim testleri aynı taklidi kullanır. Veri süreç kapanınca gider.

Gerçek çalışma zamanı (workerd) CI'da koşmuyor, elle denenir:
`sunucu/.dev.vars` dosyasına `DAVET_KODU=...` yazıp (depoya girmez)
`cd sunucu && npx --yes wrangler@4.131.1 dev`. Son denemede (25 Eylül 2026) 14 adımlık
bir API betiği (kayıt, giriş, 4,5 MB parçalı kasa, If-Match çakışması, kurtarma,
kilit, paralel denemeler, parola, silme) ve gerçek Chromium'dan çapraz köken
istekleri (ön-uçuş, `Authorization`, `If-Match`, okunabilen `X-Surum` ve hata
gövdeleri) geçti. İlk denemede Node taklidinin göstermediği bir şey çıktı: DO kasa gövdesini okumadan yanıt verince (401,
429) Worker'daki aktarma borusu yanıttan sonra okumaya devam ediyor ve workerd
bağlantıyı koparıyordu — istemci 401 yerine ağ hatası görürdü. Artık DO erken
hatada gövdeyi sonuna kadar tüketiyor, sınırı aştığını baştan söyleyen gövdeyi
Worker hiç DO'ya göndermiyor; birim testi bunu tutuyor.

Dağıtım `.github/workflows/shafa-sunucu.yml` ile (repo değişkeni
`SHAFA_SUNUCU_ACIK = 1`, secret `SHAFA_DAVET_KODU`; Cloudflare secret'ları
sosyal-studyo'dan zaten var). Sahibin adımları ayrıca yazılacak.

## Kendi Google hesabına yedek

Varsayılan kapalı. Açılırsa hekimin **kendi** Google hesabına şifreli bir kopya
gider ve bilgisayarla telefon aynı kayıtları kullanır.

**Neden "yedek" deniyor, "eşitleme" değil.** Hekimin kafasındaki şey "kendi
hesabıma kaydetmek"; uygulama ise "همگام‌سازی" (eşitleme) diyordu. Arayüzdeki
ad artık «پشتیبان در حساب گوگل خودتان». Özellik gerçekte çift yönlü olduğu için
**alt satır bunu söylemeye devam ediyor** — yalnız "yedek" deyip geçmek, öbür
cihazdan kayıt inince hekimi şaşırtırdı. Ayarlar'da iki kart yan yana duruyor:
«پشتیبان فایلی» (dosya) ve «پشتیبان در حساب گوگل خودتان».

**Google girişi girişte değil.** Yeni kuran hekimde eşitleme kapalı, dolayısıyla
`senkron/google.js` hiç yüklenmiyor; açılışta ne giriş ekranı var ne hesap
sorusu. Bu bugün doğruydu ama **bunu tutan bir denetim yoktu**: biri açılışa bir
import koysa hiçbir test patlamazdı. `npm run deneme` artık temiz bir tarayıcı
bağlamı açıp bütün ağ isteklerini dinliyor — Google'a giden tek bir istek olsa,
ya da ekranda bir modal/e-posta kutusu çıksa, deneme düşüyor.

**Nereye yazıyor:** hekimin kendi Google Drive'ındaki gizli uygulama klasörüne
(`appDataFolder`). İstenen izin `drive.appdata`: Drive'ın geri kalanı görünmez,
klasör Drive arayüzünde çıkmaz, başka uygulamalar okuyamaz.

**Google ne görüyor:** şifreli baytlar. Belge yüklenmeden önce cihazda
kapatılıyor — parola → PBKDF2-SHA256 (310 000 tur) → AES-GCM-256. Parola
cihazdan çıkmaz, kasanın içine de girmez (girseydi kasayı açacak anahtar
kasanın içinde olurdu). Bu yüzden **iki cihaza da aynı parola elle yazılır.**
Parola kaybolursa buluttaki kopya açılamaz; cihazdaki veri ve indirilmiş yedek
dosyaları bundan etkilenmez.

**Çakışma:** bağımsız kayıtlarda `guncellendi`si yeni olan kazanır, silme mezar
taşı olduğu için silinen kayıt öbür cihazda dirilmez. Ayarlar kaydı tek zarfı
paylaştığı için ayrı işlenir: alan alan birleşir, bir tarafta boş olan alan dolu
kalır, iki taraf da doluysa yenisi seçilir ve eski değer hekime gösterilir.

**Çevrimdışı:** eşitleme kapalıyken Google'a ait tek satır yüklenmez (dinamik
import). Açıkken bile uygulama internetsiz eskisi gibi tam çalışır; eşitleme
internet gelince yapılır.

### Açmak için

**Ayarlar → Kendi Google hesabına yedek → «Google ile giriş yap».** Tek düğme.
Hekim bu uygulamada **hiçbir parola yazmıyor** — yazdığı tek şifre kendi Gmail
şifresi, o da Google'ın kendi penceresinde.

Kartta eskiden iki kutu vardı: «kasa parolası» ve «Google istemci kimliği».
İkincisi geliştirici işiydi; bir doktorun ekranında `992727769946-82oa2…` diye
bir dize durmamalıydı. İkisi de artık **«Gelişmiş»** başlığının altında katlı.
`npm run deneme` kartta görünür tek bir kutu bile olmadığını ve tek düğmenin
giriş düğmesi olduğunu denetliyor.

**Kasa kodunu uygulama üretiyor.** İlk girişte `kasaKoduUret()` (bkz.
`paylasilan/kimlik.js`) 100 bitlik bir kod üretip ayarlara yazıyor:
`G5KF-RFXS-7KPZ-626R-X9FW`. Birbirine benzeyen harfler (I, O, 0, 1) alfabede
yok, çünkü bu kod elle öbür cihaza geçirilecek. `crypto` yoksa `Math.random`'a
**düşülmüyor**, hata veriliyor: burada üretilen şey bir şifreleme anahtarı ve
tahmin edilebilir olması sessiz bir güvenlik kaybı olurdu.

**İkinci cihaz.** Orada da tek düğmeye basılır. Uygulama kendi kodunu üretir,
Google'daki dosyayı indirir, açamaz ve `parola` hatası düşer — bu kodu
`meta.sonSenkronHataKodu`'na yazılır. Kart o zaman, ancak o zaman, «bu yedeği
başka bir cihaz yaptı, onun kodunu yaz» kutusunu gösterir. İlk cihazda kod
«Gelişmiş» altında, kopyalama düğmesiyle duruyor.

Bu sıra bilerek böyle: hekim ilk cihazda kodla hiç karşılaşmıyor. Kodu ancak
gerçekten lazım olduğu anda görüyor.

**Tanıtım sayfası bundan söz etmiyor** — bilerek. Gerekçesi yukarıda,
"Sayfada bilerek olmayanlar" başlığında.

Onay ekranı "Testing" modunda olduğu sürece yalnız **test listesindeki adresler**
giriş yapabilir (en çok 100). Listede olmayan bir hekim `hesap_izinsiz` hatasını
ve onu dosya yedeğine yönlendiren cümleyi görür. Herkese açmak için onay
ekranının yayına alınması gerekiyor; `drive.appdata` hassas olmayan bir kapsam
olduğu için ağır doğrulama süreci gerekmez, ama gizlilik politikası sayfası
gerekir.

### İstemci kimliği nerede

`app/js/senkron/google.js` içinde, `VARSAYILAN_ISTEMCI` sabitinde, açıkça.
Durmasında sakınca yok: OAuth **web istemci kimlikleri tasarımı gereği
herkese açıktır** — Google ile giriş kullanan her sitenin kaynak kodunda
görünürler. Gizli olan `client secret`tir ve bu akış onu hiç kullanmaz.

Kötüye kullanımı engelleyen şey gizliliği değil, Google'ın kimliği **kaynak
adresine** bağlaması. Yalnız şu iki adresten çalışır:

```
https://ferhat-yasinoglu.github.io
http://localhost:8788
```

Başka biri bu kimlikle olsa olsa **kendi** Drive'ının uygulama klasörüne
erişir — buradaki hiçbir şeye değil.

### Kendi projesini kullanmak isteyen için

Ayarlardaki **Google istemci kimliği** alanı yedek yol olarak duruyor; oraya
yazılan değer gömülü olanın yerine geçer. Kendi kimliğini üretmek için:

1. <https://console.cloud.google.com> → yeni proje.
2. **APIs & Services → Library** → *Google Drive API* → Enable.
3. **Google Auth Platform → Get started**: uygulama adı, destek e-postası,
   **External**, iletişim adresi. Yayına almaya gerek yok — *Audience* altında
   **Test users**'a kendi Gmail adresini eklemek yeter.
4. **Data Access** → `.../auth/drive.appdata` kapsamı eklenir.
5. **Clients → Create client → Web application.** *Authorized JavaScript
   origins*'e uygulamanın adresi yazılır; *redirect URIs* boş bırakılır
   (kullanılan akış yönlendirme değil).

Google Cloud Console iki adımlı doğrulama (2SV) açık olmayan hesapları
içeri almıyor; hesapta açık değilse ilk adımda takılır.

### Bilerek kabul edilen iki şey

**Google'ın betiği bizim sayfamızda çalışıyor.** Giriş için `accounts.google.com`
üzerinden bir betik yükleniyor ve o betik, sayfanın görebildiği her şeyi
görebilir — IndexedDB'deki hasta kayıtları ve kasa parolası dahil. Bu, Google'ın
desteklediği giriş yolunun (GIS) doğasında var. İki şeyle sınırlandı: betik
uygulama açılışında değil, yalnız gerçek bir eşitleme sırasında yükleniyor; ve
CSP'de joker yok, tam adres yazılı. Bundan tamamen kurtulmanın yolu yönlendirme
tabanlı OAuth'a geçmek; şimdilik yapılmadı.

**Reçete doğrulama anahtarı da buluta gidiyor** (şifreli). Gitmek zorunda: iki
cihazın aynı reçeteyi doğrulayabilmesi için aynı anahtarı taşıması gerekiyor.
Sonucu şu: kasa parolasını ve Drive dosyasını birlikte ele geçiren biri geçerli
doğrulama kodu üretebilir. Parola yalnız hekimin iki cihazında.

### Ne otomatik deneniyor, ne elle doğrulandı

Eşitleme mantığı, kasa ve iki cihazın buluşması hem birim testleriyle hem de
gerçek tarayıcıda gerçek IndexedDB/WebCrypto ile deneniyor — taşıyıcı yerine
bellek taşıyıcısı konuyor. Taşıyıcı bu yüzden bilerek ince tutuldu
(`oku()` ve `yaz()`): eşitlemenin doğruluğu Google'a bağlı olmadan denenebiliyor.

**Google'ın kendi uç noktaları CI'da denenmiyor** ve denenemez: gerçek bir
OAuth onayı bir insanın tıklamasını gerektiriyor. Gerçek hesapla uçtan uca ilk
tur 23 Eylül 2026'da elle yapıldı ve geçti — giriş, izin, Drive'a yazma ve
okuma. Yani akış çalışıyor; ama bu yoldaki bir gerileme testlerden değil,
ancak kullanımdan anlaşılır.

Yolda çıkan ve düzeltilen şey de buydu: arıza değil, arızanın görünmezliği.
Bir hata Google'ın ekranında çıkıp uygulamada iz bırakmayınca sebebi kimse
bulamıyor. Artık kod hangi kimliğin kullanıldığını yazıyor, engellenen betiği
"internet yok"tan ayırıyor ve yanıt gelmezse takılıp kalmıyor.

**Aynı dersin ikinci vakası: `access_denied`.** Onay ekranı "Testing" modunda
olduğu sürece, test listesinde OLMAYAN her adres Google'dan `access_denied`
alıyor. Kod bunu pencere kapatmayla aynı kovaya (`yetki`) atıyordu ve hekim
şunu okuyordu:

> «گوگل اجازه نداد. حساب را انتخاب کنید و اجازهٔ دسترسی بدهید.»
> *(Google izin vermedi. Hesabı seçin ve erişime izin verin.)*

Bu, o hekimin **yapamayacağı** bir şey. Kaç kez denerse denesin olmayacaktı.
Artık `access_denied` kendi kodunda (`hesap_izinsiz`) ve mesajı iki sebebi
birden sayıyor — hekim "İptal"e bastığında da aynı hata dönüyor, istemciden
ikisi ayırt edilemiyor — sonra da bugün **herkeste** çalışan yolu gösteriyor:
«دانلود پشتیبان». Tarayıcı denemesi yalnız kodun ayrıştığını değil, **metnin
"izin ver" demediğini ve dosya yedeğine yönlendirdiğini** de denetliyor.

## Yapılacaklar

- [x] İskelet: depo, yönlendirici, tema, bileşenler
- [x] İlaçlar
- [x] Hastalar
- [x] Reçete yazma (hasta + ilaç satırları, alerji ve çift etken madde uyarıları)
- [x] Reçete yazdırma (A4/A5, antetli)
- [x] Farsça arayüz ve sağdan sola düzen
- [x] Reçete kâğıdı: antet, klinik ölçüm sütunu, QR, boş kâğıt
- [x] WhatsApp / e-posta ile gönderme
- [x] Kendi Google hesabına şifreli yedek; iki cihaz aynı kayıtları kullanır (yukarıya bak)
- [ ] Reçete başlık alanlarının gözden geçirilmesi (aşağıya bak)
- [ ] Reçeteyi dosya (PDF/görsel) olarak gönderme — şu an metin olarak gidiyor,
      kâğıt görünümü için "Yazdır → PDF" kullanılıyor

### Reçete alanları

Şu an standart bir küme kullanılıyor: reçete no (gün içinde kendiliğinden artar,
elle de yazılabilir), tarih, reçete türü (normal/kırmızı/yeşil/mor/turuncu),
hasta, tanı, tanı kodu (ICD-10), protokol no, reçete notu; doktor adı, ünvanı,
diploma no ve kurumu Ayarlar'dan gelir ve kaydedilirken reçeteye işlenir.
Satırda: ilaç, adet, kullanım şekli, süre, not.

Klinik ölçümler ayrı tutulur: kan basıncı, nabız, solunum, kilo, ateş,
oksijen, boy (`paylasilan/recete.js` içindeki `OLCUMLER`); kan grubu hastanın
künyesinden gelir. Kâğıtta bunların etiketleri İngilizce durur (BP · PR · RR ·
BW · Temperature · SpO2 · Height · Blood Gr.) — basılı kâğıt da böyle ve
bunlar hekimlikte evrensel kısaltmalar.

Alan eklemek için üç yer: `paylasilan/recete.js` içindeki `bosRecete`,
`sayfalar/kagit-yaz.js` içindeki form ve `kagit.js` içindeki kâğıt
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
    senkron-arayuz.js     Ayarlar'daki eşitleme kartı ve eşitleme turu
    cekirdek/             dom · yonlendirici · modal · bildirim · simge · cizimler ·
                          tema · tarih-secici · gorsel · kurtarma · kurulum
    depo/                 sema · depo · idb · recete · dogrulama · yedek · ornek ·
                          senkron (taşıyıcıdan bağımsız eşitleme motoru)
    senkron/              google.js — Drive appDataFolder taşıyıcısı (tek ağ ucu)
    paylasilan/           saf alan mantığı: ilac · hasta · recete · qr · dogrulama ·
                          tarih · metin · kimlik · senkron (birleşme kararları) ·
                          kasa (şifreleme) · hesap-kurallari (sunucuyla ortak)
    sayfalar/             kagit-yaz (reçete sayfası) · panel · ilaclar · ilac ·
                          hastalar · hasta · receteler · recete · bos-kagit ·
                          tanilar · laboratuvar · raporlar · ayarlar · bulunamadi
sunucu/                   hesap sunucusu (Cloudflare Worker): worker · cekirdek ·
                          yerel (Node'da aynı kod + app/) · wrangler.toml
test/                     vitest (test/sunucu: Worker + DO'lar bellek taklidiyle)
tanitim/index.html        tanıtım ve indirme sayfası (tek dosya)
tools/                    sun (statik sunucu) · kontrol (statik denetim) ·
                          tarayici (uçtan uca) · site-denemesi (yayın düzeni) ·
                          gorsel-uret (tanıtım ekran görüntüleri)
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
- Eşitlemenin **kararı** `paylasilan/senkron.js`'te (saf), **yürütmesi**
  `depo/senkron.js`'te, **ağı** `senkron/google.js`'te. Taşıyıcı arayüzü iki
  yöntemden ibaret (`oku`, `yaz`) — böylece eşitlemenin doğruluğu Google'a
  bağlı olmadan denenebiliyor.
- **Saf modüller cümle kurmaz.** Doğrulama, hata, uyarı ve "3 gün önce" gibi
  göreli tarihler `paylasilan/` ve `depo/` içinde **kod** olarak döner; metne
  çevirme işi `hatalar.js`'tedir. Böylece alan mantığı dilden bağımsız kalır ve
  hiçbir hata mesajı çevrilmeden ekrana düşmez.

## Sınırlar

- **e-Reçete / Medula entegrasyonu yoktur.** Resmî kurum kimliği gerektirir. Bu uygulama
  kendi içinde çalışan bir kayıt ve takip sistemidir; çıktısı yazdırılabilir reçetedir.
- Veri varsayılan olarak tek cihazdadır. İki cihazı buluşturmak için ya yedek
  dosyası taşınır ya da Google hesabına yedek açılır (aşağıya bak).
- Tarayıcı verisi temizlenirse kayıtlar silinir. Düzenli yedek şart.
- Yedek dosyası şifresiz JSON'dur ve hasta bilgisi içerir; güvenli bir yerde saklanmalı.
- Reçete WhatsApp ve e-postaya **metin** olarak gider. Tarayıcıdan sunucusuz
  dosya eki oluşturulamadığı için kâğıt görünümü isteniyorsa "Yazdır → PDF olarak
  kaydet" ile dosya alınıp elle eklenir.
