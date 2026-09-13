// Meta (Instagram + WhatsApp Cloud API) adaptörü. Graph API v26.0.
// İki ayrı konak: Instagram "API setup with Instagram login" ile kurulduğunda
// çağrılar graph.instagram.com'a gider (token instagram_business_* izinleriyle
// üretilir). WhatsApp Cloud API graph.facebook.com'da kalır. Önce ikisi de
// facebook konağına gidiyordu; Instagram token'ı orada kabul edilmez.
import { karuselGotoButonlari } from '../../app/js/paylasilan/akis/adimlar.js';

const G_FB = 'https://graph.facebook.com/v26.0';
const G_IG = 'https://graph.instagram.com/v26.0';

async function graph(yol, { token, method = 'POST', govde, query, konak = G_FB } = {}, fetchFn = fetch) {
  const url = new URL(`${konak}/${yol}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', token);
  const r = await fetchFn(url, { method, headers: govde ? { 'Content-Type': 'application/json' } : {}, body: govde ? JSON.stringify(govde) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) { const e = new Error(`meta ${yol}: ${j.error?.message || r.status}`); e.kod = j.error?.code; throw e; }
  return j;
}

/** Meta webhook gövdesi → ortak olay listesi. */
/**
 * Gelen olayı hangi hesap kaydına bağlayacağımızı seçer.
 *
 * Aynı kanalda birden fazla kayıt olabiliyor (kurulum iki kez yapılırsa ya da kayıt
 * hem yerelde hem Worker'da oluşursa). Eski sürüm `!h.dis_id` koşulunu birebir
 * eşleşmeyle aynı kefeye koyduğu için sonuç ekleme sırasına bağlıydı: dis_id'si boş
 * olan kayıt listede önce duruyorsa, kimliği gerçekten eşleşen kaydı geçiyordu.
 * Artık kademeli: önce birebir eşleşen, sonra dis_id'si boş olan, en sonda kalan
 * kayıt; her kademede 'canli' olan öne geçer.
 */
export function hesapEslestir(hesaplar, kanal, disId) {
  const ayni = (hesaplar || []).filter((h) => h && h.kanal === kanal && !h.silindi);
  const canliOnce = (liste) => liste.find((h) => h.durum === 'canli') || liste[0];
  const kimlik = disId ? String(disId) : '';
  return (
    (kimlik && canliOnce(ayni.filter((h) => String(h.dis_id || '') === kimlik))) ||
    canliOnce(ayni.filter((h) => !h.dis_id)) ||
    canliOnce(ayni) ||
    undefined
  );
}

export function olaylaraCevir(govde, hesaplar) {
  const olaylar = [];
  const hesapBul = (kanal, disId) => hesapEslestir(hesaplar, kanal, disId);
  if (govde.object === 'instagram') {
    for (const entry of govde.entry || []) {
      const hesap = hesapBul('instagram', String(entry.id));
      for (const m of entry.messaging || []) {
        const dis_id = String(m.sender?.id || ''); if (!dis_id || (hesap && dis_id === hesap.dis_id)) continue; // kendi echo'su
        if (m.message?.is_echo) continue;
        const temel = { kaynak: 'instagram', kanal: 'instagram', hesap_id: hesap?.id, dis_id, ad: '', kullanici_adi: '', zaman: new Date(m.timestamp || Date.now()).toISOString() };
        if (m.postback) olaylar.push({ ...temel, olay_id: `ig:pb:${m.postback.mid || m.timestamp}`, tip: m.postback.payload?.startsWith('s:') ? 'buton' : 'welcome_button', payload: m.postback.payload, text: m.postback.title || '', ...(m.postback.payload?.startsWith('s:') ? { adim: Number(m.postback.payload.split(':')[1]), secenekIdx: Number(m.postback.payload.split(':')[2]) } : {}) });
        else if (m.message) {
          const msg = m.message; const qr = msg.quick_reply?.payload;
          if (qr?.startsWith('s:')) olaylar.push({ ...temel, olay_id: `ig:${msg.mid}`, tip: 'buton', adim: Number(qr.split(':')[1]), secenekIdx: Number(qr.split(':')[2]), text: msg.text || '' });
          else if (msg.reply_to?.story) olaylar.push({ ...temel, olay_id: `ig:${msg.mid}`, tip: 'story_reply', text: msg.text || '', storyId: msg.reply_to.story.id });
          else if ((msg.attachments || []).some((a) => a.type === 'story_mention')) olaylar.push({ ...temel, olay_id: `ig:${msg.mid}`, tip: 'story_mention', text: msg.text || '' });
          else if (msg.referral?.ref) olaylar.push({ ...temel, olay_id: `ig:${msg.mid}`, tip: 'ref_link', ref: msg.referral.ref, text: msg.text || '' });
          else olaylar.push({ ...temel, olay_id: `ig:${msg.mid}`, tip: 'dm', text: msg.text || '' });
        }
      }
      for (const c of entry.changes || []) {
        if (c.field === 'comments' || c.field === 'live_comments') {
          const v = c.value || {}; const dis_id = String(v.from?.id || ''); if (!dis_id || (hesap && dis_id === hesap.dis_id)) continue;
          olaylar.push({ kaynak: 'instagram', kanal: 'instagram', hesap_id: hesap?.id, dis_id, ad: v.from?.username || '', kullanici_adi: v.from?.username || '', olay_id: `ig:c:${v.id}`, tip: c.field === 'comments' ? 'comment' : 'live_comment', text: v.text || '', yorumId: v.id, gonderiId: v.media?.id, zaman: new Date().toISOString() });
        }
      }
    }
  } else if (govde.object === 'whatsapp_business_account') {
    for (const entry of govde.entry || []) for (const c of entry.changes || []) {
      const v = c.value || {}; const hesap = hesapBul('whatsapp', v.metadata?.phone_number_id);
      for (const m of v.messages || []) {
        const kisiAdi = (v.contacts || []).find((x) => x.wa_id === m.from)?.profile?.name || '';
        const temel = { kaynak: 'whatsapp', kanal: 'whatsapp', hesap_id: hesap?.id, dis_id: m.from, ad: kisiAdi, kullanici_adi: '', olay_id: `wa:${m.id}`, zaman: new Date(Number(m.timestamp || 0) * 1000 || Date.now()).toISOString() };
        const br = m.interactive?.button_reply || m.button;
        if (br?.id?.startsWith('s:') || br?.payload?.startsWith('s:')) { const p = br.id || br.payload; olaylar.push({ ...temel, tip: 'buton', adim: Number(p.split(':')[1]), secenekIdx: Number(p.split(':')[2]), text: br.title || br.text || '' }); }
        else if (m.text?.body !== undefined) olaylar.push({ ...temel, tip: 'dm', text: m.text.body });
        else if (m.interactive?.list_reply) olaylar.push({ ...temel, tip: 'dm', text: m.interactive.list_reply.title });
        // statuses (teslimat bildirimleri) ayrıştırılmaz: bot kendi bildirimlerine cevap yazmasın.
      }
    }
  }
  return olaylar;
}

/** Instagram çağrıları her zaman graph.instagram.com'a gider. */
const igGraph = (yol, sec = {}, fetchFn) => graph(yol, { ...sec, konak: G_IG }, fetchFn);

/** Eylemi Instagram'a gönderir: DM (quick_replies ≤13), özel yanıt, yorum yanıtı, gizleme. */
export async function igGonder(env, kisi, eylem, fetchFn = fetch) {
  const token = env.IG_ACCESS_TOKEN;
  if (eylem.tip === 'mesaj') {
    const message = { text: String(eylem.text || '').slice(0, 1000) };
    if (eylem.choices?.length) message.quick_replies = eylem.choices.slice(0, 13).map((c, i) => ({ content_type: 'text', title: c.label.slice(0, 20), payload: `s:${eylem.adim}:${i}` }));
    if (eylem.media?.url && !eylem.choices?.length) return igGraph('me/messages', { token, govde: { recipient: { id: kisi.dis_id }, message: { attachment: { type: eylem.media.tip === 'video' ? 'video' : 'image', payload: { url: eylem.media.url } } } } }, fetchFn);
    return igGraph('me/messages', { token, govde: { recipient: { id: kisi.dis_id }, message } }, fetchFn);
  }
  if (eylem.tip === 'ozel_yanit') return igGraph('me/messages', { token, govde: { recipient: { comment_id: eylem.yorumId }, message: { text: String(eylem.text || '').slice(0, 1000), ...(eylem.choices?.length ? { quick_replies: eylem.choices.slice(0, 13).map((c, i) => ({ content_type: 'text', title: c.label.slice(0, 20), payload: `s:${eylem.adim}:${i}` })) } : {}) } } }, fetchFn);
  if (eylem.tip === 'karusel') {
    // Instagram generic template: en fazla 10 eleman, eleman başına 3 buton.
    const gotolar = karuselGotoButonlari(eylem.kartlar);
    const elements = (eylem.kartlar || []).slice(0, 10).map((k) => {
      const e = { title: String(k.title).slice(0, 80) };
      if (k.subtitle) e.subtitle = String(k.subtitle).slice(0, 80);
      if (k.image_url) e.image_url = k.image_url;
      const bl = (k.buttons || []).slice(0, 3).map((b) => (b.url
        ? { type: 'web_url', url: b.url, title: String(b.label).slice(0, 20) }
        : { type: 'postback', title: String(b.label).slice(0, 20), payload: `s:${eylem.adim}:${gotolar.indexOf(b)}` }));
      if (bl.length) e.buttons = bl;
      return e;
    });
    return igGraph('me/messages', { token, govde: { recipient: { id: kisi.dis_id }, message: { attachment: { type: 'template', payload: { template_type: 'generic', elements } } } } }, fetchFn);
  }
  if (eylem.tip === 'yorum_yanit') return igGraph(`${eylem.yorumId}/replies`, { token, query: { message: String(eylem.text || '').slice(0, 1000) } }, fetchFn);
  if (eylem.tip === 'gizle') return igGraph(`${eylem.yorumId}`, { token, query: { hide: 'true' } }, fetchFn);
  return null;
}

/** WhatsApp Cloud API: metin ya da interaktif (≤3 buton). */
export async function waGonder(env, kisi, eylem, fetchFn = fetch) {
  const token = env.WA_ACCESS_TOKEN, telefon = env.WA_PHONE_NUMBER_ID;
  if (eylem.tip !== 'mesaj') return null;
  const temel = { messaging_product: 'whatsapp', to: kisi.dis_id };
  if (eylem.choices?.length) return graph(`${telefon}/messages`, { token, govde: { ...temel, type: 'interactive', interactive: { type: 'button', body: { text: String(eylem.text || '').slice(0, 1024) }, action: { buttons: eylem.choices.slice(0, 3).map((c, i) => ({ type: 'reply', reply: { id: `s:${eylem.adim}:${i}`, title: c.label.slice(0, 20) } })) } } } }, fetchFn);
  if (eylem.media?.url) return graph(`${telefon}/messages`, { token, govde: { ...temel, type: eylem.media.tip === 'video' ? 'video' : 'image', [eylem.media.tip === 'video' ? 'video' : 'image']: { link: eylem.media.url, caption: String(eylem.text || '').slice(0, 1024) } } }, fetchFn);
  return graph(`${telefon}/messages`, { token, govde: { ...temel, type: 'text', text: { body: String(eylem.text || '').slice(0, 4096) } } }, fetchFn);
}

/** Onaysız uygulamalar için yorum polling'i: son gönderilerin yorumlarını çeker. */
export async function igYorumlariCek(env, { limit = 8 } = {}, fetchFn = fetch) {
  const r = await igGraph('me/media', { token: env.IG_ACCESS_TOKEN, method: 'GET', query: { fields: 'id,comments.limit(20){id,text,username,timestamp,from}', limit: String(limit) } }, fetchFn);
  const out = [];
  for (const m of r.data || []) for (const c of m.comments?.data || []) out.push({ gonderiId: m.id, yorumId: c.id, text: c.text, username: c.username, from: c.from, zaman: c.timestamp });
  return out;
}
