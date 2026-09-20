// Reçete alanı: satır durumları ve reçetenin toplam durumu.
// Reçete başlığındaki alanlar (numara, tanı, doktor bilgileri…) sema tarafında
// tutulur; burada yalnız "ne verildi, ne verilmedi" mantığı yaşar.

export const RECETE_TURLERI = [
  ['normal', 'Normal reçete'], ['kirmizi', 'Kırmızı reçete'], ['yesil', 'Yeşil reçete'],
  ['mor', 'Mor reçete'], ['turuncu', 'Turuncu reçete'],
];
export const receteTuruAdi = (k) => RECETE_TURLERI.find(([v]) => v === k)?.[1] || k;

/** Bir satır neden verilmemiş olabilir? Karşılama ekranında seçilir. */
export const VERILMEME_SEBEPLERI = [
  ['stok_yok', 'Stokta yok'], ['hasta_istemedi', 'Hasta almak istemedi'],
  ['muadil', 'Muadili verildi'], ['sonra', 'Sonra gelecek'], ['diger', 'Diğer'],
];
export const sebepAdi = (k) => VERILMEME_SEBEPLERI.find(([v]) => v === k)?.[1] || k;

/** 'bekliyor' | 'kismi' | 'verildi' | 'verilmedi' — satırın kendi durumu. */
export function satirDurumu(satir) {
  const istenen = Math.max(0, Number(satir?.adet ?? 0));
  const verilen = Math.max(0, Number(satir?.verilenAdet ?? 0));
  if (verilen <= 0) return satir?.sebep ? 'verilmedi' : 'bekliyor';
  if (istenen > 0 && verilen < istenen) return 'kismi';
  return 'verildi';
}

/** Satır kapandı mı? Kapalı satır artık bekleyen iş değildir. */
export const satirKapali = (satir) => ['verildi', 'verilmedi'].includes(satirDurumu(satir));

/** 'bos' | 'bekliyor' | 'kismi' | 'tamamlandi' — reçetenin bütünü. */
export function durumHesapla(satirlar) {
  const s = Array.isArray(satirlar) ? satirlar : [];
  if (!s.length) return 'bos';
  if (s.every(satirKapali)) return 'tamamlandi';
  if (s.some((x) => satirDurumu(x) !== 'bekliyor')) return 'kismi';
  return 'bekliyor';
}

export const DURUM_ADLARI = {
  bos: 'Boş', bekliyor: 'Bekliyor', kismi: 'Kısmen verildi', tamamlandi: 'Tamamlandı',
};

/** Listelerde ve panelde gösterilen sayılar. */
export function receteOzet(recete) {
  const satirlar = recete?.satirlar || [];
  const verilen = satirlar.filter((s) => satirDurumu(s) === 'verildi').length;
  const bekleyen = satirlar.filter((s) => !satirKapali(s)).length;
  const tutar = satirlar.reduce((t, s) => t + (Number(s.verilenAdet ?? 0) * Number(s.birimFiyat ?? 0)), 0);
  return { toplam: satirlar.length, verilen, bekleyen, tutar, durum: durumHesapla(satirlar) };
}

/** Boş reçete satırı. */
export function bosSatir() {
  return { ilacId: '', ilacAdi: '', adet: 1, kullanim: '', sure: '', birimFiyat: 0, verilenAdet: 0, sebep: '', verilmeTarihi: '', not: '' };
}

/** Gün içinde artan reçete numarası: "2026-09-20-03". Aynı güne ait en büyük
 *  numaranın sırasını bir artırır; numara elle de yazılabilir. */
export function receteNoUret(mevcutNolar, gun) {
  const onek = String(gun).slice(0, 10);
  const enBuyuk = (mevcutNolar || [])
    .map((n) => String(n ?? ''))
    .filter((n) => n.startsWith(onek + '-'))
    .map((n) => Number(n.slice(onek.length + 1)))
    .filter(Number.isFinite)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${onek}-${String(enBuyuk + 1).padStart(2, '0')}`;
}
