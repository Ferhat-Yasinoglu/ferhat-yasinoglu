// Reçete kâğıdı. Ekranda gizli, yazdırılırken sayfadaki tek görünen şey.
// Düzen doktorun hâlihazırda kullandığı basılı reçete kâğıdından alındı:
// mavi antet (ad, ünvan şeridi), hizmet satırları, sabıka satırı, Name/Age/Date
// şeridi, solda Clinical sütunu, sağda ℞ alanı, altta rozetler ve iletişim.
//
// İki halde çalışır: dolu reçete ve boş kâğıt. Boş hal, doktorun tomar halinde
// bastırıp üzerine kalemle yazdığı kâğıdın aynısıdır — her şey aynı yerde durur,
// yalnız alanlar çizgi olarak basılır.
import { el, svgEl, qrGorsel } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { t } from './i18n.js';
import { tamAd, hastaYasi } from './paylasilan/hasta.js';
import { OLCUMLER, receteMetni } from './paylasilan/recete.js';
import { trTarih } from './paylasilan/tarih.js';
import { telefonNormalize } from './paylasilan/metin.js';

/* Klinik alanların etiketleri kâğıtta İngilizce durur: doktorun kendi kâğıdı
   da böyle ve BP/PR/RR/BW hekimlikte evrensel kısaltmalar. */
const KLINIK_ADLARI = { bp: 'BP', pr: 'PR', rr: 'RR', bw: 'BW', temp: 'Temperature' };

const doluMu = (v) => String(v ?? '').trim() !== '';
const satirlara = (metin) => String(metin ?? '').split('\n').map((x) => x.trim()).filter(Boolean);

/** Kâğıdın üstündeki QR'ın içeriği. Ayarlardan seçilir. */
export function qrIcerigi(ayar, recete, hasta, { bos = false } = {}) {
  const secim = ayar.qrIcerik || 'whatsapp';
  if (secim === 'yok') return '';
  if (secim === 'recete' && !bos && recete) {
    return receteMetni(recete, hasta, ayar, {
      recete: t('nav.recete', 'Reçete'), tarih: t('genel.tarih', 'Tarih'), hasta: t('nav.hasta', 'Hasta'),
      tani: t('recete.tani', 'Tanı'), ilaclar: t('nav.ilaclar', 'İlaçlar'), not: t('genel.not', 'Not'),
      alerji: t('hasta.alerji', 'Alerji'), adet: t('recete.kutu', 'kutu'), hastaAdi: tamAd(hasta),
    });
  }
  const numara = telefonNormalize(ayar.whatsapp || ayar.telefon, ayar.ulkeKodu);
  return numara ? `https://wa.me/${numara}` : '';
}

/** ℞ alanının arkasındaki soluk kalp + kalp atışı çizimi. */
function filigran() {
  return svgEl('svg', { class: 'kagit__filigran', viewBox: '0 0 240 120', 'aria-hidden': 'true' },
    svgEl('path', {
      d: 'M120 96c-1.5 0-26-16-32-30-4.5-10.5 1-21 11-23.5 7.5-1.9 15.4 1.2 21 8 5.6-6.8 13.5-9.9 21-8 10 2.5 15.5 13 11 23.5-6 14-30.5 30-32 30z',
      fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6,
    }),
    svgEl('path', {
      d: 'M120 62c-4 8-8 14-12 18-3-14-6-28-9-38-3 10-5 18-8 22H2',
      fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linejoin': 'round',
    }),
    svgEl('path', {
      d: 'M238 64h-53c-3-4-5-12-8-22-3 10-6 24-9 38-4-4-8-10-12-18',
      fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linejoin': 'round',
    }));
}

/**
 * Reçete kâğıdını kurar.
 * `bos: true` → hasta, ölçüm ve ilaç alanları elle doldurulmak üzere boş kalır.
 */
