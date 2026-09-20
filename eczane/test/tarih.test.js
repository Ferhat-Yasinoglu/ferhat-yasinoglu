import { describe, it, expect } from 'vitest';
import { isoGun, gunFarki, trTarih, yasHesapla, goreliGun } from '../app/js/paylasilan/tarih.js';

describe('isoGun', () => {
  it('yerel saate göre gün verir', () => {
    expect(isoGun(new Date(2026, 8, 20, 23, 30))).toBe('2026-09-20');
  });
  it('geçersiz tarihte boş döner', () => {
    expect(isoGun(new Date('olmaz'))).toBe('');
  });
});

describe('gunFarki', () => {
  it('gün farkını verir', () => {
    expect(gunFarki('2026-09-20', '2026-09-25')).toBe(5);
    expect(gunFarki('2026-09-25', '2026-09-20')).toBe(-5);
    expect(gunFarki('2026-02-28', '2026-03-01')).toBe(1); // 2026 artık yıl değil
  });
  it('eksik değerde null döner', () => {
    expect(gunFarki('', '2026-01-01')).toBe(null);
  });
});

describe('yasHesapla', () => {
  it('doğum günü gelmediyse bir eksiltir', () => {
    expect(yasHesapla('2000-12-31', '2026-09-20')).toBe(25);
    expect(yasHesapla('2000-01-01', '2026-09-20')).toBe(26);
    expect(yasHesapla('2000-09-20', '2026-09-20')).toBe(26);
  });
  it('gelecekteki doğum tarihinde null döner', () => {
    expect(yasHesapla('2030-01-01', '2026-09-20')).toBe(null);
  });
});

describe('trTarih / goreliGun', () => {
  it('gün.ay.yıl biçimine çevirir', () => {
    expect(trTarih('2026-09-20')).toBe('20.09.2026');
    expect(trTarih('')).toBe('—');
  });
  it('bugünü ve dünü adıyla söyler', () => {
    expect(goreliGun('2026-09-20', '2026-09-20')).toBe('bugün');
    expect(goreliGun('2026-09-19', '2026-09-20')).toBe('dün');
    expect(goreliGun('2026-09-25', '2026-09-20')).toBe('5 gün sonra');
  });
});
