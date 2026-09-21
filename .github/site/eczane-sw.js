/* Eski /eczane/ adresinde duran "kendini kapatan" service worker.

   Hekimin telefonunda kurulu uygulamanın service worker'ı hâlâ bu yolda
   kayıtlı ve sayfayı ÖNBELLEKTEN açıyor. Onu kapatmazsak taşındı sayfası
   hiç görünmez: eski uygulama sonsuza kadar önbellekten açılmaya devam eder.

   Tarayıcı her gezinmede sw.js'i tazeliyor; bu dosya oraya gelince eskisinin
   yerini alıyor, kendini siliyor ve açık pencereleri yeni adrese götürüyor.

   Önbellek BİLEREK silinmiyor. CacheStorage yola değil KAYNAĞA bağlı:
   buradan `caches.delete` demek yeni adresteki uygulamanın önbelleğini de
   silmek olurdu. Eski önbelleği yeni uygulama kendisi temizliyor — activate
   sırasında kendi sürümü dışındaki 'ecz-' önbelleklerini siliyor.

   Veriye dokunulmuyor: IndexedDB da kaynağa bağlı, yeni adreste yerinde. */
const YENI = '../shafa/app/';

// Burada skipWaiting doğru: bu worker uygulamayı SERVİS ETMİYOR, yalnız
// kendini kapatıp yönlendiriyor. Sayfa baştan yükleneceği için uygulamanın
// modül grafiğini ortasından bölme tehlikesi yok.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  await self.clients.claim();
  await self.registration.unregister();
  for (const istemci of await self.clients.matchAll({ type: 'window' })) {
    try {
      await istemci.navigate(new URL(YENI, self.registration.scope).href);
    } catch {
      // navigate() her tarayıcıda yok; o zaman taşındı sayfasının kendi
      // yönlendirmesi devreye giriyor.
    }
  }
})()));

// fetch dinleyicisi YOK: istekler doğrudan ağa gidiyor, yani taşındı sayfası
// önbellekteki eski uygulamanın arkasında kalmıyor.
