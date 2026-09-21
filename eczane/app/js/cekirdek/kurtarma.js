// Bozuk açılıştan kurtarma.
//
// Dağıtım sırasında sayfa açık kalırsa önbellekte eski ve yeni dosyalar
// karışabiliyor: sayfa eski dom.js'i çoktan yüklemişken yeni panel.js geliyor
// ve "Importing binding name … is not found" diye çöküyor. Beteri, karışık
// küme önbellekte durduğu için yenilemek de düzeltmiyor — kullanıcı kilitli
// kalıyor. O zaman önbelleği ve service worker'ı silip bir kez yeniden
// yüklüyoruz. IndexedDB'ye dokunulmuyor: hasta kayıtları orada.

const ANAHTAR = 'shafa-kurtarma';

/** Hata modül yükleme hatası mı? Yalnız bunlarda kurtarma denenir. */
export const modulHatasiMi = (e) => /Importing binding|dynamically imported module|Unexpected token '<'/i
  .test(String(e?.message ?? e ?? ''));

/**
 * Önbelleği temizleyip sayfayı yeniden yükler. Oturumda yalnız bir defa —
 * açılış gerçekten bozuksa sonsuz yenileme döngüsüne girmeyelim.
 * @returns {Promise<boolean>} yeniden yükleme başlatıldıysa true
 */
export async function kurtar() {
  try {
    if (sessionStorage.getItem(ANAHTAR)) return false;
    sessionStorage.setItem(ANAHTAR, '1');
  } catch { return false; }

  try {
    if (globalThis.caches) {
      const anahtarlar = await caches.keys();
      await Promise.all(anahtarlar.map((k) => caches.delete(k)));
    }
    const kayitlar = (await navigator.serviceWorker?.getRegistrations?.()) || [];
    await Promise.all(kayitlar.map((r) => r.unregister()));
  } catch { /* temizlenemese de yeniden yüklemeyi dene */ }

  location.reload();
  return true;
}
