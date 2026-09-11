// Giriş noktası: depoyu aç, tohumla, dili yükle, menüyü çiz, yönlendiriciyi başlat.
// Sayfa sözleşmesi: export default { baslik, cizim(root, ctx) → temizleyici|void }
// ctx: { depo, t, git, bildir, basari, hata, modal, onayla, sor, ayarlar, mod, param, sorgu, yenileBantlar }
import { yerelDepoAc } from './depo/idb.js';
import { tohumla } from './depo/tohum.js';
import { hatirlatmaGerekli } from './depo/yedek.js';
import { Yonlendirici } from './cekirdek/yonlendirici.js';
import { el, temizle, btn } from './cekirdek/dom.js';
import { bildir, basari, hata } from './cekirdek/bildirim.js';
import { modal, onayla, sor } from './cekirdek/modal.js';
import { t, yukle as dilYukle, uygula as i18nUygula, DILLER, suankiDil } from './i18n.js';

export const UYGULAMA_SURUMU = '__SURUM__';
globalThis.UYGULAMA_SURUMU = UYGULAMA_SURUMU;

const MENU = [
  { grup: 'Otomasyon', ogeler: [
    { yol: '/ozet', ad: 'Özet', anahtar: 'nav.ozet', simge: '🏠', alt: true },
    { yol: '/akislar', ad: 'Akışlar', anahtar: 'nav.akislar', simge: '⚡', alt: true },
    { yol: '/sohbetler', ad: 'Sohbetler', anahtar: 'nav.sohbetler', simge: '💬', alt: true },
    { yol: '/toplu', ad: 'Toplu Mesaj', anahtar: 'nav.toplu', simge: '📣' },
    { yol: '/buyume', ad: 'Büyüme Araçları', anahtar: 'nav.buyume', simge: '🌱' },
    { yol: '/ajan', ad: 'AI Ajan', anahtar: 'nav.ajan', simge: '✨' },
  ] },
  { grup: 'Kişiler', ogeler: [
    { yol: '/kisiler', ad: 'Kişiler & Puanlar', anahtar: 'nav.kisiler', simge: '👥', alt: true },
    { yol: '/analitik', ad: 'Analitik', anahtar: 'nav.analitik', simge: '📈' },
  ] },
  { grup: 'İçerik', ogeler: [
    { yol: '/fikirler', ad: 'Fikirler & Senaryo', anahtar: 'nav.fikirler', simge: '💡' },
    { yol: '/kancalar', ad: 'Kanca Kütüphanesi', anahtar: 'nav.kancalar', simge: '🪝' },
    { yol: '/karusel', ad: 'Karusel', anahtar: 'nav.karusel', simge: '🎠' },
    { yol: '/video', ad: 'Video Analizi', anahtar: 'nav.video', simge: '🎬' },
    { yol: '/galeri', ad: 'Galeri', anahtar: 'nav.galeri', simge: '🖼️' },
  ] },
  { grup: 'Sistem', ogeler: [
    { yol: '/ayarlar', ad: 'Ayarlar & Kurulum', anahtar: 'nav.ayarlar', simge: '⚙️' },
  ] },
];

