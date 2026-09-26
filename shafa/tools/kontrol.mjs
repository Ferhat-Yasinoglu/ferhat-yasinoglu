#!/usr/bin/env node
// Statik denetimler: (1) CSS'te fiziksel yön özelliği yok, (2) innerHTML kullanılmıyor,
// (3) paylasilan/ saf kalıyor (DOM ya da node: yok), (4) sayfa modülleri sözleşmeye uyuyor.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { listeyiDenetle, YASAK_KAYNAK } from './ilac-uret.mjs';
import { gercekVeriBul } from './gercek-veri.mjs';

const KOK = new URL('../app/', import.meta.url).pathname;
let hata = 0;
const hataVer = (m) => { console.error('✗ ' + m); hata++; };

async function dosyalar(dizin, uzanti) {
  const out = [];
  for (const e of await readdir(dizin, { withFileTypes: true })) {
    const yol = join(dizin, e.name);
    if (e.isDirectory()) out.push(...(await dosyalar(yol, uzanti)));
    else if (e.name.endsWith(uzanti)) out.push(yol);
  }
  return out;
}

for (const f of await dosyalar(join(KOK, 'css'), '.css')) {
  const s = await readFile(f, 'utf8');
  const m = s.match(/(^|[^-\w])(margin-left|margin-right|padding-left|padding-right|left:|right:|text-align:\s*(left|right)|border-left|border-right)/m);
  if (m) hataVer(`${f}: fiziksel yön özelliği (${m[2]}); mantıksal özellik kullan`);
  // İçe gölgeyle çizilen kenar şeridi de fiziksel: yatay kayma sağdan sola
  // çevrilmiyor. İlaç tablosunun uyarı şeridi satırın başında değil, # ile
  // ad arasında çıkıyordu. Şerit border-inline-* ile çizilsin.
  const golge = s.match(/box-shadow:[^;]*\binset\s+-?(?:\d*\.)?\d*[1-9][\d.]*(?:px|em|rem)?\s/);
  if (golge) hataVer(`${f}: yatay kaymalı içe gölge (${golge[0].trim()}); şeridi border-inline-start/end ile çiz`);
}
for (const f of await dosyalar(join(KOK, 'js'), '.js')) {
  const s = await readFile(f, 'utf8');
  if (/\.innerHTML\s*=/.test(s)) hataVer(`${f}: innerHTML ataması`);
  if (f.includes('/paylasilan/') && /\b(document|window|localStorage|indexedDB)\s*[.[]/.test(s)) hataVer(`${f}: paylasilan/ içinde DOM erişimi`);
  if (f.includes('/paylasilan/') && /from ['"]node:/.test(s)) hataVer(`${f}: paylasilan/ içinde node: bağımlılığı`);
  if (f.includes('/sayfalar/') && !/export default/.test(s)) hataVer(`${f}: sayfa modülü default export vermiyor`);
}
// (5) Sözlük eksiği: koddaki her t('anahtar', …) sözlükte var mı?
// Dinamik anahtarlar (t('durum.' + x)) nokta ile bittiği için atlanır.
const sozlukler = {};
for (const dil of ['fa']) {
  sozlukler[dil] = JSON.parse(await readFile(new URL(`../app/i18n/${dil}.json`, import.meta.url), 'utf8'));
}
const kullanilan = new Set();
for (const f of await dosyalar(join(KOK, 'js'), '.js')) {
  const s = await readFile(f, 'utf8');
  for (const m of s.matchAll(/\bt\('([A-Za-z0-9_.]+)'/g)) {
    if (!m[1].endsWith('.')) kullanilan.add(m[1]);
  }
}
for (const [dil, sozluk] of Object.entries(sozlukler)) {
  const eksik = [...kullanilan].filter((a) => !(a in sozluk)).sort();
  if (eksik.length) hataVer(`i18n/${dil}.json: ${eksik.length} anahtar eksik → ${eksik.slice(0, 8).join(', ')}${eksik.length > 8 ? '…' : ''}`);
}

// (6) DİNAMİK kurulan anahtarlar. Yukarıdaki tarama yalnız düz `t('a.b')`
// yazımını görüyor; `t(HARITA[x] || x)` ya da `t(`onek.${k}`)` gözünden kaçıyor.
// Şablonlar eklendiğinde tam buradan sızdı: koleksiyon → etiket haritasına
// eklenmeyen `sablonlar`, Ayarlar'daki "Veriler" kartında ham anahtarıyla,
// yani Türkçe basıldı ve öyle yayına gitti. Denetim artık bu iki üreteci de
// çözüp karşılıklarını arıyor.
const oku = (yol) => readFile(join(KOK, yol), 'utf8');
const listeAnahtarlari = (kaynak, ad) => {
  const m = kaynak.match(new RegExp(`const ${ad}\\s*=\\s*\\[(.*?)\\];`, 's'));
  return m ? [...m[1].matchAll(/\[\s*'([^']*)'/g)].map((x) => x[1]) : null;
};
const dinamik = [];

// 6a. Seçenek listeleri: secenekleriCevir(LISTE, 'onek') → 'onek.<anahtar>'
for (const [yol, ad, onek] of [
  ['js/paylasilan/hasta.js', 'CINSIYETLER', 'cinsiyet'],
  ['js/paylasilan/hasta.js', 'SIGORTALAR', 'sigorta'],
  ['js/paylasilan/ilac.js', 'FORMLAR', 'form'],
  ['js/paylasilan/recete.js', 'RECETE_TURLERI', 'recete.tur'],
  ['js/sayfalar/ilaclar.js', 'SUZGECLER', 'suzgec'],
  ['js/sayfalar/receteler.js', 'SUZGECLER', 'recete.suzgec'],
  ['js/paylasilan/recete.js', 'KULLANIM_ONERILERI', 'kullanim'],
  ['js/paylasilan/recete.js', 'SURE_ONERILERI', 'sure'],
  ['js/paylasilan/recete.js', 'YOLLAR', 'yol'],
]) {
  const liste = listeAnahtarlari(await oku(yol), ad);
  if (!liste) { hataVer(`${yol}: ${ad} listesi okunamadı — denetim bu listeyi doğrulayamıyor`); continue; }
  // Öneri listeleri düz dizi: anahtar yerine dizin kullanılıyor (kullanim.0…).
  const duzDizi = liste.length === 0;
  const kaynak = duzDizi ? await oku(yol) : null;
  const n = duzDizi
    ? (kaynak.match(new RegExp(`const ${ad}\\s*=\\s*\\[(.*?)\\];`, 's'))[1].match(/'[^']*'/g) || []).length
    : 0;
  const anahtarlar = duzDizi ? [...Array(n).keys()] : liste;
  for (const a of anahtarlar) dinamik.push([`${onek}.${a}`, `${ad} (${yol})`]);
}

// 6b. Koleksiyon → etiket: SAYILAN her koleksiyonun haritada karşılığı olmalı.
const sema = await oku('js/depo/sema.js');
const ayarlarKaynak = await oku('js/sayfalar/ayarlar.js');
const semaGovde = sema.match(/export const KOLEKSIYONLAR\s*=\s*\{(.*?)\n\};/s);
const haritaGovde = ayarlarKaynak.match(/const KOL_ANAHTARI\s*=\s*\{(.*?)\};/s);
if (!semaGovde || !haritaGovde) {
  hataVer('KOLEKSIYONLAR ya da KOL_ANAHTARI okunamadı — koleksiyon etiketleri doğrulanamıyor');
} else {
  const harita = Object.fromEntries([...haritaGovde[1].matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
  for (const m of semaGovde[1].matchAll(/^\s*(\w+):/gm)) {
    const kol = m[1];
    if (kol === 'meta') continue;          // sayılmıyor, yedeklenmiyor
    if (!harita[kol]) hataVer(`ayarlar.js: '${kol}' koleksiyonu KOL_ANAHTARI haritasında yok — etiketi Türkçe basılır`);
    else dinamik.push([harita[kol], `KOL_ANAHTARI[${kol}]`]);
  }
}

// 6c. HTML'deki data-i18n / data-i18n-label
for (const f of await dosyalar(KOK, '.html')) {
  for (const m of (await readFile(f, 'utf8')).matchAll(/data-i18n(?:-label)?="([^"]+)"/g)) {
    dinamik.push([m[1], f]);
  }
}

// 6e. hatalar.js'teki kod → metin haritaları. Bunlar `t('hata.' + e.kod, …)`
// diye dinamik çağrılıyor, yani (5) numaralı tarama hiçbirini görmüyor: sözlükte
// karşılığı olmayan bir kod, Farsça arayüzün ortasına Türkçe cümle basıyor ve
// bu hiçbir yerde patlamıyor. Görsel yükleme eklenirken aynen böyle oldu
// («Bu bir görsel değil.» diye Türkçe uyarı çıktı). Artık dört harita da
// burada çözülüp karşılıkları aranıyor.
const hatalarKaynak = await oku('js/hatalar.js');
for (const [ad, onek] of [['DOGRULAMA', 'dogrula'], ['DEPO', 'hata'], ['UYARI', 'uyari'], ['GORELI', 'zaman']]) {
  // Kalıp hem çok satırlı hem tek satırlık haritayı tutmalı: GORELI tek satır
  // yazılmış ve satır başına dayanan ilk kalıp onu hiç görmedi — denetim de
  // "okunamadı" diyerek bunu söyledi.
  const govde = hatalarKaynak.match(new RegExp(`const ${ad}\\s*=\\s*\\{([\\s\\S]*?)\\};`));
  if (!govde) { hataVer(`hatalar.js: ${ad} haritası okunamadı — hata metinleri doğrulanamıyor`); continue; }
  const kodlar = [...govde[1].matchAll(/(\w+):\s*'/g)].map((m) => m[1]);
  if (!kodlar.length) hataVer(`hatalar.js: ${ad} haritası boş görünüyor`);
  for (const k of kodlar) dinamik.push([`${onek}.${k}`, `hatalar.js ${ad}`]);
}

// 6d. Menü başlıkları (uygulama.js içindeki `anahtar: '…'`)
for (const m of (await oku('js/uygulama.js')).matchAll(/anahtar:\s*'([^']+)'/g)) {
  dinamik.push([m[1], 'uygulama.js MENU']);
}

// 6f. Önekle kurulan öbür anahtarlar: Ayarlar'daki antet alanları
// (`t('ayar.' + anahtar)` ve ipucu için `…_ipucu`; liste paylasilan/antet.js'te),
// QR seçenekleri ve Clinical ölçümleri. Antete ikinci telefon eklenince iki
// alanın etiketi de ipucu da sözlüğe girmedi; hekim Ayarlar'da «İkinci telefon»
// diye Türkçe okudu.
const antetGovde = (await oku('js/paylasilan/antet.js')).match(/const ANTET_ALANLARI\s*=\s*\[(.*?)\n\];/s);
if (!antetGovde) hataVer('paylasilan/antet.js: ANTET_ALANLARI okunamadı — antet etiketleri doğrulanamıyor');
else {
  for (const m of antetGovde[1].matchAll(/\[\s*'(\w+)',\s*'[^']*',\s*'([^']*)'/g)) {
    dinamik.push([`ayar.${m[1]}`, 'ANTET_ALANLARI (paylasilan/antet.js)']);
    if (m[2]) dinamik.push([`ayar.${m[1]}_ipucu`, 'ANTET_ALANLARI (paylasilan/antet.js)']);
  }
}
for (const [yol, ad, onek] of [
  ['js/sayfalar/ayarlar.js', 'QR_SECENEKLERI', 'ayar.qr'],
  ['js/paylasilan/recete.js', 'OLCUMLER', 'olcum'],
]) {
  const liste = listeAnahtarlari(await oku(yol), ad);
  if (!liste?.length) { hataVer(`${yol}: ${ad} listesi okunamadı — denetim bu listeyi doğrulayamıyor`); continue; }
  for (const a of liste) dinamik.push([`${onek}.${a}`, `${ad} (${yol})`]);
}

for (const [dil, sozluk] of Object.entries(sozlukler)) {
  const eksik = dinamik.filter(([a]) => !(a in sozluk));
  for (const [a, nereden] of eksik) hataVer(`i18n/${dil}.json: dinamik anahtar eksik → ${a} (${nereden})`);
}
dinamik.forEach(([a]) => kullanilan.add(a));

// (7) Tanıtım sayfasındaki sürüm rozeti koddaki sürümle aynı mı?
// İndirme bölümü "نسخه 1.0.0" yazıyor. Bu sayı elle yazıldığı için uygulama
// sürümü yükselince geride kalır ve kimse fark etmez: ziyaretçi eski bir
// sürüm indirdiğini sanır, oysa indirdiği hep en yenisi. Referans sitede de
// aynı sayı (v1.0.15) dört yerde elle yazılmıştı. Denetim ikisini bağlıyor.
const tanitim = await readFile(new URL('../tanitim/index.html', import.meta.url), 'utf8');
const surumEslesme = (await oku('js/uygulama.js')).match(/UYGULAMA_SURUMU\s*=\s*'([^']+)'/);
if (!surumEslesme) hataVer('uygulama.js: UYGULAMA_SURUMU okunamadı — tanıtımdaki sürüm doğrulanamıyor');
else {
  const rozetler = [...tanitim.matchAll(/<span class="surum-rozet">[\s\S]*?<span dir="ltr">([^<]+)<\/span>/g)].map((m) => m[1].trim());
  if (!rozetler.length) hataVer('tanitim/index.html: sürüm rozeti bulunamadı — indirme bölümü sürümü göstermiyor');
  const yanlis = rozetler.filter((r) => r !== surumEslesme[1]);
  if (yanlis.length) {
    hataVer(`tanitim/index.html: sürüm rozeti koddan farklı (${[...new Set(yanlis)].join(', ')} ≠ ${surumEslesme[1]})`);
  }
}

// (8) Tanıtımda eski /eczane/ adresi kalmasın. Site denemesi de bakıyor ama o
// Playwright kurulu değilse atlanıyor; bu denetim her koşulda çalışır.
for (const m of tanitim.matchAll(/(?:href|src)="([^"]*eczane[^"]*)"/g)) {
  hataVer(`tanitim/index.html: eski adres kalmış → ${m[1]}`);
}

// (9) Tanıtımdaki <img> ölçüleri gerçek dosyayla aynı mı?
// Görüntüler `node tools/gorsel-uret.mjs` ile yeniden üretiliyor; üretim ölçüyü
// değiştirirse HTML'deki width/height geride kalır ve tarayıcı görüntüyü ya
// eziyor ya da sayfa yüklenirken zıplıyor. Panel görüntüsü 1280×900'den
// 1600×1000'e (16:10 bilgisayar ekranı) geçerken tam bu olacaktı.
// PNG'de ölçü IHDR'de; JPEG'de çerçeve başlığında (SOF0–SOF15, DHT/JPG/DAC
// hariç), işaretler üstünden atlanarak bulunuyor.
const gorselOlcu = async (yol) => {
  const b = await readFile(yol);
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) return { en: b.readUInt32BE(16), boy: b.readUInt32BE(20) };
  if (b.length < 4 || b.readUInt16BE(0) !== 0xffd8) return null;
  for (let i = 2; i + 9 < b.length; i += 2 + b.readUInt16BE(i + 2)) {
    if (b[i] !== 0xff) return null;
    const isaret = b[i + 1];
    if (isaret >= 0xc0 && isaret <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(isaret)) {
      return { en: b.readUInt16BE(i + 7), boy: b.readUInt16BE(i + 5) };
    }
  }
  return null;
};
for (const m of tanitim.matchAll(/<img[^>]*src="(gorsel\/[^"]+\.(?:png|jpg))"[^>]*>/g)) {
  const etiket = m[0];
  const en = etiket.match(/width="(\d+)"/);
  const boy = etiket.match(/height="(\d+)"/);
  if (!en || !boy) { hataVer(`tanitim/index.html: ${m[1]} için width/height yok — sayfa yüklenirken zıplar`); continue; }
  const olcu = await gorselOlcu(new URL('../tanitim/' + m[1], import.meta.url));
  if (!olcu) { hataVer(`tanitim/${m[1]}: görüntü okunamadı`); continue; }
  if (olcu.en !== Number(en[1]) || olcu.boy !== Number(boy[1])) {
    hataVer(`tanitim/${m[1]}: HTML ${en[1]}×${boy[1]} diyor, dosya ${olcu.en}×${olcu.boy}`);
  }
}

// (10) Sunucu (sunucu/*.js) workerd'da nodejs_compat OLMADAN ve derlemesiz
// koşuyor: `node:` modülü ya da npm paketi içe aktarılırsa Node'daki testler
// geçer ama wrangler paketleyemez ya da Worker açılışta çöker. Yalnız göreli
// yollar (kendi dosyaları ve app/js/paylasilan). Sırlar yalnız WebCrypto'dan
// (Math.random tahmin edilebilir). İstek gövdesi ve Authorization asla
// loglanmaz: sunucuda tek log hata mesajıdır (console.error), başka console yok.
for (const f of await dosyalar(new URL('../sunucu/', import.meta.url).pathname, '.js')) {
  const s = await readFile(f, 'utf8');
  for (const m of s.matchAll(/\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    if (!m[1].startsWith('.')) hataVer(`${f}: göreli olmayan içe aktarma (${m[1]}); sunucu bağımlılıksız ve nodejs_compat'sız`);
  }
  if (/Math\.random/.test(s)) hataVer(`${f}: Math.random; rastgelelik yalnız crypto.getRandomValues'tan`);
  const m = s.match(/console\.(log|info|debug|warn|trace|dir)\b/);
  if (m) hataVer(`${f}: console.${m[1]}; sunucu istek verisini loglamaz (yalnız console.error ile hata mesajı)`);
}

// (11) Hazır ilaç listesi ilaç başına kullanım TAŞIMAZ. nuskha'nın listesinde
// her ilacın yanında hazır doz/zaman/tarika/adet vardı («Amoxil → ۱ دانه ·
// روزانه ۳ بار · 15»); Shafa reçete önermiyor, kullanım kararı hekimin.
// Birim testi de bakıyor ama bu denetim vitest'siz de koşsun: liste elle
// düzenlenip ya da başka bir araçla üretilip bu alanlar geri sızarsa burada
// durur. Liste alanları beyaz listeyle (listeyiDenetle), depodaki nuskha
// kopyası yasak alanlarla denetleniyor.
const ilacListesi = JSON.parse(await oku('veri/ilaclar.json'));
for (const m of listeyiDenetle(ilacListesi)) hataVer(`veri/ilaclar.json: ${m}`);
const nuskhaKopyasi = JSON.parse(await readFile(new URL('./kaynak/nuskha-ilaclar.json', import.meta.url), 'utf8'));
for (const d of nuskhaKopyasi.drugs || []) {
  const sizan = YASAK_KAYNAK.filter((k) => k in d);
  if (sizan.length) hataVer(`tools/kaynak/nuskha-ilaclar.json: ${d.brand || d.generic} ilaç başına kullanım taşıyor (${sizan.join(', ')})`);
}

// (12) Gerçek kişi verisi yok (depo herkese açık). Hekimlerin getirdiği
// tasarım görselinde gerçek görünen bir adres, iş yerleri ve telefon vardı;
// kâğıt yeniden kurulurken bunlardan biri örnek veriye, sözlüğe ya da bir
// denemeye sızarsa yayına gider. Liste ve neden tam ifade: gercek-veri.mjs.
const METIN_UZANTILARI = ['.js', '.mjs', '.json', '.css', '.html', '.md', '.txt', '.py', '.svg', '.webmanifest'];
const DEPO = new URL('../', import.meta.url).pathname;
const taranacak = [join(DEPO, 'README.md')];
for (const dizin of ['app', 'tanitim', 'tools', 'test', 'sunucu']) {
  for (const uzanti of METIN_UZANTILARI) taranacak.push(...(await dosyalar(join(DEPO, dizin), uzanti)));
}
for (const f of taranacak) {
  for (const ifade of gercekVeriBul(await readFile(f, 'utf8'))) hataVer(`${f}: tasarım görselindeki gerçek görünen veri (${ifade.slice(0, 3)}…)`);
}

// (13) Sonsuz hareket yok: dikkat dağıtıyor, pili yiyor ve azaltılmış
// hareket tercihini deliyor. Tarayıcı denemesi getAnimations() ile de bakıyor;
// bu denetim çalışma anında hiç görünmeyen (ör. yalnız bir durumda açılan)
// kuralları da yakalıyor.
for (const f of [...(await dosyalar(join(KOK, 'css'), '.css')), ...(await dosyalar(join(KOK, 'js'), '.js'))]) {
  const s = await readFile(f, 'utf8');
  if (/animation[\w-]*\s*:[^;{}]*\binfinite\b/.test(s) || /iterations\s*:\s*Infinity/.test(s)) hataVer(`${f}: sonsuz hareket`);
}

// (14) Service worker'ın önbellek listesi (KABUK) eksiksiz: caches.addAll
// bir tek dosya 404 verirse BÜTÜN kurulum düşüyor, uygulama internetsiz
// açılmıyor. Kâğıdın yazı tipleri (Cinzel) listeye eklenince tam bu risk.
// Önbellek adı 'ecz-' önekiyle ve veritabanı 'eczane' adıyla kalmalı:
// ikisi değişirse hekimin cihazındaki eski önbellek temizlenmez, kayıtları
// yeni adla boş bir veritabanında kaybolmuş görünür.
{
  const sw = await oku('sw.js');
  const kabuk = sw.match(/const KABUK = \[([\s\S]*?)\];/);
  if (!kabuk) hataVer('sw.js: KABUK listesi bulunamadı');
  else {
    for (const [, yol] of kabuk[1].matchAll(/'\.\/([^']*)'/g)) {
      try { await readFile(join(KOK, yol || 'index.html')); } catch { hataVer(`sw.js KABUK: app/${yol} yok, service worker kurulamaz`); }
    }
    for (const yazi of await readdir(join(KOK, 'yazi'))) {
      if (yazi.endsWith('.woff2') && !kabuk[1].includes(`'./yazi/${yazi}'`)) hataVer(`sw.js KABUK: yazi/${yazi} önbellekte değil, kâğıt internetsiz yedek yazıyla basılır`);
    }
  }
  if (!/const ONBELLEK = 'ecz-' \+/.test(sw)) hataVer("sw.js: önbellek adı 'ecz-' önekini kaybetti");
  if (!/const VT_ADI = 'eczane';/.test(await oku('js/depo/idb.js'))) hataVer("depo/idb.js: veritabanı adı 'eczane' olmalı");
}

console.log(hata ? `${hata} sorun` : `✓ statik denetimler geçti (${kullanilan.size} çeviri anahtarı yerinde)`);
process.exit(hata ? 1 : 0);
