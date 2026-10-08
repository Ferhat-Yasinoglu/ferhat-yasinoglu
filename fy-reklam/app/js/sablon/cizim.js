// Görsel üretimi: taslak + ürün → SVG → (canvas) → JPEG.
//
// Neden SVG: düzen metinle (tspan) tarif edilir, önizleme DOM'da aynı SVG'dir, JPEG de aynı SVG'nin
// taranmış hâlidir — iki ayrı çizim kodu yok. Canvas'a çizilen bir SVG dış kaynak YÜKLEYEMEZ: yazı tipleri
// data: URI olarak <style>'a gömülür (yalnız JPEG için; önizlemede sayfanın @font-face'i yeter).
// Satır kırma tarayıcının canvas ölçümüyle yapılır (aynı yazı tipi, aynı ağırlık), SVG'de otomatik kırma yok.
//
// Tasarım dili: ajans sitesinin v3 «Yeşil»i — gece siyahı zemin, kireç vurgu, cam kart, eş aralıklı etiket,
// italik serif vurgu kelimesi (*yıldızlar* arasına yazılır), FY harfleri alt köşede.
import { simgeYollari } from '../simge.js';
import { RTL_DILLER } from '../paylasilan/urunler.js';

export const BICIMLER = {
  kare: { w: 1080, h: 1080, ad: 'kare' },
  dikey: { w: 1080, h: 1350, ad: 'dikey' },
  hikaye: { w: 1080, h: 1920, ad: 'hikaye' },
};
export const SABLONLAR = ['baslik', 'ozellikler', 'akis'];

// Renkler ajans tokenlarından (gece teması); görsel her zaman koyu zeminde çıkar.
const R = {
  ink0: '#040504', ink1: '#0a0b0a', ink2: '#10110f', surface1: '#0b0c0b', surface2: '#121311', surface3: '#1d1f1b',
  fg: '#f2f2ee', muted: '#a3a3a0', dim: '#969691', faint: '#55554f',
  lime: '#c0f244', limeHi: '#dcf98f', limePale: '#eef9c4', limeDeep: '#8ab02c', olive: '#5e692f', onLime: '#0b1000',
  cyan: '#7cc0cc', line: 'rgba(255,255,255,',
};
const FY_YOL = 'M471 243 H821 L918 403 L1026 243 H1145 L972 497 V708 H855 V497 L753 329 H578 V400 H767 L708 500 H578 V708 H455 V259 A16 16 0 0 1 471 243 Z';
const FY_KUTU = { x: 455, y: 243, w: 690, h: 465 };
export const HESAP = '@farhad___yaqoobi';
export const MARKA = 'FY — Yapay Zekâ Ajansı';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const yuvarla = (n) => Math.round(n * 10) / 10;

// --- yazı tipleri ------------------------------------------------------------

const AILE = {
  govde: { ad: 'Geist', dosya: 'fonts/geist-latin.woff2' },
  mono: { ad: 'Geist Mono', dosya: 'fonts/geistmono-latin.woff2' },
  vurgu: { ad: 'Instrument Serif', dosya: 'fonts/instrumentserif-italic-latin.woff2', italik: true },
  fa: { ad: 'Vazirmatn', dosya: ['fonts/vazirmatn-latin.woff2', 'fonts/vazirmatn-arabic.woff2'] },
};
const gomuluOnbellek = new Map();

async function dataUri(yol) {
  if (gomuluOnbellek.has(yol)) return gomuluOnbellek.get(yol);
  const s = (async () => {
    const r = await fetch(yol);
    if (!r.ok) throw new Error('yazı tipi yüklenemedi: ' + yol);
    const b = new Uint8Array(await r.arrayBuffer());
    let m = '';
    for (let i = 0; i < b.length; i += 0x8000) m += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return `data:font/woff2;base64,${btoa(m)}`;
  })();
  gomuluOnbellek.set(yol, s);
  return s;
}

/** JPEG için <style>: gerekli aileler data: URI ile. */
async function gomuluStil(rtl) {
  const kurallar = [];
  const ekle = async (aile, dosya) => kurallar.push(`@font-face{font-family:"${aile.ad}";font-style:${aile.italik ? 'italic' : 'normal'};font-weight:100 900;src:url("${await dataUri(dosya)}") format("woff2")}`);
  await ekle(AILE.mono, AILE.mono.dosya);
  if (rtl) { for (const d of AILE.fa.dosya) await ekle(AILE.fa, d); } else { await ekle(AILE.govde, AILE.govde.dosya); await ekle(AILE.vurgu, AILE.vurgu.dosya); }
  return kurallar.join('');
}

