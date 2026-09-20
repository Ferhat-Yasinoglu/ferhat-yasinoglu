// Giriş noktası: depoyu aç, menüyü çiz, yönlendiriciyi başlat.
// Sayfa sözleşmesi: export default { baslik, cizim(kok, ctx) → temizleyici|void }
// ctx: { depo, git, bildir, basari, uyar, hata, modal, onayla, sor, param, sorgu, yenileBantlar }
import { yerelDepoAc } from './depo/idb.js';
import { hatirlatmaGerekli, yedekOlustur, indir } from './depo/yedek.js';
import { Yonlendirici } from './cekirdek/yonlendirici.js';
import { el, temizle, btn, girdi, sirala } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { bildir, basari, uyar, hata } from './cekirdek/bildirim.js';
import { modal, onayla, sor } from './cekirdek/modal.js';
import { ilacAra, ilacEtiketi } from './paylasilan/ilac.js';
import { hastaAra, tamAd } from './paylasilan/hasta.js';

export const UYGULAMA_SURUMU = '0.1.0';
globalThis.UYGULAMA_SURUMU = UYGULAMA_SURUMU;

const MENU = [
  { grup: 'Eczane', ogeler: [
    { yol: '/panel', ad: 'Panel', simge: 'panel', alt: true },
    { yol: '/ilaclar', ad: 'İlaçlar', simge: 'ilac', alt: true, sayac: 'ilaclar' },
    { yol: '/hastalar', ad: 'Hastalar', simge: 'hasta', alt: true, sayac: 'hastalar' },
  ] },
  { grup: 'Sistem', ogeler: [
    { yol: '/ayarlar', ad: 'Ayarlar', simge: 'ayarlar', alt: true },
  ] },
];

const ROTALAR = [
  { yol: '/', yukle: () => import('./sayfalar/panel.js') },
  { yol: '/panel', yukle: () => import('./sayfalar/panel.js') },
  { yol: '/ilaclar', yukle: () => import('./sayfalar/ilaclar.js') },
  { yol: '/ilac/:id', yukle: () => import('./sayfalar/ilac.js') },
  { yol: '/hastalar', yukle: () => import('./sayfalar/hastalar.js') },
  { yol: '/hasta/:id', yukle: () => import('./sayfalar/hasta.js') },
  { yol: '/ayarlar', yukle: () => import('./sayfalar/ayarlar.js') },
  { yol: '/404', yukle: () => import('./sayfalar/bulunamadi.js') },
];

const TUM_OGELER = MENU.flatMap((g) => g.ogeler);

async function menuCiz(depo) {
  const kok = document.getElementById('kenar-menu');
  const alt = document.getElementById('alt-cubuk');
  const sayilar = {
    ilaclar: await depo.say('ilaclar'),
    hastalar: await depo.say('hastalar'),
  };
  temizle(kok);
  for (const g of MENU) {
    kok.appendChild(el('div', { class: 'menu__grup' }, g.grup));
    for (const o of g.ogeler) {
      kok.appendChild(el('a', { href: '#' + o.yol, dataset: { yol: o.yol } },
        simge(o.simge), el('span', {}, o.ad),
        o.sayac ? el('span', { class: 'menu__sayi' }, String(sayilar[o.sayac] ?? '')) : null));
    }
  }
  temizle(alt);
  for (const o of TUM_OGELER.filter((x) => x.alt)) {
    alt.appendChild(el('a', { href: '#' + o.yol, dataset: { yol: o.yol } }, simge(o.simge, { boy: 21 }), el('span', {}, o.ad)));
  }
}

