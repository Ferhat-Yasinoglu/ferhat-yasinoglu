// Reçete kâğıdı: ekranda gizli, yazdırılırken sayfadaki tek görünen şey.
// İki halde çalışır: dolu reçete ve boş kâğıt. Boş hal, doktorun tomar halinde
// bastırıp üzerine kalemle yazdığı kâğıdın aynısıdır — antet, klinik ölçüm
// sütunu ve iletişim şeridi aynı yerde durur, yalnız satırlar boş kalır.
import { el, qrGorsel } from './cekirdek/dom.js';
import { t } from './i18n.js';
import { tamAd, hastaYasi } from './paylasilan/hasta.js';
import { OLCUMLER, receteMetni } from './paylasilan/recete.js';
import { trTarih } from './paylasilan/tarih.js';
import { telefonNormalize } from './paylasilan/metin.js';

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

const doluMu = (v) => String(v ?? '').trim() !== '';

/**
 * Reçete kâğıdını kurar.
 * `bos: true` → hasta ve ilaç satırları elle doldurulmak üzere boş bırakılır.
 */
export function kagitCiz({ recete = {}, hasta = null, ayar = {}, bos = false } = {}) {
  const boyut = ayar.yazdirmaBoyutu === 'A5' ? 'A5' : 'A4';
  const stil = el('style', {});
  stil.textContent = `@page { size: ${boyut}; margin: ${boyut === 'A5' ? '8mm' : '12mm'}; }`;

  const yas = hasta ? hastaYasi(hasta) : null;
  const bosCizgi = (genislik) => el('span', { class: 'kagit__cizgi', style: genislik ? { inlineSize: genislik } : null }, ' ');

  /* Antet: solda klinik, sağda doktor. Her ikisi de iki satırlı olabilir
     (örneğin üstte Dari, altta İngilizce) — metin ayarlardan olduğu gibi gelir. */
  const antet = el('header', { class: 'kagit__antet' },
    el('div', { class: 'kagit__sol' },
      doluMu(ayar.klinikAdi) ? el('div', { class: 'kagit__klinik' }, ayar.klinikAdi) : null,
      doluMu(ayar.klinikAdiAlt) ? el('div', { class: 'kagit__klinik-alt' }, ayar.klinikAdiAlt) : null,
      doluMu(ayar.adres) ? el('div', { class: 'kagit__ince' }, ayar.adres) : null,
      doluMu(ayar.calismaSaatleri) ? el('div', { class: 'kagit__ince' }, ayar.calismaSaatleri) : null),
    el('div', { class: 'kagit__sag' },
      el('div', { class: 'kagit__doktor' }, [recete.doktorUnvan || ayar.doktorUnvan, recete.doktorAd || ayar.doktorAd].filter(doluMu).join(' ')),
      doluMu(ayar.doktorAdAlt) ? el('div', { class: 'kagit__doktor-alt' }, ayar.doktorAdAlt) : null,
      doluMu(ayar.uzmanlik) ? el('div', { class: 'kagit__ince' }, ayar.uzmanlik) : null,
      doluMu(recete.diplomaNo || ayar.diplomaNo) ? el('div', { class: 'kagit__ince' }, `${t('ayar.diploma', 'Diploma no')}: ${recete.diplomaNo || ayar.diplomaNo}`) : null,
      doluMu(recete.kurum || ayar.kurum) ? el('div', { class: 'kagit__ince' }, recete.kurum || ayar.kurum) : null));

  /* Hasta şeridi */
  const alan = (etiket, deger, genislik) => el('span', { class: 'kagit__alan' },
    el('b', {}, etiket + ':'), bos ? bosCizgi(genislik) : el('span', {}, deger || '—'));

  const serit = el('div', { class: 'kagit__serit' },
    alan(t('kagit.ad', 'Ad'), tamAd(hasta), '46mm'),
    alan(t('kagit.yas', 'Yaş'), yas !== null ? String(yas) : '', '16mm'),
    alan(t('genel.tarih', 'Tarih'), bos ? '' : trTarih(recete.tarih), '26mm'),
    alan(t('recete.no_kisa', 'No'), bos ? '' : recete.receteNo, '26mm'));

  /* Sol sütun: klinik ölçümler + QR */
  const qr = qrGorsel(qrIcerigi(ayar, recete, hasta, { bos }), { boy: 76, sinif: 'kagit__qr' });
  const sutun = el('aside', { class: 'kagit__klinik-sutun' },
    el('div', { class: 'kagit__sutun-bas' }, t('kagit.klinik', 'Klinik')),
    // Ölçüm girilmemişse tire değil çizgi basılır: doktor çıktının üstüne
    // kalemle yazabilsin. Kâğıt hem dolu hem elle tamamlanabilir olsun diye.
    ...OLCUMLER.map(([anahtar, ad, , birim]) => el('div', { class: 'kagit__olcum' },
      el('b', {}, `${t('olcum.' + anahtar, ad)}:`),
      // Değer ve birim soldan sağa yalıtılır: sağdan sola sayfada "110/70 mmHg"
      // yoksa "mmHg 110/70" diye ters okunuyordu.
      !bos && doluMu(recete.olcumler?.[anahtar])
        ? el('span', { dir: 'ltr' }, `${recete.olcumler[anahtar]} ${birim}`)
        : bosCizgi())),
    qr ? el('div', { class: 'kagit__qr-kutu' }, qr) : null);

  /* Sağ taraf: ℞ ve ilaçlar */
  const ilacGovdesi = bos
    ? el('div', { class: 'kagit__bos-satirlar' }, ...Array.from({ length: 9 }, () => el('div', { class: 'kagit__bos-satir' })))
    : el('ol', { class: 'kagit__ilaclar' }, ...(recete.satirlar || []).map((s) => el('li', {},
      el('div', { class: 'kagit__ilac-ad' }, el('b', {}, s.ilacAdi), el('span', { class: 'kagit__adet' }, `× ${s.adet}`)),
      doluMu(s.kullanim) || doluMu(s.sure) || doluMu(s.not)
        ? el('div', { class: 'kagit__kullanim' }, [s.kullanim, s.sure, s.not].filter(doluMu).join(' · '))
        : null)));

  const rx = el('section', { class: 'kagit__rx' }, el('div', { class: 'kagit__rx-isaret' }, '℞'), ilacGovdesi);

  /* Tanı ve alerji: kâğıtta gözden kaçmayacak yerde */
  const tani = !bos && (doluMu(recete.tani) || doluMu(recete.taniKodu))
    ? el('div', { class: 'kagit__tani' }, el('b', {}, t('recete.tani', 'Tanı') + ': '), [recete.tani, recete.taniKodu].filter(doluMu).join(' · '))
    : bos ? el('div', { class: 'kagit__tani' }, el('b', {}, t('recete.tani', 'Tanı') + ': '), bosCizgi('100%')) : null;

  const alerjiler = hasta?.alerjiler || [];
  const alerji = !bos && alerjiler.length
    ? el('div', { class: 'kagit__alerji' }, el('b', {}, t('hasta.alerji', 'Alerji').toLocaleUpperCase('tr') + ': '), alerjiler.join(', '))
    : null;

  const iletisim = [ayar.telefon, ayar.whatsapp && ayar.whatsapp !== ayar.telefon ? `WhatsApp: ${ayar.whatsapp}` : '', ayar.eposta]
    .filter(doluMu).join('  ·  ');

  return el('div', { class: 'yazdir-alan kagit' }, stil,
    antet, serit, tani,
    el('div', { class: 'kagit__govde' }, sutun, rx),
    alerji,
    !bos && doluMu(recete.notlar) ? el('div', { class: 'kagit__not' }, recete.notlar) : null,
    el('footer', { class: 'kagit__ayak' },
      el('div', { class: 'kagit__iletisim' }, iletisim),
      el('div', { class: 'kagit__imza' }, t('kagit.imza', 'Kaşe / İmza'))));
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
