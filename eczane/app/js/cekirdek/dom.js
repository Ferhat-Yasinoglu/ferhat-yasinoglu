// DOM yardımcıları. `innerHTML` bilerek yok: her metin textContent üzerinden
// yazılır, hasta adından gelen bir tırnak işareti hiçbir zaman kod olmaz.
import { simge } from './simge.js';
import { qrYolu } from '../paylasilan/qr.js';

export function el(tag, attrs = {}, ...cocuklar) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (['value', 'checked', 'disabled', 'selected', 'hidden'].includes(k)) e[k] = v;
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  ekle(e, cocuklar);
  return e;
}

export function ekle(hedef, cocuklar) {
  for (const c of cocuklar.flat(Infinity)) {
    if (c === null || c === undefined || c === false || c === '') continue;
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

/** Formdaki adlandırılmış alanları nesneye çevirir; onay kutuları boolean olur. */
export function formVerisi(kok) {
  const v = {};
  for (const g of kok.querySelectorAll('[name]')) {
    if (g.type === 'checkbox') v[g.name] = g.checked;
    else if (g.type === 'number') v[g.name] = g.value === '' ? '' : Number(g.value);
    else v[g.name] = typeof g.value === 'string' ? g.value.trim() : g.value;
  }
  return v;
}

/* ---------- Kısa yardımcılar ---------- */
export const btn = (metin, attrs = {}, ...c) => el('button', { type: 'button', class: 'btn', ...attrs }, metin, ...c);
/** Simgeli düğme: btnS('arti', 'İlaç ekle', { class: 'btn btn--birincil' }) */
export const btnS = (ad, metin, attrs = {}, ...c) => btn(simge(ad, { boy: attrs.class?.includes('btn--kucuk') ? 16 : 18 }), attrs, metin, ...c);
export const girdi = (attrs = {}) => el('input', { class: 'input', ...attrs });
export const metinAlani = (attrs = {}) => el('textarea', { class: 'input', rows: 3, ...attrs });
export const secim = (secenekler, attrs = {}) =>
  el('select', { class: 'input', ...attrs }, ...secenekler.map(([v, m]) => el('option', { value: v, selected: String(attrs.value ?? '') === String(v) }, m)));

/** Etiketli form alanı. `hata` dolu gelirse alan kırmızıya döner ve mesaj altta çıkar. */
export function alan(etiket, girdiler, { ipucu, hata, gerekli = false } = {}) {
  const g = Array.isArray(girdiler) ? girdiler : [girdiler];
  if (hata) for (const x of g) if (x?.classList) x.classList.add('input--hata');
  return el('label', { class: 'alan' },
    el('span', { class: 'alan__etiket' }, etiket, gerekli ? el('i', { class: 'alan__yildiz', 'aria-hidden': 'true' }, '*') : null),
    ...g,
    ipucu && !hata ? el('span', { class: 'alan__ipucu' }, ipucu) : null,
    hata ? el('span', { class: 'alan__hata', role: 'alert' }, hata) : null);
}

export const onayKutusu = (etiket, attrs = {}) =>
  el('label', { class: 'onay' }, el('input', { type: 'checkbox', ...attrs }), el('span', {}, etiket));

export const rozet = (metin, tur = 'gri', sec = {}) =>
  el('span', { class: `rozet rozet--${tur}`, title: sec.title }, sec.simge ? simge(sec.simge, { boy: 13 }) : null, metin);

export const kart = (attrs = {}, ...c) => el('section', { class: 'kart', ...attrs }, ...c);

/** Sayfa başlığı: başlık, açıklama, sağda eylem düğmeleri, istenirse geri oku. */
export function sayfaBas(baslik, { alt, eylemler = [], geri } = {}) {
  return el('div', { class: 'sayfa-bas' },
    geri ? btn(simge('geri'), { class: 'btn btn--ikon btn--sade', 'aria-label': 'Geri', onclick: geri }) : null,
    el('div', { class: 'sayfa-bas__govde' }, el('h1', {}, baslik), alt ? el('p', { class: 'sayfa-bas__alt' }, alt) : null),
    eylemler.filter(Boolean).length ? el('div', { class: 'sayfa-bas__eylem' }, ...eylemler.filter(Boolean)) : null);
}

/** Panelde kullanılan sayaç kutusu. `tur` rengi belirler: vurgu/uyari/hata/notr. */
export function sayacKutusu({ baslik, deger, alt, simge: s, tur = 'notr', yol }) {
  const icerik = [
    el('div', { class: 'sayac__ust' }, s ? simge(s, { boy: 18 }) : null, el('span', {}, baslik)),
    el('strong', { class: 'sayac__deger' }, String(deger)),
    alt ? el('span', { class: 'sayac__alt' }, alt) : null,
  ];
  return yol
    ? el('a', { class: `sayac sayac--${tur}`, href: '#' + yol }, ...icerik)
    : el('div', { class: `sayac sayac--${tur}` }, ...icerik);
}

/** Boş liste / hata durumu. */
export function bosDurum({ simge: s = 'bilgi', baslik, alt, eylem, hata = false } = {}) {
  return el('div', { class: 'durum' + (hata ? ' durum--hata' : '') },
    el('div', { class: 'durum__simge' }, simge(s, { boy: 30 })),
    baslik ? el('div', { class: 'durum__baslik' }, baslik) : null,
    alt ? el('p', { class: 'durum__alt' }, alt) : null,
    eylem || null);
}

/** Tablo kurar: basliklar = ['Ad', …], satirlar = [[hücre, …], …] */
export function tablo(basliklar, satirlar, { bos = 'Kayıt yok' } = {}) {
  if (!satirlar.length) return bosDurum({ baslik: bos });
  return el('div', { class: 'tablo-kap' },
    el('table', { class: 'tablo' },
      el('thead', {}, el('tr', {}, ...basliklar.map((b) => el('th', { class: b?.sinif }, b?.ad ?? b)))),
      el('tbody', {}, ...satirlar.map((s) => el('tr', s.attrs || {}, ...(s.hucreler || s).map((h) => el('td', {}, h)))))));
}

/** Liste/ızgara öğelerine sırayla açılma gecikmesi verir. */
export function sirala(kap) {
  kap.classList.add('sirali');
  [...kap.children].forEach((c, i) => c.style.setProperty('--i', String(Math.min(i, 12))));
  return kap;
}

/** Uyarı şeridi: reçete ve ilaç ekranlarında alerji/stok uyarıları için. */
export const uyariSeridi = (uyarilar) =>
  uyarilar.length
    ? el('div', { class: 'uyarilar' }, ...uyarilar.map((u) =>
      el('div', { class: `uyari uyari--${u.tur || 'uyari'}` }, simge(u.tur === 'hata' ? 'hata' : 'uyari', { boy: 16 }), el('span', {}, u.metin))))
    : null;

/* ---------- SVG ve QR ---------- */
const SVG_AD_ALANI = 'http://www.w3.org/2000/svg';

export function svgEl(tag, attrs = {}, ...cocuklar) {
  const e = document.createElementNS(SVG_AD_ALANI, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    e.setAttribute(k, String(v));
  }
  for (const c of cocuklar.flat(Infinity)) if (c) e.appendChild(c);
  return e;
}

/** Metinden QR görseli. İçerik sığmazsa ya da boşsa null döner — çağıran karar verir. */
export function qrGorsel(metin, { boy = 96, sinif = 'qr' } = {}) {
  if (!String(metin || '').trim()) return null;
  try {
    const { yol, boy: kutu } = qrYolu(metin);
    return svgEl('svg', {
      class: sinif, width: boy, height: boy, viewBox: `0 0 ${kutu} ${kutu}`,
      role: 'img', 'aria-label': 'QR',
    }, svgEl('rect', { width: kutu, height: kutu, fill: '#fff' }), svgEl('path', { d: yol, fill: '#000' }));
  } catch (e) {
    console.warn('QR üretilemedi', e);
    return null;
  }
}
