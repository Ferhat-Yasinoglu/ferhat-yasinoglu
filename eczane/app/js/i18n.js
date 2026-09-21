// Diller: Türkçe (kodun içindeki varsayılan), Dari/Farsça ve İngilizce.
// Sözlükte anahtar yoksa koddaki Türkçe metin kullanılır — çeviri eksik kalsa
// bile arayüz hiçbir zaman boş görünmez.
// Farsça sağdan sola yazılır; CSS baştan beri yalnız mantıksal yön özellikleri
// kullandığı için düzen kendiliğinden döner.
export const DILLER = [['tr', 'Türkçe'], ['fa', 'دری'], ['en', 'English']];
const SAGDAN_SOLA = ['fa'];

let sozluk = {};
let dil = 'tr';

export function kayitliDil() {
  try { return localStorage.getItem('ecz-dil') || 'tr'; } catch { return 'tr'; }
}

export async function yukle(istenen) {
  dil = DILLER.some(([k]) => k === istenen) ? istenen : 'tr';
  sozluk = {};
  if (dil !== 'tr') {
    try {
      const yanit = await fetch(`./i18n/${dil}.json`);
      if (yanit.ok) sozluk = await yanit.json();
    } catch (e) {
      console.warn('sözlük yüklenemedi, Türkçeye düşüldü', e);
    }
  }
  try { localStorage.setItem('ecz-dil', dil); } catch { /* özel pencerede yazılamaz */ }
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

/** HTML'deki data-i18n metinlerini çevirir. Özgün metin ilk çağrıda saklanır. */
export function uygula(kok = document) {
  for (const e of kok.querySelectorAll('[data-i18n]')) {
    if (!e.dataset.i18nAsil) e.dataset.i18nAsil = e.textContent;
    e.textContent = t(e.dataset.i18n, e.dataset.i18nAsil);
  }
}

/** Saf modüllerdeki seçenek listelerini çevirir: FORMLAR → [['tablet','قرص'], …]
 *  Liste ['anahtar', 'Türkçe ad'] çiftlerinden oluşur; sözlük anahtarı `onek.anahtar`. */
export const secenekleriCevir = (liste, onek) => liste.map(([k, ad]) => [k, t(`${onek}.${k}`, ad)]);

/** Tek bir seçeneğin çevrilmiş adı. */
export const secenekAdi = (liste, anahtar, onek) => {
  const bulunan = liste.find(([k]) => k === anahtar);
  return bulunan ? t(`${onek}.${anahtar}`, bulunan[1]) : anahtar;
};
