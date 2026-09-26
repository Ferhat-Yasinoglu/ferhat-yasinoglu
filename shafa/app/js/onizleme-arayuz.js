// Kâğıt önizleme paneli: reçete yazma sayfasındaki sağ panelin başlığı
// (tasarımdaki «پیش نمایش نسخه» satırı), kaç yaprak basılacağını söyleyen
// rozet ve «ذخیره PDF» akışı. Reçete kaydı sayfası ve boş kâğıt sayfası da
// aynı paneli kullanıyor: hekim kâğıdı her yerde aynı çerçevede görüyor ve
// yazdır / PDF düğmeleri her yerde aynı yerde duruyor.
import { el, btn } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { bildir } from './cekirdek/bildirim.js';
import { t } from './i18n.js';
import { kagidiYazdir } from './kagit.js';

/**
 * Başlık satırı ve tuvalden oluşan panel.
 * `eylemler`: [{ simge, metin, odakAdi, onclick, ikon }] — sağdan sola
 * sırayla dizilir; `ikon: true` yazısız kare düğme (metin aria-label olur).
 * `id`: başlığın kimliği (panel onunla adlandırılıyor).
 * `sinif`: panele eklenecek sınıf (reçete sayfasında yapışkan `recete-onizleme`).
 */
export function onizlemePaneli({ baslik, eylemler = [], tuval, id, sinif = '' }) {
  const dugmeler = eylemler.map((e) => btn(simge(e.simge, { boy: 16, dolu: e.simge === 'yazdir' }), {
    class: 'btn recete-onizleme__dugme' + (e.ikon ? ' recete-onizleme__ikon' : ''),
    'data-odak-adi': e.odakAdi, onclick: e.onclick,
    ...(e.ikon ? { 'aria-label': e.metin, title: e.metin } : {}),
  }, e.ikon ? null : e.metin));
  // Yaprak rozeti: kâğıt birden çok yaprağa bölününce görünüyor. Yapraklar
  // tuvalin içinde alt alta; rozet olmadan hekim ikinci yaprağın varlığını
  // ancak kaydırınca fark ediyordu.
  const rozet = el('span', { class: 'recete-onizleme__sayfa', hidden: true });
  return el('section', { class: ('recete-panel recete-panel--onizleme ' + sinif).trim(), 'aria-labelledby': id },
    el('div', { class: 'recete-onizleme__bas' },
      el('div', { class: 'recete-onizleme__eylem' }, ...dugmeler),
      rozet,
      el('h2', { class: 'recete-onizleme__baslik', id },
        el('span', {}, baslik), simge('yeni-recete', { boy: 30, dolu: true }))),
    tuval);
}

/** Kâğıdın yaprak sayısı (lacivert kâğıt 25 ilacın üstünde bölünüyor). */
export const yaprakSayisi = (kagit) => Math.max(1, kagit?.querySelectorAll('[data-rol="sayfa"]').length || 0);

/** «{n} صفحه» metni: rozette ve büyük önizlemenin başlığında aynı. */
export const yaprakMetni = (n) => t('recete.onizleme_sayfa', '{n} sayfa', { n });

/** Panelin rozetini yeni çizilen kâğıda göre tazeler. */
export function yaprakRozeti(panel, kagit) {
  const rozet = panel?.querySelector('.recete-onizleme__sayfa');
  if (!rozet) return;
  const n = yaprakSayisi(kagit);
  rozet.hidden = n < 2;
  rozet.textContent = n < 2 ? '' : yaprakMetni(n);
}

// Oturumda bir kez: her PDF'te aynı ipucu hekimi yorardı.
let pdfIpucuGosterildi = false;

/**
 * «ذخیره PDF»: tarayıcının yazdırma penceresi açılıyor, hedef olarak
 * «Save as PDF» seçilecek. Ek kütüphane yok (derleme adımı ve bağımlılık
 * yok); tarayıcı hedefi kendisi seçtiremiyor, o yüzden ipucu veriliyor ve
 * belge başlığı dosya adına çevriliyor (bkz. kagidiYazdir).
 */
export async function pdfKaydet(secenekler) {
  if (!pdfIpucuGosterildi) {
    pdfIpucuGosterildi = true;
    bildir(t('recete.pdf_ipucu', 'Yazdırma penceresinde hedef olarak «PDF olarak kaydet»i seçin.'));
  }
  await kagidiYazdir({ ...secenekler, pdf: true });
}
