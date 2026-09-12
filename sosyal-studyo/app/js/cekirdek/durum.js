// Boş / hata / iskelet durumları — her sayfa aynı görünümü kullanır.
import { el, btn } from './dom.js';
export function bos({ simge = '🗂️', baslik, aciklama, eylem }) {
  return el('div', { class: 'durum durum--bos' }, el('div', { class: 'durum__simge', 'aria-hidden': 'true' }, simge), el('h2', {}, baslik), aciklama ? el('p', {}, aciklama) : null, eylem ? btn(eylem.metin, { class: 'btn btn--birincil', onclick: eylem.cb }) : null);
}
export function hataDurumu({ mesaj, yenidenDene }) {
  return el('div', { class: 'durum durum--hata' }, el('p', {}, '⚠️ ', mesaj), yenidenDene ? btn('Yeniden dene', { onclick: yenidenDene }) : null);
}
export function iskelet(satir = 3) { return el('div', { class: 'durum durum--iskelet', 'aria-busy': 'true' }, ...Array.from({ length: satir }, () => el('div', { class: 'iskelet-satir' }))); }
