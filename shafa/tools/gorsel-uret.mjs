#!/usr/bin/env node
// Tanıtım sayfasının ekran görüntülerini üretir: `node tools/gorsel-uret.mjs`.
//
// Neden bir araç: görüntüler elle alınınca sessizce eskiyor. Tanıtımdaki
// panel.png örnek hastalar Dari'ye çevrilmeden önce alınmıştı; Afgan hekime
// aylarca «Ayşe Yılmaz, Mehmet Demir, Zeynep Kaya» gösterdi ve bunu hiçbir
// test yakalamadı. Artık tek komutla yeniden üretiliyor.
//
// Üç görüntü:
//   panel.png   bilgisayarda giriş sayfası, yani reçete sayfası: solda form,
//               sağda canlı kâğıt. Örnek hasta, iki ilaç, ölçümler ve tanı
//               formdan (hekimin tıkladığı yerlerden) doldurulur.
//   mobil.png   telefonda panel (#/panel): 14 günlük grafik ve son reçeteler.
//   recete.png  basılan kâğıdın kendisi, açık temada ve yalnız kâğıt.
//               Ekrandaki düzenleme işaretleri (kesik çerçeveli «+» satırları)
//               yok: kâğıt kaydedilmiş örnek reçeteden, basıldığı gibi kurulur.
//               Önce elle alınıyordu ve kâğıt yeniden tasarlanınca eski
//               kâğıdı göstermeye devam etti.
// Tanıtım sayfası koyu; ilk ikisi koyu temada alınır. Kâğıt her temada beyaz.
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

const PORT = Number(process.env.GORSEL_PORT) || 8794;
const KOK = `http://localhost:${PORT}/?nosw=1`;
const CIKTI = fileURLToPath(new URL('../tanitim/gorsel/', import.meta.url));

// Düğme yazısı sözlükten okunur: burada elle yazılsa sözlük değiştiğinde
// betik sessizce zaman aşımına düşerdi.
const SOZLUK = JSON.parse(await readFile(new URL('../app/i18n/fa.json', import.meta.url), 'utf8'));
const T = (a) => { if (!SOZLUK[a]) throw new Error('sözlükte yok: ' + a); return SOZLUK[a]; };
// Tanı adı klinik listeden, Türkçe karşılığıyla bulunur (Farsça ad değişse de).
const KLINIK = JSON.parse(await readFile(new URL('../app/veri/klinik.json', import.meta.url), 'utf8'));
const TANI = KLINIK.tanilar.find((x) => x.tr === 'Üst solunum yolu enfeksiyonu');
if (!TANI) throw new Error('klinik listede tanı yok');

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

/** Örnek veri ve reçetelerle bir bağlam açar, `yol`daki sayfaya gider. */
async function hazirla(ayar, { yol = '', tema = 'karanlik' } = {}) {
  const baglam = await tarayici.newContext({ ...ayar });
  await baglam.addInitScript((t) => {
    try { localStorage.setItem('ecz-tema', t); } catch { /* engelliyse varsayılan kalır */ }
  }, tema);
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

  await sayfa.goto(KOK + yol, { waitUntil: 'networkidle' });
  await sayfa.waitForSelector('#sayfa');
  await bitir(sayfa);
  const gercekTema = await sayfa.evaluate(() => document.documentElement.dataset.tema);
  if (gercekTema !== tema) throw new Error(`tema ${tema} değil: ${gercekTema}`);
  const bant = await sayfa.$$eval('.bant', (a) => a.map((x) => x.textContent.trim().slice(0, 60)));
  if (bant.length) throw new Error('uyarı bandı görüntüye girecekti: ' + bant.join(' | '));
  return { baglam, sayfa, kac, hatalar };
}

/** Hareket bitsin, odak ve fare hiçbir şeyi vurgulamasın; görüntüde kutu,
 *  bildirim ya da takvim kalmasın. */
async function bitir(sayfa) {
  await sayfa.waitForTimeout(400);
  // Sayaçlar requestAnimationFrame ile sayıyor, sütunlar CSS ile açılıyor.
  await sayfa.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
  await sayfa.mouse.move(1, 1);
  await sayfa.evaluate(() => document.activeElement?.blur());
  await sayfa.waitForSelector('.bildirim', { state: 'detached', timeout: 8000 });
  await sayfa.waitForTimeout(900);
  const kalan = await sayfa.$$eval('.ortu, .tarih-kutu, .bildirim', (a) => a.map((x) => x.className));
  if (kalan.length) throw new Error('görüntüye kutu ya da bildirim girecekti: ' + kalan.join(', '));
}

/** Reçete sayfasını hekimin yaptığı gibi doldurur: hasta, ölçümler, tanı ve
 *  iki ilaç. Kullanım/doz yine boş (bkz. RECETE_YAZ). */
