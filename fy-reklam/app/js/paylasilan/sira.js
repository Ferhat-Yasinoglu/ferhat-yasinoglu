// Günlük sıra: her gün bir ürün. SAF modül (tarayıcı, Worker, test).
//
// Amaç paralı reklam değil, düzenli paylaşım: yayındaki ürünler sırayla döner, her güne biri düşer.
// İki kişi aynı günü görsün diye takvim cihaza değil Avrupa/Berlin gününe bağlıdır ve sıra sabit bir
// başlangıç gününden sayılır. Mini Dakhl gibi «yakında» ürünler sıraya girmez (yapmadığın işi gösterme).

export const BASLANGIC = '2026-10-08'; // sıranın ilk günü: ilk yayındaki ürün bu gün
export const SAAT_DILIMI = 'Europe/Berlin';

/** Verilen anın Avrupa/Berlin gününü 'YYYY-MM-DD' olarak verir. */
export function gunMetni(an = new Date(), saatDilimi = SAAT_DILIMI) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: saatDilimi, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(an);
  const al = (t) => p.find((x) => x.type === t)?.value;
  return `${al('year')}-${al('month')}-${al('day')}`;
}

/** 'YYYY-MM-DD' → başlangıçtan bu yana geçen gün (0 = başlangıç günü; önceki günler negatif). */
export function gunNumarasi(gun, baslangic = BASLANGIC) {
  return Math.round((Date.parse(gun + 'T00:00:00Z') - Date.parse(baslangic + 'T00:00:00Z')) / 86_400_000);
}

/** Sıraya giren ürünler: yayında olanlar, katalog sırasıyla. */
export const siradakiUrunler = (urunler) => urunler.filter((u) => u.yayinda !== false);

/**
 * Günün ürünü. Döner: { urun, gun, sira } ya da null (sırada ürün yoksa).
 * Sıra döngüseldir; başlangıçtan önceki günler de hesaplanır (negatif mod düzeltilir).
 */
export function gununUrunu(urunler, gun = gunMetni()) {
  const liste = siradakiUrunler(urunler);
  if (!liste.length) return null;
  const n = gunNumarasi(gun);
  const sira = ((n % liste.length) + liste.length) % liste.length;
  return { urun: liste[sira], gun, sira };
}

/** Bugünden başlayarak sonraki `adet` gün: [{ gun, urun }]. */
export function onumuzdekiGunler(urunler, adet = 7, bugun = gunMetni()) {
  const out = [];
  const bas = Date.parse(bugun + 'T00:00:00Z');
  for (let i = 0; i < adet; i++) {
    const gun = new Date(bas + i * 86_400_000).toISOString().slice(0, 10);
    const g = gununUrunu(urunler, gun);
    if (g) out.push({ gun, urun: g.urun });
  }
  return out;
}

/** Kayıt listesinde bu ürün bu gün paylaşılmış ya da yayınlanmış mı (kanal fark etmez, hata sayılmaz). */
export function bugunYapildi(kayitlar, urunAnahtari, gun = gunMetni(), saatDilimi = SAAT_DILIMI) {
  return (kayitlar || []).some((k) => {
    if (k.urun !== urunAnahtari || k.durum === 'hata') return false;
    const z = typeof k.zaman === 'number' ? new Date(k.zaman < 1e12 ? k.zaman * 1000 : k.zaman) : new Date(k.zaman);
    return !Number.isNaN(z.getTime()) && gunMetni(z, saatDilimi) === gun;
  });
}
