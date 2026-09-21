// Klinik seçim listeleri: birleştirme mantığı ve gönderilen verinin sağlığı.
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  AYRAC, parcala, birlestir, secili, degistir, taniDegistir,
  ara, siklar, gruplaraBol, gecmisler, klinikGecerliMi,
} from '../app/js/paylasilan/klinik.js';

const belge = JSON.parse(await readFile(new URL('../app/veri/klinik.json', import.meta.url), 'utf8'));

describe('gönderilen klinik belge', () => {
  it('beklenen biçimde', () => expect(klinikGecerliMi(belge)).toBe(true));
  it('eksik listeyi reddeder', () => expect(klinikGecerliMi({ ...belge, belirtiler: null })).toBe(false));
  it('adsız kaydı reddeder', () =>
    expect(klinikGecerliMi({ ...belge, laboratuvar: [{ ad: ' ' }] })).toBe(false));
});

// Üç liste de aynı kalıpta: aynı korumalar üçüne birden uygulanıyor.
const LISTELER = [
  ['tanilar', 'gruplar'],
  ['belirtiler', 'gruplar'],
  ['laboratuvar', 'labGruplari'],
];

describe.each(LISTELER)('%s listesi', (ad, grupAlani) => {
  const liste = belge[ad];
  const gruplar = belge[grupAlani];

  it('gözle görülür bir hacimde', () => expect(liste.length).toBeGreaterThan(50));

  it('her kaydın adı, Türkçesi ve grubu var', () => {
    for (const x of liste) {
      expect(x.ad.trim(), JSON.stringify(x)).not.toBe('');
      expect(x.tr?.trim(), JSON.stringify(x)).not.toBe('');
      expect(x.grup?.trim(), JSON.stringify(x)).not.toBe('');
    }
  });

  it('her kaydın grubu tanımlı gruplardan biri', () => {
    const gecerli = new Set(gruplar.map((g) => g.anahtar));
    for (const x of liste) expect(gecerli.has(x.grup), `${x.ad}: ${x.grup}`).toBe(true);
  });

  it('aynı ad iki kez yazılmamış', () => {
    const adlar = liste.map((x) => x.ad);
    expect(new Set(adlar).size).toBe(adlar.length);
  });

  // Ad ayraç taşısaydı seçilince iki ayrı kayda bölünür, geri alınamazdı.
  it('adlarda ayraç geçmiyor', () => {
    for (const x of liste) expect(x.ad.includes('،') || x.ad.includes(','), x.ad).toBe(false);
  });

  // Bu liste bir AD sözlüğü. Tedavi kararı hekimin; listeye sonradan
  // öneri sızarsa bu test kırılsın.
  it('tedavi, ilaç ya da doz taşımıyor', () => {
    for (const x of liste) {
      for (const alan of ['ilac', 'ilaclar', 'tedavi', 'doz', 'kullanim', 'oneri', 'endikasyon']) {
        expect(x[alan], JSON.stringify(x)).toBeUndefined();
      }
    }
  });
});

describe.each(LISTELER)('%s grupları', (ad, grupAlani) => {
  it('boş grup yok — başlık boşluğa bakmasın', () => {
    const kullanilan = new Set(belge[ad].map((x) => x.grup));
    const bos = belge[grupAlani].filter((g) => !kullanilan.has(g.anahtar)).map((g) => g.anahtar);
    // gruplar iki liste arasında paylaşılıyor; ikisinin birleşimi hepsini kapsamalı
    if (grupAlani === 'gruplar') {
      const hepsi = new Set([...belge.tanilar, ...belge.belirtiler].map((x) => x.grup));
      expect(belge.gruplar.filter((g) => !hepsi.has(g.anahtar))).toEqual([]);
    } else {
      expect(bos).toEqual([]);
    }
  });
});

