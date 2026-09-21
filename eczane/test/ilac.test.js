import { describe, it, expect } from 'vitest';
import { stokDurumu, sktDurumu, ilacEtiketi, ilacAra, muadiller, ilacUyarilari, ilacDogrula, hareketYonu } from '../app/js/paylasilan/ilac.js';

const ilac = (o) => ({ id: 'ila_1', ad: 'Parol', doz: '500 mg', form: 'tablet', stok: 10, kritikStok: 5, ...o });

describe('stokDurumu', () => {
  it('sıfır stokta yok der', () => expect(stokDurumu(ilac({ stok: 0 }))).toBe('yok'));
  it('eşiğe inince kritik der', () => expect(stokDurumu(ilac({ stok: 5 }))).toBe('kritik'));
  it('eşiğin üstünde normal der', () => expect(stokDurumu(ilac({ stok: 6 }))).toBe('normal'));
  it('eşik tanımsızsa yalnız tükenmeye bakar', () => expect(stokDurumu(ilac({ stok: 1, kritikStok: 0 }))).toBe('normal'));
});

describe('sktDurumu', () => {
  it('tarih yoksa yok der', () => expect(sktDurumu(ilac({}), '2026-09-20')).toBe('yok'));
  it('geçmiş tarihi yakalar', () => expect(sktDurumu(ilac({ sonKullanma: '2026-09-19' }), '2026-09-20')).toBe('gecti'));
  it('90 gün içini yaklaşıyor sayar', () => {
    expect(sktDurumu(ilac({ sonKullanma: '2026-10-20' }), '2026-09-20')).toBe('yaklasiyor');
    expect(sktDurumu(ilac({ sonKullanma: '2027-09-20' }), '2026-09-20')).toBe('normal');
  });
  it('tam sınır günü hâlâ uyarır', () => {
    expect(sktDurumu(ilac({ sonKullanma: '2026-12-19' }), '2026-09-20')).toBe('yaklasiyor');
  });
});

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
  const a = ilac({ id: 'a', etkenMadde: 'Amoksisilin', stok: 4 });
  const b = ilac({ id: 'b', ad: 'Amoklavin', etkenMadde: 'amoksisilin', stok: 7 });
  const c = ilac({ id: 'c', ad: 'Zinnat', etkenMadde: 'Sefuroksim', stok: 3 });
  const d = ilac({ id: 'd', ad: 'Largopen', etkenMadde: 'Amoksisilin', stok: 0 });
  it('aynı etken maddeyi stoktan bulur', () => {
    const m = muadiller([a, b, c, d], a);
    expect(m.map((x) => x.id)).toEqual(['b']);
  });
  it('etken madde yoksa boş döner', () => expect(muadiller([a, b], ilac({ etkenMadde: '' }))).toEqual([]));
});

describe('ilacUyarilari', () => {
  it('stok ve tarih uyarılarını birlikte verir', () => {
    const u = ilacUyarilari(ilac({ stok: 0, sonKullanma: '2026-09-01' }), '2026-09-20');
    expect(u.map((x) => x.kod)).toEqual(['stok_yok', 'skt_gecti']);
  });
  it('cümle değil kod ve değişken döner', () => {
    const u = ilacUyarilari(ilac({ stok: 3, kritikStok: 5, sonKullanma: '2026-10-01' }), '2026-09-20');
    expect(u).toEqual([
      { tur: 'uyari', kod: 'stok_kritik', veri: { n: 3 } },
      { tur: 'uyari', kod: 'skt_yakin', veri: { n: 11 } },
    ]);
  });
  it('sorun yoksa boş döner', () => {
    expect(ilacUyarilari(ilac({ stok: 50, sonKullanma: '2030-01-01' }), '2026-09-20')).toEqual([]);
  });
});

describe('ilacDogrula', () => {
  it('adsız kaydı reddeder', () => expect(ilacDogrula({ ad: '' }).ad).toBeTruthy());
  it('kısa barkodu reddeder', () => expect(ilacDogrula({ ad: 'X', barkod: '123' }).barkod).toBeTruthy());
  it('negatif stoğu reddeder', () => expect(ilacDogrula({ ad: 'X', stok: -1 }).stok).toBeTruthy());
  it('doğru kaydı geçirir', () => expect(ilacDogrula({ ad: 'Parol', barkod: '8699514013059', stok: 5, sonKullanma: '2027-01-01' })).toEqual({}));
});

describe('hareketYonu', () => {
  it('giriş ve iade artırır', () => {
    expect(hareketYonu('giris')).toBe(1);
    expect(hareketYonu('iade')).toBe(1);
  });
  it('reçete ve fire azaltır', () => {
    expect(hareketYonu('recete')).toBe(-1);
    expect(hareketYonu('fire')).toBe(-1);
  });
});
