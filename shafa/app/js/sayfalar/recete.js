// Reçete kartı: yazılan reçetenin künyesi, gönderilmesi ve yazdırılması.
// Karşılama yok — hasta ilacını dışarıdaki eczaneden kendi alıyor.
// Sayfanın dibinde basılacak kâğıdın kendisi duruyor (reçete yazma
// sayfasındaki önizleme paneliyle aynı çerçeve): hekim yazdırmadan ya da
// PDF kaydetmeden önce neyin basılacağını, bölünmüşse her yaprağını görüyor.
import { el, temizle, btn, btnS, metinAlani, alan, kart, sayfaBas, bosDurum, sirala } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { RECETE_TURLERI, doluOlcumler, receteUyarilari, receteMetni } from '../paylasilan/recete.js';
import { tamAd, hastaYasi, alerjiCakismasi } from '../paylasilan/hasta.js';
import { basHarfler, telefonNormalize } from '../paylasilan/metin.js';
import { tarihMetni, tarihSaatMetni } from '../paylasilan/tarih.js';
import { satirKagitAdi } from '../paylasilan/ilac.js';
import { t, secenekAdi } from '../i18n.js';
import { kagitCiz, kagidiYazdir, kagidiOlcekle } from '../kagit.js';
import { onizlemePaneli, pdfKaydet, yaprakRozeti } from '../onizleme-arayuz.js';
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

export default {
  baslik: 'Reçete',
  async cizim(kok, ctx) {
    const { depo, git, basari, onayla } = ctx;
    let sira = 0;
    let olcekBirak = null;

    async function ciz() {
      const benim = ++sira;
      const recete = await depo.al('receteler', ctx.param.id);
      // Veri beklenirken başka bir sayfaya geçildiyse (yönlendiricinin
      // sırası) eski çizim yeni sayfanın üstüne yazmasın.
      if (benim !== sira || !ctx.guncel()) return;
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
      if (benim !== sira || !ctx.guncel()) return;

      const uyarilar = receteUyarilari(recete.satirlar, hasta, ilaclar, { alerjiBul: alerjiCakismasi });

      temizle(kok);
      // Yazdır ve PDF başlıkta değil, önizleme panelinin başında (aşağıda):
      // aynı iki eylem iki kez duruyordu, klavye iki çiftten geçiyordu.
      kok.append(sayfaBas(recete.receteNo || t('nav.recete', 'Reçete'), {
        alt: [tarihMetni(recete.tarih), secenekAdi(RECETE_TURLERI, recete.tur, 'recete.tur'), tamAd(hasta)].filter(Boolean).join(' · '),
        geri: () => git('/receteler'),
        eylemler: [
          btnS('telefon', t('paylas.gonder', 'Gönder'), { class: 'btn btn--birincil', onclick: () => paylasKutusu(ctx, recete, hasta, ayar) }),
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
            // Kâğıdın sol sütunundakiler burada da: kayıt sayfası basılandan azını göstermesin.
            [t('kagit.belirtiler', 'Belirtiler'), recete.belirtiler || '—'],
            [t('kagit.laboratuvar', 'Laboratuvar'), recete.laboratuvar || '—'],
            [t('recete.protokol', 'Protokol no'), recete.protokolNo || '—'],
            [t('recete.yazan', 'Yazan'), [recete.doktorUnvan, recete.doktorAd].filter(Boolean).join(' ') || '—'],
            [t('recete.yazildigi_an', 'Yazıldığı an'), tarihSaatMetni(recete.olusturuldu)]]
            .map(([b, d]) => el('div', {}, el('div', { class: 'alan__etiket' }, b), el('div', {}, d)))),
        recete.notlar ? el('p', { class: 'kart__alt', style: { marginBlockStart: 'var(--b-3)' } }, recete.notlar) : null));

      /* --- Klinik ölçümler ve kan grubu (girilmişse) ---
         Birimin yalnız ilk parçası: BP'ninki formdaki iki kutuyu anlatıyor
         («mmHg / mmHg»), kâğıtta da «130/85 mmHg» basılıyor. Değer ile birim
         soldan sağa yalıtılmış: sağdan sola satırda «kg 74» diye diziliyordu. */
      const olcumler = doluOlcumler(recete).map(([anahtar, ad, kisa, birim]) =>
        [`${t('olcum.' + anahtar, ad)} (${kisa})`, `${recete.olcumler[anahtar]} ${birim.split(' / ')[0]}`]);
      if (String(recete.kanGrubu ?? '').trim()) olcumler.push([t('hasta.kan_grubu', 'Kan grubu'), recete.kanGrubu]);
      if (olcumler.length) {
        kok.appendChild(kart({},
          el('div', { class: 'kart__bas' }, el('h2', {}, t('recete.olcumler', 'Klinik ölçümler'))),
          el('div', { class: 'izgara' }, ...olcumler.map(([etiket, deger]) =>
            el('div', {},
              el('div', { class: 'alan__etiket' }, etiket),
              el('div', {}, el('bdi', { dir: 'ltr' }, deger)))))));
      }

      /* --- Reçetedeki ilaçlar --- */
      const tbody = el('tbody', {});
      (recete.satirlar || []).forEach((s, i) => {
        const satirUyarilari = uyarilar.filter((u) => u.satir === i);
        tbody.appendChild(el('tr', {},
          el('td', { class: 'sayi' }, String(i + 1)),
          el('td', {},
            // Ad kâğıttaki gibi: etken madde ve güçle («Cap: Feldene (Piroxicam) 20 mg»).
            el('div', { class: 'liste__baslik' }, el('bdi', {}, satirKagitAdi(s))),
            // Kâğıttaki ikinci satırın sırası: kullanım, yemek zamanı, süre, yol.
            // Zaman kâğıda basılıp burada görünmezse hekim kaydında basılandan azını okur.
            el('div', { class: 'liste__alt' }, [s.kullanim, s.zaman, s.sure, s.yol].filter(Boolean).join(' \u00b7 ') || '\u2014'),
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

      /* --- Basılacak kâğıt: ekranda ölçekli kopya; her yaprak alt alta ---
         Yazdırılan kopya sayfanın doğrudan çocuğu (gizli; Ctrl+P ve
         kagidiYazdir onu basıyor), buradaki yalnız bakmak için. */
      const kagit = kagitCiz({ recete, hasta, ayar });
      const tuval = el('div', { class: 'kagit-tuval' }, kagit);
      const panel = onizlemePaneli({
        baslik: t('recete.onizleme_bas', 'Reçete önizlemesi'), id: 'recete-kayit-onizleme', sinif: 'recete-kayit__onizleme', tuval,
        eylemler: [
          { simge: 'yazdir', metin: t('genel.yazdir', 'Yazdır'), odakAdi: 'kayit-yazdir', onclick: () => kagidiYazdir({ recete, hasta, ayar }) },
          { simge: 'pdf', metin: t('recete.pdf_kaydet', 'PDF kaydet'), odakAdi: 'kayit-pdf', onclick: () => pdfKaydet({ recete, hasta, ayar }) },
        ],
      });
      kok.append(panel, kagitCiz({ recete, hasta, ayar }));
      yaprakRozeti(panel, kagit);
      olcekBirak?.();
      olcekBirak = kagidiOlcekle(tuval, kagit, kok);
      sirala(tbody);
    }

    await ciz();
    // Sayfadan çıkınca önizlemenin boyut gözcüsü bırakılsın.
    return () => olcekBirak?.();
  },
};
