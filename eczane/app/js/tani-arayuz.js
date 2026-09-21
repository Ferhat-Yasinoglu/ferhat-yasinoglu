// Tanı seçme arayüzü: çipler ve tam liste kutusu.
//
// sayfalar/ dışında duruyor çünkü orası default export bekliyor; burası
// reçete formunun kullandığı parçalar.
import { el, temizle, btn, btnS, girdi } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { taniAra, taniDegistir, taniSecili, sikTanilar, gruplaraBol, taniParcala } from './paylasilan/tani.js';
import { t } from './i18n.js';

/** Dokunulabilir çip. Seçiliyken işaretli duruyor; ikinci dokunuş geri alır. */
export function cip(metin, { secili = false, alt = '', onclick } = {}) {
  return el('button', {
    type: 'button',
    class: `cip cip--secilir${secili ? ' cip--secili' : ''}`,
    'aria-pressed': secili ? 'true' : 'false',
    title: alt || metin,
    onclick,
  }, secili ? simge('onay', { boy: 13 }) : null, el('span', {}, metin));
}

/**
 * Tanı çipleri: önce hekimin kendi sık yazdıkları, sonra listedeki yaygınlar.
 * Tıklanınca reçeteyi yerinde günceller ve girdileri tazeler — sayfayı baştan
 * çizmiyoruz ki hekim kaydırdığı yerden düşmesin.
 */
export function taniSecicisi(ctx, { belge, gecmis = [], recete, adGirdisi, kodGirdisi, tazele }) {
  const kap = el('div', {});

  function uygula(secilen) {
    Object.assign(recete, taniDegistir(recete, secilen));
    adGirdisi.value = recete.tani;
    kodGirdisi.value = recete.taniKodu;
    adGirdisi.classList.remove('input--hata');
    ciz();
    tazele?.();
  }

  function seritCiz(baslik, liste) {
    if (!liste.length) return null;
    return el('div', { class: 'cip-kume' },
      el('span', { class: 'cip-kume__etiket' }, baslik),
      ...liste.map((x) => cip(x.ad, {
        secili: taniSecili(recete.tani, x.ad),
        alt: [x.tr, x.kod].filter(Boolean).join(' · '),
        onclick: () => uygula(x),
      })));
  }

  function ciz() {
    temizle(kap);
    // Kendi geçmişinde olanı ikinci kez yaygınlar arasında göstermiyoruz.
    const gecmisAdlari = new Set(gecmis.map((x) => x.ad));
    const yaygin = sikTanilar(belge.tanilar).filter((x) => !gecmisAdlari.has(x.ad));
    kap.append(
      seritCiz(t('tani.sik_senin', 'Senin sık yazdıkların'), gecmis),
      seritCiz(t('tani.sik', 'Yaygın'), yaygin.slice(0, 12)),
      el('div', { class: 'satir', style: { marginBlockStart: 'var(--b-2)' } },
        btnS('ara', t('tani.hepsi', 'Tüm liste ({n})', { n: belge.tanilar.length }), {
          class: 'btn btn--kucuk',
          onclick: async () => {
            const y = await taniSecKutusu(ctx, belge, recete);
            if (!y) return;
            Object.assign(recete, y);
            adGirdisi.value = recete.tani;
            kodGirdisi.value = recete.taniKodu;
            ciz();
            tazele?.();
          },
        }),
        taniParcala(recete.tani).length
          ? btn(t('tani.temizle', 'Tanıyı temizle'), { class: 'btn btn--kucuk btn--sade', onclick: () => {
            recete.tani = ''; recete.taniKodu = '';
            adGirdisi.value = ''; kodGirdisi.value = '';
            ciz(); tazele?.();
          } })
          : null));
  }

  ciz();
  return kap;
}

/** Tam liste: arama + gruplar. Vazgeçilirse reçeteye dokunulmaz. */
export async function taniSecKutusu(ctx, belge, recete) {
  const { modal } = ctx;
  let secim = { tani: recete.tani || '', taniKodu: recete.taniKodu || '' };

  const kutu = girdi({ type: 'search', name: 'taniArama', placeholder: t('tani.ara', 'Şikâyet, tanı ya da ICD kodu…') });
  const ozet = el('div', { class: 'cip-kume', style: { marginBlockEnd: 'var(--b-2)' } });
  const govde = el('div', { style: { maxBlockSize: '52vh', overflowY: 'auto' } });

  function ozetCiz() {
    temizle(ozet);
    const parcalar = taniParcala(secim.tani);
    ozet.append(el('span', { class: 'cip-kume__etiket' }, t('tani.secilen', 'Seçilen')));
    if (!parcalar.length) { ozet.appendChild(el('span', { class: 'sessiz' }, t('tani.secilen_yok', 'Henüz seçilmedi'))); return; }
    for (const p of parcalar) {
      // Kodu listeden buluyoruz: çıkarma kodu DEĞERİNE göre eşleştiriyor,
      // elimizde yalnız ad varsa yanlış kodu götürebilirdi.
      const bilinen = belge.tanilar.find((x) => x.ad === p) || { ad: p };
      ozet.appendChild(cip(p, { secili: true, onclick: () => { secim = taniDegistir(secim, bilinen); ozetCiz(); listeCiz(); } }));
    }
  }

  function listeCiz() {
    temizle(govde);
    const bulunan = taniAra(belge.tanilar, kutu.value);
    if (!bulunan.length) { govde.appendChild(el('div', { class: 'liste__satir sessiz' }, t('tani.eslesme_yok', 'Eşleşen tanı yok'))); return; }
    for (const g of gruplaraBol(bulunan, belge.gruplar)) {
      govde.append(el('div', { class: 'cip-kume' },
        el('span', { class: 'cip-kume__etiket' }, g.ad),
        ...g.tanilar.map((x) => cip(x.ad, {
          secili: taniSecili(secim.tani, x.ad),
          alt: [x.tr, x.kod].filter(Boolean).join(' · '),
          onclick: () => { secim = taniDegistir(secim, x); ozetCiz(); listeCiz(); },
        }))));
    }
  }

  kutu.oninput = listeCiz;
  ozetCiz();
  listeCiz();

  const sonuc = await modal({
    baslik: t('tani.sec', 'Şikâyet / tanı seç'),
    genis: true,
    govde: el('div', {},
      el('p', { class: 'kart__alt' }, t('tani.uyari', 'Bu bir ad ve kod listesidir, teşhis önerisi değil. Tanıya muayeneden sonra hekim karar verir.')),
      kutu, ozet, govde),
    dugmeler: [
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: t('genel.sec', 'Seç'), sinif: 'btn--birincil', cb: () => secim },
    ],
  });
  return sonuc && typeof sonuc === 'object' ? sonuc : null;
}
