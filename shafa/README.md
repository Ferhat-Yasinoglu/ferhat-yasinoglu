# Shafa — Reçete

Klinikte çalışan bir hekim için reçete yazma ve hasta kaydı: çerçevesiz,
derleme adımsız bir PWA.
Bütün veriler tarayıcıda (IndexedDB) durur ve internet olmadan da tam çalışır.
Hesap **isteğe bağlı**: hesap yokken hiçbir kayıt cihazdan çıkmaz, açılışta tek
bir ağ isteği bile yok. Hesap açan hekimin bilgisayarı ve telefonu aynı kayıtları
kullanır; sunucuya yalnız cihazda şifrelenmiş bir kopya gider (aşağıda
[Hesap](#hesap-bilgisayar-ve-telefon-aynı-kayıtlar)).

**Arayüz dili فارسی'dir** ve sayfa sağdan sola akar — CSS baştan beri yalnız
mantıksal yön özellikleri kullandığı için düzen kendiliğinden dönüyor, ayrı bir
RTL sayfası yok. Çoklu dil şimdilik kapalı; altyapı duruyor, yeni bir dil
eklemek `DILLER`'e bir satır ve `app/i18n/<kod>.json` dosyası eklemekten ibaret.

**Neden böyle:** Hasta verisi hassas veri. En güvenli sunucu, olmayan sunucudur —
bu yüzden veri cihazda tutulur, hesap açılsa bile sunucu yalnız okuyamadığı
şifreli baytları saklar ve asıl güvence yine dosya yedeğidir. Uygulama yedek almayı
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
- **Hesap reklam edilmiyor.** Sunucunun adresi uygulamaya yazılana kadar
  (`VARSAYILAN_SUNUCU` boş) hesap kartı dürüstçe «henüz açık değil» diyor;
  sitenin söz vermesi erken olurdu. Google döneminde aynı hata yapılmıştı:
  sayfa, çoğu hekimin kullanamadığı bir özelliği "imkân" diye saydı. Bu yüzden
  "iki cihazı nasıl birleştiririm" sorusunun cevabı bugün **herkeste** çalışan
  yol olarak kalıyor: dosya yedeğini öbür cihaza taşımak.

  Gizlilik sorusunun (۰۱) cevabı ise hesabı **anlatıyor**: "معلومات دستگاه را
  ترک نمی‌کند" derken isteğe bağlı şifreli kopyayı söylememek eksik bilgi olurdu.
  Cevap tasarımdaki dürüst metnin aynısı: kopya cihazda şifreleniyor; sunucuyu
  uygulamanın sahibi Cloudflare'de işletiyor; parola güçlüyse kimse açamıyor;
  sunucu kullanıcı adını, zamanları, boyutu ve IP'yi görüyor; parola da kurtarma
  kodu da kaybolursa çevrimiçi kopya açılmıyor; asıl yedek dosya.

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
`npm run sun` ve `npm run yerel` yalnız bu bilgisayardan erişilir (127.0.0.1): aynı
Wi-Fi'daki biri geliştirme sunucusuna ulaşamaz. Telefonda denemek için bilerek
`HOST=0.0.0.0 npm run yerel`.

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

Reçete sayfası (`#/recete/kagit`, giriş sayfası) hekimlerin seçtiği tasarım
görselinden kuruldu (2026-09 yeniden tasarımı: hekimler reçeteye ondan çok ilaç
yazıyor, eski kâğıt on iki gerçek adda taşıyordu). Bilgisayarda **solda hekimin
doldurduğu form, sağda önizleme paneli**: formda yazılan her şey kâğıda anında
düşüyor, kâğıttaki alana dokunmak da aynı kutuyu açıyor.

- **Form** tek panel: başlık bandı («ذخیره به عنوان قالب» / «از قالب پر کن»),
  hasta kartı (نام و تخلص, yaş, şemsi tarih, numara), Clinical kartı (BP iki
  kutu ama reçetede tek metin, kan grubu seçim listesi; eski serbest değerler
  korunuyor), «افزودن دوا» (hekimin ilaçları ile hazır listenin birlikte, yerinde
  aranması; گروپ دوایی / شکل / برند süzgeçleri), sayfanın akışında uzayan ilaç
  tablosu (başlığı yapışık, 11 satırdan sonra sıkışık), belirti ve tetkik kontrol
  listeleri, tanı araması (ICD kodlu çipler), ek not; altta پاک کردن · پیش نمایش
  · ذخیره و چاپ. Ctrl+S yalnız kaydeder.
- **Önizleme paneli** (`app/js/onizleme-arayuz.js`): başlıkta «پیش نمایش نسخه»
  ve üç düğme — büyük önizleme, «چاپ», «ذخیره PDF». Panel yapışkan: tablo uzayıp
  sayfa kaysa da yazdır düğmesi her kaydırmada elde (alttaki düğme ekranın
  dışına inse de). «چاپ» ve «ذخیره PDF» alttaki düğmenin yolu: önce kaydeder
  (numara ve doğrulama kodu kayıtta üretiliyor), geçersiz formu basmaz,
  düzenlemede aynı reçeteyi günceller. PDF için kütüphane yok: tarayıcının
  yazdırma penceresi açılıyor, belge başlığı yazdırma boyunca dosya adı oluyor
  (`nuskha-<numara>-<hasta>`, boş kâğıtta `nuskha-khali`) ve oturumda bir kez
  «Save as PDF» ipucu çıkıyor. Kâğıt panelin eni ve ekranın boyuna sığacak
  kadar ölçekli; 25 ilacın üstünde kâğıt yapraklara bölünür, o zaman başlıkta
  «2 صفحه» rozeti çıkar ve tuval kendi içinde (klavyeyle de) kayar, her yaprak
  tuvale tam sığar. Büyük önizleme de yaprak sayısını başlığında söyler.
- **Aynı panel başka sayfalarda da:** reçete kaydı (`#/recete/<id>`) basılacak
  kâğıdı her yaprağıyla alt alta gösteriyor, ilaçları kâğıttaki adla (etken
  madde ve güçle) listeliyor; boş kâğıt sayfası (`#/recete/bos`) tomarı yazdırıyor
  ya da PDF olarak kaydediyor. Gönderilen metin (WhatsApp, e-posta, pano) da
  ilacın kâğıttaki adını yazıyor; reçeteler listesi kâğıda İngilizce yazılan
  tanıyı Dari adıyla, ilacı etken maddesiyle de buluyor.

İki sütun ancak form 620 px alabildiğinde, yani 1280 px ve üstünde; 861–1279
arasında form tam genişlikte, kâğıt altında. Telefonda (≤ 860 px) her şey sağdan
sola, kenar çubuğu sağdan açılan çekmece.

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
- **Cinzel** (`app/yazi/cinzel-kagit.woff2`, OFL, `OFL-Cinzel.txt`): lacivert
  kâğıttaki Latin ad, ihtisas satırı ve mühür halkası. Latin harflere indirilmiş
  16 KB'lık bir alt küme; yazdırmadan önce en çok 800 ms bekleniyor.
- **Kalam 700** (`app/yazi/kalam-700.woff2`, OFL, `OFL-Kalam.txt`): modern
  kâğıttaki tek el yazısı satırı ("Healthy Life Brighter Tomorrow"). Yalnız
  ASCII'ye indirilmiş 12 KB'lık bir alt küme.
- **«طبیب حقیقی خداوند (ج) است» vecizesi** Aref Ruqaa Bold'un tamamından
  dizilmiş satır içi SVG yolu (`cizimler.js`, `OFL-ArefRuqaa.txt`): yazı tipi
  gönderilmiyor.
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

Dört stil var, Ayarlar'dan seçilir:

| Stil | Ne zaman |
|---|---|
| **Lacivert** (سرمه‌ای و طلایی, varsayılan) | Yeni tasarımın kâğıdı (`app/js/kagit-lacivert.js`): altın çerçeve, vecize, üç sütunlu antet (Latin ad · mühür · Dari ad), hasta şeridi, solda SYMPTOMS / LAB / VITAL SIGNS / DIAGNOSIS / NOTES, sağda ℞ ve numaralı ilaçlar, imza satırında doğrulama kodu, ayakta adres, QR ve telefon |
| **Modern** | Önceki varsayılan: dalgalı turkuaz antet, kadüse ve aile amblemi, açık turkuaz Clinical paneli, dalgalı ayak ve rozetler |
| **Klasik** | Hekimin hâlihazırda kullandığı basılı kâğıdın aynısı: koyu mavi antet, renk bantları |
| **Sade** | Siyah-beyaz, en az mürekkep |

Dördü de aynı alanları taşıyor; testler kâğıdın parçalarını stilden bağımsız
`data-rol` kancalarıyla buluyor. Kendiliğinden kaydedilmiş «modern» bir kez
laciverte döndü (`kagitStiliSurum`); klasik ya da sade seçmiş hekime
dokunulmadı.

**Lacivert kâğıt sabit bir A4 yaprağı** (194 × 272 mm, 8 mm @page payı) ve
yoğunluğu içerikten hesaplanıyor (`paylasilan/kagit-yogunluk.js`, saf; önizleme
ile baskı aynı sonucu alıyor): 10 ilaca dek rahat, 16'ya dek orta, 25'e dek
sık — hepsi tek sayfa. Üstü temiz devam yaprakları: her yaprakta hasta şeridi
(«۱/۲»), imza, aynı doğrulama kodu, QR ve ayak. Yazı küçültülmüyor (ilaç adı en
az 8,2 pt); taşan hiçbir şey kesilmiyor, deneme bunu basılan genişlikte her
yaprakta ölçüyor. A5'te sık kip yok, orta kipin üstü bölünüyor. QR okunamayacak
kadar sıkışacaksa (modül < 0,30 mm) iletişim QR'ı ya da kod basılıyor ve altındaki
yazı bunu söylüyor. İmza görseli (Ayarlar) yalnız bu cihazda kalıyor: yedeğe ve
eşitlemeye girmiyor; yoksa boş imza çizgisi basılıyor, uydurma imza asla.
Antetteki her satır (ad, ünvan, slogan, hizmetler, sabıka, adres, telefon, alt
rozetler) Ayarlar'dan girilir; kâğıt kimseye gömülü değildir, başka bir hekim
kendi bilgilerini yazınca kendi kâğıdı çıkar.

**Veri kaynakları.** Hazır ilaç listesi (678 ilaç, 18 grup) Shafa'nın kendi
123 ilacı ile sahibin öbür uygulaması **nuskha**'nın ilaç adlarından, klinik
listeler (149 belirti, 261 tanı, 133 tetkik; İngilizce ve Dari) yine nuskha'nın
ad listelerinden üretildi. nuskha'daki ilaç başına hazır doz, zaman, tarika ve
adet bilgisi **bilerek alınmadı**: kaynak kopyası (`tools/kaynak/`) ayıklanmış
olarak depoda ve `npm run kontrol` bu alanların geri sızmasını durduruyor. Seçim
listelerindeki kullanım ifadeleri («روزانه ۱ بار», «بعد از غذا»…) ilaca bağlı
değil, genel ifadeler; bir ilaca önerilen tek kullanım hekimin o ilaca daha önce
kendi yazdığıdır ve o da ancak dokununca doldurulur. Kâğıda klinik adlar
İngilizce basılıyor, Dari adla da aranıyor. Örnek antet uydurma
(«نمونه احمدی» / "Dr. Nemuna Ahmadi", کابل، افغانستان, 0700000000); tasarım
görselindeki gerçek görünen adres ve iş yerleri depoya girmiyor, `kontrol` ve
görsel üreticisi bunları tam ifade olarak arıyor (`tools/gercek-veri.mjs`).

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

Kullanıcı adı + parolalı hesap için küçük bir Cloudflare Worker; Google yedeğinin
yerini aldı. Hekimin gördüğü taraf aşağıda, [Hesap](#hesap-bilgisayar-ve-telefon-aynı-kayıtlar)
bölümünde. Düz ES modülleri, bağımlılık yok, derleme yok.

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
| `POST kurtarma/yenile` | Bearer | `giris, yeniKurtarma, yeniKurtarmaSarili` | `{ ok: true }` | 401 `yanlis`/`oturum` (5. yanlışta oturum düşer), 409 `cakisma`, 429 `cok_istek` (IP) |
| `POST parola` | Bearer | `giris, yeniGiris, yeniSarili` | `{ jeton }` — öbür oturumlar düşer | 401 `yanlis`/`oturum`, 409 `cakisma`, 429 `cok_istek` (IP) |
| `POST cikis` | Bearer | – | `{ ok: true }` | – |
| `POST hesap/sil` | Bearer | `giris` | `{ ok: true }` | 401 `yanlis`/`oturum`, 409 `cakisma`, 429 `cok_istek` (IP) |
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
  60 sn × 2^(n−10), en çok 1 saat; doğru parola sıfırlar; 24 saat boşta kalan
  sayaç alarmla silinir. Her deneme sonucu beklenmeden sayılır: aynı anda
  gönderilen 30 denemeden yalnız 10'u parolaya ulaşır (önce denetleyip sonra
  saymak paralel saldırıda sınırı boşa çıkarırdı). Yalnız `giris`'e uygulanır,
  kurtarmaya uygulanmaz (120 bitlik kod tahminle bulunmaz). Var olan ve olmayan
  ad aynı yoldan geçer. **Açık oturumları durdurmaz**: adı bilen biri hekimin
  çalışan cihazlarının ne eşitlemesini ne parola değiştirmesini engelleyebilir.
- **Oturum başına parola denemesi** (`parola`, `hesap/sil`, `kurtarma/yenile`):
  yanlış parola hesap kilidine değil o OTURUMA sayılır (`hata:<özet>`, oturum
  kaydından ayrı anahtar); 5. yanlışta oturum silinir ve jeton `oturum` alır.
  Önceden bu işlemler hesap kilidindeydi: yalnız adı bilen bir yabancı saatte
  bir yanlış girişle kilidi sonsuza dek açık tutup hekimin parolayı
  değiştirmesini — çalınan bir cihazı düşürmesini — engelleyebiliyordu. Jetonu
  çalan biri ise en çok 5 kez dener, sonra yeniden girmek zorundadır ve hesap
  kilidine takılır. Sayım paralel denemelerde de tek tek (30 paralel denemeden
  5'i parolaya ulaşır). Başarılı işlem hesap kilidini de sıfırlar.
- **Eşzamanlı sır değişimi**: anahtar hangi hesap kaydıyla doğrulandıysa yazma
  o kayda göre yapılır; arada hesap değiştiyse (başka bir kurtarma, parola
  değişimi) 409 `cakisma`. Tek kullanımlık kurtarma kodu aynı anda gelen iki
  istekle iki kez kullanılamaz; eski parolayla yarışan bir giriş parola
  değişiminin düşürmesinden kurtulamaz.
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
sosyal-studyo'dan zaten var). Sahibin adımları aşağıda:
[Sahibin yapacakları](#sahibin-yapacakları-dağıtım).

## Hesap: bilgisayar ve telefon aynı kayıtlar

İsteğe bağlı. Hesap yokken uygulama ağa hiç çıkmaz — tarayıcı denemesi bunu
her koşuda ölçüyor (açılışta, Ayarlar çizilirken, Google dönemi ayarları
dururken: sıfır `/v1/` isteği). Kayıtlar hesapla da cihazda kalır; sunucuya
yalnız cihazda şifrelenmiş kasa gider. Kodun yerleri:

| Dosya | Ne yapar |
|---|---|
| `js/hesap-arayuz.js` | Ayarlar'daki «حساب» kartı, kurtarma kodu kutusu, hesap değişimi sorusu, kalıcı hata bandı |
| `js/senkron/hesap-servisi.js` | akışlar (kayıt, giriş, kurtarma, parola, çıkış, silme) ve kendiliğinden eşitleme — DOM yok |
| `js/senkron/hesap.js` | WebCrypto: paroladan/kurtarma kodundan anahtar, K'yi sarma/açma |
| `js/senkron/sunucu.js` · `sunucu-adresi.js` | HTTP istemcisi, hata eşleme; sunucunun adresi (`VARSAYILAN_SUNUCU`) |
| `js/paylasilan/hesap-kurallari.js` | kullanıcı adı/parola/kod normalleştirme ve kuralları (sunucuyla ortak) |

### Hekimin gördüğü

**Ayarlar → «حساب»** (dosya yedeği kartının hemen altında; ikisi aynı sorunun iki cevabı):

- **Sunucu yok** (`VARSAYILAN_SUNUCU` boş, sayfa localhost değil): kart
  «حساب‌ها هنوز فعال نشده‌اند…» der, tek kutu yok. Bu sürüm böyle çıkıyor;
  adres dağıtımdan sonra ayrı bir değişiklikle yazılır.
- **Çıkışlı**: «ورود» / «ساختن حساب» sekmeleri, «رمز را فراموش کرده‌اید؟» ile
  kurtarma formu. Kullanıcı adı kutusu `autocapitalize=none autocorrect=off
  spellcheck=false dir=ltr inputmode=email autocomplete=username`; yazılırken
  küçük harfe ve ASCII rakama döner (`Dr.Ahmad۱۲` → `dr.ahmad12`). Parola
  kutuları `current-password` / `new-password` (parola yöneticisi ancak böyle
  kaydediyor). Facebook/Instagram/WhatsApp/Android WebView içinde açılmışsa
  «önce Chrome ya da Safari'de aç» uyarısı: oraların deposu ayrı ve geçici,
  indirme ve pano da çoğu zaman sessizce çalışmıyor.
- **Hesap açma sırası**: kurallar (kutu ve ağdan önce) → hesap değişimi
  sorusu → **kurtarma kodu kutusu** → ancak onay alınınca `POST /v1/kayit` →
  ilk eşitleme. Kod hesaptan ÖNCE gösteriliyor: kutu açıkken uygulama kapanırsa
  (iOS arkadaki PWA'yı öldürür) ortada kodunu kimsenin görmediği bir hesap
  kalmasın. Kutuda kod büyük ve `dir=ltr`, kullanıcı adı, uygulamanın adresi ve
  tarih; «اشتراک» (`navigator.share` varsa), «کاپی», «دانلود فایل» (.txt, Dari +
  İngilizce); «kâğıda yaz ya da fotoğrafını çek, yalnız bu telefonda tutma»;
  işaretlenmeden «ادامه» açılmayan onay kutusu.
- **Hesap değişimi sorusu**: girişte ya da hesap açarken bu cihazda örnek
  olmayan kayıt varsa ve cihaz en son başka bir hesapla (ya da hiç) eşitlenmişse:
  «این دستگاه N ثبت دارد. به حساب X اضافه شود؟» — «اضافه کن», «اول این دستگاه
  را پاک کن» (önce yedek indirtir; silme ancak giriş başarılı olunca), «انصراف».
  Varsayılan eklemek değil: odak kapat düğmesinde, Enter vazgeçer. Ayarlar da
  sayılır (tek kayıt), ama yalnız kişisel bir şey taşıyorsa: hekimin yazdığı
  antet (örnek antetten farklı), Clinical görseli ya da reçete doğrulama
  anahtarı (`paylasilan/antet.js`, `kisiselAyarMi`). Yalnız antedi doldurulmuş
  ortak bir cihazda soru sorulmasaydı o hekimin adı, telefonu ve doğrulama
  anahtarı başka bir hekimin hesabına ve bütün cihazlarına giderdi; kutu bunu
  ayrı bir satırla söylüyor.
- **Kurtarma**: kullanıcı adı + kurtarma kodu + yeni parola. Yeni kurtarma kodu
  ancak eski kod sunucuda **tuttuktan sonra** gösteriliyor (kodu yanlış yazan
  hekim her denemede boşuna yeni kod yazmasın); eski kod bir daha geçmez, öbür
  cihazların oturumu düşer.
- **Girişli**: «وارد شده: <ad>», son eşitleme, gönderilmemiş değişiklik sayısı,
  «همگام‌سازی اکنون», «خروج از این دستگاه» (isteğe bağlı «ثبت‌های این دستگاه را
  هم پاک کن»). «پیشرفته»: parola değiştir (öbür cihazlar yeniden sorar), yeni
  kurtarma kodu (parola ister, kutu yine önce — ama parola cihazdaki
  doğrulayıcıyla, `girisOzeti`, TUTTUKTAN sonra: yanlış parolada kutu hiç
  açılmaz; onaydan sonra bir şey ters giderse «کد نو ثبت نشد؛ کد بازیابی قبلی
  هنوز معتبر است»), hesabı sil (şifreli kopyanın Cloudflare yedeklerinde 30
  güne kadar durabileceğini söyler).
- **Çıkış tur sürerken**: çıkış önce süren turu keser (kuşak sayacı + ağ
  isteğinin kesilmesi) ve anahtarları siler, bu sekmedeki turun bitmesini
  bekler, «bu cihazdakileri de sil» silmesini sekmeler arası eşitleme kilidinin
  içinde yapar. Tur, yerele (içe aktarma) ve sunucuya (yükleme) yazmadan hemen
  önce hâlâ sürmesi gerekip gerekmediğini soruyor (`senkronEt(…, { devam })`).
  Önceden yavaş bir hatta süren indirme silmeden sonra bitip hesabın bütün
  hastalarını az önce silinen cihaza geri yazıyordu.
- **Oturum düştü** (parola ya da kurtarma başka cihazda, hesap silindi): kart
  kullanıcı adını hazır tutup yalnız parolayı sorar; o zamana kadar kendiliğinden
  eşitleme durur. Sunucu silinmiş hesapla yanlış parolayı bilerek ayırmıyor (ad
  sızmasın), bu yüzden bu formun "yanlış" metni hesabın başka bir cihazda
  silinmiş olabileceğini de söyler.
- **Kalıcı hatalar** (`buyuk`, `kasa_bozuk`, `parola`, `oturum`, `sunucu_dolu`…)
  kartta ve bantta (zil kutusu; telefonda sayfanın tepesi). İnternet yok, sunucu o
  an yok, yazım temposu ve çakışma sessiz: kendiliğinden geçerler. Formlarda
  (giriş, hesap açma, kurtarma) ağ hatası eşitlemeyi değil formu anlatır
  («وقتی وصل شدید دوباره کوشش کنید»): form kendiliğinden yeniden gönderilmez.
- **Meşgul**: anahtar türetme (600 bin tur PBKDF2) telefonda saniyeler sürüyor;
  kartın bütün düğme ve kutuları kilitlenir ve «لطفاً صبر کنید…» yazar.
- **Boş cihaz**: reçete sayfasının karşılamasında «حساب دارید؟ وارد شوید» —
  Ayarlar'ı hesap kartında, kullanıcı adı kutusunda açar. iOS Safari sekmesi
  verisini 7 günde siler, ana ekran uygulamasının deposu ayrıdır: yeniden
  kuran hekim girişi aramadan bulmalı.
- **«حذف همه داده‌ها»** silmeyi hesaptan çıkışın içinde yapar
  (`cikisYap({ sil: true })`: jeton ve K silinir, süren tur durdurulup beklenir;
  yoksa bir tur sunucudaki kopyayı boş cihaza geri indirirdi) ve sunucudaki
  kopyanın durduğunu, silmek için hesabın silinmesi gerektiğini söyler.

**Kendiliğinden eşitleme** yalnız girişliyken: açılıştan 1,5 sn sonra, son
değişiklikten 2 dk sonra, internet gelince (30 sn) ve uygulamaya dönülünce
(son tur 10 dk'dan eskiyse). Önce ucuz ön denetim (`GET veri/surum`): sunucudaki
sürüm bilinenle aynı ve gönderilmemiş değişiklik yoksa tur hiç başlamaz.
Sekmeler arası tek tur (`navigator.locks`). Tur geçici bir hatayla biterse
(`cok_istek`, `cakisma`, `sunucu_yok`, `zaman_asimi`, `sunucu_hata`,
`sunucu_dolu`) servis yeniden denemeyi kendi kurar: sunucu ne kadar
bekleneceğini söylediyse (429 `bekle`) o kadar, yoksa 30 sn, 1, 2, 4… dk (en
çok 10 dk), üstüne birkaç saniyelik rastgele pay. İki cihaz aynı anda
yazınca kaybeden (sunucunun 5 sn'lik yazım temposu: 429) böylece birkaç
saniye sonra kendiliğinden yükler; önceden değişiklik hekim başka bir şey
yazana kadar cihazda kalıyordu. İnternet yokken (`ag`) `online` olayı bekler. Dosya yedeğinin hatırlatması
susmuyor: hesapla eşitlenen cihazda da asıl yedek dosyadır.

**Dürüst metinler** (kart, tanıtım SSS'i, `app/index.html` açıklaması): kayıtlar
cihazda kalır; hesapla uygulamanın sunucusunda (uygulamanın sahibi Cloudflare'de
işletiyor) **şifreli** bir kopya durur; parola güçlüyse sunucunun sahibi dahil
kimse açamaz; sunucu kullanıcı adını, zamanları, boyutu ve IP adreslerini görür;
parola da kurtarma kodu da kaybolursa çevrimiçi kopya açılmaz (cihazdaki
kayıtlar kalır); asıl yedek dosya yedeğidir.

### Sahibin yapacakları (dağıtım)

1. GitHub → depo → **Settings → Secrets and variables → Actions**:
   - **Variables** sekmesi → *New repository variable*: `SHAFA_SUNUCU_ACIK` = `1`.
   - **Secrets** sekmesi → *New repository secret*: `SHAFA_DAVET_KODU` = hekimlere
     verilecek davet kodu (herhangi bir kelime, ör. iki kelimelik bir söz; depoya
     hiçbir yerde yazılmaz). `CLOUDFLARE_API_TOKEN` ve `CLOUDFLARE_ACCOUNT_ID`
     sosyal-studyo'dan zaten var.
2. **Actions → Shafa Sunucu → Run workflow** (ya da `shafa/sunucu/**`'ya dokunan
   bir `main` gönderimi). İş sunucu testlerini koşar, Worker'ı ve Durable
   Object'leri dağıtır, `DAVET_KODU`'nu yazar, `/v1/durum` ve CORS ön-uçuşuyla
   duman testi yapar ve adresi işin özetine yazar
   (`https://shafa-sunucu.<alt-alan>.workers.dev`).
3. Adresi asistana ver: ayrı bir değişiklik `VARSAYILAN_SUNUCU`'yu ve
   `app/index.html`'deki CSP'ye (`connect-src`) **tam** adresi yazar — joker
   (`*.workers.dev`) değil, yoksa herkesin kendi Worker'ına veri çıkarılabilirdi.
4. Davet kodunu hekimlere (WhatsApp'tan) ver. Sızarsa secret'ı değiştirip işi
   yeniden çalıştır; açılmış hesaplar etkilenmez.

İlk gerçek dağıtım, "Edit Cloudflare Workers" şablonundaki jetonun Durable
Object göçüne yetip yetmediğini de gösterecek (büyük olasılıkla yeter: DO
sınıfları betikle birlikte yükleniyor).

### Google döneminden geçiş ve Drive temizliği

Google yedeğini kullanmış cihazlarda kayıtlar olduğu gibi duruyor; yeni sürüm
açılışta Google döneminin ayarlarını (kasa kodu dahil) bir kez siliyor.

1. Her cihazı yeni sürüme güncelle (açık sekmeyi kapatıp aç; «نسخه تازه آماده
   است.» çıkarsa «تازه‌سازی»).
2. Güvence için bir cihazda **dosya yedeği** al.
3. Birinci cihazda (ör. bilgisayar) **hesap aç**; soru gelince «اضافه کن».
4. İkinci cihazda (telefon) aynı hesapla **gir**; soru gelince yine «اضافه کن»
   (ikisi de aynı hekimin kayıtları; birleşme sıradan bağımsız, kayıp yok).
   İki cihazda Ayarlar → «داده‌ها» sayılarını karşılaştır.
5. **Drive'daki şifreli kopyayı sil**: drive.google.com → sağ üstte dişli →
   *Ayarlar* → *Uygulamaları yönet* → *Shafa* → *Seçenekler* → **Gizli uygulama
   verilerini sil**, ardından *Drive bağlantısını kes*.
6. **Erişimi kaldır**: myaccount.google.com → *Güvenlik* → *Üçüncü taraf
   uygulamalar ve hizmetlerle bağlantılarınız* → *Shafa* → **Tüm bağlantıları sil**.
7. **OAuth istemcisini sil**: console.cloud.google.com → projeyi seç →
   *APIs & Services → Credentials* → OAuth istemci kimliği → **Delete** (ya da
   projeyi tamamen kapat: *IAM & Admin → Settings → Shut down*).

### Bilerek kabul edilenler ve yapılmayanlar

- **Veritabanı sızarsa** saldırganın yolu parola başına 600 bin turluk PBKDF2
  denemesi; zayıf parola düşer. Kurallar bunun için sıkı (en az 10 karakter,
  yalnız rakam ya da telefon numarası olamaz, kullanıcı adını içeremez, ~400
  yaygın parola — Dari olanlar dahil — reddedilir).
- **Kullanıcı adına bağlı sabit tuz** (`SHA-256("shafa-hesap-v1|" + ad)`): bilinen
  bir kullanıcı adı için önceden hesaplama yapılabilir. Standart bir ödünleşim;
  tur sayısı istemcide sabit, sahte bir sunucu onu düşüremez.
- **K döndürülmüyor** («bütün cihazları çıkar ve yeni anahtar üret» yok).
  Çalınan, kilidi açık bir cihaz K'yi ve jetonu taşır; parola değişince oturumu
  düşer ve API'den yeni veri alamaz, ama elindeki K eskimez. Tam döndürme
  yeniden şifreleme ve yeniden sarmayı tek atomik adımda ister; sonraya.
- **Köken ortak**: Shafa ve sosyal-studyo aynı `ferhat-yasinoglu.github.io`
  kökeninde; aynı kökendeki bir sayfa bu kökenin IndexedDB'sini okuyabilir. Bu
  bugün cihazdaki hasta kayıtları için de doğru. Kendi kökenine taşımak her
  hekimin yerel veritabanını taşımak demek; ayrı bir iş.
- **Kasa tek parça**: her turda bütün kasa gidip geliyor (gzip'li). Kasa
  büyürse ileride kovalara bölünür, yalnız değişen kova yüklenir.
- **Doğrulama anahtarı kasada** (şifreli): iki cihazın aynı reçeteyi
  doğrulayabilmesi için gitmek zorunda. K'yi ve sunucudaki kasayı birlikte ele
  geçiren biri geçerli doğrulama kodu üretebilir.
- **Silinen hesabın** şifreli kopyası Cloudflare yedeklerinde 30 güne kadar
  kalabilir (kart bunu söylüyor).
- **Kota sosyal-studyo ile ortak** (aynı Cloudflare hesabı; bkz. yukarıda
  *Sınırlar*). Kabaca: günde 40 hasta ≈ yılda 12 MB JSON; gzip bunu 5–10 kat
  küçültüyor, yani 20 MB tavanı yıllarca yetiyor. Kota dolarsa hekim «حد روزانهٔ
  سرور پر شده» görür (internet yok değil), gece yarısı UTC'de (Kabil 04:30) açılır.

### Ne otomatik deneniyor

- **Birim** (`npm test`): sunucu (`test/sunucu`), kurallar, `hesap.js`'in
  bağımsız hesaplanmış bilinen-cevap değerleri, HTTP eşlemesi, kasa v1/v2,
  `hesap-servisi` akışları gerçek Worker koduna ve bellek DO'larına karşı,
  kartın saf parçaları (`test/hesap-arayuz.test.js`).
- **Tarayıcı** (`npm run deneme`, CI koşmuyor): yerel sunucu denemenin kendi
  sürecinde açılıyor, böylece sunucunun deposuna doğrudan bakılıyor. Üç bağlam
  üç cihaz: A bilgisayar, B telefon (390×844), C Instagram'ın uygulama içi
  tarayıcısı. Denenen: kutuların autocomplete/dir ayarları; sunucusuz kart;
  boş cihazdaki «حساب دارید؟»; hesap açmada kural hataları, hesap değişimi
  sorusu ve kurtarma kodu kutusunun hesaptan ÖNCE geldiği; sunucunun deposunda
  hasta adı, parola, K ve kurtarma kodunun hiçbir değerde geçmediği; B'nin
  «önce temizle» ile girişi; B'deki değişikliğin 2 dk sonra kendiliğinden
  gidip A'ya ön denetimle (`veri/surum`) geldiği; yanlış parola, meşgul hâli ve
  10 denemeden sonra Dari kilit metni — A bu arada eşitlemeye devam ediyor;
  iki cihazın AYNI ANDA yazması (kaybeden 429 alıp kendiliğinden yeniden
  yüklüyor, kazanan bir sonraki tetikte alıyor); çevrimdışı giriş formunun
  metni; kurtarma (yeni kod, eski kod geçmiyor), A'nın parolayı yeniden sorması
  ve bandı; parola değişince B'nin yeniden sorması; yanlış parolayla yeni
  kurtarma kodu kutusunun hiç açılmaması; silerek/silmeden çıkış; «tüm verileri
  sil»in önce çıkması; sunucuya konan şifresiz paketin reddi; hesap silme ve
  girişli öbür cihazın oturum formunun hesabın silinmiş olabileceğini
  söylemesi. Zamanlayıcılar Playwright saatiyle ileri alınıyor.

## Yapılacaklar

- [x] İskelet: depo, yönlendirici, tema, bileşenler
- [x] İlaçlar
- [x] Hastalar
- [x] Reçete yazma (hasta + ilaç satırları, alerji ve çift etken madde uyarıları)
- [x] Reçete yazdırma (A4/A5, antetli)
- [x] Farsça arayüz ve sağdan sola düzen
- [x] Reçete kâğıdı: antet, klinik ölçüm sütunu, QR, boş kâğıt
- [x] WhatsApp / e-posta ile gönderme
- [x] Kullanıcı adı + parolalı hesap: şifreli kopya, iki cihaz aynı kayıtları kullanır (yukarıya bak)
- [ ] Hesap sunucusunun adresi: dağıtımdan sonra `VARSAYILAN_SUNUCU` ve CSP'deki tam adres
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
  veri/                   ilaclar.json (678 ilaçlık ad sözlüğü, 18 grup) ·
                          klinik.json (belirti/tanı/tetkik, Dari + İngilizce, yazım kısayolları)
  js/
    uygulama.js           giriş: depo, dil, menü, arama, yönlendirici
    i18n.js               t() ve sözlük yükleme
    hatalar.js            hata, doğrulama ve uyarı kodlarının arayüz metni
    kagit.js              reçete kâğıdı (dolu ve boş hali) + yazdırma + ölçekleme
    kagit-lacivert.js     lacivert (varsayılan) kâğıt: yapraklar, yoğunluk kipleri
    onizleme-arayuz.js    önizleme paneli (başlık, yazdır / PDF, yaprak rozeti)
    hesap-arayuz.js       Ayarlar'daki hesap kartı, kurtarma kodu kutusu, hesap bandı
    cekirdek/             dom · yonlendirici · modal · bildirim · simge · cizimler ·
                          tema · tarih-secici · gorsel · kurtarma · kurulum
    depo/                 sema · depo · idb · recete · dogrulama · yedek · ornek ·
                          senkron (taşıyıcıdan bağımsız eşitleme motoru)
    senkron/              hesap (WebCrypto) · sunucu (HTTP istemcisi, tek ağ ucu) ·
                          sunucu-adresi · hesap-servisi (akışlar, kendiliğinden eşitleme)
    paylasilan/           saf alan mantığı: ilac · hasta · recete · kagit-yogunluk · klinik ·
                          ilac-listesi · antet · sablon · qr · dogrulama ·
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
                          gorsel-uret (tanıtım ekran görüntüleri) ·
                          ilac-uret / klinik-uret.py (veri/ listelerini üretir)
  kaynak/                 nuskha'nın ad listelerinin kopyası (ilaç başına kullanım ayıklanmış)
```

**Hazır listeler elle düzenlenmez, üretilir.** `node tools/ilac-uret.mjs --yaz`
ilaç listesini, `python3 tools/klinik-uret.py` klinik listeleri yeniden yazar;
ikisi de öbür depo olmadan `tools/kaynak/`taki kopyadan çalışır (`--nuskha
<dosya> --kaynak-yaz` kopyayı yeniler). İlaç listesinde her satırın kalıcı
kimliği (`hid`) var ve asla değişmez; yeni ürün sıradaki kimliği alır. Listeler
AD sözlüğüdür: nuskha'daki ilaç başına hazır doz/zaman/tarika/adet bilerek
alınmadı, `npm run kontrol` ve birim testleri geri sızmasını durdurur. Hekime
önerilebilecek tek kullanım, kendi kaydettiği reçetelerden türetilen «son
kullanım»dır (`paylasilan/recete.js` `sonKullanimlar`).

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
  `depo/senkron.js`'te, **ağı** `senkron/sunucu.js`'te. Taşıyıcı arayüzü iki
  yöntemden ibaret (`oku`, `yaz`) — böylece eşitlemenin doğruluğu sunucuya
  bağlı olmadan denenebiliyor.
- **Saf modüller cümle kurmaz.** Doğrulama, hata, uyarı ve "3 gün önce" gibi
  göreli tarihler `paylasilan/` ve `depo/` içinde **kod** olarak döner; metne
  çevirme işi `hatalar.js`'tedir. Böylece alan mantığı dilden bağımsız kalır ve
  hiçbir hata mesajı çevrilmeden ekrana düşmez.

## Sınırlar

- **e-Reçete / Medula entegrasyonu yoktur.** Resmî kurum kimliği gerektirir. Bu uygulama
  kendi içinde çalışan bir kayıt ve takip sistemidir; çıktısı yazdırılabilir reçetedir.
- Veri varsayılan olarak tek cihazdadır. İki cihazı buluşturmak için ya yedek
  dosyası taşınır ya da hesap açılır (yukarıya bak).
- Tarayıcı verisi temizlenirse kayıtlar silinir. Düzenli yedek şart.
- Yedek dosyası şifresiz JSON'dur ve hasta bilgisi içerir; güvenli bir yerde saklanmalı.
- Reçete WhatsApp ve e-postaya **metin** olarak gider. Tarayıcıdan sunucusuz
  dosya eki oluşturulamadığı için kâğıt görünümü isteniyorsa "Yazdır → PDF olarak
  kaydet" ile dosya alınıp elle eklenir.
