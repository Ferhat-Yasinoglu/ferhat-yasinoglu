// DOM yardımcıları. `innerHTML` bilerek yok: kullanıcı metni her zaman textContent
// üzerinden yazılır, XSS kapısı hiç açılmaz.
import { simge } from './simge.js';

export function el(tag, attrs = {}, ...cocuklar) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') e[k] = v;
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  ekle(e, cocuklar);
  return e;
}

export function ekle(hedef, cocuklar) {
  for (const c of cocuklar.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    hedef.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return hedef;
}

export function temizle(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }

/** Olay delegasyonu: kök içinde `secici`ye uyan en yakın öğe için çağırır. */
export function delegasyon(kok, olay, secici, cb) {
  const h = (e) => { const hedef = e.target.closest(secici); if (hedef && kok.contains(hedef)) cb(e, hedef); };
  kok.addEventListener(olay, h);
  return () => kok.removeEventListener(olay, h);
}

export function formVerisi(form) {
  const v = {};
  for (const [k, d] of new FormData(form).entries()) v[k] = typeof d === 'string' ? d.trim() : d;
  for (const cb of form.querySelectorAll('input[type=checkbox][name]')) v[cb.name] = cb.checked;
  return v;
}

/** Kısa yardımcılar */
export const btn = (metin, attrs = {}, ...c) => el('button', { type: 'button', class: 'btn', ...attrs }, metin, ...c);
/** Simgeli düğme: btnS('indir', 'CSV', { class: 'btn btn--kucuk' }) */
export const btnS = (ad, metin, attrs = {}, ...c) => btn(simge(ad, { boy: attrs.class?.includes('btn--kucuk') ? 16 : 18 }), attrs, metin, ...c);
export const ikon = (s) => el('span', { class: 'ikon', 'aria-hidden': 'true' }, s);
export function alan(etiket, girdi, { ipucu, hata } = {}) {
  return el('label', { class: 'field' }, el('span', { class: 'field__etiket' }, etiket), girdi, ipucu ? el('span', { class: 'field__ipucu' }, ipucu) : null, hata ? el('span', { class: 'field__hata' }, hata) : null);
}
export const girdi = (attrs = {}) => el('input', { class: 'input', ...attrs });
export const secim = (secenekler, attrs = {}) => el('select', { class: 'input', ...attrs }, ...secenekler.map(([v, m]) => el('option', { value: v, selected: attrs.value === v }, m)));
export const metinAlani = (attrs = {}) => el('textarea', { class: 'input', rows: 3, ...attrs });
export function rozet(metin, tur = 'gri') { return el('span', { class: `rozet rozet--${tur}` }, metin); }
export function kart(...c) { return el('section', { class: 'kart' }, ...c); }
export function tarihMetni(iso, dil = 'tr') {
  if (!iso) return '—';
  try { return new Intl.DateTimeFormat(dil, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch { return iso; }
}
export function goreliZaman(iso, t = (k, tr) => tr) {
  if (!iso) return '—';
  const fark = (Date.now() - Date.parse(iso)) / 1000;
  if (fark < 60) return t('zaman.simdi', 'az önce');
  if (fark < 3600) return `${Math.floor(fark / 60)} ${t('zaman.dk', 'dk')}`;
  if (fark < 86400) return `${Math.floor(fark / 3600)} ${t('zaman.sa', 'sa')}`;
  return `${Math.floor(fark / 86400)} ${t('zaman.gun', 'gün')}`;
}

/** Sayfa başlığı bloğu: deco üst etiket, başlık, kısa açıklama, sağda eylem düğmeleri. */
export function sayfaBas(baslik, { alt, eylemler = [], geri, ustEtiket } = {}) {
  return el('div', { class: 'sayfa-bas' },
    geri ? btn(simge('sol'), { class: 'btn btn--ikon btn--sade', 'aria-label': 'Geri', onclick: geri }) : null,
    el('div', { class: 'sayfa-bas__govde' },
      ustEtiket ? el('div', { class: 'sayfa-bas__ust' }, ustEtiket) : null,
      el('h1', {}, baslik),
      alt ? el('p', { class: 'sayfa-bas__alt' }, alt) : null),
    eylemler.filter(Boolean).length ? el('div', { class: 'sayfa-bas__eylem' }, ...eylemler) : null);
}

/* ---------- Marka grafikleri ---------- */
const SVG_NS = 'http://www.w3.org/2000/svg';
export function svgEl(tag, attrs = {}, ...c) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) { if (v === null || v === undefined || v === false) continue; e.setAttribute(k, String(v)); }
  for (const x of c.flat(Infinity)) { if (x) e.appendChild(x); }
  return e;
}

/** Sparkline: sayaç kartının arkasına giden ince altın çizgi + dolgu.
 *  `degerler` en az iki sayı; hepsi eşitse düz çizgi çizer. */
export function sparkline(degerler, { g = 160, y = 40, dolgu = true } = {}) {
  const d = degerler.length >= 2 ? degerler : [0, ...degerler, 0];
  const enB = Math.max(...d), enK = Math.min(...d);
  const araliq = enB - enK || 1;
  const adim = g / (d.length - 1);
  const nokta = d.map((v, i) => [i * adim, y - 3 - ((v - enK) / araliq) * (y - 8)]);
  const cizgi = nokta.map(([x, yy], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${yy.toFixed(1)}`).join(' ');
  const svg = svgEl('svg', { class: 'grafik', viewBox: `0 0 ${g} ${y}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  if (dolgu) svg.appendChild(svgEl('path', { class: 'grafik__alan', d: `${cizgi} L${g} ${y} L0 ${y} Z` }));
  svg.appendChild(svgEl('path', { class: 'grafik__cizgi cizilen', d: cizgi, style: `--uz:${Math.round(g * 1.4)}` }));
  const [sx, sy] = nokta[nokta.length - 1];
  svg.appendChild(svgEl('circle', { class: 'grafik__nokta', cx: sx.toFixed(1), cy: sy.toFixed(1), r: 2.4 }));
  return svg;
}

/** Çubuk grafik: gün gün sayılar. `veri` = [[etiket, sayı], …] */
export function cubukGrafik(veri, { y = 120, etiketli = true } = {}) {
  const enB = Math.max(1, ...veri.map(([, v]) => v));
  const gen = Math.max(veri.length * 26, 160);
  const svg = svgEl('svg', { class: 'grafik', viewBox: `0 0 ${gen} ${y}`, role: 'img' });
  const taban = etiketli ? y - 16 : y - 2;
  svg.appendChild(svgEl('line', { class: 'grafik__eksen', x1: 0, y1: taban, x2: gen, y2: taban }));
  veri.forEach(([et, v], i) => {
    const h = Math.max(2, (v / enB) * (taban - 8));
    const x = i * (gen / veri.length) + 4;
    const w = gen / veri.length - 8;
    svg.appendChild(svgEl('rect', {
      class: 'grafik__cubuk cubuk', x, y: taban - h, width: w, height: h, rx: 3, style: `--i:${i}`,
    }, svgEl('title', {}, document.createTextNode(`${et}: ${v}`))));
    if (etiketli && (veri.length <= 8 || i % 2 === 0)) {
      const t = svgEl('text', { class: 'grafik__yazi', x: x + w / 2, y: y - 3, 'text-anchor': 'middle' });
      t.appendChild(document.createTextNode(et));
      svg.appendChild(t);
    }
  });
  return svg;
}

/** Halka ölçer: 0–1 arası oran. Kurulum ilerlemesi ve puan göstergeleri için. */
export function halka(oran, { boy = 84, kalinlik = 6, yazi } = {}) {
  const r = (boy - kalinlik) / 2, cevre = 2 * Math.PI * r;
  const svg = svgEl('svg', { width: boy, height: boy, viewBox: `0 0 ${boy} ${boy}`, 'aria-hidden': 'true' },
    svgEl('circle', { class: 'halka__iz', cx: boy / 2, cy: boy / 2, r, fill: 'none', 'stroke-width': kalinlik }),
    svgEl('circle', {
      class: 'halka__dolu halka-dolu', cx: boy / 2, cy: boy / 2, r, fill: 'none', 'stroke-width': kalinlik,
      'stroke-dasharray': cevre.toFixed(1),
      'stroke-dashoffset': (cevre * (1 - Math.max(0, Math.min(1, oran)))).toFixed(1),
      style: `--cevre:${cevre.toFixed(1)}`,
    }));
  return el('div', { class: 'halka' }, svg, yazi ? el('span', { class: 'halka__yazi' }, yazi) : null);
}

/** Boş/hata durumu: marka çizimi + başlık + açıklama + eylem. */
export function bosDurum({ simge: s, baslik, alt, eylem, hata } = {}) {
  return el('div', { class: 'durum giris' + (hata ? ' durum--hata' : '') },
    el('div', { class: 'takim-kat', 'aria-hidden': 'true' }),
    s ? el('div', { class: 'durum__simge' }, s) : null,
    baslik ? el('div', { class: 'durum__baslik' }, baslik) : null,
    alt ? el('p', { class: 'durum__alt' }, alt) : null,
    eylem || null);
}

/** Deco etiket: iki yanı altın hatlı, büyük harf küçük başlık. */
export const decoEtiket = (metin, { sol = false } = {}) =>
  el('div', { class: 'deco-etiket' + (sol ? ' deco-etiket--sol' : '') }, el('span', {}, metin));

/** Liste/ızgara öğelerine sırayla açılma gecikmesi verir. */
export function sirala(kap, sinif = 'sirali') {
  kap.classList.add(sinif);
  [...kap.children].forEach((c, i) => c.style.setProperty('--i', String(i)));
  return kap;
}

/** Çok serili çizgi grafik. `seriler` = [{ ad, degerler, renk }]. Renk bir CSS
 *  rengi (ör. 'rgb(var(--vurgu))'); marka tokenları geçerlidir.
 *  DOM ile kurulur — proje genelinde innerHTML kullanılmaz. */
export function cizgiGrafigi(etiketler, seriler, { g = 600, y: yuk = 200 } = {}) {
  const solP = 34, altP = 24, ustP = 12, sagP = 10;
  const enB = Math.max(1, ...seriler.flatMap((x) => x.degerler));
  const kx = (i) => solP + (i / Math.max(1, etiketler.length - 1)) * (g - solP - sagP);
  const ky = (v) => yuk - altP - (v / enB) * (yuk - altP - ustP);

  const svg = svgEl('svg', {
    class: 'grafik', viewBox: `0 0 ${g} ${yuk}`, role: 'img',
    'aria-label': seriler.map((x) => `${x.ad}: ${x.degerler.join(', ')}`).join(' · '),
  });
  // Taban ekseni ve tavan değeri
  svg.appendChild(svgEl('line', { class: 'grafik__eksen', x1: solP, y1: ky(0), x2: g - sagP, y2: ky(0) }));
  const tavan = svgEl('text', { class: 'grafik__yazi', x: 4, y: ustP + 8 });
  tavan.appendChild(document.createTextNode(String(enB)));
  svg.appendChild(tavan);

  for (const [n, x] of seriler.entries()) {
    const d = x.degerler.map((v, i) => `${i ? 'L' : 'M'}${kx(i).toFixed(1)} ${ky(v).toFixed(1)}`).join('');
    svg.appendChild(svgEl('path', {
      d, fill: 'none', stroke: x.renk, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      class: 'cizilen', style: `--uz:${Math.round(g * 1.6)};animation-delay:${n * 140}ms`,
    }));
    for (const [i, v] of x.degerler.entries()) {
      const nokta = svgEl('circle', { cx: kx(i).toFixed(1), cy: ky(v).toFixed(1), r: 3, fill: x.renk });
      const baslik = svgEl('title');
      baslik.appendChild(document.createTextNode(`${x.ad}: ${v}`));
      nokta.appendChild(baslik);
      svg.appendChild(nokta);
    }
  }
  // Tarih etiketleri — sıkışmasın diye seyreltilir.
  const atla = Math.ceil(etiketler.length / 10);
  for (const [i, e] of etiketler.entries()) {
    if (i % atla) continue;
    const t = svgEl('text', { class: 'grafik__yazi', x: kx(i).toFixed(1), y: yuk - 6, 'text-anchor': 'middle' });
    t.appendChild(document.createTextNode(String(e).slice(5)));
    svg.appendChild(t);
  }
  return svg;
}

/** Grafik serisi için renk anahtarı. */
export function grafikAnahtari(seriler) {
  return el('div', { class: 'satir', style: { marginBlockStart: 'var(--b-2)' } },
    ...seriler.map((x) => el('span', { class: 'grafik-anahtar' },
      el('i', { style: { background: x.renk } }), x.ad)));
}
