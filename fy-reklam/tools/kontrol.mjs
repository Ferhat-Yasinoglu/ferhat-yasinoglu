#!/usr/bin/env node
// Statik denetim (npm run kontrol). Testlerin yakalamadığı, ama yayında sessizce bozulan şeyler:
//   1. app/ altındaki her JS dosyası sözdizimce geçerli (node --check).
//   2. innerHTML / outerHTML / insertAdjacentHTML / document.write yok.
//   3. Sözlük: Türkçe ve Dari aynı anahtarlara sahip; koddaki her t('…') sözlükte var; dinamik
//      ailelerin (bicim., sablon., denetim., yayin_hata., kanal., …) her değeri için çeviri var.
//   4. CSS yalnız mantıksal yön özellikleri kullanır (Dari'de düzen aynalanır).
//   5. Service worker kabuğu bütün uygulama dosyalarını listeler (ve listedekiler var).
//   6. index.html CSP'si yayındaki API adresine izin verir.
//   7. Ürün kataloğu: her ürün dört dilde özet/özellik/çağrı/etiket taşır, simgesi var, 3–5 etiket.
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const kok = fileURLToPath(new URL('..', import.meta.url));
const app = join(kok, 'app');
const hatalar = [];
const hata = (m) => hatalar.push(m);

async function dosyalar(dizin, uzanti) {
  const sonuc = [];
  for (const g of await readdir(dizin, { withFileTypes: true })) {
    const yol = join(dizin, g.name);
    if (g.isDirectory()) sonuc.push(...await dosyalar(yol, uzanti));
    else if (g.name.endsWith(uzanti)) sonuc.push(yol);
  }
  return sonuc;
}
const oku = (yol) => readFile(yol, 'utf8');
const ice = (yol) => import(pathToFileURL(yol).href);

// 1–2. JS sözdizimi ve tehlikeli DOM yazımı
const jsler = await dosyalar(app, '.js');
const kaynaklar = new Map();
for (const f of jsler) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { hata(`${relative(kok, f)}: sözdizimi hatası\n${String(e.stderr).split('\n').slice(0, 4).join('\n')}`); }
  const kod = (await oku(f)).replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  kaynaklar.set(f, kod);
  for (const yasak of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write']) {
    if (kod.includes(yasak)) hata(`${relative(kok, f)}: ${yasak} kullanılmamalı (textContent / dom.js h() kullan)`);
  }
}

