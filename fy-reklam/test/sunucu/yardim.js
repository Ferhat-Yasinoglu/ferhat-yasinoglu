// Sunucu testlerinin ortak kurulumu: Worker'ın kendisi (worker.js) bellekteki
// DO taklidiyle (yerel.mjs, node:sqlite) çalıştırılır; istekler gerçek
// Request/Response. Google'ın yerine testin kendi RSA anahtarı geçer: JWKS bir
// data: adresinden sunulur (env.GOOGLE_JWKS), jetonları test kendisi imzalar.
// Meta'nın yerine `metaTaklidi` geçer: Worker'a `getir` olarak verilir, her
// çağrıyı kaydeder ve Graph API gibi yanıtlar.
import { isleyici } from '../../sunucu/worker.js';
import { bellekOrtami } from '../../sunucu/yerel.mjs';
import { b64urlYaz, utf8 } from '../../sunucu/cekirdek.js';

export const KOK = 'https://fy-reklam-sunucu.test';
export const KOKEN = 'https://fy-reklam.pages.dev';
export const ISTEMCI = 'fy-reklam-test.apps.googleusercontent.com';
export const SAHIP = 'sahip@fy.af';
export const ARKADAS = 'arkadas@fy.af';

const RS256 = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };

/** Sahte "Google": RSA anahtar çifti + onu yayımlayan JWKS (data: adresi). */
export async function googleTaklidi(kid = 'test-anahtar-1') {
  const cift = await crypto.subtle.generateKey({ ...RS256, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ['sign', 'verify']);
  const acik = await crypto.subtle.exportKey('jwk', cift.publicKey);
  const jwks = { keys: [{ kty: 'RSA', n: acik.n, e: acik.e, kid, alg: 'RS256', use: 'sig' }] };
  return { cift, kid, jwks, adres: 'data:application/json,' + encodeURIComponent(JSON.stringify(jwks)) };
}

export const GOOGLE = await googleTaklidi();

const parca = (o) => b64urlYaz(utf8(JSON.stringify(o)));

/** Verilen başlık ve yükle RS256 imzalı JWT. */
export async function jwtImzala(baslik, yuk, ozelAnahtar) {
  const govde = `${parca(baslik)}.${parca(yuk)}`;
  const imza = new Uint8Array(await crypto.subtle.sign(RS256, ozelAnahtar, utf8(govde)));
  return `${govde}.${b64urlYaz(imza)}`;
}

/** Google'ın vereceği gibi bir kimlik jetonu; `ek` alanları ezer (undefined → alan yok). */
export function googleJetonu(eposta, ek = {}, { google = GOOGLE, baslik = {} } = {}) {
  const simdi = Math.floor(Date.now() / 1000);
  const yuk = {
    iss: 'https://accounts.google.com', azp: ISTEMCI, aud: ISTEMCI, sub: 'g-' + eposta,
    email: eposta, email_verified: true, name: 'Kullanıcı ' + eposta.split('@')[0],
    picture: 'https://lh3.googleusercontent.com/a/ornek', iat: simdi, nbf: simdi - 30, exp: simdi + 3600,
    jti: crypto.randomUUID(), ...ek,
  };
  for (const a of Object.keys(yuk)) if (yuk[a] === undefined) delete yuk[a];
  return jwtImzala({ alg: 'RS256', kid: google.kid, typ: 'JWT', ...baslik }, yuk, google.cift.privateKey);
}

/** Geçerli görünen bir JPEG gövdesi: FF D8 FF E0 … FF D9, istenen boyutta. */
export function jpeg(boyut = 2048) {
  const b = new Uint8Array(boyut);
  b.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
  for (let i = 11; i < boyut - 2; i++) b[i] = (i * 31) & 0xff;
  b[boyut - 2] = 0xff; b[boyut - 1] = 0xd9;
  return b;
}

/** PNG imzası: JPEG değil. */
export const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1]);

/**
 * Sahte Meta Graph API. Her çağrı `cagrilar`a yazılır:
 *   { konak, yol, method, query, govde, alanlar (ikisinin birleşimi), ham }
 * Yanıtlar: photos → id (published=true ise post_id de), feed → id,
 * media → kap id, media_publish → medya id, status sorgusu → `durumlar`
 * dizisinden sırayla (son değer tekrar eder), content_publishing_limit → kota.
 * `hata` verilirse HER çağrı o Graph hatasıyla döner.
 */
