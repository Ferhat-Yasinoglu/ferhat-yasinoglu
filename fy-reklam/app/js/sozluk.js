// Arayüz metinleri. Her anahtar iki dilde de olmalı (tools/kontrol.mjs denetler).
// Dari metinlerde ZWNJ (‌) anlamlıdır. Gönderi İÇERİĞİ bu sözlükten değil, ürün kataloğundan gelir.

const tr = {
  // genel
  'geri': 'Geri', 'sil': 'Sil', 'silindi': 'Silindi', 'ac': 'Aç', 'dil': 'Dil', 'eposta': 'E-posta',
  'cikis': 'Çıkış yap', 'cikis_onay': 'Bu cihazdan çıkış yapılsın mı?',

  // menü
  'menu': 'Ana menü', 'menu.projeler': 'Projeler', 'menu.taslaklar': 'Taslaklar', 'menu.yeni': 'Yeni gönderi', 'menu.kayit': 'Kayıt', 'menu.daha': 'Daha',
  'menu_kisa.paylas': 'Paylaş',

  // kip
  'kip.yerel_kisa': 'yerel kip', 'kip.yerel_aciklama': 'Sunucu yok: tasarla, metni yaz, indir ve paylaş çalışır; doğrudan yayınlama ve ortak kayıt kapalı.',

  // giriş
  'giris.ust': 'FY — Yapay Zekâ Ajansı', 'giris.reklam': 'Reklam',
  'giris.aciklama': 'Ürünleri tanıtan gönderileri tasarla, metnini yaz, Instagram ve Facebook\'ta paylaş.',
  'giris.not': 'Yalnız yönetici Gmail adresleri girebilir. Hiçbir anahtar bu cihaza inmez.',
  'giris.gelistirme': 'Geliştirme girişi', 'giris.google_yuklenemedi': 'Google girişi yüklenemedi. Bağlantını denetle.',
  'giris.yetkisiz': '{eposta} yönetici listesinde değil.',

  // hatalar
  'hata.kimlik': 'Google kimliği doğrulanamadı. Yeniden dene.', 'hata.yapilandirma': 'Sunucu henüz ayarlanmamış (Google istemcisi ya da yönetici listesi yok).',
  'hata.oran': 'Çok fazla deneme; biraz sonra yeniden dene.', 'hata.ag': 'Sunucuya ulaşılamıyor.', 'hata.sunucu': 'Sunucu hatası.',

  // projeler
  'projeler.ust': 'Ürünler', 'projeler.yeni_ust': 'Yeni gönderi', 'projeler.baslik_1': 'Hangi ürünü', 'projeler.baslik_vurgu': 'anlatıyoruz?',
  'projeler.aciklama': 'Bir ürün seç; görsel ve metin onun gerçek özelliklerinden başlar. Sayfada olmayan bir vaat yazılmaz.',
  'urun.yakinda': 'yakında', 'urun.tasarla': 'Tasarla',

  // adımlar
  'adim.tasarla': 'Tasarla', 'adim.metin': 'Metin', 'adim.paylas': 'Paylaş', 'adim.etiket': 'Adım {n} / 3',

  // tasarla
  'tasarla.aciklama': 'Biçimi, şablonu ve dili seç; metinleri düzenle. Önizleme canlı.',
  'tasarla.bicim': 'Biçim', 'tasarla.sablon': 'Şablon', 'tasarla.dil': 'İçerik dili',
  'bicim.kare': 'Kare 1:1', 'bicim.dikey': 'Dikey 4:5', 'bicim.hikaye': 'Hikâye 9:16',
  'sablon.baslik': 'Başlık', 'sablon.ozellikler': 'Özellikler', 'sablon.akis': 'Akış',
  'tasarla.baslik': 'Başlık', 'tasarla.baslik_ipucu': 'Vurgu için kelimeyi *yıldızlar* arasına al',
  'tasarla.alt': 'Alt metin', 'tasarla.alt_ipucu': 'Bir cümle: ürün ne yapar?',
  'tasarla.ozellikler': 'Özellikler', 'tasarla.ozellik_not': 'Özellikler ve Akış şablonlarında',
  'tasarla.cagri': 'Çağrı', 'tasarla.cagri_ipucu': 'Tek eylem: Deneyin: adres',
  'tasarla.logo': 'FY imzası', 'tasarla.adres_goster': 'Adresi göster',
  'tasarla.devam': 'Metne geç', 'tasarla.sifirla': 'Üründen al', 'tasarla.sifirla_onay': 'Metinler ürünün varsayılanlarına dönsün mü?', 'tasarla.sifirlandi': 'Metinler sıfırlandı',
  'tasarla.dil_sifirla': 'Dil değişti. Metinler yeni dilin varsayılanlarına dönsün mü? (Vazgeç: yazdıkların kalır)',
  'tasarla.onizleme_not': 'Önizleme gerçek boyutun küçültülmüşüdür; JPEG Paylaş adımında üretilir.',

  // metin
  'metin.baslik': 'Gönderi metni', 'metin.aciklama': 'Üç parça: ilk satır kanca, sonra gerçekten bir şey anlatan değer, en sonda tek çağrı. Etiketler en altta.',
  'metin.kanca': 'Kanca', 'metin.kanca_not': 'İlk satır; «daha fazla»dan önce görünen kısım. Soru ya da ters köşe, ama içerikte olmayanı vaat etmez.',
  'metin.deger': 'Değer', 'metin.deger_not': '3–6 kısa satır; okuyan bir şey öğrenmeli ya da uygulayabilmeli.',
  'metin.cagri': 'Çağrı', 'metin.cagri_not': 'Tek eylem: «Deneyin: adres» ya da «Yorumla: …».',
  'metin.baglanti': 'Bağlantı (isteğe bağlı)', 'metin.baglanti_not': 'Instagram açıklamasında bağlantı tıklanmaz; Facebook\'ta tıklanır.',
  'metin.etiketler': 'Etiketler', 'metin.etiket_hedef': '4–5 niş etiket', 'metin.etiket_ekle': 'Etiket yaz, Enter', 'metin.etiket_kaldir': '{e} etiketini kaldır',
  'metin.onizleme': 'Instagram\'da nasıl görünür', 'metin.daha_fazla': '… daha fazla', 'metin.denetim': 'Denetim',
  'metin.sayac': '{k} / {enCok} karakter · {e} etiket · {emoji} emoji',
  'metin.devam': 'Paylaşıma geç', 'metin.kopyala': 'Metni kopyala', 'metin.kopyalandi': 'Metin panoya kopyalandı', 'metin.kopyalanamadi': 'Kopyalanamadı; metni elle seç.',
  'metin.sifirla': 'Üründen al', 'metin.sifirla_onay': 'Metin ürünün varsayılanına dönsün mü?',

  // denetim kodları (paylasilan/metin.js)
  'denetim.temiz': 'Marka sesine uygun; platform sınırları içinde.',
  'denetim.bos': 'Metin boş.', 'denetim.uzun': 'Açıklama 2.200 karakteri {n} karakter aşıyor.', 'denetim.cok_etiket': 'En çok 30 etiket; şu an {n}.',
  'denetim.kanca_yok': 'Kanca yok: ilk satır boş.', 'denetim.kanca_uzun': 'Kanca {n} karakter; «daha fazla» kesmesi yaklaşık 125\'te.', 'denetim.kanca_cok_satir': 'Kanca tek satır olmalı.',
  'denetim.cok_emoji': '{n} emoji; marka sesi en fazla bir.', 'denetim.bagirma': 'Büyük harfle bağırma: {n}', 'denetim.cok_unlem': 'Art arda ünlem ya da soru işareti.',
  'denetim.az_etiket': 'Yalnız {n} etiket; 4–5 niş etiket hedef.', 'denetim.fazla_etiket': '{n} etiket; 4–5 yeter, yığın gibi görünür.', 'denetim.genel_etiket': 'Çok genel etiket: {n}',
  'denetim.ig_baglanti': 'Instagram açıklamasında bağlantı tıklanmaz; «profildeki bağlantı» de.', 'denetim.deger_kisa': 'Değer kısmı çok kısa; bir şey öğretmiyor.',
  'denetim.cok_etiketleme': 'En çok 20 @etiketleme; şu an {n}.', 'denetim.baski': 'Baskı kalıbı: «{n}». Marka sesi aceleye getirmez.',

  // paylaş
  'paylas.baslik': 'Paylaş', 'paylas.aciklama': 'Görsel JPEG olarak hazır. Telefondan paylaşım menüsüyle Instagram\'a at ya da indir; bağlıysan doğrudan yayınla.',
  'paylas.uretiliyor': 'Görsel üretiliyor…', 'paylas.gorsel_alt': '{urun} için üretilen gönderi görseli', 'paylas.gorsel_bilgi': '{w}×{h} JPEG · {kb} KB',
  'paylas.indir': 'JPEG indir', 'paylas.indirildi': 'Görsel indirildi', 'paylas.paylas': 'Paylaş…', 'paylas.paylasilamadi': 'Paylaşılamadı.', 'paylas.paylasim_yok': 'Bu cihazda dosya paylaşımı yok; JPEG indir.',
  'paylas.business_suite': 'Business Suite', 'paylas.elle_not': 'Elle yol: görseli indir ya da paylaş, metni kopyala; Business Suite Instagram ve Facebook\'a birlikte paylaşır ve zamanlar.',
  'paylas.metin': 'Gönderi metni', 'paylas.metin_hatali': 'Metinde hata var; Metin adımına dön.', 'paylas.dogrudan': 'Doğrudan yayınla',
  'paylas.yayin_yerel': 'Doğrudan yayınlama için Worker gerekir (Daha → Bağlantı).', 'paylas.kanal_okunamadi': 'Kanal durumu okunamadı.',
  'paylas.yayinla_instagram': 'Instagram\'a yayınla', 'paylas.yayinla_facebook': 'Facebook\'a yayınla',
  'paylas.yayinla_onay': '{kanal} hesabında yayınlansın mı?', 'paylas.yayinlaniyor': 'Yayınlanıyor…', 'paylas.yayinlandi': '{kanal} hesabında yayınlandı',
  'paylas.prova_not': 'PROVA: sunucu hiçbir dış gönderim yapmaz; istek kayda düşer. Canlıya almak: Worker PROVA=0.', 'paylas.prova_tamam': 'Prova tamam: kayda yazıldı, dışarı bir şey gitmedi.',
  'paylas.kota': 'Instagram API kotası: son 24 saatte {k} / {s}',
  'paylas.tekrar_onay': 'Aynı metin son 24 saatte bu kanalda yayınlanmış. Yine de yayınlansın mı? (Meta tekrarı reddedebilir)',
  'kanal_ad.instagram': 'Instagram', 'kanal_ad.facebook': 'Facebook',
  'kanal.calisir': 'çalışır', 'kanal.prova': 'prova', 'kanal.kapali': 'bağlı değil', 'kanal.yerel': 'yerel',

  // yayın hataları (Worker kodları)
  'yayin_hata.yeniden_baglan': 'Meta erişimi düştü; Sayfa token\'ı yenilenmeli.', 'yayin_hata.izin': 'Meta izin vermedi (izin ya da erişim düzeyi).', 'yayin_hata.oran': 'Meta hız sınırı; biraz sonra dene.',
  'yayin_hata.gorsel': 'Meta görseli alamadı (JPEG, boyut ya da oran).', 'yayin_hata.meta': 'Meta hatası.', 'yayin_hata.ag': 'Sunucuya ulaşılamadı.',
  'yayin_hata.gorsel_yok': 'Görsel sunucuya yüklenemedi.', 'yayin_hata.metin_uzun': 'Metin 2.200 karakteri aşıyor.', 'yayin_hata.kanal_kapali': 'Bu kanal sunucuda bağlı değil.',
  'yayin_hata.cok_gorsel': 'En çok 10 görsel.', 'yayin_hata.oturum': 'Oturum düştü; yeniden gir.', 'yayin_hata.gorsel_turu': 'Sunucu yalnız JPEG kabul eder.', 'yayin_hata.gorsel_buyuk': 'Görsel çok büyük (en çok 1,9 MB).',
  'yayin_hata.kota': 'Instagram günlük yayın kotası doldu; yarın yeniden dene.', 'yayin_hata.bekle': 'Meta görseli hâlâ işliyor; bir dakika sonra yeniden dene.', 'yayin_hata.tekrar': 'Aynı metin son 24 saatte bu kanalda yayınlandı (Meta tekrarı reddeder).', 'yayin_hata.kimlik_dogrulama': 'Facebook Sayfası kimlik doğrulaması istiyor: Facebook uygulamasında tamamla.',

  // taslaklar
  'taslaklar.ust': 'Bu cihazda', 'taslaklar.baslik': 'Taslaklar', 'taslaklar.aciklama': 'Taslaklar bu cihazda durur; yedeğe girmez.',
  'taslaklar.bos': 'Henüz taslak yok', 'taslaklar.bos_aciklama': 'Projeler\'den bir ürün seçince taslak açılır.', 'taslaklar.yeni': 'Yeni gönderi',
  'taslaklar.ac': 'Düzenle', 'taslaklar.sil_onay': 'Taslak silinsin mi?',
  'taslak_durum.taslak': 'taslak', 'taslak_durum.paylasildi': 'paylaşıldı', 'taslak_durum.yayinlandi': 'yayınlandı',

  // kayıt
  'kayit.ust': 'Kim, ne zaman, neyi', 'kayit.baslik': 'Kayıt', 'kayit.aciklama': 'Paylaşılan ve yayınlanan gönderiler. İki kişi aynı listeyi görür.',
  'kayit.ortak_not': 'Ortak kayıt (sunucu) + bu cihaz.', 'kayit.ortak_okunamadi': 'Ortak kayıt okunamadı; yalnız bu cihaz gösteriliyor.', 'kayit.yerel_not': 'Yalnız bu cihazın kaydı (yerel kip).',
  'kayit.bos': 'Kayıt yok', 'kayit.bos_aciklama': 'İndirilen, paylaşılan ya da yayınlanan ilk gönderi burada görünür.',
  'kanal_eylem.instagram': 'Instagram\'da yayınlandı', 'kanal_eylem.facebook': 'Facebook\'ta yayınlandı', 'kanal_eylem.indir': 'JPEG indirildi', 'kanal_eylem.paylas': 'paylaşım menüsüyle', 'kanal_eylem.kopyala': 'metin kopyalandı', 'kanal_eylem.business_suite': 'Business Suite açıldı',
  'kayit_durum.yayinlandi': 'yayınlandı', 'kayit_durum.prova': 'prova', 'kayit_durum.hata': 'hata', 'kayit_durum.yapildi': 'yapıldı', 'kayit_durum.gonderiliyor': 'gönderiliyor',

  // daha
  'daha.ust': 'Ayarlar', 'daha.gorunum': 'Görünüm', 'daha.dil_not': 'Arayüz dili; gönderi dili Tasarla\'da seçilir.', 'daha.tema': 'Tema', 'daha.gece': 'Gece', 'daha.gunduz': 'Gündüz',
  'daha.baglanti': 'Bağlantı', 'daha.sunucu': 'Sunucu', 'daha.ayni_koken': 'aynı köken (yerel)', 'daha.google': 'Google ile giriş', 'daha.ayarli': 'ayarlı', 'daha.ayarsiz': 'ayarlı değil',
  'daha.ig_yolu_ig': 'Instagram Login yolu (graph.instagram.com)', 'daha.ig_yolu_fb': 'Facebook Sayfası üzerinden (graph.facebook.com)', 'daha.kanal_kapali_not': 'Secret\'lar yok: README → Meta kurulumu', 'daha.sayfa': 'Sayfa {id}',
  'daha.gelistirme_uyari': 'Geliştirme kipi açık: Google\'sız giriş var. Yayında asla.',
  'daha.hesap': 'Hesap', 'daha.hesap_yok': 'Oturum yok (yerel kip).', 'daha.depolama': 'Bu cihazda depolama',
  'daha.baglantilar': 'Bağlantılar', 'daha.suite_not': 'Instagram ve Facebook\'a elle paylaşım ve zamanlama',
  'daha.hakkinda': 'FY Reklam 0.1 — çerçevesiz, derleme adımsız; görseller cihazda üretilir, anahtarlar yalnız sunucuda durur.',
  'daha.kurulum': 'Meta kurulum rehberi',
  'daha.google_eksik': 'Sunucu yanıt veriyor ama Google istemcisi (GOOGLE_ISTEMCI) ya da REKLAMCILAR eksik: giriş kapalı, uygulama yerel kipte. README → Yayın.',

  // kurulum rehberi
  'kurulum.ust': 'Meta tarafı', 'kurulum.baslik': 'Kurulum rehberi',
  'kurulum.aciklama': 'Doğrudan yayınlama için Meta tarafında bir kez yapılacaklar. Sıra önemli; onay kutuları bu cihazda durur.',
  'kurulum.not': 'Kurallar Ekim 2026 Meta belgelerinden; kaynaklar README\'de. Hiçbir token bu uygulamaya yazılmaz; yalnız GitHub Secrets.',
  'kurulum.ilerleme': '{n} / {t} adım', 'kurulum.sifirla': 'Sıfırla', 'kurulum.sifirla_onay': 'Onay kutuları temizlensin mi?',
  'kurulum.kopyala': 'Kopyala', 'kurulum.kopyalandi': 'Kopyalandı',
};

