// FY Reklam sunucusu: Cloudflare Worker + tek bir SQLite tabanlı Durable Object.
//
//   Reklam (idFromName('reklam'), tek örnek)  oturumlar, ortak kayıt, JPEG'ler
//
// İki reklamcı (REKLAMCILAR secret'ı) Google ile girer; ürün tanıtım
// gönderilerini tasarlayıp Facebook Sayfası'na ve Instagram'a yayınlar.
// Görseller önce buraya yüklenir (/v1/gorsel) ve herkese açık /g/<id>.jpg
// adresinden verilir: Meta görseli oradan çeker. PROVA='1' iken Meta'ya hiç
// gidilmez, kayıt 'prova' durumuyla yazılır.
//
// Her yanıt TEK bir sarmalayıcıdan geçer: CORS, no-store ve nosniff hata
// yanıtları dahil HER yanıta eklenir (CORS'suz bir 401'i tarayıcı ağ hatası
// sanır). Ham istisna dışarı çıkmaz (500 `sunucu`).
//
// Gövdeler, jetonlar, Meta token'ları ve Authorization hiçbir yerde loglanmaz.

import {
  ApiHatasi, AYAR, JETON_KALIBI, bearer, gelistirmeGovdesi, girisGovdesi, govdeOku, jpegMi, jsonOku, jsonYanit as json, kayitGovdesi,
  metinOzeti, reklamciListesi, sinirAlani, yayinGovdesi,
} from './cekirdek.js';
import { googleDogrula } from './google.js';
import { MetaHatasi, fbCokluYayinla, fbFotoYayinla, gizle, igKaruselYayinla, igKota, igYayinla, igYolu, kanalBagli } from './meta.js';

export { Reklam } from './reklam.js';

const JSON_TURU = 'application/json; charset=utf-8';

// --- ortak yanıt sarmalayıcısı ---------------------------------------------

const GELISTIRME_KOKENI = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

/** İzinli köken listesi tam eşleşmeyle; localhost yalnız geliştirme bayrağıyla. */
function kokenIzinli(env, koken) {
  if (!koken) return false;
  const liste = String(env.IZINLI_KOKENLER || '').split(',').map((s) => s.trim()).filter(Boolean);
  return liste.includes(koken) || (env.GELISTIRME === '1' && GELISTIRME_KOKENI.test(koken));
}

function ortakBasliklar(env, koken) {
  const b = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '7200',
  };
  if (kokenIzinli(env, koken)) b['Access-Control-Allow-Origin'] = koken;
  return b;
}

function hataYaniti(e) {
  if (e instanceof ApiHatasi) return json({ hata: e.kod, ...e.ek }, e.durum);
  // Mesajda ne olursa olsun token sızmasın: Meta kalıbı süzülür, 200 karakter.
  console.error('sunucu hatasi:', gizle(String(e?.message || e)).slice(0, 200));
  return json({ hata: 'sunucu' }, 500);
}

async function sarmala(istek, env, is) {
  let yanit;
  try { yanit = await is(); } catch (e) { yanit = hataYaniti(e); }
  // DO'dan gelen yanıtın başlıkları değişmez olabilir: kopyala.
  const cikis = new Response(yanit.body, { status: yanit.status, statusText: yanit.statusText, headers: yanit.headers });
  // Önbellek izni veren tek yanıt herkese açık görsel (/g/): onun kendi
  // Cache-Control'ü kalıyor, gerisi no-store.
  const onbellekli = yanit.status === 200 && /^public,/.test(yanit.headers.get('Cache-Control') || '');
  for (const [ad, deger] of Object.entries(ortakBasliklar(env, istek.headers.get('Origin')))) {
    if (ad === 'Cache-Control' && onbellekli) continue;
    cikis.headers.set(ad, deger);
  }
  return cikis;
}

// --- DO'ya erişim ----------------------------------------------------------

/** DO bağı yoksa (yanlış toml) hiçbir şey çalışmasın: 503. */
function reklamKutusu(env) {
  if (!env.REKLAM) throw new ApiHatasi(503, 'yapilandirma');
  return env.REKLAM.get(env.REKLAM.idFromName('reklam'));
}

/**
 * Reklam DO'sunu çağırır; JSON gövde döner. 2xx dışı yanıt (401 oturum, 403
 * yetki, 422 gorsel_yok…) ApiHatasi olarak fırlar: sarmalayıcı aynı JSON'u
 * aynı durumla dışarı verir. `ham` verilirse gövde JSON değil bayt (görsel).
 */
