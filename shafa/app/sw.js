/* Service worker: uygulama kabuğunu önbelleğe alır, internetsiz çalıştırır.
   Veri IndexedDB'de durduğu için çevrimdışı hiçbir işlev kapanmaz —
   önbellek yalnız dosyalar içindir. Sürüm değişince eski önbellek silinir. */
// Yayında dağıtımın kısa SHA'sı buraya yazılır (site.yml); yerelde yer tutucu kalır,
// zaten geliştirirken ?nosw=1 ile service worker devre dışı.
const SURUM = '__SURUM__';
const ONBELLEK = 'ecz-' + SURUM;
const KABUK = [
  './', './index.html', './manifest.webmanifest',
  './css/tokenlar.css', './css/bilesenler.css', './css/uygulama.css', './css/yazdirma.css',
  './js/cekirdek/tema.js', './js/uygulama.js', './js/i18n.js',
  './i18n/fa.json', './img/logo.svg', './yazi/vazirmatn.woff2', './yazi/kalam-700.woff2',
  './veri/ilaclar.json', './veri/klinik.json',
];

// skipWaiting burada BİLEREK yok. Yeni sürüm açık sayfayı ortasından
// devralırsa modül grafiği karışıyor: sayfa eski dom.js'i çoktan yüklemişken
// yeni panel.js geliyor ve "Importing binding name … is not found" diye
// çöküyordu. Yeni sürüm sırasını bekler; kullanıcı "Yenile" deyince
// 'atla' iletisiyle devralır (aşağıdaki message dinleyicisi).
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(ONBELLEK).then((c) => c.addAll(KABUK)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith('ecz-') && k !== ONBELLEK).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Hesap API'si (/v1/) önbelleğe girmez: yerelde uygulamayla aynı kökenden
  // sunuluyor ve "önce önbellek" eski bir kasa sürümü döndürürdü. Yayında
  // zaten başka kökende.
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/v1/')) return;
  // Önbellekten hemen ver, arkada tazele.
  e.respondWith(caches.open(ONBELLEK).then(async (c) => {
    const eski = await c.match(e.request);
    const taze = fetch(e.request).then((y) => { if (y.ok) c.put(e.request, y.clone()); return y; }).catch(() => null);
    return eski || (await taze) || new Response('çevrimdışı', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});

self.addEventListener('message', (e) => { if (e.data === 'atla') self.skipWaiting(); });
