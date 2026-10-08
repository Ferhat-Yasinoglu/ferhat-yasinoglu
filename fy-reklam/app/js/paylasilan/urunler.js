// Ürün kataloğu. SAF modül: tarayıcı, Worker ve testler aynı dosyayı okur.
// Her iddia ilgili deponun README'sinden; sayfada olmayan bir vaat ya da rakam YAZILMAZ
// («yapmadığın işi gösterme»). Yeni ürün: bir kayıt ekle, simge adı simge.js'te olsun.
//
// Alanlar: anahtar · ad · renk (kartta ve görselde) · simge · adres · kaynak (varsa herkese açık kod)
//          yayinda (false → «yakında» etiketi; çağrı metni «yakında» der)
//          kitle: hangi dillerde paylaşılması anlamlı (ilk sıradaki varsayılan)
//          ozet / ozellikler / cagri: tr · de · en · fa (Dari)
//          etiketler: dil başına 4–5 niş etiket (genel #ai #tech yığını yok)

export const DILLER = ['tr', 'de', 'en', 'fa'];
export const RTL_DILLER = new Set(['fa']);

export const URUNLER = [
  {
    anahtar: 'dawayar', ad: 'Dawayar', renk: '#2dd4bf', simge: 'hap', yayinda: true,
    adres: 'https://dawayar.pages.dev/', kitle: ['fa', 'en', 'tr'],
    ozet: {
      tr: 'Afgan eczaneleri için eczane yönetimi: elektrik ve internet gidince kasa satmaya devam eder.',
      de: 'Apothekenverwaltung für afghanische Apotheken: Die Kasse verkauft weiter, wenn Strom und Internet ausfallen.',
      en: 'Pharmacy management for Afghan pharmacies: the till keeps selling when the power and the internet don\'t.',
      fa: 'مدیریت دواخانه برای دواخانه‌های افغانستان: وقتی برق و انترنت برود، فروش متوقف نمی‌شود.',
    },
    ozellikler: {
      tr: ['Parti ve son kullanma tarihine göre stok', 'Barkodlu kasa, alış, müşteri ve tedarikçi borcu', 'Dari, Peştu, İngilizce; sağdan sola; şemsi takvim', 'Kayıtlar önce cihazda; bağlantı gelince cihazlar eşitlenir'],
      de: ['Bestand nach Charge und Verfallsdatum', 'Barcode-Kasse, Einkauf, Kunden- und Lieferantenkredit', 'Dari, Paschtu, Englisch; rechts nach links; Sonnenkalender', 'Daten zuerst auf dem Gerät; Sync, sobald Verbindung da ist'],
      en: ['Stock by batch and expiry date', 'Barcode till, purchases, customer and supplier credit', 'Dari, Pashto, English; right to left; Shamsi calendar', 'Records live on the device first; devices sync when back online'],
      fa: ['موجودی به اساس بسته و تاریخ ختم', 'کاسهٔ بارکودی، خرید، قرض مشتری و تأمین‌کننده', 'دری، پښتو، انگلیسی؛ راست به چپ؛ تقویم شمسی', 'ثبت‌ها اول در دستگاه؛ با آمدن انترنت دستگاه‌ها هماهنگ می‌شوند'],
    },
    cagri: {
      tr: 'Deneyin: dawayar.pages.dev', de: 'Ausprobieren: dawayar.pages.dev', en: 'Try it: dawayar.pages.dev', fa: 'امتحان کنید: dawayar.pages.dev',
    },
    etiketler: {
      tr: ['#eczane', '#afganistan', '#çevrimdışı', '#pwa', '#dawayar'],
      de: ['#apotheke', '#afghanistan', '#offlinefirst', '#webapp', '#dawayar'],
      en: ['#pharmacy', '#afghanistan', '#offlinefirst', '#pwa', '#dawayar'],
      fa: ['#دواخانه', '#افغانستان', '#بدون_انترنت', '#دوایار', '#dawayar'],
    },
  },
  {
    anahtar: 'shafa', ad: 'Shafa', renk: '#818cf8', simge: 'steteskop', yayinda: true,
    adres: 'https://shafa.pages.dev/', kitle: ['fa', 'en'],
    ozet: {
      tr: 'Afganistan\'daki doktorlar için reçete yazma ve hasta kaydı; internet olmadan da çalışır.',
      de: 'Rezeptschreiben und Patientenkartei für Ärzte in Afghanistan; funktioniert auch ohne Internet.',
      en: 'Prescription writing and patient records for doctors in Afghanistan; works without internet.',
      fa: 'نسخه‌نویسی و ثبت مریض برای داکتران افغانستان؛ بدون انترنت هم کار می‌کند.',
    },
    ozellikler: {
      tr: ['Hastayı seç, ilaçları ekle, reçeteyi yazdır ya da gönder', 'Antetli kâğıt, reçete şablonları, alerji uyarısı', 'Hasta bilgisi yalnız cihazda; dosya yedeği', 'Gmail ile giriş, 15 gün ücretsiz deneme'],
      de: ['Patient wählen, Medikamente hinzufügen, Rezept drucken oder senden', 'Briefkopf, Rezeptvorlagen, Allergiewarnung', 'Patientendaten nur auf dem Gerät; Datei-Backup', 'Anmeldung mit Gmail, 15 Tage kostenlos testen'],
      en: ['Pick the patient, add medicines, print or send the prescription', 'Letterhead, prescription templates, allergy warning', 'Patient data stays on the device; file backup', 'Sign in with Gmail, 15-day free trial'],
      fa: ['مریض را انتخاب کنید، دواها را اضافه کنید، نسخه را چاپ یا ارسال کنید', 'سربرگ، قالب‌های نسخه، هشدار حساسیت', 'معلومات مریض تنها در دستگاه؛ پشتیبان فایلی', 'ورود با جیمیل، ۱۵ روز آزمایش رایگان'],
    },
    cagri: { tr: 'Deneyin: shafa.pages.dev', de: 'Ausprobieren: shafa.pages.dev', en: 'Try it: shafa.pages.dev', fa: 'امتحان کنید: shafa.pages.dev' },
    etiketler: {
      tr: ['#doktor', '#reçete', '#afganistan', '#çevrimdışı', '#shafa'],
      de: ['#arzt', '#rezept', '#afghanistan', '#offlinefirst', '#shafa'],
      en: ['#doctors', '#prescription', '#afghanistan', '#offlinefirst', '#shafa'],
      fa: ['#داکتر', '#نسخه', '#افغانستان', '#شفا', '#shafa'],
    },
  },
  {
    anahtar: 'nuskha', ad: 'Nüsha', renk: '#c084fc', simge: 'recete', yayinda: true,
    adres: 'https://nuskha.pages.dev/', kitle: ['fa', 'en'],
    ozet: {
      tr: 'Tek doktor için bilgisayarlı reçete sistemi: A4 reçete, ilaç listesi, hasta kayıtları; tarayıcı, Android ve Windows.',
      de: 'Computer-Rezeptsystem für eine Praxis: A4-Rezept, Medikamentenliste, Patientenakten; Browser, Android und Windows.',
      en: 'Computer prescription system for one doctor: A4 prescription, medicine list, patient records; browser, Android and Windows.',
      fa: 'سامانهٔ نسخه‌نویسی کمپیوتری برای یک داکتر: ورق A4، فهرست دوا، معلومات مریضان؛ مرورگر، اندروید و ویندوز.',
    },
    ozellikler: {
      tr: ['İki dilli antet ve logo ile A4 reçete; her gün 1\'den numara', 'İlaç kaydı: doz, kullanım, form, marka, sık kullanılanlar', 'Yazdırınca reçete kaydedilir; hasta arama ve şemsi tarih süzgeci', 'Veri yalnız cihazda; Android APK ve Windows kurulumu'],
      de: ['A4-Rezept mit zweisprachigem Kopf und Logo; Nummerierung täglich ab 1', 'Medikamentenkartei: Dosis, Einnahme, Form, Marke, Favoriten', 'Drucken speichert das Rezept; Patientensuche, Datumsfilter', 'Daten nur auf dem Gerät; Android-APK und Windows-Installer'],
      en: ['A4 prescription with bilingual header and logo; numbered from 1 each day', 'Medicine registry: dose, timing, form, brand, favourites', 'Printing saves the prescription; patient search and date filter', 'Data stays on the device; Android APK and Windows installer'],
      fa: ['ورق A4 با سرخط دو زبانه و لوگو؛ شماره هر روز از ۱', 'ثبت دوا: دوز، زمان مصرف، فرم، برند، پرکاربردها', 'چاپ، نسخه را ذخیره هم می‌کند؛ جستجوی مریض و فلتر تاریخ شمسی', 'معلومات تنها در دستگاه؛ برنامهٔ اندروید و ویندوز'],
    },
    cagri: { tr: 'Deneyin: nuskha.pages.dev', de: 'Ausprobieren: nuskha.pages.dev', en: 'Try it: nuskha.pages.dev', fa: 'امتحان کنید: nuskha.pages.dev' },
    etiketler: {
      tr: ['#reçete', '#doktor', '#afganistan', '#windows', '#nüsha'],
      de: ['#rezept', '#arztpraxis', '#afghanistan', '#windowsapp', '#nuskha'],
      en: ['#prescription', '#doctors', '#afghanistan', '#windowsapp', '#nuskha'],
      fa: ['#نسخه', '#داکتر', '#افغانستان', '#نسخه_نویسی', '#nuskha'],
    },
  },
  {
    anahtar: 'zamin', ad: 'Zamin', renk: '#4ade80', simge: 'konum', yayinda: true,
    adres: 'https://naqsha-zamin.pages.dev/', kitle: ['fa', 'en'],
    ozet: {
      tr: 'Afganistan için arsa ölçme, bölme, raporlama ve satış uygulaması: uydu haritası, GPS, kenar uzunlukları.',
      de: 'Grundstücke vermessen, teilen, dokumentieren und verkaufen, für Afghanistan: Satellitenkarte, GPS, Seitenlängen.',
      en: 'Land measuring, dividing, reporting and sales for Afghanistan: satellite map, GPS, side lengths.',
      fa: 'اندازه‌گیری، تقسیم، راپور و فروش زمین برای افغانستان: نقشهٔ ستلایت، GPS، طول اضلاع.',
    },
    ozellikler: {
      tr: ['Uydu haritası, GPS, kenar ve köşegenler, plan üzerinde ölçek', 'Emlakçı için bölme: eşit, cepheye, alana ya da hisseye göre', 'A4 rapor, satış ilanı görseli, WhatsApp özeti', 'Jerib, biswa, biswasa, m², hektar; veriler cihazda; Android APK'],
      de: ['Satellitenkarte, GPS, Seiten und Diagonalen, Maßstab auf dem Plan', 'Teilung für Makler: gleich, nach Front, Fläche oder Anteil', 'A4-Bericht, Verkaufsanzeige als Bild, WhatsApp-Zusammenfassung', 'Jerib, Biswa, Biswasa, m², Hektar; Daten auf dem Gerät; Android-APK'],
      en: ['Satellite map, GPS, sides and diagonals, scale on a plan', 'Division for realtors: equal, by frontage, by area or by share', 'A4 report, sale listing image, WhatsApp summary', 'Jerib, biswa, biswasa, m², hectare; data on the device; Android APK'],
      fa: ['نقشهٔ ستلایت، GPS، اضلاع و قطرها، مقیاس روی پلان', 'تقسیم برای رهنمای معاملات: مساوی، به روی جاده، به مساحت یا به حصه', 'راپور A4، اعلان فروش، خلاصهٔ واتساپ', 'جریب، بسوه، بسوسه، متر مربع، هکتار؛ معلومات در دستگاه؛ برنامهٔ اندروید'],
    },
    cagri: { tr: 'Deneyin: naqsha-zamin.pages.dev', de: 'Ausprobieren: naqsha-zamin.pages.dev', en: 'Try it: naqsha-zamin.pages.dev', fa: 'امتحان کنید: naqsha-zamin.pages.dev' },
    etiketler: {
      tr: ['#arsa', '#emlak', '#afganistan', '#ölçüm', '#zamin'],
      de: ['#grundstück', '#immobilien', '#afghanistan', '#vermessung', '#zamin'],
      en: ['#land', '#realestate', '#afghanistan', '#surveying', '#zamin'],
      fa: ['#زمین', '#رهنمای_معاملات', '#افغانستان', '#نقشه', '#zamin'],
    },
  },
  {
    anahtar: 'netstore', ad: 'NetStore', renk: '#a78bfa', simge: 'dukkan', yayinda: true,
    adres: 'https://fy-netstore.pages.dev/', kitle: ['fa', 'en', 'tr'],
    ozet: {
      tr: 'Çevrimdışı çalışmaya devam eden dükkân panosu: iki kişinin Google hesaplarıyla paylaştığı satış ve stok.',
      de: 'Ein Laden-Dashboard, das offline weiterläuft: Verkauf und Bestand, geteilt über zwei Google-Konten.',
      en: 'A shop dashboard that keeps working offline: sales and stock two people share through their Google accounts.',
      fa: 'داشبورد دکان که بدون انترنت هم کار می‌کند: فروش و موجودی، مشترک میان دو نفر با حساب گوگل.',
    },
    ozellikler: {
      tr: ['Kayıtlar Firestore üzerinden eşitlenir', 'Ağ gidince çalışmaya devam eder', 'Tarayıcıdan kurulur', 'Afgani desteklenir, fatura yazdırılır'],
      de: ['Daten werden über Firestore synchronisiert', 'Läuft weiter, wenn das Netz ausfällt', 'Installation direkt aus dem Browser', 'Afghani wird unterstützt, Rechnung druckbar'],
      en: ['Records sync through Firestore', 'Keeps working when the network drops', 'Installs straight from the browser', 'Afghani is supported and the invoice prints'],
      fa: ['ثبت‌ها از طریق Firestore هماهنگ می‌شوند', 'با قطع انترنت کار ادامه دارد', 'از خود مرورگر نصب می‌شود', 'افغانی پشتیبانی می‌شود و بل چاپ می‌شود'],
    },
    cagri: { tr: 'Deneyin: fy-netstore.pages.dev', de: 'Ausprobieren: fy-netstore.pages.dev', en: 'Try it: fy-netstore.pages.dev', fa: 'امتحان کنید: fy-netstore.pages.dev' },
    etiketler: {
      tr: ['#dükkan', '#stok', '#afganistan', '#çevrimdışı', '#netstore'],
      de: ['#laden', '#warenwirtschaft', '#afghanistan', '#offlinefirst', '#netstore'],
      en: ['#shop', '#inventory', '#afghanistan', '#offlinefirst', '#netstore'],
      fa: ['#دکان', '#موجودی', '#افغانستان', '#بدون_انترنت', '#netstore'],
    },
  },
  {
    anahtar: 'minidakhl', ad: 'Mini Dakhl', renk: '#fbbf24', simge: 'nakit', yayinda: false,
    adres: 'https://mini-dakhl.pages.dev/', kitle: ['fa', 'en'],
    ozet: {
      tr: 'Afganistan\'daki işletmeler için çevrimdışı çalışan muhasebe: günlük defter, alacak, mal ve depo, alış-satış, havale, döviz, raporlar.',
      de: 'Offline-Buchhaltung für Betriebe in Afghanistan: Journal, Forderungen, Waren und Lager, Ein- und Verkauf, Hawala, Devisen, Berichte.',
      en: 'Offline accounting for businesses in Afghanistan: journal, receivables, goods and warehouse, buying and selling, hawala, currency exchange, reports.',
      fa: 'حسابداری بدون انترنت برای کسب‌وکارهای افغانستان: روزنامچه، طلب و گرفت، اجناس و گدام، خرید و فروش، حواله، تبادلهٔ اسعار، گزارشات.',
    },
    ozellikler: {
      tr: ['Çift kayıt, ama kullanıcı görmeden: bakiye ve stok belgelerden türetilir', 'Çok para birimi; günlük kurlar; döviz pozisyonu', 'Dari, Peştu, İngilizce; şemsi takvim', 'Kayıtlar önce cihazda; işletmenin öbür cihazlarıyla eşitlenir'],
      de: ['Doppelte Buchführung im Hintergrund: Salden und Bestand aus Belegen', 'Mehrere Währungen; Tageskurse; Devisenposition', 'Dari, Paschtu, Englisch; Sonnenkalender', 'Daten zuerst auf dem Gerät; Sync mit den anderen Geräten des Betriebs'],
      en: ['Double entry, hidden from the user: balances and stock derive from documents', 'Multi-currency; daily rates; currency position', 'Dari, Pashto, English; Shamsi calendar', 'Records live on the device first; sync with the business\'s other devices'],
      fa: ['حساب دوطرفه، اما پنهان از کاربر: بیلانس و موجودی از اسناد', 'چند اسعار؛ نرخ روز؛ موجودی اسعار', 'دری، پښتو، انگلیسی؛ تقویم شمسی', 'ثبت‌ها اول در دستگاه؛ با دستگاه‌های دیگر کسب‌وکار هماهنگ می‌شود'],
    },
    cagri: { tr: 'Yakında: mini-dakhl.pages.dev', de: 'Bald: mini-dakhl.pages.dev', en: 'Coming soon: mini-dakhl.pages.dev', fa: 'به‌زودی: mini-dakhl.pages.dev' },
    etiketler: {
      tr: ['#muhasebe', '#afganistan', '#esnaf', '#çevrimdışı', '#minidakhl'],
      de: ['#buchhaltung', '#afghanistan', '#kleinunternehmen', '#offlinefirst', '#minidakhl'],
      en: ['#accounting', '#afghanistan', '#smallbusiness', '#offlinefirst', '#minidakhl'],
      fa: ['#حسابداری', '#افغانستان', '#دخل', '#بدون_انترنت', '#minidakhl'],
    },
  },
  {
    anahtar: 'sosyal-studyo', ad: 'Sosyal Stüdyo', renk: '#f472b6', simge: 'megafon', yayinda: true,
    adres: 'https://sosyal-studyo.pages.dev/', kitle: ['tr', 'en', 'de'],
    ozet: {
      tr: 'Sosyal medya otomasyon stüdyosu: akışlar, kişiler, toplu mesaj, AI ajan ve içerik araçları; Telegram tam, Instagram kendi hesabında.',
      de: 'Social-Media-Automationsstudio: Flows, Kontakte, Broadcasts, KI-Agent und Content-Werkzeuge; Telegram komplett, Instagram am eigenen Konto.',
      en: 'Social media automation studio: flows, contacts, broadcasts, AI agent and content tools; Telegram fully, Instagram on your own account.',
      fa: 'استودیوی اتوماسیون شبکه‌های اجتماعی: جریان‌ها، مخاطبان، پیام گروهی، ایجنت هوش مصنوعی و ابزار محتوا؛ تلگرام کامل، انستاگرام در حساب خودتان.',
    },
    ozellikler: {
      tr: ['Akış kur, simülatörde dene, kişileri etiketle ve puanla', 'Telegram: webhook, akışlar ve gerçek toplu mesaj', 'Instagram: DM, yorum→DM, yoruma yanıt (kendi profesyonel hesabın)', 'Fikir, senaryo, kanca, karusel ve video araçları; tek tıkla yedek'],
      de: ['Flows bauen, im Simulator testen, Kontakte taggen und bewerten', 'Telegram: Webhook, Flows und echte Broadcasts', 'Instagram: DM, Kommentar→DM, Kommentarantwort (eigenes Business-Konto)', 'Ideen-, Skript-, Hook-, Karussell- und Video-Werkzeuge; Backup mit einem Klick'],
      en: ['Build flows, test in the simulator, tag and score contacts', 'Telegram: webhook, flows and real broadcasts', 'Instagram: DM, comment→DM, comment reply (your own professional account)', 'Idea, script, hook, carousel and video tools; one-click backup'],
      fa: ['جریان بسازید، در شبیه‌ساز امتحان کنید، مخاطبان را برچسب و امتیاز بدهید', 'تلگرام: وب‌هوک، جریان‌ها و پیام گروهی واقعی', 'انستاگرام: پیام، کامنت←پیام، جواب کامنت (حساب حرفه‌ای خودتان)', 'ابزار ایده، سناریو، قلاب، کاروسل و ویدیو؛ پشتیبان با یک کلیک'],
    },
    cagri: { tr: 'Deneyin: sosyal-studyo.pages.dev', de: 'Ausprobieren: sosyal-studyo.pages.dev', en: 'Try it: sosyal-studyo.pages.dev', fa: 'امتحان کنید: sosyal-studyo.pages.dev' },
    etiketler: {
      tr: ['#sosyalmedya', '#otomasyon', '#telegrambot', '#instagramotomasyon', '#sosyalstüdyo'],
      de: ['#socialmedia', '#automatisierung', '#telegrambot', '#instagrammarketing', '#sosyalstudyo'],
      en: ['#socialmedia', '#automation', '#telegrambot', '#instagramautomation', '#sosyalstudyo'],
      fa: ['#شبکه_اجتماعی', '#اتوماسیون', '#تلگرام', '#انستاگرام', '#sosyalstudyo'],
    },
  },
  {
    anahtar: 'acik-defter', ad: 'Açık Defter', renk: '#e8d9a8', simge: 'defter', yayinda: true,
    adres: 'https://ferhat-yasinoglu.github.io/acik-defter/', kaynak: 'https://github.com/Ferhat-Yasinoglu/acik-defter', kitle: ['tr', 'de', 'en', 'fa'],
    ozet: {
      tr: 'Bir BT öğrencisinin açık defteri: masada duran çizgili bir okul defteri gibi tasarlanmış kişisel site ve öğrenme günlüğü.',
      de: 'Das offene Heft eines IT-Studenten: persönliche Seite und Lerntagebuch, gestaltet wie ein liniertes Schulheft auf dem Tisch.',
      en: 'An IT student\'s open notebook: a personal site and learning journal designed like a lined school notebook on a desk.',
      fa: 'دفتر باز یک محصل آی‌تی: سایت شخصی و روزنامهٔ یادگیری، طراحی‌شده مانند یک کتابچهٔ خط‌دار مکتب روی میز.',
    },
    ozellikler: {
      tr: ['Sıfırdan: çerçeve yok, derleme adımı yok, bağımlılık yok', 'Dört dil tek sözlükte; Farsçada bütün düzen sağdan sola', 'Ağ kapalıyken de okunur; JavaScript kapalıyken hiçbir şey gizlenmez', 'Kontrast, dokunma hedefi ve klavye erişimi gerçek tarayıcıda ölçülür'],
      de: ['Von Grund auf: kein Framework, kein Build, keine Abhängigkeit', 'Vier Sprachen in einem Wörterbuch; Persisch komplett rechts nach links', 'Lesbar ohne Netz; ohne JavaScript bleibt nichts verborgen', 'Kontrast, Touch-Ziele und Tastaturzugang im echten Browser gemessen'],
      en: ['From scratch: no framework, no build step, no dependency', 'Four languages share one dictionary; Persian turns the whole layout right-to-left', 'Reads with the network off; nothing hidden when JavaScript is off', 'Contrast, touch targets and keyboard access measured in a real browser'],
      fa: ['از صفر: بدون فریم‌ورک، بدون مرحلهٔ ساخت، بدون وابستگی', 'چهار زبان در یک فرهنگ؛ در فارسی تمام چیدمان راست به چپ', 'بدون انترنت خوانده می‌شود؛ با جاوااسکریپت خاموش چیزی پنهان نمی‌شود', 'کنتراست، هدف لمسی و دسترسی کیبورد در مرورگر واقعی اندازه‌گیری می‌شود'],
    },
    cagri: { tr: 'Oku: ferhat-yasinoglu.github.io/acik-defter', de: 'Lesen: ferhat-yasinoglu.github.io/acik-defter', en: 'Read: ferhat-yasinoglu.github.io/acik-defter', fa: 'بخوانید: ferhat-yasinoglu.github.io/acik-defter' },
    etiketler: {
      tr: ['#webgeliştirme', '#vanillajs', '#pwa', '#erişilebilirlik', '#açıkdefter'],
      de: ['#webentwicklung', '#vanillajs', '#pwa', '#barrierefreiheit', '#acikdefter'],
      en: ['#webdev', '#vanillajs', '#pwa', '#a11y', '#acikdefter'],
      fa: ['#برنامه_نویسی_وب', '#جاوااسکریپت', '#pwa', '#دسترسی_پذیری', '#acikdefter'],
    },
  },
  {
    anahtar: 'botflow-mcp', ad: 'botflow-mcp', renk: '#60a5fa', simge: 'bot', yayinda: true,
    adres: 'https://github.com/Ferhat-Yasinoglu/ferhat-yasinoglu/tree/main/botflow-mcp', kaynak: 'https://github.com/Ferhat-Yasinoglu/ferhat-yasinoglu/tree/main/botflow-mcp', kitle: ['en', 'tr', 'de'],
    ozet: {
      tr: 'Telegram chatbot hunileri, panoya tıklamak yerine bir modelle konuşarak kurulur: MCP konuşur, uzun polling ile herkese açık adres gerekmez.',
      de: 'Telegram-Chatbot-Funnels, gebaut im Gespräch mit einem Modell statt per Dashboard: spricht MCP, Long Polling, keine öffentliche URL nötig.',
      en: 'Telegram chatbot funnels, built by talking to a model instead of clicking a dashboard: speaks MCP, long polling, no public URL needed.',
      fa: 'قیف‌های چت‌بات تلگرام که با گفتگو با یک مدل ساخته می‌شوند، نه با کلیک در داشبورد: MCP، پولینگ طولانی، بدون آدرس عمومی.',
    },
    ozellikler: {
      tr: ['Mesaj, soru, buton dallanması, gecikme, etiket, goto adımları', 'Cevaplar değişken olur: {{ad}}', 'Toplu gönderim arka planda, hız sınırlı, kesilince kaldığı yerden', 'SQLite; dış servis yok; 209 test, ağ gerekmez'],
      de: ['Schritte: Nachricht, Frage, Button-Verzweigung, Verzögerung, Tag, goto', 'Antworten werden Variablen: {{name}}', 'Broadcasts im Hintergrund, ratenbegrenzt, wiederaufnehmbar', 'SQLite; kein externer Dienst; 209 Tests ohne Netz'],
      en: ['Steps: message, question, button branching, delay, tag, goto', 'Answers become variables: {{name}}', 'Broadcasts run in the background, rate-limited, resumable', 'SQLite; no external service; 209 tests, no network needed'],
      fa: ['قدم‌ها: پیام، سوال، شاخه با دکمه، تأخیر، برچسب، goto', 'جواب‌ها متغیر می‌شوند: {{name}}', 'ارسال گروهی در پس‌زمینه، با محدودیت سرعت، قابل ادامه', 'SQLite؛ بدون سرویس خارجی؛ ۲۰۹ تست بدون انترنت'],
    },
    cagri: { tr: 'Kaynak: github.com/Ferhat-Yasinoglu', de: 'Quellcode: github.com/Ferhat-Yasinoglu', en: 'Source: github.com/Ferhat-Yasinoglu', fa: 'کد منبع: github.com/Ferhat-Yasinoglu' },
    etiketler: {
      tr: ['#telegrambot', '#mcp', '#typescript', '#chatbot', '#botflow'],
      de: ['#telegrambot', '#mcp', '#typescript', '#chatbot', '#botflow'],
      en: ['#telegrambot', '#mcp', '#typescript', '#chatbot', '#botflow'],
      fa: ['#تلگرام', '#چت_بات', '#mcp', '#typescript', '#botflow'],
    },
  },
  {
    anahtar: 'fy-ajans', ad: 'FY · Yapay Zekâ Yolculuğu', renk: '#c0f244', simge: 'kivilcim', yayinda: true,
    adres: 'https://fy-ajans.pages.dev/', kitle: ['tr', 'de', 'en', 'fa'],
    ozet: {
      tr: 'Mutlak sıfırdan para kazandıran beceriye giden yedi bölümlük yapay zekâ kursu; şimdilik ücretsiz, dört dilde.',
      de: 'Ein KI-Kurs in sieben Kapiteln, von absolut null bis zur Fähigkeit, Geld zu verdienen; vorerst kostenlos, in vier Sprachen.',
      en: 'A seven-chapter AI course from absolute zero to a skill that earns money; free for now, in four languages.',
      fa: 'دورهٔ هفت‌فصلی هوش مصنوعی از صفر مطلق تا مهارتی که درآمد می‌آورد؛ فعلاً رایگان، به چهار زبان.',
    },
    ozellikler: {
      tr: ['7 bölüm, her bölümde gerçek bir proje', 'Prompt yazımı, n8n otomasyon, Claude Code, site ve CRM kurma, video ve pazarlama', 'Tam metin sitede açık: kayıt ya da şifre yok', 'Türkçe, Almanca, İngilizce, Farsça'],
      de: ['7 Kapitel, in jedem ein echtes Projekt', 'Prompting, n8n-Automation, Claude Code, Website und CRM, Video und Marketing', 'Volltext offen auf der Seite: keine Anmeldung, kein Passwort', 'Türkisch, Deutsch, Englisch, Persisch'],
      en: ['7 chapters, a real project in each', 'Prompting, n8n automation, Claude Code, building a site and CRM, video and marketing', 'Full text open on the site: no sign-up, no password', 'Turkish, German, English, Persian'],
      fa: ['۷ فصل، در هر فصل یک پروژهٔ واقعی', 'پرامپت‌نویسی، اتوماسیون n8n، Claude Code، ساخت سایت و CRM، ویدیو و بازاریابی', 'متن کامل در سایت باز است: بدون ثبت‌نام، بدون رمز', 'ترکی، آلمانی، انگلیسی، فارسی'],
    },
    cagri: { tr: 'Bölüm 1 profildeki bağlantıda', de: 'Kapitel 1 über den Link im Profil', en: 'Chapter 1 is in the link in bio', fa: 'فصل ۱ در لینک پروفایل' },
    etiketler: {
      tr: ['#yapayzeka', '#claude', '#yapayzekaöğren', '#dijitalgirişimci', '#fyajans'],
      de: ['#künstlicheintelligenz', '#claude', '#kilernen', '#digitalesbusiness', '#fyajans'],
      en: ['#learnai', '#claude', '#promptengineering', '#digitalbusiness', '#fyajans'],
      fa: ['#هوش_مصنوعی', '#claude', '#یادگیری_هوش_مصنوعی', '#کسب_و_کار_دیجیتال', '#fyajans'],
    },
  },
];

export const urunBul = (anahtar) => URUNLER.find((u) => u.anahtar === anahtar) || null;

/** Ürünün metnini istenen dilde; yoksa İngilizce, o da yoksa Türkçe. */
export function metin(urun, alan, dil) {
  const kaynak = urun?.[alan];
  if (!kaynak) return '';
  return kaynak[dil] ?? kaynak.en ?? kaynak.tr ?? '';
}
