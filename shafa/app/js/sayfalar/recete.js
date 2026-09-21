// Reçete kartı: yazılan reçetenin künyesi, gönderilmesi ve yazdırılması.
// Karşılama yok — hasta ilacını dışarıdaki eczaneden kendi alıyor.
import { el, temizle, btn, btnS, metinAlani, alan, kart, sayfaBas, bosDurum, sirala } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { RECETE_TURLERI, doluOlcumler, receteUyarilari, receteMetni } from '../paylasilan/recete.js';
import { tamAd, hastaYasi, alerjiCakismasi } from '../paylasilan/hasta.js';
import { basHarfler, telefonNormalize } from '../paylasilan/metin.js';
import { trTarih, trTarihSaat } from '../paylasilan/tarih.js';
import { t, secenekAdi } from '../i18n.js';
import { kagitCiz, kagidiYazdir } from '../kagit.js';
import { uyariMetni } from '../hatalar.js';
import { kodSatiri } from '../paylasilan/dogrulama.js';

/** Reçeteyi düz metne çevirir: WhatsApp, e-posta ve panoya kopyalama aynı metni kullanır. */
function metneCevir(recete, hasta, ayar) {
  const kod = recete.dogrulamaKodu ? `\n\n${kodSatiri(recete.dogrulamaKodu)}` : '';
  return receteMetni(recete, hasta, ayar, {
    recete: t('nav.recete', 'Reçete'), tarih: t('genel.tarih', 'Tarih'), hasta: t('nav.hasta', 'Hasta'),
    tani: t('recete.tani', 'Tanı'), ilaclar: t('nav.ilaclar', 'İlaçlar'), not: t('genel.not', 'Not'),
    belirtiler: t('kagit.belirtiler', 'Belirtiler'), laboratuvar: t('kagit.laboratuvar', 'Laboratuvar'),
    alerji: t('hasta.alerji', 'Alerji'), adet: t('recete.kutu', 'kutu'), hastaAdi: tamAd(hasta),
  }) + kod;
}

/** Paylaşma kutusu: WhatsApp, e-posta, pano ve cihazın kendi paylaşma penceresi. */
async function paylasKutusu(ctx, recete, hasta, ayar) {
  const metin = metneCevir(recete, hasta, ayar);
  const baslik = `${t('nav.recete', 'Reçete')} ${recete.receteNo || ''}`.trim();
  const numara = telefonNormalize(hasta?.telefon, ayar.ulkeKodu);
  const onizleme = metinAlani({ rows: 10, value: metin, readonly: true, style: { fontFamily: 'var(--mono)', fontSize: 'var(--f-s)' } });

  const ac = (adres) => window.open(adres, '_blank', 'noopener');
  const dugmeler = el('div', { class: 'satir' },
    btnS('telefon', numara ? t('paylas.whatsapp_numara', 'WhatsApp ({n})', { n: hasta.telefon }) : t('paylas.whatsapp', 'WhatsApp'), {
      class: 'btn btn--birincil',
      onclick: () => ac(`https://wa.me/${numara}?text=${encodeURIComponent(onizleme.value)}`),
    }),
    btnS('not', t('paylas.eposta', 'E-posta'), {
      class: 'btn',
      onclick: () => ac(`mailto:${hasta?.eposta || ''}?subject=${encodeURIComponent(baslik)}&body=${encodeURIComponent(onizleme.value)}`),
    }),
    btnS('kopya', t('paylas.kopyala', 'Panoya kopyala'), {
      class: 'btn',
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(onizleme.value);
          ctx.basari(t('paylas.kopyalandi', 'Reçete panoya kopyalandı'));
        } catch {
          onizleme.select();
          ctx.uyar(t('paylas.kopyalanamadi', 'Panoya kopyalanamadı — metin seçildi, elle kopyala.'));
        }
      },
    }),
    navigator.share
      ? btnS('git', t('paylas.cihaz', 'Diğer uygulamalar'), {
        class: 'btn',
        onclick: () => navigator.share({ title: baslik, text: onizleme.value }).catch(() => {}),
      })
      : null);

  await ctx.modal({
    baslik: t('paylas.baslik', 'Reçeteyi gönder'),
    genis: true,
    govde: el('div', {},
      el('p', { class: 'kart__alt' }, t('paylas.aciklama', 'Reçete düz metin olarak gider. Kâğıt görünümü için "Yazdır" ile PDF kaydedip dosya olarak ekleyebilirsin.')),
      dugmeler,
      el('div', { style: { marginBlockStart: 'var(--b-3)' } }, alan(t('paylas.onizleme', 'Gönderilecek metin'), onizleme))),
    dugmeler: [{ metin: t('genel.kapat', 'Kapat'), deger: true }],
  });
}

