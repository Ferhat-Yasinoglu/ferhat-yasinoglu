// Tanı seçme: birleştirme mantığı ve gönderilen listenin sağlığı.
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  AYRAC, taniParcala, taniBirlestir, taniSecili, taniDegistir,
  taniAra, sikTanilar, gruplaraBol, gecmisTanilar, taniListesiGecerliMi,
} from '../app/js/paylasilan/tani.js';

const belge = JSON.parse(await readFile(new URL('../app/veri/tanilar.json', import.meta.url), 'utf8'));

describe('gönderilen tanı listesi', () => {
  it('beklenen biçimde', () => expect(taniListesiGecerliMi(belge)).toBe(true));

  it('her tanının adı, Türkçesi, kodu ve grubu var', () => {
    for (const x of belge.tanilar) {
      expect(x.ad.trim(), JSON.stringify(x)).not.toBe('');
      expect(x.tr?.trim(), JSON.stringify(x)).not.toBe('');
      expect(x.kod?.trim(), JSON.stringify(x)).not.toBe('');
      expect(x.grup?.trim(), JSON.stringify(x)).not.toBe('');
    }
  });

  it('her tanının grubu tanımlı gruplardan biri', () => {
    const gecerli = new Set(belge.gruplar.map((g) => g.anahtar));
    for (const x of belge.tanilar) expect(gecerli.has(x.grup), `${x.ad}: ${x.grup}`).toBe(true);
  });

  it('boş grup yok — başlık boşluğa bakmasın', () => {
    const kullanilan = new Set(belge.tanilar.map((x) => x.grup));
    for (const g of belge.gruplar) expect(kullanilan.has(g.anahtar), g.anahtar).toBe(true);
  });

  it('aynı tanı iki kez yazılmamış', () => {
    const adlar = belge.tanilar.map((x) => x.ad);
    expect(new Set(adlar).size).toBe(adlar.length);
  });

  // taniDegistir kodu DEĞERİNE göre çıkarıyor; iki tanı aynı kodu taşırsa
  // birini kaldırmak öbürünün kodunu götürürdü.
  it('aynı ICD kodu iki tanıda geçmiyor', () => {
    const kodlar = belge.tanilar.map((x) => x.kod);
    expect(new Set(kodlar).size).toBe(kodlar.length);
  });

  it('tedavi, ilaç ya da doz taşımıyor — o karar hekimin', () => {
    for (const x of belge.tanilar) {
      for (const alan of ['ilac', 'ilaclar', 'tedavi', 'doz', 'kullanim', 'oneri']) {
        expect(x[alan], JSON.stringify(x)).toBeUndefined();
      }
    }
  });

  it('adlarda ayraç geçmiyor — yoksa seçince iki tanıya bölünürdü', () => {
    for (const x of belge.tanilar) expect(x.ad.includes('،') || x.ad.includes(','), x.ad).toBe(false);
  });

  it('yaygın işaretliler form üstüne sığacak kadar', () => {
    const sik = sikTanilar(belge.tanilar);
    expect(sik.length).toBeGreaterThan(8);
    expect(sik.length).toBeLessThan(30);
  });

  it('gözle görülür bir hacimde', () => expect(belge.tanilar.length).toBeGreaterThan(80));
});

describe('taniParcala / taniBirlestir', () => {
  it('Farsça ayraçla böler', () => expect(taniParcala('سردردی، تب')).toEqual(['سردردی', 'تب']));
  it('Latin virgülü de kabul eder', () => expect(taniParcala('سردردی, تب')).toEqual(['سردردی', 'تب']));
  it('boş metin boş dizi', () => expect(taniParcala('  ')).toEqual([]));
  it('boşları atar', () => expect(taniParcala('سردردی،، تب')).toEqual(['سردردی', 'تب']));
  it('geri birleştirir', () => expect(taniBirlestir(['سردردی', 'تب'])).toBe('سردردی' + AYRAC + 'تب'));
});

