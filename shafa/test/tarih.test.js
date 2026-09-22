import { describe, it, expect } from 'vitest';
import { isoGun, gunFarki, tarihMetni, yasHesapla, goreliGun } from '../app/js/paylasilan/tarih.js';

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

describe('tarihMetni / goreliGun', () => {
  // Hekim ve hastaları şemsi takvim kullanıyor: gösterilen tarih o takvimde.
  // Depoda tarih miladi ISO kalıyor — reçete numarası ve sahtecilik özeti
  // ona bağlı, bu yüzden burada yalnız GÖSTERİM deneniyor.
  it('şemsi takvimde yıl/ay/gün yazar', () => {
    expect(tarihMetni('2026-09-22')).toBe('1405/06/31');
    expect(tarihMetni('2026-03-21')).toBe('1405/01/01');   // nevruz: yıl başı
    expect(tarihMetni('2026-03-20')).toBe('1404/12/29');   // bir gün öncesi eski yıl
  });
  it('doğum tarihi gibi eski günleri de çevirir', () => {
    expect(tarihMetni('1985-04-12')).toBe('1364/01/23');
  });
  it('rakamlar Latin: uygulamanın geri kalanı da öyle', () => {
    expect(tarihMetni('2026-09-22')).toMatch(/^[0-9/]+$/);
  });
  it('geçersiz ya da boş tarihte tire döner', () => {
    expect(tarihMetni('')).toBe('—');
    expect(tarihMetni('abc')).toBe('—');
    expect(tarihMetni(null)).toBe('—');
  });
  it('uzaklığı kod olarak verir (cümleyi arayüz kurar)', () => {
    expect(goreliGun('2026-09-20', '2026-09-20')).toEqual({ kod: 'bugun', gun: 0 });
    expect(goreliGun('2026-09-21', '2026-09-20')).toEqual({ kod: 'yarin', gun: 1 });
    expect(goreliGun('2026-09-19', '2026-09-20')).toEqual({ kod: 'dun', gun: 1 });
    expect(goreliGun('2026-09-25', '2026-09-20')).toEqual({ kod: 'sonra', gun: 5 });
    expect(goreliGun('2026-09-10', '2026-09-20')).toEqual({ kod: 'once', gun: 10 });
  });
  it('geçersiz tarihte kod yok döner', () => {
    expect(goreliGun('', '2026-09-20')).toEqual({ kod: 'yok', gun: 0 });
  });
});