/** Ölçüm için yazı tiplerinin sayfada yüklü olmasını bekler. */
export async function yaziTipleriniHazirla(rtl) {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  const istekler = [`400 16px "${AILE.mono.ad}"`];
  if (rtl) istekler.push(`400 16px "${AILE.fa.ad}"`, `700 16px "${AILE.fa.ad}"`);
  else istekler.push(`400 16px "${AILE.govde.ad}"`, `600 16px "${AILE.govde.ad}"`, `700 16px "${AILE.govde.ad}"`, `italic 400 16px "${AILE.vurgu.ad}"`);
  await Promise.all(istekler.map((i) => document.fonts.load(i).catch(() => null)));
}

// --- ölçüm ve satır kırma -----------------------------------------------------

let olcumBaglam;
let olcumYok = false;
/** Metin genişliği (px). Canvas yoksa (Node, testler) kaba bir tahmin: harf başına boyutun .56'sı. */
function olc(metin, font) {
  if (!olcumBaglam && !olcumYok) {
    try {
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : (typeof document !== 'undefined' ? document.createElement('canvas') : null);
      olcumBaglam = c ? c.getContext('2d') : null;
    } catch { olcumBaglam = null; }
    if (!olcumBaglam) olcumYok = true;
  }
  if (olcumYok) {
    const boyut = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] || 16);
    return [...String(metin)].length * boyut * 0.56;
  }
  olcumBaglam.font = font;
  return olcumBaglam.measureText(metin).width;
}

/** «*vurgu*» işaretli metni parçalara ayırır: [{ metin, vurgu }]. */
export function vurguParcala(metin) {
  const parcalar = [];
  const d = String(metin || '');
  const kalip = /\*([^*\n]+)\*/g;
  let son = 0;
  for (const m of d.matchAll(kalip)) {
    if (m.index > son) parcalar.push({ metin: d.slice(son, m.index), vurgu: false });
    parcalar.push({ metin: m[1], vurgu: true });
    son = m.index + m[0].length;
  }
  if (son < d.length) parcalar.push({ metin: d.slice(son), vurgu: false });
  return parcalar.length ? parcalar : [{ metin: d, vurgu: false }];
}

/**
 * Kelime kelime kırar; her kelime kendi yazı tipiyle ölçülür (vurgu kelimeleri serif italik, biraz büyük).
 * Döner: satırlar = [[{ metin, vurgu }], …]. Boşluklar kelimeye yapışık tutulur (sondaki hariç).
 */
function satirKir(metin, { genislik, boyut, agirlik, rtl, enCokSatir = 6 }) {
  const normal = `${agirlik} ${boyut}px "${rtl ? AILE.fa.ad : AILE.govde.ad}"`;
  const vurgu = rtl ? normal : `italic 400 ${Math.round(boyut * 1.08)}px "${AILE.vurgu.ad}"`;
  const kelimeler = [];
  for (const p of vurguParcala(metin)) {
    for (const k of p.metin.split(/(\s+)/)) {
      if (!k) continue;
      if (/^\s+$/.test(k)) { if (kelimeler.length) kelimeler[kelimeler.length - 1].bosluk = true; continue; }
      kelimeler.push({ metin: k, vurgu: p.vurgu, bosluk: false });
    }
  }
  const bosluk = olc(' ', normal);
  const satirlar = [];
  let satir = [];
  let dolu = 0;
  for (const k of kelimeler) {
    const w = olc(k.metin, k.vurgu ? vurgu : normal);
    const ek = satir.length ? bosluk : 0;
    if (satir.length && dolu + ek + w > genislik) { satirlar.push(satir); satir = []; dolu = 0; }
    satir.push(k);
    dolu += (satir.length > 1 ? bosluk : 0) + w;
  }
  if (satir.length) satirlar.push(satir);
  if (satirlar.length > enCokSatir) {
    const kalan = satirlar.slice(0, enCokSatir);
    const sonSatir = kalan[enCokSatir - 1];
    sonSatir[sonSatir.length - 1] = { ...sonSatir[sonSatir.length - 1], metin: sonSatir[sonSatir.length - 1].metin + '…' };
    return kalan;
  }
  return satirlar;
}

