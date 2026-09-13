// Çeviri kapsaması: koddaki her t('anahtar', 'Türkçe') çağrısının üç dil
// dosyasında da karşılığı olmalı. Eksik anahtar sessizce Türkçeye düşüyor —
// arayüz "çevrilmiş" görünüp Türkçe kalıyordu; bu test onu görünür kılar.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const KOK = new URL('..', import.meta.url).pathname;
const DILLER = ['de', 'en', 'fa'];
// Birleştirilerek kurulan anahtarlar (ör. t('menu.grup.' + x)) statik taranamaz.
const DINAMIK_ONEK = ['menu.grup.', 'adim.tip.'];

function jsDosyalari(dizin) {
  return readdirSync(dizin).flatMap((ad) => {
    const yol = join(dizin, ad);
    return statSync(yol).isDirectory() ? jsDosyalari(yol) : yol.endsWith('.js') ? [yol] : [];
  });
}

function kullanilanAnahtarlar() {
  const pat = /\bt\(\s*'([a-z0-9_.]+)'\s*,\s*'((?:[^'\\]|\\.)*)'/gi;
  const bulunan = new Map();
  for (const f of jsDosyalari(join(KOK, 'app/js'))) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(pat)) if (!bulunan.has(m[1])) bulunan.set(m[1], m[2]);
  }
  for (const m of readFileSync(join(KOK, 'app/index.html'), 'utf8').matchAll(/data-i18n="([^"]+)"/g)) {
    if (!bulunan.has(m[1])) bulunan.set(m[1], '(html)');
  }
  return bulunan;
}

const kullanilan = kullanilanAnahtarlar();

describe('i18n kapsamasi', () => {
  it('kodda anahtar bulur (tarayici bozulursa test anlamsizlasmasin)', () => {
    expect(kullanilan.size).toBeGreaterThan(400);
  });

  for (const dil of DILLER) {
    it(`${dil}: kullanilan her anahtarin karsiligi var`, () => {
      const d = JSON.parse(readFileSync(join(KOK, `app/i18n/${dil}.json`), 'utf8'));
      const eksik = [...kullanilan.keys()].filter((k) => !(k in d));
      expect(eksik, `${dil}.json eksik: ${eksik.join(', ')}`).toEqual([]);
    });

    it(`${dil}: bos ya da Turkce kalmis deger yok`, () => {
      const d = JSON.parse(readFileSync(join(KOK, `app/i18n/${dil}.json`), 'utf8'));
      const bos = Object.entries(d).filter(([, v]) => typeof v !== 'string' || !v.trim()).map(([k]) => k);
      expect(bos, `${dil}.json bos deger: ${bos.join(', ')}`).toEqual([]);
    });
  }

  it('uc dil dosyasi ayni anahtar kumesini tasir', () => {
    const kumeler = DILLER.map((dil) => ({
      dil, k: new Set(Object.keys(JSON.parse(readFileSync(join(KOK, `app/i18n/${dil}.json`), 'utf8')))),
    }));
    const temel = kumeler[0];
    for (const x of kumeler.slice(1)) {
      const fark = [...temel.k].filter((k) => !x.k.has(k)).concat([...x.k].filter((k) => !temel.k.has(k)));
      expect(fark, `${temel.dil} ↔ ${x.dil} farki: ${fark.join(', ')}`).toEqual([]);
    }
  });

  it('dil dosyasinda kullanilmayan anahtar birikmesin', () => {
    const d = JSON.parse(readFileSync(join(KOK, 'app/i18n/en.json'), 'utf8'));
    const olu = Object.keys(d).filter((k) => !kullanilan.has(k) && !DINAMIK_ONEK.some((p) => k.startsWith(p)));
    // Ölü anahtar hata değil ama 25'i aşarsa dosya çöplüğe dönüyor demektir.
    expect(olu.length, `kullanilmayan: ${olu.join(', ')}`).toBeLessThan(25);
  });
});
