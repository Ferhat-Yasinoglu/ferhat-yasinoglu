// AI katmanı: Anthropic (ANTHROPIC_API_KEY varsa) → Workers AI → kapalı. Günlük bütçe D1 sayaçlarında.
// Ajan cevabında "<skip>" = model emin değil → susar, soru "cevapsız" listesine düşer.
const ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const VARSAYILAN_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8-fast';

export function saglayici(env) { return env.ANTHROPIC_API_KEY ? 'anthropic' : env.AI ? 'workers-ai' : 'yok'; }

// Anahtar geçersiz/yetkisiz ya da kredi bitmiş: bu, sahibin düzeltmesini bekleyen bir
// hesap sorunudur, geçici değil. Workers AI bağlıysa cevap oradan gelir, bot susmaz;
// anahtar düzelince hiçbir şey yapmadan yeniden Anthropic kullanılır.
// Başka hatalar (429, 5xx, bozuk istek) eskisi gibi yukarı çıkar.
const anahtarSorunu = (durum, mesaj) => durum === 401 || durum === 403 || (durum === 400 && /credit balance/i.test(mesaj));

// AI_MODEL virgülle birden çok model alabilir: ilki kaldırılmış ya da hata verirse sıradaki denenir.
async function workersAi(env, { sistem, mesajlar, maxToken }) {
  const modeller = String(env.AI_MODEL || VARSAYILAN_AI_MODEL).split(',').map((m) => m.trim()).filter(Boolean);
  let son;
  for (const model of modeller) {
    try {
      const r = await env.AI.run(model, { messages: [{ role: 'system', content: sistem }, ...mesajlar], max_tokens: maxToken });
      const metin = typeof r?.response === 'string' ? r.response : r?.choices?.[0]?.message?.content ?? '';
      return { metin: String(metin).trim(), girdi: r?.usage?.prompt_tokens || 0, cikti: r?.usage?.completion_tokens || 0, saglayici: 'workers-ai', model };
    } catch (e) { son = e; console.warn(`workers-ai ${model}: ${e.message}`); }
  }
  throw son;
}

