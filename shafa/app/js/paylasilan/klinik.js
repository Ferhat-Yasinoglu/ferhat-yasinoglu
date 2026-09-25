// Klinik seçim listeleri: belirti, tanı, laboratuvar.
//
// Üçü de aynı işi yapıyor: hekim boş kutuya yazmak yerine dokunarak seçsin.
// Listeler AD sözlüğüdür (tanıda ayrıca ICD kodu). Hangi belirtinin olduğuna,
// hangi tanının konduğuna, hangi tetkikin gerektiğine muayene sonrası hekim
// karar verir; listeler tedavi, ilaç ya da doz taşımaz.
//
// 3. sürümden beri her kaydın İngilizce adı (`en`) var ve reçeteye O
// yazılıyor: kâğıdın klinik sütunu tasarımda İngilizce («Fever», «CBC»),
// ölçümler de öyle. Dari ad (`ad`) aramada ve seçim kutusunda ikinci satır.
// Eski reçetelerde Dari yazılmış seçimler («تب») hâlâ tanınıyor: aynı kaydın
// bütün adları (`adlari`) tek kayda çıkıyor (`adIndeksi`).
//
// Saf modül: depo ve DOM buradan görünmez.
import { normalize } from './metin.js';

/** Dari arama için: normalize() yalnız Türkçe/Latin harfi sadeleştiriyor.
 *  Dari'de büyük/küçük harf yok ama aynı sözcük iki yazımla geliyor: yarım
 *  boşluk (ZWNJ) ya da boşluk, Arapça ي/ك ya da Farsça ی/ک. */
