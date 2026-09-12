// AI katmanı: Anthropic (ANTHROPIC_API_KEY varsa) → Workers AI → kapalı. Günlük bütçe D1 sayaçlarında.
// Ajan cevabında "<skip>" = model emin değil → susar, soru "cevapsız" listesine düşer.
const ANTHROPIC = 'https://api.anthropic.com/v1/messages';

export function saglayici(env) { return env.ANTHROPIC_API_KEY ? 'anthropic' : env.AI ? 'workers-ai' : 'yok'; }

export async function modelCagir(env, { sistem, mesajlar, maxToken = 600, fetchFn = fetch }) {
  if (env.ANTHROPIC_API_KEY) {
    const r = await fetchFn(ANTHROPIC, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: env.MODEL || 'claude-haiku-4-5', max_tokens: maxToken, system: sistem, messages: mesajlar }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`anthropic ${r.status}: ${j.error?.message || ''}`);
    return { metin: (j.content || []).map((c) => c.text || '').join('').trim(), girdi: j.usage?.input_tokens || 0, cikti: j.usage?.output_tokens || 0 };
  }
  if (env.AI) {
    const r = await env.AI.run(env.AI_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8-fast', { messages: [{ role: 'system', content: sistem }, ...mesajlar], max_tokens: maxToken });
    return { metin: String(r.response || '').trim(), girdi: 0, cikti: 0 };
  }
  throw new Error('AI sağlayıcısı yok');
}

export async function butceVar(db, env, ozellik) {
  const tavan = Number(env.AI_GUNLUK_TAVAN || 300);
  const bugun = await db.sayac('ai');
  return bugun < tavan;
}

function jsonAyikla(metin) {
  const m = metin.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) throw new Error('model JSON döndürmedi');
  return JSON.parse(m[0]);
}

const OZELLIKLER = {
  fikir_uret: { sistem: 'Sosyal medya içerik stratejistisin. Yalnız JSON döndür: {"fikirler":[{"baslik":"...","aciklama":"...","format":"reels|story|karusel|dm","kanca":"..."}]} — tam 10 fikir, Türkçe, somut ve özgün.', kullanici: (g) => `Niş: ${g.nis || '-'}\nHedef kitle: ${g.hedef || '-'}\nFormat: ${g.format || 'reels'}`, maxToken: 1500 },
  senaryo_yaz: { sistem: 'Kısa video senaryosu yazarsın. Yalnız JSON: {"kanca":"ilk 3 saniye","sahneler":[{"sure_sn":3,"metin":"..."}],"cta":"..."} — toplam 30-60 sn, konuşma dili, Türkçe.', kullanici: (g) => `Başlık: ${g.baslik}\nAçıklama: ${g.aciklama || ''}\nFormat: ${g.format || 'reels'}`, maxToken: 1200 },
  kanca_oner: { sistem: 'Kaydırmayı durduran açılış cümleleri yazarsın. Yalnız JSON: {"kancalar":["...", ...]} — tam 10 kanca, her biri en fazla 90 karakter, dil: kullanıcının dili.', kullanici: (g) => `Konu: ${g.konu}\nDil: ${g.dil || 'tr'}`, maxToken: 800 },
  karusel_uret: { sistem: 'Instagram karusel metni yazarsın. Yalnız JSON: {"slaytlar":[{"baslik":"≤60 kr","metin":"≤220 kr"}]} — istenen slayt sayısı kadar; 1. slayt kanca, son slayt CTA.', kullanici: (g) => `Konu: ${g.baslik}\nSlayt sayısı: ${g.slayt || 6}`, maxToken: 1500 },
  video_analiz: { sistem: 'Kısa video analistisin. Verilen transkripti analiz et. Yalnız JSON: {"kanca":"...","yapi":[{"sn":0,"bolum":"Kanca","not":"..."}],"cta":"...","tempo":"...","puan":1-10,"alternatifKancalar":["...","...","..."],"iyilestirmeler":["...","...","..."]} — puan dürüst bir tahmindir.', kullanici: (g) => `Başlık: ${g.baslik || ''}\nTranskript:\n${String(g.transkript || '').slice(0, 12000)}`, maxToken: 1500 },
  varyant_uret: { sistem: 'Yorum yanıtı varyantları yazarsın. Yalnız JSON: {"varyantlar":["..."]} — tam 10 farklı, kısa, doğal, {{username}} yer tutucusu kullanılabilir.', kullanici: (g) => `Örnek yanıt: ${g.ornek}\nDil: ${g.dil || 'tr'}`, maxToken: 800 },
  akis_uret: { sistem: 'Sohbet botu akışı tasarlarsın. Yalnız JSON: {"adimlar":[...]} — adım tipleri: message{text}, question{text,save_as}, buttons{text,save_as,choices:[{label,goto?,add_tags?}]}, tag{add_tags}, score{delta,reason,once_per}, condition{check,then,else}, end. goto indeksleri 0 tabanlı ve akış içinde. En fazla 12 adım, Türkçe.', kullanici: (g) => `Görev: ${g.gorev}\nHedef: ${g.hedef || ''}\nMesaj sayısı: ${g.sayi || 6}`, maxToken: 1800 },
  metin_iyilestir: { sistem: 'Metni aynı anlamda daha kısa, sıcak ve net yaz. Yalnız JSON: {"metin":"..."}', kullanici: (g) => g.metin, maxToken: 400 },
};

