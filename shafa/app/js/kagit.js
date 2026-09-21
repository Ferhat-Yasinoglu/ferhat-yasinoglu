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

/* Antetteki amblem: Asklepios asası — asaya dolanmış tek yılan.
   Tıbbın doğru sembolü budur; kanatlı iki yılanlı kadüse aslında ticaretin
   sembolüdür ve tıpta yaygın bir karışıklıktır. Kâğıda ait, dolgulu kendi
   çizimimiz: yılanın gövdesi baştan kuyruğa incelir, asanın arkasına geçtiği
   yerlerde kesilir — tek renkte "dolanma" ancak böyle okunur.
   Gövde eğrisi hesapla üretildi. 100×100 kutuya oturur, boyutu CSS verir. */
const AMBLEM = {
  bas: 'M50.0 19.4c5.4 0 9.8 2.6 9.8 6.1c0 3.4-4.4 6.2-9.8 6.2c-3.4 0-6-1.9-6-3.9c0-3 3-2.8 3-4.8c0-1.6-1.6-3.6-3-3.6z',
  govde: [
    'M48.7 28.1C49.0 28.2 50.0 28.5 50.6 28.7C51.3 28.9 51.9 29.1 52.5 29.3C53.2 29.5 53.8 29.7 54.4 29.9C55.0 30.1 55.5 30.3 56.1 30.5C56.6 30.7 57.1 30.9 57.6 31.1C58.1 31.2 58.6 31.4 59.0 31.6C59.4 31.8 59.8 32.0 60.1 32.1C60.5 32.3 60.7 32.5 61.0 32.6C61.2 32.7 61.4 32.9 61.5 32.9C61.7 33.0 61.7 33.1 61.8 33.1C61.8 33.1 61.7 33.0 61.6 32.9C61.6 32.7 61.4 32.4 61.4 32.1C61.4 31.9 61.4 31.4 61.4 31.2C61.5 30.9 61.6 30.7 61.7 30.6C61.8 30.4 61.8 30.4 61.8 30.5C61.8 30.5 61.7 30.6 61.5 30.7C61.4 30.8 61.2 30.9 60.9 31.1C60.6 31.3 60.3 31.4 60.0 31.6C59.6 31.8 59.2 32.0 58.8 32.2C58.4 32.4 57.1 31.4 57.3 32.8C57.6 34.1 59.6 39.1 60.4 40.2C61.2 41.4 61.5 39.8 62.0 39.6C62.5 39.4 63.0 39.1 63.5 38.9C64.0 38.7 64.5 38.4 65.0 38.1C65.4 37.9 65.9 37.6 66.3 37.3C66.7 37.0 67.2 36.7 67.5 36.3C67.9 35.9 68.3 35.5 68.7 34.9C69.0 34.4 69.3 33.8 69.5 33.1C69.6 32.4 69.7 31.6 69.6 30.9C69.5 30.1 69.2 29.4 68.9 28.9C68.6 28.3 68.2 27.8 67.8 27.4C67.5 27.0 67.0 26.6 66.6 26.3C66.2 26.0 65.8 25.7 65.3 25.4C64.9 25.1 64.4 24.9 63.9 24.6C63.4 24.4 62.9 24.1 62.4 23.9C61.9 23.6 61.3 23.4 60.7 23.2C60.2 23.0 59.6 22.7 59.0 22.5C58.4 22.3 57.8 22.1 57.1 21.8C56.5 21.6 55.9 21.4 55.2 21.2C54.6 21.0 53.9 20.8 53.3 20.5C52.6 20.3 51.6 20.0 51.3 19.9Z',
    'M42.5 37.8C41.9 38.0 40.1 38.7 39.0 39.2C37.9 39.6 36.8 40.1 35.8 40.6C34.9 41.2 34.0 41.6 33.2 42.4C32.4 43.1 31.4 44.0 31.1 45.2C30.8 46.3 30.7 48.1 31.1 49.3C31.4 50.4 32.4 51.3 33.2 52.0C34.0 52.8 34.9 53.2 35.8 53.7C36.8 54.2 37.9 54.7 39.0 55.1C40.1 55.6 41.3 56.0 42.6 56.4C43.9 56.9 45.2 57.3 46.5 57.7C47.8 58.1 49.2 58.6 50.5 59.0C51.8 59.4 53.2 59.8 54.4 60.2C55.6 60.6 56.7 61.0 57.7 61.4C58.7 61.8 59.7 62.2 60.4 62.5C61.1 62.9 61.6 63.2 61.9 63.4C62.2 63.6 62.2 63.7 62.2 63.5C62.2 63.4 62.1 62.5 62.1 62.3C62.1 62.0 62.4 61.9 62.2 62.0C62.0 62.0 61.7 62.4 61.1 62.8C60.5 63.1 58.6 62.7 58.6 63.9C58.7 65.2 60.6 69.3 61.6 70.1C62.5 70.8 63.5 69.2 64.5 68.7C65.4 68.2 66.2 67.7 67.0 66.9C67.7 66.2 68.6 65.2 68.8 64.1C69.0 63.0 68.8 61.3 68.4 60.3C67.9 59.2 67.0 58.5 66.2 57.8C65.4 57.2 64.5 56.7 63.6 56.2C62.6 55.7 61.5 55.2 60.4 54.8C59.2 54.3 58.0 53.8 56.7 53.4C55.4 52.9 54.1 52.5 52.8 52.1C51.4 51.6 50.1 51.2 48.8 50.8C47.5 50.3 46.2 49.9 45.0 49.5C43.9 49.1 42.7 48.7 41.8 48.3C40.9 47.9 40.0 47.5 39.4 47.1C38.7 46.8 38.3 46.4 38.1 46.3C37.9 46.2 38.1 46.2 38.2 46.5C38.2 46.8 38.2 47.7 38.2 48.0C38.2 48.3 37.9 48.4 38.1 48.3C38.4 48.2 38.8 47.8 39.5 47.5C40.1 47.2 41.0 46.8 41.9 46.4C42.9 46.0 44.7 45.4 45.3 45.2Z',
    'M44.3 68.9C44.0 69.0 43.0 69.3 42.4 69.6C41.7 69.8 41.1 70.0 40.5 70.3C39.9 70.5 39.3 70.7 38.8 71.0C38.2 71.2 37.7 71.4 37.2 71.7C36.7 71.9 36.2 72.2 35.7 72.4C35.3 72.7 34.8 73.0 34.4 73.3C34.0 73.6 33.6 73.9 33.2 74.2C32.9 74.6 32.5 75.0 32.2 75.5C31.9 75.9 31.6 76.5 31.5 77.1C31.4 77.7 31.3 78.4 31.4 79.0C31.5 79.6 31.8 80.2 32.0 80.7C32.3 81.2 32.7 81.6 33.0 82.0C33.4 82.3 33.8 82.6 34.2 82.9C34.6 83.2 35.0 83.5 35.5 83.8C35.9 84.0 36.4 84.3 36.9 84.5C37.4 84.7 37.9 85.0 38.5 85.2C39.0 85.4 39.6 85.7 40.2 85.9C40.8 86.1 41.4 86.3 42.0 86.6C42.6 86.8 43.3 87.0 43.9 87.2C44.6 87.4 45.3 88.7 45.9 87.8C46.6 87.0 47.8 83.2 47.8 82.2C47.8 81.1 46.5 81.7 45.9 81.5C45.2 81.3 44.6 81.1 44.1 80.8C43.5 80.6 42.9 80.4 42.4 80.2C41.8 80.0 41.3 79.8 40.9 79.6C40.4 79.4 40.0 79.2 39.6 79.0C39.2 78.8 38.9 78.6 38.6 78.4C38.3 78.3 38.0 78.1 37.9 78.0C37.7 77.8 37.6 77.7 37.5 77.6C37.4 77.6 37.5 77.5 37.5 77.6C37.5 77.7 37.6 77.8 37.6 78.0C37.6 78.2 37.6 78.5 37.6 78.6C37.6 78.8 37.5 78.9 37.5 78.9C37.5 79.0 37.5 78.9 37.6 78.9C37.7 78.8 37.8 78.7 38.1 78.5C38.3 78.4 38.5 78.2 38.8 78.1C39.2 77.9 39.5 77.7 39.9 77.5C40.3 77.3 40.8 77.1 41.3 76.9C41.8 76.7 42.3 76.5 42.8 76.3C43.4 76.1 43.9 75.9 44.5 75.7C45.1 75.5 46.1 75.2 46.4 75.1Z',
  ],
};

