// Meta Graph API adaptörü: Facebook Sayfası'na fotoğraf / çoklu fotoğraf,
// Instagram'a tek görsel / karusel yayınlama, Instagram yayın kotası.
//
// Konaklar: Facebook her zaman graph.facebook.com + Sayfa token'ı. Instagram
// "API setup with Instagram login" ile kurulduysa META_IG_TOKEN vardır ve
// çağrılar graph.instagram.com'a o token'la gider; yoksa Instagram hesabı
// Sayfa'ya bağlıdır, graph.facebook.com + Sayfa token'ı kullanılır.
//
// Her işlev `getir` (fetch) alır: testte sahte, yayında global fetch.
// (Workers'ta fetch'i bir değişkene atayıp çağırmak "Illegal invocation"
// verebilir: sarmalanır.) Instagram kabının hazır olmasını bekleyen döngünün
// `bekle`si de enjekte edilir ki test anında geçsin.
//
// access_token YALNIZ sorgu dizisinde gider, hiçbir yerde loglanmaz ve hata
// mesajlarından süzülür (Meta'nın mesajı adresi yankılasa bile).

const varsayilanGetir = (u, o) => fetch(u, o);
const varsayilanBekle = (ms) => new Promise((tamam) => setTimeout(tamam, ms));

/** Instagram kabı (container) hazır mı: en çok bu kadar sorgu, aralarında bu kadar bekleme. */
export const KAP_DENEME = 12;
export const KAP_ARALIGI = 1500;

const surum = (env) => env.GRAPH_SURUM || 'v26.0';
/** Ortamdaki bütün token'lar: hata mesajlarından hepsi süzülür (hangi kanalın çağrısı olursa olsun). */
const gizliler = (env) => [env.META_SAYFA_TOKEN, env.META_IG_TOKEN].filter(Boolean);
const FB = (env) => ({ konak: `https://graph.facebook.com/${surum(env)}`, token: env.META_SAYFA_TOKEN, gizliler: gizliler(env) });

/** Instagram çağrılarının konağı ve token'ı (yukarıdaki kurala göre). */
export const igBaglanti = (env) => (env.META_IG_TOKEN
  ? { konak: `https://graph.instagram.com/${surum(env)}`, token: env.META_IG_TOKEN, yol: 'instagram', gizliler: gizliler(env) }
  : { konak: `https://graph.facebook.com/${surum(env)}`, token: env.META_SAYFA_TOKEN, yol: 'facebook', gizliler: gizliler(env) });

/** Instagram hangi yoldan gidiyor: 'instagram' (kendi token'ı) ya da 'facebook' (Sayfa token'ı). */
export const igYolu = (env) => igBaglanti(env).yol;

/** Kanalın secret'ları tam mı (değerler asla dışarı çıkmaz, yalnız var/yok). */
export function kanalBagli(env, kanal) {
  if (kanal === 'facebook') return !!(env.META_SAYFA_TOKEN && env.META_SAYFA_ID);
  if (kanal === 'instagram') return !!(env.META_IG_ID && (env.META_IG_TOKEN || env.META_SAYFA_TOKEN));
  return false;
}

/**
 * Graph hata kodu → bizim kod. Uygulama bu koda göre konuşur: 'yeniden_baglan'
 * (token süresi dolmuş/geçersiz), 'izin' (uygulamanın ya da hesabın izni yok),
 * 'oran' (çok istek; biraz sonra), 'gorsel' (Instagram görseli çekemedi ya da
 * beğenmedi: boyut, oran, biçim), 'meta' (gerisi).
 */
export function hataKodu(kod) {
  if (kod === 190) return 'yeniden_baglan';
  if (kod === 10 || (kod >= 200 && kod <= 299)) return 'izin';
  if (kod === 4 || kod === 17 || kod === 32 || kod === 613) return 'oran';
  if (kod === 9004 || (kod >= 36000 && kod <= 36007)) return 'gorsel';
  return 'meta';
}

