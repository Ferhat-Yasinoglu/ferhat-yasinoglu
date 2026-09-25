// Reçete kâğıdı. Ekranda gizli, yazdırılırken sayfadaki tek görünen şey.
// Düzen doktorun hâlihazırda kullandığı basılı reçete kâğıdından alındı:
// mavi antet (ad, ünvan şeridi), hizmet satırları, sabıka satırı, Name/Age/Date
// şeridi, solda Clinical sütunu, sağda ℞ alanı, altta rozetler ve iletişim.
//
// İki halde çalışır: dolu reçete ve boş kâğıt. Boş hal, doktorun tomar halinde
// bastırıp üzerine kalemle yazdığı kâğıdın aynısıdır — her şey aynı yerde durur,
// yalnız alanlar çizgi olarak basılır.
import { el, svgEl, qrGorsel } from './cekirdek/dom.js';
import { gorselMi } from './cekirdek/gorsel.js';
import { simge, LOGO } from './cekirdek/simge.js';
import { rxIsareti, hatCizimi, VECIZE_METNI } from './cekirdek/cizimler.js';
import { t } from './i18n.js';
import { tamAd, hastaYasi } from './paylasilan/hasta.js';
import { OLCUMLER } from './paylasilan/recete.js';
import { formKisa, ilacAdiFormsuz } from './paylasilan/ilac.js';
import { ozetMetni, kodSatiri } from './paylasilan/dogrulama.js';
import { tarihMetni } from './paylasilan/tarih.js';
import { telefonNormalize } from './paylasilan/metin.js';
import { qrOkunurMu } from './paylasilan/qr.js';
import { kagitStiliCoz } from './paylasilan/antet.js';
import { ilacSatiri } from './paylasilan/kagit-yogunluk.js';
import { lacivertKagit } from './kagit-lacivert.js';

/** Antet amblemi: kanatlı kadüse — hekimin basılı kâğıdındaki amblem.
 *
 *  Not: tıbbın doğru sembolü tek yılanlı Asklepios asasıdır; kanatlı iki
 *  yılanlı kadüse aslında ticaretin sembolü ve tıpta yaygın bir karışıklık.
 *  Burada yine de kadüse çiziliyor çünkü bu kâğıt hekimin kendi antedi ve
 *  onun basılı reçetesinde bu amblem var — kâğıdın kimliği, bizim tercihimiz
 *  değil. Asklepios çizimi denendi ve "bizimki bu değil" diye geri alındı.
 *
 *  viewBox tasarımdaki çizimin piksel kutusu (69×83). Kanatlar omuzda
 *  kabarıp uca doğru hafifçe iniyor, alt kenarları üç kat tüy; iki yılanın
 *  başı tepede dışa kıvrılıyor, gövdeleri asanın çevresinde beş kez
 *  kesişerek daralıyor ve incelen bir kuyrukta bitiyor. Yılan her halkada
 *  biraz daha ince: tek kalınlıkta çizilince halkalar aşağıda kalın
 *  ilmeklere dönüyordu. Tüy araları beyaz çizgi: kâğıt her zaman beyaz,
 *  oyuk gibi okunuyor.
 *
 *  Renk yukarıdan aşağı koyulaşan bir geçiş; kuyruğa doğru yine açılıyor.
 *  Durakların rengi kendiliğinden currentColor (klasik antette beyaz, sade
 *  kâğıtta siyah, düz); tonları yalnız modern stil CSS'ten veriyor. */
const YILAN_PARCALARI = [
  // [kalınlık, yol]: baş kıvrımı, beş halka, kuyruk. Öteki yılan bunun aynası.
  [3.4, 'M28.2 30.4C29.2 28 27.6 25.6 25 25.9 22 26.3 20.8 30.2 22.8 33 24.8 35.6 29.5 36 34.5 35.5'],
  [3, 'M34.5 35.5C39.5 35.6 42.7 38.2 42.7 41.5S39.5 47.4 34.5 47.6'],
  [2.6, 'M34.5 47.6C31.2 47.8 29 49.6 29 51.8S31.2 55.8 34.5 56'],
  [2.2, 'M34.5 56C36.8 56.1 38.3 57.6 38.3 59.6S36.8 63.1 34.5 63.2'],
  [1.8, 'M34.5 63.2C32.9 63.3 31.9 64.5 31.9 65.9S32.9 68.5 34.5 68.6'],
  [1.4, 'M34.5 68.6C35.6 68.7 36.2 69.6 36.2 70.7S35.6 72.7 34.5 72.8'],
  [1, 'M34.5 72.8C33.6 73.8 33.7 75.4 34.5 77.2'],
];
const KANAT = 'M31.6 9.6C31.2 6.6 28.6 5.4 25.6 6 16.5 6.2 6.5 8.6.2 12.8 3.5 14 7 14.4 10.5 14.3 7.5 15.2 5 16.2 4.2 16.8 8.5 17.8 13 18.3 17.6 18.2 15.4 19.2 13.6 20.2 13 20.8 19 22.6 26 22.9 31.6 22Z';
const KANAT_TUY = 'M6.5 14.9C10.5 15.4 14.5 15.4 18 14.8M12.5 18.8C15.5 19.4 18.5 19.5 21.5 19';
export function amblemCiz() {
  const renk = tekilKimlik('kagit-kaduse');
  const ayna = 'matrix(-1 0 0 1 69 0)';
  const yilan = (donus) => svgEl('g', { fill: 'none', stroke: `url(#${renk})`, 'stroke-linecap': 'round', transform: donus },
    YILAN_PARCALARI.map(([kalinlik, d]) => svgEl('path', { d, 'stroke-width': kalinlik })));
  return svgEl('svg', { class: 'kagit__amblem-cizim', viewBox: '0 0 69 83', 'aria-hidden': 'true' },
    svgEl('defs', {},
      svgEl('linearGradient', { id: renk, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: 83 },
        ['ust', 'orta', 'alt', 'uc'].map((ad, i) => svgEl('stop', {
          class: `kagit__amblem-${ad}`, offset: [0, 0.45, 0.8, 1][i], 'stop-color': 'currentColor',
        })))),
    svgEl('g', { fill: `url(#${renk})` },
      // Asa, tepesinde topuz; alt ucu sivri
      svgEl('circle', { cx: 34.5, cy: 3.6, r: 3.4 }),
      svgEl('path', { d: 'M33.3 6.5h2.4v67l-1.2 4-1.2-4z' }),
      svgEl('path', { d: KANAT }),
      svgEl('path', { d: KANAT, transform: ayna })),
    svgEl('g', { fill: 'none', stroke: '#fff', 'stroke-width': 0.7, 'stroke-linecap': 'round' },
      svgEl('path', { d: KANAT_TUY }),
      svgEl('path', { d: KANAT_TUY, transform: ayna })),
    yilan(null), yilan(ayna));
}

/** Slogan bloğundaki logo: kenar çubuğundaki marka logosunun AYNI çizimi
 *  (simge.js LOGO), kâğıtta biraz daha kalın. Kutu çizimin sıkı çerçevesi:
 *  60×55 px'lik yuvayı (19 × 17,5 mm) kalp dolduruyor. Kalınlıklar
 *  tasarımda ölçüldü: kalp ≈ 3,5 px, nabız ≈ 2,6 px. */
function sloganAmblemi() {
  const cizgi = (d, kalinlik) => svgEl('path', {
    d, 'stroke-width': kalinlik, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  });
  return svgEl('svg', { class: 'kagit__slogan-cizim', viewBox: LOGO.kutu, fill: 'none', stroke: 'currentColor', 'aria-hidden': 'true' },
    cizgi(LOGO.kalp, 1.1), cizgi(LOGO.nabiz, 0.8));
}

/** Antetin sağında, kadüsenin altındaki ikinci amblem: kontur bir kalbin
 *  içinde kollarını açmış TEK bir insan. Tasarımdaki figür artıyla
 *  kaynaşmış bir insan (üretim hatası); aynı silueti temiz bir anlamla
 *  veriyor. Eskiden dolu kalpte üç beyaz figürdü.
 *  Kalbin konturu tek kalınlıkta bir çizgi değil, iki kalp arasındaki
 *  halka (evenodd): tepede ince, yanlarda ve sivri uçta kalın, tasarımdaki
 *  kalem izi gibi. Rengi yukarıdan aşağı koyulaşıyor; duraklar kendiliğinden
 *  currentColor, tonları modern stil CSS'ten veriyor (bkz. amblemCiz).
 *  Figür ayrı parçalar (baş, omuz, iki kol, gövde): deneme amblemin
 *  gerçekten çizildiğini parça sayısından anlıyor. */
