// Hazır ilaç listesinin birleştirme mantığı.
//
// Liste bir ad sözlüğüdür: hekim her ilacı sıfırdan yazmasın diye. Kullanım
// şekli, doz aralığı ve süre kararı hekimindir; liste bunları taşımaz.
//
// 3. sürümden beri liste (678 ilaç) bütünüyle depoya yazılmıyor: reçete
// yazarken hekimin kendi ilaçlarıyla BİRLİKTE yerinde aranıyor (`havuz`,
// `ilacSuz`), bir liste satırı ancak hekim onu ilk kez seçince kayda dönüşüyor.
// Neden: 678 kayıt her cihazda ~225 KB ve şifreli her eşitleme kasasında
// taşınırdı; tipik hekim 50–150 ilaç yazıyor.
//
// Saf modül: depo ve DOM buradan görünmez.
import { normalize } from './metin.js';

/** İki kaydın "aynı ilaç" sayılması için anahtar: ad + doz + şekil.
 *  Aynı etken maddenin 500 mg tableti ile 250 mg/5 ml şurubu ayrı kayıttır;
 *  hekim reçetede hangisini yazdığını seçebilmeli. */
export const ilacAnahtari = (i) =>
  [normalize(i?.ad), normalize(i?.doz), String(i?.form ?? '').trim()].join('|');

/**
 * Hazır listeden, depoda henüz olmayanları çıkarır.
 * İki kez yüklense de kopya oluşmaz; hekimin elle eklediği ya da düzenlediği
 * kayıtlara dokunulmaz — listeden geleni ezmek, onun yazdığını silmek olurdu.
 */
export function eksikleriBul(mevcutlar, hazirlar) {
  const var_ = new Set((mevcutlar || []).map(ilacAnahtari));
  const eklenecek = [];
  const gorulen = new Set();
  for (const h of hazirlar || []) {
    const a = ilacAnahtari(h);
    if (var_.has(a) || gorulen.has(a)) continue;   // listenin kendi içindeki tekrarı da at
    gorulen.add(a);
    eklenecek.push(h);
  }
  return eklenecek;
}

/**
 * Listenin eski sürümünden yüklenmiş ve o günden beri adı/dozu değişmiş
 * kayıtları yeni adlarıyla döndürür (yerinde güncellemek için). Listedeki
 * `eski` alanı kaydın önceki sürümdeki ad/doz/etken maddesini taşıyor.
 * Önce eski ad ile yenisi farklı anahtar sayılıyordu: liste yeniden
 * yüklenince 18 kopya ekleniyor, Türkçe eski adlar da yanlarında kalıyordu.
 * Yalnız listeden gelmiş (`hazir`) ve anahtarı hâlâ eski olan kayıt
 * güncelleniyor; hekimin adını ya da dozunu değiştirdiği kayda, yeni adıyla
 * zaten bir kayıt varsa da eskisine dokunulmuyor.
 */
export function eskiKayitlariBul(mevcutlar, hazirlar) {
  const guncellenecek = [];
  for (const h of hazirlar || []) {
    if (!h?.eski) continue;
    const eskiAnahtar = ilacAnahtari({ ...h, ...h.eski });
    const yeniAnahtar = ilacAnahtari(h);
    for (const m of mevcutlar || []) {
      if (!m.hazir || ilacAnahtari(m) !== eskiAnahtar) continue;
      if ((mevcutlar || []).some((x) => x !== m && ilacAnahtari(x) === yeniAnahtar)) continue;
      const yeni = { ...m };
      // Etken madde de yalnız eskisiyle aynıysa: hekim düzelttiyse kalsın.
      for (const alan of Object.keys(h.eski)) {
        if (normalize(m[alan]) === normalize(h.eski[alan])) yeni[alan] = h[alan];
      }
      // Yazımı zaten yeni olan kayıt («İnsülin» → «Insulin» anahtarda aynı)
      // her yükseltmede boşuna yeniden yazılıp eşitlemeye girmesin.
      if (Object.keys(h.eski).some((alan) => yeni[alan] !== m[alan])) guncellenecek.push(yeni);
    }
  }
  return guncellenecek;
}

