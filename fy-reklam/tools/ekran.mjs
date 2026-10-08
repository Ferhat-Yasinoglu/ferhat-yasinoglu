#!/usr/bin/env node
// Görsel doğrulama: uygulamayı statik sunar, Chromium'da telefon ve masaüstü boyutunda açar,
// her ekranın görüntüsünü ekran/ klasörüne yazar ve Paylaş adımında üretilen JPEG'leri kaydeder
// (biri sağdan sola Dari, biri Türkçe). `node tools/ekran.mjs [port=8797]`.
// Playwright + Chromium gerekir (CI'da koşmaz; yayın öncesi göz kontrolü).
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { statikSun } from './sun.mjs';

const kok = fileURLToPath(new URL('..', import.meta.url));
const cikti = join(kok, 'ekran');
const port = Number(process.argv[2] || 8797);
const require = createRequire(import.meta.url);
let pw;
for (const aday of ['playwright', '/opt/node-tools/node_modules/playwright', process.env.PLAYWRIGHT_MODUL].filter(Boolean)) {
  try { pw = require(aday); break; } catch { /* sıradaki */ }
}
if (!pw) { console.error('playwright bulunamadı: npm i --no-save playwright'); process.exit(1); }

const sunucu = createServer((i, y) => statikSun(join(kok, 'app'), i, y));
await new Promise((coz) => sunucu.listen(port, '127.0.0.1', coz));
await mkdir(cikti, { recursive: true });
const adres = `http://127.0.0.1:${port}/`;
const tarayici = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const hatalar = [];

/** Paylaş sayfasındaki üretilmiş JPEG'i canvas üzerinden okur (blob: adresi CSP connect-src'de yok, olması da gerekmez). */
const jpegOku = (sayfa) => sayfa.evaluate(() => {
  const img = document.querySelector('.onizleme img');
  if (!img || !img.naturalWidth) return null;
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  const bilgi = /(\d+) KB/.exec(document.querySelector('.onizleme + p')?.textContent || '');
  return { b64: c.toDataURL('image/jpeg', 0.92).split(',')[1], kb: bilgi ? Number(bilgi[1]) : 0, w: img.naturalWidth, h: img.naturalHeight };
});

async function tur(ad, viewport, { tamTur }) {
  const baglam = await tarayici.newContext({ viewport, deviceScaleFactor: 1, locale: 'tr-TR', colorScheme: 'dark' });
  const sayfa = await baglam.newPage();
  sayfa.on('pageerror', (e) => hatalar.push(`${ad}: ${e.message}`));
  // Yerel kipte sunucu yok: /v1/durum 404 döner, uygulama bunu bekler; kalan konsol hataları gerçek.
  sayfa.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) hatalar.push(`${ad} console: ${m.text()}`); });
  sayfa.on('dialog', (d) => d.accept());
  const cek = async (yol, dosya, bekle = 600) => {
    await sayfa.goto(adres + yol, { waitUntil: 'networkidle' });
    await sayfa.waitForTimeout(bekle);
    await sayfa.screenshot({ path: join(cikti, `${ad}-${dosya}.png`), fullPage: true });
    return sayfa.url();
  };
  const tikla = async (ad_) => { await sayfa.getByRole('button', { name: ad_ }).first().click(); await sayfa.waitForTimeout(900); };

  await cek('#/projeler', '1-projeler');

  // Taslak A: Dawayar — Dari (sağdan sola), dikey, Özellikler
  const urlA = await cek('#/tasarla/dawayar', '2-tasarla', 1500);
  const idA = /\/t\/([a-f0-9]+)/.exec(urlA)?.[1];
  if (!idA) { hatalar.push(`${ad}: taslak kimliği alınamadı (${urlA})`); await baglam.close(); return; }
  await tikla(/Özellikler/);
  await sayfa.screenshot({ path: join(cikti, `${ad}-2b-tasarla-ozellikler.png`), fullPage: true });
  await tikla(/Akış/); await tikla(/Kare/);
  await sayfa.screenshot({ path: join(cikti, `${ad}-2c-tasarla-akis-kare.png`), fullPage: true });
  await tikla(/Türkçe/);
  await sayfa.screenshot({ path: join(cikti, `${ad}-2d-tasarla-turkce.png`), fullPage: true });
  await tikla(/دری/); await tikla(/Özellikler/); await tikla(/Dikey/);
  await cek(`#/metin/${idA}`, '3-metin', 800);
  await cek(`#/paylas/${idA}`, '4-paylas', 3000);
  const jA = await jpegOku(sayfa);
  if (jA) { await writeFile(join(cikti, `${ad}-uretilen-dari-ozellikler.jpg`), Buffer.from(jA.b64, 'base64')); console.log(`${ad}: Dari JPEG ${jA.w}×${jA.h}, ${jA.kb} KB`); } else hatalar.push(`${ad}: Dari JPEG üretilmedi`);
  await sayfa.getByRole('button', { name: /JPEG indir/ }).click().catch(() => hatalar.push(`${ad}: indir düğmesi tıklanamadı`));
  await sayfa.waitForTimeout(300);

  if (tamTur) {
    // Taslak B: Sosyal Stüdyo — Türkçe, kare, Akış; Taslak C: FY kursu — İngilizce, hikâye, Başlık
    for (const [urun, dil, bicim, sablon, dosya] of [['sosyal-studyo', null, /Kare/, /Akış/, 'tr-akis'], ['fy-ajans', /English/, /Hikâye/, /Başlık/, 'en-baslik']]) {
      const url = await cek(`#/tasarla/${urun}`, `2x-${dosya}`, 1200);
      const id = /\/t\/([a-f0-9]+)/.exec(url)?.[1];
      if (dil) await tikla(dil);
      await tikla(bicim); await tikla(sablon);
      await sayfa.screenshot({ path: join(cikti, `${ad}-2x-${dosya}.png`), fullPage: true });
      await cek(`#/paylas/${id}`, `4x-${dosya}`, 3000);
      const j = await jpegOku(sayfa);
      if (j) { await writeFile(join(cikti, `${ad}-uretilen-${dosya}.jpg`), Buffer.from(j.b64, 'base64')); console.log(`${ad}: ${dosya} JPEG ${j.w}×${j.h}, ${j.kb} KB`); } else hatalar.push(`${ad}: ${dosya} JPEG üretilmedi`);
    }
  }
  await cek('#/taslaklar', '5-taslaklar');
  await cek('#/kayit', '6-kayit');
  await cek('#/daha', '7-daha');
  await baglam.close();
}
await tur('telefon', { width: 390, height: 844 }, { tamTur: true });
await tur('masaustu', { width: 1280, height: 900 }, { tamTur: false });
await tarayici.close();
sunucu.close();
if (hatalar.length) { console.error(hatalar.map((h) => '✗ ' + h).join('\n')); process.exit(1); }
console.log(`ekran görüntüleri: ${cikti}`);
