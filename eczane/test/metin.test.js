import { describe, it, expect } from 'vitest';
import { normalize, eslesir, basHarfler, kisalt, paraMetni, telefonNormalize, bicimAyarla, sayiMetni } from '../app/js/paylasilan/metin.js';
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
  it('para birimi ve dil ayarlanabilir', () => {
    bicimAyarla({ dil: 'tr', kur: 'TRY' });
    expect(paraMetni(12.5)).toContain('12,50');
    expect(paraMetni(12.5)).toMatch(/₺|TRY/);

    bicimAyarla({ kur: 'AFN' });
    expect(paraMetni(12.5)).toMatch(/؋|AFN/);

    bicimAyarla({ dil: 'en', kur: 'USD' });
    expect(paraMetni(1234.5)).toContain('1,234.50');

    bicimAyarla({ dil: 'tr', kur: 'AFN' });   // varsayılana dön
  });
  it('Dari biçiminde de Latin rakam kullanır', () => {
    bicimAyarla({ dil: 'fa', kur: 'AFN' });
    expect(sayiMetni(1234)).toMatch(/^[\d.,\s\u00a0]+$/);
    expect(paraMetni(20)).toMatch(/\d/);
    bicimAyarla({ dil: 'tr', kur: 'AFN' });
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

describe('telefonNormalize', () => {
  it('baştaki sıfırı ülke koduyla değiştirir', () => {
    expect(telefonNormalize('0702397511', '93')).toBe('93702397511');
    expect(telefonNormalize('0532 000 00 01', '90')).toBe('905320000001');
  });
  it('artı ile başlayan numarayı olduğu gibi alır', () => {
    expect(telefonNormalize('+93 702 397 511', '90')).toBe('93702397511');
    expect(telefonNormalize('0093702397511')).toBe('93702397511');
  });
  it('zaten ülke koduyla başlayan numarayı tekrarlamaz', () => {
    expect(telefonNormalize('93702397511', '93')).toBe('93702397511');
  });
  it('ülke kodu yoksa yalnız rakamları verir', () => {
    expect(telefonNormalize('702-397-511')).toBe('702397511');
  });
  it('boş değerde boş döner', () => {
    expect(telefonNormalize('')).toBe('');
    expect(telefonNormalize(null, '93')).toBe('');
    expect(telefonNormalize('abc')).toBe('');
  });
});
