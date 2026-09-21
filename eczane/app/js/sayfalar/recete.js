// Reçete kartı: karşılama ve yazdırma.
// Karşılama satır satır yürür: her "ver" stoktan düşer ve hareket bırakır,
// "verilemedi" sebebiyle kapanır, "geri al" iade hareketiyle stoğa döndürür.
// Reçetedeki durum ile stok geçmişi hep birbirini tutar.
import { el, temizle, btn, btnS, girdi, secim, metinAlani, alan, kart, rozet, sayfaBas, bosDurum, sirala } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import {
  RECETE_TURLERI, VERILMEME_SEBEPLERI, receteTuruAdi, sebepAdi,
  satirDurumu, satirKalan, satirKapali, receteOzet, DURUM_ADLARI, receteUyarilari,
} from '../paylasilan/recete.js';
import { satirVer, satirVerilmedi, satirGeriAl, hepsiniVer } from '../depo/recete.js';
import { ilacUyarilari, stokDurumu } from '../paylasilan/ilac.js';
import { tamAd, hastaYasi, alerjiCakismasi, SIGORTALAR } from '../paylasilan/hasta.js';
import { basHarfler, paraMetni } from '../paylasilan/metin.js';
import { trTarih, trTarihSaat } from '../paylasilan/tarih.js';

const DURUM_RENGI = { bekliyor: 'sari', kismi: 'mavi', tamamlandi: 'yesil', bos: 'gri' };
const SATIR_RENGI = { bekliyor: 'gri', kismi: 'mavi', verildi: 'yesil', verilmedi: 'kirmizi' };
const SATIR_ADI = { bekliyor: 'Bekliyor', kismi: 'Kısmen verildi', verildi: 'Verildi', verilmedi: 'Verilmedi' };

