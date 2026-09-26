// Lacivert (sürmeli ve altın) reçete kâğıdı: hekimlerin seçtiği yeni
// tasarım (yeni/hedef). Kâğıt sabit 194 × 272 mm: altın çerçeve, köşelerde
// lacivert kıvrımlar, başta Ruqaa hattıyla vecize, üç sütunlu antet (Latin
// ad · mühür · Dari ad), hasta şeridi, solda klinik sütun, sağda Rx ve
// ilaçlar, altta lacivert dalgalı ayak (adres · QR · telefon).
//
// Sayfa sabit boyda ve taşanı kesiyor (overflow: hidden): bu yüzden içerik
// hiçbir zaman "sığmazsa küçülsün" diye bırakılmıyor. Kip (rahat / orta /
// sık) ve sayfalara bölünme paylasilan/kagit-yogunluk.js'te içerikten
// HESAPLANIYOR; önizleme ve baskı aynı reçeteden aynı kâğıdı kuruyor.
//
// Eski üç stilin (modern, klasik, sade) ağacı kagit.js'te olduğu gibi
// duruyor; buradaki sınıflar `kagit__l-` önekli, çünkü eski `.kagit__*`
// kuralları kapsamsız ve aynı adları kullanan her şeyi boyardı.
import { el, svgEl } from './cekirdek/dom.js';
import { gorselMi } from './cekirdek/gorsel.js';
import { simge } from './cekirdek/simge.js';
import { rxIsareti, vecizeCizimi } from './cekirdek/cizimler.js';
import { t } from './i18n.js';
import { tamAd, hastaYasi } from './paylasilan/hasta.js';
import { OLCUMLER, bpBol } from './paylasilan/recete.js';
import { tarihMetni } from './paylasilan/tarih.js';
import { kagitYogunlugu, ilacSatiri, ikiSutunMu } from './paylasilan/kagit-yogunluk.js';
import { amblemCiz, tekilKimlik, KLINIK_ADLARI, qrBilgisi, qrCiz } from './kagit.js';

