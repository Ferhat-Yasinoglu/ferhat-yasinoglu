// Reçete yazma. Hasta seç → ilaç satırlarını ekle → kaydet.
// Uyarılar (alerji, çift etken madde) satır eklenir eklenmez
// çıkar; hiçbiri kaydetmeyi engellemez, karar hekimindir — ama görmeden geçilmez.
import { el, temizle, btn, btnS, girdi, secim, metinAlani, alan, kart, rozet, sayfaBas, bosDurum, sirala } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { RECETE_TURLERI, KULLANIM_ONERILERI, SURE_ONERILERI, OLCUMLER, bosRecete, bosSatir, receteDogrula, receteUyarilari, sikIlaclar } from '../paylasilan/recete.js';
import { receteKaydet } from '../depo/recete.js';
import { sablonuUygula } from '../paylasilan/sablon.js';
import { sablonSecKutusu, sablonKaydetKutusu } from '../sablon-arayuz.js';
import { ilacAra, ilacEtiketi } from '../paylasilan/ilac.js';
import { gecmisTanilar } from '../paylasilan/tani.js';
import { tanilariOku } from '../depo/tanilar.js';
import { taniSecicisi, cip } from '../tani-arayuz.js';
import { tamAd, hastaAra, hastaYasi, alerjiCakismasi } from '../paylasilan/hasta.js';
import { basHarfler } from '../paylasilan/metin.js';
import { bugun } from '../paylasilan/tarih.js';
import { t, secenekleriCevir } from '../i18n.js';
import { dogrulaMetni, hataMetni, uyariMetni } from '../hatalar.js';

/** Hasta seçme kutusu: arar, yoksa yeni hasta eklemeye gönderir. */
async function hastaSec(ctx, hastalar) {
  const { modal } = ctx;
  const kutu = girdi({ type: 'search', name: 'hastaArama', placeholder: t('hasta.ara_kisa', 'Ad, soyad, telefon…') });
  const liste = el('div', { class: 'liste', style: { marginBlockStart: 'var(--b-3)', maxBlockSize: '340px', overflowY: 'auto' } });
  let secilen = null;

  function ciz() {

    // Sayfadan ayrıldıysak çizme: bu işlev modal kapandıktan sonra da

    // çağrılıyor ve o sırada başka bir sayfa açılmış olabilir. Koruma

    // olmadan eski form yeni sayfanın üstüne yazılıyordu.

    if (benimSira !== cizimSirasi) return;
    temizle(liste);
    const bulunan = hastaAra(hastalar, kutu.value).slice(0, 20);
    if (!bulunan.length) {
      liste.appendChild(el('div', { class: 'liste__satir sessiz' }, hastalar.length ? t('hasta.eslesme_yok', 'Eşleşen hasta yok') : t('hasta.kayit_yok', 'Kayıtlı hasta yok.')));
      return;
    }
    for (const h of bulunan) {
      const yas = hastaYasi(h);
      liste.appendChild(el('button', {
        class: 'liste__satir liste__satir--tiklanir',
        type: 'button',
        style: { border: 'none', background: 'none', textAlign: 'start', font: 'inherit', cursor: 'pointer', inlineSize: '100%' },
        onclick: () => { secilen = h; document.querySelector('.ortu .btn--birincil')?.click(); },
      },
        el('span', { class: 'avatar' }, basHarfler(tamAd(h))),
        el('div', { class: 'liste__govde' },
          el('div', { class: 'liste__baslik' }, tamAd(h)),
          el('div', { class: 'liste__alt' }, [yas !== null ? t('hasta.yas', '{n} yaş', { n: yas }) : null, h.telefon].filter(Boolean).join(' · ') || '—')),
        (h.alerjiler || []).length ? el('div', { class: 'liste__son' }, rozet(t('hasta.alerji_sayisi', '{n} alerji', { n: h.alerjiler.length }), 'kirmizi')) : null));
    }
    sirala(liste);
  }
  kutu.oninput = ciz;
  ciz();

  const sonuc = await modal({
    baslik: t('recete.hasta_sec', 'Hasta seç'),
    govde: el('div', {}, kutu, liste),
    dugmeler: [{ metin: t('genel.vazgec', 'Vazgeç'), deger: null }, { metin: t('genel.sec', 'Seç'), sinif: 'btn--birincil', cb: () => secilen || false }],
  });
  return sonuc && typeof sonuc === 'object' ? sonuc : null;
}

