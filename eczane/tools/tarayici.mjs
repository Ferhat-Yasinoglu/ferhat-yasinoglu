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

// Arayüz Farsça olduğu için seçiciler sözlükten okunur: bir çeviri yeniden
// yazılınca deneme kırılmaz, sözlükle birlikte kendiliğinden güncellenir.
const sozluk = JSON.parse(await readFile(new URL('../app/i18n/fa.json', import.meta.url), 'utf8'));
const T = (anahtar) => {
  const metin = sozluk[anahtar];
  if (!metin) throw new Error(`sözlükte yok: ${anahtar}`);
  return metin;
};

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
// Açık bir bağlam: yan sekmeler aynı IndexedDB'yi görsün diye gerekli.
const baglam = await tarayici.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const sayfa = await baglam.newPage();
sayfa.on('console', (m) => { if (m.type() === 'error') hatalar.push('console: ' + m.text()); });
sayfa.on('pageerror', (e) => hatalar.push('pageerror: ' + e.message));

await sayfa.goto(KOK, { waitUntil: 'networkidle' });
await sayfa.waitForSelector('#kenar-menu a');
ok('uygulama açıldı, menü çizildi');

// --- Panel boşken doğru şeyi söylüyor mu?
await sayfa.waitForSelector(`text=${T('panel.bos')}`);
ok('boş panel "uygulama boş" diyor');

// --- Ayarlar: örnek veri yükle
await sayfa.click('#kenar-menu a[href="#/ayarlar"]');
await sayfa.click(`button:has-text("${T('ayar.ornek_yukle')}")`);
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
for (const beklenen of [T('ilac.stok_yok'), T('ilac.stok_az'), T('ilac.skt_gecti'), T('ilac.skt_yakin')]) {
  if (!rozetler.includes(beklenen)) throw new Error(`"${beklenen}" rozeti yok. Görülenler: ${rozetler.join(', ')}`);
}
ok('stok ve son kullanma rozetleri doğru: ' + [...new Set(rozetler)].join(', '));

// --- Arama: etken maddeden muadil bulma
await sayfa.fill('#sayfa input[type=search]', 'amoksisilin');
await sayfa.waitForFunction(() => document.querySelectorAll('.tablo tbody tr').length === 2);
ok('etken madde araması 2 muadili buldu');
await sayfa.fill('#sayfa input[type=search]', '');

// --- Süzgeç
await sayfa.selectOption('#sayfa select', { label: T('suzgec.skt_gecti') });
await sayfa.waitForFunction(() => document.querySelectorAll('.tablo tbody tr').length === 1);
ok('SKT geçmişler süzgeci 1 ilaç bıraktı');
await sayfa.selectOption('#sayfa select', { label: T('suzgec.') });
await sayfa.waitForFunction(() => document.querySelectorAll('.tablo tbody tr').length === 8);

await resim(sayfa, '1-ilaclar.png');

// --- Yeni ilaç ekle
await sayfa.click(`button:has-text("${T('ilac.ekle')}")`);
await sayfa.waitForSelector('.modal');
await sayfa.fill('.modal input[name=ad]', 'Aferin');
await sayfa.fill('.modal input[name=etkenMadde]', 'Parasetamol + Klorfeniramin');
await sayfa.fill('.modal input[name=doz]', '500 mg');
await sayfa.fill('.modal input[name=stok]', '12');
await sayfa.fill('.modal input[name=satisFiyati]', '36.9');
await sayfa.fill('.modal input[name=barkod]', '123');           // bilerek geçersiz
await sayfa.click(`.modal button:has-text("${T('genel.kaydet')}")`);
await sayfa.waitForSelector('.alan__hata');
const barkodHatasi = (await sayfa.textContent('.alan__hata')).trim();
if (barkodHatasi !== T('dogrula.barkod_bicim')) throw new Error('doğrulama metni çevrilmemiş: ' + barkodHatasi);
ok('geçersiz barkod Farsça uyarıyla yakalandı: ' + barkodHatasi);
await sayfa.fill('.modal input[name=barkod]', '8699546010999');
await sayfa.click(`.modal button:has-text("${T('genel.kaydet')}")`);
await sayfa.waitForFunction(() => document.querySelectorAll('.tablo tbody tr').length === 9);
ok('yeni ilaç eklendi, liste 9 satır');

