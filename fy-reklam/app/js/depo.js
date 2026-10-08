// Yerel depo (IndexedDB): taslaklar ve bu cihazda yapılan paylaşımların kaydı.
// Worker'daki ortak kayıt ayrıdır (api.js). Burada hiçbir anahtar ya da jeton durmaz.
const AD = 'fy-reklam';
const SURUM = 1;
const KOLLAR = ['taslaklar', 'kayit'];

let vt;

function ac() {
  if (vt) return Promise.resolve(vt);
  return new Promise((coz, red) => {
    const istek = indexedDB.open(AD, SURUM);
    istek.onupgradeneeded = () => {
      const d = istek.result;
      for (const k of KOLLAR) {
        if (!d.objectStoreNames.contains(k)) {
          const kol = d.createObjectStore(k, { keyPath: 'id' });
          kol.createIndex('guncellendi', 'guncellendi');
        }
      }
    };
    istek.onsuccess = () => { vt = istek.result; vt.onversionchange = () => { vt.close(); vt = null; }; coz(vt); };
    istek.onerror = () => red(istek.error);
  });
}

function islem(kol, kip, f) {
  return ac().then((d) => new Promise((coz, red) => {
    const tx = d.transaction(kol, kip);
    const sonuc = f(tx.objectStore(kol));
    tx.oncomplete = () => coz(sonuc?.result ?? sonuc);
    tx.onerror = () => red(tx.error);
    tx.onabort = () => red(tx.error);
  }));
}

export const kimlik = () => {
  const b = new Uint8Array(9);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
};

export async function kaydet(kol, kayit) {
  const simdi = new Date().toISOString();
  const k = { ...kayit, id: kayit.id || kimlik(), olusturuldu: kayit.olusturuldu || simdi, guncellendi: simdi };
  await islem(kol, 'readwrite', (o) => o.put(k));
  return k;
}

export const al = (kol, id) => islem(kol, 'readonly', (o) => o.get(id));
export const sil = (kol, id) => islem(kol, 'readwrite', (o) => o.delete(id));

/** Son güncellenen önce. */
export async function listele(kol, sinir = 200) {
  const hepsi = await islem(kol, 'readonly', (o) => o.getAll());
  return (hepsi || []).sort((a, b) => (a.guncellendi < b.guncellendi ? 1 : -1)).slice(0, sinir);
}

/** Depolama kullanımı (destekleyen tarayıcıda). */
export async function kapasite() {
  try {
    const k = await navigator.storage?.estimate?.();
    return k ? { kullanilan: k.usage || 0, toplam: k.quota || 0 } : null;
  } catch { return null; }
}
