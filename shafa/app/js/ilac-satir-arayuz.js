// İlaç satırı kutusu: reçetenin en kalabalık parçası.
//
// sayfalar/ dışında duruyor çünkü orası default export bekliyor. Önce
// recete-yeni.js'in içindeydi; kâğıt üzerinde yazma ekranı gelince oraya da
// lazım oldu ve kopyalamak yerine buraya alındı. Alerji uyarısı burada:
// ikinci bir kopyada unutulması güvenlik sorunu olurdu.
import { el, temizle, btn, girdi, alan } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { KULLANIM_ONERILERI, SURE_ONERILERI, YOLLAR, bosSatir } from './paylasilan/recete.js';
import { FORMLAR, formAdi, ilacAra, ilacEtiketi } from './paylasilan/ilac.js';
import { alerjiCakismasi } from './paylasilan/hasta.js';
import { cip } from './klinik-arayuz.js';
import { enterleOnayla } from './cekirdek/modal.js';
import { t, secenekAdi } from './i18n.js';
import { uyariMetni } from './hatalar.js';

/** Ekranda gösterilen ilaç adı: şekil adı sözlükten ("Parol 500 mg تابلیت").
 *  Reçete satırına giden ilacAdi yine ilacEtiketi(): kâğıt o Türkçe şekil
 *  adını tanıyıp düşürüyor (ilacAdiFormsuz). */
export const ilacGorunenAd = (ilac) => ilacEtiketi(ilac, (k) => (formAdi(k) ? secenekAdi(FORMLAR, k, 'form') : ''));

/** İlaç satırı kutusu: ilaç ara/seç, adet, kullanım, süre. */
export async function satirKutusu(ctx, ilaclar, hasta, mevcut = null, sik = []) {
  const { modal } = ctx;
  let ilac = mevcut?.ilacId ? ilaclar.find((x) => x.id === mevcut.ilacId) : null;

  const kutu = girdi({ type: 'search', name: 'ilacArama', placeholder: t('recete.ilac_ara', 'İlaç adı, barkod, etken madde…'), value: ilac ? ilacGorunenAd(ilac) : '' });
  const sonuclar = el('div', { class: 'liste', style: { maxBlockSize: '220px', overflowY: 'auto' } });
  const secilenKutusu = el('div', {});
  const adet = girdi({ type: 'number', name: 'adet', min: 1, step: 1, value: mevcut?.adet ?? 1 });
  const kullanim = girdi({ name: 'kullanim', value: mevcut?.kullanim ?? '', list: 'kullanim-onerileri', placeholder: t('recete.kullanim_yer', 'Günde 2×1') });
  const sure = girdi({ name: 'sure', value: mevcut?.sure ?? '', placeholder: t('recete.sure_yer', '10 gün') });
  const yol = girdi({ name: 'yol', value: mevcut?.yol ?? '', placeholder: t('recete.yol_yer', 'Ağızdan') });
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
            el('div', { class: 'liste__baslik' }, ilacGorunenAd(ilac)),
            el('div', { class: 'liste__alt' }, ilac.etkenMadde || '—')))),
      ...uyarilar.map((u) => el('div', { class: `uyari uyari--${u.tur}`, style: { marginBlockStart: 'var(--b-2)' } }, simge(u.tur === 'hata' ? 'hata' : 'uyari', { boy: 16 }), el('span', {}, u.metin))));
  }

  const ilacSatiri = (i) => el('button', {
    class: 'liste__satir liste__satir--tiklanir', type: 'button',
    style: { border: 'none', background: 'none', textAlign: 'start', font: 'inherit', cursor: 'pointer', inlineSize: '100%' },
    onclick: () => { ilac = i; kutu.value = ilacGorunenAd(i); aramaCiz(); secileniCiz(); },
  },
    el('div', { class: 'liste__govde' },
      el('div', { class: 'liste__baslik' }, ilacGorunenAd(i)),
      el('div', { class: 'liste__alt' }, i.etkenMadde || '—')));

  function aramaCiz() {
    temizle(sonuclar);
    const q = kutu.value.trim();
    // Kutu boşken de liste gösteriyoruz: hekim yazmadan gezinebilsin.
    // Önce kendi çok yazdıkları, sonra alfabetik baş taraf.
    if (!q || (ilac && q === ilacGorunenAd(ilac))) {
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
  /* Enter: arama kutusunda TEK eşleşme kalınca (ya da adı tam yazılınca)
     onu seçip adete geçiyor; boş kutuda ya da birden çok eşleşmede bir şey
     seçmiyor, yanlış dava kâğıda girmesin (hasta seçicideki gibi). Öbür
     tek satırlık alanlarda kutuyu onaylıyor: önce en çok kullanılan bu
     kutuda Enter hiçbir şey yapmıyordu. Kullanım alanı hariç: öneri
     listesinden (datalist) Enter'la seçilen öneri yazılmadan kutu
     kapanabilirdi. Adet geçersizse cb kutuyu açık tutuyor. */
  kutu.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    const q = kutu.value.trim();
    if (!q) return;
    const bulunan = ilacAra(ilaclar, q);
    const tam = bulunan.filter((i) => ilacGorunenAd(i).toLowerCase() === q.toLowerCase());
    const tek = bulunan.length === 1 ? bulunan : tam;
    if (tek.length !== 1) return;
    [ilac] = tek;
    kutu.value = ilacGorunenAd(ilac); aramaCiz(); secileniCiz();
    adet.focus(); adet.select();
  });
  for (const g of [adet, sure, yol, not]) enterleOnayla(g);
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
      alan(t('recete.yol', 'Veriliş yolu'), yol),
      oneriCipleri(yol, YOLLAR.map((k, i) => t(`yol.${i}`, k))),
      alan(t('genel.not', 'Not'), not)),
    dugmeler: [
      // Düzenlerken silme de buradan: kâğıtta satırı çıkarmanın başka yolu
      // yok, eski formdaki çöp kutusu düğmesi kâğıda sığmıyor.
      ...(mevcut ? [{ metin: t('genel.sil', 'Sil'), deger: 'sil' }] : []),
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: mevcut ? t('genel.kaydet', 'Kaydet') : t('genel.ekle', 'Ekle'), sinif: 'btn--birincil', cb: () => {
        const n = Math.floor(Number(adet.value));
        if (!ilac) { kutu.classList.add('input--hata'); kutu.focus(); return false; }
        if (!(n > 0)) { adet.classList.add('input--hata'); adet.focus(); return false; }
        return {
          ...bosSatir(), ...(mevcut || {}),
          ilacId: ilac.id, ilacAdi: ilacEtiketi(ilac), etkenMadde: ilac.etkenMadde || '',
          // Şekli de saklıyoruz: kâğıt "Cap:" önekini bundan basıyor ve
          // ilaç sonradan silinse bile eski reçete doğru basılsın.
          form: ilac.form || '',
          adet: n, kullanim: kullanim.value.trim(), sure: sure.value.trim(),
          yol: yol.value.trim(), not: not.value.trim(),
        };
      } },
    ],
  });
  if (sonuc === 'sil') return 'sil';
  return sonuc && typeof sonuc === 'object' ? sonuc : null;
}
