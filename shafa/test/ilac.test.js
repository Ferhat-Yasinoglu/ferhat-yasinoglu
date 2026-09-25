import { describe, it, expect } from 'vitest';
import { ilacEtiketi, ilacAra, muadiller, ilacDogrula, formKisa, ilacAdiFormsuz, satirAdi, satirGorunumu } from '../app/js/paylasilan/ilac.js';

const ilac = (o) => ({ id: 'ila_1', ad: 'Parol', doz: '500 mg', form: 'tablet', ...o });

describe('ilacEtiketi', () => {
  it('ad, doz ve formu birleştirir', () => expect(ilacEtiketi(ilac({}))).toBe('Parol 500 mg Tablet'));
  it('eksik alanları atlar', () => expect(ilacEtiketi({ ad: 'Parol' })).toBe('Parol'));
  it('şekil adını arayüzün verdiği çeviriyle yazar', () => {
    expect(ilacEtiketi(ilac({ form: 'surup' }), (k) => (k === 'surup' ? 'شربت' : ''))).toBe('Parol 500 mg شربت');
  });
});

describe('satirAdi — kayıttaki ad ekranda ve metinde', () => {
  it('Türkçe şekil adı düşer, Latin kısaltma öne gelir (kâğıttaki gibi)', () => {
    expect(satirAdi({ ilacAdi: 'Panadol Syrup 120 mg/5 ml Şurup', form: 'surup' })).toBe('Syr: Panadol Syrup 120 mg/5 ml');
    expect(satirAdi({ ilacAdi: 'Amoxicillin 500 mg Kapsül', form: 'kapsul' })).toBe('Cap: Amoxicillin 500 mg');
  });
  it('şekli bilinmeyen eski satırda adı olduğu gibi bırakır', () => {
    expect(satirAdi({ ilacAdi: 'Parol 500 mg' })).toBe('Parol 500 mg');
  });
  it('boş satırda boş döner', () => expect(satirAdi({ form: 'tablet' })).toBe(''));
});

describe('ilacAra', () => {
  const liste = [ilac({}), ilac({ id: 'ila_2', ad: 'Augmentin', etkenMadde: 'Amoksisilin', barkod: '8699522090014' })];
  it('etken maddeden bulur', () => expect(ilacAra(liste, 'amoksisilin')).toHaveLength(1));
  it('barkoddan bulur', () => expect(ilacAra(liste, '8699522090014')[0].id).toBe('ila_2'));
  it('boş sorguda hepsini verir', () => expect(ilacAra(liste, '')).toHaveLength(2));
});

describe('muadiller', () => {
  const a = ilac({ id: 'a', etkenMadde: 'Amoksisilin' });
  const b = ilac({ id: 'b', ad: 'Amoklavin', etkenMadde: 'amoksisilin' });
  const c = ilac({ id: 'c', ad: 'Zinnat', etkenMadde: 'Sefuroksim' });
  const d = ilac({ id: 'd', ad: 'Largopen', etkenMadde: 'Amoksisilin' });
  it('aynı etken maddeyi büyük/küçük harf ayırmadan bulur', () => {
    const m = muadiller([a, b, c, d], a);
    expect(m.map((x) => x.id)).toEqual(['b', 'd']);
  });
  it('etken madde yoksa boş döner', () => expect(muadiller([a, b], ilac({ etkenMadde: '' }))).toEqual([]));
});

describe('ilacDogrula', () => {
  it('adsız kaydı reddeder', () => expect(ilacDogrula({ ad: '' }).ad).toBeTruthy());
  it('kısa barkodu reddeder', () => expect(ilacDogrula({ ad: 'X', barkod: '123' }).barkod).toBeTruthy());
  it('doğru kaydı geçirir', () => expect(ilacDogrula({ ad: 'Parol', barkod: '8699514013059' })).toEqual({}));
});


describe('formKisa / ilacAdiFormsuz — kâğıttaki ilaç satırı', () => {
  it('bilinen şeklin Latin kısaltmasını verir', () => {
    expect(formKisa('tablet')).toBe('Tab');
    expect(formKisa('kapsul')).toBe('Cap');
    expect(formKisa('ampul')).toBe('Amp');
  });
  it('bilinmeyen şekilde önek basılmaz', () => {
    expect(formKisa('diger')).toBe('');
    expect(formKisa('')).toBe('');
    expect(formKisa(undefined)).toBe('');
  });
  it('şekil önek olacağı için addan düşer', () => {
    expect(ilacAdiFormsuz('Nurofen 400 mg Tablet', 'tablet')).toBe('Nurofen 400 mg');
  });
  it('şekil bilinmiyorsa ada dokunmaz — eski reçeteler', () => {
    expect(ilacAdiFormsuz('Nurofen 400 mg Tablet', '')).toBe('Nurofen 400 mg Tablet');
  });
  it('ad zaten şekille bitmiyorsa dokunmaz', () => {
    expect(ilacAdiFormsuz('Nurofen 400 mg', 'tablet')).toBe('Nurofen 400 mg');
  });
  it('boş adda patlamaz', () => expect(ilacAdiFormsuz(undefined, 'tablet')).toBe(''));
});

describe('satirGorunumu — formdaki tablonun ad ve güç sütunları', () => {
  it('güç ayrı sütuna, etken madde adın yanına (tasarımdaki «Feldene (Piroxicam)»)', () => {
    expect(satirGorunumu({ ilacAdi: 'Feldene 20 mg Kapsül', form: 'kapsul', doz: '20 mg', etkenMadde: 'Piroxicam' }))
      .toEqual({ ad: 'Feldene (Piroxicam)', doz: '20 mg', kisa: 'Cap' });
  });
  it('etken madde addaysa tekrar etmiyor', () => {
    expect(satirGorunumu({ ilacAdi: 'Paracetamol 500 mg Tablet', form: 'tablet', doz: '500 mg', etkenMadde: 'Paracetamol' }).ad).toBe('Paracetamol');
  });
  // Eski satırda güç yok: ad kayıttaki gibi (gücüyle) kalıyor, hiçbir şey düşmüyor.
  it('gücü olmayan eski satırın adı olduğu gibi', () => {
    expect(satirGorunumu({ ilacAdi: 'Brufen 400 mg Tablet', form: 'tablet', etkenMadde: 'Ibuprofen' }))
      .toEqual({ ad: 'Brufen 400 mg (Ibuprofen)', doz: '', kisa: 'Tab' });
  });
  it('şekli ve etkeni bilinmeyen satır', () => {
    expect(satirGorunumu({ ilacAdi: 'X' })).toEqual({ ad: 'X', doz: '', kisa: '' });
    expect(satirGorunumu(null)).toEqual({ ad: '', doz: '', kisa: '' });
  });
});
