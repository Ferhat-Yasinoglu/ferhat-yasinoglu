// Metin yardımcıları. Arama Türkçe harflere duyarsızdır: "sarilik" → "Sarılık",
// "ISTANBUL" → "istanbul". JS'in toLowerCase'i I/İ'yi Türkçe kurallarına göre
// çevirmediği için harf eşlemesi elle yapılır.

const HARF = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', I: 'i', İ: 'i', ö: 'o', Ö: 'o',
  ş: 's', Ş: 's', ü: 'u', Ü: 'u', â: 'a', Â: 'a', î: 'i', Î: 'i', û: 'u', Û: 'u',
};

/** Aramaya hazır sade biçim: Türkçe harfler sadeleşir, hepsi küçük harf olur. */
export function normalize(s) {
  return String(s ?? '').replace(/[çÇğĞıIİöÖşŞüÜâÂîÎûÛ]/g, (c) => HARF[c]).toLowerCase().trim();
}

/** `q` içindeki her kelime metinde geçiyor mu? Kelime sırası önemsiz. */
export function eslesir(metin, q) {
  const n = normalize(metin);
  const kelimeler = normalize(q).split(/\s+/).filter(Boolean);
  return kelimeler.every((k) => n.includes(k));
}

export function kisalt(s, n = 60) {
  const m = String(s ?? '').trim();
  return m.length > n ? m.slice(0, n - 1) + '…' : m;
}

/** Baş harfler: "Ayşe Yılmaz" → "AY". Avatar dairesi için. */
export function basHarfler(ad) {
  const p = String(ad ?? '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toLocaleUpperCase('tr');
}

export function paraMetni(n, kurus = true) {
  // Boş alan sıfır değildir: fiyatı girilmemiş ilaç "₺0,00" değil "—" gösterir.
  if (n === '' || n === null || n === undefined) return '—';
  const s = Number(n);
  if (!Number.isFinite(s)) return '—';
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: kurus ? 2 : 0 }).format(s);
  } catch { return s.toFixed(2) + ' ₺'; }
}

export function sayiMetni(n) {
  const s = Number(n);
  if (!Number.isFinite(s)) return '0';
  try { return new Intl.NumberFormat('tr-TR').format(s); } catch { return String(s); }
}
