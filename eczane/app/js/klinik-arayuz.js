// Belirti / tanı / laboratuvar seçme arayüzü: çipler ve tam liste kutusu.
//
// sayfalar/ dışında duruyor çünkü orası default export bekliyor; burası
// reçete formunun kullandığı parçalar.
import { el, temizle, btn, btnS, girdi } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { ara, degistir, taniDegistir, secili, siklar, gruplaraBol, parcala } from './paylasilan/klinik.js';
import { t } from './i18n.js';

/** Dokunulabilir çip. Seçiliyken işaretli duruyor; ikinci dokunuş geri alır. */
export function cip(metin, { secili: isaretli = false, alt = '', onclick } = {}) {
  return el('button', {
    type: 'button',
    class: `cip cip--secilir${isaretli ? ' cip--secili' : ''}`,
    'aria-pressed': isaretli ? 'true' : 'false',
    title: alt || metin,
    onclick,
  }, isaretli ? simge('onay', { boy: 13 }) : null, el('span', {}, metin));
}

/**
 * Bir seçim alanının çip şeridi.
 *
 * Üç liste de aynı kalıpta: önce hekimin kendi sık yazdıkları, sonra (varsa)
 * listedeki yaygınlar, sonra "tüm liste" düğmesi. Tanıda ad ve ICD kodu
 * birlikte yürüyor; belirti ve laboratuvarda kod yok.
 *
 * Tıklanınca reçeteyi yerinde günceller ve girdiyi tazeler — sayfayı baştan
 * çizmiyoruz ki hekim kaydırdığı yerden düşmesin.
 *
 * @param {object} c
 * @param {Array} c.liste seçilebilecek kayıtlar
 * @param {Array} c.gruplar tam liste kutusundaki başlıklar
 * @param {string} c.alan reçetedeki alan adı
 * @param {string|null} c.kodAlani tanıda 'taniKodu', ötekilerde null
 * @param {HTMLElement} c.girdiElemani alanın metin kutusu
 * @param {HTMLElement|null} c.kodGirdisi kod kutusu (yalnız tanıda)
 */
export function secimSeridi(ctx, {
  liste, gruplar, alan, kodAlani = null, baslik, gecmis = [], recete,
  girdiElemani, kodGirdisi = null, tazele,
}) {
  const kap = el('div', {});

  const uygula = (secilen) => {
    if (kodAlani) {
      const y = taniDegistir({ tani: recete[alan] || '', taniKodu: recete[kodAlani] || '' }, secilen);
      recete[alan] = y.tani; recete[kodAlani] = y.taniKodu;
      if (kodGirdisi) kodGirdisi.value = y.taniKodu;
    } else {
      recete[alan] = degistir(recete[alan] || '', secilen.ad);
    }
    girdiElemani.value = recete[alan];
    girdiElemani.classList.remove('input--hata');
    ciz();
    tazele?.();
  };

  function seritCiz(etiket, kayitlar) {
    if (!kayitlar.length) return null;
    return el('div', { class: 'cip-kume' },
      el('span', { class: 'cip-kume__etiket' }, etiket),
      ...kayitlar.map((x) => cip(x.ad, {
        secili: secili(recete[alan], x.ad),
        alt: [x.tr, x.kod].filter(Boolean).join(' · '),
        onclick: () => uygula(x),
      })));
  }

  function ciz() {
    temizle(kap);
    // Kendi geçmişinde olanı ikinci kez yaygınlar arasında göstermiyoruz.
    const gecmisAdlari = new Set(gecmis.map((x) => x.ad));
    const yaygin = siklar(liste).filter((x) => !gecmisAdlari.has(x.ad));
    // append() null'u "null" metnine çeviriyor — el() gibi atlamıyor.
    // Boş şerit (henüz geçmiş yokken) ekranda "null" yazıyordu.
    const parcalar = [
      seritCiz(t('klinik.sik_senin', 'Senin sık yazdıkların'), gecmis),
      seritCiz(t('klinik.sik', 'Yaygın'), yaygin.slice(0, 12)),
      el('div', { class: 'satir', style: { marginBlockStart: 'var(--b-2)' } },
        btnS('ara', t('klinik.hepsi', 'Tüm liste ({n})', { n: liste.length }), {
          class: 'btn btn--kucuk',
          onclick: async () => {
            const y = await secimKutusu(ctx, { liste, gruplar, baslik, kodAlani, recete, alan });
            if (!y) return;
            recete[alan] = y.metin;
            if (kodAlani) { recete[kodAlani] = y.kodlar; if (kodGirdisi) kodGirdisi.value = y.kodlar; }
            girdiElemani.value = y.metin;
            ciz();
            tazele?.();
          },
        }),
        parcala(recete[alan]).length
          ? btn(t('klinik.temizle', 'Temizle'), { class: 'btn btn--kucuk btn--sade', onclick: () => {
            recete[alan] = '';
            if (kodAlani) { recete[kodAlani] = ''; if (kodGirdisi) kodGirdisi.value = ''; }
            girdiElemani.value = '';
            ciz(); tazele?.();
          } })
          : null),
    ];
    kap.append(...parcalar.filter(Boolean));
  }

  ciz();
  return kap;
}

