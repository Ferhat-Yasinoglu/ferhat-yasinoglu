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

/** Sık kullanılan kullanım şekilleri — yazmak yerine seçilebilsin diye. */
export const KULLANIM_ONERILERI = [
  'Günde 1×1', 'Günde 2×1', 'Günde 3×1', 'Günde 1×2', 'Günde 2×2',
  '12 saatte bir', '8 saatte bir', 'Aç karnına', 'Tok karnına', 'Gerektikçe',
];

/** Satırda daha kaç adet verilmeyi bekliyor? */
export function satirKalan(satir) {
  return Math.max(0, Number(satir?.adet ?? 0) - Number(satir?.verilenAdet ?? 0));
}

/** Yeni reçete iskeleti. Doktor bilgileri ayarlardan gelir ve reçeteye
 *  mühürlenir: ayarlar sonradan değişse bile eski reçete yazıldığı günkü
 *  bilgiyi taşır. */
export function bosRecete(ayar = {}, gun = '') {
  return {
    receteNo: '', tarih: gun, tur: 'normal', hastaId: '',
    tani: '', taniKodu: '', protokolNo: '', notlar: '', satirlar: [],
    doktorAd: ayar.doktorAd || '', doktorUnvan: ayar.doktorUnvan || '',
    diplomaNo: ayar.diplomaNo || '', kurum: ayar.kurum || '',
  };
}

export function receteDogrula(recete) {
  const h = {};
  if (!recete.hastaId) h.hastaId = 'Hasta seçilmeli.';
  if (!String(recete.tarih ?? '').match(/^\d{4}-\d{2}-\d{2}$/)) h.tarih = 'Tarih geçersiz.';
  if (!recete.satirlar?.length) h.satirlar = 'En az bir ilaç eklenmeli.';
  else if (recete.satirlar.some((s) => !(Number(s.adet) > 0))) h.satirlar = 'Her satırın adedi sıfırdan büyük olmalı.';
  return h;
}

/**
 * Reçetenin klinik uyarıları. Saf: hasta ve ilaç kayıtlarını dışarıdan alır.
 * Döndürdüğü her uyarı hangi satıra ait olduğunu `satir` alanında taşır
 * (reçetenin tamamına ait uyarılarda -1).
 */
export function receteUyarilari(satirlar, hasta, ilaclar, sec = {}) {
  const { alerjiBul, ilacUyarilariBul } = sec;
  const u = [];
  const bul = (id) => (ilaclar || []).find((x) => x.id === id);
  const etkenSayaci = new Map();

  (satirlar || []).forEach((s, i) => {
    const ilac = bul(s.ilacId);
    if (!ilac) return;

    if (alerjiBul && hasta) {
      const a = alerjiBul(hasta, ilac);
      if (a) u.push({ satir: i, tur: 'hata', kod: 'alerji', metin: `${ilac.ad}: hastanın "${a}" alerjisi var` });
    }

    if (ilacUyarilariBul) {
      for (const x of ilacUyarilariBul(ilac)) {
        // Stok uyarısı istenen adede göre yeniden değerlendirilir: 3 kutu
        // isteniyor ve 2 kutu varsa bu "stok az" değil, karşılanamayan satırdır.
        if (x.kod === 'stok_kritik') continue;
        u.push({ satir: i, tur: x.tur, kod: x.kod, metin: `${ilac.ad}: ${x.metin}` });
      }
    }

    const istenen = Number(s.adet ?? 0);
    const stok = Number(ilac.stok ?? 0);
    if (stok > 0 && istenen > stok) {
      u.push({ satir: i, tur: 'uyari', kod: 'stok_yetersiz', metin: `${ilac.ad}: ${istenen} isteniyor, stokta ${stok} var` });
    }

    const etken = String(ilac.etkenMadde || '').trim().toLocaleLowerCase('tr');
    if (etken) etkenSayaci.set(etken, [...(etkenSayaci.get(etken) || []), { i, ad: ilac.ad }]);
  });

  // Aynı etken madde iki satırda: çift doz riski.
  for (const [, satirlarDizisi] of etkenSayaci) {
    if (satirlarDizisi.length > 1) {
      u.push({
        satir: satirlarDizisi[1].i, tur: 'uyari', kod: 'cift_etken',
        metin: `Aynı etken madde birden fazla satırda: ${satirlarDizisi.map((x) => x.ad).join(', ')}`,
      });
    }
  }
  return u;
}
