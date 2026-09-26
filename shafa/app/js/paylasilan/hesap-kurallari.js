// Hesap kuralları: kullanıcı adı, parola ve kurtarma kodunun normalleştirilmesi
// ve denetimi. İstemci de sunucu (sunucu/cekirdek.js) da BU dosyayı kullanır.
//
// Neden ortak: aynı ad iki tarafta farklı normalleşirse "Ali" ile "ali" iki ayrı
// hesap olur, ya da parolanın tuzu (kullanıcı adından türüyor) cihazla sunucu
// arasında kayar ve doğru parola "yanlış" çıkar. Tek kaynak bunu imkânsız kılar.
//
// Saf modül: DOM yok, node: yok, ağ yok. Sunucu bunu göreli yolla içe aktarır,
// wrangler da paketlerken buradan alır.

import { KOD_ALFABE } from './dogrulama.js';

/** 3–32 karakter; harf ya da rakamla başlar. Nokta, alt çizgi ve tire serbest. */
export const KULLANICI_KALIBI = /^[a-z0-9][a-z0-9._-]{2,31}$/;

/** Normalleştirmeden SONRA sayılır. 10 karakter: sunucu sızarsa 600 bin turlu
 *  PBKDF2'ye karşı zayıf parolaları çevrimdışı denemede makul bir süre tutar. */
export const EN_AZ_PAROLA = 10;

/** Sunucudaki şifreli kasanın tavanı. İstemci yüklemeden önce, sunucu hem
 *  Content-Length'e hem okuduğu bayta bakarak aynı sayıyı uygular. */
export const VERI_SINIRI = 20 * 1024 * 1024;

/* Farsça (U+06F0–9) ve Arapça-Hint (U+0660–9) rakamlar: iki takımın da son
   dört biti rakamın değeri. Afgan telefonlarında klavyeye göre ikisi de çıkıyor. */
const DOGU_RAKAMI = /[۰-۹٠-٩]/g;
export const rakamlariCevir = (s) => String(s).replace(DOGU_RAKAMI, (c) => String(c.charCodeAt(0) & 0xf));

/* Görünmez işaretler: ZWNJ/ZWJ (Dari klavyeleri nim-fasıla'yı farklı koyuyor)
   ve yön işaretleri (LRM, RLM, ALM). Göze görünmeyen bir fark parolayı
   "yanlış" yapmamalı. */
const GORUNMEZ = /[‌‍‎‏؜]/g;

/** Kullanıcı adı: NFKC, rakamlar ASCII, görünmezler atılır, küçük harf. */
export function kullaniciAdiNormal(ham) {
  return rakamlariCevir(String(ham ?? '').normalize('NFKC')).replace(GORUNMEZ, '').trim().toLowerCase();
}

export const kullaniciGecerli = (u) => typeof u === 'string' && KULLANICI_KALIBI.test(u);

/**
 * Parola: NFKC; yalnız klavyeye göre değişen iki harf çifti birleştirilir
 * (Arapça ي → Farsça ی, Arapça ك → Farsça ک); rakamlar ASCII; görünmezler
 * atılır; baştaki/sondaki boşluk kırpılır. Başka hiçbir harfe dokunulmaz
 * (ۀ ve ة yazıldığı gibi kalır): fazla birleştirme parolanın gücünü yer.
 * Bu fonksiyon anahtar türetmenin girdisi — değişirse bütün hesaplar kilitlenir;
 * bilinen-cevap testleri onu sabitliyor.
 */
export function parolaNormal(ham) {
  return rakamlariCevir(String(ham ?? '').normalize('NFKC').replace(/ي/g, 'ی').replace(/ك/g, 'ک'))
    .replace(GORUNMEZ, '').trim();
}

/** Kurtarma kodu: büyük harf, rakamlar ASCII; alfabe dışı her şey (tire,
 *  boşluk) atılır. Kayıtta ve kurtarmada AYNI fonksiyon çalışır. */
export function kurtarmaNormal(ham) {
  const s = rakamlariCevir(String(ham ?? '').normalize('NFKC')).toUpperCase();
  let cikis = '';
  for (const c of s) if (KOD_ALFABE.includes(c)) cikis += c;
  return cikis;
}

/* Telefon numarası biçimi: Afgan cep numarası (07XXXXXXXX, +93 7…, 0093 7…)
   ve genel 9–15 haneli numara. Hekimin kendi numarası en tahmin edilebilir
   parolalardan biri: 10^8 olasılık tek ekran kartıyla saatler içinde denenir. */
const TELEFON = [/^\+?0*9?3?7\d{8}$/, /^\+?\d{9,15}$/];
const AYIRAC = /[\s._\-()]+/g;

/* Yaygın parolalar. Karşılaştırma küçük harfle, boşluk/nokta/tire atılarak
   yapılır; baştaki ve sondaki rakam ve işaretler de soyulup gövde ayrıca
   aranır — "password123!" ya da "kabul1404" listedeki gövdeyle yakalanır.
   Liste bilerek küçük (~400): amaç en bariz tahminleri kapatmak, hekimi
   bezdirmek değil. Dari ve Afgan olanlar da var (şehirler, dini ifadeler,
   yaygın adlar, Dari klavyede sıradan tuş dizileri). */
