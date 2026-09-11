// Yorum/mesaj kural motoru — reply-bot'un mirası. Sıralı liste; ilk eşleşen
// kazanır. Bir kural: {name, keywords[], pattern, reply: string|string[], privateReply,
// hide, ignore, channels[]}. Anahtar kelimeler Türkçe'ye duyarlı normalize ile,
// regex'ler ham metinle (i bayrağı) eşlenir.
import { doldur, kelimeVar, normalize, varyantSec } from './metin.js';

export function kurallariAyristir(girdi) {
  const hatalar = [];
  let liste = girdi;
  if (typeof girdi === 'string') { try { liste = JSON.parse(girdi); } catch (e) { return { kurallar: [], hatalar: ['JSON okunamadı: ' + e.message] }; } }
  if (!Array.isArray(liste)) return { kurallar: [], hatalar: ['kurallar bir liste olmalı'] };
  const kurallar = [];
  liste.forEach((k, i) => {
    if (!k || typeof k !== 'object') return hatalar.push(`kural[${i}] nesne değil`);
    if (!k.name) return hatalar.push(`kural[${i}] adı yok`);
    if (!k.keywords?.length && !k.pattern) return hatalar.push(`kural ${k.name}: keywords ya da pattern gerekli`);
    let regex = null;
    if (k.pattern) {
      try { regex = new RegExp(k.pattern, 'iu'); } catch (e) { return hatalar.push(`kural ${k.name}: regex hatalı (${e.message})`); }
    }
    const replies = Array.isArray(k.reply) ? k.reply : k.reply ? [k.reply] : [];
    if (!replies.length && !k.hide && !k.ignore && !k.privateReply) hatalar.push(`kural ${k.name}: reply, privateReply, hide ya da ignore olmalı`);
    kurallar.push({ ...k, keywords: (k.keywords || []).map(String), reply: replies, _regex: regex, channels: k.channels || null });
  });
  return { kurallar, hatalar };
}

/** Bir metin için karar: {tur:'cevap'|'gizle'|'yoksay'|'sessiz', kural?, metin?, ozelYanit?, gizle?} */
export function karar(kurallar, { text, kanal, username, degiskenler = {}, anahtar }) {
  if (!kelimeVar(text)) return { tur: 'sessiz', sebep: 'kelime yok' };
  const n = normalize(text);
  for (const k of kurallar) {
    if (k.channels && kanal && !k.channels.includes(kanal)) continue;
    const kelimeEs = k.keywords.some((kw) => n.includes(normalize(kw)));
    // Regex hem ham metne hem normalize metne bakar: 'takipci' deseni 'takipçi'yi de yakalar.
    const regexEs = k._regex ? (k._regex.test(String(text)) || k._regex.test(n)) : false;
    if (!kelimeEs && !regexEs) continue;
    if (k.ignore) return { tur: 'yoksay', kural: k.name };
    if (k.hide) return { tur: 'gizle', kural: k.name, gizle: kanal === 'instagram' };
    const d = { username: username || '', ad: username || '', ...degiskenler };
    const cevap = k.reply.length ? doldur(varyantSec(k.reply, anahtar ?? text), d) : null;
    const ozel = k.privateReply && kanal === 'instagram' ? doldur(k.privateReply, d) : null;
    if (!cevap && !ozel) return { tur: 'sessiz', kural: k.name, sebep: 'bu kanalda yapılacak eylem yok' };
    return { tur: 'cevap', kural: k.name, metin: cevap, ozelYanit: ozel };
  }
  return { tur: 'sessiz', sebep: 'kural eşleşmedi' };
}

/** Kuralı yayınlamadan önce hızlı deneme: hangi kural, ne cevap. */
export function dene(kurallar, text, kanal = 'instagram') {
  return karar(kurallar, { text, kanal, username: 'deneme' });
}
