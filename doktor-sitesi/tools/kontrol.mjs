#!/usr/bin/env node
// Statik denetimler: (1) CSS'te fiziksel yön özelliği yok (RTL bozulmasın),
// (2) JS'te innerHTML ataması yok (XSS'e kapalı).
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const KOK = new URL('..', import.meta.url).pathname;
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
}

console.log(hata ? `${hata} sorun` : '✓ statik denetimler geçti');
process.exit(hata ? 1 : 0);
