// Reçete kâğıdı. Ekranda gizli, yazdırılırken sayfadaki tek görünen şey.
// Düzen doktorun hâlihazırda kullandığı basılı reçete kâğıdından alındı:
// mavi antet (ad, ünvan şeridi), hizmet satırları, sabıka satırı, Name/Age/Date
// şeridi, solda Clinical sütunu, sağda ℞ alanı, altta rozetler ve iletişim.
//
// İki halde çalışır: dolu reçete ve boş kâğıt. Boş hal, doktorun tomar halinde
// bastırıp üzerine kalemle yazdığı kâğıdın aynısıdır — her şey aynı yerde durur,
// yalnız alanlar çizgi olarak basılır.
import { el, svgEl, qrGorsel } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { t } from './i18n.js';
import { tamAd, hastaYasi } from './paylasilan/hasta.js';
import { OLCUMLER } from './paylasilan/recete.js';
import { formKisa, ilacAdiFormsuz } from './paylasilan/ilac.js';
import { ozetMetni, kodSatiri } from './paylasilan/dogrulama.js';
import { trTarih } from './paylasilan/tarih.js';
import { telefonNormalize } from './paylasilan/metin.js';

/** Antet amblemi: kanatlı kadüse — hekimin basılı kâğıdındaki amblem.
 *
 *  Not: tıbbın doğru sembolü tek yılanlı Asklepios asasıdır; kanatlı iki
 *  yılanlı kadüse aslında ticaretin sembolü ve tıpta yaygın bir karışıklık.
 *  Burada yine de kadüse çiziliyor çünkü bu kâğıt hekimin kendi antedi ve
 *  onun basılı reçetesinde bu amblem var — kâğıdın kimliği, bizim tercihimiz
 *  değil. Asklepios çizimi denendi ve "bizimki bu değil" diye geri alındı.
 *
 *  İki yılan x=50 ekseninde birbirinin aynası; birlikte klasik sarmalı
 *  veriyorlar. 100×100 kutuya oturur, boyutu CSS verir. */
