// Projeler: ürün kartları. Birine dokununca o ürün için yeni taslak açılır (Tasarla).
import { h, doldur } from '../dom.js';
import { simge } from '../simge.js';
import { URUNLER, metin } from '../paylasilan/urunler.js';
import { gununUrunu, onumuzdekiGunler, bugunYapildi, gunMetni } from '../paylasilan/sira.js';
import * as depo from '../depo.js';
import { kayitlar } from '../api.js';
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

  // Günün ürünü: iki kişi aynı günü görür (Avrupa/Berlin). Yapıldı mı: bu cihazın kaydı + bağlıysa ortak kayıt.
  const bugun = gunMetni();
  const gunun = gununUrunu(URUNLER, bugun);
  const bugunKarti = h('section', { class: 'glass glass--guclu', 'data-reveal': '' });
  if (gunun) {
    const u = gunun.urun;
    const durumCipi = h('span', { class: 'chip' }, t('bugun.bekliyor'));
    const serit = h('div', { class: 'satir', style: { gap: '6px' } }, ...onumuzdekiGunler(URUNLER, 7, bugun).slice(1).map((g) => h('span', { class: 'chip', title: g.gun }, h('span', { class: 'renk-nokta', style: { '--renk': g.urun.renk, width: '7px', height: '7px' } }), g.urun.ad)));
    doldur(bugunKarti,
      h('div', { class: 'satir satir--arasi', style: { marginBottom: '12px' } },
        h('p', { class: 'eyebrow' }, t('bugun.ust', { gun: new Intl.DateTimeFormat(uiDil === 'fa' ? 'fa-AF' : 'tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()) })),
        durumCipi),
      h('div', { class: 'urun-kart', style: { '--renk': u.renk } },
        h('span', { class: 'icon-box icon-box--renk' }, simge(u.simge, { boyut: 22 })),
        h('div', { class: 'urun-kart__govde' },
          h('h2', {}, t('bugun.baslik'), ' ', h('span', { class: 'vurgu' }, u.ad)),
          h('p', { class: 'kart__alt' }, metin(u, 'ozet', uiDil === 'fa' ? 'fa' : 'tr')),
          h('div', { class: 'dugmeler', style: { marginTop: '8px' } },
            h('button', { class: 'btn btn--birincil', type: 'button', onclick: () => git(`#/tasarla/${u.anahtar}`) }, simge('kivilcim', { boyut: 18 }), t('bugun.hazirla')),
            h('a', { class: 'btn btn--hayalet btn--kucuk', href: '#/kayit' }, simge('kayit', { boyut: 16 }), t('menu.kayit'))))),
      h('p', { class: 'g-note', style: { marginTop: '14px', marginBottom: '6px' } }, t('bugun.siradakiler')),
      serit);
    (async () => {
      const yerel = await depo.listele('kayit', 100);
      let ortak = [];
      if (ctx.kip === 'bagli') { try { ortak = (await kayitlar(100)).kayitlar || []; } catch { /* ortak kayıt yoksa yerel yeter */ } }
      if (bugunYapildi([...yerel, ...ortak], u.anahtar, bugun)) { durumCipi.textContent = t('bugun.yapildi'); durumCipi.className = 'chip chip--ok'; }
    })();
  }

  doldur(kap,
    h('header', { class: 'g-head g-head--yan' },
      h('div', {},
        h('p', { class: 'eyebrow' }, yeni ? t('projeler.yeni_ust') : t('projeler.ust')),
        h('h1', { style: { marginTop: '10px' } }, t('projeler.baslik_1'), ' ', h('span', { class: 'vurgu' }, t('projeler.baslik_vurgu')))),
      h('p', {}, t('projeler.aciklama'))),
    ctx.kip === 'yerel' ? h('div', { class: 'g-tag' }, h('i', { class: 'g-tag__sq', 'aria-hidden': 'true' }), t('kip.yerel_kisa'), h('span', { class: 'g-tag__sep' }, '/'), t('kip.yerel_aciklama')) : null,
    gunun ? bugunKarti : null,
    h('div', { class: 'izgara' }, ...kartlar));
}
