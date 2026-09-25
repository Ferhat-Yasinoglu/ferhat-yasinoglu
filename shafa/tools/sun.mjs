#!/usr/bin/env node
// Sıfır bağımlılıklı statik sunucu: `node tools/sun.mjs app 8788`.
// Yerel geliştirme için; yayında dosyalar olduğu gibi statik bir sunucudan verilir.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export function mimeBul(yol) {
  return MIME[extname(yol).toLowerCase()] || 'application/octet-stream';
}

async function dosyaOku(yol) {
  const bilgi = await stat(yol);
  if (bilgi.isDirectory()) return dosyaOku(join(yol, 'index.html'));
  return { govde: await readFile(yol), tur: mimeBul(yol) };
}

/** Tek bir statik isteği yanıtlar. sunucu/yerel.mjs de uygulamayı bununla sunar. */
export async function statikSun(kok, istek, yanit) {
  // Yol köke hapsedilir; ".." ile dışarı çıkılamaz.
  const ham = decodeURIComponent(new URL(istek.url, 'http://x').pathname);
  const yol = normalize(join(kok, ham));
  if (!yol.startsWith(kok)) { yanit.writeHead(403); return yanit.end(); }
  try {
    const { govde, tur } = await dosyaOku(yol);
    yanit.writeHead(200, { 'Content-Type': tur, 'Cache-Control': 'no-store' });
    yanit.end(govde);
  } catch {
    yanit.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    yanit.end('bulunamadi: ' + ham);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const kok = resolve(process.argv[2] || 'app');
  const port = Number(process.argv[3] || 8788);
  createServer((istek, yanit) => statikSun(kok, istek, yanit))
    .listen(port, () => console.log(`sunuluyor: http://localhost:${port}/  (${kok})`));
}
