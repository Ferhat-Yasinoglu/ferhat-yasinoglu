// DOM yardımcıları. `innerHTML` bilerek yok: kullanıcı metni her zaman textContent
// üzerinden yazılır, XSS kapısı hiç açılmaz.
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

/** Sayfa başlığı bloğu: başlık, kısa açıklama, sağda eylem düğmeleri. */
export function sayfaBas(baslik, { alt, eylemler = [], geri } = {}) {
  return el('div', { class: 'sayfa-bas' },
    geri ? btn('←', { class: 'btn btn--ikon btn--sade', 'aria-label': 'Geri', onclick: geri }) : null,
    el('div', { class: 'sayfa-bas__govde' }, el('h1', {}, baslik), alt ? el('p', { class: 'sayfa-bas__alt' }, alt) : null),
    eylemler.filter(Boolean).length ? el('div', { class: 'sayfa-bas__eylem' }, ...eylemler) : null);
}
