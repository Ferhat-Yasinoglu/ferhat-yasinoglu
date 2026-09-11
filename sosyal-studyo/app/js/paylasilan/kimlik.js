// Kimlik ve özet yardımcıları. Hem tarayıcıda hem Worker'da yalnızca Web Crypto kullanır.
const HEX = '0123456789abcdef';

function rastgeleHex(uzunluk) {
  const b = new Uint8Array(uzunluk / 2);
  crypto.getRandomValues(b);
  let s = '';
  for (const x of b) s += HEX[x >> 4] + HEX[x & 15];
  return s;
}

/** Önekli kimlik: `akis_3f9a…` (16 hex). */
export const yeniId = (onek) => `${onek}_${rastgeleHex(16)}`;

/** Bir metnin SHA-256 özeti, küçük harf hex. */
export async function sha256Hex(metin) {
  const veri = new TextEncoder().encode(metin);
  const ozet = await crypto.subtle.digest('SHA-256', veri);
  let s = '';
  for (const x of new Uint8Array(ozet)) s += HEX[x >> 4] + HEX[x & 15];
  return s;
}

/** Şu anın ISO 8601 (UTC) metni. Test edilebilirlik için tek yerden. */
export const simdi = () => new Date().toISOString();
