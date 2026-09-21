#!/usr/bin/env node
// Gerçek tarayıcıda uçtan uca deneme: `npm run deneme`.
// Uygulamayı açar, örnek veriyi yükler, ilaç ekler, reçete yazar, arar, yedek indirir;
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

// Klinik çipler Farsça yazıyor; denemede Türkçe karşılığından buluyoruz ki
// bir kayıt yeniden adlandırılınca burası da kendiliğinden güncellensin.
const klinik = JSON.parse(await readFile(new URL('../app/veri/klinik.json', import.meta.url), 'utf8'));
const klinikAdi = (liste, tr) => {
  const x = klinik[liste].find((y) => y.tr === tr);
  if (!x) throw new Error(`${liste} listesinde yok: ${tr}`);
  return x;
};
const taniAdi = (tr) => klinikAdi('tanilar', tr);
const belirtiAdi = (tr) => klinikAdi('belirtiler', tr);
const labAdi = (tr) => klinikAdi('laboratuvar', tr);

const PORT = 8799;
const KOK = `http://localhost:${PORT}/?nosw=1`;
const ekranBayragi = process.argv.indexOf('--ekran');
const EKRAN = ekranBayragi > -1 ? process.argv[ekranBayragi + 1] : '';
if (EKRAN) await mkdir(EKRAN, { recursive: true });

const hatalar = [];
let adim = 0;
const ok = (m) => console.log(`✓ ${++adim}. ${m}`);
const resim = async (sayfa, ad, sec) => {
  if (!EKRAN) return;
  // Animasyonlar bitmeden çekilen görüntü yarı saydam satırlar ve büyümemiş
  // sütunlar gösteriyor. CSS animasyonlarını bekle, sayaçların sayması için
  // de kısa bir pay bırak (o requestAnimationFrame ile yürüyor).
  await sayfa.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
  await sayfa.waitForTimeout(750);
  await sayfa.screenshot({ path: `${EKRAN}/${ad}`, ...sec });
};

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

// --- Arama: etken maddeden muadil bulma
await sayfa.fill('#sayfa input[type=search]', 'amoksisilin');
await sayfa.waitForFunction(() => document.querySelectorAll('.tablo tbody tr').length === 2);
ok('etken madde araması 2 muadili buldu');
await sayfa.fill('#sayfa input[type=search]', '');

// --- Süzgeç: yalnız reçeteli ilaçlar
await sayfa.selectOption('#sayfa select', { label: T('suzgec.receteli') });
await sayfa.waitForFunction(() => document.querySelectorAll('.tablo tbody tr').length === 6);
ok('"yalnız reçeteli" süzgeci 6 ilaç bıraktı');
await sayfa.selectOption('#sayfa select', { label: T('suzgec.') });
await sayfa.waitForFunction(() => document.querySelectorAll('.tablo tbody tr').length === 8);

await resim(sayfa, '1-ilaclar.png');

// --- Yeni ilaç ekle
await sayfa.click(`button:has-text("${T('ilac.ekle')}")`);
await sayfa.waitForSelector('.modal');
await sayfa.fill('.modal input[name=ad]', 'Aferin');
await sayfa.fill('.modal input[name=etkenMadde]', 'Parasetamol + Klorfeniramin');
await sayfa.fill('.modal input[name=doz]', '500 mg');
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

// --- İlaç kartı: künye doğru mu?
await sayfa.click('.tablo tbody tr:has-text("Aferin")');
await sayfa.waitForSelector('h1:has-text("Aferin")');
const kunyeMetni = await sayfa.textContent(`.kart:has(h2:text-is("${T('genel.kunye')}"))`);
for (const beklenen of ['Parasetamol + Klorfeniramin', '500 mg', '8699546010999']) {
  if (!kunyeMetni.includes(beklenen)) throw new Error(`künyede "${beklenen}" yok`);
}
if (/[0-9]+\s*(عدد|بسته)/.test(kunyeMetni)) throw new Error('künyede stok kalıntısı var');
ok('ilaç künyesi eksiksiz: etken madde, doz, barkod — stok alanı yok');
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
await sayfa.waitForSelector('input[name=doktorAd]');
// Örnek veriyle gelen antetin üstüne denemenin kendi bilgileri yazılır.
await sayfa.fill('input[name=doktorUnvan]', 'الحاج داکتر');
await sayfa.fill('input[name=doktorAd]', 'نمونه احمدی');
await sayfa.fill('input[name=doktorAdAlt]', 'Dr. Nemuna Ahmadi');
await sayfa.fill('input[name=uzmanlik]', 'معالج امراض داخله عمومی و اطفال');
await sayfa.fill('textarea[name=slogan]', 'سلامتی شما\nهدف ماست');
await sayfa.fill('input[name=klinikAdi]', 'Deneme Eczanesi');
await sayfa.fill('textarea[name=hizmetler]', 'ثبت و تشخیص گراف برقی قلب (ECG)\nماهر معاینات تلویزیونی (التراساند)');
await sayfa.fill('input[name=hizmetAlanlari]', '(قلب ، شش ، معده ، گرده)');
await sayfa.fill('input[name=deneyim]', 'سابقه کاری : شفاخانه نمونه');
await sayfa.fill('input[name=ayakEtiketleri]', 'قلب, شش, معده, اطفال');
await sayfa.fill('input[name=telefon]', '0700000000');
await sayfa.fill('input[name=ulkeKodu]', '93');
await sayfa.fill('input[name=adres]', 'کابل، افغانستان');
await sayfa.click(`button:has-text("${T('ayar.antet_kaydet')}")`);
await sayfa.waitForSelector('.bildirim--basari');
ok('reçete anteti kaydedildi (ad, ünvan şeridi, slogan, hizmetler, sabıka, rozetler, iletişim)');

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

