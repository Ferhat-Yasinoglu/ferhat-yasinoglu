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

/* Sayı ve para biçimi. Uygulama açılırken ve dil ya da para birimi değişince
   `bicimAyarla` ile kurulur — saf modül olduğu için ayarları kendisi okumaz.
   Rakamlar her dilde Latin kalır: doz ve adet okunurken tereddüt olmasın. */
export const PARA_BIRIMLERI = [['AFN', '؋ AFN'], ['TRY', '₺ TRY'], ['USD', '$ USD'], ['EUR', '€ EUR'], ['PKR', '₨ PKR'], ['IRR', '﷼ IRR']];
const YEREL = { tr: 'tr-TR', fa: 'fa-AF', en: 'en-US' };
const bicim = { dil: 'tr', kur: 'AFN' };

export function bicimAyarla({ dil, kur } = {}) {
  if (dil) bicim.dil = dil;
  if (kur) bicim.kur = kur;
}

const yerel = () => `${YEREL[bicim.dil] || 'tr-TR'}-u-nu-latn`;

export function paraMetni(n, kurus = true) {
  // Boş alan sıfır değildir: fiyatı girilmemiş ilaç "0,00" değil "—" gösterir.
  if (n === '' || n === null || n === undefined) return '—';
  const s = Number(n);
  if (!Number.isFinite(s)) return '—';
  try {
    return new Intl.NumberFormat(yerel(), {
      style: 'currency', currency: bicim.kur,
      minimumFractionDigits: kurus ? 2 : 0, maximumFractionDigits: 2,
    }).format(s);
  } catch { return s.toFixed(2) + ' ' + bicim.kur; }
}

export function sayiMetni(n) {
  const s = Number(n);
  if (!Number.isFinite(s)) return '0';
  try { return new Intl.NumberFormat(yerel()).format(s); } catch { return String(s); }
}

/**
 * Telefon numarasını wa.me biçimine çevirir: yalnız rakamlar, başta ülke kodu.
 * Numara 0 ile başlıyorsa baştaki sıfır atılır ve ülke kodu eklenir
 * (Afganistan 93, Türkiye 90). Zaten + ile başlıyorsa olduğu gibi alınır.
 */
export function telefonNormalize(numara, ulkeKodu = '') {
  const ham = String(numara ?? '').trim();
  if (!ham) return '';
  const artiVar = ham.startsWith('+') || ham.startsWith('00');
  let rakam = ham.replace(/\D/g, '');
  if (ham.startsWith('00')) rakam = rakam.slice(2);
  if (!rakam) return '';
  if (artiVar) return rakam;
  const kod = String(ulkeKodu ?? '').replace(/\D/g, '');
  if (rakam.startsWith('0')) rakam = rakam.slice(1);
  else if (kod && rakam.startsWith(kod)) return rakam;
  return kod ? kod + rakam : rakam;
}
