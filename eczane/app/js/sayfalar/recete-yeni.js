// Reçete yazma. Hasta seç → ilaç satırlarını ekle → kaydet.
// Uyarılar (alerji, stok, son kullanma, çift etken madde) satır eklenir eklenmez
// çıkar; hiçbiri kaydetmeyi engellemez, karar hekimindir — ama görmeden geçilmez.
import { el, temizle, btn, btnS, girdi, secim, metinAlani, alan, kart, rozet, sayfaBas, bosDurum, sirala } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { RECETE_TURLERI, KULLANIM_ONERILERI, bosRecete, bosSatir, receteDogrula, receteUyarilari } from '../paylasilan/recete.js';
import { receteKaydet } from '../depo/recete.js';
import { ilacAra, ilacEtiketi, ilacUyarilari, stokDurumu } from '../paylasilan/ilac.js';
import { tamAd, hastaAra, hastaYasi, alerjiCakismasi } from '../paylasilan/hasta.js';
import { basHarfler, paraMetni } from '../paylasilan/metin.js';
import { bugun } from '../paylasilan/tarih.js';

/** Hasta seçme kutusu: arar, yoksa yeni hasta eklemeye gönderir. */
async function hastaSec(ctx, hastalar) {
  const { modal } = ctx;
  const kutu = girdi({ type: 'search', name: 'hastaArama', placeholder: 'Ad, soyad, telefon…' });
  const liste = el('div', { class: 'liste', style: { marginBlockStart: 'var(--b-3)', maxBlockSize: '340px', overflowY: 'auto' } });
  let secilen = null;

  function ciz() {
    temizle(liste);
    const bulunan = hastaAra(hastalar, kutu.value).slice(0, 20);
    if (!bulunan.length) {
      liste.appendChild(el('div', { class: 'liste__satir sessiz' }, hastalar.length ? 'Eşleşen hasta yok.' : 'Kayıtlı hasta yok.'));
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
          el('div', { class: 'liste__alt' }, [yas !== null ? `${yas} yaş` : null, h.telefon].filter(Boolean).join(' · ') || '—')),
        (h.alerjiler || []).length ? el('div', { class: 'liste__son' }, rozet(`${h.alerjiler.length} alerji`, 'kirmizi')) : null));
    }
    sirala(liste);
  }
  kutu.oninput = ciz;
  ciz();

  const sonuc = await modal({
    baslik: 'Hasta seç',
    govde: el('div', {}, kutu, liste),
    dugmeler: [{ metin: 'Vazgeç', deger: null }, { metin: 'Seç', sinif: 'btn--birincil', cb: () => secilen || false }],
  });
  return sonuc && typeof sonuc === 'object' ? sonuc : null;
}