// --- İkinci ilaç: kutuya hiç yazmadan, çiplerle
await sayfa.click(`button:has-text("${T('recete.ilac_ekle')}")`);
// Arama kutusu boşken de liste geliyor: hekim yazmadan gezinebilmeli.
await sayfa.waitForSelector('.modal .liste__satir--tiklanir');
const gezinilebilir = await sayfa.locator('.modal .liste__satir--tiklanir').count();
if (gezinilebilir < 3) throw new Error(`boş aramada gezinilecek liste yok, ${gezinilebilir} satır`);
ok(`ilaç kutusu boşken ${gezinilebilir} ilaç listeleniyor, aramadan seçilebiliyor`);

await sayfa.fill('.modal input[name=ilacArama]', 'parol');
await sayfa.click('.modal .liste__satir:has-text("Parol")');
await sayfa.fill('.modal input[name=adet]', '1');
// Kullanım ve süre de dokunarak: metin tam eşleşmeli, "۵ روز" ile "۱۵ روز"
// birbirinin içinde geçiyor.
const cipSec = async (metin) => sayfa.click(`.modal .cip--secilir:has(span:text-is("${metin}"))`);
await cipSec(T('kullanim.2'));
await cipSec(T('sure.0'));
await cipSec(T('yol.0'));
const cipKullanim = await sayfa.inputValue('.modal input[name=kullanim]');
const cipSure = await sayfa.inputValue('.modal input[name=sure]');
const cipYol = await sayfa.inputValue('.modal input[name=yol]');
if (cipKullanim !== T('kullanim.2')) throw new Error(`kullanım çipi yazmadı: "${cipKullanim}"`);
if (cipSure !== T('sure.0')) throw new Error(`süre çipi yazmadı: "${cipSure}"`);
if (cipYol !== T('yol.0')) throw new Error(`veriliş yolu çipi yazmadı: "${cipYol}"`);
ok(`kullanım, süre ve veriliş yolu çiple dolduruldu: ${cipKullanim} · ${cipSure} · ${cipYol}`);
await sayfa.click(`.modal button:has-text("${T('genel.ekle')}")`);
await sayfa.waitForFunction(() => document.querySelectorAll('.tablo tbody tr').length === 2);
await sayfa.fill('input[name=olcum_bp]', '110/70');
await sayfa.fill('input[name=olcum_temp]', '38.2');
ok('ikinci ilaç ve klinik ölçümler eklendi');

// --- Belirti, tanı ve laboratuvar ÇİPLE seçiliyor: hekim elle yazmıyor.
// Aynı ad hem belirti hem tanı olabiliyor (سردردی), ve "tüm liste" düğmesi
// üç kartta da var — seçiciler karta göre daraltılıyor.
const kart = (baslik) => `.kart:has(h2:text-is("${baslik}"))`;
const KART_BELIRTI = kart(T('recete.belirtiler'));
const KART_TANI = kart(T('recete.tani'));
const KART_LAB = kart(T('recete.laboratuvar'));
const cipTikla = (kapsayici, ad) => sayfa.click(`${kapsayici} .cip--secilir:has(span:text-is("${ad}"))`);

// Belirti: kart açılır açılmaz çipler duruyor, ikinci dokunuş geri alıyor.
const sarfa = belirtiAdi('Öksürük');
const tabB = belirtiAdi('Ateş');
await cipTikla(KART_BELIRTI, sarfa.ad);
await cipTikla(KART_BELIRTI, tabB.ad);
const belirtiMetni = await sayfa.inputValue('input[name=belirtiler]');
if (!belirtiMetni.includes(sarfa.ad) || !belirtiMetni.includes(tabB.ad)) {
  throw new Error(`belirti çipleri yazmadı: "${belirtiMetni}"`);
}
await cipTikla(KART_BELIRTI, tabB.ad);
const belirtiTek = await sayfa.inputValue('input[name=belirtiler]');
if (belirtiTek !== sarfa.ad) throw new Error(`belirti geri alınmadı: "${belirtiTek}"`);
ok(`belirti çiple seçildi ve geri alındı: ${belirtiTek}`);

