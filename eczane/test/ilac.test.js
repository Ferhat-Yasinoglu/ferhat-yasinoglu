import { describe, it, expect } from 'vitest';
import { ilacEtiketi, ilacAra, muadiller, ilacDogrula } from '../app/js/paylasilan/ilac.js';

const ilac = (o) => ({ id: 'ila_1', ad: 'Parol', doz: '500 mg', form: 'tablet', ...o });

describe('ilacEtiketi', () => {
  it('ad, doz ve formu birleştirir', () => expect(ilacEtiketi(ilac({}))).toBe('Parol 500 mg Tablet'));
  it('eksik alanları atlar', () => expect(ilacEtiketi({ ad: 'Parol' })).toBe('Parol'));
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