/** İlaç satırı kutusu: ilaç ara/seç, adet, kullanım, süre. */
async function satirKutusu(ctx, ilaclar, hasta, mevcut = null) {
  const { modal } = ctx;
  let ilac = mevcut?.ilacId ? ilaclar.find((x) => x.id === mevcut.ilacId) : null;

  const kutu = girdi({ type: 'search', name: 'ilacArama', placeholder: 'İlaç adı, barkod, etken madde…', value: ilac ? ilacEtiketi(ilac) : '' });
  const sonuclar = el('div', { class: 'liste', style: { maxBlockSize: '220px', overflowY: 'auto' } });
  const secilenKutusu = el('div', {});
  const adet = girdi({ type: 'number', name: 'adet', min: 1, step: 1, value: mevcut?.adet ?? 1 });
  const kullanim = girdi({ name: 'kullanim', value: mevcut?.kullanim ?? '', list: 'kullanim-onerileri', placeholder: 'Günde 2×1' });
  const sure = girdi({ name: 'sure', value: mevcut?.sure ?? '', placeholder: '10 gün' });
  const not = girdi({ name: 'satirNotu', value: mevcut?.not ?? '', placeholder: 'Tok karnına…' });
  const oneriler = el('datalist', { id: 'kullanim-onerileri' }, ...KULLANIM_ONERILERI.map((k) => el('option', { value: k })));

  function secileniCiz() {
    temizle(secilenKutusu);
    if (!ilac) return;
    const uyarilar = [...ilacUyarilari(ilac)];
    const a = hasta ? alerjiCakismasi(hasta, ilac) : null;
    if (a) uyarilar.unshift({ tur: 'hata', metin: `Hastanın "${a}" alerjisi var` });
    secilenKutusu.append(
      el('div', { class: 'liste' },
        el('div', { class: 'liste__satir' },
          el('span', { class: 'avatar' }, simge('ilac', { boy: 18 })),
          el('div', { class: 'liste__govde' },
            el('div', { class: 'liste__baslik' }, ilacEtiketi(ilac)),
            el('div', { class: 'liste__alt' }, [ilac.etkenMadde, `Stok ${ilac.stok ?? 0}`, paraMetni(ilac.satisFiyati)].filter(Boolean).join(' · '))))),
      ...uyarilar.map((u) => el('div', { class: `uyari uyari--${u.tur}`, style: { marginBlockStart: 'var(--b-2)' } }, simge(u.tur === 'hata' ? 'hata' : 'uyari', { boy: 16 }), el('span', {}, u.metin))));
  }

  function aramaCiz() {
    temizle(sonuclar);
    const q = kutu.value.trim();
    if (!q || (ilac && q === ilacEtiketi(ilac))) return;
    const bulunan = ilacAra(ilaclar, q).slice(0, 8);
    if (!bulunan.length) { sonuclar.appendChild(el('div', { class: 'liste__satir sessiz' }, 'Eşleşen ilaç yok.')); return; }
    for (const i of bulunan) {
      const durum = stokDurumu(i);
      sonuclar.appendChild(el('button', {
        class: 'liste__satir liste__satir--tiklanir', type: 'button',
        style: { border: 'none', background: 'none', textAlign: 'start', font: 'inherit', cursor: 'pointer', inlineSize: '100%' },
        onclick: () => { ilac = i; kutu.value = ilacEtiketi(i); temizle(sonuclar); secileniCiz(); adet.focus(); },
      },
        el('div', { class: 'liste__govde' },
          el('div', { class: 'liste__baslik' }, ilacEtiketi(i)),
          el('div', { class: 'liste__alt' }, i.etkenMadde || '—')),
        el('div', { class: 'liste__son' },
          rozet(`Stok ${i.stok ?? 0}`, durum === 'yok' ? 'kirmizi' : durum === 'kritik' ? 'sari' : 'gri'))));
    }
  }
  kutu.oninput = aramaCiz;
  secileniCiz();

  const sonuc = await modal({
    baslik: mevcut ? 'Satırı düzenle' : 'İlaç ekle',
    genis: true,
    govde: el('div', {}, oneriler,
      alan('İlaç', kutu, { gerekli: true, ipucu: 'Stoktan seç; listede yoksa önce İlaçlar\'a ekle.' }),
      sonuclar, secilenKutusu,
      el('div', { class: 'izgara izgara--form', style: { marginBlockStart: 'var(--b-3)' } },
        alan('Adet (kutu)', adet, { gerekli: true }),
        alan('Kullanım', kullanim),
        alan('Süre', sure)),
      alan('Not', not)),
    dugmeler: [
      { metin: 'Vazgeç', deger: null },
      { metin: mevcut ? 'Kaydet' : 'Ekle', sinif: 'btn--birincil', cb: () => {
        const n = Math.floor(Number(adet.value));
        if (!ilac) { kutu.classList.add('input--hata'); kutu.focus(); return false; }
        if (!(n > 0)) { adet.classList.add('input--hata'); adet.focus(); return false; }
        return {
          ...bosSatir(), ...(mevcut || {}),
          ilacId: ilac.id, ilacAdi: ilacEtiketi(ilac), etkenMadde: ilac.etkenMadde || '',
          adet: n, kullanim: kullanim.value.trim(), sure: sure.value.trim(), not: not.value.trim(),
          birimFiyat: Number(ilac.satisFiyati) || 0,
        };
      } },
    ],
  });
  return sonuc && typeof sonuc === 'object' ? sonuc : null;
}

