// Lacivert kâğıdın yoğunluk kipi ve sayfalara bölünmesi. Saf: DOM yok.
//
// Neden ölçmeden, hesapla: kâğıt iki yerde çiziliyor — ekrandaki canlı
// önizleme ve yazdırırken DOM'a hiç girmeden kurulan kopya. Kip DOM'dan
// ölçülseydi ikisi farklı kip seçebilir, hekim ekranda gördüğünden başka
// bir kâğıt basardı. Burada yalnız reçetenin içeriği sayılıyor; aynı reçete
// her yerde aynı kipi ve aynı sayfa bölünmesini veriyor.
//
// Sayılar yeni/kagit.md §6'dan: Chromium'da A4'e basılmış bir prototipte
// (gerçek yazı tipleri, tipik klinik içerik) ölçüldü. Sığmayan içerik
// küçülmüyor: 25 birimin üstünde kâğıt sayfalara bölünüyor (ilk sayfa
// «orta», devam sayfaları), okunaklılık sıkıştırmaya tercih ediliyor.
import { satirGorunumu } from './ilac.js';

export const KIPLER = ['rahat', 'orta', 'sik'];

/* Kip başına ölçüler (mm, pt). govde: antet, şerit ve ayaktan kalan gövde
   boyu. kapasite: sağ sütuna sığan ilaç birimi. adSinir/kulSinir: ilaç
   adının ve kullanım satırının kaç harften sonra ikinci satıra kırıldığı
   (sağ sütunun ≈ 93 mm'lik yazı eni, Vazirmatn'ın ortalama harf eniyle). */
export const KIP_OLCULERI = {
  rahat: { govde: 171, kapasite: 10, adSinir: 44, kulSinir: 70, baslik: 9.5, metin: 9.5, satir: 1.4, baslikUst: 3, olcum: 5.4, notEnAz: 11, bosCizgi: 4, ikiSutun: 5 },
  orta: { govde: 185, kapasite: 16, adSinir: 54, kulSinir: 84, baslik: 8.5, metin: 8.5, satir: 1.35, baslikUst: 2.2, olcum: 4.7, notEnAz: 9, bosCizgi: 4, ikiSutun: 3 },
  sik: { govde: 197, kapasite: 25, adSinir: 62, kulSinir: 95, baslik: 8, metin: 8, satir: 1.3, baslikUst: 1.8, olcum: 4.2, notEnAz: 8, bosCizgi: 4, ikiSutun: 3 },
};

/* Devam sayfası: kısa antet (vecize, iki ad, ayraç), yinelenen hasta
   şeridi, «orta» ölçüleri. Gövde 272 − 30 (kısa antet) − 8,5 − 3,5
   (şerit ve payları) − 22 (ayak) = 208 mm; altta imza satırı (19 mm).
   genis: klinik sütun bittiyse ilaçlar gövdenin tam eninde iki sütun;
   iki: sol sütunda klinik içerik sürüyorsa sağ sütun tek başına. Sütun
   dar (≈ 86 mm) olduğu için kırılma sınırları «orta»dan biraz kısa. */
export const DEVAM_OLCULERI = { govde: 208, sutunKapasite: 20, sagKapasite: 19, adSinir: 48, kulSinir: 76 };

/* İmza satırı «sik»te sol sütunun dibine iniyor (sağ sütunun her
   milimetresi ilaçlara); sol sütunun bütçesine o zaman bu da giriyor. */
const IMZA_SATIRI = 19;
/* Sayfalara bölünen kâğıdın ilk sayfası «ادامه در صفحهٔ بعد ←» satırıyla
   bitiyor: yarım ilaç birimi. */
const DEVAM_SATIRI = 0.5;

const PT = 25.4 / 72;
const SOL_EN = 71; // 78 mm'lik sol sütun eksi iç payları (3 + 4 mm)
const MADDE_GIRINTI = 4.5;
const SUTUN_ARASI = 3;

const doluMu = (v) => String(v ?? '').trim() !== '';

/** Liste alanı: dizi ya da «،», «,» ve satır sonuyla ayrılmış metin. */
export function kalemler(v) {
  const liste = Array.isArray(v) ? v : String(v ?? '').split(/[\n،,]/);
  return liste.map((x) => String(x ?? '').trim()).filter(Boolean);
}

/** Tanılar ve ICD kodları kâğıtta: sayılar denkse her tanının yanında kendi
 *  kodu («Chronic hepatitis C · B18.2»). Denk değilse (kodu elle silinmiş
 *  ya da kodsuz yazılmış tanı) hangi kodun hangi tanıya ait olduğu
 *  bilinemez: adlar ayrı, kodlar son satırda birlikte basılıyor. */
export function taniKalemleri(recete = {}) {
  const adlar = kalemler(recete.tani);
  const kodlar = kalemler(recete.taniKodu);
  if (adlar.length === kodlar.length) return adlar.map((ad, i) => `${ad} · ${kodlar[i]}`);
  return kodlar.length ? [...adlar, kodlar.join(' · ')] : adlar;
}

