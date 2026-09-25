#!/usr/bin/env node
// Tanıtım sayfasının ekran görüntülerini üretir: `node tools/gorsel-uret.mjs`.
//
// Neden bir araç: görüntüler elle alınınca sessizce eskiyor. Tanıtımdaki
// panel görüntüsü örnek hastalar Dari'ye çevrilmeden önce alınmıştı; Afgan hekime
// aylarca «Ayşe Yılmaz, Mehmet Demir, Zeynep Kaya» gösterdi ve bunu hiçbir
// test yakalamadı. Artık tek komutla yeniden üretiliyor.
//
// Üç görüntü:
//   panel.jpg   bilgisayarda giriş sayfası, yani reçete sayfası: solda form,
//               sağda canlı kâğıt. Örnek hasta, iki ilaç, ölçümler ve tanı
//               formdan (hekimin tıkladığı yerlerden) doldurulur.
//   mobil.png   telefonda panel (#/panel): 14 günlük grafik ve son reçeteler.
//   recete.jpg  basılan kâğıdın kendisi, açık temada ve yalnız kâğıt.
//               Ekrandaki düzenleme işaretleri (kesik çerçeveli «+» satırları)
//               yok: kâğıt kaydedilmiş örnek reçeteden, basıldığı gibi kurulur.
//               Önce elle alınıyordu ve kâğıt yeniden tasarlanınca eski
//               kâğıdı göstermeye devam etti.
// Tanıtım sayfası koyu; ilk ikisi koyu temada alınır. Kâğıt her temada beyaz.
// Büyük ikisi JPEG: PNG olarak panel 1 MB, kâğıt 720 KB'tı ve panel sayfanın
// ilk ekranında hemen yükleniyor; tanıtım yavaş bağlantıdaki hekim için.
// Telefon görüntüsü PNG'de de küçük.
//
// Playwright bu projenin bağımlılığı değil; kurulu değilse betik atlanır.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gercekVeriBul } from './gercek-veri.mjs';

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
// Tanı klinik listeden, Türkçe karşılığıyla bulunur (adı değişse de); çipte ve
// kâğıtta İngilizce adı (`en`) duruyor.
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
  // Görüntünün kendisi taranamıyor (JPEG); içindeki yazı çekimden ÖNCE
  // taranıyor: tasarım görselinin gerçek görünen verisi tanıtıma girmesin.
  const gercek = gercekVeriBul(await sayfa.evaluate(() => document.body.textContent));
  if (gercek.length) throw new Error(`görüntüye gerçek görünen veri girecekti (${gercek.length} ifade)`);
}

/** Reçete sayfasını hekimin yaptığı gibi doldurur: hasta, ölçümler, tanı ve
 *  iki ilaç. Kullanım/doz yine boş (bkz. RECETE_YAZ). */
async function receteDoldur(sayfa) {
  await sayfa.waitForSelector('.recete-duzen .kagit');
  await sayfa.click('.recete-form .secim-alani');
  await sayfa.click('.ortu .liste__satir--tiklanir:has-text("محمد نعیم رحیمی")');
  await sayfa.waitForSelector('.ortu', { state: 'detached' });
  // Kan basıncı formda iki kutu (sistolik / diyastolik).
  for (const [ad, deger] of [['bp_sis', '130'], ['bp_dia', '85'], ['pr', '78'], ['rr', '18'], ['bw', '74'], ['temp', '38.2'], ['spo2', '97']]) {
    await sayfa.fill(`input[name=olcum_${ad}]`, deger);
  }
  // Tanı formdaki satır içi aramadan (çip olarak görünsün); belirti ve
  // tetkik kartları boş kalmasın diye ikişer işaret.
  await sayfa.fill('input[name=taniArama]', TANI.en);
  await sayfa.click(`.tani-sonuc__satir:has(.liste__baslik:text-is("${TANI.en}"))`);
  for (const kart of ['.kart--belirti', '.kart--lab']) {
    for (const n of [0, 1]) await sayfa.check(`${kart} input[type=checkbox] >> nth=${n}`);
  }
  // İki ilaç, formdaki aramadan: sonuç satırı satır kutusunu ilaç seçili açıyor.
  for (const ad of ['Panadol', 'Glucophage']) {
    await sayfa.fill('.recete-form input[name=ilacArama]', ad);
    await sayfa.click(`.ilac-sonuc__satir:has(.liste__baslik:text-is("${ad}")) >> nth=0`);
    await sayfa.click(`.modal button:has-text("${T('genel.ekle')}")`);
    await sayfa.waitForSelector('.ortu', { state: 'detached' });
  }
  await sayfa.waitForSelector('.kagit-tuval [data-rol=ilac] >> nth=1');
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
    belirtiler: 'Fever، Cough', tani: tani.en, taniKodu: tani.kod, laboratuvar: 'CBC',
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

// --- Bilgisayar ekranı: tasarımın çizildiği 1536×1024. Giriş sayfası.
// 1600×1000'de kâğıdın dibi ve alt şerit görüntünün dışında kalıyordu.
{
  const { baglam, sayfa, kac, hatalar } = await hazirla({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: 2 });
  await receteDoldur(sayfa);
  await bitir(sayfa);
  await sayfa.screenshot({ path: CIKTI + 'panel.jpg', type: 'jpeg', quality: 85 });
  raporlar.push({ ad: 'panel.jpg', olcu: '1536×1024 (tasarımın ölçüsü), reçete sayfası', recete: kac, hata: hatalar });
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
  // Kesim içeriye yuvarlanıyor: öğenin kutusu küsuratlı ve öğe görüntüsü
  // dışarı yuvarlıyordu; sağda ve altta 2 piksellik sayfa zemini ile
  // kenarlıktan taşan renk izleri kalıyordu.
  const k = await sayfa.locator('.gorsel-tuval [data-rol=sayfa] >> nth=0').boundingBox();
  const x = Math.ceil(k.x), y = Math.ceil(k.y);
  await sayfa.screenshot({
    path: CIKTI + 'recete.jpg', type: 'jpeg', quality: 88,
    clip: { x, y, width: Math.floor(k.x + k.width) - x, height: Math.floor(k.y + k.height) - y },
  });
  raporlar.push({ ad: 'recete.jpg', olcu: 'kâğıt, 2×', recete: kac + 1, hata: hatalar });
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