describe('tanı listesi ayrıca', () => {
  it('her tanının ICD kodu var', () => {
    for (const x of belge.tanilar) expect(x.kod?.trim(), JSON.stringify(x)).not.toBe('');
  });

  // taniDegistir kodu DEĞERİNE göre çıkarıyor; iki tanı aynı kodu taşırsa
  // birini kaldırmak öbürünün kodunu götürürdü.
  it('aynı ICD kodu iki tanıda geçmiyor', () => {
    const kodlar = belge.tanilar.map((x) => x.kod);
    expect(new Set(kodlar).size).toBe(kodlar.length);
  });

  it('yaygın işaretliler form üstüne sığacak kadar', () => {
    const sik = siklar(belge.tanilar);
    expect(sik.length).toBeGreaterThan(8);
    expect(sik.length).toBeLessThan(40);
  });
});

describe('parcala / birlestir', () => {
  it('Farsça ayraçla böler', () => expect(parcala('سردردی، تب')).toEqual(['سردردی', 'تب']));
  it('Latin virgülü de kabul eder', () => expect(parcala('سردردی, تب')).toEqual(['سردردی', 'تب']));
  it('boş metin boş dizi', () => expect(parcala('  ')).toEqual([]));
  it('boşları atar', () => expect(parcala('سردردی،، تب')).toEqual(['سردردی', 'تب']));
  it('geri birleştirir', () => expect(birlestir(['سردردی', 'تب'])).toBe('سردردی' + AYRAC + 'تب'));
});

describe('secili', () => {
  it('boşluk ve harf farkını aynı sayar', () => expect(secili('  سردردی ، تب', 'سردردی')).toBe(true));
  it('olmayanı bulmaz', () => expect(secili('تب', 'سردردی')).toBe(false));
});

describe('degistir — kodsuz listeler (belirti, laboratuvar)', () => {
  it('boş metne ekler', () => expect(degistir('', 'سرفه')).toBe('سرفه'));
  it('ikinciyi ayraçla ekler', () => expect(parcala(degistir('سرفه', 'تب'))).toEqual(['سرفه', 'تب']));
  it('ikinci dokunuş geri alır', () => expect(degistir('سرفه، تب', 'سرفه')).toBe('تب'));
  it('hepsi çıkınca boş kalır', () => expect(degistir('سرفه', 'سرفه')).toBe(''));
  it('aynı adı iki kez eklemez', () => {
    const bir = degistir('', 'سرفه');
    expect(parcala(degistir(degistir(bir, 'تب'), 'سرفه'))).toEqual(['تب']);
  });
  it('adsız çağrı metni bozmaz', () => expect(degistir('سرفه', '')).toBe('سرفه'));
  it('elle yazılmış metne dokunabilir', () => expect(degistir('چیز خودم', 'تب')).toBe('چیز خودم، تب'));
});

describe('taniDegistir — ad ve ICD birlikte', () => {
  const bas = { tani: '', taniKodu: '' };
  const sardardi = { ad: 'سردردی', kod: 'R51' };
  const tab = { ad: 'تب', kod: 'R50.9' };

  it('boş reçeteye ekler', () => {
    expect(taniDegistir(bas, sardardi)).toEqual({ tani: 'سردردی', taniKodu: 'R51' });
  });

  it('ikinciyi ayraçla ekler, kodu hizalı tutar', () => {
    const r = taniDegistir(taniDegistir(bas, sardardi), tab);
    expect(parcala(r.tani)).toEqual(['سردردی', 'تب']);
    expect(parcala(r.taniKodu)).toEqual(['R51', 'R50.9']);
  });

  it('ikinci dokunuş geri alır, kodu da götürür', () => {
    const iki = taniDegistir(taniDegistir(bas, sardardi), tab);
    expect(taniDegistir(iki, sardardi)).toEqual({ tani: 'تب', taniKodu: 'R50.9' });
  });

  it('elle yazılmış kodsuz tanının üstüne yeni kodu geçirmez', () => {
    const elle = { tani: 'چیز دیگر', taniKodu: '' };
    const r = taniDegistir(elle, sardardi);
    expect(parcala(r.tani)).toEqual(['چیز دیگر', 'سردردی']);
    expect(r.taniKodu).toBe('R51');           // kod yalnız kodu olan tanıya ait
  });

  it('kodsuz tanı çıkarılınca öbürünün kodu kalır', () => {
    const karisik = taniDegistir({ tani: 'چیز دیگر', taniKodu: '' }, sardardi);
    const kalan = taniDegistir(karisik, { ad: 'چیز دیگر' });
    expect(kalan.tani).toBe('سردردی');
    expect(kalan.taniKodu).toBe('R51');
  });

  it('kodu bilinmeden çıkarırken hizalıysa doğru kodu götürür', () => {
    const iki = taniDegistir(taniDegistir(bas, sardardi), tab);
    const kalan = taniDegistir(iki, { ad: 'سردردی' });   // özet çipi: kod taşımıyor
    expect(kalan.tani).toBe('تب');
    expect(kalan.taniKodu).toBe('R50.9');
  });

  it('kodsuz seçim de eklenebilir', () => {
    expect(taniDegistir(bas, { ad: 'چیزی' }).tani).toBe('چیزی');
  });

  it('adsız seçim reçeteyi bozmaz', () => {
    expect(taniDegistir({ tani: 'سردردی', taniKodu: 'R51' }, null))
      .toEqual({ tani: 'سردردی', taniKodu: 'R51' });
  });
});

