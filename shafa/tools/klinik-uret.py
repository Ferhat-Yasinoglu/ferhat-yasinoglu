# -*- coding: utf-8 -*-
"""Shafa klinik seçim listeleri: belirti, tanı, laboratuvar (app/veri/klinik.json).

Liste ad sözlüğüdür. Tedavi, ilaç, doz YOK — o karar hekimin.

  python3 tools/klinik-uret.py                      # depodaki nuskha kopyasıyla üretir
  python3 tools/klinik-uret.py --nuskha <clinical.json> [--kaynak-yaz]

İki kat: (1) Shafa'nın kendi tabloları (T, B, L) 2. sürümü kuruyor; (2) 3.
sürüm her kayda İngilizce adı (`en`, kâğıda basılan), arama eş anlamlılarını
(`es`) ve nuskha'nın belirti/tetkik/tanı adlarını ekliyor, iki ICD kodunu
düzeltiyor, `secenekler` yazım kısayollarını koyuyor. Kaynak varsayılan olarak
depodaki kopyadır (tools/kaynak/nuskha-klinik.json): üretim öbür depo olmadan
da tekrarlanabilsin. `--kaynak-yaz` verilen nuskha dosyasından yalnız ad
listelerini o kopyanın yerine yazar.

Eskiden çıktı sabit bir mutlak yola (…/eczane/app/veri/klinik.json) yazılıyordu;
depo taşınınca araç çalışmaz oldu. Yollar artık bu dosyaya göre.
"""
import json, io, os, collections, argparse

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CIKTI = os.path.join(KOK, 'app', 'veri', 'klinik.json')
KAYNAK = os.path.join(KOK, 'tools', 'kaynak', 'nuskha-klinik.json')

arg = argparse.ArgumentParser()
arg.add_argument('--nuskha', help='nuskha data/clinical.json (verilmezse depodaki kopya)')
arg.add_argument('--kaynak-yaz', action='store_true', help='--nuskha dosyasının ad listelerini depodaki kopyaya yaz')
secim = arg.parse_args()

# ============================================================ 2. sürüm (Shafa'nın kendi tabloları)
GRUPLAR = [
 ("umumi", "عمومی", "Genel"),
 ("sinir", "سر و اعصاب", "Baş ve sinir"),
 ("ravani", "روانی", "Ruhsal"),
 ("dandan", "دهان و دندان", "Ağız ve diş"),
 ("gulu", "چشم، گوش، بینی، گلو", "Göz, kulak, burun, boğaz"),
 ("tanaffus", "تنفسی", "Solunum"),
 ("qalb", "قلب و عروق", "Kalp ve damar"),
 ("khun_g", "خون", "Kan"),
 ("guwarish", "گوارشی", "Sindirim"),
 ("idrar", "ادراری و تناسلی", "İdrar ve üreme"),
 ("jildi", "جلدی", "Deri"),
 ("ustukhan", "عضلات و استخوان", "Kas ve kemik"),
 ("ghudad", "غدد و متابولیزم", "Hormon ve metabolizma"),
 ("ufunat", "عفونی", "Enfeksiyon"),
 ("zanan", "زنان و حاملگی", "Kadın ve gebelik"),
 ("atfal", "اطفال", "Çocuk"),
 ("hadisa", "حادثه و مسمومیت", "Kaza ve zehirlenme"),
]

