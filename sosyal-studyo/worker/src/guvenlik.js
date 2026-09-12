// Kimlik, CORS, imza doğrulama. fy-ajans worker'ının dersleri: fail-closed, Origin kimlik değildir.
const enc = new TextEncoder();

export function sabitZamanEsit(a, b) {
  const x = enc.encode(String(a || '')), y = enc.encode(String(b || ''));
  if (x.length !== y.length) return false;
  let f = 0; for (let i = 0; i < x.length; i++) f |= x[i] ^ y[i];
  return f === 0;
}

export function izinliKaynaklar(env) { return String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean); }

export function corsBasliklari(env, origin) {
  const izinli = izinliKaynaklar(env);
  const secilen = izinli.includes(origin) ? origin : (izinli[0] || 'null');
  return { 'Access-Control-Allow-Origin': secilen, 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-SS-Sema, If-Match, X-Yedek-Onayi', 'Access-Control-Expose-Headers': 'ETag', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}

/** Yönetici anahtarı: Bearer; ≥32 karakter secret yoksa hiç kimse giremez. */
export function yoneticiMi(env, istek) {
  const beklenen = env.YONETICI_ANAHTARI || '';
  if (beklenen.length < 32) return false;
  const h = istek.headers.get('Authorization') || '';
  return h.startsWith('Bearer ') && sabitZamanEsit(h.slice(7).trim(), beklenen);
}

/** Meta webhook: X-Hub-Signature-256 = 'sha256=' + HMAC-SHA256(ham gövde, App Secret). */
export async function metaImzaGecerli(env, hamGovde, baslik) {
  if (!env.META_APP_SECRET || !baslik || !baslik.startsWith('sha256=')) return false;
  const anahtar = await crypto.subtle.importKey('raw', enc.encode(env.META_APP_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const imza = await crypto.subtle.sign('HMAC', anahtar, enc.encode(hamGovde));
  const hex = [...new Uint8Array(imza)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return sabitZamanEsit(hex, baslik.slice(7));
}

/** Telegram webhook: X-Telegram-Bot-Api-Secret-Token başlığı setWebhook'taki secret_token ile aynı olmalı. */
export function telegramGizliGecerli(env, istek) {
  return !!env.TELEGRAM_WEBHOOK_SECRET && sabitZamanEsit(istek.headers.get('X-Telegram-Bot-Api-Secret-Token') || '', env.TELEGRAM_WEBHOOK_SECRET);
}

/** Yapılandırma eksikse Worker kapalı kalır (fail-closed). */
export function yapilandirmaEksikleri(env) {
  const eksik = [];
  if (!env.DB) eksik.push('D1 (DB) bağlı değil');
  if (!env.YONETICI_ANAHTARI || env.YONETICI_ANAHTARI.length < 32) eksik.push('YONETICI_ANAHTARI yok ya da 32 karakterden kısa');
  if (!izinliKaynaklar(env).length) eksik.push('ALLOWED_ORIGINS boş');
  return eksik;
}

export const json = (veri, durum = 200, basliklar = {}) => new Response(JSON.stringify(veri), { status: durum, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...basliklar } });
export const ok = (veri, basliklar) => json({ ok: true, veri }, 200, basliklar);
export const hata = (kod, mesaj, durum = 400, basliklar) => json({ ok: false, hata: kod, mesaj }, durum, basliklar);