/** En uzun kelime genişliğe sığana dek yazıyı küçültür (adres gibi bölünemeyen metinler için). */
function sigdir(metin, genislik, boyut, enKucuk, { agirlik = 600, rtl = false } = {}) {
  const aile = rtl ? AILE.fa.ad : AILE.govde.ad;
  const kelimeler = String(metin || '').replace(/\*/g, '').split(/\s+/).filter(Boolean);
  let b = boyut;
  while (b > enKucuk && kelimeler.some((k) => olc(k, `${agirlik} ${b}px "${aile}"`) > genislik)) b -= 1;
  return b;
}

/** Tek satıra sığmayan metni «…» ile keser. */
function kes(metin, genislik, font) {
  let m = String(metin || '');
  if (olc(m, font) <= genislik) return m;
  const k = [...m];
  while (k.length > 1 && olc(k.join('') + '…', font) > genislik) k.pop();
  return k.join('').trimEnd() + '…';
}

/** Satırları <text> olarak yazar (tspan'lı); x, y üst sol (ya da RTL'de üst sağ). Döner: { svg, yukseklik }. */
function metinBlogu(metin, { x, y, genislik, boyut, agirlik = 600, renk = R.fg, satirYuk = 1.08, rtl = false, enCokSatir = 6, harfAralik = 0 }) {
  const satirlar = satirKir(metin, { genislik, boyut, agirlik, rtl, enCokSatir });
  const aile = rtl ? AILE.fa.ad : AILE.govde.ad;
  const parcalar = [];
  let yy = y + boyut; // ilk taban çizgisi
  for (const satir of satirlar) {
    const icerik = satir.map((k, i) => {
      const ara = i < satir.length - 1 ? ' ' : '';
      if (k.vurgu) return rtl
        ? `<tspan fill="${R.lime}">${esc(k.metin)}${ara}</tspan>`
        : `<tspan font-family="${AILE.vurgu.ad}" font-style="italic" font-weight="400" font-size="${Math.round(boyut * 1.08)}" fill="${R.lime}">${esc(k.metin)}${ara}</tspan>`;
      return esc(k.metin) + ara;
    }).join('');
    parcalar.push(`<text x="${x}" y="${yuvarla(yy)}" font-family="${aile}" font-size="${boyut}" font-weight="${agirlik}" fill="${renk}" letter-spacing="${harfAralik}"${rtl ? ' direction="rtl" text-anchor="start"' : ''}>${icerik}</text>`);
    yy += boyut * satirYuk;
  }
  return { svg: parcalar.join(''), yukseklik: satirlar.length ? (satirlar.length - 1) * boyut * satirYuk + boyut : 0, satir: satirlar.length };
}

/* Eş aralıklı satır. rtl: direction="rtl" ve text-anchor="start" — SVG'de anchor yön görelidir, sağdan sola
   metnin başlangıcı x'in SAĞ ucudur; 'end' verilirse metin x'in sağına taşar (ilk ekran denemesinde görüldü). */
function monoMetin(metin, { x, y, boyut = 26, renk = R.muted, rtl = false, anchor }) {
  const a = anchor || 'start';
  return `<text x="${x}" y="${y}" font-family="${AILE.mono.ad}, ${AILE.fa.ad}" font-size="${boyut}" font-weight="400" fill="${renk}" text-anchor="${a}"${rtl ? ' direction="rtl"' : ''}>${esc(metin)}</text>`;
}

// --- parçalar -------------------------------------------------------------------

/**
 * Şablon içeriğini dikeyde ortalar: içeriğin kapladığı alan (en alttaki y) ile alt bilgi arasındaki boşluğun
 * %38'i kadar aşağı kaydırır — tam ortadan biraz yukarı, göz böyle dengeli görür. Yalnız başlık ve özellikler
 * şablonlarında; akış penceresi zaten alanı dolduruyor. Üst etiket kaydırılmaz (hep aynı yerde).
 */