# (ad_dari, turkce, icd10, grup, sik)
T = [
 # ---------------- عمومی
 ("تب", "Ateş", "R50.9", "umumi", 1),
 ("تب با منشای نامعلوم", "Nedeni bilinmeyen ateş", "R50.8", "umumi", 0),
 ("ضعف و بی‌حالی", "Halsizlik", "R53", "umumi", 0),
 ("بی‌اشتهایی", "İştahsızlık", "R63.0", "umumi", 0),
 ("کاهش وزن بدون دلیل", "Nedensiz kilo kaybı", "R63.4", "umumi", 0),
 ("تعریق شبانه", "Gece terlemesi", "R61", "umumi", 0),
 ("ورم (ادیم)", "Ödem", "R60.9", "umumi", 0),
 ("معاینه عمومی", "Genel muayene", "Z00.0", "umumi", 0),
 ("کم‌آبی بدن", "Dehidratasyon", "E86", "umumi", 0),
 ("سوء تغذیه", "Beslenme yetersizliği", "E46", "umumi", 0),

 # ---------------- سر و اعصاب
 ("سردردی", "Baş ağrısı", "R51", "sinir", 1),
 ("سردردی تنشی", "Gerilim tipi baş ağrısı", "G44.2", "sinir", 0),
 ("میگرن", "Migren", "G43.9", "sinir", 0),
 ("سرگیچی", "Baş dönmesi", "R42", "sinir", 1),
 ("ورتیگوی محیطی", "Periferik vertigo", "H81.3", "sinir", 0),
 ("بی‌خوابی", "Uykusuzluk", "G47.0", "sinir", 0),
 ("غش (بی‌هوشی گذرا)", "Bayılma", "R55", "sinir", 0),
 ("لرزش دست", "El titremesi", "R25.1", "sinir", 0),
 ("فلج صورت", "Yüz felci", "G51.0", "sinir", 0),
 ("صرع", "Sara", "G40.9", "sinir", 0),
 ("تشنج تب‌دار اطفال", "Ateşli havale", "R56.0", "sinir", 0),
 ("درد عصب سیاتیک", "Siyatik", "M54.3", "sinir", 0),
 ("سکته مغزی", "İnme", "I64", "sinir", 0),
 ("حمله گذرای مغزی (TIA)", "Geçici iskemik atak", "G45.9", "sinir", 0),
 ("نوروپاتی محیطی", "Periferik nöropati", "G62.9", "sinir", 0),
 ("سندروم تونل کارپال", "Karpal tünel sendromu", "G56.0", "sinir", 0),
 ("التهاب پرده مغز (مننژیت)", "Menenjit", "G03.9", "sinir", 0),
 ("پارکینسون", "Parkinson", "G20", "sinir", 0),

 # ---------------- روانی
 ("اضطراب", "Kaygı bozukluğu", "F41.9", "ravani", 0),
 ("افسردگی", "Depresyon", "F32.9", "ravani", 0),
 ("استرس", "Stres tepkisi", "F43.9", "ravani", 0),
 ("حمله هراس (پانیک)", "Panik atak", "F41.0", "ravani", 0),
 ("اختلال جسمانی‌سازی", "Somatizasyon", "F45.0", "ravani", 0),
 ("وابستگی به مواد", "Madde bağımlılığı", "F19.2", "ravani", 0),
 ("اختلال خواب", "Uyku bozukluğu", "F51.0", "ravani", 0),

 # ---------------- دهان و دندان
 ("دندان‌دردی", "Diş ağrısı", "K08.8", "dandan", 1),
 ("پوسیدگی دندان", "Diş çürüğü", "K02.9", "dandan", 0),
 ("التهاب لثه", "Diş eti iltihabı", "K05.1", "dandan", 0),
 ("آبسه دندان", "Diş apsesi", "K04.7", "dandan", 0),
 ("زخم دهان (آفت)", "Aft", "K12.0", "dandan", 0),
 ("برفک دهان (کاندیدا)", "Pamukçuk", "B37.0", "dandan", 0),
 ("خشکی دهان", "Ağız kuruluğu", "R68.2", "dandan", 0),

 # ---------------- چشم، گوش، بینی، گلو
 ("گلودردی", "Boğaz ağrısı", "J02.9", "gulu", 1),
 ("التهاب حلق چرکی", "Streptokok farenjiti", "J02.0", "gulu", 0),
 ("التهاب لوزه", "Bademcik iltihabı", "J03.9", "gulu", 0),
 ("گوش‌دردی", "Kulak ağrısı", "H92.0", "gulu", 1),
 ("التهاب گوش میانی", "Orta kulak iltihabı", "H66.9", "gulu", 0),
 ("التهاب گوش خارجی", "Dış kulak iltihabı", "H60.9", "gulu", 0),
 ("جرم گوش", "Kulak kiri tıkacı", "H61.2", "gulu", 0),
 ("سینوزیت", "Sinüzit", "J01.9", "gulu", 0),
 ("رینیت الرژیک", "Alerjik nezle", "J30.4", "gulu", 0),
 ("گرفتگی بینی", "Burun tıkanıklığı", "J34.8", "gulu", 0),
 ("خون‌ریزی بینی", "Burun kanaması", "R04.0", "gulu", 0),
 ("انحراف تیغه بینی", "Septum deviasyonu", "J34.2", "gulu", 0),
 ("التهاب ملتحمه چشم", "Konjonktivit", "H10.9", "gulu", 1),
 ("گل‌مژه", "Arpacık", "H00.0", "gulu", 0),
 ("خشکی چشم", "Göz kuruluğu", "H04.1", "gulu", 0),
 ("آب مروارید", "Katarakt", "H25.9", "gulu", 0),
 ("گلوکوم (آب سیاه)", "Glokom", "H40.9", "gulu", 0),
 ("کاهش بینایی", "Görme azalması", "H54.7", "gulu", 0),
 ("کاهش شنوایی", "İşitme kaybı", "H91.9", "gulu", 0),
 ("زنگ زدن گوش", "Kulak çınlaması", "H93.1", "gulu", 0),

 # ---------------- تنفسی
 ("زکام (سرماخوردگی)", "Nezle", "J00", "tanaffus", 1),
 ("سرفه", "Öksürük", "R05", "tanaffus", 1),
 ("انفلونزا", "Grip", "J11.1", "tanaffus", 0),
 ("عفونت مجرای تنفسی فوقانی", "Üst solunum yolu enfeksiyonu", "J06.9", "tanaffus", 1),
 ("عفونت مجرای تنفسی تحتانی", "Alt solunum yolu enfeksiyonu", "J22", "tanaffus", 1),
 ("برونشیت حاد", "Akut bronşit", "J20.9", "tanaffus", 0),
 ("برونشیت مزمن", "Kronik bronşit", "J42", "tanaffus", 0),
 ("برونشیولیت", "Bronşiyolit", "J21.9", "tanaffus", 0),
 ("ذات‌الریه (نمونیا)", "Zatürre", "J18.9", "tanaffus", 1),
 ("آسم", "Astım", "J45.9", "tanaffus", 0),
 ("مرض انسدادی مزمن ریه (COPD)", "KOAH", "J44.9", "tanaffus", 0),
 ("خروسک (کروپ)", "Krup", "J05.0", "tanaffus", 0),
 ("سیاه‌سرفه", "Boğmaca", "A37.9", "tanaffus", 0),
 ("تجمع مایع در پرده ریه", "Plevral efüzyon", "J90", "tanaffus", 0),
 ("تنگی نفس", "Nefes darlığı", "R06.0", "tanaffus", 0),
 ("التهاب حنجره", "Larenjit", "J04.0", "tanaffus", 0),

 # ---------------- قلب و عروق
 ("فشار خون بلند", "Yüksek tansiyon", "I10", "qalb", 1),
 ("فشار خون پایین", "Düşük tansiyon", "I95.9", "qalb", 0),
 ("درد سینه", "Göğüs ağrısı", "R07.4", "qalb", 0),
 ("آنژین صدری", "Anjina", "I20.9", "qalb", 0),
 ("سکته قلبی", "Kalp krizi", "I21.9", "qalb", 0),
 ("تنگی شریان قلب", "Koroner arter hastalığı", "I25.1", "qalb", 0),
 ("نارسایی قلب", "Kalp yetmezliği", "I50.9", "qalb", 0),
 ("تپش قلب", "Çarpıntı", "R00.2", "qalb", 0),
 ("بی‌نظمی ضربان (فیبریلاسیون)", "Atriyal fibrilasyon", "I48.9", "qalb", 0),
 ("مرض دریچه قلب (روماتیزمی)", "Romatizmal kalp kapağı", "I09.9", "qalb", 0),
 ("واریس", "Varis", "I83.9", "qalb", 0),
 ("ترومبوز ورید عمقی", "Derin ven trombozu", "I80.2", "qalb", 0),

 # ---------------- خون
 ("کم‌خونی", "Kansızlık", "D64.9", "khun_g", 1),
 ("کم‌خونی فقر آهن", "Demir eksikliği anemisi", "D50.9", "khun_g", 1),
 ("کم‌خونی کمبود ویتامین B12", "B12 eksikliği anemisi", "D51.9", "khun_g", 0),
 ("تالاسمی", "Talasemi", "D56.9", "khun_g", 0),
 ("کمبود پلاکت", "Trombositopeni", "D69.6", "khun_g", 0),
 ("افزایش گلبول سفید", "Lökositoz", "D72.8", "khun_g", 0),
 ("بزرگی غدد لنفاوی", "Lenf bezi büyümesi", "R59.1", "khun_g", 0),

 # ---------------- گوارشی
 ("دل‌دردی (درد شکم)", "Karın ağrısı", "R10.4", "guwarish", 1),
 ("سوزش معده (گاستریت)", "Gastrit", "K29.7", "guwarish", 1),
 ("ریفلاکس معده", "Reflü", "K21.9", "guwarish", 0),
 ("زخم معده", "Mide ülseri", "K25.9", "guwarish", 0),
 ("زخم اثنی‌عشر", "Duodenum ülseri", "K26.9", "guwarish", 0),
 ("عفونت هلیکوباکتر پیلوری", "H. pylori enfeksiyonu", "K29.0", "guwarish", 0),
 ("اسهال", "İshal", "A09", "guwarish", 1),
 ("گاستروانتریت حاد", "Akut gastroenterit", "K52.9", "guwarish", 0),
 ("اسهال خونی (شیگلا)", "Kanlı ishal", "A03.9", "guwarish", 0),
 ("کولرا", "Kolera", "A00.9", "guwarish", 0),
 ("امیبیازیس", "Amipli dizanteri", "A06.0", "guwarish", 0),
 ("ژیاردیا", "Giardiyaz", "A07.1", "guwarish", 0),
 ("کرم‌های روده", "Bağırsak solucanı", "B82.9", "guwarish", 0),
 ("قبضیت (یبوست)", "Kabızlık", "K59.0", "guwarish", 0),
 ("دل‌بدی و استفراغ", "Bulantı ve kusma", "R11.2", "guwarish", 0),
 ("نفخ شکم", "Şişkinlik", "R14", "guwarish", 0),
 ("سندروم روده تحریک‌پذیر", "Huzursuz bağırsak", "K58.9", "guwarish", 0),
 ("بواسیر", "Basur", "K64.9", "guwarish", 0),
 ("شقاق مقعد", "Anal fissür", "K60.2", "guwarish", 0),
 ("التهاب کبد (هپاتیت)", "Hepatit", "B19.9", "guwarish", 0),
 ("هپاتیت B", "Hepatit B", "B16.9", "guwarish", 0),
 ("هپاتیت C", "Hepatit C", "B17.1", "guwarish", 0),
 ("تشمع کبد (سیروز)", "Siroz", "K74.6", "guwarish", 0),
 ("کبد چرب", "Yağlı karaciğer", "K76.0", "guwarish", 0),
 ("سنگ کیسه صفرا", "Safra taşı", "K80.2", "guwarish", 0),
 ("التهاب کیسه صفرا", "Safra kesesi iltihabı", "K81.9", "guwarish", 0),
 ("التهاب اپاندیس", "Apandisit", "K37", "guwarish", 0),
 ("التهاب پانقراس", "Pankreatit", "K85.9", "guwarish", 0),
 ("فتق مغبنی", "Kasık fıtığı", "K40.9", "guwarish", 0),
 ("مسمومیت غذایی", "Gıda zehirlenmesi", "A05.9", "guwarish", 0),

 # ---------------- ادراری و تناسلی
 ("سوزش ادرار", "İdrar yanması", "R30.0", "idrar", 1),
 ("عفونت مجاری ادرار", "İdrar yolu enfeksiyonu", "N39.0", "idrar", 1),
 ("التهاب مثانه", "Sistit", "N30.9", "idrar", 0),
 ("التهاب گرده (پیلونفریت)", "Piyelonefrit", "N10", "idrar", 0),
 ("سنگ گرده", "Böbrek taşı", "N20.0", "idrar", 0),
 ("سنگ مثانه", "Mesane taşı", "N21.0", "idrar", 0),
 ("درد گرده (کولیک)", "Böbrek koliği", "N23", "idrar", 0),
 ("نارسایی مزمن گرده", "Kronik böbrek yetmezliği", "N18.9", "idrar", 0),
 ("بزرگی پروستات", "Prostat büyümesi", "N40", "idrar", 0),
 ("التهاب پروستات", "Prostatit", "N41.9", "idrar", 0),
 ("پروتئین در ادرار", "Proteinüri", "R80", "idrar", 0),
 ("ناتوانی جنسی", "Erektil disfonksiyon", "N52.9", "idrar", 0),
 ("نازایی", "Kısırlık", "N97.9", "idrar", 0),

 # ---------------- جلدی
 ("خارش پوست", "Kaşıntı", "L29.9", "jildi", 1),
 ("حساسیت پوستی", "Deri alerjisi", "L23.9", "jildi", 0),
 ("اگزما", "Egzama", "L30.9", "jildi", 0),
 ("درماتیت اتوپیک", "Atopik dermatit", "L20.9", "jildi", 0),
 ("کهیر", "Ürtiker", "L50.9", "jildi", 0),
 ("زخم جلدی", "Deri yarası", "L98.9", "jildi", 0),
 ("عفونت چرکی پوست", "Deri apsesi", "L02.9", "jildi", 0),
 ("سلولیت", "Selülit", "L03.9", "jildi", 0),
 ("زرد زخم (ایمپتیگو)", "İmpetigo", "L01.0", "jildi", 0),
 ("قارچ پوست", "Deri mantarı", "B35.9", "jildi", 0),
 ("قارچ ناخن", "Tırnak mantarı", "B35.1", "jildi", 0),
 ("جرب (گال)", "Uyuz", "B86", "jildi", 0),
 ("شپش", "Bit", "B85.0", "jildi", 0),
 ("آکنه (جوش)", "Akne", "L70.0", "jildi", 0),
 ("پسوریازیس", "Sedef", "L40.9", "jildi", 0),
 ("ویتیلیگو (پیسی)", "Vitiligo", "L80", "jildi", 0),
 ("ریزش مو", "Saç dökülmesi", "L65.9", "jildi", 0),
 ("زگیل", "Siğil", "B07", "jildi", 0),
 ("تبخال", "Uçuk", "B00.1", "jildi", 0),
 ("سوختگی", "Yanık", "T30.0", "jildi", 0),

 # ---------------- عضلات و استخوان
 ("کمردردی", "Bel ağrısı", "M54.5", "ustukhan", 1),
 ("گردن‌دردی", "Boyun ağrısı", "M54.2", "ustukhan", 0),
 ("درد مفاصل", "Eklem ağrısı", "M25.5", "ustukhan", 1),
 ("استیوآرتریت (ساییدگی)", "Kireçlenme", "M19.9", "ustukhan", 0),
 ("روماتیزم مفصلی", "Romatoid artrit", "M06.9", "ustukhan", 0),
 ("درد زانو", "Diz ağrısı", "M25.56", "ustukhan", 0),
 ("درد شانه", "Omuz ağrısı", "M25.51", "ustukhan", 0),
 ("دیسک کمر", "Bel fıtığı", "M51.2", "ustukhan", 0),
 ("پوکی استخوان", "Kemik erimesi", "M81.9", "ustukhan", 0),
 ("درد عضلات", "Kas ağrısı", "M79.1", "ustukhan", 0),
 ("فیبرومیالژی", "Fibromiyalji", "M79.7", "ustukhan", 0),
 ("نقرس", "Gut", "M10.9", "ustukhan", 0),
 ("التهاب تاندون", "Tendinit", "M77.9", "ustukhan", 0),
 ("شکستگی استخوان", "Kemik kırığı", "T14.2", "ustukhan", 0),
 ("رگ به رگ شدن", "Burkulma", "T14.3", "ustukhan", 0),
 ("عفونت استخوان", "Kemik iltihabı", "M86.9", "ustukhan", 0),

 # ---------------- غدد و متابولیزم
 ("مرض شکر (دیابت)", "Şeker hastalığı", "E11.9", "ghudad", 1),
 ("دیابت نوع ۱", "Tip 1 diyabet", "E10.9", "ghudad", 0),
 ("دیابت حاملگی", "Gebelik diyabeti", "O24.4", "ghudad", 0),
 ("قند خون پایین", "Hipoglisemi", "E16.2", "ghudad", 0),
 ("کم‌کاری غده تایرایید", "Hipotiroidi", "E03.9", "ghudad", 0),
 ("پرکاری غده تایرایید", "Hipertiroidi", "E05.9", "ghudad", 0),
 ("گواتر", "Guatr", "E04.9", "ghudad", 0),
 ("چربی خون بلند", "Yüksek kolesterol", "E78.5", "ghudad", 0),
 ("چاقی", "Obezite", "E66.9", "ghudad", 0),
 ("کمبود ویتامین D", "D vitamini eksikliği", "E55.9", "ghudad", 0),
 ("کمبود ویتامین B12", "B12 eksikliği", "E53.8", "ghudad", 0),
 ("کمبود ید", "İyot eksikliği", "E61.8", "ghudad", 0),
 ("کمبود کلسیم", "Kalsiyum eksikliği", "E58", "ghudad", 0),

 # ---------------- عفونی
 ("عفونت عمومی", "Enfeksiyon", "A49.9", "ufunat", 0),
 ("ملاریا", "Sıtma", "B54", "ufunat", 0),
 ("تایفویید", "Tifo", "A01.0", "ufunat", 0),
 ("توبرکلوز (سل)", "Verem", "A15.9", "ufunat", 0),
 ("لیشمانیا (سالک)", "Şark çıbanı", "B55.1", "ufunat", 0),
 ("بروسلوز (تب مالت)", "Bruselloz", "A23.9", "ufunat", 0),
 ("سرخکان", "Kızamık", "B05.9", "ufunat", 0),
 ("مرغانه (آبله‌مرغان)", "Su çiçeği", "B01.9", "ufunat", 0),
 ("اوریون", "Kabakulak", "B26.9", "ufunat", 0),
 ("کچالو (کزاز)", "Tetanoz", "A35", "ufunat", 0),
 ("هاری (سگ‌گزیدگی)", "Kuduz riski", "Z20.3", "ufunat", 0),
 ("کووید-۱۹", "COVID-19", "U07.1", "ufunat", 0),

 # ---------------- زنان و حاملگی
 ("قاعدگی دردناک", "Ağrılı adet", "N94.6", "zanan", 0),
 ("بی‌نظمی قاعدگی", "Adet düzensizliği", "N92.6", "zanan", 0),
 ("خون‌ریزی شدید قاعدگی", "Aşırı adet kanaması", "N92.0", "zanan", 0),
 ("حاملگی", "Gebelik", "Z34.9", "zanan", 0),
 ("کم‌خونی دوران حاملگی", "Gebelik anemisi", "O99.0", "zanan", 0),
 ("فشار خون حاملگی", "Gebelik hipertansiyonu", "O13", "zanan", 0),
 ("تهوع حاملگی", "Gebelik bulantısı", "O21.0", "zanan", 0),
 ("سقط تهدیدآمیز", "Düşük tehdidi", "O20.0", "zanan", 0),
 ("عفونت واژن", "Vajinit", "N76.0", "zanan", 0),
 ("کاندیدیازیس واژن", "Vajinal mantar", "B37.3", "zanan", 0),
 ("کیست تخمدان", "Yumurtalık kisti", "N83.2", "zanan", 0),
 ("تخمدان پلی‌کیستیک", "Polikistik over", "E28.2", "zanan", 0),
 ("یایسگی", "Menopoz", "N95.1", "zanan", 0),
 ("التهاب پستان", "Meme iltihabı", "N61", "zanan", 0),

 # ---------------- اطفال
 ("سوء تغذیه اطفال", "Çocuk beslenme bozukluğu", "E44.0", "atfal", 0),
 ("سوء تغذیه شدید", "Ağır malnütrisyon", "E43", "atfal", 0),
 ("کمبود وزن طفل", "Düşük kilo", "R62.8", "atfal", 0),
 ("راشیتیزم", "Raşitizm", "E55.0", "atfal", 0),
 ("زردی نوزاد", "Yenidoğan sarılığı", "P59.9", "atfal", 0),
 ("قولنج نوزاد", "Bebek koliği", "R10.83", "atfal", 0),
 ("بثورات کهنه (دیاپر)", "Pişik", "L22", "atfal", 0),
 ("واکسین", "Aşı", "Z23", "atfal", 0),
 ("تأخیر رشد", "Gelişme geriliği", "R62.5", "atfal", 0),

 # ---------------- حادثه و مسمومیت
 ("زخم و جراحت", "Yaralanma", "T14.1", "hadisa", 0),
 ("ضربه سر", "Kafa travması", "S09.9", "hadisa", 0),
 ("گزیدگی حشره", "Böcek sokması", "T63.4", "hadisa", 0),
 ("مارگزیدگی", "Yılan sokması", "T63.0", "hadisa", 0),
 ("مسمومیت دوایی", "İlaç zehirlenmesi", "T50.9", "hadisa", 0),
 ("گرمازدگی", "Sıcak çarpması", "T67.0", "hadisa", 0),
 ("سرمازدگی", "Donma", "T33.9", "hadisa", 0),
]