// Tanı: ad ve ICD kodu birlikte geliyor.
const usye = taniAdi('Üst solunum yolu enfeksiyonu');
await cipTikla(KART_TANI, usye.ad);
const secilenTani = await sayfa.inputValue('input[name=tani]');
const secilenKod = await sayfa.inputValue('input[name=taniKodu]');
if (secilenTani !== usye.ad) throw new Error(`çip tanıyı yazmadı: "${secilenTani}"`);
if (secilenKod !== usye.kod) throw new Error(`çip ICD kodunu yazmadı: "${secilenKod}"`);
ok(`tanı tek dokunuşla yazıldı: ${usye.ad} (${usye.kod}), elle yazılmadı`);

await cipTikla(KART_TANI, usye.ad);
if (await sayfa.inputValue('input[name=tani]') !== '') throw new Error('ikinci dokunuş tanıyı geri almadı');
if (await sayfa.inputValue('input[name=taniKodu]') !== '') throw new Error('tanı geri alınınca kod kaldı');
await cipTikla(KART_TANI, usye.ad);
ok('çipe ikinci dokunuş tanıyı ve kodunu geri aldı');

// Tam liste kutusu: arayıp ikinci bir tanı ekle, sonra çıkar.
const dis = taniAdi('Diş ağrısı');
await sayfa.click(`${KART_TANI} button:has-text("${T('klinik.hepsi').replace(' ({n})', '')}")`);
await sayfa.waitForSelector('.modal input[name=klinikArama]');
await sayfa.fill('.modal input[name=klinikArama]', 'diş');
await sayfa.click(`.modal .cip--secilir:has(span:text-is("${dis.ad}"))`);
await sayfa.click(`.modal button:has-text("${T('genel.sec')}")`);
const ikiTani = await sayfa.inputValue('input[name=tani]');
const ikiKod = await sayfa.inputValue('input[name=taniKodu]');
if (!ikiTani.includes(usye.ad) || !ikiTani.includes(dis.ad)) throw new Error('iki tanı birleşmedi: ' + ikiTani);
if (!ikiKod.includes(usye.kod) || !ikiKod.includes(dis.kod)) throw new Error('iki kod birleşmedi: ' + ikiKod);
ok(`tam listeden ikinci tanı eklendi, ikisi birleşti: ${ikiTani} / ${ikiKod}`);

// İkinciyi geri al: reçetede yalnız ÜSYE kalsın (sonraki adımlar buna dayanıyor).
await cipTikla(KART_TANI, dis.ad);
const tekTani = await sayfa.inputValue('input[name=tani]');
const tekKod = await sayfa.inputValue('input[name=taniKodu]');
if (tekTani !== usye.ad || tekKod !== usye.kod) throw new Error(`tanı çıkarılınca kalan yanlış: "${tekTani}" / "${tekKod}"`);
ok('ikinci tanı çıkarıldı, kalanın kodu bozulmadı');

// Laboratuvar: tam liste kutusunda bölüm başlıkları (هماتولوژی…) altında.
const cbc = labAdi('Tam kan sayımı');
const xray = labAdi('Akciğer röntgeni');
await cipTikla(KART_LAB, cbc.ad);
await sayfa.click(`${KART_LAB} button:has-text("${T('klinik.hepsi').replace(' ({n})', '')}")`);
await sayfa.waitForSelector('.modal input[name=klinikArama]');
const labGruplari = await sayfa.locator('.modal .cip-kume__etiket').count();
if (labGruplari < 4) throw new Error(`laboratuvar bölüm başlıkları gelmedi, ${labGruplari} başlık`);
await sayfa.fill('.modal input[name=klinikArama]', 'röntgen');
await sayfa.click(`.modal .cip--secilir:has(span:text-is("${xray.ad}"))`);
await sayfa.click(`.modal button:has-text("${T('genel.sec')}")`);
const labMetni = await sayfa.inputValue('input[name=laboratuvar]');
if (!labMetni.includes(cbc.ad) || !labMetni.includes(xray.ad)) throw new Error('laboratuvar birleşmedi: ' + labMetni);
ok(`laboratuvar seçildi (${labGruplari} bölüm başlığı): ${labMetni}`);

// Boş çip şeridi ekranda "null" yazıyordu: append() null'u metne çeviriyor.
// Formun hiçbir yerinde kaçak "null"/"undefined" kalmasın.
const formMetni = await sayfa.textContent('#sayfa');
const kacak = ['null', 'undefined', 'NaN', '[object Object]'].filter((x) => formMetni.includes(x));
if (kacak.length) throw new Error('formda kaçak değer görünüyor: ' + kacak.join(', '));
ok('formda kaçak "null"/"undefined" yok');
await resim(sayfa, '7-recete-yaz.png', { fullPage: true });

