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

## Çalıştırma

```bash
cd shafa
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
| **Reçete kâğıdı** | Üç stil (modern / klasik / sade): antet (ad, ünvan), hizmet satırları, sabıka şeridi, Name/Age/Date şeridi, solda Clinical sütunu (BP · PR · RR · BW · Temperature), sağda ℞ alanı, altta rozetler ve iletişim |
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

**Renk klinik turkuazı.** Uygulamayı hekim muayene sırasında, hastayla
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

## Reçete kâğıdı

Üç stil var, Ayarlar'dan seçilir:

| Stil | Ne zaman |
|---|---|
| **Modern** (varsayılan) | Beyaz zemin, üstte tek bir turkuaz çizgi, ince kurallar ve boşluk. Az mürekkep yer, fotokopide dağılmaz, klinik evrakı gibi durur |
| **Klasik** | Hekimin hâlihazırda kullandığı basılı kâğıdın aynısı: koyu mavi antet, renk bantları |
| **Sade** | Siyah-beyaz, en az mürekkep |

Üçü de aynı düzeni taşıyor — alanların yeri, QR ve doğrulama kodu değişmiyor.
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

## İki cihazda aynı veri

Varsayılan kapalı. Açılırsa bilgisayarla telefon aynı kayıtları kullanır.

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

**Ayarlar → Google ile eşitle** → kasa parolasını yaz → **Kaydet** → **Şimdi eşitle**.
İkinci cihazda aynı parola. İstemci kimliği alanı boş bırakılır.

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

### Denenmemiş olan

Eşitleme mantığı, kasa ve iki cihazın buluşması hem birim testleriyle hem de
gerçek tarayıcıda gerçek IndexedDB/WebCrypto ile deneniyor (taşıyıcı yerine
bellek taşıyıcısı konuyor). **Google'ın kendi uç noktaları denenmedi** —
istemci kimliği gerekiyor. Bu yüzden taşıyıcı bilerek ince tutuldu:
`oku()` ve `yaz()`.

## Yapılacaklar

- [x] İskelet: depo, yönlendirici, tema, bileşenler
- [x] İlaçlar
- [x] Hastalar
- [x] Reçete yazma (hasta + ilaç satırları, alerji ve çift etken madde uyarıları)
- [x] Reçete yazdırma (A4/A5, antetli)
- [x] Farsça arayüz ve sağdan sola düzen
- [x] Reçete kâğıdı: antet, klinik ölçüm sütunu, QR, boş kâğıt
- [x] WhatsApp / e-posta ile gönderme
- [x] İki cihazda aynı veri: Google Drive ile şifreli eşitleme (yukarıya bak)
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
    senkron-arayuz.js     Ayarlar'daki eşitleme kartı ve eşitleme turu
    cekirdek/             dom · yonlendirici · modal · bildirim · simge · tema ·
                          tarih-secici · gorsel · kurtarma
    depo/                 sema · depo · idb · recete · dogrulama · yedek · ornek ·
                          senkron (taşıyıcıdan bağımsız eşitleme motoru)
    senkron/              google.js — Drive appDataFolder taşıyıcısı (tek ağ ucu)
    paylasilan/           saf alan mantığı: ilac · hasta · recete · qr · dogrulama ·
                          tarih · metin · kimlik · senkron (birleşme kararları) ·
                          kasa (şifreleme)
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
  dosyası taşınır ya da Google eşitlemesi açılır (aşağıya bak).
- Tarayıcı verisi temizlenirse kayıtlar silinir. Düzenli yedek şart.
- Yedek dosyası şifresiz JSON'dur ve hasta bilgisi içerir; güvenli bir yerde saklanmalı.
- Reçete WhatsApp ve e-postaya **metin** olarak gider. Tarayıcıdan sunucusuz
  dosya eki oluşturulamadığı için kâğıt görünümü isteniyorsa "Yazdır → PDF olarak
  kaydet" ile dosya alınıp elle eklenir.