async function reklamIste(env, islem, { veri = {}, jeton, ham } = {}) {
  const basliklar = { 'Content-Type': ham ? 'application/octet-stream' : JSON_TURU };
  if (jeton) basliklar.Authorization = 'Bearer ' + jeton;
  const r = await reklamKutusu(env).fetch('https://reklam/' + islem, { method: 'POST', headers: basliklar, body: ham ?? JSON.stringify(veri) });
  const sonuc = await r.json();
  if (!r.ok) { const { hata, ...ek } = sonuc; throw new ApiHatasi(r.status, hata || 'sunucu', ek); }
  return sonuc;
}

/** Biçimi bile tutmayan jeton DO'ya gitmez. */
function jetonGerekli(istek) {
  const jeton = bearer(istek);
  if (!jeton || !JETON_KALIBI.test(jeton)) throw new ApiHatasi(401, 'oturum');
  return jeton;
}

/* İstemci IP'si Cloudflare'in yazdığı CF-Connecting-IP'den (istemci taklit
   edemez). yerel.mjs bu başlığı istemciden gelse bile siler ve soketten yazar. */
const istemciIp = (istek) => istek.headers.get('CF-Connecting-IP') || '';

const provaMi = (env) => env.PROVA === '1';
const koken = (istek) => new URL(istek.url).origin;

/* Giriş için gerekenler yoksa 503: boş REKLAMCILAR kapıyı açık değil kapalı
   bırakır; istemci kimliği yoksa Google düğmesi zaten çizilemez. */
function yapilandirmaDenetle(env, { google = true } = {}) {
  if (google && !env.GOOGLE_ISTEMCI_KIMLIGI) throw new ApiHatasi(503, 'yapilandirma');
  if (!reklamciListesi(env.REKLAMCILAR).size) throw new ApiHatasi(503, 'yapilandirma');
}

// --- yollar -----------------------------------------------------------------

/* Jetonsuz: uygulama Google düğmesini kimliği koda gömmeden çizsin, PROVA ve
   kanal bağlılığını (yalnız var/yok; değer asla dönmez) bilsin. */
const durum = (istek, env) => json({
  ok: true,
  surum: AYAR.surum,
  gelistirme: env.GELISTIRME === '1',
  istemciKimligi: env.GOOGLE_ISTEMCI_KIMLIGI || '',
  prova: provaMi(env),
  kanallar: { facebook: { bagli: kanalBagli(env, 'facebook') }, instagram: { bagli: kanalBagli(env, 'instagram') } },
});

/* Önce IP kapısı (çok başarısız denemeden sonra Google jetonuna bile
   bakılmaz), sonra Google jetonu (yalnız CPU, DO'ya gitmez: uydurma jetonlar
   Reklam'a hiç ulaşmaz), en son allowlist ve oturum. */
async function giris(istek, env) {
  yapilandirmaDenetle(env);
  const { kimlik } = girisGovdesi(await jsonOku(istek));
  const ip = istemciIp(istek);
  await reklamIste(env, 'giris/kapi', { veri: { ip } });
  let k;
  try {
    k = await googleDogrula(kimlik, { istemciKimligi: env.GOOGLE_ISTEMCI_KIMLIGI, jwksAdresi: env.GOOGLE_JWKS });
  } catch (e) {
    if (e instanceof ApiHatasi && e.durum === 401) await reklamIste(env, 'giris/basarisiz', { veri: { ip } }).catch(() => {});
    throw e;
  }
  return json(await reklamIste(env, 'giris', { veri: { eposta: k.eposta, ad: k.ad, resim: k.resim, ip } }));
}

/* Google'sız giriş: YALNIZ GELISTIRME='1' (yerel.mjs --gelistirme) iken var.
   Yayında bu yol bilinmeyen bir yoldan farksızdır (404). Allowlist yine uygulanır. */
async function gelistirmeGirisi(istek, env) {
  if (env.GELISTIRME !== '1') throw new ApiHatasi(404, 'yok');
  yapilandirmaDenetle(env, { google: false });
  const g = gelistirmeGovdesi(await jsonOku(istek));
  return json(await reklamIste(env, 'giris', { veri: { ...g, ip: istemciIp(istek) } }));
}

async function cikis(istek, env) {
  const jeton = bearer(istek);
  if (!jeton || !JETON_KALIBI.test(jeton)) return json({ ok: true });
  return json(await reklamIste(env, 'cikis', { jeton }));
}

async function kayitlar(istek, env) {
  const jeton = jetonGerekli(istek);
  const sinir = sinirAlani(new URL(istek.url).searchParams.get('sinir'));
  return json(await reklamIste(env, 'kayitlar', { jeton, veri: { sinir } }));
}

/** API'siz kanal kaydı (indir, paylaş, kopyala, Business Suite): kim = oturumun e-postası. */
async function kayitYaz(istek, env) {
  const jeton = jetonGerekli(istek);
  const g = kayitGovdesi(await jsonOku(istek));
  return json(await reklamIste(env, 'kayit', { jeton, veri: g }));
}