function aktifIsaretle(yol) {
  const kok = '/' + (yol.split('/')[1] || '');
  for (const a of document.querySelectorAll('[data-yol]')) {
    const hedef = a.dataset.yol;
    // Detay sayfaları kendi listelerini aktif gösterir: /ilac/x → İlaçlar.
    const aktif = hedef === yol || hedef === kok || (hedef === '/ilaclar' && kok === '/ilac') || (hedef === '/hastalar' && kok === '/hasta');
    if (aktif) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

/** Ctrl+K araması: ilaç ve hastaları birlikte arar. */
async function aramaAc(ctx, ilk = '') {
  const { depo } = ctx;
  const kutu = girdi({ type: 'search', placeholder: 'İlaç, barkod, hasta adı…', value: ilk });
  const sonuc = el('div', { class: 'liste', style: { marginBlockStart: 'var(--b-3)' } });
  const [ilaclar, hastalar] = await Promise.all([depo.listele('ilaclar'), depo.listele('hastalar')]);
  const kapat = () => document.querySelector('.ortu')?.remove();

  function ciz() {
    temizle(sonuc);
    const q = kutu.value.trim();
    if (!q) { sonuc.appendChild(el('div', { class: 'liste__satir sessiz' }, 'Aramak için yazmaya başla.')); return; }
    const bulunan = [
      ...ilacAra(ilaclar, q).slice(0, 6).map((i) => ({ ad: ilacEtiketi(i), alt: `İlaç · stok ${i.stok ?? 0}`, s: 'ilac', yol: `/ilac/${i.id}` })),
      ...hastaAra(hastalar, q).slice(0, 6).map((h) => ({ ad: tamAd(h), alt: `Hasta · ${h.telefon || h.kimlikNo || '—'}`, s: 'hasta', yol: `/hasta/${h.id}` })),
    ];
    if (!bulunan.length) { sonuc.appendChild(el('div', { class: 'liste__satir sessiz' }, 'Sonuç yok.')); return; }
    for (const x of bulunan) {
      sonuc.appendChild(el('a', { class: 'liste__satir', href: '#' + x.yol, onclick: kapat },
        el('span', { class: 'avatar' }, simge(x.s, { boy: 18 })),
        el('div', { class: 'liste__govde' }, el('div', { class: 'liste__baslik' }, x.ad), el('div', { class: 'liste__alt' }, x.alt))));
    }
    sirala(sonuc);
  }
  kutu.oninput = ciz;
  kutu.onkeydown = (e) => { if (e.key === 'Enter') sonuc.querySelector('a')?.click(); };
  ciz();
  modal({ baslik: 'Ara', govde: el('div', {}, kutu, sonuc) });
  setTimeout(() => kutu.focus(), 30);
}

async function bantlariYenile(ctx) {
  const kap = document.getElementById('bantlar');
  temizle(kap);
  if (!ctx.depo.kalici) {
    kap.appendChild(el('div', { class: 'bant bant--hata' }, simge('uyari', { boy: 18 }),
      el('span', {}, 'Tarayıcı depolaması açılamadı: kayıtlar bu sekme kapanınca silinir. Yedek al ve başka bir tarayıcı dene.')));
  }
  const h = hatirlatmaGerekli(await ctx.depo.meta());
  if (h.gerekli) {
    kap.appendChild(el('div', { class: 'bant' }, simge('kaydet', { boy: 18 }),
      el('span', {}, h.sebep === 'hic' ? 'Henüz hiç yedek almadın. Veriler yalnız bu cihazda duruyor.' : `Son yedekten bu yana ${h.sayac} değişiklik var.`),
      btn('Yedek indir', { class: 'btn btn--kucuk', onclick: async () => { indir(await yedekOlustur(ctx.depo)); basari('Yedek indirildi'); bantlariYenile(ctx); } })));
  }
}

function temaDugmesi() {
  const b = btn('', { class: 'btn btn--ikon btn--sade', 'aria-label': 'Temayı değiştir', title: 'Tema' });
  const ciz = () => { temizle(b); b.appendChild(simge(document.documentElement.dataset.tema === 'karanlik' ? 'gunduz' : 'gece')); };
  b.onclick = () => {
    const y = document.documentElement.dataset.tema === 'karanlik' ? 'aydinlik' : 'karanlik';
    document.documentElement.dataset.tema = y;
    try { localStorage.setItem('ecz-tema', y); } catch { /* özel pencerede yazılamaz */ }
    ciz();
  };
  ciz();
  return b;
}

async function baslat() {
  const depo = await yerelDepoAc();
  if (depo.kaliciYap) depo.kaliciYap();

  const ctx = {
    depo, bildir, basari, uyar, hata, modal, onayla, sor, uygulamaSurumu: UYGULAMA_SURUMU,
    git: (yol) => { location.hash = '#' + yol; },
    yenileBantlar: () => bantlariYenile(ctx),
    yenileMenu: () => menuCiz(depo),
  };

  await menuCiz(depo);

  const ustAra = document.getElementById('ust-ara');
  const aramaKutusu = girdi({ type: 'search', placeholder: 'Ara…  (Ctrl+K)', 'aria-label': 'Ara', style: { minHeight: '36px' } });
  aramaKutusu.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); aramaAc(ctx, aramaKutusu.value); aramaKutusu.value = ''; }
  });
  ustAra.appendChild(aramaKutusu);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); aramaAc(ctx, ''); }
  });

  const ustSag = document.getElementById('ust-sag');
  ustSag.appendChild(btn(simge('ara'), { class: 'btn btn--ikon btn--sade ust__ara-btn', 'aria-label': 'Ara', onclick: () => aramaAc(ctx, '') }));
  ustSag.appendChild(temaDugmesi());

  const yonlendirici = new Yonlendirici(ROTALAR, {
    kok: document.getElementById('sayfa'),
    cizimOncesi: ({ yol }) => { aktifIsaretle(yol); bantlariYenile(ctx); },
  });
  yonlendirici.ctx = ctx;
  ctx.git = (yol) => yonlendirici.git(yol);
  // Kayıt değişince kenar menüdeki sayılar tazelenir.
  depo.dinle('*', ({ kol }) => { if (kol === 'ilaclar' || kol === 'hastalar') menuCiz(depo); });

  // replaceState kullanılır: `location.hash = …` bir hashchange kuyruğa alır ve
  // yönlendirici açılışta iki kez çizerdi.
  if (!location.hash) history.replaceState(null, '', '#/panel');
  await yonlendirici.baslat();

  window.addEventListener('unhandledrejection', (e) => {
    console.error(e.reason);
    hata('Beklenmeyen bir hata oldu: ' + (e.reason?.message || e.reason));
  });

  if ('serviceWorker' in navigator && !location.search.includes('nosw') && location.protocol.startsWith('http')) {
    try {
      const kayit = await navigator.serviceWorker.register('./sw.js');
      kayit.addEventListener('updatefound', () => {
        const y = kayit.installing;
        y?.addEventListener('statechange', () => {
          if (y.state === 'installed' && navigator.serviceWorker.controller) {
            bildir('Yeni sürüm hazır.', { sure: 0, eylem: { metin: 'Yenile', cb: () => { y.postMessage('atla'); location.reload(); } } });
          }
        });
      });
    } catch (e) { console.warn('SW kaydedilemedi', e); }
  }
}

baslat().catch((e) => {
  console.error(e);
  document.getElementById('sayfa').textContent = 'Uygulama başlatılamadı: ' + (e?.message || e);
});
