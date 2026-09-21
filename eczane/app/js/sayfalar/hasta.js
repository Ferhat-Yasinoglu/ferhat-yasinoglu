// Hasta kartı: künye, alerjiler, kronik hastalıklar ve reçete geçmişi.
import { el, temizle, btn, btnS, kart, rozet, sayfaBas, bosDurum, uyariSeridi } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { CINSIYETLER, SIGORTALAR, tamAd, hastaYasi } from '../paylasilan/hasta.js';
import { trTarih, trTarihSaat } from '../paylasilan/tarih.js';
import { DURUM_ADLARI, receteOzet } from '../paylasilan/recete.js';
import { hastaKutusu } from './hastalar.js';

const DURUM_RENGI = { bekliyor: 'sari', kismi: 'mavi', tamamlandi: 'yesil', bos: 'gri' };
const adiBul = (liste, k) => liste.find(([v]) => v === k)?.[1] || '—';

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
        kok.appendChild(bosDurum({ simge: 'hata', baslik: 'Hasta bulunamadı', alt: 'Kayıt silinmiş olabilir.', eylem: btn('Hastalara dön', { class: 'btn', onclick: () => git('/hastalar') }) }));
        return;
      }
      const yas = hastaYasi(hasta);
      const receteler = await depo.listele('receteler', { filtre: { hastaId: hasta.id }, sirala: 'tarih', azalan: true });
      if (benim !== sira) return;

      temizle(kok);
      kok.append(sayfaBas(tamAd(hasta), {
        alt: [yas !== null ? `${yas} yaş` : null, adiBul(CINSIYETLER, hasta.cinsiyet), hasta.telefon].filter(Boolean).join(' · '),
        geri: () => git('/hastalar'),
        eylemler: [
          btnS('recete', 'Reçete yaz', { class: 'btn btn--birincil', onclick: () => git(`/recete/yeni?hasta=${hasta.id}`) }),
          btnS('kalem', 'Düzenle', { class: 'btn', onclick: async () => { if (await hastaKutusu(ctx, hasta)) ciz(); } }),
          btnS('cop', 'Sil', { class: 'btn', onclick: async () => {
            if (await onayla(`"${tamAd(hasta)}" silinsin mi? Reçete geçmişi kayıtlarda kalır.`, { tehlikeli: true, evet: 'Sil' })) {
              await depo.sil('hastalar', hasta.id);
              basari('Hasta silindi');
              git('/hastalar');
            }
          } }),
        ],
      }));

      // Alerji her ekranda en görünür yerde durur: reçete yazarken hayati.
      const seridi = uyariSeridi((hasta.alerjiler || []).map((a) => ({ tur: 'hata', metin: `Alerji: ${a}` })));
      if (seridi) kok.appendChild(seridi);

      const kunye = [
        ['Doğum tarihi', trTarih(hasta.dogumTarihi)],
        ['Kimlik no', hasta.kimlikNo || '—'],
        ['Telefon', hasta.telefon || '—'],
        ['E-posta', hasta.eposta || '—'],
        ['Kan grubu', hasta.kanGrubu || '—'],
        ['Sigorta', adiBul(SIGORTALAR, hasta.sigorta)],
        ['Adres', hasta.adres || '—'],
        ['Kayıt', trTarihSaat(hasta.olusturuldu)],
      ];
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, 'Künye'), hasta.ornek ? rozet('örnek kayıt', 'mor') : null),
        el('div', { class: 'izgara' }, ...kunye.map(([b, d]) => el('div', {}, el('div', { class: 'alan__etiket' }, b), el('div', {}, d))))));

      const etiketListesi = (baslik, liste, renk) => el('div', {},
        el('div', { class: 'alan__etiket' }, baslik),
        liste?.length
          ? el('div', { class: 'satir', style: { gap: '4px', marginBlockStart: '4px' } }, ...liste.map((x) => rozet(x, renk)))
          : el('div', { class: 'sessiz' }, '—'));

      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, 'Sağlık bilgileri')),
        el('div', { class: 'izgara' },
          etiketListesi('Alerjiler', hasta.alerjiler, 'kirmizi'),
          etiketListesi('Kronik hastalıklar', hasta.kronikHastaliklar, 'mavi'),
          etiketListesi('Sürekli kullandığı ilaçlar', hasta.surekliIlaclar, 'vurgu')),
        hasta.notlar ? el('p', { class: 'kart__alt', style: { marginBlockStart: 'var(--b-3)' } }, hasta.notlar) : null));

      const receteGovdesi = receteler.length
        ? el('div', { class: 'liste' }, ...receteler.map((r) => {
          const o = receteOzet(r);
          return el('a', { class: 'liste__satir', href: `#/recete/${r.id}` },
            el('span', { class: 'avatar' }, simge('recete', { boy: 18 })),
            el('div', { class: 'liste__govde' },
              el('div', { class: 'liste__baslik' }, r.receteNo || trTarih(r.tarih)),
              el('div', { class: 'liste__alt' }, `${trTarih(r.tarih)} · ${o.toplam} ilaç · ${o.verilen} verildi`)),
            el('div', { class: 'liste__son' }, rozet(DURUM_ADLARI[o.durum] || o.durum, DURUM_RENGI[o.durum] || 'gri')));
        }))
        : bosDurum({ simge: 'recete', baslik: 'Reçete yok', alt: 'Bu hastaya henüz reçete yazılmamış.' });

      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' },
          el('h2', {}, 'Reçeteler'),
          btnS('arti', 'Yeni reçete', { class: 'btn btn--kucuk', onclick: () => git(`/recete/yeni?hasta=${hasta.id}`) })),
        receteGovdesi));
    }

    await ciz();
    return depo.dinle('hastalar', () => ciz());
  },
};
