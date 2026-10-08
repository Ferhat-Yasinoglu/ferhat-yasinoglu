// Google ile giriş: "Sign in with Google" düğmesinin verdiği kimlik jetonunun
// (ID token, JWT) doğrulanması. Bağımlılık yok: RS256 imzası WebCrypto ile,
// Google'ın yayımladığı açık anahtarlara (JWKS) karşı denetlenir.
//
// Neden kendimiz: jetonu Google'ın tokeninfo ucuna sormak her girişte bir ağ
// gidiş-dönüşü ve Google'a bağımlı bir hız sınırı demek. Anahtarlar ise
// saatlerce değişmez; isolate başına önbellekte tutulur.
//
// Denetlenenler: alg RS256 + bilinen kid, imza, iss (accounts.google.com),
// aud (bizim OAuth istemci kimliğimiz), exp/iat/nbf (±5 dk saat kayması),
// email_verified === true. Hata ayrıntısı dışarı verilmez: hepsi 401 `kimlik`.

import { ApiHatasi, b64urlOku, epostaGecerli, epostaNormal, ozetHex, resimAdresi, temizMetin, utf8 } from './cekirdek.js';

export const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';
const IHRACCILAR = new Set(['accounts.google.com', 'https://accounts.google.com']);
/** Saat kayması payı (saniye): telefonun ya da sunucunun saati biraz kaymış olabilir. */
export const SAAT_KAYMASI = 5 * 60;
/** Bilinmeyen kid için JWKS en çok dakikada bir yeniden çekilir: uydurma kid'li
 *  jeton yağdıran biri Google'a istek yağdıramasın. */
export const YENILEME_ARALIGI = 60 * 1000;
/** JWKS isteği bu kadar sürerse bırakılır: Google'a giden yol takılırsa bütün
 *  girişler (aynı çekimi bekledikleri için) sonsuza dek asılı kalmasın. */
export const CEKIM_ZAMAN_ASIMI = 8000;
const VARSAYILAN_OMUR = 60 * 60 * 1000;
const EN_UZUN_OMUR = 24 * 60 * 60 * 1000;
const JETON_SINIRI = 4096;
const RS256 = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };

/** JWKS adresi → { anahtarlar: Map(kid → CryptoKey), bitis, sonCekim, hata, cekim } */
const onbellek = new Map();

/** Testler için: isolate önbelleğini boşaltır. */
export function jwksOnbelleginiSifirla() { onbellek.clear(); }

const kimlikHatasi = () => new ApiHatasi(401, 'kimlik');
const cozucu = new TextDecoder('utf-8', { fatal: true });

function jsonParca(b64) {
  const b = b64urlOku(b64);
  if (!b) return null;
  try {
    const v = JSON.parse(cozucu.decode(b));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch { return null; }
}

/**
 * `başlık.yük.imza` → parçalar; biçim bozuksa null. İmza burada DENETLENMEZ.
 * `govde` imzalanan metindir (`başlık.yük`).
 */
export function jwtCoz(jeton) {
  if (typeof jeton !== 'string' || !jeton || jeton.length > JETON_SINIRI) return null;
  const p = jeton.split('.');
  if (p.length !== 3) return null;
  const baslik = jsonParca(p[0]);
  const yuk = jsonParca(p[1]);
  const imza = b64urlOku(p[2]);
  if (!baslik || !yuk || !imza?.length) return null;
  const govde = `${p[0]}.${p[1]}`;
  return { baslik, yuk, imza, govde, imzali: utf8(govde) };
}

/** Google JWKS yanıtını `Cache-Control: max-age` kadar tutar (1 dk – 24 saat). */
function omurBul(cacheControl) {
  const m = /max-age=(\d+)/i.exec(cacheControl || '');
  const ms = m ? Number(m[1]) * 1000 : VARSAYILAN_OMUR;
  return Math.min(Math.max(ms, YENILEME_ARALIGI), EN_UZUN_OMUR);
}

async function anahtarlariCek(adres, getir, zamanAsimi) {
  const r = await getir(adres, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(zamanAsimi) });
  if (!r.ok) throw new Error('jwks ' + r.status);
  const veri = await r.json();
  const anahtarlar = new Map();
  for (const k of Array.isArray(veri?.keys) ? veri.keys : []) {
    if (k?.kty !== 'RSA' || typeof k.kid !== 'string' || typeof k.n !== 'string' || typeof k.e !== 'string') continue;
    if ((k.use && k.use !== 'sig') || (k.alg && k.alg !== 'RS256')) continue;
    try {
      anahtarlar.set(k.kid, await globalThis.crypto.subtle.importKey('jwk', { kty: 'RSA', n: k.n, e: k.e }, RS256, false, ['verify']));
    } catch { /* bozuk anahtar atlanır; ötekiler kullanılır */ }
  }
  return { anahtarlar, omur: omurBul(r.headers.get('Cache-Control')) };
}

/* Aynı anda gelen girişler tek çekimi paylaşır. Çekim başarısızsa eski
   anahtarlar (varsa) kullanılmaya devam eder: Google'a bir an ulaşılamaması
   bütün girişleri durdurmasın.

   Paylaşılan çekim, onu başlatan isteğin bağlamında çalışır. workerd'de o
   istek iptal olursa G/Ç'si de iptal edilir ve söz hiç sonuçlanmayabilir;
   bu yüzden her bekleyen KENDİ zamanlayıcısıyla en çok `zamanAsimi` bekler ve
   süresini aşmış bir çekim ölü sayılıp yerine yenisi başlatılır. Döner: çekim bitti mi. */
