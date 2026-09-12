// Göç zinciri. Her eleman bir şema sürümü: `belge` yedek belgesini (saf), `idb`
// IndexedDB yapısını yükseltir. Kural: yayınlanmış göç asla düzenlenmez; yeni
// sürüm = yeni eleman + SEMA_SURUMU artışı + worker/migrations/000N_*.sql.
import { KOLEKSIYONLAR } from './surum.js';

const INDEKSLER = {
  kisiler: [['hesap_dis', ['hesap_id', 'dis_id'], { unique: true }], ['kanal', 'kanal'], ['guncellendi', 'guncellendi']],
  kosular: [['kisi_durum', ['kisi_id', 'durum']], ['durum_devam', ['durum', 'devam_zamani']]],
  gunluk: [['zaman', 'zaman'], ['kisi_zaman', ['kisi_id', 'zaman']]],
  mesajlar: [['sohbet_zaman', ['sohbet_id', 'zaman']]],
  puan_olaylari: [['olay_anahtari', 'olay_anahtari', { unique: true }], ['kisi', 'kisi_id']],
  tetikleyiciler: [['akis', 'akis_id']],
  sohbetler: [['kisi', 'kisi_id', { unique: true }], ['son_zaman', 'son_zaman']],
  galeri: [['tur', 'tur']],
};

export const GOCLER = [
  {
    surum: 1,
    aciklama: 'ilk şema: tüm koleksiyonlar, temel indeksler',
    belge: (b) => b,
    idb: (db, tx) => {
      for (const ad of Object.keys(KOLEKSIYONLAR)) {
        if (db.objectStoreNames.contains(ad)) continue;
        const store = db.createObjectStore(ad, { keyPath: 'id' });
        for (const [isim, yol, secenek] of INDEKSLER[ad] || []) store.createIndex(isim, yol, secenek || {});
      }
    },
  },
];

/** Yedek belgesini güncel şemaya yükseltir (saf). */
export function yukselt(belge) {
  let b = belge;
  for (const g of GOCLER) if (g.surum > (b.sema_surumu || 0)) { b = g.belge(b); b = { ...b, sema_surumu: g.surum }; }
  return b;
}

/** IndexedDB onupgradeneeded içinde çağrılır. */
export function idbYukselt(db, tx, eski) {
  for (const g of GOCLER) if (g.surum > (eski || 0)) g.idb(db, tx);
}
