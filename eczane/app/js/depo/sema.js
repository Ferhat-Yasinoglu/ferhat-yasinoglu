// Şema: koleksiyonlar, sürüm ve IndexedDB yükseltmesi.
// Sürüm artınca idbYukselt her eski sürümden yeniye taşır; veri silinmez.
export const SEMA_SURUMU = 1;

export const KOLEKSIYONLAR = {
  ilaclar: { onek: 'ila', yedek: true, indeksler: { barkod: 'barkod', ad: 'ad' } },
  hastalar: { onek: 'has', yedek: true, indeksler: { kimlikNo: 'kimlikNo', soyad: 'soyad' } },
  receteler: { onek: 'rec', yedek: true, indeksler: { hastaId: 'hastaId', tarih: 'tarih' } },
  hareketler: { onek: 'hrk', yedek: true, indeksler: { ilacId: 'ilacId', tarih: 'tarih' } },
  ayarlar: { onek: 'ayr', yedek: true },
  meta: { onek: 'met', yedek: false },
};

export function idbYukselt(db, tx, eskiSurum) {
  if (eskiSurum < 1) {
    for (const [ad, bilgi] of Object.entries(KOLEKSIYONLAR)) {
      const magaza = db.objectStoreNames.contains(ad) ? tx.objectStore(ad) : db.createObjectStore(ad, { keyPath: 'id' });
      for (const [indeksAdi, yol] of Object.entries(bilgi.indeksler || {})) {
        if (!magaza.indexNames.contains(indeksAdi)) magaza.createIndex(indeksAdi, yol, { unique: false });
      }
    }
  }
  // Sonraki sürümler buraya eklenir: if (eskiSurum < 2) { … }
}

/** Yedek belgesinde taşınan koleksiyonlar. */
export const YEDEKLENEN = Object.entries(KOLEKSIYONLAR).filter(([, b]) => b.yedek).map(([ad]) => ad);
