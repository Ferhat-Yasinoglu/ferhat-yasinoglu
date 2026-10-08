// FY Reklam sunucusunun ortak parçaları: hata türü, bayt ve metin yardımcıları,
// e-posta normalleştirme, istek gövdesi okuma, istek doğrulayıcıları ve hız
// penceresi. Şema ve Durable Object mantığı reklam.js'te.
//
// Yalnız Web API'ye (TextEncoder, crypto.subtle, streams) dayanır; Cloudflare'e
// özgü hiçbir şey içe aktarmaz. Böylece aynı kod workerd'da, Node'daki yerel
// sunucuda (yerel.mjs, node:sqlite) ve testlerde birebir çalışır.
//
// Oturum jetonu yalnız istemcide durur; sunucu SHA-256 özetini saklar. Gövdeler,
// jetonlar, Meta token'ları ve Authorization hiçbir yerde loglanmaz.

const SANIYE = 1000;
const DAKIKA = 60 * SANIYE;
const SAAT = 60 * DAKIKA;
const GUN = 24 * SAAT;

export const AYAR = Object.freeze({
  surum: '0.1.0',
  /** JSON gövdelerin tavanı (Google jetonu ~1,3 KB; en uzun gönderi metni 2200 karakter). */
  jsonSiniri: 64 * 1024,
  /* Barındırılan JPEG'in tavanı: DO SQLite'ta tek bir BLOB en çok 2.000.000
     bayt olabilir; pay bırakılır. Uygulama JPEG kalitesini buna göre düşürür. */
  gorselSiniri: 1_900_000,
  /** Oturum bu kadar sonra düşer (iki yönetici, kendi cihazları; yeniden giriş kolay). */
  oturumOmru: 30 * GUN,
  /** Görsel Meta çekene kadar durur; sonra işi biter. Her yüklemede eskiler silinir. */
  gorselOmru: 7 * GUN,
  /** Instagram açıklama tavanı; Facebook'a da aynı sınır uygulanır (tek metin, iki kanal). */
  metinSiniri: 2200,
  /** Karusel: Instagram en çok 10 öğe; Facebook'a da aynı tavan. */
  enCokGorsel: 10,
  listeVarsayilan: 100,
  listeSiniri: 500,
  /** IP başına başarısız giriş (bozuk Google jetonu ya da allowlist dışı adres). */
  giris: Object.freeze({ sayi: 20, sure: 15 * DAKIKA }),
  pencereTavani: 20000,
});

/** Yanıta dönüşecek bilinen hata: durum kodu + makinece okunur kod (+ ek alanlar). */
export class ApiHatasi extends Error {
  constructor(durum, kod, ek = {}) { super(kod); this.durum = durum; this.kod = kod; this.ek = ek; }
}

const gecersiz = (alan) => new ApiHatasi(400, 'gecersiz', alan ? { alan } : {});
const duzNesne = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

const JSON_TURU = 'application/json; charset=utf-8';
/** JSON yanıt (Worker ve DO aynı biçimi kullanır). */
export const jsonYanit = (veri, durum = 200, basliklar = {}) =>
  new Response(JSON.stringify(veri), { status: durum, headers: { 'Content-Type': JSON_TURU, ...basliklar } });

export const bearer = (istek) => {
  const m = (istek.headers.get('Authorization') || '').match(/^Bearer\s+(\S+)$/);
  return m ? m[1] : null;
};

// --- baytlar ----------------------------------------------------------------

const kodlayici = new TextEncoder();
export const utf8 = (s) => kodlayici.encode(String(s));