/**
 * İlaç girdisinin kâğıttaki iki satırı. Ad formdaki tablonun ad sütunuyla
 * aynı yardımcıdan (satirGorunumu): «Feldene (Piroxicam) 20 mg». İkinci
 * satırın başında adet — eczacı miktarları alt alta okusun.
 */
export function ilacSatiri(s = {}) {
  const { ad, doz, kisa } = satirGorunumu(s);
  return {
    kisa,
    ad: [ad, doz].filter(Boolean).join(' '),
    adet: `N=${s.adet ?? ''}`,
    kullanim: [s.kullanim, s.zaman, s.sure, s.yol, s.not].filter(doluMu).map((x) => String(x).trim()),
  };
}

/** Bir ilacın birimi: 1, adı ya da kullanımı ikinci satıra kırılıyorsa +0,5. */
export function ilacBirimi(s, sinir) {
  const x = ilacSatiri(s);
  const bir = (x.kisa ? x.kisa + ': ' : '') + x.ad;
  const iki = [x.adet, ...x.kullanim].join(' | ');
  return 1 + (bir.length > sinir.adSinir ? 0.5 : 0) + (iki.length > sinir.kulSinir ? 0.5 : 0);
}

const ilacYuku = (satirlar, sinir) => satirlar.reduce((t, s) => t + ilacBirimi(s, sinir), 0);

/**
 * Sol sütunun blokları, kâğıttaki sırayla. Boş belirti/tetkik/tanı rahat
 * kipte başlığı ve bir kalem çizgisiyle basılıyor (hekim elle yazabilsin),
 * sıkışık kiplerde atlanıyor; ölçümler ve not her zaman var.
 */
export function solBloklari(recete = {}, kip = 'rahat', { bos = false } = {}) {
  const liste = (tur, v) => {
    const k = bos ? [] : v;
    if (k.length || bos || kip === 'rahat') return [{ tur, kalemler: k }];
    return [];
  };
  return [
    ...liste('belirtiler', kalemler(recete.belirtiler)),
    ...liste('lab', kalemler(recete.laboratuvar)),
    { tur: 'olcum' },
    ...liste('tani', taniKalemleri(recete)),
    { tur: 'not', metin: bos ? '' : String(recete.notlar ?? '').trim() },
  ];
}

/* Bir kalemin kaç satır tuttuğu: harf sayısı × ortalama harf eni. Latin
   ≈ 0,5 em, Dari ≈ 0,36 em (Vazirmatn, ölçüldü). */
function satirSayisi(metin, pt, en) {
  const dari = /[؀-ۿ]/.test(metin);
  const harfMm = (dari ? 0.36 : 0.5) * pt * PT;
  return Math.max(1, Math.ceil((metin.length * harfMm) / en));
}

/** Liste bloğunun kalem satırları iki sütuna geçiyor mu (kagit.md §4.7). */
export const ikiSutunMu = (kip, n) => n > KIP_OLCULERI[kip].ikiSutun;

/** Bloğun tahmini boyu (mm). `ilk`: sütunun ilk bloğu (üst payı yok). */
export function blokBoyu(blok, kip, { ilk = false } = {}) {
  const o = KIP_OLCULERI[kip];
  const satirMm = o.metin * PT * o.satir;
  // Başlık: yazı + altın çizgi (0,7 üst pay, 0,7 kalınlık, 0,9 alt pay).
  const baslik = o.baslik * PT * 1.2 + 2.3 + (ilk ? 0 : o.baslikUst);
  if (blok.tur === 'olcum') return baslik + 8 * o.olcum;
  if (blok.tur === 'not') {
    // Kutunun iç payı 2 × 2 mm yanlarda, 2 × 1 mm üstte-altta, kenarı 0,3 mm.
    const metin = String(blok.metin ?? '').trim();
    const satirlar = metin ? metin.split('\n').reduce((t, s) => t + satirSayisi(s, o.metin, SOL_EN - 4.6), 0) : 0;
    return baslik + Math.max(o.notEnAz, satirlar * satirMm + 2.6);
  }
  if (!blok.kalemler.length) return baslik + o.bosCizgi;
  const iki = ikiSutunMu(kip, blok.kalemler.length);
  const en = iki ? (SOL_EN - SUTUN_ARASI) / 2 - MADDE_GIRINTI : SOL_EN - MADDE_GIRINTI;
  const satirlar = blok.kalemler.map((k) => satirSayisi(k, o.metin, en));
  const toplam = satirlar.reduce((t, n) => t + n, 0);
  return baslik + (iki ? Math.ceil(toplam / 2) : toplam) * satirMm;
}

const solYuku = (bloklar, kip) => bloklar.reduce((t, b, i) => t + blokBoyu(b, kip, { ilk: i === 0 }), 0);