// --- İlaç kartı ve stok işlemi
await sayfa.click('.tablo tbody tr:has-text("Aferin")');
await sayfa.waitForSelector('h1:has-text("Aferin")');
const stokMetni = () => sayfa.textContent(`.kart .izgara div:has(.alan__etiket:text-is("${T('ilac.stok')}")) strong`);
if ((await stokMetni()).trim() !== '12') throw new Error('başlangıç stoğu 12 değil: ' + await stokMetni());
ok('başlangıç stoğu mal girişi olarak işlendi (12)');

await sayfa.click(`button:has-text("${T('stok.islem')}")`);
await sayfa.waitForSelector('.modal');
await sayfa.selectOption('.modal select[name=tur]', { label: T('hareket.fire') });
await sayfa.fill('.modal input[name=adet]', '3');
await sayfa.fill('.modal textarea[name=aciklama]', 'kutu ezildi');
await sayfa.click(`.modal button:has-text("${T('genel.uygula')}")`);
await sayfa.waitForFunction((etiket) => {
  const h = [...document.querySelectorAll('.alan__etiket')].find((x) => x.textContent === etiket);
  return h?.nextElementSibling?.textContent.trim() === '9';
}, T('ilac.stok'));
ok('fire işlemi stoğu 12 → 9 yaptı');

const hareketSatiri = await sayfa.textContent('.tablo tbody tr');
if (!hareketSatiri.includes('kutu ezildi') || !hareketSatiri.includes('-3')) throw new Error('hareket kaydı eksik: ' + hareketSatiri);
ok('hareket geçmişine "-3 · kutu ezildi" yazıldı');

// --- Stok yetersizliği engelleniyor mu?
await sayfa.click(`button:has-text("${T('stok.islem')}")`);
await sayfa.selectOption('.modal select[name=tur]', { label: T('hareket.sayim') });
await sayfa.fill('.modal input[name=adet]', '4');
await sayfa.click(`.modal button:has-text("${T('genel.uygula')}")`);
await sayfa.waitForFunction((etiket) => {
  const h = [...document.querySelectorAll('.alan__etiket')].find((x) => x.textContent === etiket);
  return h?.nextElementSibling?.textContent.trim() === '4';
}, T('ilac.stok'));
ok('sayım düzeltmesi stoğu 4\'e eşitledi');
await resim(sayfa, '2-ilac-karti.png');

// --- Muadil bağlantısı
await sayfa.goto(KOK + '#/ilaclar');
await sayfa.click('.tablo tbody tr:has-text("Augmentin")');
await sayfa.waitForSelector(`h2:has-text("${T('ilac.muadiller')}")`);
const muadil = await sayfa.textContent(`.kart:has(h2:text-is("${T('ilac.muadiller')}")) .liste__baslik`);
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

// --- Eczane ve doktor bilgileri (reçete antedine düşecek)
await sayfa.click('#kenar-menu a[href="#/ayarlar"]');
await sayfa.waitForSelector('input[name=klinikAdi]');
await sayfa.fill('input[name=klinikAdi]', 'Deneme Eczanesi');
await sayfa.fill('input[name=klinikAdiAlt]', 'Sample Pharmacy');
await sayfa.fill('input[name=doktorUnvan]', 'Dr.');
await sayfa.fill('input[name=doktorAd]', 'Ahmet Yılmaz');
await sayfa.fill('input[name=doktorAdAlt]', 'د. احمد یلماز');
await sayfa.fill('input[name=uzmanlik]', 'Dahiliye');
await sayfa.fill('input[name=diplomaNo]', '123456');
await sayfa.fill('input[name=telefon]', '0700000000');
await sayfa.fill('input[name=ulkeKodu]', '93');
await sayfa.fill('input[name=adres]', 'Kabil, Afganistan');
await sayfa.click(`button:has-text("${T('ayar.antet_kaydet')}")`);
await sayfa.waitForSelector('.bildirim--basari');
ok('reçete anteti (klinik, doktor, iletişim) kaydedildi');

