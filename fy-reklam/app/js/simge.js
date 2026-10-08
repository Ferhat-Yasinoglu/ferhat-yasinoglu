// Çizgi simgeler (24×24, stroke 1.5, yuvarlak uç). Ajans sitesinin «ico» biçimi:
// <svg class="ico"><path pathLength="1"/></svg>. Hepsi elle çizildi, dış kaynak yok.
import { s } from './dom.js';

const YOLLAR = {
  // ürünler
  hap: ['M8.5 3.5a5 5 0 0 1 7 7l-5 5a5 5 0 0 1-7-7z', 'M5.5 7.5l7 7', 'M16 15l5 5M21 15l-5 5'],
  steteskop: ['M6 3v5a5 5 0 0 0 10 0V3', 'M11 13v2a4 4 0 0 0 8 0v-2', 'M19 10a2 2 0 1 0 0 .01'],
  recete: ['M7 3h8l4 4v14H7z', 'M15 3v4h4', 'M10 11h5M10 15h3', 'M9 8h2'],
  konum: ['M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11z', 'M12 12a2.5 2.5 0 1 0 0-.01'],
  dukkan: ['M4 10l1.5-5h13L20 10', 'M4 10a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 6 0', 'M5 12v8h14v-8', 'M10 20v-5h4v5'],
  nakit: ['M3 7h18v10H3z', 'M12 12a2.5 2.5 0 1 0 0-.01', 'M6 10h.01M18 14h.01'],
  megafon: ['M4 10v4h3l7 4V6l-7 4z', 'M17.5 9.5a3.5 3.5 0 0 1 0 5', 'M7 14l1 5h2.5'],
  defter: ['M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6z', 'M6 3v18', 'M9 8h7M9 12h7M9 16h4'],
  bot: ['M5 9h14v10H5z', 'M12 5v4', 'M12 3a1 1 0 1 0 0 .01', 'M9 14h.01M15 14h.01', 'M9 17h6'],
  kivilcim: ['M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 'M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z'],
  paket: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M4 7.5l8 4.5 8-4.5', 'M12 12v9'],
  // arayüz
  izgara: ['M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'],
  taslak: ['M5 4h10l4 4v12H5z', 'M15 4v4h4', 'M8 13h8M8 17h5'],
  kayit: ['M5 4h14v16H5z', 'M8 9h8M8 13h8M8 17h4', 'M3 8h2M3 12h2M3 16h2'],
  daha: ['M5 12h.01M12 12h.01M19 12h.01'],
  arti: ['M12 5v14M5 12h14'],
  geri: ['M15 5l-7 7 7 7'],
  ileri: ['M9 5l7 7-7 7'],
  indir: ['M12 4v11', 'M7 11l5 5 5-5', 'M4 20h16'],
  paylas: ['M12 15V4', 'M8 8l4-4 4 4', 'M5 12v8h14v-8'],
  kopyala: ['M9 9h11v11H9z', 'M5 15V4h11'],
  instagram: ['M4 4h16v16H4z', 'M12 12a4 4 0 1 0 0-.01', 'M17.5 6.5h.01'],
  facebook: ['M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z'],
  harici: ['M14 4h6v6', 'M20 4l-9 9', 'M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5'],
  kalkan: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M9 12l2 2 4-4'],
  cikis: ['M10 4H5v16h5', 'M14 8l4 4-4 4', 'M18 12H9'],
  dil: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M3 12h18', 'M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18'],
  gunes: ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
  ay: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'],
  onay: ['M5 12.5l4.5 4.5L19 7'],
  uyari: ['M12 4l9 16H3z', 'M12 10v4M12 17h.01'],
  kapat: ['M6 6l12 12M18 6L6 18'],
  bilgi: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 11v5M12 8h.01'],
  sil: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v6M14 11v6'],
  goz: ['M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z', 'M12 12a3 3 0 1 0 0-.01'],
  kalem: ['M4 20l4-1L19 8l-3-3L5 16z', 'M14 7l3 3'],
  yenile: ['M20 12a8 8 0 1 1-2.3-5.7', 'M20 4v5h-5'],
  yazi: ['M4 6h16M4 12h10M4 18h7'],
  resim: ['M4 5h16v14H4z', 'M4 16l5-5 4 4 3-3 4 4', 'M16 9h.01'],
  akis: ['M4 6h5v4H4zM15 4h5v4h-5zM15 14h5v4h-5z', 'M9 8h3v-2h3M12 8v8h3'],
  liste: ['M9 6h11M9 12h11M9 18h11', 'M4 6h.01M4 12h.01M4 18h.01'],
  baslik: ['M4 5h16', 'M8 5v14M16 5v14', 'M6 19h4M14 19h4'],
  kare: ['M4 4h16v16H4z'],
  dikey: ['M6 3h12v18H6z'],
  hikaye: ['M7 2h10v20H7z', 'M11 19h2'],
};

/** simge('hap', { boyut: 20, class: 'ekstra' }) → <svg class="ico …"> */
export function simge(ad, { boyut = 24, class: sinif = '', etiket } = {}) {
  const yollar = YOLLAR[ad] || YOLLAR.paket;
  const svg = s('svg', {
    class: ['ico', sinif], viewBox: '0 0 24 24', width: boyut, height: boyut,
    fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    'aria-hidden': etiket ? false : true, role: etiket ? 'img' : false, 'aria-label': etiket || false, focusable: 'false',
  });
  for (const d of yollar) svg.append(s('path', { d, pathLength: 1 }));
  return svg;
}

/** Şablon SVG'sine (görsel üretimi) gömmek için ham yol listesi. */
export const simgeYollari = (ad) => YOLLAR[ad] || YOLLAR.paket;
export const SIMGE_ADLARI = Object.keys(YOLLAR);
