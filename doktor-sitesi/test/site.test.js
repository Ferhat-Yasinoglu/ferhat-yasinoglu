// Yapısal denetimler: site tek dilde (Farsça, RTL) — eski TR/FA anahtar
// geçiş sistemi tamamen kaldırılmış olmalı; menüdeki her çapa hedefi
// sayfada gerçekten bulunmalı.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const KOK = new URL('..', import.meta.url).pathname;
const HTML = readFileSync(join(KOK, 'index.html'), 'utf8');

describe('site', () => {
  it('kok etiket Farsca ve sagdan sola sabit', () => {
    expect(HTML).toMatch(/<html\s+lang="fa"\s+dir="rtl"\s*>/);
  });

  it('eski data-i18n gecis sisteminden iz kalmamis', () => {
    expect(HTML).not.toMatch(/data-i18n/);
  });

  it('i18n.js ve fa.json artik yok (tek dilli site)', () => {
    expect(HTML).not.toMatch(/i18n\.js|fa\.json/);
  });

  it('menudeki her capa hedefi (href="#...") sayfada gercekten var', () => {
    const hedefler = new Set([...HTML.matchAll(/href="#([\w-]+)"/g)].map((m) => m[1]));
    const idler = new Set([...HTML.matchAll(/\sid="([\w-]+)"/g)].map((m) => m[1]));
    const kayip = [...hedefler].filter((h) => !idler.has(h));
    expect(kayip, `id'si olmayan çapa hedefi: ${kayip.join(', ')}`).toEqual([]);
  });

  it('tamas yollari (tel: ve wa.me) dogru numarayla calisiyor', () => {
    expect(HTML).toMatch(/href="tel:\+93791448001"/);
    expect(HTML).toMatch(/href="https:\/\/wa\.me\/93791448001"/);
  });
});
