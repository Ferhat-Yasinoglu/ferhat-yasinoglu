/* Service worker: uygulama kabuğunu önbelleğe alır, çevrimdışı çalıştırır.
   Sürüm damgası yayınlanırken kısa SHA ile değiştirilir; değişince eski önbellek silinir.
   /api/ ve başka origin istekleri hiç ele alınmaz (Worker çağrıları her zaman ağa gider). */
const SURUM = '__SURUM__';
const ONBELLEK = 'ss-' + SURUM;
const KABUK = [
  './', './index.html', './manifest.webmanifest', './css/tokenlar.css', './css/bilesenler.css', './css/uygulama.css',
  './js/cekirdek/tema.js', './js/uygulama.js', './js/i18n.js', './img/logo.svg', './img/icon-192.png', './img/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(ONBELLEK).then((c) => c.addAll(KABUK)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('ss-') && k !== ONBELLEK).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  // Önbellekten hemen ver, arkada güncelle (stale-while-revalidate).
  e.respondWith(caches.open(ONBELLEK).then(async (c) => {
    const eski = await c.match(e.request);
    const taze = fetch(e.request).then((y) => { if (y.ok) c.put(e.request, y.clone()); return y; }).catch(() => null);
    return eski || (await taze) || new Response('çevrimdışı', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});
self.addEventListener('message', (e) => { if (e.data === 'atla') self.skipWaiting(); });