# (ad_dari, turkce, grup)
B = [
 ("تب", "Ateş", "umumi"),
 ("لرزه", "Titreme", "umumi"),
 ("ضعف عمومی", "Halsizlik", "umumi"),
 ("خستگی", "Yorgunluk", "umumi"),
 ("تعریق شبانه", "Gece terlemesi", "umumi"),
 ("بی‌اشتهایی", "İştahsızlık", "umumi"),
 ("کاهش وزن", "Kilo kaybı", "umumi"),
 ("افزایش وزن", "Kilo artışı", "umumi"),
 ("تشنگی زیاد", "Aşırı susama", "umumi"),
 ("زردی", "Sarılık", "umumi"),
 ("ورم پاها", "Bacak şişmesi", "umumi"),
 ("ورم صورت", "Yüz şişmesi", "umumi"),
 ("رنگ‌پریدگی", "Solukluk", "umumi"),
 ("خارش عمومی بدن", "Yaygın kaşıntı", "umumi"),

 ("سردردی", "Baş ağrısı", "sinir"),
 ("سرگیچی", "Baş dönmesi", "sinir"),
 ("بی‌خوابی", "Uykusuzluk", "sinir"),
 ("خواب‌آلودگی", "Uyku hali", "sinir"),
 ("تشنج", "Havale", "sinir"),
 ("بی‌هوشی", "Bilinç kaybı", "sinir"),
 ("بی‌حسی دست و پا", "El ve ayakta uyuşma", "sinir"),
 ("سوزش دست و پا", "El ve ayakta yanma", "sinir"),
 ("لرزش دست", "El titremesi", "sinir"),
 ("ضعف یک طرف بدن", "Tek taraflı güçsüzlük", "sinir"),
 ("اختلال تکلم", "Konuşma bozukluğu", "sinir"),
 ("سفتی گردن", "Ense sertliği", "sinir"),
 ("فراموشی", "Unutkanlık", "sinir"),

 ("اضطراب", "Kaygı", "ravani"),
 ("بی‌قراری", "Huzursuzluk", "ravani"),
 ("غمگینی", "Üzgünlük", "ravani"),
 ("بی‌علاقگی", "İlgisizlik", "ravani"),
 ("تپش قلب با اضطراب", "Kaygıyla çarpıntı", "ravani"),

 ("دندان‌دردی", "Diş ağrısı", "dandan"),
 ("زخم دهان", "Ağız yarası", "dandan"),
 ("خون‌ریزی لثه", "Diş eti kanaması", "dandan"),
 ("بوی بد دهان", "Ağız kokusu", "dandan"),
 ("خشکی دهان", "Ağız kuruluğu", "dandan"),

 ("درد گلو", "Boğaz ağrısı", "gulu"),
 ("بلع دردناک", "Yutma güçlüğü", "gulu"),
 ("گرفتگی صدا", "Ses kısıklığı", "gulu"),
 ("آبریزش بینی", "Burun akıntısı", "gulu"),
 ("گرفتگی بینی", "Burun tıkanıklığı", "gulu"),
 ("عطسه", "Hapşırma", "gulu"),
 ("خون‌ریزی بینی", "Burun kanaması", "gulu"),
 ("گوش‌دردی", "Kulak ağrısı", "gulu"),
 ("ترشح گوش", "Kulak akıntısı", "gulu"),
 ("کاهش شنوایی", "İşitme azalması", "gulu"),
 ("زنگ گوش", "Kulak çınlaması", "gulu"),
 ("سرخی چشم", "Göz kızarıklığı", "gulu"),
 ("خارش چشم", "Göz kaşıntısı", "gulu"),
 ("اشک‌ریزش", "Gözyaşı akması", "gulu"),
 ("ترشح چشم", "Göz çapaklanması", "gulu"),
 ("تاری دید", "Bulanık görme", "gulu"),
 ("دوبینی", "Çift görme", "gulu"),

 ("سرفه", "Öksürük", "tanaffus"),
 ("سرفه خشک", "Kuru öksürük", "tanaffus"),
 ("سرفه بلغم‌دار", "Balgamlı öksürük", "tanaffus"),
 ("خون در بلغم", "Balgamda kan", "tanaffus"),
 ("تنگی نفس", "Nefes darlığı", "tanaffus"),
 ("تنفس تند", "Hızlı soluma", "tanaffus"),
 ("خس‌خس سینه", "Hırıltı", "tanaffus"),
 ("فرورفتگی قفسه سینه", "Göğüs çekilmesi", "tanaffus"),
 ("کبودی لب و ناخن", "Morarma", "tanaffus"),
 ("خرخر شبانه", "Horlama", "tanaffus"),

 ("درد سینه", "Göğüs ağrısı", "qalb"),
 ("تپش قلب", "Çarpıntı", "qalb"),
 ("تنگی نفس هنگام فعالیت", "Eforla nefes darlığı", "qalb"),
 ("تنگی نفس شبانه", "Gece nefes darlığı", "qalb"),

 ("خون‌ریزی آسان", "Kolay kanama", "khun_g"),
 ("کبودی خودبه‌خودی", "Kendiliğinden morarma", "khun_g"),
 ("بزرگی غدد گردن", "Boyunda bez şişliği", "khun_g"),

 ("درد شکم", "Karın ağrısı", "guwarish"),
 ("سوزش معده", "Mide yanması", "guwarish"),
 ("ترش کردن", "Ekşime", "guwarish"),
 ("دل‌بدی", "Bulantı", "guwarish"),
 ("استفراغ", "Kusma", "guwarish"),
 ("استفراغ خونی", "Kanlı kusma", "guwarish"),
 ("اسهال", "İshal", "guwarish"),
 ("اسهال خونی", "Kanlı ishal", "guwarish"),
 ("قبضیت", "Kabızlık", "guwarish"),
 ("نفخ شکم", "Şişkinlik", "guwarish"),
 ("خون در مدفوع", "Dışkıda kan", "guwarish"),
 ("مدفوع سیاه", "Siyah dışkı", "guwarish"),
 ("خارش مقعد", "Makat kaşıntısı", "guwarish"),
 ("درد هنگام تخلیه", "Dışkılarken ağrı", "guwarish"),

 ("سوزش ادرار", "İdrar yanması", "idrar"),
 ("تکرر ادرار", "Sık idrara çıkma", "idrar"),
 ("ادرار شبانه", "Gece idrara çıkma", "idrar"),
 ("خون در ادرار", "İdrarda kan", "idrar"),
 ("کم‌ادراری", "İdrar azlığı", "idrar"),
 ("احتباس ادرار", "İdrar yapamama", "idrar"),
 ("بی‌اختیاری ادرار", "İdrar kaçırma", "idrar"),
 ("ترشح تناسلی", "Genital akıntı", "idrar"),

 ("خارش پوست", "Kaşıntı", "jildi"),
 ("دانه‌های پوستی", "Deri döküntüsü", "jildi"),
 ("کهیر", "Kurdeşen", "jildi"),
 ("زخم پوست", "Deri yarası", "jildi"),
 ("تاول", "Kabarcık", "jildi"),
 ("خشکی پوست", "Deri kuruluğu", "jildi"),
 ("ریزش مو", "Saç dökülmesi", "jildi"),
 ("تغییر رنگ ناخن", "Tırnak renk değişimi", "jildi"),

 ("کمردردی", "Bel ağrısı", "ustukhan"),
 ("گردن‌دردی", "Boyun ağrısı", "ustukhan"),
 ("درد مفاصل", "Eklem ağrısı", "ustukhan"),
 ("ورم مفاصل", "Eklem şişmesi", "ustukhan"),
 ("خشکی صبحگاهی مفاصل", "Sabah tutukluğu", "ustukhan"),
 ("درد عضلات", "Kas ağrısı", "ustukhan"),
 ("محدودیت حرکت", "Hareket kısıtlılığı", "ustukhan"),
 ("لنگیدن", "Aksama", "ustukhan"),

 ("قاعدگی دردناک", "Ağrılı adet", "zanan"),
 ("خون‌ریزی غیرعادی", "Anormal kanama", "zanan"),
 ("قطع قاعدگی", "Adet kesilmesi", "zanan"),
 ("درد پستان", "Meme ağrısı", "zanan"),

 ("شیر نخوردن طفل", "Bebeğin ememesi", "atfal"),
 ("گریه دایمی طفل", "Sürekli ağlama", "atfal"),
 ("بی‌حالی طفل", "Çocukta halsizlik", "atfal"),
 ("کم شدن ادرار طفل", "Çocukta idrar azlığı", "atfal"),
 ("کم‌وزنی طفل", "Çocukta kilo alamama", "atfal"),
]

LAB_GRUPLARI = [
 ("hema", "هماتولوژی", "Hematoloji"),
 ("biokim", "بیوشیمی", "Biyokimya"),
 ("hormon", "هورمون و ویتامین", "Hormon ve vitamin"),
 ("serolojy", "سیرولوژی", "Seroloji"),
 ("mikrob", "میکروبیولوژی", "Mikrobiyoloji"),
 ("idrar_mad", "ادرار و مدفوع", "İdrar ve dışkı"),
 ("tasvir", "عکس و تصویربرداری", "Görüntüleme"),
]

# (ad_dari, turkce, grup)
L = [
 # هماتولوژی
 ("CBC — شمارش کامل خون", "Tam kan sayımı", "hema"),
 ("HB — هیموگلوبین", "Hemoglobin", "hema"),
 ("R.B.C", "Eritrosit sayısı", "hema"),
 ("H.C.T — هیماتوکریت", "Hematokrit", "hema"),
 ("MCV / MCH / MCHC", "Eritrosit indeksleri", "hema"),
 ("Platelet Count — پلاکت", "Trombosit sayısı", "hema"),
 ("T.L.C — شمارش کل گلبول سفید", "Lökosit sayısı", "hema"),
 ("D.L.C — شمارش افتراقی", "Lökosit formülü", "hema"),
 ("E.S.R", "Sedimantasyon", "hema"),
 ("Reticulocyte Count", "Retikülosit", "hema"),
 ("Peripheral Blood Smear", "Periferik yayma", "hema"),
 ("گروپ خون و Rh", "Kan grubu ve Rh", "hema"),
 ("PT / INR", "Protrombin zamanı", "hema"),
 ("PTT", "Parsiyel tromboplastin", "hema"),
 ("وقت خون‌ریزی و انعقاد (BT/CT)", "Kanama ve pıhtılaşma zamanı", "hema"),
 ("Sickling Test", "Orak hücre testi", "hema"),
 ("G6PD", "G6PD", "hema"),
 ("الکتروفورز هیموگلوبین", "Hemoglobin elektroforezi", "hema"),

 # بیوشیمی
 ("قند خون ناشتا (FBS)", "Açlık kan şekeri", "biokim"),
 ("قند خون تصادفی (RBS)", "Rastgele kan şekeri", "biokim"),
 ("قند ۲ ساعت بعد از غذا", "Tokluk kan şekeri", "biokim"),
 ("HbA1c", "HbA1c", "biokim"),
 ("اوریا (Urea)", "Üre", "biokim"),
 ("کریاتینین", "Kreatinin", "biokim"),
 ("اسید یوریک", "Ürik asit", "biokim"),
 ("کولسترول توتال", "Total kolesterol", "biokim"),
 ("تری‌گلیسیرید", "Trigliserit", "biokim"),
 ("HDL / LDL", "HDL / LDL", "biokim"),
 ("SGPT (ALT)", "ALT", "biokim"),
 ("SGOT (AST)", "AST", "biokim"),
 ("الکالین فاسفاتاز (ALP)", "ALP", "biokim"),
 ("بیلی‌روبین توتال و مستقیم", "Total ve direkt bilirubin", "biokim"),
 ("پروتین توتال و البومین", "Total protein ve albümin", "biokim"),
 ("امیلاز", "Amilaz", "biokim"),
 ("لیپاز", "Lipaz", "biokim"),
 ("CPK", "CPK", "biokim"),
 ("LDH", "LDH", "biokim"),
 ("تروپونین", "Troponin", "biokim"),
 ("کلسیم", "Kalsiyum", "biokim"),
 ("سودیم و پوتاشیم", "Sodyum ve potasyum", "biokim"),
 ("کلورید", "Klorür", "biokim"),
 ("منیزیم", "Magnezyum", "biokim"),
 ("فاسفورس", "Fosfor", "biokim"),
 ("آهن سرم و TIBC", "Serum demiri ve TIBC", "biokim"),
 ("فریتین", "Ferritin", "biokim"),

 # هورمون و ویتامین
 ("TSH", "TSH", "hormon"),
 ("T3", "T3", "hormon"),
 ("T4 / FT4", "T4 / serbest T4", "hormon"),
 ("پرولاکتین", "Prolaktin", "hormon"),
 ("LH / FSH", "LH / FSH", "hormon"),
 ("تستوسترون", "Testosteron", "hormon"),
 ("استرادیول", "Östradiol", "hormon"),
 ("Beta-HCG خون", "Beta-HCG", "hormon"),
 ("کورتیزول", "Kortizol", "hormon"),
 ("PSA", "PSA", "hormon"),
 ("ویتامین D", "D vitamini", "hormon"),
 ("ویتامین B12", "B12 vitamini", "hormon"),
 ("اسید فولیک", "Folik asit", "hormon"),

 # سیرولوژی
 ("CRP", "CRP", "serolojy"),
 ("RA Factor", "Romatoid faktör", "serolojy"),
 ("ASO Titre", "ASO", "serolojy"),
 ("تست ویدال (تایفویید)", "Widal testi", "serolojy"),
 ("HBsAg", "Hepatit B yüzey antijeni", "serolojy"),
 ("Anti-HCV", "Hepatit C antikoru", "serolojy"),
 ("HIV", "HIV", "serolojy"),
 ("VDRL / RPR", "Sifiliz testi", "serolojy"),
 ("رایت (بروسلا)", "Brusella (Wright)", "serolojy"),
 ("H. Pylori Ab", "H. pylori antikoru", "serolojy"),
 ("H. Pylori Stool Antigen", "H. pylori dışkı antijeni", "serolojy"),
 ("توکسوپلاسما", "Toksoplazma", "serolojy"),
 ("سرخکان (Measles IgM)", "Kızamık IgM", "serolojy"),
 ("کووید-۱۹ (PCR/Antigen)", "COVID-19 testi", "serolojy"),

 # میکروبیولوژی
 ("کشت ادرار", "İdrar kültürü", "mikrob"),
 ("کشت خون", "Kan kültürü", "mikrob"),
 ("کشت مدفوع", "Dışkı kültürü", "mikrob"),
 ("کشت گلو", "Boğaz kültürü", "mikrob"),
 ("کشت زخم", "Yara kültürü", "mikrob"),
 ("بلغم برای سل (AFB)", "Balgamda ARB", "mikrob"),
 ("GeneXpert برای سل", "Verem GeneXpert", "mikrob"),
 ("تست ملاریا (Smear/RDT)", "Sıtma testi", "mikrob"),
 ("سمیر لیشمانیا", "Leishmania yayması", "mikrob"),
 ("تست قارچ (KOH)", "Mantar KOH", "mikrob"),

 # ادرار و مدفوع
 ("تحلیل ادرار (Urine R/E)", "İdrar tahlili", "idrar_mad"),
 ("پروتین ادرار ۲۴ ساعته", "24 saatlik idrar proteini", "idrar_mad"),
 ("تست حاملگی ادرار", "İdrarda gebelik testi", "idrar_mad"),
 ("تحلیل مدفوع (Stool R/E)", "Dışkı tahlili", "idrar_mad"),
 ("خون مخفی در مدفوع", "Gizli kan", "idrar_mad"),
 ("مدفوع برای تخم انگل", "Dışkıda parazit yumurtası", "idrar_mad"),

 # عکس و تصویربرداری
 ("عکس سینه (CXR)", "Akciğer röntgeni", "tasvir"),
 ("عکس ساده شکم", "Direkt karın grafisi", "tasvir"),
 ("عکس اندام", "Ekstremite röntgeni", "tasvir"),
 ("عکس ستون فقرات", "Omurga röntgeni", "tasvir"),
 ("التراسوند شکم", "Karın ultrasonu", "tasvir"),
 ("التراسوند حوصله", "Pelvik ultrason", "tasvir"),
 ("التراسوند حاملگی", "Gebelik ultrasonu", "tasvir"),
 ("التراسوند تایرایید", "Tiroid ultrasonu", "tasvir"),
 ("التراسوند گرده", "Böbrek ultrasonu", "tasvir"),
 ("ECG — گراف برقی قلب", "EKG", "tasvir"),
 ("ایکوی قلب", "Ekokardiyografi", "tasvir"),
 ("CT سکن", "Bilgisayarlı tomografi", "tasvir"),
 ("MRI", "Manyetik rezonans", "tasvir"),
 ("ماموگرافی", "Mamografi", "tasvir"),
 ("اندوسکوپی معده", "Mide endoskopisi", "tasvir"),
 ("کولونوسکوپی", "Kolonoskopi", "tasvir"),
]