/** Panel AI özellikleri. */
export async function ozellikCalistir(env, db, ozellik, girdi, fetchFn = fetch) {
  const o = OZELLIKLER[ozellik];
  if (!o) throw new Error('bilinmeyen özellik');
  if (!(await butceVar(db, env, ozellik))) throw new Error('günlük AI tavanı doldu');
  let son;
  for (let deneme = 0; deneme < 2; deneme++) {
    const r = await modelCagir(env, { sistem: o.sistem, mesajlar: [{ role: 'user', content: o.kullanici(girdi) }], maxToken: o.maxToken, fetchFn });
    await db.sayacArtir('ai');
    try { return jsonAyikla(r.metin); } catch (e) { son = e; }
  }
  throw new Error('üretim bozuk geldi, yeniden denendi (2/2): ' + son.message);
}

/** Mesajın dilini sezer: fa | de | tr | en. Küçük modellere "aynı dilde cevapla"
 *  demek yetmiyor; saptanan dil sistem istemine somut bir satır olarak yazılır.
 *  Puanlama eşleşen kelime SAYISIYLA yapılır: tek ortak kelime (ör. "bot")
 *  iki dili beraberliğe düşürmesin. Ortak alıntı kelimeler listelerde yok. */
const DE_KELIME = /\b(und|oder|nicht|kostet|kosten|preis|wie|was|warum|ich|wir|sie|ist|sind|eine|einen|eines|kann|können|kannst|bitte|danke|hallo|guten|tag|für|mit|auch|brauche|brauchen|machen|erstellen|haben|hast|mein|meine|ihre|nach|schon|gern)\b/g;
const TR_KELIME = /\b(ve|ile|için|bir|bu|şu|ne|nasıl|neden|merhaba|selam|fiyat|kaç|mı|mi|mu|mü|yapar|yapıyor|yapabilir|misin|musun|mısın|var|yok|lütfen|teşekkür|teşekkürler|olur|değil|çok|istiyorum|görebilir|kadar)\b/g;
const DE_HARF = /[äöüß]/;
const TR_HARF = /[çğışÇĞİŞ]/;   // ö/ü ortak: Almanca ile karışmasın diye dışarıda

export function dilSez(metin = '') {
  const m = String(metin).toLowerCase();
  if (/[\u0600-\u06FF]/.test(m)) return 'fa';                 // Arap alfabesi → Farsça
  const de = (m.match(DE_KELIME) || []).length + (DE_HARF.test(m) ? 1 : 0);
  const tr = (m.match(TR_KELIME) || []).length + (TR_HARF.test(m) ? 1 : 0);
  if (de > tr) return 'de';
  if (tr > de) return 'tr';
  return tr ? 'tr' : 'en';                                     // beraberlikte: kanıt varsa ana dil
}

const DIL_ADI = { tr: 'Türkçe', de: 'Almanca (Deutsch)', en: 'İngilizce (English)', fa: 'Farsça (فارسی)' };

/** Ajan cevabı: brifing + bilgi tabanı; emin değilse null. */
export async function ajanCevap(env, db, { brifing, mesaj, gecmis = [], kanal }, fetchFn = fetch) {
  if (!brifing) return null;
  if (!(await butceVar(db, env, 'ajan'))) return null;
  const gunKredi = await db.sayac('ajan:' + brifing.id);
  if (brifing.gunlukKredi && gunKredi >= brifing.gunlukKredi) return null;
  const bilgi = (brifing.bilgi_tabani || []).filter((b) => b.aktif !== 0).map((b) => `## ${b.baslik}\n${b.metin}`).join('\n\n').slice(0, 32000);
  const dil = dilSez(mesaj);
  const dilKurali = `CEVAP DİLİ: ${DIL_ADI[dil]}. Cevabın tamamı ${DIL_ADI[dil]} olmalı; tek kelime bile başka dile kayma.`;
  const sistem = `${dilKurali}\n\n${brifing.kimlik}\n\nEn fazla ${brifing.maxKarakter || 400} karakter. Emoji kullanma.\nYasak konular: ${(brifing.yasaklar || []).join(', ') || 'yok'}.\nKanal: ${kanal || 'dm'}.\n\nBİLGİ TABANI (yalnız buna dayan):\n${bilgi || '(boş)'}\n\nEmin değilsen ya da bilgi tabanında cevap yoksa tam olarak <skip> yaz.\n${dilKurali}`;
  const mesajlar = [...gecmis.slice(-6).map((m) => ({ role: m.yon === 'gelen' ? 'user' : 'assistant', content: m.metin })), { role: 'user', content: String(mesaj).slice(0, 2000) }];
  const r = await modelCagir(env, { sistem, mesajlar, maxToken: 400, fetchFn });
  await db.sayacArtir('ai'); await db.sayacArtir('ajan:' + brifing.id);
  const metin = r.metin.trim();
  if (!metin || /<skip>/i.test(metin)) return null;
  return metin.slice(0, brifing.maxKarakter || 400);
}

/** Ses transkripti (Workers AI Whisper). */
export async function transkript(env, { dosya, mime }) {
  if (!env.AI) throw new Error('Transkript için Workers AI gerekir');
  const bytes = Uint8Array.from(atob(dosya), (c) => c.charCodeAt(0));
  const r = await env.AI.run('@cf/openai/whisper', { audio: [...bytes] });
  return { transkript: r.text || '' };
}
