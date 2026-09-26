import { describe, it, expect } from 'vitest';
import {
  receteOzet, receteNoUret, receteDogrula, bosRecete,
  receteUyarilari, receteMetni, doluOlcumler, OLCUMLER, sikIlaclar, SURE_ONERILERI,
  bosSatir, sonKullanimlar, sonKullanim, bpBol, bpBirlestir, receteAramaMetni,
} from '../app/js/paylasilan/recete.js';
import { adIndeksi } from '../app/js/paylasilan/klinik.js';
import { ilacEtiketi } from '../app/js/paylasilan/ilac.js';

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
    doktorUnvan: 'Dr.', doktorAd: 'Nemuna Ahmadi', notlar: 'Bol sıvı',
    satirlar: [
      { ilacAdi: 'Nurofen 400 mg', adet: 2, kullanim: 'Günde 2×1', sure: '5 gün', not: '' },
      { ilacAdi: 'Parol 500 mg', adet: 1, kullanim: '', sure: '', not: 'tok karnına' },
    ],
  };
  const hasta = { ad: 'Zeynep', soyad: 'Kaya', alerjiler: ['İbuprofen'] };
  const ayar = { klinikAdi: 'Deneme Eczanesi', telefon: '0700000000' };

  it('reçeteyi okunur düz metne çevirir', () => {
    const m = receteMetni(recete, hasta, ayar, { hastaAdi: 'Zeynep Kaya' });
    expect(m).toContain('Deneme Eczanesi');
    expect(m).toContain('Dr. Nemuna Ahmadi');
    expect(m).toContain('Reçete: 2026-09-21-01');
    expect(m).toContain('Hasta: Zeynep Kaya');
    expect(m).toContain('Tanı: Üst solunum yolu enfeksiyonu · J06.9');
    expect(m).toContain('1) Nurofen 400 mg — 2 kutu · Günde 2×1 · 5 gün');
    expect(m).toContain('2) Parol 500 mg — 1 kutu (tok karnına)');
    expect(m).toContain('0700000000');
  });
  it('yemek zamanı doluysa kullanımdan sonra yazılıyor', () => {
    const r = { ...recete, satirlar: [{ ...recete.satirlar[0], zaman: 'بعد از غذا' }] };
    expect(receteMetni(r, hasta, ayar)).toContain('1) Nurofen 400 mg — 2 kutu · Günde 2×1 · بعد از غذا · 5 gün');
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
  it('ilacın adını kâğıttaki gibi etken madde ve güçle yazar', () => {
    const m = receteMetni({ satirlar: [{ ilacAdi: 'Feldene 20 mg Kapsül', form: 'kapsul', doz: '20 mg', etkenMadde: 'Piroxicam', adet: 1 }] }, null, {});
    expect(m).toContain('1) Cap: Feldene (Piroxicam) 20 mg — 1 kutu');
  });
  it('kayıttaki Türkçe şekil adını göndermez, kâğıttaki gibi yazar', () => {
    const m = receteMetni({ satirlar: [{ ilacAdi: 'Panadol Syrup 120 mg/5 ml Şurup', form: 'surup', adet: 1 }] }, null, {});
    expect(m).toContain('1) Syr: Panadol Syrup 120 mg/5 ml');
    expect(m).not.toContain('Şurup');
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
    expect(OLCUMLER.map(([, , k]) => k)).toEqual(['BP', 'PR', 'RR', 'BW', 'T', 'SpO₂', 'Ht']);
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

describe('bosSatir', () => {
  it('yeni satırda yemek zamanı ve güç boş', () => {
    expect(bosSatir()).toMatchObject({ zaman: '', doz: '', kullanim: '', sure: '', yol: '', adet: 1 });
  });
});

describe('sonKullanimlar — hekimin kendi son kullanımı', () => {
  const ilac = { id: 'ila_1', ad: 'Amoxil', doz: '500 mg', form: 'kapsul' };
  const satir = (o) => ({ ilacId: 'ila_1', ilacAdi: ilacEtiketi(ilac), form: 'kapsul', adet: 1, ...o });
  const recete = (tarih, satirlar, o = {}) => ({ tarih, satirlar, ...o });

  it('ilaca en son yazılan kullanımı veriyor (tarih sırasıyla, kayıt sırası değil)', () => {
    const h = sonKullanimlar([
      recete('2026-09-20', [satir({ kullanim: 'روزانه 3 بار', zaman: 'بعد از غذا', sure: '7 روز' })]),
      recete('2026-09-10', [satir({ kullanim: 'روزانه 2 بار', sure: '5 روز' })]),
    ]);
    expect(sonKullanim(h, ilac)).toEqual({ kullanim: 'روزانه 3 بار', zaman: 'بعد از غذا', sure: '7 روز', yol: '', tarih: '2026-09-20' });
  });

  it('aynı gün iki reçetede sonra güncelleneni alıyor', () => {
    const h = sonKullanimlar([
      recete('2026-09-20', [satir({ kullanim: 'B' })], { guncellendi: '2026-09-20T10:00:00Z' }),
      recete('2026-09-20', [satir({ kullanim: 'A' })], { guncellendi: '2026-09-20T09:00:00Z' }),
    ]);
    expect(sonKullanim(h, ilac).kullanim).toBe('B');
  });

  it('boş satır hafızayı silmiyor; not ve adet hatırlanmıyor', () => {
    const h = sonKullanimlar([
      recete('2026-09-10', [satir({ kullanim: 'روزانه 2 بار', not: 'hastaya özel', adet: 3 })]),
      recete('2026-09-20', [satir({})]),
    ]);
    const v = sonKullanim(h, ilac);
    expect(v.kullanim).toBe('روزانه 2 بار');
    expect(v).not.toHaveProperty('not');
    expect(v).not.toHaveProperty('adet');
  });

  it('silinmiş ve örnek reçeteleri saymıyor', () => {
    const h = sonKullanimlar([
      recete('2026-09-10', [satir({ kullanim: 'gerçek' })]),
      recete('2026-09-20', [satir({ kullanim: 'silindi' })], { silindi: 1 }),
      recete('2026-09-21', [satir({ kullanim: 'örnek' })], { ornek: 1 }),
    ]);
    expect(sonKullanim(h, ilac).kullanim).toBe('gerçek');
  });

  it('hiç yazılmamış ilaçta null: alanlar boş kalır, başka ilaçtan taşınmaz', () => {
    const h = sonKullanimlar([recete('2026-09-10', [satir({ kullanim: 'X' })])]);
    expect(sonKullanim(h, { id: 'ila_2', ad: 'Brufen', doz: '400 mg', form: 'tablet' })).toBeNull();
    expect(sonKullanim(sonKullanimlar([]), ilac)).toBeNull();
    expect(sonKullanim(sonKullanimlar(null), ilac)).toBeNull();
  });

  it('ilaç silinip yeniden eklense de (yeni kimlik) ad ve şekille hatırlanıyor', () => {
    const h = sonKullanimlar([recete('2026-09-10', [satir({ kullanim: 'روزانه 2 بار' })])]);
    expect(sonKullanim(h, { ...ilac, id: 'ila_yeni' }).kullanim).toBe('روزانه 2 بار');
    expect(sonKullanim(h, { ...ilac, id: 'ila_yeni', form: 'surup' })).toBeNull();
  });
});

describe('bpBol / bpBirlestir — iki kutu, tek metin', () => {
  it('bölüyor ve birleştiriyor', () => {
    expect(bpBol('130/85')).toEqual(['130', '85']);
    expect(bpBirlestir('130', '85')).toBe('130/85');
  });
  it('boş iki kutu boş metin; yalnız sistolik «130/»', () => {
    expect(bpBirlestir('', '')).toBe('');
    expect(bpBirlestir('  ', '')).toBe('');
    expect(bpBirlestir('130', '')).toBe('130/');
    expect(bpBol('')).toEqual(['', '']);
    expect(bpBol(undefined)).toEqual(['', '']);
  });
  // «/»suz eski değer bütünüyle ilk kutuda: kesilmiyor, bir şey atılmıyor.
  it('eski serbest metin ilk kutuya bütün olarak düşüyor', () => {
    expect(bpBol('بالا (نشسته)')).toEqual(['بالا (نشسته)', '']);
  });
  // Düzeltilen eski değerin sonuna «/» eklenmiyordu değil, ekleniyordu:
  // «بالا (ایستاده)/» kaydedilip kâğıda «/mmHg» diye basılıyordu.
  it('düzeltilen eski serbest metne ve sistoliğe yapıştırılan «130/85»e «/» eklenmiyor', () => {
    expect(bpBirlestir('بالا (ایستاده)', '')).toBe('بالا (ایستاده)');
    expect(bpBirlestir('بالا (ایستاده) x', '  ')).toBe('بالا (ایستاده) x');
    expect(bpBirlestir('130/85', '')).toBe('130/85');
    expect(bpBirlestir('120.5', '')).toBe('120.5/');
  });
  it('«/» içeren her değerde gidiş-dönüş aynı metni veriyor', () => {
    for (const v of ['118/76', '130 / 85', ' 120/80 ', '120/80 (نشسته)', '130/', '/85', '1/2/3']) {
      expect(bpBirlestir(...bpBol(v))).toBe(v);
    }
    // Tek başına eğik çizgi değer değil: iki kutu boş, metin boş.
    expect(bpBirlestir(...bpBol('/'))).toBe('');
  });
});

describe('receteAramaMetni — reçeteler listesinde arama', () => {
  const recete = {
    receteNo: '2026-09-25-01', tani: 'Chronic hepatitis C، Fever', taniKodu: 'B18.2',
    satirlar: [{ ilacAdi: 'Feldene 20 mg Kapsül', form: 'kapsul', doz: '20 mg', etkenMadde: 'Piroxicam', adet: 1 }],
  };
  const indeks = adIndeksi([{ ad: 'هپاتیت C مزمن', en: 'Chronic hepatitis C', kod: 'B18.2' }]);
  it('numara, hasta, tanı, kod ve ilaç adı (etken maddesiyle) metinde', () => {
    const m = receteAramaMetni(recete, 'زهرا صدیقی', indeks);
    for (const parca of ['2026-09-25-01', 'زهرا صدیقی', 'Chronic hepatitis C', 'B18.2', 'Feldene', 'Piroxicam']) expect(m).toContain(parca);
  });
  it('kâğıda İngilizce yazılan tanının Dari adı da aranıyor', () => {
    expect(receteAramaMetni(recete, '', indeks)).toContain('هپاتیت C مزمن');
    // Listede olmayan parça (elle yazılmış) bir şey eklemiyor; indeks yoksa yalnız kayıttaki ad.
    expect(receteAramaMetni(recete, '', null)).not.toContain('هپاتیت');
  });
  it('boş reçetede çökmez', () => {
    expect(receteAramaMetni({}, '', indeks)).toBe('');
  });
});
