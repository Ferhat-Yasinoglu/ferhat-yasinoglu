// Meta (Instagram + WhatsApp Cloud API) adaptörü. Graph API v26.0.
const G = 'https://graph.facebook.com/v26.0';

async function graph(yol, { token, method = 'POST', govde, query } = {}, fetchFn = fetch) {
  const url = new URL(`${G}/${yol}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', token);
  const r = await fetchFn(url, { method, headers: govde ? { 'Content-Type': 'application/json' } : {}, body: govde ? JSON.stringify(govde) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) { const e = new Error(`meta ${yol}: ${j.error?.message || r.status}`); e.kod = j.error?.code; throw e; }
  return j;
}

/** Meta webhook gövdesi → ortak olay listesi. */
export function olaylaraCevir(govde, hesaplar) {
  const olaylar = [];
  const hesapBul = (kanal, disId) => hesaplar.find((h) => h.kanal === kanal && (!disId || h.dis_id === disId || !h.dis_id)) || hesaplar.find((h) => h.kanal === kanal);
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

/** Eylemi Instagram'a gönderir: DM (quick_replies ≤13), özel yanıt, yorum yanıtı, gizleme. */
export async function igGonder(env, kisi, eylem, fetchFn = fetch) {
  const token = env.IG_ACCESS_TOKEN;
  if (eylem.tip === 'mesaj') {
    const message = { text: String(eylem.text || '').slice(0, 1000) };
    if (eylem.choices?.length) message.quick_replies = eylem.choices.slice(0, 13).map((c, i) => ({ content_type: 'text', title: c.label.slice(0, 20), payload: `s:${eylem.adim}:${i}` }));
    if (eylem.media?.url && !eylem.choices?.length) return graph('me/messages', { token, govde: { recipient: { id: kisi.dis_id }, message: { attachment: { type: eylem.media.tip === 'video' ? 'video' : 'image', payload: { url: eylem.media.url } } } } }, fetchFn);
    return graph('me/messages', { token, govde: { recipient: { id: kisi.dis_id }, message } }, fetchFn);
  }
  if (eylem.tip === 'ozel_yanit') return graph('me/messages', { token, govde: { recipient: { comment_id: eylem.yorumId }, message: { text: String(eylem.text || '').slice(0, 1000), ...(eylem.choices?.length ? { quick_replies: eylem.choices.slice(0, 13).map((c, i) => ({ content_type: 'text', title: c.label.slice(0, 20), payload: `s:${eylem.adim}:${i}` })) } : {}) } } }, fetchFn);
  if (eylem.tip === 'yorum_yanit') return graph(`${eylem.yorumId}/replies`, { token, query: { message: String(eylem.text || '').slice(0, 1000) } }, fetchFn);
  if (eylem.tip === 'gizle') return graph(`${eylem.yorumId}`, { token, query: { hide: 'true' } }, fetchFn);
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
  const r = await graph('me/media', { token: env.IG_ACCESS_TOKEN, method: 'GET', query: { fields: 'id,comments.limit(20){id,text,username,timestamp,from}', limit: String(limit) } }, fetchFn);
  const out = [];
  for (const m of r.data || []) for (const c of m.comments?.data || []) out.push({ gonderiId: m.id, yorumId: c.id, text: c.text, username: c.username, from: c.from, zaman: c.timestamp });
  return out;
}
