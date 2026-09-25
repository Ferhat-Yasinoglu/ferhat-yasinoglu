// İlaç alanı: künye, arama, muadil bulma.
// Saf modül; depo ve DOM buradan görünmez.
//
// Burada stok yok. Hasta ilacını dışarıdaki eczaneden kendi alıyor; hekimin
// elinde kutu durmuyor. İlaç kaydı yalnız reçeteye ilacı doğru yazabilmek
// için var: ad, doz, şekil, etken madde.
import { normalize, eslesir } from './metin.js';

export const FORMLAR = [
  ['tablet', 'Tablet'], ['kapsul', 'Kapsül'], ['surup', 'Şurup'], ['ampul', 'Ampul/Flakon'],
  ['krem', 'Krem/Pomat'], ['damla', 'Damla'], ['sprey', 'Sprey'], ['fitil', 'Fitil'],
  ['posetl', 'Poşet/Toz'], ['diger', 'Diğer'],
];
export const formAdi = (k) => FORMLAR.find(([v]) => v === k)?.[1] || '';

/** Reçete kâğıdındaki Latin kısaltma: "1- Cap: Amoxicillin 500 mg".
 *  Hekimin ve eczacının alışık olduğu biçim bu; kâğıt Farsça ama ilaç
 *  satırı Latin yazılıyor. Tanınmayan şekilde önek basılmaz. */
const FORM_KISALTMALARI = {
  tablet: 'Tab', kapsul: 'Cap', surup: 'Syr', ampul: 'Amp', krem: 'Oint',
  damla: 'Drop', sprey: 'Spray', fitil: 'Supp', posetl: 'Sach',
};
export const formKisa = (k) => FORM_KISALTMALARI[k] || '';

/**
 * Kâğıtta şekil ÖNEK olarak basılıyor ("Tab: …"), o yüzden adın sonundaki
 * şekil adı düşer: "Nurofen 400 mg Tablet" → "Nurofen 400 mg".
 * Yoksa "Tab: Nurofen 400 mg Tablet" çıkıyordu — şekil iki kez.
 * Şekli bilinmeyen eski reçetede ad olduğu gibi kalır.
 */
export function ilacAdiFormsuz(ilacAdi, form) {
  const ad = String(ilacAdi ?? '').trim();
  const f = formAdi(form);
  return f && ad.endsWith(f) ? ad.slice(0, -f.length).trim() : ad;
}

/** Tek satırlık ad: "Parol 500 mg Tablet". Varsayılan şekil adı Türkçe ve
 *  reçete satırına (ilacAdi) böyle yazılıyor; ekranda arayüz çevrilmiş şekil
 *  adını `formAdiBul` ile veriyor (ilac-satir-arayuz.js ilacGorunenAd). */
export function ilacEtiketi(ilac, formAdiBul = formAdi) {
  if (!ilac) return '';
  return [ilac.ad, ilac.doz, formAdiBul(ilac.form)].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ');
}

/**
 * Reçete satırının adı, kâğıttaki gibi: "Syr: Panadol Syrup 120 mg/5 ml".
 * Kayıttaki ilacAdi ilacEtiketi()'nden gelir, yani Türkçe şekil adıyla biter
 * ("… Şurup"); kâğıt onu düşürüp Latin kısaltmayı öne koyuyordu ama reçete
 * kartı, gönderilen metin ve sayımlar kaydı olduğu gibi basıyor, Afgan hekim
 * de «Şurup», «Kapsül» okuyordu. Kayıt değişmiyor (doğrulama kodu ona
 * bağlı); yalnız gösterilen ad buradan geçiyor.
 */
export function satirAdi(s) {
  const ad = ilacAdiFormsuz(s?.ilacAdi, s?.form);
  const kisa = formKisa(s?.form);
  return kisa && ad ? `${kisa}: ${ad}` : ad;
}

/** Ad, barkod, etken madde ve üretici üzerinden arama. */
export function ilacAra(liste, q) {
  const s = String(q ?? '').trim();
  if (!s) return [...liste];
  return liste.filter((i) => eslesir(`${i.ad} ${i.barkod || ''} ${i.etkenMadde || ''} ${i.uretici || ''}`, s));
}

/** Aynı etken maddeyi taşıyan başka ilaçlar — hasta eczanede bulamazsa
 *  hekim yerine ne yazabileceğini görsün diye. */
export function muadiller(liste, ilac) {
  const e = normalize(ilac?.etkenMadde);
  if (!e) return [];
  return liste.filter((x) => x.id !== ilac.id && normalize(x.etkenMadde) === e);
}

/** Yeni ilaç kaydı için boş şablon; formlar bunun üzerine yazar. */
export function bosIlac() {
  return {
    ad: '', barkod: '', etkenMadde: '', form: 'tablet', doz: '', kutuAdedi: '',
    receteli: true, uretici: '', notlar: '',
  };
}

/** Kaydetmeden önceki denetim. Dönen nesne alan → hata kodu.
 *  Kod döner, metin değil: bu modül saf kalır, metni arayüz çevirir. */
export function ilacDogrula(ilac) {
  const h = {};
  if (!String(ilac.ad ?? '').trim()) h.ad = 'ad_gerekli';
  if (ilac.barkod && !/^\d{6,14}$/.test(String(ilac.barkod).trim())) h.barkod = 'barkod_bicim';
  return h;
}