describe('ara', () => {
  it('Farsça adla bulur', () => expect(ara(belge.tanilar, 'سردردی').length).toBeGreaterThan(0));
  it('Türkçe karşılıkla bulur', () => {
    expect(ara(belge.tanilar, 'diş ağrısı').map((x) => x.kod)).toContain('K08.8');
  });
  it('ICD koduyla bulur', () => expect(ara(belge.tanilar, 'I10').some((x) => x.kod === 'I10')).toBe(true));
  it('kodsuz listede de çalışır', () =>
    expect(ara(belge.laboratuvar, 'CBC').length).toBeGreaterThan(0));
  it('laboratuvarı Türkçesiyle bulur', () =>
    expect(ara(belge.laboratuvar, 'sedimantasyon').length).toBeGreaterThan(0));
  it('boş sorgu hepsini döndürür', () => expect(ara(belge.tanilar, ' ')).toHaveLength(belge.tanilar.length));
});

describe('gruplaraBol', () => {
  it('her kaydı bir gruba koyar, hiçbirini düşürmez', () => {
    const toplam = gruplaraBol(belge.laboratuvar, belge.labGruplari)
      .reduce((n, g) => n + g.kayitlar.length, 0);
    expect(toplam).toBe(belge.laboratuvar.length);
  });
  it('boş grubu atar', () => {
    const b = gruplaraBol([{ ad: 'X', grup: 'hema' }], belge.labGruplari);
    expect(b).toHaveLength(1);
    expect(b[0].anahtar).toBe('hema');
  });
});

describe('gecmisler', () => {
  const receteler = [
    { tani: 'سردردی', taniKodu: 'R51', belirtiler: 'سرفه' },
    { tani: 'سردردی، تب', taniKodu: 'R51، R50.9', belirtiler: 'سرفه، تب' },
    { tani: 'تب', taniKodu: 'R50.9', belirtiler: '' },
    { tani: 'سردردی', taniKodu: 'R51', belirtiler: 'سرفه' },
    { tani: '', taniKodu: '' },
  ];

  it('çok yazılandan aza sıralar', () => {
    expect(gecmisler(receteler, 'tani', 'taniKodu').map((x) => x.ad)).toEqual(['سردردی', 'تب']);
  });
  it('kaç kez yazıldığını sayar', () => expect(gecmisler(receteler, 'tani', 'taniKodu')[0].n).toBe(3));
  it('kodu da taşır', () => expect(gecmisler(receteler, 'tani', 'taniKodu')[0].kod).toBe('R51'));
  it('kodsuz alanda da çalışır', () => {
    const b = gecmisler(receteler, 'belirtiler');
    expect(b.map((x) => x.ad)).toEqual(['سرفه', 'تب']);
    expect(b[0].kod).toBe('');
  });
  it('listede olmayan, elle yazılanı da sayar', () => {
    expect(gecmisler([{ tani: 'چیز خودم' }], 'tani').map((x) => x.ad)).toEqual(['چیز خودم']);
  });
  it('sınırı aşmaz', () => expect(gecmisler(receteler, 'tani', 'taniKodu', 1)).toHaveLength(1));
  it('reçete yoksa boş', () => expect(gecmisler([], 'tani')).toEqual([]));
});
