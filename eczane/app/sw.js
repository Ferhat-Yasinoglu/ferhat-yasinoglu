/* Service worker: uygulama kabuğunu önbelleğe alır, internetsiz çalıştırır.
   Veri IndexedDB'de durduğu için çevrimdışı hiçbir işlev kapanmaz —
   önbellek yalnız dosyalar içindir. Sürüm değişince eski önbellek silinir. */
const SURUM = 'v2';
const ONBELLEK = 'ecz-' + SURUM;
const KABUK = [
  './', './index.html', './manifest.webmanifest',
  './css/tokenlar.css', './css/bilesenler.css', './css/uygulama.css', './css/yazdirma.css',
  './js/cekirdek/tema.js', './js/uygulama.js', './js/i18n.js',
  './i18n/fa.json', './i18n/en.json', './img/logo.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(ONBELLEK).then((c) => c.addAll(KABUK)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith('ecz-') && k !== ONBELLEK).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Önbellekten hemen ver, arkada tazele.
  e.respondWith(caches.open(ONBELLEK).then(async (c) => {
    const eski = await c.match(e.request);
    const taze = fetch(e.request).then((y) => { if (y.ok) c.put(e.request, y.clone()); return y; }).catch(() => null);
    return eski || (await taze) || new Response('çevrimdışı', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});

self.addEventListener('message', (e) => { if (e.data === 'atla') self.skipWaiting(); });
