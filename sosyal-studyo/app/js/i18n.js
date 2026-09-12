// i18n: Türkçe kaynak metin kodda, diğer diller ./i18n/<dil>.json'dan çalışma
// zamanında yüklenir. Sözlük yoksa ya da anahtar eksikse Türkçe görünür — uygulama
// hiçbir zaman "anahtar.adı" göstermez. fy-ajans'ın data-i18n modeliyle uyumlu.
export const DILLER = [['tr', 'Türkçe'], ['de', 'Deutsch'], ['en', 'English'], ['fa', 'فارسی']];
let sozluk = {};
let dil = 'tr';
const uyarilan = new Set();

export function suankiDil() { return dil; }

export async function yukle(yeniDil) {
  dil = DILLER.some(([k]) => k === yeniDil) ? yeniDil : 'tr';
  sozluk = {};
  if (dil !== 'tr') {
    try { const r = await fetch(`./i18n/${dil}.json`, { cache: 'no-cache' }); if (r.ok) sozluk = await r.json(); }
    catch (e) { console.warn('sözlük yüklenemedi', dil, e); }
  }
  document.documentElement.lang = dil;
  document.documentElement.dir = dil === 'fa' ? 'rtl' : 'ltr';
  try { localStorage.setItem('ss-lang', dil); } catch {}
  document.dispatchEvent(new CustomEvent('dil-degisti', { detail: { dil } }));
  return dil;
}

/** t('nav.akislar', 'Akışlar') — sözlükte yoksa Türkçe. `{n}` yer tutucuları doldurulur. */
export function t(anahtar, tr, degerler) {
  let s = dil === 'tr' ? tr : (sozluk[anahtar] ?? null);
  if (s === null) { s = tr; if (!uyarilan.has(anahtar)) { uyarilan.add(anahtar); } }
  if (degerler) s = s.replace(/\{(\w+)\}/g, (_, k) => (degerler[k] ?? ''));
  return s;
}

/** Statik işaretlemedeki data-i18n öğelerini çevirir. */
export function uygula(kok = document) {
  for (const e of kok.querySelectorAll('[data-i18n]')) { const a = e.dataset.i18n; const tr = e.dataset.i18nTr ?? (e.dataset.i18nTr = e.textContent); e.textContent = t(a, tr); }
  for (const e of kok.querySelectorAll('[data-i18n-attr]')) { for (const parca of e.dataset.i18nAttr.split(';')) { const [oz, a] = parca.split('='); const kaynak = e.dataset['i18nTr_' + oz] ?? (e.dataset['i18nTr_' + oz] = e.getAttribute(oz)); e.setAttribute(oz, t(a, kaynak)); } }
}

export const sayi = (n) => new Intl.NumberFormat(dil).format(n);
export const tarih = (d, sec = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat(dil, sec).format(d instanceof Date ? d : new Date(d));
