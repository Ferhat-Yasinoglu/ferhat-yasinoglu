#!/usr/bin/env node
// Statik denetimler: (1) CSS'te fiziksel yön özellikleri yok (RTL), (2) innerHTML kullanılmıyor,
// (3) paylasilan/ içinde DOM ya da node: bağımlılığı yok, (4) her sayfa modülü sözleşmeye uyuyor.
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
  if (/\.innerHTML\s*=/.test(s) && !f.includes('analitik.js')) hataVer(`${f}: innerHTML ataması`);
  if (f.includes('/paylasilan/') && /\b(document|window|localStorage)\s*[.[]/.test(s)) hataVer(`${f}: paylasilan/ içinde DOM erişimi`);
  if (f.includes('/paylasilan/') && /from ['"]node:/.test(s)) hataVer(`${f}: paylasilan/ içinde node: bağımlılığı`);
  if (f.includes('/sayfalar/') && !/export default/.test(s)) hataVer(`${f}: sayfa modülü default export vermiyor`);
}
console.log(hata ? `${hata} sorun` : '✓ statik denetimler geçti');
process.exit(hata ? 1 : 0);
