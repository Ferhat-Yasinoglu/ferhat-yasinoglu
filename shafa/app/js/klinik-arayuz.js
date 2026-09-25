// Belirti / tanı / laboratuvar seçme kutusu: ara, grupla, çiple seç.
//
// sayfalar/ dışında duruyor çünkü orası default export bekliyor; burası
// kâğıt üzerinde yazma ekranının kullandığı parçalar.
//
// Eski formda bir de sayfaya gömülü çip şeridi (secimSeridi) vardı; form
// kalkınca onunla birlikte gitti. Oradaki asıl değer hekimin KENDİ sık
// yazdıklarıydı — o buraya, kutunun en üstüne taşındı.
import { el, temizle, girdi } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { ara, degistir, taniDegistir, secili, siklar, gruplaraBol, parcala, kagitAdi, adIndeksi, normalizeFa } from './paylasilan/klinik.js';
import { t } from './i18n.js';

/** Dokunulabilir çip. Seçiliyken işaretli duruyor; ikinci dokunuş geri alır. */
export function cip(metin, { secili: isaretli = false, alt = '', onclick } = {}) {
  // Yazının dir=auto'su: İngilizce ad («Transient ischemic attack (TIA)»)
  // sağdan sola akışta parantezleri ters basmasın.
  return el('button', {
    type: 'button',
    class: `cip cip--secilir${isaretli ? ' cip--secili' : ''}`,
    'aria-pressed': isaretli ? 'true' : 'false',
    title: alt || metin,
    onclick,
  }, isaretli ? simge('onay', { boy: 13 }) : null, el('span', { dir: 'auto' }, metin));
}

/** Çipte kâğıda basılacak ad (İngilizce), altında Dari adı ve kodu: hekim
 *  Dari arayıp buluyor, kâğıtta ne çıkacağını da çipte görüyor. */
const cipAlti = (x) => [x.ad !== kagitAdi(x) ? x.ad : '', x.kod].filter(Boolean).join(' · ');

/** Tam liste: arama + gruplar. Vazgeçilirse reçeteye dokunulmaz.
 *  `gecmis` gecmisler()'in çıktısı; kaydı bilinenler `kayit` taşıyor. */
export async function secimKutusu(ctx, { liste, gruplar, baslik, kodAlani, recete, alan, gecmis = [] }) {
  const { modal } = ctx;
  const indeks = adIndeksi(liste);
  let metin = recete[alan] || '';
  let kodlar = kodAlani ? (recete[kodAlani] || '') : '';

  const kutu = girdi({ type: 'search', name: 'klinikArama', placeholder: t('klinik.ara', 'Ara…') });
  // Sınıf adları görünüşe değil, parçaları AYIRT ETMEYE yarıyor: aynı ad
  // hem "seçilen" özetinde hem listede çipli duruyor, ikisini karıştırmamak
  // gerek (denemede de öyle).
  const ozet = el('div', { class: 'cip-kume klinik-ozet', style: { marginBlockEnd: 'var(--b-2)' } });
  const govde = el('div', { class: 'klinik-liste', style: { maxBlockSize: '52vh', overflowY: 'auto' } });

  function sec(kayit) {
    if (kodAlani) {
      const y = taniDegistir({ tani: metin, taniKodu: kodlar }, kayit);
      metin = y.tani; kodlar = y.taniKodu;
    } else {
      metin = degistir(metin, kayit);
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
      // elimizde yalnız ad varsa yanlış kodu götürebilirdi. Eski reçetede
      // Dari yazılmış seçim («تب») de kaydını buluyor; çip yazıldığı gibi.
      const bilinen = indeks.get(normalizeFa(p)) || { ad: p };
      ozet.appendChild(cip(p, { secili: true, onclick: () => sec(bilinen) }));
    }
  }

  function listeCiz() {
    temizle(govde);
    // Kısayollar en üstte: 231 tanının içinde gezinmek yerine kutuyu açan
    // hareketin çoğu bu birkaç kayıt için. Önce hekimin KENDİ yazdıkları,
    // sonra listenin yaygın işaretlileri (yeni hekimde geçmiş yok).
    // Yalnız kutu boşken: arama sırasında aynı kayıt hem burada hem
    // sonuçlarda çıkıyordu.
    if (!kutu.value.trim()) {
      // Geçmişin kaydı listeden (adIndeksi) geliyor: basılan ICD güncel
      // listeninki, eski reçetedeki eski kod değil. Listede olmayan, elle
      // yazılmış geçmiş kendisi olarak kalıyor.
      const gecmisKayitlari = gecmis.map((x) => x.kayit || { ad: x.ad, kod: x.kod });
      const kisayol = (sinif, etiket, kayitlar) => {
        if (!kayitlar.length) return;
        govde.appendChild(el('div', { class: `cip-kume ${sinif}` },
          el('span', { class: 'cip-kume__etiket' }, etiket),
          ...kayitlar.map((x) => cip(kagitAdi(x), {
            secili: secili(metin, x),
            alt: cipAlti(x),
            onclick: () => sec(x),
          }))));
      };
      kisayol('klinik-gecmis', t('klinik.sik_senin', 'Senin sık yazdıkların'), gecmisKayitlari);
      // Kendi geçmişinde olanı ikinci kez yaygınlar arasında göstermiyoruz.
      const gecmisteki = new Set(gecmisKayitlari);
      kisayol('klinik-yaygin', t('klinik.sik', 'Yaygın'),
        siklar(liste).filter((x) => !gecmisteki.has(x)).slice(0, 12));
    }
    const bulunan = ara(liste, kutu.value);
    if (!bulunan.length) { govde.appendChild(el('div', { class: 'liste__satir sessiz' }, t('klinik.eslesme_yok', 'Eşleşen kayıt yok'))); return; }
    for (const g of gruplaraBol(bulunan, gruplar)) {
      govde.append(el('div', { class: 'cip-kume' },
        el('span', { class: 'cip-kume__etiket' }, g.ad),
        ...g.kayitlar.map((x) => cip(kagitAdi(x), {
          secili: secili(metin, x),
          alt: cipAlti(x),
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
