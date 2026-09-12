// Çizgi simge seti. Emoji yok: her simge 24×24 ızgarada, `currentColor` ile çizilir,
// yazı tipine ve işletim sistemine göre değişmez, RTL'de ters dönmez.
// Kullanım: simge('akis'), simge('ara', { boy: 18 }). Bilinmeyen ad boş kare döndürür.
const NS = 'http://www.w3.org/2000/svg';

// d: path verisi (birden çok parça dizi olarak), c: <circle> [cx,cy,r], g: dolgu ister mi
const SIMGELER = {
  // — gezinme —
  ozet: { d: ['M3 10.6 12 3.6l9 7M5.4 9v10.4h13.2V9', 'M9.6 19.4v-5.6h4.8v5.6'] },
  akis: { d: ['M7 5.5h4.2a2 2 0 0 1 2 2v9a2 2 0 0 0 2 2H19'], c: [[5, 5.5, 2], [19, 18.5, 2], [19, 11.5, 2]], d2: ['M7 5.5h6a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h1'] },
  sohbet: { d: ['M3.6 17.4V6.8a2 2 0 0 1 2-2h12.8a2 2 0 0 1 2 2v7.4a2 2 0 0 1-2 2H8.2L3.6 20z', 'M7.6 9.2h8.8M7.6 12.4h5.6'] },
  kisiler: { d: ['M2.8 20v-1.4a4.2 4.2 0 0 1 4.2-4.2h3a4.2 4.2 0 0 1 4.2 4.2V20', 'M16.6 14.6a4.2 4.2 0 0 1 4.6 4.2V20', 'M15.4 4.6a3.4 3.4 0 0 1 0 6.6'], c: [[8.5, 7.6, 3.4]] },
  toplu: { d: ['M4 14.4V9.6a1.6 1.6 0 0 1 1.6-1.6h2.6L15 4.2a1 1 0 0 1 1.5.9v12.8a1 1 0 0 1-1.5.9L8.2 16H5.6A1.6 1.6 0 0 1 4 14.4z', 'M8.2 16v3.2a1.4 1.4 0 0 0 2.8 0V16', 'M19 9.4a3.6 3.6 0 0 1 0 5.2'] },
  fikir: { d: ['M9.4 18.4h5.2M10 21h4', 'M12 3.2a6 6 0 0 0-3.6 10.8c.5.4.8 1 .9 1.6h5.4c.1-.6.4-1.2.9-1.6A6 6 0 0 0 12 3.2z', 'M12 15.6v-3.4M12 12.2l-1.8-1.8M12 12.2l1.8-1.8'] },
  video: { d: ['M3.4 7.4a2 2 0 0 1 2-2h9.2a2 2 0 0 1 2 2v9.2a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2z', 'M16.6 10.4 20.4 8v8l-3.8-2.4z', 'M8 9.6l3.4 2.4L8 14.4z'] },
  karusel: { d: ['M8.2 5.4h7.6a2 2 0 0 1 2 2v9.2a2 2 0 0 1-2 2H8.2a2 2 0 0 1-2-2V7.4a2 2 0 0 1 2-2z', 'M3.4 8.4v7.2M20.6 8.4v7.2'] },
  kanca: { d: ['M15.4 3.6v7.8a3.4 3.4 0 0 1-6.8 0', 'M12 15v5.4M9.4 20.4h5.2'] },
  galeri: { d: ['M4.4 5.4h15.2a1 1 0 0 1 1 1v11.2a1 1 0 0 1-1 1H4.4a1 1 0 0 1-1-1V6.4a1 1 0 0 1 1-1z', 'M3.6 16.2 8.4 11.4l4 4 2.8-2.6 4.4 4'], c: [[8.6, 9, 1.5]] },
  analitik: { d: ['M3.6 20.4h16.8', 'M6.6 20.4V12M11 20.4V6.4M15.4 20.4v-5.6M19.8 20.4V9.2'] },
  buyume: { d: ['M3.6 16.6 9 11l3.6 3.6 7.8-7.8', 'M15.6 6.8h4.8v4.8'] },
  ajan: { d: ['M12 2.8 13.7 8 19 9.7 13.7 11.4 12 16.6 10.3 11.4 5 9.7 10.3 8z', 'M18.2 15.4l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z'] },
  ayarlar: { d: ['M4 7.4h6M14 7.4h6M4 16.6h4M12 16.6h8'], c: [[12, 7.4, 2.2], [10, 16.6, 2.2]] },
  kurulum: { d: ['M8.4 3.6v4.2M15.6 3.6v4.2', 'M5.8 7.8h12.4v3.4a6.2 6.2 0 0 1-12.4 0z', 'M12 17.4v3'] },

  // — eylemler —
  ara: { d: ['M20.4 20.4 16.3 16.3'], c: [[10.6, 10.6, 6.2]] },
  arti: { d: ['M12 5v14M5 12h14'] },
  eksi: { d: ['M5 12h14'] },
  kapat: { d: ['M6 6l12 12M18 6 6 18'] },
  onay: { d: ['M4.8 12.6 9.6 17.4 19.2 6.6'] },
  kalem: { d: ['M4 20h4.2L19.4 8.8a2.1 2.1 0 0 0-3-3L5.2 17z', 'M14.8 7.2l3 3'] },
  cop: { d: ['M4.6 6.6h14.8', 'M9.4 6.6V4.8a1.2 1.2 0 0 1 1.2-1.2h2.8a1.2 1.2 0 0 1 1.2 1.2v1.8', 'M6.6 6.6l.9 12a1.6 1.6 0 0 0 1.6 1.5h5.8a1.6 1.6 0 0 0 1.6-1.5l.9-12', 'M10.4 10.4v6M13.6 10.4v6'] },
  kopya: { d: ['M9 9h9.4a1.6 1.6 0 0 1 1.6 1.6V20a1.6 1.6 0 0 1-1.6 1.6H9A1.6 1.6 0 0 1 7.4 20v-9.4A1.6 1.6 0 0 1 9 9z', 'M4.6 15H4a1.6 1.6 0 0 1-1.6-1.6V4a1.6 1.6 0 0 1 1.6-1.6h9.4A1.6 1.6 0 0 1 15 4v.6'] },
  indir: { d: ['M12 3.6v11.2M7.2 10.4 12 15.2l4.8-4.8', 'M4.4 18.8v1.6h15.2v-1.6'] },
  yukle: { d: ['M12 20.4V9.2M7.2 14 12 9.2l4.8 4.8', 'M4.4 5.2V3.6h15.2v1.6'] },
  yenile: { d: ['M20.2 12a8.2 8.2 0 1 1-2.6-6', 'M20.4 3.8v4.6h-4.6'] },
  filtre: { d: ['M3.4 5.4h17.2l-6.6 7.8v6.2l-4 2v-8.2z'] },
  surukle: { c: [[9, 6, 1.3], [15, 6, 1.3], [9, 12, 1.3], [15, 12, 1.3], [9, 18, 1.3], [15, 18, 1.3]], dolu: true },
  daha: { c: [[5.4, 12, 1.4], [12, 12, 1.4], [18.6, 12, 1.4]], dolu: true },
  menu: { d: ['M4 7h16M4 12h16M4 17h16'] },
  kaydet: { d: ['M5.4 4.4h10.4L19.6 8.2V18a1.6 1.6 0 0 1-1.6 1.6H5.4A1.6 1.6 0 0 1 3.8 18V6a1.6 1.6 0 0 1 1.6-1.6z', 'M7.6 4.4v5h7.2v-5M7.6 19.6v-5.4h8.8v5.4'] },

  // — oklar —
  sag: { d: ['M4.6 12h14.2M13 6.2 18.8 12 13 17.8'] },
  sol: { d: ['M19.4 12H5.2M11 6.2 5.2 12 11 17.8'] },
  yukari: { d: ['M12 19.4V5.2M6.2 11 12 5.2 17.8 11'] },
  asagi: { d: ['M12 4.6v14.2M6.2 13 12 18.8 17.8 13'] },
  git: { d: ['M6.6 17.4 17.4 6.6', 'M9 6.6h8.4V15'] },
  disari: { d: ['M13.4 4.6h6v6M19.4 4.6 11.6 12.4', 'M17 14v4.4a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18.4V8.6A1.6 1.6 0 0 1 5.6 7H10'] },

  // — durum —
  uyari: { d: ['M12 4 21 19.6H3z', 'M12 9.6v4.2M12 16.8v.1'] },
  bilgi: { d: ['M12 11.4v5M12 7.8v.1'], c: [[12, 12, 8.6]] },
  hata: { d: ['M8.8 8.8l6.4 6.4M15.2 8.8l-6.4 6.4'], c: [[12, 12, 8.6]] },
  basari: { d: ['M8 12.2 10.9 15 16 9.4'], c: [[12, 12, 8.6]] },
  saat: { d: ['M12 7.4V12l3 1.8'], c: [[12, 12, 8.6]] },
  yildiz: { d: ['M12 3.6 14.6 9l5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.6 9.8 9.4 9z'] },
  kalp: { d: ['M12 20.2 4.6 13a4.4 4.4 0 0 1 6.2-6.2l1.2 1.2 1.2-1.2A4.4 4.4 0 0 1 19.4 13z'] },
  goz: { d: ['M2.2 12S5.8 5.6 12 5.6 21.8 12 21.8 12 18.2 18.4 12 18.4 2.2 12 2.2 12z'], c: [[12, 12, 2.8]] },
  gozKapali: { d: ['M3 4.4 21 20.4', 'M10 6a9.6 9.6 0 0 1 2-.2c6.2 0 9.8 6.2 9.8 6.2a17 17 0 0 1-3.2 3.8M6.6 7.8A16.7 16.7 0 0 0 2.2 12S5.8 18.2 12 18.2a9.4 9.4 0 0 0 3.4-.6', 'M10.2 10.4a2.6 2.6 0 0 0 3.4 3.6'] },
  kilit: { d: ['M6.4 10.4h11.2a1.4 1.4 0 0 1 1.4 1.4v7a1.4 1.4 0 0 1-1.4 1.4H6.4A1.4 1.4 0 0 1 5 18.8v-7a1.4 1.4 0 0 1 1.4-1.4z', 'M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8'] },
  anahtar: { d: ['M20.4 3.6 11.8 12.2', 'M17.6 6.4l2 2M15 9l2 2'], c: [[8.2, 15.8, 4.6]] },

  // — nesneler —
  yildirim: { d: ['M13.4 2.6 5.2 13.4h5.8l-1.4 8 8.6-11.2H12z'] },
  parilti: { d: ['M12 3 13.9 8.1 19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z'] },
  etiket: { d: ['M3.8 11.4V5a1.2 1.2 0 0 1 1.2-1.2h6.4l8.6 8.6a1.6 1.6 0 0 1 0 2.3l-5.1 5.1a1.6 1.6 0 0 1-2.3 0z', 'M7.8 7.9v.1'] },
  zincir: { d: ['M10 13.8a3.6 3.6 0 0 0 5.4.4l2.8-2.8a3.6 3.6 0 0 0-5.1-5.1l-1.6 1.6', 'M14 10.2a3.6 3.6 0 0 0-5.4-.4l-2.8 2.8a3.6 3.6 0 0 0 5.1 5.1l1.6-1.6'] },
  kutu: { d: ['M20.4 8.2v7.6a1.4 1.4 0 0 1-.8 1.3l-6.8 3.4a1.8 1.8 0 0 1-1.6 0l-6.8-3.4a1.4 1.4 0 0 1-.8-1.3V8.2', 'M3.9 7.6 11.2 4a1.8 1.8 0 0 1 1.6 0l7.3 3.6-7.3 3.6a1.8 1.8 0 0 1-1.6 0z', 'M12 11.4v8.8'] },
  anten: { d: ['M12 13.6V21', 'M8.6 8.6a4.8 4.8 0 0 1 6.8 0M5.8 5.8a8.8 8.8 0 0 1 12.4 0'], c: [[12, 11.4, 2.2]] },
  telefon: { d: ['M7.4 2.8h9.2a1.6 1.6 0 0 1 1.6 1.6v15.2a1.6 1.6 0 0 1-1.6 1.6H7.4a1.6 1.6 0 0 1-1.6-1.6V4.4a1.6 1.6 0 0 1 1.6-1.6z', 'M10.6 18.2h2.8'] },
  bulut: { d: ['M7 18.4a4.4 4.4 0 0 1-.6-8.8 5.6 5.6 0 0 1 10.8-1.2A4 4 0 0 1 17.6 18.4z'] },
  gelen: { d: ['M3.6 13.4h4.2l1.4 2.6h5.6l1.4-2.6h4.2', 'M3.6 13.4 6.4 5.6a1.4 1.4 0 0 1 1.3-1h8.6a1.4 1.4 0 0 1 1.3 1l2.8 7.8v4.6a1.4 1.4 0 0 1-1.4 1.4H5a1.4 1.4 0 0 1-1.4-1.4z'] },
  prova: { d: ['M9.6 2.8v6.4L4.4 18a2 2 0 0 0 1.7 3h11.8a2 2 0 0 0 1.7-3l-5.2-8.8V2.8', 'M8.4 2.8h7.2', 'M7.2 14.6h9.6'] },
  robot: { d: ['M7.6 8.6h8.8a2 2 0 0 1 2 2v6.8a2 2 0 0 1-2 2H7.6a2 2 0 0 1-2-2v-6.8a2 2 0 0 1 2-2z', 'M12 8.6V5.4M3.2 12.6v2.8M20.8 12.6v2.8', 'M9.6 13v1.2M14.4 13v1.2'], c: [[12, 4.2, 1.4]] },
  takvim: { d: ['M5 5.6h14a1.4 1.4 0 0 1 1.4 1.4v12A1.4 1.4 0 0 1 19 20.4H5a1.4 1.4 0 0 1-1.4-1.4V7A1.4 1.4 0 0 1 5 5.6z', 'M8.2 3.4v4M15.8 3.4v4M3.6 10.4h16.8'] },
  izgara: { d: ['M4.4 4.4h5.2v5.2H4.4zM14.4 4.4h5.2v5.2h-5.2zM4.4 14.4h5.2v5.2H4.4zM14.4 14.4h5.2v5.2h-5.2z'] },
  soru: { d: ['M9.4 9.2a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.4-2.6 4M12 17.4v.1'], c: [[12, 12, 8.6]] },
  panel: { d: ['M4.4 4.6h15.2a1 1 0 0 1 1 1v12.8a1 1 0 0 1-1 1H4.4a1 1 0 0 1-1-1V5.6a1 1 0 0 1 1-1z', 'M3.4 9.2h17.2M9.4 9.2v10.2'] },

  // — oynatma —
  oynat: { d: ['M7.6 4.8 19 12 7.6 19.2z'] },
  duraklat: { d: ['M9 5.4v13.2M15 5.4v13.2'] },
  durdur: { d: ['M6.4 6.4h11.2v11.2H6.4z'] },
  ileri: { d: ['M6 5.4 15 12 6 18.6zM18 5.4v13.2'] },

  // — tema —
  gece: { d: ['M20.4 14.6A8.8 8.8 0 0 1 9.4 3.6a8.8 8.8 0 1 0 11 11z'] },
  gunduz: { d: ['M12 2.6v2.8M12 18.6v2.8M4.4 12H1.6M22.4 12h-2.8M6.6 6.6 4.6 4.6M19.4 19.4l-2-2M6.6 17.4l-2 2M19.4 4.6l-2 2'], c: [[12, 12, 4.2]] },

  // — kanallar —
  telegram: { d: ['M21.2 4.2 2.8 11.3l4.9 1.7 1.9 5.9 2.7-3.2 4.6 3.4z', 'M7.7 13 18.4 6.4l-6.1 8.3'] },
  instagram: { d: ['M7.4 3.6h9.2a3.8 3.8 0 0 1 3.8 3.8v9.2a3.8 3.8 0 0 1-3.8 3.8H7.4a3.8 3.8 0 0 1-3.8-3.8V7.4a3.8 3.8 0 0 1 3.8-3.8z', 'M17 7v.1'], c: [[12, 12, 3.8]] },
  whatsapp: { d: ['M3.4 20.6 4.8 16A8.2 8.2 0 1 1 8 19.2z', 'M8.8 9c.4 2.6 3.6 5.8 6.2 6.2l1.2-1.6 2 1-.6 1.8c-3.6.8-8.8-4.4-8-8l1.8-.6 1 2z'] },
  tiktok: { d: ['M15.6 3.4v9.8a3.9 3.9 0 1 1-3.9-3.9', 'M15.6 3.4a5 5 0 0 0 5 5'] },
};

const YEDEK = { d: ['M5.4 5.4h13.2v13.2H5.4z'] };

/** SVG simge öğesi. `boy` piksel (varsayılan 20), `sinif` ek sınıf. */
export function simge(ad, { boy = 20, sinif = '' } = {}) {
  const s = SIMGELER[ad] || YEDEK;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(boy));
  svg.setAttribute('height', String(boy));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', s.kalin || '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', ('simge ' + sinif).trim());
  for (const d of s.d || []) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  }
  for (const [cx, cy, r] of s.c || []) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', String(cx)); c.setAttribute('cy', String(cy)); c.setAttribute('r', String(r));
    if (s.dolu) { c.setAttribute('fill', 'currentColor'); c.setAttribute('stroke', 'none'); }
    svg.appendChild(c);
  }
  return svg;
}

/** Dolu (fill) varyant: yıldız, kalp, yıldırım gibi "seçili" durumlar için. */
export function simgeDolu(ad, secenek = {}) {
  const svg = simge(ad, secenek);
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('stroke-width', '1');
  return svg;
}

export const SIMGE_ADLARI = Object.keys(SIMGELER);
export const simgeVar = (ad) => Object.prototype.hasOwnProperty.call(SIMGELER, ad);