function aileAmblemi() {
  const renk = tekilKimlik('kagit-aile');
  return svgEl('svg', { class: 'kagit__aile-cizim', viewBox: '0 0 100 100', fill: 'currentColor', 'aria-hidden': 'true' },
    svgEl('defs', {},
      svgEl('linearGradient', { id: renk, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: 100 },
        ['ust', 'orta', 'alt'].map((ad, i) => svgEl('stop', {
          class: `kagit__aile-${ad}`, offset: i / 2, 'stop-color': 'currentColor',
        })))),
    svgEl('path', {
      fill: `url(#${renk})`, 'fill-rule': 'evenodd',
      d: 'M50 97C20 77 1 58 1 34.5 1 16 13.5 3.5 30 3.5c8.5 0 15.5 4 20 10.5C54.5 7.5 61.5 3.5 70 3.5 86.5 3.5 99 16 99 34.5 99 58 80 77 50 97Z'
        + 'M50 84C26 68 11 52.5 11 34.5 11 20 19 9.5 30.5 9.5c8 0 13.8 4.6 17.2 11.5h4.6C55.7 14.1 61.5 9.5 69.5 9.5 81 9.5 89 20 89 34.5 89 52.5 74 68 50 84Z',
    }),
    svgEl('circle', { cx: 50, cy: 33, r: 7.5 }),
    svgEl('path', { d: 'M44.8 42.5h10.4l-1.4 8h-7.6z' }),
    svgEl('path', { d: 'M46 47H35.5a4.5 4.5 0 0 0 0 9H46z' }),
    svgEl('path', { d: 'M54 47h10.5a4.5 4.5 0 0 1 0 9H54z' }),
    svgEl('path', { d: 'M45.5 49h9v22a4.5 4.5 0 0 1-9 0z' }));
}

/** İkinci hizmet dairesindeki ekografi cihazı: ince çizgi monitör, ekranda
 *  küçük bir damla, ayak ve taban. Uygulamanın genel `ultrason` simgesindeki
 *  iki yay 7 mm'lik dairede çizgi yumağına dönüyordu. */
function ultrasonCizimi() {
  return svgEl('svg', {
    class: 'simge', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  },
  svgEl('rect', { x: 4, y: 3.5, width: 16, height: 12, rx: 2 }),
  svgEl('path', { d: 'M12 7.2c1.2 1.4 1.9 2.4 1.9 3.3a1.9 1.9 0 0 1-3.8 0c0-.9.7-1.9 1.9-3.3z' }),
  svgEl('path', { d: 'M12 15.5v2.8M6 18.3h12M4.5 20.8h15' }));
}

/** Clinical sütununun altındaki sağlık çizimi: borusu kalp çizen stetoskop.
 *  Basılı kâğıtta burada bir FOTOĞRAF var. Hekim kendi fotoğrafını
 *  Ayarlar'dan yükleyebiliyor (cihazda kalıyor, bkz. cekirdek/gorsel.js);
 *  yüklemediyse bu çizim duruyor — düzeni ve ağırlığı veriyor. */
function saglikResmi(ayar = {}) {
  if (gorselMi(ayar.saglikGorseli)) {
    return el('img', { class: 'kagit__saglik-foto', src: ayar.saglikGorseli, alt: '' });
  }
  return saglikCizimi();
}

/* Fotoğraf yoksa yerine duran çizim: tasarımdaki fotoğrafın vektör
   karşılığı. Birebir olamaz (fotoğraf), ama aynı öğeler aynı yerde: üstte
   kulaklıklar, ortada parlak koyu bir kalp ve üstünde beyaz nabız, kalbin
   iki yanından inen metal kollar, solda kıvrılan hortum ve göğüs parçası,
   arkada yumuşak açık bir kart. Sağ alt köşe BOŞ: el yazısı («Healthy Life
   …») oraya, QR'ın sağına oturuyor ve çizime binmiyor; göğüs parçası da
   QR'ın hemen üstünde bitiyor.
   viewBox tasarımdaki yuvanın pikseli (147×83 ≈ 46,9×26 mm).
   Kart ve parıltı yalnız süs: modern dışındaki stiller onları basmıyor,
   sade stil kalanı ince siyah çizgiyle basıyor (bkz. yazdirma.css). */