/** Asklepios asası. Beyaz çizilir; rengi CSS'ten currentColor ile gelir. */
function amblemCiz() {
  return svgEl('svg', { class: 'kagit__amblem-cizim', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
    svgEl('g', { transform: 'translate(50,50) scale(0.93) translate(-50,-50)', fill: 'currentColor' },
      svgEl('circle', { cx: 50, cy: 11, r: 5.1 }),
      svgEl('path', { d: 'M46.6 16h6.8v70l-3.4 9-3.4-9z' }),
      svgEl('path', { d: AMBLEM.bas }),
      ...AMBLEM.govde.map((yol) => svgEl('path', { d: yol }))));
}

/* Klinik alanların etiketleri kâğıtta İngilizce durur: doktorun kendi kâğıdı
   da böyle ve BP/PR/RR/BW hekimlikte evrensel kısaltmalar. */
/** Kâğıda basılı, değişmeyen satır. Ayarlarda karşılığı yoktur; kaldırmak
 *  ya da değiştirmek için bu dosyayı düzenlemek gerekir — öyle istendi. */
const VECIZE = 'طبیب حقیقی خداوند (ج) است';

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
    // Dolgulu köşe kütleleri: katman katman akan dalgalar. Kontur denendi,
    // basılı kâğıdın ağırlığını vermiyordu.
    return svgEl('svg', {
      class: 'kagit__dalga kagit__dalga--ust', viewBox: '0 0 300 150',
      preserveAspectRatio: 'none', 'aria-hidden': 'true',
    },
    // Köşe KÜTLESİ: köşeden başlayıp kavisli bir hipotenüsle inceliyor.
    // Tam genişlik bant denendi, kâğıdın üstüne çekilmiş düz şerit gibi durdu.
    svgEl('path', { class: 'kagit__dalga-1', d: 'M0 0H300C252 70 140 112 0 150Z' }),
    svgEl('path', { class: 'kagit__dalga-2', d: 'M0 0H222C188 58 104 98 0 124Z' }),
    svgEl('path', { class: 'kagit__dalga-3', d: 'M0 0H142C124 44 68 80 0 98Z' }));
  }
  // Ayak bandının üst kenarı: kâğıt renginde kesip banda kıvrım veriyor.
  return svgEl('svg', {
    class: 'kagit__dalga kagit__dalga--alt', viewBox: '0 0 1000 110',
    preserveAspectRatio: 'none', 'aria-hidden': 'true',
  },
  svgEl('path', { class: 'kagit__dalga-kesim', d: 'M0 0H1000V52C874 96 742 30 606 52 470 74 352 18 214 40 140 52 68 70 0 58Z' }),
  svgEl('path', { class: 'kagit__dalga-2', d: 'M0 44C82 72 168 26 268 40 386 56 470 96 592 82 704 69 812 24 1000 62V0H0Z' }));
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

  /* ---- Antet: sağda doktorun adı, ortada amblem, solda slogan ---- */
  const antet = el('header', { class: 'kagit__antet' },
    el('div', { class: 'kagit__ad-blok' },
      el('div', { class: 'kagit__doktor' }, [recete.doktorUnvan || ayar.doktorUnvan, recete.doktorAd || ayar.doktorAd].filter(doluMu).join(' ')),
      doluMu(ayar.doktorAdAlt) ? el('div', { class: 'kagit__doktor-alt' }, ayar.doktorAdAlt) : null),
    el('div', { class: 'kagit__amblem' }, amblemCiz()),
    el('div', { class: 'kagit__slogan' },
      simge('ekg', { boy: 26 }),
      doluMu(ayar.slogan) ? el('div', {}, ...satirlara(ayar.slogan).map((x) => el('div', {}, x))) : null,
      doluMu(ayar.klinikAdi) ? el('div', { class: 'kagit__klinik-ad' }, ayar.klinikAdi) : null));

  const unvan = doluMu(ayar.uzmanlik) ? el('div', { class: 'kagit__unvan' }, el('span', {}, ayar.uzmanlik)) : null;

  /* ---- Hizmetler: her satır kendi simgesiyle, altında ilgi alanları ---- */
  const hizmetSatirlari = satirlara(ayar.hizmetler);
  const hizmet = hizmetSatirlari.length || doluMu(ayar.hizmetAlanlari)
    ? el('div', { class: 'kagit__hizmet' },
      hizmetSatirlari.length
        ? el('div', { class: 'kagit__hizmet-satir' }, ...hizmetSatirlari.map((h, i) =>
          el('span', { class: 'kagit__hizmet-oge' },
            el('span', { class: 'kagit__hizmet-daire' }, simge(i % 2 ? 'ultrason' : 'ekg', { boy: 15 })),
            el('span', {}, h))))
        : null,
      doluMu(ayar.hizmetAlanlari) ? el('div', { class: 'kagit__hizmet-alan' }, ayar.hizmetAlanlari) : null)
    : null;

  const deneyim = doluMu(ayar.deneyim) ? el('div', { class: 'kagit__deneyim' }, ayar.deneyim) : null;

  /* ---- Kâğıda ait sabit satır ----
     Hekimin basılı reçetesinde bu satır var ve kalması istendi. Bilerek
     ayarlardan gelmiyor ve bilerek koşulsuz basılıyor: kâğıdın parçası,
     doldurulan bir alan değil. Boş kâğıtta da çıkar. */
  // Süslü çerçeve: basılı kâğıtta bu satır bir kartuş içinde duruyor.
  // Süsler aria-hidden değil, metin düğümü olmadıkları için okuyucuya düşmez.
  const vecize = el('div', { class: 'kagit__vecize' },
    el('span', { class: 'kagit__vecize-cerceve' },
      el('span', { class: 'kagit__vecize-sus' }, '❖'),
      el('span', { class: 'kagit__vecize-metin' }, VECIZE),
      el('span', { class: 'kagit__vecize-sus' }, '❖')));

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
        el('span', { class: 'kagit__olcum-simge' }, simge(OLCUM_SIMGELERI[anahtar] || 'kalp', { boy: 19 })),
        el('b', {}, `${KLINIK_ADLARI[anahtar]} :`),
        !bos && doluMu(recete.olcumler?.[anahtar])
          ? el('span', { dir: 'ltr' }, `${recete.olcumler[anahtar]} ${birim}`)
          : cizgi()))),
      // Kan grubu ölçüm değil, hastanın künyesi — ama hekim onu da burada
      // arıyor. Ölçümlerle aynı satır düzeninde, en altta. Ayırt edici
      // sınıfı var: deneme ölçüm sayarken bunu saymasın.
      duz('kanGrubu', el('div', { class: 'kagit__olcum kagit__olcum--kan' },
        el('span', { class: 'kagit__olcum-simge' }, simge('kan', { boy: 19 })),
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
      el('div', { class: 'kagit__qr-kutu' }, qr,
        el('span', { class: 'kagit__qr-alt' }, t('kagit.qr_alt', 'Scan for Contact'))),
      el('div', { class: 'kagit__sutun-resim' }, simge('stetoskop', { boy: 54 }), simge('kalp', { boy: 34 }))));

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

  const rx = el('section', { class: 'kagit__rx' },
    filigran(),
    el('div', { class: 'kagit__rx-isaret', dir: 'ltr' }, '℞'),
    el('div', { class: 'kagit__rx-govde' }, belirtiler, tani, alerji, ilacGovdesi,
      bos ? null : yerTutucu('ilac-ekle', t('recete.ilac_ekle', 'İlaç ekle')),
      laboratuvar,
      !bos && doluMu(recete.notlar)
        ? duz('notlar', el('div', { class: 'kagit__not' }, recete.notlar))
        : (bos ? null : yerTutucu('notlar', t('recete.not', 'Reçete notu')))),
    imza);

  /* ---- Ayak: rozetler ve iletişim ---- */
  const rozetler = String(ayar.ayakEtiketleri ?? t('kagit.ayak_etiketleri', 'قلب, شش, معده, اطفال'))
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

  // İki üst köşede birden: sağdaki CSS'te aynalanıyor.
  const ustDalga = dalga('ust');
  const ustDalga2 = dalga('ust');
  ustDalga2.classList.add('kagit__dalga--ayna');

  return el('div', { class: `yazdir-alan kagit${stilSinifi}` }, stil,
    ustDalga, ustDalga2,
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
