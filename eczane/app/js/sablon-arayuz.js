// Reçete şablonlarının arayüzü: seçme kutusu, kaydetme kutusu ve liste.
// Sayfa değil, başka sayfaların kullandığı parçalar.
import { el, temizle, btn, btnS, girdi, alan, bosDurum } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { sablonAra, receteyiSablonaCevir, sablonDogrula } from './paylasilan/sablon.js';
import { t } from './i18n.js';
import { dogrulaMetni, hataMetni } from './hatalar.js';

/** Şablonun bir satırlık özeti: "3 ilaç · Parol, Augmentin, …" */
export function sablonOzeti(sablon) {
  const satirlar = sablon?.satirlar || [];
  const adlar = satirlar.map((s) => s.ilacAdi).filter(Boolean);
  const kisa = adlar.slice(0, 3).join('، ') + (adlar.length > 3 ? ' …' : '');
  return [t('recete.ilac_sayisi', '{n} ilaç', { n: satirlar.length }), kisa].filter(Boolean).join(' · ');
}

/** Şablon seçme kutusu. Seçileni döndürür, vazgeçilirse null. */
export async function sablonSecKutusu(ctx, sablonlar) {
  const { modal } = ctx;
  const arama = girdi({ type: 'search', placeholder: t('sablon.ara', 'Şablon adı, tanı ya da ilaç…') });
  const sonuclar = el('div', { class: 'liste' });
  let secilen = null;

  function ciz() {
    temizle(sonuclar);
    const bulunan = sablonAra(sablonlar, arama.value);
    if (!bulunan.length) {
      sonuclar.appendChild(el('div', { class: 'liste__satir sessiz' }, t('sablon.eslesme_yok', 'Eşleşen şablon yok')));
      return;
    }
    for (const s of bulunan) {
      sonuclar.appendChild(el('button', {
        class: 'liste__satir liste__satir--tiklanir', type: 'button',
        style: { border: 'none', background: 'none', textAlign: 'start', font: 'inherit', cursor: 'pointer', inlineSize: '100%' },
        'aria-pressed': secilen?.id === s.id,
        onclick: () => { secilen = s; ciz(); },
      },
        el('span', { class: 'avatar' }, simge('recete', { boy: 18 })),
        el('div', { class: 'liste__govde' },
          el('div', { class: 'liste__baslik' }, s.ad),
          el('div', { class: 'liste__alt' }, [s.tani, sablonOzeti(s)].filter(Boolean).join(' · '))),
        secilen?.id === s.id ? el('div', { class: 'liste__son' }, simge('onay', { boy: 18 })) : null));
    }
  }
  arama.oninput = ciz;
  ciz();

  const sonuc = await modal({
    baslik: t('sablon.sec', 'Şablondan doldur'),
    genis: true,
    govde: el('div', {},
      el('p', { class: 'kart__alt' }, t('sablon.sec_alt', 'Şablondaki ilaçlar reçeteye eklenir. Hasta, tarih ve ölçümler değişmez.')),
      el('div', { style: { marginBlock: 'var(--b-3)' } }, arama),
      sonuclar),
    dugmeler: [
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: t('sablon.uygula', 'Uygula'), sinif: 'btn--birincil', cb: () => secilen || false },
    ],
  });
  return sonuc && typeof sonuc === 'object' ? sonuc : null;
}

/** Açık reçeteyi şablon olarak kaydeder. Kaydedilen şablonu döndürür. */
export async function sablonKaydetKutusu(ctx, recete) {
  const { depo, modal, basari, hata } = ctx;
  const mevcutlar = await depo.listele('sablonlar', { sirala: 'ad' });
  const onerilenAd = String(recete.tani || '').trim();
  const adGirdisi = girdi({ name: 'ad', value: onerilenAd, placeholder: t('sablon.ad_yer', 'Örneğin: Üst solunum yolu enfeksiyonu') });
  const hataSatiri = el('div', { class: 'alan__hata' });

  const sonuc = await modal({
    baslik: t('sablon.kaydet', 'Şablon olarak kaydet'),
    govde: el('div', {},
      el('p', { class: 'kart__alt' }, t('sablon.kaydet_alt', 'Yalnız ilaçlar, tanı ve reçete notu saklanır. Hasta, tarih ve ölçümler saklanmaz.')),
      el('div', { style: { marginBlockStart: 'var(--b-3)' } }, alan(t('sablon.ad', 'Şablon adı'), adGirdisi, { gerekli: true })),
      hataSatiri),
    dugmeler: [
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: t('genel.kaydet', 'Kaydet'), sinif: 'btn--birincil', cb: () => {
        const taslak = receteyiSablonaCevir(recete, adGirdisi.value);
        const hatalar = sablonDogrula(taslak, mevcutlar);
        if (Object.keys(hatalar).length) {
          hataSatiri.textContent = dogrulaMetni(hatalar.ad || hatalar.satirlar);
          adGirdisi.classList.add('input--hata');
          return false;
        }
        return taslak;
      } },
    ],
  });
  if (!sonuc || typeof sonuc !== 'object') return null;
  try {
    const y = await depo.kaydet('sablonlar', sonuc);
    basari(t('sablon.kaydedildi', 'Şablon kaydedildi: {ad}', { ad: y.ad }));
    return y;
  } catch (e) {
    hata(hataMetni(e, t('genel.kaydedilemedi', 'Kaydedilemedi')));
    return null;
  }
}

/** Ayarlardaki şablon listesi. Silme dışında düzenleme yok: şablon zaten
 *  bir reçeteden üretiliyor, değiştirmek isteyen yenisini kaydediyor. */
export function sablonListesi(ctx, sablonlar, tazele) {
  const { depo, onayla, basari } = ctx;
  if (!sablonlar.length) {
    return bosDurum({
      simge: 'recete', baslik: t('sablon.yok', 'Henüz şablon yok'),
      alt: t('sablon.yok_alt', 'Bir reçete yazarken "Şablon olarak kaydet" dersen burada görünür.'),
    });
  }
  return el('div', { class: 'liste' }, ...sablonlar.map((s) =>
    el('div', { class: 'liste__satir' },
      el('span', { class: 'avatar' }, simge('recete', { boy: 18 })),
      el('div', { class: 'liste__govde' },
        el('div', { class: 'liste__baslik' }, s.ad),
        el('div', { class: 'liste__alt' }, [s.tani, sablonOzeti(s)].filter(Boolean).join(' · '))),
      el('div', { class: 'liste__son' },
        btnS('cop', t('genel.sil', 'Sil'), { class: 'btn btn--kucuk btn--sade', onclick: async () => {
          if (await onayla(t('sablon.sil_onay', '"{ad}" şablonu silinsin mi?', { ad: s.ad }), { tehlikeli: true, evet: t('genel.sil', 'Sil') })) {
            await depo.sil('sablonlar', s.id);
            basari(t('sablon.silindi', 'Şablon silindi'));
            tazele();
          }
        } })))));
}
