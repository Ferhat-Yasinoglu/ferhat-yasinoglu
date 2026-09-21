// Şema: koleksiyonlar, sürüm ve IndexedDB yükseltmesi.
// Sürüm artınca idbYukselt her eski sürümden yeniye taşır; veri silinmez.
export const SEMA_SURUMU = 3;

export const KOLEKSIYONLAR = {
  ilaclar: { onek: 'ila', yedek: true, indeksler: { barkod: 'barkod', ad: 'ad' } },
  hastalar: { onek: 'has', yedek: true, indeksler: { kimlikNo: 'kimlikNo', soyad: 'soyad' } },
  receteler: { onek: 'rec', yedek: true, indeksler: { hastaId: 'hastaId', tarih: 'tarih' } },
  sablonlar: { onek: 'sab', yedek: true, indeksler: { ad: 'ad' } },
  ayarlar: { onek: 'ayr', yedek: true },
  meta: { onek: 'met', yedek: false },
};

/** 2. sürümde düşen mağazalar. Yükseltme bunları siler; eski yedeklerde
 *  bu koleksiyonlar çıkarsa geri yükleme sessizce atlar. */
export const DUSEN_KOLEKSIYONLAR = ['hareketler'];

export function idbYukselt(db, tx, eskiSurum) {
  if (eskiSurum < 1) {
    for (const [ad, bilgi] of Object.entries(KOLEKSIYONLAR)) {
      const magaza = db.objectStoreNames.contains(ad) ? tx.objectStore(ad) : db.createObjectStore(ad, { keyPath: 'id' });
      for (const [indeksAdi, yol] of Object.entries(bilgi.indeksler || {})) {
        if (!magaza.indexNames.contains(indeksAdi)) magaza.createIndex(indeksAdi, yol, { unique: false });
      }
    }
  }
  // 2: stok takibi kalktı — hasta ilacını dışarıdaki eczaneden kendi alıyor.
  // Stok hareketleri mağazası siliniyor; ilaç kayıtlarındaki ölü alanlar
  // (stok, sonKullanma, raf…) yerinde duruyor, kimse okumuyor ve ilaç
  // düzenlenince kendiliğinden gidiyorlar. Veri silmemek için tercih edildi:
  // kullanıcı yanlışlıkla stok kaydı tutuyorsa yedekte hâlâ bulunur.
  if (eskiSurum < 2) {
    for (const ad of DUSEN_KOLEKSIYONLAR) {
      if (db.objectStoreNames.contains(ad)) db.deleteObjectStore(ad);
    }
  }
  // 3: reçete şablonları. Yeni mağaza; eski kayıtlara dokunulmuyor.
  if (eskiSurum < 3 && !db.objectStoreNames.contains('sablonlar')) {
    const magaza = db.createObjectStore('sablonlar', { keyPath: 'id' });
    magaza.createIndex('ad', 'ad', { unique: false });
  }
}

/** Yedek belgesinde taşınan koleksiyonlar. */
export const YEDEKLENEN = Object.entries(KOLEKSIYONLAR).filter(([, b]) => b.yedek).map(([ad]) => ad);