const fa = {
  'geri': 'بازگشت', 'sil': 'حذف', 'silindi': 'حذف شد', 'ac': 'باز کردن', 'dil': 'زبان', 'eposta': 'ایمیل',
  'cikis': 'خروج', 'cikis_onay': 'از این دستگاه خارج شوید؟',

  'menu': 'منوی اصلی', 'menu.projeler': 'محصولات', 'menu.taslaklar': 'پیش‌نویس‌ها', 'menu.yeni': 'پست نو', 'menu.kayit': 'ثبت', 'menu.daha': 'بیشتر',
  'menu_kisa.paylas': 'اشتراک',

  'kip.yerel_kisa': 'حالت محلی', 'kip.yerel_aciklama': 'سرور نیست: طراحی، نوشتن متن، دانلود و اشتراک کار می‌کند؛ نشر مستقیم و ثبت مشترک خاموش است.',

  'giris.ust': 'FY — آژانس هوش مصنوعی', 'giris.reklam': 'تبلیغات',
  'giris.aciklama': 'پست‌های معرفی محصولات را طراحی کنید، متن بنویسید و در انستاگرام و فیسبوک به اشتراک بگذارید.',
  'giris.not': 'تنها جیمیل‌های مدیر وارد می‌شوند. هیچ کلیدی به این دستگاه نمی‌آید.',
  'giris.gelistirme': 'ورود آزمایشی', 'giris.google_yuklenemedi': 'ورود گوگل بارگذاری نشد. انترنت را بررسی کنید.',
  'giris.yetkisiz': '{eposta} در فهرست مدیران نیست.',

  'hata.kimlik': 'هویت گوگل تأیید نشد. دوباره امتحان کنید.', 'hata.yapilandirma': 'سرور هنوز تنظیم نشده (کلاینت گوگل یا فهرست مدیران نیست).',
  'hata.oran': 'تلاش زیاد؛ کمی بعد دوباره امتحان کنید.', 'hata.ag': 'به سرور دسترسی نیست.', 'hata.sunucu': 'خطای سرور.',

  'projeler.ust': 'محصولات', 'projeler.yeni_ust': 'پست نو', 'projeler.baslik_1': 'کدام محصول را', 'projeler.baslik_vurgu': 'معرفی می‌کنیم؟',
  'projeler.aciklama': 'یک محصول را انتخاب کنید؛ تصویر و متن از امکانات واقعی آن آغاز می‌شود. وعده‌ای که در صفحه نیست نوشته نمی‌شود.',
  'urun.yakinda': 'به‌زودی', 'urun.tasarla': 'طراحی',

  'adim.tasarla': 'طراحی', 'adim.metin': 'متن', 'adim.paylas': 'اشتراک', 'adim.etiket': 'قدم {n} از ۳',

  'tasarla.aciklama': 'قالب، طرح و زبان را انتخاب کنید؛ متن‌ها را ویرایش کنید. پیش‌نمایش زنده است.',
  'tasarla.bicim': 'قالب', 'tasarla.sablon': 'طرح', 'tasarla.dil': 'زبان محتوا',
  'bicim.kare': 'مربع ۱:۱', 'bicim.dikey': 'عمودی ۴:۵', 'bicim.hikaye': 'استوری ۹:۱۶',
  'sablon.baslik': 'عنوان', 'sablon.ozellikler': 'امکانات', 'sablon.akis': 'جریان',
  'tasarla.baslik': 'عنوان', 'tasarla.baslik_ipucu': 'برای تأکید، کلمه را میان *ستاره* بگذارید',
  'tasarla.alt': 'متن زیر', 'tasarla.alt_ipucu': 'یک جمله: محصول چه می‌کند؟',
  'tasarla.ozellikler': 'امکانات', 'tasarla.ozellik_not': 'در طرح‌های امکانات و جریان',
  'tasarla.cagri': 'فراخوان', 'tasarla.cagri_ipucu': 'یک عمل: امتحان کنید: آدرس',
  'tasarla.logo': 'امضای FY', 'tasarla.adres_goster': 'نمایش آدرس',
  'tasarla.devam': 'به متن', 'tasarla.sifirla': 'از محصول بگیر', 'tasarla.sifirla_onay': 'متن‌ها به پیش‌فرض محصول برگردند؟', 'tasarla.sifirlandi': 'متن‌ها بازنشانی شد',
  'tasarla.dil_sifirla': 'زبان عوض شد. متن‌ها به پیش‌فرض زبان نو برگردند؟ (لغو: نوشته‌های شما می‌ماند)',
  'tasarla.onizleme_not': 'پیش‌نمایش کوچک‌شدهٔ اندازهٔ واقعی است؛ JPEG در قدم اشتراک ساخته می‌شود.',

  'metin.baslik': 'متن پست', 'metin.aciklama': 'سه بخش: سطر اول قلاب، بعد ارزشی که واقعاً چیزی بگوید، در آخر یک فراخوان. هشتگ‌ها در پایان.',
  'metin.kanca': 'قلاب', 'metin.kanca_not': 'سطر اول؛ بخشی که پیش از «بیشتر» دیده می‌شود. سوال یا غافلگیری، اما وعدهٔ چیزی را که در محتوا نیست ندهد.',
  'metin.deger': 'ارزش', 'metin.deger_not': '۳ تا ۶ سطر کوتاه؛ خواننده باید چیزی بیاموزد یا بتواند انجام دهد.',
  'metin.cagri': 'فراخوان', 'metin.cagri_not': 'یک عمل: «امتحان کنید: آدرس» یا «کامنت کنید: …».',
  'metin.baglanti': 'لینک (اختیاری)', 'metin.baglanti_not': 'در توضیح انستاگرام لینک کلیک نمی‌شود؛ در فیسبوک می‌شود.',
  'metin.etiketler': 'هشتگ‌ها', 'metin.etiket_hedef': '۴ تا ۵ هشتگ تخصصی', 'metin.etiket_ekle': 'هشتگ بنویسید، Enter', 'metin.etiket_kaldir': 'حذف هشتگ {e}',
  'metin.onizleme': 'در انستاگرام چطور دیده می‌شود', 'metin.daha_fazla': '… بیشتر', 'metin.denetim': 'بررسی',
  'metin.sayac': '{k} / {enCok} حرف · {e} هشتگ · {emoji} ایموجی',
  'metin.devam': 'به اشتراک', 'metin.kopyala': 'کاپی متن', 'metin.kopyalandi': 'متن کاپی شد', 'metin.kopyalanamadi': 'کاپی نشد؛ متن را دستی انتخاب کنید.',
  'metin.sifirla': 'از محصول بگیر', 'metin.sifirla_onay': 'متن به پیش‌فرض محصول برگردد؟',

  'denetim.temiz': 'با صدای برند هم‌خوان؛ در محدودهٔ پلتفرم.',
  'denetim.bos': 'متن خالی است.', 'denetim.uzun': 'توضیح {n} حرف از ۲٬۲۰۰ بیشتر است.', 'denetim.cok_etiket': 'حداکثر ۳۰ هشتگ؛ اکنون {n}.',
  'denetim.kanca_yok': 'قلاب نیست: سطر اول خالی است.', 'denetim.kanca_uzun': 'قلاب {n} حرف است؛ برش «بیشتر» حدود ۱۲۵ است.', 'denetim.kanca_cok_satir': 'قلاب باید یک سطر باشد.',
  'denetim.cok_emoji': '{n} ایموجی؛ صدای برند حداکثر یکی.', 'denetim.bagirma': 'فریاد با حروف بزرگ: {n}', 'denetim.cok_unlem': 'علامت تعجب یا سوال پشت سر هم.',
  'denetim.az_etiket': 'تنها {n} هشتگ؛ هدف ۴ تا ۵ هشتگ تخصصی.', 'denetim.fazla_etiket': '{n} هشتگ؛ ۴ تا ۵ کافی است، شبیه انبار می‌شود.', 'denetim.genel_etiket': 'هشتگ خیلی عمومی: {n}',
  'denetim.ig_baglanti': 'در توضیح انستاگرام لینک کلیک نمی‌شود؛ بگویید «لینک در پروفایل».', 'denetim.deger_kisa': 'بخش ارزش خیلی کوتاه است؛ چیزی نمی‌آموزد.',
  'denetim.cok_etiketleme': 'حداکثر ۲۰ منشن (@)؛ اکنون {n}.', 'denetim.baski': 'الگوی فشار: «{n}». صدای برند عجله نمی‌دهد.',

  'paylas.baslik': 'اشتراک', 'paylas.aciklama': 'تصویر به صورت JPEG آماده است. از تیلفون با منوی اشتراک به انستاگرام بفرستید یا دانلود کنید؛ اگر وصل هستید مستقیم نشر کنید.',
  'paylas.uretiliyor': 'تصویر ساخته می‌شود…', 'paylas.gorsel_alt': 'تصویر پست برای {urun}', 'paylas.gorsel_bilgi': '{w}×{h} JPEG · {kb} KB',
  'paylas.indir': 'دانلود JPEG', 'paylas.indirildi': 'تصویر دانلود شد', 'paylas.paylas': 'اشتراک…', 'paylas.paylasilamadi': 'اشتراک نشد.', 'paylas.paylasim_yok': 'در این دستگاه اشتراک فایل نیست؛ JPEG را دانلود کنید.',
  'paylas.business_suite': 'Business Suite', 'paylas.elle_not': 'راه دستی: تصویر را دانلود یا اشتراک کنید، متن را کاپی کنید؛ Business Suite هم‌زمان در انستاگرام و فیسبوک نشر و زمان‌بندی می‌کند.',
  'paylas.metin': 'متن پست', 'paylas.metin_hatali': 'متن خطا دارد؛ به قدم متن برگردید.', 'paylas.dogrudan': 'نشر مستقیم',
  'paylas.yayin_yerel': 'برای نشر مستقیم Worker لازم است (بیشتر ← اتصال).', 'paylas.kanal_okunamadi': 'وضعیت کانال خوانده نشد.',
  'paylas.yayinla_instagram': 'نشر در انستاگرام', 'paylas.yayinla_facebook': 'نشر در فیسبوک',
  'paylas.yayinla_onay': 'در حساب {kanal} نشر شود؟', 'paylas.yayinlaniyor': 'در حال نشر…', 'paylas.yayinlandi': 'در حساب {kanal} نشر شد',
  'paylas.prova_not': 'تمرین: سرور هیچ ارسال بیرونی نمی‌کند؛ درخواست ثبت می‌شود. برای زنده شدن: Worker PROVA=0.', 'paylas.prova_tamam': 'تمرین تمام: ثبت شد، چیزی بیرون نرفت.',
  'paylas.kota': 'سهمیهٔ API انستاگرام: در ۲۴ ساعت گذشته {k} / {s}',
  'paylas.tekrar_onay': 'همین متن در ۲۴ ساعت گذشته در این کانال نشر شده. باز هم نشر شود؟ (Meta ممکن است تکرار را رد کند)',
  'kanal_ad.instagram': 'انستاگرام', 'kanal_ad.facebook': 'فیسبوک',
  'kanal.calisir': 'کار می‌کند', 'kanal.prova': 'تمرین', 'kanal.kapali': 'وصل نیست', 'kanal.yerel': 'محلی',

  'yayin_hata.yeniden_baglan': 'دسترسی Meta قطع شد؛ توکن صفحه باید نو شود.', 'yayin_hata.izin': 'Meta اجازه نداد (مجوز یا سطح دسترسی).', 'yayin_hata.oran': 'محدودیت سرعت Meta؛ کمی بعد امتحان کنید.',
  'yayin_hata.gorsel': 'Meta تصویر را نگرفت (JPEG، اندازه یا نسبت).', 'yayin_hata.meta': 'خطای Meta.', 'yayin_hata.ag': 'به سرور دسترسی نشد.',
  'yayin_hata.gorsel_yok': 'تصویر به سرور بار نشد.', 'yayin_hata.metin_uzun': 'متن از ۲٬۲۰۰ حرف بیشتر است.', 'yayin_hata.kanal_kapali': 'این کانال در سرور وصل نیست.',
  'yayin_hata.cok_gorsel': 'حداکثر ۱۰ تصویر.', 'yayin_hata.oturum': 'نشست قطع شد؛ دوباره وارد شوید.', 'yayin_hata.gorsel_turu': 'سرور تنها JPEG می‌پذیرد.', 'yayin_hata.gorsel_buyuk': 'تصویر خیلی بزرگ است (حداکثر ۱٫۹ MB).',
  'yayin_hata.kota': 'سهمیهٔ روزانهٔ نشر انستاگرام پر شد؛ فردا دوباره امتحان کنید.', 'yayin_hata.bekle': 'Meta هنوز تصویر را پردازش می‌کند؛ یک دقیقه بعد دوباره امتحان کنید.', 'yayin_hata.tekrar': 'همین متن در ۲۴ ساعت گذشته در این کانال نشر شده (Meta تکرار را رد می‌کند).', 'yayin_hata.kimlik_dogrulama': 'صفحهٔ فیسبوک تأیید هویت می‌خواهد: در برنامهٔ فیسبوک تکمیل کنید.',

  'taslaklar.ust': 'در این دستگاه', 'taslaklar.baslik': 'پیش‌نویس‌ها', 'taslaklar.aciklama': 'پیش‌نویس‌ها در این دستگاه می‌مانند؛ در پشتیبان نمی‌روند.',
  'taslaklar.bos': 'هنوز پیش‌نویسی نیست', 'taslaklar.bos_aciklama': 'با انتخاب یک محصول از «محصولات» پیش‌نویس باز می‌شود.', 'taslaklar.yeni': 'پست نو',
  'taslaklar.ac': 'ویرایش', 'taslaklar.sil_onay': 'پیش‌نویس حذف شود؟',
  'taslak_durum.taslak': 'پیش‌نویس', 'taslak_durum.paylasildi': 'اشتراک شد', 'taslak_durum.yayinlandi': 'نشر شد',

  'kayit.ust': 'کی، چه وقت، چه', 'kayit.baslik': 'ثبت', 'kayit.aciklama': 'پست‌های اشتراک‌شده و نشرشده. هر دو نفر همین فهرست را می‌بینند.',
  'kayit.ortak_not': 'ثبت مشترک (سرور) + این دستگاه.', 'kayit.ortak_okunamadi': 'ثبت مشترک خوانده نشد؛ تنها این دستگاه نشان داده می‌شود.', 'kayit.yerel_not': 'تنها ثبت این دستگاه (حالت محلی).',
  'kayit.bos': 'ثبتی نیست', 'kayit.bos_aciklama': 'اولین پست دانلود، اشتراک یا نشرشده این‌جا دیده می‌شود.',
  'kanal_eylem.instagram': 'در انستاگرام نشر شد', 'kanal_eylem.facebook': 'در فیسبوک نشر شد', 'kanal_eylem.indir': 'JPEG دانلود شد', 'kanal_eylem.paylas': 'با منوی اشتراک', 'kanal_eylem.kopyala': 'متن کاپی شد', 'kanal_eylem.business_suite': 'Business Suite باز شد',
  'kayit_durum.yayinlandi': 'نشر شد', 'kayit_durum.prova': 'تمرین', 'kayit_durum.hata': 'خطا', 'kayit_durum.yapildi': 'انجام شد', 'kayit_durum.gonderiliyor': 'در حال ارسال',

  'daha.ust': 'تنظیمات', 'daha.gorunum': 'ظاهر', 'daha.dil_not': 'زبان برنامه؛ زبان پست در «طراحی» انتخاب می‌شود.', 'daha.tema': 'تم', 'daha.gece': 'شب', 'daha.gunduz': 'روز',
  'daha.baglanti': 'اتصال', 'daha.sunucu': 'سرور', 'daha.ayni_koken': 'همین مبدأ (محلی)', 'daha.google': 'ورود با گوگل', 'daha.ayarli': 'تنظیم شده', 'daha.ayarsiz': 'تنظیم نشده',
  'daha.ig_yolu_ig': 'مسیر Instagram Login (graph.instagram.com)', 'daha.ig_yolu_fb': 'از طریق صفحهٔ فیسبوک (graph.facebook.com)', 'daha.kanal_kapali_not': 'Secret ها نیست: README ← تنظیم Meta', 'daha.sayfa': 'صفحهٔ {id}',
  'daha.gelistirme_uyari': 'حالت توسعه باز است: ورود بدون گوگل وجود دارد. هرگز در نشر.',
  'daha.hesap': 'حساب', 'daha.hesap_yok': 'نشستی نیست (حالت محلی).', 'daha.depolama': 'ذخیره در این دستگاه',
  'daha.baglantilar': 'لینک‌ها', 'daha.suite_not': 'اشتراک و زمان‌بندی دستی در انستاگرام و فیسبوک',
  'daha.hakkinda': 'FY Reklam 0.1 — بدون فریم‌ورک و بدون مرحلهٔ ساخت؛ تصویرها در دستگاه ساخته می‌شوند، کلیدها تنها در سرور می‌مانند.',
  'daha.kurulum': 'راهنمای تنظیم Meta',
  'daha.google_eksik': 'سرور جواب می‌دهد اما کلاینت گوگل (GOOGLE_ISTEMCI) یا REKLAMCILAR نیست: ورود بسته، برنامه در حالت محلی. README ← Yayın.',

  'kurulum.ust': 'سمت Meta', 'kurulum.baslik': 'راهنمای تنظیم',
  'kurulum.aciklama': 'کارهایی که برای نشر مستقیم یک بار در سمت Meta انجام می‌شود. ترتیب مهم است؛ تیک‌ها در این دستگاه می‌مانند.',
  'kurulum.not': 'قاعده‌ها از اسناد Meta اکتبر ۲۰۲۶؛ منابع در README. هیچ توکنی در این برنامه نوشته نمی‌شود؛ تنها GitHub Secrets.',
  'kurulum.ilerleme': '{n} / {t} قدم', 'kurulum.sifirla': 'بازنشانی', 'kurulum.sifirla_onay': 'تیک‌ها پاک شوند؟',
  'kurulum.kopyala': 'کاپی', 'kurulum.kopyalandi': 'کاپی شد',
};

export const SOZLUK = { tr, fa };
