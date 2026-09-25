// İlaç kartı: künye, muadiller ve bu ilacın yazıldığı reçeteler.
// Stok yok — hasta ilacını dışarıdaki eczaneden kendi alıyor.
import { el, temizle, btn, btnS, kart, sayfaBas, bosDurum } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { FORMLAR, muadiller } from '../paylasilan/ilac.js';
import { ilacGorunenAd } from '../ilac-satir-arayuz.js';
import { tarihMetni } from '../paylasilan/tarih.js';
import { ilacKutusu, ilacRozetleri } from './ilaclar.js';
import { t, secenekAdi } from '../i18n.js';

export default {
  baslik: 'İlaç',
  async cizim(kok, ctx) {
    const { depo, git, onayla, basari } = ctx;
    temizle(kok);

    let sira = 0;
    async function ciz() {
      const benim = ++sira;
      const ilac = await depo.al('ilaclar', ctx.param.id);
      if (benim !== sira || !ctx.guncel()) return;
      if (!ilac) {
        temizle(kok);
        kok.appendChild(bosDurum({ simge: 'hata', baslik: t('ilac.bulunamadi', 'İlaç bulunamadı'), alt: t('genel.silinmis_olabilir', 'Kayıt silinmiş olabilir.'), eylem: btn(t('ilac.geri', 'İlaçlara dön'), { class: 'btn', onclick: () => git('/ilaclar') }) }));
        return;
      }
      const [hepsi, receteler] = await Promise.all([depo.listele('ilaclar'), depo.listele('receteler', { sirala: 'tarih', azalan: true })]);
      if (benim !== sira || !ctx.guncel()) return;
      const esdeger = muadiller(hepsi, ilac);
      // Bu ilacın geçtiği reçeteler: "bunu kime, ne zaman yazmıştım?"
      const gectigi = receteler.filter((r) => (r.satirlar || []).some((s) => s.ilacId === ilac.id)).slice(0, 8);

      temizle(kok);
      kok.append(sayfaBas(ilacGorunenAd(ilac), {
        alt: [ilac.etkenMadde, ilac.uretici].filter(Boolean).join(' · '),
        geri: () => git('/ilaclar'),
        eylemler: [
          btnS('recete', t('recete.yaz', 'Reçete yaz'), { class: 'btn btn--birincil', onclick: () => git('/recete/kagit') }),
          btnS('kalem', t('genel.duzenle', 'Düzenle'), { class: 'btn', onclick: async () => { if (await ilacKutusu(ctx, ilac)) ciz(); } }),
          btnS('cop', t('genel.sil', 'Sil'), { class: 'btn', onclick: async () => {
            if (await onayla(t('ilac.sil_onay', '"{ad}" silinsin mi? Yazılmış reçetelerde adı kalır.', { ad: ilac.ad }), { tehlikeli: true, evet: t('genel.sil', 'Sil') })) {
              await depo.sil('ilaclar', ilac.id);
              basari(t('ilac.silindi', 'İlaç silindi'));
              git('/ilaclar');
            }
          } }),
        ],
      }));

      const kunye = [
        [t('ilac.etken_madde', 'Etken madde'), ilac.etkenMadde || '—'],
        [t('ilac.form', 'Form'), secenekAdi(FORMLAR, ilac.form, 'form') || '—'],
        [t('ilac.doz', 'Doz'), ilac.doz || '—'],
        [t('ilac.kutu_adedi', 'Kutudaki adet'), ilac.kutuAdedi || '—'],
        [t('ilac.barkod', 'Barkod'), ilac.barkod || '—'],
        [t('ilac.uretici', 'Üretici'), ilac.uretici || '—'],
        [t('nav.recete', 'Reçete'), ilac.receteli ? t('ilac.receteli', 'Reçete ile verilir') : t('ilac.recetesiz', 'Reçetesiz')],
      ];
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, t('genel.kunye', 'Künye')), el('div', { class: 'satir' }, ...ilacRozetleri(ilac))),
        el('div', { class: 'izgara' }, ...kunye.map(([b, d]) =>
          el('div', {}, el('div', { class: 'alan__etiket' }, b), el('div', {}, d)))),
        ilac.notlar ? el('p', { class: 'kart__alt', style: { marginBlockStart: 'var(--b-3)' } }, ilac.notlar) : null));

      if (esdeger.length) {
        kok.appendChild(kart({},
          el('div', { class: 'kart__bas' }, el('h2', {}, t('ilac.muadiller', 'Muadiller')), el('span', { class: 'kart__alt' }, t('ilac.muadil_alt', 'Aynı etken madde'))),
          el('div', { class: 'liste' }, ...esdeger.map((m) =>
            el('a', { class: 'liste__satir', href: `#/ilac/${m.id}` },
              el('span', { class: 'avatar' }, simge('ilac', { boy: 18 })),
              el('div', { class: 'liste__govde' }, el('div', { class: 'liste__baslik' }, ilacGorunenAd(m)), el('div', { class: 'liste__alt' }, m.etkenMadde || '—')))))));
      }

      const receteGovdesi = gectigi.length
        ? el('div', { class: 'liste' }, ...gectigi.map((r) =>
          el('a', { class: 'liste__satir', href: `#/recete/${r.id}` },
            el('span', { class: 'avatar' }, simge('recete', { boy: 18 })),
            el('div', { class: 'liste__govde' },
              el('div', { class: 'liste__baslik' }, r.receteNo || tarihMetni(r.tarih)),
              el('div', { class: 'liste__alt' }, tarihMetni(r.tarih))))))
        : bosDurum({ simge: 'recete', baslik: t('ilac.recete_yok', 'Bu ilaç henüz hiçbir reçetede yok') });

      kok.appendChild(kart({}, el('div', { class: 'kart__bas' }, el('h2', {}, t('ilac.gectigi_receteler', 'Yazıldığı reçeteler'))), receteGovdesi));
    }

    await ciz();
    const birak = [depo.dinle('ilaclar', ciz), depo.dinle('receteler', ciz)];
    return () => birak.forEach((f) => f());
  },
};
