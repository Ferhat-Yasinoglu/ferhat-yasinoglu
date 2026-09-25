// Giriş noktası: depoyu aç, dili yükle, menüyü çiz, yönlendiriciyi başlat.
// Sayfa sözleşmesi: export default { baslik, cizim(kok, ctx) → temizleyici|void }
// ctx: { depo, t, git, bildir, basari, uyar, hata, modal, onayla, sor, param, sorgu, … }
import { yerelDepoAc } from './depo/idb.js';
import { hatirlatmaGerekli, yedekOlustur, indir } from './depo/yedek.js';
import { hazirListeyiTazele } from './depo/hazir-ilaclar.js';
import { eskiSenkronAyarlariniSil } from './depo/senkron.js';
import { HesapServisi } from './senkron/hesap-servisi.js';
import { senkronOzeti } from './hesap-arayuz.js';
import { kur, kurulabilirMi, kuruluMu, elleKurulur, dinle as kurulumuDinle } from './cekirdek/kurulum.js';
import { Yonlendirici } from './cekirdek/yonlendirici.js';
import { el, temizle, btn, girdi, sirala } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { bildir, basari, uyar, hata } from './cekirdek/bildirim.js';
import { modal, onayla, sor } from './cekirdek/modal.js';
import { ilacAra } from './paylasilan/ilac.js';
import { ilacGorunenAd } from './ilac-satir-arayuz.js';
import { hastaAra, tamAd } from './paylasilan/hasta.js';
import { eslesir, bicimAyarla, basHarfler } from './paylasilan/metin.js';
import { tarihMetni, bugun } from './paylasilan/tarih.js';
import { t, yukle as dilYukle, uygula as dilUygula, suankiDil } from './i18n.js';
import { kurtar } from './cekirdek/kurtarma.js';

export const UYGULAMA_SURUMU = '1.0.0';
globalThis.UYGULAMA_SURUMU = UYGULAMA_SURUMU;

/* Menü TEK liste: tasarımda grup başlığı yok ve sıra hekimin iş akışını
   izliyor — önce hasta, sonra reçete yazma, sonra kayıtlar ve listeler.
   Etiketler Afganistan'da kullanılan sözcüklerle (مریضان، دواها); tasarımdaki
   İran Farsçası karşılıkları (بیماران، داروها) bilerek alınmadı, hekim
   bugüne kadar bunları gördü. */
/* Sıra hekimlerin söylediği sıra: önce reçete, sonra hasta, sonra dava.
   `alt: true` olanlar telefondaki alt çubuğa çıkıyor — dördü, fazlası
   parmağın altında kalabalık ediyor. Geri kalanı kenar çubuğunda; telefonda
   o çubuk üst köşedeki ☰ ile çekmece gibi açılıyor.

   «Reçeteler» dördüncü kutuda BİLEREK: hekim yazdığı reçeteyi en çok oradan
   arıyor (eczane telefon edince, hasta geri gelince). Menüye gömülmesi
   günlük işi yavaşlatırdı.

   `simge` telefondaki alt çubuğun çizgi simgesi, `dolu` kenar çubuğunun
   dolgulu simgesi (tasarımda koyu kolonda dolgulu şekiller var; alt çubuk
   bugünkü görünümünde kalıyor). */
