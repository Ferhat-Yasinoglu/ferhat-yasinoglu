// Uygulama kabuğunu önbelleğe alır: internet yavaşken de hemen açılsın; görsel üretimi çevrimdışı çalışsın.
// Veriler (API, başka köken) hiç önbelleğe girmez. __SURUM__ yayında kısa commit kimliğiyle değişir.
const SURUM = 'fy-reklam-__SURUM__';
const KABUK = [
  './', 'index.html', 'manifest.webmanifest', 'css/tokenlar.css', 'css/uygulama.css',
  'img/logo.svg', 'img/logo-mark.svg', 'img/logo-mark-static.svg', 'img/icon-192.png', 'img/icon-512.png', 'img/icon-180.png', 'img/fy-logo-512.png',
  'fonts/geist-latin.woff2', 'fonts/geistmono-latin.woff2', 'fonts/instrumentserif-italic-latin.woff2',
  'fonts/vazirmatn-latin.woff2', 'fonts/vazirmatn-latin-ext.woff2', 'fonts/vazirmatn-arabic.woff2',
  'js/ana.js', 'js/api.js', 'js/ayar.js', 'js/depo.js', 'js/dom.js', 'js/i18n.js', 'js/sozluk.js', 'js/simge.js', 'js/tema.js',
  'js/paylasilan/urunler.js', 'js/paylasilan/metin.js', 'js/sablon/cizim.js', 'js/rehber.js',
  'js/ekranlar/ortak.js', 'js/ekranlar/giris.js', 'js/ekranlar/projeler.js', 'js/ekranlar/tasarla.js', 'js/ekranlar/metin.js',
  'js/ekranlar/paylas.js', 'js/ekranlar/taslaklar.js', 'js/ekranlar/kayit.js', 'js/ekranlar/daha.js', 'js/ekranlar/kurulum.js',
];

self.addEventListener('install', (o) => {
  o.waitUntil(caches.open(SURUM).then((c) => c.addAll(KABUK)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (o) => {
  o.waitUntil(caches.keys()
    .then((anahtarlar) => Promise.all(anahtarlar.filter((a) => a !== SURUM).map((a) => caches.delete(a))))
    .then(() => self.clients.claim()));
});

/* Aynı kökenden GET: önce ağ (güncel sürüm), ağ yoksa önbellek. /v1 ve /g asla önbelleğe girmez. */
self.addEventListener('fetch', (o) => {
  const istek = o.request;
  const url = new URL(istek.url);
  if (istek.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.includes('/v1/') || url.pathname.includes('/g/')) return;
  o.respondWith(fetch(istek).then((yanit) => {
    if (yanit.ok) { const kopya = yanit.clone(); caches.open(SURUM).then((c) => c.put(istek, kopya)); }
    return yanit;
  }).catch(() => caches.match(istek, { ignoreSearch: true }).then((y) => y || caches.match('index.html'))));
});
