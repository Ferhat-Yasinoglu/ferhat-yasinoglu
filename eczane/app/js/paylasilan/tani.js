// Şikâyet/tanı seçme mantığı.
//
// Liste bir AD ve KOD sözlüğüdür: hekim "baş ağrısı"nı elle yazmasın, tıklasın
// diye. Hangi tanının konduğuna muayene sonrası hekim karar verir; liste
// tedavi, ilaç ya da doz taşımaz.
//
// Saf modül: depo ve DOM buradan görünmez.
import { normalize } from './metin.js';

/** Farsça metinde tanıları ayıran işaret. Latin virgülü de kabul ediliyor:
 *  eski reçeteler ve elle yazılanlar da doğru bölünsün. */
export const AYRAC = '، ';

/** "سردردی، تب" → ['سردردی', 'تب'] */
export const taniParcala = (metin) =>
  String(metin ?? '').split(/[،,]/).map((p) => p.trim()).filter(Boolean);

/** ['سردردی', 'تب'] → "سردردی، تب" */
export const taniBirlestir = (parcalar) => (parcalar || []).filter(Boolean).join(AYRAC);

/** Bir tanı metinde zaten var mı? Büyük/küçük ve boşluk farkı önemsenmez. */
export const taniSecili = (metin, ad) =>
  taniParcala(metin).some((p) => normalize(p) === normalize(ad));

/**
 * Tanıyı ekler ya da zaten varsa çıkarır — çip'e ikinci dokunuş geri alsın.
 * Ad ve kod birlikte yürür: tanı çıkarılınca kodu da gider.
 *
 * Kod, KONUMA göre değil DEĞERE göre eşleşiyor. Konum denendi ve kırıldı:
 * hekim tanıyı elle yazdıysa kodu olmuyor, sonraki seçimin kodu onun yerine
 * kayıyordu. Liste kodları tekil (bir test bunu koruyor), o yüzden değere
 * bakmak tek anlamlı.
 * @returns {{tani: string, taniKodu: string}}
 */
export function taniDegistir({ tani = '', taniKodu = '' } = {}, secilen) {
  if (!secilen?.ad) return { tani, taniKodu };
  const adlar = taniParcala(tani);
  const kodlar = taniParcala(taniKodu);
  const yer = adlar.findIndex((p) => normalize(p) === normalize(secilen.ad));

  if (yer !== -1) {
    let kodYeri = secilen.kod
      ? kodlar.findIndex((k) => normalize(k) === normalize(secilen.kod))
      : -1;
    // Kodu bilinmeyen (elle yazılmış ya da özetten gelen) tanı: sayılar
    // birebir denkse aynı sıradaki kodu çıkar, değilse kodlara dokunma.
    if (kodYeri === -1 && !secilen.kod && kodlar.length === adlar.length) kodYeri = yer;
    return {
      tani: taniBirlestir(adlar.filter((_, i) => i !== yer)),
      taniKodu: taniBirlestir(kodlar.filter((_, i) => i !== kodYeri)),
    };
  }
  return {
    tani: taniBirlestir([...adlar, secilen.ad]),
    taniKodu: taniBirlestir(secilen.kod ? [...kodlar, secilen.kod] : kodlar),
  };
}

/** Ada, Türkçe karşılığına ve ICD koduna göre arar. */
export function taniAra(tanilar, sorgu) {
  const q = normalize(sorgu);
  if (!q) return tanilar || [];
  return (tanilar || []).filter((x) =>
    normalize(x.ad).includes(q) || normalize(x.tr).includes(q) || normalize(x.kod).includes(q));
}

/** Listede sık işaretli olanlar: form üstünde tek dokunuşla duracaklar. */
export const sikTanilar = (tanilar) => (tanilar || []).filter((x) => x.sik);

/** Tanıları gruplarına böler. Boş grup atlanır ki başlık boşluğa bakmasın. */
export function gruplaraBol(tanilar, gruplar) {
  return (gruplar || [])
    .map((g) => ({ ...g, tanilar: (tanilar || []).filter((x) => x.grup === g.anahtar) }))
    .filter((g) => g.tanilar.length);
}

/**
 * Hekimin kendi geçmişinden en çok yazdığı tanılar.
 * Hazır listeden gelmeyen, elle yazdıkları da sayılır — asıl istediği
 * kısayol çoğu zaman kendi alışkanlığıdır.
 * @returns {Array<{ad: string, kod: string, n: number}>}
 */
export function gecmisTanilar(receteler, sinir = 8) {
  const sayim = new Map();
  for (const r of receteler || []) {
    const adlar = taniParcala(r?.tani);
    const kodlar = taniParcala(r?.taniKodu);
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
export function taniListesiGecerliMi(belge) {
  return !!belge && Array.isArray(belge.tanilar) && Array.isArray(belge.gruplar)
    && belge.tanilar.every((x) => x && typeof x.ad === 'string' && x.ad.trim() !== '');
}
