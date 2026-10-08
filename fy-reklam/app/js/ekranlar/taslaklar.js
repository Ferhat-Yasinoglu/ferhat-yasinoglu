// Taslaklar: bu cihazda duran taslaklar; aç, sil.
import { h, doldur, zamanMetni, bildir } from '../dom.js';
import { simge } from '../simge.js';
import { urunBul } from '../paylasilan/urunler.js';
import * as depo from '../depo.js';
import { dil } from '../i18n.js';
import { bosDurum } from './ortak.js';

export async function taslaklarEkrani(kap, a, ctx) {
  const { t, git } = ctx;
  const liste = h('div', { class: 'sutun' });

  async function ciz() {
    const taslaklar = await depo.listele('taslaklar');
    if (!taslaklar.length) {
      doldur(liste, bosDurum({ simgeAdi: 'taslak', baslik: t('taslaklar.bos'), aciklama: t('taslaklar.bos_aciklama'), eylem: h('a', { class: 'btn btn--birincil', href: '#/projeler' }, simge('arti', { boyut: 18 }), t('taslaklar.yeni')) }));
      return;
    }
    doldur(liste, ...taslaklar.map((ts) => {
      const u = urunBul(ts.urun) || { ad: ts.urun, renk: '#999', simge: 'paket' };
      return h('div', { class: 'glass glass--sik urun-kart', style: { '--renk': u.renk } },
        h('span', { class: 'icon-box icon-box--renk' }, simge(u.simge, { boyut: 22 })),
        h('div', { class: 'urun-kart__govde' },
          h('div', { class: 'satir satir--arasi' },
            h('span', { class: 'kart__baslik' }, (ts.baslik || u.ad).replace(/\*/g, '')),
            h('span', { class: ['chip', ts.durum === 'yayinlandi' ? 'chip--ok' : ts.durum === 'paylasildi' ? 'chip--secili' : ''] }, t(`taslak_durum.${ts.durum || 'taslak'}`))),
          h('span', { class: 'kart__alt' }, `${u.ad} · ${t(`bicim.${ts.bicim}`)} · ${t(`sablon.${ts.sablon}`)} · ${(ts.dil || '').toUpperCase()}`),
          h('span', { class: 'kayit__zaman' }, zamanMetni(ts.guncellendi, dil())),
          h('div', { class: 'satir', style: { marginTop: '6px' } },
            h('a', { class: 'btn btn--kucuk btn--birincil', href: `#/tasarla/t/${ts.id}` }, simge('kalem', { boyut: 16 }), t('taslaklar.ac')),
            h('a', { class: 'btn btn--kucuk btn--hayalet', href: `#/paylas/${ts.id}` }, simge('paylas', { boyut: 16 }), t('menu_kisa.paylas')),
            h('button', { class: 'btn btn--kucuk btn--ikon btn--sade', type: 'button', 'aria-label': t('sil'), onclick: async () => { if (confirm(t('taslaklar.sil_onay'))) { await depo.sil('taslaklar', ts.id); bildir(t('silindi')); ciz(); } } }, simge('sil', { boyut: 18 })))));
    }));
  }

  doldur(kap,
    h('header', { class: 'g-head g-head--yan' },
      h('div', {}, h('p', { class: 'eyebrow' }, t('taslaklar.ust')), h('h1', { style: { marginTop: '10px' } }, t('taslaklar.baslik'))),
      h('p', {}, t('taslaklar.aciklama'))),
    liste);
  ciz();
}