/** Tam liste: arama + gruplar. Vazgeçilirse reçeteye dokunulmaz. */
export async function secimKutusu(ctx, { liste, gruplar, baslik, kodAlani, recete, alan }) {
  const { modal } = ctx;
  let metin = recete[alan] || '';
  let kodlar = kodAlani ? (recete[kodAlani] || '') : '';

  const kutu = girdi({ type: 'search', name: 'klinikArama', placeholder: t('klinik.ara', 'Ara…') });
  const ozet = el('div', { class: 'cip-kume', style: { marginBlockEnd: 'var(--b-2)' } });
  const govde = el('div', { style: { maxBlockSize: '52vh', overflowY: 'auto' } });

  function sec(kayit) {
    if (kodAlani) {
      const y = taniDegistir({ tani: metin, taniKodu: kodlar }, kayit);
      metin = y.tani; kodlar = y.taniKodu;
    } else {
      metin = degistir(metin, kayit.ad);
    }
    ozetCiz(); listeCiz();
  }

  function ozetCiz() {
    temizle(ozet);
    const parcalar = parcala(metin);
    ozet.append(el('span', { class: 'cip-kume__etiket' }, t('klinik.secilen', 'Seçilen')));
    if (!parcalar.length) { ozet.appendChild(el('span', { class: 'sessiz' }, t('klinik.secilen_yok', 'Henüz seçilmedi'))); return; }
    for (const p of parcalar) {
      // Kodu listeden buluyoruz: çıkarma kodu DEĞERİNE göre eşleştiriyor,
      // elimizde yalnız ad varsa yanlış kodu götürebilirdi.
      const bilinen = liste.find((x) => x.ad === p) || { ad: p };
      ozet.appendChild(cip(p, { secili: true, onclick: () => sec(bilinen) }));
    }
  }

  function listeCiz() {
    temizle(govde);
    const bulunan = ara(liste, kutu.value);
    if (!bulunan.length) { govde.appendChild(el('div', { class: 'liste__satir sessiz' }, t('klinik.eslesme_yok', 'Eşleşen kayıt yok'))); return; }
    for (const g of gruplaraBol(bulunan, gruplar)) {
      govde.append(el('div', { class: 'cip-kume' },
        el('span', { class: 'cip-kume__etiket' }, g.ad),
        ...g.kayitlar.map((x) => cip(x.ad, {
          secili: secili(metin, x.ad),
          alt: [x.tr, x.kod].filter(Boolean).join(' · '),
          onclick: () => sec(x),
        }))));
    }
  }

  kutu.oninput = listeCiz;
  ozetCiz();
  listeCiz();

  const sonuc = await modal({
    baslik,
    genis: true,
    govde: el('div', {},
      el('p', { class: 'kart__alt' }, t('klinik.uyari', 'Bu bir ad listesidir, tıbbi öneri değil. Karar muayeneden sonra hekimindir.')),
      kutu, ozet, govde),
    dugmeler: [
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: t('genel.sec', 'Seç'), sinif: 'btn--birincil', cb: () => ({ metin, kodlar }) },
    ],
  });
  return sonuc && typeof sonuc === 'object' ? sonuc : null;
}
