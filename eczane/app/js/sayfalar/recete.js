// Reçete kartı: karşılama, paylaşma ve yazdırma.
// Karşılama satır satır yürür: her "ver" stoktan düşer ve hareket bırakır,
// "verilemedi" sebebiyle kapanır, "geri al" iade hareketiyle stoğa döndürür.
// Reçetedeki durum ile stok geçmişi hep birbirini tutar.
import { el, temizle, btn, btnS, girdi, secim, metinAlani, alan, kart, rozet, sayfaBas, bosDurum, sirala } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import {
  RECETE_TURLERI, VERILMEME_SEBEPLERI, OLCUMLER, doluOlcumler,
  satirDurumu, satirKalan, satirKapali, receteOzet, DURUM_ADLARI, receteUyarilari, receteMetni,
} from '../paylasilan/recete.js';
import { satirVer, satirVerilmedi, satirGeriAl, hepsiniVer } from '../depo/recete.js';
import { ilacUyarilari, stokDurumu } from '../paylasilan/ilac.js';
import { tamAd, hastaYasi, alerjiCakismasi } from '../paylasilan/hasta.js';
import { basHarfler, paraMetni, telefonNormalize } from '../paylasilan/metin.js';
import { trTarih, trTarihSaat } from '../paylasilan/tarih.js';
import { t, secenekleriCevir, secenekAdi } from '../i18n.js';
import { kagitCiz, kagidiYazdir } from '../kagit.js';
import { hataMetni, uyariMetni } from '../hatalar.js';
import { kodSatiri } from '../paylasilan/dogrulama.js';

const DURUM_RENGI = { bekliyor: 'sari', kismi: 'mavi', tamamlandi: 'yesil', bos: 'gri' };
const SATIR_RENGI = { bekliyor: 'gri', kismi: 'mavi', verildi: 'yesil', verilmedi: 'kirmizi' };
const SATIR_ADI = { bekliyor: 'Bekliyor', kismi: 'Kısmen verildi', verildi: 'Verildi', verilmedi: 'Verilmedi' };

/** Kısmi verme kutusu: kalandan az adet. */
async function kismiKutusu(ctx, satir) {
  const kalan = satirKalan(satir);
  const adet = girdi({ type: 'number', min: 1, max: kalan, step: 1, value: Math.max(1, kalan - 1) });
  const sonuc = await ctx.modal({
    baslik: t('recete.kismi', 'Kısmi ver'),
    govde: el('div', {},
      el('p', {}, t('recete.kismi_aciklama', '{ad} — {n} adet bekliyor.', { ad: satir.ilacAdi, n: kalan })),
      alan(t('recete.verilecek_adet', 'Verilecek adet'), adet)),
    dugmeler: [
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: t('recete.ver', 'Ver'), sinif: 'btn--birincil', cb: () => {
        const n = Math.floor(Number(adet.value));
        if (!(n > 0) || n > kalan) { adet.classList.add('input--hata'); adet.focus(); return false; }
        return n;
      } },
    ],
  });
  return typeof sonuc === 'number' ? sonuc : null;
}

/** Verilemedi kutusu: sebep ve not. */
async function sebepKutusu(ctx, satir) {
  const sebep = secim(secenekleriCevir(VERILMEME_SEBEPLERI, 'sebep'), { value: 'stok_yok' });
  const not = metinAlani({ rows: 2, value: satir.not || '', placeholder: t('genel.aciklama_istege_bagli', 'İsteğe bağlı açıklama') });
  const sonuc = await ctx.modal({
    baslik: t('recete.verilemedi_baslik', 'Verilemedi olarak işaretle'),
    govde: el('div', {}, el('p', {}, satir.ilacAdi), alan(t('recete.sebep', 'Sebep'), sebep), alan(t('genel.not', 'Not'), not)),
    dugmeler: [
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: t('recete.isaretle', 'İşaretle'), sinif: 'btn--birincil', cb: () => ({ sebep: sebep.value, not: not.value.trim() }) },
    ],
  });
  return sonuc && typeof sonuc === 'object' ? sonuc : null;
}

