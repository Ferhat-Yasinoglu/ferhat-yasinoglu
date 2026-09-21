import { describe, it, expect } from 'vitest';
import {
  receteOzet, receteNoUret, receteDogrula, bosRecete,
  receteUyarilari, receteMetni, doluOlcumler, OLCUMLER, sikIlaclar, SURE_ONERILERI,
} from '../app/js/paylasilan/recete.js';

const satir = (o) => ({ adet: 2, ...o });

describe('receteOzet', () => {
  it('satır sayısını verir', () => {
    expect(receteOzet({ satirlar: [satir({}), satir({}), satir({})] })).toEqual({ toplam: 3 });
  });
  it('satırsız reçetede sıfır döner', () => expect(receteOzet({ satirlar: [] })).toEqual({ toplam: 0 }));
  it('reçete yoksa da patlamaz', () => expect(receteOzet(null)).toEqual({ toplam: 0 }));
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
    { id: 'a', ad: 'Largopen', etkenMadde: 'Amoksisilin' },
    { id: 'b', ad: 'Amoklavin', etkenMadde: 'amoksisilin' },
    { id: 'c', ad: 'Parol', etkenMadde: 'Parasetamol' },
  ];
  const hasta = { alerjiler: ['Penisilin'] };
  const alerjiBul = (h, i) => (i.ad === 'Largopen' && h.alerjiler.includes('Penisilin') ? 'Penisilin' : null);

  it('alerjiyi satırına bağlar', () => {
    const u = receteUyarilari([{ ilacId: 'a', adet: 1 }], hasta, ilaclar, { alerjiBul });
    expect(u).toEqual([{ satir: 0, tur: 'hata', kod: 'alerji', veri: { ad: 'Largopen', a: 'Penisilin' } }]);
  });
  it('sorun yoksa susar', () => {
    expect(receteUyarilari([{ ilacId: 'c', adet: 2 }], null, ilaclar, {})).toEqual([]);
  });
  it('aynı etken maddeyi iki satırda yakalar', () => {
    const u = receteUyarilari([{ ilacId: 'a', adet: 1 }, { ilacId: 'b', adet: 1 }], null, ilaclar, {});
    expect(u.map((x) => x.kod)).toEqual(['cift_etken']);
    expect(u[0].veri.liste).toBe('Largopen, Amoklavin');
  });
  it('alerji denetçisi verilmezse alerjiye bakmaz', () => {
    expect(receteUyarilari([{ ilacId: 'a', adet: 1 }], hasta, ilaclar, {})).toEqual([]);
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

describe('sikIlaclar', () => {
  const ilaclar = [{ id: 'a', ad: 'A' }, { id: 'b', ad: 'B' }, { id: 'c', ad: 'C' }];
  const receteler = [
    { satirlar: [{ ilacId: 'a' }, { ilacId: 'b' }] },
    { satirlar: [{ ilacId: 'a' }] },
    { satirlar: [{ ilacId: 'a' }, { ilacId: 'c' }] },
    { satirlar: [{ ilacId: 'b' }] },
  ];

  it('çok yazılandan aza sıralar', () =>
    expect(sikIlaclar(receteler, ilaclar).map((x) => x.id)).toEqual(['a', 'b', 'c']));

  it('hiç yazılmamışı listelemez', () =>
    expect(sikIlaclar([{ satirlar: [{ ilacId: 'c' }] }], ilaclar).map((x) => x.id)).toEqual(['c']));

  it('silinmiş ilacı atar — oradan zaten seçilemez', () =>
    expect(sikIlaclar([{ satirlar: [{ ilacId: 'yok' }] }], ilaclar)).toEqual([]));

  it('sınırı aşmaz', () => expect(sikIlaclar(receteler, ilaclar, 2)).toHaveLength(2));

  it('reçete yoksa boş', () => expect(sikIlaclar([], ilaclar)).toEqual([]));

  it('satırsız reçetede patlamaz', () => expect(sikIlaclar([{}, { satirlar: null }], ilaclar)).toEqual([]));
});

describe('SURE_ONERILERI', () => {
  it('ilaçla eşleştirilmiş değil — sadece yazım kısayolu', () => {
    for (const x of SURE_ONERILERI) expect(typeof x).toBe('string');
    expect(new Set(SURE_ONERILERI).size).toBe(SURE_ONERILERI.length);
  });
});