SIK_BELIRTI = {'درد مفاصل', 'سوزش ادرار', 'سرفه', 'سرگیچی', 'تب', 'درد گلو', 'سردردی', 'کمردردی', 'آبریزش بینی', 'درد شکم', 'استفراغ', 'خارش پوست', 'تنگی نفس', 'ضعف عمومی', 'دندان\u200cدردی', 'اسهال'}
SIK_LAB = {'تست ملاریا (Smear/RDT)', 'تحلیل مدفوع (Stool R/E)', 'CBC — شمارش کامل خون', 'عکس سینه (CXR)', 'E.S.R', 'التراسوند شکم', 'کریاتینین', 'ECG — گراف برقی قلب', 'CRP', 'SGPT (ALT)', 'قند خون ناشتا (FBS)', 'تحلیل ادرار (Urine R/E)'}

# ---------------------------------------------------------------- doğrulama
def tekrarlar(sayac):
    return [k for k, n in sayac.items() if n > 1]

gecerli = {g[0] for g in GRUPLAR}
lab_gecerli = {g[0] for g in LAB_GRUPLARI}

assert not tekrarlar(collections.Counter(x[0] for x in T)), tekrarlar(collections.Counter(x[0] for x in T))
assert not tekrarlar(collections.Counter(x[2] for x in T)), tekrarlar(collections.Counter(x[2] for x in T))
assert not tekrarlar(collections.Counter(x[0] for x in B)), tekrarlar(collections.Counter(x[0] for x in B))
assert not tekrarlar(collections.Counter(x[0] for x in L)), tekrarlar(collections.Counter(x[0] for x in L))

for ad, tr, kod, grup, sik in T:
    assert grup in gecerli, (ad, grup)
    assert tr.strip() and kod.strip(), ad
    assert '،' not in ad and ',' not in ad, ad
for ad, tr, grup in B:
    assert grup in gecerli, (ad, grup)
    assert tr.strip(), ad
    assert '،' not in ad and ',' not in ad, ad
for ad, tr, grup in L:
    assert grup in lab_gecerli, (ad, grup)
    assert tr.strip(), ad
    assert '،' not in ad and ',' not in ad, ad

# her grup en az bir kayıt görmeli, yoksa boş başlık kalır
assert {x[3] for x in T} | {x[2] for x in B} == gecerli, gecerli ^ ({x[3] for x in T} | {x[2] for x in B})
assert {x[2] for x in L} == lab_gecerli, lab_gecerli ^ {x[2] for x in L}

eksik_b = SIK_BELIRTI - {x[0] for x in B}
assert not eksik_b, ("sık belirti listede yok:", eksik_b)
eksik_l = SIK_LAB - {x[0] for x in L}
assert not eksik_l, ("sık laboratuvar listede yok:", eksik_l)

taban = {
  "surum": 2,
  "aciklama": (
    "Yaygın belirti, tanı ve laboratuvar adları. Bu bir YAZIM kolaylığıdır, "
    "teşhis ya da tetkik önerisi değil: hastada neyin olduğuna ve hangi "
    "tetkikin gerektiğine muayene sonrası hekim karar verir. Liste tedavi, "
    "ilaç ya da doz içermez."
  ),
  "gruplar": [{"anahtar": k, "ad": ad, "tr": tr} for k, ad, tr in GRUPLAR],
  "labGruplari": [{"anahtar": k, "ad": ad, "tr": tr} for k, ad, tr in LAB_GRUPLARI],
  "tanilar": [
    {"ad": ad, "tr": tr, "kod": kod, "grup": grup, **({"sik": 1} if sik else {})}
    for ad, tr, kod, grup, sik in T
  ],
  "belirtiler": [
    {"ad": ad, "tr": tr, "grup": grup, **({"sik": 1} if ad in SIK_BELIRTI else {})}
    for ad, tr, grup in B
  ],
  "laboratuvar": [
    {"ad": ad, "tr": tr, "grup": grup, **({"sik": 1} if ad in SIK_LAB else {})}
    for ad, tr, grup in L
  ],
}

# ============================================================ 3. sürüm: İngilizce adlar ve nuskha
# Grupların İngilizcesi (gruplar belirti ve tanıda ortak).
GRUP_EN = {
  'umumi': 'General', 'sinir': 'Head & nerves', 'ravani': 'Mental health', 'dandan': 'Mouth & teeth',
  'gulu': 'Eye, ear, nose & throat', 'tanaffus': 'Respiratory', 'qalb': 'Heart & vessels', 'khun_g': 'Blood',
  'guwarish': 'Digestive', 'idrar': 'Urinary & genital', 'jildi': 'Skin', 'ustukhan': 'Muscles & bones',
  'ghudad': 'Endocrine & metabolic', 'ufunat': 'Infectious', 'zanan': "Women's health & pregnancy",
  'atfal': 'Children', 'hadisa': 'Injury & poisoning',
}

# ------------------------------------------------------------ belirtiler
# Shafa'nın Dari adı → İngilizcesi (kâğıda basılan). nuskha'daki aynı belirti buna katılıyor.
BELIRTI_EN = {
 'تب': 'Fever', 'لرزه': 'Chills', 'ضعف عمومی': 'Weakness', 'خستگی': 'Fatigue', 'تعریق شبانه': 'Night Sweats',
 'بی‌اشتهایی': 'Loss of Appetite', 'کاهش وزن': 'Weight Loss', 'افزایش وزن': 'Weight Gain', 'تشنگی زیاد': 'Polydipsia',
 'زردی': 'Jaundice', 'ورم پاها': 'Pedal Edema', 'ورم صورت': 'Facial Swelling', 'رنگ‌پریدگی': 'Pallor',
 'خارش عمومی بدن': 'Generalized Itching',
 'سردردی': 'Headache', 'سرگیچی': 'Dizziness', 'بی‌خوابی': 'Insomnia', 'خواب‌آلودگی': 'Drowsiness',
 'تشنج': 'Convulsions', 'بی‌هوشی': 'Loss of Consciousness', 'بی‌حسی دست و پا': 'Numbness',
 'سوزش دست و پا': 'Burning Hands and Feet', 'لرزش دست': 'Tremor', 'ضعف یک طرف بدن': 'One-sided Weakness',
 'اختلال تکلم': 'Speech Difficulty', 'سفتی گردن': 'Neck Stiffness', 'فراموشی': 'Forgetfulness',
 'اضطراب': 'Anxiety', 'بی‌قراری': 'Restlessness', 'غمگینی': 'Depressed Mood', 'بی‌علاقگی': 'Loss of Interest',
 'تپش قلب با اضطراب': 'Palpitations with Anxiety',
 'دندان‌دردی': 'Toothache', 'زخم دهان': 'Mouth Ulcers', 'خون‌ریزی لثه': 'Bleeding Gums', 'بوی بد دهان': 'Bad Breath',
 'خشکی دهان': 'Dry Mouth',
 'درد گلو': 'Sore Throat', 'بلع دردناک': 'Painful Swallowing', 'گرفتگی صدا': 'Hoarseness', 'آبریزش بینی': 'Runny Nose',
 'گرفتگی بینی': 'Nasal Congestion', 'عطسه': 'Sneezing', 'خون‌ریزی بینی': 'Nosebleed', 'گوش‌دردی': 'Ear Pain',
 'ترشح گوش': 'Ear Discharge', 'کاهش شنوایی': 'Hearing Loss', 'زنگ گوش': 'Tinnitus', 'سرخی چشم': 'Red Eye',
 'خارش چشم': 'Itchy Eyes', 'اشک‌ریزش': 'Watery Eyes', 'ترشح چشم': 'Eye Discharge', 'تاری دید': 'Blurred Vision',
 'دوبینی': 'Double Vision',
 'سرفه': 'Cough', 'سرفه خشک': 'Dry Cough', 'سرفه بلغم‌دار': 'Productive Cough', 'خون در بلغم': 'Hemoptysis',
 'تنگی نفس': 'Shortness of Breath', 'تنفس تند': 'Fast Breathing', 'خس‌خس سینه': 'Wheezing',
 'فرورفتگی قفسه سینه': 'Chest Indrawing', 'کبودی لب و ناخن': 'Cyanosis', 'خرخر شبانه': 'Snoring',
 'درد سینه': 'Chest Pain', 'تپش قلب': 'Palpitations', 'تنگی نفس هنگام فعالیت': 'Exertional Dyspnea',
 'تنگی نفس شبانه': 'Nocturnal Dyspnea',
 'خون‌ریزی آسان': 'Easy Bleeding', 'کبودی خودبه‌خودی': 'Easy Bruising', 'بزرگی غدد گردن': 'Cervical Lymphadenopathy',
 'درد شکم': 'Abdominal Pain', 'سوزش معده': 'Heartburn', 'ترش کردن': 'Acid Regurgitation', 'دل‌بدی': 'Nausea',
 'استفراغ': 'Vomiting', 'استفراغ خونی': 'Hematemesis', 'اسهال': 'Diarrhea', 'اسهال خونی': 'Bloody Diarrhea',
 'قبضیت': 'Constipation', 'نفخ شکم': 'Bloating', 'خون در مدفوع': 'Rectal Bleeding', 'مدفوع سیاه': 'Melena',
 'خارش مقعد': 'Anal Itching', 'درد هنگام تخلیه': 'Painful Defecation',
 'سوزش ادرار': 'Dysuria', 'تکرر ادرار': 'Urinary Frequency', 'ادرار شبانه': 'Nocturia', 'خون در ادرار': 'Hematuria',
 'کم‌ادراری': 'Decreased Urine Output', 'احتباس ادرار': 'Urinary Retention', 'بی‌اختیاری ادرار': 'Urinary Incontinence',
 'ترشح تناسلی': 'Genital Discharge',
 'خارش پوست': 'Itching', 'دانه‌های پوستی': 'Rash', 'کهیر': 'Hives', 'زخم پوست': 'Skin Ulcer', 'تاول': 'Blisters',
 'خشکی پوست': 'Dry Skin', 'ریزش مو': 'Hair Loss', 'تغییر رنگ ناخن': 'Nail Discoloration',
 'کمردردی': 'Back Pain', 'گردن‌دردی': 'Neck Pain', 'درد مفاصل': 'Joint Pain', 'ورم مفاصل': 'Joint Swelling',
 'خشکی صبحگاهی مفاصل': 'Morning Stiffness', 'درد عضلات': 'Muscle Pain', 'محدودیت حرکت': 'Limited Movement',
 'لنگیدن': 'Limping',
 'قاعدگی دردناک': 'Painful Menstruation', 'خون‌ریزی غیرعادی': 'Abnormal Vaginal Bleeding', 'قطع قاعدگی': 'Amenorrhea',
 'درد پستان': 'Breast Pain',
 'شیر نخوردن طفل': 'Unable to Drink or Breastfeed', 'گریه دایمی طفل': 'Excessive Crying', 'بی‌حالی طفل': 'Lethargy',
 'کم شدن ادرار طفل': 'Decreased Urine in Child', 'کم‌وزنی طفل': 'Failure to Thrive',
}
# nuskha'da olup Shafa'da karşılığı olmayan belirtiler: (en, Dari, Türkçe, grup)
BELIRTI_YENI = [
 ('Generalized Body Pain', 'درد عمومی بدن', 'Yaygın vücut ağrısı', 'umumi'),
 ('Periorbital Edema', 'ورم دور چشم', 'Göz çevresinde şişlik', 'umumi'),
 ('Dehydration', 'کم‌آبی بدن', 'Susuzluk (dehidratasyon)', 'umumi'),
 ('Heat Intolerance', 'عدم تحمل گرما', 'Sıcağa dayanamama', 'umumi'),
 ('Cold Intolerance', 'عدم تحمل سردی', 'Soğuğa dayanamama', 'umumi'),
 ('Vertigo', 'چرخیدن سر (ورتیگو)', 'Vertigo', 'sinir'),
 ('Syncope', 'غش کردن', 'Bayılma', 'sinir'),
 ('Tingling', 'مورمور شدن دست و پا', 'Karıncalanma', 'sinir'),
 ('Altered Level of Consciousness', 'کاهش سطح هوشیاری', 'Bilinç bulanıklığı', 'sinir'),
 ('Confusion', 'پریشانی ذهن (گیجی)', 'Konfüzyon', 'sinir'),
 ('Dysphagia', 'مشکل در بلع', 'Yutma güçlüğü', 'gulu'),
 ('Nasal Flaring', 'باز و بسته شدن پره‌های بینی', 'Burun kanadı solunumu', 'tanaffus'),
 ('Grunting', 'ناله هنگام تنفس', 'İnleyerek soluma', 'tanaffus'),
 ('Tachycardia', 'ضربان تند قلب', 'Taşikardi', 'qalb'),
 ('High Blood Pressure', 'فشار خون بلند', 'Yüksek tansiyon', 'qalb'),
 ('Low Blood Pressure', 'فشار خون پایین', 'Düşük tansiyon', 'qalb'),
 ('Lymphadenopathy', 'بزرگی غدد لنفاوی', 'Lenf bezi büyümesi', 'khun_g'),
 ('Splenomegaly', 'بزرگی طحال', 'Dalak büyümesi', 'khun_g'),
 ('Epigastric Pain', 'درد بالای معده', 'Mide ağzı ağrısı', 'guwarish'),
 ('Lower Abdominal Pain', 'درد زیر ناف', 'Alt karın ağrısı', 'guwarish'),
 ('Hepatomegaly', 'بزرگی جگر', 'Karaciğer büyümesi', 'guwarish'),
 ('Urinary Urgency', 'فوریت ادرار', 'Sıkışma hissi (idrar)', 'idrar'),
 ('Flank Pain', 'درد پهلو', 'Böğür ağrısı', 'idrar'),
 ('Polyuria', 'پرادراری', 'Çok idrara çıkma', 'idrar'),
 ('Vaginal Discharge', 'ترشح مهبلی', 'Vajinal akıntı', 'zanan'),
 ('Irregular Menstruation', 'بی‌نظمی قاعدگی', 'Adet düzensizliği', 'zanan'),
 ('Heavy Menstrual Bleeding', 'خون‌ریزی زیاد قاعدگی', 'Aşırı adet kanaması', 'zanan'),
 ('Sunken Eyes', 'فرورفتگی چشم‌ها', 'Gözlerde çökme', 'atfal'),
 ('Poor Feeding', 'کم خوردن طفل', 'Çocukta az beslenme', 'atfal'),
 ('Irritability', 'تحریک‌پذیری طفل', 'Huzursuzluk (çocuk)', 'atfal'),
 ('Bulging Fontanelle', 'برآمدگی ملاج', 'Bıngıldak kabarıklığı', 'atfal'),
]
BELIRTI_SIK_EK = {'لرزه'}          # tasarımdaki hızlı liste: Fever, Chills, Cough, Headache