// --- Hasta kartından reçete yazma (Zeynep'in ibuprofen alerjisi var)
await sayfa.click('#kenar-menu a[href="#/hastalar"]');
await sayfa.click('.liste__satir:has-text("Zeynep Kaya")');
await sayfa.click(`button:has-text("${T('recete.yaz')}")`);
await sayfa.waitForSelector(`h1:has-text("${T('recete.yeni')}")`);
if (!(await sayfa.textContent('.kart')).includes('Zeynep Kaya')) throw new Error('hasta reçeteye taşınmadı');
ok('hasta kartından reçete açıldı, hasta önceden seçili geldi');

// --- Alerjili ilaç: uyarı satır eklenmeden önce çıkmalı
await sayfa.click(`button:has-text("${T('recete.ilac_ekle')}")`);
await sayfa.fill('.modal input[name=ilacArama]', 'nurofen');
await sayfa.click('.modal .liste__satir:has-text("Nurofen")');
await sayfa.waitForSelector('.modal .uyari--hata');
const alerjiUyarisi = await sayfa.textContent('.modal .uyari--hata');
if (!alerjiUyarisi.includes('İbuprofen')) throw new Error('alerji uyarısı yok: ' + alerjiUyarisi);
ok('ilaç seçilince alerji uyarısı çıktı: ' + alerjiUyarisi.trim());

await sayfa.fill('.modal input[name=adet]', '2');
await sayfa.fill('.modal input[name=kullanim]', 'Günde 2×1');
await sayfa.fill('.modal input[name=sure]', '5 gün');
await sayfa.click(`.modal button:has-text("${T('genel.ekle')}")`);
await sayfa.waitForSelector('.tablo tbody tr:has-text("Nurofen")');
ok('alerjili ilaç uyarısıyla birlikte reçeteye eklendi');

// --- İkinci ilaç
await sayfa.click(`button:has-text("${T('recete.ilac_ekle')}")`);
await sayfa.fill('.modal input[name=ilacArama]', 'parol');
await sayfa.click('.modal .liste__satir:has-text("Parol")');
await sayfa.fill('.modal input[name=adet]', '1');
await sayfa.click(`.modal button:has-text("${T('genel.ekle')}")`);
await sayfa.waitForFunction(() => document.querySelectorAll('.tablo tbody tr').length === 2);
await sayfa.fill('input[name=tani]', 'Üst solunum yolu enfeksiyonu');
await sayfa.fill('input[name=taniKodu]', 'J06.9');
await sayfa.fill('input[name=olcum_bp]', '110/70');
await sayfa.fill('input[name=olcum_temp]', '38.2');
ok('ikinci ilaç, tanı ve klinik ölçümler eklendi');
await resim(sayfa, '7-recete-yaz.png', { fullPage: true });

// --- Kaydet
await sayfa.click(`button:has-text("${T('recete.kaydet')}")`);
await sayfa.waitForSelector(`h2:has-text("${T('recete.karsilama')}")`);
const receteNo = (await sayfa.textContent('h1')).trim();
if (!/^\d{4}-\d{2}-\d{2}-\d{2}$/.test(receteNo)) throw new Error('reçete numarası beklenen biçimde değil: ' + receteNo);
ok('reçete kaydedildi, numara kendiliğinden verildi: ' + receteNo);

// --- Karşılama: bir satır verilir, stoktan düşer.
// Stok yan sekmeden okunur: reçete sayfasından ayrılmadan bakılır ve aynı
// IndexedDB'yi iki sekmenin paylaştığı da böylece doğrulanmış olur.
const yanSekmede = async (hash, is) => {
  const yan = await baglam.newPage();
  await yan.goto(KOK + hash, { waitUntil: 'networkidle' });
  const sonuc = await is(yan);
  await yan.close();
  return sonuc;
};
const stokOku = (ad) => yanSekmede('#/ilaclar', async (yan) => {
  const secici = `.tablo tbody tr:has-text("${ad}") strong`;
  await yan.waitForSelector(secici);
  return Number((await yan.textContent(secici)).trim());
});

