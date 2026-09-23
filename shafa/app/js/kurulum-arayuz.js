// Ayarlar'daki "Bu cihaza kur" kartı.
//
// Üç ayrı durum var ve üçü de farklı şey göstermeli:
//   • zaten kurulu        → onay, düğme yok
//   • tarayıcı kurabiliyor → gerçek düğme (Android/Chrome, masaüstü)
//   • iOS Safari          → düğme YOK, tarif var (Apple kurulumu yalnız
//                           "Paylaş → Ana Ekrana Ekle" ile yaptırıyor)
// Hiçbirini bilmiyorsak tarayıcı menüsünü tarif ediyoruz; boş kart göstermek
// ya da çalışmayan bir düğme koymak hekimi uğraştırır.
import { el, temizle, btnS, kart, rozet } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { kur, kurulabilirMi, kuruluMu, elleKurulur, dinle } from './cekirdek/kurulum.js';
import { t } from './i18n.js';

export function kurulumKarti(ctx, yenile) {
  const { basari, uyar } = ctx;
  const govde = () => {
    if (kuruluMu()) {
      return el('p', { class: 'kart__alt' },
        t('kurulum.kurulu_alt', 'Uygulama bu cihaza kurulu ve internetsiz de açılıyor.'));
    }
    if (kurulabilirMi()) {
      return el('div', {},
        el('p', { class: 'kart__alt' }, t('kurulum.alt', 'Mağazaya gerek yok: uygulama tarayıcıdan kurulur, ana ekrana bir simge olarak iner ve internetsiz de açılır.')),
        el('div', { class: 'satir', style: { marginBlockStart: 'var(--b-3)' } },
          btnS('indir', t('kurulum.kur', 'Bu cihaza kur'), { class: 'btn btn--birincil', onclick: async () => {
            const sonuc = await kur();
            if (sonuc === 'kuruldu') basari(t('kurulum.kuruldu', 'Kuruldu. Uygulamayı artık ana ekrandan açabilirsin.'));
            else if (sonuc === 'vazgecildi') uyar(t('kurulum.vazgecildi', 'Kurulumdan vazgeçildi.'));
            yenile();
          } })));
    }
    if (elleKurulur()) {
      return el('div', {},
        el('p', { class: 'kart__alt' }, t('kurulum.alt', 'Mağazaya gerek yok: uygulama tarayıcıdan kurulur, ana ekrana bir simge olarak iner ve internetsiz de açılır.')),
        el('div', { class: 'uyari uyari--bilgi', style: { marginBlockStart: 'var(--b-3)' } },
          simge('bilgi', { boy: 16 }),
          el('span', {}, t('kurulum.ios', 'iPhone ve iPad\'de: alttaki «Paylaş» düğmesine bas, açılan listeden «Ana Ekrana Ekle»yi seç.'))));
    }
    return el('div', {},
      el('p', { class: 'kart__alt' }, t('kurulum.alt', 'Mağazaya gerek yok: uygulama tarayıcıdan kurulur, ana ekrana bir simge olarak iner ve internetsiz de açılır.')),
      el('div', { class: 'uyari uyari--bilgi', style: { marginBlockStart: 'var(--b-3)' } },
        simge('bilgi', { boy: 16 }),
        el('span', {}, t('kurulum.menu', 'Tarayıcının menüsünü aç ve «Uygulamayı kur» ya da «Ana ekrana ekle» seçeneğini kullan.'))));
  };

  /* Tarayıcı "kurulabilir" bilgisini sayfa çizildikten SONRA veriyor. Kart bir
     kez çizilip bıraksaydı, hekim Ayarlar'ı erken açtığında düğme hiç
     görünmezdi. Kart kendini tazeliyor; DOM'dan düşünce aboneliği bırakıyor,
     yoksa her çizimde bir dinleyici birikirdi. */
  const kap = kart({});
  function ciz() {
    temizle(kap);
    kap.append(
      el('div', { class: 'kart__bas' },
        el('h2', {}, t('kurulum.baslik', 'Bu cihaza kur')),
        kuruluMu() ? rozet(t('kurulum.kurulu', 'kurulu'), 'yesil') : null),
      govde());
  }
  ciz();
  const birak = dinle(() => {
    if (!kap.isConnected) { birak(); return; }
    ciz();
  });
  return kap;
}