# ------------------------------------------------------------ tanılar
# Shafa ICD kodu → İngilizce ad. Kodlar tekil (test koruyor), o yüzden eşleşme anahtarı kod.
TANI_EN = {
 'R50.9': 'Fever', 'R50.8': 'Fever of unknown origin', 'R53': 'Malaise and fatigue', 'R63.0': 'Loss of appetite (anorexia)',
 'R63.4': 'Abnormal weight loss', 'R61': 'Night sweats', 'R60.9': 'Edema', 'Z00.0': 'General medical examination',
 'E86': 'Dehydration', 'E46': 'Malnutrition',
 'R51': 'Headache', 'G44.2': 'Tension-type headache', 'G43.9': 'Migraine', 'R42': 'Dizziness', 'H81.3': 'Peripheral vertigo',
 'G47.0': 'Insomnia', 'R55': 'Syncope', 'R25.1': 'Tremor', 'G51.0': "Bell's palsy", 'G40.9': 'Epilepsy',
 'R56.0': 'Febrile seizure', 'M54.3': 'Sciatica', 'I64': 'Stroke', 'G45.9': 'Transient ischemic attack (TIA)',
 'G62.9': 'Peripheral neuropathy', 'G56.0': 'Carpal tunnel syndrome', 'G03.9': 'Meningitis', 'G20': "Parkinson's disease",
 'F41.9': 'Anxiety disorder', 'F32.9': 'Depression', 'F43.9': 'Stress reaction', 'F41.0': 'Panic disorder',
 'F45.0': 'Somatization disorder', 'F19.2': 'Substance dependence', 'F51.0': 'Sleep disorder (non-organic)',
 'K08.8': 'Toothache', 'K02.9': 'Dental caries', 'K05.1': 'Gingivitis', 'K04.7': 'Dental abscess',
 'K12.0': 'Aphthous stomatitis', 'B37.0': 'Oral candidiasis', 'R68.2': 'Dry mouth',
 'J02.9': 'Acute pharyngitis', 'J02.0': 'Streptococcal pharyngitis', 'J03.9': 'Acute tonsillitis', 'H92.0': 'Ear pain (otalgia)',
 'H66.9': 'Otitis media', 'H60.9': 'Otitis externa', 'H61.2': 'Impacted cerumen', 'J01.9': 'Acute sinusitis',
 'J30.4': 'Allergic rhinitis', 'J34.8': 'Nasal obstruction', 'R04.0': 'Epistaxis', 'J34.2': 'Deviated nasal septum',
 'H10.9': 'Conjunctivitis', 'H00.0': 'Hordeolum (stye)', 'H04.1': 'Dry eye', 'H25.9': 'Cataract', 'H40.9': 'Glaucoma',
 'H54.7': 'Reduced vision', 'H91.9': 'Hearing loss', 'H93.1': 'Tinnitus',
 'J00': 'Common cold', 'R05': 'Cough', 'J11.1': 'Influenza', 'J06.9': 'Acute upper respiratory tract infection',
 'J22': 'Acute lower respiratory tract infection', 'J20.9': 'Acute bronchitis', 'J42': 'Chronic bronchitis',
 'J21.9': 'Bronchiolitis', 'J18.9': 'Pneumonia', 'J45.9': 'Bronchial asthma', 'J44.9': 'COPD', 'J05.0': 'Croup',
 'A37.9': 'Whooping cough (pertussis)', 'J90': 'Pleural effusion', 'R06.0': 'Dyspnea', 'J04.0': 'Acute laryngitis',
 'I10': 'Hypertension', 'I95.9': 'Hypotension', 'R07.4': 'Chest pain', 'I20.9': 'Angina pectoris',
 'I21.9': 'Acute myocardial infarction', 'I25.1': 'Coronary artery disease', 'I50.9': 'Heart failure',
 'R00.2': 'Palpitations', 'I48.9': 'Atrial fibrillation', 'I09.9': 'Rheumatic heart disease', 'I83.9': 'Varicose veins',
 'I80.2': 'Deep vein thrombosis',
 'D64.9': 'Anemia', 'D50.9': 'Iron deficiency anemia', 'D51.9': 'Vitamin B12 deficiency anemia', 'D56.9': 'Thalassemia',
 'D69.6': 'Thrombocytopenia', 'D72.8': 'Leukocytosis', 'R59.1': 'Generalized lymphadenopathy',
 'R10.4': 'Abdominal pain', 'K29.7': 'Gastritis', 'K21.9': 'Gastroesophageal reflux disease (GERD)', 'K25.9': 'Gastric ulcer',
 'K26.9': 'Duodenal ulcer', 'K29.0': 'H. pylori infection', 'A09': 'Diarrhea (infectious)', 'K52.9': 'Acute gastroenteritis',
 'A03.9': 'Dysentery (shigellosis)', 'A00.9': 'Cholera', 'A06.0': 'Amoebic dysentery', 'A07.1': 'Giardiasis',
 'B82.9': 'Intestinal worms', 'K59.0': 'Constipation', 'R11.2': 'Nausea and vomiting', 'R14': 'Bloating',
 'K58.9': 'Irritable bowel syndrome', 'K64.9': 'Hemorrhoids', 'K60.2': 'Anal fissure', 'B19.9': 'Viral hepatitis',
 'B16.9': 'Acute hepatitis B', 'B17.1': 'Acute hepatitis C', 'K74.6': 'Liver cirrhosis',
 'K76.0': 'Fatty liver disease (NAFLD)', 'K80.2': 'Gallstones (cholelithiasis)', 'K81.9': 'Cholecystitis',
 'K37': 'Appendicitis', 'K85.9': 'Acute pancreatitis', 'K40.9': 'Inguinal hernia', 'A05.9': 'Food poisoning',
 'R30.0': 'Dysuria', 'N39.0': 'Urinary tract infection', 'N30.9': 'Cystitis', 'N10': 'Acute pyelonephritis',
 'N20.0': 'Kidney stone', 'N21.0': 'Bladder stone', 'N23': 'Renal colic', 'N18.9': 'Chronic kidney disease',
 'N40': 'Benign prostatic hyperplasia', 'N41.9': 'Prostatitis', 'R80': 'Proteinuria', 'N52.9': 'Erectile dysfunction',
 'N97.9': 'Infertility',
 'L29.9': 'Pruritus', 'L23.9': 'Allergic contact dermatitis', 'L30.9': 'Eczema', 'L20.9': 'Atopic dermatitis',
 'L50.9': 'Urticaria', 'L98.9': 'Skin ulcer', 'L02.9': 'Skin abscess', 'L03.9': 'Cellulitis', 'L01.0': 'Impetigo',
 'B35.9': 'Tinea (dermatophytosis)', 'B35.1': 'Onychomycosis', 'B86': 'Scabies', 'B85.0': 'Head lice',
 'L70.0': 'Acne vulgaris', 'L40.9': 'Psoriasis', 'L80': 'Vitiligo', 'L65.9': 'Hair loss (alopecia)', 'B07': 'Warts',
 'B00.1': 'Herpes labialis', 'T30.0': 'Burn',
 'M54.5': 'Low back pain', 'M54.2': 'Neck pain', 'M25.5': 'Joint pain (arthralgia)', 'M19.9': 'Osteoarthritis',
 'M06.9': 'Rheumatoid arthritis', 'M25.56': 'Knee pain', 'M25.51': 'Shoulder pain', 'M51.2': 'Lumbar disc prolapse',
 'M81.9': 'Osteoporosis', 'M79.1': 'Myalgia', 'M79.7': 'Fibromyalgia', 'M10.9': 'Gout', 'M77.9': 'Tendinitis',
 'T14.2': 'Fracture', 'T14.3': 'Sprain', 'M86.9': 'Osteomyelitis',
 'E11.9': 'Type 2 diabetes mellitus', 'E10.9': 'Type 1 diabetes mellitus', 'O24.4': 'Gestational diabetes',
 'E16.2': 'Hypoglycemia', 'E03.9': 'Hypothyroidism', 'E05.9': 'Hyperthyroidism', 'E04.9': 'Goiter',
 'E78.5': 'Dyslipidemia', 'E66.9': 'Obesity', 'E55.9': 'Vitamin D deficiency', 'E53.8': 'Vitamin B12 deficiency',
 'E61.8': 'Iodine deficiency', 'E58': 'Calcium deficiency',
 'A49.9': 'Bacterial infection', 'B54': 'Malaria', 'A01.0': 'Typhoid fever', 'A15.9': 'Tuberculosis',
 'B55.1': 'Cutaneous leishmaniasis', 'A23.9': 'Brucellosis', 'B05.9': 'Measles', 'B01.9': 'Chickenpox', 'B26.9': 'Mumps',
 'A35': 'Tetanus', 'Z20.3': 'Animal bite (rabies exposure)', 'U07.1': 'COVID-19',
 'N94.6': 'Dysmenorrhea', 'N92.6': 'Irregular menstruation', 'N92.0': 'Heavy menstrual bleeding',
 'Z34.9': 'Normal pregnancy (antenatal care)', 'O99.0': 'Anemia in pregnancy', 'O13': 'Gestational hypertension',
 'O21.0': 'Hyperemesis gravidarum', 'O20.0': 'Threatened abortion', 'N76.0': 'Vaginitis',
 'B37.3': 'Vulvovaginal candidiasis', 'N83.2': 'Ovarian cyst', 'E28.2': 'Polycystic ovary syndrome',
 'N95.1': 'Menopausal syndrome', 'N61': 'Mastitis',
 'E44.0': 'Moderate acute malnutrition', 'E43': 'Severe acute malnutrition', 'R62.8': 'Underweight child',
 'E55.0': 'Nutritional rickets', 'P59.9': 'Neonatal jaundice', 'R10.83': 'Infantile colic', 'L22': 'Diaper dermatitis',
 'Z23': 'Vaccination', 'R62.5': 'Failure to thrive',
 'T14.1': 'Open wound', 'S09.9': 'Head injury', 'T63.4': 'Insect bite or sting', 'T63.0': 'Snake bite',
 'T50.9': 'Drug poisoning', 'T67.0': 'Heat stroke', 'T33.9': 'Frostbite',
}
# nuskha tanısı (birebir yazımı) → aynısı olan Shafa kodu. Yazımı farklıysa arama eş anlamlısı (`es`) oluyor.
TANI_ESLE = {
 'Acute upper respiratory tract infection': 'J06.9', 'Acute lower respiratory tract infection': 'J22',
 'Influenza': 'J11.1', 'COVID-19': 'U07.1', 'Acute pharyngitis': 'J02.9', 'Acute tonsillitis': 'J03.9',
 'Acute sinusitis': 'J01.9', 'Allergic rhinitis': 'J30.4', 'Acute otitis media': 'H66.9', 'Otitis externa': 'H60.9',
 'Impacted cerumen': 'H61.2', 'Acute bronchitis': 'J20.9', 'Bronchiolitis': 'J21.9', 'Pneumonia': 'J18.9',
 'Bronchial asthma': 'J45.9', 'COPD': 'J44.9', 'Pulmonary tuberculosis': 'A15.9', 'Acute gastroenteritis': 'K52.9',
 'Acute watery diarrhea': 'A09', 'Dysentery': 'A03.9', 'Amoebiasis': 'A06.0', 'Giardiasis': 'A07.1',
 'Intestinal helminthiasis': 'B82.9', 'Food poisoning': 'A05.9', 'Gastritis': 'K29.7', 'H. pylori infection': 'K29.0',
 'Gastroesophageal reflux disease (GERD)': 'K21.9', 'Irritable bowel syndrome': 'K58.9',
 'Functional constipation': 'K59.0', 'Hemorrhoids': 'K64.9', 'Anal fissure': 'K60.2', 'Acute appendicitis': 'K37',
 'Acute viral hepatitis': 'B19.9', 'Fatty liver disease (NAFLD)': 'K76.0', 'Cholelithiasis': 'K80.2',
 'Acute cholecystitis': 'K81.9', 'Typhoid fever': 'A01.0', 'Brucellosis': 'A23.9', 'Acute febrile illness': 'R50.9',
 'Measles': 'B05.9', 'Chickenpox': 'B01.9', 'Mumps': 'B26.9', 'Meningitis': 'G03.9', 'Urinary tract infection': 'N39.0',
 'Acute pyelonephritis': 'N10', 'Urolithiasis': 'N20.0', 'Renal colic': 'N23', 'Benign prostatic hyperplasia': 'N40',
 'Chronic kidney disease': 'N18.9', 'Hypertension': 'I10', 'Type 2 diabetes mellitus': 'E11.9',
 'Type 1 diabetes mellitus': 'E10.9', 'Dyslipidemia': 'E78.5', 'Ischemic heart disease': 'I25.1',
 'Stable angina': 'I20.9', 'Heart failure': 'I50.9', 'Rheumatic heart disease': 'I09.9', 'Hypothyroidism': 'E03.9',
 'Hyperthyroidism': 'E05.9', 'Goiter': 'E04.9', 'Obesity': 'E66.9', 'Gout': 'M10.9', 'Iron deficiency anemia': 'D50.9',
 'Anemia in pregnancy': 'O99.0', 'Vitamin B12 deficiency': 'E53.8', 'Vitamin D deficiency': 'E55.9',
 'Nutritional rickets': 'E55.0', 'Severe acute malnutrition': 'E43', 'Moderate acute malnutrition': 'E44.0',
 'Thalassemia': 'D56.9', 'Osteoarthritis': 'M19.9', 'Rheumatoid arthritis': 'M06.9', 'Mechanical low back pain': 'M54.5',
 'Lumbar disc prolapse': 'M51.2', 'Osteoporosis': 'M81.9', 'Tension-type headache': 'G44.2', 'Migraine': 'G43.9',
 'Epilepsy': 'G40.9', 'Febrile seizure': 'R56.0', "Bell's palsy": 'G51.0', 'Stroke': 'I64',
 'Peripheral neuropathy': 'G62.9', 'Depression': 'F32.9', 'Insomnia': 'G47.0', 'Vulvovaginal candidiasis': 'B37.3',
 'Bacterial vaginosis': 'N76.0', 'Primary dysmenorrhea': 'N94.6', 'Polycystic ovary syndrome': 'E28.2',
 'Normal pregnancy (antenatal care)': 'Z34.9', 'Hyperemesis gravidarum': 'O21.0', 'Threatened abortion': 'O20.0',
 'Infertility': 'N97.9', 'Menopausal syndrome': 'N95.1', 'Scabies': 'B86', 'Cutaneous leishmaniasis': 'B55.1',
 'Impetigo': 'L01.0', 'Cellulitis': 'L03.9', 'Skin abscess': 'L02.9', 'Atopic dermatitis': 'L20.9',
 'Contact dermatitis': 'L23.9', 'Urticaria': 'L50.9', 'Acne vulgaris': 'L70.0', 'Psoriasis': 'L40.9',
 'Pediculosis capitis': 'B85.0', 'Diaper dermatitis': 'L22', 'Hordeolum (stye)': 'H00.0', 'Cataract': 'H25.9',
 'Dental caries': 'K02.9', 'Oral candidiasis': 'B37.0', 'Aphthous stomatitis': 'K12.0', 'Neonatal jaundice': 'P59.9',
 'Infantile colic': 'R10.83', 'Animal bite (rabies exposure)': 'Z20.3',
}
# Shafa'da olmayan nuskha tanıları: en → (Dari, Türkçe, ICD-10, grup)
TANI_YENI = {
 'Chronic suppurative otitis media': ('التهاب مزمن چرکی گوش میانی', 'Kronik süpüratif orta kulak iltihabı', 'H66.3', 'gulu'),
 'Tuberculous lymphadenitis': ('توبرکلوز غدد لنفاوی', 'Tüberküloz lenfadenit', 'A18.2', 'ufunat'),
 'Peptic ulcer disease': ('زخم پپتیک', 'Peptik ülser', 'K27.9', 'guwarish'),
 'Functional dyspepsia': ('بدهضمی (سوء هاضمه)', 'Fonksiyonel dispepsi', 'K30', 'guwarish'),
 'Chronic hepatitis B': ('هپاتیت B مزمن', 'Kronik hepatit B', 'B18.1', 'guwarish'),
 'Chronic hepatitis C': ('هپاتیت C مزمن', 'Kronik hepatit C', 'B18.2', 'guwarish'),
 'Malaria (P. vivax)': ('ملاریای ویواکس', 'Sıtma (P. vivax)', 'B51.9', 'ufunat'),
 'Malaria (P. falciparum)': ('ملاریای فالسیپارم', 'Sıtma (P. falciparum)', 'B50.9', 'ufunat'),
 'Crimean-Congo hemorrhagic fever (CCHF)': ('تب کانگو (CCHF)', 'Kırım-Kongo kanamalı ateşi', 'A98.0', 'ufunat'),
 'Nocturnal enuresis': ('شب‌ادراری', 'Gece altını ıslatma', 'F98.0', 'atfal'),
 'Acute rheumatic fever': ('تب روماتیزمی حاد', 'Akut romatizmal ateş', 'I00', 'qalb'),
 'Cervical spondylosis': ('ساییدگی مهره‌های گردن', 'Servikal spondiloz', 'M47.8', 'ustukhan'),
 'Soft tissue injury': ('کوفتگی نسج نرم', 'Yumuşak doku yaralanması', 'T14.0', 'hadisa'),
 'Benign paroxysmal positional vertigo (BPPV)': ('سرگیچی وضعیتی (BPPV)', 'Benign paroksismal pozisyonel vertigo', 'H81.1', 'sinir'),
 'Generalized anxiety disorder': ('اختلال اضطراب عمومی', 'Yaygın anksiyete bozukluğu', 'F41.1', 'ravani'),
 'Post-traumatic stress disorder (PTSD)': ('اختلال استرس پس از حادثه (PTSD)', 'Travma sonrası stres bozukluğu', 'F43.1', 'ravani'),
 'Pelvic inflammatory disease': ('التهاب حوصله (PID)', 'Pelvik inflamatuar hastalık', 'N73.9', 'zanan'),
 'Trichomoniasis': ('تریکوموناس', 'Trikomoniyaz', 'A59.0', 'zanan'),
 'Abnormal uterine bleeding': ('خون‌ریزی غیرعادی رحم', 'Anormal uterin kanama', 'N93.9', 'zanan'),
 'Secondary amenorrhea': ('قطع ثانوی قاعدگی', 'Sekonder amenore', 'N91.1', 'zanan'),
 'Pre-eclampsia': ('پره‌اکلامپسی', 'Preeklampsi', 'O14.9', 'zanan'),
 'Tinea corporis': ('قارچ بدن (تینیا کورپوریس)', 'Tinea korporis', 'B35.4', 'jildi'),
 'Tinea cruris': ('قارچ کشاله ران', 'Tinea kruris', 'B35.6', 'jildi'),
 'Tinea capitis': ('قارچ سر', 'Tinea kapitis', 'B35.0', 'jildi'),
 'Pityriasis versicolor': ('لکه‌های قارچی پوست (ورسیکالر)', 'Pitiriyazis versikolor', 'B36.0', 'jildi'),
 'Melasma': ('لکه‌های قهوه‌ای صورت (ملاسما)', 'Melazma', 'L81.1', 'jildi'),
 'Allergic conjunctivitis': ('التهاب حساسیتی ملتحمه', 'Alerjik konjonktivit', 'H10.1', 'gulu'),
 'Bacterial conjunctivitis': ('التهاب چرکی ملتحمه', 'Bakteriyel konjonktivit', 'H10.0', 'gulu'),
 'Refractive error': ('عیب انکساری چشم', 'Kırma kusuru', 'H52.7', 'gulu'),
 'Drug allergy': ('حساسیت دوایی', 'İlaç alerjisi', 'T88.7', 'hadisa'),
}
# Bilerek ALINMAYAN nuskha tanıları: kendi ICD kodu olmayan şiddet dereceleri. Kod tekil olmalı;
# J18.9/J45.9'u ikinci kez kullanmak aynı hastalığı iki kayıt yapardı. Hekim serbest metinle yazar.
TANI_ALMA = {
 'Severe pneumonia': 'J18.9\'un IMCI şiddet derecesi; hekim yazar ya da Pneumonia\'yı seçer',
 'Acute exacerbation of asthma': 'J45.9\'un atağı (J46 status asthmaticus demek, yanlış olurdu)',
}
# Yanlış olan iki ICD kodunun düzeltmesi. Eski kod `eskiKod` olarak kalıyor: eski reçetedeki
# tanı çıkarılınca kodu da çıkabilsin (paylasilan/klinik.js taniDegistir).
KOD_DUZELT = {
 'K29.0': ('B98.0', 'K29.0 akut hemorajik gastrit; etken olarak H. pylori = B98.0'),
 'E61.8': ('E01.8', 'E61.8 çoklu besin eksikliği; iyot eksikliği = E01.8'),
}

