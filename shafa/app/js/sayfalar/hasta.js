// Hasta kartı: künye, alerjiler, kronik hastalıklar ve reçete geçmişi.
import { el, temizle, btn, btnS, kart, rozet, sayfaBas, bosDurum, uyariSeridi } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { CINSIYETLER, SIGORTALAR, tamAd, hastaYasi } from '../paylasilan/hasta.js';
import { tarihMetni, tarihSaatMetni } from '../paylasilan/tarih.js';
import { receteOzet } from '../paylasilan/recete.js';
import { hastaKutusu } from './hastalar.js';
import { t, secenekAdi } from '../i18n.js';

export default {
  baslik: 'Hasta',
  async cizim(kok, ctx) {
    const { depo, git, onayla, basari } = ctx;

    let sira = 0;
    async function ciz() {
      const benim = ++sira;
      const hasta = await depo.al('hastalar', ctx.param.id);
      if (benim !== sira) return;
      if (!hasta) {
        temizle(kok);
        kok.appendChild(bosDurum({ simge: 'hata', baslik: t('hasta.bulunamadi', 'Hasta bulunamadı'), alt: t('genel.silinmis_olabilir', 'Kayıt silinmiş olabilir.'), eylem: btn(t('hasta.geri', 'Hastalara dön'), { class: 'btn', onclick: () => git('/hastalar') }) }));
        return;
      }
      const yas = hastaYasi(hasta);
      const receteler = await depo.listele('receteler', { filtre: { hastaId: hasta.id }, sirala: 'tarih', azalan: true });
      if (benim !== sira) return;

      temizle(kok);
      kok.append(sayfaBas(tamAd(hasta), {
        alt: [yas !== null ? t('hasta.yas', '{n} yaş', { n: yas }) : null, secenekAdi(CINSIYETLER, hasta.cinsiyet, 'cinsiyet'), hasta.telefon].filter(Boolean).join(' · '),
        geri: () => git('/hastalar'),
        eylemler: [
          btnS('recete', t('recete.yaz', 'Reçete yaz'), { class: 'btn btn--birincil', onclick: () => git(`/recete/kagit?hasta=${hasta.id}`) }),
          btnS('kalem', t('genel.duzenle', 'Düzenle'), { class: 'btn', onclick: async () => { if (await hastaKutusu(ctx, hasta)) ciz(); } }),
          btnS('cop', t('genel.sil', 'Sil'), { class: 'btn', onclick: async () => {
            if (await onayla(t('hasta.sil_onay', '"{ad}" silinsin mi? Reçete geçmişi kayıtlarda kalır.', { ad: tamAd(hasta) }), { tehlikeli: true, evet: t('genel.sil', 'Sil') })) {
              await depo.sil('hastalar', hasta.id);
              basari(t('hasta.silindi', 'Hasta silindi'));
              git('/hastalar');
            }
          } }),
        ],
      }));

      // Alerji her ekranda en görünür yerde durur: reçete yazarken hayati.
      const seridi = uyariSeridi((hasta.alerjiler || []).map((a) => ({ tur: 'hata', metin: t('hasta.alerji_satiri', 'Alerji: {a}', { a }) })));
      if (seridi) kok.appendChild(seridi);

      const kunye = [
        [t('hasta.dogum', 'Doğum tarihi'), tarihMetni(hasta.dogumTarihi)],
        [t('hasta.kimlik_no', 'Kimlik no'), hasta.kimlikNo || '—'],
        [t('genel.telefon', 'Telefon'), hasta.telefon || '—'],
        [t('genel.eposta', 'E-posta'), hasta.eposta || '—'],
        [t('hasta.kan_grubu', 'Kan grubu'), hasta.kanGrubu || '—'],
        [t('hasta.sigorta', 'Sigorta'), secenekAdi(SIGORTALAR, hasta.sigorta, 'sigorta')],
        [t('genel.adres', 'Adres'), hasta.adres || '—'],
        [t('genel.kayit', 'Kayıt'), tarihSaatMetni(hasta.olusturuldu)],
      ];
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, t('genel.kunye', 'Künye')), hasta.ornek ? rozet(t('genel.ornek_kayit', 'örnek kayıt'), 'mor') : null),
        el('div', { class: 'izgara' }, ...kunye.map(([b, d]) => el('div', {}, el('div', { class: 'alan__etiket' }, b), el('div', {}, d))))));

      const etiketListesi = (baslik, liste, renk) => el('div', {},
        el('div', { class: 'alan__etiket' }, baslik),
        liste?.length
          ? el('div', { class: 'satir', style: { gap: '4px', marginBlockStart: '4px' } }, ...liste.map((x) => rozet(x, renk)))
          : el('div', { class: 'sessiz' }, '—'));

      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, t('hasta.saglik', 'Sağlık bilgileri'))),
        el('div', { class: 'izgara' },
          etiketListesi(t('hasta.alerjiler', 'Alerjiler'), hasta.alerjiler, 'kirmizi'),
          etiketListesi(t('hasta.kronik', 'Kronik hastalıklar'), hasta.kronikHastaliklar, 'mavi'),
          etiketListesi(t('hasta.surekli_ilaclar', 'Sürekli kullandığı ilaçlar'), hasta.surekliIlaclar, 'vurgu')),
        hasta.notlar ? el('p', { class: 'kart__alt', style: { marginBlockStart: 'var(--b-3)' } }, hasta.notlar) : null));

      const receteGovdesi = receteler.length
        ? el('div', { class: 'liste' }, ...receteler.map((r) => {
          const o = receteOzet(r);
          return el('a', { class: 'liste__satir', href: `#/recete/${r.id}` },
            el('span', { class: 'avatar' }, simge('recete', { boy: 18 })),
            el('div', { class: 'liste__govde' },
              el('div', { class: 'liste__baslik' }, r.receteNo || tarihMetni(r.tarih)),
              el('div', { class: 'liste__alt' }, `${tarihMetni(r.tarih)} · ${t('recete.ilac_sayisi', '{n} ilaç', { n: o.toplam })}`)));
        }))
        : bosDurum({ simge: 'recete', baslik: t('recete.yok', 'Reçete yok'), alt: t('recete.hasta_bos', 'Bu hastaya henüz reçete yazılmamış.') });

      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' },
          el('h2', {}, t('nav.receteler', 'Reçeteler')),
          btnS('arti', t('recete.yeni', 'Yeni reçete'), { class: 'btn btn--kucuk', onclick: () => git(`/recete/kagit?hasta=${hasta.id}`) })),
        receteGovdesi));
    }

    await ciz();
    return depo.dinle('hastalar', () => ciz());
  },
};
