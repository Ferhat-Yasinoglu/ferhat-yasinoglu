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

console.log(hata ? `${hata} sorun` : `✓ statik denetimler geçti (${kullanilan.size} çeviri anahtarı yerinde)`);
process.exit(hata ? 1 : 0);