# ------------------------------------------------------------ laboratuvar
# Tetkik grupları 7'den 14'e: «بیوشیمی» tek başlık altında 40 tetkikti. Eski anahtarlar
# hema/hormon/serolojy/mikrob/idrar_mad/tasvir aynen duruyor; grup reçeteye yazılmıyor, yalnız görünüm.
YENI_LAB_GRUPLARI = [
 ('hema', 'هماتولوژی', 'Hematoloji', 'Hematology'),
 ('qand', 'قند خون', 'Kan şekeri', 'Diabetes'),
 ('gurda', 'وظایف گرده', 'Böbrek fonksiyonu', 'Renal function'),
 ('jigar', 'جگر و پانقراس', 'Karaciğer ve pankreas', 'Liver & pancreas'),
 ('charbi', 'چربی خون', 'Kan yağları', 'Lipid profile'),
 ('elektrolit', 'الکترولیت و منرال', 'Elektrolit ve mineral', 'Electrolytes & minerals'),
 ('tiroid', 'تایرایید', 'Tiroid', 'Thyroid'),
 ('hormon', 'هورمون و حاملگی', 'Hormon ve gebelik', 'Hormones & pregnancy'),
 ('vitamin', 'آهن و ویتامین', 'Demir ve vitamin', 'Iron & vitamins'),
 ('qalb', 'نشانگرهای قلبی', 'Kalp belirteçleri', 'Cardiac markers'),
 ('serolojy', 'سیرولوژی', 'Seroloji', 'Serology'),
 ('mikrob', 'میکروبیولوژی و سل', 'Mikrobiyoloji ve verem', 'Microbiology & TB'),
 ('idrar_mad', 'ادرار و مدفوع', 'İdrar ve dışkı', 'Urine & stool'),
 ('tasvir', 'عکس، التراسوند و معاینات', 'Görüntüleme ve işlemler', 'Imaging & procedures'),
]
# Shafa tetkikinin Dari adı → (İngilizce, yeni grup).
LAB_EN = {
 'CBC — شمارش کامل خون': ('CBC', 'hema'), 'HB — هیموگلوبین': ('Hb', 'hema'), 'R.B.C': ('RBC Count', 'hema'),
 'H.C.T — هیماتوکریت': ('Hct', 'hema'), 'MCV / MCH / MCHC': ('MCV / MCH / MCHC', 'hema'),
 'Platelet Count — پلاکت': ('Platelet Count', 'hema'), 'T.L.C — شمارش کل گلبول سفید': ('TLC', 'hema'),
 'D.L.C — شمارش افتراقی': ('DLC', 'hema'), 'E.S.R': ('ESR', 'hema'), 'Reticulocyte Count': ('Reticulocyte Count', 'hema'),
 'Peripheral Blood Smear': ('Peripheral Blood Smear', 'hema'), 'گروپ خون و Rh': ('Blood Group & Rh', 'hema'),
 'PT / INR': ('PT & INR', 'hema'), 'PTT': ('aPTT', 'hema'), 'وقت خون‌ریزی و انعقاد (BT/CT)': ('BT & CT', 'hema'),
 'Sickling Test': ('Sickling Test', 'hema'), 'G6PD': ('G6PD', 'hema'), 'الکتروفورز هیموگلوبین': ('Hb Electrophoresis', 'hema'),
 'قند خون ناشتا (FBS)': ('FBS', 'qand'), 'قند خون تصادفی (RBS)': ('RBS', 'qand'),
 'قند ۲ ساعت بعد از غذا': ('2-hr PPBS', 'qand'), 'HbA1c': ('HbA1c', 'qand'),
 'اوریا (Urea)': ('Blood Urea', 'gurda'), 'کریاتینین': ('Serum Creatinine', 'gurda'), 'اسید یوریک': ('Serum Uric Acid', 'gurda'),
 'کولسترول توتال': ('Total Cholesterol', 'charbi'), 'تری‌گلیسیرید': ('Triglycerides', 'charbi'),
 'HDL / LDL': ('HDL / LDL Cholesterol', 'charbi'),
 'SGPT (ALT)': ('ALT (SGPT)', 'jigar'), 'SGOT (AST)': ('AST (SGOT)', 'jigar'),
 'الکالین فاسفاتاز (ALP)': ('Alkaline Phosphatase (ALP)', 'jigar'), 'بیلی‌روبین توتال و مستقیم': ('Total & Direct Bilirubin', 'jigar'),
 'پروتین توتال و البومین': ('Total Protein & Albumin', 'jigar'), 'امیلاز': ('Serum Amylase', 'jigar'), 'لیپاز': ('Serum Lipase', 'jigar'),
 'CPK': ('CPK', 'qalb'), 'LDH': ('LDH', 'qalb'), 'تروپونین': ('Troponin I', 'qalb'),
 'کلسیم': ('Serum Calcium', 'elektrolit'), 'سودیم و پوتاشیم': ('Sodium & Potassium (Na+ K+)', 'elektrolit'),
 'کلورید': ('Chloride (Cl-)', 'elektrolit'), 'منیزیم': ('Serum Magnesium', 'elektrolit'), 'فاسفورس': ('Serum Phosphorus', 'elektrolit'),
 'آهن سرم و TIBC': ('Serum Iron & TIBC', 'vitamin'), 'فریتین': ('Serum Ferritin', 'vitamin'),
 'TSH': ('TSH', 'tiroid'), 'T3': ('T3', 'tiroid'), 'T4 / FT4': ('T4 / FT4', 'tiroid'),
 'پرولاکتین': ('Prolactin', 'hormon'), 'LH / FSH': ('LH / FSH', 'hormon'), 'تستوسترون': ('Testosterone', 'hormon'),
 'استرادیول': ('Estradiol (E2)', 'hormon'), 'Beta-HCG خون': ('Serum Beta-hCG', 'hormon'), 'کورتیزول': ('Serum Cortisol', 'hormon'),
 'PSA': ('Total PSA', 'hormon'), 'ویتامین D': ('25-OH Vitamin D', 'vitamin'), 'ویتامین B12': ('Vitamin B12', 'vitamin'),
 'اسید فولیک': ('Serum Folate', 'vitamin'),
 'CRP': ('CRP', 'serolojy'), 'RA Factor': ('RA Factor', 'serolojy'), 'ASO Titre': ('ASO Titer', 'serolojy'),
 'تست ویدال (تایفویید)': ('Widal Test', 'serolojy'), 'HBsAg': ('HBsAg', 'serolojy'), 'Anti-HCV': ('Anti-HCV', 'serolojy'),
 'HIV': ('HIV 1 & 2', 'serolojy'), 'VDRL / RPR': ('VDRL / RPR', 'serolojy'),
 'رایت (بروسلا)': ('Brucella Agglutination (Wright)', 'serolojy'), 'H. Pylori Ab': ('H. pylori Antibody', 'serolojy'),
 'H. Pylori Stool Antigen': ('Stool H. pylori Antigen', 'idrar_mad'), 'توکسوپلاسما': ('Toxoplasma IgG/IgM', 'serolojy'),
 'سرخکان (Measles IgM)': ('Measles IgM', 'serolojy'), 'کووید-۱۹ (PCR/Antigen)': ('COVID-19 PCR/Antigen', 'serolojy'),
 'کشت ادرار': ('Urine Culture & Sensitivity', 'mikrob'), 'کشت خون': ('Blood Culture & Sensitivity', 'mikrob'),
 'کشت مدفوع': ('Stool Culture & Sensitivity', 'mikrob'), 'کشت گلو': ('Throat Swab Culture & Sensitivity', 'mikrob'),
 'کشت زخم': ('Pus / Wound Culture & Sensitivity', 'mikrob'), 'بلغم برای سل (AFB)': ('Sputum for AFB (x2)', 'mikrob'),
 'GeneXpert برای سل': ('GeneXpert MTB/RIF', 'mikrob'), 'تست ملاریا (Smear/RDT)': ('Malaria Smear / RDT', 'mikrob'),
 'سمیر لیشمانیا': ('Skin Smear for LD Bodies', 'mikrob'), 'تست قارچ (KOH)': ('KOH Mount (Skin Scraping)', 'mikrob'),
 'تحلیل ادرار (Urine R/E)': ('Urine R/E', 'idrar_mad'), 'پروتین ادرار ۲۴ ساعته': ('24-Hour Urine Protein', 'gurda'),
 'تست حاملگی ادرار': ('Urine Pregnancy Test', 'hormon'), 'تحلیل مدفوع (Stool R/E)': ('Stool R/E', 'idrar_mad'),
 'خون مخفی در مدفوع': ('Stool Occult Blood', 'idrar_mad'), 'مدفوع برای تخم انگل': ('Stool for Ova & Parasites', 'idrar_mad'),
 'عکس سینه (CXR)': ('X-Ray Chest PA View', 'tasvir'), 'عکس ساده شکم': ('X-Ray Abdomen (Erect)', 'tasvir'),
 'عکس اندام': ('X-Ray Limb', 'tasvir'), 'عکس ستون فقرات': ('X-Ray Spine', 'tasvir'),
 'التراسوند شکم': ('Ultrasound Abdomen', 'tasvir'), 'التراسوند حوصله': ('Ultrasound Pelvis', 'tasvir'),
 'التراسوند حاملگی': ('Ultrasound Obstetric', 'tasvir'), 'التراسوند تایرایید': ('Ultrasound Thyroid', 'tasvir'),
 'التراسوند گرده': ('Ultrasound KUB', 'tasvir'), 'ECG — گراف برقی قلب': ('ECG', 'tasvir'),
 'ایکوی قلب': ('Echocardiography', 'tasvir'), 'CT سکن': ('CT Scan', 'tasvir'), 'MRI': ('MRI', 'tasvir'),
 'ماموگرافی': ('Mammography', 'tasvir'), 'اندوسکوپی معده': ('Upper GI Endoscopy', 'tasvir'),
 'کولونوسکوپی': ('Colonoscopy', 'tasvir'),
}
# nuskha tetkiki → katıldığı Shafa kaydının İngilizcesi (yazımı farklıysa eş anlamlı olur).
LAB_ESLE = {
 'CBC': 'CBC', 'Hb': 'Hb', 'ESR': 'ESR', 'Platelet Count': 'Platelet Count', 'Blood Group & Rh': 'Blood Group & Rh',
 'Peripheral Blood Smear': 'Peripheral Blood Smear', 'Malaria Parasite (MP)': 'Malaria Smear / RDT',
 'Reticulocyte Count': 'Reticulocyte Count', 'PT & INR': 'PT & INR', 'aPTT': 'aPTT', 'BT & CT': 'BT & CT',
 'Blood Urea': 'Blood Urea', 'Serum Creatinine': 'Serum Creatinine', 'Serum Uric Acid': 'Serum Uric Acid',
 '24-Hour Urine Protein': '24-Hour Urine Protein', 'Total Bilirubin': 'Total & Direct Bilirubin',
 'Direct Bilirubin': 'Total & Direct Bilirubin', 'ALT (SGPT)': 'ALT (SGPT)', 'AST (SGOT)': 'AST (SGOT)',
 'Alkaline Phosphatase (ALP)': 'Alkaline Phosphatase (ALP)', 'Total Protein': 'Total Protein & Albumin',
 'Serum Albumin': 'Total Protein & Albumin', 'Total Cholesterol': 'Total Cholesterol', 'Triglycerides': 'Triglycerides',
 'HDL Cholesterol': 'HDL / LDL Cholesterol', 'LDL Cholesterol': 'HDL / LDL Cholesterol', 'FBS': 'FBS', 'RBS': 'RBS',
 '2-hr PPBS': '2-hr PPBS', 'HbA1c': 'HbA1c', 'TSH': 'TSH', 'Free T4 (FT4)': 'T4 / FT4', 'Total T3': 'T3',
 'Total T4': 'T4 / FT4', 'Sodium (Na+)': 'Sodium & Potassium (Na+ K+)', 'Potassium (K+)': 'Sodium & Potassium (Na+ K+)',
 'Chloride (Cl-)': 'Chloride (Cl-)', 'Serum Calcium': 'Serum Calcium', 'Serum Magnesium': 'Serum Magnesium',
 'Serum Phosphorus': 'Serum Phosphorus', 'Serum Iron': 'Serum Iron & TIBC', 'TIBC': 'Serum Iron & TIBC',
 'Serum Ferritin': 'Serum Ferritin', 'Vitamin B12': 'Vitamin B12', '25-OH Vitamin D': '25-OH Vitamin D',
 'Serum Folate': 'Serum Folate', 'Urine R/E': 'Urine R/E', 'Urine Culture & Sensitivity': 'Urine Culture & Sensitivity',
 'Stool R/E': 'Stool R/E', 'Stool Occult Blood': 'Stool Occult Blood', 'Stool H. pylori Antigen': 'Stool H. pylori Antigen',
 'Stool Culture & Sensitivity': 'Stool Culture & Sensitivity', 'Widal Test': 'Widal Test',
 'H. pylori Antibody': 'H. pylori Antibody', 'HBsAg': 'HBsAg', 'Anti-HCV': 'Anti-HCV', 'HIV 1 & 2': 'HIV 1 & 2',
 'CRP': 'CRP', 'RA Factor': 'RA Factor', 'ASO Titer': 'ASO Titer',
 'Brucella Agglutination (Wright)': 'Brucella Agglutination (Wright)', 'VDRL': 'VDRL / RPR', 'Malaria RDT': 'Malaria Smear / RDT',
 'Troponin I': 'Troponin I', 'LDH': 'LDH', 'Urine Pregnancy Test': 'Urine Pregnancy Test', 'Serum Beta-hCG': 'Serum Beta-hCG',
 'Prolactin': 'Prolactin', 'FSH': 'LH / FSH', 'LH': 'LH / FSH', 'Estradiol (E2)': 'Estradiol (E2)',
 'Testosterone': 'Testosterone', 'Serum Cortisol': 'Serum Cortisol', 'Total PSA': 'Total PSA',
 'Sputum for AFB (x2)': 'Sputum for AFB (x2)', 'GeneXpert MTB/RIF': 'GeneXpert MTB/RIF',
 'Blood Culture & Sensitivity': 'Blood Culture & Sensitivity',
 'Throat Swab Culture & Sensitivity': 'Throat Swab Culture & Sensitivity', 'Pus Culture & Sensitivity': 'Pus / Wound Culture & Sensitivity',
 'Skin Smear for LD Bodies': 'Skin Smear for LD Bodies', 'KOH Mount (Skin Scraping)': 'KOH Mount (Skin Scraping)',
 'X-Ray Chest PA View': 'X-Ray Chest PA View', 'Ultrasound Abdomen & Pelvis': 'Ultrasound Abdomen',
 'Ultrasound KUB': 'Ultrasound KUB', 'Ultrasound Obstetric': 'Ultrasound Obstetric', 'Ultrasound Thyroid': 'Ultrasound Thyroid',
 'ECG': 'ECG', 'Echocardiography': 'Echocardiography', 'Upper GI Endoscopy': 'Upper GI Endoscopy',
}
# Shafa'da olmayan nuskha tetkikleri: en → (Dari `ad`, Türkçe, grup). `ad` Shafa'nın «KOD — Dari» yazımında.
LAB_YENI = {
 'TLC & DLC': ('TLC & DLC — شمارش کل و افتراقی گلبول سفید', 'Lökosit sayısı ve formülü', 'hema'),
 'eGFR': ('eGFR — میزان فیلتراسیون گرده', 'eGFR', 'gurda'),
 'Urine Microalbumin': ('مایکروالبومین ادرار', 'İdrarda mikroalbumin', 'gurda'),
 'GGT': ('GGT', 'GGT', 'jigar'),
 'VLDL Cholesterol': ('VLDL', 'VLDL kolesterol', 'charbi'),
 'OGTT': ('تست تحمل گلوکوز (OGTT)', 'Oral glukoz tolerans testi', 'qand'),
 'Urine Sugar': ('قند ادرار', 'İdrarda şeker', 'qand'),
 'Free T3 (FT3)': ('FT3 — T3 آزاد', 'Serbest T3', 'tiroid'),
 'Anti-TPO Antibody': ('Anti-TPO', 'Anti-TPO antikoru', 'tiroid'),
 'Bicarbonate (HCO3-)': ('بیکاربونات (HCO3-)', 'Bikarbonat', 'elektrolit'),
 'Urine Ketones': ('کیتون ادرار', 'İdrarda keton', 'idrar_mad'),
 'Urine Bile Pigments': ('رنگدانه‌های صفراوی ادرار', 'İdrarda safra pigmenti', 'idrar_mad'),
 'Typhidot IgM/IgG': ('Typhidot IgM/IgG', 'Typhidot', 'serolojy'),
 'Anti-HAV IgM': ('Anti-HAV IgM — هپاتیت A', 'Hepatit A IgM', 'serolojy'),
 'Anti-HEV IgM': ('Anti-HEV IgM — هپاتیت E', 'Hepatit E IgM', 'serolojy'),
 'CK-MB': ('CK-MB', 'CK-MB', 'qalb'),
 'D-Dimer': ('D-Dimer', 'D-dimer', 'qalb'),
 'NT-proBNP': ('NT-proBNP', 'NT-proBNP', 'qalb'),
 'Progesterone': ('پروجسترون', 'Progesteron', 'hormon'),
 'AMH': ('AMH — ذخیره تخمدان', 'AMH', 'hormon'),
 'Mantoux Test (PPD)': ('تست توبرکولین (Mantoux)', 'Tüberkülin deri testi', 'mikrob'),
 'High Vaginal Swab (HVS) Culture': ('کشت ترشح مهبل (HVS)', 'Vajinal sürüntü kültürü', 'mikrob'),
 'CSF Routine Examination': ('معاینه مایع نخاع (CSF)', 'BOS incelemesi', 'mikrob'),
 'X-Ray PNS (Waters View)': ('عکس سینوس‌ها (Waters View)', 'Sinüs grafisi', 'tasvir'),
 'X-Ray Cervical Spine AP/Lateral': ('عکس فقرات گردن', 'Servikal grafi', 'tasvir'),
 'X-Ray LS Spine AP/Lateral': ('عکس فقرات کمر', 'Lomber grafi', 'tasvir'),
 'X-Ray Knee AP/Lateral': ('عکس زانو', 'Diz grafisi', 'tasvir'),
 'CT Scan Brain': ('CT سکن مغز', 'Beyin tomografisi', 'tasvir'),
 'MRI Lumbar Spine': ('MRI فقرات کمر', 'Lomber MR', 'tasvir'),
}
LAB_SIK_EK = {'Hb', 'TLC & DLC', 'PT & INR'}    # tasarımdaki hızlı liste

