// Arayüz dili: Türkçe (kaynak) ve Dari (sağdan sola). Seçim tarayıcıda saklanır.
// t('anahtar', { ad: '…' }) → '{ad}' yer tutucuları doldurulur. Bulunamazsa
// `yedek`, o da yoksa anahtarın kendisi döner (eksik çeviri ekranda görünsün).
// Gönderi İÇERİĞİNİN dili ayrı bir şeydir (tr/de/en/fa): tasarla ekranında seçilir.
import { SOZLUK } from './sozluk.js';

const ANAHTAR = 'fyr.dil';
const DILLER = ['tr', 'fa'];

function ilkDil() {
  try {
    const s = localStorage.getItem(ANAHTAR);
    if (DILLER.includes(s)) return s;
  } catch { /* depolama kapalı */ }
  return /^(fa|ps|prs)\b/i.test(navigator.language || '') ? 'fa' : 'tr';
}

let secili = ilkDil();

export const dil = () => secili;
export const rtl = () => secili === 'fa';

export function t(anahtar, degerler = {}, yedek) {
  const ham = SOZLUK[secili][anahtar] ?? SOZLUK.tr[anahtar] ?? yedek ?? anahtar;
  return ham.replace(/\{(\w+)\}/g, (_, a) => (degerler[a] ?? ''));
}

/** <html lang/dir>: Dari'de bütün sayfa sağdan sola akar. */
export function dilUygula() {
  document.documentElement.lang = secili === 'fa' ? 'fa-AF' : 'tr';
  document.documentElement.dir = secili === 'fa' ? 'rtl' : 'ltr';
}

export function dilSec(d) {
  if (!DILLER.includes(d) || d === secili) return;
  secili = d;
  try { localStorage.setItem(ANAHTAR, d); } catch { /* yalnız bu oturum */ }
  dilUygula();
  window.dispatchEvent(new Event('fyr:dil'));
}
