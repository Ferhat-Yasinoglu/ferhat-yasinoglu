// Meta Graph API adaptörü: Facebook Sayfası'na fotoğraf / çoklu fotoğraf,
// Instagram'a tek görsel / karusel yayınlama, Instagram yayın kotası.
//
// Konaklar ve token'lar:
//   Facebook   her zaman graph.facebook.com + META_SAYFA_TOKEN.
//   Instagram  META_IG_TOKEN varsa ("Instagram API with Instagram login")
//              graph.instagram.com + o token; yoksa META_KULLANICI_TOKEN varsa
//              (uzun ömürlü kullanıcı token'ı; kap durumu sorgusu Sayfa
//              token'ıyla hata veriyordu) graph.facebook.com + o token; yoksa
//              graph.facebook.com + META_SAYFA_TOKEN.
//
// Token Authorization: Bearer başlığında gider, ASLA sorgu dizisinde (Workers
// izleri tam URL'yi kaydeder). META_APP_SECRET varsa her çağrıya
// appsecret_proof (HMAC-SHA256(app_secret, token), hex) eklenir. Token'lar ve
// app secret hiçbir yerde loglanmaz, hata mesajlarından süzülür.
//
// Her işlev `getir` (fetch) alır: testte sahte, yayında global fetch.
// (Workers'ta fetch'i bir değişkene atayıp çağırmak "Illegal invocation"
// verebilir: sarmalanır.) Instagram kabının hazır olmasını bekleyen döngünün
// `bekle`si de enjekte edilir ki test anında geçsin.

import { hex, utf8 } from './cekirdek.js';

const varsayilanGetir = (u, o) => fetch(u, o);
const varsayilanBekle = (ms) => new Promise((tamam) => setTimeout(tamam, ms));

/** Instagram kabı (container) hazır mı: en çok bu kadar sorgu, aralarında bu kadar bekleme. */
export const KAP_DENEME = 12;
export const KAP_ARALIGI = 1500;

const surum = (env) => env.GRAPH_SURUM || 'v26.0';
/** Ortamdaki bütün gizli değerler: hata mesajlarından hepsi süzülür (hangi kanalın çağrısı olursa olsun). */
const gizliler = (env) => [env.META_SAYFA_TOKEN, env.META_IG_TOKEN, env.META_KULLANICI_TOKEN, env.META_APP_SECRET].filter(Boolean);
const bag = (env, konak, token, ek = {}) => ({ konak, token, appSecret: env.META_APP_SECRET || '', gizliler: gizliler(env), ...ek });
const FB = (env) => bag(env, `https://graph.facebook.com/${surum(env)}`, env.META_SAYFA_TOKEN);

/** Instagram çağrılarının konağı ve token'ı (yukarıdaki öncelik: IG > kullanıcı > Sayfa). */
export function igBaglanti(env) {
  const fb = `https://graph.facebook.com/${surum(env)}`;
  if (env.META_IG_TOKEN) return bag(env, `https://graph.instagram.com/${surum(env)}`, env.META_IG_TOKEN, { yol: 'instagram' });
  if (env.META_KULLANICI_TOKEN) return bag(env, fb, env.META_KULLANICI_TOKEN, { yol: 'facebook' });
  return bag(env, fb, env.META_SAYFA_TOKEN, { yol: 'facebook' });
}

/** Instagram hangi konaktan gidiyor: 'instagram' (graph.instagram.com) ya da 'facebook' (graph.facebook.com). */
export const igYolu = (env) => igBaglanti(env).yol;

/** Kanalın secret'ları tam mı (değerler asla dışarı çıkmaz, yalnız var/yok). */
export function kanalBagli(env, kanal) {
  if (kanal === 'facebook') return !!(env.META_SAYFA_TOKEN && env.META_SAYFA_ID);
  if (kanal === 'instagram') return !!(env.META_IG_ID && (env.META_IG_TOKEN || env.META_KULLANICI_TOKEN || env.META_SAYFA_TOKEN));
  return false;
}

// --- hata sözlüğü -----------------------------------------------------------

/* Graph hatası → bizim kod. Uygulama bu koda göre konuşur:
     yeniden_baglan     token süresi dolmuş/geçersiz (190, her alt kod)
     izin               uygulamanın ya da hesabın izni yok (10, 200–299, 100/33)
     oran               çok istek; biraz sonra (4, 17, 32, 613; alt 2207051)
     kota               günlük yayın kotası doldu (9; alt 2207042)
     gorsel             Instagram görseli çekemedi ya da kabul etmedi (9004, 36000, 36001, 36003; alt kodları)
     metin_uzun         açıklama uzun (36004; alt 2207010)
     bekle              medya henüz hazır değil, sonra dene (9007; alt 2207027; kap döngüsü bitince)
     tekrar             aynı içerik az önce yayınlandı (506)
     kimlik_dogrulama   Meta kimlik/Sayfa yayın yetkisi onayı istiyor (mesaja göre)
     meta               gerisi */
