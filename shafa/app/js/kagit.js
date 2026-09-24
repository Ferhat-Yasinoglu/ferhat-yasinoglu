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
import { simge } from './cekirdek/simge.js';
import { t } from './i18n.js';
import { tamAd, hastaYasi } from './paylasilan/hasta.js';
import { OLCUMLER } from './paylasilan/recete.js';
import { formKisa, ilacAdiFormsuz } from './paylasilan/ilac.js';
import { ozetMetni, kodSatiri } from './paylasilan/dogrulama.js';
import { tarihMetni } from './paylasilan/tarih.js';
import { telefonNormalize } from './paylasilan/metin.js';

/** Antet amblemi: kanatlı kadüse — hekimin basılı kâğıdındaki amblem.
 *
 *  Not: tıbbın doğru sembolü tek yılanlı Asklepios asasıdır; kanatlı iki
 *  yılanlı kadüse aslında ticaretin sembolü ve tıpta yaygın bir karışıklık.
 *  Burada yine de kadüse çiziliyor çünkü bu kâğıt hekimin kendi antedi ve
 *  onun basılı reçetesinde bu amblem var — kâğıdın kimliği, bizim tercihimiz
 *  değil. Asklepios çizimi denendi ve "bizimki bu değil" diye geri alındı.
 *
 *  viewBox tasarımdaki çizimin piksel kutusu (69×83): kanat uçları hafif
 *  yukarı kalkık, iki yılan asanın etrafında aşağı doğru daralan beş
 *  halkayla sarılıp sivri bir kuyrukta bitiyor, başları dışa kıvrık.
 *  Eski çizimde üç kalın halka vardı ve 17 mm'de "yılan" okunmuyordu.
 *  Tüy araları beyaz çizgi: kâğıt her zaman beyaz, oyuk gibi okunuyor. */
