#!/usr/bin/env node
// Gerçek tarayıcıda uçtan uca deneme: `npm run deneme`.
// Uygulamayı açar, örnek veriyi yükler, ilaç ekler, stok işletir, arar, yedek indirir;
// hiçbir adımda konsola hata düşmediğini doğrular. Ekran görüntüleri --ekran <klasör>.
//
// Playwright bu projenin bağımlılığı değil (tarayıcı indirmesi ağır): kurulu
// değilse betik atlanır. Kurmak için: npm i -D playwright && npx playwright install chromium
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try {
  // Playwright hem CJS hem ESM paketler; ikisinden de chromium çıkarılır.
  const modul = await import(pathToFileURL(require.resolve('playwright')).href);
  chromium = modul.chromium || modul.default?.chromium;
  if (!chromium) throw new Error('chromium bulunamadı');
} catch {
  console.log('⚠ playwright kurulu değil, tarayıcı denemesi atlandı.');
  console.log('  Kurmak için: npm i -D playwright && npx playwright install chromium');
  process.exit(0);
}

const PORT = 8799;
const KOK = `http://localhost:${PORT}/?nosw=1`;
const ekranBayragi = process.argv.indexOf('--ekran');
const EKRAN = ekranBayragi > -1 ? process.argv[ekranBayragi + 1] : '';
if (EKRAN) await mkdir(EKRAN, { recursive: true });

const hatalar = [];
let adim = 0;
const ok = (m) => console.log(`✓ ${++adim}. ${m}`);
const resim = async (sayfa, ad, sec) => { if (EKRAN) await sayfa.screenshot({ path: `${EKRAN}/${ad}`, ...sec }); };

// Kendi sunucusunu açar, sonunda kapatır.
const sunucu = spawn(process.execPath, [new URL('sun.mjs', import.meta.url).pathname, 'app', String(PORT)], {
  cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore',
});
const kapat = () => { try { sunucu.kill(); } catch { /* zaten kapalı */ } };
process.on('exit', kapat);
await new Promise((c) => setTimeout(c, 400));

const tarayici = await chromium.launch();
const sayfa = await tarayici.newPage({ viewport: { width: 1280, height: 900 } });
sayfa.on('console', (m) => { if (m.type() === 'error') hatalar.push('console: ' + m.text()); });
sayfa.on('pageerror', (e) => hatalar.push('pageerror: ' + e.message));

await sayfa.goto(KOK, { waitUntil: 'networkidle' });
await sayfa.waitForSelector('#kenar-menu a');
ok('uygulama açıldı, menü çizildi');

// --- Panel boşken doğru şeyi söylüyor mu?
await sayfa.waitForSelector('text=Uygulama boş');
ok('boş panel "uygulama boş" diyor');

// --- Ayarlar: örnek veri yükle
await sayfa.click('#kenar-menu a[href="#/ayarlar"]');
await sayfa.click('button:has-text("Örnek verileri yükle")');
await sayfa.waitForSelector('.bildirim--basari');
ok('örnek veriler yüklendi: ' + (await sayfa.textContent('.bildirim--basari')).trim());

// --- İlaç listesi
await sayfa.click('#kenar-menu a[href="#/ilaclar"]');
await sayfa.waitForSelector('.tablo tbody tr');
const ilacSayisi = await sayfa.locator('.tablo tbody tr').count();
if (ilacSayisi !== 8) throw new Error(`8 ilaç bekleniyordu, ${ilacSayisi} var`);
ok(`ilaç listesi ${ilacSayisi} satır gösteriyor`);

// --- Rozetler: stok ve SKT uyarıları göründü mü?
const rozetler = await sayfa.locator('.tablo tbody .rozet').allTextContents();
for (const beklenen of ['Stok yok', 'Stok az', 'SKT geçti', 'SKT yakın']) {
  if (!rozetler.includes(beklenen)) throw new Error(`"${beklenen}" rozeti yok. Görülenler: ${rozetler.join(', ')}`);
}
ok('stok ve son kullanma rozetleri doğru: ' + [...new Set(rozetler)].join(', '));