// Gezinme sırası. Sayfa ilk çizimden önce veriyi bekliyor; o sırada başka
// bir sayfaya geçilirse eski çizim geri dönüp yeni sayfanın üstüne yazıyordu
// (düzenlemeden "yeni reçete"ye geçince eski hasta ekranda kalıyordu).
// Her çizim sırasını alır, beklerken yenisi başladıysa sessizce çekilir.
let cizimSirasi = 0;

export default {
  baslik: 'Reçete',
  async cizim(kok, ctx) {
    const benimSira = ++cizimSirasi;
    const { depo, git, basari, onayla } = ctx;
    let sira = 0;

    async function ciz() {
      const benim = ++sira;
      const recete = await depo.al('receteler', ctx.param.id);
      if (benim !== sira || benimSira !== cizimSirasi) return;
      if (!recete) {
        temizle(kok);
        kok.appendChild(bosDurum({
          simge: 'hata', baslik: t('recete.bulunamadi', 'Reçete bulunamadı'),
          alt: t('genel.silinmis_olabilir', 'Kayıt silinmiş olabilir.'),
          eylem: btn(t('recete.geri', 'Reçetelere dön'), { class: 'btn', onclick: () => git('/receteler') }),
        }));
        return;
      }
      const [hasta, ilaclar, ayar] = await Promise.all([
        recete.hastaId ? depo.al('hastalar', recete.hastaId) : null,
        depo.listele('ilaclar'),
        depo.ayarlar(),
      ]);
      if (benim !== sira || benimSira !== cizimSirasi) return;

      const uyarilar = receteUyarilari(recete.satirlar, hasta, ilaclar, { alerjiBul: alerjiCakismasi });

      temizle(kok);
      kok.append(sayfaBas(recete.receteNo || t('nav.recete', 'Reçete'), {
        alt: [trTarih(recete.tarih), secenekAdi(RECETE_TURLERI, recete.tur, 'recete.tur'), tamAd(hasta)].filter(Boolean).join(' · '),
        geri: () => git('/receteler'),
        eylemler: [
          btnS('telefon', t('paylas.gonder', 'Gönder'), { class: 'btn btn--birincil', onclick: () => paylasKutusu(ctx, recete, hasta, ayar) }),
          btnS('yazdir', t('genel.yazdir', 'Yazdır'), { class: 'btn', onclick: () => kagidiYazdir({ recete, hasta, ayar }) }),
          btnS('kalem', t('genel.duzenle', 'Düzenle'), { class: 'btn', onclick: () => git(`/recete/${recete.id}/duzenle`) }),
          btnS('cop', t('genel.sil', 'Sil'), { class: 'btn', onclick: async () => {
            if (await onayla(t('recete.sil_onay', 'Reçete silinsin mi?'), { tehlikeli: true, evet: t('genel.sil', 'Sil') })) {
              await depo.sil('receteler', recete.id);
              basari(t('recete.silindi', 'Reçete silindi'));
              git('/receteler');
            }
          } }),
        ],
      }));

      /* --- Hasta ve künye --- */
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, t('nav.hasta', 'Hasta'))),
        hasta
          ? el('div', { class: 'liste' },
            el('a', { class: 'liste__satir', href: `#/hasta/${hasta.id}` },
              el('span', { class: 'avatar' }, basHarfler(tamAd(hasta))),
              el('div', { class: 'liste__govde' },
                el('div', { class: 'liste__baslik' }, tamAd(hasta)),
                el('div', { class: 'liste__alt' }, [hastaYasi(hasta) !== null ? t('hasta.yas', '{n} yaş', { n: hastaYasi(hasta) }) : null, hasta.telefon].filter(Boolean).join(' · ') || '—'))))
          : el('p', { class: 'kart__alt' }, t('recete.hasta_yok', 'Hasta kaydı bulunamadı.')),
        ...(hasta?.alerjiler || []).map((a) => el('div', { class: 'uyari uyari--hata', style: { marginBlockStart: 'var(--b-2)' } }, simge('uyari', { boy: 16 }), el('span', {}, t('hasta.alerji_satiri', 'Alerji: {a}', { a })))),
        el('div', { class: 'izgara', style: { marginBlockStart: 'var(--b-4)' } },
          ...[[t('recete.tani', 'Tanı'), [recete.tani, recete.taniKodu].filter(Boolean).join(' · ') || '—'],
            [t('recete.protokol', 'Protokol no'), recete.protokolNo || '—'],
            [t('recete.yazan', 'Yazan'), [recete.doktorUnvan, recete.doktorAd].filter(Boolean).join(' ') || '—'],
            [t('recete.yazildigi_an', 'Yazıldığı an'), trTarihSaat(recete.olusturuldu)]]
            .map(([b, d]) => el('div', {}, el('div', { class: 'alan__etiket' }, b), el('div', {}, d)))),
        recete.notlar ? el('p', { class: 'kart__alt', style: { marginBlockStart: 'var(--b-3)' } }, recete.notlar) : null));

      /* --- Klinik ölçümler (girilmişse) --- */
      const olcumler = doluOlcumler(recete);
      if (olcumler.length) {
        kok.appendChild(kart({},
          el('div', { class: 'kart__bas' }, el('h2', {}, t('recete.olcumler', 'Klinik ölçümler'))),
          el('div', { class: 'izgara' }, ...olcumler.map(([anahtar, ad, kisa, birim]) =>
            el('div', {},
              el('div', { class: 'alan__etiket' }, `${t('olcum.' + anahtar, ad)} (${kisa})`),
              el('div', {}, `${recete.olcumler[anahtar]} ${birim}`))))));
      }

      /* --- Reçetedeki ilaçlar --- */
      const tbody = el('tbody', {});
      (recete.satirlar || []).forEach((s, i) => {
        const satirUyarilari = uyarilar.filter((u) => u.satir === i);
        tbody.appendChild(el('tr', {},
          el('td', { class: 'sayi' }, String(i + 1)),
          el('td', {},
            el('div', { class: 'liste__baslik' }, s.ilacAdi),
            el('div', { class: 'liste__alt' }, [s.kullanim, s.sure].filter(Boolean).join(' \u00b7 ') || '\u2014'),
            s.not ? el('div', { class: 'liste__alt' }, s.not) : null,
            ...satirUyarilari.map((u) => el('div', { class: 'alan__hata', style: u.tur === 'uyari' ? { color: 'rgb(var(--sari))' } : null }, uyariMetni(u)))),
          el('td', { class: 'sayi' }, String(s.adet))));
      });

      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' },
          el('h2', {}, t('nav.ilaclar', '\u0130la\u00e7lar')),
          el('span', { class: 'kart__alt' }, t('recete.ilac_sayisi', '{n} ila\u00e7', { n: (recete.satirlar || []).length }))),
        recete.satirlar?.length
          ? el('div', { class: 'tablo-kap' }, el('table', { class: 'tablo' },
            el('thead', {}, el('tr', {},
              el('th', { class: 'sayi' }, '#'), el('th', {}, t('nav.ilac', '\u0130la\u00e7')), el('th', { class: 'sayi' }, t('genel.adet', 'Adet')))),
            tbody))
          : bosDurum({ simge: 'ilac', baslik: t('recete.ilac_yok', 'Re\u00e7etede ila\u00e7 yok') })));

      kok.appendChild(kagitCiz({ recete, hasta, ayar }));
      sirala(tbody);
    }

    await ciz();
  },
};
