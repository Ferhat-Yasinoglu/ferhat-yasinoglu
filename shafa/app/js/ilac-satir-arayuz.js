// İlaç satırı kutusu: reçetenin en kalabalık parçası.
//
// sayfalar/ dışında duruyor çünkü orası default export bekliyor. Önce
// recete-yeni.js'in içindeydi; kâğıt üzerinde yazma ekranı gelince oraya da
// lazım oldu ve kopyalamak yerine buraya alındı. Alerji uyarısı burada:
// ikinci bir kopyada unutulması güvenlik sorunu olurdu.
import { el, temizle, btn, girdi, alan } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { KULLANIM_ONERILERI, SURE_ONERILERI, YOLLAR, bosSatir, sonKullanim } from './paylasilan/recete.js';
import { secenekListesi } from './paylasilan/klinik.js';
import { FORMLAR, formAdi, ilacAra, ilacEtiketi } from './paylasilan/ilac.js';
import { alerjiCakismasi } from './paylasilan/hasta.js';
import { cip } from './klinik-arayuz.js';
import { enterleOnayla } from './cekirdek/modal.js';
import { t, secenekAdi } from './i18n.js';
import { uyariMetni, hataMetni } from './hatalar.js';

/** Ekranda gösterilen ilaç adı: şekil adı sözlükten ("Parol 500 mg تابلیت").
 *  Reçete satırına giden ilacAdi yine ilacEtiketi(): kâğıt o Türkçe şekil
 *  adını tanıyıp düşürüyor (ilacAdiFormsuz). */
export const ilacGorunenAd = (ilac) => ilacEtiketi(ilac, (k) => (formAdi(k) ? secenekAdi(FORMLAR, k, 'form') : ''));

/** Sözlükteki eski kısa öneri listesi (kullanim.0…, sure.0…, yol.0…): klinik
 *  belge okunamadıysa satır kutusunun yedek çipleri. */
const eskiListe = (liste, onek) => liste.map((k, i) => t(`${onek}.${i}`, k));

/**
 * İlaç satırı kutusu: ilaç ara/seç, adet, güç, kullanım, zaman, süre, yol.
 * @param {object} [sec]
 * @param {object} [sec.ilac]  önceden seçili ilaç (formdaki aramadan gelen):
 *   ad kutusu dolu açılıyor, alerji uyarısı hemen çıkıyor, odak adette.
 * @param {(q: string) => object[]} [sec.ara]  arama; sayfa hekimin ilaçlarını
 *   ve hazır listeyi birlikte arıyor (paylasilan/ilac-listesi.js ilacSuz).
 * @param {(ilac: object) => Promise<object>} [sec.kayda]  hazır listeden
 *   seçilen satırı onayda depoya yazıp kimlikli kaydı döndürür. Vazgeçilirse
 *   hiçbir şey yazılmıyor.
 * @param {object} [sec.klinik]  klinik belge: kullanım/zaman/süre/yol çipleri
 *   onun `secenekler`inden (ilaca bağlı olmayan genel ifadeler).
 * @param {Map} [sec.hafiza]  paylasilan/recete.js sonKullanimlar() çıktısı.
 */
