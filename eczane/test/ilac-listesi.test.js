// Hazır ilaç listesi: birleştirme mantığı ve gönderilen verinin sağlığı.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { eksikleriBul, ilacAnahtari, listeKaydi, listeGecerliMi } from '../app/js/paylasilan/ilac-listesi.js';
import { FORMLAR } from '../app/js/paylasilan/ilac.js';
import { BellekDepo } from '../app/js/depo/depo.js';
import { hazirListeyiYukle } from '../app/js/depo/hazir-ilaclar.js';

const liste = JSON.parse(await readFile(new URL('../app/veri/ilaclar.json', import.meta.url), 'utf8'));

describe('gönderilen liste', () => {
  it('beklenen biçimde', () => expect(listeGecerliMi(liste)).toBe(true));

  it('her ilacın adı, şekli ve dozu var', () => {
    for (const i of liste.ilaclar) {
      expect(i.ad.trim(), JSON.stringify(i)).not.toBe('');
      expect(i.etkenMadde?.trim(), JSON.stringify(i)).not.toBe('');
      expect(typeof i.doz, JSON.stringify(i)).toBe('string');
    }
  });

  it('şekiller uygulamanın tanıdığı değerler', () => {
    const gecerli = new Set(FORMLAR.map(([k]) => k));
    for (const i of liste.ilaclar) expect(gecerli.has(i.form), `${i.ad}: ${i.form}`).toBe(true);
  });

  it('kendi içinde tekrar yok', () => {
    const anahtarlar = liste.ilaclar.map(ilacAnahtari);
    expect(new Set(anahtarlar).size).toBe(anahtarlar.length);
  });

  it('kullanım şekli ya da süre taşımıyor — o karar hekimin', () => {
    for (const i of liste.ilaclar) {
      expect(i.kullanim, JSON.stringify(i)).toBeUndefined();
      expect(i.sure, JSON.stringify(i)).toBeUndefined();
      expect(i.endikasyon, JSON.stringify(i)).toBeUndefined();
    }
  });

  it('gözle görülür bir hacimde', () => expect(liste.ilaclar.length).toBeGreaterThan(80));
});

describe('eksikleriBul', () => {
  const hazir = [
    { ad: 'Paracetamol', doz: '500 mg', form: 'tablet' },
    { ad: 'Paracetamol', doz: '120 mg/5 ml', form: 'surup' },
    { ad: 'Amoxicillin', doz: '500 mg', form: 'kapsul' },
  ];

  it('boş depoda hepsini döndürür', () => expect(eksikleriBul([], hazir)).toHaveLength(3));

  it('zaten olanı atlar', () => {
    const mevcut = [{ ad: 'Paracetamol', doz: '500 mg', form: 'tablet' }];
    expect(eksikleriBul(mevcut, hazir).map((x) => x.ad)).toEqual(['Paracetamol', 'Amoxicillin']);
  });

  it('aynı ilacın farklı şekli ayrı kayıttır', () => {
    const mevcut = [{ ad: 'Paracetamol', doz: '500 mg', form: 'tablet' }];
    const kalan = eksikleriBul(mevcut, hazir);
    expect(kalan.some((x) => x.form === 'surup')).toBe(true);
  });

  it('büyük/küçük harf ve boşluk farkını aynı sayar', () => {
    const mevcut = [{ ad: '  paracetamol ', doz: '500 MG', form: 'tablet' }];
    expect(eksikleriBul(mevcut, hazir).some((x) => x.form === 'tablet')).toBe(false);
  });

  it('listenin kendi içindeki tekrarı da atar', () => {
    const tekrarli = [...hazir, { ad: 'Amoxicillin', doz: '500 mg', form: 'kapsul' }];
    expect(eksikleriBul([], tekrarli)).toHaveLength(3);
  });
});

describe('listeKaydi', () => {
  it('hazır işaretiyle ve boş künye alanlarıyla kurar', () => {
    const k = listeKaydi({ ad: 'X', etkenMadde: 'X', form: 'tablet', doz: '1 mg', receteli: true });
    expect(k).toMatchObject({ ad: 'X', form: 'tablet', doz: '1 mg', receteli: true, hazir: 1, barkod: '' });
  });
  it('receteli belirtilmemişse reçeteli sayar', () => {
    expect(listeKaydi({ ad: 'X' }).receteli).toBe(true);
  });
});

describe('hazirListeyiYukle', () => {
  let depo;
  const getir = async () => ({ ok: true, json: async () => liste });
  beforeEach(() => { depo = new BellekDepo(); });

  it('listeyi depoya yazar', async () => {
    const r = await hazirListeyiYukle(depo, getir);
    expect(r.eklendi).toBe(liste.ilaclar.length);
    expect(await depo.say('ilaclar')).toBe(liste.ilaclar.length);
  });

  it('ikinci kez çalıştırmak kopya oluşturmaz', async () => {
    await hazirListeyiYukle(depo, getir);
    const ikinci = await hazirListeyiYukle(depo, getir);
    expect(ikinci.eklendi).toBe(0);
    expect(await depo.say('ilaclar')).toBe(liste.ilaclar.length);
  });

  it('hekimin kendi kaydına dokunmaz', async () => {
    await depo.kaydet('ilaclar', { ad: 'Paracetamol', doz: '500 mg', form: 'tablet', notlar: 'kendi notum' });
    await hazirListeyiYukle(depo, getir);
    const kendi = (await depo.listele('ilaclar')).find((i) => i.notlar === 'kendi notum');
    expect(kendi).toBeTruthy();
    expect(kendi.hazir).toBeUndefined();
  });

  it('okunamayan listede anlamlı hata verir', async () => {
    const bozuk = async () => { throw new Error('ağ yok'); };
    await expect(hazirListeyiYukle(depo, bozuk)).rejects.toMatchObject({ kod: 'liste_okunamadi' });
  });

  it('bozuk biçimi reddeder', async () => {
    const bozuk = async () => ({ ok: true, json: async () => ({ ilaclar: [{ ad: '' }] }) });
    await expect(hazirListeyiYukle(depo, bozuk)).rejects.toMatchObject({ kod: 'liste_bozuk' });
  });
});
