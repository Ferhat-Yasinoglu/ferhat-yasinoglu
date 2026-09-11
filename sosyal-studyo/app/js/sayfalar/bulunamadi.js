import { el, btn } from '../cekirdek/dom.js';
export default { baslik: 'Bulunamadı', cizim(kok, ctx) { kok.replaceChildren(el('h1', {}, ctx.t('bulunamadi.baslik', 'Sayfa bulunamadı')), el('p', {}, ctx.yol), btn(ctx.t('bulunamadi.ozet', 'Özete dön'), { class: 'btn btn--birincil', onclick: () => ctx.git('/ozet') })); } };
