// Simge seti: 24×24 çizgi simgeler, hepsi currentColor ile boyanır.
// Dış kaynak yok; uygulama çevrimdışı da eksiksiz görünür.
const NS = 'http://www.w3.org/2000/svg';

const SIMGELER = {
  panel: [['path', { d: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z' }]],
  ilac: [['path', { d: 'M10.5 20.5 20 11a5.7 5.7 0 0 0-8-8L2.5 12.5a5.7 5.7 0 0 0 8 8z' }], ['path', { d: 'm8.5 8.5 7 7' }]],
  hasta: [['circle', { cx: 12, cy: 8, r: 4 }], ['path', { d: 'M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5' }]],
  recete: [['path', { d: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z' }], ['path', { d: 'M14 3v4h4M9 12h6M9 16h4' }]],
  kutu: [['path', { d: 'M3 8l9-4 9 4v8l-9 4-9-4z' }], ['path', { d: 'M3 8l9 4 9-4M12 12v8' }]],
  ara: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'M16.5 16.5 21 21' }]],
  arti: [['path', { d: 'M12 5v14M5 12h14' }]],
  eksi: [['path', { d: 'M5 12h14' }]],
  kapat: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
  onay: [['path', { d: 'M5 13l4 4L19 7' }]],
  kalem: [['path', { d: 'M4 20h4L20 8l-4-4L4 16z' }]],
  cop: [['path', { d: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13' }]],
  indir: [['path', { d: 'M12 4v11M8 11l4 4 4-4M4 20h16' }]],
  yukle: [['path', { d: 'M12 19V6M8 10l4-4 4 4M5 20h14' }]],
  yenile: [['path', { d: 'M20 12a8 8 0 1 1-2.6-5.9' }], ['path', { d: 'M20 4v4h-4' }]],
  menu: [['path', { d: 'M4 7h16M4 12h16M4 17h16' }]],
  sag: [['path', { d: 'M9 5l7 7-7 7' }]],
  sol: [['path', { d: 'M15 5l-7 7 7 7' }]],
  asagi: [['path', { d: 'M5 9l7 7 7-7' }]],
  yukari: [['path', { d: 'M5 15l7-7 7 7' }]],
  geri: [['path', { d: 'M10 19l-7-7 7-7M3 12h18' }]],
  git: [['path', { d: 'M5 12h14M13 6l6 6-6 6' }]],
  uyari: [['path', { d: 'M12 3 2 20h20z' }], ['path', { d: 'M12 9v5' }], ['path', { d: 'M12 17.4v.2' }]],
  bilgi: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 11v6M12 7.4v.2' }]],
  hata: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M9 9l6 6M15 9l-6 6' }]],
  basari: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M8 12.5l2.5 2.5L16 9.5' }]],
  takvim: [['rect', { x: 3, y: 5, width: 18, height: 16, rx: 2 }], ['path', { d: 'M3 10h18M8 3v4M16 3v4' }]],
  saat: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v5l3 2' }]],
  yazdir: [['path', { d: 'M7 8V3h10v5' }], ['path', { d: 'M6 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1' }], ['rect', { x: 7, y: 14, width: 10, height: 7, rx: 1 }]],
  ayarlar: [['path', { d: 'M4 7h9M19 7h1M4 12h4M14 12h6M4 17h11M21 17h0' }], ['circle', { cx: 16, cy: 7, r: 2 }], ['circle', { cx: 11, cy: 12, r: 2 }], ['circle', { cx: 18, cy: 17, r: 2 }]],
  barkod: [['path', { d: 'M4 6v12M7 6v12M10.5 6v12M14 6v12M17 6v12M20 6v12' }]],
  telefon: [['path', { d: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z' }]],
  kilit: [['rect', { x: 4, y: 11, width: 16, height: 10, rx: 2 }], ['path', { d: 'M8 11V7a4 4 0 0 1 8 0v4' }]],
  kalp: [['path', { d: 'M12 20s-7-4.4-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6C19 15.6 12 20 12 20z' }]],
  filtre: [['path', { d: 'M3 5h18l-7 8v6l-4 2v-8z' }]],
  kaydet: [['path', { d: 'M5 3h11l3 3v15H5z' }], ['path', { d: 'M8 3v6h7V3M8 14h8v7H8z' }]],
  gece: [['path', { d: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z' }]],
  gunduz: [['circle', { cx: 12, cy: 12, r: 4 }], ['path', { d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' }]],
  grafik: [['path', { d: 'M4 20V10M10 20V4M16 20v-7M22 20H2' }]],
  not: [['path', { d: 'M5 4h14v16l-4-3-3 3-3-3-4 3z' }], ['path', { d: 'M9 9h6M9 13h4' }]],
};

export function simge(ad, { boy = 20, sinif = '' } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(boy));
  svg.setAttribute('height', String(boy));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', ('simge ' + sinif).trim());
  for (const [tag, attrs] of SIMGELER[ad] || SIMGELER.bilgi) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    svg.appendChild(e);
  }
  return svg;
}

export const simgeVar = (ad) => Object.hasOwn(SIMGELER, ad);
