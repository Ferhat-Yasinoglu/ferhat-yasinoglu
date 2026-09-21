import { describe, it, expect } from 'vitest';
import { normalize, eslesir, basHarfler, kisalt, paraMetni } from '../app/js/paylasilan/metin.js';
import { simdi } from '../app/js/paylasilan/kimlik.js';

describe('normalize', () => {
  it('Türkçe harfleri sadeleştirir', () => {
    expect(normalize('Sarılık')).toBe('sarilik');
    expect(normalize('İBUPROFEN')).toBe('ibuprofen');
    expect(normalize('ÇİĞDEM Şûle')).toBe('cigdem sule');
  });
  it('büyük I harfini i yapar', () => {
    // JS'in kendi toLowerCase'i "I"yı "i" yapar ama "İ"yi "i̇" yapar; ikisi de aynı olmalı.
    expect(normalize('IBUPROFEN')).toBe(normalize('İBUPROFEN'));
  });
  it('boş değerleri yutar', () => {
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
  });
});

describe('eslesir', () => {
  it('kelime sırasından bağımsız arar', () => {
    expect(eslesir('Augmentin BID 1000 mg', 'bid augmentin')).toBe(true);
    expect(eslesir('Augmentin BID', 'parol')).toBe(false);
  });
  it('boş sorgu her şeye uyar', () => {
    expect(eslesir('Parol', '')).toBe(true);
  });
});

describe('basHarfler', () => {
  it('ad ve soyadın baş harfini alır', () => {
    expect(basHarfler('Ayşe Yılmaz')).toBe('AY');
    expect(basHarfler('Mehmet')).toBe('M');
    expect(basHarfler('')).toBe('?');
  });
});

describe('kisalt / paraMetni', () => {
  it('uzun metni keser', () => {
    expect(kisalt('abcdefghij', 5)).toBe('abcd…');
    expect(kisalt('abc', 5)).toBe('abc');
  });
  it('geçersiz sayıya tire koyar', () => {
    expect(paraMetni('abc')).toBe('—');
    expect(paraMetni(12.5)).toContain('12,50');
  });
  it('girilmemiş fiyatı sıfır saymaz', () => {
    expect(paraMetni('')).toBe('—');
    expect(paraMetni(null)).toBe('—');
    expect(paraMetni(undefined)).toBe('—');
    expect(paraMetni(0)).toContain('0,00');
  });
});

describe('simdi', () => {
  it('arka arkaya çağrılarda hep ileri gider', () => {
    const damgalar = Array.from({ length: 50 }, () => simdi());
    for (let i = 1; i < damgalar.length; i++) {
      expect(damgalar[i] > damgalar[i - 1]).toBe(true);
    }
  });
  it('duvar saatinden geri kalmaz', () => {
    const once = Date.now();
    expect(Date.parse(simdi())).toBeGreaterThanOrEqual(once);
  });
});