const ROTALAR = [
  { yol: '/', yukle: () => import('./sayfalar/ozet.js') },
  { yol: '/baslangic', yukle: () => import('./sayfalar/baslangic.js') },
  { yol: '/ozet', yukle: () => import('./sayfalar/ozet.js') },
  { yol: '/akislar', yukle: () => import('./sayfalar/akislar.js') },
  { yol: '/akislar/yeni', yukle: () => import('./sayfalar/akis-yeni.js') },
  { yol: '/akis/:id', yukle: () => import('./sayfalar/akis.js') },
  { yol: '/akis/:id/:sekme', yukle: () => import('./sayfalar/akis.js') },
  { yol: '/sohbetler', yukle: () => import('./sayfalar/sohbetler.js') },
  { yol: '/sohbet/:id', yukle: () => import('./sayfalar/sohbetler.js') },
  { yol: '/kisiler', yukle: () => import('./sayfalar/kisiler.js') },
  { yol: '/kisiler/:sekme', yukle: () => import('./sayfalar/kisiler.js') },
  { yol: '/kisi/:id', yukle: () => import('./sayfalar/kisi.js') },
  { yol: '/toplu', yukle: () => import('./sayfalar/toplu.js') },
  { yol: '/toplu/:id', yukle: () => import('./sayfalar/toplu.js') },
  { yol: '/buyume', yukle: () => import('./sayfalar/buyume.js') },
  { yol: '/buyume/:sekme', yukle: () => import('./sayfalar/buyume.js') },
  { yol: '/ajan', yukle: () => import('./sayfalar/ajan.js') },
  { yol: '/fikirler', yukle: () => import('./sayfalar/fikirler.js') },
  { yol: '/kancalar', yukle: () => import('./sayfalar/kancalar.js') },
  { yol: '/karusel', yukle: () => import('./sayfalar/karusel.js') },
  { yol: '/karusel/:id', yukle: () => import('./sayfalar/karusel.js') },
  { yol: '/galeri', yukle: () => import('./sayfalar/galeri.js') },
  { yol: '/video', yukle: () => import('./sayfalar/video.js') },
  { yol: '/video/:id', yukle: () => import('./sayfalar/video.js') },
  { yol: '/analitik', yukle: () => import('./sayfalar/analitik.js') },
  { yol: '/ayarlar', yukle: () => import('./sayfalar/ayarlar.js') },
  { yol: '/ayarlar/:sekme', yukle: () => import('./sayfalar/ayarlar.js') },
  { yol: '/ayarlar/kurulum/:kanal', yukle: () => import('./sayfalar/kurulum.js') },
  { yol: '/404', yukle: () => import('./sayfalar/bulunamadi.js') },
];

function menuCiz(kok, alt) {
  temizle(kok);
  for (const g of MENU) {
    kok.appendChild(el('div', { class: 'menu__grup' }, g.grup));
    for (const o of g.ogeler) kok.appendChild(el('a', { href: '#' + o.yol, dataset: { yol: o.yol } }, el('span', { class: 'ikon', 'aria-hidden': 'true' }, o.simge), t(o.anahtar, o.ad)));
  }
  temizle(alt);
  for (const o of MENU.flatMap((g) => g.ogeler).filter((o) => o.alt)) alt.appendChild(el('a', { href: '#' + o.yol, dataset: { yol: o.yol } }, el('span', { class: 'ikon' }, o.simge), t(o.anahtar, o.ad)));
  alt.appendChild(btn('', { class: 'alt__daha', onclick: dahaAc }, el('span', { class: 'ikon' }, '☰'), t('nav.daha', 'Daha')));
}

function dahaAc() {
  const izgara = el('div', { class: 'daha-sayfa' });
  for (const o of MENU.flatMap((g) => g.ogeler).filter((o) => !o.alt)) izgara.appendChild(el('a', { href: '#' + o.yol, onclick: () => document.querySelector('.ortu')?.remove() }, el('span', { class: 'ikon' }, o.simge), t(o.anahtar, o.ad)));
  modal({ baslik: t('nav.daha', 'Daha'), govde: izgara });
}