function amblemCiz() {
  const yilan = (d) => svgEl('path', {
    d, fill: 'none', stroke: 'currentColor', 'stroke-width': 3.2, 'stroke-linecap': 'round',
  });
  return svgEl('svg', { class: 'kagit__amblem-cizim', viewBox: '0 0 69 83', 'aria-hidden': 'true' },
    svgEl('g', { fill: 'currentColor' },
      // Asa, tepesinde topuz; alt ucu sivri
      svgEl('circle', { cx: 34.5, cy: 3.8, r: 3.6 }),
      svgEl('path', { d: 'M33 6.5h3v71.5l-1.5 4.5-1.5-4.5z' }),
      // Kanatlar: üst kenar yukarı kalkıyor, alt kenar üç tüy katmanı
      svgEl('path', { d: 'M33 9.5C27 5 12 3 .5 7.5 4.5 11 8.5 12.5 12.5 13 11.5 14.5 15 16.5 21.5 17 20.5 18.5 25 20.5 33 21.5z' }),
      svgEl('path', { d: 'M36 9.5C42 5 57 3 68.5 7.5 64.5 11 60.5 12.5 56.5 13 57.5 14.5 54 16.5 47.5 17 48.5 18.5 44 20.5 36 21.5z' })),
    svgEl('path', {
      d: 'M6 9.6C14 8.8 22 10.2 30 13.6M15 13.9C20 14.2 25 15.4 30 17.6M63 9.6C55 8.8 47 10.2 39 13.6M54 13.9C49 14.2 44 15.4 39 17.6',
      fill: 'none', stroke: '#fff', 'stroke-width': 0.7, 'stroke-linecap': 'round',
    }),
    // İki yılan x=34.5 ekseninde birbirinin aynası
    yilan('M27.5 31.2C24 32.5 21 29.5 22.5 26.5 24 23.8 29.5 24 34.5 33 40.8 33.6 46 35 46 38.8S40.8 43.9 34.5 44.5C29.3 45 25 46.3 25 49.5S29.3 54 34.5 54.5C38.2 54.9 41.3 55.9 41.3 58.5S38.2 62.1 34.5 62.5C31.6 62.9 29.3 63.7 29.3 66S31.6 69.2 34.5 69.5C36.7 69.8 38.5 70.6 38.5 72.5S36.7 75.2 34.5 75.5C31.5 77.5 32.7 79 34.5 81'),
    yilan('M41.5 31.2C45 32.5 48 29.5 46.5 26.5 45 23.8 39.5 24 34.5 33 28.2 33.6 23 35 23 38.8S28.2 43.9 34.5 44.5C39.7 45 44 46.3 44 49.5S39.7 54 34.5 54.5C30.8 54.9 27.7 55.9 27.7 58.5S30.8 62.1 34.5 62.5C37.4 62.9 39.7 63.7 39.7 66S37.4 69.2 34.5 69.5C32.3 69.8 30.5 70.6 30.5 72.5S32.3 75.2 34.5 75.5C37.5 77.5 36.3 79 34.5 81'));
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

/** Slogan bloğundaki logo: içinden kalp atışı geçen KONTUR kalp. Atış
 *  çizgisi kalbin sağ kenarındaki boşluktan dışarı çıkıyor — tasarımda da
 *  öyle. Önce dolu bir dairenin içinde beyaz kalpti; basılı kâğıttaki
 *  logo bu değil. viewBox tasarımdaki çizimin piksel kutusu (60×55). */
function sloganAmblemi() {
  return svgEl('svg', { class: 'kagit__slogan-cizim', viewBox: '0 0 60 55', fill: 'none', stroke: 'currentColor', 'aria-hidden': 'true' },
    svgEl('path', {
      d: 'M56.6 30.8C50.5 39.5 41 46.5 30 52.6 16.5 45 3.2 34.5 3 19.2 2.8 9.4 10 2.8 17.5 2.8c5.6 0 10 3 12.5 7.6C32.5 5.8 36.9 2.8 42.5 2.8 50 2.8 57.2 9.4 57 19.2c0 1.8-.3 3.5-.7 5',
      'stroke-width': 3.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }),
    svgEl('path', {
      d: 'M11.5 27.3h9.4l1.9-6.2 3.4 13.4 5.6-21.2 3.6 26.8 3.1-14.8 2.2 2h19',
      'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }));
}

/** Antetin sağında, kadüsenin altındaki ikinci amblem: kontur bir kalbin
 *  içinde kollarını açmış TEK bir insan. Tasarımdaki figür artıyla
 *  kaynaşmış bir insan (üretim hatası); aynı silueti temiz bir anlamla
 *  veriyor. Eskiden dolu kalpte üç beyaz figürdü.
 *  Figür ayrı parçalar (baş, omuz, iki kol, gövde): deneme amblemin
 *  gerçekten çizildiğini parça sayısından anlıyor. */
function aileAmblemi() {
  return svgEl('svg', { class: 'kagit__aile-cizim', viewBox: '0 0 100 100', fill: 'currentColor', 'aria-hidden': 'true' },
    svgEl('path', {
      d: 'M50 93C22 74 5.5 56 5.5 34.5 5.5 18.5 16.5 7.5 30 7.5c9 0 16 5 20 12.5 4-7.5 11-12.5 20-12.5 13.5 0 24.5 11 24.5 27 0 21.5-16.5 39.5-44.5 58.5z',
      fill: 'none', stroke: 'currentColor', 'stroke-width': 9, 'stroke-linejoin': 'round',
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

function saglikCizimi() {
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

/* Hasta şeridindeki alanların dolgulu simgeleri, şeritteki sırayla: Name
   kişi, Age kum saati (tasarımdaki açık kitap yaşla ilgisiz bir üretim
   hatası), Date dolu belge, No kontur belge. */
const SERIT_SIMGELERI = ['hasta', 'kum-saati', 'recete', 'belge'];

/* Antet dalgasının katmanları: [renk, yol]. Birim tasarımdaki kâğıdın
   pikseli (609×193); en alttaki en soluk katman. Yollar tasarımın
   parlaklık eşiklerinden izlendi (242 → 90), delikler evenodd. */
const ANTET_DALGASI = [
  ['#d7f3f9', 'M-8 96Q-8 -8 216 -8Q440 -8 438 -2Q436 3 386 3Q334 3 324 6Q314 10 294 20Q274 30 265 30Q256 30 252 32Q248 33 242 33Q238 33 236 34Q235 34 233 46Q231 58 229 60Q226 63 216 70Q206 77 203 76Q200 74 184 85Q167 96 169 97Q170 98 178 96Q186 94 184 98Q180 102 176 105Q170 108 164 110Q158 111 150 112Q140 113 120 112Q100 112 98 119Q97 126 94 127Q90 128 92 138Q94 146 89 154Q84 161 76 162Q68 163 66 162Q64 162 60 159Q56 156 55 156Q54 157 32 172Q10 186 9 188Q8 190 10 190Q12 191 16 190Q20 189 34 194Q48 200 20 200Q-8 200 -8 96ZM64 8Q60 7 59 10Q58 12 48 14Q38 16 31 20Q24 24 23 28Q22 30 24 33Q26 36 20 38Q13 40 14 44Q14 48 20 50Q26 54 24 58Q21 64 24 66Q28 69 31 69Q34 68 34 72Q33 76 34 77Q36 79 38 80Q40 81 45 80Q50 79 52 82Q54 85 62 84Q70 83 74 80Q76 77 82 74Q88 71 96 72Q104 72 106 70Q107 68 106 62Q105 56 109 56Q114 57 116 55Q118 54 118 51Q117 48 114 44Q110 40 116 42Q122 44 125 41Q127 38 118 33Q110 27 88 18Q68 8 64 8ZM100 42Q102 41 103 47Q104 53 100 51Q97 50 97 46Q97 44 100 42ZM85 112Q76 112 71 113Q66 114 54 119Q44 124 34 132Q25 140 20 148Q14 156 21 149Q28 143 36 138Q44 134 51 132Q58 131 64 126Q72 121 82 118Q92 114 93 113Q94 112 85 112Z'],
  ['#bae8f1', 'M10 -3Q10 -8 172 -8Q333 -8 315 3Q298 14 284 21Q270 28 264 28Q258 27 252 30Q246 32 242 32Q236 32 233 39Q230 46 219 56Q208 66 191 78Q174 90 160 96Q144 103 143 104Q142 106 144 107Q146 109 132 110Q118 111 91 110Q64 110 50 114Q36 117 34 119Q32 120 34 122Q37 124 30 130Q24 136 8 153Q-8 169 -8 118Q-8 66 -1 66Q6 67 10 72Q14 78 21 83Q28 88 40 91Q52 94 64 94Q76 94 99 88Q122 82 124 78Q128 73 134 71Q140 69 146 64Q151 60 151 50Q151 40 148 37Q144 34 133 30Q122 26 112 24Q104 23 80 12Q58 1 35 2Q12 4 11 3Q10 2 10 -3ZM46 138Q50 136 51 136Q52 136 51 139Q50 141 46 142Q44 142 40 146Q36 149 34 149Q31 148 33 146Q34 144 39 142Q44 141 46 138Z'],
  ['#8dd7e3', 'M70 0Q64 -8 194 -8Q324 -8 316 0Q308 8 298 10Q288 12 268 21Q250 30 242 31Q234 32 233 38Q231 44 218 55Q206 66 190 77Q176 88 164 94Q154 99 135 104Q116 109 88 109Q60 109 46 112Q34 115 26 119Q18 123 13 129Q7 136 7 137Q8 138 11 138Q14 139 15 141Q16 142 10 150Q4 158 -2 148Q-8 138 -8 112Q-8 84 -3 83Q2 82 8 82Q12 83 18 88Q24 93 56 95Q86 97 93 94Q100 92 115 90Q130 87 134 83Q138 79 146 75Q152 71 158 65Q163 60 164 52Q165 44 164 41Q163 38 160 37Q158 35 148 32Q138 30 132 26Q124 21 113 20Q102 20 89 14Q76 9 70 0Z'],
  ['#62c5d3', 'M98 -2Q98 -8 207 -8Q317 -8 316 -2Q314 3 297 8Q280 13 264 22Q248 30 241 30Q234 31 233 36Q232 40 217 54Q202 67 191 76Q180 84 168 90Q158 96 139 102Q120 107 90 108Q60 108 49 110Q38 112 30 116Q22 119 14 127Q4 135 -2 136Q-8 136 -8 119Q-8 102 -3 96Q2 90 3 88Q4 87 8 88Q10 88 14 92Q16 96 28 96Q40 95 58 97Q76 99 88 98Q102 98 118 95Q134 92 138 88Q144 83 153 80Q162 76 166 72Q170 68 172 60Q175 52 175 47Q175 42 173 36Q170 31 168 30Q166 29 161 30Q156 31 147 29Q138 27 134 24Q130 20 116 14Q102 7 100 5Q98 4 98 -2ZM218 30Q218 29 210 36Q202 44 209 38Q216 33 218 32Q219 30 218 30Z'],
  ['#21a8b7', 'M102 -1Q100 -8 205 -8Q310 -8 294 2Q278 12 263 20Q248 29 240 30Q234 30 232 36Q230 42 218 52Q206 62 196 70Q184 79 172 86Q158 94 138 100Q118 106 88 106Q58 107 48 109Q38 111 30 115Q20 119 12 126Q4 133 -2 134Q-8 134 -8 120Q-8 106 -1 103Q6 100 16 98Q26 97 64 98Q102 100 120 97Q138 94 142 91Q146 88 152 87Q156 86 162 83Q168 80 193 57Q218 34 228 26Q238 19 247 15Q255 10 251 10Q248 10 236 15Q226 20 208 34Q190 49 188 43Q187 38 183 33Q180 28 160 26Q140 25 122 16Q104 6 102 -1Z'],
  ['#028496', 'M104 -2Q104 -8 186 -8Q270 -8 270 -2Q270 5 281 3Q292 1 295 2Q299 2 287 7Q276 12 260 20Q244 29 239 29Q234 29 232 31Q230 34 230 36Q230 40 228 41Q226 43 214 54Q200 64 196 66Q192 67 193 65Q193 62 198 56Q204 50 213 41Q222 32 244 19Q266 6 258 6Q252 7 244 10Q238 12 230 16Q222 20 213 28Q204 35 202 35Q200 35 197 32Q194 30 194 27Q194 25 178 25Q164 25 151 24Q138 22 123 14Q108 6 106 5Q104 4 104 -2ZM130 99Q132 98 134 98Q136 99 126 102Q114 105 80 106Q46 108 34 112Q22 117 12 124Q4 132 -2 131Q-8 130 -4 119Q1 108 6 104Q12 101 34 100Q56 99 76 100Q96 102 112 101Q128 100 130 99Z'],
  ['#026479', 'M109 3Q110 2 144 3Q180 4 182 4Q184 5 185 7Q186 8 184 10Q182 12 181 17Q180 21 171 22Q162 22 150 20Q138 19 124 12Q110 6 109 5Q108 4 109 3ZM236 4Q250 2 254 2Q258 2 258 3Q258 4 242 10Q226 15 224 14Q221 12 222 9Q222 5 236 4ZM274 6Q284 4 287 4Q290 4 290 5Q290 6 274 12Q258 19 252 23Q246 27 240 27Q234 26 237 24Q240 21 253 15Q266 9 274 6ZM223 35Q228 31 228 35Q228 38 224 41Q220 43 220 41Q219 38 223 35ZM42 104Q50 102 70 102Q92 103 91 104Q90 105 76 104Q62 104 50 106Q40 108 30 112Q20 117 12 123Q6 129 4 129Q2 128 2 121Q2 114 4 109Q6 105 10 104Q14 103 24 104Q36 105 42 104Z'],
];
/** Bulanıklaştırılan (en açık) katman sayısı. */
const YUMUSAK_KATMAN = 4;
let dalgaSayaci = 0;

/** Köşe süsü ve ayak bandı için akan dalga çizimleri.
 *
 *  CSS zemini değil SVG ÖĞESİ: zemin dolguları yazdırmada tarayıcının
 *  "arka plan grafikleri" seçeneğine bağlı, SVG içeriği ise her zaman basılır.
 *  (print-color-adjust yine de duruyor, bu ikinci emniyet.) */
function dalga(yer) {
  if (yer === 'ust') {
    // Tasarımda dalgalar antedin yalnız SOL yarısında (≈ %54): koyu petrol
    // bir S-kurdele, tepeden sarkan koyu bir çanak ve üstlerinde açık
    // turkuaz katmanlar; sağ yarı beyaz. Önceki çizimde soluk kurdeleler
    // bütün genişliği kaplıyordu ve koyu kütle hiç yoktu — tasarımla en
    // büyük fark buydu. Katmanlar tasarımın parlaklık eşiklerinden izlendi
    // (en açıktan en koyuya, her biri bir öncekinin üstüne çiziliyor).
    // Açık katmanlar tasarımda yumuşak geçişli; keskin kenarla basamak
    // basamak (poster gibi) duruyordu. Onlar hafifçe bulanıklaştırılıyor,
    // koyu kurdele ve çanak keskin kalıyor. Filtre kimliği her kâğıtta
    // tekil: sayfada birden çok kâğıt olabiliyor (önizleme, yazdırma kopyası).
    const kimlik = 'kagit-dalga-' + (++dalgaSayaci);
    return svgEl('svg', {
      class: 'kagit__dalga kagit__dalga--ust', viewBox: '0 0 609 193',
      preserveAspectRatio: 'none', 'aria-hidden': 'true',
    },
    svgEl('filter', { id: kimlik, x: '-5%', y: '-5%', width: '110%', height: '110%' },
      svgEl('feGaussianBlur', { stdDeviation: 1.6 })),
    ...ANTET_DALGASI.map(([renk, d], i) => svgEl('path', {
      d, fill: renk, 'fill-rule': 'evenodd', filter: i < YUMUSAK_KATMAN ? `url(#${kimlik})` : null,
    })));
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
    + ` .kagit { --rx-boy: ${boyut === 'A5' ? '62mm' : '150mm'}; }`;

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
  const alan = (etiket, deger, genislik, simgeAdi, duzAd) => duz(duzAd, el('span', { class: 'kagit__alan' },
    simge(simgeAdi, { dolu: true, boy: 20, sinif: `kagit__alan-simge kagit__alan-simge--${simgeAdi}` }),
    el('b', {}, etiket + ':'),
    bos || !doluMu(deger) ? cizgi(genislik) : el('span', { class: 'kagit__alan-deger', dir: 'auto' }, deger)));

  // Şerit ve klinik sütun soldan sağa: etiketleri İngilizce ve basılı kâğıtta
  // da bu yönde. Sayfanın kalanı sağdan sola kalır.
  const serit = el('div', { class: 'kagit__serit', dir: 'ltr' },
    alan('Name', tamAd(hasta), '52mm', SERIT_SIMGELERI[0], 'hasta'),
    alan('Age', yas !== null ? String(yas) : '', '18mm', SERIT_SIMGELERI[1], null),
    alan('Date', bos ? '' : tarihMetni(recete.tarih), '30mm', SERIT_SIMGELERI[2], 'tarih'),
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
        saglikResmi(ayar),
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
  /* Antet, ihtisas rozeti ve hizmetler TEK bandın içinde: dalga da o banda
     ait. Önce dalga kâğıdın tepesinde serbest duruyor ve yalnız üst şeridi
     koyultuyordu; ad, rozet ve hizmetler altında beyaz zeminde kalıyordu.
     Sarmalayıcı yalnız EKLENDİ, içindekilerin sırası değişmedi — klasik ve
     sade stiller aynı ağacı giymeye devam ediyor. */
  const tepe = el('div', { class: 'kagit__tepe' }, dalga('ust'), antet, unvan, hizmet);

  return el('div', { class: `yazdir-alan kagit${stilSinifi}` }, stil,
    tepe, deneyim, vecize, serit,
    el('div', { class: 'kagit__govde' }, rx, sutun),
    ayak);
}

/** Ekrandaki kâğıt A4'ün BASILABİLİR alanı genişliğinde: 194 mm (210 mm
 *  eksi iki yanda 8 mm @page payı, 96 dpi). Önceden 210 mm'ydi ve yazılar
 *  ekranda baskıdakinden farklı yerde kırılıyordu; şimdi önizleme neyse
 *  çıktı o. Kâğıt kabına göre ölçeklenir. */
export const KAGIT_PX = 733;

/**
 * Ekrandaki kâğıdı kabına sığdırır ve kap yeniden boyutlandıkça korur.
 * `gozlenen` genelde sayfa kökü: kenar çubuğu açılıp kapanınca da ölçüm
 * yenilensin. `pay`: kâğıdın iki yanında toplam bırakılan boşluk (px).
 * Reçete yazma sayfasında 0: kâğıt kendi sütununu tam dolduruyor.
 */
export function kagidiOlcekle(tuval, kagit, gozlenen = null, { pay = 8 } = {}) {
  const uygula = () => {
    if (!tuval.isConnected) return;
    const olcek = Math.min(1, Math.max(0.2, (tuval.clientWidth - pay) / KAGIT_PX));
    tuval.style.setProperty('--olcek', String(olcek));
    // Ölçeklenen öğe yerinde yer kaplamıyor; boyu elle veriliyor.
    tuval.style.blockSize = Math.ceil(kagit.offsetHeight * olcek) + 'px';
  };
  // İlk ölçüm yerleşimden SONRA: hemen ölçünce kap daha dar geliyor.
  requestAnimationFrame(uygula);
  // TUVALİN KENDİSİ İZLENMİYOR: boyunu burada değiştiriyoruz, izleseydik
  // kendi kendini tetikleyen bir döngü olurdu.
  const gozcu = new ResizeObserver(uygula);
  if (gozlenen) gozcu.observe(gozlenen);
  gozcu.observe(kagit);
  return () => gozcu.disconnect();
}

/**
 * Kâğıdı yazdırır. Sayfada duran kâğıt geçici olarak değiştirilir, yazdırma
 * bitince eski hale döner — böylece boş kâğıt da aynı düzenle basılır.
 */
export function kagidiYazdir({ tekrar = 1, ...secenekler } = {}) {
  const sayfa = document.getElementById('sayfa');
  const n = Math.max(1, Math.min(20, Math.trunc(Number(tekrar)) || 1));
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
  window.print();
  if (eski) kagitlar[0].replaceWith(eski);
  else for (const k of kagitlar) k.remove();
}