const ANA_KODLAR = {
  190: 'yeniden_baglan', 10: 'izin', 4: 'oran', 17: 'oran', 32: 'oran', 613: 'oran', 9: 'kota',
  9004: 'gorsel', 36000: 'gorsel', 36001: 'gorsel', 36003: 'gorsel', 36004: 'metin_uzun', 9007: 'bekle', 506: 'tekrar',
};
const ALT_KODLAR = {
  2207052: 'gorsel', 2207005: 'gorsel', 2207004: 'gorsel', 2207009: 'gorsel', 2207010: 'metin_uzun', 2207042: 'kota', 2207051: 'oran', 2207027: 'bekle',
};
const KIMLIK_DOGRULAMA = /identity|Page Publishing Authorization|confirm your identity/i;

/** `hataKodu(kod, altKod, mesaj)`: 190 her şeyden önce (çare yeniden bağlanmak); sonra mesajdaki kimlik onayı; sonra alt kod, ana kod. */
export function hataKodu(kod, altKod, mesaj) {
  if (kod === 190) return 'yeniden_baglan';
  if (KIMLIK_DOGRULAMA.test(String(mesaj || ''))) return 'kimlik_dogrulama';
  if (kod === 100 && altKod === 33) return 'izin';
  if (ALT_KODLAR[altKod]) return ALT_KODLAR[altKod];
  if (ANA_KODLAR[kod]) return ANA_KODLAR[kod];
  if (kod >= 200 && kod <= 299) return 'izin';
  return 'meta';
}

/** Meta'dan dönen hata: `kod` bizim kodumuz, `metaKod`/`metaAltKod` Graph'ın sayıları (yoksa null). Mesajda gizli değer yok. */
export class MetaHatasi extends Error {
  constructor(kod, metaKod, metaAltKod, mesaj) { super(mesaj); this.kod = kod; this.metaKod = metaKod; this.metaAltKod = metaAltKod; }
}

/** Metinden gizli değerleri siler: `access_token=…` kalıbı ve bilinen değerlerin kendisi. */
export function gizle(metin, ...gizli) {
  let s = String(metin ?? '').replace(/access_token=[^&\s"'<>]*/gi, 'access_token=***');
  for (const g of gizli) if (g) s = s.split(g).join('***');
  return s;
}

const sayi = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : null));

