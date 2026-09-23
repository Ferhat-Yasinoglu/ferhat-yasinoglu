#!/usr/bin/env node
// Tanıtım sayfasının ekran görüntülerini üretir: `node tools/gorsel-uret.mjs`.
//
// Neden bir araç: görüntüler elle alınınca sessizce eskiyor. Tanıtımdaki
// panel.png örnek hastalar Dari'ye çevrilmeden önce alınmıştı; Afgan hekime
// aylarca «Ayşe Yılmaz, Mehmet Demir, Zeynep Kaya» gösterdi ve bunu hiçbir
// test yakalamadı. Artık tek komutla yeniden üretiliyor.
//
// Tanıtım sayfası koyu; görüntüler de koyu temada alınır. Reçete kâğıdı
// (recete.png) bilerek dışarıda: o basılı kâğıt, kâğıt beyazdır.
//
// Playwright bu projenin bağımlılığı değil; kurulu değilse betik atlanır.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try {
  const modul = await import(pathToFileURL(require.resolve('playwright')).href);
  chromium = modul.chromium || modul.default?.chromium;
  if (!chromium) throw new Error('chromium bulunamadı');
} catch {
  console.log('⚠ playwright kurulu değil, görsel üretimi atlandı.');
  process.exit(0);
}

const PORT = 8794;
const KOK = `http://localhost:${PORT}/?nosw=1`;
const CIKTI = fileURLToPath(new URL('../tanitim/gorsel/', import.meta.url));

// Düğme yazısı sözlükten okunur: burada elle yazılsa sözlük değiştiğinde
// betik sessizce zaman aşımına düşerdi.
const SOZLUK = JSON.parse(await readFile(new URL('../app/i18n/fa.json', import.meta.url), 'utf8'));
const T = (a) => { if (!SOZLUK[a]) throw new Error('sözlükte yok: ' + a); return SOZLUK[a]; };

const sunucu = spawn(process.execPath, [new URL('sun.mjs', import.meta.url).pathname, 'app', String(PORT)], {
  cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: 'ignore',
});
process.on('exit', () => { try { sunucu.kill(); } catch { /* zaten kapalı */ } });
await new Promise((c) => setTimeout(c, 500));

/** Sayfa bağlamında örnek reçeteler yazar: panel boş durmasın, 14 günlük
 *  sütun grafiği dolsun. Kullanım/doz alanı bilerek boş — bu depo ilaç
 *  ADLARININ sözlüğü, tedavi tarifi değil; ekran görüntüsünde de olmayacak. */
const RECETE_YAZ = async () => {
  const { yerelDepoAc } = await import('./js/depo/idb.js');
  const { receteKaydet } = await import('./js/depo/recete.js');
  const depo = await yerelDepoAc();
  const hastalar = (await depo.listele('hastalar')).filter((h) => !h.silindi);
  const ilaclar = (await depo.listele('ilaclar')).filter((i) => !i.silindi);
  if (!hastalar.length || !ilaclar.length) throw new Error('örnek veri yok');
  if ((await depo.listele('receteler')).filter((r) => !r.silindi).length) return 0;

  const gun = (geri) => {
    const d = new Date();
    d.setDate(d.getDate() - geri);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  // Sabit bir dağılım: her çalıştırmada aynı grafik çıksın.
  const DAGILIM = [4, 3, 0, 2, 3, 1, 0, 2, 4, 2, 1, 3, 2, 1];
  let n = 0;
  for (let g = 0; g < DAGILIM.length; g++) {
    for (let k = 0; k < DAGILIM[g]; k++) {
      const hasta = hastalar[n % hastalar.length];
      const kac = 1 + (n % 3);
      const satirlar = [];
      for (let s = 0; s < kac; s++) {
        const ilac = ilaclar[(n + s) % ilaclar.length];
        satirlar.push({ ilacId: ilac.id, ilacAdi: ilac.ad, adet: 1, kullanim: '', sure: '', not: '' });
      }
      await receteKaydet(depo, { hastaId: hasta.id, tarih: gun(g), tur: 'normal', satirlar });
      n++;
    }
  }

  // Örnek veri yazmak yedek hatırlatma sayacını yürütüyor ve panelin tepesine
  // turuncu bir uyarı bandı koyuyor. Uyarı doğru — ama tanıtım görüntüsünde
  // hekimin göreceği ilk şey bu olmamalı. Yedek alınmış gibi işaretliyoruz.
  await depo.metaKaydet({ degisiklikSayaci: 0, sonYedek: new Date().toISOString() });
  return n;
};

const tarayici = await chromium.launch();

/** Koyu temada, örnek veri ve reçetelerle bir bağlam açar. */
async function hazirla(ayar) {
  const baglam = await tarayici.newContext({ ...ayar });
  await baglam.addInitScript(() => {
    try { localStorage.setItem('ecz-tema', 'karanlik'); } catch { /* engelliyse varsayılan kalır */ }
  });
  const sayfa = await baglam.newPage();
  const hatalar = [];
  sayfa.on('pageerror', (e) => hatalar.push(e.message));
  sayfa.on('console', (m) => { if (m.type() === 'error') hatalar.push(m.text()); });

  // Ayarlar'a kenar menüden değil adresten gidiliyor: dar ekranda kenar
  // menü gizli ve tıklama zaman aşımına düşüyor.
  await sayfa.goto(KOK + '#/ayarlar', { waitUntil: 'networkidle' });
  await sayfa.waitForSelector('#sayfa');
  await sayfa.click(`#sayfa button:has-text("${T('ayar.ornek_yukle')}")`);
  await sayfa.waitForSelector('.bildirim--basari');
  const kac = await sayfa.evaluate(RECETE_YAZ);

  await sayfa.goto(KOK, { waitUntil: 'networkidle' });
  await sayfa.waitForSelector('#sayfa');
  await sayfa.waitForTimeout(400);
  // Sayaçlar requestAnimationFrame ile sayıyor, sütunlar CSS ile açılıyor.
  await sayfa.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
  await sayfa.waitForTimeout(900);
  const koyu = await sayfa.evaluate(() => document.documentElement.dataset.tema);
  if (koyu !== 'karanlik') throw new Error('tema koyu değil: ' + koyu);
  const bant = await sayfa.$$eval('.bant', (a) => a.map((x) => x.textContent.trim().slice(0, 60)));
  if (bant.length) throw new Error('uyarı bandı görüntüye girecekti: ' + bant.join(' | '));
  return { baglam, sayfa, kac, hatalar };
}

const raporlar = [];

// --- Bilgisayar ekranı: 16:10, gerçek bir monitör oranı.
{
  const { baglam, sayfa, kac, hatalar } = await hazirla({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  await sayfa.screenshot({ path: CIKTI + 'panel.png' });
  raporlar.push({ ad: 'panel.png', olcu: '1600×1000 (16:10)', recete: kac, hata: hatalar });
  await baglam.close();
}

// --- Telefon
{
  const { baglam, sayfa, kac, hatalar } = await hazirla({
    viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
  });
  await sayfa.screenshot({ path: CIKTI + 'mobil.png' });
  raporlar.push({ ad: 'mobil.png', olcu: '390×780', recete: kac, hata: hatalar });
  await baglam.close();
}

await tarayici.close();
sunucu.kill();

let sorun = 0;
for (const r of raporlar) {
  if (r.hata.length) { sorun++; console.error(`✗ ${r.ad}: ${r.hata.join(' | ')}`); }
  else console.log(`✓ ${r.ad} — ${r.olcu}, ${r.recete} örnek reçete, koyu tema`);
}
process.exit(sorun ? 1 : 0);