/** İlaç satırı kutusu: ilaç ara/seç, adet, kullanım, süre. */
async function satirKutusu(ctx, ilaclar, hasta, mevcut = null, sik = []) {
  const { modal } = ctx;
  let ilac = mevcut?.ilacId ? ilaclar.find((x) => x.id === mevcut.ilacId) : null;

  const kutu = girdi({ type: 'search', name: 'ilacArama', placeholder: t('recete.ilac_ara', 'İlaç adı, barkod, etken madde…'), value: ilac ? ilacEtiketi(ilac) : '' });
  const sonuclar = el('div', { class: 'liste', style: { maxBlockSize: '220px', overflowY: 'auto' } });
  const secilenKutusu = el('div', {});
  const adet = girdi({ type: 'number', name: 'adet', min: 1, step: 1, value: mevcut?.adet ?? 1 });
  const kullanim = girdi({ name: 'kullanim', value: mevcut?.kullanim ?? '', list: 'kullanim-onerileri', placeholder: t('recete.kullanim_yer', 'Günde 2×1') });
  const sure = girdi({ name: 'sure', value: mevcut?.sure ?? '', placeholder: t('recete.sure_yer', '10 gün') });
  const not = girdi({ name: 'satirNotu', value: mevcut?.not ?? '', placeholder: t('recete.not_yer', 'Tok karnına…') });
  const oneriler = el('datalist', { id: 'kullanim-onerileri' }, ...KULLANIM_ONERILERI.map((k, i) => el('option', { value: t(`kullanim.${i}`, k) })));

  function secileniCiz() {
    temizle(secilenKutusu);
    if (!ilac) return;
    const uyarilar = [];
    const a = hasta ? alerjiCakismasi(hasta, ilac) : null;
    if (a) uyarilar.push({ tur: 'hata', metin: uyariMetni({ kod: 'alerji', veri: { a } }) });
    secilenKutusu.append(
      el('div', { class: 'liste' },
        el('div', { class: 'liste__satir' },
          el('span', { class: 'avatar' }, simge('ilac', { boy: 18 })),
          el('div', { class: 'liste__govde' },
            el('div', { class: 'liste__baslik' }, ilacEtiketi(ilac)),
            el('div', { class: 'liste__alt' }, ilac.etkenMadde || '—')))),
      ...uyarilar.map((u) => el('div', { class: `uyari uyari--${u.tur}`, style: { marginBlockStart: 'var(--b-2)' } }, simge(u.tur === 'hata' ? 'hata' : 'uyari', { boy: 16 }), el('span', {}, u.metin))));
  }

  const ilacSatiri = (i) => el('button', {
    class: 'liste__satir liste__satir--tiklanir', type: 'button',
    style: { border: 'none', background: 'none', textAlign: 'start', font: 'inherit', cursor: 'pointer', inlineSize: '100%' },
    onclick: () => { ilac = i; kutu.value = ilacEtiketi(i); aramaCiz(); secileniCiz(); },
  },
    el('div', { class: 'liste__govde' },
      el('div', { class: 'liste__baslik' }, ilacEtiketi(i)),
      el('div', { class: 'liste__alt' }, i.etkenMadde || '—')));

  function aramaCiz() {
    temizle(sonuclar);
    const q = kutu.value.trim();
    // Kutu boşken de liste gösteriyoruz: hekim yazmadan gezinebilsin.
    // Önce kendi çok yazdıkları, sonra alfabetik baş taraf.
    if (!q || (ilac && q === ilacEtiketi(ilac))) {
      const gecmisId = new Set(sik.map((x) => x.id));
      const kalan = ilaclar.filter((x) => !gecmisId.has(x.id)).slice(0, 10);
      if (sik.length) {
        sonuclar.appendChild(el('div', { class: 'liste__ayrac' }, t('recete.ilac_sik', 'Senin sık yazdıkların')));
        for (const i of sik) sonuclar.appendChild(ilacSatiri(i));
      }
      if (kalan.length) {
        sonuclar.appendChild(el('div', { class: 'liste__ayrac' }, sik.length ? t('recete.ilac_digerleri', 'Diğerleri') : t('recete.ilac_tumu', 'Kayıtlı ilaçlar')));
        for (const i of kalan) sonuclar.appendChild(ilacSatiri(i));
      }
      if (!sik.length && !kalan.length) sonuclar.appendChild(el('div', { class: 'liste__satir sessiz' }, t('ilac.kayit_yok', 'Kayıtlı ilaç yok.')));
      return;
    }
    const bulunan = ilacAra(ilaclar, q).slice(0, 12);
    if (!bulunan.length) { sonuclar.appendChild(el('div', { class: 'liste__satir sessiz' }, t('ilac.eslesme_yok', 'Eşleşen ilaç yok'))); return; }
    for (const i of bulunan) sonuclar.appendChild(ilacSatiri(i));
  }

  /** Bir girdiyi çiplerle doldurur. İkinci dokunuş seçimi geri alır — yanlış
   *  basan hekim klavyeye gitmek zorunda kalmasın. */
  function oneriCipleri(hedef, secenekler) {
    const kap = el('div', { class: 'cip-kume' });
    function ciz() {
      temizle(kap);
      for (const metin of secenekler) {
        kap.appendChild(cip(metin, {
          secili: hedef.value.trim() === metin,
          onclick: () => { hedef.value = hedef.value.trim() === metin ? '' : metin; ciz(); },
        }));
      }
    }
    hedef.addEventListener('input', ciz);
    ciz();
    return kap;
  }
  kutu.oninput = aramaCiz;
  // Açılışta da çiziyoruz: liste yalnız yazınca doluyordu, yani hekim
  // gezinmek için önce klavyeye gitmek zorundaydı.
  aramaCiz();
  secileniCiz();

  const sonuc = await modal({
    baslik: mevcut ? t('recete.satir_duzenle', 'Satırı düzenle') : t('recete.ilac_ekle', 'İlaç ekle'),
    genis: true,
    govde: el('div', {}, oneriler,
      alan(t('nav.ilac', 'İlaç'), kutu, { gerekli: true, ipucu: t('recete.ilac_ipucu', 'Stoktan seç; listede yoksa önce İlaçlar\'a ekle.') }),
      sonuclar, secilenKutusu,
      el('div', { class: 'izgara izgara--form', style: { marginBlockStart: 'var(--b-3)' } },
        alan(t('recete.adet', 'Adet (kutu)'), adet, { gerekli: true })),
      alan(t('recete.kullanim', 'Kullanım'), kullanim),
      oneriCipleri(kullanim, KULLANIM_ONERILERI.map((k, i) => t(`kullanim.${i}`, k))),
      alan(t('recete.sure', 'Süre'), sure),
      oneriCipleri(sure, SURE_ONERILERI.map((k, i) => t(`sure.${i}`, k))),
      alan(t('genel.not', 'Not'), not)),
    dugmeler: [
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: mevcut ? t('genel.kaydet', 'Kaydet') : t('genel.ekle', 'Ekle'), sinif: 'btn--birincil', cb: () => {
        const n = Math.floor(Number(adet.value));
        if (!ilac) { kutu.classList.add('input--hata'); kutu.focus(); return false; }
        if (!(n > 0)) { adet.classList.add('input--hata'); adet.focus(); return false; }
        return {
          ...bosSatir(), ...(mevcut || {}),
          ilacId: ilac.id, ilacAdi: ilacEtiketi(ilac), etkenMadde: ilac.etkenMadde || '',
          adet: n, kullanim: kullanim.value.trim(), sure: sure.value.trim(), not: not.value.trim(),
        };
      } },
    ],
  });
  return sonuc && typeof sonuc === 'object' ? sonuc : null;
}

