// Projeler: ürün kartları. Birine dokununca o ürün için yeni taslak açılır (Tasarla).
import { h, doldur } from '../dom.js';
import { simge } from '../simge.js';
import { URUNLER, metin } from '../paylasilan/urunler.js';
import { dil } from '../i18n.js';

const DIL_ADI = { tr: 'TR', de: 'DE', en: 'EN', fa: 'دری' };

export async function projelerEkrani(kap, a, ctx) {
  const { t, git } = ctx;
  const yeni = a.sorgu.get('yeni') === '1';
  const uiDil = dil();

  const kartlar = URUNLER.map((u, i) => h('button', {
    class: 'glass urun-kart', type: 'button', 'data-reveal': '', style: { '--renk': u.renk },
    onclick: () => git(`#/tasarla/${u.anahtar}`),
  },
    h('span', { class: 'icon-box icon-box--renk' }, simge(u.simge, { boyut: 22 })),
    h('span', { class: 'urun-kart__govde' },
      h('span', { class: 'satir satir--arasi' },
        h('span', { class: 'kart__baslik' }, u.ad),
        u.yayinda ? null : h('span', { class: 'chip chip--uyari' }, t('urun.yakinda'))),
      h('span', { class: 'kart__alt' }, metin(u, 'ozet', uiDil === 'fa' ? 'fa' : 'tr')),
      h('span', { class: 'satir' },
        ...u.kitle.map((d) => h('span', { class: 'chip' }, DIL_ADI[d] || d)),
        h('span', { class: 'chip', style: { marginInlineStart: 'auto' } }, simge('ileri', { boyut: 14 }), t('urun.tasarla')))),
    h('span', { class: 'ghost-num' }, String(i + 1).padStart(2, '0'))));

  doldur(kap,
    h('header', { class: 'g-head g-head--yan' },
      h('div', {},
        h('p', { class: 'eyebrow' }, yeni ? t('projeler.yeni_ust') : t('projeler.ust')),
        h('h1', { style: { marginTop: '10px' } }, t('projeler.baslik_1'), ' ', h('span', { class: 'vurgu' }, t('projeler.baslik_vurgu')))),
      h('p', {}, t('projeler.aciklama'))),
    ctx.kip === 'yerel' ? h('div', { class: 'g-tag' }, h('i', { class: 'g-tag__sq', 'aria-hidden': 'true' }), t('kip.yerel_kisa'), h('span', { class: 'g-tag__sep' }, '/'), t('kip.yerel_aciklama')) : null,
    h('div', { class: 'izgara' }, ...kartlar));
}