export async function modelCagir(env, { sistem, mesajlar, maxToken = 600, fetchFn = fetch }) {
  if (env.ANTHROPIC_API_KEY) {
    const r = await fetchFn(ANTHROPIC, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: env.MODEL || 'claude-haiku-4-5', max_tokens: maxToken, system: sistem, messages: mesajlar }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { metin: (j.content || []).map((c) => c.text || '').join('').trim(), girdi: j.usage?.input_tokens || 0, cikti: j.usage?.output_tokens || 0, saglayici: 'anthropic', model: env.MODEL || 'claude-haiku-4-5' };
    const mesaj = j.error?.message || '';
    if (!(env.AI && anahtarSorunu(r.status, mesaj))) throw new Error(`anthropic ${r.status}: ${mesaj}`);
    console.warn(`anthropic ${r.status}: ${mesaj} → Workers AI`);
    return { ...(await workersAi(env, { sistem, mesajlar, maxToken })), anthropicHatasi: `${r.status}: ${mesaj}` };
  }
  if (env.AI) return workersAi(env, { sistem, mesajlar, maxToken });
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
// \b kesme işaretini sınır sayar: "I've" içindeki "ve" Türkçe "ve" ile eşleşiyordu
// ve İngilizce mesaj Türkçe sanılıyordu. Sınırlar kesme işaretini de kelime karakteri sayar.
const S1 = "(?<![\\w'’])", S2 = "(?![\\w'’])";
const DE_KELIME = new RegExp(S1 + '(und|oder|nicht|kostet|kosten|preis|wie|was|warum|ich|wir|sie|ist|sind|eine|einen|eines|kann|können|kannst|bitte|danke|hallo|guten|tag|für|mit|auch|brauche|brauchen|machen|erstellen|haben|hast|mein|meine|ihre|nach|schon|gern)' + S2, 'g');
const TR_KELIME = new RegExp(S1 + '(ve|ile|için|bir|bu|şu|ne|nasıl|neden|merhaba|selam|fiyat|kaç|mı|mi|mu|mü|yapar|yapıyor|yapabilir|misin|musun|mısın|var|yok|lütfen|teşekkür|teşekkürler|olur|değil|çok|istiyorum|görebilir|kadar)' + S2, 'g');
const DE_HARF = /[äöüß]/;
const TR_HARF = /[çğışÇĞİŞ]/;   // ö/ü ortak: Almanca ile karışmasın diye dışarıda

// İngilizce için yalnız "metin bir dil kanıtı taşıyor mu" sorusunda bakılır; dilSez'in
// kararını değiştirmez (orada kanıtsız metin zaten İngilizce sayılır).
const EN_KELIME = new RegExp(S1 + '(the|is|are|how|what|why|where|when|can|could|do|does|did|you|your|my|it|this|that|and|not|please|thanks|thank|hello|hi|free|with|for|to|of)' + S2);
const ARAP_YAZISI = /[\u0600-\u06FF]/;

function kanitlar(m) {
  return {
    de: (m.match(DE_KELIME) || []).length + (DE_HARF.test(m) ? 1 : 0),
    tr: (m.match(TR_KELIME) || []).length + (TR_HARF.test(m) ? 1 : 0),
  };
}

export function dilSez(metin = '') {
  const m = String(metin).toLowerCase();
  if (ARAP_YAZISI.test(m)) return 'fa';                       // Arap alfabesi → Farsça
  const { de, tr } = kanitlar(m);
  if (de > tr) return 'de';
  if (tr > de) return 'tr';
  return tr ? 'tr' : 'en';                                     // beraberlikte: kanıt varsa ana dil
}

const DIL_ADI = { tr: 'Türkçe', de: 'Almanca (Deutsch)', en: 'İngilizce (English)', fa: 'Farsça (فارسی)' };

/** Gelen mesaja hangi dilde cevap verilir. Metin dil kanıtı taşıyorsa (Arap yazısı,
 *  Türkçe/Almanca/İngilizce kelimeler) metin kazanır: Telegram arayüzü İngilizce olan
 *  bir Afgan hekim Dari yazınca Dari cevap alsın. Kanıt yoksa ("ok", "PDF", Latin
 *  harfli Dari) kullanıcının arayüz dili (Telegram language_code) kullanılır. */
export function cevapDili(metin = '', arayuzDili) {
  const m = String(metin || '').toLowerCase();
  const { de, tr } = kanitlar(m);
  const kanit = ARAP_YAZISI.test(m) || de > 0 || tr > 0 || EN_KELIME.test(m);
  if (kanit || !DIL_ADI[arayuzDili]) return dilSez(m);
  return arayuzDili;
}

/** Kanala göre aktif brifing. `kanallar` listesi dolu olan brifing yalnız o kanallarda
 *  konuşur ve orada genel brifingden (kanallar boş) önce gelir. Böylece Telegram botu
 *  kendi brifingiyle (ör. Shafa desteği) konuşurken öbür kanallar genel brifingle sürer.
 *  Kanalı olmayan eski brifingler için davranış aynı: ilk aktif brifing. */
export function brifingSec(brifingler = [], kanal) {
  const aktifler = brifingler.filter((b) => b && b.aktif && !b.silindi);
  const kanalli = (b) => Array.isArray(b.kanallar) && b.kanallar.length > 0;
  return aktifler.find((b) => kanalli(b) && b.kanallar.includes(kanal)) || aktifler.find((b) => !kanalli(b)) || null;
}

/** Brifingin `yasakDesenleri` (RegExp kaynakları) cevapta geçiyorsa eşleşen desen. İstem
 *  bir ricadır; küçük bir model (Workers AI) "doz söyleme" kuralını çiğneyebilir. Bu
 *  denetim modelden bağımsızdır: yasak içerik hiçbir sağlayıcıdan dışarı çıkmaz. */
export function yasakDesen(brifing, metin) {
  for (const d of brifing?.yasakDesenleri || []) {
    try { if (new RegExp(d, 'iu').test(metin)) return d; } catch { /* bozuk desen: ajan-yukle yüklerken reddeder */ }
  }
  return null;
}

/** Ajan cevabı: brifing + bilgi tabanı; emin değilse null. `rapor` verilirse hangi
 *  sağlayıcının cevapladığı ve cevabın engellenip engellenmediği içine yazılır. */
export async function ajanCevap(env, db, { brifing, mesaj, gecmis = [], kanal, dil: dilUstu, rapor = {} }, fetchFn = fetch) {
  if (!brifing) return null;
  if (!(await butceVar(db, env, 'ajan'))) return null;
  const gunKredi = await db.sayac('ajan:' + brifing.id);
  if (brifing.gunlukKredi && gunKredi >= brifing.gunlukKredi) return null;
  const bilgi = (brifing.bilgi_tabani || []).filter((b) => b.aktif !== 0).map((b) => `## ${b.baslik}\n${b.metin}`).join('\n\n').slice(0, 32000);
  // Dil dışarıdan geldiyse (ör. Telegram language_code) ona güvenilir; "/start"
  // gibi metinde ipucu olmayan olaylarda sezgi çalışmaz.
  const dil = DIL_ADI[dilUstu] ? dilUstu : dilSez(mesaj);
  const dilKurali = `CEVAP DİLİ: ${DIL_ADI[dil]}. Cevabın tamamı ${DIL_ADI[dil]} olmalı; tek kelime bile başka dile kayma.`;
  const sistem = `${dilKurali}\n\n${brifing.kimlik}\n\nEn fazla ${brifing.maxKarakter || 400} karakter. Emoji kullanma.\nYasak konular: ${(brifing.yasaklar || []).join(', ') || 'yok'}.\nKanal: ${kanal || 'dm'}.\n\nBİLGİ TABANI (yalnız buna dayan):\n${bilgi || '(boş)'}\n\nEmin değilsen ya da bilgi tabanında cevap yoksa tam olarak <skip> yaz.\n${dilKurali}`;
  const mesajlar = [...gecmis.slice(-6).map((m) => ({ role: m.yon === 'gelen' ? 'user' : 'assistant', content: m.metin })), { role: 'user', content: String(mesaj).slice(0, 2000) }];
  const r = await modelCagir(env, { sistem, mesajlar, maxToken: 400, fetchFn });
  await db.sayacArtir('ai'); await db.sayacArtir('ajan:' + brifing.id);
  rapor.saglayici = r.saglayici; rapor.model = r.model;
  if (r.anthropicHatasi) rapor.anthropicHatasi = r.anthropicHatasi;
  const metin = r.metin.trim();
  if (!metin || /<skip>/i.test(metin)) return null;
  const desen = yasakDesen(brifing, metin);
  if (desen) {
    rapor.engellendi = desen;
    console.warn(`ajan ${brifing.id}: cevap yasak desene uydu, gönderilmedi (${desen})`);
    // Hazır ret cümlesi (dile göre) varsa o gider; yoksa <skip> gibi susulur.
    const ret = brifing.yasakCevabi;
    const hazir = typeof ret === 'string' ? ret : ret && (ret[dil] || Object.values(ret)[0]);
    return hazir ? String(hazir).slice(0, brifing.maxKarakter || 400) : null;
  }
  return metin.slice(0, brifing.maxKarakter || 400);
}

/** Ses transkripti (Workers AI Whisper). */
export async function transkript(env, { dosya, mime }) {
  if (!env.AI) throw new Error('Transkript için Workers AI gerekir');
  const bytes = Uint8Array.from(atob(dosya), (c) => c.charCodeAt(0));
  const r = await env.AI.run('@cf/openai/whisper', { audio: [...bytes] });
  return { transkript: r.text || '' };
}
