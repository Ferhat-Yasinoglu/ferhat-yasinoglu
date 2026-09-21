// İlaç alanı: stok ve son kullanma durumu, arama, muadil bulma.
// Saf modül; depo ve DOM buradan görünmez.
import { normalize, eslesir } from './metin.js';
import { gunFarki, bugun as buGun } from './tarih.js';

export const FORMLAR = [
  ['tablet', 'Tablet'], ['kapsul', 'Kapsül'], ['surup', 'Şurup'], ['ampul', 'Ampul/Flakon'],
  ['krem', 'Krem/Pomat'], ['damla', 'Damla'], ['sprey', 'Sprey'], ['fitil', 'Fitil'],
  ['posetl', 'Poşet/Toz'], ['diger', 'Diğer'],
];
export const formAdi = (k) => FORMLAR.find(([v]) => v === k)?.[1] || '';

/** Son kullanma tarihine bu kadar gün kalınca uyarı verilir. */
export const SKT_UYARI_GUN = 90;

/** 'yok' | 'kritik' | 'normal' — kritik eşiği tanımlı değilse yalnız tükenme bakılır. */
export function stokDurumu(ilac) {
  const stok = Number(ilac?.stok ?? 0);
  const kritik = Number(ilac?.kritikStok ?? 0);
  if (!(stok > 0)) return 'yok';
  if (kritik > 0 && stok <= kritik) return 'kritik';
  return 'normal';
}

/** 'yok' (tarih girilmemiş) | 'gecti' | 'yaklasiyor' | 'normal' */
export function sktDurumu(ilac, referans = buGun()) {
  const skt = String(ilac?.sonKullanma ?? '').slice(0, 10);
  if (!skt) return 'yok';
  const kalan = gunFarki(referans, skt);
  if (kalan === null) return 'yok';
  if (kalan < 0) return 'gecti';
  return kalan <= SKT_UYARI_GUN ? 'yaklasiyor' : 'normal';
}

/** Listede ve reçetede gösterilen tek satırlık ad: "Parol 500 mg Tablet". */
export function ilacEtiketi(ilac) {
  if (!ilac) return '';
  return [ilac.ad, ilac.doz, formAdi(ilac.form)].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ');
}

/** Ad, barkod, etken madde ve üretici üzerinden arama. */
export function ilacAra(liste, q) {
  const s = String(q ?? '').trim();
  if (!s) return [...liste];
  return liste.filter((i) => eslesir(`${i.ad} ${i.barkod || ''} ${i.etkenMadde || ''} ${i.uretici || ''}`, s));
}

/** Aynı etken madde + aynı doz, stokta olan başka ilaçlar. "Muadili verildi" için. */
export function muadiller(liste, ilac) {
  const e = normalize(ilac?.etkenMadde);
  if (!e) return [];
  return liste.filter((x) => x.id !== ilac.id && normalize(x.etkenMadde) === e && Number(x.stok ?? 0) > 0);
}

/** Bir ilacın dikkat çeken halleri — listede rozet, reçetede uyarı olur.
 *  Metin değil kod ve değişken döner; cümleyi arayüz kurar. */
export function ilacUyarilari(ilac, referans = buGun()) {
  const u = [];
  const s = stokDurumu(ilac);
  if (s === 'yok') u.push({ tur: 'hata', kod: 'stok_yok', veri: {} });
  else if (s === 'kritik') u.push({ tur: 'uyari', kod: 'stok_kritik', veri: { n: ilac.stok } });
  const k = sktDurumu(ilac, referans);
  if (k === 'gecti') u.push({ tur: 'hata', kod: 'skt_gecti', veri: {} });
  else if (k === 'yaklasiyor') u.push({ tur: 'uyari', kod: 'skt_yakin', veri: { n: gunFarki(referans, ilac.sonKullanma) } });
  return u;
}

/** Yeni ilaç kaydı için boş şablon; formlar bunun üzerine yazar. */
export function bosIlac() {
  return {
    ad: '', barkod: '', etkenMadde: '', form: 'tablet', doz: '', kutuAdedi: '',
    stok: 0, kritikStok: 5, alisFiyati: '', satisFiyati: '', sonKullanma: '',
    receteli: true, uretici: '', raf: '', notlar: '',
  };
}

/** Kaydetmeden önceki denetim. Dönen nesne alan → hata kodu.
 *  Kod döner, metin değil: bu modül saf kalır, metni arayüz çevirir. */
export function ilacDogrula(ilac) {
  const h = {};
  if (!String(ilac.ad ?? '').trim()) h.ad = 'ad_gerekli';
  if (ilac.barkod && !/^\d{6,14}$/.test(String(ilac.barkod).trim())) h.barkod = 'barkod_bicim';
  const sayi = (v) => v === '' || v === null || v === undefined || Number.isFinite(Number(v));
  if (!sayi(ilac.stok) || Number(ilac.stok ?? 0) < 0) h.stok = 'stok_negatif';
  if (!sayi(ilac.kritikStok) || Number(ilac.kritikStok ?? 0) < 0) h.kritikStok = 'stok_negatif';
  if (!sayi(ilac.alisFiyati)) h.alisFiyati = 'fiyat_sayi';
  if (!sayi(ilac.satisFiyati)) h.satisFiyati = 'fiyat_sayi';
  if (ilac.sonKullanma && !/^\d{4}-\d{2}-\d{2}$/.test(String(ilac.sonKullanma).slice(0, 10))) h.sonKullanma = 'tarih_gecersiz';
  return h;
}

/** Stok hareketi türleri: neden değiştiğini kayıt altına alır. */
export const HAREKET_TURLERI = [
  ['giris', 'Mal girişi'], ['recete', 'Reçete ile verildi'], ['iade', 'İade'],
  ['sayim', 'Sayım düzeltmesi'], ['fire', 'Fire/İmha'],
];
export const hareketAdi = (k) => HAREKET_TURLERI.find(([v]) => v === k)?.[1] || k;

/** Hareketin stoka etkisi: giriş ve iade artırır, kalanı azaltır.
 *  Sayım düzeltmesi mutlak değer yazar, bu yüzden burada ele alınmaz. */
export function hareketYonu(tur) {
  return tur === 'giris' || tur === 'iade' ? 1 : -1;
}