/** Kısmi verme kutusu: kalandan az adet. */
async function kismiKutusu(ctx, satir) {
  const kalan = satirKalan(satir);
  const adet = girdi({ type: 'number', min: 1, max: kalan, step: 1, value: Math.max(1, kalan - 1) });
  const sonuc = await ctx.modal({
    baslik: 'Kısmi ver',
    govde: el('div', {},
      el('p', {}, `${satir.ilacAdi} — ${kalan} adet bekliyor.`),
      alan('Verilecek adet', adet)),
    dugmeler: [
      { metin: 'Vazgeç', deger: null },
      { metin: 'Ver', sinif: 'btn--birincil', cb: () => {
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
  const sebep = secim(VERILMEME_SEBEPLERI, { value: 'stok_yok' });
  const not = metinAlani({ rows: 2, value: satir.not || '', placeholder: 'İsteğe bağlı açıklama' });
  const sonuc = await ctx.modal({
    baslik: 'Verilemedi olarak işaretle',
    govde: el('div', {},
      el('p', {}, satir.ilacAdi),
      alan('Sebep', sebep), alan('Not', not)),
    dugmeler: [
      { metin: 'Vazgeç', deger: null },
      { metin: 'İşaretle', sinif: 'btn--birincil', cb: () => ({ sebep: sebep.value, not: not.value.trim() }) },
    ],
  });
  return sonuc && typeof sonuc === 'object' ? sonuc : null;
}

/** Yazdırma bölümü: ekranda gizli, kâğıtta tek görünen şey. */
function yazdirmaBolumu(recete, hasta, ayar) {
  const boyut = ayar.yazdirmaBoyutu === 'A5' ? 'A5' : 'A4';
  const stil = el('style', {});
  stil.textContent = `@page { size: ${boyut}; margin: ${boyut === 'A5' ? '10mm' : '15mm'}; }`;

  const satir = (etiket, deger) => (deger ? el('div', { class: 'yaz__cift' }, el('b', {}, etiket + ': '), el('span', {}, deger)) : null);
  const yas = hastaYasi(hasta);

  return el('div', { class: 'yazdir-alan' }, stil,
    el('header', { class: 'yaz__antet' },
      el('div', {},
        el('div', { class: 'yaz__kurum' }, ayar.eczaneAdi || ayar.kurum || ''),
        ayar.adres ? el('div', { class: 'yaz__ince' }, ayar.adres) : null,
        ayar.telefon ? el('div', { class: 'yaz__ince' }, 'Tel: ' + ayar.telefon) : null),
      el('div', { class: 'yaz__sag' },
        el('div', { class: 'yaz__kurum' }, [recete.doktorUnvan, recete.doktorAd].filter(Boolean).join(' ')),
        recete.diplomaNo ? el('div', { class: 'yaz__ince' }, 'Diploma no: ' + recete.diplomaNo) : null,
        recete.kurum ? el('div', { class: 'yaz__ince' }, recete.kurum) : null)),

    el('h1', { class: 'yaz__baslik' }, receteTuruAdi(recete.tur).toLocaleUpperCase('tr')),

    el('div', { class: 'yaz__ust' },
      satir('Reçete no', recete.receteNo),
      satir('Tarih', trTarih(recete.tarih)),
      satir('Protokol no', recete.protokolNo)),

    el('div', { class: 'yaz__kutu' },
      satir('Hasta', tamAd(hasta) || '—'),
      satir('Doğum tarihi', trTarih(hasta?.dogumTarihi) !== '—' ? `${trTarih(hasta?.dogumTarihi)}${yas !== null ? ` (${yas})` : ''}` : ''),
      satir('Kimlik no', hasta?.kimlikNo),
      satir('Sigorta', SIGORTALAR.find(([v]) => v === hasta?.sigorta)?.[1]),
      satir('Tanı', [recete.tani, recete.taniKodu].filter(Boolean).join(' · '))),

    (hasta?.alerjiler || []).length
      ? el('div', { class: 'yaz__alerji' }, el('b', {}, 'ALERJİ: '), el('span', {}, hasta.alerjiler.join(', ')))
      : null,

    el('table', { class: 'yaz__tablo' },
      el('thead', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, 'İlaç'), el('th', {}, 'Adet'), el('th', {}, 'Kullanım'), el('th', {}, 'Süre'))),
      el('tbody', {}, ...(recete.satirlar || []).map((s, i) => el('tr', {},
        el('td', {}, String(i + 1)),
        el('td', {}, s.ilacAdi + (s.not ? ` (${s.not})` : '')),
        el('td', {}, String(s.adet)),
        el('td', {}, s.kullanim || '—'),
        el('td', {}, s.sure || '—'))))),

    recete.notlar ? el('p', { class: 'yaz__not' }, recete.notlar) : null,
    el('div', { class: 'yaz__imza' }, el('div', { class: 'yaz__imza-kutu' }, 'Kaşe / İmza')));
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
        kok.appendChild(bosDurum({ simge: 'hata', baslik: 'Reçete bulunamadı', alt: 'Kayıt silinmiş olabilir.', eylem: btn('Reçetelere dön', { class: 'btn', onclick: () => git('/receteler') }) }));
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
      kok.append(sayfaBas(recete.receteNo || 'Reçete', {
        alt: [trTarih(recete.tarih), receteTuruAdi(recete.tur), tamAd(hasta)].filter(Boolean).join(' · '),
        geri: () => git('/receteler'),
        eylemler: [
          btnS('yazdir', 'Yazdır', { class: 'btn', onclick: () => window.print() }),
          ozet.durum === 'bekliyor' ? btnS('kalem', 'Düzenle', { class: 'btn', onclick: () => git(`/recete/${recete.id}/duzenle`) }) : null,
          btnS('cop', 'Sil', { class: 'btn', onclick: async () => {
            const verilmis = (recete.satirlar || []).some((s) => Number(s.verilenAdet || 0) > 0);
            const mesaj = verilmis
              ? 'Bu reçetede verilmiş ilaçlar var. Reçete silinirse stok geri alınmaz — önce satırları geri alman gerekebilir. Yine de silinsin mi?'
              : 'Reçete silinsin mi?';
            if (await onayla(mesaj, { tehlikeli: true, evet: 'Sil' })) {
              await depo.sil('receteler', recete.id);
              basari('Reçete silindi');
              git('/receteler');
            }
          } }),
        ],
      }));

      /* --- Hasta ve künye --- */
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, 'Hasta'), rozet(DURUM_ADLARI[ozet.durum] || ozet.durum, DURUM_RENGI[ozet.durum] || 'gri')),
        hasta
          ? el('div', { class: 'liste' },
            el('a', { class: 'liste__satir', href: `#/hasta/${hasta.id}` },
              el('span', { class: 'avatar' }, basHarfler(tamAd(hasta))),
              el('div', { class: 'liste__govde' },
                el('div', { class: 'liste__baslik' }, tamAd(hasta)),
                el('div', { class: 'liste__alt' }, [hastaYasi(hasta) !== null ? `${hastaYasi(hasta)} yaş` : null, hasta.telefon].filter(Boolean).join(' · ') || '—'))))
          : el('p', { class: 'kart__alt' }, 'Hasta kaydı bulunamadı.'),
        ...(hasta?.alerjiler || []).map((a) => el('div', { class: 'uyari uyari--hata', style: { marginBlockStart: 'var(--b-2)' } }, simge('uyari', { boy: 16 }), el('span', {}, `Alerji: ${a}`))),
        el('div', { class: 'izgara', style: { marginBlockStart: 'var(--b-4)' } },
          ...[['Tanı', [recete.tani, recete.taniKodu].filter(Boolean).join(' · ') || '—'],
            ['Protokol no', recete.protokolNo || '—'],
            ['Yazan', [recete.doktorUnvan, recete.doktorAd].filter(Boolean).join(' ') || '—'],
            ['Yazıldığı an', trTarihSaat(recete.olusturuldu)]]
            .map(([b, d]) => el('div', {}, el('div', { class: 'alan__etiket' }, b), el('div', {}, d)))),
        recete.notlar ? el('p', { class: 'kart__alt', style: { marginBlockStart: 'var(--b-3)' } }, recete.notlar) : null));

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
          acik ? btn('Ver', {
            class: 'btn btn--kucuk btn--birincil',
            disabled: !!ilac && stok <= 0,
            title: ilac && stok <= 0 ? 'Stokta yok' : `${kalan} adet ver`,
            onclick: () => calistir(() => satirVer(depo, recete.id, i), `${s.ilacAdi}: ${kalan} adet verildi`),
          }) : null,
          acik && kalan > 1 ? btn('Kısmi', { class: 'btn btn--kucuk', onclick: async () => {
            const n = await kismiKutusu(ctx, s);
            if (n) calistir(() => satirVer(depo, recete.id, i, n), `${s.ilacAdi}: ${n} adet verildi`);
          } }) : null,
          acik ? btn('Verilemedi', { class: 'btn btn--kucuk', onclick: async () => {
            const r = await sebepKutusu(ctx, s);
            if (r) calistir(() => satirVerilmedi(depo, recete.id, i, r.sebep, r.not), `${s.ilacAdi}: ${sebepAdi(r.sebep)}`);
          } }) : null,
          geriAlinabilir ? btnS('yenile', 'Geri al', { class: 'btn btn--kucuk btn--sade', onclick: async () => {
            const geri = Number(s.verilenAdet || 0);
            const mesaj = geri > 0 ? `${s.ilacAdi}: ${geri} adet stoğa iade edilecek. Geri alınsın mı?` : `${s.ilacAdi} yeniden bekleyene alınsın mı?`;
            if (await onayla(mesaj, { evet: 'Geri al' })) calistir(() => satirGeriAl(depo, recete.id, i), `${s.ilacAdi} geri alındı`);
          } }) : null);

        tbody.appendChild(el('tr', {},
          el('td', {},
            el('div', { class: 'liste__baslik' }, s.ilacAdi),
            el('div', { class: 'liste__alt' }, [s.kullanim, s.sure].filter(Boolean).join(' · ') || '—'),
            s.sebep ? el('div', { class: 'liste__alt' }, `Sebep: ${sebepAdi(s.sebep)}${s.not ? ' · ' + s.not : ''}`) : null,
            ...satirUyarilari.map((u) => el('div', { class: 'alan__hata', style: u.tur === 'uyari' ? { color: 'rgb(var(--sari))' } : null }, u.metin))),
          el('td', { class: 'sayi' }, String(s.adet)),
          el('td', { class: 'sayi' }, `${s.verilenAdet || 0}`),
          el('td', {}, ilac ? rozet(`Stok ${stok}`, stokDurumu(ilac) === 'yok' ? 'kirmizi' : stokDurumu(ilac) === 'kritik' ? 'sari' : 'gri') : el('span', { class: 'sessiz' }, 'kayıt yok')),
          el('td', {}, rozet(SATIR_ADI[durum], SATIR_RENGI[durum]), s.verilmeTarihi ? el('div', { class: 'liste__alt' }, trTarihSaat(s.verilmeTarihi)) : null),
          el('td', {}, eylemler)));
      });

      const bekleyenVar = (recete.satirlar || []).some((s) => satirKalan(s) > 0);
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' },
          el('h2', {}, 'Karşılama'),
          bekleyenVar
            ? btnS('onay', 'Bekleyenlerin hepsini ver', { class: 'btn btn--kucuk btn--birincil', onclick: async () => {
              if (!await onayla('Bekleyen bütün satırlar stoktan verilecek. Devam edilsin mi?', { evet: 'Ver' })) return;
              try {
                const r = await hepsiniVer(depo, recete.id);
                if (r.verilen) basari(`${r.verilen} satır verildi`);
                for (const a of r.atlanan) uyar(`${a.ad}: ${a.sebep}`);
                if (!r.verilen && !r.atlanan.length) uyar('Verilecek satır kalmadı');
              } catch (e) { hata(e.message || 'İşlem yapılamadı'); }
              ciz();
            } })
            : rozet('Karşılama tamam', 'yesil')),
        recete.satirlar?.length
          ? el('div', { class: 'tablo-kap' }, el('table', { class: 'tablo' },
            el('thead', {}, el('tr', {},
              el('th', {}, 'İlaç'), el('th', { class: 'sayi' }, 'İstenen'), el('th', { class: 'sayi' }, 'Verilen'),
              el('th', {}, 'Stok'), el('th', {}, 'Durum'), el('th', {}, ''))),
            tbody))
          : bosDurum({ simge: 'ilac', baslik: 'Reçetede ilaç yok' }),
        el('p', { class: 'kart__alt', style: { marginBlockStart: 'var(--b-3)' } },
          `${ozet.verilen}/${ozet.toplam} satır verildi · ${ozet.bekleyen} bekliyor · verilen tutar ${paraMetni(ozet.tutar)}`)));

      kok.appendChild(yazdirmaBolumu(recete, hasta, ayar));
      sirala(tbody);
    }

    /** İşlemi çalıştırır, sonucu bildirir, ekranı tazeler. */
    async function calistir(is, basariMetni) {
      try {
        await is();
        basari(basariMetni);
      } catch (e) {
        hata(e.message || 'İşlem yapılamadı');
      }
      ciz();
    }

    await ciz();
    return depo.dinle('receteler', () => {});
  },
};