const nurofenOnce = await stokOku('Nurofen');
await sayfa.click(`.tablo tbody tr:has-text("Nurofen") button:text-is("${T('recete.ver')}")`);
await sayfa.waitForSelector('.tablo tbody tr:has-text("Nurofen") .rozet--yesil');
const nurofenSonra = await stokOku('Nurofen');
if (nurofenSonra !== nurofenOnce - 2) throw new Error(`stok ${nurofenOnce} → ${nurofenSonra}, 2 düşmeliydi`);
ok(`satır verildi, stok ${nurofenOnce} → ${nurofenSonra} düştü`);

// --- Stok hareketi reçeteye bağlandı mı?
const sonHareket = await yanSekmede('#/ilaclar', async (yan) => {
  await yan.click('.tablo tbody tr:has-text("Nurofen")');
  await yan.waitForSelector(`h2:has-text("${T('stok.hareketler')}")`);
  return yan.textContent('.tablo tbody tr');
});
if (!sonHareket.includes(receteNo) || !sonHareket.includes('-2')) throw new Error('hareket reçeteye bağlanmadı: ' + sonHareket);
ok('stok hareketi reçete numarasıyla kaydedildi');

// --- İkinci satır verilemedi
await sayfa.click(`.tablo tbody tr:has-text("Parol") button:has-text("${T('recete.verilemedi')}")`);
await sayfa.selectOption('.modal select', { label: T('sebep.hasta_istemedi') });
await sayfa.click(`.modal button:has-text("${T('recete.isaretle')}")`);
await sayfa.waitForSelector('.tablo tbody tr:has-text("Parol") .rozet--kirmizi');
await sayfa.waitForSelector('.kart__bas .rozet--yesil');
ok('ikinci satır sebebiyle kapandı, reçete "Tamamlandı" oldu');

// --- Kapanmış satırın düğmeleri ve tabloya sızan metin
const parolSatiri = sayfa.locator('.tablo tbody tr:has-text("Parol")');
if (await parolSatiri.locator(`button:text-is("${T('recete.ver')}")`).count()) throw new Error('kapanmış satırda hâlâ "Ver" düğmesi var');
if (!await parolSatiri.locator(`button:has-text("${T('recete.geri_al')}")`).count()) throw new Error('kapanmış satırda "Geri al" düğmesi yok');
const karsilamaMetni = await sayfa.textContent(`.kart:has(h2:text-is("${T('recete.karsilama')}"))`);
if (/\bnull\b/.test(karsilamaMetni)) throw new Error('karşılama tablosuna düz metin "null" sızmış');
ok('kapanmış satır yalnız "Geri al" gösteriyor, tabloya metin sızmıyor');
await resim(sayfa, '8-recete-karsilama.png', { fullPage: true });

// --- Geri alma stoğu iade eder
await sayfa.click(`.tablo tbody tr:has-text("Nurofen") button:has-text("${T('recete.geri_al')}")`);
await sayfa.click(`.ortu button:has-text("${T('recete.geri_al')}")`);
await sayfa.waitForSelector('.tablo tbody tr:has-text("Nurofen") .rozet--gri');
const nurofenGeri = await stokOku('Nurofen');
if (nurofenGeri !== nurofenOnce) throw new Error(`iade sonrası stok ${nurofenGeri}, ${nurofenOnce} olmalıydı`);
ok(`geri alma stoğu iade etti: ${nurofenSonra} → ${nurofenGeri}`);

// --- Yazdırma alanı: ekranda gizli, içeriği eksiksiz
const yazdirMetni = await sayfa.textContent('.yazdir-alan');
for (const beklenen of ['Deneme Eczanesi', 'Sample Pharmacy', 'Dr. Ahmet Yılmaz', '123456', 'Zeynep Kaya', 'J06.9', 'Nurofen', T('hasta.alerji')]) {
  if (!yazdirMetni.includes(beklenen)) throw new Error(`reçete çıktısında "${beklenen}" yok`);
}
if (await sayfa.isVisible('.yazdir-alan')) throw new Error('yazdırma alanı ekranda görünüyor');
ok('reçete çıktısı antet, hasta, tanı ve alerjiyle hazır (ekranda gizli)');

