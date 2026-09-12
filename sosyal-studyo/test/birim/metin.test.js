import { describe, expect, it } from 'vitest';
import { doldur, eslesir, kelimeVar, kes, normalize, varyantSec } from '../../app/js/paylasilan/metin.js';

describe('normalize', () => {
  it('Türkçe İ/ı ve aksanları eşitler', () => {
    expect(normalize('İNDİRİM')).toBe('indirim');
    expect(normalize('indırım')).toBe('indirim');
    expect(normalize('Günaydın')).toBe('gunaydin');
    expect(normalize('  çok   boşluk ')).toBe('cok bosluk');
  });
});

describe('eslesir', () => {
  it('contains / exact / any', () => {
    expect(eslesir('Fiyat nedir?', ['fiyat'])).toBe(true);
    expect(eslesir('Fiyat nedir?', ['fiyat'], 'exact')).toBe(false);
    expect(eslesir('fiyat', ['FİYAT'], 'exact')).toBe(true);
    expect(eslesir('', ['x'], 'any')).toBe(true);
    expect(eslesir('', ['x'])).toBe(false);
  });
});

describe('doldur', () => {
  it('yer tutucuları doldurur, bilinmeyeni boş bırakır', () => {
    expect(doldur('Merhaba {{ad}}, {{yok}}!', { ad: 'Ali' })).toBe('Merhaba Ali, !');
  });
});

describe('varyantSec', () => {
  it('aynı anahtara hep aynı varyantı verir', () => {
    const l = ['a', 'b', 'c', 'd'];
    expect(varyantSec(l, 'yorum-1')).toBe(varyantSec(l, 'yorum-1'));
    expect(varyantSec([], 'x')).toBe('');
  });
});

describe('kelimeVar / kes', () => {
  it('yalnız emoji ise kelime yok', () => {
    expect(kelimeVar('❤️🔥')).toBe(false);
    expect(kelimeVar('selam')).toBe(true);
  });
  it('kelime ortasından kesmez', () => {
    expect(kes('merhaba dünya nasılsın', 14)).toBe('merhaba dünya…');
    expect(kes('kısa', 10)).toBe('kısa');
  });
});