function ortala(icerik, { h, kenar, hikaye, sablon }) {
  if (sablon === 'akis') return icerik;
  const ustEtiketSonu = icerik.indexOf('</g>') + 4;
  const etiket = icerik.slice(0, ustEtiketSonu);
  const govde = icerik.slice(ustEtiketSonu);
  let enAlt = 0;
  for (const m of govde.matchAll(/<(?:text|rect)[^>]*? y="([\d.]+)"(?:[^>]*? height="([\d.]+)")?/g)) enAlt = Math.max(enAlt, Number(m[1]) + Number(m[2] || 0));
  const altSinir = h - kenar - 60 - (hikaye ? 150 : 0);
  const bosluk = altSinir - enAlt;
  if (bosluk <= 40) return icerik;
  return etiket + `<g transform="translate(0 ${yuvarla(bosluk * 0.38)})">${govde}</g>`;
}

/** FY harfleri: kireç degrade, verilen yükseklikte, (x, y) sol üst. */
function fyLogo(x, y, yukseklik, { renk = 'url(#fyGrad)' } = {}) {
  const olcek = yukseklik / FY_KUTU.h;
  return `<path d="${FY_YOL}" fill="${renk}" transform="translate(${x} ${y}) scale(${olcek}) translate(${-FY_KUTU.x} ${-FY_KUTU.y})"/>`;
}

/** Simge (24×24 yollar) — kutu içinde, ürün renginde. */
function simgeKutusu(ad, x, y, boy, renk) {
  const yollar = simgeYollari(ad);
  const ic = boy * 0.5;
  const olcek = ic / 24;
  const kaydir = (boy - ic) / 2;
  return `<g><rect x="${x}" y="${y}" width="${boy}" height="${boy}" rx="${Math.round(boy * 0.27)}" fill="${renk}" fill-opacity=".12" stroke="${renk}" stroke-opacity=".32" stroke-width="2"/>` +
    `<g transform="translate(${x + kaydir} ${y + kaydir}) scale(${olcek})" fill="none" stroke="${renk}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${yollar.map((d) => `<path d="${d}"/>`).join('')}</g></g>`;
}

/** Üst etiket (.g-tag): kare kireç nokta · marka · / · ürün. */
function ustEtiket(metin, { x, y, rtl, w }) {
  const boyut = 26;
  const geniş = olc(metin, `400 ${boyut}px "${AILE.mono.ad}"`) + 70;
  const bx = rtl ? w - x - geniş : x;
  const h = 54;
  return `<g><rect x="${bx}" y="${y}" width="${yuvarla(geniş)}" height="${h}" rx="8" fill="${R.line}.04)" stroke="${R.line}.09)"/>` +
    `<rect x="${bx + 22}" y="${y + h / 2 - 4}" width="8" height="8" fill="${R.lime}"/>` +
    monoMetin(metin, { x: bx + 44, y: y + h / 2 + 9, boyut, renk: R.muted, anchor: 'start' }) + '</g>';
}

/** Alt bilgi: FY harfleri + hesap + adres; kıl çizgi üstünde. */
function altBilgi({ w, h, kenar, rtl, adres, hikaye }) {
  const y = h - kenar - (hikaye ? 150 : 0);
  const logoBoy = 54;
  const logoX = rtl ? w - kenar - logoBoy * (FY_KUTU.w / FY_KUTU.h) : kenar;
  return `<line x1="${kenar}" y1="${y - 46}" x2="${w - kenar}" y2="${y - 46}" stroke="${R.line}.08)"/>` +
    fyLogo(logoX, y - logoBoy + 6, logoBoy) +
    monoMetin(HESAP, { x: rtl ? kenar : w - kenar, y: y - 22, boyut: 26, renk: R.muted, anchor: rtl ? 'start' : 'end' }) +
    (adres ? monoMetin(adres, { x: rtl ? kenar : w - kenar, y: y + 10, boyut: 22, renk: R.dim, anchor: rtl ? 'start' : 'end' }) : '');
}