const MENU = [
  { yol: '/recete/kagit', ad: 'Reçete yaz', anahtar: 'nav.kagit', simge: 'kalem', dolu: 'recete', alt: true },
  { yol: '/hastalar', ad: 'Hastalar', anahtar: 'nav.hastalar', simge: 'hasta', dolu: 'hastalar', alt: true, sayac: 'hastalar' },
  { yol: '/ilaclar', ad: 'İlaçlar', anahtar: 'nav.ilaclar', simge: 'ilac', dolu: 'ilac', alt: true, sayac: 'ilaclar' },
  { yol: '/receteler', ad: 'Reçeteler', anahtar: 'nav.receteler', simge: 'recete', dolu: 'liste', alt: true, sayac: 'receteler' },
  { yol: '/panel', ad: 'Panel', anahtar: 'nav.panel', simge: 'panel', dolu: 'panel', alt: false },
  { yol: '/recete/bos', ad: 'Boş kâğıt', anahtar: 'nav.bos_kagit', simge: 'yazdir', dolu: 'kagazi', alt: false },
  { yol: '/tanilar', ad: 'Tanılar', anahtar: 'nav.tanilar', simge: 'not', dolu: 'tani', alt: false },
  { yol: '/laboratuvar', ad: 'Laboratuvar', anahtar: 'nav.laboratuvar', simge: 'tup', dolu: 'tup', alt: false },
  { yol: '/raporlar', ad: 'Raporlar', anahtar: 'nav.raporlar', simge: 'grafik', dolu: 'rapor', alt: false },
  { yol: '/ayarlar', ad: 'Ayarlar', anahtar: 'nav.ayarlar', simge: 'ayarlar', dolu: 'ayarlar', alt: false },
];

const ROTALAR = [
  // Uygulamanın günlük işi reçete yazmak: açılışta hekim doğrudan kâğıdın
  // başında oluyor. Panel kalktı değil, menüye indi.
  { yol: '/', yukle: () => import('./sayfalar/kagit-yaz.js') },
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
  kenar.appendChild(el('a', { class: 'kenar__marka', href: '#/' },
    el('span', { class: 'kenar__marka-simge' }, simge('logo', { boy: 57, dolu: true })),
    el('span', { class: 'kenar__marka-ad' },
      el('b', {}, 'Shafa'),
      el('span', {}, t('uygulama.alt_latin', 'Medical System')))));

  const nav = el('nav', { class: 'menu', id: 'kenar-menu' });
  for (const o of MENU) {
    // Sayaç yalnız doluysa: boş kurulumda menü "0" yığınına dönüyordu.
    const n = o.sayac ? sayilar[o.sayac] : 0;
    nav.appendChild(el('a', { href: '#' + o.yol, dataset: { yol: o.yol } },
      simge(o.dolu, { boy: 22, dolu: true }), el('span', {}, t(o.anahtar, o.ad)),
      n ? el('span', { class: 'menu__sayi' }, String(n)) : null));
  }
  kenar.appendChild(nav);

  const slogan = String(ayar.slogan ?? t('kagit.slogan', 'سلامتی شما\nهدف ماست'))
    .split('\n').map((x) => x.trim()).filter(Boolean);
  const sloganAlt = ayar.sloganAlt ?? t('kagit.slogan_alt', 'Your Health, Our Priority');
  kenar.appendChild(el('div', { class: 'kenar__slogan' },
    ...slogan.map((x) => el('div', { class: 'kenar__slogan-fa' }, x)),
    sloganAlt ? el('div', { class: 'kenar__slogan-lat', dir: 'ltr' }, sloganAlt) : null));

  // Sürüm ayakta yalnız telefon çekmecesinde görünüyor; masaüstünde alt
  // şeritte yazılı (CSS gizliyor).
  kenar.appendChild(el('div', { class: 'kenar__ayak' },
    simge('logo', { boy: 33, dolu: true }),
    el('span', { dir: 'ltr' }, el('b', {}, 'Shafa'), ' ', t('uygulama.alt_latin', 'Medical System')),
    el('span', { class: 'kenar__surum', dir: 'ltr' }, 'v' + UYGULAMA_SURUMU)));

  // Masaüstünün alt şeridi: solda sürüm, sağda kalpli not. Kalp yalnız
  // süs (aria-hidden); ekran okuyucu notu iki parçanın birleşimi olarak okur.
  const serit = document.getElementById('alt-serit');
  temizle(serit);
  serit.append(
    el('span', { class: 'alt-serit__surum', dir: 'ltr' }, 'v' + UYGULAMA_SURUMU),
    el('span', { class: 'alt-serit__not', dir: 'rtl' },
      el('span', {}, t('alt_serit.not_bas', 'Teknolojiyle')),
      simge('kalp', { boy: 14, dolu: true }),
      el('span', {}, t('alt_serit.not_son', 'daha sağlıklı bir yaşam için'))));

  temizle(alt);
  for (const o of TUM_OGELER.filter((x) => x.alt)) {
    alt.appendChild(el('a', { href: '#' + o.yol, dataset: { yol: o.yol } },
      simge(o.simge, { boy: 21 }), el('span', {}, t(o.anahtar, o.ad))));
  }
}