/* JPEG yükleme: Content-Type image/jpeg (başka tür 415), gövde en çok 1,9 MB
   (413), ilk üç bayt FF D8 FF (415). Gövde okunurken sayılır; Content-Length'e
   güvenilmez. Döner `{ id, adres }`; adres bu Worker'ın kökeninde. */
async function gorselYukle(istek, env) {
  const jeton = jetonGerekli(istek);
  const tur = (istek.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (tur && tur !== 'image/jpeg') throw new ApiHatasi(415, 'gorsel_turu');
  if (Number(istek.headers.get('Content-Length')) > AYAR.gorselSiniri) throw new ApiHatasi(413, 'gorsel_buyuk');
  const baytlar = await govdeOku(istek.body, AYAR.gorselSiniri, 'gorsel_buyuk');
  if (!jpegMi(baytlar)) throw new ApiHatasi(415, 'gorsel_turu');
  const { id } = await reklamIste(env, 'gorsel/yukle', { jeton, ham: baytlar });
  return json({ id, adres: `${koken(istek)}/g/${id}.jpg` });
}

/* GET /g/<id>.jpg: jetonsuz, herkese açık (Meta buradan çeker). Kimlik 64 bit
   rastgele; tahmin edilemez. Görsel değişmez: bir hafta önbellek. */
async function gorselVer(istek, env, id) {
  const r = await reklamKutusu(env).fetch('https://reklam/gorsel/al', { method: 'POST', headers: { 'Content-Type': JSON_TURU }, body: JSON.stringify({ id }) });
  if (r.status !== 200) { await r.body?.cancel?.(); throw new ApiHatasi(404, 'yok'); }
  const basliklar = { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=604800, immutable' };
  const boy = r.headers.get('Content-Length');
  if (boy) basliklar['Content-Length'] = boy;
  if (istek.method === 'HEAD') { await r.body?.cancel?.(); return new Response(null, { status: 200, headers: basliklar }); }
  return new Response(r.body, { status: 200, headers: basliklar });
}

/* Kanalların durumu: bağlı mı (secret'lar var mı — PROVA'da da gerçek durum),
   Instagram hangi konaktan, kullanıcı token'ı tanımlı mı (yalnız var/yok),
   günlük API kotası. Kota yalnız canlıda sorulur; Meta'ya ulaşılamazsa null —
   isteği düşürmez. Kimlikler gizli değil (gönderi adreslerinde zaten görünür). */
async function kanallar(istek, env, { getir }) {
  await reklamIste(env, 'oturum', { jeton: jetonGerekli(istek) });
  const prova = provaMi(env);
  const fb = kanalBagli(env, 'facebook');
  const ig = kanalBagli(env, 'instagram');
  const kota = !prova && ig ? await igKota(env, getir).catch(() => null) : null;
  return json({
    prova,
    facebook: { bagli: fb, sayfaId: env.META_SAYFA_ID || null },
    instagram: { bagli: ig, igId: env.META_IG_ID || null, yol: igYolu(env), kullaniciToken: !!env.META_KULLANICI_TOKEN, kota },
  });
}

/** Kanala ve görsel sayısına göre Meta çağrısı; döner dış kimlik (dis_id). */
async function metaYayinla(env, { kanal, adresler, metin, altMetin }, getir, bekle) {
  if (kanal === 'facebook') {
    if (adresler.length === 1) {
      const r = await fbFotoYayinla(env, { gorselAdresi: adresler[0], mesaj: metin }, getir);
      return r.post_id || r.id;
    }
    return (await fbCokluYayinla(env, { gorselAdresleri: adresler, mesaj: metin }, getir)).id;
  }
  if (adresler.length === 1) return (await igYayinla(env, { gorselAdresi: adresler[0], aciklama: metin, altMetin }, getir, { bekle })).id;
  return (await igKaruselYayinla(env, { gorselAdresleri: adresler, aciklama: metin, altMetin }, getir, { bekle })).id;
}

/*
 * Yayınla: gövde denetimi (400/422) → kanal secret'ları (canlıda; 422
 * kanal_kapali) → DO kaydı 'gonderiliyor' açar, görsellerin varlığını (422
 * gorsel_yok) ve aynı metnin son 24 saatte yayınlanmadığını (409 tekrar;
 * zorla geçer) denetler → PROVA'da dış çağrı yok, kayıt 'prova' → canlıda
 * Instagram kotası (doluysa 429 kota, kayıt 'hata'/kota; okunamazsa devam) →
 * Meta; başarı 'yayinlandi' + dis_id, hata 'hata' + kod ve 502 { hata: 'meta',
 * kod, meta_kod, meta_alt_kod }. PROVA'da secret aranmaz: yerel geliştirme
 * (--gelistirme) secret'sız çalışır, akış uçtan uca denenir. Worker kendi
 * /g/ adresini hiç çekmez (Cloudflare 1042): görsel varlığına DO bakar,
 * adresi yalnız Meta'ya verir.
 */
async function yayinla(istek, env, { getir, bekle }) {
  const jeton = jetonGerekli(istek);
  const g = yayinGovdesi(await jsonOku(istek));
  const prova = provaMi(env);
  if (!prova && !kanalBagli(env, g.kanal)) throw new ApiHatasi(422, 'kanal_kapali', { kanal: g.kanal });
  const { kayit } = await reklamIste(env, 'yayin/hazirla', { jeton, veri: { ...g, metin_ozet: await metinOzeti(g.metin) } });
  const bitir = (sonuc) => reklamIste(env, 'yayin/bitir', { veri: { id: kayit.id, ...sonuc } });
  if (prova) {
    const r = await bitir({ durum: 'prova', dis_id: 'prova-' + kayit.id, hata: null });
    return json({ kayit: r.kayit, sonuc: { dis_id: r.kayit.dis_id, prova: true } });
  }
  if (g.kanal === 'instagram') {
    const kota = await igKota(env, getir).catch(() => null);
    if (kota && kota.sinir !== null && kota.kullanilan >= kota.sinir) {
      await bitir({ durum: 'hata', dis_id: null, hata: 'kota' }).catch(() => {});
      throw new ApiHatasi(429, 'kota', { kullanilan: kota.kullanilan, sinir: kota.sinir });
    }
  }
  const adresler = g.gorseller.map((id) => `${koken(istek)}/g/${id}.jpg`);
  let disId;
  try {
    disId = await metaYayinla(env, { kanal: g.kanal, adresler, metin: g.metin, altMetin: g.altMetin }, getir, bekle);
  } catch (e) {
    const meta = e instanceof MetaHatasi;
    if (!meta) console.error('meta hatasi:', gizle(String(e?.message || e)).slice(0, 200));
    await bitir({ durum: 'hata', dis_id: null, hata: meta ? e.kod : 'meta' }).catch(() => {});
    throw new ApiHatasi(502, 'meta', { kod: meta ? e.kod : 'meta', meta_kod: meta ? e.metaKod : null, meta_alt_kod: meta ? e.metaAltKod : null });
  }
  const r = await bitir({ durum: 'yayinlandi', dis_id: disId, hata: null });
  return json({ kayit: r.kayit, sonuc: { dis_id: disId, prova: false } });
}

/* Meta'nın görsel çekicisi (facebookexternalhit) /g/ altına girebilsin, başka
   tarayıcı hiçbir yolu dizine eklemesin. Jetonsuz, herkese açık. */
export const ROBOTS = 'User-agent: facebookexternalhit\nAllow: /g/\n\nUser-agent: *\nDisallow: /\n';
const robots = (istek) => new Response(istek.method === 'HEAD' ? null : ROBOTS, {
  status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
});

const YOLLAR = {
  'GET durum': durum,
  'POST giris': giris,
  'POST gelistirme/giris': gelistirmeGirisi,
  'POST cikis': cikis,
  'GET kayit': kayitlar,
  'POST kayit': kayitYaz,
  'POST gorsel': gorselYukle,
  'GET kanallar': kanallar,
  'POST yayinla': yayinla,
};

const GORSEL_YOLU = /^\/g\/([a-f0-9]{16})\.jpg$/;

async function yonlendir(istek, env, baglam) {
  const yol = new URL(istek.url).pathname;
  const okuma = istek.method === 'GET' || istek.method === 'HEAD';
  const g = GORSEL_YOLU.exec(yol);
  if (g) {
    if (!okuma) throw new ApiHatasi(404, 'yok');
    return gorselVer(istek, env, g[1]);
  }
  if (yol === '/robots.txt') {
    if (!okuma) throw new ApiHatasi(404, 'yok');
    return robots(istek);
  }
  if (!yol.startsWith('/v1/')) throw new ApiHatasi(404, 'yok');
  if (istek.method === 'OPTIONS') return new Response(null, { status: 204 });
  const is = YOLLAR[`${istek.method} ${yol.slice(4)}`];
  if (!is) throw new ApiHatasi(404, 'yok');
  return is(istek, env, baglam);
}

/**
 * Worker'ın işleyicisi. `getir` Meta çağrılarının fetch'i, `bekle` Instagram
 * kabını beklerken kullanılan uyku: testler ikisini de verir, yayında
 * varsayılanlar (global fetch, setTimeout).
 */
export function isleyici({ getir = (u, o) => fetch(u, o), bekle } = {}) {
  const baglam = { getir, bekle };
  return { fetch: (istek, env) => sarmala(istek, env, () => yonlendir(istek, env, baglam)) };
}

export default isleyici();
