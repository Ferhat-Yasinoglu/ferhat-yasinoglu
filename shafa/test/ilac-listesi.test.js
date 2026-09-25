// Hazır ilaç listesi: birleştirme mantığı ve gönderilen verinin sağlığı.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { eksikleriBul, eskiKayitlariBul, ilacAnahtari, listeKaydi, listeGecerliMi } from '../app/js/paylasilan/ilac-listesi.js';
import { FORMLAR } from '../app/js/paylasilan/ilac.js';
import { BellekDepo } from '../app/js/depo/depo.js';
import { hazirListeyiYukle, hazirListeyiTazele, HAZIR_LISTE_SURUMU } from '../app/js/depo/hazir-ilaclar.js';

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

  // Kâğıdı Dari/İngilizce okuyan hekim ve eczacı için nokta ondalık ayraçtır:
  // «100.000 IU/ml» 100 IU/ml okunuyordu (bin kat). Yüzde de sayıdan sonra.
  it('dozlarda Türk yazımı yok: binlik nokta ve önde yüzde', () => {
    for (const i of liste.ilaclar) {
      expect(i.doz, i.ad).not.toMatch(/\d\.\d{3}\b/);
      expect(i.doz, i.ad).not.toMatch(/%\d/);
    }
  });

  it('koddaki sürüm listeninkiyle aynı', () => expect(HAZIR_LISTE_SURUMU).toBe(liste.surum));
});

/* Listenin 1. sürümü: `eski` alanları yerine konunca elde edilen belge. */
const eskiListe = {
  surum: 1,
  ilaclar: liste.ilaclar.map(({ eski, ...h }) => ({ ...h, ...eski })),
};
const degisen = liste.ilaclar.filter((h) => h.eski);

describe('eski sürümden yükseltme', () => {
  let depo;
  const getir = (belge) => async () => ({ ok: true, json: async () => belge });
  beforeEach(() => { depo = new BellekDepo(); });

  it('yeniden yüklemek kopya eklemiyor, eski adları yerinde yeniliyor', async () => {
    await hazirListeyiYukle(depo, getir(eskiListe));
    const r = await hazirListeyiYukle(depo, getir(liste));
    expect(r).toMatchObject({ eklendi: 0, guncellendi: degisen.length });
    const kayitlar = await depo.listele('ilaclar');
    expect(kayitlar).toHaveLength(liste.ilaclar.length);
    expect(new Set(kayitlar.map(ilacAnahtari))).toEqual(new Set(liste.ilaclar.map(ilacAnahtari)));
    // Anahtarı aynı kalanlarda da (İnsülin → Insulin) yeni yazım.
    expect(kayitlar.map((k) => k.ad)).toContain('Insulin (NPH)');
    expect(kayitlar.find((k) => k.ad === 'Nystatin').doz).toBe('100,000 IU/ml');
    expect(kayitlar.find((k) => k.ad.startsWith('Vitamin B')).etkenMadde).toBe('Vitamin B complex');
    expect(await depo.meta()).toMatchObject({ hazirListeSurumu: 2 });
  });

  it('açılışta bir kez: adları yeniliyor, yeni ilaç eklemiyor, hekimin kaydına dokunmuyor', async () => {
    const ilk60 = eskiListe.ilaclar.slice(0, 60);
    await hazirListeyiYukle(depo, getir({ ...eskiListe, ilaclar: ilk60 }));
    const eskiNystatin = (await depo.listele('ilaclar')).find((k) => k.ad === 'Nystatin');
    // Hekim bir kaydın dozunu kendisi değiştirmiş, birini de elle eklemiş.
    const suni = (await depo.listele('ilaclar')).find((k) => k.ad === 'Oral rehidratasyon tuzları (ORS)');
    await depo.kaydet('ilaclar', { ...suni, doz: '1 L için (kendi)' });
    await depo.kaydet('ilaclar', { ad: 'Clotrimazole', doz: '%1', form: 'krem', notlar: 'kendi' });
    const n = await hazirListeyiTazele(depo, getir(liste));
    const kayitlar = await depo.listele('ilaclar');
    expect(kayitlar).toHaveLength(61);
    expect(kayitlar.find((k) => k.id === eskiNystatin.id).doz).toBe('100,000 IU/ml');
    expect(kayitlar.find((k) => k.id === suni.id).ad).toBe('Oral rehidratasyon tuzları (ORS)');
    expect(kayitlar.find((k) => k.notlar === 'kendi').doz).toBe('%1');
    // İlk 60'taki değişenlerin hepsi, hekimin dozunu değiştirdiği ORS hariç.
    const ilk60Degisen = degisen.filter((h) => ilk60.some((e) => ilacAnahtari(e) === ilacAnahtari({ ...h, ...h.eski })));
    expect(n).toBe(ilk60Degisen.length - 1);
    // İkinci açılışta bir şey yapmıyor.
    expect(await hazirListeyiTazele(depo, async () => { throw new Error('okunmamalı'); })).toBe(0);
  });

  it('listeyi hiç yüklememiş kurulumda listeyi okumuyor bile', async () => {
    expect(await hazirListeyiTazele(depo, async () => { throw new Error('okunmamalı'); })).toBe(0);
    expect(await depo.say('ilaclar')).toBe(0);
  });

  it('yeni adıyla bir kayıt zaten varsa eskisi güncellenmiyor (kopya anahtar olmasın)', () => {
    const h = { ad: 'Artificial tears', doz: '0.3%', form: 'damla', eski: { ad: 'Suni gözyaşı', doz: '%0.3' } };
    const eski = { id: 'a', ad: 'Suni gözyaşı', doz: '%0.3', form: 'damla', hazir: 1 };
    const yeni = { id: 'b', ad: 'Artificial tears', doz: '0.3%', form: 'damla', hazir: 1 };
    expect(eskiKayitlariBul([eski, yeni], [h])).toEqual([]);
    expect(eskiKayitlariBul([eski], [h])).toEqual([{ ...eski, ad: 'Artificial tears', doz: '0.3%' }]);
    // Listeden gelmemiş kayda dokunulmuyor.
    expect(eskiKayitlariBul([{ ...eski, hazir: undefined }], [h])).toEqual([]);
  });
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