/* Üst çubuğun ucundaki hekim bloğu: ad, "hekim hesabı" ve baş harfler.
   Ad ayarlardaki antetten geliyor; eşitleme hesabıyla ilgisi yok, "hesap"
   sözcüğü burada yalnız "bu kâğıtları kim imzalıyor" demek. */
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

/* Telefonda menü. Yeni bir menü bileşeni YAZILMIYOR: dar ekranda gizlenen
   kenar çubuğunun kendisi çekmece olarak açılıyor. Böylece tek menü var —
   sayaçlar, aktif işaret ve sıra iki yerde ayrı ayrı tutulmuyor. */
export function menuyuKapat() {
  document.body.classList.remove('menu-acik');
  document.querySelector('.ust__menu')?.setAttribute('aria-expanded', 'false');
}

function menuDugmesi() {
  const d = btn('', {
    class: 'btn btn--sade btn--ikon ust__menu',
    'aria-label': t('nav.menu', 'Menü'),
    'aria-expanded': 'false',
    onclick: () => {
      document.body.classList.add('menu-hazir');
      const acik = document.body.classList.toggle('menu-acik');
      d.setAttribute('aria-expanded', acik ? 'true' : 'false');
    },
  });
  d.appendChild(simge('menu'));
  return d;
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
  // Sonuca basınca kutu modalın kendi kapatışıyla kapanıyor. Önce örtü elle
  // sökülüyordu: sonuç zaten açık olan sayfaysa adres değişmiyor, modal da
  // hashchange'i duymadığı için keydown dinleyicisi ve sözü açık kalıyordu.
  let kapat = () => {};

  function ciz() {
    temizle(sonuc);
    const q = kutu.value.trim();
    if (!q) { sonuc.appendChild(el('div', { class: 'liste__satir sessiz' }, t('ara.basla', 'Aramak için yazmaya başla.'))); return; }
    const bulunan = [
      ...ilacAra(ilaclar, q).slice(0, 6).map((i) => ({
        ad: ilacGorunenAd(i), alt: t('ara.ilac', 'İlaç · {e}', { e: i.etkenMadde || '—' }), s: 'ilac', yol: `/ilac/${i.id}`,
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
      sonuc.appendChild(el('a', { class: 'liste__satir', href: '#' + x.yol, onclick: () => kapat(null) },
        el('span', { class: 'avatar' }, simge(x.s, { boy: 18 })),
        el('div', { class: 'liste__govde' }, el('div', { class: 'liste__baslik' }, x.ad), el('div', { class: 'liste__alt' }, x.alt))));
    }
    sirala(sonuc);
  }
  kutu.oninput = ciz;
  kutu.onkeydown = (e) => { if (e.key === 'Enter') sonuc.querySelector('a')?.click(); };
  ciz();
  modal({ baslik: t('ara.etiket', 'Ara'), govde: el('div', {}, kutu, sonuc), kapatici: (k) => { kapat = k; } });
  setTimeout(() => kutu.focus(), 30);
}

/* Zil: geniş ekranda uyarı bantları (yedek hatırlatması, açılamayan depo)
   sayfanın tepesinde değil, zilin açtığı kutuda duruyor — tasarımdaki gibi
   paneller üst çubuğun hemen altından başlasın diye. Zil süs değil: bekleyen
   uyarı varsa kırmızı nokta taşıyor, basınca aynı bantlar açılıyor. Telefonda
   zil gizli ve bantlar bugünkü gibi sayfanın tepesinde (CSS). */
function zilAc(acik) {
  document.body.classList.toggle('zil-acik', acik);
  document.querySelector('.ust__zil')?.setAttribute('aria-expanded', acik ? 'true' : 'false');
}

function zilDugmesi() {
  return btn('', {
    class: 'btn btn--ikon btn--sade ust__zil',
    'aria-label': t('ust.bildirimler', 'Bildirimler'),
    'aria-expanded': 'false', 'aria-controls': 'bantlar',
    onclick: () => zilAc(!document.body.classList.contains('zil-acik')),
  }, simge('zil', { boy: 18, dolu: true }), el('span', { class: 'ust__zil-nokta', hidden: true }));
}

// Depo açılamadıysa (kayıtlar sekmeyle silinecek) kutu bir kez kendiliğinden
// açılıyor: bu uyarı bir noktanın arkasında kalamayacak kadar önemli.
let hataGosterildi = false;

async function bantlariYenile(ctx) {
  const kap = document.getElementById('bantlar');
  temizle(kap);
  kap.dataset.bos = t('ust.bildirim_yok', 'Yeni bildirim yok.');
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
  const n = kap.childElementCount;
  const zil = document.querySelector('.ust__zil');
  if (zil) {
    zil.querySelector('.ust__zil-nokta').hidden = !n;
    zil.setAttribute('aria-label', n ? t('ust.bildirim_var', 'Bildirimler: {n} yeni', { n }) : t('ust.bildirimler', 'Bildirimler'));
  }
  if (!hataGosterildi && kap.querySelector('.bant--hata')) { hataGosterildi = true; zilAc(true); }
}

function temaDugmesi() {
  const b = btn('', { class: 'btn btn--ikon btn--sade ust__tema', 'aria-label': t('ayar.tema_degistir', 'Temayı değiştir'), title: t('ayar.tema', 'Tema') });
  const ciz = () => { temizle(b); b.appendChild(simge(document.documentElement.dataset.tema === 'karanlik' ? 'gunduz' : 'gece', { boy: 17, dolu: true })); };
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

  // Google döneminin ayarları (kasa anahtarı dahil) bir kez silinir. Google
  // yedeği kalktı; bu değerlerin cihazda durmasının bir getirisi yok.
  await eskiSenkronAyarlariniSil(depo);
  const ayar = await depo.ayarlar();

  // Hazır ilaç listesi eski bir sürümden yüklenmişse adları bir kez yenile:
  // ilk sayfa Türkçe kalmış eski adlarla çizilmesin. Liste okunamazsa
  // (çevrimdışı, önbellekte yok) bir sonraki açılışta yeniden denenir.
  await hazirListeyiTazele(depo).catch(() => 0);

  await dilYukle();
  bicimAyarla({ dil: suankiDil(), kur: ayar.paraBirimi || 'AFN' });

  const hesap = new HesapServisi(depo);
  const ctx = {
    depo, hesap, t, bildir, basari, uyar, hata, modal, sor, onayla, uygulamaSurumu: UYGULAMA_SURUMU,
    git: (yol) => { location.hash = '#' + yol; },
    yenileBantlar: () => bantlariYenile(ctx),
    yenileMenu: () => menuCiz(depo),
  };

  await menuCiz(depo);
  // Telefonun üst çubuğundaki marka kenar çubuğununkiyle aynı çizim. Önce
  // eski ℞ karosu (img/logo.svg) ve «شفا» duruyordu; çekmece açılınca iki
  // ayrı marka yan yana görünüyordu. Çizim simge tablosunda, yani JS'te.
  document.querySelector('.ust__logo')?.prepend(
    el('span', { class: 'ust__logo-simge' }, simge('logo', { boy: 38, dolu: true })));
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
    el('span', { class: 'ara-kutu__simge', onclick: () => aramaKutusu.focus() }, simge('ara', { boy: 18 })),
    aramaKutusu,
    klavyeli ? el('kbd', { class: 'ara-kutu__kisayol', dir: 'ltr' }, 'Ctrl + K') : null));
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); aramaAc(ctx, ''); }
  });

  const ustSag = document.getElementById('ust-sag');
  // Bugünün tarihi şemsi takvimde. Seçici DEĞİL, yazı: üst çubuktaki bir
  // tarih seçicinin değiştireceği bir şey yok, reçetenin tarihi kendi
  // ekranında duruyor. Yazı önce, simge sonra: tasarımda tarih kutunun
  // başında, takvim ucunda.
  ustSag.appendChild(el('div', { class: 'ust__tarih', title: t('genel.bugun', 'Bugün') },
    el('span', { dir: 'ltr' }, tarihMetni(bugun())),
    simge('takvim', { boy: 19, dolu: true })));
  ustSag.appendChild(temaDugmesi());
  ustSag.appendChild(zilDugmesi());
  ustSag.appendChild(menuDugmesi());
  ustSag.appendChild(el('div', { class: 'ust__hesap', id: 'ust-hesap' }));
  await hesabiCiz(depo);

  document.getElementById('kenar-perde')?.addEventListener('click', menuyuKapat);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { menuyuKapat(); zilAc(false); } });
  // Zil kutusu dışına basınca kapanır; kutunun içindeki "yedek indir" gibi
  // düğmeler kutuyu kapatmıyor.
  document.addEventListener('click', (e) => {
    if (document.body.classList.contains('zil-acik') && !e.target.closest('.ust__zil, #bantlar')) zilAc(false);
  });

  const yonlendirici = new Yonlendirici(ROTALAR, {
    kok: document.getElementById('sayfa'),
    cizimOncesi: ({ yol }) => { aktifIsaretle(yol); zilAc(false); bantlariYenile(ctx); menuyuKapat(); },
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
  if (!location.hash) history.replaceState(null, '', '#/recete/kagit');
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

  /* Tanıtım sayfasından "kur" diye gelindiyse kurulumu öne çıkar.
     Kendiliğinden kuramıyoruz: prompt() yalnız kullanıcı hareketinin içinde
     çağrılabiliyor. Bu yüzden basılacak bir düğme gösteriliyor — ve tarayıcı
     "kurulabilir" demeden düğme çıkmıyor, çalışmayan düğme göstermeyelim. */
  if (/(^|[?&])kur(=|&|$)/.test(location.search) && !kuruluMu()) {
    let gosterildi = false;
    const goster = () => {
      if (gosterildi || kuruluMu()) return;
      if (kurulabilirMi()) {
        gosterildi = true;
        bildir(t('kurulum.hazir', 'Uygulama bu cihaza kurulabilir.'), {
          sure: 0,
          eylem: { metin: t('kurulum.kur', 'Bu cihaza kur'), cb: () => kur() },
        });
      } else if (elleKurulur()) {
        gosterildi = true;
        bildir(t('kurulum.ios', 'iPhone ve iPad\'de: alttaki «Paylaş» düğmesine bas, açılan listeden «Ana Ekrana Ekle»yi seç.'), { sure: 0 });
      }
    };
    goster();
    if (!gosterildi) kurulumuDinle(goster);   // olay açılıştan sonra da gelebiliyor
  }

  // Hesaba kendiliğinden eşitleme: açılıştan 1,5 sn SONRA, sonra değişiklik,
  // internetin gelişi ve uygulamaya dönüş üzerine. Kapı jeton + K: hesap
  // yoksa tek bir ağ isteği atılmaz. Turlar sessiz; olan biten Ayarlar'daki
  // kartta yazıyor. Başka cihazdan kayıt inince menü sayaçları tazelenir.
  hesap.dinle((olay) => {
    if (olay.tur === 'indi') { menuCiz(depo); bildir(senkronOzeti(olay.sonuc)); }
  });
  hesap.baslat();
}

baslat().catch(async (e) => {
  console.error(e);
  if (await kurtar()) return;
  document.getElementById('sayfa').textContent = 'Uygulama başlatılamadı: ' + (e?.message || e);
});