export async function satirKutusu(ctx, ilaclar, hasta, mevcut = null, sik = [], {
  ilac: onceSecilen = null, ara = (q) => ilacAra(ilaclar, q), kayda = async (x) => x, klinik = null, hafiza = null,
} = {}) {
  const { modal } = ctx;
  let ilac = onceSecilen || (mevcut?.ilacId ? ilaclar.find((x) => x.id === mevcut.ilacId) : null);

  const kutu = girdi({ type: 'search', name: 'ilacArama', placeholder: t('recete.ilac_ara', 'İlaç adı, barkod, etken madde…'), value: ilac ? ilacGorunenAd(ilac) : '' });
  const sonuclar = el('div', { class: 'liste', style: { maxBlockSize: '220px', overflowY: 'auto' } });
  const secilenKutusu = el('div', {});
  const adet = girdi({ type: 'number', name: 'adet', min: 1, step: 1, value: mevcut?.adet ?? 1 });
  // Güç (doz) satıra seçildiği andaki hâliyle yazılıyor: tablo ve kâğıt
  // «20 mg (Cap)» basıyor, ilaç kaydı sonradan değişse de reçete değişmesin.
  const doz = girdi({ name: 'doz', dir: 'ltr', value: mevcut?.doz ?? ilac?.doz ?? '', placeholder: t('recete.doz_yer', '500 mg') });
  const kullanim = girdi({ name: 'kullanim', value: mevcut?.kullanim ?? '', list: 'kullanim-onerileri', placeholder: t('recete.kullanim_yer', 'Günde 2×1') });
  const zaman = girdi({ name: 'zaman', value: mevcut?.zaman ?? '', placeholder: t('recete.zaman_yer', 'Yemekten sonra') });
  const sure = girdi({ name: 'sure', value: mevcut?.sure ?? '', placeholder: t('recete.sure_yer', '10 gün') });
  const yol = girdi({ name: 'yol', value: mevcut?.yol ?? '', placeholder: t('recete.yol_yer', 'Ağızdan') });
  const not = girdi({ name: 'satirNotu', value: mevcut?.not ?? '', placeholder: t('recete.not_yer', 'Tok karnına…') });
  // Çipler klinik belgenin genel ifadelerinden (veri/klinik.json
  // `secenekler`); belge okunamadıysa sözlükteki eski kısa liste.
  const secenek = (tur, eski, onek) => (klinik?.secenekler?.[tur]?.length
    ? secenekListesi(klinik, tur, ilac?.form) : eski ? eskiListe(eski, onek) : []);
  const kullanimlar = secenek('tariqa', KULLANIM_ONERILERI, 'kullanim');
  const oneriler = el('datalist', { id: 'kullanim-onerileri' }, ...kullanimlar.map((k) => el('option', { value: k })));

  /* Hekimin bu ilaca en son yazdığı kullanım (kendi reçetelerinden): tek
     dokunuşla dört alanı dolduran bir çip. Kendiliğinden doldurulmuyor —
     her hasta ayrı karar; öneri yalnız teklif. Düzenlemede yok: alanlar zaten
     satırın kendi değerleriyle dolu. */
  function hafizaCipi() {
    const son = !mevcut && hafiza && ilac ? sonKullanim(hafiza, ilac) : null;
    if (!son) return null;
    const metin = [son.kullanim, son.zaman, son.sure, son.yol].filter(Boolean).join(' · ');
    return el('button', {
      type: 'button', class: 'cip cip--secilir cip--hafiza', 'data-odak-adi': 'son-kullanim',
      title: t('recete.son_kullanim_ipucu', 'Bu ilaca son yazdığın kullanım; dokununca alanlara yazılır.'),
      onclick: () => {
        for (const [g, v] of [[kullanim, son.kullanim], [zaman, son.zaman], [sure, son.sure], [yol, son.yol]]) {
          g.value = v;
          g.dispatchEvent(new Event('input'));
        }
      },
    }, simge('saat', { boy: 14 }), el('span', { dir: 'auto' }, t('recete.son_kullanim', 'Son kez: {metin}', { metin })));
  }

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
      hafizaCipi() || [],
      ...uyarilar.map((u) => el('div', { class: `uyari uyari--${u.tur}`, style: { marginBlockStart: 'var(--b-2)' } }, simge(u.tur === 'hata' ? 'hata' : 'uyari', { boy: 16 }), el('span', {}, u.metin))));
  }

  const ilacSatiri = (i) => el('button', {
    class: 'liste__satir liste__satir--tiklanir', type: 'button',
    style: { border: 'none', background: 'none', textAlign: 'start', font: 'inherit', cursor: 'pointer', inlineSize: '100%' },
    onclick: () => sec(i),
  },
    el('div', { class: 'liste__govde' },
      el('div', { class: 'liste__baslik' }, ilacGorunenAd(i)),
      el('div', { class: 'liste__alt' }, i.etkenMadde || '—')));

  /** İlacı seçer; güç kutusu yeni ilacın gücüyle doluyor. */
  function sec(i) {
    ilac = i;
    kutu.value = ilacGorunenAd(i);
    doz.value = i.doz || '';
    aramaCiz(); secileniCiz();
  }

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
    const bulunan = ara(q).slice(0, 12);
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
    const bulunan = ara(q);
    const tam = bulunan.filter((i) => ilacGorunenAd(i).toLowerCase() === q.toLowerCase());
    const tek = bulunan.length === 1 ? bulunan : tam;
    if (tek.length !== 1) return;
    sec(tek[0]);
    adet.focus(); adet.select();
  });
  for (const g of [adet, doz, zaman, sure, yol, not]) enterleOnayla(g);
  // Açılışta da çiziyoruz: liste yalnız yazınca doluyordu, yani hekim
  // gezinmek için önce klavyeye gitmek zorundaydı.
  aramaCiz();
  secileniCiz();

  const acik = modal({
    baslik: mevcut ? t('recete.satir_duzenle', 'Satırı düzenle') : t('recete.ilac_ekle', 'İlaç ekle'),
    genis: true,
    govde: el('div', {}, oneriler,
      alan(t('nav.ilac', 'İlaç'), kutu, { gerekli: true, ipucu: t('recete.ilac_ipucu', 'Stoktan seç; listede yoksa önce İlaçlar\'a ekle.') }),
      sonuclar, secilenKutusu,
      el('div', { class: 'izgara izgara--form', style: { marginBlockStart: 'var(--b-3)' } },
        alan(t('recete.adet', 'Adet (kutu)'), adet, { gerekli: true }),
        alan(t('recete.doz', 'Güç'), doz)),
      alan(t('recete.kullanim', 'Kullanım'), kullanim),
      oneriCipleri(kullanim, kullanimlar),
      alan(t('recete.zaman', 'Yemekle'), zaman),
      oneriCipleri(zaman, secenek('zaman')),
      alan(t('recete.sure', 'Süre'), sure),
      oneriCipleri(sure, secenek('sure', SURE_ONERILERI, 'sure')),
      alan(t('recete.yol', 'Veriliş yolu'), yol),
      oneriCipleri(yol, secenek('yol', YOLLAR, 'yol')),
      alan(t('genel.not', 'Not'), not)),
    dugmeler: [
      // Düzenlerken silme de buradan: kâğıttaki satırı çıkarmanın bir yolu
      // da bu (formdaki tabloda ayrıca çöp kutusu var).
      ...(mevcut ? [{ metin: t('genel.sil', 'Sil'), deger: 'sil' }] : []),
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: mevcut ? t('genel.kaydet', 'Kaydet') : t('genel.ekle', 'Ekle'), sinif: 'btn--birincil', cb: async () => {
        const n = Math.floor(Number(adet.value));
        if (!ilac) { kutu.classList.add('input--hata'); kutu.focus(); return false; }
        if (!(n > 0)) { adet.classList.add('input--hata'); adet.focus(); return false; }
        // Hazır listeden seçilen satır ancak ŞİMDİ kayda dönüşüyor: kimliği
        // olsun ki alerji, çift etken ve «son kullanım» onu tanısın.
        if (ilac.katalog) {
          try { ilac = await kayda(ilac); } catch (e) { ctx.hata?.(hataMetni(e)); return false; }
        }
        const guc = doz.value.trim();
        return {
          ...bosSatir(), ...(mevcut || {}),
          // Ad güçle birlikte yazılıyor: hekim gücü değiştirdiyse kâğıttaki ad da.
          ilacId: ilac.id, ilacAdi: ilacEtiketi({ ...ilac, doz: guc }), etkenMadde: ilac.etkenMadde || '',
          // Şekli de saklıyoruz: kâğıt "Cap:" önekini bundan basıyor ve
          // ilaç sonradan silinse bile eski reçete doğru basılsın.
          form: ilac.form || '', doz: guc,
          adet: n, kullanim: kullanim.value.trim(), zaman: zaman.value.trim(), sure: sure.value.trim(),
          yol: yol.value.trim(), not: not.value.trim(),
        };
      } },
    ],
  });
  // Formdaki aramadan gelindiyse ilaç zaten seçili: hekim doğrudan adedi yazsın.
  if (onceSecilen) { adet.focus(); adet.select(); }
  const sonuc = await acik;
  if (sonuc === 'sil') return 'sil';
  return sonuc && typeof sonuc === 'object' ? sonuc : null;
}