// Gezinme sırası. Sayfa ilk çizimden önce veriyi bekliyor; o sırada başka
// bir sayfaya geçilirse eski çizim geri dönüp yeni sayfanın üstüne yazıyordu
// (düzenlemeden "yeni reçete"ye geçince eski hasta ekranda kalıyordu).
// Her çizim sırasını alır, beklerken yenisi başladıysa sessizce çekilir.
let cizimSirasi = 0;

export default {
  baslik: 'Reçete yaz',
  async cizim(kok, ctx) {
    const benimSira = ++cizimSirasi;
    const { depo, git, basari, hata, onayla } = ctx;
    // Tanı listesi okunamazsa form yine çalışsın: çipler görünmez, alan
    // elle yazılabilir kalır. Reçete yazmayı bir veri dosyası engellememeli.
    const [ilaclar, hastalar, ayar, ilkSablonlar, gecmisReceteler, taniBelgesi] = await Promise.all([
      depo.listele('ilaclar', { sirala: 'ad' }),
      depo.listele('hastalar', { sirala: 'soyad' }),
      depo.ayarlar(),
      depo.listele('sablonlar', { sirala: 'ad' }),
      depo.listele('receteler'),
      tanilariOku().catch(() => null),
    ]);
    if (benimSira !== cizimSirasi) return;
    const sikYazilanlar = sikIlaclar(gecmisReceteler, ilaclar);
    const kendiTanilari = gecmisTanilar(gecmisReceteler);
    // Şablon listesi yeni bir şablon kaydedilince tazelenir.
    let sablonlar = ilkSablonlar;

    const duzenleme = ctx.param.id ? await depo.al('receteler', ctx.param.id) : null;
    if (benimSira !== cizimSirasi) return;
    let recete = duzenleme ? { ...duzenleme } : bosRecete(ayar, bugun());
    let hasta = recete.hastaId ? hastalar.find((h) => h.id === recete.hastaId) : null;
    if (!duzenleme && ctx.sorgu?.hasta) {
      hasta = hastalar.find((h) => h.id === ctx.sorgu.hasta) || null;
      if (hasta) recete.hastaId = hasta.id;
    }
    let hatalar = {};

    function ciz() {
      temizle(kok);
      kok.append(sayfaBas(duzenleme ? `${t('recete.duzenle', 'Reçeteyi düzenle')} · ${duzenleme.receteNo || ''}` : t('recete.yeni', 'Yeni reçete'), {
        alt: t('recete.yeni_alt', 'Hasta seç, ilaçları ekle. Karşılama sonraki adımda.'),
        geri: () => git(duzenleme ? `/recete/${duzenleme.id}` : '/receteler'),
      }));

      /* --- Hasta --- */
      const hastaGovdesi = hasta
        ? el('div', {},
          el('div', { class: 'liste' },
            el('div', { class: 'liste__satir' },
              el('span', { class: 'avatar' }, basHarfler(tamAd(hasta))),
              el('div', { class: 'liste__govde' },
                el('div', { class: 'liste__baslik' }, tamAd(hasta)),
                el('div', { class: 'liste__alt' }, [hastaYasi(hasta) !== null ? t('hasta.yas', '{n} yaş', { n: hastaYasi(hasta) }) : null, hasta.telefon].filter(Boolean).join(' · ') || '—')),
              el('div', { class: 'liste__son' }, btn(t('genel.degistir', 'Değiştir'), { class: 'btn btn--kucuk', onclick: hastaDegistir })))),
          ...(hasta.alerjiler || []).map((a) => el('div', { class: 'uyari uyari--hata', style: { marginBlockStart: 'var(--b-2)' } }, simge('uyari', { boy: 16 }), el('span', {}, t('hasta.alerji_satiri', 'Alerji: {a}', { a })))),
          (hasta.kronikHastaliklar || []).length
            ? el('p', { class: 'kart__alt', style: { marginBlockStart: 'var(--b-2)' } }, t('hasta.kronik_kisa', 'Kronik') + ': ' + hasta.kronikHastaliklar.join(', '))
            : null)
        : el('div', {},
          btnS('hasta', t('recete.hasta_sec', 'Hasta seç'), { class: 'btn btn--birincil', onclick: hastaDegistir }),
          hatalar.hastaId ? el('span', { class: 'alan__hata', style: { marginInlineStart: 'var(--b-3)' } }, dogrulaMetni(hatalar.hastaId)) : null);
      kok.appendChild(kart({}, el('div', { class: 'kart__bas' }, el('h2', {}, t('nav.hasta', 'Hasta'))), hastaGovdesi));

      /* --- Reçete bilgileri --- */
      const g = {
        tarih: girdi({ type: 'date', name: 'tarih', value: String(recete.tarih || '').slice(0, 10), onchange: (e) => { recete.tarih = e.target.value; } }),
        tur: secim(secenekleriCevir(RECETE_TURLERI, 'recete.tur'), { name: 'tur', value: recete.tur, onchange: (e) => { recete.tur = e.target.value; } }),
        receteNo: girdi({ name: 'receteNo', value: recete.receteNo, placeholder: t('recete.no_yer', 'Kaydedince kendiliğinden verilir'), onchange: (e) => { recete.receteNo = e.target.value.trim(); } }),
        tani: girdi({ name: 'tani', value: recete.tani, onchange: (e) => { recete.tani = e.target.value.trim(); } }),
        taniKodu: girdi({ name: 'taniKodu', value: recete.taniKodu, placeholder: 'J06.9', onchange: (e) => { recete.taniKodu = e.target.value.trim(); } }),
        protokolNo: girdi({ name: 'protokolNo', value: recete.protokolNo, onchange: (e) => { recete.protokolNo = e.target.value.trim(); } }),
      };
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, t('recete.bilgiler', 'Reçete bilgileri'))),
        el('div', { class: 'izgara izgara--form' },
          alan(t('genel.tarih', 'Tarih'), g.tarih, { gerekli: true, hata: dogrulaMetni(hatalar.tarih) }),
          alan(t('recete.turu', 'Reçete türü'), g.tur),
          alan(t('recete.no', 'Reçete no'), g.receteNo),
          alan(t('recete.protokol', 'Protokol no'), g.protokolNo)),
        el('div', { style: { marginBlockStart: 'var(--b-3)' } },
          el('div', { class: 'izgara izgara--form' },
            alan(t('recete.tani', 'Tanı'), g.tani, { ipucu: t('recete.tani_ipucu', 'Aşağıdan seç ya da elle yaz.') }),
            alan(t('recete.tani_kodu', 'Tanı kodu (ICD-10)'), g.taniKodu)),
          taniBelgesi
            ? taniSecicisi(ctx, { belge: taniBelgesi, gecmis: kendiTanilari, recete, adGirdisi: g.tani, kodGirdisi: g.taniKodu })
            : null)));

      /* --- Klinik ölçümler --- */
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, t('recete.olcumler', 'Klinik ölçümler')), el('span', { class: 'kart__alt' }, t('genel.zorunlu_degil', 'Zorunlu değil'))),
        el('div', { class: 'izgara izgara--dar' }, ...OLCUMLER.map(([anahtar, ad, kisa, birim]) =>
          alan(`${t('olcum.' + anahtar, ad)} (${kisa})`, girdi({
            name: 'olcum_' + anahtar, value: recete.olcumler?.[anahtar] ?? '', placeholder: birim,
            onchange: (e) => { recete.olcumler = { ...recete.olcumler, [anahtar]: e.target.value.trim() }; },
          }))))));

      /* --- İlaç satırları --- */
      const uyarilar = receteUyarilari(recete.satirlar, hasta, ilaclar, {
        alerjiBul: alerjiCakismasi,
      });
      const satirGovdesi = recete.satirlar.length
        ? el('div', { class: 'tablo-kap' }, el('table', { class: 'tablo' },
          el('thead', {}, el('tr', {}, el('th', {}, t('nav.ilac', 'İlaç')), el('th', { class: 'sayi' }, t('genel.adet', 'Adet')), el('th', {}, t('recete.kullanim', 'Kullanım')), el('th', {}, t('recete.sure', 'Süre')), el('th', {}, ''))),
          el('tbody', {}, ...recete.satirlar.map((s, i) => {
            const satirUyarilari = uyarilar.filter((u) => u.satir === i);
            return el('tr', {},
              el('td', {},
                el('div', { class: 'liste__baslik' }, s.ilacAdi),
                ...satirUyarilari.map((u) => el('div', { class: 'alan__hata', style: u.tur === 'uyari' ? { color: 'rgb(var(--sari))' } : null }, uyariMetni(u))),
                s.not ? el('div', { class: 'liste__alt' }, s.not) : null),
              el('td', { class: 'sayi' }, String(s.adet)),
              el('td', {}, s.kullanim || '—'),
              el('td', {}, s.sure || '—'),
              el('td', { class: 'sayi' },
                el('div', { class: 'satir', style: { justifyContent: 'flex-end', flexWrap: 'nowrap' } },
                  btn(simge('kalem', { boy: 15 }), { class: 'btn btn--kucuk btn--ikon btn--sade', 'aria-label': t('recete.satir_duzenle_etiket', '{ad} satırını düzenle', { ad: s.ilacAdi }), onclick: async () => {
                    const y = await satirKutusu(ctx, ilaclar, hasta, s, sikYazilanlar);
                    if (y) { recete.satirlar = recete.satirlar.map((x, j) => (j === i ? y : x)); ciz(); }
                  } }),
                  btn(simge('cop', { boy: 15 }), { class: 'btn btn--kucuk btn--ikon btn--sade', 'aria-label': t('recete.satir_sil_etiket', '{ad} satırını sil', { ad: s.ilacAdi }), onclick: () => {
                    recete.satirlar = recete.satirlar.filter((_, j) => j !== i); ciz();
                  } }))));
          }))))
        : bosDurum({ simge: 'ilac', baslik: t('recete.ilac_bos', 'Henüz ilaç eklenmedi'), alt: t('recete.ilac_bos_alt', 'Reçeteye en az bir ilaç ekle.') });

      const genelUyarilar = uyarilar.filter((u) => u.satir === -1);
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' },
          el('h2', {}, t('nav.ilaclar', 'İlaçlar')),
          el('div', { class: 'satir', style: { gap: 'var(--b-2)' } },
            sablonlar.length
              ? btnS('recete', t('sablon.doldur', 'Şablondan doldur'), { class: 'btn btn--kucuk', onclick: async () => {
                const s = await sablonSecKutusu(ctx, sablonlar);
                if (!s) return;
                Object.assign(recete, sablonuUygula(recete, s));
                basari(t('sablon.uygulandi', '"{ad}" uygulandı', { ad: s.ad }));
                ciz();
              } })
              : null,
            btnS('arti', t('recete.ilac_ekle', 'İlaç ekle'), { class: 'btn btn--kucuk btn--birincil', onclick: async () => {
              const y = await satirKutusu(ctx, ilaclar, hasta, null, sikYazilanlar);
              if (y) { recete.satirlar = [...recete.satirlar, y]; ciz(); }
            } }))),
        hatalar.satirlar ? el('div', { class: 'alan__hata', style: { marginBlockEnd: 'var(--b-2)' } }, dogrulaMetni(hatalar.satirlar)) : null,
        satirGovdesi,
        ...genelUyarilar.map((u) => el('div', { class: `uyari uyari--${u.tur}`, style: { marginBlockStart: 'var(--b-2)' } }, simge('uyari', { boy: 16 }), el('span', {}, uyariMetni(u))))));

      /* --- Not ve kaydet --- */
      kok.appendChild(kart({},
        alan(t('recete.not', 'Reçete notu'), metinAlani({ name: 'notlar', value: recete.notlar, rows: 2, onchange: (e) => { recete.notlar = e.target.value.trim(); } })),
        el('div', { class: 'satir' },
          btnS('kaydet', duzenleme ? t('recete.kaydet_degisiklik', 'Değişiklikleri kaydet') : t('recete.kaydet', 'Reçeteyi kaydet'), { class: 'btn btn--birincil', onclick: () => kaydet() }),
          recete.satirlar.length
            ? btnS('kaydet', t('sablon.kaydet', 'Şablon olarak kaydet'), { class: 'btn', onclick: async () => {
              if (await sablonKaydetKutusu(ctx, recete)) { sablonlar = await depo.listele('sablonlar', { sirala: 'ad' }); ciz(); }
            } })
            : null,
          btn(t('genel.vazgec', 'Vazgeç'), { class: 'btn btn--sade', onclick: async () => {
            if (!recete.satirlar.length || await onayla(t('recete.kapat_onay', 'Bu reçete kaydedilmeden kapatılsın mı?'), { evet: t('genel.kapat', 'Kapat') })) {
              git(duzenleme ? `/recete/${duzenleme.id}` : '/receteler');
            }
          } }))));
    }

    async function hastaDegistir() {
      if (!hastalar.length) {
        hata(t('recete.hasta_gerekli', 'Önce bir hasta kaydetmelisin.'));
        git('/hastalar');
        return;
      }
      const h = await hastaSec(ctx, hastalar);
      if (h) { hasta = h; recete.hastaId = h.id; hatalar = { ...hatalar, hastaId: '' }; ciz(); }
    }

    async function kaydet() {
      hatalar = receteDogrula(recete);
      if (Object.keys(hatalar).length) { ciz(); hata(dogrulaMetni(Object.values(hatalar)[0])); return; }
      try {
        const y = await receteKaydet(depo, recete);
        basari(duzenleme ? t('recete.guncellendi', 'Reçete güncellendi') : t('recete.kaydedildi', 'Reçete kaydedildi: {no}', { no: y.receteNo }));
        git(`/recete/${y.id}`);
      } catch (e) { hata(hataMetni(e, t('genel.kaydedilemedi', 'Kaydedilemedi'))); }
    }

    ciz();
  },
};
