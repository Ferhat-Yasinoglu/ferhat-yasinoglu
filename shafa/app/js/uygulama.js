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
import { eslesir, bicimAyarla, basHarfler } from './paylasilan/metin.js';
import { tarihMetni, bugun } from './paylasilan/tarih.js';
import { t, yukle as dilYukle, uygula as dilUygula, suankiDil } from './i18n.js';
import { kurtar } from './cekirdek/kurtarma.js';

export const UYGULAMA_SURUMU = '0.2.0';
globalThis.UYGULAMA_SURUMU = UYGULAMA_SURUMU;

/* Menü TEK liste: tasarımda grup başlığı yok ve sıra hekimin iş akışını
   izliyor — önce hasta, sonra reçete yazma, sonra kayıtlar ve listeler.
   Etiketler Afganistan'da kullanılan sözcüklerle (مریضان، دواها); tasarımdaki
   İran Farsçası karşılıkları (بیماران، داروها) bilerek alınmadı, hekim
   bugüne kadar bunları gördü. */
const MENU = [
  { yol: '/panel', ad: 'Panel', anahtar: 'nav.panel', simge: 'panel', alt: true },
  { yol: '/hastalar', ad: 'Hastalar', anahtar: 'nav.hastalar', simge: 'hasta', alt: true, sayac: 'hastalar' },
  { yol: '/recete/kagit', ad: 'Reçete yaz', anahtar: 'nav.kagit', simge: 'kalem', alt: true },
  { yol: '/recete/bos', ad: 'Boş kâğıt', anahtar: 'nav.bos_kagit', simge: 'yazdir', alt: false },
  { yol: '/receteler', ad: 'Reçeteler', anahtar: 'nav.receteler', simge: 'recete', alt: true, sayac: 'receteler' },
  { yol: '/ilaclar', ad: 'İlaçlar', anahtar: 'nav.ilaclar', simge: 'ilac', alt: true, sayac: 'ilaclar' },
  { yol: '/tanilar', ad: 'Tanılar', anahtar: 'nav.tanilar', simge: 'not', alt: false },
  { yol: '/laboratuvar', ad: 'Laboratuvar', anahtar: 'nav.laboratuvar', simge: 'tup', alt: false },
  { yol: '/raporlar', ad: 'Raporlar', anahtar: 'nav.raporlar', simge: 'grafik', alt: false },
  { yol: '/ayarlar', ad: 'Ayarlar', anahtar: 'nav.ayarlar', simge: 'ayarlar', alt: false },
];

const ROTALAR = [
  { yol: '/', yukle: () => import('./sayfalar/panel.js') },
  { yol: '/panel', yukle: () => import('./sayfalar/panel.js') },
  { yol: '/ilaclar', yukle: () => import('./sayfalar/ilaclar.js') },
  { yol: '/ilac/:id', yukle: () => import('./sayfalar/ilac.js') },
  { yol: '/hastalar', yukle: () => import('./sayfalar/hastalar.js') },
  { yol: '/hasta/:id', yukle: () => import('./sayfalar/hasta.js') },
  { yol: '/receteler', yukle: () => import('./sayfalar/receteler.js') },
  // Reçete yazmanın tek yolu kâğıt ekranı. /recete/yeni eski formun
  // adresiydi; hekimin yer imi ve eski bağlantılar kırılmasın diye
  // buraya yönleniyor.
  { yol: '/recete/kagit', yukle: () => import('./sayfalar/kagit-yaz.js') },
  { yol: '/recete/yeni', yukle: () => import('./sayfalar/kagit-yaz.js') },
  // /recete/:id'DEN ÖNCE: sonra gelseydi 'bos' bir reçete kimliği sanılırdı.
  { yol: '/recete/bos', yukle: () => import('./sayfalar/bos-kagit.js') },
  { yol: '/recete/:id', yukle: () => import('./sayfalar/recete.js') },
  { yol: '/recete/:id/duzenle', yukle: () => import('./sayfalar/kagit-yaz.js') },
  { yol: '/tanilar', yukle: () => import('./sayfalar/tanilar.js') },
  { yol: '/laboratuvar', yukle: () => import('./sayfalar/laboratuvar.js') },
  { yol: '/raporlar', yukle: () => import('./sayfalar/raporlar.js') },
  { yol: '/ayarlar', yukle: () => import('./sayfalar/ayarlar.js') },
  { yol: '/404', yukle: () => import('./sayfalar/bulunamadi.js') },
];

const TUM_OGELER = MENU;

