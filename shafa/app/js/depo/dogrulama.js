// Doğrulama kodunun üretimi ve denetimi.
//
// Kod, reçete özetinin HMAC-SHA256'sının ilk beş baytıdır. Anahtar cihazda
// üretilir, ayarlarda durur ve yedeğe girer — doktor cihaz değiştirirse
// yedekten gelen anahtarla eski reçeteler doğrulanmaya devam eder.
// Anahtar yedekten de kaybolursa eski kodlar bir daha doğrulanamaz; bu yüzden
// yedek dosyası hasta bilgisi kadar bu anahtarı da korur.
//
// ESKİ ANAHTARLAR: iki cihaz eşitlenince (ya da başka bir cihazın yedeği
// yüklenince) iki ayrı anahtar bir araya geliyor. Biri aktif kalır, öbürü
// `eskiAnahtarlar`a düşer. YENİ kod hep aktif anahtarla üretilir; DENETİM ise
// sırayla hepsini dener. Böylece öbür cihazda daha önce basılmış kâğıtlar
// doğrulanmaya devam ediyor. Bu liste olmasaydı eşitlemenin ilk gününde
// cihazlardan birinin bütün reçeteleri "TUTMUYOR" derdi.
import { ozetMetni, koduBicimle, metniAyir, kodEsit } from '../paylasilan/dogrulama.js';
import { tamAd } from '../paylasilan/hasta.js';

const ANAHTAR_ALANI = 'dogrulamaAnahtari';
const ESKI_ALANI = 'eskiAnahtarlar';

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

/** Denetimde sırayla denenecek anahtarlar: önce aktif, sonra eskiler. */
export async function anahtarlar(depo) {
  const aktif = await anahtarAl(depo);
  const ayar = await depo.ayarlar();
  const eski = (ayar[ESKI_ALANI] || []).map((a) => { try { return b64Oku(a); } catch { return null; } });
  return [aktif, ...eski.filter(Boolean)];
}

async function hamKod(ham, ozet) {
  const anahtar = await crypto.subtle.importKey('raw', ham, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const imza = await crypto.subtle.sign('HMAC', anahtar, new TextEncoder().encode(ozet));
  return koduBicimle(new Uint8Array(imza));
}

/** Verilen metnin bu cihaza ait doğrulama kodu — hep AKTİF anahtarla. */
export async function kodUret(depo, ozet) {
  return hamKod(await anahtarAl(depo), ozet);
}

/** Reçetenin kodu: özet reçeteden türetilir, kod özetten. */
export const receteKodu = (depo, recete, hastaAdi) => kodUret(depo, ozetMetni(recete, hastaAdi));

/**
 * Yalnız kodu taşıyan metin («کد تأیید: ABCD-EFGH»): reçete özeti QR'a
 * sığmayınca kâğıt salt kod QR'ı basıyor (kagit.js qrBilgisi). Kodun
 * kaydı bu cihazda (ya da eşitlenmiş cihazlarda) varsa o reçetenin özeti
 * gösteriliyor: eczacı kâğıttaki yazıyı onunla karşılaştırıyor. Kaydın
 * kodu da yeniden hesaplanıyor: kayıt sonradan değiştiyse onaylanmasın.
 */
async function kodlaBul(depo, kod) {
  const recete = (await depo.listele('receteler')).find((r) => kodEsit(r.dogrulamaKodu, kod));
  if (!recete) return { durum: 'bilinmiyor', kod, beklenen: '', ozet: '', eskiyle: false };
  const hasta = recete.hastaId ? await depo.al('hastalar', recete.hastaId) : null;
  const ozet = ozetMetni(recete, tamAd(hasta));
  const liste = await anahtarlar(depo);
  for (const [i, ham] of liste.entries()) {
    if (kodEsit(kod, await hamKod(ham, ozet))) return { durum: 'kayitli', kod, beklenen: kod, ozet, eskiyle: i > 0, receteNo: recete.receteNo };
  }
  return { durum: 'gecersiz', kod, beklenen: await hamKod(liste[0], ozet), ozet, eskiyle: false };
}

/**
 * Yapıştırılan metni (QR içeriği ya da elle yazılmış özet) denetler.
 * Döner: { durum: 'gecerli' | 'gecersiz' | 'kodsuz' | 'kayitli' | 'bilinmiyor', kod, beklenen, ozet, eskiyle }
 * `eskiyle` true ise kod eski bir anahtarla tuttu: kâğıt öbür cihazdan çıkmış.
 * Salt kod metninde 'kayitli' (kaydı bulundu, `ozet` onun özeti) ya da
 * 'bilinmiyor'; önce «metinde kod yok» deniyordu, oysa metin koddan ibaretti.
 */
export async function metniDogrula(depo, metin) {
  const { ozet, kod } = metniAyir(metin);
  if (!ozet && kod) return kodlaBul(depo, kod);
  if (!ozet) return { durum: 'kodsuz', kod: '', beklenen: '', ozet: '', eskiyle: false };
  const liste = await anahtarlar(depo);
  const beklenen = await hamKod(liste[0], ozet);
  if (!kod) return { durum: 'kodsuz', kod: '', beklenen, ozet, eskiyle: false };
  if (kodEsit(kod, beklenen)) return { durum: 'gecerli', kod, beklenen, ozet, eskiyle: false };
  for (const ham of liste.slice(1)) {
    if (kodEsit(kod, await hamKod(ham, ozet))) return { durum: 'gecerli', kod, beklenen, ozet, eskiyle: true };
  }
  return { durum: 'gecersiz', kod, beklenen, ozet, eskiyle: false };
}