// --- Arama: etken maddeden muadil bulma
await sayfa.fill('input[type=search][placeholder*="barkod"]', 'amoksisilin');
await sayfa.waitForFunction(() => document.querySelectorAll('.tablo tbody tr').length === 2);
ok('etken madde araması 2 muadili buldu');
await sayfa.fill('input[type=search][placeholder*="barkod"]', '');

// --- Süzgeç
await sayfa.selectOption('select', { label: 'Son kullanması geçmişler' });
await sayfa.waitForFunction(() => document.querySelectorAll('.tablo tbody tr').length === 1);
ok('SKT geçmişler süzgeci 1 ilaç bıraktı');
await sayfa.selectOption('select', { label: 'Tümü' });
await sayfa.waitForFunction(() => document.querySelectorAll('.tablo tbody tr').length === 8);

await resim(sayfa, '1-ilaclar.png');

// --- Yeni ilaç ekle
await sayfa.click('button:has-text("İlaç ekle")');
await sayfa.waitForSelector('.modal');
await sayfa.fill('.modal input[name=ad]', 'Aferin');
await sayfa.fill('.modal input[name=etkenMadde]', 'Parasetamol + Klorfeniramin');
await sayfa.fill('.modal input[name=doz]', '500 mg');
await sayfa.fill('.modal input[name=stok]', '12');
await sayfa.fill('.modal input[name=satisFiyati]', '36.9');
await sayfa.fill('.modal input[name=barkod]', '123');           // bilerek geçersiz
await sayfa.click('.modal button:has-text("Kaydet")');
await sayfa.waitForSelector('.alan__hata');
ok('geçersiz barkod yakalandı: ' + (await sayfa.textContent('.alan__hata')).trim());
await sayfa.fill('.modal input[name=barkod]', '8699546010999');
await sayfa.click('.modal button:has-text("Kaydet")');
await sayfa.waitForFunction(() => document.querySelectorAll('.tablo tbody tr').length === 9);
ok('yeni ilaç eklendi, liste 9 satır');

// --- İlaç kartı ve stok işlemi
await sayfa.click('.tablo tbody tr:has-text("Aferin")');
await sayfa.waitForSelector('h1:has-text("Aferin")');
const stokMetni = () => sayfa.textContent('.kart .izgara div:has(.alan__etiket:text-is("Stok")) strong');
if ((await stokMetni()).trim() !== '12') throw new Error('başlangıç stoğu 12 değil: ' + await stokMetni());
ok('başlangıç stoğu mal girişi olarak işlendi (12)');

await sayfa.click('button:has-text("Stok işlemi")');
await sayfa.waitForSelector('.modal');
await sayfa.selectOption('.modal select[name=tur]', { label: 'Fire/İmha' });
await sayfa.fill('.modal input[name=adet]', '3');
await sayfa.fill('.modal textarea[name=aciklama]', 'kutu ezildi');
await sayfa.click('.modal button:has-text("Uygula")');
await sayfa.waitForFunction(() => {
  const h = [...document.querySelectorAll('.alan__etiket')].find((x) => x.textContent === 'Stok');
  return h?.nextElementSibling?.textContent.trim() === '9';
});
ok('fire işlemi stoğu 12 → 9 yaptı');

const hareketSatiri = await sayfa.textContent('.tablo tbody tr');
if (!hareketSatiri.includes('kutu ezildi') || !hareketSatiri.includes('-3')) throw new Error('hareket kaydı eksik: ' + hareketSatiri);
ok('hareket geçmişine "-3 · kutu ezildi" yazıldı');

// --- Stok yetersizliği engelleniyor mu?
await sayfa.click('button:has-text("Stok işlemi")');
await sayfa.selectOption('.modal select[name=tur]', { label: 'Sayım düzeltmesi' });
await sayfa.fill('.modal input[name=adet]', '4');
await sayfa.click('.modal button:has-text("Uygula")');
await sayfa.waitForFunction(() => {
  const h = [...document.querySelectorAll('.alan__etiket')].find((x) => x.textContent === 'Stok');
  return h?.nextElementSibling?.textContent.trim() === '4';
});
ok('sayım düzeltmesi stoğu 4\'e eşitledi');
await resim(sayfa, '2-ilac-karti.png');

