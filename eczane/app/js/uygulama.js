// Giriş noktası: depoyu aç, dili yükle, menüyü çiz, yönlendiriciyi başlat.
// Sayfa sözleşmesi: export default { baslik, cizim(kok, ctx) → temizleyici|void }
// ctx: { depo, t, git, bildir, basari, uyar, hata, modal, onayla, sor, param, sorgu, … }
import { yerelDepoAc } from './depo/idb.js';
import { hatirlatmaGerekli, yedekOlustur, indir } from './depo/yedek.js';
import { Yonlendirici } from './cekirdek/yonlendirici.js';
import { el, temizle, btn, girdi, sirala } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { bildir, basari, uyar, hata } from './cekirdek/bildirim.js';
import { modal, onayla, sor } from './cekirdek/modal.js';
import { ilacAra, ilacEtiketi } from './paylasilan/ilac.js';
import { hastaAra, tamAd } from './paylasilan/hasta.js';
import { eslesir, bicimAyarla } from './paylasilan/metin.js';
import { trTarih } from './paylasilan/tarih.js';
import { t, yukle as dilYukle, uygula as dilUygula, suankiDil } from './i18n.js';

export const UYGULAMA_SURUMU = '0.2.0';
globalThis.UYGULAMA_SURUMU = UYGULAMA_SURUMU;

const MENU = [
  { grup: 'Eczane', anahtar: 'nav.grup.eczane', ogeler: [
    { yol: '/panel', ad: 'Panel', anahtar: 'nav.panel', simge: 'panel', alt: true },
    { yol: '/ilaclar', ad: 'İlaçlar', anahtar: 'nav.ilaclar', simge: 'ilac', alt: true, sayac: 'ilaclar' },
    { yol: '/hastalar', ad: 'Hastalar', anahtar: 'nav.hastalar', simge: 'hasta', alt: true, sayac: 'hastalar' },
    { yol: '/receteler', ad: 'Reçeteler', anahtar: 'nav.receteler', simge: 'recete', alt: true, sayac: 'receteler' },
  ] },
  { grup: 'Sistem', anahtar: 'nav.grup.sistem', ogeler: [
    { yol: '/ayarlar', ad: 'Ayarlar', anahtar: 'nav.ayarlar', simge: 'ayarlar', alt: true },
  ] },
];

const ROTALAR = [
  { yol: '/', yukle: () => import('./sayfalar/panel.js') },
  { yol: '/panel', yukle: () => import('./sayfalar/panel.js') },
  { yol: '/ilaclar', yukle: () => import('./sayfalar/ilaclar.js') },
  { yol: '/ilac/:id', yukle: () => import('./sayfalar/ilac.js') },
  { yol: '/hastalar', yukle: () => import('./sayfalar/hastalar.js') },
  { yol: '/hasta/:id', yukle: () => import('./sayfalar/hasta.js') },
  { yol: '/receteler', yukle: () => import('./sayfalar/receteler.js') },
  { yol: '/recete/yeni', yukle: () => import('./sayfalar/recete-yeni.js') },
  { yol: '/recete/:id', yukle: () => import('./sayfalar/recete.js') },
  { yol: '/recete/:id/duzenle', yukle: () => import('./sayfalar/recete-yeni.js') },
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
    receteler: await depo.say('receteler'),
  };
  temizle(kok);
  for (const g of MENU) {
    kok.appendChild(el('div', { class: 'menu__grup' }, t(g.anahtar, g.grup)));
    for (const o of g.ogeler) {
      kok.appendChild(el('a', { href: '#' + o.yol, dataset: { yol: o.yol } },
        simge(o.simge), el('span', {}, t(o.anahtar, o.ad)),
        o.sayac ? el('span', { class: 'menu__sayi' }, String(sayilar[o.sayac] ?? '')) : null));
    }
  }
  temizle(alt);
  for (const o of TUM_OGELER.filter((x) => x.alt)) {
    alt.appendChild(el('a', { href: '#' + o.yol, dataset: { yol: o.yol } },
      simge(o.simge, { boy: 21 }), el('span', {}, t(o.anahtar, o.ad))));
  }
}

