// Uygulamanın girişi: sunucu varsa ve oturum yoksa giriş ekranı; yoksa yüzen menülü kabuk ve
// adres çubuğundaki #/… yoluna göre ekran. Ekran değişimleri (destekleyen tarayıcıda) yumuşak geçişle.
//
// İki kip:
//   bağlı  — Worker ulaşılabilir: Google ile giriş (yalnız YONETICILER), ortak kayıt, Yayınla.
//   yerel  — Worker yok ya da ulaşılamıyor: giriş istenmez; tasarla, metin yaz, indir, paylaş çalışır.
import { h, doldur, sakin } from './dom.js';
import { t, dilUygula } from './i18n.js';
import { temaUygula } from './tema.js';
import { oturumVar, oturumDusunce, durum, sunucuVar, kullanici } from './api.js';
import { simge } from './simge.js';
import { girisEkrani } from './ekranlar/giris.js';
import { projelerEkrani } from './ekranlar/projeler.js';
import { tasarlaEkrani } from './ekranlar/tasarla.js';
import { metinEkrani } from './ekranlar/metin.js';
import { paylasEkrani } from './ekranlar/paylas.js';
import { taslaklarEkrani } from './ekranlar/taslaklar.js';
import { kayitEkrani } from './ekranlar/kayit.js';
import { dahaEkrani } from './ekranlar/daha.js';
import { kurulumEkrani } from './ekranlar/kurulum.js';

document.documentElement.classList.add('js');
const kok = document.getElementById('uygulama');

/** '#/tasarla/dawayar?x=1' → { yol: ['tasarla', 'dawayar'], sorgu: URLSearchParams } */
function adres() {
  const [yol, sorgu = ''] = location.hash.replace(/^#\/?/, '').split('?');
  return { yol: yol.split('/').filter(Boolean).map(decodeURIComponent), sorgu: new URLSearchParams(sorgu) };
}

const EKRANLAR = {
  projeler: projelerEkrani,
  tasarla: tasarlaEkrani,
  metin: metinEkrani,
  paylas: paylasEkrani,
  taslaklar: taslaklarEkrani,
  kayit: kayitEkrani,
  daha: dahaEkrani,
  kurulum: kurulumEkrani,
};

/** Alt menüde hangi sekme seçili görünsün. */
const SEKME = { projeler: 'projeler', tasarla: 'projeler', metin: 'projeler', paylas: 'projeler', taslaklar: 'taslaklar', kayit: 'kayit', daha: 'daha', kurulum: 'daha' };

/** Uygulama durumu: kip ve sunucu bilgisi; ekranlar ctx olarak alır. */
const durumBilgisi = { kip: 'yerel', sunucu: null };

function menu(secili) {
  const sekme = (ad, simgeAdi, etiket) => h('a', {
    href: `#/${ad}`, class: ['sekme', secili === ad ? 'secili' : ''], 'aria-current': secili === ad ? 'page' : false,
  }, simge(simgeAdi, { boyut: 22 }), h('span', { class: 'sekme-ad' }, etiket));
  return h('nav', { class: 'menu', 'aria-label': t('menu') },
    h('a', { href: '#/projeler', class: 'menu__marka' }, h('img', { src: 'img/icon-192.png', alt: '', width: 28, height: 28 }), 'FY Reklam'),
    sekme('projeler', 'izgara', t('menu.projeler')),
    sekme('taslaklar', 'taslak', t('menu.taslaklar')),
    h('a', { href: '#/projeler?yeni=1', class: 'sekme sekme--fab', 'aria-label': t('menu.yeni') }, h('span', { class: 'fab' }, simge('arti', { boyut: 24 })), h('span', { class: 'sekme-ad' }, t('menu.yeni'))),
    sekme('kayit', 'kayit', t('menu.kayit')),
    sekme('daha', 'daha', t('menu.daha')));
}

function ciz() {
  if (durumBilgisi.kip === 'bagli' && !oturumVar()) {
    doldur(kok, girisEkrani(() => { location.hash = '#/projeler'; goster(); }, durumBilgisi));
    return;
  }
  const a = adres();
  const ad = EKRANLAR[a.yol[0]] ? a.yol[0] : 'projeler';
  const ekran = h('main', { class: 'ekran', id: 'ekran' });
  doldur(kok, ekran, menu(SEKME[ad]));
  window.scrollTo(0, 0);
  const ctx = {
    t, git: (yol) => { location.hash = yol; }, kullanici: kullanici(), kip: durumBilgisi.kip, sunucu: durumBilgisi.sunucu,
    yenidenCiz: goster,
  };
  Promise.resolve(EKRANLAR[ad](ekran, a, ctx)).catch((e) => {
    doldur(ekran, h('div', { class: 'glass' }, h('p', { class: 'denetim__oge denetim__oge--hata' }, simge('uyari'), String(e?.message || e))));
  });
}

/** Ekranı değiştirir; View Transitions destekleniyorsa yumuşak geçişle. */
function goster() {
  if (document.startViewTransition && !sakin() && kok.firstElementChild) document.startViewTransition(ciz);
  else ciz();
}

async function basla() {
  temaUygula();
  dilUygula();
  if (sunucuVar()) {
    try {
      durumBilgisi.sunucu = await durum();
      durumBilgisi.kip = 'bagli';
    } catch {
      durumBilgisi.kip = 'yerel';
    }
  }
  oturumDusunce(() => goster());
  window.addEventListener('hashchange', goster);
  window.addEventListener('fyr:dil', goster);
  ciz();
  if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

basla();