export default {
  baslik: 'Reçete yaz',
  async cizim(kok, ctx) {
    const { depo, git, basari, hata, onayla } = ctx;
    const [ilaclar, hastalar, ayar] = await Promise.all([
      depo.listele('ilaclar', { sirala: 'ad' }),
      depo.listele('hastalar', { sirala: 'soyad' }),
      depo.ayarlar(),
    ]);

    const duzenleme = ctx.param.id ? await depo.al('receteler', ctx.param.id) : null;
    let recete = duzenleme ? { ...duzenleme } : bosRecete(ayar, bugun());
    let hasta = recete.hastaId ? hastalar.find((h) => h.id === recete.hastaId) : null;
    if (!duzenleme && ctx.sorgu?.hasta) {
      hasta = hastalar.find((h) => h.id === ctx.sorgu.hasta) || null;
      if (hasta) recete.hastaId = hasta.id;
    }
    let hatalar = {};

    function ciz() {
      temizle(kok);
      kok.append(sayfaBas(duzenleme ? `Reçeteyi düzenle · ${duzenleme.receteNo || ''}` : 'Yeni reçete', {
        alt: 'Hasta seç, ilaçları ekle. Karşılama sonraki adımda.',
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
                el('div', { class: 'liste__alt' }, [hastaYasi(hasta) !== null ? `${hastaYasi(hasta)} yaş` : null, hasta.telefon, hasta.sigorta === 'sgk' ? 'SGK' : null].filter(Boolean).join(' · ') || '—')),
              el('div', { class: 'liste__son' }, btn('Değiştir', { class: 'btn btn--kucuk', onclick: hastaDegistir })))),
          ...(hasta.alerjiler || []).map((a) => el('div', { class: 'uyari uyari--hata', style: { marginBlockStart: 'var(--b-2)' } }, simge('uyari', { boy: 16 }), el('span', {}, `Alerji: ${a}`))),
          (hasta.kronikHastaliklar || []).length
            ? el('p', { class: 'kart__alt', style: { marginBlockStart: 'var(--b-2)' } }, 'Kronik: ' + hasta.kronikHastaliklar.join(', '))
            : null)
        : el('div', {},
          btnS('hasta', 'Hasta seç', { class: 'btn btn--birincil', onclick: hastaDegistir }),
          hatalar.hastaId ? el('span', { class: 'alan__hata', style: { marginInlineStart: 'var(--b-3)' } }, hatalar.hastaId) : null);
      kok.appendChild(kart({}, el('div', { class: 'kart__bas' }, el('h2', {}, 'Hasta')), hastaGovdesi));

      /* --- Reçete bilgileri --- */
      const g = {
        tarih: girdi({ type: 'date', name: 'tarih', value: String(recete.tarih || '').slice(0, 10), onchange: (e) => { recete.tarih = e.target.value; } }),
        tur: secim(RECETE_TURLERI, { name: 'tur', value: recete.tur, onchange: (e) => { recete.tur = e.target.value; } }),
        receteNo: girdi({ name: 'receteNo', value: recete.receteNo, placeholder: 'Kaydedince kendiliğinden verilir', onchange: (e) => { recete.receteNo = e.target.value.trim(); } }),
        tani: girdi({ name: 'tani', value: recete.tani, onchange: (e) => { recete.tani = e.target.value.trim(); } }),
        taniKodu: girdi({ name: 'taniKodu', value: recete.taniKodu, placeholder: 'J06.9', onchange: (e) => { recete.taniKodu = e.target.value.trim(); } }),
        protokolNo: girdi({ name: 'protokolNo', value: recete.protokolNo, onchange: (e) => { recete.protokolNo = e.target.value.trim(); } }),
      };
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, 'Reçete bilgileri')),
        el('div', { class: 'izgara izgara--form' },
          alan('Tarih', g.tarih, { gerekli: true, hata: hatalar.tarih }),
          alan('Reçete türü', g.tur),
          alan('Reçete no', g.receteNo),
          alan('Tanı', g.tani),
          alan('Tanı kodu (ICD-10)', g.taniKodu),
          alan('Protokol no', g.protokolNo))));

      /* --- İlaç satırları --- */
      const uyarilar = receteUyarilari(recete.satirlar, hasta, ilaclar, {
        alerjiBul: alerjiCakismasi,
        ilacUyarilariBul: (i) => ilacUyarilari(i),
      });
      const satirGovdesi = recete.satirlar.length
        ? el('div', { class: 'tablo-kap' }, el('table', { class: 'tablo' },
          el('thead', {}, el('tr', {}, el('th', {}, 'İlaç'), el('th', { class: 'sayi' }, 'Adet'), el('th', {}, 'Kullanım'), el('th', {}, 'Süre'), el('th', {}, ''))),
          el('tbody', {}, ...recete.satirlar.map((s, i) => {
            const satirUyarilari = uyarilar.filter((u) => u.satir === i);
            return el('tr', {},
              el('td', {},
                el('div', { class: 'liste__baslik' }, s.ilacAdi),
                ...satirUyarilari.map((u) => el('div', { class: 'alan__hata', style: u.tur === 'uyari' ? { color: 'rgb(var(--sari))' } : null }, u.metin)),
                s.not ? el('div', { class: 'liste__alt' }, s.not) : null),
              el('td', { class: 'sayi' }, String(s.adet)),
              el('td', {}, s.kullanim || '—'),
              el('td', {}, s.sure || '—'),
              el('td', { class: 'sayi' },
                el('div', { class: 'satir', style: { justifyContent: 'flex-end', flexWrap: 'nowrap' } },
                  btn(simge('kalem', { boy: 15 }), { class: 'btn btn--kucuk btn--ikon btn--sade', 'aria-label': `${s.ilacAdi} satırını düzenle`, onclick: async () => {
                    const y = await satirKutusu(ctx, ilaclar, hasta, s);
                    if (y) { recete.satirlar = recete.satirlar.map((x, j) => (j === i ? y : x)); ciz(); }
                  } }),
                  btn(simge('cop', { boy: 15 }), { class: 'btn btn--kucuk btn--ikon btn--sade', 'aria-label': `${s.ilacAdi} satırını sil`, onclick: () => {
                    recete.satirlar = recete.satirlar.filter((_, j) => j !== i); ciz();
                  } }))));
          }))))
        : bosDurum({ simge: 'ilac', baslik: 'Henüz ilaç eklenmedi', alt: 'Reçeteye en az bir ilaç ekle.' });

      const genelUyarilar = uyarilar.filter((u) => u.satir === -1);
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' },
          el('h2', {}, 'İlaçlar'),
          btnS('arti', 'İlaç ekle', { class: 'btn btn--kucuk btn--birincil', onclick: async () => {
            const y = await satirKutusu(ctx, ilaclar, hasta);
            if (y) { recete.satirlar = [...recete.satirlar, y]; ciz(); }
          } })),
        hatalar.satirlar ? el('div', { class: 'alan__hata', style: { marginBlockEnd: 'var(--b-2)' } }, hatalar.satirlar) : null,
        satirGovdesi,
        ...genelUyarilar.map((u) => el('div', { class: `uyari uyari--${u.tur}`, style: { marginBlockStart: 'var(--b-2)' } }, simge('uyari', { boy: 16 }), el('span', {}, u.metin)))));

      /* --- Not ve kaydet --- */
      kok.appendChild(kart({},
        alan('Reçete notu', metinAlani({ name: 'notlar', value: recete.notlar, rows: 2, onchange: (e) => { recete.notlar = e.target.value.trim(); } })),
        el('div', { class: 'satir' },
          btnS('kaydet', duzenleme ? 'Değişiklikleri kaydet' : 'Reçeteyi kaydet', { class: 'btn btn--birincil', onclick: () => kaydet(false) }),
          !duzenleme ? btnS('onay', 'Kaydet ve karşıla', { class: 'btn', onclick: () => kaydet(true) }) : null,
          btn('Vazgeç', { class: 'btn btn--sade', onclick: async () => {
            if (!recete.satirlar.length || await onayla('Bu reçete kaydedilmeden kapatılsın mı?', { evet: 'Kapat' })) {
              git(duzenleme ? `/recete/${duzenleme.id}` : '/receteler');
            }
          } }))));
    }

    async function hastaDegistir() {
      if (!hastalar.length) {
        hata('Önce bir hasta kaydetmelisin.');
        git('/hastalar');
        return;
      }
      const h = await hastaSec(ctx, hastalar);
      if (h) { hasta = h; recete.hastaId = h.id; hatalar = { ...hatalar, hastaId: '' }; ciz(); }
    }

    async function kaydet(karsilamayaGit) {
      hatalar = receteDogrula(recete);
      if (Object.keys(hatalar).length) { ciz(); hata(Object.values(hatalar)[0]); return; }
      try {
        const y = await receteKaydet(depo, recete);
        basari(duzenleme ? 'Reçete güncellendi' : `Reçete kaydedildi: ${y.receteNo}`);
        git(`/recete/${y.id}`);
      } catch (e) { hata(e.message || 'Kaydedilemedi'); }
    }

    ciz();
  },
};