describe('taniDegistir', () => {
  const bas = { tani: '', taniKodu: '' };
  const sardardi = { ad: 'سردردی', kod: 'R51' };
  const tab = { ad: 'تب', kod: 'R50.9' };

  it('boş reçeteye ekler', () => {
    expect(taniDegistir(bas, sardardi)).toEqual({ tani: 'سردردی', taniKodu: 'R51' });
  });

  it('ikinciyi ayraçla ekler, kodu hizalı tutar', () => {
    const r = taniDegistir(taniDegistir(bas, sardardi), tab);
    expect(taniParcala(r.tani)).toEqual(['سردردی', 'تب']);
    expect(taniParcala(r.taniKodu)).toEqual(['R51', 'R50.9']);
  });

  it('ikinci dokunuş geri alır, kodu da götürür', () => {
    const iki = taniDegistir(taniDegistir(bas, sardardi), tab);
    expect(taniDegistir(iki, sardardi)).toEqual({ tani: 'تب', taniKodu: 'R50.9' });
  });

  it('elle yazılmış kodsuz tanının üstüne yeni kodu geçirmez', () => {
    const elle = { tani: 'چیز دیگر', taniKodu: '' };
    const r = taniDegistir(elle, sardardi);
    expect(taniParcala(r.tani)).toEqual(['چیز دیگر', 'سردردی']);
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

describe('taniSecili', () => {
  it('boşluk ve harf farkını aynı sayar', () => expect(taniSecili('  سردردی ، تب', 'سردردی')).toBe(true));
  it('olmayanı bulmaz', () => expect(taniSecili('تب', 'سردردی')).toBe(false));
});

describe('taniAra', () => {
  it('Farsça adla bulur', () => expect(taniAra(belge.tanilar, 'سردردی').length).toBeGreaterThan(0));
  it('Türkçe karşılıkla bulur', () => {
    expect(taniAra(belge.tanilar, 'diş ağrısı').map((x) => x.kod)).toContain('K08.8');
  });
  it('ICD koduyla bulur', () => expect(taniAra(belge.tanilar, 'I10').some((x) => x.kod === 'I10')).toBe(true));
  it('boş sorgu hepsini döndürür', () => expect(taniAra(belge.tanilar, ' ')).toHaveLength(belge.tanilar.length));
});

describe('gruplaraBol', () => {
  it('her tanıyı bir gruba koyar, hiçbirini düşürmez', () => {
    const toplam = gruplaraBol(belge.tanilar, belge.gruplar).reduce((n, g) => n + g.tanilar.length, 0);
    expect(toplam).toBe(belge.tanilar.length);
  });
  it('boş grubu atar', () => {
    const b = gruplaraBol([{ ad: 'X', grup: 'umumi' }], belge.gruplar);
    expect(b).toHaveLength(1);
    expect(b[0].anahtar).toBe('umumi');
  });
});

describe('gecmisTanilar', () => {
  const receteler = [
    { tani: 'سردردی', taniKodu: 'R51' },
    { tani: 'سردردی، تب', taniKodu: 'R51، R50.9' },
    { tani: 'تب', taniKodu: 'R50.9' },
    { tani: 'سردردی', taniKodu: 'R51' },
    { tani: '', taniKodu: '' },
  ];

  it('çok yazılandan aza sıralar', () => {
    expect(gecmisTanilar(receteler).map((x) => x.ad)).toEqual(['سردردی', 'تب']);
  });
  it('kaç kez yazıldığını sayar', () => expect(gecmisTanilar(receteler)[0].n).toBe(3));
  it('kodu da taşır', () => expect(gecmisTanilar(receteler)[0].kod).toBe('R51'));
  it('listede olmayan, elle yazılanı da sayar', () => {
    expect(gecmisTanilar([{ tani: 'چیز خودم' }]).map((x) => x.ad)).toEqual(['چیز خودم']);
  });
  it('sınırı aşmaz', () => expect(gecmisTanilar(receteler, 1)).toHaveLength(1));
  it('reçete yoksa boş', () => expect(gecmisTanilar([])).toEqual([]));
});
