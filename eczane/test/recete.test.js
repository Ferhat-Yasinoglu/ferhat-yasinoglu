import { describe, it, expect } from 'vitest';
import { satirDurumu, satirKapali, durumHesapla, receteOzet, receteNoUret } from '../app/js/paylasilan/recete.js';

const satir = (o) => ({ adet: 2, verilenAdet: 0, sebep: '', birimFiyat: 10, ...o });

describe('satirDurumu', () => {
  it('hiç verilmediyse bekliyor', () => expect(satirDurumu(satir({}))).toBe('bekliyor'));
  it('sebep varsa verilmedi', () => expect(satirDurumu(satir({ sebep: 'stok_yok' }))).toBe('verilmedi'));
  it('eksik verildiyse kısmi', () => expect(satirDurumu(satir({ verilenAdet: 1 }))).toBe('kismi'));
  it('tamamı verildiyse verildi', () => expect(satirDurumu(satir({ verilenAdet: 2 }))).toBe('verildi'));
  it('fazla verildiyse yine verildi', () => expect(satirDurumu(satir({ verilenAdet: 3 }))).toBe('verildi'));
});

describe('durumHesapla', () => {
  it('satır yoksa boş', () => expect(durumHesapla([])).toBe('bos'));
  it('hepsi bekliyorsa bekliyor', () => expect(durumHesapla([satir({}), satir({})])).toBe('bekliyor'));
  it('biri verildiyse kısmi', () => expect(durumHesapla([satir({ verilenAdet: 2 }), satir({})])).toBe('kismi'));
  it('hepsi kapandıysa tamamlandı', () => {
    expect(durumHesapla([satir({ verilenAdet: 2 }), satir({ sebep: 'stok_yok' })])).toBe('tamamlandi');
  });
  it('kısmi verilen satır reçeteyi tamamlamaz', () => {
    expect(durumHesapla([satir({ verilenAdet: 1 })])).toBe('kismi');
  });
});

describe('satirKapali', () => {
  it('verilen ve verilmeyen satır kapalıdır', () => {
    expect(satirKapali(satir({ verilenAdet: 2 }))).toBe(true);
    expect(satirKapali(satir({ sebep: 'hasta_istemedi' }))).toBe(true);
  });
  it('bekleyen satır açıktır', () => expect(satirKapali(satir({}))).toBe(false));
});

describe('receteOzet', () => {
  it('sayıları ve tutarı hesaplar', () => {
    const o = receteOzet({ satirlar: [satir({ verilenAdet: 2 }), satir({ verilenAdet: 1 }), satir({})] });
    expect(o).toMatchObject({ toplam: 3, verilen: 1, bekleyen: 2, durum: 'kismi' });
    expect(o.tutar).toBe(30);
  });
  it('satırsız reçetede sıfırlar', () => {
    expect(receteOzet({ satirlar: [] })).toMatchObject({ toplam: 0, verilen: 0, tutar: 0, durum: 'bos' });
  });
});

describe('receteNoUret', () => {
  it('günün ilk numarasını verir', () => expect(receteNoUret([], '2026-09-20')).toBe('2026-09-20-01'));
  it('aynı günün en büyüğünü artırır', () => {
    expect(receteNoUret(['2026-09-20-01', '2026-09-20-07'], '2026-09-20')).toBe('2026-09-20-08');
  });
  it('başka günün numaralarını saymaz', () => {
    expect(receteNoUret(['2026-09-19-09'], '2026-09-20')).toBe('2026-09-20-01');
  });
});