function zemin({ w, h, renk }) {
  return `<defs>
    <linearGradient id="fyGrad" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${R.limePale}"/><stop offset=".45" stop-color="${R.lime}"/><stop offset="1" stop-color="${R.limeDeep}"/></linearGradient>
    <radialGradient id="g1" cx="0.12" cy="0" r="0.9"><stop offset="0" stop-color="${R.lime}" stop-opacity=".16"/><stop offset=".55" stop-color="${R.lime}" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="0.95" cy="0.12" r="0.7"><stop offset="0" stop-color="${renk}" stop-opacity=".16"/><stop offset=".6" stop-color="${renk}" stop-opacity="0"/></radialGradient>
    <radialGradient id="g3" cx="0.5" cy="1.1" r="0.8"><stop offset="0" stop-color="${R.lime}" stop-opacity=".08"/><stop offset=".6" stop-color="${R.lime}" stop-opacity="0"/></radialGradient>
    <linearGradient id="cam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${R.surface2}" stop-opacity=".86"/><stop offset="1" stop-color="${R.surface1}" stop-opacity=".86"/></linearGradient>
    <linearGradient id="kenar" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".14"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".05"/><stop offset="1" stop-color="${R.lime}" stop-opacity=".25"/></linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="${R.ink0}"/>
  <rect width="${w}" height="${h}" fill="url(#g1)"/><rect width="${w}" height="${h}" fill="url(#g2)"/><rect width="${w}" height="${h}" fill="url(#g3)"/>`;
}

/** İnce ızgara (devre kartı hissi), çok soluk. */
function izgara(w, h, kenar) {
  const adim = 90;
  const cizgiler = [];
  for (let x = kenar; x <= w - kenar; x += adim) cizgiler.push(`M${x} ${kenar}V${h - kenar}`);
  for (let y = kenar; y <= h - kenar; y += adim) cizgiler.push(`M${kenar} ${y}H${w - kenar}`);
  return `<path d="${cizgiler.join('')}" stroke="${R.line}.035)" stroke-width="1"/>`;
}

function camKart(x, y, w, h, rx = 28) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#cam)" stroke="url(#kenar)" stroke-width="1.5"/>`;
}

// --- şablonlar -----------------------------------------------------------------

/**
 * taslak: { bicim, sablon, dil, baslik, alt, ozellikler[], cagri, logo }
 * urun:   { ad, renk, simge, adres }
 */
function sablonBaslik(t, u, { w, h, kenar, rtl, hikaye }) {
  const ust = hikaye ? kenar + 180 : kenar;
  const govdeW = w - kenar * 2;
  const x = rtl ? w - kenar : kenar;
  let svg = ustEtiket(`${MARKA}  /  ${u.ad}`, { x: kenar, y: ust, rtl, w });
  const buyuk = h > 1200 ? 96 : 88;
  const basY = ust + 54 + (hikaye ? 280 : h > 1200 ? 180 : 120);
  const baslik = metinBlogu(t.baslik || u.ad, { x, y: basY, genislik: govdeW, boyut: buyuk, agirlik: 700, rtl, enCokSatir: hikaye ? 6 : 4, harfAralik: rtl ? 0 : -2.5 });
  svg += baslik.svg;
  let y = basY + baslik.yukseklik + 44;
  if (t.alt) {
    const alt = metinBlogu(t.alt, { x, y, genislik: govdeW * (hikaye ? 1 : 0.9), boyut: 38, agirlik: 400, renk: R.muted, satirYuk: 1.35, rtl, enCokSatir: 5 });
    svg += alt.svg;
    y += alt.yukseklik + 40;
  }
  // ürün çipi: simge kutusu + ad + çağrı
  const kutu = 76;
  const ky = Math.min(y + 24, h - kenar - 200 - (hikaye ? 150 : 0));
  svg += simgeKutusu(u.simge, rtl ? w - kenar - kutu : kenar, ky, kutu, u.renk);
  svg += `<text x="${rtl ? w - kenar - kutu - 24 : kenar + kutu + 24}" y="${ky + 32}" font-family="${rtl ? AILE.fa.ad : AILE.govde.ad}" font-size="30" font-weight="600" fill="${R.fg}"${rtl ? ' direction="rtl" text-anchor="start"' : ''}>${esc(u.ad)}</text>`;
  if (t.cagri) svg += monoMetin(t.cagri, { x: rtl ? w - kenar - kutu - 24 : kenar + kutu + 24, y: ky + 66, boyut: 24, renk: R.lime, rtl });
  return svg;
}