/** Liste satırından kayda geçen sınıflama alanları: kalıcı kimlik (`hazirId`),
 *  ilaç grubu, marka işareti ve kâğıttaki Latin önek. Olmayan alan yazılmıyor:
 *  eski sürümün okuduğu kayıt şekli değişmesin. */
const katalogAlanlari = (h) => ({
  ...(h.hid ? { hazirId: h.hid } : {}),
  ...(h.grup ? { grup: h.grup } : {}),
  ...(h.marka ? { marka: 1 } : {}),
  ...(h.kisa ? { kisa: h.kisa } : {}),
});

/** Listeden gelen kaydı depo kaydına çevirir. `hazir: 1` işareti, sonradan
 *  "listeden geleni temizle" diyebilmek için duruyor. */
export const listeKaydi = (h) => ({
  ad: h.ad ?? '', etkenMadde: h.etkenMadde ?? '', form: h.form ?? 'tablet',
  doz: h.doz ?? '', barkod: '', kutuAdedi: '', uretici: '', notlar: '',
  receteli: h.receteli !== false,
  hazir: 1,
  ...katalogAlanlari(h),
});

/** Belgenin beklenen biçimde olup olmadığı. `gruplar` 3. sürümle geldi;
 *  varsa dizi olmalı. */
export function listeGecerliMi(belge) {
  return !!belge && Array.isArray(belge.ilaclar)
    && (belge.gruplar === undefined || Array.isArray(belge.gruplar))
    && belge.ilaclar.every((i) => i && typeof i.ad === 'string' && i.ad.trim() !== '');
}

/**
 * 3. sürüme geçişte bir kez: listeden yüklenmiş ve hekimin DOKUNMADIĞI
 * kayıtlara kalıcı kimliği ve grubu ekler (yeniden yazılacakları döndürür).
 * Dokunulmamış = `hazir` işaretli, henüz kimliksiz ve ad|doz|şekli hâlâ bir
 * liste satırıyla aynı. Hekimin kendi eklediği ya da adını/dozunu
 * değiştirdiği kayda dokunulmuyor; onun grubu `grupBul` ile çalışırken
 * bulunuyor. İki cihaz aynı içeriği üretir, eşitlemede çakışma zararsız.
 */
export function katalogDamgasi(mevcutlar, katalog) {
  const anahtarla = new Map((katalog || []).map((h) => [ilacAnahtari(h), h]));
  const out = [];
  for (const m of mevcutlar || []) {
    if (m.hazir !== 1 || m.hazirId || m.silindi) continue;
    const h = anahtarla.get(ilacAnahtari(m));
    if (h) out.push({ ...m, ...katalogAlanlari(h) });
  }
  return out;
}

/** Karışımın bileşenleri sırasız: «A + B» ile «B + A» aynı etken. */
const etkenKanonu = (e) => String(e ?? '').split('+').map((p) => normalize(p)).filter(Boolean).sort().join(' + ');

/** Liste satırlarını üç yoldan bulmak için: kimlik, ad|doz|şekil, etken madde. */
export function katalogIndeksi(katalog) {
  const hid = new Map();
  const anahtar = new Map();
  const etken = new Map();
  for (const h of katalog || []) {
    if (h.hid) hid.set(h.hid, h);
    anahtar.set(ilacAnahtari(h), h);
    const e = etkenKanonu(h.etkenMadde);
    if (e && !etken.has(e)) etken.set(e, h);
  }
  return { hid, anahtar, etken };
}

/** Kaydın liste satırı: kimliğiyle, yoksa ad|doz|şekliyle. */
const satiriBul = (ilac, indeks) =>
  (ilac?.katalog ? ilac : null) || indeks?.hid.get(ilac?.hazirId) || indeks?.anahtar.get(ilacAnahtari(ilac)) || null;

/**
 * Herhangi bir ilaç kaydının grubu: kendi alanı, yoksa aynı ürünün liste
 * satırı, yoksa aynı etken maddeli ilk liste satırı. Bulunamazsa '' — o
 * ilaç yalnız «همه» altında görünür.
 */
export function grupBul(ilac, indeks) {
  return ilac?.grup || satiriBul(ilac, indeks)?.grup || indeks?.etken.get(etkenKanonu(ilac?.etkenMadde))?.grup || '';
}

