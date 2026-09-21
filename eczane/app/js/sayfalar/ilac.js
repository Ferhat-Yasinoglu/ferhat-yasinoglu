// İlaç kartı: künye, uyarılar, stok işlemleri ve hareket geçmişi.
// Stok yalnız buradaki işlemlerle değişir; her işlem geçmişe yazılır.
import { el, temizle, btn, btnS, girdi, secim, metinAlani, alan, kart, rozet, sayfaBas, bosDurum, uyariSeridi } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { ilacEtiketi, FORMLAR, ilacUyarilari, muadiller, HAREKET_TURLERI } from '../paylasilan/ilac.js';
import { paraMetni } from '../paylasilan/metin.js';
import { trTarih, trTarihSaat } from '../paylasilan/tarih.js';
import { hareketUygula, ilacHareketleri } from '../depo/stok.js';
import { ilacKutusu, ilacRozetleri } from './ilaclar.js';
import { t, secenekleriCevir, secenekAdi } from '../i18n.js';

/** Stok işlemi kutusu: tür, miktar ve açıklama. */
async function stokKutusu(ctx, ilac) {
  const { depo, modal, basari, hata } = ctx;
  const tur = secim(secenekleriCevir(HAREKET_TURLERI.filter(([k]) => k !== 'recete'), 'hareket'), { name: 'tur', value: 'giris' });
  const adet = girdi({ name: 'adet', type: 'number', min: 0, step: 1, value: 1 });
  const aciklama = metinAlani({ name: 'aciklama', rows: 2, placeholder: t('stok.aciklama_yer', 'Fatura no, sebep…') });
  const ipucu = el('p', { class: 'alan__ipucu' });
  const adetAlani = alan(t('genel.adet', 'Adet'), adet);

  const ipucuYaz = () => {
    ipucu.textContent = tur.value === 'sayim'
      ? t('stok.sayim_ipucu', 'Sayım sonucu: stok bu sayıya eşitlenir (şu an {n}).', { n: ilac.stok ?? 0 })
      : t('stok.degisim_ipucu', 'Şu anki stok {n}. Bu işlem stoğu {yon}.', {
        n: ilac.stok ?? 0,
        yon: tur.value === 'giris' || tur.value === 'iade' ? t('stok.artirir', 'artırır') : t('stok.azaltir', 'azaltır'),
      });
  };
  tur.onchange = ipucuYaz;
  ipucuYaz();

  const sonuc = await modal({
    baslik: t('stok.islem', 'Stok işlemi'),
    govde: el('div', {}, alan(t('stok.islem_turu', 'İşlem'), tur), adetAlani, ipucu, alan(t('genel.aciklama', 'Açıklama'), aciklama)),
    dugmeler: [
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: t('genel.uygula', 'Uygula'), sinif: 'btn--birincil', cb: () => {
        const n = Number(adet.value);
        if (!Number.isFinite(n) || n < 0 || (n === 0 && tur.value !== 'sayim')) { adet.classList.add('input--hata'); adet.focus(); return false; }
        return { tur: tur.value, adet: n, aciklama: aciklama.value.trim() };
      } },
    ],
  });
  if (!sonuc || typeof sonuc !== 'object') return false;
  try {
    await hareketUygula(depo, { ilacId: ilac.id, ...sonuc });
    basari(t('stok.guncellendi', 'Stok güncellendi'));
    return true;
  } catch (e) { hata(e.message || t('genel.islem_olmadi', 'İşlem yapılamadı')); return false; }
}