function sablonOzellikler(t, u, { w, h, kenar, rtl, hikaye }) {
  const ust = hikaye ? kenar + 180 : kenar;
  const govdeW = w - kenar * 2;
  const x = rtl ? w - kenar : kenar;
  let svg = ustEtiket(`${MARKA}  /  ${u.ad}`, { x: kenar, y: ust, rtl, w });
  const basY = ust + 54 + (hikaye ? 160 : 80);
  const baslik = metinBlogu(t.baslik || u.ad, { x, y: basY, genislik: govdeW, boyut: h > 1200 ? 72 : 64, agirlik: 700, rtl, enCokSatir: 3, harfAralik: rtl ? 0 : -2 });
  svg += baslik.svg;
  let y = basY + baslik.yukseklik + 56;
  // cam kart içinde onay listesi
  const ozellikler = (t.ozellikler || []).filter(Boolean).slice(0, hikaye ? 5 : 4);
  const satirBoy = 40;
  const icPad = 44;
  const satirlar = [];
  let icY = 0;
  for (const o of ozellikler) {
    const b = metinBlogu(o, { x: 0, y: 0, genislik: govdeW - icPad * 2 - 60, boyut: satirBoy, agirlik: 500, renk: R.fg, satirYuk: 1.3, rtl, enCokSatir: 2 });
    satirlar.push({ metin: o, yuk: b.yukseklik, kay: icY });
    icY += b.yukseklik + 34;
  }
  const kartH = icY - 34 + icPad * 2;
  svg += camKart(kenar, y, govdeW, kartH);
  for (const s of satirlar) {
    const sy = y + icPad + s.kay;
    const ikonX = rtl ? w - kenar - icPad - 30 : kenar + icPad;
    svg += `<path d="M${ikonX + 4} ${sy + 22}l8 8 16-18" fill="none" stroke="${R.lime}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    svg += metinBlogu(s.metin, { x: rtl ? w - kenar - icPad - 60 : kenar + icPad + 60, y: sy, genislik: govdeW - icPad * 2 - 60, boyut: satirBoy, agirlik: 500, renk: R.fg, satirYuk: 1.3, rtl, enCokSatir: 2 }).svg;
  }
  y += kartH + 40;
  const kutu = 64;
  if (y + kutu < h - kenar - 110 - (hikaye ? 150 : 0)) {
    svg += simgeKutusu(u.simge, rtl ? w - kenar - kutu : kenar, y, kutu, u.renk);
    svg += `<text x="${rtl ? w - kenar - kutu - 20 : kenar + kutu + 20}" y="${y + 28}" font-family="${rtl ? AILE.fa.ad : AILE.govde.ad}" font-size="28" font-weight="600" fill="${R.fg}"${rtl ? ' direction="rtl" text-anchor="start"' : ''}>${esc(u.ad)}</text>`;
    if (t.cagri) svg += monoMetin(t.cagri, { x: rtl ? w - kenar - kutu - 20 : kenar + kutu + 20, y: y + 58, boyut: 22, renk: R.lime, rtl });
  }
  return svg;
}

/** Akış penceresi: ajans hero'sundaki .g-flow'un görsel karşılığı — düğümler, kablolar, durum satırı. */
function sablonAkis(t, u, { w, h, kenar, rtl, hikaye }) {
  const ust = hikaye ? kenar + 180 : kenar;
  const govdeW = w - kenar * 2;
  const x = rtl ? w - kenar : kenar;
  let svg = ustEtiket(`${MARKA}  /  ${u.ad}`, { x: kenar, y: ust, rtl, w });
  const basY = ust + 54 + (hikaye ? 140 : 60);
  const baslik = metinBlogu(t.baslik || u.ad, { x, y: basY, genislik: govdeW, boyut: h > 1200 ? 68 : 60, agirlik: 700, rtl, enCokSatir: 3, harfAralik: rtl ? 0 : -2 });
  svg += baslik.svg;
  let y = basY + baslik.yukseklik + 48;
  // pencere
  const pencereH = Math.min(h > 1200 ? 560 : 470, h - y - kenar - 130 - (hikaye ? 150 : 0));
  svg += camKart(kenar, y, govdeW, pencereH, 32);
  // başlık çubuğu
  const cx = kenar + 34;
  svg += `<circle cx="${cx}" cy="${y + 36}" r="6" fill="${R.line}.18)"/><circle cx="${cx + 22}" cy="${y + 36}" r="6" fill="${R.line}.18)"/><circle cx="${cx + 44}" cy="${y + 36}" r="6" fill="${R.line}.18)"/>`;
  svg += monoMetin(u.ad, { x: cx + 72, y: y + 45, boyut: 24, renk: R.muted, anchor: 'start' });
  svg += `<circle cx="${w - kenar - 44}" cy="${y + 36}" r="6" fill="${R.lime}"/>`;
  svg += monoMetin(t.akisDurum || AKIS_ETIKET.durum[t.dil] || AKIS_ETIKET.durum.en, { x: w - kenar - 62, y: y + 45, boyut: 22, renk: R.lime, anchor: 'end' });
  svg += `<line x1="${kenar + 1}" y1="${y + 72}" x2="${w - kenar - 1}" y2="${y + 72}" stroke="${R.line}.08)"/>`;
  // düğümler: 1 kaynak (ürün) → 2–3 adım (özellikler) → sonuç (çağrı ya da son özellik)
  const adimlar = (t.ozellikler || []).filter(Boolean).slice(0, 3);
  const nodeW = Math.min(280, Math.floor((govdeW - 96 - 2 * 36) / 3)); // üç sütun: kaynak · adımlar · sonuç
  const nodeH = 104;
  const grafY = y + 72;
  const grafH = pencereH - 72;
  const solX = kenar + 48;
  const sagX = w - kenar - 48 - nodeW;
  const ortaX = (w - nodeW) / 2;
  const noktalar = [
    { x: solX, y: grafY + grafH / 2 - nodeH / 2, b: u.ad, k: t.kaynakEtiketi || AKIS_ETIKET.kaynak[t.dil] || AKIS_ETIKET.kaynak.en, simge: u.simge },
  ];
  const adimY = (i, n) => grafY + 40 + (grafH - 80 - nodeH) * (n === 1 ? 0.5 : i / (n - 1));
  adimlar.forEach((a, i) => noktalar.push({ x: adimlar.length > 1 ? ortaX : sagX, y: adimY(i, adimlar.length), b: a, k: `${i + 1}`, adim: true }));
  if (adimlar.length > 1) noktalar.push({ x: sagX, y: grafY + grafH / 2 - nodeH / 2, b: t.cagri || u.ad, k: t.sonucEtiketi || AKIS_ETIKET.sonuc[t.dil] || AKIS_ETIKET.sonuc.en, son: true });
  // kablolar
  const orta = (n) => ({ x: n.x + nodeW / 2, y: n.y + nodeH / 2 });
  const kablo = (a, b) => { const p = orta(a), q = orta(b); const cx1 = p.x + (q.x - p.x) / 2; return `<path d="M${p.x + nodeW / 2} ${p.y} C ${cx1} ${p.y}, ${cx1} ${q.y}, ${q.x - nodeW / 2} ${q.y}" fill="none" stroke="${R.lime}" stroke-opacity=".55" stroke-width="2"/>`; };
  const kaynak = noktalar[0];
  const adimNoktalari = noktalar.filter((n) => n.adim);
  const sonuc = noktalar.find((n) => n.son);
  for (const n of adimNoktalari) { svg += kablo(kaynak, n); if (sonuc) svg += kablo(n, sonuc); }
  // düğüm kutuları: küçük etiket sağ üstte, başlık en çok iki satır; sığmayan uzun kelime (adres) yazıyı küçültür
  for (const n of noktalar) {
    svg += `<rect x="${n.x}" y="${yuvarla(n.y)}" width="${nodeW}" height="${nodeH}" rx="16" fill="${R.ink1}" stroke="${n.son ? R.lime : R.line + '.14)'}" stroke-opacity="${n.son ? .7 : 1}" stroke-width="1.5"/>`;
    if (n.simge) svg += simgeKutusu(n.simge, n.x + 16, n.y + (nodeH - 52) / 2, 52, u.renk);
    const tx = n.simge ? n.x + 84 : n.x + 20;
    const icW = nodeW - (n.simge ? 100 : 40);
    const boyut = sigdir(n.b, icW, 24, 16, { agirlik: 600, rtl });
    const satir = satirKir(n.b, { genislik: icW, boyut, agirlik: 600, rtl, enCokSatir: 2 });
    const ilkY = n.y + nodeH / 2 - ((satir.length - 1) * boyut * 1.15) / 2 + boyut * 0.36;
    satir.forEach((s, i) => { svg += `<text x="${rtl ? n.x + nodeW - 20 : tx}" y="${yuvarla(ilkY + i * boyut * 1.15)}" font-family="${rtl ? AILE.fa.ad : AILE.govde.ad}" font-size="${boyut}" font-weight="600" fill="${R.fg}"${rtl ? ' direction="rtl" text-anchor="start"' : ''}>${esc(s.map((k) => k.metin).join(' '))}</text>`; });
    svg += monoMetin(n.k, { x: rtl ? n.x + 14 : n.x + nodeW - 14, y: n.y + 22, boyut: 15, renk: n.son ? R.lime : R.dim, anchor: rtl ? 'start' : 'end' });
  }
  // alt not
  svg += `<circle cx="${kenar + 36}" cy="${y + pencereH - 30}" r="5" fill="${R.lime}"/>`;
  svg += monoMetin(kes(t.alt || t.cagri || '', govdeW - 110, `400 22px "${AILE.mono.ad}"`), { x: kenar + 54, y: y + pencereH - 22, boyut: 22, renk: R.muted, anchor: 'start' });
  return svg;
}

/** Akış penceresindeki küçük etiketler, içerik dilinde. */
const AKIS_ETIKET = {
  durum: { tr: 'çalışıyor', de: 'läuft', en: 'running', fa: 'فعال' },
  kaynak: { tr: 'kaynak', de: 'Quelle', en: 'source', fa: 'منبع' },
  sonuc: { tr: 'sonuç', de: 'Ergebnis', en: 'result', fa: 'نتیجه' },
};

const SABLON_FN = { baslik: sablonBaslik, ozellikler: sablonOzellikler, akis: sablonAkis };

/**
 * Taslaktan SVG metni. gomulu=true: yazı tipleri data: URI (JPEG için); false: sayfanın @font-face'i (önizleme).
 */
export async function svgUret(taslak, urun, { gomulu = false } = {}) {
  const b = BICIMLER[taslak.bicim] || BICIMLER.dikey;
  const rtl = RTL_DILLER.has(taslak.dil);
  const hikaye = b.ad === 'hikaye';
  const kenar = 72;
  await yaziTipleriniHazirla(rtl);
  const ciz = SABLON_FN[taslak.sablon] || sablonBaslik;
  const stil = gomulu ? `<style>${await gomuluStil(rtl)}</style>` : '';
  const icerik = ciz(taslak, urun, { w: b.w, h: b.h, kenar, rtl, hikaye });
  const govde = zemin({ w: b.w, h: b.h, renk: urun.renk }) + izgara(b.w, b.h, kenar) +
    ortala(icerik, { h: b.h, kenar, hikaye, sablon: taslak.sablon }) +
    (taslak.logo === false ? '' : altBilgi({ w: b.w, h: b.h, kenar, rtl, adres: taslak.adresGoster === false ? '' : (urun.adres || '').replace(/^https?:\/\//, '').replace(/\/$/, ''), hikaye }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${b.w}" height="${b.h}" viewBox="0 0 ${b.w} ${b.h}" role="img">${stil}${govde}</svg>`;
}

/** SVG metni → JPEG Blob (opak zemin). Kalite .92; 1,9 MB'ı aşarsa kalite düşürülür (Worker sınırı). */
export async function jpegUret(svgMetin, { w, h }, { kalite = 0.92, enCokBayt = 1_900_000 } = {}) {
  const img = new Image();
  img.decoding = 'async';
  const url = URL.createObjectURL(new Blob([svgMetin], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    await new Promise((coz, red) => { img.onload = () => coz(); img.onerror = () => red(new Error('svg çizilemedi')); img.src = url; });
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = R.ink0; g.fillRect(0, 0, w, h);
    g.drawImage(img, 0, 0, w, h);
    let k = kalite;
    for (let i = 0; i < 4; i++) {
      const blob = await new Promise((coz) => c.toBlob(coz, 'image/jpeg', k));
      if (!blob) throw new Error('jpeg üretilemedi');
      if (blob.size <= enCokBayt || k <= 0.6) return blob;
      k -= 0.1;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
  throw new Error('jpeg üretilemedi');
}

/** Taslağın varsayılan metinleri: üründen, seçili dilde. Vurgu: başlığın ilk kelimesi. */
export function varsayilanMetinler(urun, dil, metinFn) {
  const ozet = metinFn(urun, 'ozet', dil);
  const ad = urun.ad;
  return {
    baslik: `*${ad}*`,
    alt: ozet,
    ozellikler: (urun.ozellikler?.[dil] || urun.ozellikler?.en || urun.ozellikler?.tr || []).slice(0, 4),
    cagri: metinFn(urun, 'cagri', dil),
  };
}
