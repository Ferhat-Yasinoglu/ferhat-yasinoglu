// Telegram Bot API adaptörü: güncellemeyi ortak olay biçimine çevirir, mesaj/buton gönderir.
// Butonlar callback_data 's:<adım>:<i>' taşır; eski butona basmak hiçbir şey yapmaz (koşucu bakar).
const API = (token, yontem) => `https://api.telegram.org/bot${token}/${yontem}`;

export async function tgCagir(env, yontem, govde, fetchFn = fetch) {
  const r = await fetchFn(API(env.TELEGRAM_BOT_TOKEN, yontem), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde || {}) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) { const e = new Error(`telegram ${yontem}: ${j.description || r.status}`); e.kod = j.error_code; e.retry_after = j.parameters?.retry_after; throw e; }
  return j.result;
}

/** Telegram'ın language_code'unu desteklediğimiz dörde indirger; tanımadığını İngilizce sayar. */
export function dilKodu(kod) {
  const k = String(kod || '').slice(0, 2).toLowerCase();
  return ['tr', 'de', 'fa', 'en'].includes(k) ? k : (k === 'az' ? 'tr' : k === 'ps' || k === 'da' ? 'fa' : 'en');
}

/** Telegram güncellemesi → ortak olay (null = ilgisiz). */
export function olayaCevir(update, hesap_id) {
  const m = update.message;
  if (m?.text !== undefined || m?.caption !== undefined) {
    const text = m.text ?? m.caption ?? '';
    const from = m.from || {};
    // language_code Telegram'dan gelir; "/start"ta metinde dil ipucu olmadığı için
    // karşılamayı doğru dilde yazmanın tek kaynağı budur.
    const temel = { kaynak: 'telegram', kanal: 'telegram', hesap_id, olay_id: `tg:${update.update_id}`, dis_id: String(m.chat.id), ad: [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || String(m.chat.id), kullanici_adi: from.username || '', dil: dilKodu(from.language_code), zaman: new Date((m.date || 0) * 1000).toISOString() };
    const start = /^\/start(?:@\w+)?(?:\s+(\S+))?$/.exec(text);
    if (start) return { ...temel, tip: 'start', text, ref: start[1]?.startsWith('ref_') ? start[1].slice(4) : start[1] || null };
    return { ...temel, tip: 'dm', text };
  }
  const cq = update.callback_query;
  if (cq) {
    const from = cq.from || {};
    const [, adim, idx] = String(cq.data || '').split(':');
    return { kaynak: 'telegram', kanal: 'telegram', hesap_id, olay_id: `tg:cq:${cq.id}`, dis_id: String(cq.message?.chat?.id || from.id), ad: [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || '', kullanici_adi: from.username || '', tip: 'buton', adim: Number(adim), secenekIdx: Number(idx), callback_id: cq.id, zaman: new Date().toISOString() };
  }
  return null;
}

/** Eylemi Telegram'a gönderir. Metin 4096 sınırı; butonlar inline klavye. */
export async function gonder(env, kisi, eylem, fetchFn = fetch) {
  const chat_id = kisi.dis_id;
  if (eylem.tip === 'mesaj') {
    const govde = { chat_id, text: String(eylem.text || '').slice(0, 4096) };
    if (eylem.choices?.length) govde.reply_markup = { inline_keyboard: eylem.choices.map((c, i) => [c.url ? { text: c.label, url: c.url } : { text: c.label.slice(0, 64), callback_data: `s:${eylem.adim}:${i}` }]) };
    if (eylem.media?.url) return tgCagir(env, eylem.media.tip === 'video' ? 'sendVideo' : 'sendPhoto', { chat_id, [eylem.media.tip === 'video' ? 'video' : 'photo']: eylem.media.url, caption: govde.text.slice(0, 1024), reply_markup: govde.reply_markup }, fetchFn);
    return tgCagir(env, 'sendMessage', govde, fetchFn);
  }
  return null;
}

export async function callbackKapat(env, id, fetchFn = fetch) { try { await tgCagir(env, 'answerCallbackQuery', { callback_query_id: id }, fetchFn); } catch {} }

/** Kurulu webhook beklenen adres mi? {kurulu, mevcut} döner; token yoksa null. */
export async function webhookDurumu(env, workerUrl, fetchFn = fetch) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) return null;
  const bilgi = await tgCagir(env, 'getWebhookInfo', {}, fetchFn);
  const beklenen = `${workerUrl}/tg/webhook`;
  return { kurulu: bilgi.url === beklenen, mevcut: bilgi.url || '', bekleyen: bilgi.pending_update_count || 0 };
}

export async function webhookKur(env, workerUrl, fetchFn = fetch) {
  const me = await tgCagir(env, 'getMe', {}, fetchFn);
  const url = `${workerUrl}/tg/webhook`;
  await tgCagir(env, 'setWebhook', { url, secret_token: env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query'], drop_pending_updates: false }, fetchFn);
  const bilgi = await tgCagir(env, 'getWebhookInfo', {}, fetchFn);
  return { bot: me, webhook: bilgi };
}