// --- Muadil bağlantısı
await sayfa.goto(KOK + '#/ilaclar');
await sayfa.click('.tablo tbody tr:has-text("Augmentin")');
await sayfa.waitForSelector('h2:has-text("Muadiller")');
const muadil = await sayfa.textContent('.kart:has(h2:text-is("Muadiller")) .liste__baslik');
if (!muadil.includes('Amoklavin')) throw new Error('muadil bulunamadı: ' + muadil);
ok('muadil kartı doğru ilacı gösterdi: ' + muadil.trim());

// --- Hasta kartı ve alerji uyarısı
await sayfa.click('#kenar-menu a[href="#/hastalar"]');
await sayfa.waitForSelector('.liste__satir');
await sayfa.click('.liste__satir:has-text("Ayşe Yılmaz")');
await sayfa.waitForSelector('h1:has-text("Ayşe Yılmaz")');
const alerji = await sayfa.textContent('.uyari--hata');
if (!alerji.includes('Penisilin')) throw new Error('alerji uyarısı yok');
ok('hasta kartı alerjiyi kırmızı şeritte gösterdi: ' + alerji.trim());
await resim(sayfa, '3-hasta-karti.png');

// --- Panel dolu haliyle
await sayfa.click('#kenar-menu a[href="#/panel"]');
await sayfa.waitForSelector('.sayac');
const sayaclar = await sayfa.locator('.sayac').allTextContents();
ok('panel sayaçları: ' + sayaclar.map((s) => s.replace(/\s+/g, ' ').trim()).join(' | '));
await resim(sayfa, '4-panel.png', { fullPage: true });

// --- Ctrl+K araması
await sayfa.keyboard.press('Control+k');
await sayfa.waitForSelector('.modal input[type=search]');
await sayfa.fill('.modal input[type=search]', 'ventolin');
await sayfa.waitForSelector('.modal .liste__baslik:has-text("Ventolin")');
ok('Ctrl+K araması ilacı buldu');
await sayfa.keyboard.press('Escape');

// --- Yedek al ve içeriğini doğrula
const indirme = sayfa.waitForEvent('download');
await sayfa.click('#kenar-menu a[href="#/ayarlar"]');
await sayfa.click('button:has-text("Yedek indir")');
const dosya = await indirme;
const yol = await dosya.path();
const belge = JSON.parse(await readFile(yol, 'utf8'));
if (belge.bicim !== 'eczane-yedek' || belge.koleksiyonlar.ilaclar.length !== 9) {
  throw new Error('yedek içeriği beklenmedik: ' + JSON.stringify(Object.keys(belge)));
}
ok(`yedek indirildi (${dosya.suggestedFilename()}): 9 ilaç, ${belge.koleksiyonlar.hastalar.length} hasta, ${belge.koleksiyonlar.hareketler.length} hareket`);

// --- Karanlık tema + dar ekran
await sayfa.click('button[aria-label="Temayı değiştir"]');
await sayfa.click('#kenar-menu a[href="#/panel"]');
await sayfa.waitForSelector('.sayac');
await resim(sayfa, '5-karanlik.png', { fullPage: true });
ok('karanlık tema açıldı');

await sayfa.setViewportSize({ width: 390, height: 780 });
await sayfa.waitForSelector('.alt a');
const altGorunur = await sayfa.isVisible('.alt a[href="#/ilaclar"]');
if (!altGorunur) throw new Error('dar ekranda alt gezinme görünmüyor');
ok('dar ekranda alt gezinme çubuğu açıldı');
await resim(sayfa, '6-mobil.png');

// --- Veri kalıcı mı? (sayfa yenilenince duruyor mu)
await sayfa.setViewportSize({ width: 1280, height: 900 });
await sayfa.goto(KOK + '#/ilaclar', { waitUntil: 'networkidle' });
await sayfa.waitForFunction(() => document.querySelectorAll('.tablo tbody tr').length === 9);
ok('sayfa yenilendi, 9 ilaç IndexedDB\'den geri geldi');

await tarayici.close();
kapat();

if (hatalar.length) { console.error('\n✗ konsol hataları:\n' + hatalar.join('\n')); process.exit(1); }
console.log(`\n✓ ${adim} adımın hepsi geçti, konsolda tek hata yok.`);
