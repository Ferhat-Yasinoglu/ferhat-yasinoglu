// Rx işareti ve hat çizimi: reçete kâğıdı ile form bu iki kurucuya dayanıyor.
// Tarayıcı denemesi (S26, S29) «℞» metnini ve hattın <title>'ını arıyor;
// burada kurucuların bunları gerçekten ürettiği kanıtlanıyor.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sahteDomKur } from './sahte-dom.js';
import { rxIsareti, hatCizimi, HAT_METNI, vecizeCizimi, VECIZE_METNI } from '../app/js/cekirdek/cizimler.js';

const SVG = 'http://www.w3.org/2000/svg';
let kaldir;
beforeAll(() => { kaldir = sahteDomKur(); });
afterAll(() => kaldir());

// Yol verisi yalnız yol komutları ve sayılar taşımalı; bozuk kopyalanmış
// bir yol tarayıcıda sessizce hiçbir şey çizmez.
const YOL_DESENI = /^[MLHVCSQTAZmlhvcsqtaz0-9.,\s-]+$/;

describe('rxIsareti', () => {
  // Ad yalnız gizli «℞»: SVG ekran okuyucudan saklı. İkisinin de adı
  // olunca başlık «Rx ℞» diye iki kez okunuyordu.
  it('currentColor ile boyanan, ekran okuyucudan saklı bir SVG ve tek ad olarak gizli «℞» metni kurar', () => {
    const kap = rxIsareti({ sinif: 'deneme' });
    expect(kap.className).toBe('rx-isaret deneme');
    expect(kap.dir).toBe('ltr');
    const [svg, metin] = kap.children;
    expect(svg.namespaceURI).toBe(SVG);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
    expect(svg.getAttribute('aria-label')).toBeNull();
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
  // Tasarımdaki yükselen taban çizgisi: iki satır −12° döndürülmüş bir
  // grupta, altlarında dönmeyen bir kuyruk.
  it('metni <title> olarak taşıyan, iki satırı yükselen ve kuyruklu bir SVG kurar', () => {
    const svg = hatCizimi();
    expect(svg.namespaceURI).toBe(SVG);
    expect(svg.className).toBe('hat-cizim');
    expect(svg.getAttribute('role')).toBe('img');
    const [baslik, satirlar, kuyruk, ...fazla] = svg.children;
    expect(baslik.tagName).toBe('title');
    expect(baslik.namespaceURI).toBe(SVG);
    expect(baslik.textContent).toBe('سلامت سرمایهٔ زندگی است');
    expect(HAT_METNI).toBe(baslik.textContent);
    expect(fazla).toHaveLength(0);
    expect(satirlar.tagName).toBe('g');
    expect(satirlar.getAttribute('transform')).toMatch(/^rotate\(-\d+(\.\d+)? \d+ \d+\)$/);
    expect(satirlar.children).toHaveLength(2);
    for (const y of [...satirlar.children, kuyruk]) {
      expect(y.tagName).toBe('path');
      expect(y.getAttribute('fill')).toBe('currentColor');
      expect(y.getAttribute('d')).toMatch(YOL_DESENI);
    }
  });
});

/** Yolun kaba sınır kutusu: «x y» çiftleri (H/V tek sayıları atlanıyor, kutu için yeter). */
const kutu = (d) => {
  const p = [...d.matchAll(/(-?\d+)[ ,](-?\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), en: Math.max(...xs) - Math.min(...xs), boy: Math.max(...ys) - Math.min(...ys) };
};

describe('vecizeCizimi', () => {
  it('metni <title> olarak taşıyan, glif başına bir tamsayı yolu olan bir SVG kurar', () => {
    const svg = vecizeCizimi({ sinif: 'deneme' });
    expect(svg.namespaceURI).toBe(SVG);
    expect(svg.className).toBe('vecize-cizim deneme');
    expect(svg.getAttribute('role')).toBe('img');
    const [baslik, ...yollar] = svg.children;
    expect(baslik.tagName).toBe('title');
    expect(baslik.textContent).toBe('طبیب حقیقی خداوند (ج) است');
    expect(VECIZE_METNI).toBe(baslik.textContent);
    expect(yollar.length).toBeGreaterThan(20);
    for (const y of yollar) {
      expect(y.tagName).toBe('path');
      expect(y.getAttribute('fill')).toBe('currentColor');
      expect(y.getAttribute('d')).toMatch(YOL_DESENI);
      // Yuvarlanmış koordinatlar: ondalık yok (yol verisi yarı yarıya kısa).
      expect(y.getAttribute('d')).not.toMatch(/\d\.\d/);
    }
  });

  // Yazı tipinin Arapça alt kümesinde parantez yok: oradan dizilince «( )»
  // boş kutu (.notdef) olarak çıkıyordu. Parantez uzun ve dar bir glif;
  // tam iki tane olmalı ve «ج»yi iki yandan sarmalı.
  it('parantezler gerçek glif: iki uzun dar yol «ج»nin iki yanında', () => {
    const kutular = vecizeCizimi().children.slice(1).map((y) => kutu(y.getAttribute('d')));
    const parantez = kutular.filter((k) => k.boy > 850 && k.boy / k.en > 3);
    expect(parantez).toHaveLength(2);
    const [sol, sag] = parantez.sort((a, b) => a.x0 - b.x0);
    // Arada yalnız «ج»: gövdesi ve noktası.
    const icerde = kutular.filter((k) => k.x0 > sol.x1 && k.x1 < sag.x0);
    expect(icerde).toHaveLength(2);
    expect(Math.max(...icerde.map((k) => k.boy))).toBeGreaterThan(800);
  });
});