export const YAYGIN_PAROLALAR = new Set(`
password passw0rd p@ssword p@ssw0rd mypassword passwort motdepasse contrasena
qwerty qwertyuiop qwertyui qwertyu qweasd qweasdzxc qazwsx qazwsxedc
1qaz2wsx3edc zaq12wsx zaq1xsw2cde3 1q2w3e4r5t 1q2w3e4r5t6y 1234qwerty qwer asdf
zxcv asdfgh asdfghjk asdfghjkl zxcvbn zxcvbnm poiuytrewq lkjhgfdsa mnbvcxz abcd
abcdef abcdefg abcdefgh abcdefghij a123456789 123456789a q123456789 123456789q aa12345678
iloveyou iloveu loveyou lovely lover love welcome admin administrator letmein
monkey dragon master sunshine princess football baseball soccer superman batman spiderman
trustno shadow michael jennifer charlie jordan hunter freedom whatever starwars computer
internet samsung iphone apple google facebook instagram whatsapp telegram youtube twitter
hello helloworld secret changeme default login access guest user root toor test
testing tester oracle mysql server system manager killer pokemon naruto matrix mustang
harley ginger pepper cookie cheese chocolate butterfly purple orange banana flower summer
winter spring autumn family friends forever blessed angel baby liverpool chelsea arsenal
barcelona realmadrid manchester ronaldo messi cristiano neymar cricket player
gamer gaming minecraft fortnite pubg freefire whatsup goodluck money
afghanistan afghan afghani kabul kabuljan herat hirat kandahar qandahar mazar mazarsharif
mazaresharif balkh jalalabad nangarhar kunduz ghazni bamyan bamiyan panjshir badakhshan
helmand logar paktia khost parwan kapisa baghlan takhar faryab samangan badghis farah
nimroz zabul uruzgan ghor laghman kunar nuristan wardak sarpul jawzjan daikundi
pashtun pashtoon tajik hazara uzbek dari pashto farsi persian watan watandar azadi
islam muslim musulman allah allahuakbar allahoakbar allahu bismillah bismilla
bismillahirrahmanirrahim alhamdulillah alhamdulilah subhanallah mashallah mashaallah
inshallah inshaallah lailahaillallah astaghfirullah quran koran kaaba makkah mecca madina
muhammad mohammad mohammed muhammed mohamad mohamed ahmad ahmed mahmood mahmud mahmoud
hassan hasan hussain husain hussein hossain fatima fatemeh zahra zahara maryam mariam
ayesha aisha khadija omar umar usman osman abubakr abubakar abdullah abdul rahman rahim
karim hamid rashid najib nasir farid jawad javid javed sultan khan zalmay zalmai massoud
masood ahmadshah amanullah hamidullah rahmatullah zabihullah habibullah naqibullah
wahid waheed yousuf yusuf ibrahim ismail idris younus khalid walid tariq sohail shabnam
doctor daktar dactar doktor docter medicine hospital shafakhana shafa shifa clinic
klinik pharmacy darmaltoon dawakhana dawa nurse surgeon patient mariz tabib
salam salaam khoda khuda eshq ishq janan jaan dost dostam zendagi zindagi delam
omid umid baran bahar sahar setara sitara parwana gulalai gulbuddin
aaaaaaaa aaaaaaaaaa zzzzzzzzzz asdasdasd qweqweqwe
افغانستان افغان کابل هرات کندهار قندهار مزار مزارشریف جلالآباد کندز غزنی بامیان پنجشیر
بدخشان هلمند آزادی الله اللهاکبر بسمالله بسماللهالرحمنالرحیم الحمدلله سبحانالله ماشالله
انشاالله محمد احمد محمود حسین فاطمه زهرا مریم عایشه خدیجه عثمان عبدالله
داکتر دکتر شفاخانه دواخانه مریض سلام جانان دوست زندگی پسورد
رمزعبور امید باران بهار ستاره پروانه
ضصثقفغعهخحجچ ضصثقفغعهخحج ضصثقفغعهخ ضصثقفغ شسیبلاتنمک شسیبلاتن ظطزرذدپو ظطزرذد
`.trim().split(/\s+/));

const DIS_ISARET = /^[0-9!@#$%^&*?+=~]+|[0-9!@#$%^&*?+=~]+$/g;

function yayginMi(p) {
  const sade = p.toLowerCase().replace(AYIRAC, '');
  if (YAYGIN_PAROLALAR.has(sade)) return true;
  const govde = sade.replace(DIS_ISARET, '');
  return govde.length >= 4 && YAYGIN_PAROLALAR.has(govde);
}

/**
 * Parola kuralları. Dönüş: null (uygun) ya da kod —
 * 'kisa' | 'telefon' | 'rakam' | 'kullanici' | 'yaygin'.
 * Kod döner, cümle değil: metni arayüz (hatalar.js / sözlük) kurar.
 */
export function parolaSorunu(ham, kullanici = '') {
  const p = parolaNormal(ham);
  if ([...p].length < EN_AZ_PAROLA) return 'kisa';
  const bitisik = p.replace(AYIRAC, '');
  if (TELEFON.some((k) => k.test(bitisik))) return 'telefon';
  if (/^\d+$/.test(bitisik)) return 'rakam';
  const u = kullaniciAdiNormal(kullanici);
  if (u.length >= 3) {
    const kucuk = p.toLowerCase();
    const uSade = u.replace(/[._-]/g, '');
    if (kucuk.includes(u) || (uSade.length >= 3 && kucuk.replace(AYIRAC, '').includes(uSade))) return 'kullanici';
  }
  if (yayginMi(p)) return 'yaygin';
  return null;
}
