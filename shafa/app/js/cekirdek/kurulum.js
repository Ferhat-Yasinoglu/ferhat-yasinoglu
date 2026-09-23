// Uygulamayı cihaza kurma (PWA). Mağaza yok: tarayıcı kuruyor.
//
// `beforeinstallprompt` YAKALANMAK ZORUNDA: olay bir kez geliyor ve o an
// tutulmazsa bir daha gelmiyor. Bu yüzden dinleyici modül yüklenir yüklenmez,
// herhangi bir sayfa çizilmeden kuruluyor.
//
// prompt() yalnız kullanıcı hareketinin içinde çağrılabiliyor. Bu yüzden
// açılışta kendiliğinden kurulum başlatmak mümkün değil; tanıtım sayfasından
// `?kur=1` ile gelindiğinde bile hekime basacağı bir düğme gösteriliyor.
//
// iOS'ta bu olay hiç yok: Safari kurulumu yalnız "Paylaş → Ana Ekrana Ekle"
// ile yapıyor. Orada düğme gösterilmiyor, tarif gösteriliyor.

let olay = null;
const dinleyiciler = new Set();

const duyur = () => { for (const cb of dinleyiciler) { try { cb(); } catch (e) { console.error(e); } } };

/** Tarayıcı "kurulabilir" dedi mi? iOS'ta hep false. */
export const kurulabilirMi = () => !!olay;

/** Uygulama zaten kurulu mu (ana ekrandan açılmış mı)? */
export function kuruluMu() {
  try {
    return matchMedia('(display-mode: standalone)').matches
      || matchMedia('(display-mode: window-controls-overlay)').matches
      || navigator.standalone === true;
  } catch { return false; }
}

/** iOS/iPadOS Safari: kurulum var ama düğmesi yok, tarifi var. */
export function elleKurulur() {
  const ua = navigator.userAgent || '';
  const iosMu = /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS masaüstü kimliğiyle geliyor
  return iosMu && !kuruluMu();
}

export function dinle(cb) { dinleyiciler.add(cb); return () => dinleyiciler.delete(cb); }

/** Kurulum penceresini açar. Döner: 'kuruldu' | 'vazgecildi' | 'yok' */
export async function kur() {
  if (!olay) return 'yok';
  const o = olay;
  olay = null;              // prompt bir kez kullanılabiliyor
  duyur();
  try {
    o.prompt();
    const secim = await o.userChoice;
    return secim?.outcome === 'accepted' ? 'kuruldu' : 'vazgecildi';
  } catch { return 'vazgecildi'; }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();       // tarayıcının kendi çubuğu çıkmasın; düğme bizde
  olay = e;
  duyur();
});
window.addEventListener('appinstalled', () => { olay = null; duyur(); });