# ============================================================ OPTION LISTS (pick lists, not per-drug regimens)
# miktar = one intake. `adet` = units per intake for count forms (for the optional N = adet*gunluk*gun helper).
# ------------------------------------------------------------ seçenekler
# Yazım kısayolları: nuskha'nın doseOptions/timingOptions/tariqaOptions listelerinden ayıklandı.
# İLAÇLA EŞLEŞTİRİLMEMİŞ genel ifadeler; hangi ilaca ne yazılacağına hekim karar verir.
# tariqaOptions üç türü karıştırıyordu (sıklık, yol, süre): yollar `yol`a, süreler `sure`ye taşındı.
# nuskha'daki ilaç başına hazır değerler (dose/timing/tariqa/n) hiçbir yere alınmadı.
# Adet/gün meta verisi (N'yi süreden hesaplamak için) bilerek YOK: kaç kutu yazılacağı da hekimin.
# `formlar` yalnız sıralama: o şekildeki ilaçta bu seçenek öne gelir, öbürleri arkada durur.
SECENEK = {
 # miktar: bir seferde alınan
 'miktar': [
  {'ad': '۱ دانه', 'formlar': ['tablet', 'kapsul', 'fitil']},
  {'ad': 'نیم دانه', 'formlar': ['tablet']},
  {'ad': 'ربع دانه', 'formlar': ['tablet']},
  {'ad': '۱ و نیم دانه', 'formlar': ['tablet']},
  {'ad': '۲ دانه', 'formlar': ['tablet', 'kapsul']},
  {'ad': 'نیم قاشق چای‌خوری', 'formlar': ['surup']},
  {'ad': '۱ قاشق چای‌خوری', 'formlar': ['surup']},
  {'ad': '۲ قاشق چای‌خوری', 'formlar': ['surup']},
  {'ad': '۱ قاشق نان‌خوری', 'formlar': ['surup']},
  {'ad': '۱ ملی‌لیتر', 'formlar': ['surup', 'damla', 'ampul']},
  {'ad': '۱ قطره', 'formlar': ['damla']}, {'ad': '۲ قطره', 'formlar': ['damla']},
  {'ad': '۳ قطره', 'formlar': ['damla']}, {'ad': '۵ قطره', 'formlar': ['damla']},
  {'ad': '۱ پُف', 'formlar': ['sprey']}, {'ad': '۲ پُف', 'formlar': ['sprey']},
  {'ad': '۱ امپول', 'formlar': ['ampul']},
  {'ad': '۱ پاکت', 'formlar': ['posetl']},
  {'ad': '۱ شیاف', 'formlar': ['fitil']},
  {'ad': 'به اندازه کافی', 'formlar': ['krem']},
  {'ad': 'طبق هدایت'},
 ],
 # zaman: yemekle ya da günün saatiyle ilişkisi
 'zaman': [
  {'ad': 'قبل از غذا'}, {'ad': 'بعد از غذا'}, {'ad': 'همراه غذا'}, {'ad': 'ناشتا'},
  {'ad': 'هنگام خواب'}, {'ad': 'صبح'}, {'ad': 'شب'}, {'ad': 'صبح و شام'},
 ],
 # tariqa: ne sıklıkla (reçete satırında `kullanim` alanına yazılır)
 'tariqa': [
  {'ad': 'روزانه ۱ بار'}, {'ad': 'روزانه ۲ بار'}, {'ad': 'روزانه ۳ بار'}, {'ad': 'روزانه ۴ بار'},
  {'ad': 'هر ۶ ساعت'}, {'ad': 'هر ۸ ساعت'}, {'ad': 'هر ۱۲ ساعت'}, {'ad': 'هفته ۱ بار'},
  {'ad': 'در صورت ضرورت'}, {'ad': 'در صورت تب'}, {'ad': 'در صورت درد'},
 ],
 # yol: veriliş yolu ya da yeri
 'yol': [
  {'ad': 'خوراکی'}, {'ad': 'عضلی'}, {'ad': 'وریدی'}, {'ad': 'وریدی آهسته'}, {'ad': 'زیر جلدی'}, {'ad': 'زیر زبان'},
  {'ad': 'بالای جای مریضی مالیده شود'}, {'ad': 'در هر چشم'}, {'ad': 'در گوش'}, {'ad': 'در بینی'},
  {'ad': 'استنشاقی'}, {'ad': 'از راه مقعد'}, {'ad': 'مهبلی'}, {'ad': 'غرغره شود'}, {'ad': 'در آب حل شود'},
 ],
 # sure: ne kadar süre
 'sure': [
  {'ad': '۱ روز'}, {'ad': '۳ روز'}, {'ad': '۵ روز'}, {'ad': '۷ روز'}, {'ad': '۱۰ روز'}, {'ad': '۱۴ روز'},
  {'ad': '۱۵ روز'}, {'ad': '۱ ماه'}, {'ad': '۲ ماه'}, {'ad': '۳ ماه'}, {'ad': 'یک دوز'}, {'ad': 'دوامدار'},
 ],
}