async function receteDoldur(sayfa) {
  await sayfa.waitForSelector('.recete-duzen .kagit');
  await sayfa.click('.recete-form .secim-alani');
  await sayfa.click('.ortu .liste__satir--tiklanir:has-text("محمد نعیم رحیمی")');
  await sayfa.waitForSelector('.ortu', { state: 'detached' });
  for (const [ad, deger] of [['bp', '130/85'], ['pr', '78'], ['rr', '18'], ['bw', '74'], ['temp', '38.2'], ['spo2', '97']]) {
    await sayfa.fill(`input[name=olcum_${ad}]`, deger);
  }
  await sayfa.click('.kagit-tuval [data-alan="tani"]');
  await sayfa.click(`.modal .klinik-liste .cip-kume:not(.klinik-gecmis):not(.klinik-yaygin) .cip--secilir:has(span:text-is("${TANI.ad}"))`);
  await sayfa.click(`.modal button:has-text("${T('genel.sec')}")`);
  await sayfa.waitForSelector('.ortu', { state: 'detached' });
  // İki ilaç: üçüncüsünde tablo kayıyor ve ilk satır yarım görünüyordu.
  for (const ad of ['Panadol 500', 'Glucophage']) {
    await sayfa.click('.recete-form .ilac-bas__ekle');
    await sayfa.fill('.modal input[name=ilacArama]', ad.split(' ')[0]);
    await sayfa.click(`.modal .liste__satir--tiklanir:has-text("${ad}") >> nth=0`);
    await sayfa.click(`.modal button:has-text("${T('genel.ekle')}")`);
    await sayfa.waitForSelector('.ortu', { state: 'detached' });
  }
  await sayfa.waitForSelector('.kagit__ilaclar li >> nth=1');
}

/** Kâğıdı basıldığı gibi kurar: örnek hastaya kayıtlı bir reçete (numarası
 *  ve doğrulama kodu kayıtta üretiliyor), ekranın sol üstünde, ölçeksiz. */
const KAGIT_KUR = async (tani) => {
  const { yerelDepoAc } = await import('./js/depo/idb.js');
  const { receteKaydet } = await import('./js/depo/recete.js');
  const { bosRecete } = await import('./js/paylasilan/recete.js');
  const { ilacEtiketi } = await import('./js/paylasilan/ilac.js');
  const { kagitCiz } = await import('./js/kagit.js');
  const depo = await yerelDepoAc();
  const ayar = await depo.ayarlar();
  const hasta = (await depo.listele('hastalar')).find((h) => h.ad === 'محمد نعیم');
  const ilaclar = await depo.listele('ilaclar');
  const ilac = (ad) => ilaclar.find((i) => i.ad === ad);
  const d = new Date();
  const gun = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const recete = await receteKaydet(depo, {
    ...bosRecete(ayar, gun), hastaId: hasta.id, kanGrubu: hasta.kanGrubu,
    belirtiler: 'تب، سرفه', tani: tani.ad, taniKodu: tani.kod, laboratuvar: 'CBC',
    olcumler: { bp: '130/85', pr: '78', rr: '18', bw: '74', temp: '38.2', spo2: '97' },
    satirlar: ['Panadol', 'Glucophage', 'Ventolin'].map((ad) => ({
      ilacId: ilac(ad).id, ilacAdi: ilacEtiketi(ilac(ad)), form: ilac(ad).form, adet: 1, kullanim: '', sure: '', yol: '', not: '',
    })),
  });
  const tuval = document.createElement('div');
  tuval.className = 'kagit-tuval gorsel-tuval';
  tuval.style.cssText = 'position:fixed;inset:0 auto auto 0;z-index:999;background:#fff';
  tuval.append(kagitCiz({ ayar, recete, hasta }));
  document.body.append(tuval);
  await document.fonts.ready;
};

const raporlar = [];

// --- Bilgisayar ekranı: 16:10, gerçek bir monitör oranı. Giriş sayfası.
{
  const { baglam, sayfa, kac, hatalar } = await hazirla({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  await receteDoldur(sayfa);
  await bitir(sayfa);
  await sayfa.screenshot({ path: CIKTI + 'panel.png' });
  raporlar.push({ ad: 'panel.png', olcu: '1600×1000 (16:10), reçete sayfası', recete: kac, hata: hatalar });
  await baglam.close();
}

// --- Telefon
{
  const { baglam, sayfa, kac, hatalar } = await hazirla({
    viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
  }, { yol: '#/panel' });
  await sayfa.screenshot({ path: CIKTI + 'mobil.png' });
  raporlar.push({ ad: 'mobil.png', olcu: '390×780, panel', recete: kac, hata: hatalar });
  await baglam.close();
}

// --- Basılan kâğıt: açık tema, yalnız kâğıt (194 mm = 733 px, iki kat).
{
  const { baglam, sayfa, kac, hatalar } = await hazirla({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 2 }, { tema: 'aydinlik' });
  await sayfa.evaluate(KAGIT_KUR, TANI);
  await bitir(sayfa);
  await sayfa.locator('.gorsel-tuval .kagit').screenshot({ path: CIKTI + 'recete.png' });
  raporlar.push({ ad: 'recete.png', olcu: 'kâğıt, 2×', recete: kac + 1, hata: hatalar });
  await baglam.close();
}

await tarayici.close();
sunucu.kill();

let sorun = 0;
for (const r of raporlar) {
  if (r.hata.length) { sorun++; console.error(`✗ ${r.ad}: ${r.hata.join(' | ')}`); }
  else console.log(`✓ ${r.ad} — ${r.olcu}, ${r.recete} örnek reçete`);
}
process.exit(sorun ? 1 : 0);
