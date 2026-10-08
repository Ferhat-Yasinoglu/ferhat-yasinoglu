// Ekranların paylaştığı küçük parçalar.
import { h } from '../dom.js';
import { simge } from '../simge.js';

/** Tasarla → Metin → Paylaş adım göstergesi. */
export function adimGostergesi(adim, t) {
  const adimlar = [t('adim.tasarla'), t('adim.metin'), t('adim.paylas')];
  const parcalar = [];
  adimlar.forEach((ad, i) => {
    if (i) parcalar.push(h('i', { 'aria-hidden': 'true' }));
    parcalar.push(h('span', { class: ['adim', i + 1 === adim ? 'secili' : ''] }, h(i + 1 === adim ? 'b' : 'span', {}, String(i + 1)), h('span', { class: 'adim__ad' }, ad)));
  });
  return h('span', { class: 'adimlar', 'aria-label': t('adim.etiket', { n: adim }) }, ...parcalar);
}

/** Boş durum kartı. */
export function bosDurum({ simgeAdi = 'taslak', baslik, aciklama, eylem }) {
  return h('div', { class: 'glass bos' }, h('span', { class: 'icon-box' }, simge(simgeAdi, { boyut: 26 })), h('h2', {}, baslik), aciklama ? h('p', {}, aciklama) : null, eylem || null);
}

/** Kanal etiketi: çalışır / prova / kapalı. */
export function kanalCipi(durum, t) {
  const sinif = { calisir: 'chip--ok', prova: 'chip--uyari', kapali: 'chip--hata', yerel: 'chip' }[durum] || 'chip';
  return h('span', { class: ['chip', sinif] }, t(`kanal.${durum}`));
}