# Rakamlar Latin: Shafa kuralı («Rakamlar her dilde Latin kalır») ve tasarım da «روزانه 1 بار»,
# «10 روز» basıyor. Tablo nuskha'dan okunduğu gibi Farsça rakamla yazılı, burada çevriliyor.
FA_RAKAM = str.maketrans('۰۱۲۳۴۵۶۷۸۹', '0123456789')
for liste in SECENEK.values():
    for x in liste:
        x['ad'] = x['ad'].translate(FA_RAKAM)

# ============================================================ nuskha kaynağı
# Yalnız ad listeleri okunuyor. nuskha'nın doseOptions/timingOptions/tariqaOptions
# listeleri kopyaya da alınmıyor: seçenekler yukarıda SECENEK'te elle ayıklanmış hâlde.
AD_LISTELERI = ('symptoms', 'labGroups', 'diagnoses')
if secim.nuskha:
    ham = json.load(io.open(secim.nuskha, encoding='utf-8'))
    nus = {k: ham[k] for k in AD_LISTELERI}
    if secim.kaynak_yaz:
        with io.open(KAYNAK, 'w', encoding='utf-8') as f:
            json.dump({'kaynak': 'github.com/Ferhat-Yasinoglu/nuskha data/clinical.json; yalnız ad listeleri '
                                 '(symptoms, labGroups, diagnoses). Yeniden üretmek: python3 tools/klinik-uret.py '
                                 '--nuskha <clinical.json> --kaynak-yaz', **nus}, f, ensure_ascii=False, indent=1)
            f.write('\n')
else:
    nus = json.load(io.open(KAYNAK, encoding='utf-8'))

# ============================================================ 3. sürümü kur
rapor = []
def tekil(liste, alan):
    c = collections.Counter(x[alan] for x in liste)
    return [k for k, n in c.items() if n > 1]

# --- belirtiler
bel = []
for x in taban['belirtiler']:
    y = {'ad': x['ad'], 'en': BELIRTI_EN[x['ad']], 'tr': x['tr'], 'grup': x['grup']}
    if x.get('sik') or x['ad'] in BELIRTI_SIK_EK: y['sik'] = 1
    bel.append(y)
en_bel = {y['en'].lower(): y for y in bel}
for en, fa, tr, grup in BELIRTI_YENI:
    assert en.lower() not in en_bel, en
    bel.append({'ad': fa, 'en': en, 'tr': tr, 'grup': grup})
    en_bel[en.lower()] = bel[-1]
eslesmeyen = [s for s in nus['symptoms'] if s.lower() not in en_bel]
assert not eslesmeyen, ('yerleşmeyen nuskha belirtisi', eslesmeyen)

# --- tanılar
tan = []
for x in taban['tanilar']:
    kod = x['kod']
    y = {'ad': x['ad'], 'en': TANI_EN[kod], 'tr': x['tr'], 'kod': kod, 'grup': x['grup']}
    if kod in KOD_DUZELT:
        y['kod'] = KOD_DUZELT[kod][0]
        y['eskiKod'] = kod
        rapor.append(f'ICD {x["ad"]}: {kod} -> {y["kod"]} ({KOD_DUZELT[kod][1]})')
    if x.get('sik'): y['sik'] = 1
    tan.append(y)
kodla = {x['kod']: y for x, y in zip(taban['tanilar'], tan)}
for n in nus['diagnoses']:
    if n in TANI_ESLE:
        y = kodla[TANI_ESLE[n]]
        if n.lower() != y['en'].lower(): y.setdefault('es', []).append(n)
    elif n in TANI_YENI:
        fa, tr, kod, grup = TANI_YENI[n]
        tan.append({'ad': fa, 'en': n, 'tr': tr, 'kod': kod, 'grup': grup})
    elif n in TANI_ALMA:
        rapor.append(f'ALINMADI "{n}": {TANI_ALMA[n]}')
    else:
        raise SystemExit('yerleşmeyen nuskha tanısı: ' + n)

# --- laboratuvar
lab = []
for x in taban['laboratuvar']:
    en, grup = LAB_EN[x['ad']]
    y = {'ad': x['ad'], 'en': en, 'tr': x['tr'], 'grup': grup}
    if x.get('sik') or en in LAB_SIK_EK: y['sik'] = 1
    lab.append(y)
enle = {y['en']: y for y in lab}
for t in [t for g in nus['labGroups'] for t in g['tests']]:
    if t in LAB_ESLE:
        y = enle[LAB_ESLE[t]]
        if t != y['en']: y.setdefault('es', []).append(t)
    elif t in LAB_YENI:
        fa, tr, grup = LAB_YENI[t]
        y = {'ad': fa, 'en': t, 'tr': tr, 'grup': grup}
        if t in LAB_SIK_EK: y['sik'] = 1
        lab.append(y)
        enle[t] = y
    else:
        raise SystemExit('yerleşmeyen nuskha tetkiki: ' + t)
# Tetkikler grup sırasıyla, grup içinde eski sırasıyla (kararlı sıralama).
sira = {g[0]: i for i, g in enumerate(YENI_LAB_GRUPLARI)}
lab.sort(key=lambda y: sira[y['grup']])

# --- denetimler (test/klinik.test.js'in aynısı, üretimde de dursun)
for ad, liste in (('belirtiler', bel), ('tanilar', tan), ('laboratuvar', lab)):
    assert not tekil(liste, 'ad'), (ad, tekil(liste, 'ad'))
    assert not tekil(liste, 'en'), (ad, tekil(liste, 'en'))
    for y in liste:
        # Ayraç (virgül) taşıyan ad seçilince iki kayda bölünür, geri alınamazdı.
        for alan in ('ad', 'en', 'tr'):
            assert y[alan].strip() and '،' not in y[alan] and ',' not in y[alan], (ad, y)
        for a in y.get('es', []):
            assert ',' not in a and '،' not in a, a
assert not tekil(tan, 'kod'), tekil(tan, 'kod')
assert not ({y['eskiKod'] for y in tan if 'eskiKod' in y} & {y['kod'] for y in tan}), 'eskiKod başka kaydın kodu'
assert {y['grup'] for y in bel + tan} == {g['anahtar'] for g in taban['gruplar']}
assert {y['grup'] for y in lab} == set(sira)

belge = {
  'surum': 3,
  'aciklama': taban['aciklama'] + ' 3. sürüm: her kayda İngilizce ad (en, kâğıda basılan) ve arama eş anlamlıları (es) '
              'eklendi; nuskha listesindeki belirti, tetkik ve tanılar birleştirildi. `secenekler` yalnız yazım '
              'kısayoludur, ilaçla eşleştirilmemiştir.',
  'gruplar': [{**g, 'en': GRUP_EN[g['anahtar']]} for g in taban['gruplar']],
  'labGruplari': [{'anahtar': k, 'ad': fa, 'tr': tr, 'en': en} for k, fa, tr, en in YENI_LAB_GRUPLARI],
  'tanilar': tan, 'belirtiler': bel, 'laboratuvar': lab,
  'secenekler': SECENEK,
}

# Bir kayıt bir satır: fark okunur kalsın.
satir = lambda x: json.dumps(x, ensure_ascii=False, separators=(',', ':'))
with io.open(CIKTI, 'w', encoding='utf-8') as f:
    f.write('{\n')
    anahtarlar = list(belge)
    for i, k in enumerate(anahtarlar):
        v = belge[k]
        son = ',\n' if i < len(anahtarlar) - 1 else '\n'
        if isinstance(v, list):
            f.write(f' {json.dumps(k)}: [\n' + ',\n'.join('  ' + satir(x) for x in v) + '\n ]' + son)
        elif isinstance(v, dict):
            f.write(f' {json.dumps(k)}: {{\n' + ',\n'.join(f'  {json.dumps(kk)}: ' + satir(vv) for kk, vv in v.items()) + '\n }' + son)
        else:
            f.write(f' {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}' + son)
    f.write('}\n')

print(f'belirti {len(taban["belirtiler"])} -> {len(bel)} | tanı {len(taban["tanilar"])} -> {len(tan)} | '
      f'lab {len(taban["laboratuvar"])} -> {len(lab)} | eş anlamlı {sum(len(y.get("es", [])) for y in tan + lab)} | '
      f'sık {sum(1 for y in bel if y.get("sik"))} + {sum(1 for y in tan if y.get("sik"))} + {sum(1 for y in lab if y.get("sik"))}')
print('\n'.join(rapor))
