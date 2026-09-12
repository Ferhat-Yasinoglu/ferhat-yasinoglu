// Yedek belgesi: kanonik JSON + SHA-256 sağlama toplamı. Kesik ya da bozuk bir
// dosya içe aktarılmaz; gizli değerler asla girmez.
import { sha256Hex } from '../kimlik.js';
import { KOLEKSIYONLAR, SEMA_SURUMU, YEDEGE_GIRMEZ } from './surum.js';

export const YEDEK_FORMAT = 'sosyal-studyo/yedek';

/** Anahtarları sıralı, boşluksuz JSON: sağlama toplamı platformdan bağımsız kalır. */
export function kanonikJson(deger) {
  if (Array.isArray(deger)) return '[' + deger.map(kanonikJson).join(',') + ']';
  if (deger && typeof deger === 'object') {
    return '{' + Object.keys(deger).sort().map((k) => JSON.stringify(k) + ':' + kanonikJson(deger[k])).join(',') + '}';
  }
  return JSON.stringify(deger);
}

export async function yedekOlustur(koleksiyonlar, { kaynak = { mod: 'yerel' }, secenekler = {}, uygulama_surumu = '' } = {}) {
  const temiz = {};
  for (const [ad, kayitlar] of Object.entries(koleksiyonlar)) {
    if (YEDEGE_GIRMEZ.has(ad) || !KOLEKSIYONLAR[ad]) continue;
    temiz[ad] = (kayitlar || []).filter((k) => secenekler.sanalDahil || !k.sanal);
  }
  const sayim = Object.fromEntries(Object.entries(temiz).map(([k, v]) => [k, v.length]));
  return {
    format: YEDEK_FORMAT, format_surumu: 1, sema_surumu: SEMA_SURUMU,
    olusturuldu: new Date().toISOString(), uygulama_surumu, kaynak, secenekler, sayim,
    koleksiyonlar: temiz,
    ozet_sha256: await sha256Hex(kanonikJson(temiz)),
  };
}

/** Belgeyi doğrular: biçim, sürüm, sağlama toplamı, yasak alanlar. */
export async function yedekDogrula(belge) {
  const hatalar = [];
  if (!belge || typeof belge !== 'object') return { gecerli: false, hatalar: ['belge nesne değil'] };
  if (belge.format !== YEDEK_FORMAT) hatalar.push('biçim tanınmadı: ' + belge.format);
  if (!Number.isInteger(belge.sema_surumu)) hatalar.push('şema sürümü yok');
  else if (belge.sema_surumu > SEMA_SURUMU) hatalar.push(`bu yedek daha yeni bir sürümden (${belge.sema_surumu} > ${SEMA_SURUMU}); önce uygulamayı güncelle`);
  if (!belge.koleksiyonlar || typeof belge.koleksiyonlar !== 'object') hatalar.push('koleksiyonlar yok');
  else {
    for (const ad of Object.keys(belge.koleksiyonlar)) {
      if (YEDEGE_GIRMEZ.has(ad)) hatalar.push(`yasak koleksiyon: ${ad}`);
      else if (!KOLEKSIYONLAR[ad]) hatalar.push(`bilinmeyen koleksiyon: ${ad}`);
      else if (!Array.isArray(belge.koleksiyonlar[ad])) hatalar.push(`${ad} liste değil`);
    }
    if (!hatalar.length) {
      const ozet = await sha256Hex(kanonikJson(belge.koleksiyonlar));
      if (ozet !== belge.ozet_sha256) hatalar.push('sağlama toplamı tutmuyor: dosya bozuk ya da kesik');
    }
  }
  const sayim = belge.koleksiyonlar ? Object.fromEntries(Object.entries(belge.koleksiyonlar).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])) : {};
  return { gecerli: hatalar.length === 0, hatalar, sayim, surumFarki: SEMA_SURUMU - (belge.sema_surumu || 0) };
}