async function yenile(g, adres, getir, zamanAsimi) {
  const simdi = Date.now();
  if (!g.cekim || simdi - g.cekimBas > zamanAsimi) {
    g.sonCekim = g.cekimBas = simdi;
    const cekim = (async () => {
      try {
        const y = await anahtarlariCek(adres, getir, zamanAsimi);
        g.anahtarlar = y.anahtarlar;
        g.bitis = Date.now() + y.omur;
        g.hata = false;
      } catch {
        g.hata = true;
      } finally {
        if (g.cekim === cekim) g.cekim = null;
      }
    })();
    g.cekim = cekim;
  }
  let zamanlayici;
  const sure = new Promise((tamam) => { zamanlayici = setTimeout(() => tamam(false), zamanAsimi); });
  try {
    return await Promise.race([g.cekim.then(() => true), sure]);
  } finally {
    clearTimeout(zamanlayici);
  }
}

async function anahtarBul(adres, kid, getir, zamanAsimi) {
  let g = onbellek.get(adres);
  if (!g) {
    g = { anahtarlar: new Map(), bitis: 0, sonCekim: -Infinity, cekimBas: 0, hata: false, cekim: null };
    onbellek.set(adres, g);
  }
  const simdi = Date.now();
  const taze = simdi < g.bitis;
  if (taze && g.anahtarlar.has(kid)) return g.anahtarlar.get(kid);
  let bitti = true;
  if (g.cekim || simdi - g.sonCekim >= YENILEME_ARALIGI) bitti = await yenile(g, adres, getir, zamanAsimi);
  // Hiç anahtar yok ve Google'a ulaşılamadı: bu kullanıcının değil sunucunun sorunu.
  if (!g.anahtarlar.size && (g.hata || !bitti)) throw new ApiHatasi(503, 'sunucu');
  return g.anahtarlar.get(kid) ?? null;
}

/**
 * Google kimlik jetonunu doğrular. Döner: `{ eposta (normalleşmiş), ad, resim,
 * sub, bitis (ms), tekrarAnahtari (imzalanan metnin SHA-256'sı) }`. Her hata
 * 401 `kimlik`; istemci kimliği yapılandırılmamışsa 503 `yapilandirma`;
 * JWKS'e ulaşılamıyor ve elde hiç anahtar yoksa 503 `sunucu`.
 *
 * `getir` testte JWKS'i sunmak için; yayında global fetch. (Workers'ta fetch'i
 * bir değişkene atayıp çağırmak "Illegal invocation" verebilir: sarmalanır.)
 */
export async function googleDogrula(jeton, { istemciKimligi, jwksAdresi, getir = (u, o) => fetch(u, o), zamanAsimi = CEKIM_ZAMAN_ASIMI } = {}) {
  if (!istemciKimligi) throw new ApiHatasi(503, 'yapilandirma');
  const j = jwtCoz(jeton);
  if (!j || j.baslik.alg !== 'RS256' || typeof j.baslik.kid !== 'string' || !j.baslik.kid || j.baslik.kid.length > 200) throw kimlikHatasi();
  const anahtar = await anahtarBul(jwksAdresi || GOOGLE_JWKS, j.baslik.kid, getir, zamanAsimi);
  if (!anahtar) throw kimlikHatasi();
  let dogru = false;
  try { dogru = await globalThis.crypto.subtle.verify(RS256, anahtar, j.imza, j.imzali); } catch { dogru = false; }
  if (!dogru) throw kimlikHatasi();

  // İmza doğru: bundan sonra yük Google'ın yazdığıdır, ama BİZE mi ve hâlâ geçerli mi?
  const y = j.yuk;
  const simdi = Date.now() / 1000;
  const sayi = (v) => typeof v === 'number' && Number.isFinite(v);
  if (!IHRACCILAR.has(y.iss)) throw kimlikHatasi();
  if (y.aud !== istemciKimligi) throw kimlikHatasi();
  if (!sayi(y.exp) || simdi > y.exp + SAAT_KAYMASI) throw kimlikHatasi();
  if (!sayi(y.iat) || y.iat - SAAT_KAYMASI > simdi) throw kimlikHatasi();
  if (y.nbf !== undefined && (!sayi(y.nbf) || y.nbf - SAAT_KAYMASI > simdi)) throw kimlikHatasi();
  if (typeof y.sub !== 'string' || !y.sub) throw kimlikHatasi();
  // Doğrulanmamış adres başkasının Gmail'ini "sahiplenmek" olurdu.
  if (y.email_verified !== true || typeof y.email !== 'string') throw kimlikHatasi();
  const eposta = epostaNormal(y.email);
  if (!epostaGecerli(eposta)) throw kimlikHatasi();
  return {
    eposta, ad: temizMetin(y.name, 100), resim: resimAdresi(y.picture), sub: y.sub,
    bitis: (y.exp + SAAT_KAYMASI) * 1000, tekrarAnahtari: await ozetHex(j.govde),
  };
}
