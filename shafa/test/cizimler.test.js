// Rx işareti ve hat çizimi: reçete kâğıdı ile form bu iki kurucuya dayanıyor.
// Tarayıcı denemesi (S26, S29) «℞» metnini ve hattın <title>'ını arıyor;
// burada kurucuların bunları gerçekten ürettiği kanıtlanıyor.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sahteDomKur } from './sahte-dom.js';
import { rxIsareti, hatCizimi, HAT_METNI } from '../app/js/cekirdek/cizimler.js';

const SVG = 'http://www.w3.org/2000/svg';
let kaldir;
beforeAll(() => { kaldir = sahteDomKur(); });
afterAll(() => kaldir());

// Yol verisi yalnız yol komutları ve sayılar taşımalı; bozuk kopyalanmış
// bir yol tarayıcıda sessizce hiçbir şey çizmez.
const YOL_DESENI = /^[MLHVCSQTAZmlhvcsqtaz0-9.,\s-]+$/;

describe('rxIsareti', () => {
  it('currentColor ile boyanan, adı "Rx" olan bir SVG ve gizli «℞» metni kurar', () => {
    const kap = rxIsareti({ sinif: 'deneme' });
    expect(kap.className).toBe('rx-isaret deneme');
    expect(kap.dir).toBe('ltr');
    const [svg, metin] = kap.children;
    expect(svg.namespaceURI).toBe(SVG);
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Rx');
    expect(svg.getAttribute('viewBox')).toMatch(/^-?\d+ -?\d+ \d+ \d+$/);
    const yollar = svg.torunlar().filter((o) => o.tagName === 'path');
    expect(yollar).toHaveLength(1);
    expect(yollar[0].getAttribute('fill')).toBe('currentColor');
    expect(yollar[0].getAttribute('d')).toMatch(YOL_DESENI);
    expect(metin.className).toBe('gizli-metin');
    expect(metin.textContent).toBe('℞');
  });
});

describe('hatCizimi', () => {
  it('metni <title> olarak taşıyan iki satırlık bir SVG kurar', () => {
    const svg = hatCizimi();
    expect(svg.namespaceURI).toBe(SVG);
    expect(svg.className).toBe('hat-cizim');
    expect(svg.getAttribute('role')).toBe('img');
    const [baslik, ...yollar] = svg.children;
    expect(baslik.tagName).toBe('title');
    expect(baslik.namespaceURI).toBe(SVG);
    expect(baslik.textContent).toBe('سلامت سرمایهٔ زندگی است');
    expect(HAT_METNI).toBe(baslik.textContent);
    expect(yollar).toHaveLength(2);
    for (const y of yollar) {
      expect(y.tagName).toBe('path');
      expect(y.getAttribute('fill')).toBe('currentColor');
      expect(y.getAttribute('d')).toMatch(YOL_DESENI);
    }
  });
});