export default {
  baslik: 'İlaç',
  async cizim(kok, ctx) {
    const { depo, git, onayla, basari } = ctx;
    temizle(kok);

    let sira = 0;
    async function ciz() {
      const benim = ++sira;
      const ilac = await depo.al('ilaclar', ctx.param.id);
      if (benim !== sira) return;
      if (!ilac) {
        temizle(kok);
        kok.appendChild(bosDurum({ simge: 'hata', baslik: t('ilac.bulunamadi', 'İlaç bulunamadı'), alt: t('genel.silinmis_olabilir', 'Kayıt silinmiş olabilir.'), eylem: btn(t('ilac.geri', 'İlaçlara dön'), { class: 'btn', onclick: () => git('/ilaclar') }) }));
        return;
      }
      const uyarilar = ilacUyarilari(ilac);
      const hepsi = await depo.listele('ilaclar');
      const hareketler = await ilacHareketleri(depo, ilac.id);
      if (benim !== sira) return;
      const esdeger = muadiller(hepsi, ilac);

      temizle(kok);
      kok.append(sayfaBas(ilacEtiketi(ilac), {
        alt: [ilac.etkenMadde, ilac.uretici].filter(Boolean).join(' · '),
        geri: () => git('/ilaclar'),
        eylemler: [
          btnS('kutu', t('stok.islem', 'Stok işlemi'), { class: 'btn btn--birincil', onclick: async () => { if (await stokKutusu(ctx, ilac)) ciz(); } }),
          btnS('kalem', t('genel.duzenle', 'Düzenle'), { class: 'btn', onclick: async () => { if (await ilacKutusu(ctx, ilac)) ciz(); } }),
          btnS('cop', t('genel.sil', 'Sil'), { class: 'btn', onclick: async () => {
            if (await onayla(t('ilac.sil_onay', '"{ad}" silinsin mi? Hareket geçmişi kalır ama ilaç listelerde görünmez.', { ad: ilac.ad }), { tehlikeli: true, evet: t('genel.sil', 'Sil') })) {
              await depo.sil('ilaclar', ilac.id);
              basari(t('ilac.silindi', 'İlaç silindi'));
              git('/ilaclar');
            }
          } }),
        ],
      }));

      const seridi = uyariSeridi(uyarilar);
      if (seridi) kok.appendChild(seridi);

      const kunye = [
        [t('ilac.stok', 'Stok'), el('strong', { class: 'sayi-yazi' }, String(ilac.stok ?? 0))],
        [t('ilac.kritik_esik', 'Kritik eşik'), String(ilac.kritikStok ?? 0)],
        [t('ilac.form', 'Form'), secenekAdi(FORMLAR, ilac.form, 'form') || '—'],
        [t('ilac.doz', 'Doz'), ilac.doz || '—'],
        [t('ilac.kutu_adedi', 'Kutudaki adet'), ilac.kutuAdedi || '—'],
        [t('ilac.barkod', 'Barkod'), ilac.barkod || '—'],
        [t('ilac.son_kullanma', 'Son kullanma'), trTarih(ilac.sonKullanma)],
        [t('ilac.alis_kisa', 'Alış'), paraMetni(ilac.alisFiyati)],
        [t('ilac.satis_kisa', 'Satış'), paraMetni(ilac.satisFiyati)],
        [t('ilac.raf', 'Raf'), ilac.raf || '—'],
        [t('nav.recete', 'Reçete'), ilac.receteli ? t('ilac.receteli', 'Reçete ile verilir') : t('ilac.recetesiz', 'Reçetesiz')],
      ];
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, t('genel.kunye', 'Künye')), el('div', { class: 'satir' }, ...ilacRozetleri(ilac))),
        el('div', { class: 'izgara' }, ...kunye.map(([b, d]) =>
          el('div', {}, el('div', { class: 'alan__etiket' }, b), el('div', {}, d)))),
        ilac.notlar ? el('p', { class: 'kart__alt', style: { marginBlockStart: 'var(--b-3)' } }, ilac.notlar) : null));

      if (esdeger.length) {
        kok.appendChild(kart({},
          el('div', { class: 'kart__bas' }, el('h2', {}, t('ilac.muadiller', 'Muadiller')), el('span', { class: 'kart__alt' }, t('ilac.muadil_alt', 'Aynı etken madde, stokta var'))),
          el('div', { class: 'liste' }, ...esdeger.map((m) =>
            el('a', { class: 'liste__satir', href: `#/ilac/${m.id}` },
              el('span', { class: 'avatar' }, simge('ilac', { boy: 18 })),
              el('div', { class: 'liste__govde' }, el('div', { class: 'liste__baslik' }, ilacEtiketi(m)), el('div', { class: 'liste__alt' }, `${t('ilac.stok', 'Stok')} ${m.stok} · ${paraMetni(m.satisFiyati)}`)))))));
      }

      const govde = hareketler.length
        ? el('div', { class: 'tablo-kap' }, el('table', { class: 'tablo' },
          el('thead', {}, el('tr', {}, el('th', {}, t('genel.tarih', 'Tarih')), el('th', {}, t('stok.islem_turu', 'İşlem')), el('th', { class: 'sayi' }, t('stok.degisim', 'Değişim')), el('th', { class: 'sayi' }, t('stok.sonra', 'Sonra')), el('th', {}, t('genel.aciklama', 'Açıklama')))),
          el('tbody', {}, ...hareketler.map((h) => el('tr', {},
            el('td', {}, trTarihSaat(h.tarih)),
            el('td', {}, rozet(secenekAdi(HAREKET_TURLERI, h.tur, 'hareket'), h.tur === 'giris' || h.tur === 'iade' ? 'yesil' : h.tur === 'fire' ? 'kirmizi' : 'gri')),
            el('td', { class: 'sayi' }, (h.adet > 0 ? '+' : '') + h.adet),
            el('td', { class: 'sayi' }, String(h.sonrasi)),
            el('td', {}, h.aciklama || '—'))))))
        : bosDurum({ simge: 'saat', baslik: t('stok.hareket_yok', 'Hareket yok'), alt: t('stok.hareket_bos_alt', 'Stok işlemleri burada listelenir.') });

      kok.appendChild(kart({}, el('div', { class: 'kart__bas' }, el('h2', {}, t('stok.hareketler', 'Stok hareketleri'))), govde));
    }

    await ciz();
    return depo.dinle('ilaclar', () => ciz());
  },
};