async function menuCiz(depo) {
  const kenar = document.querySelector('.kenar');
  const alt = document.getElementById('alt-cubuk');
  const ayar = await depo.ayarlar();
  const sayilar = {
    ilaclar: await depo.say('ilaclar'),
    hastalar: await depo.say('hastalar'),
    receteler: await depo.say('receteler'),
  };

  // Kenar çubuğunun TAMAMI burada kuruluyor (marka, menü, slogan, ayak).
  // Önce yalnız menü çiziliyordu; ötekiler index.html'de sabit dursaydı
  // slogan ayarlardan gelemezdi.
  temizle(kenar);
  kenar.appendChild(el('a', { class: 'kenar__marka', href: '#/panel' },
    el('span', { class: 'kenar__marka-simge' }, simge('nabiz-kalp', { boy: 24 })),
    el('span', { class: 'kenar__marka-ad' },
      el('b', {}, 'Shafa'),
      el('span', {}, t('uygulama.alt_latin', 'Medical System')))));

  const nav = el('nav', { class: 'menu', id: 'kenar-menu' });
  for (const o of MENU) {
    // Sayaç yalnız doluysa: boş kurulumda menü "0" yığınına dönüyordu.
    const n = o.sayac ? sayilar[o.sayac] : 0;
    nav.appendChild(el('a', { href: '#' + o.yol, dataset: { yol: o.yol } },
      simge(o.simge), el('span', {}, t(o.anahtar, o.ad)),
      n ? el('span', { class: 'menu__sayi' }, String(n)) : null));
  }
  kenar.appendChild(nav);

  const slogan = String(ayar.slogan ?? t('kagit.slogan', 'سلامتی شما\nهدف ماست'))
    .split('\n').map((x) => x.trim()).filter(Boolean);
  const sloganAlt = ayar.sloganAlt ?? t('kagit.slogan_alt', 'Your Health, Our Priority');
  kenar.appendChild(el('div', { class: 'kenar__slogan' },
    ...slogan.map((x) => el('div', { class: 'kenar__slogan-fa' }, x)),
    sloganAlt ? el('div', { class: 'kenar__slogan-lat', dir: 'ltr' }, sloganAlt) : null));

  kenar.appendChild(el('div', { class: 'kenar__ayak' },
    simge('nabiz-kalp', { boy: 15 }),
    el('span', { dir: 'ltr' }, 'Shafa ', el('b', {}, t('uygulama.alt_latin', 'Medical System'))),
    el('span', { class: 'kenar__surum', dir: 'ltr' }, 'v' + UYGULAMA_SURUMU)));

  temizle(alt);
  for (const o of TUM_OGELER.filter((x) => x.alt)) {
    alt.appendChild(el('a', { href: '#' + o.yol, dataset: { yol: o.yol } },
      simge(o.simge, { boy: 21 }), el('span', {}, t(o.anahtar, o.ad))));
  }
}

/* Üst çubuğun ucundaki hekim bloğu: ad, "hekim hesabı" ve baş harfler.
   Ad ayarlardan geliyor ve BU CİHAZDA duruyor — hiçbir hesap sunucusu yok,
   "hesap" sözcüğü burada yalnız "bu kâğıtları kim imzalıyor" demek. */
async function hesabiCiz(depo) {
  const kap = document.getElementById('ust-hesap');
  if (!kap) return;
  const ayar = await depo.ayarlar();
  const ad = String(ayar.doktorAd || '').trim();
  const unvan = String(ayar.doktorUnvan || '').trim();
  temizle(kap);
  // Antet boşken uydurma bir ad yazmaktansa ayarlara götüren bir çağrı.
  kap.appendChild(el('a', { class: 'ust__hesap-ad', href: '#/ayarlar' },
    el('b', {}, ad || t('ust.antet_bos', 'Antet bilgilerini gir')),
    el('span', {}, ad ? (unvan || t('ust.hekim', 'Hekim hesabı')) : t('ust.antet_bos_alt', 'Ayarlar'))));
  kap.appendChild(el('a', { class: 'avatar avatar--ust', href: '#/ayarlar', 'aria-hidden': 'true', tabindex: '-1' },
    ad ? basHarfler(ad) : simge('hasta', { boy: 18 })));
}

/* Detay sayfaları kendi listelerini aktif gösterir: /ilac/x → İlaçlar. */
const KOK_ESLESME = { '/ilac': '/ilaclar', '/hasta': '/hastalar', '/recete': '/receteler' };

