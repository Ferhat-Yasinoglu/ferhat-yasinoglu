// Reçete doğrulama: kâğıttaki yazı ile QR'daki özetin tutup tutmadığı.
//
// Fikir basit: reçetenin özeti QR'a yazılır, sonuna doktorun cihazına özel
// gizli anahtarla üretilmiş kısa bir kod eklenir. Kâğıtta ilaç, adet ya da doz
// değiştirilirse QR'daki özet tutmaz; sahte bir reçeteye geçerli kod üretmek
// için gizli anahtar gerekir.
//
// NE YAPMAZ: geçerli bir reçetenin fotokopisini engellemez. Değiştirmeyi ve
// sıfırdan uydurmayı yakalar, çoğaltmayı değil — çoğaltma ancak eczanenin
// reçete numarasını not etmesiyle görülür.
//
// Özet biçimi bilerek sabittir: arayüz dili ya da çeviri değişse bile eski
// reçetelerin kodu doğrulanmaya devam etsin diye etiketler koda gömülüdür.

/** Karıştırılması kolay harfler (0/O, 1/I) yok: kod telefonla okunabilsin. */
export const KOD_ALFABE = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const KOD_ETIKETI = 'کد تأیید';

const temiz = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/**
 * Reçetenin kanonik özeti — kodun üzerinden hesaplandığı metin.
 * Hem okunur hem makine için kararlı: alan sırası ve etiketler sabittir.
 */
export function ozetMetni(recete, hastaAdi = '') {
  const satirlar = [
    `نسخه: ${temiz(recete?.receteNo)}`,
    `تاریخ: ${temiz(recete?.tarih).slice(0, 10)}`,
    `مریض: ${temiz(hastaAdi)}`,
  ];
  const tani = [temiz(recete?.tani), temiz(recete?.taniKodu)].filter(Boolean).join(' · ');
  if (tani) satirlar.push(`تشخیص: ${tani}`);
  (recete?.satirlar || []).forEach((s, i) => {
    // `zaman` yalnız doluysa: eski reçetelerin özeti bayt bayt aynı kalsın
    // (basılmış kodları doğrulanmaya devam etsin), yeni reçetede de kâğıttaki
    // «بعد از غذا» değiştirilirse kod tutmasın. `doz` eklenmiyor: güç zaten
    // ilacAdi'nin içinde.
    const parcalar = [temiz(s.kullanim), temiz(s.zaman), temiz(s.sure)].filter(Boolean).join(' — ');
    satirlar.push(`${i + 1}) ${temiz(s.ilacAdi)} × ${Number(s.adet) || 0}${parcalar ? ' — ' + parcalar : ''}`);
  });
  return satirlar.join('\n');
}

/** Ham baytlardan sekiz harflik okunabilir kod: "4F9K-2P7R". */
export function koduBicimle(baytlar) {
  let bit = 0, deger = 0, kod = '';
  for (const b of Array.from(baytlar).slice(0, 5)) {
    deger = (deger << 8) | b;
    bit += 8;
    while (bit >= 5) {
      kod += KOD_ALFABE[(deger >> (bit - 5)) & 31];
      bit -= 5;
    }
  }
  return `${kod.slice(0, 4)}-${kod.slice(4, 8)}`;
}

export const kodSatiri = (kod) => `${KOD_ETIKETI}: ${kod}`;

/**
 * QR ya da yapıştırılan metni özet ve koda ayırır.
 * Kod satırı yoksa kod boş döner — doğrulanamaz demektir.
 */
export function metniAyir(metin) {
  const satirlar = String(metin ?? '').split('\n');
  const yeri = satirlar.findIndex((s) => s.trim().startsWith(KOD_ETIKETI));
  if (yeri === -1) return { ozet: satirlar.join('\n').trim(), kod: '' };
  const kod = satirlar[yeri].split(':').slice(1).join(':').trim().toUpperCase();
  return { ozet: satirlar.slice(0, yeri).join('\n').trim(), kod };
}

/** İki kodu karşılaştırır: büyük/küçük harf ve tire önemsiz. */
export function kodEsit(a, b) {
  const sade = (k) => String(k ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  return sade(a).length > 0 && sade(a) === sade(b);
}
