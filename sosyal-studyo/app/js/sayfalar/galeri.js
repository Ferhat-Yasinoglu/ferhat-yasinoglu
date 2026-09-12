// Galeri: üretilen içerik arşivi; tür/tarih filtresi, yeniden kullan, depolama kullanımı.
import { el, btn, kart, rozet, temizle, secim, goreliZaman, sayfaBas } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { bos } from '../cekirdek/durum.js';

export default {
  baslik: 'Galeri',
  async cizim(kok, ctx) {
    const { depo, t, git } = ctx;
    temizle(kok);
    const tur = secim([['', t('galeri.tum', 'Tümü')], ['karusel_png', 'Karusel'], ['senaryo_txt', 'Senaryo'], ['video_analiz', 'Video analizi'], ['liderlik_png', 'Liderlik']]);
    const liste = el('div', { class: 'izgara izgara--dar' });
    const kap = await (depo.kapasite ? depo.kapasite() : null);
    async function ciz() {
      temizle(liste);
      const ogeler = (await depo.listele('galeri', { sirala: 'guncellendi', azalan: true })).filter((g) => !tur.value || g.tur === tur.value);
      if (!ogeler.length) { liste.appendChild(bos({ simge: 'galeri', baslik: t('galeri.bos', 'Galeri boş'), aciklama: t('galeri.bos_aciklama', 'Ürettiğin karuseller, senaryolar ve analizler burada birikir.') })); return; }
      for (const g of ogeler) liste.appendChild(kart(rozet(g.tur, 'mor'), el('h2', { class: 'kart__baslik' }, g.baslik), el('p', { class: 'kart__alt' }, g.onizleme || ''), el('div', { class: 'kart__alt' }, goreliZaman(g.guncellendi, t)), el('div', { class: 'satir' }, btn(t('galeri.ac', 'Aç'), { class: 'btn btn--kucuk btn--birincil', onclick: () => { const y = { karuseller: `/karusel/${g.kaynak?.id}`, senaryolar: '/fikirler', video_analizleri: `/video/${g.kaynak?.id}` }[g.kaynak?.kol]; if (y) git(y); } }), btn(simge('kapat'), { class: 'btn btn--kucuk btn--ikon', onclick: async () => { await depo.sil('galeri', g.id); ciz(); } }))));
    }
    tur.onchange = ciz;
    kok.append(sayfaBas(t('nav.galeri', 'Galeri'), { alt: t('galeri.alt', 'Ürettiğin görseller ve yüklediğin dosyalar bu cihazda saklanır.') }), el('div', { class: 'satir satir--arasi' }, tur, kap ? el('span', { class: 'kart__alt' }, `${t('galeri.depolama', 'Depolama')}: ${(kap.kullanilan / 1048576).toFixed(1)} MB / ${(kap.toplam / 1048576).toFixed(0)} MB`) : null), el('div', { style: { height: '12px' } }), liste);
    ciz();
  },
};
