#!/usr/bin/env node
// Statik denetimler: (1) CSS'te fiziksel yön özelliği yok, (2) innerHTML kullanılmıyor,
// (3) paylasilan/ saf kalıyor (DOM ya da node: yok), (4) sayfa modülleri sözleşmeye uyuyor.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

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

for (const [dil, sozluk] of Object.entries(sozlukler)) {
  const eksik = dinamik.filter(([a]) => !(a in sozluk));
  for (const [a, nereden] of eksik) hataVer(`i18n/${dil}.json: dinamik anahtar eksik → ${a} (${nereden})`);
}
dinamik.forEach(([a]) => kullanilan.add(a));

console.log(hata ? `${hata} sorun` : `✓ statik denetimler geçti (${kullanilan.size} çeviri anahtarı yerinde)`);
process.exit(hata ? 1 : 0);
