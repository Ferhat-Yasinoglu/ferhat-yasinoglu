// Boş reçete kâğıdı: antetli ama içi boş kâğıdı tomar halinde bastırma ekranı.
//
// Hekim her reçeteyi bilgisayarda yazmıyor — ev ziyaretinde, elektrik yokken
// ya da sırası sıkışıkken elle dolduruyor. O zaman da kâğıdın üstünde kendi
// anteti, altında imza yeri dursun isteniyor.
//
// Ayarlar sayfasında da bir "boş kâğıt bastır" düğmesi vardı; oraya gömülü
// olduğu için kimse bulamıyordu. Buradaki ekran onun yerini alıyor: ne
// basılacağı önce görünüyor, sonra basılıyor.
import { el, temizle, btnS, kart, sayfaBas, alan, secim } from '../cekirdek/dom.js';
import { kagitCiz, kagidiYazdir, kagidiOlcekle, tarayiciBaskisi } from '../kagit.js';
import { t } from '../i18n.js';

export default {
  baslik: 'Boş kâğıt',
  async cizim(kok, ctx) {
    const { depo } = ctx;
    const ayar = await depo.ayarlar();
    temizle(kok);

    const adet = secim(
      [1, 2, 5, 10, 20].map((n) => [String(n), t('bos_kagit.adet_n', '{n} kâğıt', { n })]),
      { name: 'adet', value: '1' });

    /* Tek bir kâğıdı N kez basmanın tarayıcıdan geçen yolu yok: yazıcı
       kopya sayısını yazdırma kutusunda soruyor. O yüzden kâğıdı N kez
       arka arkaya çiziyoruz; her biri kendi sayfasına düşüyor
       (.yazdir-alan + `break-after`, bkz. yazdirma.css). */
    const bastir = () => {
      const n = Math.max(1, Math.min(20, Number(adet.value) || 1));
      kagidiYazdir({ ayar, bos: true, tekrar: n });
    };

    kok.appendChild(sayfaBas(t('bos_kagit.baslik', 'Boş reçete kâğıdı'), {
      alt: t('bos_kagit.alt', 'Anteti basılı, içi boş kâğıt. Elle doldurmak için tomar halinde bastır.'),
      eylemler: [btnS('yazdir', t('bos_kagit.bastir', 'Bastır'), { class: 'btn btn--birincil', onclick: bastir })],
    }));

    kok.appendChild(kart({},
      el('div', { class: 'kart__bas' }, el('h2', {}, t('bos_kagit.kac', 'Kaç kâğıt?'))),
      el('p', { class: 'kart__alt' }, t('bos_kagit.kac_alt', 'Yazıcı kutusunda ayrıca kopya sayısı sorarsa oradakini 1 bırak.')),
      alan(t('bos_kagit.adet', 'Adet'), adet)));

    const kagit = kagitCiz({ ayar, bos: true });
    const tuval = el('div', { class: 'kagit-tuval' }, kagit);
    kok.appendChild(kart({ class: 'kart recete-onizleme' },
      el('div', { class: 'kart__bas' },
        el('h2', {}, t('bos_kagit.onizleme', 'Basılacak kâğıt')),
        el('span', { class: 'kart__alt' }, ayar.yazdirmaBoyutu === 'A5' ? 'A5' : 'A4')),
      tuval));
    // Sayfadan çıkınca boyut gözcüsü ve yazdırma dinleyicileri bırakılsın
    // (yönlendirici temizleyiciyi çağırıyor). Ctrl+P tek boş kâğıt basıyor.
    const olcekBirak = kagidiOlcekle(tuval, kagit, kok);
    const baskiBirak = tarayiciBaskisi(() => kagitCiz({ ayar, bos: true }));
    return () => { olcekBirak(); baskiBirak(); };
  },
};