function aktifIsaretle(yol) {
  for (const a of document.querySelectorAll('[data-yol]')) {
    const hedef = a.dataset.yol;
    const aktif = yol === hedef || (hedef !== '/ozet' && yol.startsWith(hedef.replace(/lar$|ler$/, '')) && yol.split('/')[1] === hedef.split('/')[1]);
    if (aktif) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

async function bantlariYenile(ctx) {
  const kap = document.getElementById('bantlar');
  temizle(kap);
  const ayar = await ctx.depo.ayarlar();
  const meta = await ctx.depo.meta();
  if (!ctx.depo.kalici) kap.appendChild(el('div', { class: 'bant bant--kirmizi' }, '⚠️ ', t('bant.kalici_degil', 'Tarayıcı depolaması açılamadı: veriler bu sekme kapanınca silinir. Yedek indir.')));
  if ((ayar.mod || 'yerel') === 'yerel') kap.appendChild(el('div', { class: 'bant bant--mavi' }, '🔵 ', t('bant.yerel', 'Yerel mod: veriler yalnız bu cihazda. Kanalları ve AI\'ı açmak için Worker\'ı bağla.'), btn(t('bant.worker_bagla', 'Worker\'ı bağla'), { class: 'btn btn--kucuk', onclick: () => ctx.git('/ayarlar/worker') })));
  if (!navigator.onLine) kap.appendChild(el('div', { class: 'bant bant--gri' }, '📴 ', t('bant.cevrimdisi', 'Çevrimdışısın; değişiklikler bu cihazda kaydediliyor.')));
  const h = hatirlatmaGerekli(meta, ayar);
  if (h.gerekli) kap.appendChild(el('div', { class: 'bant bant--sari' }, '💾 ', t('bant.yedek', 'Yedek eski: {sebep}.', { sebep: h.sebep }), btn(t('bant.yedek_indir', 'Yedeği indir'), { class: 'btn btn--kucuk', onclick: async () => { const { indir } = await import('./depo/yedek.js'); await indir(await ctx.depo.disaAktar()); basari(t('yedek.indirildi', 'Yedek indirildi')); bantlariYenile(ctx); } })));
}

async function baslat() {
  const depo = await yerelDepoAc();
  if (depo.kaliciYap) depo.kaliciYap();
  const ayar = await depo.ayarlar();
  await dilYukle(ayar.dil || localStorage.getItem('ss-lang') || 'tr');
  if (!ayar.ilk_kurulum_tamam && (await depo.meta()).tohumlandi !== 1) await tohumla(depo);

  const ctx = { depo, t, bildir, basari, hata, modal, onayla, sor, uygulamaSurumu: UYGULAMA_SURUMU,
    git: (yol) => { location.hash = '#' + yol; },
    ayarlar: () => depo.ayarlar(),
    mod: async () => (await depo.ayar('mod')) || 'yerel',
    yenileBantlar: () => bantlariYenile(ctx),
    // Dil değişince menü ve statik metinler hemen çevrilir; sayfa varsayılan olarak yeniden
    // çizilir. Durumu olan sayfalar (ör. Başlangıç sihirbazı) yenidenCiz:false ile kendi çizer.
    dilDegistir: async (d, { yenidenCiz = true } = {}) => { await depo.ayarKaydet('dil', d); await dilYukle(d); menuCiz(document.getElementById('kenar-menu'), document.getElementById('alt-cubuk')); i18nUygula(document); if (yenidenCiz) yonlendirici.calistir(); },
  };

  menuCiz(document.getElementById('kenar-menu'), document.getElementById('alt-cubuk'));
  i18nUygula(document);

  const ustSag = document.getElementById('ust-sag');
  ustSag.appendChild(el('select', { class: 'input', 'aria-label': 'Dil', style: { width: 'auto', minHeight: '34px' }, onchange: (e) => ctx.dilDegistir(e.target.value) }, ...DILLER.map(([k, ad]) => el('option', { value: k, selected: k === suankiDil() }, ad))));
  ustSag.appendChild(btn('◐', { class: 'btn btn--ikon btn--sade', 'aria-label': 'Tema', title: 'Açık/koyu tema', onclick: () => { const y = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = y; try { localStorage.setItem('ss-tema', y); } catch {} } }));

  const yonlendirici = new Yonlendirici(ROTALAR, { kok: document.getElementById('sayfa'), cizimOncesi: ({ yol }) => { aktifIsaretle(yol); bantlariYenile(ctx); } });
  yonlendirici.ctx = ctx;
  ctx.git = (yol) => yonlendirici.git(yol);
  if (!ayar.ilk_kurulum_tamam && (location.hash === '' || location.hash === '#/' || location.hash === '#/ozet')) location.hash = '#/baslangic';
  await yonlendirici.baslat();

  window.addEventListener('online', () => bantlariYenile(ctx));
  window.addEventListener('offline', () => bantlariYenile(ctx));
  window.addEventListener('error', (e) => { console.error(e.error || e.message); });
  window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); hata(t('hata.beklenmeyen', 'Beklenmeyen bir hata oldu: {m}', { m: e.reason?.message || e.reason })); });

  if ('serviceWorker' in navigator && !location.search.includes('nosw') && location.protocol !== 'file:') {
    try {
      const kayit = await navigator.serviceWorker.register('./sw.js');
      kayit.addEventListener('updatefound', () => { const y = kayit.installing; y?.addEventListener('statechange', () => { if (y.state === 'installed' && navigator.serviceWorker.controller) bildir(t('sw.yeni', 'Yeni sürüm hazır.'), { sure: 0, eylem: { metin: t('sw.yenile', 'Yenile'), cb: () => { y.postMessage('atla'); location.reload(); } } }); }); });
    } catch (e) { console.warn('SW kaydedilemedi', e); }
  }
}

baslat().catch((e) => { console.error(e); const s = document.getElementById('sayfa'); s.textContent = 'Uygulama başlatılamadı: ' + (e?.message || e); });
