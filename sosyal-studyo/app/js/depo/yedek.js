// Yedek işleri: indir, paylaş, dosyadan oku, hatırlatma. Belge biçimi paylasilan/sema/yedek-belgesi.js.
export function dosyaAdi(tarih = new Date()) {
  return `sosyal-studyo-yedek-${tarih.toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
}

export async function indir(belge) {
  const blob = new Blob([JSON.stringify(belge)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = dosyaAdi(new Date(belge.olusturuldu));
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function paylas(belge) {
  const dosya = new File([JSON.stringify(belge)], dosyaAdi(new Date(belge.olusturuldu)), { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [dosya] })) { await navigator.share({ files: [dosya], title: 'Sosyal Stüdyo yedeği' }); return true; }
  return false;
}

export async function dosyadanOku(dosya) {
  const metin = await dosya.text();
  try { return JSON.parse(metin); } catch { throw new Error('Dosya JSON değil'); }
}

/** 7 günden eski ya da 20+ değişiklik biriktiyse hatırlat. */
export function hatirlatmaGerekli(meta, ayarlar = {}) {
  const aralikGun = ayarlar.yedek?.aralikGun ?? 7;
  const esik = ayarlar.yedek?.esikDegisiklik ?? 20;
  const sayac = meta.degisiklik_sayaci || 0;
  if (!meta.son_yedek) return sayac > 0 ? { gerekli: true, sebep: 'hiç yedek alınmadı' } : { gerekli: false };
  const gun = (Date.now() - Date.parse(meta.son_yedek)) / 86400e3;
  if (gun >= aralikGun) return { gerekli: true, sebep: `son yedek ${Math.floor(gun)} gün önce` };
  if (sayac >= esik) return { gerekli: true, sebep: `${sayac} değişiklik yedeklenmedi` };
  return { gerekli: false };
}