export function b64urlYaz(baytlar) {
  let s = '';
  for (const b of baytlar) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Geçersiz girdide null: çağıran bunu 400/401'e çevirir, istisna sızmaz.
 * Yalnız KANONİK yazım kabul edilir: atob son karakterin kullanılmayan
 * bitlerini görmezden geliyor, yani aynı baytların 4–16 ayrı yazımı vardı.
 */
export function b64urlOku(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
  let baytlar;
  try {
    const ikili = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
    baytlar = Uint8Array.from(ikili, (c) => c.charCodeAt(0));
  } catch { return null; }
  return b64urlYaz(baytlar) === s ? baytlar : null;
}

export const hex = (baytlar) => Array.from(baytlar, (b) => b.toString(16).padStart(2, '0')).join('');

/** SHA-256, küçük harf hex. */
export async function ozetHex(metin) {
  return hex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', utf8(metin))));
}

/** Oturum jetonu: 32 rastgele bayt, b64url (43 karakter). Yalnız istemcide durur. */
export function rastgeleJeton() {
  const b = new Uint8Array(32);
  globalThis.crypto.getRandomValues(b);
  return b64urlYaz(b);
}
export const JETON_KALIBI = /^[A-Za-z0-9_-]{43}$/;

/** Görsel kimliği: 8 rastgele bayt, 16 hex. Adres herkese açık; tahmin edilemez olması yeter. */
export function rastgeleKimlik() {
  const b = new Uint8Array(8);
  globalThis.crypto.getRandomValues(b);
  return hex(b);
}
export const GORSEL_KIMLIGI = /^[a-f0-9]{16}$/;

/** JPEG dosyası FF D8 FF ile başlar (JFIF, EXIF ve ham hepsi). Content-Type yalan söyleyebilir; baytlar söylemez. */
export const jpegMi = (b) => b instanceof Uint8Array && b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

// --- istek gövdesi ----------------------------------------------------------

/**
 * Akışı sonuna kadar okur, `sinir`i aşınca 413 atar (`kod`: 'buyuk' ya da
 * 'gorsel_buyuk'). Content-Length'e güvenmek yetmez (yoksa ya da yalansa
 * diye) — her okumada sayılır.
 */
export async function govdeOku(akis, sinir, kod = 'buyuk') {
  if (!akis) return new Uint8Array();
  const parcalar = [];
  let toplam = 0;
  const okuyucu = akis.getReader();
  try {
    for (;;) {
      const { done, value } = await okuyucu.read();
      if (done) break;
      const bayt = value instanceof Uint8Array ? value : new Uint8Array(value);
      toplam += bayt.length;
      if (toplam > sinir) throw new ApiHatasi(413, kod);
      parcalar.push(bayt);
    }
  } catch (e) {
    okuyucu.cancel().catch(() => {});
    throw e;
  }
  if (parcalar.length === 1) return parcalar[0];
  const tum = new Uint8Array(toplam);
  let i = 0;
  for (const p of parcalar) { tum.set(p, i); i += p.length; }
  return tum;
}

const kesinCozucu = new TextDecoder('utf-8', { fatal: true });

/** JSON gövdeyi çözer; bozuk UTF-8, bozuk JSON ya da düz nesne olmayan gövde 400. */
export function jsonCoz(baytlar) {
  let veri;
  try { veri = JSON.parse(kesinCozucu.decode(baytlar)); } catch { throw gecersiz(); }
  if (!duzNesne(veri)) throw gecersiz();
  return veri;
}

/** Küçük JSON gövde (görsel dışındaki bütün uçlar). */
export async function jsonOku(istek, sinir = AYAR.jsonSiniri) {
  if (Number(istek.headers.get('Content-Length')) > sinir) throw new ApiHatasi(413, 'buyuk');
  return jsonCoz(await govdeOku(istek.body, sinir));
}

// --- metin alanları ---------------------------------------------------------

/* Dışarıdan gelen tek satırlık metindeki denetim karakterleri ve YÖN
   DENETİMLERİ (LRM/RLM, ALM, gömme/geçersiz kılma, yalıtım) atılır: Google adı
   ve kayıt başlığı uygulamanın listesinde gösteriliyor; U+202E gibi bir
   karakter orada metni ters çevirip yanıltıcı görünebilirdi. ZWNJ (U+200C)
   DOKUNULMAZ: Dari'de anlamlı. */
const KONTROL_TUM = /[\u0000-\u001f\u007f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/g;
/* Gönderi metninde satır sonu ve sekme kalır; yön işaretleri de kalır (Dari +
   Latin karışık bir açıklamada bilerek konmuş olabilir, Instagram'a gider,
   bizim ekranda değil). Yalnız öteki denetim karakterleri atılır. */
const KONTROL_SATIRLI = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u2028\u2029]/g;

/** Dışarıdan gelen ve reddedilmemesi gereken tek satırlık metin: temizlenip kısaltılır. */
export function temizMetin(v, enCok) {
  return typeof v === 'string' ? v.replace(KONTROL_TUM, ' ').replace(/\s+/g, ' ').trim().slice(0, enCok) : '';
}

/** Çok satırlı gönderi metni: satır sonları birleşir (\r\n → \n), kalan denetim karakterleri atılır. */
export function cokSatirMetin(v) {
  return typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(KONTROL_SATIRLI, '').trim() : '';
}

/** Kod noktası sayısı (Instagram karakter sayar; .length emojiyi iki sayardı — gereksiz red olurdu). */
export const karakterSayisi = (s) => [...s].length;

/** Profil resmi yalnız https adresi olabilir (istemci onu <img src>'ye koyar). */
export function resimAdresi(v) {
  return typeof v === 'string' && v.length <= 500 && /^https:\/\/[^\s"'<>]+$/.test(v) ? v : '';
}

/** İsteğe bağlı tek satırlık alan: yoksa '', metin değilse 400. */
function metinAlani(veri, alan, enCok) {
  const v = veri[alan];
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') throw gecersiz(alan);
  return temizMetin(v, enCok);
}

// --- e-posta ----------------------------------------------------------------

/* Görünmez işaretler (ZWNJ/ZWJ, yön işaretleri, BOM) ve her türlü boşluk:
   Dari klavyeli telefonda kopyala-yapıştırla gelir, adreste hiçbiri olamaz. */
const GORUNMEZ = /[\s\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g;
const DOGU_RAKAMI = /[\u06f0-\u06f9\u0660-\u0669]/g;

/**
 * E-postanın tek biçimi: NFKC, görünmezler atılır, Farsça/Arapça rakamlar
 * ASCII, küçük harf. Gmail'de noktalar ve `+etiket` aynı kutuya gider ve
 * googlemail.com = gmail.com: "Sahip.X+y@GoogleMail.com" → "sahipx@gmail.com".
 * Başka alanlarda (Google Workspace) nokta anlamlıdır, dokunulmaz.
 * REKLAMCILAR listesi de girişteki adres de bu biçimle karşılaştırılır.
 */
export function epostaNormal(ham) {
  const s = String(ham ?? '').normalize('NFKC').replace(GORUNMEZ, '')
    .replace(DOGU_RAKAMI, (c) => String(c.charCodeAt(0) & 0xf)).toLowerCase();
  const at = s.lastIndexOf('@');
  if (at < 1) return s;
  let yerel = s.slice(0, at);
  let alan = s.slice(at + 1);
  if (alan === 'googlemail.com') alan = 'gmail.com';
  if (alan === 'gmail.com') yerel = yerel.split('+')[0].replace(/\./g, '');
  return `${yerel}@${alan}`;
}

const ETIKET = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const EPOSTA_KALIBI = new RegExp(`^[a-z0-9!#$%&'*+/=?^_\`{|}~.-]{1,64}@${ETIKET}(?:\\.${ETIKET})+$`);

/** Normalleşmiş adres için biçim denetimi (en çok 254 karakter). */
export const epostaGecerli = (e) => typeof e === 'string' && e.length <= 254 && EPOSTA_KALIBI.test(e);

/** REKLAMCILAR secret'ı: virgül, noktalı virgül ya da boşlukla ayrılmış adresler → normalleşmiş küme. */
export function reklamciListesi(ham) {
  const k = new Set();
  for (const p of String(ham || '').split(/[,;\s]+/)) {
    const e = epostaNormal(p);
    if (epostaGecerli(e)) k.add(e);
  }
  return k;
}

/** Gövdedeki e-postayı normalleştirip denetler. */
export function epostaAlani(v, alan = 'eposta') {
  if (typeof v !== 'string' || v.length > 320) throw gecersiz(alan);
  const e = epostaNormal(v);
  if (!epostaGecerli(e)) throw gecersiz(alan);
  return e;
}

// --- istek gövdeleri --------------------------------------------------------

/** Ürün anahtarı (app/js/paylasilan/urunler.js'teki `anahtar`): küçük harf, rakam, tire. */
export const URUN_KALIBI = /^[a-z][a-z0-9-]{0,39}$/;

export function urunAlani(v, alan = 'urun') {
  if (typeof v !== 'string' || !URUN_KALIBI.test(v)) throw gecersiz(alan);
  return v;
}

/** POST giris: `{ kimlik: <Google ID jetonu> }`. */
export function girisGovdesi(veri) {
  if (typeof veri.kimlik !== 'string' || !veri.kimlik || veri.kimlik.length > 4096) throw gecersiz('kimlik');
  return { kimlik: veri.kimlik };
}

/** POST gelistirme/giris: `{ eposta, ad? }` (yalnız GELISTIRME='1'). */
export function gelistirmeGovdesi(veri) {
  const eposta = epostaAlani(veri.eposta);
  return { eposta, ad: metinAlani(veri, 'ad', 100) || eposta.split('@')[0], resim: '' };
}

/* Ortak kaydın API'siz kanalları: uygulama görseli indirdi, paylaşım
   sayfasından paylaştı, metni kopyaladı ya da Business Suite'i açtı.
   'facebook' ve 'instagram' kayıtlarını yalnız /v1/yayinla yazar. */
export const KAYIT_KANALLARI = Object.freeze(['indir', 'paylas', 'kopyala', 'business_suite']);
export const YAYIN_KANALLARI = Object.freeze(['facebook', 'instagram']);

/** POST kayit: `{ urun, kanal, bicim?, baslik? }`. */
export function kayitGovdesi(veri) {
  if (!KAYIT_KANALLARI.includes(veri.kanal)) throw gecersiz('kanal');
  return { urun: urunAlani(veri.urun), kanal: veri.kanal, bicim: metinAlani(veri, 'bicim', 40), baslik: metinAlani(veri, 'baslik', 200) };
}

/**
 * POST yayinla: `{ kanal, gorseller: [id…], metin?, urun, baslik?, bicim? }`.
 * Görsel ve metin sınırları 422 (kullanıcının düzeltebileceği şeyler), biçim
 * hataları 400. Görsellerin gerçekten var olup olmadığına DO bakar.
 */
export function yayinGovdesi(veri) {
  if (!YAYIN_KANALLARI.includes(veri.kanal)) throw gecersiz('kanal');
  if (!Array.isArray(veri.gorseller)) throw gecersiz('gorseller');
  if (!veri.gorseller.length) throw new ApiHatasi(422, 'gorsel_yok');
  if (veri.gorseller.length > AYAR.enCokGorsel) throw new ApiHatasi(422, 'cok_gorsel', { sinir: AYAR.enCokGorsel });
  if (veri.gorseller.some((g) => typeof g !== 'string' || !GORSEL_KIMLIGI.test(g))) throw new ApiHatasi(422, 'gorsel_yok');
  if (veri.metin !== undefined && veri.metin !== null && typeof veri.metin !== 'string') throw gecersiz('metin');
  const metin = cokSatirMetin(veri.metin ?? '');
  if (karakterSayisi(metin) > AYAR.metinSiniri) throw new ApiHatasi(422, 'metin_uzun', { sinir: AYAR.metinSiniri });
  return {
    kanal: veri.kanal, gorseller: veri.gorseller, metin, urun: urunAlani(veri.urun),
    baslik: metinAlani(veri, 'baslik', 200), bicim: metinAlani(veri, 'bicim', 40) || (veri.gorseller.length > 1 ? 'karusel' : 'tek'),
  };
}

/** `?sinir=` → 1…500, bozuk ya da yoksa 100. */
export function sinirAlani(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return AYAR.listeVarsayilan;
  return Math.min(n, AYAR.listeSiniri);
}

// --- IP ---------------------------------------------------------------------

/** IPv4 olduğu gibi; IPv6 /64 önekine indirgenir (bir istemci bütün /64'ü
 *  kullanabildiği için adres değiştirerek sınırı aşmasın). IPv4-mapped
 *  IPv6 (::ffff:1.2.3.4) IPv4'e döner. */
export function ipAnahtari(ip) {
  const s = String(ip || '').trim().toLowerCase();
  if (!s.includes(':')) return s || 'bilinmiyor';
  const eslesen = s.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (eslesen) return eslesen[1];
  const [bas, son = ''] = s.split('%')[0].split('::');
  const sol = bas ? bas.split(':') : [];
  const sag = s.includes('::') && son ? son.split(':') : [];
  const tam = s.includes('::') ? [...sol, ...Array(Math.max(0, 8 - sol.length - sag.length)).fill('0'), ...sag] : sol;
  return tam.slice(0, 4).map((h) => (parseInt(h, 16) || 0).toString(16)).join(':') + '::/64';
}

// --- hız sınırı -------------------------------------------------------------

const saniye = (ms) => Math.max(1, Math.ceil(ms / SANIYE));

/**
 * Sabit pencereli sayaç, yalnız bellekte. DO tek örnek olduğu için (bütün
 * girişler ondan geçer) sayaç bütün dünya için tektir; nesne düşerse
 * sıfırlanır — kabul edilebilir, depoya satır yazmak her IP için kalıcı çöp
 * üretirdi. `say` bir olayı sayar, `dolu` sınıra ulaşıldıysa kalan saniyeyi
 * döndürür (yoksa 0): girişte yalnız BAŞARISIZ denemeler sayılır.
 */
export class Pencere {
  constructor({ sayi, sure }, tavan = AYAR.pencereTavani) {
    this.sayi = sayi;
    this.sure = sure;
    this.tavan = tavan;
    this.kayitlar = new Map();
  }

  kayit(anahtar, simdi) {
    let k = this.kayitlar.get(anahtar);
    if (!k || simdi - k.bas >= this.sure) {
      this.budama(simdi);
      k = { bas: simdi, sayi: 0 };
      this.kayitlar.set(anahtar, k);
    }
    return k;
  }

  dolu(anahtar, simdi = Date.now()) {
    const k = this.kayit(anahtar, simdi);
    return k.sayi >= this.sayi ? saniye(k.bas + this.sure - simdi) : 0;
  }

  say(anahtar, simdi = Date.now()) { this.kayit(anahtar, simdi).sayi++; }

  /* Bellek sınırsız büyümesin: tavan aşılınca süresi dolanlar atılır, yine
     sığmıyorsa hepsi (sınırı bir pencere boyunca gevşetmek, nesnenin
     düşmesinden iyidir). */
  budama(simdi) {
    if (this.kayitlar.size < this.tavan) return;
    for (const [a, k] of this.kayitlar) if (simdi - k.bas >= this.sure) this.kayitlar.delete(a);
    if (this.kayitlar.size >= this.tavan) this.kayitlar.clear();
  }
}
