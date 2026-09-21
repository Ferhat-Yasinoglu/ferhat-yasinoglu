import { describe, it, expect } from 'vitest';
import {
  satirDurumu, satirKapali, durumHesapla, receteOzet, receteNoUret,
  satirKalan, receteDogrula, bosRecete, receteUyarilari, receteMetni, doluOlcumler, OLCUMLER,
} from '../app/js/paylasilan/recete.js';

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

describe('satirKalan', () => {
  it('istenen eksi verilen', () => expect(satirKalan({ adet: 3, verilenAdet: 1 })).toBe(2));
  it('fazla verilende eksiye düşmez', () => expect(satirKalan({ adet: 2, verilenAdet: 5 })).toBe(0));
});

describe('receteDogrula', () => {
  const gecerli = { hastaId: 'has_1', tarih: '2026-09-21', satirlar: [{ adet: 1 }] };
  it('hasta ister', () => expect(receteDogrula({ ...gecerli, hastaId: '' }).hastaId).toBeTruthy());
  it('en az bir ilaç ister', () => expect(receteDogrula({ ...gecerli, satirlar: [] }).satirlar).toBeTruthy());
  it('sıfır adetli satırı reddeder', () => expect(receteDogrula({ ...gecerli, satirlar: [{ adet: 0 }] }).satirlar).toBeTruthy());
  it('bozuk tarihi reddeder', () => expect(receteDogrula({ ...gecerli, tarih: '21.09.2026' }).tarih).toBeTruthy());
  it('doğru reçeteyi geçirir', () => expect(receteDogrula(gecerli)).toEqual({}));
});

describe('bosRecete', () => {
  it('doktor bilgilerini ayarlardan alır', () => {
    const r = bosRecete({ doktorAd: 'Ahmet Yılmaz', diplomaNo: '12345' }, '2026-09-21');
    expect(r).toMatchObject({ doktorAd: 'Ahmet Yılmaz', diplomaNo: '12345', tarih: '2026-09-21', tur: 'normal' });
    expect(r.satirlar).toEqual([]);
  });
});

describe('receteUyarilari', () => {
  const ilaclar = [
    { id: 'a', ad: 'Largopen', etkenMadde: 'Amoksisilin', stok: 10 },
    { id: 'b', ad: 'Amoklavin', etkenMadde: 'amoksisilin', stok: 4 },
    { id: 'c', ad: 'Parol', etkenMadde: 'Parasetamol', stok: 2 },
  ];
  const hasta = { alerjiler: ['Penisilin'] };
  const alerjiBul = (h, i) => (i.ad === 'Largopen' && h.alerjiler.includes('Penisilin') ? 'Penisilin' : null);

  it('alerjiyi satırına bağlar', () => {
    const u = receteUyarilari([{ ilacId: 'a', adet: 1 }], hasta, ilaclar, { alerjiBul });
    expect(u).toEqual([{ satir: 0, tur: 'hata', kod: 'alerji', veri: { ad: 'Largopen', a: 'Penisilin' } }]);
  });
  it('istenen adet stoktan fazlaysa uyarır', () => {
    const u = receteUyarilari([{ ilacId: 'c', adet: 5 }], null, ilaclar, {});
    expect(u).toEqual([{ satir: 0, tur: 'uyari', kod: 'stok_yetersiz', veri: { ad: 'Parol', istenen: 5, mevcut: 2 } }]);
  });
  it('stok yetiyorsa susar', () => {
    expect(receteUyarilari([{ ilacId: 'c', adet: 2 }], null, ilaclar, {})).toEqual([]);
  });
  it('aynı etken maddeyi iki satırda yakalar', () => {
    const u = receteUyarilari([{ ilacId: 'a', adet: 1 }, { ilacId: 'b', adet: 1 }], null, ilaclar, {});
    expect(u.map((x) => x.kod)).toEqual(['cift_etken']);
    expect(u[0].veri.liste).toBe('Largopen, Amoklavin');
  });
  it('ilaç uyarılarını devralır ama stok eşiğini kendi hesaplar', () => {
    const ilacUyarilariBul = () => [
      { tur: 'uyari', kod: 'stok_kritik', veri: { n: 2 } },
      { tur: 'hata', kod: 'skt_gecti', veri: {} },
    ];
    const u = receteUyarilari([{ ilacId: 'c', adet: 1 }], null, ilaclar, { ilacUyarilariBul });
    expect(u.map((x) => x.kod)).toEqual(['skt_gecti']);
  });
  it('kayıtta olmayan ilacı atlar', () => {
    expect(receteUyarilari([{ ilacId: 'yok', adet: 1 }], hasta, ilaclar, { alerjiBul })).toEqual([]);
  });
});

