// İlk kurulum: marka açılışı + üç adım. Dil → başlangıç modu → kanallar. 60 saniyede Özet'e.
// Açılışta FY rozeti, altın daire ve zemin ızgarası: uygulamanın kim olduğunu ilk ekranda söyler.
import { el, btn, kart, rozet, temizle, ekle } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { DILLER } from '../i18n.js';
import { KANALLAR } from '../paylasilan/kanallar.js';
import { tohumla } from '../depo/tohum.js';

export default {
  baslik: 'Başlangıç',
  async cizim(kok, ctx) {
    const { depo, t, git } = ctx;
    temizle(kok);
    let adim = 1;
    const govde = el('div', { class: 'giris' });
    const gosterge = el('div', { class: 'satir', style: { justifyContent: 'center', marginBlockEnd: 'var(--b-6)' } });

    function gostergeCiz() {
      temizle(gosterge);
      [t('baslangic.dil_kisa', 'Dil'), t('baslangic.mod_kisa', 'Başlangıç'), t('baslangic.kanal_kisa', 'Kanallar')].forEach((ad, i) => {
        const n = i + 1, gecti = n < adim;
        ekle(gosterge, [
          el('span', { class: 'cip' + (n === adim ? ' cip--secili' : ''), style: gecti ? { color: 'rgb(var(--yesil))', borderColor: 'rgb(var(--yesil) / .45)' } : null },
            gecti ? simge('onay', { boy: 13 }) : el('span', { style: { opacity: '.7' } }, String(n)), ad),
          i < 2 ? el('span', { style: { color: 'rgb(var(--vurgu) / .5)' } }, simge('sag', { boy: 15 })) : null]);
      });
    }

    function ciz() {
      temizle(govde); gostergeCiz();
      govde.classList.remove('giris'); void govde.offsetWidth; govde.classList.add('giris');

      if (adim === 1) govde.append(
        el('h2', { style: { textAlign: 'center', marginBlockStart: 0 } }, t('baslangic.dil', 'Hangi dilde kullanmak istersin?')),
        el('div', { class: 'izgara izgara--dar sirali', style: { maxWidth: '640px', marginInline: 'auto' } },
          ...DILLER.map(([k, ad], i) => btn(ad, {
            class: 'btn btn--tam', style: { minHeight: '56px', fontSize: 'var(--f-l)', '--i': String(i) },
            onclick: async () => { await ctx.dilDegistir(k, { yenidenCiz: false }); adim = 2; ciz(); },
          }))));

      if (adim === 2) govde.append(
        el('h2', { style: { textAlign: 'center', marginBlockStart: 0 } }, t('baslangic.nasil', 'Nasıl başlayalım?')),
        el('div', { class: 'izgara sirali', style: { maxWidth: '760px', marginInline: 'auto' } },
          el('section', { class: 'kart kart--vurgu sweep', style: { '--i': '0' } },
            el('div', { class: 'durum__simge' }, simge('prova', { boy: 32 })),
            el('h3', { class: 'kart__baslik' }, t('baslangic.hemen', 'Hemen dene')),
            el('p', { class: 'kart__alt' }, t('baslangic.hemen_aciklama', 'Yerel mod + demo verisi. Worker gerekmez; akış kur, simülatörde dene, içerik üret.')),
            btn(t('baslangic.hemen_btn', 'Demo ile başla'), { class: 'btn btn--birincil', onclick: async () => { await tohumla(depo); await depo.ayarKaydet('mod', 'yerel'); adim = 3; ciz(); } })),
          el('section', { class: 'kart sweep', style: { '--i': '1' } },
            el('div', { class: 'durum__simge' }, simge('bulut', { boy: 32 })),
            el('h3', { class: 'kart__baslik' }, t('baslangic.worker', 'Worker\'a bağlan')),
            el('p', { class: 'kart__alt' }, t('baslangic.worker_aciklama', 'Cloudflare Worker adresin ve yönetici anahtarın varsa kanallar ve AI açılır. Sonra da yapabilirsin.')),
            btn(t('baslangic.worker_btn', 'Ayarlar → Worker'), { onclick: async () => { await depo.ayarKaydet('ilk_kurulum_tamam', 1); git('/ayarlar/worker'); } }))));

      if (adim === 3) govde.append(
        el('h2', { style: { textAlign: 'center', marginBlockStart: 0 } }, t('baslangic.kanallar', 'Hangi kanallar çalışır?')),
        el('p', { class: 'kart__alt', style: { textAlign: 'center', maxWidth: '56ch', marginInline: 'auto' } },
          t('baslangic.kanallar_aciklama', 'Dürüst etiketler: bazı kanallar hemen çalışır, bazıları platform onayı ister. Hepsini sonra Ayarlar → Kurulum\'dan bağlayabilirsin.')),
        el('div', { class: 'izgara izgara--dar sirali', style: { maxWidth: '880px', marginInline: 'auto' } },
          ...Object.values(KANALLAR).map((k, i) => el('section', { class: 'kart', style: { '--i': String(i) } },
            el('div', { class: 'satir satir--arasi' },
              el('span', { class: 'kart__baslik' }, simge(k.ikon), k.ad),
              rozet(k.etiket.ad, k.etiket.renk)),
            el('p', { class: 'kart__alt', style: { margin: 0 } }, k.ozet)))),
        el('div', { style: { textAlign: 'center', marginBlockStart: 'var(--b-6)' } },
          btn(t('baslangic.ozete', 'Özete git'), {
            class: 'btn btn--birincil', style: { minWidth: '220px', minHeight: '52px' },
            onclick: async () => { await depo.ayarKaydet('ilk_kurulum_tamam', 1); ctx.yenileBantlar(); git('/ozet'); },
          }, simge('sag'))));
    }

    // Marka açılışı: rozet, altın daire, zemin ızgarası ve ufuk çizgisi.
    kok.append(
      el('div', { class: 'ufuk giris', style: { textAlign: 'center', paddingBlock: 'var(--b-6) var(--b-5)' } },
        el('div', { class: 'ufuk__zemin', 'aria-hidden': 'true' }),
        el('div', { class: 'ufuk__cizgi', 'aria-hidden': 'true' }),
        // Animasyonlu hero logosu: halka döner, parlama süpürür, zemin yansır.
        // Hareket azaltılmışsa tarayıcı durağan varyantı seçer.
        el('picture', { style: { position: 'relative' } },
          el('source', { media: '(prefers-reduced-motion: reduce)', srcset: './img/logo-hero-static.svg' }),
          el('img', { src: './img/logo-hero.svg', alt: 'FY', width: 960, height: 880, style: { width: 'min(260px, 60vw)', height: 'auto' } })),
        el('h1', { style: { marginBlockStart: 'var(--b-4)', position: 'relative' } }, t('baslangic.baslik', 'Sosyal Stüdyo\'ya hoş geldin')),
        el('div', { class: 'deco-etiket', style: { maxWidth: '340px', marginInline: 'auto', justifyContent: 'center' } },
          el('span', {}, t('uygulama.ajans', 'Yapay Zekâ Ajansı'))),
        el('p', { class: 'kart__alt', style: { maxWidth: '54ch', marginInline: 'auto', marginBlock: 'var(--b-3) var(--b-6)', position: 'relative' } },
          t('baslangic.alt', 'Akışlar, kişiler, toplu mesaj ve içerik araçları — sunucusuz, çerçevesiz, kaybolmayan.'))),
      gosterge, govde);
    ciz();
  },
};
