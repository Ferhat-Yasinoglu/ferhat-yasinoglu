// İlaç kartı: künye, uyarılar, stok işlemleri ve hareket geçmişi.
// Stok yalnız buradaki işlemlerle değişir; her işlem geçmişe yazılır.
import { el, temizle, btn, btnS, girdi, secim, metinAlani, alan, kart, rozet, sayfaBas, bosDurum, uyariSeridi } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { ilacEtiketi, formAdi, ilacUyarilari, muadiller, HAREKET_TURLERI, hareketAdi } from '../paylasilan/ilac.js';
import { paraMetni } from '../paylasilan/metin.js';
import { trTarih, trTarihSaat } from '../paylasilan/tarih.js';
import { hareketUygula, ilacHareketleri } from '../depo/stok.js';
import { ilacKutusu, ilacRozetleri } from './ilaclar.js';

/** Stok işlemi kutusu: tür, miktar ve açıklama. */
async function stokKutusu(ctx, ilac) {
  const { depo, modal, basari, hata } = ctx;
  const tur = secim(HAREKET_TURLERI.filter(([k]) => k !== 'recete'), { name: 'tur', value: 'giris' });
  const adet = girdi({ name: 'adet', type: 'number', min: 0, step: 1, value: 1 });
  const aciklama = metinAlani({ name: 'aciklama', rows: 2, placeholder: 'Fatura no, sebep…' });
  const ipucu = el('p', { class: 'alan__ipucu' });
  const adetAlani = alan('Adet', adet);

  const ipucuYaz = () => {
    const s = tur.value === 'sayim'
      ? `Sayım sonucu: stok bu sayıya eşitlenir (şu an ${ilac.stok ?? 0}).`
      : `Şu anki stok ${ilac.stok ?? 0}. Bu işlem stoğu ${tur.value === 'giris' || tur.value === 'iade' ? 'artırır' : 'azaltır'}.`;
    ipucu.textContent = s;
  };
  tur.onchange = ipucuYaz;
  ipucuYaz();

  const sonuc = await modal({
    baslik: 'Stok işlemi',
    govde: el('div', {}, alan('İşlem', tur), adetAlani, ipucu, alan('Açıklama', aciklama)),
    dugmeler: [
      { metin: 'Vazgeç', deger: null },
      { metin: 'Uygula', sinif: 'btn--birincil', cb: () => {
        const n = Number(adet.value);
        if (!Number.isFinite(n) || n < 0 || (n === 0 && tur.value !== 'sayim')) { adet.classList.add('input--hata'); adet.focus(); return false; }
        return { tur: tur.value, adet: n, aciklama: aciklama.value.trim() };
      } },
    ],
  });
  if (!sonuc || typeof sonuc !== 'object') return false;
  try {
    await hareketUygula(depo, { ilacId: ilac.id, ...sonuc });
    basari('Stok güncellendi');
    return true;
  } catch (e) { hata(e.message || 'İşlem yapılamadı'); return false; }
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
        kok.appendChild(bosDurum({ simge: 'hata', baslik: 'İlaç bulunamadı', alt: 'Kayıt silinmiş olabilir.', eylem: btn('İlaçlara dön', { class: 'btn', onclick: () => git('/ilaclar') }) }));
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
          btnS('kutu', 'Stok işlemi', { class: 'btn btn--birincil', onclick: async () => { if (await stokKutusu(ctx, ilac)) ciz(); } }),
          btnS('kalem', 'Düzenle', { class: 'btn', onclick: async () => { if (await ilacKutusu(ctx, ilac)) ciz(); } }),
          btnS('cop', 'Sil', { class: 'btn', onclick: async () => {
            if (await onayla(`"${ilac.ad}" silinsin mi? Hareket geçmişi kalır ama ilaç listelerde görünmez.`, { tehlikeli: true, evet: 'Sil' })) {
              await depo.sil('ilaclar', ilac.id);
              basari('İlaç silindi');
              git('/ilaclar');
            }
          } }),
        ],
      }));

      const seridi = uyariSeridi(uyarilar);
      if (seridi) kok.appendChild(seridi);

      const kunye = [
        ['Stok', el('strong', { class: 'sayi-yazi' }, String(ilac.stok ?? 0))],
        ['Kritik eşik', String(ilac.kritikStok ?? 0)],
        ['Form', formAdi(ilac.form) || '—'],
        ['Doz', ilac.doz || '—'],
        ['Kutudaki adet', ilac.kutuAdedi || '—'],
        ['Barkod', ilac.barkod || '—'],
        ['Son kullanma', trTarih(ilac.sonKullanma)],
        ['Alış', paraMetni(ilac.alisFiyati)],
        ['Satış', paraMetni(ilac.satisFiyati)],
        ['Raf', ilac.raf || '—'],
        ['Reçete', ilac.receteli ? 'Reçete ile verilir' : 'Reçetesiz'],
      ];
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, 'Künye'), el('div', { class: 'satir' }, ...ilacRozetleri(ilac))),
        el('div', { class: 'izgara' }, ...kunye.map(([b, d]) =>
          el('div', {}, el('div', { class: 'alan__etiket' }, b), el('div', {}, d)))),
        ilac.notlar ? el('p', { class: 'kart__alt', style: { marginBlockStart: 'var(--b-3)' } }, ilac.notlar) : null));

      if (esdeger.length) {
        kok.appendChild(kart({},
          el('div', { class: 'kart__bas' }, el('h2', {}, 'Muadiller'), el('span', { class: 'kart__alt' }, 'Aynı etken madde, stokta var')),
          el('div', { class: 'liste' }, ...esdeger.map((m) =>
            el('a', { class: 'liste__satir', href: `#/ilac/${m.id}` },
              el('span', { class: 'avatar' }, simge('ilac', { boy: 18 })),
              el('div', { class: 'liste__govde' }, el('div', { class: 'liste__baslik' }, ilacEtiketi(m)), el('div', { class: 'liste__alt' }, `Stok ${m.stok} · ${paraMetni(m.satisFiyati)}`)))))));
      }

      const govde = hareketler.length
        ? el('div', { class: 'tablo-kap' }, el('table', { class: 'tablo' },
          el('thead', {}, el('tr', {}, el('th', {}, 'Tarih'), el('th', {}, 'İşlem'), el('th', { class: 'sayi' }, 'Değişim'), el('th', { class: 'sayi' }, 'Sonra'), el('th', {}, 'Açıklama'))),
          el('tbody', {}, ...hareketler.map((h) => el('tr', {},
            el('td', {}, trTarihSaat(h.tarih)),
            el('td', {}, rozet(hareketAdi(h.tur), h.tur === 'giris' || h.tur === 'iade' ? 'yesil' : h.tur === 'fire' ? 'kirmizi' : 'gri')),
            el('td', { class: 'sayi' }, (h.adet > 0 ? '+' : '') + h.adet),
            el('td', { class: 'sayi' }, String(h.sonrasi)),
            el('td', {}, h.aciklama || '—'))))))
        : bosDurum({ simge: 'saat', baslik: 'Hareket yok', alt: 'Stok işlemleri burada listelenir.' });

      kok.appendChild(kart({}, el('div', { class: 'kart__bas' }, el('h2', {}, 'Stok hareketleri')), govde));
    }

    await ciz();
    return depo.dinle('ilaclar', () => ciz());
  },
};
