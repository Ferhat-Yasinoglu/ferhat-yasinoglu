// 404: bilinmeyen adres.
import { temizle, btn, bosDurum } from '../cekirdek/dom.js';

export default {
  baslik: 'Bulunamadı',
  cizim(kok, ctx) {
    temizle(kok);
    kok.appendChild(bosDurum({
      simge: 'ara', baslik: 'Sayfa bulunamadı',
      alt: 'Aradığın adres yok ya da taşınmış.',
      eylem: btn('Panele dön', { class: 'btn btn--birincil', onclick: () => ctx.git('/panel') }),
    }));
  },
};