/** Meta'dan dönen hata: `kod` bizim kodumuz, `metaKod` Graph'ın sayısı (yoksa null). Mesajda token yok. */
export class MetaHatasi extends Error {
  constructor(kod, metaKod, mesaj) { super(mesaj); this.kod = kod; this.metaKod = metaKod; }
}

/** Metinden token'ı siler: hem `access_token=…` kalıbı hem de bilinen değerin kendisi. */
export function gizle(metin, ...gizliler) {
  let s = String(metin ?? '').replace(/access_token=[^&\s"'<>]*/gi, 'access_token=***');
  for (const g of gizliler) if (g) s = s.split(g).join('***');
  return s;
}

/**
 * Tek Graph çağrısı. POST alanları form gövdesinde, GET alanları sorguda;
 * access_token her zaman sorguda. Ağ hatası da MetaHatasi('meta') olur:
 * çağıran tek tür yakalar.
 */
async function graph(getir, { konak, token, yol, method = 'POST', alanlar = {}, gizliler: gizli = [token] }) {
  if (!token) throw new MetaHatasi('yeniden_baglan', null, `${yol}: token yok`);
  const url = new URL(`${konak}/${yol}`);
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(alanlar)) {
    if (v === undefined || v === null) continue;
    if (method === 'GET') url.searchParams.set(k, String(v)); else form.set(k, String(v));
  }
  url.searchParams.set('access_token', token);
  let r;
  try {
    r = await getir(url.toString(), {
      method,
      headers: method === 'GET' ? { Accept: 'application/json' } : { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: method === 'GET' ? undefined : form.toString(),
    });
  } catch (e) {
    throw new MetaHatasi('meta', null, `${yol}: ${gizle(e?.message || 'ağ hatası', token, ...gizli)}`);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.error) {
    const sayi = Number(j?.error?.code);
    const metaKod = Number.isFinite(sayi) ? sayi : null;
    throw new MetaHatasi(hataKodu(metaKod), metaKod, `${yol}: ${gizle(j?.error?.message || `HTTP ${r.status}`, token, ...gizli)}`.slice(0, 300));
  }
  return j;
}

// --- Facebook Sayfası -------------------------------------------------------

/** Tek fotoğraf, hemen yayında. Döner `{ id, post_id }` (post_id Sayfa gönderisi; yoksa yalnız fotoğraf kimliği). */
export async function fbFotoYayinla(env, { gorselAdresi, mesaj = '' }, getir = varsayilanGetir) {
  const r = await graph(getir, { ...FB(env), yol: `${env.META_SAYFA_ID}/photos`, alanlar: { url: gorselAdresi, message: mesaj, published: 'true' } });
  return { id: String(r.id), post_id: r.post_id ? String(r.post_id) : undefined };
}

/**
 * Birden çok fotoğraf tek gönderide: her fotoğraf yayınlanmadan (published=false)
 * yüklenir, sonra Sayfa akışına hepsi bağlanmış tek gönderi yazılır. Döner `{ id }`.
 */
export async function fbCokluYayinla(env, { gorselAdresleri, mesaj = '' }, getir = varsayilanGetir) {
  const fb = FB(env);
  const kimlikler = [];
  for (const adres of gorselAdresleri) {
    const r = await graph(getir, { ...fb, yol: `${env.META_SAYFA_ID}/photos`, alanlar: { url: adres, published: 'false' } });
    kimlikler.push(String(r.id));
  }
  const r = await graph(getir, {
    ...fb, yol: `${env.META_SAYFA_ID}/feed`,
    alanlar: { message: mesaj, attached_media: JSON.stringify(kimlikler.map((id) => ({ media_fbid: id }))) },
  });
  return { id: String(r.id) };
}

// --- Instagram --------------------------------------------------------------

/**
 * Kap (container) hazır olana dek sorar: FINISHED → döner; ERROR/EXPIRED →
 * 'gorsel' (Instagram görseli çekemedi ya da kabul etmedi); deneme biterse 'meta'.
 */
async function kapBekle(getir, bag, id, bekle) {
  for (let i = 0; i < KAP_DENEME; i++) {
    if (i) await bekle(KAP_ARALIGI);
    const r = await graph(getir, { ...bag, yol: id, method: 'GET', alanlar: { fields: 'status_code,status' } });
    const durum = String(r.status_code || '');
    if (durum === 'FINISHED' || durum === 'PUBLISHED') return;
    if (durum === 'ERROR' || durum === 'EXPIRED') {
      throw new MetaHatasi('gorsel', null, `${id}: ${durum} ${gizle(r.status || '', bag.token, ...(bag.gizliler || []))}`.slice(0, 300));
    }
  }
  throw new MetaHatasi('meta', null, `${id}: kap ${KAP_DENEME} denemede hazır olmadı`);
}

/** Tek görsel: kap → hazır → yayınla. Döner `{ id }` (Instagram medya kimliği). */
export async function igYayinla(env, { gorselAdresi, aciklama = '' }, getir = varsayilanGetir, { bekle = varsayilanBekle } = {}) {
  const bag = igBaglanti(env);
  const kap = await graph(getir, { ...bag, yol: `${env.META_IG_ID}/media`, alanlar: { image_url: gorselAdresi, caption: aciklama } });
  await kapBekle(getir, bag, String(kap.id), bekle);
  const y = await graph(getir, { ...bag, yol: `${env.META_IG_ID}/media_publish`, alanlar: { creation_id: String(kap.id) } });
  return { id: String(y.id) };
}

/**
 * Karusel (2–10 görsel): her çocuk is_carousel_item=true ve açıklamasız bir
 * kap; hepsi hazır olunca CAROUSEL kabı (children + caption), o da hazır
 * olunca yayın. Döner `{ id }`.
 */
export async function igKaruselYayinla(env, { gorselAdresleri, aciklama = '' }, getir = varsayilanGetir, { bekle = varsayilanBekle } = {}) {
  if (!Array.isArray(gorselAdresleri) || gorselAdresleri.length < 2 || gorselAdresleri.length > 10) {
    throw new MetaHatasi('gorsel', null, 'karusel 2–10 görsel ister');
  }
  const bag = igBaglanti(env);
  const cocuklar = [];
  for (const adres of gorselAdresleri) {
    const r = await graph(getir, { ...bag, yol: `${env.META_IG_ID}/media`, alanlar: { image_url: adres, is_carousel_item: 'true' } });
    cocuklar.push(String(r.id));
  }
  for (const id of cocuklar) await kapBekle(getir, bag, id, bekle);
  const kap = await graph(getir, { ...bag, yol: `${env.META_IG_ID}/media`, alanlar: { media_type: 'CAROUSEL', children: cocuklar.join(','), caption: aciklama } });
  await kapBekle(getir, bag, String(kap.id), bekle);
  const y = await graph(getir, { ...bag, yol: `${env.META_IG_ID}/media_publish`, alanlar: { creation_id: String(kap.id) } });
  return { id: String(y.id) };
}

/** Günlük API yayın kotası: `{ kullanilan, sinir }`; yanıt beklenen biçimde değilse null. */
export async function igKota(env, getir = varsayilanGetir) {
  const bag = igBaglanti(env);
  const r = await graph(getir, { ...bag, yol: `${env.META_IG_ID}/content_publishing_limit`, method: 'GET', alanlar: { fields: 'quota_usage,config' } });
  const v = Array.isArray(r.data) ? r.data[0] : null;
  if (!v || typeof v.quota_usage !== 'number') return null;
  return { kullanilan: v.quota_usage, sinir: typeof v.config?.quota_total === 'number' ? v.config.quota_total : null };
}