function aktifIsaretle(yol) {
  const kok = '/' + (yol.split('/')[1] || '');
  const ogeler = [...document.querySelectorAll('[data-yol]')];
  // TAM eşleşme varsa üst kalem işaretlenmiyor. Önce öyle değildi ve
  // /recete/kagit'te hem "reçete yaz" hem "reçeteler" vurgulu geliyordu:
  // menüde aynı anda iki aktif kalem duruyordu.
  const tamVar = ogeler.some((a) => a.dataset.yol === yol);
  for (const a of ogeler) {
    const hedef = a.dataset.yol;
    const aktif = hedef === yol
      || (!tamVar && (hedef === kok || hedef === KOK_ESLESME[kok]));
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
        ad: r.receteNo || t('nav.recete', 'Reçete'), alt: t('ara.recete', 'Reçete · {g}', { g: tarihMetni(r.tarih) }), s: 'recete', yol: `/recete/${r.id}`,
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

  // onayla()'nın varsayılanları (başlık, "Evet", "Vazgeç") kodda Türkçe:
  // cekirdek/ saf tutuluyor, sözlüğü oradan çağırmıyoruz. Çeviri burada,
  // ctx kurulurken giydiriliyor — yoksa Farsça arayüzün ortasında Türkçe
  // bir onay kutusu açılıyordu. Çağıran yer yine kendi metnini geçebilir.
  const onaylaCevirili = (mesaj, secenekler = {}) => onayla(mesaj, {
    baslik: t('genel.emin', 'Emin misin?'),
    evet: t('genel.evet', 'Evet'),
    hayir: t('genel.vazgec', 'Vazgeç'),
    ...secenekler,
  });

  const ctx = {
    depo, t, bildir, basari, uyar, hata, modal, sor, onayla: onaylaCevirili, uygulamaSurumu: UYGULAMA_SURUMU,
    git: (yol) => { location.hash = '#' + yol; },
    yenileBantlar: () => bantlariYenile(ctx),
    yenileMenu: () => menuCiz(depo),
  };

  await menuCiz(depo);
  dilUygula(document);

  const ustAra = document.getElementById('ust-ara');
  // Telefonda "(Ctrl+K)" ipucu yer kaplamaktan başka bir işe yaramıyor:
  // klavye yok. Kısayol yalnız fare/klavyeli cihazlarda yazılı — ve artık
  // yazının içinde değil, kutunun ucunda ayrı bir rozette.
  const klavyeli = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const aramaKutusu = girdi({
    type: 'search', placeholder: t('ara.yer', 'Hasta, ilaç, tanı ara…'),
    'aria-label': t('ara.etiket', 'Ara'),
  });
  aramaKutusu.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); aramaAc(ctx, aramaKutusu.value); aramaKutusu.value = ''; }
  });
  // Büyüteç kutunun İÇİNDE: ayrı bir düğme olarak durduğunda arama alanıyla
  // ilgisi görünmüyordu. Tıklanınca da arama açılıyor.
  ustAra.appendChild(el('div', { class: 'ara-kutu' },
    el('span', { class: 'ara-kutu__simge', onclick: () => aramaKutusu.focus() }, simge('ara', { boy: 17 })),
    aramaKutusu,
    klavyeli ? el('kbd', { class: 'ara-kutu__kisayol', dir: 'ltr' }, 'Ctrl K') : null));
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); aramaAc(ctx, ''); }
  });

  const ustSag = document.getElementById('ust-sag');
  // Bugünün tarihi şemsi takvimde. Seçici DEĞİL, yazı: üst çubuktaki bir
  // tarih seçicinin değiştireceği bir şey yok, reçetenin tarihi kendi
  // ekranında duruyor.
  ustSag.appendChild(el('div', { class: 'ust__tarih', title: t('genel.bugun', 'Bugün') },
    simge('takvim', { boy: 16 }),
    el('span', { dir: 'ltr' }, tarihMetni(bugun()))));
  ustSag.appendChild(temaDugmesi());
  ustSag.appendChild(el('div', { class: 'ust__hesap', id: 'ust-hesap' }));
  await hesabiCiz(depo);

  const yonlendirici = new Yonlendirici(ROTALAR, {
    kok: document.getElementById('sayfa'),
    cizimOncesi: ({ yol }) => { aktifIsaretle(yol); bantlariYenile(ctx); },
  });
  yonlendirici.ctx = ctx;
  ctx.git = (yol) => yonlendirici.git(yol);
  depo.dinle('*', ({ kol }) => {
    if (['ilaclar', 'hastalar', 'receteler'].includes(kol)) menuCiz(depo);
    // Antet ayarları değişince hem kenar sloganı hem üstteki ad tazelenir.
    if (kol === 'ayarlar') { menuCiz(depo); hesabiCiz(depo); }
  });

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
      // Denetleyici değişince sayfa bir kez yenilenir: yeni service worker
      // devraldığı anda elimizdeki modüller eskidir, karışık bir grafikle
      // devam etmek çökmeye götürüyor.
      let yenilendi = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (yenilendi) return;
        yenilendi = true;
        location.reload();
      });
      kayit.addEventListener('updatefound', () => {
        const y = kayit.installing;
        y?.addEventListener('statechange', () => {
          if (y.state === 'installed' && navigator.serviceWorker.controller) {
            // Yenileme kullanıcının elinde: yarım kalmış bir reçetenin
            // üstüne sayfa yenilemek veri kaybettirir.
            bildir(t('sw.yeni', 'Yeni sürüm hazır.'), { sure: 0, eylem: { metin: t('genel.yenile', 'Yenile'), cb: () => y.postMessage('atla') } });
          }
        });
      });
    } catch (e) { console.warn('SW kaydedilemedi', e); }
  }
}

baslat().catch(async (e) => {
  console.error(e);
  if (await kurtar()) return;
  document.getElementById('sayfa').textContent = 'Uygulama başlatılamadı: ' + (e?.message || e);
});
