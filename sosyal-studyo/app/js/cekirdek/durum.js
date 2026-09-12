// Boş / hata / iskelet durumları — her sayfa aynı görünümü kullanır.
// Boş durumun arkasında markanın takımyıldız dokusu var: sayfa boşken bile ölü görünmez.
import { el, btn } from './dom.js';
import { simge } from './simge.js';

export function bos({ simge: ad = 'kutu', baslik, aciklama, eylem }) {
  return el('div', { class: 'durum durum--bos giris' },
    el('div', { class: 'takim-kat', 'aria-hidden': 'true' }),
    el('div', { class: 'durum__simge' }, typeof ad === 'string' ? simge(ad, { boy: 44 }) : ad),
    el('div', { class: 'durum__baslik' }, baslik),
    aciklama ? el('p', { class: 'durum__alt' }, aciklama) : null,
    eylem ? btn(eylem.metin, { class: 'btn btn--birincil', onclick: eylem.cb }) : null);
}

export function hataDurumu({ mesaj, yenidenDene }) {
  return el('div', { class: 'durum durum--hata giris' },
    el('div', { class: 'durum__simge' }, simge('hata', { boy: 40 })),
    el('p', { class: 'durum__alt' }, mesaj),
    yenidenDene ? btn('Yeniden dene', { onclick: yenidenDene }) : null);
}

export function iskelet(satir = 3) {
  return el('div', { class: 'durum durum--iskelet', 'aria-busy': 'true', style: { padding: '0', border: '0', background: 'none' } },
    ...Array.from({ length: satir }, () => el('div', { class: 'iskelet-satir' })));
}