function saglikCizimi() {
  const kalp = tekilKimlik('kagit-kalp');
  const kart = tekilKimlik('kagit-kart');
  const boru = (d, renk, kalinlik) => svgEl('path', {
    d, fill: 'none', stroke: renk, 'stroke-width': kalinlik, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  });
  return svgEl('svg', { class: 'kagit__saglik-cizim', viewBox: '0 0 147 83', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' },
    svgEl('defs', {},
      svgEl('radialGradient', { id: kalp, cx: '.34', cy: '.3', r: '.8' },
        svgEl('stop', { offset: 0, 'stop-color': '#4f7482' }),
        svgEl('stop', { offset: 1, 'stop-color': '#14303d' })),
      svgEl('linearGradient', { id: kart, x1: 0, y1: 0, x2: 0, y2: 1 },
        svgEl('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.95 }),
        svgEl('stop', { offset: 1, 'stop-color': '#e2f1f6', 'stop-opacity': 0.55 }))),
    // Arkadaki açık kart: üst kenarı sağa doğru kalkıyor, köşesi yuvarlak.
    svgEl('path', { class: 'kagit__saglik-kart', d: 'M0 16C36 5 92 1 136 5Q147 6 147 17V83H0Z', fill: `url(#${kart})` }),
    svgEl('path', { class: 'kagit__saglik-kart', d: 'M0 50C34 42 76 58 110 72Q126 78 147 76V83H0Z', fill: '#d6eaf1', opacity: 0.6 }),
    // Kulaklıklar üstte, kalbin sağ lobunun üstünde; metal kollar kalbin
    // iki yanından iniyor. Sağ kol kalbin arkasına giriyor: el yazısının
    // yeri (sağ alt) boş kalsın.
    svgEl('rect', { x: 78, y: 2, width: 10, height: 5.6, rx: 2.8, fill: '#26343c', transform: 'rotate(8 83 5)' }),
    svgEl('rect', { x: 92, y: 4.5, width: 10, height: 5.6, rx: 2.8, fill: '#26343c', transform: 'rotate(22 97 7.3)' }),
    boru('M80 6C64 7 51 16 47 31', '#8d9ba2', 2.2),
    boru('M101 10C117 14 123 27 118 38 114 47 103 50 86 47', '#8d9ba2', 2.2),
    // Kauçuk hortum: soldan kıvrılıp göğüs parçasına iniyor; kalbin
    // altından gelen ikinci kol da ona bağlanıyor.
    boru('M47 31C44 40 39 43 29 44 15 46 5 52 7 59 9 66 19 67 26 63', '#26343c', 3.8),
    boru('M72 55C63 60 53 62 41 61', '#26343c', 3.8),
    // Kalp ve üstündeki beyaz nabız; sol üstte hafif bir parıltı. Grup
    // kalbin eski (tam yuva) çiziminden 0,9 kat küçültülmüş.
    svgEl('g', { transform: 'matrix(.9 0 0 .9 2.6 -8.4)' },
      svgEl('path', { d: 'M81 77C66 66 55 55 55 41 55 31 62 25 69.5 25 74.5 25 78.8 28 81 32.5 83.2 28 87.5 25 92.5 25 100 25 107 31 107 41 107 55 96 66 81 77Z', fill: `url(#${kalp})` }),
      svgEl('ellipse', { class: 'kagit__saglik-parilti', cx: 66, cy: 34, rx: 6, ry: 3.2, fill: '#fff', opacity: 0.22, transform: 'rotate(-28 66 34)' }),
      boru('M58 51H72l2.4-4.2 3 10.4 3.6-18.6 3.2 15.2 2-4.8H104', '#fff', 1.6)),
    svgEl('circle', { cx: 30, cy: 61, r: 11, fill: '#26343c' }),
    svgEl('circle', { cx: 30, cy: 61, r: 7.4, fill: '#aab6bb' }),
    svgEl('circle', { cx: 30, cy: 61, r: 4, fill: '#dde4e7' }));
}

/** Vecize kartuşu: uçları sivri kıvrımlı (ogee) turkuaz çerçeve, iki
 *  ucunda arabesk süs ve ince bir kıl çizgi. Kenarlık + outline ile
 *  yapılamıyordu: sivri uç ve süs ancak çizimle basılıyor. Tasarımda altın
 *  yok; önceki altın iç çizgi ve baklava süs kaldırıldı.
 *  viewBox tasarımdaki kartuşun piksel kutusu (290×38); boyutu CSS veriyor
 *  ve oran korunuyor, uçlar hiç esnemiyor. Sağ süs soldakinin aynası. */
function kartusCiz() {
  const sus = (ayna) => svgEl('g', {
    fill: 'none', stroke: 'currentColor', 'stroke-width': 1.3, 'stroke-linecap': 'round',
    class: 'kagit__kartus-sus', transform: ayna ? 'matrix(-1 0 0 1 289 0)' : null,
  },
  svgEl('path', { d: 'M0 19H24', 'stroke-width': 0.8 }),
  svgEl('path', { d: 'M5 19C10 16.4 15.5 16.2 20 19 15.5 21.8 10 21.6 5 19Z', fill: 'currentColor', stroke: 'none' }),
  svgEl('path', { d: 'M24 17.4C20.5 16.4 17 13.8 17.6 10.4 18.2 7.4 22.4 7 23.4 9.6 24.2 11.8 22 13.2 20.8 12.1' }),
  svgEl('path', { d: 'M24 20.6C20.5 21.6 17 24.2 17.6 27.6 18.2 30.6 22.4 31 23.4 28.4 24.2 26.2 22 24.8 20.8 25.9' }),
  svgEl('path', { d: 'M16 15.8C13.6 14.4 12.6 12 14 10.4M16 22.2C13.6 23.6 12.6 26 14 27.6' }));
  return svgEl('svg', { class: 'kagit__kartus', viewBox: '0 0 290 38', 'aria-hidden': 'true' },
    svgEl('path', {
      fill: '#fff', stroke: 'currentColor', 'stroke-width': 1.8,
      d: 'M37 1H252C256.5 1 259.8 3.8 260 8.5 260.2 13 261.5 16.6 264 19 261.5 21.4 260.2 25 260 29.5 259.8 34.2 256.5 37 252 37H37C32.5 37 29.2 34.2 29 29.5 28.8 25 27.5 21.4 25 19 27.5 16.6 28.8 13 29 8.5 29.2 3.8 32.5 1 37 1Z',
    }),
    sus(false), sus(true));
}

/** Kâğıda basılı, değişmeyen satır. Ayarlarda karşılığı yoktur; kaldırmak
 *  ya da değiştirmek için cizimler.js'i düzenlemek gerekir — öyle istendi.
 *  Lacivert kâğıt aynı satırı hat çizimi olarak basıyor. */
const VECIZE = VECIZE_METNI;

/* Klinik alanların etiketleri kâğıtta İngilizce durur: doktorun kendi kâğıdı
   da böyle ve BP/PR/RR/BW hekimlikte evrensel kısaltmalar. */
export const KLINIK_ADLARI = { bp: 'BP', pr: 'PR', rr: 'RR', bw: 'BW', temp: 'Temperature', spo2: 'SpO2', ht: 'Height' };

/* Her ölçümün yanında kendi simgesi duruyor: sütun bir etiket listesi değil,
   bakışta taranabilen bir pano olsun. Simgeler dolgulu tablodan (simge.js
   SIMGELER_DOLU) ve formun Clinical kartıyla AYNI adlar: form da bu
   tabloyu kullanıyor, iki yerde ayrı yol seti tutulmuyor. */
export const OLCUM_SIMGELERI = {
  bp: 'tansiyon', pr: 'nabiz', rr: 'akciger', bw: 'tarti',
  temp: 'termometre', spo2: 'oksijen', ht: 'boy', kanGrubu: 'kan',
};
/* Hasta şeridindeki alanların dolgulu simgeleri, şeritteki sırayla: Name
   kişi, Age kum saati (tasarımdaki açık kitap yaşla ilgisiz bir üretim
   hatası), Date dolu belge, No kontur belge. */
const SERIT_SIMGELERI = ['hasta', 'kum-saati', 'recete', 'belge'];

/* Antet dalgasının katmanları, arkadan öne: [yol, dolgu]. Birim tasarımdaki
   kâğıdın pikseli (608×191, sol üst köşe 0,0); kenarlar tasarımda sütun
   sütun ölçüldü. Her katman tek bir düzgün Bézier yolu ve kendi geçişiyle
   boyanıyor: eşikten izlenen düz renkli lekeler (poster görünümü) ve
   bulanıklık filtresi yok. Kâğıt kenarına değen yollar viewBox'ın 4 birim
   dışına taşıyor; kenarda beyaz hale kalmıyor.
   Dolgu: ['d', x1, y1, x2, y2, duraklar] doğrusal geçiş (kullanıcı birimi),
   ['r', cx, cy, rx, ry, duraklar] eliptik ışıma; durak [konum, renk, opaklık?]. */
const ANTET_DALGASI = [
  // Soluk zemin: sol üst köşe, slogan logosunun arkasında beyaz bir ışıma.
  ['M-4-4H308C290 8 262 18 240 32 210 51.1 186 82 160 90 140 96.2 120 105 90 106 60 107 40 108 25 114 12 119.2 4 128-4 134Z',
    ['r', 72, 46, 128, 70, [[0, '#fff'], [0.3, '#f6fbfd'], [0.55, '#e4f3f7'], [0.8, '#d2eef4'], [1, '#c6ebf2']]]],
  // Sol alt köşedeki soluk yıkama (kurdelenin arkasında): kutunun kenarına
  // varmadan sönüyor, sınırı görünmüyor.
  ['M-4 96H132V195H-4Z', ['r', -6, 162, 118, 48, [[0, '#c9e9f0'], [0.55, '#dff3f7', 0.7], [1, '#eef9fb', 0]]]],
  // Cam bant, üç parça: kurdelenin üstünde soldan gelen ince bant, sağda
  // çanağın altını dolduran ve çanağa doğru koyulaşan kama, sol üstten
  // çanağın altına inen açık kol. İç kenarları saydamlaşarak zemine
  // karışıyor; keskin bir leke sınırı kalmıyor.
  ['M-4 74C30 78 62 86 100 86 124 86 144 83 160 74V88C140 97 110 99 70 101 40 102 20 103-4 107Z',
    ['d', 0, 74, 0, 100, [[0, '#8fd7e2', 0], [0.5, '#76cfdb', 0.9], [1, '#5cc4d5']]]],
  ['M134 24C142 40 140 70 138 98 160 88 170 78 180 69 200 52 222 32 245 19 265 9 283 4 300-2L304-4H134Z',
    ['d', 138, 0, 222, 0, [[0, '#b5e4ec', 0], [0.3, '#8cd6e1', 0.8], [0.47, '#6cc9d6'], [0.62, '#3cb4c4'], [0.78, '#119fb1'], [1, '#0b8fa2']]]],
  ['M57-4C66 2 76 7 86 12 106 22 132 28 158 31L172 33V-4Z',
    ['d', 57, 0, 172, 0, [[0, '#c6ebf2', 0.3], [0.3, '#a9e0e9', 0.9], [0.7, '#88d6e2'], [1, '#7bd1dd']]]],
  // Çanağın sağ altından inen koyu turkuaz iç kurdele.
  ['M166 20C184 26 194 36 203 43 215 34 228 22 246 6V-4H166Z',
    ['d', 196, 44, 214, 16, [[0, '#2aacbc'], [0.45, '#0795a8'], [1, '#037d91']]]],
  // Tepeden sarkan koyu çanak; ortası daha açık petrol.
  ['M94-4C110 6 136 20 166 24 198 28 228 18 264-4Z',
    ['d', 100, 0, 262, 0, [[0, '#03586d'], [0.3, '#016b80'], [0.62, '#02889a'], [0.78, '#027d90'], [1, '#035b6e']]]],
  // Kurdelenin üst kenarındaki açık parıltı (sağ yarıda).
  ['M170 76C184 62 195 49 205 37 220 22 240 10 262 3 273 0 283-2 293-4H302L298-2C283 4 265 9 245 19 222 32 200 52 180 69Z',
    ['d', 176, 0, 292, 0, [[0, '#a6dde6'], [0.4, '#88d1dc'], [0.66, '#6fc8d5'], [0.82, '#3db2c1'], [1, '#1fa6b5']]]],
  // Koyu S-kurdele: sol kenarda kalın, ortada incelip açılıyor, tepede yine koyu.
  ['M-4 105C20 99 70 99 110 97 140 95 160 84 180 67 200 50 222 30 245 17 265 7 283 2 298-4H308C290 8 262 18 240 32 210 51.1 186 82 160 90 140 96.2 120 105 90 106 60 107 40 108 25 114 12 119.2 4 128-4 134Z',
    ['d', 0, 0, 304, 0, [[0, '#06566a'], [0.08, '#046a7f'], [0.22, '#067f93'], [0.42, '#0790a4'], [0.55, '#0898ab'], [0.64, '#05889c'], [0.71, '#03697d'], [0.79, '#024f63'], [1, '#033f50']]]],
  // Kurdelenin sol ucunun alt yarısı gölgede: kenarda koyu, sağa doğru siliniyor.
  ['M-4 116C12 113 28 109 50 107 32 110 16 118-4 134Z',
    ['d', -4, 0, 50, 0, [[0, '#073a48', 0.9], [1, '#073a48', 0]]]],
  // Kurdelenin altındaki açık kuyruk: sol kenardan çıkıp incelerek bitiyor.
  ['M-4 134C4 128 12 120 25 114 40 108 60 107 84 107 58 112 30 124-4 150Z',
    ['d', -4, 0, 84, 0, [[0, '#8fd6e2'], [0.5, '#b4e3eb', 0.9], [1, '#d6f1f6', 0]]]],
  // Kurdele tepesinin sağında ince açık tepe.
  ['M296-4C314 3 336 4 362-4Z', ['d', 296, 0, 362, 0, [[0, '#a8e2eb'], [1, '#e2f6f9', 0]]]],
];

/* SVG içindeki kimlikler (filtre, gradyan) belgede tekil olmalı: sayfada
   aynı anda birden çok kâğıt olabiliyor (önizleme kutusu, yazdırma
   kopyaları) ve aynı kimlik ikincide ilkini gösteriyordu. */
let kimlikSayaci = 0;
export const tekilKimlik = (on) => `${on}-${++kimlikSayaci}`;

/* Ayak bandının katmanları, arkadan öne. Birim tasarımdaki kâğıdın pikseli:
   x 0–608, y 0 = gövde kutularının alt kenarı, 94 = kâğıdın dibi. Üst
   kenarlar tasarımın parlaklık eşiklerinden sütun sütun ölçüldü (236 / 175
   / 100) ve yumuşatıldı. Soluk katman sağ uçta ℞ kutusunun köşesinin
   arkasına yükseliyor; kutular önde durduğu için yalnız aradaki boşlukta
   görünüyor. */
const AYAK_SOLUK = 'M0 -4C5 -3.2 20.8 -.5 30 1 39.2 2.5 47.5 4.5 55 5 62.5 5.5 67.5 4.5 75 4 82.5 3.5 82.5 2.2 100 2 117.5 1.8 155 3 180 3 205 3 230 1.5 250 2 270 2.5 283.3 4.2 300 6 316.7 7.8 331.7 10.3 350 13 368.3 15.7 393.3 22.7 410 22 426.7 21.3 438.3 11.5 450 9 461.7 6.5 470 6.8 480 7 490 7.2 500.8 9.8 510 10 519.2 10.2 525.8 9.3 535 8 544.2 6.7 556.2 3.7 565 2 573.8 .3 582.2 .3 588 -2 593.8 -4.3 596.7 -8.3 600 -12 603.3 -15.7 606.7 -22 608 -24V94H0Z';
const AYAK_PARLAK = 'M0 25C4.2 23.3 16.7 17.7 25 15 33.3 12.3 41.7 10.7 50 9 58.3 7.3 66.7 6.2 75 5 83.3 3.8 82.5 2.3 100 2 117.5 1.7 153.3 2.8 180 3 206.7 3.2 240 2.3 260 3 280 3.7 285 5.3 300 7 315 8.7 333.3 10.7 350 13 366.7 15.3 383.3 18.8 400 21 416.7 23.2 434.2 24.8 450 26 465.8 27.2 480 28.2 495 28 510 27.8 528.3 26.3 540 25 551.7 23.7 556.7 22.3 565 20 573.3 17.7 582.8 14.8 590 11 597.2 7.2 605 -.7 608 -3V94H0Z';
const AYAK_KOYU = 'M0 26C4.2 24.2 16.7 17.8 25 15 33.3 12.2 41.7 10.7 50 9 58.3 7.3 67.2 5.8 75 5 82.8 4.2 90.8 3 97 4 103.2 5 103.2 10.2 112 11 120.8 11.8 135.3 9 150 9 164.7 9 181.7 10 200 11 218.3 12 243.3 13.5 260 15 276.7 16.5 288.3 18.3 300 20 311.7 21.7 319.7 22 330 25 340.3 28 352.8 36.7 362 38 371.2 39.3 377 35 385 33 393 31 400.8 27.2 410 26 419.2 24.8 428.3 25.7 440 26 451.7 26.3 466.7 27.7 480 28 493.3 28.3 506.7 28.2 520 28 533.3 27.8 548.3 27.7 560 27 571.7 26.3 582 25 590 24 598 23 605 21.5 608 21V94H0Z';
/** Koyu tabanı çapraz kesen açık turkuaz iz (iletişim bloğunun solunda). */
const AYAK_IZ = 'M372 40C392 52 424 72 452 94H420C408 76 392 58 372 40Z';

/** Antet katmanının geçişi: doğrusal ya da eliptik ışıma (kullanıcı
 *  biriminde; elips gradientTransform ile birim daireden çiziliyor). */
function gecis(id, [tur, a, b, c, d, duraklar]) {
  const stoplar = duraklar.map(([offset, renk, opaklik]) => svgEl('stop', { offset, 'stop-color': renk, 'stop-opacity': opaklik }));
  return tur === 'r'
    ? svgEl('radialGradient', { id, gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: 1, gradientTransform: `translate(${a} ${b}) scale(${c} ${d})` }, stoplar)
    : svgEl('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: a, y1: b, x2: c, y2: d }, stoplar);
}

/** Köşe süsü ve ayak bandı için akan dalga çizimleri.
 *
 *  CSS zemini değil SVG ÖĞESİ: zemin dolguları yazdırmada tarayıcının
 *  "arka plan grafikleri" seçeneğine bağlı, SVG içeriği ise her zaman basılır.
 *  (print-color-adjust yine de duruyor, bu ikinci emniyet.) */
function dalga(yer) {
  if (yer === 'ust') {
    // Tasarımda dalgalar antedin yalnız SOL yarısında (≈ %54): koyu petrol
    // bir S-kurdele, tepeden sarkan koyu bir çanak, aralarında açık turkuaz
    // bir cam bant; sağ yarı beyaz. Geçiş kimlikleri her kâğıtta tekil:
    // sayfada birden çok kâğıt olabiliyor (önizleme, yazdırma kopyası).
    const kimlikler = ANTET_DALGASI.map(() => tekilKimlik('kagit-dalga'));
    return svgEl('svg', {
      class: 'kagit__dalga kagit__dalga--ust', viewBox: '0 0 608 191',
      preserveAspectRatio: 'none', 'aria-hidden': 'true',
    },
    svgEl('defs', {}, ANTET_DALGASI.map(([, dolgu], i) => gecis(kimlikler[i], dolgu))),
    ANTET_DALGASI.map(([d], i) => svgEl('path', { d, fill: `url(#${kimlikler[i]})` })));
  }
  // Ayak bandı: dört katman. Soluk turkuaz hale, parlak turkuaz kurdele,
  // koyu petrol taban ve tabanı kesen açık iz. Zemin rengi CSS'te değil
  // bu çizimde: "arka plan grafikleri" kapalı basılsa da bant çıksın.
  const soluk = tekilKimlik('kagit-ayak-soluk');
  const parlak = tekilKimlik('kagit-ayak-parlak');
  const taban = tekilKimlik('kagit-ayak-taban');
  const dikey = (id, duraklar) => svgEl('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: 0, y1: -24, x2: 0, y2: 40 },
    ...duraklar.map(([offset, renk]) => svgEl('stop', { offset, 'stop-color': renk })));
  return svgEl('svg', {
    class: 'kagit__dalga kagit__dalga--alt', viewBox: '0 -24 608 118',
    preserveAspectRatio: 'none', 'aria-hidden': 'true',
  },
  svgEl('defs', {},
    dikey(soluk, [[0, '#eef9fc'], [0.4, '#cdeff5'], [0.75, '#98dde8'], [1, '#7fd3df']]),
    dikey(parlak, [[0.35, '#0a9bad'], [0.6, '#0a8a9e'], [1, '#0b687b']]),
    svgEl('linearGradient', { id: taban, x1: 0, y1: 0, x2: 1, y2: 0 },
      ...[[0, '#013d4e'], [0.3, '#014d5e'], [0.7, '#014d5e'], [1, '#013d4e']].map(([offset, renk]) => svgEl('stop', { offset, 'stop-color': renk })))),
  svgEl('path', { d: AYAK_SOLUK, fill: `url(#${soluk})` }),
  svgEl('path', { d: AYAK_PARLAK, fill: `url(#${parlak})` }),
  svgEl('path', { d: AYAK_KOYU, fill: `url(#${taban})` }),
  svgEl('path', { d: AYAK_IZ, fill: '#2f8ea2', opacity: 0.5 }));
}

const doluMu = (v) => String(v ?? '').trim() !== '';
const satirlara = (metin) => String(metin ?? '').split('\n').map((x) => x.trim()).filter(Boolean);

/** QR ayarı hiç kaydedilmemişse ne basılır. Ayarlar sayfası da bunu
 *  seçili gösteriyor: önceden orada «reçete metni» seçili duruyor, kâğıt
 *  ise WhatsApp basıyordu. WhatsApp, çünkü QR'ın altında "Scan for
 *  Contact" yazıyor ve boş kâğıtta da basılabilen tek içerik bu. */
export const QR_VARSAYILAN = 'whatsapp';

/* QR'ın kâğıttaki basılı eni (mm, 2 modüllük sessiz alan dahil). Lacivert
   kâğıtta QR kartı kipe göre 14/13/12 mm, içinde 1 mm pay: en küçüğü (10
   mm) alınıyor ki içerik kararı kipe bağlı olmasın — önizleme ve baskı hangi
   kipte olursa olsun aynı QR'ı bassın. Öbür stillerde QR 16 mm. */
const QR_BASKI_MM = { lacivert: 10, modern: 16, klasik: 16, sade: 16 };

/**
 * Kâğıdın QR'ı: içerik ve türü. Ayarlardan seçilir.
 *
 * «Reçete metni» seçiliyse içerik doğrulanabilir özet. Özet uzun: tek
 * ilaçta bile basılı QR'ın modülü 0,17 mm'ye iniyor, on ilaçta QR hiç
 * kurulamıyordu (sürüm 20'yi aşıyor) ve kâğıttaki yer sessizce boş
 * kalıyordu. Okunamayacak bir QR basmak yerine iletişim QR'ı (numara yoksa
 * doğrulama kodu) basılıyor; `yedek` bunu söylüyor, altındaki yazı da
 * basılanı anlatıyor. Ayarlar sayfası bu seçimde ayrıca uyarıyor.
 * @returns {{ metin: string, tur: 'recete'|'iletisim'|'kod'|'yok', yedek: boolean }}
 */
export function qrBilgisi(ayar, recete, hasta, { bos = false } = {}) {
  const secim = ayar.qrIcerik || QR_VARSAYILAN;
  if (secim === 'yok') return { metin: '', tur: 'yok', yedek: false };
  const numara = telefonNormalize(ayar.whatsapp || ayar.telefon, ayar.ulkeKodu);
  const iletisim = numara ? { metin: `https://wa.me/${numara}`, tur: 'iletisim' } : { metin: '', tur: 'yok' };
  if (secim === 'recete' && !bos && recete) {
    // Doğrulanabilir içerik: kanonik özet + kod. Eczaneci QR'ı okutup kâğıttaki
    // yazıyla karşılaştırır; ikisi tutmuyorsa kâğıt üzerinde oynanmıştır.
    const ozet = ozetMetni(recete, tamAd(hasta));
    const metin = recete.dogrulamaKodu ? `${ozet}\n${kodSatiri(recete.dogrulamaKodu)}` : ozet;
    if (qrOkunurMu(metin, QR_BASKI_MM[kagitStiliCoz(ayar)])) return { metin, tur: 'recete', yedek: false };
    if (iletisim.metin) return { ...iletisim, yedek: true };
    return recete.dogrulamaKodu
      ? { metin: kodSatiri(recete.dogrulamaKodu), tur: 'kod', yedek: true }
      : { metin: '', tur: 'yok', yedek: true };
  }
  return { ...iletisim, yedek: false };
}

/** Kâğıdın üstündeki QR'ın içeriği (basılan metin). */
export const qrIcerigi = (ayar, recete, hasta, secenek) => qrBilgisi(ayar, recete, hasta, secenek).metin;

/** QR çizimi. Sessiz alan 4 değil 2 modül: kâğıtta QR'ın çevresinde ayrıca
 *  beyaz bir kart payı var. Dört modülde kod kartın ancak üçte ikisiydi;
 *  tasarımda kart neredeyse tamamen koddan oluşuyor. */
export function qrCiz(metin, { boy, sinif }) {
  const qr = qrGorsel(metin, { boy, sinif });
  if (!qr) return null;
  const kutu = Number(qr.getAttribute('viewBox').split(' ')[2]);
  qr.setAttribute('viewBox', `2 2 ${kutu - 4} ${kutu - 4}`);
  qr.setAttribute('data-rol', 'qr');
  return qr;
}

/** ℞ alanının arkasındaki filigran: kalın-ince (hat kalemiyle çizilmiş
 *  gibi) altı açık bir kalp ve alanı boydan boya geçen üç atımlı bir
 *  nabız çizgisi. Tasarımdaki gibi: sağ kol ucun ötesine, sol alta doğru
 *  incelerek uzanıyor; nabız kalbin çizgisini kestiği yerde kalbi yarıyor.
 *  viewBox'ın birimi tasarımdaki ℞ kutusunun pikseli (426 geniş): çizim
 *  kutunun tam genişliğine yayılınca oranlar kendiliğinden tutuyor.
 *  Renk düz ve opak (--m-filigran): basılınca da aynı açıklıkta çıksın;
 *  yalnız nabzın iki ucu solarak bitiyor. */
function filigran() {
  const solma = tekilKimlik('kagit-filigran');
  const NABIZ = 'M24 110H87l5-14 10 36 8-71 7 83 8-47 5 13H173l7-16 13 48 15-75 12 62 8-22 H253M287 110h5l8-13 7 47 7-83 10 71 8-36 7 14H392';
  return svgEl('svg', { class: 'kagit__filigran', viewBox: '0 0 426 200', 'aria-hidden': 'true' },
    svgEl('defs', {},
      svgEl('linearGradient', { id: solma, gradientUnits: 'userSpaceOnUse', x1: 24, y1: 0, x2: 392, y2: 0 },
        svgEl('stop', { offset: 0, 'stop-color': 'currentColor', 'stop-opacity': 0 }),
        svgEl('stop', { offset: 0.14, 'stop-color': 'currentColor' }),
        svgEl('stop', { offset: 0.86, 'stop-color': 'currentColor' }),
        svgEl('stop', { offset: 1, 'stop-color': 'currentColor', 'stop-opacity': 0 }))),
    // Kalbin iki kolu ayrı hilaller: tepede ince, loblarda kalın. Uçları
    // oyukta üst üste biniyor (V gibi birleşiyor); sol kol sivri uca kadar
    // ≈ 4 birim kalınlıkta iniyor, eskiden nabzın altında kılcaldı.
    svgEl('path', { fill: 'currentColor', d: 'M210 48C196 30 181 23 163 24 140 25 123 42 124 62 125 88 148 113 199 172 174 128 132 101 134 64 134 46 147 33 163 33 180 33 196 40 207 54Z' }),
    svgEl('path', { fill: 'currentColor', d: 'M208 48C221 31 236 23 253 24 276 25 295 43 294 66 293 96 262 131 184 193 244 136 285 100 285 66 285 46 270 32 253 32 236 32 222 40 211 54Z' }),
    // Nabız, altında kâğıt renginde bir pay: kalbin çizgisini keserek geçiyor.
    svgEl('path', { d: NABIZ, fill: 'none', stroke: '#fff', 'stroke-width': 9, 'stroke-linejoin': 'round' }),
    svgEl('path', { d: NABIZ, fill: 'none', stroke: `url(#${solma})`, 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
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
  // Kâğıt stili. Varsayılan lacivert (paylasilan/antet.js); 'klasik'
  // hekimin hâlihazırda kullandığı basılı kâğıdın aynısı, eski sürüm onu
  // 'renkli' diye kaydediyordu. Lacivert kendi modülünde, kendi ağacıyla:
  // aşağıdaki ağaç üç eski stilin olduğu gibi kalıyor.
  const stilAdi = kagitStiliCoz(ayar);

  /** Alanı düzenleme ekranına tanıtır. Düzenlenebilir değilse öğeyi
   *  olduğu gibi bırakır: basılan kâğıtta hiçbir iz kalmaz. */
  // Adı olmayan alan (Age, No) dokunulabilir değil: işaretlenseydi
  // data-alan="null" alıyor, üstüne gelince çerçeve çıkıp hiçbir şey açmıyordu.
  const duz = (ad, oge) => {
    if (!duzenlenebilir || !oge || !ad) return oge;
    oge.setAttribute('data-alan', ad);
    oge.setAttribute('tabindex', '0');
    oge.setAttribute('role', 'button');
    oge.classList.add('kagit__duz');
    return oge;
  };
  /** Boş alanın yer tutucusu: düzenlerken görünür, basarken çizilmez.
   *  "+" ayrı ve kalın bir çizim, okuyucuya yalnız etiket düşüyor. */
  const yerTutucu = (ad, metin) => duzenlenebilir
    ? duz(ad, el('div', { class: 'kagit__duz-bos' },
      simge('arti', { boy: 12, sinif: 'kagit__duz-arti' }), el('span', {}, metin)))
    : null;
  const cizgi = (genislik) => el('span', { class: 'kagit__cizgi', style: genislik ? { inlineSize: genislik } : null }, '\u00a0');

  if (stilAdi === 'lacivert') return lacivertKagit({ recete, hasta, ayar, bos, boyut, duzenlenebilir, duz, yerTutucu, cizgi });

  const stilSinifi = stilAdi === 'klasik' ? '' : ` kagit--${stilAdi}`;
  const stil = el('style', {});
  // ℞ alanı sayfanın kalanını doldursun: boş kâğıtta yazmaya bol yer kalır.
  // A4'te 140 mm: tasarımdaki 155 mm'lik gövde A4'e sığmıyor (tasarımın
  // kâğıdı basılabilir alandan 10 mm uzun); kısalan yalnız bu esnek bölüm,
  // antet ve ayak tasarımdaki oranlarını koruyor.
  // --baski-boy: basılan modern kâğıdın en az boyu (yazdirma.css); A5'te yok.
  stil.textContent = `@page { size: ${boyut}; margin: ${boyut === 'A5' ? '6mm' : '8mm'}; }`
    + ` .kagit { --rx-boy: ${boyut === 'A5' ? '62mm' : '140mm'}; --baski-boy: ${boyut === 'A5' ? 'auto' : '270mm'}; }`;

  // "Healthy Life Brighter Tomorrow" el yazısı yüzüyle (Kalam) basılıyor.
  // window.print() eşzamanlı: yüz o an inmemişse satır yedek yazıyla
  // çıkar. Kâğıt çizilirken yükleme başlatılıyor, beklenmiyor; hekim
  // yazdır'a bastığında dosya çoktan gelmiş oluyor.
  if (stilAdi === 'modern') document.fonts?.load('700 10pt Kalam').catch(() => {});

  const yas = hasta ? hastaYasi(hasta) : null;

  /* Kâğıdın iki yanındaki sabit yazılar. Rozet etiketleri gibi `??` ile:
     ayarda hiç dokunulmamışsa basılı kâğıttakiler çıkıyor, hekim silmek
     isterse alanı boşaltması yetiyor (boş dize '' geçerli bir değer). */
  const slogan = ayar.slogan ?? t('kagit.slogan', 'سلامتی شما\nهدف ماست');
  const sloganAlt = ayar.sloganAlt ?? t('kagit.slogan_alt', 'Your Health, Our Priority');
  const cagriUst = ayar.cagriUst ?? t('kagit.cagri_ust', 'با ما');
  const cagriAlt = ayar.cagriAlt ?? t('kagit.cagri_alt', 'به سوی زندگی سالم‌تر');

  /* ---- Antet: sağda amblem, yanında doktorun adı, solda slogan ---- */
  // Antet ayarlardan geliyor. Hiç doldurulmamışsa kâğıt yarım kalıyordu:
  // süsler (slogan rozeti, amblemler) çıkıyor ama ad, ünvan şeridi, hizmetler
  // ve sabıka satırı yok — dalgaların altında boşluk. Hekime bunu söyleyen
  // hiçbir şey de yoktu. Düzenleme kipinde boş antet yer tutucu oluyor;
  // dokununca Ayarlar açılıyor, kâğıdın geri kalanıyla aynı mantık.
  const doktorAdi = [recete.doktorUnvan || ayar.doktorUnvan, recete.doktorAd || ayar.doktorAd].filter(doluMu).join(' ');
  const antet = el('header', { class: 'kagit__antet' },
    el('div', { class: 'kagit__ad-blok' },
      doluMu(doktorAdi)
        ? el('div', { class: 'kagit__doktor' }, doktorAdi)
        : (yerTutucu('antet', t('kagit.antet_bos', 'Antet bilgilerini gir')) || el('div', { class: 'kagit__doktor' }, '')),
      doluMu(ayar.doktorAdAlt) ? el('div', { class: 'kagit__doktor-alt' }, ayar.doktorAdAlt) : null),
    el('div', { class: 'kagit__amblem' }, amblemCiz()),
    // Slogan bloğu: basılı kâğıtta kontur kalp+EKG logosu, sağında iki
    // Farsça satır, altında Latin karşılığı.
    el('div', { class: 'kagit__slogan' },
      el('span', { class: 'kagit__slogan-daire' }, sloganAmblemi()),
      doluMu(slogan) ? el('div', {}, ...satirlara(slogan).map((x) => el('div', {}, x))) : null,
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
              el('span', { class: 'kagit__hizmet-daire' }, i % 2 ? ultrasonCizimi() : simge('nabiz', { dolu: true, boy: 26 })),
              el('span', {}, h))))
          : null,
        doluMu(ayar.hizmetAlanlari) ? el('div', { class: 'kagit__hizmet-alan' }, ayar.hizmetAlanlari) : null))
    : null;

  // «سابقه کاری :» başlığı kalın, gerisi normal: ayar tek bir metin, başlık
  // ilk iki noktaya kadar olan kısım. İki nokta yoksa metin olduğu gibi.
  const [deneyimBas, ...deneyimSon] = String(ayar.deneyim ?? '').split(':');
  const deneyim = doluMu(ayar.deneyim)
    ? el('div', { class: 'kagit__deneyim' },
      ...(deneyimSon.length ? [el('b', {}, deneyimBas + ':'), deneyimSon.join(':')] : [ayar.deneyim]))
    : null;

  /* ---- Kâğıda ait sabit satır ----
     Hekimin basılı reçetesinde bu satır var ve kalması istendi. Bilerek
     ayarlardan gelmiyor ve bilerek koşulsuz basılıyor: kâğıdın parçası,
     doldurulan bir alan değil. Boş kâğıtta da çıkar. */
  // Süslü çerçeve: basılı kâğıtta bu satır bir kartuş içinde, iki yanında
  // kalın birer "+" ile duruyor. Artılar süs: okuyucuya düşmüyor.
  const arti = () => el('span', { class: 'kagit__vecize-arti' }, simge('arti-kalin', { dolu: true, boy: 14 }));
  const vecize = el('div', { class: 'kagit__vecize' },
    el('span', { class: 'kagit__vecize-cerceve' },
      kartusCiz(), arti(),
      el('span', { class: 'kagit__vecize-metin' }, VECIZE),
      arti()));

  /* ---- Hasta şeridi: Name / Age / Date / No ---- */
  // Boş değer tire değil noktalı çizgi basılır: hekim yaşı ya da numarayı
  // çıktının üstüne kalemle yazabilsin. Dolu değer de aynı çizginin üstünde.
  const alan = (etiket, deger, genislik, simgeAdi, duzAd, rol) => duz(duzAd, el('span', { class: 'kagit__alan', 'data-rol': rol },
    simge(simgeAdi, { dolu: true, boy: 20, sinif: `kagit__alan-simge kagit__alan-simge--${simgeAdi}` }),
    el('b', {}, etiket + ':'),
    bos || !doluMu(deger) ? cizgi(genislik) : el('span', { class: 'kagit__alan-deger', dir: 'auto' }, deger)));

  // Şerit ve klinik sütun soldan sağa: etiketleri İngilizce ve basılı kâğıtta
  // da bu yönde. Sayfanın kalanı sağdan sola kalır.
  const serit = el('div', { class: 'kagit__serit', dir: 'ltr', 'data-rol': 'serit' },
    alan('Name', tamAd(hasta), '52mm', SERIT_SIMGELERI[0], 'hasta', 'hasta'),
    alan('Age', yas !== null ? String(yas) : '', '18mm', SERIT_SIMGELERI[1], null, 'yas'),
    alan('Date', bos ? '' : tarihMetni(recete.tarih), '30mm', SERIT_SIMGELERI[2], 'tarih', 'tarih'),
    alan('No', bos ? '' : recete.receteNo, '28mm', SERIT_SIMGELERI[3], null, 'no'));

  /* ---- Clinical sütunu: ölçümler, altta stetoskop ve QR ---- */
  // Her ölçüm tek satır: simge, etiket ve hemen yanında değer; altta
  // noktalı yazı çizgisi. Girilmemiş ölçüm tire değil çizgi basılır: doktor
  // çıktının üstüne kalemle yazabilsin.
  const olcumSatiri = (anahtar, etiket, deger, sinif = '') => duz(anahtar === 'kanGrubu' ? 'kanGrubu' : 'olcum:' + anahtar,
    el('div', {
      class: ('kagit__olcum ' + sinif).trim(),
      'data-rol': anahtar === 'kanGrubu' ? 'kan' : 'olcum',
      'data-olcum': anahtar === 'kanGrubu' ? null : anahtar,
    },
      el('span', { class: 'kagit__olcum-simge' },
        // Kutu boyu CSS'te, her simge için ayrı: viewBox'lardaki boşluk farklı.
        simge(OLCUM_SIMGELERI[anahtar], { dolu: true, sinif: 'kagit__olcum-cizim--' + anahtar })),
      el('b', {}, `${etiket} :`),
      doluMu(deger) ? el('span', { dir: 'ltr' }, deger) : cizgi()));
  const qr = qrCiz(qrIcerigi(ayar, recete, hasta, { bos }), { boy: 76, sinif: 'kagit__qr' });
  const sutun = el('aside', { class: 'kagit__klinik-sutun', dir: 'ltr' },
    el('div', { class: 'kagit__sutun-bas' },
      el('span', {}, t('kagit.klinik', 'Clinical')),
      simge('stetoskop', { boy: 24, dolu: true })),
    el('div', { class: 'kagit__olcumler', 'data-rol': 'olcumler' },
      // Birimin yalnız ilk parçası basılıyor: BP'nin birimi formda iki
      // kutuyu anlatan «mmHg / mmHg»; kâğıtta «120/80 mmHg» yazılır.
      // «Temperature :» en uzun etiket; değer yazılınca satır sıkışık
      // düzene geçiyor (bkz. yazdirma.css), yoksa değer alta kırılıyordu.
      ...OLCUMLER.map(([anahtar, , , birim]) => {
        const dolu = !bos && doluMu(recete.olcumler?.[anahtar]);
        return olcumSatiri(anahtar, KLINIK_ADLARI[anahtar],
          dolu ? `${recete.olcumler[anahtar]} ${birim.split(' / ')[0]}` : '',
          dolu && anahtar === 'temp' ? 'kagit__olcum--sikisik' : '');
      }),
      // Kan grubu ölçüm değil, hastanın künyesi — ama hekim onu da burada
      // arıyor. Ölçümlerle aynı satır düzeninde, en altta. Ayırt edici
      // sınıfı var: deneme ölçüm sayarken bunu saymasın.
      olcumSatiri('kanGrubu', 'Blood Gr.', bos ? '' : recete.kanGrubu, 'kagit__olcum--kan')),
    !bos && doluMu(recete.dogrulamaKodu)
      ? el('div', { class: 'kagit__kod', 'data-rol': 'kod' },
        el('span', { class: 'kagit__olcum-simge' }, simge('kilit', { boy: 15 })),
        el('b', {}, t('kagit.kod', 'کد تأیید') + ': '), el('span', { class: 'kagit__kod-deger', dir: 'ltr' }, recete.dogrulamaKodu))
      : null,
    // Resim sütunun tam genişliğinde; altında solda QR, sağında eğik el
    // yazısı. Yazı resmin içinde değil yanında bir kardeş: ızgarada QR'ın
    // karşısına oturuyor ve çizimin boş sağ alt köşesine uzanıyor
    // (tasarımdaki gibi, çizime binmeden).
    el('div', { class: 'kagit__sutun-ayak' },
      el('div', { class: 'kagit__sutun-resim' }, saglikResmi(ayar)),
      el('div', { class: 'kagit__sutun-yazi' },
        ...satirlara(t('kagit.saglik_sozu', 'Healthy\nLife\nBrighter\nTomorrow')).map((x) => el('div', {}, x))),
      el('div', { class: 'kagit__qr-kutu' }, qr,
        el('span', { class: 'kagit__qr-alt' }, t('kagit.qr_alt', 'Scan for Contact')))));

  /* ---- ℞ alanı ---- */
  const tani = !bos && (doluMu(recete.tani) || doluMu(recete.taniKodu))
    ? duz('tani', el('div', { class: 'kagit__tani', 'data-rol': 'tani' }, el('b', {}, t('recete.tani', 'Tanı') + ': '), [recete.tani, recete.taniKodu].filter(doluMu).join(' · ')))
    : (bos ? null : yerTutucu('tani', t('recete.tani', 'Tanı')));

  const alerjiler = hasta?.alerjiler || [];
  const alerji = !bos && alerjiler.length
    ? el('div', { class: 'kagit__alerji', 'data-rol': 'alerji' }, el('b', {}, t('hasta.alerji', 'Alerji') + ': '), alerjiler.join(', '))
    : null;

  // İlaç satırı hekimin ve eczacının alışık olduğu biçimde:
  // "1- Cap: Amoxicillin 500 mg" … "N=12". Numarayı <ol> veriyor.
  // Şekli bilinmeyen (eski) satırda önek basılmaz, ad tek başına kalır.
  const ilacGovdesi = bos
    ? null
    // Liste soldan sağa: sıra numarası adın SOLUNDA dursun ("1. Tab: …").
    // RTL'de numara sağa geçiyor ve ".1" diye ters basılıyordu.
    : el('ol', { class: 'kagit__ilaclar', dir: 'ltr', 'data-rol': 'ilaclar' }, ...(recete.satirlar || []).map((s, i) => {
      const kisa = formKisa(s.form);
      const { kullanim } = ilacSatiri(s);
      return duz('ilac:' + i, el('li', { 'data-rol': 'ilac' },
        el('div', { class: 'kagit__ilac-ad', dir: 'ltr' },
          kisa ? el('span', { class: 'kagit__form' }, kisa + ':') : null,
          el('b', {}, ilacAdiFormsuz(s.ilacAdi, s.form)),
          el('span', { class: 'kagit__adet' }, `N=${s.adet}`)),
        // Kullanım satırı Farsça: yönünü içeriğinden alsın, liste LTR olsa da.
        // Yemek zamanı (zaman) kullanımın hemen ardında, lacivertteki sırayla.
        kullanim.length ? el('div', { class: 'kagit__kullanim', dir: 'auto' }, kullanim.join(' · ')) : null));
    }));

  // Hastanın anlattıkları tanının üstünde: kâğıt muayenenin sırasını izlesin.
  const belirtiler = !bos && doluMu(recete.belirtiler)
    ? duz('belirtiler', el('div', { class: 'kagit__belirti', 'data-rol': 'belirtiler' }, el('b', {}, t('kagit.belirtiler', 'Belirtiler') + ': '), recete.belirtiler))
    : (bos ? null : yerTutucu('belirtiler', t('kagit.belirtiler', 'Belirtiler')));

  // Tetkik istemi ilaçlardan sonra, kendi bloğunda: gerçek reçetede de
  // ayrı bir istem, ilaç listesinin parçası değil.
  const laboratuvar = !bos && doluMu(recete.laboratuvar)
    ? duz('laboratuvar', el('div', { class: 'kagit__lab', 'data-rol': 'lab' },
      el('div', { class: 'kagit__lab-bas' }, t('kagit.laboratuvar', 'Laboratuvar')),
      el('div', {}, recete.laboratuvar)))
    : (bos ? null : yerTutucu('laboratuvar', t('kagit.laboratuvar', 'Laboratuvar')));

  // İmza yeri: gerçek reçetede hekimin imzası olur. Dolu kâğıtta da boş
  // kâğıtta da basılıyor — imza her hâlükârda elle atılıyor.
  const imza = el('div', { class: 'kagit__imza', 'data-rol': 'imza' },
    el('span', { class: 'kagit__imza-cizgi' }, ' '),
    el('span', { class: 'kagit__imza-etiket' }, t('kagit.imza', 'امضا')));

  // Hat yazısı imzanın KARŞI köşesinde, ikisi ℞ alanının dibinde aynı
  // satırda (bkz. yazdirma.css .kagit__rx-alt). Nestalik çizim (SVG): metin
  // <title>'da, okuyucu ve arama onu buluyor.
  const hat = el('div', { class: 'kagit__hat' }, hatCizimi({ sinif: 'kagit__hat-cizim' }));

  const rx = el('section', { class: 'kagit__rx' },
    filigran(),
    // Rx çizimi; yanında görünmeyen «℞» metni (okuyucu ve arama için).
    rxIsareti({ sinif: 'kagit__rx-isaret' }),
    el('div', { class: 'kagit__rx-govde' }, belirtiler, tani, alerji, ilacGovdesi,
      bos ? null : yerTutucu('ilac-ekle', t('recete.ilac_ekle', 'İlaç ekle')),
      laboratuvar,
      !bos && doluMu(recete.notlar)
        ? duz('notlar', el('div', { class: 'kagit__not', 'data-rol': 'not' }, recete.notlar))
        : (bos ? null : yerTutucu('notlar', t('recete.not', 'Reçete notu')))),
    el('div', { class: 'kagit__rx-alt' }, hat, imza));

  /* ---- Ayak: rozetler ve iletişim ---- */
  const rozetler = String(ayar.ayakEtiketleri ?? t('kagit.ayak_etiketleri', 'قلب, شش, معده, گرده, شکر, روماتیزم, سردرد'))
    .split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8);
  // Basılı kâğıtta hekimin ilgilendiği alanlar rozet olarak diziliyor.
  // Sıra ayardaki etiket sırasını izliyor (varsayılan: قلب, شش, معده, گرده,
  // شکر, روماتیزم, سردرد); sekizinciye ve fazlasına düz kalp düşüyor.
  // Halkanın içinde beyaz, dolgulu simgeler (simge.js SIMGELER_DOLU).
  const ROZET_SIMGE = ['tani', 'akciger', 'mide', 'bobrek', 'sise', 'romatizma', 'bas-agrisi', 'kalp'];
  // Basılı kâğıtta iki numara var (doktor ve klinik). İkincisi boşsa
  // basılmıyor; etiketler ayarlardan, boşsa tek ortak etiket kullanılıyor.
  const etiketler = String(ayar.telefonEtiket ?? '').split(',').map((x) => x.trim());
  const numaralar = [ayar.telefon, ayar.telefon2].map((x, i) => ({ no: x, etiket: etiketler[i] }))
    .filter((x) => doluMu(x.no));
  // Etiket ve numara aynı metinde, adres satırı gibi: iki noktanın iki
  // yanında birer boşluk. Numara ayrı bir öğeyken satırın flex boşluğu da
  // araya ekleniyor ve numara iki noktadan üç kat uzak duruyordu.
  const telefonSatirlari = numaralar.map(({ no, etiket }) =>
    el('div', { class: 'kagit__iletisim-satir' },
      simge('telefon', { boy: 16, dolu: true }),
      el('span', {}, `${doluMu(etiket) ? etiket : t('kagit.tel', 'شماره تماس')} : `, el('bdi', { dir: 'ltr' }, no))));

  const ayak = el('footer', { class: 'kagit__ayak', 'data-rol': 'ayak' },
    dalga('alt'),
    el('div', { class: 'kagit__iletisim' },
      doluMu(ayar.adres) ? el('div', { class: 'kagit__iletisim-satir' }, simge('konum', { boy: 16, dolu: true }), el('span', {}, `${t('kagit.adres', 'آدرس')} : ${ayar.adres}`)) : null,
      ...telefonSatirlari),
    rozetler.length
      ? el('div', { class: 'kagit__rozetler', dir: 'ltr' }, ...rozetler.map((etiket, i) => {
        const ad = ROZET_SIMGE[i] || 'kalp';
        return el('div', { class: 'kagit__rozet' },
          el('span', { class: 'kagit__rozet-daire' }, simge(ad, { boy: 20, dolu: true, sinif: 'kagit__rozet-simge--' + ad })),
          el('span', {}, etiket));
      }))
      : null);

  // Tek bant, tam genişlik: kurdeleler kâğıdın bir ucundan ötekine akıyor.
  // Eskiden iki köşe parçasıydı (biri CSS'te aynalanan), o düzen kurdele
  // değil iki ayrı leke gibi duruyordu.
  /* Antet, ihtisas rozeti ve hizmetler TEK bandın içinde: dalga da o banda
     ait. Önce dalga kâğıdın tepesinde serbest duruyor ve yalnız üst şeridi
     koyultuyordu; ad, rozet ve hizmetler altında beyaz zeminde kalıyordu.
     Sarmalayıcı yalnız EKLENDİ, içindekilerin sırası değişmedi — klasik ve
     sade stiller aynı ağacı giymeye devam ediyor. */
  const tepe = el('div', { class: 'kagit__tepe', 'data-rol': 'antet' }, dalga('ust'), antet, unvan, hizmet);

  // Dokuz ve daha çok ilaçta sık düzen (yazdirma.css .kagit--sik): her ilaç
  // bir satır daha az tutuyor. Yoksa on ilaçlı kâğıt A4'e sığmıyor, ayak
  // ikinci sayfaya bölünüyordu.
  const sik = !bos && (recete.satirlar?.length || 0) >= 9 ? ' kagit--sik' : '';
  return el('div', { class: `yazdir-alan kagit${stilSinifi}${sik}`, 'data-rol': 'sayfa' }, stil,
    tepe, deneyim, vecize, serit,
    el('div', { class: 'kagit__govde' }, rx, sutun),
    ayak);
}

/** Ekrandaki kâğıt A4'ün BASILABİLİR alanı genişliğinde: 194 mm (210 mm
 *  eksi iki yanda 8 mm @page payı, 96 dpi). Önceden 210 mm'ydi ve yazılar
 *  ekranda baskıdakinden farklı yerde kırılıyordu; şimdi önizleme neyse
 *  çıktı o. Kâğıt kabına göre ölçeklenir. */
export const KAGIT_PX = 733;

/** Tuval → onu ölçekleyen gözcüyü bırakan fonksiyon. */
const oncekiGozcu = new WeakMap();

/**
 * Ekrandaki kâğıdı kabına sığdırır ve kap yeniden boyutlandıkça korur.
 * `gozlenen` genelde sayfa kökü: kenar çubuğu açılıp kapanınca da ölçüm
 * yenilensin. `pay`: kâğıdın iki yanında toplam bırakılan boşluk (px).
 * Reçete yazma sayfasında 0: kâğıt kendi sütununu tam dolduruyor.
 * `yukseklik`: verilirse kâğıdın sığması gereken boyu (px) döndüren
 * fonksiyon; kâğıt o zaman boyuna da sığacak kadar küçülüyor (önizleme
 * kutusunda ve reçete sayfasının yapışkan sütununda sayfanın tamamı
 * kaydırmadan görünsün diye). Pencerenin yalnız boyu değişince gözlenen
 * kutuların hiçbiri büyümeyebiliyor: ölçüm pencerenin `resize`ında da yenileniyor.
 */
export function kagidiOlcekle(tuval, kagit, gozlenen = null, { pay = 8, yukseklik = null } = {}) {
  // Aynı tuvale yeni kâğıt konunca eski gözcü bırakılıyor: bırakılmazsa
  // ayrılmış kâğıdın boyunu (0) tuvale yazmaya devam ediyordu. Çağıran
  // dönen fonksiyonu tutmasa da sızıntı olmasın diye burada.
  oncekiGozcu.get(tuval)?.();
  const uygula = () => {
    if (!tuval.isConnected) return;
    const enine = (tuval.clientWidth - pay) / KAGIT_PX;
    // 1 px pay: tuvalin boyu aşağıda yukarı yuvarlanıyor, küsuratlı bir
    // boyda kâğıt 1 px taşıp kaydırma çubuğu açıyordu.
    // Birden çok yapraklı (lacivert, devam sayfalı) kâğıtta boya YAPRAK
    // sığdırılıyor, yığın değil: üst üste dizilmiş yapraklar boya sığdırılsa
    // okunmayacak kadar küçülürdü. O seyrek durumda tuval kendi içinde
    // kayıyor (data-cok-yaprak) ve ekrandan taşmıyor: yapışkan önizleme ve
    // başlığındaki yazdır düğmesi yerinde kalıyor.
    const yapraklar = kagit.querySelectorAll('[data-rol="sayfa"]');
    const yaprakBoyu = yapraklar.length > 1 ? yapraklar[0].offsetHeight : kagit.offsetHeight;
    const sigacak = yukseklik ? yukseklik() - 1 : Infinity;
    const boyuna = yaprakBoyu ? sigacak / yaprakBoyu : Infinity;
    const olcek = Math.min(1, Math.max(0.2, Math.min(enine, boyuna)));
    tuval.style.setProperty('--olcek', String(olcek));
    tuval.toggleAttribute('data-cok-yaprak', yapraklar.length > 1);
    // Ölçek yerleşimi değiştirmiyor: kayan tuvalin içi ölçeklenmemiş boyda
    // kalır, altında boş bir kaydırma payı açılırdı. Eksi alt pay onu kapatıyor.
    kagit.style.marginBlockEnd = yapraklar.length > 1 ? `${(olcek - 1) * kagit.offsetHeight}px` : '';
    // Ölçeklenen öğe yerinde yer kaplamıyor; boyu elle veriliyor.
    tuval.style.blockSize = Math.ceil(Math.min(kagit.offsetHeight * olcek, yapraklar.length > 1 ? sigacak : Infinity)) + 'px';
  };
  // İlk ölçüm yerleşimden SONRA: hemen ölçünce kap daha dar geliyor.
  requestAnimationFrame(uygula);
  // TUVALİN KENDİSİ İZLENMİYOR: boyunu burada değiştiriyoruz, izleseydik
  // kendi kendini tetikleyen bir döngü olurdu.
  const gozcu = new ResizeObserver(uygula);
  if (gozlenen) gozcu.observe(gozlenen);
  gozcu.observe(kagit);
  if (yukseklik) addEventListener('resize', uygula);
  const birak = () => {
    gozcu.disconnect();
    removeEventListener('resize', uygula);
    if (oncekiGozcu.get(tuval) === birak) oncekiGozcu.delete(tuval);
  };
  oncekiGozcu.set(tuval, birak);
  return birak;
}

/**
 * Tarayıcının KENDİ yazdırması (Ctrl+P, menüden «Yazdır») için. Reçete
 * yazma ve boş kâğıt sayfalarında kâğıt #sayfa'nın doğrudan çocuğu değil,
 * önizleme tuvalinin içinde; yazdırma kuralı onu saran bölümle birlikte
 * gizliyordu ve Ctrl+P bembeyaz bir sayfa basıyordu. Yazdırma başlarken
 * sayfada doğrudan bir kâğıt yoksa `uret()`in çizdiği kâğıt ekleniyor,
 * bitince kaldırılıyor. Uygulamanın kendi düğmeleri (kagidiYazdir) kâğıdı
 * zaten ekliyor; o zaman burası bir şey yapmıyor.
 * @param {() => HTMLElement} uret  Basılacak kâğıdı o anki hâliyle çizer.
 * @returns {() => void} Dinleyicileri bırakır (sayfadan çıkarken).
 */
export function tarayiciBaskisi(uret) {
  let eklenen = null;
  const once = () => {
    const sayfa = document.getElementById('sayfa');
    if (!sayfa || sayfa.querySelector(':scope > .yazdir-alan')) return;
    eklenen = uret();
    sayfa.appendChild(eklenen);
  };
  const sonra = () => { eklenen?.remove(); eklenen = null; };
  addEventListener('beforeprint', once);
  addEventListener('afterprint', sonra);
  return () => {
    sonra();
    removeEventListener('beforeprint', once);
    removeEventListener('afterprint', sonra);
  };
}

/* Yazdırmadan önce yazı yüzünün inmesi için beklenecek en uzun süre (ms).
   Lacivert kâğıdın Latin adı ve mühür yazısı Cinzel'le basılıyor;
   window.print() o an inmemiş bir yüzü beklemiyor, satır yedek yazıyla
   çıkıyordu. Çevrimdışı ve önbellekte yoksa sonsuza dek beklenmesin. */
const YUZ_BEKLEME = 800;

/** Kaydedilen PDF'in önerilen adı: Chrome ve Edge belge başlığını
 *  kullanıyor. Harf, rakam ve tire dışı her şey atılıyor, 60 harfle sınırlı. */
export function belgeAdi(recete = {}, hasta = null) {
  const parca = (x) => String(x ?? '').replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return ['nuskha', parca(recete.receteNo), parca(tamAd(hasta))].filter(Boolean).join('-').slice(0, 60).replace(/-$/, '');
}

/**
 * Kâğıdı yazdırır. Sayfada duran kâğıt geçici olarak değiştirilir, yazdırma
 * bitince eski hale döner — böylece boş kâğıt da aynı düzenle basılır.
 * `pdf`: «ذخیره PDF» düğmesi. Tarayıcı «PDF olarak kaydet»i kendisi
 * seçtiremiyor; belge başlığı yazdırma boyunca dosya adı olacak biçime
 * getiriliyor (Chrome kaydedilen dosyaya bu adı öneriyor), sonra geri alınıyor.
 */
export async function kagidiYazdir({ tekrar = 1, pdf = false, ...secenekler } = {}) {
  const sayfa = document.getElementById('sayfa');
  const n = Math.max(1, Math.min(20, Math.trunc(Number(tekrar)) || 1));
  if (kagitStiliCoz(secenekler.ayar) === 'lacivert' && document.fonts) {
    await Promise.race([document.fonts.load('700 10pt Cinzel').catch(() => {}), new Promise((r) => setTimeout(r, YUZ_BEKLEME))]);
  }
  /* Yalnız #sayfa'nın DOĞRUDAN çocuğu olan kâğıt yerinde değiştirilir
     (reçete kaydı sayfası böyle). Tuvalin içindeki önizleme kâğıdı yerinde
     DEĞİŞTİRİLEMEZ: yazdırma kuralı kâğıttan başka her doğrudan çocuğu
     gizliyor, önizlemeyi saran kart da gidiyor ve çıktı bembeyaz iniyordu.
     Orada kâğıt #sayfa'ya ekleniyor, basıldıktan sonra kaldırılıyor. */
  const eski = n === 1 ? [...sayfa.children].find((c) => c.classList.contains('yazdir-alan')) : null;
  const kagitlar = Array.from({ length: n }, () => kagitCiz(secenekler));
  // Her kopya kendi sayfasına düşer; sonuncudan sonra boş sayfa çıkmasın.
  for (const k of kagitlar.slice(0, -1)) k.classList.add('yazdir-alan--kopya');
  if (eski) eski.replaceWith(kagitlar[0]);
  else for (const k of kagitlar) sayfa.appendChild(k);
  const baslik = document.title;
  if (pdf) document.title = belgeAdi(secenekler.recete, secenekler.hasta);
  try {
    window.print();
  } finally {
    document.title = baslik;
    if (eski) kagitlar[0].replaceWith(eski);
    else for (const k of kagitlar) k.remove();
  }
}
