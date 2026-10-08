// Daha: dil, görünüm, bağlantı durumu (doktor), hesap ve çıkış, depolama, hakkında.
import { h, doldur, bildir } from '../dom.js';
import { simge } from '../simge.js';
import { dil, dilSec } from '../i18n.js';
import { tema, temaSec } from '../tema.js';
import { cikis, kanallar, durum } from '../api.js';
import * as depo from '../depo.js';
import { BUSINESS_SUITE, INSTAGRAM, SUNUCU } from '../ayar.js';
import { kanalCipi } from './ortak.js';

export async function dahaEkrani(kap, a, ctx) {
  const { t } = ctx;

  const satir = (etiket, deger, ...eylem) => h('div', { class: 'satir satir--arasi', style: { padding: '12px 0', borderBlockEnd: '1px solid rgb(var(--line) / .06)' } }, h('span', {}, h('b', {}, etiket), deger ? h('span', { class: 'kart__alt', style: { display: 'block' } }, deger) : null), h('span', { class: 'satir' }, ...eylem));

  const dilSecimi = h('div', { class: 'secim' },
    ...[['tr', 'Türkçe'], ['fa', 'دری']].map(([d, ad]) => h('button', { type: 'button', class: ['secim__ogesi', dil() === d ? 'secili' : ''], onclick: () => dilSec(d) }, ad)));
  const temaSecimi = h('div', { class: 'secim' },
    ...[['gece', 'ay', t('daha.gece')], ['gunduz', 'gunes', t('daha.gunduz')]].map(([k, s, ad]) => h('button', { type: 'button', class: ['secim__ogesi', tema() === k ? 'secili' : ''], onclick: () => { temaSec(k); ctx.yenidenCiz(); } }, simge(s, { boyut: 18 }), ad)));

  // doktor
  const doktor = h('div', {});
  (async () => {
    const satirlar = [];
    if (ctx.kip !== 'bagli') {
      satirlar.push(satir(t('daha.sunucu'), SUNUCU || t('daha.ayni_koken'), kanalCipi('yerel', t)));
      satirlar.push(h('p', { class: 'g-note', style: { marginTop: '10px' } }, t('kip.yerel_aciklama')));
    } else {
      let d = ctx.sunucu;
      try { d = await durum(true); } catch { /* eski bilgi kalır */ }
      satirlar.push(satir(t('daha.sunucu'), SUNUCU || t('daha.ayni_koken'), kanalCipi('calisir', t)));
      satirlar.push(satir(t('daha.google'), d?.istemciKimligi ? t('daha.ayarli') : t('daha.ayarsiz'), kanalCipi(d?.istemciKimligi ? 'calisir' : 'kapali', t)));
      try {
        const k = await kanallar();
        satirlar.push(satir('Instagram', k.instagram?.bagli ? (k.instagram.yol === 'instagram' ? t('daha.ig_yolu_ig') : t('daha.ig_yolu_fb')) : t('daha.kanal_kapali_not'), kanalCipi(!k.instagram?.bagli ? 'kapali' : k.prova ? 'prova' : 'calisir', t)));
        satirlar.push(satir('Facebook', k.facebook?.bagli ? t('daha.sayfa', { id: k.facebook.sayfaId || '' }) : t('daha.kanal_kapali_not'), kanalCipi(!k.facebook?.bagli ? 'kapali' : k.prova ? 'prova' : 'calisir', t)));
        if (k.prova) satirlar.push(h('p', { class: 'g-note', style: { marginTop: '10px' } }, t('paylas.prova_not')));
      } catch { satirlar.push(h('p', { class: 'g-note' }, t('paylas.kanal_okunamadi'))); }
      if (d?.gelistirme) satirlar.push(h('p', { class: 'denetim__oge denetim__oge--uyari', style: { marginTop: '10px' } }, simge('uyari'), t('daha.gelistirme_uyari')));
    }
    doldur(doktor, ...satirlar);
  })();

  const kap_ = await depo.kapasite();
  const kullanici = ctx.kullanici;

  doldur(kap,
    h('header', { class: 'g-head' }, h('p', { class: 'eyebrow' }, t('daha.ust')), h('h1', { style: { marginTop: '10px' } }, t('menu.daha'))),
    h('div', { class: 'izgara' },
      h('div', { class: 'glass' }, h('h2', { class: 'kart__baslik', style: { marginBottom: '12px' } }, t('daha.gorunum')),
        satir(t('dil'), t('daha.dil_not'), dilSecimi),
        satir(t('daha.tema'), '', temaSecimi)),
      h('div', { class: 'glass' }, h('h2', { class: 'kart__baslik', style: { marginBottom: '12px' } }, t('daha.baglanti')), doktor,
        h('a', { class: 'btn btn--kucuk btn--hayalet', href: '#/kurulum', style: { marginTop: '14px' } }, simge('kalkan', { boyut: 16 }), t('daha.kurulum'))),
      h('div', { class: 'glass' }, h('h2', { class: 'kart__baslik', style: { marginBottom: '12px' } }, t('daha.hesap')),
        kullanici ? satir(kullanici.ad || kullanici.eposta, kullanici.eposta, h('button', { class: 'btn btn--kucuk btn--hayalet btn--tehlike', type: 'button', onclick: async () => { if (confirm(t('cikis_onay'))) { await cikis(); location.hash = '#/projeler'; ctx.yenidenCiz(); } } }, simge('cikis', { boyut: 16 }), t('cikis'))) : h('p', { class: 'kart__alt' }, t('daha.hesap_yok')),
        kap_ ? satir(t('daha.depolama'), `${(kap_.kullanilan / 1048576).toFixed(1)} MB / ${(kap_.toplam / 1048576).toFixed(0)} MB`) : null),
      h('div', { class: 'glass' }, h('h2', { class: 'kart__baslik', style: { marginBottom: '12px' } }, t('daha.baglantilar')),
        satir('Meta Business Suite', t('daha.suite_not'), h('a', { class: 'btn btn--kucuk btn--hayalet', href: BUSINESS_SUITE, target: '_blank', rel: 'noopener' }, simge('harici', { boyut: 16 }), t('ac'))),
        satir('Instagram', '@farhad___yaqoobi', h('a', { class: 'btn btn--kucuk btn--hayalet', href: INSTAGRAM, target: '_blank', rel: 'noopener' }, simge('harici', { boyut: 16 }), t('ac'))),
        h('p', { class: 'g-note', style: { marginTop: '12px' } }, t('daha.hakkinda')))));
}
