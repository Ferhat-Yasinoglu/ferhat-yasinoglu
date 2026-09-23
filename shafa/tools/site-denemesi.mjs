#!/usr/bin/env node
// Yayın düzenini uçtan uca dener: `npm run site`.
//
// site.yml'nin yaptığını birebir yapar, sonucu gerçek tarayıcıda açar ve
// yolların tuttuğunu doğrular. Yayın düzeni sessizce kırılan cinsten:
// bir `cp` satırı yanlış olsa testler yeşil kalır, hata ancak canlıda
// görünür. Uygulama /eczane/ adresinden /shafa/app/ adresine taşınırken
// yazı dosyasının yolu ve tanıtımdaki bağlantılar tam da böyle kırılmıştı.
//
// Playwright bu projenin bağımlılığı değil; kurulu değilse betik atlanır.
import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try {
  const modul = await import(pathToFileURL(require.resolve('playwright')).href);
  chromium = modul.chromium || modul.default?.chromium;
  if (!chromium) throw new Error('chromium bulunamadı');
} catch {
  console.log('⚠ playwright kurulu değil, site denemesi atlandı.');
  process.exit(0);
}

const KOK = fileURLToPath(new URL('../../', import.meta.url));   // depo kökü
const SITE = join(tmpdir(), 'shafa-site-denemesi');
const PORT = 8801;

/* ---- site.yml'nin "Siteyi hazirla" adımı ---- */
await rm(SITE, { recursive: true, force: true });
await mkdir(join(SITE, 'shafa', 'app'), { recursive: true });
await mkdir(join(SITE, 'eczane'), { recursive: true });
await mkdir(join(SITE, 'sosyal-studyo'), { recursive: true });
const kopyala = (kaynak, hedef) => cp(join(KOK, kaynak), join(SITE, hedef), { recursive: true });
await kopyala('sosyal-studyo/app', 'sosyal-studyo');
await kopyala('shafa/tanitim', 'shafa');
await kopyala('shafa/app', 'shafa/app');
await kopyala('.github/site/eczane-tasindi.html', 'eczane/index.html');
await kopyala('.github/site/eczane-sw.js', 'eczane/sw.js');
await kopyala('.github/site/index.html', 'index.html');
await kopyala('.github/site/404.html', '404.html');
for (const y of ['sosyal-studyo/sw.js', 'sosyal-studyo/js/uygulama.js', 'shafa/app/sw.js']) {
  const p = join(SITE, y);
  await writeFile(p, (await readFile(p, 'utf8')).replaceAll('__SURUM__', 'denemesha'));
}

/* ---- Sunucu ---- */
const TUR = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png',
};
const bulunamayan = [];
const sunucu = createServer(async (q, y) => {
  let yol = decodeURIComponent(q.url.split('?')[0]);
  if (yol.endsWith('/')) yol += 'index.html';
  try {
    const govde = await readFile(join(SITE, normalize(yol).replace(/^(\.\.[/\\])+/, '')));
    y.writeHead(200, { 'Content-Type': TUR[extname(yol)] || 'application/octet-stream' });
    y.end(govde);
  } catch {
    bulunamayan.push(yol);
    // Pages bilinmeyen her yol için kökteki 404.html'i verir.
    y.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    y.end(await readFile(join(SITE, '404.html')).catch(() => '404'));
  }
});
await new Promise((r) => sunucu.listen(PORT, r));
const K = `http://localhost:${PORT}`;

const tarayici = await chromium.launch();
const baglam = await tarayici.newContext();
const hatalar = [];
baglam.on('console', (m) => { if (m.type() === 'error') hatalar.push(m.text()); });
let n = 0;
const ok = (m) => console.log(`✓ ${++n}. ${m}`);
const sayfa = await baglam.newPage();

