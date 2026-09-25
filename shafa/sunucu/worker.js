// Shafa hesap sunucusu: Cloudflare Worker + iki SQLite tabanlı Durable Object.
//
//   Hesap  (idFromName(u))            hesap kaydı, oturumlar, şifreli kasa
//   Sinir  (u:<özet> | ip:<n> | genel) hesap kilidi, IP pencereleri, günlük kayıt tavanı
//
// Her yanıt TEK bir sarmalayıcıdan geçer (sarmala): CORS, no-store ve nosniff
// hata yanıtları dahil HER yanıta eklenir. Tarayıcı CORS başlığı olmayan bir
// 401/413/500'ü ağ hatası (TypeError) diye görür; hekim de "internet yok" sanıp
// sorun sunucudayken modemiyle uğraşır. Kota ve depolama hataları da JSON 503
// `kota` olur, ham istisna asla dışarı çıkmaz.
//
// Gövdeler ve Authorization başlığı hiçbir yerde loglanmaz.

import {
  AYAR, ApiHatasi, HesapCekirdek, SinirCekirdek, govdeDogrula, jsonOku, davetNormal, esitMi,
  jetonKullanicisi, ipAnahtari, ipParcasi, ozet, hex, utf8,
} from './cekirdek.js';

const JSON_TURU = 'application/json; charset=utf-8';
const json = (veri, durum = 200, basliklar = {}) =>
  new Response(JSON.stringify(veri), { status: durum, headers: { 'Content-Type': JSON_TURU, ...basliklar } });

// --- ortak yanıt sarmalayıcısı ---------------------------------------------

const GELISTIRME_KOKENI = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

/** İzinli köken listesi tam eşleşmeyle; localhost yalnız geliştirme bayrağıyla
 *  (yerel.mjs --gelistirme). Yayındaki sunucu localhost'a hiç izin vermez. */
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
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match',
    'Access-Control-Expose-Headers': 'X-Surum',
    // Chrome ön-uçuş önbelleğini zaten 2 saatle sınırlıyor; fazlası boşa.
    'Access-Control-Max-Age': '7200',
  };
  if (kokenIzinli(env, koken)) b['Access-Control-Allow-Origin'] = koken;
  return b;
}

/* Cloudflare kota aşımında ("Exceeded allowed … free tier") ya da nesne
   aşırı yüklenince istisna atıyor. Bunlar hekime "sunucu şu an dolu" diye
   görünmeli (503 kota), gerisi 500 sunucu. */
const KOTA = /exceeded|quota|free tier|daily limit|overloaded/i;
function hataYaniti(e) {
  if (e instanceof ApiHatasi) return json({ hata: e.kod, ...e.ek }, e.durum);
  if (e?.overloaded || e?.retryable || KOTA.test(String(e?.message || ''))) return json({ hata: 'kota' }, 503);
  console.error('sunucu hatasi:', String(e?.message || e).slice(0, 200));
  return json({ hata: 'sunucu' }, 500);
}

async function sarmala(istek, env, is) {
  let yanit;
  try { yanit = await is(); } catch (e) { yanit = hataYaniti(e); }
  // DO'dan ya da fetch'ten gelen yanıtın başlıkları değişmez olabilir: kopyala.
  const cikis = new Response(yanit.body, { status: yanit.status, statusText: yanit.statusText, headers: yanit.headers });
  for (const [ad, deger] of Object.entries(ortakBasliklar(env, istek.headers.get('Origin')))) cikis.headers.set(ad, deger);
  return cikis;
}

// --- DO'lara erişim ---------------------------------------------------------

const hesapKutusu = (env, u) => env.HESAP.get(env.HESAP.idFromName(u));
const sinirKutusu = (env, ad) => env.SINIR.get(env.SINIR.idFromName(ad));

async function sinirIste(kutu, islem, veri = {}) {
  const r = await kutu.fetch('https://sinir/' + islem, { method: 'POST', body: JSON.stringify(veri) });
  return r.json();
}

/** Worker'da denetlenmiş gövdeyle Hesap DO'sunu çağırır; DO'nun JSON yanıtı
 *  (durum + gövde) aynen döner. */
async function hesapIste(env, u, islem, veri, jeton) {
  const basliklar = { 'Content-Type': JSON_TURU };
  if (jeton) basliklar.Authorization = 'Bearer ' + jeton;
  const r = await hesapKutusu(env, u).fetch('https://hesap/v1/' + islem, { method: 'POST', headers: basliklar, body: JSON.stringify(veri) });
  return { durum: r.status, veri: await r.json() };
}

const bearer = (istek) => {
  const m = (istek.headers.get('Authorization') || '').match(/^Bearer\s+(\S+)$/);
  return m ? m[1] : null;
};

function jetonluKullanici(istek) {
  const jeton = bearer(istek);
  const u = jetonKullanicisi(jeton);
  if (!u) throw new ApiHatasi(401, 'oturum');
  return { jeton, u };
}