// --- QR ve klinik ölçüm sütunu kâğıtta yerinde mi?
const qrModulSayisi = await sayfa.locator('.kagit__qr path').count();
if (!qrModulSayisi) throw new Error('kâğıtta QR yok');
const qrYolu = await sayfa.getAttribute('.kagit__qr path', 'd');
if (!qrYolu || qrYolu.length < 200) throw new Error('QR yolu beklenenden kısa: ' + (qrYolu || '').length);
const olcumSayisi = await sayfa.locator('.kagit__olcum').count();
if (olcumSayisi !== 5) throw new Error(`klinik sütunda 5 ölçüm bekleniyordu, ${olcumSayisi} var`);
const olcumMetni = await sayfa.textContent('.kagit__klinik-sutun');
if (!olcumMetni.includes('110/70 mmHg') || !olcumMetni.includes('38.2 °C')) {
  throw new Error('girilen ölçümler kâğıda basılmamış: ' + olcumMetni.replace(/\s+/g, ' '));
}
// Girilmeyen ölçümler elle yazılsın diye çizgi olarak basılır.
const bosOlcum = await sayfa.locator('.kagit__olcum .kagit__cizgi').count();
if (bosOlcum !== 3) throw new Error(`boş ölçümlerde 3 çizgi bekleniyordu, ${bosOlcum} var`);
ok(`kâğıtta QR (${qrYolu.length} karakterlik yol), dolu ölçümler yazılı, boş 3 ölçüm elle doldurulmak üzere çizgili`);

// --- Boş kâğıt: aynı antet, elle doldurulacak satırlar
const bosKagit = await sayfa.evaluate(async () => {
  const { kagitCiz } = await import('./js/kagit.js');
  const { yerelDepoAc } = await import('./js/depo/idb.js');
  const depo = await yerelDepoAc();
  const kagit = kagitCiz({ ayar: await depo.ayarlar(), bos: true });
  return {
    metin: kagit.textContent,
    bosSatir: kagit.querySelectorAll('.kagit__bos-satir').length,
    cizgi: kagit.querySelectorAll('.kagit__cizgi').length,
    qr: kagit.querySelectorAll('.kagit__qr').length,
  };
});
if (bosKagit.bosSatir < 5) throw new Error('boş kâğıtta yazı satırı yok');
if (!bosKagit.cizgi) throw new Error('boş kâğıtta doldurulacak çizgiler yok');
if (!bosKagit.metin.includes('Deneme Eczanesi')) throw new Error('boş kâğıtta antet yok');
if (bosKagit.metin.includes('Zeynep')) throw new Error('boş kâğıtta hasta bilgisi sızmış');
ok(`boş kâğıt hazır: antet duruyor, ${bosKagit.bosSatir} yazı satırı + ${bosKagit.cizgi} doldurma çizgisi, hasta bilgisi yok`);

// --- Gönder: WhatsApp bağlantısı ve metin
await sayfa.evaluate(() => { window.__acilan = null; window.open = (u) => { window.__acilan = u; return null; }; });
await sayfa.click(`button:has-text("${T('paylas.gonder')}")`);
await sayfa.waitForSelector('.modal textarea');
const gonderilecek = await sayfa.inputValue('.modal textarea');
for (const beklenen of ['Deneme Eczanesi', 'Zeynep Kaya', 'Nurofen', 'İbuprofen']) {
  if (!gonderilecek.includes(beklenen)) throw new Error(`gönderilecek metinde "${beklenen}" yok`);
}
await sayfa.click(`.modal button:has-text("${T('paylas.whatsapp')}")`);
const acilan = await sayfa.evaluate(() => window.__acilan);
if (!acilan?.startsWith('https://wa.me/93535')) throw new Error('WhatsApp bağlantısı beklenen numarayla açılmadı: ' + acilan);
if (!decodeURIComponent(acilan).includes('Nurofen')) throw new Error('WhatsApp bağlantısında reçete metni yok');
ok('gönder: WhatsApp bağlantısı hastanın numarasıyla ve reçete metniyle kuruldu');
await sayfa.click(`.modal button:has-text("${T('genel.kapat')}")`);
await sayfa.emulateMedia({ media: 'print' });
await resim(sayfa, '9-recete-cikti.png', { fullPage: true });
await sayfa.emulateMedia({ media: 'screen' });