export function metaTaklidi({ durumlar = ['FINISHED'], hata = null, kota = { quota_usage: 3, config: { quota_total: 50, quota_duration: 'DAY' } } } = {}) {
  const t = { cagrilar: [], durumlar, hata, kota };
  let sayac = 0;
  let durumIndeksi = 0;
  const yanit = (v, durum = 200) => new Response(JSON.stringify(v), { status: durum, headers: { 'Content-Type': 'application/json' } });
  t.getir = async (girdi, ayar = {}) => {
    const url = new URL(String(girdi));
    const method = ayar.method || 'GET';
    const query = Object.fromEntries(url.searchParams);
    const govde = ayar.body ? Object.fromEntries(new URLSearchParams(String(ayar.body))) : {};
    const cagri = { konak: url.host, yol: url.pathname, method, query, govde, alanlar: { ...query, ...govde }, ham: `${url} ${ayar.body || ''}` };
    t.cagrilar.push(cagri);
    if (t.hata) return yanit({ error: { message: t.hata.message || 'Meta hatası', type: 'OAuthException', code: t.hata.code, fbtrace_id: 'xyz' } }, t.hata.durum || 400);
    const yol = url.pathname;
    if (/\/photos$/.test(yol)) return yanit({ id: `foto${++sayac}`, ...(cagri.alanlar.published === 'true' ? { post_id: `sayfa_${sayac}` } : {}) });
    if (/\/feed$/.test(yol)) return yanit({ id: `akis_${++sayac}` });
    if (/\/media$/.test(yol)) return yanit({ id: `kap${++sayac}` });
    if (/\/media_publish$/.test(yol)) return yanit({ id: `ig_${++sayac}` });
    if (/\/content_publishing_limit$/.test(yol)) return yanit({ data: [t.kota] });
    if (method === 'GET' && cagri.alanlar.fields === 'status_code,status') {
      const d = t.durumlar[Math.min(durumIndeksi++, t.durumlar.length - 1)];
      return yanit({ status_code: d, status: d === 'ERROR' ? 'Error: Media download failed' : d, id: yol.split('/').pop() });
    }
    return yanit({ error: { message: 'bilinmeyen yol ' + yol, code: 100 } }, 400);
  };
  return t;
}

/** Testte izin verilmeyen dış çağrı: hata olarak görünsün (502 meta), sessizce geçmesin. */
const beklenmeyenGetir = async (u) => { throw new Error('beklenmeyen dış çağrı: ' + new URL(String(u)).host); };

/**
 * Ortam + Worker + istemci yardımcıları. `degiskenler` env'i ezer (PROVA,
 * META_*, REKLAMCILAR…); `getir`/`bekle` Worker'a verilir (Meta için).
 */
export function kur(degiskenler = {}, { getir = beklenmeyenGetir, bekle = async () => {} } = {}) {
  const env = bellekOrtami({
    GOOGLE_ISTEMCI_KIMLIGI: ISTEMCI, GOOGLE_JWKS: GOOGLE.adres, REKLAMCILAR: `${SAHIP}, ${ARKADAS}`, IZINLI_KOKENLER: KOKEN, PROVA: '1', ...degiskenler,
  });
  const worker = isleyici({ getir, bekle });

  /**
   * Worker'a tek istek. `yol` '/' ile başlıyorsa olduğu gibi, yoksa /v1/ altı.
   * `govde` nesneyse JSON, Uint8Array ise ham (tür `tur` ile). `koken: null` → Origin yok.
   */
  const iste = async (yol, { method = 'GET', govde, jeton, ip = '203.0.113.7', koken = KOKEN, basliklar = {}, tur } = {}) => {
    const h = new Headers(basliklar);
    if (koken) h.set('Origin', koken);
    if (ip) h.set('CF-Connecting-IP', ip);
    if (jeton) h.set('Authorization', 'Bearer ' + jeton);
    let body = govde;
    if (govde !== undefined && typeof govde !== 'string' && !(govde instanceof Uint8Array)) {
      body = JSON.stringify(govde);
      h.set('Content-Type', 'application/json');
    }
    if (tur) h.set('Content-Type', tur);
    return worker.fetch(new Request(KOK + (yol.startsWith('/') ? yol : '/v1/' + yol), { method, headers: h, body }), env);
  };

  const jsonIste = async (yol, secenek) => {
    const r = await iste(yol, secenek);
    return { durum: r.status, veri: r.status === 204 ? null : await r.json(), r };
  };

  /** Google jetonuyla giriş isteği (yanıtın kendisi). */
  const girisYap = async (eposta, { ip, jetonEk, kimlik, google } = {}) =>
    jsonIste('giris', { method: 'POST', ip, govde: { kimlik: kimlik ?? await googleJetonu(eposta, jetonEk, { google }) } });

  /** Başarılı giriş; oturum jetonunu döndürür. */
  const gir = async (eposta = SAHIP, secenek) => {
    const r = await girisYap(eposta, secenek);
    if (r.durum !== 200) throw new Error(`giriş olmadı (${eposta}): ${r.durum} ${JSON.stringify(r.veri)}`);
    return r.veri.jeton;
  };

  /** JPEG yükler; `{ durum, veri }`. */
  const gorselYukle = (jeton, baytlar = jpeg(), tur = 'image/jpeg') => jsonIste('gorsel', { method: 'POST', jeton, govde: baytlar, tur });

  /** Yüklenmiş `n` görselin kimlikleri. */
  const gorseller = async (jeton, n = 1) => {
    const liste = [];
    for (let i = 0; i < n; i++) {
      const r = await gorselYukle(jeton, jpeg(1024 + i));
      if (r.durum !== 200) throw new Error(`görsel yüklenemedi: ${r.durum} ${JSON.stringify(r.veri)}`);
      liste.push(r.veri.id);
    }
    return liste;
  };

  const cekirdek = () => env.REKLAM.nesne('reklam').cekirdek;
  const sql = (sorgu, ...b) => cekirdek().sql.exec(sorgu, ...b).toArray();

  return { env, worker, iste, jsonIste, girisYap, gir, gorselYukle, gorseller, cekirdek, sql };
}
