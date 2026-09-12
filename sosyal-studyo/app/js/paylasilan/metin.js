// Türkçe'ye duyarlı metin işleri. botflow-mcp/src/text.ts'in fikri:
// `İ`.toLowerCase() "i" + birleşik nokta üretir, dotless `ı` ayrışmaz;
// ikisini de elle ele alıyoruz ki "İNDİRİM" ≈ "indirim" ≈ "indırım" olsun.

/** Karşılaştırma için normalize: küçük harf, aksansız, tek boşluk. */
export function normalize(metin) {
  return String(metin ?? '')
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Anahtar kelime eşleşmesi. `eslesme`: 'exact' | 'contains' | 'any'. */
export function eslesir(metin, anahtarKelimeler, eslesme = 'contains') {
  if (eslesme === 'any') return true;
  const m = normalize(metin);
  if (!m) return false;
  for (const k of anahtarKelimeler || []) {
    const n = normalize(k);
    if (!n) continue;
    if (eslesme === 'exact' ? m === n : m.includes(n)) return true;
  }
  return false;
}

/** `{{ad}}` biçimindeki yer tutucuları doldurur; bilinmeyen anahtar boş kalır. */
export function doldur(sablon, degiskenler = {}) {
  return String(sablon ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, ad) => {
    const v = degiskenler[ad];
    return v === undefined || v === null ? '' : String(v);
  });
}

/** Aynı anahtar için hep aynı varyantı seçer (yorum id'siyle çağrılırsa aynı yoruma aynı cevap). */
export function varyantSec(liste, anahtar) {
  if (!liste || !liste.length) return '';
  let h = 2166136261;
  for (const ch of String(anahtar ?? '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return liste[h % liste.length];
}

/** Metnin "kelime" içerip içermediği: yalnız emoji/işaretse false (model çağrısı bile yapılmaz). */
export function kelimeVar(metin) {
  return /[\p{L}\p{N}]{2,}/u.test(String(metin ?? ''));
}

/** Basit kesme: uzun metinleri kanal sınırına indirir, kelime ortasından kesmez. */
export function kes(metin, enFazla) {
  const s = String(metin ?? '');
  if (s.length <= enFazla) return s;
  const kesik = s.slice(0, enFazla - 1);
  const bosluk = kesik.lastIndexOf(' ');
  return (bosluk > enFazla * 0.6 ? kesik.slice(0, bosluk) : kesik) + '…';
}
