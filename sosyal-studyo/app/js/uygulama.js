// Giriş noktası: depoyu aç, tohumla, dili yükle, menüyü çiz, yönlendiriciyi başlat.
// Sayfa sözleşmesi: export default { baslik, cizim(root, ctx) → temizleyici|void }
// ctx: { depo, t, git, bildir, basari, hata, modal, onayla, sor, ayarlar, mod, param, sorgu, yenileBantlar }
import { yerelDepoAc } from './depo/idb.js';
import { tohumla } from './depo/tohum.js';
import { hatirlatmaGerekli, hatirlatmaMetni } from './depo/yedek.js';
import { Yonlendirici } from './cekirdek/yonlendirici.js';
import { el, temizle, btn, sirala } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { bildir, basari, hata } from './cekirdek/bildirim.js';
import { modal, onayla, sor } from './cekirdek/modal.js';
import { t, yukle as dilYukle, uygula as i18nUygula, DILLER, suankiDil } from './i18n.js';

export const UYGULAMA_SURUMU = '__SURUM__';
globalThis.UYGULAMA_SURUMU = UYGULAMA_SURUMU;

const MENU = [
  { grup: 'Otomasyon', anahtar: 'otomasyon', ogeler: [
    { yol: '/ozet', ad: 'Özet', anahtar: 'nav.ozet', simge: 'ozet', alt: true },
    { yol: '/akislar', ad: 'Akışlar', anahtar: 'nav.akislar', simge: 'akis', alt: true },
    { yol: '/sohbetler', ad: 'Sohbetler', anahtar: 'nav.sohbetler', simge: 'sohbet', alt: true },
    { yol: '/toplu', ad: 'Toplu Mesaj', anahtar: 'nav.toplu', kisa: 'nav.toplu_kisa', kisaAd: 'Toplu', simge: 'toplu' },
    { yol: '/buyume', ad: 'Büyüme Araçları', anahtar: 'nav.buyume', kisa: 'nav.buyume_kisa', kisaAd: 'Büyüme', simge: 'buyume' },
    { yol: '/ajan', ad: 'AI Ajan', anahtar: 'nav.ajan', simge: 'ajan' },
  ] },
  { grup: 'Kişiler', anahtar: 'kisiler', ogeler: [
    { yol: '/kisiler', ad: 'Kişiler & Puanlar', anahtar: 'nav.kisiler', kisa: 'nav.kisiler_kisa', kisaAd: 'Kişiler', simge: 'kisiler', alt: true },
    { yol: '/analitik', ad: 'Analitik', anahtar: 'nav.analitik', simge: 'analitik' },
  ] },
  { grup: 'İçerik', anahtar: 'icerik', ogeler: [
    { yol: '/fikirler', ad: 'Fikirler & Senaryo', anahtar: 'nav.fikirler', kisa: 'nav.fikirler_kisa', kisaAd: 'Fikirler', simge: 'fikir' },
    { yol: '/kancalar', ad: 'Kanca Kütüphanesi', anahtar: 'nav.kancalar', kisa: 'nav.kancalar_kisa', kisaAd: 'Kancalar', simge: 'kanca' },
    { yol: '/karusel', ad: 'Karusel', anahtar: 'nav.karusel', simge: 'karusel' },
    { yol: '/video', ad: 'Video Analizi', anahtar: 'nav.video', simge: 'video' },
    { yol: '/galeri', ad: 'Galeri', anahtar: 'nav.galeri', simge: 'galeri' },
  ] },
  { grup: 'Sistem', anahtar: 'sistem', ogeler: [
    { yol: '/ayarlar', ad: 'Ayarlar & Kurulum', anahtar: 'nav.ayarlar', kisa: 'nav.ayarlar_kisa', kisaAd: 'Ayarlar', simge: 'ayarlar' },
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
    kok.appendChild(el('div', { class: 'menu__grup' }, t('menu.grup.' + g.anahtar, g.grup)));
    for (const o of g.ogeler) kok.appendChild(el('a', { href: '#' + o.yol, dataset: { yol: o.yol } }, simge(o.simge), t(o.anahtar, o.ad)));
  }
  temizle(alt);
  for (const o of MENU.flatMap((g) => g.ogeler).filter((o) => o.alt)) alt.appendChild(el('a', { href: '#' + o.yol, dataset: { yol: o.yol } }, simge(o.simge, { boy: 22 }), el('span', { class: 'alt__etiket' }, o.kisa ? t(o.kisa, o.kisaAd) : t(o.anahtar, o.ad))));
  alt.appendChild(btn('', { class: 'alt__daha', onclick: dahaAc }, simge('menu', { boy: 22 }), el('span', { class: 'alt__etiket' }, t('nav.daha', 'Daha'))));
}

async function aramaAc(ctx, ilk) {
  const { depo, t } = ctx;
  const kutu = el('input', { class: 'input', type: 'search', placeholder: t('ara.yer_uzun', 'Sayfa, kişi ya da akış ara…'), value: ilk || '' });
  const sonuc = el('div', { class: 'liste', style: { marginBlockStart: '12px' } });
  const kapat = () => document.querySelector('.ortu')?.remove();
  const [kisiler, akislar] = await Promise.all([depo.listele('kisiler'), depo.listele('akislar')]);
  const sayfalar = MENU.flatMap((g) => g.ogeler).map((o) => ({ tur: 'sayfa', ad: t(o.anahtar, o.ad), simge: o.simge, yol: o.yol }));
  const hepsi = [...sayfalar, ...akislar.map((a) => ({ tur: 'akis', ad: a.ad, simge: 'akis', yol: `/akis/${a.id}`, alt: a.durum === 'yayinda' ? t('akis.yayinda', 'Yayında') : t('akis.taslak', 'Taslak') })), ...kisiler.map((k) => ({ tur: 'kisi', ad: k.ad, simge: 'kisiler', yol: `/kisi/${k.id}`, alt: [k.kanal, k.kullanici_adi ? '@' + k.kullanici_adi : ''].filter(Boolean).join(' · ') }))];
  function ciz() {
    temizle(sonuc);
    const q = kutu.value.trim().toLowerCase();
    const bulunan = (q ? hepsi.filter((x) => `${x.ad} ${x.alt || ''}`.toLowerCase().includes(q)) : sayfalar).slice(0, 12);
    if (!bulunan.length) { sonuc.appendChild(el('div', { class: 'liste__satir' }, el('div', { class: 'liste__alt' }, t('ara.yok', 'Sonuç yok')))); return; }
    for (const x of bulunan) sonuc.appendChild(el('a', { class: 'liste__satir', href: '#' + x.yol, onclick: kapat }, el('span', { class: 'avatar avatar--kucuk avatar--sade' }, simge(x.simge, { boy: 16 })), el('div', { class: 'liste__govde' }, el('div', { class: 'liste__baslik' }, x.ad), x.alt ? el('div', { class: 'liste__alt' }, x.alt) : null)));
    sirala(sonuc, 'sirali-hizli');
  }
  kutu.oninput = ciz;
  kutu.onkeydown = (e) => { if (e.key === 'Enter') { const a = sonuc.querySelector('a'); if (a) { a.click(); } } };
  ciz();
  modal({ baslik: t('ara.etiket', 'Ara'), govde: el('div', {}, kutu, sonuc) });
  setTimeout(() => kutu.focus(), 30);
}

function dahaAc() {
  const izgara = el('div', { class: 'daha-sayfa' });
  for (const o of MENU.flatMap((g) => g.ogeler).filter((o) => !o.alt)) izgara.appendChild(el('a', { href: '#' + o.yol, onclick: () => document.querySelector('.ortu')?.remove() }, simge(o.simge, { boy: 22 }), t(o.anahtar, o.ad)));
  sirala(izgara, 'sirali-hizli');
  modal({ baslik: t('nav.daha', 'Daha'), govde: izgara });
}

function aktifIsaretle(yol) {
  for (const a of document.querySelectorAll('[data-yol]')) {
    const hedef = a.dataset.yol;
    const aktif = yol === hedef || (hedef !== '/ozet' && yol.startsWith(hedef.replace(/lar$|ler$/, '')) && yol.split('/')[1] === hedef.split('/')[1]);
    if (aktif) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

let bantSira = 0;
async function bantlariYenile(ctx) {
  const kap = document.getElementById('bantlar');
  const benimSira = ++bantSira;
  const parcalar = [];
  const ayar = await ctx.depo.ayarlar();
  const meta = await ctx.depo.meta();
  if (!ctx.depo.kalici) parcalar.push(el('div', { class: 'bant bant--kirmizi' }, simge('uyari', { boy: 18 }), t('bant.kalici_degil', 'Tarayıcı depolaması açılamadı: veriler bu sekme kapanınca silinir. Yedek indir.')));
  // Yerel mod bandı bir kez kapatılabilir (oturum boyunca); her sayfada bağırmasın.
  let yerelKapali = false; try { yerelKapali = sessionStorage.getItem('ss-yerel-bant') === '1'; } catch {}
  if ((ayar.mod || 'yerel') === 'yerel' && !yerelKapali) parcalar.push(el('div', { class: 'bant bant--mavi' }, simge('bilgi', { boy: 18 }), t('bant.yerel', 'Yerel mod: veriler yalnız bu cihazda. Kanalları ve AI\'ı açmak için Worker\'ı bağla.'), btn(t('bant.worker_bagla', 'Worker\'ı bağla'), { class: 'btn btn--kucuk', onclick: () => ctx.git('/ayarlar/worker') }), el('button', { class: 'bant__kapat', type: 'button', 'aria-label': t('genel.kapat', 'Kapat'), onclick: (e) => { try { sessionStorage.setItem('ss-yerel-bant', '1'); } catch {} e.currentTarget.closest('.bant').remove(); } }, simge('kapat', { boy: 16 }))));
  const kuyruk = ctx.depo.gidenSayisi ? await ctx.depo.gidenSayisi() : 0;
  if (!navigator.onLine || kuyruk) parcalar.push(el('div', { class: 'bant bant--gri' }, simge(navigator.onLine ? 'yukle' : 'anten', { boy: 18 }), navigator.onLine ? t('bant.kuyruk', 'Worker\'a gönderilmeyi bekleyen {n} değişiklik.', { n: kuyruk }) : t('bant.cevrimdisi', 'Çevrimdışısın; değişiklikler bu cihazda kaydediliyor.'), kuyruk && navigator.onLine ? btn(t('bant.simdi_gonder', 'Şimdi gönder'), { class: 'btn btn--kucuk', onclick: () => ctx.depo.gidenKutusunuBosalt().then(() => bantlariYenile(ctx)) }) : null));
  if (ctx.depo.mod === 'bagli' && ctx.depo.cevrimici === false) parcalar.push(el('div', { class: 'bant bant--kirmizi' }, simge('uyari', { boy: 18 }), t('bant.worker_yok', 'Worker\'a ulaşılamıyor; önbellekten gösteriliyor.')));
  const h = hatirlatmaGerekli(meta, ayar);
  if (h.gerekli) parcalar.push(el('div', { class: 'bant bant--sari' }, simge('kaydet', { boy: 18 }), t('bant.yedek', 'Yedek eski: {sebep}.', { sebep: hatirlatmaMetni(h, t) }), btn(t('bant.yedek_indir', 'Yedeği indir'), { class: 'btn btn--kucuk', onclick: async () => { const { indir } = await import('./depo/yedek.js'); await indir(await ctx.depo.disaAktar()); basari(t('yedek.indirildi', 'Yedek indirildi')); bantlariYenile(ctx); } })));
  if (benimSira !== bantSira) return; // daha yeni bir çizim başladı
  temizle(kap); for (const p of parcalar) kap.appendChild(p);
}

async function depoyuAc() {
  // Bağlı mod: ayarlar yerel IndexedDB'de; Worker adresi varsa UzakDepo aynı veritabanını açar.
  const yerel = await yerelDepoAc();
  const a = await yerel.ayarlar();
  if (a.mod === 'bagli' && a.worker?.adres && yerel.db) {
    yerel.db.close();
    try { const { UzakDepo } = await import('./depo/uzak.js'); return await new UzakDepo(a.worker.adres).ac(); }
    catch (e) { console.warn('bağlı mod açılamadı, yerel moda düşüldü', e); return yerelDepoAc(); }
  }
  return yerel;
}

async function baslat() {
  const depo = await depoyuAc();
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

  // Üst çubuk: masaüstünde arama, sağda tema ve dil. Arama menü ögelerini ve kişileri bulur.
  const ustAra = document.getElementById('ust-ara');
  const aramaKutusu = el('input', { class: 'input', type: 'search', placeholder: t('ara.yer', 'Ara… (Ctrl+K)'), 'aria-label': t('ara.etiket', 'Ara'), style: { minHeight: '38px' } });
  ustAra.appendChild(aramaKutusu);
  aramaKutusu.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); aramaAc(ctx, aramaKutusu.value); aramaKutusu.value = ''; } });
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); aramaAc(ctx, ''); } });

  const ustSag = document.getElementById('ust-sag');
  ustSag.appendChild(btn(simge('ara'), { class: 'btn btn--ikon btn--sade ust__ara-btn', 'aria-label': t('ara.etiket', 'Ara'), onclick: () => aramaAc(ctx, '') }));
  const temaBtn = btn('', { class: 'btn btn--ikon btn--sade', 'aria-label': 'Tema', title: t('ayar.tema', 'Tema'), onclick: () => { const y = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = y; try { localStorage.setItem('ss-tema', y); } catch {} temaIkon(); } });
  const temaIkon = () => { temizle(temaBtn); temaBtn.appendChild(simge(document.documentElement.dataset.theme === 'light' ? 'gece' : 'gunduz')); };
  temaIkon();
  ustSag.appendChild(temaBtn);
  ustSag.appendChild(el('select', { class: 'input', 'aria-label': 'Dil', style: { width: 'auto', minHeight: '38px', paddingInlineEnd: '28px' }, onchange: (e) => ctx.dilDegistir(e.target.value) }, ...DILLER.map(([k, ad]) => el('option', { value: k, selected: k === suankiDil() }, ad))));

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