function aktifIsaretle(yol) {
  const kok = '/' + (yol.split('/')[1] || '');
  for (const a of document.querySelectorAll('[data-yol]')) {
    const hedef = a.dataset.yol;
    // Detay sayfaları kendi listelerini aktif gösterir: /ilac/x → İlaçlar.
    const aktif = hedef === yol || hedef === kok
      || (hedef === '/ilaclar' && kok === '/ilac')
      || (hedef === '/hastalar' && kok === '/hasta')
      || (hedef === '/receteler' && kok === '/recete');
    if (aktif) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

/** Ctrl+K araması: ilaç, hasta ve reçeteleri birlikte arar. */
async function aramaAc(ctx, ilk = '') {
  const { depo } = ctx;
  const kutu = girdi({ type: 'search', placeholder: t('ara.yer_uzun', 'İlaç, barkod, hasta adı…'), value: ilk });
  const sonuc = el('div', { class: 'liste', style: { marginBlockStart: 'var(--b-3)' } });
  const [ilaclar, hastalar, receteler] = await Promise.all([
    depo.listele('ilaclar'), depo.listele('hastalar'), depo.listele('receteler'),
  ]);
  const kapat = () => document.querySelector('.ortu')?.remove();

  function ciz() {
    temizle(sonuc);
    const q = kutu.value.trim();
    if (!q) { sonuc.appendChild(el('div', { class: 'liste__satir sessiz' }, t('ara.basla', 'Aramak için yazmaya başla.'))); return; }
    const bulunan = [
      ...ilacAra(ilaclar, q).slice(0, 6).map((i) => ({
        ad: ilacEtiketi(i), alt: t('ara.ilac', 'İlaç · {e}', { e: i.etkenMadde || '—' }), s: 'ilac', yol: `/ilac/${i.id}`,
      })),
      ...hastaAra(hastalar, q).slice(0, 6).map((h) => ({
        ad: tamAd(h), alt: t('ara.hasta', 'Hasta · {b}', { b: h.telefon || h.kimlikNo || '—' }), s: 'hasta', yol: `/hasta/${h.id}`,
      })),
      ...receteler.filter((r) => eslesir(`${r.receteNo || ''} ${r.tani || ''}`, q)).slice(0, 4).map((r) => ({
        ad: r.receteNo || t('nav.recete', 'Reçete'), alt: t('ara.recete', 'Reçete · {g}', { g: trTarih(r.tarih) }), s: 'recete', yol: `/recete/${r.id}`,
      })),
    ];
    if (!bulunan.length) { sonuc.appendChild(el('div', { class: 'liste__satir sessiz' }, t('ara.yok', 'Sonuç yok.'))); return; }
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
  modal({ baslik: t('ara.etiket', 'Ara'), govde: el('div', {}, kutu, sonuc) });
  setTimeout(() => kutu.focus(), 30);
}

async function bantlariYenile(ctx) {
  const kap = document.getElementById('bantlar');
  temizle(kap);
  if (!ctx.depo.kalici) {
    kap.appendChild(el('div', { class: 'bant bant--hata' }, simge('uyari', { boy: 18 }),
      el('span', {}, t('bant.kalici_degil', 'Tarayıcı depolaması açılamadı: kayıtlar bu sekme kapanınca silinir. Yedek al ve başka bir tarayıcı dene.'))));
  }
  const h = hatirlatmaGerekli(await ctx.depo.meta());
  if (h.gerekli) {
    kap.appendChild(el('div', { class: 'bant' }, simge('kaydet', { boy: 18 }),
      el('span', {}, h.sebep === 'hic'
        ? t('bant.yedek_hic', 'Henüz hiç yedek almadın. Veriler yalnız bu cihazda duruyor.')
        : t('bant.yedek_eski', 'Son yedekten bu yana {n} değişiklik var.', { n: h.sayac })),
      btn(t('yedek.indir', 'Yedek indir'), { class: 'btn btn--kucuk', onclick: async () => {
        indir(await yedekOlustur(ctx.depo));
        basari(t('yedek.indirildi', 'Yedek indirildi'));
        bantlariYenile(ctx);
      } })));
  }
}

function temaDugmesi() {
  const b = btn('', { class: 'btn btn--ikon btn--sade ust__tema', 'aria-label': t('ayar.tema_degistir', 'Temayı değiştir'), title: t('ayar.tema', 'Tema') });
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

  const ayar = await depo.ayarlar();
  await dilYukle();
  bicimAyarla({ dil: suankiDil(), kur: ayar.paraBirimi || 'AFN' });

  const ctx = {
    depo, t, bildir, basari, uyar, hata, modal, onayla, sor, uygulamaSurumu: UYGULAMA_SURUMU,
    git: (yol) => { location.hash = '#' + yol; },
    yenileBantlar: () => bantlariYenile(ctx),
    yenileMenu: () => menuCiz(depo),
  };

  await menuCiz(depo);
  dilUygula(document);

  const ustAra = document.getElementById('ust-ara');
  // Telefonda "(Ctrl+K)" ipucu yer kaplamaktan başka bir işe yaramıyor:
  // klavye yok. Kısayol yalnız fare/klavyeli cihazlarda yazılı.
  const klavyeli = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const araYer = klavyeli ? t('ara.yer', 'Ara…  (Ctrl+K)') : t('ara.yer_kisa', 'Ara…');
  const aramaKutusu = girdi({ type: 'search', placeholder: araYer, 'aria-label': t('ara.etiket', 'Ara'), style: { minHeight: '36px' } });
  aramaKutusu.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); aramaAc(ctx, aramaKutusu.value); aramaKutusu.value = ''; }
  });
  ustAra.appendChild(aramaKutusu);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); aramaAc(ctx, ''); }
  });

  const ustSag = document.getElementById('ust-sag');
  ustSag.appendChild(btn(simge('ara'), { class: 'btn btn--ikon btn--sade ust__ara-btn', 'aria-label': t('ara.etiket', 'Ara'), onclick: () => aramaAc(ctx, '') }));
  ustSag.appendChild(temaDugmesi());

  const yonlendirici = new Yonlendirici(ROTALAR, {
    kok: document.getElementById('sayfa'),
    cizimOncesi: ({ yol }) => { aktifIsaretle(yol); bantlariYenile(ctx); },
  });
  yonlendirici.ctx = ctx;
  ctx.git = (yol) => yonlendirici.git(yol);
  depo.dinle('*', ({ kol }) => { if (['ilaclar', 'hastalar', 'receteler'].includes(kol)) menuCiz(depo); });

  // replaceState kullanılır: `location.hash = …` bir hashchange kuyruğa alır ve
  // yönlendirici açılışta iki kez çizerdi.
  if (!location.hash) history.replaceState(null, '', '#/panel');
  await yonlendirici.baslat();

  window.addEventListener('unhandledrejection', (e) => {
    console.error(e.reason);
    hata(t('hata.beklenmeyen', 'Beklenmeyen bir hata oldu: {m}', { m: e.reason?.message || e.reason }));
  });

  if ('serviceWorker' in navigator && !location.search.includes('nosw') && location.protocol.startsWith('http')) {
    try {
      const kayit = await navigator.serviceWorker.register('./sw.js');
      kayit.addEventListener('updatefound', () => {
        const y = kayit.installing;
        y?.addEventListener('statechange', () => {
          if (y.state === 'installed' && navigator.serviceWorker.controller) {
            bildir(t('sw.yeni', 'Yeni sürüm hazır.'), { sure: 0, eylem: { metin: t('genel.yenile', 'Yenile'), cb: () => { y.postMessage('atla'); location.reload(); } } });
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
