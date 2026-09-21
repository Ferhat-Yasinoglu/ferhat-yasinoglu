import { describe, it, expect } from 'vitest';
import { bosSablon, receteyiSablonaCevir, sablonuUygula, sablonAra, sablonDogrula } from '../app/js/paylasilan/sablon.js';

const recete = (o = {}) => ({
  hastaId: 'has_1', tarih: '2026-09-21', receteNo: '2026-09-21-01',
  tani: 'Üst solunum yolu enfeksiyonu', taniKodu: 'J06.9', notlar: 'Bol sıvı',
  olcumler: { bp: '110/70' }, dogrulamaKodu: 'ABCD-EFGH',
  satirlar: [
    { ilacId: 'ila_1', ilacAdi: 'Parol 500 mg', adet: 2, kullanim: 'Günde 2×1', sure: '5 gün', not: '' },
    { ilacId: 'ila_2', ilacAdi: 'Nurofen 400 mg', adet: 1, kullanim: '', sure: '', not: 'tok karnına' },
  ],
  ...o,
});

describe('receteyiSablonaCevir', () => {
  it('ilaçları, tanıyı ve notu taşır', () => {
    const s = receteyiSablonaCevir(recete(), '  ÜSYE  ');
    expect(s.ad).toBe('ÜSYE');
    expect(s.tani).toBe('Üst solunum yolu enfeksiyonu');
    expect(s.taniKodu).toBe('J06.9');
    expect(s.notlar).toBe('Bol sıvı');
    expect(s.satirlar.map((x) => x.ilacAdi)).toEqual(['Parol 500 mg', 'Nurofen 400 mg']);
    expect(s.satirlar[1].not).toBe('tok karnına');
  });

  it('hastaya ve o güne ait hiçbir şeyi taşımaz', () => {
    const s = receteyiSablonaCevir(recete(), 'ÜSYE');
    for (const alan of ['hastaId', 'tarih', 'receteNo', 'olcumler', 'dogrulamaKodu']) {
      expect(s[alan]).toBeUndefined();
    }
  });

  it('bozuk adedi 1 yapar', () => {
    const s = receteyiSablonaCevir(recete({ satirlar: [{ ilacId: 'a', ilacAdi: 'X', adet: 0 }] }), 'T');
    expect(s.satirlar[0].adet).toBe(1);
  });
});

describe('sablonuUygula', () => {
  const sablon = {
    ad: 'ÜSYE', tani: 'ÜSYE', taniKodu: 'J06.9', notlar: 'Bol sıvı',
    satirlar: [
      { ilacId: 'ila_1', ilacAdi: 'Parol 500 mg', adet: 2, kullanim: 'Günde 2×1', sure: '5 gün', not: '' },
      { ilacId: 'ila_9', ilacAdi: 'Augmentin', adet: 1, kullanim: '', sure: '', not: '' },
    ],
  };

  it('boş reçeteye ilaçları ve tanıyı koyar', () => {
    const y = sablonuUygula({ satirlar: [], tani: '', taniKodu: '', notlar: '' }, sablon);
    expect(y.satirlar.map((x) => x.ilacId)).toEqual(['ila_1', 'ila_9']);
    expect(y.tani).toBe('ÜSYE');
  });

  it('hasta, tarih ve ölçümleri korur', () => {
    const acik = { hastaId: 'has_7', tarih: '2026-09-21', olcumler: { bp: '120/80' }, satirlar: [], tani: '', taniKodu: '', notlar: '' };
    const y = sablonuUygula(acik, sablon);
    expect(y.hastaId).toBe('has_7');
    expect(y.tarih).toBe('2026-09-21');
    expect(y.olcumler).toEqual({ bp: '120/80' });
  });

  it('elle yazılmış satırları silmez, aynı ilacı iki kez eklemez', () => {
    const acik = { satirlar: [{ ilacId: 'ila_1', ilacAdi: 'Parol 500 mg', adet: 5 }], tani: '', taniKodu: '', notlar: '' };
    const y = sablonuUygula(acik, sablon);
    expect(y.satirlar.map((x) => x.ilacId)).toEqual(['ila_1', 'ila_9']);
    expect(y.satirlar[0].adet).toBe(5); // elle yazılan kazanır
  });

  it('reçetede zaten tanı varsa üstüne yazmaz', () => {
    const y = sablonuUygula({ satirlar: [], tani: 'Migren', taniKodu: 'G43.9', notlar: '' }, sablon);
    expect(y.tani).toBe('Migren');
    expect(y.taniKodu).toBe('G43.9');
    expect(y.notlar).toBe('Bol sıvı'); // boş olan şablondan gelir
  });

  it('şablonun satırlarını kopyalar — sonradan değişirse reçete etkilenmez', () => {
    const y = sablonuUygula({ satirlar: [], tani: '', taniKodu: '', notlar: '' }, sablon);
    y.satirlar[0].adet = 99;
    expect(sablon.satirlar[0].adet).toBe(2);
  });
});

describe('sablonAra', () => {
  const liste = [
    { ad: 'ÜSYE', tani: 'Üst solunum yolu', satirlar: [{ ilacAdi: 'Parol' }] },
    { ad: 'Migren', tani: '', satirlar: [{ ilacAdi: 'Majezik' }] },
  ];
  it('ada göre bulur', () => expect(sablonAra(liste, 'migren').map((x) => x.ad)).toEqual(['Migren']));
  it('ilaç adına göre bulur', () => expect(sablonAra(liste, 'parol').map((x) => x.ad)).toEqual(['ÜSYE']));
  it('boş sorgu hepsini döndürür', () => expect(sablonAra(liste, '  ')).toHaveLength(2));
});

describe('sablonDogrula', () => {
  const dolu = { ad: 'ÜSYE', satirlar: [{ ilacId: 'a' }] };
  it('adsız şablonu reddeder', () => expect(sablonDogrula({ ...dolu, ad: ' ' }).ad).toBe('sablon_ad_gerekli'));
  it('ilaçsız şablonu reddeder', () => expect(sablonDogrula({ ...dolu, satirlar: [] }).satirlar).toBe('ilac_gerekli'));
  it('aynı adı ikinci kez reddeder', () => {
    expect(sablonDogrula(dolu, [{ id: 'sab_1', ad: 'üsye' }]).ad).toBe('sablon_ad_tekrar');
  });
  it('kendi adını çakışma saymaz', () => {
    expect(sablonDogrula({ ...dolu, id: 'sab_1' }, [{ id: 'sab_1', ad: 'ÜSYE' }])).toEqual({});
  });
  it('doğru şablonu geçirir', () => expect(sablonDogrula(dolu, [])).toEqual({}));
});

describe('bosSablon', () => {
  it('boş ve satırsız başlar', () => expect(bosSablon()).toEqual({ ad: '', tani: '', taniKodu: '', notlar: '', satirlar: [] }));
});
