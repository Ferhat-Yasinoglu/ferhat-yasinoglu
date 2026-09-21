# -*- coding: utf-8 -*-
"""Shafa klinik seçim listeleri: belirti, tanı, laboratuvar.

Liste ad sözlüğüdür. Tedavi, ilaç, doz YOK — o karar hekimin.
"""
import json, io, collections

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

belge = {
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

yol = "/home/user/ferhat-yasinoglu/eczane/app/veri/klinik.json"
with io.open(yol, "w", encoding="utf-8") as f:
    json.dump(belge, f, ensure_ascii=False, indent=1)
    f.write("\n")
print("tanı:", len(T), "| belirti:", len(B), "| lab:", len(L),
      "| grup:", len(GRUPLAR), "+", len(LAB_GRUPLARI),
      "| sık:", sum(1 for x in T if x[4]), "+", len(SIK_BELIRTI), "+", len(SIK_LAB))