/** appsecret_proof: HMAC-SHA256(app_secret, token), küçük harf hex. */
async function appsecretProof(token, appSecret) {
  const anahtar = await globalThis.crypto.subtle.importKey('raw', utf8(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', anahtar, utf8(token))));
}

/**
 * Tek Graph çağrısı. POST alanları form gövdesinde, GET alanları sorguda;
 * token Authorization başlığında; appsecret_proof (varsa) öteki alanlar gibi.
 * Ağ hatası da MetaHatasi('meta') olur: çağıran tek tür yakalar.
 */
async function graph(getir, b, { yol, method = 'POST', alanlar = {} }) {
  const { konak, token, appSecret, gizliler: gizli = [] } = b;
  if (!token) throw new MetaHatasi('yeniden_baglan', null, null, `${yol}: token yok`);
  const url = new URL(`${konak}/${yol}`);
  const alan = { ...alanlar };
  if (appSecret) alan.appsecret_proof = await appsecretProof(token, appSecret);
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(alan)) {
    if (v === undefined || v === null || v === '') continue;
    if (method === 'GET') url.searchParams.set(k, String(v)); else form.set(k, String(v));
  }
  const basliklar = { Accept: 'application/json', Authorization: `Bearer ${token}` };
  if (method !== 'GET') basliklar['Content-Type'] = 'application/x-www-form-urlencoded';
  let r;
  try {
    r = await getir(url.toString(), { method, headers: basliklar, body: method === 'GET' ? undefined : form.toString() });
  } catch (e) {
    throw new MetaHatasi('meta', null, null, `${yol}: ${gizle(e?.message || 'ağ hatası', ...gizli)}`);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.error) {
    const h = j?.error || {};
    const metaKod = sayi(h.code);
    const altKod = sayi(h.error_subcode);
    const mesaj = [h.message, h.error_user_title, h.error_user_msg].filter(Boolean).join(' | ') || `HTTP ${r.status}`;
    throw new MetaHatasi(hataKodu(metaKod, altKod, mesaj), metaKod, altKod, `${yol}: ${gizle(mesaj, ...gizli)}`.slice(0, 300));
  }
  return j;
}

// --- Facebook Sayfası -------------------------------------------------------

/** Tek fotoğraf, hemen yayında (`caption`; Meta `message`ı kaldırdı). Döner `{ id, post_id }`. */
export async function fbFotoYayinla(env, { gorselAdresi, mesaj = '' }, getir = varsayilanGetir) {
  const r = await graph(getir, FB(env), { yol: `${env.META_SAYFA_ID}/photos`, alanlar: { url: gorselAdresi, caption: mesaj, published: 'true' } });
  return { id: String(r.id), post_id: r.post_id ? String(r.post_id) : undefined };
}

/**
 * Birden çok fotoğraf tek gönderide: her fotoğraf yayınlanmadan (published=false)
 * yüklenir, sonra Sayfa akışına hepsi bağlanmış tek gönderi (`message`) yazılır. Döner `{ id }`.
 */
export async function fbCokluYayinla(env, { gorselAdresleri, mesaj = '' }, getir = varsayilanGetir) {
  const fb = FB(env);
  const kimlikler = [];
  for (const adres of gorselAdresleri) {
    const r = await graph(getir, fb, { yol: `${env.META_SAYFA_ID}/photos`, alanlar: { url: adres, published: 'false' } });
    kimlikler.push(String(r.id));
  }
  const r = await graph(getir, fb, {
    yol: `${env.META_SAYFA_ID}/feed`,
    alanlar: { message: mesaj, attached_media: JSON.stringify(kimlikler.map((id) => ({ media_fbid: id }))) },
  });
  return { id: String(r.id) };
}

// --- Instagram --------------------------------------------------------------

/**
 * Kap (container) hazır olana dek sorar: FINISHED → döner; ERROR/EXPIRED →
 * 'gorsel' (Instagram görseli çekemedi ya da kabul etmedi); deneme biterse 'bekle'.
 */
async function kapBekle(getir, b, id, bekle) {
  for (let i = 0; i < KAP_DENEME; i++) {
    if (i) await bekle(KAP_ARALIGI);
    const r = await graph(getir, b, { yol: id, method: 'GET', alanlar: { fields: 'status_code,status' } });
    const durum = String(r.status_code || '');
    if (durum === 'FINISHED' || durum === 'PUBLISHED') return;
    if (durum === 'ERROR' || durum === 'EXPIRED') {
      throw new MetaHatasi('gorsel', null, null, `${id}: ${durum} ${gizle(r.status || '', ...b.gizliler)}`.slice(0, 300));
    }
  }
  throw new MetaHatasi('bekle', null, null, `${id}: kap ${KAP_DENEME} denemede hazır olmadı`);
}

/** Tek görsel: kap (image_url, caption, alt_text?) → hazır → yayınla. Döner `{ id }`. */
export async function igYayinla(env, { gorselAdresi, aciklama = '', altMetin = '' }, getir = varsayilanGetir, { bekle = varsayilanBekle } = {}) {
  const b = igBaglanti(env);
  const kap = await graph(getir, b, { yol: `${env.META_IG_ID}/media`, alanlar: { image_url: gorselAdresi, caption: aciklama, alt_text: altMetin } });
  await kapBekle(getir, b, String(kap.id), bekle);
  const y = await graph(getir, b, { yol: `${env.META_IG_ID}/media_publish`, alanlar: { creation_id: String(kap.id) } });
  return { id: String(y.id) };
}

/**
 * Karusel (2–10 görsel): her çocuk is_carousel_item=true, açıklamasız (alt_text
 * varsa her çocukta) bir kap; hepsi hazır olunca CAROUSEL kabı (children +
 * caption), o da hazır olunca yayın. Döner `{ id }`.
 */
export async function igKaruselYayinla(env, { gorselAdresleri, aciklama = '', altMetin = '' }, getir = varsayilanGetir, { bekle = varsayilanBekle } = {}) {
  if (!Array.isArray(gorselAdresleri) || gorselAdresleri.length < 2 || gorselAdresleri.length > 10) {
    throw new MetaHatasi('gorsel', null, null, 'karusel 2–10 görsel ister');
  }
  const b = igBaglanti(env);
  const cocuklar = [];
  for (const adres of gorselAdresleri) {
    const r = await graph(getir, b, { yol: `${env.META_IG_ID}/media`, alanlar: { image_url: adres, is_carousel_item: 'true', alt_text: altMetin } });
    cocuklar.push(String(r.id));
  }
  for (const id of cocuklar) await kapBekle(getir, b, id, bekle);
  const kap = await graph(getir, b, { yol: `${env.META_IG_ID}/media`, alanlar: { media_type: 'CAROUSEL', children: cocuklar.join(','), caption: aciklama } });
  await kapBekle(getir, b, String(kap.id), bekle);
  const y = await graph(getir, b, { yol: `${env.META_IG_ID}/media_publish`, alanlar: { creation_id: String(kap.id) } });
  return { id: String(y.id) };
}

/** Günlük API yayın kotası: `{ kullanilan, sinir }`; yanıt beklenen biçimde değilse null. */
export async function igKota(env, getir = varsayilanGetir) {
  const r = await graph(getir, igBaglanti(env), { yol: `${env.META_IG_ID}/content_publishing_limit`, method: 'GET', alanlar: { fields: 'quota_usage,config' } });
  const v = Array.isArray(r.data) ? r.data[0] : null;
  if (!v || typeof v.quota_usage !== 'number') return null;
  return { kullanilan: v.quota_usage, sinir: typeof v.config?.quota_total === 'number' ? v.config.quota_total : null };
}
