// Raporlar: hekimin kendi kayıtlarından çıkan sayımlar.
//
// Her şey CİHAZDA hesaplanıyor — hiçbir sayım dışarı gitmiyor, hiçbir servis
// çağrılmıyor. Sayılan şey hekimin ne yazdığı; hastanın adı hiçbir grafiğe
// girmiyor.
import { el, temizle, kart, sayacKutusu, sayfaBas, bosDurum, sutunGrafik, yatayGrafik } from '../cekirdek/dom.js';
import { tarihMetni, bugun } from '../paylasilan/tarih.js';
import { parcala } from '../paylasilan/klinik.js';
import { satirAdi } from '../paylasilan/ilac.js';
import { t } from '../i18n.js';

/** En çok geçen N değer: [{ etiket, deger }], çoktan aza. */
function enCoklar(sayim, n = 8) {
  return [...sayim.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([etiket, deger]) => ({ etiket, deger }));
}

/** Son 12 ay, şemsi takvimde YYYY/MM etiketiyle. Ay adları yerine sayı:
 *  Intl'in şemsi ay adları uzun, grafiğin altında üst üste biniyorlar. */
function aylar(receteler) {
  const bos = new Map();
  const d = new Date(bugun() + 'T00:00:00Z');
  for (let i = 11; i >= 0; i--) {
    const g = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    bos.set(tarihMetni(g.toISOString().slice(0, 10)).slice(0, 7), 0);
  }
  for (const r of receteler) {
    const anahtar = tarihMetni(String(r.tarih || '').slice(0, 10)).slice(0, 7);
    if (bos.has(anahtar)) bos.set(anahtar, bos.get(anahtar) + 1);
  }
  // Etikette yalnız ay: yıl on iki sütunun hepsinde tekrar edince okunmuyor.
  return [...bos.entries()].map(([anahtar, deger]) => ({ etiket: anahtar.slice(5), deger, baslik: anahtar }));
}

export default {
  baslik: 'Raporlar',
  async cizim(kok, ctx) {
    const { depo } = ctx;
    temizle(kok);

    const [hastalar, receteler] = await Promise.all([
      depo.listele('hastalar'),
      depo.listele('receteler', { sirala: 'tarih', azalan: true }),
    ]);

    kok.appendChild(sayfaBas(t('rapor.baslik', 'Raporlar'), {
      alt: t('rapor.alt', 'Kendi kayıtlarından çıkan sayımlar. Hepsi bu cihazda hesaplanıyor, hiçbiri dışarı gitmiyor.'),
    }));

    if (!receteler.length) {
      kok.appendChild(bosDurum({
        simge: 'grafik', baslik: t('rapor.bos', 'Henüz sayılacak bir şey yok'),
        alt: t('rapor.bos_alt', 'İlk reçeteyi yazdığında buradaki grafikler dolmaya başlar.'),
      }));
      return;
    }

    const ilacSayimi = new Map();
    const taniSayimi = new Map();
    const labSayimi = new Map();
    const hastaSayimi = new Map();
    let ilacKalemi = 0;
    for (const r of receteler) {
      for (const satir of r.satirlar || []) {
        const ad = satirAdi(satir);
        if (!ad) continue;
        ilacKalemi++;
        ilacSayimi.set(ad, (ilacSayimi.get(ad) || 0) + 1);
      }
      for (const ad of parcala(r.tani)) taniSayimi.set(ad, (taniSayimi.get(ad) || 0) + 1);
      for (const ad of parcala(r.laboratuvar)) labSayimi.set(ad, (labSayimi.get(ad) || 0) + 1);
      if (r.hastaId) hastaSayimi.set(r.hastaId, (hastaSayimi.get(r.hastaId) || 0) + 1);
    }

    const tekrarEden = [...hastaSayimi.values()].filter((n) => n > 1).length;
    const ortalama = (ilacKalemi / receteler.length).toFixed(1);

    kok.appendChild(el('div', { class: 'izgara izgara--sayac', style: { marginBlockEnd: 'var(--b-5)' } },
      sayacKutusu({ baslik: t('rapor.recete', 'Reçete'), deger: receteler.length, simge: 'recete', tur: 'vurgu', yol: '/receteler' }),
      sayacKutusu({ baslik: t('rapor.hasta', 'Hasta'), deger: hastalar.length, simge: 'hasta', yol: '/hastalar' }),
      sayacKutusu({
        baslik: t('rapor.ilac_kalemi', 'İlaç kalemi'), deger: ilacKalemi, simge: 'ilac',
        alt: t('rapor.ortalama', 'reçete başına {n}', { n: ortalama }),
      }),
      sayacKutusu({
        baslik: t('rapor.tekrar_eden', 'Tekrar gelen hasta'), deger: tekrarEden, simge: 'yenile',
        alt: t('rapor.tekrar_eden_alt', 'birden çok reçetesi olan'),
      })));

    kok.appendChild(kart({},
      el('div', { class: 'kart__bas' },
        el('h2', {}, t('rapor.aylik', 'Aylara göre reçete')),
        el('span', { class: 'kart__alt' }, t('rapor.aylik_alt', 'son 12 ay'))),
      sutunGrafik(aylar(receteler), { etiket: t('rapor.aylik', 'Aylara göre reçete') })));

    const bolumler = [
      [t('rapor.en_cok_ilac', 'En çok yazdığın ilaçlar'), ilacSayimi],
      [t('rapor.en_cok_tani', 'En çok koyduğun tanılar'), taniSayimi],
      [t('rapor.en_cok_lab', 'En çok istediğin tahliller'), labSayimi],
    ];
    for (const [baslik, sayim] of bolumler) {
      const veri = enCoklar(sayim);
      if (!veri.length) continue;
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, baslik)),
        yatayGrafik(veri, { etiket: baslik })));
    }
  },
};
