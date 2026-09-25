// Arayüz dili: فارسی. Uygulamayı kullanan doktor Farsça okuyor, o yüzden tek dil
// yeterli — çoklu dil kaldırıldı ama altyapı duruyor: yeni bir dil eklemek
// DILLER'e bir satır ve i18n/<kod>.json dosyası eklemekten ibaret.
//
// Metinler kodda t(anahtar, 'Türkçe karşılık') biçiminde yazılır. Türkçe metin
// çeviri değil yedektir: sözlükte anahtar bulunamazsa ekran boş kalmasın diye
// durur. `npm run kontrol` her anahtarın sözlükte karşılığı olduğunu denetler.
export const DILLER = [['fa', 'فارسی']];
const SAGDAN_SOLA = ['fa'];
const VARSAYILAN = 'fa';

let sozluk = {};
let dil = VARSAYILAN;

export async function yukle(istenen = VARSAYILAN) {
  dil = DILLER.some(([k]) => k === istenen) ? istenen : VARSAYILAN;
  sozluk = {};
  try {
    const yanit = await fetch(`./i18n/${dil}.json`);
    if (yanit.ok) sozluk = await yanit.json();
    else console.warn('sözlük bulunamadı:', dil);
  } catch (e) {
    console.warn('sözlük yüklenemedi', e);
  }
  document.documentElement.lang = dil;
  document.documentElement.dir = SAGDAN_SOLA.includes(dil) ? 'rtl' : 'ltr';
  return dil;
}

/** t('nav.ilaclar', 'İlaçlar') · t('hasta.yas', '{n} yaş', { n: 3 }) */
export function t(anahtar, varsayilan = '', degiskenler = null) {
  let metin = sozluk[anahtar] ?? varsayilan ?? anahtar;
  if (degiskenler) {
    for (const [k, v] of Object.entries(degiskenler)) metin = metin.split(`{${k}}`).join(String(v));
  }
  return metin;
}

export const suankiDil = () => dil;
export const sagdanSola = () => SAGDAN_SOLA.includes(dil);

/** HTML'deki data-i18n metinlerini ve data-i18n-label adlarını (aria-label)
 *  çevirir. Özgün metin ilk çağrıda saklanır. Adlar eskiden hiç çevrilmiyordu:
 *  kontrol anahtarın sözlükte olduğuna bakıyordu ama onu uygulayan kod yoktu,
 *  ekran okuyucu kenar çubuğuna «Menü» diyordu. */
export function uygula(kok = document) {
  for (const e of kok.querySelectorAll('[data-i18n]')) {
    if (!e.dataset.i18nAsil) e.dataset.i18nAsil = e.textContent;
    e.textContent = t(e.dataset.i18n, e.dataset.i18nAsil);
  }
  for (const e of kok.querySelectorAll('[data-i18n-label]')) {
    if (!e.dataset.i18nAsilAd) e.dataset.i18nAsilAd = e.getAttribute('aria-label') || '';
    e.setAttribute('aria-label', t(e.dataset.i18nLabel, e.dataset.i18nAsilAd));
  }
}

/** Saf modüllerdeki seçenek listelerini çevirir: FORMLAR → [['tablet','قرص'], …] */
export const secenekleriCevir = (liste, onek) => liste.map(([k, ad]) => [k, t(`${onek}.${k}`, ad)]);

/** Tek bir seçeneğin çevrilmiş adı. */
export const secenekAdi = (liste, anahtar, onek) => {
  const bulunan = liste.find(([k]) => k === anahtar);
  return bulunan ? t(`${onek}.${anahtar}`, bulunan[1]) : anahtar;
};
