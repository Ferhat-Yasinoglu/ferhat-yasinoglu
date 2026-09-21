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
  return { ad: '', tani: '', taniKodu: '', notlar: '', satirlar: [] };
}

/**
 * Açık bir reçeteden şablon çıkarır. Hastaya ve o güne ait olan hiçbir şey
 * taşınmaz: tarih, numara, ölçümler, hasta ve doğrulama kodu dışarıda kalır.
 * Şablon "ne yazdım"ı taşır, "kime yazdım"ı değil.
 */
export function receteyiSablonaCevir(recete, ad) {
  return {
    ad: String(ad ?? '').trim(),
    tani: recete?.tani ?? '',
    taniKodu: recete?.taniKodu ?? '',
    notlar: recete?.notlar ?? '',
    satirlar: (recete?.satirlar || []).map((s) => ({
      ilacId: s.ilacId ?? '', ilacAdi: s.ilacAdi ?? '',
      adet: Number(s.adet) > 0 ? Number(s.adet) : 1,
      kullanim: s.kullanim ?? '', sure: s.sure ?? '', not: s.not ?? '',
    })),
  };
}

/**
 * Şablonu açık reçetenin üstüne uygular.
 * Hasta, tarih, numara ve ölçümler korunur — onlar o muayeneye ait.
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
