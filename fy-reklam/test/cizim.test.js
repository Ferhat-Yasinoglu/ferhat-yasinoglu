// Görsel üretimi Node'da: canvas yok, ölçüm tahminle; SVG metni iyi biçimli ve içerik yerinde mi.
import { describe, it, expect } from 'vitest';
import { svgUret, BICIMLER, SABLONLAR, vurguParcala, varsayilanMetinler } from '../app/js/sablon/cizim.js';
import { URUNLER, DILLER, metin, urunBul } from '../app/js/paylasilan/urunler.js';

/** Basit iyi biçimlilik: açılan her etiket kapanıyor, kaçışsız & yok, viewBox ölçüyle aynı. */
function iyiBicimli(svg, { w, h }) {
  expect(svg.startsWith('<svg ')).toBe(true);
  expect(svg.endsWith('</svg>')).toBe(true);
  expect(svg).toContain(`viewBox="0 0 ${w} ${h}"`);
  for (const etiket of ['text', 'g', 'defs', 'svg', 'tspan', 'style']) {
    const acik = (svg.match(new RegExp(`<${etiket}[\\s>]`, 'g')) || []).length;
    const kapali = (svg.match(new RegExp(`</${etiket}>`, 'g')) || []).length;
    expect(acik, etiket).toBe(kapali);
  }
  // kaçışsız & (entity olmayan)
  expect(svg.replace(/&(amp|lt|gt|quot|apos|#\d+);/g, '')).not.toMatch(/&/);
  expect(svg).not.toMatch(/undefined|NaN/);
}

describe('svgUret', () => {
  const urun = urunBul('dawayar');
  for (const bicim of Object.keys(BICIMLER)) {
    for (const sablon of SABLONLAR) {
      it(`${bicim} · ${sablon} · tr iyi biçimli ve içeriği taşıyor`, async () => {
        const taslak = { bicim, sablon, dil: 'tr', ...varsayilanMetinler(urun, 'tr', metin), logo: true };
        const svg = await svgUret(taslak, urun);
        iyiBicimli(svg, BICIMLER[bicim]);
        expect(svg).toContain('Dawayar');
        expect(svg).toContain('@farhad___yaqoobi');
        if (sablon !== 'baslik') expect(svg).toContain(taslak.ozellikler[0].split(' ')[0]);
      });
    }
  }
  it('Dari: sağdan sola, Vazirmatn, serif italik yok', async () => {
    const taslak = { bicim: 'dikey', sablon: 'ozellikler', dil: 'fa', ...varsayilanMetinler(urun, 'fa', metin) };
    const svg = await svgUret(taslak, urun);
    iyiBicimli(svg, BICIMLER.dikey);
    expect(svg).toContain('direction="rtl"');
    expect(svg).toContain('Vazirmatn');
    expect(svg).not.toContain('Instrument Serif" font-style');
  });
  it('vurgu kelimesi serif italik ve kireç', async () => {
    const taslak = { bicim: 'kare', sablon: 'baslik', dil: 'tr', baslik: 'Elektrik gidince *kasa* durmaz', alt: '', cagri: '', ozellikler: [] };
    const svg = await svgUret(taslak, urun);
    expect(svg).toMatch(/<tspan font-family="Instrument Serif"[^>]*fill="#c0f244">kasa/);
  });
  it('XML özel karakterleri kaçırılır', async () => {
    const taslak = { bicim: 'kare', sablon: 'baslik', dil: 'en', baslik: 'A & B <c>', alt: '"q"', cagri: "it's", ozellikler: [] };
    const svg = await svgUret(taslak, urun);
    iyiBicimli(svg, BICIMLER.kare);
    expect(svg).toContain('A &amp; B &lt;c&gt;');
  });
  it('logo kapatılınca FY harfleri ve hesap yok', async () => {
    const taslak = { bicim: 'kare', sablon: 'baslik', dil: 'tr', baslik: 'x', alt: '', cagri: '', ozellikler: [], logo: false };
    const svg = await svgUret(taslak, urun);
    expect(svg).not.toContain('@farhad___yaqoobi');
    expect(svg).not.toContain('M471 243');
  });
});

describe('vurguParcala', () => {
  it('yıldızlar arası vurgu, gerisi düz', () => {
    expect(vurguParcala('a *b c* d')).toEqual([{ metin: 'a ', vurgu: false }, { metin: 'b c', vurgu: true }, { metin: ' d', vurgu: false }]);
  });
  it('işaretsiz metin tek parça; tek yıldız olduğu gibi', () => {
    expect(vurguParcala('düz')).toEqual([{ metin: 'düz', vurgu: false }]);
    expect(vurguParcala('a * b')).toEqual([{ metin: 'a * b', vurgu: false }]);
  });
});

describe('ürün kataloğu', () => {
  it('her ürün dört dilde özet, özellik, çağrı ve 3–5 etiket taşır', () => {
    for (const u of URUNLER) for (const d of DILLER) {
      expect(u.ozet[d], `${u.anahtar} ozet ${d}`).toBeTruthy();
      expect(u.ozellikler[d]?.length, `${u.anahtar} ozellikler ${d}`).toBeGreaterThanOrEqual(3);
      expect(u.cagri[d], `${u.anahtar} cagri ${d}`).toBeTruthy();
      expect(u.etiketler[d]?.length, `${u.anahtar} etiketler ${d}`).toBeGreaterThanOrEqual(3);
      expect(u.etiketler[d]?.length).toBeLessThanOrEqual(5);
    }
  });
  it('varsayılan metinler üründen, başlık vurgulu ürün adı', () => {
    const v = varsayilanMetinler(urunBul('shafa'), 'fa', metin);
    expect(v.baslik).toBe('*Shafa*');
    expect(v.ozellikler).toHaveLength(4);
    expect(v.cagri).toContain('shafa.pages.dev');
  });
});
