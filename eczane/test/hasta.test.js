import { describe, it, expect } from 'vitest';
import { tamAd, hastaYasi, tcGecerli, hastaAra, alerjiCakismasi, hastaDogrula, listeyeCevir } from '../app/js/paylasilan/hasta.js';

describe('tamAd', () => {
  it('ad ve soyadı birleştirir', () => expect(tamAd({ ad: 'Ayşe', soyad: 'Yılmaz' })).toBe('Ayşe Yılmaz'));
  it('eksik soyadı atlar', () => expect(tamAd({ ad: 'Ayşe' })).toBe('Ayşe'));
  it('boş kayıtta boş döner', () => expect(tamAd(null)).toBe(''));
});

describe('tcGecerli', () => {
  it('geçerli numarayı kabul eder', () => expect(tcGecerli('10000000146')).toBe(true));
  it('sağlama tutmayan numarayı reddeder', () => expect(tcGecerli('10000000147')).toBe(false));
  it('sıfırla başlayanı reddeder', () => expect(tcGecerli('01234567890')).toBe(false));
  it('eksik haneli numarayı reddeder', () => expect(tcGecerli('123')).toBe(false));
  it('harf içereni reddeder', () => expect(tcGecerli('1000000014a')).toBe(false));
});

describe('hastaAra', () => {
  const liste = [
    { ad: 'Ayşe', soyad: 'Yılmaz', telefon: '0532 111', kimlikNo: '10000000146' },
    { ad: 'Mehmet', soyad: 'Demir', telefon: '0533 222' },
  ];
  it('soyadından bulur', () => expect(hastaAra(liste, 'yilmaz')).toHaveLength(1));
  it('telefondan bulur', () => expect(hastaAra(liste, '0533')[0].ad).toBe('Mehmet'));
  it('kimlik numarasından bulur', () => expect(hastaAra(liste, '10000000146')).toHaveLength(1));
});

describe('alerjiCakismasi', () => {
  const hasta = { alerjiler: ['Penisilin', 'Aspirin'] };
  it('etken maddeden yakalar', () => {
    expect(alerjiCakismasi(hasta, { ad: 'Largopen', etkenMadde: 'Amoksisilin (penisilin grubu)' })).toBe('Penisilin');
  });
  it('ilaç adından yakalar', () => {
    expect(alerjiCakismasi(hasta, { ad: 'Aspirin 100 mg', etkenMadde: 'Asetilsalisilik asit' })).toBe('Aspirin');
  });
  it('ilgisiz ilaçta null döner', () => {
    expect(alerjiCakismasi(hasta, { ad: 'Parol', etkenMadde: 'Parasetamol' })).toBe(null);
  });
  it('çok kısa alerji metnini yok sayar', () => {
    expect(alerjiCakismasi({ alerjiler: ['ol'] }, { ad: 'Parol', etkenMadde: '' })).toBe(null);
  });
});

describe('hastaDogrula', () => {
  it('ad ve soyad ister', () => {
    const h = hastaDogrula({ ad: '', soyad: '' });
    expect(h.ad).toBeTruthy();
    expect(h.soyad).toBeTruthy();
  });
  it('gelecekteki doğum tarihini reddeder', () => {
    expect(hastaDogrula({ ad: 'A', soyad: 'B', dogumTarihi: '2099-01-01' }).dogumTarihi).toBeTruthy();
  });
  it('doğru kaydı geçirir', () => {
    expect(hastaDogrula({ ad: 'Ayşe', soyad: 'Yılmaz', dogumTarihi: '1985-04-12', eposta: 'a@b.com' })).toEqual({});
  });
});

describe('listeyeCevir', () => {
  it('virgül ve satırla ayırır', () => {
    expect(listeyeCevir('Penisilin, aspirin\nlateks')).toEqual(['Penisilin', 'aspirin', 'lateks']);
  });
  it('boş metinde boş liste verir', () => expect(listeyeCevir('')).toEqual([]));
});