/** Reçeteyi düz metne çevirir: WhatsApp, e-posta ve panoya kopyalama aynı metni kullanır. */
function metneCevir(recete, hasta, ayar) {
  const kod = recete.dogrulamaKodu ? `\n\n${kodSatiri(recete.dogrulamaKodu)}` : '';
  return receteMetni(recete, hasta, ayar, {
    recete: t('nav.recete', 'Reçete'), tarih: t('genel.tarih', 'Tarih'), hasta: t('nav.hasta', 'Hasta'),
    tani: t('recete.tani', 'Tanı'), ilaclar: t('nav.ilaclar', 'İlaçlar'), not: t('genel.not', 'Not'),
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

export default {
  baslik: 'Reçete',
  async cizim(kok, ctx) {
    const { depo, git, basari, hata, uyar, onayla } = ctx;
    let sira = 0;

    async function ciz() {
      const benim = ++sira;
      const recete = await depo.al('receteler', ctx.param.id);
      if (benim !== sira) return;
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
      if (benim !== sira) return;

      const ozet = receteOzet(recete);
      const uyarilar = receteUyarilari(recete.satirlar, hasta, ilaclar, {
        alerjiBul: alerjiCakismasi,
        ilacUyarilariBul: (i) => ilacUyarilari(i),
      });

      temizle(kok);
      kok.append(sayfaBas(recete.receteNo || t('nav.recete', 'Reçete'), {
        alt: [trTarih(recete.tarih), secenekAdi(RECETE_TURLERI, recete.tur, 'recete.tur'), tamAd(hasta)].filter(Boolean).join(' · '),
        geri: () => git('/receteler'),
        eylemler: [
          btnS('telefon', t('paylas.gonder', 'Gönder'), { class: 'btn btn--birincil', onclick: () => paylasKutusu(ctx, recete, hasta, ayar) }),
          btnS('yazdir', t('genel.yazdir', 'Yazdır'), { class: 'btn', onclick: () => kagidiYazdir({ recete, hasta, ayar }) }),
          ozet.durum === 'bekliyor' ? btnS('kalem', t('genel.duzenle', 'Düzenle'), { class: 'btn', onclick: () => git(`/recete/${recete.id}/duzenle`) }) : null,
          btnS('cop', t('genel.sil', 'Sil'), { class: 'btn', onclick: async () => {
            const verilmis = (recete.satirlar || []).some((s) => Number(s.verilenAdet || 0) > 0);
            const mesaj = verilmis
              ? t('recete.sil_onay_verilmis', 'Bu reçetede verilmiş ilaçlar var. Reçete silinirse stok geri alınmaz — önce satırları geri alman gerekebilir. Yine de silinsin mi?')
              : t('recete.sil_onay', 'Reçete silinsin mi?');
            if (await onayla(mesaj, { tehlikeli: true, evet: t('genel.sil', 'Sil') })) {
              await depo.sil('receteler', recete.id);
              basari(t('recete.silindi', 'Reçete silindi'));
              git('/receteler');
            }
          } }),
        ],
      }));

      /* --- Hasta ve künye --- */
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, t('nav.hasta', 'Hasta')), rozet(t('durum.' + ozet.durum, DURUM_ADLARI[ozet.durum] || ozet.durum), DURUM_RENGI[ozet.durum] || 'gri')),
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

      /* --- Karşılama --- */
      const tbody = el('tbody', {});
      (recete.satirlar || []).forEach((s, i) => {
        const durum = satirDurumu(s);
        const kalan = satirKalan(s);
        const ilac = ilaclar.find((x) => x.id === s.ilacId);
        const stok = Number(ilac?.stok ?? 0);
        const satirUyarilari = uyarilar.filter((u) => u.satir === i);

        // Açık satır verilebilir; bir şey verilmiş ya da sebeple kapatılmışsa geri
        // alınabilir. Kısmi satırda ikisi birden görünür.
        const acik = !satirKapali(s);
        const geriAlinabilir = Number(s.verilenAdet || 0) > 0 || !!s.sebep;
        const eylemler = el('div', { class: 'satir', style: { justifyContent: 'flex-end' } },
          acik ? btn(t('recete.ver', 'Ver'), {
            class: 'btn btn--kucuk btn--birincil',
            disabled: !!ilac && stok <= 0,
            title: ilac && stok <= 0 ? t('ilac.stok_yok', 'Stokta yok') : t('recete.ver_ipucu', '{n} adet ver', { n: kalan }),
            onclick: () => calistir(() => satirVer(depo, recete.id, i), t('recete.verildi_bildirim', '{ad}: {n} adet verildi', { ad: s.ilacAdi, n: kalan })),
          }) : null,
          acik && kalan > 1 ? btn(t('recete.kismi', 'Kısmi'), { class: 'btn btn--kucuk', onclick: async () => {
            const n = await kismiKutusu(ctx, s);
            if (n) calistir(() => satirVer(depo, recete.id, i, n), t('recete.verildi_bildirim', '{ad}: {n} adet verildi', { ad: s.ilacAdi, n }));
          } }) : null,
          acik ? btn(t('recete.verilemedi', 'Verilemedi'), { class: 'btn btn--kucuk', onclick: async () => {
            const r = await sebepKutusu(ctx, s);
            if (r) calistir(() => satirVerilmedi(depo, recete.id, i, r.sebep, r.not), `${s.ilacAdi}: ${secenekAdi(VERILMEME_SEBEPLERI, r.sebep, 'sebep')}`);
          } }) : null,
          geriAlinabilir ? btnS('yenile', t('recete.geri_al', 'Geri al'), { class: 'btn btn--kucuk btn--sade', onclick: async () => {
            const geri = Number(s.verilenAdet || 0);
            const mesaj = geri > 0
              ? t('recete.geri_onay', '{ad}: {n} adet stoğa iade edilecek. Geri alınsın mı?', { ad: s.ilacAdi, n: geri })
              : t('recete.geri_onay_bos', '{ad} yeniden bekleyene alınsın mı?', { ad: s.ilacAdi });
            if (await onayla(mesaj, { evet: t('recete.geri_al', 'Geri al') })) {
              calistir(() => satirGeriAl(depo, recete.id, i), t('recete.geri_alindi', '{ad} geri alındı', { ad: s.ilacAdi }));
            }
          } }) : null);

        tbody.appendChild(el('tr', {},
          el('td', {},
            el('div', { class: 'liste__baslik' }, s.ilacAdi),
            el('div', { class: 'liste__alt' }, [s.kullanim, s.sure].filter(Boolean).join(' · ') || '—'),
            s.sebep ? el('div', { class: 'liste__alt' }, `${t('recete.sebep', 'Sebep')}: ${secenekAdi(VERILMEME_SEBEPLERI, s.sebep, 'sebep')}${s.not ? ' · ' + s.not : ''}`) : null,
            ...satirUyarilari.map((u) => el('div', { class: 'alan__hata', style: u.tur === 'uyari' ? { color: 'rgb(var(--sari))' } : null }, uyariMetni(u)))),
          el('td', { class: 'sayi' }, String(s.adet)),
          el('td', { class: 'sayi' }, `${s.verilenAdet || 0}`),
          el('td', {}, ilac
            ? rozet(`${t('ilac.stok', 'Stok')} ${stok}`, stokDurumu(ilac) === 'yok' ? 'kirmizi' : stokDurumu(ilac) === 'kritik' ? 'sari' : 'gri')
            : el('span', { class: 'sessiz' }, t('recete.kayit_yok', 'kayıt yok'))),
          el('td', {}, rozet(t('satir.' + durum, SATIR_ADI[durum]), SATIR_RENGI[durum]), s.verilmeTarihi ? el('div', { class: 'liste__alt' }, trTarihSaat(s.verilmeTarihi)) : null),
          el('td', {}, eylemler)));
      });

      const bekleyenVar = (recete.satirlar || []).some((s) => satirKalan(s) > 0);
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' },
          el('h2', {}, t('recete.karsilama', 'Karşılama')),
          bekleyenVar
            ? btnS('onay', t('recete.hepsini_ver', 'Bekleyenlerin hepsini ver'), { class: 'btn btn--kucuk btn--birincil', onclick: async () => {
              if (!await onayla(t('recete.hepsi_onay', 'Bekleyen bütün satırlar stoktan verilecek. Devam edilsin mi?'), { evet: t('recete.ver', 'Ver') })) return;
              try {
                const r = await hepsiniVer(depo, recete.id);
                if (r.verilen) basari(t('recete.satir_verildi', '{n} satır verildi', { n: r.verilen }));
                for (const a of r.atlanan) uyar(`${a.ad}: ${hataMetni(a.hata)}`);
                if (!r.verilen && !r.atlanan.length) uyar(t('recete.verilecek_yok', 'Verilecek satır kalmadı'));
              } catch (e) { hata(hataMetni(e)); }
              ciz();
            } })
            : rozet(t('recete.karsilama_tamam', 'Karşılama tamam'), 'yesil')),
        recete.satirlar?.length
          ? el('div', { class: 'tablo-kap' }, el('table', { class: 'tablo' },
            el('thead', {}, el('tr', {},
              el('th', {}, t('nav.ilac', 'İlaç')), el('th', { class: 'sayi' }, t('recete.istenen', 'İstenen')), el('th', { class: 'sayi' }, t('recete.verilen', 'Verilen')),
              el('th', {}, t('ilac.stok', 'Stok')), el('th', {}, t('genel.durum', 'Durum')), el('th', {}, ''))),
            tbody))
          : bosDurum({ simge: 'ilac', baslik: t('recete.ilac_yok', 'Reçetede ilaç yok') }),
        el('p', { class: 'kart__alt', style: { marginBlockStart: 'var(--b-3)' } },
          t('recete.ozet', '{a}/{b} satır verildi · {c} bekliyor · verilen tutar {d}', {
            a: ozet.verilen, b: ozet.toplam, c: ozet.bekleyen, d: paraMetni(ozet.tutar),
          }))));

      kok.appendChild(kagitCiz({ recete, hasta, ayar }));
      sirala(tbody);
    }

    /** İşlemi çalıştırır, sonucu bildirir, ekranı tazeler. */
    async function calistir(is, basariMetni) {
      try {
        await is();
        basari(basariMetni);
      } catch (e) {
        hata(hataMetni(e));
      }
      ciz();
    }

    await ciz();
    return depo.dinle('receteler', () => {});
  },
};
