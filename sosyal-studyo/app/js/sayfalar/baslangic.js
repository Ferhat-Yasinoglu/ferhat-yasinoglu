// İlk kurulum: dil → başlangıç modu → kanal bilgisi. 60 saniyede Özet'e.
import { el, btn, kart, rozet, temizle } from '../cekirdek/dom.js';
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
    function ciz() {
      temizle(govde);
      if (adim === 1) govde.append(el('h2', {}, t('baslangic.dil', '1 · Dil')), el('div', { class: 'izgara izgara--dar' }, ...DILLER.map(([k, ad]) => btn(ad, { class: 'btn btn--tam', onclick: async () => { await ctx.dilDegistir(k, { yenidenCiz: false }); adim = 2; ciz(); } }))));
      if (adim === 2) govde.append(el('h2', {}, t('baslangic.nasil', '2 · Nasıl başlayalım?')), el('div', { class: 'izgara' },
        kart(el('h3', { class: 'kart__baslik' }, '🧪 ' + t('baslangic.hemen', 'Hemen dene')), el('p', { class: 'kart__alt' }, t('baslangic.hemen_aciklama', 'Yerel mod + demo verisi. Worker gerekmez; akış kur, simülatörde dene, içerik üret.')), btn(t('baslangic.hemen_btn', 'Demo ile başla'), { class: 'btn btn--birincil', onclick: async () => { await tohumla(depo); await depo.ayarKaydet('mod', 'yerel'); adim = 3; ciz(); } })),
        kart(el('h3', { class: 'kart__baslik' }, '☁️ ' + t('baslangic.worker', 'Worker\'a bağlan')), el('p', { class: 'kart__alt' }, t('baslangic.worker_aciklama', 'Cloudflare Worker adresin ve yönetici anahtarın varsa kanallar ve AI açılır. Sonra da yapabilirsin.')), btn(t('baslangic.worker_btn', 'Ayarlar → Worker'), { onclick: async () => { await depo.ayarKaydet('ilk_kurulum_tamam', 1); git('/ayarlar/worker'); } }))));
      if (adim === 3) govde.append(el('h2', {}, t('baslangic.kanallar', '3 · Kanallar')), el('div', { class: 'izgara izgara--dar' }, ...Object.values(KANALLAR).map((k) => kart(el('div', { class: 'satir satir--arasi' }, el('span', { class: 'kart__baslik' }, `${k.simge} ${k.ad}`), rozet(k.etiket.ad, k.etiket.renk)), el('p', { class: 'kart__alt' }, k.ozet)))),
        btn(t('baslangic.ozete', 'Özete git'), { class: 'btn btn--birincil btn--tam', onclick: async () => { await depo.ayarKaydet('ilk_kurulum_tamam', 1); ctx.yenileBantlar(); git('/ozet'); } }));
    }
    kok.append(el('h1', {}, t('baslangic.baslik', 'Sosyal Stüdyo\'ya hoş geldin')), el('p', { class: 'kart__alt' }, t('baslangic.alt', 'Akışlar, kişiler, toplu mesaj ve içerik araçları — sunucusuz, çerçevesiz, kaybolmayan.')), govde);
    ciz();
  },
};
