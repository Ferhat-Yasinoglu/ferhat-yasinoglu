// Doğrulama kodunun üretimi ve denetimi.
//
// Kod, reçete özetinin HMAC-SHA256'sının ilk beş baytıdır. Anahtar cihazda
// üretilir, ayarlarda durur ve yedeğe girer — doktor cihaz değiştirirse
// yedekten gelen anahtarla eski reçeteler doğrulanmaya devam eder.
// Anahtar yedekten de kaybolursa eski kodlar bir daha doğrulanamaz; bu yüzden
// yedek dosyası hasta bilgisi kadar bu anahtarı da korur.
import { ozetMetni, koduBicimle, metniAyir, kodEsit } from '../paylasilan/dogrulama.js';

const ANAHTAR_ALANI = 'dogrulamaAnahtari';

const b64Yaz = (baytlar) => btoa(String.fromCharCode(...baytlar));
const b64Oku = (metin) => Uint8Array.from(atob(metin), (c) => c.charCodeAt(0));

/** Cihazın gizli anahtarı; yoksa üretilip ayarlara yazılır. */
export async function anahtarAl(depo) {
  const ayar = await depo.ayarlar();
  if (ayar[ANAHTAR_ALANI]) return b64Oku(ayar[ANAHTAR_ALANI]);
  const yeni = crypto.getRandomValues(new Uint8Array(32));
  await depo.ayarKaydet(ANAHTAR_ALANI, b64Yaz(yeni));
  return yeni;
}

/** Verilen metnin bu cihaza ait doğrulama kodu. */
export async function kodUret(depo, ozet) {
  const anahtar = await crypto.subtle.importKey(
    'raw', await anahtarAl(depo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const imza = await crypto.subtle.sign('HMAC', anahtar, new TextEncoder().encode(ozet));
  return koduBicimle(new Uint8Array(imza));
}

/** Reçetenin kodu: özet reçeteden türetilir, kod özetten. */
export const receteKodu = (depo, recete, hastaAdi) => kodUret(depo, ozetMetni(recete, hastaAdi));

/**
 * Yapıştırılan metni (QR içeriği ya da elle yazılmış özet) denetler.
 * Döner: { durum: 'gecerli' | 'gecersiz' | 'kodsuz', kod, beklenen, ozet }
 */
export async function metniDogrula(depo, metin) {
  const { ozet, kod } = metniAyir(metin);
  if (!ozet) return { durum: 'kodsuz', kod: '', beklenen: '', ozet: '' };
  if (!kod) return { durum: 'kodsuz', kod: '', beklenen: await kodUret(depo, ozet), ozet };
  const beklenen = await kodUret(depo, ozet);
  return { durum: kodEsit(kod, beklenen) ? 'gecerli' : 'gecersiz', kod, beklenen, ozet };
}