/**
 * Sol sütun bloklarını bütçeye sığdığı kadar alır. Liste bloğu kalem kalem
 * bölünebiliyor (kalanı devam sayfasına «(cont.)» başlığıyla); ölçüm tablosu
 * ve not bölünmüyor. Boş sütuna en az bir blok girer: sonsuz döngü olmasın.
 */
function solBol(bloklar, butce, kip) {
  const alinan = [];
  let kullanilan = 0;
  let i = 0;
  for (; i < bloklar.length; i++) {
    const b = bloklar[i];
    const boy = blokBoyu(b, kip, { ilk: alinan.length === 0 });
    if (kullanilan + boy <= butce || (!alinan.length && !b.kalemler?.length)) {
      alinan.push(b);
      kullanilan += boy;
      continue;
    }
    if (b.kalemler?.length > 1 || (b.kalemler?.length && !alinan.length)) {
      let k = b.kalemler.length - 1;
      while (k > 0 && kullanilan + blokBoyu({ ...b, kalemler: b.kalemler.slice(0, k) }, kip, { ilk: !alinan.length }) > butce) k--;
      if (k === 0 && !alinan.length) k = 1;
      if (k > 0) {
        alinan.push({ ...b, kalemler: b.kalemler.slice(0, k) });
        return [alinan, [{ ...b, kalemler: b.kalemler.slice(k), devam: true }, ...bloklar.slice(i + 1)]];
      }
    }
    break;
  }
  return [alinan, bloklar.slice(i)];
}

/** `bas`tan başlayıp kapasiteye sığan son ilacın ardı (en az bir ilaç). */
function ilacBol(satirlar, bas, kapasite, sinir) {
  let yuk = 0;
  let i = bas;
  while (i < satirlar.length) {
    const b = ilacBirimi(satirlar[i], sinir);
    if (yuk + b > kapasite && i > bas) break;
    yuk += b;
    i++;
  }
  return i;
}

/**
 * Kâğıdın kipi ve sayfaları.
 * @returns {{ kip: 'rahat'|'orta'|'sik', sayfalar: Array<{ kip, duzen: 'tek'|'ilk'|'iki'|'genis',
 *   ilk: number, son: number, sol: object[]|null, no: number, toplam: number }> }}
 *   duzen: tek (her şey tek sayfada), ilk (bölünen kâğıdın ilk sayfası),
 *   iki (devam: solda klinik, sağda ilaç), genis (devam: ilaçlar iki sütun).
 *   ilk/son: sayfanın ilaç aralığı [ilk, son).
 */
export function kagitYogunlugu(recete = {}, hasta = null, { boyut = 'A4', bos = false } = {}) {
  const satirlar = bos ? [] : (recete.satirlar || []);
  const alerji = !bos && (hasta?.alerjiler || []).length > 0 ? 0.5 : 0;
  const numarala = (sayfalar) => sayfalar.map((s, i) => ({ ...s, no: i + 1, toplam: sayfalar.length }));

  if (bos) return { kip: 'rahat', sayfalar: numarala([{ kip: 'rahat', duzen: 'tek', ilk: 0, son: 0, sol: solBloklari(recete, 'rahat', { bos }) }]) };

  // A5'te sıkı kip yok: 0,7 kat küçültülünce yazısı ≈ 5,7 pt'ye iniyor.
  const kipler = boyut === 'A5' ? ['rahat', 'orta'] : KIPLER;
  for (const kip of kipler) {
    const o = KIP_OLCULERI[kip];
    const sol = solBloklari(recete, kip);
    const solButce = o.govde - 4 - (kip === 'sik' ? IMZA_SATIRI : 0);
    if (ilacYuku(satirlar, o) + alerji <= o.kapasite && solYuku(sol, kip) <= solButce) {
      return { kip, sayfalar: numarala([{ kip, duzen: 'tek', ilk: 0, son: satirlar.length, sol }]) };
    }
  }

  // Sığmıyor: ilk sayfa «orta», gerisi devam sayfaları.
  const o = KIP_OLCULERI.orta;
  const d = DEVAM_OLCULERI;
  const sayfalar = [];
  let [sol, kalan] = solBol(solBloklari(recete, 'orta'), o.govde - 4, 'orta');
  let i = ilacBol(satirlar, 0, o.kapasite - alerji - DEVAM_SATIRI, o);
  sayfalar.push({ kip: 'orta', duzen: 'ilk', ilk: 0, son: i, sol });
  while (i < satirlar.length || kalan.length) {
    if (kalan.length) {
      [sol, kalan] = solBol(kalan, d.govde - 4 - IMZA_SATIRI, 'orta');
      const son = i < satirlar.length ? ilacBol(satirlar, i, d.sagKapasite, d) : i;
      sayfalar.push({ kip: 'orta', duzen: 'iki', ilk: i, son, sol });
      i = son;
    } else {
      const son = ilacBol(satirlar, i, 2 * d.sutunKapasite, d);
      sayfalar.push({ kip: 'orta', duzen: 'genis', ilk: i, son, sol: null });
      i = son;
    }
  }
  return { kip: 'orta', sayfalar: numarala(sayfalar) };
}