try {
  await sayfa.goto(`${K}/`, { waitUntil: 'networkidle' });
  const kokBag = await sayfa.$$eval('a.proje', (a) => a.map((x) => x.getAttribute('href')));
  if (!kokBag.includes('./shafa/')) throw new Error('kökte /shafa/ bağlantısı yok: ' + kokBag);
  ok(`site kökü açıldı: ${kokBag.join(', ')}`);

  await sayfa.goto(`${K}/shafa/`, { waitUntil: 'networkidle' });
  const uygBag = await sayfa.$$eval('a[href="./app/"]', (a) => a.length);
  if (!uygBag) throw new Error('tanıtımda uygulama bağlantısı yok');
  const eskiKalan = await sayfa.$$eval('a[href*="eczane"]', (a) => a.map((x) => x.getAttribute('href')));
  if (eskiKalan.length) throw new Error('tanıtımda eski adres kalmış: ' + eskiKalan);
  ok(`tanıtım /shafa/ açıldı, ${uygBag} uygulama bağlantısı, eski adres kalmamış`);

  // İndirme bölümü artık sitenin asıl dönüşüm yolu: ziyaretçi uygulamayı
  // buradan kuruyor. Sekmeler JS ile açılıp kapanıyor; JS'te bir hata olsa
  // dört tarifin dördü birden açık kalır ya da hiçbiri açılmaz ve bu hiçbir
  // testte patlamaz.
  const acikPano = () => sayfa.$$eval('.pano', (a) => a.filter((x) => !x.hidden).map((x) => x.id));
  const sekmeSayisi = await sayfa.$$eval('.sekme', (a) => a.length);
  const ilkAcik = await acikPano();
  if (sekmeSayisi < 3) throw new Error('indirme sekmeleri eksik: ' + sekmeSayisi);
  if (ilkAcik.length !== 1) throw new Error('açılışta tam bir pano açık olmalı: ' + ilkAcik.join(', '));
  await sayfa.click('#s-ios');
  const iosAcik = await acikPano();
  if (iosAcik.join() !== 'p-ios') throw new Error('sekme değişmedi: ' + iosAcik.join(', '));
  ok(`indirme bölümü: ${sekmeSayisi} sekme, açılışta ${ilkAcik[0]}, tıklayınca p-ios`);

  // Sekme şeridini ortalayan kod sayfayı da kaydırırsa ziyaretçi tanıtımı
  // baştan değil indirme bölümünden görür. Bir kez tam da böyle oldu.
  await sayfa.goto(`${K}/shafa/`, { waitUntil: 'networkidle' });
  const kaydi = await sayfa.evaluate(() => window.scrollY);
  if (kaydi > 0) throw new Error('sayfa kendiliğinden kaydı: scrollY=' + kaydi);
  ok('açılışta sayfa kendiliğinden kaymıyor (scrollY=0)');

  // Kurulum düğmesi uygulamayı kurulum işaretiyle açmalı.
  const kurBag = await sayfa.$$eval('a[href="./app/?kur=1"]', (a) => a.length);
  if (!kurBag) throw new Error('indirme bölümünde ./app/?kur=1 düğmesi yok');
  ok(`kurulum düğmesi yerinde (${kurBag} tane ./app/?kur=1)`);

  await sayfa.click('a[href="./app/"]');
  await sayfa.waitForURL(/\/shafa\/app\//);
  await sayfa.waitForSelector('#sayfa', { timeout: 15000 });
  ok(`tanıtımdan uygulamaya geçildi: ${new URL(sayfa.url()).pathname}`);

  await sayfa.goto(`${K}/shafa/app/?nosw=1`, { waitUntil: 'networkidle' });
  await sayfa.waitForSelector('#kenar-menu a[href="#/ayarlar"]');
  const veri = await sayfa.evaluate(async () => {
    const [klinik, ilaclar] = await Promise.all([fetch('./veri/klinik.json'), fetch('./veri/ilaclar.json')]);
    const k = await klinik.json();
    return { ok: klinik.ok && ilaclar.ok, tani: k.tanilar.length, belirti: k.belirtiler.length, lab: k.laboratuvar.length };
  });
  if (!veri.ok) throw new Error('veri dosyaları yeni adresten okunamadı');
  ok(`uygulama /shafa/app/ altında çalışıyor (${veri.tani} tanı, ${veri.belirti} belirti, ${veri.lab} lab)`);

  // Manifest mutlak yol kullansa taşınma kırardı.
  const manifest = await sayfa.evaluate(async () => (await (await fetch('./manifest.webmanifest')).json()));
  if (manifest.start_url.startsWith('/') || manifest.scope.startsWith('/')) {
    throw new Error('manifest mutlak yol kullanıyor: ' + JSON.stringify(manifest));
  }
  ok(`manifest göreli (${manifest.start_url}, scope ${manifest.scope}) — taşınma kırmıyor`);

  // Hekimin telefonundaki kurulu uygulama ve yer imi eski adrese bakıyor.
  const eski = await baglam.newPage();
  await eski.goto(`${K}/eczane/`, { waitUntil: 'domcontentloaded' });
  await eski.waitForURL(/\/shafa\/app\//, { timeout: 15000 });
  await eski.waitForSelector('#sayfa', { timeout: 15000 });
  ok(`eski /eczane/ adresi yönlendirdi: ${new URL(eski.url()).pathname}`);

  // location.replace kullanılıyor: "geri" eski adrese düşüp döngü yapmamalı.
  await eski.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
  const geri = new URL(eski.url()).pathname;
  if (geri.startsWith('/eczane')) throw new Error('geri tuşu eski adrese düştü: ' + geri);
  ok(`geri tuşu döngüye sokmuyor (${geri})`);
  await eski.close();

  const sw = await (await fetch(`${K}/eczane/sw.js`)).text();
  if (!sw.includes('unregister')) throw new Error('eski adresin sw.js\'i kendini kapatmıyor');
  if (/addEventListener\(\s*['"]fetch/.test(sw)) {
    throw new Error('eski sw hâlâ fetch yakalıyor; taşındı sayfası önbelleğin arkasında kalır');
  }
  ok('eski adresin service worker\'ı kendini kapatıyor, fetch yakalamıyor');

  // Buradan sonrası bilerek olmayan bir adres istiyor: o 404 beklenen.
  const hataSayisi = hatalar.length;
  await sayfa.goto(`${K}/olmayan/derin/yol`, { waitUntil: 'domcontentloaded' });
  const y404 = await sayfa.$$eval('a.proje', (a) => a.map((x) => x.getAttribute('href')));
  if (y404.some((h) => h.includes('eczane'))) throw new Error('404 eski adrese gönderiyor: ' + y404);
  if (!y404.some((h) => h.includes('/shafa/'))) throw new Error('404 yeni adresi göstermiyor: ' + y404);
  // 404 sayfası her derin yolda çalışmalı: bağlantıları mutlak olmalı.
  if (y404.some((h) => !h.startsWith('/'))) throw new Error('404 bağlantıları göreli, derin yolda kırılır: ' + y404);
  ok(`404 yeni adresi gösteriyor, bağlantıları mutlak: ${y404.join(', ')}`);

  const kacak = bulunamayan.filter((x) => !x.startsWith('/olmayan/'));
  if (kacak.length) throw new Error('site içinde bulunamayan dosya: ' + [...new Set(kacak)].join(', '));
  const beklenmeyen = hatalar.slice(0, hataSayisi);
  if (beklenmeyen.length) throw new Error('konsol hataları:\n' + beklenmeyen.join('\n'));
  console.log(`\n✓ ${n} adımın hepsi geçti, eksik dosya ve konsol hatası yok.`);
} finally {
  await tarayici.close();
  sunucu.close();
  await rm(SITE, { recursive: true, force: true });
}
