// Klinik seçim listeleri: belirti, tanı, laboratuvar.
//
// Üçü de aynı işi yapıyor: hekim boş kutuya yazmak yerine dokunarak seçsin.
// Listeler AD sözlüğüdür (tanıda ayrıca ICD kodu). Hangi belirtinin olduğuna,
// hangi tanının konduğuna, hangi tetkikin gerektiğine muayene sonrası hekim
// karar verir; listeler tedavi, ilaç ya da doz taşımaz.
//
// Saf modül: depo ve DOM buradan görünmez.
import { normalize } from './metin.js';

/** Farsça metinde seçimleri ayıran işaret. Latin virgülü de kabul ediliyor:
 *  eski kayıtlar ve elle yazılanlar da doğru bölünsün. */
export const AYRAC = '، ';

/** "سردردی، تب" → ['سردردی', 'تب'] */
export const parcala = (metin) =>
  String(metin ?? '').split(/[،,]/).map((p) => p.trim()).filter(Boolean);

/** ['سردردی', 'تب'] → "سردردی، تب" */
export const birlestir = (parcalar) => (parcalar || []).filter(Boolean).join(AYRAC);

/** Bir ad metinde zaten var mı? Büyük/küçük ve boşluk farkı önemsenmez. */
export const secili = (metin, ad) =>
  parcala(metin).some((p) => normalize(p) === normalize(ad));

/**
 * Kodsuz liste (belirti, laboratuvar) için ekle/çıkar.
 * İkinci dokunuş geri alsın diye tekli değil, geçişli.
 */
export function degistir(metin, ad) {
  if (!ad) return String(metin ?? '');
  const parcalar = parcala(metin);
  const yer = parcalar.findIndex((p) => normalize(p) === normalize(ad));
  return birlestir(yer !== -1 ? parcalar.filter((_, i) => i !== yer) : [...parcalar, ad]);
}

/**
 * Tanı için ekle/çıkar: ad ve ICD kodu birlikte yürür, tanı çıkarılınca
 * kodu da gider.
 *
 * Kod, KONUMA göre değil DEĞERE göre eşleşiyor. Konum denendi ve kırıldı:
 * hekim tanıyı elle yazdıysa kodu olmuyor, sonraki seçimin kodu onun yerine
 * kayıyordu. Liste kodları tekil (bir test bunu koruyor), o yüzden değere
 * bakmak tek anlamlı.
 * @returns {{tani: string, taniKodu: string}}
 */
export function taniDegistir({ tani = '', taniKodu = '' } = {}, secilen) {
  if (!secilen?.ad) return { tani, taniKodu };
  const adlar = parcala(tani);
  const kodlar = parcala(taniKodu);
  const yer = adlar.findIndex((p) => normalize(p) === normalize(secilen.ad));

  if (yer !== -1) {
    let kodYeri = secilen.kod
      ? kodlar.findIndex((k) => normalize(k) === normalize(secilen.kod))
      : -1;
    // Kodu bilinmeyen (elle yazılmış ya da özetten gelen) tanı: sayılar
    // birebir denkse aynı sıradaki kodu çıkar, değilse kodlara dokunma.
    if (kodYeri === -1 && !secilen.kod && kodlar.length === adlar.length) kodYeri = yer;
    return {
      tani: birlestir(adlar.filter((_, i) => i !== yer)),
      taniKodu: birlestir(kodlar.filter((_, i) => i !== kodYeri)),
    };
  }
  return {
    tani: birlestir([...adlar, secilen.ad]),
    taniKodu: birlestir(secilen.kod ? [...kodlar, secilen.kod] : kodlar),
  };
}

/** Ada, Türkçe karşılığına ve (varsa) ICD koduna göre arar. */
export function ara(liste, sorgu) {
  const q = normalize(sorgu);
  if (!q) return liste || [];
  return (liste || []).filter((x) =>
    normalize(x.ad).includes(q) || normalize(x.tr).includes(q) || normalize(x.kod).includes(q));
}

/** Listede sık işaretli olanlar: form üstünde tek dokunuşla duracaklar. */
export const siklar = (liste) => (liste || []).filter((x) => x.sik);

/** Kayıtları gruplarına böler. Boş grup atlanır ki başlık boşluğa bakmasın. */
export function gruplaraBol(liste, gruplar) {
  return (gruplar || [])
    .map((g) => ({ ...g, kayitlar: (liste || []).filter((x) => x.grup === g.anahtar) }))
    .filter((g) => g.kayitlar.length);
}

/**
 * Hekimin kendi geçmişinden en çok yazdıkları.
 * Hazır listeden gelmeyen, elle yazdıkları da sayılır — asıl istediği
 * kısayol çoğu zaman kendi alışkanlığıdır.
 * @param {string} alan reçetedeki alan adı ('tani', 'belirtiler', 'laboratuvar')
 * @param {string|null} kodAlani varsa kodun durduğu alan ('taniKodu')
 * @returns {Array<{ad: string, kod: string, n: number}>}
 */
export function gecmisler(receteler, alan, kodAlani = null, sinir = 8) {
  const sayim = new Map();
  for (const r of receteler || []) {
    const adlar = parcala(r?.[alan]);
    const kodlar = kodAlani ? parcala(r?.[kodAlani]) : [];
    adlar.forEach((ad, i) => {
      const a = normalize(ad);
      if (!a) return;
      const v = sayim.get(a) || { ad: ad.trim(), kod: kodlar[i] || '', n: 0 };
      v.n += 1;
      if (!v.kod && kodlar[i]) v.kod = kodlar[i];
      sayim.set(a, v);
    });
  }
  return [...sayim.values()].sort((a, b) => b.n - a.n || a.ad.localeCompare(b.ad)).slice(0, sinir);
}

/** Belgenin beklenen biçimde olup olmadığı. */
export function klinikGecerliMi(belge) {
  if (!belge || !Array.isArray(belge.gruplar) || !Array.isArray(belge.labGruplari)) return false;
  const doluAdlar = (liste) =>
    Array.isArray(liste) && liste.every((x) => x && typeof x.ad === 'string' && x.ad.trim() !== '');
  return doluAdlar(belge.tanilar) && doluAdlar(belge.belirtiler) && doluAdlar(belge.laboratuvar);
}
