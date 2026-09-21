// 404: bilinmeyen adres.
import { temizle, btn, bosDurum } from '../cekirdek/dom.js';
import { t } from '../i18n.js';

export default {
  baslik: 'Bulunamadı',
  cizim(kok, ctx) {
    temizle(kok);
    kok.appendChild(bosDurum({
      simge: 'ara', baslik: t('genel.sayfa_yok', 'Sayfa bulunamadı'),
      alt: t('genel.sayfa_yok_alt', 'Aradığın adres yok ya da taşınmış.'),
      eylem: btn(t('genel.panele_don', 'Panele dön'), { class: 'btn btn--birincil', onclick: () => ctx.git('/panel') }),
    }));
  },
};
