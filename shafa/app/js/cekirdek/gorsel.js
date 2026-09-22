/* Kâğıda basılacak küçük görselleri okur.
 *
 * Hekimin kendi fotoğrafı (Clinical sütununun altındaki stetoskop resmi)
 * CİHAZDA kalıyor: dosya okunuyor, küçültülüyor ve ayarlara veri adresi
 * (data:) olarak yazılıyor. Hiçbir yere yüklenmiyor, hiçbir servis
 * çağrılmıyor — uygulamanın geri kalanı gibi.
 *
 * Küçültme şart: telefonla çekilmiş bir fotoğraf 4 MB geliyor ve olduğu
 * gibi saklanırsa her yedek onunla birlikte şişiyor. Kâğıtta yaklaşık
 * 24 mm genişliğinde basılıyor, 360 pikselden fazlası görünmüyor.
 */

/** Kâğıtta bu genişliğin üstü görünmüyor; yedeği şişirmesin. */
export const EN_BUYUK_EN = 360;

/** Küçültülmüş görsel bu boyutu aşarsa kabul edilmiyor (yaklaşık, base64). */
export const EN_BUYUK_BAYT = 220 * 1024;

export class GorselHatasi extends Error {
  constructor(kod, mesaj) { super(mesaj); this.name = 'GorselHatasi'; this.kod = kod; }
}

/**
 * Dosyayı okur, en çok `EN_BUYUK_EN` genişliğe küçültür ve JPEG veri adresi
 * döner. Saydamlık korunmuyor: stetoskop fotoğrafı için gereksiz ve JPEG
 * aynı görüntüyü üçte bir yerde saklıyor.
 */
export async function gorseliOku(dosya) {
  if (!dosya) throw new GorselHatasi('gorsel_yok', 'Dosya seçilmedi.');
  if (!String(dosya.type || '').startsWith('image/')) {
    throw new GorselHatasi('gorsel_tur', 'Bu bir görsel değil.');
  }
  const adres = URL.createObjectURL(dosya);
  try {
    const resim = await new Promise((coz, at) => {
      const r = new Image();
      r.onload = () => coz(r);
      r.onerror = () => at(new GorselHatasi('gorsel_bozuk', 'Görsel açılamadı.'));
      r.src = adres;
    });
    const en = Math.min(EN_BUYUK_EN, resim.naturalWidth || EN_BUYUK_EN);
    const oran = en / (resim.naturalWidth || en);
    const boy = Math.max(1, Math.round((resim.naturalHeight || en) * oran));
    const tuval = document.createElement('canvas');
    tuval.width = en; tuval.height = boy;
    const ctx = tuval.getContext('2d');
    // Beyaz zemin: JPEG saydamlığı taşımıyor, yoksa saydam alanlar siyah çıkar.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, en, boy);
    ctx.drawImage(resim, 0, 0, en, boy);
    const veri = tuval.toDataURL('image/jpeg', 0.82);
    if (veri.length > EN_BUYUK_BAYT) throw new GorselHatasi('gorsel_buyuk', 'Görsel çok büyük.');
    return veri;
  } finally {
    URL.revokeObjectURL(adres);
  }
}

/** Ayarda duran değer basılabilir bir görsel mi? */
export const gorselMi = (v) => /^data:image\/(jpeg|png|webp);base64,/.test(String(v ?? ''));