// --- Reçete listesi ve süzgeç
await sayfa.click('#kenar-menu a[href="#/receteler"]');
await sayfa.waitForSelector(`h1:has-text("${T('nav.receteler')}")`);
await sayfa.waitForSelector('.tablo tbody tr:has-text("Zeynep Kaya")');
await sayfa.selectOption('#sayfa select', { label: T('recete.suzgec.acik') });
await sayfa.waitForFunction(() => document.querySelectorAll('.tablo tbody tr').length === 1);
ok('reçete listede göründü, "bekleyen ve kısmi" süzgeci onu buldu');

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
await sayfa.click(`button:has-text("${T('yedek.indir')}")`);
const dosya = await indirme;
const yol = await dosya.path();
const belge = JSON.parse(await readFile(yol, 'utf8'));
if (belge.bicim !== 'eczane-yedek' || belge.koleksiyonlar.ilaclar.length !== 9) {
  throw new Error('yedek içeriği beklenmedik: ' + JSON.stringify(Object.keys(belge)));
}
ok(`yedek indirildi (${dosya.suggestedFilename()}): 9 ilaç, ${belge.koleksiyonlar.hastalar.length} hasta, ${belge.koleksiyonlar.hareketler.length} hareket`);

// --- Arayüz tek dilli: Farsça ve sağdan sola
const yon = await sayfa.evaluate(() => [document.documentElement.dir, document.documentElement.lang]);
if (yon[0] !== 'rtl' || yon[1] !== 'fa') throw new Error('belge Farsça/sağdan sola değil: ' + yon.join(' '));
if (await sayfa.locator('.ust__dil').count()) throw new Error('dil seçici hâlâ duruyor');
const menuMetni = (await sayfa.textContent('#kenar-menu')).replace(/\s+/g, ' ').trim();
for (const anahtar of ['nav.panel', 'nav.ilaclar', 'nav.hastalar', 'nav.receteler', 'nav.ayarlar']) {
  if (!menuMetni.includes(T(anahtar))) throw new Error(`menüde ${T(anahtar)} yok: ${menuMetni}`);
}
// Koddaki Türkçe yedekler ekrana düşmemeli. Uyarı, hata ve tarih cümleleri
// saf modüllerde kod olarak durup arayüzde çevrildiği için asıl sınav burada:
// stok ve son kullanma uyarısı olan ilaç kartı ile reçete kartı taranır.
const TURKCE = ['Stok', 'İlaç', 'Hasta', 'Reçete', 'Bekleyen', 'Kaydet', 'gün önce', 'gün sonra', 'Son kullanma', 'Alerji', 'yaş'];
const turkceAra = async (nerede) => {
  const metin = await sayfa.textContent('#sayfa');
  for (const turkce of TURKCE) {
    if (metin.includes(turkce)) throw new Error(`${nerede}: çevrilmemiş Türkçe metin "${turkce}"`);
  }
};
await turkceAra('panel');

await sayfa.click('#kenar-menu a[href="#/ilaclar"]');
await sayfa.waitForSelector('.tablo tbody tr');
await turkceAra('ilaç listesi');
await sayfa.click('.tablo tbody tr:has-text("Majezik")');
await sayfa.waitForSelector('.uyari');
await turkceAra('ilaç kartı');

await sayfa.click('#kenar-menu a[href="#/receteler"]');
await sayfa.waitForSelector('.tablo tbody tr');
await sayfa.click('.tablo tbody tr');
await sayfa.waitForSelector(`h2:has-text("${T('recete.karsilama')}")`);
await turkceAra('reçete kartı');
ok('arayüz tek dilli: Farsça, sağdan sola, dil seçici yok; uyarı ve tarih cümleleri dahil hiçbir yerde Türkçe kalmamış');
await resim(sayfa, '10-farsca.png', { fullPage: true });

// --- Karanlık tema + dar ekran
await sayfa.click('.ust__tema');
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