// --- Kaydet
await sayfa.click(`button:has-text("${T('recete.kaydet')}")`);
// Kaydedilen reçetenin sayfasına geçilmesini bekle: "İlaçlar" başlığı reçete
// yazma ekranında da var, tek başına geçişi kanıtlamıyor.
await sayfa.waitForURL(/#\/recete\/rec_/);
await sayfa.waitForSelector(`.kart:has(h2:text-is("${T('nav.ilaclar')}")) .tablo tbody tr`);
const receteId = (new URL(sayfa.url()).hash.match(/#\/recete\/(rec_[^/?]+)/) || [])[1];
if (!receteId) throw new Error('reçete kimliği adresten okunamadı: ' + sayfa.url());
const receteNo = (await sayfa.textContent('h1')).trim();
if (!/^\d{4}-\d{2}-\d{2}-\d{2}$/.test(receteNo)) throw new Error('reçete numarası beklenen biçimde değil: ' + receteNo);
ok('reçete kaydedildi, numara kendiliğinden verildi: ' + receteNo);

// --- Reçete kartı: satırlar okunur halde, karşılama düğmesi yok
const ilacTablosu = await sayfa.textContent(`.kart:has(h2:text-is("${T('nav.ilaclar')}"))`);
for (const beklenen of ['Nurofen 400 mg Tablet', 'Parol 500 mg Tablet']) {
  if (!ilacTablosu.includes(beklenen)) throw new Error(`reçete tablosunda "${beklenen}" yok`);
}
if (/\bnull\b/.test(ilacTablosu)) throw new Error('reçete tablosuna düz metin "null" sızmış');
ok('reçetedeki iki ilaç adet ve kullanımıyla listelendi');

// Karşılamadan kalan hiçbir şey olmamalı: satır tablosunda düğme yok,
// sözlükte de "ver / verilemedi / geri al" anahtarları kalmadı.
const satirDugmesi = await sayfa.locator(`.kart:has(h2:text-is("${T('nav.ilaclar')}")) .tablo button`).count();
if (satirDugmesi) throw new Error(`reçete satırlarında ${satirDugmesi} düğme kaldı`);
for (const anahtar of ['recete.ver', 'recete.verilemedi', 'recete.geri_al', 'stok.hareketler', 'ilac.stok']) {
  if (anahtar in sozluk) throw new Error(`sözlükte karşılama/stok anahtarı kaldı: ${anahtar}`);
}
ok('karşılama yok: satır tablosunda düğme, sözlükte stok anahtarı kalmamış');
await resim(sayfa, '8-recete-karti.png', { fullPage: true });

// --- Şablon: reçeteyi kaydet, yeni reçetede uygula
// Hekim aynı kombinasyonu gün boyu tekrar yazıyor; bu akış kırılırsa
// günlük kullanımın en çok zaman kazandıran parçası gider.
await sayfa.goto(KOK + `#/recete/${receteId}/duzenle`);
await sayfa.waitForSelector(`button:has-text("${T('sablon.kaydet')}")`);
await sayfa.click(`button:has-text("${T('sablon.kaydet')}")`);
await sayfa.waitForSelector('.modal input[name=ad]');
const onerilen = await sayfa.inputValue('.modal input[name=ad]');
if (!onerilen.includes(taniAdi('Üst solunum yolu enfeksiyonu').ad)) throw new Error('şablon adı tanıdan önerilmedi: ' + onerilen);
await sayfa.fill('.modal input[name=ad]', 'ÜSYE denemesi');
await sayfa.click(`.modal button:has-text("${T('genel.kaydet')}")`);
await sayfa.waitForSelector('.bildirim--basari');
ok('reçete şablon olarak kaydedildi, ad tanıdan önerildi');

// Şablonu temiz bir sekmede uygula: aynı sekmede gezinince önceki sayfanın
// yeniden çizimiyle yarışıyor. Hekim de gerçekte yeni reçeteye sıfırdan
// başlıyor, bu yüzden denenen yol da bu.
const yeniSekme = await baglam.newPage();
await yeniSekme.goto(KOK + '#/recete/yeni', { waitUntil: 'networkidle' });
await yeniSekme.waitForSelector(`button:has-text("${T('recete.hasta_sec')}")`);
await yeniSekme.click(`button:has-text("${T('sablon.doldur')}")`);
await yeniSekme.waitForSelector('.modal .liste__satir--tiklanir');
await yeniSekme.click('.modal .liste__satir--tiklanir:has-text("ÜSYE denemesi")');
await yeniSekme.click(`.modal button:has-text("${T('sablon.uygula')}")`);
await yeniSekme.waitForSelector('.tablo tbody tr:has-text("Nurofen")');
const sablonSatir = await yeniSekme.locator('#sayfa .tablo tbody tr').count();
const sablonTani = await yeniSekme.inputValue('input[name=tani]');
if (sablonSatir !== 2) throw new Error(`şablondan 2 satır beklenirdi, ${sablonSatir} geldi`);
if (!sablonTani.includes(taniAdi('Üst solunum yolu enfeksiyonu').ad)) throw new Error('şablon tanıyı getirmedi: ' + sablonTani);
// Hasta seçilmemiş olmalı: şablon hastaya ait değil.
const hastaKarti = await yeniSekme.textContent(`.kart:has(h2:text-is("${T('nav.hasta')}"))`);
if (/Zeynep|Ayşe|Mehmet/.test(hastaKarti)) {
  throw new Error('şablon uygulanınca hasta da geldi — şablon hastaya ait olmamalı: ' + hastaKarti.trim());
}
await yeniSekme.close();
ok('şablon uygulandı: 2 ilaç ve tanı geldi, hasta gelmedi');

// Ayarlarda görünüyor ve silinebiliyor
await sayfa.click('#kenar-menu a[href="#/ayarlar"]');
await sayfa.waitForSelector(`h2:has-text("${T('sablon.baslik')}")`);
const sablonKarti = await sayfa.textContent(`.kart:has(h2:text-is("${T('sablon.baslik')}"))`);
if (!sablonKarti.includes('ÜSYE denemesi')) throw new Error('şablon ayarlarda listelenmedi');
ok('şablon ayarlarda listelendi');

// Kaldığımız yere dön: sonraki adımlar kaydedilmiş reçetenin sayfasında.
await sayfa.goto(KOK + `#/recete/${receteId}`);
await sayfa.waitForSelector('.yazdir-alan', { state: 'attached' });

// --- Yazdırma alanı: ekranda gizli, içeriği eksiksiz
const yazdirMetni = await sayfa.textContent('.yazdir-alan');
const bolumler = [
  ['doktor adı', 'نمونه احمدی'], ['latin ad', 'Dr. Nemuna Ahmadi'],
  ['ünvan şeridi', 'معالج امراض داخله'], ['slogan', 'سلامتی شما'],
  ['hizmet', '(ECG)'], ['ilgi alanları', '(قلب ، شش'], ['sabıka', 'سابقه کاری'],
  ['hasta', 'Zeynep Kaya'], ['tanı', 'J06.9'], ['ilaç', 'Nurofen'],
  ['alerji', T('hasta.alerji')], ['adres', 'کابل'], ['telefon', '0700000000'],
  ['Clinical başlığı', 'Clinical'], ['ölçüm etiketi', 'BP :'],
  // Kâğıda ait sabit satır: ayarlardan gelmiyor, her kâğıtta olmalı.
  ['sabit satır', 'طبیب حقیقی خداوند'],
];
for (const [ad, beklenen] of bolumler) {
  if (!yazdirMetni.includes(beklenen)) throw new Error(`reçete çıktısında ${ad} yok ("${beklenen}")`);
}
const amblemParca = await sayfa.locator('.kagit__amblem-cizim path, .kagit__amblem-cizim circle').count();
if (amblemParca < 6) throw new Error(`antet amblemi eksik çizilmiş: ${amblemParca} parça`);
const rozetSayisi = await sayfa.locator('.kagit__rozet').count();
if (rozetSayisi !== 4) throw new Error(`ayakta 4 rozet bekleniyordu, ${rozetSayisi} var`);
if (await sayfa.isVisible('.yazdir-alan')) throw new Error('yazdırma alanı ekranda görünüyor');
ok(`reçete kâğıdı eksiksiz: kadüse amblemi (${amblemParca} parça), antet, ünvan şeridi, hizmetler, sabıka, Clinical sütunu, ${rozetSayisi} rozet, iletişim`);

// --- QR ve klinik ölçüm sütunu kâğıtta yerinde mi?
const qrModulSayisi = await sayfa.locator('.kagit__qr path').count();
if (!qrModulSayisi) throw new Error('kâğıtta QR yok');
const qrYolu = await sayfa.getAttribute('.kagit__qr path', 'd');
if (!qrYolu || qrYolu.length < 200) throw new Error('QR yolu beklenenden kısa: ' + (qrYolu || '').length);
// Ölçüm sayısını sabit yazmıyoruz: listeye yeni ölçüm eklenince deneme
// kendiliğinden uyum sağlasın, ama "hepsi basıldı mı" yine denetlensin.
const olcumBekleneni = await sayfa.evaluate(async () => {
  const { OLCUMLER } = await import('./js/paylasilan/recete.js');
  return OLCUMLER.length;
});
const olcumSayisi = await sayfa.locator('.kagit__olcum:not(.kagit__olcum--kan)').count();
if (olcumSayisi !== olcumBekleneni) throw new Error(`klinik sütunda ${olcumBekleneni} ölçüm bekleniyordu, ${olcumSayisi} var`);
const olcumMetni = await sayfa.textContent('.kagit__klinik-sutun');
if (!olcumMetni.includes('110/70 mmHg') || !olcumMetni.includes('38.2 °C')) {
  throw new Error('girilen ölçümler kâğıda basılmamış: ' + olcumMetni.replace(/\s+/g, ' '));
}
// Girilmeyen ölçümler elle yazılsın diye çizgi olarak basılır: 2 tanesi dolu.
const bosOlcum = await sayfa.locator('.kagit__olcum:not(.kagit__olcum--kan) .kagit__cizgi').count();
if (bosOlcum !== olcumBekleneni - 2) throw new Error(`boş ölçümlerde ${olcumBekleneni - 2} çizgi bekleniyordu, ${bosOlcum} var`);
// Kan grubu ölçüm değil, hastanın künyesi: kendi satırında.
const kanSatiri = await sayfa.locator('.kagit__olcum--kan').count();
if (kanSatiri !== 1) throw new Error(`kâğıtta kan grubu satırı bekleniyordu, ${kanSatiri} var`);
ok(`kâğıtta QR (${qrYolu.length} karakterlik yol), ${olcumBekleneni} ölçümün 2'si yazılı, ${bosOlcum}'ü çizgili, kan grubu satırı ayrı`);

// --- Kâğıtta belirti, laboratuvar ve yeni ilaç satırı biçimi
const rxMetni = (await sayfa.textContent('.kagit__rx-govde')).replace(/\s+/g, ' ');
if (!rxMetni.includes(sarfa.ad)) throw new Error('belirtiler kâğıda basılmamış: ' + rxMetni);
if (!rxMetni.includes(cbc.ad) || !rxMetni.includes(xray.ad)) throw new Error('laboratuvar kâğıda basılmamış: ' + rxMetni);
const ilkIlacSatiri = (await sayfa.textContent('.kagit__ilaclar li:first-child')).replace(/\s+/g, ' ').trim();
// Referanstaki biçim: "Cap: Amoxicillin 500 mg … N=12"
if (!/\b(Tab|Cap|Syr|Amp|Oint|Drop|Spray|Supp|Sach):/.test(ilkIlacSatiri)) {
  throw new Error('ilaç satırında şekil kısaltması yok: ' + ilkIlacSatiri);
}
if (!/N=\d+/.test(ilkIlacSatiri)) throw new Error('ilaç satırında N= adedi yok: ' + ilkIlacSatiri);
// Şekil önek olarak basıldığı için adın sonunda tekrar etmemeli.
if (/Tab:.*Tablet/.test(ilkIlacSatiri)) throw new Error('şekil iki kez yazılmış: ' + ilkIlacSatiri);
// Veriliş yolu ikinci ilaca girildi; blokta olması yeter.
const ilaclarMetni = (await sayfa.textContent('.kagit__ilaclar')).replace(/\s+/g, ' ');
if (!ilaclarMetni.includes(T('yol.0'))) throw new Error('veriliş yolu kâğıda basılmamış: ' + ilaclarMetni);
ok(`kâğıtta belirti ve laboratuvar var; ilaç satırı referans biçiminde: ${ilkIlacSatiri}`);

// --- Boş kâğıt: aynı antet, elle doldurulacak satırlar
const bosKagit = await sayfa.evaluate(async () => {
  const { kagitCiz } = await import('./js/kagit.js');
  const { yerelDepoAc } = await import('./js/depo/idb.js');
  const depo = await yerelDepoAc();
  const kagit = kagitCiz({ ayar: await depo.ayarlar(), bos: true });
  return {
    metin: kagit.textContent,
    rozet: kagit.querySelectorAll('.kagit__rozet').length,
    cizgi: kagit.querySelectorAll('.kagit__cizgi').length,
    qr: kagit.querySelectorAll('.kagit__qr').length,
  };
});
if (bosKagit.cizgi < 8) throw new Error(`boş kâğıtta doldurma çizgisi eksik: ${bosKagit.cizgi}`);
for (const beklenen of ['نمونه احمدی', 'سلامتی شما', 'سابقه کاری', 'طبیب حقیقی خداوند', 'Clinical', 'BP :', '℞']) {
  if (!bosKagit.metin.includes(beklenen)) throw new Error(`boş kâğıtta "${beklenen}" yok`);
}
if (bosKagit.metin.includes('Zeynep')) throw new Error('boş kâğıtta hasta bilgisi sızmış');
if (bosKagit.metin.includes('Nurofen')) throw new Error('boş kâğıtta ilaç sızmış');
ok(`boş kâğıt hazır: antet ve Clinical sütunu duruyor, ${bosKagit.cizgi} doldurma çizgisi, hasta ve ilaç yok`);

// Boş kâğıdın çıktısı da görülsün: sayfadaki kâğıt geçici olarak boşuyla değişir.
if (EKRAN) {
  await sayfa.evaluate(async () => {
    const { kagitCiz } = await import('./js/kagit.js');
    const { yerelDepoAc } = await import('./js/depo/idb.js');
    const depo = await yerelDepoAc();
    const eski = document.querySelector('.yazdir-alan');
    window.__doluKagit = eski;
    eski.replaceWith(kagitCiz({ ayar: await depo.ayarlar(), bos: true }));
  });
  await sayfa.emulateMedia({ media: 'print' });
  await resim(sayfa, '11-bos-kagit.png', { fullPage: true });
  await sayfa.emulateMedia({ media: 'screen' });
  await sayfa.evaluate(() => { document.querySelector('.yazdir-alan').replaceWith(window.__doluKagit); });
}

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

// --- Doğrulama kodu: kâğıtta basılı mı, QR'da var mı?
const basiliKod = (await sayfa.textContent('.kagit__kod')).trim();
if (!/[0-9A-Z]{4}-[0-9A-Z]{4}/.test(basiliKod)) throw new Error('kâğıtta doğrulama kodu yok: ' + basiliKod);
ok('kâğıda doğrulama kodu basıldı: ' + basiliKod);

// --- Doğrulama: dokunulmamış metin geçerli, kurcalanmış metin yakalanmalı
const kagitMetni = await sayfa.evaluate(async () => {
  const { ozetMetni, kodSatiri } = await import('./js/paylasilan/dogrulama.js');
  const { yerelDepoAc } = await import('./js/depo/idb.js');
  const { tamAd } = await import('./js/paylasilan/hasta.js');
  const depo = await yerelDepoAc();
  const [recete] = await depo.listele('receteler');
  const hasta = await depo.al('hastalar', recete.hastaId);
  return `${ozetMetni(recete, tamAd(hasta))}\n${kodSatiri(recete.dogrulamaKodu)}`;
});
if (!kagitMetni.includes('Nurofen')) throw new Error('özet metni beklenen içeriği taşımıyor');

const denetle = async (metin) => {
  await sayfa.click('#kenar-menu a[href="#/ayarlar"]');
  await sayfa.waitForSelector(`h2:has-text("${T('dogrula.baslik')}")`);
  await sayfa.fill(`textarea[placeholder="${T('dogrula.yer')}"]`, metin);
  await sayfa.click(`button:has-text("${T('dogrula.dugme')}")`);
  await sayfa.waitForSelector('.kart:has(h2:text-is("' + T('dogrula.baslik') + '")) .uyari');
  return sayfa.textContent('.kart:has(h2:text-is("' + T('dogrula.baslik') + '")) .uyari');
};

const saglam = await denetle(kagitMetni);
if (!saglam.includes(T('dogrula.gecerli'))) throw new Error('dokunulmamış reçete geçerli sayılmadı: ' + saglam.trim());
ok('dokunulmamış reçete "geçerli" dedi');

const kurcalanmis = kagitMetni.replace('× 2', '× 20');
if (kurcalanmis === kagitMetni) throw new Error('kurcalama uygulanamadı');
const yakalandi = await denetle(kurcalanmis);
if (!yakalandi.includes(T('dogrula.gecersiz').split('{')[0].trim())) {
  throw new Error('adedi değiştirilmiş reçete yakalanmadı: ' + yakalandi.trim());
}
ok('adet 2 → 20 yapılan reçete yakalandı: kod tutmadı');

// --- Reçete listesi ve süzgeç
await sayfa.click('#kenar-menu a[href="#/receteler"]');
await sayfa.waitForSelector(`h1:has-text("${T('nav.receteler')}")`);
await sayfa.waitForSelector('.tablo tbody tr:has-text("Zeynep Kaya")');
await sayfa.selectOption('#sayfa select', { label: T('recete.suzgec.bugun') });
await sayfa.waitForFunction(() => document.querySelectorAll('.tablo tbody tr').length === 1);
ok('reçete listede göründü, "bugün yazılanlar" süzgeci onu buldu');

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
if (belge.bicim !== 'shafa-yedek' || belge.koleksiyonlar.ilaclar.length !== 9) {
  throw new Error('yedek içeriği beklenmedik: ' + JSON.stringify(Object.keys(belge)));
}
ok(`yedek indirildi (${dosya.suggestedFilename()}): 9 ilaç, ${belge.koleksiyonlar.hastalar.length} hasta, ${belge.koleksiyonlar.receteler.length} reçete`);
if ('hareketler' in belge.koleksiyonlar) throw new Error('yedekte stok hareketleri koleksiyonu duruyor');

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
// alerji uyarısı taşıyan hasta kartı ile reçete kartı taranır.
const TURKCE = ['Stok', 'İlaç', 'Hasta', 'Reçete', 'Kaydet', 'gün önce', 'gün sonra', 'Alerji', 'yaş'];
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
await sayfa.waitForSelector('h1:has-text("Majezik")');
await turkceAra('ilaç kartı');

await sayfa.click('#kenar-menu a[href="#/hastalar"]');
await sayfa.waitForSelector('.liste__satir');
await sayfa.click('.liste__satir:has-text("Ayşe Yılmaz")');
await sayfa.waitForSelector('.uyari');
await turkceAra('hasta kartı (alerji şeridi)');

await sayfa.click('#kenar-menu a[href="#/receteler"]');
await sayfa.waitForSelector('.tablo tbody tr');
await sayfa.click('.tablo tbody tr');
await sayfa.waitForSelector(`h2:has-text("${T('nav.ilaclar')}")`);
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

// --- Hazır ilaç listesi (en sonda: ilaç sayısını değiştirdiği için)
// Satır saymak yerine sayfanın kendi yazdığı sayıyı okuyoruz: satırlar
// belirirken saymak yarı çizilmiş listeyi ölçüyordu.
const ilacSayisiniOku = async () => {
  await sayfa.waitForSelector('#sayfa p.kart__alt');
  const metin = await sayfa.textContent('#sayfa p.kart__alt');
  const n = Number((metin.match(/\d+/) || [])[0]);
  if (!Number.isFinite(n)) throw new Error('ilaç sayısı okunamadı: ' + metin);
  return n;
};
await sayfa.click('#kenar-menu a[href="#/ayarlar"]');
await sayfa.waitForSelector(`h2:has-text("${T('ayar.hazir_liste')}")`);
await sayfa.click(`button:has-text("${T('ayar.hazir_yukle')}")`);
// Ekrandaki eski bir bildirim kutusunu beklemek yükleme bitmeden devam
// etmeye yol açıyordu. "Yüklendi" rozeti yalnız iş bitince çiziliyor.
// Bildirimler üst üste biniyor; kendi mesajımızı metninden seçiyoruz, yoksa
// ekranda kalan alakasız bir bildirimi okuyup yanıltıcı satır basıyorduk.
const eklendiKalibi = T('ayar.hazir_eklendi').replace('{n}', '').trim();
const eklendiKutusu = `.bildirim--basari:has-text("${eklendiKalibi}")`;
await sayfa.waitForSelector(eklendiKutusu);
const eklendiMetni = (await sayfa.textContent(eklendiKutusu)).trim();
await sayfa.waitForSelector(`.kart:has(h2:text-is("${T('ayar.hazir_liste')}")) .rozet`);
await sayfa.goto(KOK + '#/ilaclar', { waitUntil: 'networkidle' });
// Satır sayısı yerleşene kadar bekle: tek satır belirir belirmez saymak
// yarı çizilmiş listeyi ölçüyordu.
const listeSonrasi = await ilacSayisiniOku();
if (listeSonrasi <= 9) throw new Error(`hazır liste yüklenmedi, hâlâ ${listeSonrasi} ilaç var`);
ok(`hazır ilaç listesi yüklendi (${eklendiMetni}), liste ${listeSonrasi} satır`);

// Aranabiliyor mu?
await sayfa.fill('#sayfa input[type=search]', 'amoxicillin');
await sayfa.waitForFunction(() => document.querySelectorAll('.tablo tbody tr').length > 0);
const amoks = await ilacSayisiniOku();
ok(`listeden gelen ilaç aranabiliyor: "amoxicillin" ${amoks} sonuç`);
await sayfa.fill('#sayfa input[type=search]', '');

// İkinci kez yüklemek kopya oluşturmamalı
await sayfa.click('#kenar-menu a[href="#/ayarlar"]');
await sayfa.click(`button:has-text("${T('ayar.hazir_yukle')}")`);
await sayfa.waitForSelector(`.bildirim--uyari:has-text("${T('ayar.hazir_zaten')}")`);
await sayfa.goto(KOK + '#/ilaclar', { waitUntil: 'networkidle' });
const ikinciSayim = await ilacSayisiniOku();
if (ikinciSayim !== listeSonrasi) throw new Error(`ikinci yükleme kopya oluşturdu: ${listeSonrasi} → ${ikinciSayim}`);
ok('ikinci kez yüklemek kopya oluşturmadı');

await tarayici.close();
kapat();

if (hatalar.length) { console.error('\n✗ konsol hataları:\n' + hatalar.join('\n')); process.exit(1); }
console.log(`\n✓ ${adim} adımın hepsi geçti, konsolda tek hata yok.`);
