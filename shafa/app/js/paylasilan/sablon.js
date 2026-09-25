// Reçete şablonları.
//
// Hekim aynı birkaç kombinasyonu gün boyu tekrar yazıyor: "üst solunum yolu
// enfeksiyonu" deyince hep aynı üç ilaç. Her seferinde tek tek aratmak günde
// otuz reçetede ciddi zaman. Şablon bir tanı + ilaç satırları demek; hastaya
// bağlı değil, o yüzden her hastaya uygulanabilir.
//
// Saf modül: depo ve DOM buradan görünmez.
import { normalize, eslesir } from './metin.js';

/** Yeni şablon iskeleti. */
export function bosSablon() {
  return { ad: '', tani: '', taniKodu: '', laboratuvar: '', notlar: '', satirlar: [] };
}

/**
 * Açık bir reçeteden şablon çıkarır. Hastaya ve o güne ait olan hiçbir şey
 * taşınmaz: tarih, numara, ölçümler, hasta ve doğrulama kodu dışarıda kalır.
 * Şablon "ne yazdım"ı taşır, "kime yazdım"ı değil.
 *
 * BELİRTİLER de dışarıda: hastanın o gün anlattığı şey, duruma değil kişiye
 * ait. LABORATUVAR içeride: "bu tanıda şu tetkikleri isterim" tekrar eden bir
 * karar, her hastada yeniden seçilmesi gereksiz.
 */
export function receteyiSablonaCevir(recete, ad) {
  return {
    ad: String(ad ?? '').trim(),
    tani: recete?.tani ?? '',
    taniKodu: recete?.taniKodu ?? '',
    laboratuvar: recete?.laboratuvar ?? '',
    notlar: recete?.notlar ?? '',
    // Etken madde de: formdaki ilaç tablosu adı «Feldene (Piroxicam)» diye
    // gösteriyor; şablondan gelen satır elle eklenenden farklı görünmesin.
    satirlar: (recete?.satirlar || []).map((s) => ({
      ilacId: s.ilacId ?? '', ilacAdi: s.ilacAdi ?? '', etkenMadde: s.etkenMadde ?? '',
      adet: Number(s.adet) > 0 ? Number(s.adet) : 1,
      form: s.form ?? '', doz: s.doz ?? '',
      kullanim: s.kullanim ?? '', zaman: s.zaman ?? '', sure: s.sure ?? '', yol: s.yol ?? '', not: s.not ?? '',
    })),
  };
}

/**
 * Şablonu açık reçetenin üstüne uygular.
 * Hasta, tarih, numara, ölçümler ve belirtiler korunur — onlar o muayeneye ait.
 * Zaten yazılmış satırlar silinmez, şablonunkiler eklenir: hekim iki şablonu
 * üst üste kullanabilsin ve elle eklediği satır kaybolmasın.
 * Aynı ilaç iki kez girmez.
 */
export function sablonuUygula(recete, sablon) {
  const mevcut = recete?.satirlar || [];
  const varOlan = new Set(mevcut.map((s) => s.ilacId).filter(Boolean));
  const gelen = (sablon?.satirlar || []).filter((s) => !s.ilacId || !varOlan.has(s.ilacId));
  return {
    ...recete,
    tani: recete?.tani?.trim() ? recete.tani : (sablon?.tani ?? ''),
    taniKodu: recete?.taniKodu?.trim() ? recete.taniKodu : (sablon?.taniKodu ?? ''),
    laboratuvar: recete?.laboratuvar?.trim() ? recete.laboratuvar : (sablon?.laboratuvar ?? ''),
    notlar: recete?.notlar?.trim() ? recete.notlar : (sablon?.notlar ?? ''),
    satirlar: [...mevcut, ...gelen.map((s) => ({ ...s }))],
  };
}

/** Ada ve tanıya göre arama. */
export function sablonAra(liste, q) {
  const s = String(q ?? '').trim();
  if (!s) return [...liste];
  return liste.filter((x) => eslesir(`${x.ad} ${x.tani || ''} ${(x.satirlar || []).map((y) => y.ilacAdi).join(' ')}`, s));
}

/** Alan → hata kodu. Metni arayüz çevirir (bkz. hatalar.js). */
export function sablonDogrula(sablon, mevcutlar = []) {
  const h = {};
  const ad = String(sablon?.ad ?? '').trim();
  if (!ad) h.ad = 'sablon_ad_gerekli';
  else if (mevcutlar.some((x) => x.id !== sablon.id && normalize(x.ad) === normalize(ad))) h.ad = 'sablon_ad_tekrar';
  if (!(sablon?.satirlar || []).length) h.satirlar = 'ilac_gerekli';
  return h;
}