export function kagitCiz({ recete = {}, hasta = null, ayar = {}, bos = false } = {}) {
  const boyut = ayar.yazdirmaBoyutu === 'A5' ? 'A5' : 'A4';
  const sade = ayar.kagitStili === 'sade';
  const stil = el('style', {});
  // ℞ alanı sayfanın kalanını doldursun: boş kâğıtta yazmaya bol yer kalır.
  stil.textContent = `@page { size: ${boyut}; margin: ${boyut === 'A5' ? '6mm' : '8mm'}; }`
    + ` .kagit { --rx-boy: ${boyut === 'A5' ? '92mm' : '168mm'}; }`;

  const yas = hasta ? hastaYasi(hasta) : null;
  const cizgi = (genislik) => el('span', { class: 'kagit__cizgi', style: genislik ? { inlineSize: genislik } : null }, ' ');

  /* ---- Antet: sağda doktorun adı, ortada amblem, solda slogan ---- */
  const antet = el('header', { class: 'kagit__antet' },
    el('div', { class: 'kagit__ad-blok' },
      el('div', { class: 'kagit__doktor' }, [recete.doktorUnvan || ayar.doktorUnvan, recete.doktorAd || ayar.doktorAd].filter(doluMu).join(' ')),
      doluMu(ayar.doktorAdAlt) ? el('div', { class: 'kagit__doktor-alt' }, ayar.doktorAdAlt) : null),
    el('div', { class: 'kagit__amblem' }, simge('asa', { boy: 44 })),
    el('div', { class: 'kagit__slogan' },
      simge('ekg', { boy: 26 }),
      doluMu(ayar.slogan) ? el('div', {}, ...satirlara(ayar.slogan).map((x) => el('div', {}, x))) : null,
      doluMu(ayar.klinikAdi) ? el('div', { class: 'kagit__klinik-ad' }, ayar.klinikAdi) : null));

  const unvan = doluMu(ayar.uzmanlik) ? el('div', { class: 'kagit__unvan' }, el('span', {}, ayar.uzmanlik)) : null;

  /* ---- Hizmetler: her satır kendi simgesiyle, altında ilgi alanları ---- */
  const hizmetSatirlari = satirlara(ayar.hizmetler);
  const hizmet = hizmetSatirlari.length || doluMu(ayar.hizmetAlanlari)
    ? el('div', { class: 'kagit__hizmet' },
      hizmetSatirlari.length
        ? el('div', { class: 'kagit__hizmet-satir' }, ...hizmetSatirlari.map((h, i) =>
          el('span', { class: 'kagit__hizmet-oge' }, simge(i % 2 ? 'ultrason' : 'ekg', { boy: 17 }), el('span', {}, h))))
        : null,
      doluMu(ayar.hizmetAlanlari) ? el('div', { class: 'kagit__hizmet-alan' }, ayar.hizmetAlanlari) : null)
    : null;

  const deneyim = doluMu(ayar.deneyim) ? el('div', { class: 'kagit__deneyim' }, ayar.deneyim) : null;

  /* ---- Hasta şeridi: Name / Age / Date / No ---- */
  const alan = (etiket, deger, genislik) => el('span', { class: 'kagit__alan' },
    el('b', {}, etiket + ':'), bos ? cizgi(genislik) : el('span', { dir: 'auto' }, deger || '—'));

  // Şerit ve klinik sütun soldan sağa: etiketleri İngilizce ve basılı kâğıtta
  // da bu yönde. Sayfanın kalanı sağdan sola kalır.
  const serit = el('div', { class: 'kagit__serit', dir: 'ltr' },
    alan('Name', tamAd(hasta), '52mm'),
    alan('Age', yas !== null ? String(yas) : '', '18mm'),
    alan('Date', bos ? '' : trTarih(recete.tarih), '30mm'),
    alan('No', bos ? '' : recete.receteNo, '28mm'));

  /* ---- Clinical sütunu: ölçümler, altta stetoskop ve QR ---- */
  const qr = qrGorsel(qrIcerigi(ayar, recete, hasta, { bos }), { boy: 76, sinif: 'kagit__qr' });
  const sutun = el('aside', { class: 'kagit__klinik-sutun', dir: 'ltr' },
    el('div', { class: 'kagit__sutun-bas' },
      el('span', {}, t('kagit.klinik', 'Clinical')),
      simge('stetoskop', { boy: 24 })),
    el('div', { class: 'kagit__olcumler' },
      // Girilmemiş ölçüm tire değil çizgi basılır: doktor çıktının üstüne
      // kalemle yazabilsin. Kâğıt hem dolu hem elle tamamlanabilir olsun diye.
      ...OLCUMLER.map(([anahtar, , , birim]) => el('div', { class: 'kagit__olcum' },
        el('b', {}, `${KLINIK_ADLARI[anahtar]} :`),
        !bos && doluMu(recete.olcumler?.[anahtar])
          ? el('span', { dir: 'ltr' }, `${recete.olcumler[anahtar]} ${birim}`)
          : cizgi()))),
    el('div', { class: 'kagit__sutun-ayak' },
      qr,
      el('div', { class: 'kagit__sutun-resim' }, simge('stetoskop', { boy: 54 }), simge('kalp', { boy: 34 }))));

  /* ---- ℞ alanı ---- */
  const tani = !bos && (doluMu(recete.tani) || doluMu(recete.taniKodu))
    ? el('div', { class: 'kagit__tani' }, el('b', {}, t('recete.tani', 'Tanı') + ': '), [recete.tani, recete.taniKodu].filter(doluMu).join(' · '))
    : null;

  const alerjiler = hasta?.alerjiler || [];
  const alerji = !bos && alerjiler.length
    ? el('div', { class: 'kagit__alerji' }, el('b', {}, t('hasta.alerji', 'Alerji') + ': '), alerjiler.join(', '))
    : null;

  const ilacGovdesi = bos
    ? null
    : el('ol', { class: 'kagit__ilaclar' }, ...(recete.satirlar || []).map((s) => el('li', {},
      el('div', { class: 'kagit__ilac-ad' }, el('b', {}, s.ilacAdi), el('span', { class: 'kagit__adet' }, `× ${s.adet}`)),
      doluMu(s.kullanim) || doluMu(s.sure) || doluMu(s.not)
        ? el('div', { class: 'kagit__kullanim' }, [s.kullanim, s.sure, s.not].filter(doluMu).join(' · '))
        : null)));

  const rx = el('section', { class: 'kagit__rx' },
    filigran(),
    el('div', { class: 'kagit__rx-isaret', dir: 'ltr' }, '℞'),
    el('div', { class: 'kagit__rx-govde' }, tani, alerji, ilacGovdesi,
      !bos && doluMu(recete.notlar) ? el('div', { class: 'kagit__not' }, recete.notlar) : null));

  /* ---- Ayak: rozetler ve iletişim ---- */
  const rozetler = String(ayar.ayakEtiketleri ?? t('kagit.ayak_etiketleri', 'قلب, شش, معده, اطفال'))
    .split(',').map((x) => x.trim()).filter(Boolean).slice(0, 4);
  const ROZET_SIMGE = ['kalp', 'akciger', 'mide', 'cocuk'];
  const ayak = el('footer', { class: 'kagit__ayak' },
    el('div', { class: 'kagit__iletisim' },
      doluMu(ayar.adres) ? el('div', { class: 'kagit__iletisim-satir' }, simge('konum', { boy: 16 }), el('span', {}, `${t('kagit.adres', 'آدرس')} : ${ayar.adres}`)) : null,
      doluMu(ayar.telefon) ? el('div', { class: 'kagit__iletisim-satir' }, simge('telefon', { boy: 16 }), el('span', { dir: 'ltr' }, `${t('kagit.tel', 'شماره تماس')} : ${ayar.telefon}`)) : null),
    rozetler.length
      ? el('div', { class: 'kagit__rozetler', dir: 'ltr' }, ...rozetler.map((etiket, i) =>
        el('div', { class: 'kagit__rozet' }, el('span', { class: 'kagit__rozet-daire' }, simge(ROZET_SIMGE[i] || 'kalp', { boy: 20 })), el('span', {}, etiket))))
      : null);

  return el('div', { class: `yazdir-alan kagit${sade ? ' kagit--sade' : ''}` }, stil,
    antet, unvan, hizmet, deneyim, serit,
    el('div', { class: 'kagit__govde' }, rx, sutun),
    ayak);
}

/**
 * Kâğıdı yazdırır. Sayfada duran kâğıt geçici olarak değiştirilir, yazdırma
 * bitince eski hale döner — böylece boş kâğıt da aynı düzenle basılır.
 */
export function kagidiYazdir(secenekler) {
  const eski = document.querySelector('.yazdir-alan');
  const yeni = kagitCiz(secenekler);
  if (eski) eski.replaceWith(yeni); else document.getElementById('sayfa').appendChild(yeni);
  window.print();
  if (eski) yeni.replaceWith(eski); else yeni.remove();
}
