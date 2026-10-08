// Küçük DOM yardımcıları. innerHTML hiç kullanılmaz: ürün adı, gönderi metni ve
// Google'dan gelen her metin textContent olarak girer (XSS kapısı yok; tools/kontrol.mjs denetler).

const SVG_NS = 'http://www.w3.org/2000/svg';

function oznitelikler(el, oz, svg) {
  for (const [a, d] of Object.entries(oz || {})) {
    if (d === false || d === null || d === undefined) continue;
    if (a.startsWith('on') && typeof d === 'function') el.addEventListener(a.slice(2), d);
    else if (a === 'class') el.setAttribute('class', Array.isArray(d) ? d.filter(Boolean).join(' ') : d);
    else if (a === 'style' && typeof d === 'object') for (const [k, v] of Object.entries(d)) el.style.setProperty(k, v);
    else if (a === 'dataset' && typeof d === 'object') for (const [k, v] of Object.entries(d)) el.dataset[k] = v;
    else if (!svg && a === 'value') el.value = d;
    else if (!svg && a === 'checked') el.checked = !!d;
    else if (!svg && a === 'selected') el.selected = !!d;
    else el.setAttribute(a, d === true ? '' : String(d));
  }
}

function ekle(el, cocuklar) {
  for (const c of cocuklar) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) ekle(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/**
 * h('button', { class: 'btn', onclick: f, style: { '--i': 2 } }, 'Kaydet', çocuk…)
 * Öznitelik değeri false/null/undefined ise yazılmaz; `on…` olay dinleyicisi;
 * `class` dizi olabilir (boşlar atılır); `style` nesneyse CSS özellikleri tek tek.
 */
export function h(etiket, oz = {}, ...cocuklar) {
  const el = document.createElement(etiket);
  oznitelikler(el, oz, false);
  ekle(el, cocuklar);
  return el;
}

/** SVG öğesi: s('path', { d: '…' }). */
export function s(etiket, oz = {}, ...cocuklar) {
  const el = document.createElementNS(SVG_NS, etiket);
  oznitelikler(el, oz, true);
  ekle(el, cocuklar);
  return el;
}

/** Kabın içini verilen çocuklarla değiştirir. */
export function doldur(kap, ...cocuklar) {
  kap.replaceChildren();
  ekle(kap, cocuklar);
  return kap;
}

/** Bir SVG metnini (güvenilir, kendi şablonumuz) DOM'a ayrıştırır; dış kaynak yok. */
export function svgCoz(metin) {
  const belge = new DOMParser().parseFromString(metin, 'image/svg+xml');
  const hata = belge.querySelector('parsererror');
  if (hata) throw new Error('svg: ' + hata.textContent.slice(0, 120));
  return document.importNode(belge.documentElement, true);
}

/** Kullanıcı "hareketi azalt" demiş mi. */
export const sakin = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Tarih/saat: kısa, yerel. */
export function zamanMetni(iso, dil = 'tr') {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(dil === 'fa' ? 'fa-AF' : 'tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
}

/** Panoya kopyalar; başaramazsa false (eski tarayıcı, izin yok). */
export async function kopyala(metin) {
  try { await navigator.clipboard.writeText(metin); return true; } catch { return false; }
}

/** Dosya indirir (Blob → <a download>). */
export function indir(blob, ad) {
  const u = URL.createObjectURL(blob);
  const a = h('a', { href: u, download: ad });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 10_000);
}

/** Küçük geçici bildirim (altta). */
let bildirimZamanlayici;
export function bildir(metin, tur = 'bilgi') {
  let kap = document.getElementById('bildirim');
  if (!kap) { kap = h('div', { id: 'bildirim', role: 'status', 'aria-live': 'polite' }); document.body.append(kap); }
  doldur(kap, h('span', { class: ['bildirim', `bildirim--${tur}`] }, metin));
  kap.classList.add('acik');
  clearTimeout(bildirimZamanlayici);
  bildirimZamanlayici = setTimeout(() => kap.classList.remove('acik'), 3200);
}