/* İstemci IP'si Cloudflare'in yazdığı CF-Connecting-IP'den (istemci taklit
   edemez). yerel.mjs bu başlığı istemciden gelse bile siler ve soketten yazar. */
async function ipDene(env, istek, tur) {
  const anahtar = ipAnahtari(istek.headers.get('CF-Connecting-IP'));
  const r = await sinirIste(sinirKutusu(env, 'ip:' + ipParcasi(anahtar)), 'ip', { tur, anahtar });
  if (!r.izin) throw new ApiHatasi(429, 'cok_istek', { bekle: r.bekle });
}

const kilitKutusu = async (env, u) => sinirKutusu(env, 'u:' + hex(await ozet(utf8(u))));

/**
 * Hesap kilidiyle korunan işlem (giriş, parola, silme, kurtarma kodu yenileme).
 * Kilit kullanıcı adının özetine bağlı ve hesabın var olup olmadığına hiç
 * bakmıyor: bilinmeyen ad da aynı sayacı, aynı kilidi, aynı yanıtları alır.
 * Her deneme sonucu beklenmeden sayılır (kilitDene), başarı sıfırlar.
 */
async function kilitle(env, u, calistir) {
  const kutu = await kilitKutusu(env, u);
  const k = await sinirIste(kutu, 'kilit/dene');
  if (k.kilitli) throw new ApiHatasi(429, 'kilitli', { bekle: k.bekle });
  const r = await calistir();
  if (r.durum < 300) await sinirIste(kutu, 'kilit/sifirla');
  return json(r.veri, r.durum);
}

/* Jetonlu kilitli işlemlerde oturum, kilit sayacına dokunmadan ÖNCE denetlenir:
   yoksa geçersiz jetonlarla parola denemesi yağdıran biri, parolayı hiç
   bilmeden hekimin hesabını yeni girişlere kilitleyebilirdi. */
async function oturumDenetle(env, u, jeton) {
  const r = await hesapKutusu(env, u).fetch('https://hesap/v1/veri/surum', { headers: { Authorization: 'Bearer ' + jeton } });
  await r.body?.cancel();
  if (r.status === 401) throw new ApiHatasi(401, 'oturum');
}

// --- yollar -----------------------------------------------------------------

async function kayit(istek, env) {
  // Davet kodu yoksa kayıt KAPALI: yanlışlıkla herkese açık bir sunucu olmasın.
  if (!env.DAVET_KODU) throw new ApiHatasi(403, 'kayit_kapali');
  await ipDene(env, istek, 'kayit');
  const g = govdeDogrula('kayit', await jsonOku(istek));
  if (!esitMi(davetNormal(g.davet), davetNormal(env.DAVET_KODU))) throw new ApiHatasi(403, 'davet');
  const genel = await sinirIste(sinirKutusu(env, 'genel'), 'genel/kayit');
  if (!genel.izin) throw new ApiHatasi(429, 'cok_istek', { bekle: genel.bekle });
  const { davet, ...hesapIcin } = g;
  const r = await hesapIste(env, g.kullanici, 'kayit', hesapIcin);
  return json(r.veri, r.durum);
}

async function giris(istek, env) {
  await ipDene(env, istek, 'giris');
  const g = govdeDogrula('giris', await jsonOku(istek));
  return kilitle(env, g.kullanici, () => hesapIste(env, g.kullanici, 'giris', g));
}

/* Kurtarma uçları hesap kilidine girmez: 120 bitlik kod tahminle bulunmaz,
   ortak sayaç ise yalnız hekimi kurtarmadan alıkoyan bir araç olurdu. IP
   sınırı yeter. */
async function kurtarAc(istek, env) {
  await ipDene(env, istek, 'giris');
  const g = govdeDogrula('kurtar/ac', await jsonOku(istek));
  const r = await hesapIste(env, g.kullanici, 'kurtar/ac', g);
  return json(r.veri, r.durum);
}

async function kurtarBitir(istek, env) {
  await ipDene(env, istek, 'giris');
  const g = govdeDogrula('kurtar/bitir', await jsonOku(istek));
  const r = await hesapIste(env, g.kullanici, 'kurtar/bitir', g);
  // Kurtaran hekimin öbür cihazları yeni parolayla girebilsin: kilit sıfırlanır.
  if (r.durum < 300) await sinirIste(await kilitKutusu(env, g.kullanici), 'kilit/sifirla');
  return json(r.veri, r.durum);
}

const jetonluKilitli = (islem) => async (istek, env) => {
  await ipDene(env, istek, 'giris');
  const { jeton, u } = jetonluKullanici(istek);
  const g = govdeDogrula(islem, await jsonOku(istek));
  await oturumDenetle(env, u, jeton);
  return kilitle(env, u, () => hesapIste(env, u, islem, g, jeton));
};

async function cikis(istek, env) {
  const { jeton, u } = jetonluKullanici(istek);
  const r = await hesapIste(env, u, 'cikis', {}, jeton);
  return json(r.veri, r.durum);
}

