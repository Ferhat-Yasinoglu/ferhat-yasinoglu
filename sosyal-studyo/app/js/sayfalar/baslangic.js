// İlk kurulum: üç adımlı karşılama. Dil → başlangıç modu → kanallar. 60 saniyede Özet'e.
import { el, btn, kart, rozet, temizle, ekle } from '../cekirdek/dom.js';
import { DILLER } from '../i18n.js';
import { KANALLAR } from '../paylasilan/kanallar.js';
import { tohumla } from '../depo/tohum.js';

export default {
  baslik: 'Başlangıç',
  async cizim(kok, ctx) {
    const { depo, t, git } = ctx;
    temizle(kok);
    let adim = 1;
    const govde = el('div', {});
    const gosterge = el('div', { class: 'satir', style: { justifyContent: 'center', marginBlockEnd: '24px' } });
    function gostergeCiz() {
      temizle(gosterge);
      [t('baslangic.dil_kisa', 'Dil'), t('baslangic.mod_kisa', 'Başlangıç'), t('baslangic.kanal_kisa', 'Kanallar')].forEach((ad, i) => {
        const n = i + 1;
        ekle(gosterge, [el('span', { class: 'cip' + (n === adim ? ' cip--secili' : ''), style: n < adim ? { color: 'rgb(var(--yesil))', borderColor: 'rgb(var(--yesil) / .4)' } : null }, (n < adim ? '✓ ' : `${n} · `) + ad), i < 2 ? el('span', { style: { color: 'rgb(var(--metin-3))' } }, '→') : null]);
      });
    }
    function ciz() {
      temizle(govde); gostergeCiz();
      if (adim === 1) govde.append(
        el('h2', { style: { textAlign: 'center', marginBlockStart: 0 } }, t('baslangic.dil', 'Hangi dilde kullanmak istersin?')),
        el('div', { class: 'izgara izgara--dar', style: { maxWidth: '640px', marginInline: 'auto' } }, ...DILLER.map(([k, ad]) => btn(ad, { class: 'btn btn--tam', style: { minHeight: '56px', fontSize: 'var(--f-l)' }, onclick: async () => { await ctx.dilDegistir(k, { yenidenCiz: false }); adim = 2; ciz(); } }))));
      if (adim === 2) govde.append(
        el('h2', { style: { textAlign: 'center', marginBlockStart: 0 } }, t('baslangic.nasil', 'Nasıl başlayalım?')),
        el('div', { class: 'izgara', style: { maxWidth: '760px', marginInline: 'auto' } },
          el('section', { class: 'kart kart--vurgu' }, el('div', { style: { fontSize: '2rem' } }, '🧪'), el('h3', { class: 'kart__baslik' }, t('baslangic.hemen', 'Hemen dene')), el('p', { class: 'kart__alt', style: { margin: 0 } }, t('baslangic.hemen_aciklama', 'Yerel mod + demo verisi. Worker gerekmez; akış kur, simülatörde dene, içerik üret.')), btn(t('baslangic.hemen_btn', 'Demo ile başla'), { class: 'btn btn--birincil', onclick: async () => { await tohumla(depo); await depo.ayarKaydet('mod', 'yerel'); adim = 3; ciz(); } })),
          el('section', { class: 'kart' }, el('div', { style: { fontSize: '2rem' } }, '☁️'), el('h3', { class: 'kart__baslik' }, t('baslangic.worker', 'Worker\'a bağlan')), el('p', { class: 'kart__alt', style: { margin: 0 } }, t('baslangic.worker_aciklama', 'Cloudflare Worker adresin ve yönetici anahtarın varsa kanallar ve AI açılır. Sonra da yapabilirsin.')), btn(t('baslangic.worker_btn', 'Ayarlar → Worker'), { onclick: async () => { await depo.ayarKaydet('ilk_kurulum_tamam', 1); git('/ayarlar/worker'); } }))));
      if (adim === 3) govde.append(
        el('h2', { style: { textAlign: 'center', marginBlockStart: 0 } }, t('baslangic.kanallar', 'Hangi kanallar çalışır?')),
        el('p', { class: 'kart__alt', style: { textAlign: 'center', maxWidth: '56ch', marginInline: 'auto' } }, t('baslangic.kanallar_aciklama', 'Dürüst etiketler: bazı kanallar hemen çalışır, bazıları platform onayı ister. Hepsini sonra Ayarlar → Kurulum\'dan bağlayabilirsin.')),
        el('div', { class: 'izgara izgara--dar', style: { maxWidth: '880px', marginInline: 'auto' } }, ...Object.values(KANALLAR).map((k) => kart(el('div', { class: 'satir satir--arasi' }, el('span', { class: 'kart__baslik' }, `${k.simge} ${k.ad}`), rozet(k.etiket.ad, k.etiket.renk)), el('p', { class: 'kart__alt', style: { margin: 0 } }, k.ozet)))),
        el('div', { style: { textAlign: 'center', marginBlockStart: '24px' } }, btn(t('baslangic.ozete', 'Özete git') + ' →', { class: 'btn btn--birincil', style: { minWidth: '220px', minHeight: '52px' }, onclick: async () => { await depo.ayarKaydet('ilk_kurulum_tamam', 1); ctx.yenileBantlar(); git('/ozet'); } })));
    }
    kok.append(
      el('div', { style: { textAlign: 'center', paddingBlock: '16px 8px' } },
        el('img', { src: './img/logo.svg', alt: '', width: 56, height: 56, style: { borderRadius: '14px', boxShadow: 'var(--golge-2)' } }),
        el('h1', { style: { marginBlockStart: '16px' } }, t('baslangic.baslik', 'Sosyal Stüdyo\'ya hoş geldin')),
        el('p', { class: 'kart__alt', style: { maxWidth: '54ch', marginInline: 'auto', marginBlockEnd: '24px' } }, t('baslangic.alt', 'Akışlar, kişiler, toplu mesaj ve içerik araçları — sunucusuz, çerçevesiz, kaybolmayan.'))),
      gosterge, govde);
    ciz();
  },
};
