#!/usr/bin/env node
// Bağlı kipin göz kontrolü: yerel sunucuyu (uygulama + API, geliştirme girişi, PROVA, sahte Meta secret'ları)
// çocuk süreç olarak açar, Chromium'da giriş → Tasarla → Paylaş → «Instagram'a yayınla» (PROVA) → Kayıt → Daha
// turunu yapar, ekran görüntülerini ekran/ klasörüne yazar ve kayıtta «prova» satırını arar.
// `node tools/ekran-bagli.mjs [port=8798]`. Dışarıya hiçbir istek gitmez (PROVA=1).
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const kok = fileURLToPath(new URL('..', import.meta.url));
const cikti = join(kok, 'ekran');
const port = Number(process.argv[2] || 8798);
const require = createRequire(import.meta.url);
let pw;
for (const aday of ['playwright', '/opt/node-tools/node_modules/playwright', process.env.PLAYWRIGHT_MODUL].filter(Boolean)) {
  try { pw = require(aday); break; } catch { /* sıradaki */ }
}
if (!pw) { console.error('playwright bulunamadı'); process.exit(1); }

// Sahte Meta secret'ları: kanallar «bağlı» görünsün, PROVA dış çağrıyı engellesin. Gerçek değer değil.
const sunucu = spawn(process.execPath, [join(kok, 'sunucu', 'yerel.mjs'), String(port), '--gelistirme'], {
  env: { ...process.env, PROVA: '1', META_SAYFA_TOKEN: 'prova-token', META_SAYFA_ID: '100', META_IG_ID: '200', META_APP_SECRET: 'prova-secret' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
sunucu.stdout.on('data', (d) => { log += d; });
sunucu.stderr.on('data', (d) => { log += d; });
const adres = `http://127.0.0.1:${port}/`;
for (let i = 0; i < 50; i++) {
  try { const r = await fetch(adres + 'v1/durum'); if (r.ok) break; } catch { /* henüz açılmadı */ }
  await new Promise((c) => setTimeout(c, 200));
}
await mkdir(cikti, { recursive: true });

const tarayici = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const hatalar = [];
try {
  const baglam = await tarayici.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR', colorScheme: 'dark' });
  const sayfa = await baglam.newPage();
  sayfa.on('pageerror', (e) => hatalar.push(`sayfa: ${e.message}`));
  sayfa.on('console', (m) => { if (m.type() === 'error') hatalar.push(`console: ${m.text()}`); });
  sayfa.on('dialog', (d) => d.accept());
  const cek = async (dosya, bekle = 600) => { await sayfa.waitForTimeout(bekle); await sayfa.screenshot({ path: join(cikti, `bagli-${dosya}.png`), fullPage: true }); };

  await sayfa.goto(adres, { waitUntil: 'networkidle' });
  await cek('1-giris');
  await sayfa.getByRole('button', { name: /Geliştirme girişi/ }).click();
  await sayfa.waitForURL(/#\/projeler/);
  await cek('2-projeler');
  await sayfa.goto(adres + '#/tasarla/shafa', { waitUntil: 'networkidle' });
  await sayfa.waitForTimeout(1200);
  const id = /\/t\/([a-f0-9]+)/.exec(sayfa.url())?.[1];
  if (!id) throw new Error('taslak kimliği alınamadı');
  await sayfa.goto(adres + `#/paylas/${id}`, { waitUntil: 'networkidle' });
  await sayfa.waitForTimeout(3000);
  await cek('3-paylas');
  const dugme = sayfa.getByRole('button', { name: /Instagram'a yayınla/ });
  if (await dugme.isDisabled()) hatalar.push('Instagram\'a yayınla düğmesi kapalı (kanal bağlı görünmüyor)');
  else {
    await dugme.click();
    await sayfa.waitForTimeout(2500);
    await cek('3b-paylas-prova', 100);
    const bildirim = await sayfa.locator('#bildirim').textContent().catch(() => '');
    if (!/Prova tamam/.test(bildirim || '')) hatalar.push(`prova bildirimi gelmedi: «${(bildirim || '').trim()}»`);
  }
  await sayfa.goto(adres + '#/kayit', { waitUntil: 'networkidle' });
  await cek('4-kayit', 1200);
  const kayitMetni = await sayfa.locator('main').textContent();
  if (!/prova/.test(kayitMetni || '')) hatalar.push('kayıt listesinde prova satırı yok');
  if (!/sahip@ornek\.af/.test(kayitMetni || '')) hatalar.push('kayıtta yapan (sahip@ornek.af) görünmüyor');
  await sayfa.goto(adres + '#/daha', { waitUntil: 'networkidle' });
  await cek('5-daha', 1500);
  await sayfa.goto(adres + '#/kurulum', { waitUntil: 'networkidle' });
  await cek('6-kurulum', 600);
  await baglam.close();
} catch (e) {
  hatalar.push(String(e?.message || e));
} finally {
  await tarayici.close();
  sunucu.kill();
}
if (hatalar.length) { console.error(hatalar.map((h) => '✗ ' + h).join('\n')); console.error('--- sunucu günlüğü ---\n' + log.slice(-2000)); process.exit(1); }
console.log(`bağlı kip tamam: ekran görüntüleri ${cikti}/bagli-*.png`);