/* Veri uçları DO'ya AKIŞ olarak aktarılır, Worker gövdeyi ayrıştırmaz:
   ücretsiz planda istek başına 10 ms CPU var, 20 MB'ı JSON diye okumak
   bunu aşar. Yönlendirme yalnız jetonun ilk parçasından. Sınırı aşacağını
   baştan söyleyen gövde DO'ya hiç gitmez: gövdeye dokunmadan verilen yanıt
   bağlantıyı bozmaz (DO'nun erken yanıtı bozuyordu, bkz. akisiAt). */
async function veriAktar(istek, env) {
  const { u } = jetonluKullanici(istek);
  if (Number(istek.headers.get('Content-Length')) > AYAR.veriSiniri) throw new ApiHatasi(413, 'buyuk');
  return hesapKutusu(env, u).fetch(istek);
}

const YOLLAR = {
  'GET durum': async () => json({ ok: true }),
  'POST kayit': kayit,
  'POST giris': giris,
  'POST kurtar/ac': kurtarAc,
  'POST kurtar/bitir': kurtarBitir,
  'POST kurtarma/yenile': jetonluKilitli('kurtarma/yenile'),
  'POST parola': jetonluKilitli('parola'),
  'POST hesap/sil': jetonluKilitli('hesap/sil'),
  'POST cikis': cikis,
  'GET veri/surum': veriAktar,
  'GET veri': veriAktar,
  'PUT veri': veriAktar,
};

async function yonlendir(istek, env) {
  const yol = new URL(istek.url).pathname;
  if (!yol.startsWith('/v1/')) throw new ApiHatasi(404, 'yok');
  if (istek.method === 'OPTIONS') return new Response(null, { status: 204 });
  const is = YOLLAR[`${istek.method} ${yol.slice(4)}`];
  if (!is) throw new ApiHatasi(404, 'yok');
  return is(istek, env);
}

export default {
  fetch: (istek, env) => sarmala(istek, env, () => yonlendir(istek, env)),
};

// --- Durable Object sınıfları ----------------------------------------------

/* DO'nun içinde ApiHatasi JSON yanıta çevrilir (istisna nesnesi DO sınırından
   türüyle geçmez). Diğer istisnalar (depolama, kota) yukarı fırlar; Worker'daki
   sarmalayıcı onları 503/500 yapar. */
async function icYanit(is) {
  try { return await is(); } catch (e) {
    if (e instanceof ApiHatasi) return json({ hata: e.kod, ...e.ek }, e.durum);
    throw e;
  }
}

/** If-Match: `"3"`, `3` ya da `""` (henüz kasa yok); başlık yoksa null. */
function beklenenSurum(istek) {
  const h = istek.headers.get('If-Match');
  return h === null ? null : h.trim().replace(/^"(.*)"$/, '$1');
}

export class Hesap {
  constructor(ctx) {
    this.cekirdek = new HesapCekirdek(ctx.storage);
  }

  fetch(istek) {
    return icYanit(async () => {
      const c = this.cekirdek;
      const jeton = bearer(istek);
      const islem = new URL(istek.url).pathname.slice(4);
      switch (`${istek.method} ${islem}`) {
        case 'POST kayit': return json(await c.kayit(await istek.json()), 201);
        case 'POST giris': return json(await c.giris(await istek.json()));
        case 'POST kurtar/ac': return json(await c.kurtarAc(await istek.json()));
        case 'POST kurtar/bitir': return json(await c.kurtarBitir(await istek.json()));
        case 'POST kurtarma/yenile': return json(await c.kurtarmaYenile(jeton, await istek.json()));
        case 'POST parola': return json(await c.parola(jeton, await istek.json()));
        case 'POST cikis': return json(await c.cikis(jeton));
        case 'POST hesap/sil': return json(await c.sil(jeton, await istek.json()));
        case 'GET veri/surum': return json(await c.surum(jeton));
        case 'GET veri': {
          const { surum, govde } = await c.veriOku(jeton);
          if (!govde) return new Response(null, { status: 204, headers: { 'X-Surum': '' } });
          return new Response(govde, { headers: { 'Content-Type': JSON_TURU, 'X-Surum': surum } });
        }
        case 'PUT veri': {
          const r = await c.veriYaz(jeton, { beklenen: beklenenSurum(istek), akis: istek.body });
          return json(r, 200, { 'X-Surum': r.surum });
        }
        default: throw new ApiHatasi(404, 'yok');
      }
    });
  }
}

export class Sinir {
  constructor(ctx) {
    this.cekirdek = new SinirCekirdek(ctx.storage);
  }

  async fetch(istek) {
    const c = this.cekirdek;
    const veri = await istek.json();
    switch (new URL(istek.url).pathname.slice(1)) {
      case 'ip': return json(c.ipDene(veri.tur, veri.anahtar));
      case 'kilit/dene': return json(await c.kilitDene());
      case 'kilit/sifirla': return json(await c.kilitSifirla());
      case 'genel/kayit': return json(await c.genelKayit());
      default: return json({ hata: 'yok' }, 404);
    }
  }

  alarm() {
    return this.cekirdek.alarm();
  }
}