describe('receteMetni', () => {
  const recete = {
    receteNo: '2026-09-21-01', tarih: '2026-09-21',
    tani: 'Üst solunum yolu enfeksiyonu', taniKodu: 'J06.9',
    doktorUnvan: 'Dr.', doktorAd: 'Feda Mohammad', notlar: 'Bol sıvı',
    satirlar: [
      { ilacAdi: 'Nurofen 400 mg', adet: 2, kullanim: 'Günde 2×1', sure: '5 gün', not: '' },
      { ilacAdi: 'Parol 500 mg', adet: 1, kullanim: '', sure: '', not: 'tok karnına' },
    ],
  };
  const hasta = { ad: 'Zeynep', soyad: 'Kaya', alerjiler: ['İbuprofen'] };
  const ayar = { klinikAdi: 'Deneme Eczanesi', telefon: '0702397511' };

  it('reçeteyi okunur düz metne çevirir', () => {
    const m = receteMetni(recete, hasta, ayar, { hastaAdi: 'Zeynep Kaya' });
    expect(m).toContain('Deneme Eczanesi');
    expect(m).toContain('Dr. Feda Mohammad');
    expect(m).toContain('Reçete: 2026-09-21-01');
    expect(m).toContain('Hasta: Zeynep Kaya');
    expect(m).toContain('Tanı: Üst solunum yolu enfeksiyonu · J06.9');
    expect(m).toContain('1) Nurofen 400 mg — 2 kutu · Günde 2×1 · 5 gün');
    expect(m).toContain('2) Parol 500 mg — 1 kutu (tok karnına)');
    expect(m).toContain('0702397511');
  });
  it('alerjiyi metne taşır', () => {
    expect(receteMetni(recete, hasta, ayar)).toContain('Alerji: İbuprofen');
  });
  it('alerji yoksa o satırı yazmaz', () => {
    expect(receteMetni(recete, { ad: 'A' }, ayar)).not.toContain('Alerji');
  });
  it('etiketleri çeviri sözlüğünden alabilir', () => {
    const m = receteMetni(recete, hasta, ayar, { recete: 'نسخه', hasta: 'مریض', hastaAdi: 'زینب' });
    expect(m).toContain('نسخه: 2026-09-21-01');
    expect(m).toContain('مریض: زینب');
  });
  it('boş reçetede çökmez', () => {
    expect(receteMetni({ satirlar: [] }, null, {})).toBeTypeOf('string');
  });
});

describe('doluOlcumler', () => {
  it('yalnız girilmiş ölçümleri verir', () => {
    const d = doluOlcumler({ olcumler: { bp: '120/80', pr: '', bw: '31' } });
    expect(d.map(([k]) => k)).toEqual(['bp', 'bw']);
  });
  it('ölçüm yoksa boş liste verir', () => {
    expect(doluOlcumler({})).toEqual([]);
    expect(doluOlcumler(null)).toEqual([]);
  });
  it('OLCUMLER kısaltmaları sabittir (çıktıda değişmez)', () => {
    expect(OLCUMLER.map(([, , k]) => k)).toEqual(['BP', 'PR', 'RR', 'BW', 'T']);
  });
});