function amblemCiz() {
  const yilan = (d) => svgEl('path', {
    d, fill: 'none', stroke: 'currentColor', 'stroke-width': 4.6,
    'stroke-linecap': 'round',
  });
  return svgEl('svg', { class: 'kagit__amblem-cizim', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
    svgEl('g', { fill: 'currentColor' },
      // Asa ve tepesindeki topuz
      svgEl('circle', { cx: 50, cy: 10, r: 5.4 }),
      svgEl('path', { d: 'M46.8 16h6.4v72l-3.2 8-3.2-8z' }),
      // Kanatlar: tüy katmanları dışa doğru inceliyor
      svgEl('path', { d: 'M53 25c10-7 24-11 41-10-5 4-12 7-19 8 6 1 11 3 16 6-7 3-15 3-22 1 5 3 9 6 12 10-10 0-19-3-26-9-3-2-4-4-2-6z' }),
      svgEl('path', { d: 'M47 25c-10-7-24-11-41-10 5 4 12 7 19 8-6 1-11 3-16 6 7 3 15 3 22 1-5 3-9 6-12 10 10 0 19-3 26-9 3-2 4-4 2-6z' }),
      // Yılan başları, sarmalın üst uçlarında
      svgEl('ellipse', { cx: 57.5, cy: 30, rx: 4.4, ry: 3.2, transform: 'rotate(-28 57.5 30)' }),
      svgEl('ellipse', { cx: 42.5, cy: 30, rx: 4.4, ry: 3.2, transform: 'rotate(28 42.5 30)' })),
    yilan('M50 82c16-4 16-15 0-19s-16-15 0-19c11-3 11-9 6-14'),
    yilan('M50 82c-16-4-16-15 0-19s16-15 0-19c-11-3-11-9-6-14'));
}

/* Clinical sütununun dolgulu simgeleri. `simge()` her şeyi konturla çiziyor;
   basılı kâğıtta bu sütunun simgeleri dolu siluet. Kâğıda ait oldukları için
   simge setine değil buraya konuldular — `amblemCiz`, `filigran`, `dalga`
   zaten aynı kalıpta. */
const OLCUM_CIZIMLERI = {
  kalp: [['path', { d: 'M12 21.2s-8.2-5.2-8.2-11.2a4.7 4.7 0 0 1 8.2-3.1 4.7 4.7 0 0 1 8.2 3.1c0 6-8.2 11.2-8.2 11.2z' }]],
  ekg: [['path', { d: 'M1.8 12h3.8l2-6.6 3 13.2 2.5-8.2 1.8 4.1h7.3', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }]],
  akciger: [
    ['path', { d: 'M11.15 2.8h1.7v8.6h-1.7z' }],
    ['path', { d: 'M10.6 11.6c-2.9.5-4.7 3-4.7 6.1v1.6A2.5 2.5 0 0 0 8.4 21.8h1.5a2.5 2.5 0 0 0 2.5-2.5v-5.2c0-1.7-.6-2.8-1.8-2.5z' }],
    ['path', { d: 'M13.4 11.6c2.9.5 4.7 3 4.7 6.1v1.6a2.5 2.5 0 0 1-2.5 2.5h-1.5a2.5 2.5 0 0 1-2.5-2.5v-5.2c0-1.7.6-2.8 1.8-2.5z' }],
  ],
  tarti: [
    ['path', { d: 'M7.4 7.4h9.2a2.3 2.3 0 0 1 2.3 2l1.4 9.4a1.6 1.6 0 0 1-1.6 1.8H5.3a1.6 1.6 0 0 1-1.6-1.8l1.4-9.4a2.3 2.3 0 0 1 2.3-2z' }],
    ['path', { d: 'M9.2 10.6a3 3 0 0 1 5.6 0', fill: 'none', stroke: '#fff', 'stroke-width': 1.5, 'stroke-linecap': 'round' }],
    ['path', { d: 'M12 11.4v3.2', fill: 'none', stroke: '#fff', 'stroke-width': 1.5, 'stroke-linecap': 'round' }],
  ],
  termometre: [
    ['path', { d: 'M12 2.2a2.5 2.5 0 0 0-2.5 2.5v9a4.2 4.2 0 1 0 5 0v-9A2.5 2.5 0 0 0 12 2.2z' }],
    ['path', { d: 'M16.6 6.4h2.2M16.6 9.4h2.2', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' }],
  ],
  oksijen: [['path', { d: 'M12 2.6s6.5 7.2 6.5 11.4a6.5 6.5 0 0 1-13 0C5.5 9.8 12 2.6 12 2.6z' }]],
  kan: [
    ['path', { d: 'M12 2.6s6.5 7.2 6.5 11.4a6.5 6.5 0 0 1-13 0C5.5 9.8 12 2.6 12 2.6z' }],
    ['path', { d: 'M6.6 13.4h10.8', fill: 'none', stroke: '#fff', 'stroke-width': 1.6, 'stroke-linecap': 'round' }],
  ],
  // Basılı kâğıtta boy simgesi ayakta duran bir insan.
  boy: [
    ['circle', { cx: 12, cy: 4.6, r: 2.6 }],
    ['path', { d: 'M12 8.2c-2.3 0-3.9 1.6-3.9 3.9v4.1h1.7v5.4h4.4v-5.4h1.7v-4.1c0-2.3-1.6-3.9-3.9-3.9z' }],
  ],
};

/** Clinical sütunundaki dolgulu ölçüm simgesi. */
function olcumSimgesi(ad) {
  const parcalar = OLCUM_CIZIMLERI[ad] || OLCUM_CIZIMLERI.kalp;
  return svgEl('svg', {
    class: 'simge kagit__olcum-cizim', viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true',
  }, ...parcalar.map(([tag, attrs]) => svgEl(tag, attrs)));
}

/** Slogan rozetindeki logo: içinden kalp atışı geçen dolu kalp. */
function sloganAmblemi() {
  return svgEl('svg', { class: 'kagit__slogan-cizim', viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    svgEl('path', {
      d: 'M12 21.4s-8.6-5.4-8.6-11.6a4.9 4.9 0 0 1 8.6-3.2 4.9 4.9 0 0 1 8.6 3.2c0 6.2-8.6 11.6-8.6 11.6z',
      fill: 'currentColor',
    }),
    // Atış çizgisi kalbin üstünde oyuk: tek renkte ancak böyle okunur.
    svgEl('path', {
      d: 'M4.6 12.4h3.2l1.6-3.4 2.4 6.6 1.8-4.2 1.2 2.2h4.6',
      fill: 'none', stroke: '#fff', 'stroke-width': 1.6,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }));
}

/** Antetin sağında, kadüsenin altındaki ikinci amblem: kalbin içinde aile.
 *  Basılı kâğıtta "با ما … به سوی زندگی سالمتر" yazısının ortasında duruyor.
 *  Dolgulu çizim: figürler kalbin üstünde beyaz oyuk olarak okunuyor. */
function aileAmblemi() {
  return svgEl('svg', { class: 'kagit__aile-cizim', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
    svgEl('path', {
      d: 'M50 88C20 68 6 48 6 32 6 18 17 8 30 8c9 0 16 5 20 12 4-7 11-12 20-12 13 0 24 10 24 24 0 16-14 36-44 56z',
      fill: 'currentColor',
    }),
    // Figürler kalbin dar alanına sığsın diye içeri çekildi: kenara yaklaşınca
    // gövdeler kalbin dışına taşıyor ve amblem kirli görünüyordu.
    svgEl('g', { fill: '#fff' },
      svgEl('circle', { cx: 34, cy: 34, r: 6.5 }),
      svgEl('path', { d: 'M34 42.5c-5.6 0-10 4.4-10 10V60h20v-7.5c0-5.6-4.4-10-10-10z' }),
      svgEl('circle', { cx: 66, cy: 34, r: 6.5 }),
      svgEl('path', { d: 'M66 42.5c-5.6 0-10 4.4-10 10V60h20v-7.5c0-5.6-4.4-10-10-10z' }),
      svgEl('circle', { cx: 50, cy: 46, r: 5 }),
      svgEl('path', { d: 'M50 52.5c-4.4 0-7.5 3.1-7.5 7.5v5h15v-5c0-4.4-3.1-7.5-7.5-7.5z' })));
}

/** Clinical sütununun altındaki sağlık çizimi: borusu kalp çizen stetoskop.
 *  Basılı kâğıtta burada bir fotoğraf var; çizgi çizimi onun dürüst
 *  karşılığı — fotoğrafı yeniden üretemeyiz, düzeni ve ağırlığı veriyoruz. */
function saglikResmi() {
  const boru = (d, kalinlik = 3) => svgEl('path', {
    d, fill: 'none', stroke: 'currentColor', 'stroke-width': kalinlik,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  });
  return svgEl('svg', { class: 'kagit__saglik-cizim', viewBox: '0 0 120 80', 'aria-hidden': 'true' },
    svgEl('path', {
      d: 'M62 72C44 60 32 48 32 36c0-9 7-15 15-15 6 0 11 3 15 9 4-6 9-9 15-9 8 0 15 6 15 15 0 12-12 24-30 36z',
      fill: 'currentColor', opacity: .17,
    }),
    boru('M16 10v13a11 11 0 0 0 22 0V10'),
    boru('M12 10h8M34 10h8'),
    boru('M27 34v9c0 12 10 22 22 22h12'),
    svgEl('circle', { cx: 69, cy: 65, r: 7.5, fill: 'none', stroke: 'currentColor', 'stroke-width': 3 }),
    boru('M80 38h7l4-9 6 18 4-9h11', 2.4));
}

/** Vecize kartuşunun iki yanındaki süs. Basılı kâğıtta kıvrımlı bir
 *  arabesk duruyor; buradaki karşılığı kıvrım + baklava. */
function vecizeSusu() {
  return svgEl('svg', { class: 'kagit__sus-cizim', viewBox: '0 0 46 16', 'aria-hidden': 'true' },
    svgEl('path', {
      d: 'M1.5 8c3-5.2 6-5.2 9 0s6 5.2 9 0',
      fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linecap': 'round',
    }),
    svgEl('path', { d: 'M21 8h5.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.1, 'stroke-linecap': 'round' }),
    svgEl('path', { d: 'M33 3.4 37.6 8 33 12.6 28.4 8z', fill: 'currentColor' }),
    svgEl('path', { d: 'M39.5 8h5', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.1, 'stroke-linecap': 'round' }));
}

/* Klinik alanların etiketleri kâğıtta İngilizce durur: doktorun kendi kâğıdı
   da böyle ve BP/PR/RR/BW hekimlikte evrensel kısaltmalar. */
/** Kâğıda basılı, değişmeyen satır. Ayarlarda karşılığı yoktur; kaldırmak
 *  ya da değiştirmek için bu dosyayı düzenlemek gerekir — öyle istendi. */
const VECIZE = 'طبیب حقیقی خداوند (ج) است';

/** İmzanın karşısındaki hat yazısı. Vecize gibi kâğıda ait: ayarlardan
 *  gelmiyor, boş kâğıtta da basılıyor. */
// Basılı kâğıtta iki satır: üstte küçük «سلامت», altında akışkan yazıyla
// gerisi. Tek satır denendi, hat değil düz bir etiket gibi duruyordu.
// Metin TEK yerde duruyor, satırlar ondan türetiliyor: iki ayrı sabit
// olsaydı biri değişip öteki kalabilirdi. İlk satırın sonundaki boşluk
// bilerek korunuyor — yoksa kâğıdın metni "سلامتسرمایهٔ" diye okunuyor
// (ekran okuyucuda da, kopyalayınca da).
const HAT_YAZISI = 'سلامت سرمایهٔ زندگی است';

const KLINIK_ADLARI = { bp: 'BP', pr: 'PR', rr: 'RR', bw: 'BW', temp: 'Temperature', spo2: 'SpO2', ht: 'Height' };

/* Her ölçümün yanında kendi simgesi duruyor: sütun bir etiket listesi değil,
   bakışta taranabilen bir pano olsun. */
const OLCUM_SIMGELERI = {
  bp: 'kalp', pr: 'ekg', rr: 'akciger', bw: 'tarti',
  temp: 'termometre', spo2: 'oksijen', ht: 'boy',
};

/* Hasta şeridindeki alanların simgeleri, şeritteki sırayla. */
const SERIT_SIMGELERI = ['hasta', 'takvim', 'takvim', 'recete'];

/** Köşe süsü ve ayak bandı için akan dalga çizimleri.
 *
 *  CSS zemini değil SVG ÖĞESİ: zemin dolguları yazdırmada tarayıcının
 *  "arka plan grafikleri" seçeneğine bağlı, SVG içeriği ise her zaman basılır.
 *  (print-color-adjust yine de duruyor, bu ikinci emniyet.) */
function dalga(yer) {
  if (yer === 'ust') {
    // Basılı kâğıtta antet, sayfanın TAMAMINI kateden akan kurdelelerin
    // üzerinde duruyor. Köşe kütlesi denendi (iki köşeye birer üçgen):
    // kurdele hissi vermiyordu, kâğıdın üstüne yapıştırılmış iki leke gibi
    // duruyordu. Kurdeleler tam genişlikte, birbirinin üstünden geçiyor ve
    // ortada alçalıp kenarlarda yükseliyor — asıl kâğıttaki hareket bu.
    return svgEl('svg', {
      class: 'kagit__dalga kagit__dalga--ust', viewBox: '0 0 1000 220',
      preserveAspectRatio: 'none', 'aria-hidden': 'true',
    },
    // En geniş ve en soluk katman, en alta iniyor.
    svgEl('path', { class: 'kagit__dalga-1', d: 'M0 0H1000V34C928 52 878 72 818 76 740 81 698 54 638 60 546 68 518 114 448 126 368 140 318 102 248 116 158 134 82 166 0 206Z' }),
    svgEl('path', { class: 'kagit__dalga-2', d: 'M0 0H1000V24C930 40 882 58 824 62 748 67 708 42 650 47 560 54 534 96 466 107 388 119 340 82 272 92 186 104 90 106 0 96Z' }),
    svgEl('path', { class: 'kagit__dalga-ak', d: 'M0 196C84 160 178 132 264 116 334 103 382 136 460 125 528 115 554 71 644 65 702 61 744 84 820 80 878 76 926 58 1000 40V22C926 40 878 58 820 62 744 66 702 43 644 47 554 53 528 97 460 107 382 118 334 85 264 98 178 114 84 142 0 178Z' }),
    svgEl('path', { class: 'kagit__dalga-3', d: 'M0 0H1000V14C932 30 886 46 830 50 756 55 718 32 662 36 574 42 550 78 484 86 408 94 360 62 294 70 206 80 92 74 0 58Z' }));
  }
  // Ayak bandı: üst kenarı kâğıt renginde kesiliyor, içinde de kurdeleler akıyor.
  return svgEl('svg', {
    class: 'kagit__dalga kagit__dalga--alt', viewBox: '0 0 1000 150',
    preserveAspectRatio: 'none', 'aria-hidden': 'true',
  },
  svgEl('path', { class: 'kagit__dalga-kesim', d: 'M0 0H1000V52C874 96 742 30 606 52 470 74 352 18 214 40 140 52 68 70 0 58Z' }),
  svgEl('path', { class: 'kagit__dalga-ak', d: 'M0 96C140 62 300 118 470 92 640 66 820 120 1000 82V104C820 142 640 88 470 114 300 140 140 84 0 118Z' }),
  svgEl('path', { class: 'kagit__dalga-2', d: 'M0 62C82 90 168 44 268 58 386 74 470 114 592 100 704 87 812 42 1000 80V0H0Z' }));
}

const doluMu = (v) => String(v ?? '').trim() !== '';
const satirlara = (metin) => String(metin ?? '').split('\n').map((x) => x.trim()).filter(Boolean);

/** Kâğıdın üstündeki QR'ın içeriği. Ayarlardan seçilir. */
export function qrIcerigi(ayar, recete, hasta, { bos = false } = {}) {
  const secim = ayar.qrIcerik || 'whatsapp';
  if (secim === 'yok') return '';
  if (secim === 'recete' && !bos && recete) {
    // Doğrulanabilir içerik: kanonik özet + kod. Eczaneci QR'ı okutup kâğıttaki
    // yazıyla karşılaştırır; ikisi tutmuyorsa kâğıt üzerinde oynanmıştır.
    const ozet = ozetMetni(recete, tamAd(hasta));
    return recete.dogrulamaKodu ? `${ozet}\n${kodSatiri(recete.dogrulamaKodu)}` : ozet;
  }
  const numara = telefonNormalize(ayar.whatsapp || ayar.telefon, ayar.ulkeKodu);
  return numara ? `https://wa.me/${numara}` : '';
}

/** ℞ alanının arkasındaki soluk kalp + kalp atışı çizimi. */
function filigran() {
  return svgEl('svg', { class: 'kagit__filigran', viewBox: '0 0 240 120', 'aria-hidden': 'true' },
    svgEl('path', {
      d: 'M120 96c-1.5 0-26-16-32-30-4.5-10.5 1-21 11-23.5 7.5-1.9 15.4 1.2 21 8 5.6-6.8 13.5-9.9 21-8 10 2.5 15.5 13 11 23.5-6 14-30.5 30-32 30z',
      fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6,
    }),
    svgEl('path', {
      d: 'M120 62c-4 8-8 14-12 18-3-14-6-28-9-38-3 10-5 18-8 22H2',
      fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linejoin': 'round',
    }),
    svgEl('path', {
      d: 'M238 64h-53c-3-4-5-12-8-22-3 10-6 24-9 38-4-4-8-10-12-18',
      fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linejoin': 'round',
    }));
}

/**
 * Reçete kâğıdını kurar.
 * `bos: true` → hasta, ölçüm ve ilaç alanları elle doldurulmak üzere boş kalır.
 */
/**
 * @param {object} c
 * @param {boolean} [c.duzenlenebilir] Kâğıdın üzerinde çalışılacaksa true:
 *   boş alanlar da yer tutucuyla çiziliyor ve her alan `data-alan` ile
 *   işaretleniyor. Düzenleme ekranı bu işaretlerden yakalıyor — kâğıdın
 *   çizimi tek yerde kalsın, ikinci bir kopya çıkmasın diye.
 */
export function kagitCiz({ recete = {}, hasta = null, ayar = {}, bos = false, duzenlenebilir = false } = {}) {
  const boyut = ayar.yazdirmaBoyutu === 'A5' ? 'A5' : 'A4';
  // Kâğıt stili. 'klasik' hekimin hâlihazırda kullandığı basılı kâğıdın
  // aynısı; eski sürüm bunu 'renkli' diye kaydediyordu, o değer korunuyor.
  // Yeni kurulumlarda varsayılan 'modern'.
  const stilAdi = ayar.kagitStili === 'sade' ? 'sade'
    : (ayar.kagitStili === 'klasik' || ayar.kagitStili === 'renkli') ? 'klasik'
      : 'modern';
  const stilSinifi = stilAdi === 'klasik' ? '' : ` kagit--${stilAdi}`;
  const stil = el('style', {});
  // ℞ alanı sayfanın kalanını doldursun: boş kâğıtta yazmaya bol yer kalır.
  stil.textContent = `@page { size: ${boyut}; margin: ${boyut === 'A5' ? '6mm' : '8mm'}; }`
    + ` .kagit { --rx-boy: ${boyut === 'A5' ? '92mm' : '168mm'}; }`;

  const yas = hasta ? hastaYasi(hasta) : null;

  /** Alanı düzenleme ekranına tanıtır. Düzenlenebilir değilse öğeyi
   *  olduğu gibi bırakır: basılan kâğıtta hiçbir iz kalmaz. */
  const duz = (ad, oge) => {
    if (!duzenlenebilir || !oge) return oge;
    oge.setAttribute('data-alan', ad);
    oge.setAttribute('tabindex', '0');
    oge.setAttribute('role', 'button');
    oge.classList.add('kagit__duz');
    return oge;
  };
  /** Boş alanın yer tutucusu: düzenlerken görünür, basarken çizilmez. */
  const yerTutucu = (ad, metin) => duzenlenebilir
    ? duz(ad, el('div', { class: 'kagit__duz-bos' }, el('span', {}, '+ ' + metin)))
    : null;
  const cizgi = (genislik) => el('span', { class: 'kagit__cizgi', style: genislik ? { inlineSize: genislik } : null }, ' ');

  /* Kâğıdın iki yanındaki sabit yazılar. Rozet etiketleri gibi `??` ile:
     ayarda hiç dokunulmamışsa basılı kâğıttakiler çıkıyor, hekim silmek
     isterse alanı boşaltması yetiyor (boş dize '' geçerli bir değer). */
  const sloganAlt = ayar.sloganAlt ?? t('kagit.slogan_alt', 'Your Health, Our Priority');
  const cagriUst = ayar.cagriUst ?? t('kagit.cagri_ust', 'با ما');
  const cagriAlt = ayar.cagriAlt ?? t('kagit.cagri_alt', 'به سوی زندگی سالم‌تر');

  /* ---- Antet: sağda doktorun adı, ortada amblem, solda slogan ---- */
  const antet = el('header', { class: 'kagit__antet' },
    el('div', { class: 'kagit__ad-blok' },
      el('div', { class: 'kagit__doktor' }, [recete.doktorUnvan || ayar.doktorUnvan, recete.doktorAd || ayar.doktorAd].filter(doluMu).join(' ')),
      doluMu(ayar.doktorAdAlt) ? el('div', { class: 'kagit__doktor-alt' }, ayar.doktorAdAlt) : null),
    el('div', { class: 'kagit__amblem' }, amblemCiz()),
    // Slogan bloğu: basılı kâğıtta yuvarlak bir rozetin içinde kalp+EKG,
    // altında Farsça satırlar, en altta Latin karşılığı.
    el('div', { class: 'kagit__slogan' },
      el('span', { class: 'kagit__slogan-daire' }, sloganAmblemi()),
      doluMu(ayar.slogan) ? el('div', {}, ...satirlara(ayar.slogan).map((x) => el('div', {}, x))) : null,
      doluMu(sloganAlt) ? el('div', { class: 'kagit__slogan-alt', dir: 'ltr' }, sloganAlt) : null,
      doluMu(ayar.klinikAdi) ? el('div', { class: 'kagit__klinik-ad' }, ayar.klinikAdi) : null));

  const unvan = doluMu(ayar.uzmanlik) ? el('div', { class: 'kagit__unvan' }, el('span', {}, ayar.uzmanlik)) : null;

  /* ---- Hizmetler: her satır kendi simgesiyle, altında ilgi alanları ---- */
  const hizmetSatirlari = satirlara(ayar.hizmetler);
  // Hizmetlerin sağında ikinci amblem: kalbin içinde aile, üstünde ve altında
  // birer satır. Basılı kâğıtta kadüsenin altında, tam bu hizada duruyor.
  const aile = doluMu(cagriUst) || doluMu(cagriAlt)
    ? el('div', { class: 'kagit__cagri' },
      doluMu(cagriUst) ? el('div', { class: 'kagit__cagri-ust' }, cagriUst) : null,
      el('span', { class: 'kagit__cagri-amblem' }, aileAmblemi()),
      doluMu(cagriAlt) ? el('div', { class: 'kagit__cagri-alt' }, cagriAlt) : null)
    : null;
  const hizmet = hizmetSatirlari.length || doluMu(ayar.hizmetAlanlari) || aile
    ? el('div', { class: 'kagit__hizmet' },
      aile,
      el('div', { class: 'kagit__hizmet-govde' },
        hizmetSatirlari.length
          ? el('div', { class: 'kagit__hizmet-satir' }, ...hizmetSatirlari.map((h, i) =>
            el('span', { class: 'kagit__hizmet-oge' },
              el('span', { class: 'kagit__hizmet-daire' }, simge(i % 2 ? 'ultrason' : 'ekg', { boy: 15 })),
              el('span', {}, h))))
          : null,
        doluMu(ayar.hizmetAlanlari) ? el('div', { class: 'kagit__hizmet-alan' }, ayar.hizmetAlanlari) : null))
    : null;

  const deneyim = doluMu(ayar.deneyim) ? el('div', { class: 'kagit__deneyim' }, ayar.deneyim) : null;

  /* ---- Kâğıda ait sabit satır ----
     Hekimin basılı reçetesinde bu satır var ve kalması istendi. Bilerek
     ayarlardan gelmiyor ve bilerek koşulsuz basılıyor: kâğıdın parçası,
     doldurulan bir alan değil. Boş kâğıtta da çıkar. */
  // Süslü çerçeve: basılı kâğıtta bu satır bir kartuş içinde duruyor.
  // Süsler aria-hidden değil, metin düğümü olmadıkları için okuyucuya düşmez.
  const susSag = vecizeSusu();
  const susSol = vecizeSusu();
  susSol.classList.add('kagit__sus-cizim--ayna');
  const vecize = el('div', { class: 'kagit__vecize' },
    el('span', { class: 'kagit__vecize-cerceve' },
      el('span', { class: 'kagit__vecize-sus' }, susSag),
      el('span', { class: 'kagit__vecize-metin' }, VECIZE),
      el('span', { class: 'kagit__vecize-sus' }, susSol)));

  /* ---- Hasta şeridi: Name / Age / Date / No ---- */
  const alan = (etiket, deger, genislik, simgeAdi, duzAd) => duz(duzAd, el('span', { class: 'kagit__alan' },
    simgeAdi ? simge(simgeAdi, { boy: 15 }) : null,
    el('b', {}, etiket + ':'), bos ? cizgi(genislik) : el('span', { dir: 'auto' }, deger || '—')));

  // Şerit ve klinik sütun soldan sağa: etiketleri İngilizce ve basılı kâğıtta
  // da bu yönde. Sayfanın kalanı sağdan sola kalır.
  const serit = el('div', { class: 'kagit__serit', dir: 'ltr' },
    alan('Name', tamAd(hasta), '52mm', SERIT_SIMGELERI[0], 'hasta'),
    alan('Age', yas !== null ? String(yas) : '', '18mm', SERIT_SIMGELERI[1], null),
    alan('Date', bos ? '' : trTarih(recete.tarih), '30mm', SERIT_SIMGELERI[2], 'tarih'),
    alan('No', bos ? '' : recete.receteNo, '28mm', SERIT_SIMGELERI[3], null));

  /* ---- Clinical sütunu: ölçümler, altta stetoskop ve QR ---- */
  const qr = qrGorsel(qrIcerigi(ayar, recete, hasta, { bos }), { boy: 76, sinif: 'kagit__qr' });
  const sutun = el('aside', { class: 'kagit__klinik-sutun', dir: 'ltr' },
    el('div', { class: 'kagit__sutun-bas' },
      el('span', {}, t('kagit.klinik', 'Clinical')),
      simge('stetoskop', { boy: 24 })),
    el('div', { class: 'kagit__olcumler' },
      // Girilmemiş ölçüm tire değil çizgi basılır: doktor çıktının üstüne
      // kalemle yazabilsin. Kâğıt hem dolu hem elle tamamlanabilir olsun diye.
      ...OLCUMLER.map(([anahtar, , , birim]) => duz('olcum:' + anahtar, el('div', { class: 'kagit__olcum' },
        el('span', { class: 'kagit__olcum-simge' }, olcumSimgesi(OLCUM_SIMGELERI[anahtar] || 'kalp')),
        el('b', {}, `${KLINIK_ADLARI[anahtar]} :`),
        !bos && doluMu(recete.olcumler?.[anahtar])
          ? el('span', { dir: 'ltr' }, `${recete.olcumler[anahtar]} ${birim}`)
          : cizgi()))),
      // Kan grubu ölçüm değil, hastanın künyesi — ama hekim onu da burada
      // arıyor. Ölçümlerle aynı satır düzeninde, en altta. Ayırt edici
      // sınıfı var: deneme ölçüm sayarken bunu saymasın.
      duz('kanGrubu', el('div', { class: 'kagit__olcum kagit__olcum--kan' },
        el('span', { class: 'kagit__olcum-simge' }, olcumSimgesi('kan')),
        el('b', {}, 'Blood Gr. :'),
        !bos && doluMu(recete.kanGrubu)
          ? el('span', { dir: 'ltr' }, recete.kanGrubu)
          : cizgi()))),
    !bos && doluMu(recete.dogrulamaKodu)
      ? el('div', { class: 'kagit__kod' },
        el('span', { class: 'kagit__olcum-simge' }, simge('kilit', { boy: 15 })),
        el('b', {}, t('kagit.kod', 'کد تأیید') + ': '), el('span', { dir: 'ltr' }, recete.dogrulamaKodu))
      : null,
    el('div', { class: 'kagit__sutun-ayak' },
      el('div', { class: 'kagit__sutun-resim' },
        saglikResmi(),
        el('div', { class: 'kagit__sutun-yazi' },
          ...satirlara(t('kagit.saglik_sozu', 'Healthy\nLife\nBrighter\nTomorrow')).map((x) => el('div', {}, x)))),
      el('div', { class: 'kagit__qr-kutu' }, qr,
        el('span', { class: 'kagit__qr-alt' }, t('kagit.qr_alt', 'Scan for Contact')))));

  /* ---- ℞ alanı ---- */
  const tani = !bos && (doluMu(recete.tani) || doluMu(recete.taniKodu))
    ? duz('tani', el('div', { class: 'kagit__tani' }, el('b', {}, t('recete.tani', 'Tanı') + ': '), [recete.tani, recete.taniKodu].filter(doluMu).join(' · ')))
    : (bos ? null : yerTutucu('tani', t('recete.tani', 'Tanı')));

  const alerjiler = hasta?.alerjiler || [];
  const alerji = !bos && alerjiler.length
    ? el('div', { class: 'kagit__alerji' }, el('b', {}, t('hasta.alerji', 'Alerji') + ': '), alerjiler.join(', '))
    : null;

  // İlaç satırı hekimin ve eczacının alışık olduğu biçimde:
  // "1- Cap: Amoxicillin 500 mg" … "N=12". Numarayı <ol> veriyor.
  // Şekli bilinmeyen (eski) satırda önek basılmaz, ad tek başına kalır.
  const ilacGovdesi = bos
    ? null
    // Liste soldan sağa: sıra numarası adın SOLUNDA dursun ("1. Tab: …").
    // RTL'de numara sağa geçiyor ve ".1" diye ters basılıyordu.
    : el('ol', { class: 'kagit__ilaclar', dir: 'ltr' }, ...(recete.satirlar || []).map((s, i) => {
      const kisa = formKisa(s.form);
      return duz('ilac:' + i, el('li', {},
        el('div', { class: 'kagit__ilac-ad', dir: 'ltr' },
          kisa ? el('span', { class: 'kagit__form' }, kisa + ':') : null,
          el('b', {}, ilacAdiFormsuz(s.ilacAdi, s.form)),
          el('span', { class: 'kagit__adet' }, `N=${s.adet}`)),
        doluMu(s.kullanim) || doluMu(s.sure) || doluMu(s.yol) || doluMu(s.not)
          // Kullanım satırı Farsça: yönünü içeriğinden alsın, liste LTR olsa da.
          ? el('div', { class: 'kagit__kullanim', dir: 'auto' }, [s.kullanim, s.sure, s.yol, s.not].filter(doluMu).join(' · '))
          : null));
    }));

  // Hastanın anlattıkları tanının üstünde: kâğıt muayenenin sırasını izlesin.
  const belirtiler = !bos && doluMu(recete.belirtiler)
    ? duz('belirtiler', el('div', { class: 'kagit__belirti' }, el('b', {}, t('kagit.belirtiler', 'Belirtiler') + ': '), recete.belirtiler))
    : (bos ? null : yerTutucu('belirtiler', t('kagit.belirtiler', 'Belirtiler')));

  // Tetkik istemi ilaçlardan sonra, kendi bloğunda: gerçek reçetede de
  // ayrı bir istem, ilaç listesinin parçası değil.
  const laboratuvar = !bos && doluMu(recete.laboratuvar)
    ? duz('laboratuvar', el('div', { class: 'kagit__lab' },
      el('div', { class: 'kagit__lab-bas' }, t('kagit.laboratuvar', 'Laboratuvar')),
      el('div', {}, recete.laboratuvar)))
    : (bos ? null : yerTutucu('laboratuvar', t('kagit.laboratuvar', 'Laboratuvar')));

  // İmza yeri: gerçek reçetede hekimin imzası olur. Dolu kâğıtta da boş
  // kâğıtta da basılıyor — imza her hâlükârda elle atılıyor.
  const imza = el('div', { class: 'kagit__imza' },
    el('span', { class: 'kagit__imza-cizgi' }, ' '),
    el('span', { class: 'kagit__imza-etiket' }, t('kagit.imza', 'امضا')));

  // Hat yazısı imzanın KARŞI köşesinde. İmza 42mm'lik dar bir sütun, içine
  // koyunca sığmıyor; kendi başına konumlanıyor.
  const [hatIlk, ...hatKalan] = HAT_YAZISI.split(' ');
  const hat = el('div', { class: 'kagit__hat' },
    el('span', { class: 'kagit__hat-ust' }, hatIlk + ' '),
    el('span', { class: 'kagit__hat-alt' }, hatKalan.join(' ')));

  const rx = el('section', { class: 'kagit__rx' },
    filigran(),
    el('div', { class: 'kagit__rx-isaret', dir: 'ltr' }, '℞'),
    el('div', { class: 'kagit__rx-govde' }, belirtiler, tani, alerji, ilacGovdesi,
      bos ? null : yerTutucu('ilac-ekle', t('recete.ilac_ekle', 'İlaç ekle')),
      laboratuvar,
      !bos && doluMu(recete.notlar)
        ? duz('notlar', el('div', { class: 'kagit__not' }, recete.notlar))
        : (bos ? null : yerTutucu('notlar', t('recete.not', 'Reçete notu')))),
    hat, imza);

  /* ---- Ayak: rozetler ve iletişim ---- */
  const rozetler = String(ayar.ayakEtiketleri ?? t('kagit.ayak_etiketleri', 'قلب, شش, معده, گرده, شکر, روماتیزم, سردرد'))
    .split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8);
  // Basılı kâğıtta hekimin ilgilendiği alanlar rozet olarak diziliyor.
  // Sıra ayardaki etiket sırasını izliyor; fazlası 'kalp' ile doluyor.
  const ROZET_SIMGE = ['kalp', 'akciger', 'mide', 'bobrek', 'seker', 'eklem', 'beyin', 'cocuk'];
  // Basılı kâğıtta iki numara var (doktor ve klinik). İkincisi boşsa
  // basılmıyor; etiketler ayarlardan, boşsa tek ortak etiket kullanılıyor.
  const etiketler = String(ayar.telefonEtiket ?? '').split(',').map((x) => x.trim());
  const numaralar = [ayar.telefon, ayar.telefon2].map((x, i) => ({ no: x, etiket: etiketler[i] }))
    .filter((x) => doluMu(x.no));
  const telefonSatirlari = numaralar.map(({ no, etiket }) =>
    el('div', { class: 'kagit__iletisim-satir' },
      simge('telefon', { boy: 16 }),
      el('span', {}, `${doluMu(etiket) ? etiket : t('kagit.tel', 'شماره تماس')} : `),
      el('span', { dir: 'ltr' }, no)));

  const ayak = el('footer', { class: 'kagit__ayak' },
    dalga('alt'),
    el('div', { class: 'kagit__iletisim' },
      doluMu(ayar.adres) ? el('div', { class: 'kagit__iletisim-satir' }, simge('konum', { boy: 16 }), el('span', {}, `${t('kagit.adres', 'آدرس')} : ${ayar.adres}`)) : null,
      ...telefonSatirlari),
    rozetler.length
      ? el('div', { class: 'kagit__rozetler', dir: 'ltr' }, ...rozetler.map((etiket, i) =>
        el('div', { class: 'kagit__rozet' }, el('span', { class: 'kagit__rozet-daire' }, simge(ROZET_SIMGE[i] || 'kalp', { boy: 20 })), el('span', {}, etiket))))
      : null);

  // Tek bant, tam genişlik: kurdeleler kâğıdın bir ucundan ötekine akıyor.
  // Eskiden iki köşe parçasıydı (biri CSS'te aynalanan), o düzen kurdele
  // değil iki ayrı leke gibi duruyordu.
  return el('div', { class: `yazdir-alan kagit${stilSinifi}` }, stil,
    dalga('ust'),
    antet, unvan, hizmet, deneyim, vecize, serit,
    el('div', { class: 'kagit__govde' }, rx, sutun),
    ayak);
}

/**
 * Kâğıdı yazdırır. Sayfada duran kâğıt geçici olarak değiştirilir, yazdırma
 * bitince eski hale döner — böylece boş kâğıt da aynı düzenle basılır.
 */
export function kagidiYazdir(secenekler) {
  const eski = document.querySelector('.yazdir-alan');
  const yeni = kagitCiz(secenekler);
  if (eski) eski.replaceWith(yeni); else document.getElementById('sayfa').appendChild(yeni);
  window.print();
  if (eski) yeni.replaceWith(eski); else yeni.remove();
}