/**
 * Ticari ad mı? Liste satırı biliyorsa o; hekimin kendi kaydında adı etken
 * maddeden farklıysa ticari sayılıyor (Brufen / Ibuprofen).
 */
export function markaMi(ilac, indeks) {
  if (ilac?.marka) return true;
  const h = satiriBul(ilac, indeks);
  if (h) return !!h.marka;
  const e = normalize(ilac?.etkenMadde);
  return !!e && normalize(ilac?.ad) !== e;
}

/**
 * Reçetede aranan havuz: hekimin silinmemiş kendi kayıtları + listede olup
 * henüz kayda dönüşmemiş satırlar (`katalog: true`, `id`siz). Kayda dönüşmüş
 * satır (aynı `hazirId` ya da aynı ad|doz|şekil) ikinci kez çıkmıyor.
 */
export function havuz(kayitlar, katalog) {
  const kendi = (kayitlar || []).filter((k) => !k.silindi);
  const hidler = new Set(kendi.map((k) => k.hazirId).filter(Boolean));
  const anahtarlar = new Set(kendi.map(ilacAnahtari));
  const liste = (katalog || [])
    .filter((h) => !hidler.has(h.hid) && !anahtarlar.has(ilacAnahtari(h)))
    .map((h) => ({ ...h, katalog: true }));
  return [...kendi, ...liste];
}

/** Ekranda en çok bu kadar sonuç çiziliyor: maliyet aramada değil DOM'da. */
export const SONUC_SINIRI = 40;

/**
 * Havuzu aramaya hazırlar: her kaydın aranan metni, grubu ve marka durumu
 * bir kez hesaplanıyor. Havuz değişince yeniden kurulur, her tuşta değil
 * (828 kayıtta tuş başına 0.5 ms yerine 0.03 ms).
 */
export function aramaDizini(havuzKayitlari, indeks) {
  return (havuzKayitlari || []).map((ilac) => ({
    ilac,
    metin: normalize([ilac.ad, ilac.etkenMadde, ilac.doz, ilac.barkod, ilac.uretici].filter(Boolean).join(' ')),
    ad: normalize(ilac.ad),
    grup: grupBul(ilac, indeks),
    marka: markaMi(ilac, indeks),
  }));
}

/**
 * Arama + süzgeç. `suzgec.marka` üç durumlu: '' hepsi, 'marka' ticari,
 * 'jenerik' jenerik. Sıra: hekimin sık yazdıkları, öbür kendi kayıtları,
 * listenin yaygınları (`sik`), gerisi; her kademede adı sorguyla başlayan
 * önce, sonra ad, sonra dozun sayısı (5 mg, 10 mg, 20 mg).
 * @param {string[]} sikIdler hekimin sık yazdığı ilaçların kimlikleri
 * @returns {{sonuclar: object[], toplam: number}} en çok `sinir` sonuç ve eşleşen sayısı
 */
export function ilacSuz(dizin, sorgu = '', suzgec = {}, { sikIdler = [], sinir = SONUC_SINIRI } = {}) {
  const qn = normalize(sorgu);
  const kelimeler = qn.split(/\s+/).filter(Boolean);   // eslesir() gibi: her kelime, sıra önemsiz
  const sik = new Set(sikIdler);
  const kademe = (i) => (i.id && sik.has(i.id) ? 0 : !i.katalog ? 1 : i.sik ? 2 : 3);
  const sayi = (d) => Number.parseFloat(String(d ?? '').replace(/,/g, '')) || 0;
  const bulunan = (dizin || []).filter((d) =>
    (!suzgec.grup || d.grup === suzgec.grup)
    && (!suzgec.form || d.ilac.form === suzgec.form)
    && (!suzgec.marka || (suzgec.marka === 'marka') === d.marka)
    && kelimeler.every((k) => d.metin.includes(k)));
  bulunan.sort((a, b) => kademe(a.ilac) - kademe(b.ilac)
    || (qn ? Number(!a.ad.startsWith(qn)) - Number(!b.ad.startsWith(qn)) : 0)
    || a.ad.localeCompare(b.ad)
    || sayi(a.ilac.doz) - sayi(b.ilac.doz));
  return { sonuclar: bulunan.slice(0, sinir).map((d) => d.ilac), toplam: bulunan.length };
}
