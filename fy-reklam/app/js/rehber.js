// Meta kurulum rehberi: Daha → Kurulum ekranının içeriği. Onay kutuları bu cihazda saklanır (localStorage).
// Metinler arayüz sözlüğünde değil burada: uzun, adım adım içerik; TR ve Dari.
// Kaynak: plan iş akışının doğrulama turu (Ekim 2026, Meta belgeleri) — her kural README'de kaynaklı.
// Hiçbir token ya da kimlik buraya yazılmaz; yalnız nereye yazılacağı anlatılır.

export const BOLUMLER = [
  {
    id: 'hesaplar',
    baslik: { tr: 'Hesaplar', fa: 'حساب‌ها' },
    adimlar: [
      { id: 'ig-pro', b: { tr: 'Instagram hesabını profesyonele çevir ve herkese açık yap', fa: 'حساب انستاگرام را حرفه‌ای و عمومی کنید' },
        a: { tr: 'Instagram → Ayarlar → Hesap türü → İşletme ya da İçerik üreticisi. Hesap gizliyse API hiç çalışmaz. Kullanıcı adın ve gönderilerin değişmez.', fa: 'انستاگرام ← تنظیمات ← نوع حساب ← تجاری یا سازنده. اگر حساب خصوصی باشد API کار نمی‌کند. نام کاربری و پست‌ها تغییر نمی‌کند.' } },
      { id: 'fb-sayfa', b: { tr: 'Bir Facebook Sayfası olsun ve Instagram ona bağlansın', fa: 'یک صفحهٔ فیسبوک باشد و انستاگرام به آن وصل شود' },
        a: { tr: 'API ile yalnız bir Sayfaya gönderi atılır; kişisel profile atılmaz. «FY» adıyla Sayfa aç (yoksa), Instagram hesabını bu Sayfaya bağla; ikisi aynı işletme portföyünde olsun (Business Suite için de şart).', fa: 'با API تنها به صفحه پست می‌رود، نه به پروفایل شخصی. صفحه‌ای به نام «FY» بسازید (اگر نیست)، انستاگرام را به آن وصل کنید؛ هر دو در یک پورتفولیوی تجاری باشند.' },
        link: 'https://business.facebook.com/' },
      { id: 'fb-2fa', b: { tr: 'Sayfada kimlik doğrulama ve iki aşamalı doğrulama', fa: 'تأیید هویت و تأیید دو مرحله‌ای در صفحه' },
        a: { tr: 'Facebook «kimliğini doğrula» (Page Publishing Authorization) istiyorsa tamamlanmadan API gönderisi 400 ile düşer. Hesabında 2FA açık olsun.', fa: 'اگر فیسبوک «تأیید هویت» بخواهد، تا تکمیل نشود پست API با خطای ۴۰۰ می‌افتد. تأیید دو مرحله‌ای را روشن کنید.' } },
    ],
  },
  {
    id: 'uygulama',
    baslik: { tr: 'Meta uygulaması', fa: 'برنامهٔ Meta' },
    adimlar: [
      { id: 'app', b: { tr: 'developers.facebook.com → Uygulama oluştur (Business türü)', fa: 'developers.facebook.com ← ساخت برنامه (نوع Business)' },
        a: { tr: 'Meta Developer hesabı senin adına. Uygulama türü Business; ürün olarak «Facebook Login for Business» eklenir. Instagram ve Facebook Sayfası birlikte isteniyorsa tek yol bu (bir uygulama ya Facebook Login ya Instagram Login kullanır, ikisini birden değil).', fa: 'حساب Meta Developer به نام شما. نوع برنامه Business؛ محصول «Facebook Login for Business» اضافه می‌شود. برای انستاگرام و صفحهٔ فیسبوک با هم تنها همین راه است.' },
        link: 'https://developers.facebook.com/apps/' },
      { id: 'izinler', b: { tr: 'İzinler', fa: 'مجوزها' },
        a: { tr: 'Standard Access yeter; App Review ve Business Verification yalnız başkalarının hesapları için gerekir. İstenen izinler:', fa: 'Standard Access کافی است؛ App Review و Business Verification تنها برای حساب‌های دیگران لازم است. مجوزهای لازم:' },
        kod: 'pages_show_list\npages_read_engagement\npages_manage_posts\ninstagram_basic\ninstagram_content_publish' },
      { id: 'roller', b: { tr: 'Roller: sen Administrator, arkadaşın Tester', fa: 'نقش‌ها: شما Administrator، دوست‌تان Tester' },
        a: { tr: 'Uygulama rolleri → Tester davetini normal Facebook hesabına gönder (developer hesabı gerekmez). Meta, Tester\'ın çalışan ya da anlaşmalı kişi olmasını şart koşar: bir paragraflık yazılı anlaşma yeter. Arkadaşın FY Reklam\'a Google ile girer; Meta\'da OAuth yapmaz — Worker senin bağlantınla gönderir, kayıtta onun adı yazar.', fa: 'نقش‌های برنامه ← دعوت Tester به حساب فیسبوک عادی. Meta شرط می‌کند Tester کارمند یا طرف قرارداد باشد: یک پاراگراف توافق کتبی کافی است. دوست‌تان با گوگل وارد FY Reklam می‌شود؛ در Meta OAuth نمی‌کند.' } },
      { id: 'live', b: { tr: 'Temel ayarlar ve Live', fa: 'تنظیمات پایه و Live' },
        a: { tr: 'Development modunda Sayfaya API ile atılan gönderiler yalnız rol sahiplerine görünür. Live için App Review değil Basic Settings gerekir: gizlilik politikası URL\'si, hizmet şartları URL\'si, simge, kategori, iletişim e-postası. İlk gönderiyi çıkış yapılmış bir tarayıcıdan kontrol et.', fa: 'در حالت Development پست‌های API در صفحه تنها برای دارندگان نقش دیده می‌شود. برای Live نه App Review بلکه Basic Settings لازم است: آدرس سیاست حریم خصوصی، شرایط خدمات، آیکون، دسته، ایمیل تماس. پست اول را از مرورگرِ خارج‌شده بررسی کنید.' } },
    ],
  },
  {
    id: 'tokenlar',
    baslik: { tr: 'Token\'lar ve secret\'lar', fa: 'توکن‌ها و Secret ها' },
    adimlar: [
      { id: 'token', b: { tr: 'Graph API Explorer ile Sayfa token\'ı al', fa: 'توکن صفحه را از Graph API Explorer بگیرید' },
        a: { tr: 'Kullanıcı token\'ı → uzun ömürlü (yaklaşık 60 gün; ayda bir yenilenmezse Sayfa token\'ı yeniden türetilemez) → /me/accounts ile Sayfa token\'ı (süresiz; şifre değişince, uygulama kaldırılınca ya da Sayfa rolü düşünce ölür → hata 190) ve instagram_business_account kimliği. Token\'ı hiçbir dosyaya, mesaja ya da tarayıcıya yazma.', fa: 'توکن کاربر ← طولانی‌مدت (حدود ۶۰ روز) ← با /me/accounts توکن صفحه (بی‌مدت؛ با تغییر رمز، حذف برنامه یا از دست رفتن نقش می‌میرد ← خطای ۱۹۰) و شناسهٔ instagram_business_account. توکن را هیچ‌جا ننویسید.' },
        link: 'https://developers.facebook.com/tools/explorer/',
        kod: 'GET /oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=KISA_TOKEN\nGET /me/accounts?fields=id,name,access_token,tasks,instagram_business_account' },
      { id: 'secret', b: { tr: 'GitHub Secrets → Cloudflare', fa: 'GitHub Secrets ← Cloudflare' },
        a: { tr: 'Depo → Settings → Secrets and variables → Actions. Secret\'lar: REKLAMCILAR (iki Gmail, virgülle), META_SAYFA_TOKEN, META_SAYFA_ID, META_IG_ID, META_APP_SECRET; isteğe bağlı META_KULLANICI_TOKEN. Variables: GOOGLE_ISTEMCI, PROVA (1 = prova). İş akışı bunları wrangler secret put ile Cloudflare\'e taşır; hiçbiri koda girmez.', fa: 'مخزن ← Settings ← Secrets and variables ← Actions. Secret ها: REKLAMCILAR، META_SAYFA_TOKEN، META_SAYFA_ID، META_IG_ID، META_APP_SECRET؛ اختیاری META_KULLANICI_TOKEN. Variables: GOOGLE_ISTEMCI، PROVA.' } },
    ],
  },
  {
    id: 'kanit',
    baslik: { tr: 'Kanıt ve canlıya alma', fa: 'اثبات و زنده کردن' },
    adimlar: [
      { id: 'curl', b: { tr: 'Bilgisayardan tek görselle kanıt', fa: 'اثبات با یک تصویر از کمپیوتر' },
        a: { tr: 'Herkese açık bir JPEG adresiyle: kap oluştur → durum FINISHED → yayınla; Facebook için /photos. Çıkış yapılmış tarayıcıdan gönderiyi gör, sonra ikisini de sil. Gerçek hata kodlarını ve kota yanıtını README\'ye tarihle yaz.', fa: 'با یک آدرس JPEG عمومی: ظرف بسازید ← وضعیت FINISHED ← نشر؛ برای فیسبوک /photos. پست را از مرورگر خارج‌شده ببینید، بعد هر دو را حذف کنید.' },
        kod: 'curl -X POST "https://graph.facebook.com/v26.0/IG_ID/media" -H "Authorization: Bearer TOKEN" -d image_url=https://.../g/ID.jpg -d caption=deneme\ncurl "https://graph.facebook.com/v26.0/KAP_ID?fields=status_code" -H "Authorization: Bearer TOKEN"\ncurl -X POST "https://graph.facebook.com/v26.0/IG_ID/media_publish" -H "Authorization: Bearer TOKEN" -d creation_id=KAP_ID\ncurl -X POST "https://graph.facebook.com/v26.0/SAYFA_ID/photos" -H "Authorization: Bearer SAYFA_TOKEN" -d url=https://.../g/ID.jpg -d caption=deneme' },
      { id: 'robots', b: { tr: 'Worker görseli Meta\'ya veriyor mu', fa: 'آیا Worker تصویر را به Meta می‌دهد' },
        a: { tr: 'Meta görseli facebookexternalhit ile çeker. Worker /robots.txt ile buna izin verir ve /g/… adresini image/jpeg olarak, yönlendirmesiz sunar. Yayın öncesi duman testi:', fa: 'Meta تصویر را با facebookexternalhit می‌گیرد. Worker با /robots.txt اجازه می‌دهد و /g/… را به صورت image/jpeg می‌دهد. تست دود:' },
        kod: 'curl -sI -A facebookexternalhit/1.1 https://fy-reklam-sunucu.ferhatyasinoglu.workers.dev/g/ID.jpg\ncurl -s https://fy-reklam-sunucu.ferhatyasinoglu.workers.dev/robots.txt' },
      { id: 'canli', b: { tr: 'Provadan canlıya', fa: 'از تمرین به زنده' },
        a: { tr: 'Worker PROVA=1 ile gelir: hiçbir dış gönderim yapılmaz, istek kayda düşer. Canlı: GitHub Variable PROVA=0 → iş akışını yeniden çalıştır. İlk canlı gönderiyi küçük tut ve çıkış yapılmış tarayıcıdan kontrol et.', fa: 'Worker با PROVA=1 می‌آید: هیچ ارسال بیرونی نمی‌شود. زنده: GitHub Variable PROVA=0 ← اجرای دوبارهٔ workflow. اولین پست زنده را کوچک نگه دارید.' } },
    ],
  },
];

export const TUM_ADIMLAR = BOLUMLER.flatMap((b) => b.adimlar);