export const normalizeFa = (s) =>
  normalize(s).replace(/\u200c/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();

/** Kâğıda (reçeteye) yazılan ad: İngilizcesi; yoksa (elle yazılmış ya da eski
 *  biçimde bir kayıt) Dari adı. */
export const kagitAdi = (x) => x?.en || x?.ad || '';

/** Bir kaydın tanındığı bütün adlar: İngilizce, Dari, Türkçe, eş anlamlılar. */
export const adlari = (x) => [x?.en, x?.ad, x?.tr, ...(x?.es || [])].filter(Boolean);

/** Ad → kayıt. Reçetedeki metin hangi dilde yazılmış olursa olsun kaydını bulur. */
export function adIndeksi(liste) {
  const m = new Map();
  for (const x of liste || []) {
    for (const a of adlari(x)) if (!m.has(normalizeFa(a))) m.set(normalizeFa(a), x);
  }
  return m;
}

/** Metnin bu kayda ait parçası (hangi adıyla yazılmışsa); yoksa -1.
 *  Kayıt yerine düz ad da verilebilir: elle yazılmış, listede olmayan seçim. */
function parcaYeri(parcalar, x) {
  const adlar = new Set((typeof x === 'string' ? [x] : adlari(x)).map(normalizeFa));
  return parcalar.findIndex((p) => adlar.has(normalizeFa(p)));
}

/** Farsça metinde seçimleri ayıran işaret. Latin virgülü de kabul ediliyor:
 *  eski kayıtlar ve elle yazılanlar da doğru bölünsün. */
export const AYRAC = '، ';

/** "سردردی، تب" → ['سردردی', 'تب'] */
export const parcala = (metin) =>
  String(metin ?? '').split(/[،,]/).map((p) => p.trim()).filter(Boolean);

/** ['سردردی', 'تب'] → "سردردی، تب" */
export const birlestir = (parcalar) => (parcalar || []).filter(Boolean).join(AYRAC);

/** Kayıt (ya da düz ad) metinde zaten var mı? Herhangi bir adıyla yazılmış
 *  olabilir: eski reçetedeki «تب» Fever kaydını seçili gösterir. */
export const secili = (metin, x) => parcaYeri(parcala(metin), x) !== -1;

/**
 * Kodsuz liste (belirti, laboratuvar) için ekle/çıkar.
 * İkinci dokunuş geri alsın diye tekli değil, geçişli. Çıkarırken hangi
 * adıyla yazılmışsa o gider; eklerken kâğıt adı (İngilizce) yazılır.
 * `x` kayıt ya da düz ad.
 */
export function degistir(metin, x) {
  const ad = typeof x === 'string' ? x : kagitAdi(x);
  if (!ad) return String(metin ?? '');
  const parcalar = parcala(metin);
  const yer = parcaYeri(parcalar, x);
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
  if (!kagitAdi(secilen)) return { tani, taniKodu };
  const adlar = parcala(tani);
  const kodlar = parcala(taniKodu);
  const yer = parcaYeri(adlar, secilen);

  if (yer !== -1) {
    // Kod listesi düzeltildiyse (K29.0 → B98.0) eski reçetede eski kod
    // yazılı: çıkarırken onu da tanımalı, yoksa kodu kâğıtta kalırdı.
    const kodlari = [secilen.kod, secilen.eskiKod].filter(Boolean).map(normalize);
    let kodYeri = kodlari.length ? kodlar.findIndex((k) => kodlari.includes(normalize(k))) : -1;
    // Kodu bilinmeyen (elle yazılmış ya da özetten gelen) tanı: sayılar
    // birebir denkse aynı sıradaki kodu çıkar, değilse kodlara dokunma.
    if (kodYeri === -1 && !secilen.kod && kodlar.length === adlar.length) kodYeri = yer;
    return {
      tani: birlestir(adlar.filter((_, i) => i !== yer)),
      taniKodu: birlestir(kodlar.filter((_, i) => i !== kodYeri)),
    };
  }
  return {
    tani: birlestir([...adlar, kagitAdi(secilen)]),
    taniKodu: birlestir(secilen.kod ? [...kodlar, secilen.kod] : kodlar),
  };
}

/** Bütün adlarına (İngilizce, Dari, Türkçe, eş anlamlı) ve ICD koduna göre arar. */
export function ara(liste, sorgu) {
  const q = normalizeFa(sorgu);
  if (!q) return liste || [];
  return (liste || []).filter((x) =>
    adlari(x).some((a) => normalizeFa(a).includes(q)) || normalize(x.kod).includes(q));
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
 * `indeks` (adIndeksi) verilirse her parça kaydına bağlanır: eski reçetedeki
 * «تب» ile yenisindeki «Fever» tek kayıt sayılır ve kâğıt adıyla gösterilir.
 * Listede olmayan serbest metin kendisi olarak sayılır.
 * @param {string} alan reçetedeki alan adı ('tani', 'belirtiler', 'laboratuvar')
 * @param {string|null} kodAlani varsa kodun durduğu alan ('taniKodu')
 * @returns {Array<{ad: string, kod: string, n: number, kayit?: object}>}
 */
export function gecmisler(receteler, alan, kodAlani = null, sinir = 8, indeks = null) {
  const sayim = new Map();
  for (const r of receteler || []) {
    const adlar = parcala(r?.[alan]);
    const kodlar = kodAlani ? parcala(r?.[kodAlani]) : [];
    adlar.forEach((ad, i) => {
      const kayit = indeks?.get(normalizeFa(ad));
      const a = kayit ? 'k:' + kagitAdi(kayit) : normalizeFa(ad);
      if (!a) return;
      const v = sayim.get(a) || (kayit
        ? { ad: kagitAdi(kayit), kod: kayit.kod || '', n: 0, kayit }
        : { ad: ad.trim(), kod: kodlar[i] || '', n: 0 });
      v.n += 1;
      if (!v.kod && kodlar[i]) v.kod = kodlar[i];
      sayim.set(a, v);
    });
  }
  return [...sayim.values()].sort((a, b) => b.n - a.n || a.ad.localeCompare(b.ad)).slice(0, sinir);
}

/**
 * Yazım kısayolu listesi (`secenekler`: miktar, zaman, tariqa, yol, sure)
 * düz metin olarak. İlaçla eşleştirilmemiş genel ifadeler; `form` verilirse
 * o şekle uyanlar öne gelir (şurupta «قاشق», damlada «قطره»), öbürleri
 * arkada kalır — hiçbiri gizlenmez, seçim hekimin.
 */
export function secenekListesi(belge, tur, form = '') {
  const liste = belge?.secenekler?.[tur] || [];
  const uyar = (x) => !!form && (x.formlar || []).includes(form);
  return [...liste.filter(uyar), ...liste.filter((x) => !uyar(x))].map((x) => x.ad);
}

/**
 * Formdaki belirti / tetkik kontrol listesinin satırları, sırasıyla:
 * önceki çizimde gösterilenler (yerleri oynamasın: işareti kaldırılan satır
 * sayfadan çıkılana dek yerinde kalıyor), sonra yeni seçilenler (seçili olan
 * HİÇ gizlenmiyor, hepsi kâğıda basılıyor), sonra öneriler (hekimin geçmişi,
 * listenin yaygınları) toplam `sinir`e kadar. Aynı kayıt iki kez çıkmıyor:
 * `anahtar` eski Dari «تب» ile «Fever»ı tek sayabilsin diye dışarıdan veriliyor.
 * @param {{secilenler?: string[], oneriler?: string[], onceki?: string[], sinir?: number, anahtar?: (ad: string) => string}} sec
 * @returns {string[]} gösterilecek adlar
 */
export function gosterilecekler({ secilenler = [], oneriler = [], onceki = [], sinir = 4, anahtar = normalizeFa } = {}) {
  const out = [];
  const gorulen = new Set();
  const ekle = (ad) => {
    const a = anahtar(ad);
    if (!a || gorulen.has(a)) return;
    gorulen.add(a);
    out.push(ad);
  };
  onceki.forEach(ekle);
  secilenler.forEach(ekle);
  for (const o of oneriler) {
    if (out.length >= sinir) break;
    ekle(o);
  }
  return out;
}

/** Belgenin beklenen biçimde olup olmadığı. */
export function klinikGecerliMi(belge) {
  if (!belge || !Array.isArray(belge.gruplar) || !Array.isArray(belge.labGruplari)) return false;
  const doluAdlar = (liste) =>
    Array.isArray(liste) && liste.every((x) => x && typeof x.ad === 'string' && x.ad.trim() !== '');
  return doluAdlar(belge.tanilar) && doluAdlar(belge.belirtiler) && doluAdlar(belge.laboratuvar);
}