const doluMu = (v) => String(v ?? '').trim() !== '';
const satirlara = (metin) => String(metin ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
const PT = 25.4 / 72;
/* Dari rakam: devam sayfasının numarası («۲/۲») şeridin Dari etiketinin yanında. */
const dariRakam = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

/* ---------- Çizimler ----------
   Ölçüler mm (viewBox'lar kâğıdın mm'si): tasarımın kâğıdı 636 px =
   194 mm, 1 px = 0,305 mm. Köşe kıvrımlarının ve ayak dalgasının
   noktaları tasarımda sütun sütun ölçüldü (yeni/kagit.md §4.2, §4.8) ve
   Catmull-Rom ile düzgün Bézier'e çevrildi.
   Basılması gereken her renk SVG ÖĞESİ: CSS zemini yazdırmada «arka plan
   grafikleri» seçeneğine bağlı, SVG içeriği her zaman basılıyor. */
const L_KOSE_SOL = 'M0 29C0.4 28.4 1.1 26.8 2.1 25.6C3.1 24.4 4.2 23.2 5.8 22C7.4 20.8 10.2 19.5 11.9 18.3C13.6 17.1 14.3 16.4 16.2 14.6C18.1 12.8 21.6 8.8 23.2 7.3C24.8 5.8 24.7 6.1 25.9 5.5C27.1 4.9 28.1 4.3 30.2 3.7C32.3 3.1 36.1 2.2 38.7 1.8C41.3 1.4 44.8 1.1 46 1';
const L_KOSE_SAG = 'M146 1C146.8 1.1 148.3 1.4 150.7 1.8C153 2.2 157.4 2.8 160.1 3.7C162.8 4.6 164.4 5.5 166.8 7.3C169.2 9.1 172 12.5 174.5 14.6C177 16.7 179.5 18.6 181.8 20.1C184.1 21.6 186.8 22.6 188.5 23.8C190.2 25 191.3 26.3 192.2 27.5C193.1 28.7 193.7 30.4 194 31';
/* Lacivert alanın içinde, kıvrıma koşut iki soluk şerit (tasarımdaki parıltı). */
const L_KOSE_SERIT = [
  'M-3 26C-2.6 25.4 -1.9 23.8 -0.9 22.6C0.1 21.4 1.2 20.2 2.8 19C4.4 17.8 7.2 16.5 8.9 15.3C10.6 14.1 11.3 13.4 13.2 11.6C15.1 9.8 18.6 5.8 20.2 4.3C21.8 2.8 21.7 3.1 22.9 2.5C24.1 1.9 25.1 1.3 27.2 0.7C29.3 0.1 33.1 -0.8 35.7 -1.2',
  'M-6.5 22.5C-6.2 21.9 -5.4 20.3 -4.4 19.1C-3.4 17.9 -2.3 16.7 -0.7 15.5C0.9 14.3 3.7 13 5.4 11.8C7.1 10.6 7.8 9.9 9.7 8.1C11.6 6.3 15.1 2.3 16.7 0.8C18.3 -0.7 18.2 -0.4 19.4 -1',
  'M149 -2C149.8 -1.9 151.3 -1.6 153.7 -1.2C156 -0.8 160.4 -0.2 163.1 0.7C165.8 1.6 167.4 2.5 169.8 4.3C172.2 6.1 175 9.5 177.5 11.6C180 13.7 182.5 15.6 184.8 17.1C187.1 18.6 189.8 19.6 191.5 20.8C193.2 22 194.3 23.3 195.2 24.5',
  'M157.2 -4.7C159.5 -4.2 163.9 -3.7 166.6 -2.8C169.3 -1.9 170.9 -1 173.3 0.8C175.7 2.6 178.5 6 181 8.1C183.5 10.2 186 12.1 188.3 13.6C190.6 15.1 193.3 16.1 195 17.3',
];
/* Ayak dalgası (viewBox 194 × 30, üst 0): lacivertin üst kenarı, onun
   üstünde sağa doğru kalınlaşan altın kenar ve en üstte soluk gölge. */
const L_AYAK_DALGA = 'M-1 0.5C-0.5 0.7 -0.7 0.6 1.8 1.9C4.3 3.2 8.9 6.9 14 8.3C19.1 9.7 24.2 9.9 32.3 10.2C40.4 10.5 53.6 10.4 62.8 9.9C72 9.4 80.1 7.6 87.2 7.1C94.3 6.6 97.4 6.4 105.5 6.8C113.6 7.2 126.8 8.7 136 9.6C145.2 10.5 153.3 12 160.4 12.3C167.5 12.7 173.6 12.9 178.7 11.7C183.8 10.5 188.2 6.7 190.9 5C193.6 3.3 194.3 2.1 195 1.5';
const L_AYAK_ALTIN = 'M-1 -0.7C-0.5 -0.5 -0.7 -0.6 1.8 0.7C4.3 2 8.9 5.7 14 7C19.1 8.4 24.2 8.6 32.3 8.8C40.4 9 53.6 8.9 62.8 8.3C72 7.7 80.1 5.9 87.2 5.3C94.3 4.8 97.4 4.5 105.5 4.9C113.6 5.3 126.8 6.6 136 7.5C145.2 8.3 153.3 9.7 160.4 10C167.5 10.3 173.6 10.6 178.7 9.3C183.8 8.1 188.2 4.2 190.9 2.5C193.6 0.8 194.3 -0.4 195 -1';
const L_AYAK_GOLGE = 'M-1 -2.2C-0.5 -2 -0.7 -2.1 1.8 -0.8C4.3 0.5 8.9 4.2 14 5.5C19.1 6.9 24.2 7.1 32.3 7.3C40.4 7.5 53.6 7.4 62.8 6.8C72 6.2 80.1 4.4 87.2 3.8C94.3 3.3 97.4 3 105.5 3.4C113.6 3.8 126.8 5.1 136 6C145.2 6.8 153.3 8.2 160.4 8.5C167.5 8.8 173.6 9.1 178.7 7.8C183.8 6.6 188.2 2.7 190.9 1C193.6 -0.7 194.3 -1.9 195 -2.5';
/* Ayağın iki alt köşesindeki altın kıvrımlar: sivri uçlu hilal. */
const L_AYAK_SUS = ['M-1 28.2C9 26.2 22 26.3 33 29.4C22 27.6 10 27.8 -1 29.6Z', 'M195 28.2C185 26.2 172 26.3 161 29.4C172 27.6 184 27.8 195 29.6Z'];

/* Altın geçiş: çerçeve, köşe kenarları, ayraç ve dalga kenarı. */
const ALTIN_DURAKLAR = [[0, '#B07824'], [0.3, '#F3D27A'], [0.55, '#D9A54A'], [0.75, '#F8DE94'], [1, '#B07824']];
function altinGecis(id, x2 = 1, y2 = 1) {
  return svgEl('linearGradient', { id, x1: 0, y1: 0, x2, y2 },
    ALTIN_DURAKLAR.map(([offset, renk]) => svgEl('stop', { offset, 'stop-color': renk })));
}

/** Altın çerçeve: kâğıdın basılabilir alanının kenarı. Ekrandaki kart
 *  kenarlığı ve gölgesi lacivertte yok; kenarı bu çiziyor. */
function cerceveCiz() {
  const altin = tekilKimlik('l-cerceve');
  return svgEl('svg', { class: 'kagit__l-cerceve', viewBox: '0 0 194 272', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    svgEl('defs', {}, altinGecis(altin)),
    svgEl('rect', { x: 0.9, y: 0.9, width: 192.2, height: 270.2, rx: 3, fill: 'none', stroke: `url(#${altin})`, 'stroke-width': 1.2 }),
    svgEl('rect', { x: 1.9, y: 1.9, width: 190.2, height: 268.2, rx: 2.2, fill: 'none', stroke: '#B07824', 'stroke-width': 0.25 }));
}

/** Üst köşeler: iki lacivert kıvrım ve tepede boydan boya altın şerit. */
function koseCiz() {
  const lacivert = tekilKimlik('l-kose');
  const altin = tekilKimlik('l-kose-altin');
  const alan = (kenar, kapat) => svgEl('path', { d: kenar + kapat, fill: `url(#${lacivert})` });
  const kenar = (d) => [
    svgEl('path', { d, fill: 'none', stroke: '#E8E2D0', 'stroke-width': 0.5, transform: 'translate(.5 .9)' }),
    svgEl('path', { d, fill: 'none', stroke: `url(#${altin})`, 'stroke-width': 1.4 }),
  ];
  return svgEl('svg', { class: 'kagit__l-kose', viewBox: '0 0 194 31', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    svgEl('defs', {},
      svgEl('linearGradient', { id: lacivert, x1: 0, y1: 0, x2: 1, y2: 1 },
        svgEl('stop', { offset: 0, 'stop-color': '#033968' }), svgEl('stop', { offset: 1, 'stop-color': '#001A44' })),
      altinGecis(altin, 1, 0)),
    alan(L_KOSE_SOL, 'L46 0H0Z'),
    alan(L_KOSE_SAG, 'L194 0H146Z'),
    svgEl('g', { fill: 'none', stroke: '#0A4C86', 'stroke-width': 1.2, opacity: 0.35 }, L_KOSE_SERIT.map((d) => svgEl('path', { d }))),
    kenar(L_KOSE_SOL), kenar(L_KOSE_SAG),
    svgEl('rect', { x: 0, y: 0, width: 194, height: 1, fill: `url(#${altin})` }));
}

/** Vecizenin iki yanındaki altın arabesk: kıl çizgi, küçük daire, yaprak
 *  kıvrımı, küçük daire; uç yazıya bakıyor. `ayna`: sağdaki. */
function susCiz(ayna) {
  return svgEl('svg', { class: 'kagit__l-sus', viewBox: '0 0 58 19', 'aria-hidden': 'true' },
    svgEl('g', { fill: 'none', stroke: '#B07824', 'stroke-width': 1.1, 'stroke-linecap': 'round', transform: ayna ? 'matrix(-1 0 0 1 58 0)' : null },
      svgEl('path', { d: 'M1 9.5H17M41 9.5H57' }),
      svgEl('circle', { cx: 20, cy: 9.5, r: 2.4 }),
      svgEl('path', { d: 'M23 9.5C27 3.5 33 3.5 35 7.5 36.4 10.4 33.6 12.4 31.6 10.6M23 9.5C27 15.5 33 15.5 35 11.5' }),
      svgEl('circle', { cx: 38.5, cy: 9.5, r: 2.4 }),
      svgEl('path', { d: 'M41 9.5C44 8 46.5 8 49 9.5 46.5 11 44 11 41 9.5Z', fill: '#D9B25F', stroke: 'none' })));
}

/** Antet ile şerit arasındaki ayraç: iki uçta sönen altın çizgi, ortada
 *  lacivert baklava (içinde dört köşeli beyaz ışıltı), iki yanında boş
 *  altın baklava. */
function elmasAyrac() {
  const cizgi = tekilKimlik('l-ayrac');
  const baklava = (cx, en, boy) => `M${cx - en / 2} 3.5L${cx} ${3.5 - boy / 2}L${cx + en / 2} 3.5L${cx} ${3.5 + boy / 2}Z`;
  return svgEl('svg', { class: 'kagit__l-ayrac', viewBox: '0 0 184 7', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    svgEl('defs', {},
      svgEl('linearGradient', { id: cizgi, x1: 0, y1: 0, x2: 1, y2: 0 },
        [[0, 0], [0.08, 1], [0.92, 1], [1, 0]].map(([offset, o]) => svgEl('stop', { offset, 'stop-color': '#D9B25F', 'stop-opacity': o })))),
    svgEl('rect', { x: 0, y: 3.35, width: 184, height: 0.3, fill: `url(#${cizgi})` }),
    svgEl('path', { d: baklava(92, 6.7, 6.7), fill: '#0B1E72', stroke: '#D9B25F', 'stroke-width': 0.35 }),
    svgEl('path', { d: 'M92 1.6L92.45 3.05 93.9 3.5 92.45 3.95 92 5.4 91.55 3.95 90.1 3.5 91.55 3.05Z', fill: '#fff' }),
    svgEl('path', { d: baklava(86.1, 3.2, 2.6), fill: '#FBF8EE', stroke: '#D9B25F', 'stroke-width': 0.35 }),
    svgEl('path', { d: baklava(97.9, 3.2, 2.6), fill: '#FBF8EE', stroke: '#D9B25F', 'stroke-width': 0.35 }));
}

/** Beş köşeli yıldız (mühürde 9 ve 3 yönünde). */
const yildiz = (cx, cy, r) => svgEl('path', {
  d: Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const u = i % 2 ? r * 0.42 : r;
    return `${i ? 'L' : 'M'}${(cx + u * Math.cos(a)).toFixed(2)} ${(cy + u * Math.sin(a)).toFixed(2)}`;
  }).join('') + 'Z',
});

/* Mühürdeki yazının yayı: üstte adın, altta alt yazının taban çizgisi.
   Üst yay dışa, alt yay içe bakıyor; ikisi de soldan sağa okunuyor. */
const MUHUR_UST = 'M13.5 50A36.5 36.5 0 0 1 86.5 50';
const MUHUR_ALT = 'M9 50A41 41 0 0 0 91 50';
const UST_YAY = Math.PI * 36.5;

/**
 * Antedin ortasındaki mühür: Ayarlar'dan üretiliyor (Latin ad üst yayda,
 * alt yazı altta, ortada kadüse). Hiçbir gerçek damganın kopyası değil,
 * bu yüzden her lacivert kâğıtta basılıyor. Süs: aria-hidden, dokunulmaz.
 */
function muhurCiz(ayar) {
  const ust = tekilKimlik('l-muhur-ust');
  const alt = tekilKimlik('l-muhur-alt');
  const ad = String(ayar.doktorAdAlt ?? '').trim();
  const altYazi = String(ayar.muhurAlt ?? '').trim() || t('kagit.muhur_alt', 'Health · Care · Trust');
  // Uzun ad yaya sığdırılıyor: Cinzel'in harfi ≈ 0,68 em (7,5 birim).
  const adBoyu = ad.length * 7.5 * 0.68 + ad.length * 0.6;
  const sigdir = adBoyu > UST_YAY * 0.72 ? { textLength: (UST_YAY * 0.72).toFixed(1), lengthAdjust: 'spacingAndGlyphs' } : {};
  const kaduse = amblemCiz();
  for (const [k, v] of Object.entries({ x: 25.9, y: 21, width: 48.2, height: 58 })) kaduse.setAttribute(k, String(v));
  return svgEl('svg', { class: 'kagit__l-muhur-cizim', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
    svgEl('defs', {}, svgEl('path', { id: ust, d: MUHUR_UST }), svgEl('path', { id: alt, d: MUHUR_ALT })),
    svgEl('circle', { cx: 50, cy: 50, r: 48.5, fill: '#fff', stroke: '#D9B25F', 'stroke-width': 1.6 }),
    svgEl('circle', { cx: 50, cy: 50, r: 46, fill: '#05214F' }),
    svgEl('circle', { cx: 50, cy: 50, r: 31, fill: '#FBF8EE', stroke: '#D9B25F', 'stroke-width': 1.4 }),
    // Kadüsenin arkasında soluk bir pusula yıldızı.
    svgEl('g', { stroke: '#C9AF8A', 'stroke-width': 0.6, opacity: 0.45 },
      Array.from({ length: 8 }, (_, i) => svgEl('path', { d: 'M50 22L51.6 48.4 50 50 48.4 48.4Z', fill: '#E4D3B0', transform: `rotate(${i * 45} 50 50)` }))),
    kaduse,
    ad ? svgEl('text', { class: 'kagit__l-muhur-ust', 'font-size': 7.5, 'letter-spacing': 0.6, fill: '#E9B450' },
      svgEl('textPath', { href: `#${ust}`, startOffset: '50%', 'text-anchor': 'middle', ...sigdir }, document.createTextNode(ad))) : null,
    svgEl('text', { class: 'kagit__l-muhur-alt', 'font-size': 6.6, 'letter-spacing': 1, fill: '#E9B450' },
      svgEl('textPath', { href: `#${alt}`, startOffset: '50%', 'text-anchor': 'middle' }, document.createTextNode(altYazi))),
    svgEl('g', { fill: '#E9B450' }, yildiz(11.5, 50, 2.6), yildiz(88.5, 50, 2.6)));
}

/** Rx sütununun arkasındaki filigran: iki kare (biri 45° dönük) ve iki
 *  daireden bir yıldız, ortasında kadüse. Bütünü %7 opaklıkta (CSS). */
function filigranCiz() {
  const kaduse = amblemCiz();
  for (const [k, v] of Object.entries({ x: 30, y: 26, width: 40, height: 48 })) kaduse.setAttribute(k, String(v));
  return svgEl('svg', { class: 'kagit__l-filigran', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
    svgEl('g', { fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 },
      svgEl('circle', { cx: 50, cy: 50, r: 46 }),
      svgEl('circle', { cx: 50, cy: 50, r: 30 }),
      svgEl('rect', { x: 20, y: 20, width: 60, height: 60 }),
      svgEl('rect', { x: 20, y: 20, width: 60, height: 60, transform: 'rotate(45 50 50)' })),
    kaduse);
}

/** Ayak bandı: gölge, altın kenar, lacivert taban ve köşe süsleri. */
function ayakDalgasi() {
  const lacivert = tekilKimlik('l-ayak');
  const altin = tekilKimlik('l-ayak-altin');
  const kapat = 'V31H-1Z';
  return svgEl('svg', { class: 'kagit__l-dalga', viewBox: '0 0 194 30', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    svgEl('defs', {},
      svgEl('linearGradient', { id: lacivert, x1: 0, y1: 0, x2: 0, y2: 1 },
        svgEl('stop', { offset: 0, 'stop-color': '#011F4D' }), svgEl('stop', { offset: 1, 'stop-color': '#000D2E' })),
      altinGecis(altin, 1, 0)),
    // Dalga 2 mm aşağıda: ortada gölge bandı gövdenin dibindeki imza
    // satırına ve son ilaca binmesin; kenarlarda yine gövdenin yanına çıkıyor.
    svgEl('g', { transform: 'translate(0 2)' },
      svgEl('path', { d: L_AYAK_GOLGE + kapat, fill: '#E8E2D0' }),
      svgEl('path', { d: L_AYAK_ALTIN + kapat, fill: `url(#${altin})` }),
      svgEl('path', { d: L_AYAK_DALGA + kapat, fill: `url(#${lacivert})` })),
    L_AYAK_SUS.map((d) => svgEl('path', { d, fill: `url(#${altin})` })));
}

/* ---------- Metin ölçüleri (kip başına) ----------
   Antedin madde satırları sayılıyor, ölçülmüyor: kâğıt DOM dışında da
   kuruluyor. Harf sığası = sütunun yazı eni / (ortalama harf eni × punto);
   Vazirmatn düz Latin ≈ 0,45 em, Dari ≈ 0,42 em (sayılar ve virgül
   aralıklarıyla, antetin kendi örneğinde ölçüldü). Satır sınırı aşılınca kalan maddeler
   basılmıyor (Ayarlar bunu uyarıyor). */
/* Kip başına antet ölçüleri (yazdirma.css'teki --l-* ile aynı): tepe
   bloğunun boyu, ızgaranın üst payı, madde aralığı (mm) ve puntolar. */
const ANTET = {
  rahat: { tepe: 63, ust: 19.5, adimLat: 4, adimFa: 4.3, ad: 17, uzLat: 6.8, uzFa: 9, lat: 7.3, fa: 8.5, satir: 6 },
  orta: { tepe: 53, ust: 18, adimLat: 3.75, adimFa: 3.9, ad: 14.5, uzLat: 6.5, uzFa: 8.5, lat: 6.8, fa: 7.5, satir: 6 },
  sik: { tepe: 46, ust: 15, adimLat: 3.3, adimFa: 3.5, ad: 13, uzLat: 6, uzFa: 8, lat: 6.3, fa: 7, satir: 5 },
};
/* Ayraç çizgisi tepe bloğunun dibinden 3 mm yukarıda; maddeler ondan 1 mm önce bitiyor. */
const AYRAC_PAYI = 4;
const MADDE_EN = 61; // 66 mm'lik antet sütunu eksi simge ve boşluk
const AD_EN = 66;
const AD_TABAN = 11; // pt
/** Maddeleri satır sınırına kadar alır (kırılan madde birden çok satır
 *  sayılır). `bagli` madde (çalışma geçmişinin başlığı) ancak ardındaki
 *  maddeyle birlikte sığarsa basılıyor: altı boş bir başlık kalmasın. */
function maddeleriSinirla(maddeler, { enFazla, harf }) {
  const satirSayisi = (m) => Math.max(1, Math.ceil(m.metin.length / harf));
  const alinan = [];
  let satir = 0;
  for (const [i, m] of maddeler.entries()) {
    const n = satirSayisi(m) + (m.bagli && maddeler[i + 1] ? satirSayisi(maddeler[i + 1]) : 0);
    if (satir + n > enFazla) break;
    alinan.push(m);
    satir += satirSayisi(m);
  }
  return alinan;
}

/** Tepe bloğunda maddelere kalan satır: bloğun boyu eksi ad, ihtisas
 *  satırları ve ayraç, madde aralığına bölünüp kipin sınırıyla kırpılıyor. */
function maddeSatiri(o, uzmanlik, { uzPt, uzEm, uzPay, adimMm }) {
  const satir = (pt, oran) => pt * PT * oran;
  const uzSatir = uzmanlik ? Math.min(2, Math.ceil(uzmanlik.length * uzEm * uzPt * PT / AD_EN)) : 0;
  const kalan = o.tepe - o.ust - AYRAC_PAYI - satir(o.ad, 1.12) - (uzSatir ? uzSatir * satir(uzPt, 1.28) + uzPay : 0);
  return Math.max(0, Math.min(o.satir, Math.floor(kalan / adimMm)));
}

/* İngilizce hizmet maddelerinin sırayla aldığı dolgulu simgeler. */
const HIZMET_SIMGELERI = ['stetoskop', 'tani', 'akciger', 'kan', 'mide', 'bobrek'];

/** Antedin iki yanının maddeleri: hepsi ve kipin satır sınırına sığanlar. */
function antetMaddeleri(ayar, kip) {
  const o = ANTET[kip];
  const latin = [
    ...satirlara(ayar.hizmetlerEn).map((metin, i) => ({ metin, simge: HIZMET_SIMGELERI[i] || 'kalp' })),
    ...(doluMu(ayar.deneyimEn)
      ? [{ metin: t('kagit.deneyim_en', 'Professional Experience:'), simge: 'canta', kalin: true, bagli: true },
        ...satirlara(ayar.deneyimEn).map((metin) => ({ metin, simge: 'konum' }))]
      : []),
  ];
  // İlgi alanları tek madde, dış parantezleri atılmış; çalışma geçmişinde
  // ilk iki noktaya kadarki kısım kalın (eski kâğıttaki gibi).
  const alanlar = String(ayar.hizmetAlanlari ?? '').trim().replace(/^\((.*)\)$/s, '$1').trim();
  const [deneyimBas, ...deneyimSon] = String(ayar.deneyim ?? '').split(':');
  const dari = [
    ...satirlara(ayar.hizmetler).map((metin) => ({ metin })),
    ...(alanlar ? [{ metin: alanlar }] : []),
    ...(doluMu(ayar.deneyim) ? [{ metin: ayar.deneyim, bas: deneyimSon.length ? deneyimBas + ':' : '', son: deneyimSon.join(':') }] : []),
  ];
  return {
    latin, dari,
    latinSigan: maddeleriSinirla(latin, {
      enFazla: maddeSatiri(o, String(ayar.uzmanlikEn ?? '').trim(), { uzPt: o.uzLat, uzEm: 0.6, uzPay: 2.6, adimMm: o.adimLat }),
      harf: Math.floor(MADDE_EN / (0.45 * o.lat * PT)),
    }),
    dariSigan: maddeleriSinirla(dari, {
      enFazla: maddeSatiri(o, String(ayar.uzmanlik ?? '').trim(), { uzPt: o.uzFa, uzEm: 0.42, uzPay: 2, adimMm: o.adimFa }),
      harf: Math.floor(MADDE_EN / (0.42 * o.fa * PT)),
    }),
  };
}

/** Antet maddelerinin bir kısmı rahat kipte bile basılmıyor mu? Ayarlar
 *  sayfası hekimi bununla uyarıyor: kâğıt sessizce madde düşürmesin. */
export function antetTasiyor(ayar = {}) {
  const m = antetMaddeleri(ayar, 'rahat');
  return m.latinSigan.length < m.latin.length || m.dariSigan.length < m.dari.length;
}

/** Antedin üç sütunu: Latin (sol) · mühür · Dari (sağ). `kisa`: devam
 *  sayfasının antedi, yalnız iki ad. */
function antetIzgarasi(ayar, recete, kip, { yerTutucu, kisa = false }) {
  const o = ANTET[kip];
  const latinAd = String(ayar.doktorAdAlt ?? '').trim();
  const dariAd = [recete.doktorUnvan || ayar.doktorUnvan, recete.doktorAd || ayar.doktorAd].filter(doluMu).join(' ');
  // Antet boşsa düzenlerken yer tutucu (dokununca Ayarlar); basılan kâğıtta
  // iki yan boş kalıyor, ortada mühür (alt yazısı ve yıldızlarıyla).
  if (!latinAd && !dariAd) {
    const yer = yerTutucu('antet', t('kagit.antet_bos', 'Antet bilgilerini gir'));
    if (yer) return el('div', { class: 'kagit__l-antet-bos' }, yer);
  }
  // Ad tek satıra sığacak puntoya iniyor (en çok kipinki); 11 pt'nin altına
  // inmiyor, o zaman ikinci satıra kırılıyor. Harf eni: Cinzel ≈ 0,63 em,
  // Vazirmatn kalın Dari ≈ 0,45 em.
  const ad = (metin, harfEm, sinif) => {
    const sigan = AD_EN / (harfEm * metin.length * PT);
    const pt = Math.min(o.ad, Math.max(AD_TABAN, Math.floor(sigan * 10) / 10));
    return el('div', { class: sigan < AD_TABAN ? `${sinif} ${sinif}--kir` : sinif, style: pt < o.ad ? { '--l-ad-sigdir': pt + 'pt' } : null }, metin);
  };
  const m = kisa ? { latinSigan: [], dariSigan: [] } : antetMaddeleri(ayar, kip);

  return el('div', { class: 'kagit__l-antet', dir: 'ltr' },
    el('div', { class: 'kagit__l-lat' },
      latinAd ? ad(latinAd, 0.63, 'kagit__l-ad-lat') : null,
      !kisa && doluMu(ayar.uzmanlikEn) ? el('div', { class: 'kagit__l-uz-lat' }, ayar.uzmanlikEn) : null,
      m.latinSigan.length
        ? el('ul', { class: 'kagit__l-maddeler kagit__l-maddeler--lat' }, ...m.latinSigan.map((x) =>
          el('li', { class: x.kalin ? 'kagit__l-madde--kalin' : null }, simge(x.simge, { dolu: true, boy: 12 }), el('span', {}, x.metin))))
        : null),
    kisa ? el('div', {}) : el('div', { class: 'kagit__l-muhur' }, muhurCiz(ayar)),
    el('div', { class: 'kagit__l-fa', dir: 'rtl' },
      dariAd ? ad(dariAd, 0.45, 'kagit__l-ad-fa') : null,
      !kisa && doluMu(ayar.uzmanlik) ? el('div', { class: 'kagit__l-uz-fa' }, ayar.uzmanlik) : null,
      m.dariSigan.length
        ? el('ul', { class: 'kagit__l-maddeler kagit__l-maddeler--fa' }, ...m.dariSigan.map((x) =>
          el('li', {}, el('span', {}, x.bas ? [el('b', {}, x.bas), x.son] : x.metin))))
        : null));
}

/** Kâğıdın tepesi: vecize, İngilizce karşılığı, antet ve ayraç. */
function tepeCiz(ayar, recete, kip, c, kisa) {
  return el('header', { class: 'kagit__l-tepe' + (kisa ? ' kagit__l-tepe--kisa' : ''), 'data-rol': 'antet' },
    el('div', { class: 'kagit__l-vecize', dir: 'ltr' }, susCiz(false), vecizeCizimi({ sinif: 'kagit__l-vecize-cizim' }), susCiz(true)),
    el('div', { class: 'kagit__l-motto', dir: 'ltr' }, t('kagit.vecize_en', 'The true healer is Allah (J).')),
    antetIzgarasi(ayar, recete, kip, { ...c, kisa }),
    elmasAyrac());
}

/** Hasta şeridi: No · NAME · AGE · SEX · DATE (soldan sağa). Boş değer
 *  kalem çizgisi: hekim çıktının üstüne yazabilsin. */
function seritCiz({ recete, hasta, bos, duz, cizgi }, sayfa) {
  const yas = hasta ? hastaYasi(hasta) : null;
  const cins = { erkek: t('kagit.cins_erkek', 'M'), kadin: t('kagit.cins_kadin', 'F') }[hasta?.cinsiyet] || '';
  const hucre = (etiket, deger, { rol, alan, dir = 'ltr', sinif = '' } = {}) => duz(alan, el('span', { class: ('kagit__l-hucre ' + sinif).trim(), 'data-rol': rol },
    etiket,
    bos || !doluMu(deger) ? cizgi() : el('bdi', { class: 'kagit__l-deger', dir }, deger)));
  // Devam sayfalarında numaranın yanında yaprağın sırası («۲/۲»): sayfalar
  // karışırsa eczacı hangisinin eksik olduğunu görsün.
  const no = hucre(el('span', { class: 'kagit__l-no' }, simge('hasta', { dolu: true, boy: 14 }), el('b', { dir: 'rtl' }, t('kagit.no', 'شماره') + ':')),
    bos ? '' : String(recete.receteNo ?? ''), { rol: 'no', sinif: 'kagit__l-hucre--no' });
  if (sayfa.toplam > 1) no.append(el('span', { class: 'kagit__l-yaprak' }, `· ${dariRakam(sayfa.no)}/${dariRakam(sayfa.toplam)}`));
  return el('div', { class: 'kagit__l-serit', dir: 'ltr', 'data-rol': 'serit' },
    no,
    hucre(el('b', {}, t('kagit.serit_ad', 'NAME:')), tamAd(hasta), { rol: 'hasta', alan: 'hasta', dir: 'auto', sinif: 'kagit__l-hucre--ad' }),
    hucre(el('b', {}, t('kagit.serit_yas', 'AGE:')), yas !== null ? String(yas) : '', { rol: 'yas' }),
    hucre(el('b', {}, t('kagit.serit_cins', 'SEX:')), cins, { rol: 'cins' }),
    hucre(el('b', {}, t('kagit.serit_tarih', 'DATE:')), bos ? '' : tarihMetni(recete.tarih), { rol: 'tarih', alan: 'tarih' }));
}

/* Sol sütunun bölüm başlıkları, kâğıttaki adları ve düzenlerken boş
   bölümün eylemi (başlığı yinelemiyor: «+ SYMPTOMS AND SIGNS:» yerine
   «+ افزودن علائم»). */
const BOLUMLER = {
  belirtiler: { baslik: ['kagit.l_belirti', 'SYMPTOMS AND SIGNS:'], ekle: ['kagit.l_belirti_ekle', 'Belirti ekle'], alan: 'belirtiler', rol: 'belirtiler', bos: 4 },
  lab: { baslik: ['kagit.l_lab', 'LABORATORY FINDINGS:'], ekle: ['kagit.l_lab_ekle', 'Tetkik ekle'], alan: 'laboratuvar', rol: 'lab', bos: 4 },
  tani: { baslik: ['kagit.l_tani', 'DIAGNOSIS / IMPRESSION:'], ekle: ['kagit.l_tani_ekle', 'Tanı ekle'], alan: 'tani', rol: 'tani', bos: 2 },
};
/* Sıkışık kipte basılmayan bölümlerin yer tutucu satırı (7 mm) ve payı. */
const EKSIK_SATIRI = 9;

/** Ölçüm tablosu: yedi ölçüm ve sekizinci satırda kan grubu. Boş değer
 *  noktalı çizginin üstünde boşluk (kalemle yazılsın); tire basılmıyor.
 *  Boşluk gerçek bir karakter (U+00A0), boş span değil: taban çizgisi
 *  hizalı ızgarada içi boş öğenin sentetik taban çizgisi satırın üstüne
 *  taşıyor ve Chromium BASARKEN o satırı hiç çizmiyordu (ekranda vardı):
 *  boş kâğıtta «VITAL SIGNS:» altında sekiz satırın hepsi kayboluyordu. */
function olcumTablosu({ recete, bos, duz }) {
  const satir = (anahtar, etiket, deger, birim) => duz(anahtar === 'kanGrubu' ? 'kanGrubu' : 'olcum:' + anahtar,
    el('div', { class: 'kagit__l-olcum', 'data-rol': anahtar === 'kanGrubu' ? 'kan' : 'olcum', 'data-olcum': anahtar === 'kanGrubu' ? null : anahtar },
      el('b', {}, etiket + ':'),
      el('span', { class: 'kagit__l-olcum-deger' }, deger || '\u00a0'),
      birim ? el('i', {}, birim) : null));
  return el('div', { class: 'kagit__l-olcumler', 'data-rol': 'olcumler' },
    ...OLCUMLER.map(([anahtar, , , birim]) => {
      const ham = bos ? '' : String(recete.olcumler?.[anahtar] ?? '').trim();
      // Kan basıncı «130 / 85»: iki sayı arasında boşluklu bölü (tasarımdaki gibi).
      const [sis, dia] = anahtar === 'bp' ? bpBol(ham) : [ham, ''];
      const deger = anahtar === 'bp' && dia ? `${sis} / ${dia}` : ham;
      return satir(anahtar, KLINIK_ADLARI[anahtar], deger, birim.split(' / ')[0]);
    }),
    satir('kanGrubu', 'Blood Gr.', bos ? '' : String(recete.kanGrubu ?? '').trim(), ''));
}

/** Sol sütun: bölümler, ölçüm tablosu ve ek not kutusu. */
function solSutun(bloklar, kip, c, imzaSatiri, solArtan) {
  const { duz, yerTutucu } = c;
  const baslik = (anahtar, yedek, devam) => el('div', { class: 'kagit__l-bas' },
    t(anahtar, yedek) + (devam ? ' ' + t('kagit.l_devam', '(cont.)') : ''));
  const bolum = (b) => {
    if (b.tur === 'olcum') {
      return el('section', { class: 'kagit__l-bolum' }, baslik('kagit.l_hayati', 'VITAL SIGNS:', b.devam), olcumTablosu(c));
    }
    if (b.tur === 'not') {
      return el('section', { class: 'kagit__l-bolum' }, baslik('kagit.l_not', 'ADDITIONAL NOTES:', b.devam),
        duz('notlar', el('div', { class: 'kagit__l-not', 'data-rol': 'not', dir: 'auto' }, b.metin)));
    }
    const tanim = BOLUMLER[b.tur];
    if (!b.kalemler.length) {
      // Boş bölüm basılırken kalem çizgileri (boş kâğıtta bölüm başına
      // 4/4/2, dolu kâğıtta 1). Düzenlerken de aynı çizgiler: eylem yazısı
      // çizginin ÜSTÜNDE, bölümün kendisi dokunulan yer. Çizgilerin yerine
      // konan yer tutucu 6 mm uzundu, önizleme basılandan uzun düşüyordu.
      const cizgiler = el('div', { class: 'kagit__l-cizgiler' },
        ...Array.from({ length: c.bos ? tanim.bos : 1 }, () => el('span', { class: 'kagit__l-kalem' })));
      const eylem = c.duzenlenebilir
        ? el('span', { class: 'kagit__l-bolum-ekle' }, simge('arti', { boy: 12, sinif: 'kagit__duz-arti' }), el('span', {}, t(...tanim.ekle)))
        : null;
      return duz(tanim.alan, el('section', { class: 'kagit__l-bolum kagit__l-bolum--bos' }, baslik(...tanim.baslik, b.devam), cizgiler, eylem));
    }
    return duz(tanim.alan, el('section', { class: 'kagit__l-bolum', 'data-rol': tanim.rol },
      baslik(...tanim.baslik, b.devam),
      el('ul', { class: 'kagit__l-liste' + (ikiSutunMu(kip, b.kalemler.length) ? ' kagit__l-liste--iki' : '') },
        ...b.kalemler.map((k) => el('li', { dir: 'auto' }, k)))));
  };
  // Sıkışık kiplerde boş bölümler basılmıyor, ama düzenlerken dokunulacak
  // yerleri kalmalı: yer tutucuları (yalnız ekranda) tek satırda, sütunun
  // sonunda — ve yalnız sütunda yer varsa: kapasite sınırında önizlemeye
  // eklenen satır imzayı ayağın altına itiyordu (form kartları yine açık).
  const eksik = c.duzenlenebilir && kip !== 'rahat' && !c.bos && solArtan >= EKSIK_SATIRI
    ? Object.keys(BOLUMLER).filter((tur) => !bloklar.some((b) => b.tur === tur))
      .map((tur) => yerTutucu(BOLUMLER[tur].alan, t(...BOLUMLER[tur].ekle)))
    : [];
  return el('div', { class: 'kagit__l-sol' }, ...bloklar.map(bolum),
    eksik.length ? el('div', { class: 'kagit__l-eksikler' }, ...eksik) : null, imzaSatiri);
}

/** İmza satırı: doğrulama kodu (sol) ve imza bloğu (sağ). İmza görseli
 *  varsa (Ayarlar, yalnız bu cihazda) o basılıyor, yoksa boş bir çizgi.
 *  Yazıyla ya da çizimle uydurulmuş bir imza HİÇBİR zaman basılmıyor. */
function imzaSatiriCiz({ recete, ayar, bos }) {
  const gorsel = gorselMi(ayar.imzaGorseli) ? ayar.imzaGorseli : '';
  return el('div', { class: 'kagit__l-imza-satir' },
    !bos && doluMu(recete.dogrulamaKodu)
      ? el('div', { class: 'kagit__l-kod', dir: 'rtl', 'data-rol': 'kod' },
        simge('kilit', { boy: 12 }), el('b', {}, t('kagit.kod', 'کد تأیید') + ': '), el('bdi', { dir: 'ltr' }, recete.dogrulamaKodu))
      : el('span', {}),
    el('div', { class: 'kagit__l-imza', 'data-rol': 'imza' },
      el('div', { class: 'kagit__l-imza-etiket', dir: 'rtl' }, t('kagit.imza_etiket', 'امضا داکتر')),
      el('div', { class: 'kagit__l-imza-yer' }, gorsel ? el('img', { class: 'kagit__l-imza-gorsel', src: gorsel, alt: '' }) : null),
      el('div', { class: 'kagit__l-imza-en' }, t('kagit.imza_en', "Doctor's Signature"))));
}

/* Güç («375 mg», «10 mg/5») sözcük kaydırmada bölünmüyor: ad satırın sonuna
   denk gelince «375 / mg» diye iki satıra düşüyordu. Boşluk bölünmez karakter
   değil, bölünmez kutu: kâğıdın metni (kopyalanan, aranan) aynı kalsın. */
const gucBolunmez = (ad) => ad.split(/(\S*\d \D\S*)/).map((p, i) => (i % 2 ? el('span', { class: 'kagit__l-bolunmez' }, p) : p));

/** İlaç listesi: numara, «Tab: Ad (Etken) güç», altında «N=… | kullanım |
 *  zaman | süre». Numara gerçek metin: okuyucu ve arama da görüyor.
 *  İkinci satırda adet solda (eczacı miktarları alt alta okusun), Dari
 *  parçalar kendi grubunda sağdan sola: satır soldan sağa dizilseydi hekim
 *  «خوراکی | ۵ روز | … | روزانه ۳ بار» diye sondan başa okurdu. */
function ilacListesi({ recete, duz }, ilk, son, { genis = false } = {}) {
  const satirlar = (recete.satirlar || []).slice(ilk, son);
  return el('ol', { class: 'kagit__l-ilaclar' + (genis ? ' kagit__l-ilaclar--genis' : ''), dir: 'ltr', 'data-rol': 'ilaclar' },
    ...satirlar.map((s, j) => {
      const x = ilacSatiri(s);
      return duz('ilac:' + (ilk + j), el('li', { 'data-rol': 'ilac' },
        el('span', { class: 'kagit__l-sira' }, `${ilk + j + 1}.`),
        el('div', {},
          // Şekli tanınmayan ilaçta önek boş ama yeri duruyor: ad sütunu kaymasın.
          el('div', { class: 'kagit__l-i1' }, el('span', { class: 'kagit__l-form' }, x.kisa ? x.kisa + ':' : ''), el('b', {}, ...gucBolunmez(x.ad))),
          el('div', { class: 'kagit__l-i2' },
            el('span', { class: 'kagit__l-adet' }, x.adet),
            x.kullanim.length ? el('span', { class: 'kagit__l-ayir', 'aria-hidden': 'true' }, '|') : null,
            x.kullanim.length ? el('span', { class: 'kagit__l-kul', dir: 'rtl' }, ...x.kullanim.flatMap((k, i) => [
              i ? el('span', { class: 'kagit__l-ayir', 'aria-hidden': 'true' }, '|') : null, el('bdi', {}, k)])) : null))));
    }));
}

/** Sağ sütun: filigran, Rx, alerji satırı, ilaçlar, (varsa) imza satırı. */
function sagSutun(c, sayfa, imzaSatiri) {
  const { hasta, bos, yerTutucu } = c;
  const ilkSayfa = sayfa.no === 1;
  const alerjiler = hasta?.alerjiler || [];
  return el('div', { class: 'kagit__l-sag' },
    filigranCiz(),
    ilkSayfa ? el('div', { class: 'kagit__l-rx' }, rxIsareti({ sinif: 'kagit__l-rx-isaret' })) : null,
    ilkSayfa && !bos && alerjiler.length
      ? el('div', { class: 'kagit__l-alerji', dir: 'rtl', 'data-rol': 'alerji' },
        simge('uyari', { boy: 12 }), el('b', {}, t('kagit.alerji', 'حساسیت') + ': '), alerjiler.join('، '))
      : null,
    bos ? null : ilacListesi(c, sayfa.ilk, sayfa.son),
    // «+ افزودن دوا» yalnız sütunda bir ilaçlık yer varsa (tutucu bir
    // birimden kısa): kapasite sınırında imzayı ve kodu ayağın altına itiyor,
    // önizleme basılan kâğıttan farklı görünüyordu. Form tablosunun
    // «افزودن دوا»sı her zaman orada.
    !bos && sayfa.son === (c.recete.satirlar || []).length && sayfa.artan >= 1 ? yerTutucu('ilac-ekle', t('recete.ilac_ekle', 'İlaç ekle')) : null,
    // «Devam ediyor» yalnız ilaçlar gerçekten sonraki yaprakta sürüyorsa:
    // yalnız klinik sütun taştığında da basılıyordu, eczacı ikinci yaprakta
    // olmayan ilaçları arıyordu.
    sayfa.son < (c.recete.satirlar || []).length ? el('div', { class: 'kagit__l-devam-var', dir: 'rtl' }, t('kagit.devam_var', 'ادامه در صفحهٔ بعد ←')) : null,
    imzaSatiri);
}

/** Ayak: adres (sol) · QR (orta) · telefon (sağ). */
function ayakCiz({ ayar, recete, hasta, bos }) {
  const qr = qrBilgisi(ayar, recete, hasta, { bos });
  const qrSvg = qrCiz(qr.metin, { boy: 48, sinif: 'kagit__l-qr' });
  // Altındaki yazı basılanı anlatıyor: reçete metni ya da kod «Scan to
  // Verify», iletişim bağlantısı «Scan for Contact» (reçete metni sığmayıp
  // iletişime düşülünce de).
  const qrAlt = qr.tur === 'iletisim' ? t('kagit.qr_alt', 'Scan for Contact') : t('kagit.qr_dogrula', 'Scan to Verify');
  const etiketler = String(ayar.telefonEtiket ?? '').split(',').map((x) => x.trim());
  const numaralar = [ayar.telefon, ayar.telefon2].map((no, i) => ({ no, etiket: etiketler[i] })).filter((x) => doluMu(x.no));
  return el('footer', { class: 'kagit__l-ayak', dir: 'ltr', 'data-rol': 'ayak' },
    ayakDalgasi(),
    el('div', { class: 'kagit__l-adres' },
      doluMu(ayar.adres) || doluMu(ayar.adresEn) || doluMu(ayar.klinikAdi) ? simge('konum', { dolu: true, boy: 20 }) : null,
      el('div', {},
        doluMu(ayar.klinikAdi) ? el('div', { class: 'kagit__l-klinik', dir: 'auto' }, ayar.klinikAdi) : null,
        doluMu(ayar.adres) ? el('div', { class: 'kagit__l-adres-fa', dir: 'rtl' }, `${t('kagit.adres', 'آدرس')}: ${ayar.adres}`) : null,
        doluMu(ayar.adresEn) ? el('div', { class: 'kagit__l-adres-en' }, el('b', {}, t('kagit.adres_en', 'Address:')), ' ', ayar.adresEn) : null)),
    el('div', { class: 'kagit__l-qr-kutu' },
      qrSvg ? [el('span', { class: 'kagit__l-qr-kart' }, qrSvg), el('span', { class: 'kagit__l-qr-alt' }, qrAlt)] : null),
    el('div', { class: 'kagit__l-tel' },
      numaralar.length ? simge('telefon', { dolu: true, boy: 20 }) : null,
      el('div', {}, ...numaralar.map(({ no, etiket }, i) => el('div', { class: i ? 'kagit__l-tel-2' : null },
        el('div', { class: 'kagit__l-tel-etiket', dir: 'rtl' }, `${doluMu(etiket) ? etiket : t('kagit.tel', 'شماره تماس')}:`),
        el('bdi', { class: 'kagit__l-tel-no', dir: 'ltr' }, no))))));
}

/** Tek bir yaprak. */
function yaprakCiz(c, sayfa) {
  const { kip, duzen } = sayfa;
  const kisa = sayfa.no > 1;
  const imza = imzaSatiriCiz(c);
  let govde;
  if (duzen === 'genis') {
    govde = el('div', { class: 'kagit__l-govde kagit__l-govde--genis', dir: 'ltr' },
      filigranCiz(), ilacListesi(c, sayfa.ilk, sayfa.son, { genis: true }), imza);
  } else {
    // Sık kipte imza satırı sol sütunun dibinde: sağ sütunun her milimetresi ilaçlara.
    const solda = kip === 'sik';
    govde = el('div', { class: 'kagit__l-govde', dir: 'ltr' },
      solSutun(sayfa.sol || [], kip, c, solda ? imza : null, sayfa.solArtan),
      sagSutun(c, sayfa, solda ? null : imza));
  }
  return el('div', {
    class: `kagit kagit--lacivert kagit--l-${kip}${kisa ? ' kagit--l-devam' : ''}${c.boyut === 'A5' ? ' kagit--l-a5' : ''}`,
    'data-rol': 'sayfa', 'data-sayfa': `${sayfa.no}/${sayfa.toplam}`,
  },
  cerceveCiz(), koseCiz(),
  el('span', { class: 'kagit__l-amblem' }, amblemCiz()),
  tepeCiz(c.ayar, c.recete, kip, c, kisa),
  seritCiz(c, sayfa),
  govde,
  ayakCiz(c));
}

/**
 * Lacivert kâğıdı kurar: `.yazdir-alan` sarmalayıcısı içinde bir ya da
 * daha çok yaprak. Sarmalayıcı eski stillerdeki kâğıtla aynı yerde duruyor
 * (tuval, yazdırma, Ctrl+P); yapraklar kendi sayfalarına basılıyor.
 * @param {object} c kagitCiz'in seçenekleri ve düzenleme yardımcıları
 *   (duz, yerTutucu, cizgi — kagit.js'teki, iki stil aynı davranışla).
 */
export function lacivertKagit(c) {
  const { recete = {}, hasta = null, bos = false, boyut = 'A4' } = c;
  // Cinzel yüzünün yüklenmesi çizimle başlıyor, beklenmiyor; yazdırmadan
  // önce kagidiYazdir ayrıca bekliyor (mühür yazısı SVG <text>).
  document.fonts?.load('700 10pt Cinzel').catch(() => {});
  const { sayfalar } = kagitYogunlugu(recete, hasta, { boyut, bos });
  const stil = el('style', {});
  // A5: aynı yaprak 136/194 = 0,701 oranında (sayfa 136 × 190,7 mm).
  stil.textContent = `@page { size: ${boyut}; margin: ${boyut === 'A5' ? '6mm' : '8mm'}; }`
    + (boyut === 'A5' ? ' @media print { .yazdir-alan--lacivert .kagit--lacivert { zoom: 0.7010; } }' : '');
  const ctx = { ...c, recete, hasta, bos, boyut };
  return el('div', { class: 'yazdir-alan yazdir-alan--lacivert' }, stil, ...sayfalar.map((s) => yaprakCiz(ctx, s)));
}