// 3. Sözlük
const { SOZLUK } = await ice(join(app, 'js', 'sozluk.js'));
const tr = new Set(Object.keys(SOZLUK.tr));
const fa = new Set(Object.keys(SOZLUK.fa));
for (const a of tr) if (!fa.has(a)) hata(`sözlük: '${a}' Dari'de yok`);
for (const a of fa) if (!tr.has(a)) hata(`sözlük: '${a}' Türkçede yok`);
for (const [dil, s] of Object.entries(SOZLUK)) {
  for (const [a, d] of Object.entries(s)) if (typeof d !== 'string' || !d.trim()) hata(`sözlük ${dil}: '${a}' boş`);
  // yer tutucular iki dilde aynı olmalı
}
for (const a of tr) {
  const yt = (m) => [...m.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(',');
  if (fa.has(a) && yt(SOZLUK.tr[a]) !== yt(SOZLUK.fa[a])) hata(`sözlük: '${a}' yer tutucuları iki dilde farklı`);
}
for (const [f, s] of kaynaklar) {
  for (const m of s.matchAll(/\bt\('([a-z0-9_.-]+)'/gi)) {
    if (!m[1].endsWith('.') && !tr.has(m[1])) hata(`${relative(kok, f)}: t('${m[1]}') sözlükte yok`);
  }
}
const aile = (onek, degerler) => { for (const d of degerler) if (!tr.has(onek + d)) hata(`sözlük: '${onek}${d}' yok (kod bu değeri üretebilir)`); };
const cizim = await ice(join(app, 'js', 'sablon', 'cizim.js'));
aile('bicim.', Object.keys(cizim.BICIMLER));
aile('sablon.', cizim.SABLONLAR);
const metinKaynak = await oku(join(app, 'js', 'paylasilan', 'metin.js'));
aile('denetim.', new Set([...metinKaynak.matchAll(/kod:\s*'([a-z_]+)'/g)].map((m) => m[1])));
aile('kanal.', ['calisir', 'prova', 'kapali', 'yerel']);
aile('kanal_ad.', ['instagram', 'facebook']);
aile('kanal_eylem.', ['instagram', 'facebook', 'indir', 'paylas', 'kopyala', 'business_suite']);
aile('kayit_durum.', ['yayinlandi', 'prova', 'hata', 'yapildi', 'gonderiliyor']);
aile('taslak_durum.', ['taslak', 'paylasildi', 'yayinlandi']);
aile('adim.', ['tasarla', 'metin', 'paylas']);
aile('tasarla.', ['baslik', 'alt', 'cagri']);
aile('metin.', ['kanca', 'deger', 'cagri', 'baglanti', 'kanca_not', 'deger_not', 'cagri_not', 'baglanti_not']);
aile('yayin_hata.', ['yeniden_baglan', 'izin', 'oran', 'gorsel', 'meta', 'ag', 'gorsel_yok', 'metin_uzun', 'kanal_kapali', 'cok_gorsel', 'oturum', 'gorsel_turu', 'gorsel_buyuk', 'kota', 'bekle', 'tekrar', 'kimlik_dogrulama']);
aile('hata.', ['kimlik', 'yapilandirma', 'oran', 'ag', 'sunucu']);

// 4. CSS: fiziksel yönler yasak
const FIZIKSEL = /(^|[\s;{])(margin|padding|border)-(left|right)\b|(^|[\s;{])(left|right)\s*:|text-align\s*:\s*(left|right)\b|float\s*:\s*(left|right)\b|border-(top|bottom)-(left|right)-radius/;
for (const f of await dosyalar(join(app, 'css'), '.css')) {
  (await oku(f)).split('\n').forEach((satir, i) => {
    const temiz = satir.replace(/\/\*.*?\*\//g, '').replace(/url\("[^"]*"\)/g, 'url()');
    if (FIZIKSEL.test(temiz)) hata(`${relative(kok, f)}:${i + 1}: fiziksel yön özelliği (mantıksal olanı kullan): ${satir.trim().slice(0, 100)}`);
  });
}

// 5. Service worker kabuğu
const sw = await oku(join(app, 'sw.js'));
const kabuk = new Set([...sw.matchAll(/'([^']+\.(?:js|css|html|svg|png|webmanifest|woff2))'/g)].map((m) => m[1]));
for (const f of jsler) {
  const r = relative(app, f).split('\\').join('/');
  if (r === 'sw.js') continue;
  if (!kabuk.has(r)) hata(`sw.js: '${r}' kabukta yok (çevrimdışı açılmaz)`);
}
for (const f of await dosyalar(join(app, 'css'), '.css')) {
  const r = relative(app, f).split('\\').join('/');
  if (!kabuk.has(r)) hata(`sw.js: '${r}' kabukta yok`);
}
for (const k of kabuk) {
  try { await readFile(join(app, k)); } catch { hata(`sw.js: kabuktaki '${k}' dosyası yok`); }
}
for (const f of await dosyalar(join(app, 'fonts'), '.woff2')) {
  const r = relative(app, f).split('\\').join('/');
  if (!kabuk.has(r)) hata(`sw.js: '${r}' kabukta yok (yazı tipi çevrimdışı gelmez)`);
}
if (!sw.includes('__SURUM__')) hata('sw.js: __SURUM__ yer tutucusu yok (yeni sürüm kullanıcıya ulaşmaz)');

// 6. CSP ↔ API adresi
const ayar = await oku(join(app, 'js', 'ayar.js'));
const html = await oku(join(app, 'index.html'));
const yayin = /const YAYIN = '([^']+)'/.exec(ayar)?.[1];
const csp = /Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] || '';
const connect = /connect-src ([^;]+)/.exec(csp)?.[1].split(/\s+/) || [];
if (!yayin) hata('ayar.js: YAYIN adresi bulunamadı');
else if (!connect.includes(yayin)) hata(`index.html: CSP connect-src '${yayin}' adresine izin vermiyor`);
if (!/img-src[^;]*\bblob:/.test(csp)) hata('index.html: CSP img-src blob: yok (JPEG önizlemesi görünmez)');
if (!/font-src[^;]*\bdata:/.test(csp)) hata('index.html: CSP font-src data: yok (SVG\'ye gömülü yazı tipleri)');

// 7. Ürün kataloğu
const { URUNLER, DILLER } = await ice(join(app, 'js', 'paylasilan', 'urunler.js'));
const { SIMGE_ADLARI } = await ice(join(app, 'js', 'simge.js'));
const anahtarlar = new Set();
for (const u of URUNLER) {
  if (anahtarlar.has(u.anahtar)) hata(`ürünler: '${u.anahtar}' iki kez`);
  anahtarlar.add(u.anahtar);
  if (!/^[a-z][a-z0-9-]+$/.test(u.anahtar)) hata(`ürünler: '${u.anahtar}' anahtarı küçük harf/rakam/tire olmalı`);
  if (!SIMGE_ADLARI.includes(u.simge)) hata(`ürünler: '${u.anahtar}' simgesi '${u.simge}' simge.js'te yok`);
  if (!/^#[0-9a-f]{6}$/i.test(u.renk)) hata(`ürünler: '${u.anahtar}' rengi hex değil`);
  if (!/^https:\/\//.test(u.adres)) hata(`ürünler: '${u.anahtar}' adresi https değil`);
  for (const d of u.kitle) if (!DILLER.includes(d)) hata(`ürünler: '${u.anahtar}' kitle dili '${d}' bilinmiyor`);
  for (const alan of ['ozet', 'ozellikler', 'cagri', 'etiketler']) {
    for (const d of DILLER) {
      const v = u[alan]?.[d];
      if (v === undefined || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) hata(`ürünler: '${u.anahtar}' ${alan}.${d} yok`);
    }
  }
  for (const d of DILLER) {
    const e = u.etiketler?.[d] || [];
    if (e.length < 3 || e.length > 5) hata(`ürünler: '${u.anahtar}' etiketler.${d} ${e.length} tane (3–5 olmalı)`);
    for (const x of e) if (!/^#[\p{L}\p{N}_]+$/u.test(x)) hata(`ürünler: '${u.anahtar}' etiketi '${x}' geçersiz`);
    if ((u.ozellikler?.[d] || []).some((o) => [...o].length > 90)) hata(`ürünler: '${u.anahtar}' ozellikler.${d} içinde 90 karakteri aşan madde var`);
  }
}

if (hatalar.length) {
  console.error(hatalar.map((h) => '✗ ' + h).join('\n'));
  console.error(`\n${hatalar.length} sorun`);
  process.exit(1);
}
console.log(`kontrol tamam: ${jsler.length} JS dosyası, ${tr.size} sözlük anahtarı (iki dilde), CSS mantıksal, kabuk ${kabuk.size} dosya, ${URUNLER.length} ürün`);
