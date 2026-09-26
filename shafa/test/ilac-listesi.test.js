// Hazır ilaç listesi: birleştirme mantığı ve gönderilen verinin sağlığı.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  eksikleriBul, eskiKayitlariBul, ilacAnahtari, listeKaydi, listeGecerliMi, katalogDamgasi, havuz,
} from '../app/js/paylasilan/ilac-listesi.js';
import { FORMLAR } from '../app/js/paylasilan/ilac.js';
import { BellekDepo } from '../app/js/depo/depo.js';
import {
  hazirListeyiYukle, hazirListeyiTazele, HAZIR_LISTE_SURUMU, katalogdanKaydet, katalogOku, katalogBelleginiBosalt,
} from '../app/js/depo/hazir-ilaclar.js';

const liste = JSON.parse(await readFile(new URL('../app/veri/ilaclar.json', import.meta.url), 'utf8'));
/* 2. sürümün donmuş kopyası: sahadaki cihazların yüklediği liste bu. */
const v2 = JSON.parse(await readFile(new URL('./veri/ilaclar-v2.json', import.meta.url), 'utf8'));

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

  // nuskha'nın listesinde her ilacın yanında hazır doz/zaman/tarika/adet
  // vardı; o değerler buraya sızarsa uygulama reçete önermiş olur.
  it('kullanım şekli, doz, zaman ya da süre taşımıyor — o karar hekimin', () => {
    const yasak = ['kullanim', 'sure', 'endikasyon', 'dose', 'timing', 'tariqa', 'n', 'miktar', 'zaman', 'adet', 'yol'];
    for (const i of liste.ilaclar) {
      for (const a of yasak) expect(i[a], JSON.stringify(i)).toBeUndefined();
    }
  });

  it('yalnız ad sözlüğü alanları var (beyaz liste)', () => {
    const izinli = new Set(['hid', 'ad', 'etkenMadde', 'form', 'doz', 'marka', 'kisa', 'grup', 'receteli', 'sik', 'eski']);
    for (const i of liste.ilaclar) {
      expect(Object.keys(i).filter((k) => !izinli.has(k)), i.ad).toEqual([]);
    }
  });

  it('gözle görülür bir hacimde', () => expect(liste.ilaclar.length).toBeGreaterThan(500));

  it('her satırın kalıcı, tekil kimliği var (h + 4 hane)', () => {
    const hidler = liste.ilaclar.map((i) => i.hid);
    for (const h of hidler) expect(h).toMatch(/^h\d{4}$/);
    expect(new Set(hidler).size).toBe(hidler.length);
  });

  // Sahada bu satırlar cihazlara yüklendi ve reçetelere yazıldı: adı, dozu ya
  // da şekli değişirse hazır kayıt listeyle eşleşmez, kimliği kayarsa damga
  // yanlış ilaca gider.
  it('2. sürümün her satırı aynı kimlikle ve aynı alanlarla duruyor', () => {
    v2.ilaclar.forEach((eski, i) => {
      const hid = `h${String(i + 1).padStart(4, '0')}`;
      const yeni = liste.ilaclar.find((x) => x.hid === hid);
      expect(yeni, hid).toBeTruthy();
      for (const a of ['ad', 'doz', 'form', 'etkenMadde', 'receteli', 'eski']) expect(yeni[a], `${hid} ${a}`).toEqual(eski[a]);
    });
  });

  it('her ilacın grubu tanımlı gruplardan biri, boş grup yok', () => {
    const gruplar = new Set(liste.gruplar.map((g) => g.anahtar));
    expect(gruplar.size).toBe(18);
    for (const i of liste.ilaclar) expect(gruplar.has(i.grup), `${i.ad}: ${i.grup}`).toBe(true);
    const kullanilan = new Set(liste.ilaclar.map((i) => i.grup));
    expect(liste.gruplar.filter((g) => !kullanilan.has(g.anahtar))).toEqual([]);
    for (const g of liste.gruplar) {
      expect(g.ad.trim(), g.anahtar).not.toBe('');
      expect(g.en.trim(), g.anahtar).not.toBe('');
    }
  });

  it('kâğıttaki önek (kisa) bilinen değerlerden, marka işareti yalnız 1', () => {
    const kisalar = new Set(['Susp', 'Vial', 'Inj', 'Inf', 'Cream', 'Gel', 'Lotion', 'Eye Drops', 'Ear Drops', 'Nasal Drops',
      'Nasal Spray', 'Inhaler', 'Eye Oint', 'Oral Gel', 'Oral Paste', 'Vag Tab', 'Mouthwash', 'Shampoo', 'Powder']);
    for (const i of liste.ilaclar) {
      if (i.kisa !== undefined) expect(kisalar.has(i.kisa), `${i.ad}: ${i.kisa}`).toBe(true);
      if (i.marka !== undefined) expect(i.marka, i.ad).toBe(1);
    }
    expect(liste.ilaclar.filter((i) => i.marka).length).toBeGreaterThan(300);
  });

  // Kâğıdı Dari/İngilizce okuyan hekim ve eczacı için nokta ondalık ayraçtır:
  // «100.000 IU/ml» 100 IU/ml okunuyordu (bin kat). Yüzde de sayıdan sonra.
  // Binlik grup 0 ile başlamaz: «0.025%» ve «2/0.035 mg» gerçek ondalık.
  it('dozlarda Türk yazımı yok: binlik nokta ve önde yüzde', () => {
    for (const i of liste.ilaclar) {
      expect(i.doz, i.ad).not.toMatch(/\b[1-9]\d{0,2}\.\d{3}\b/);
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
    expect(await depo.meta()).toMatchObject({ hazirListeSurumu: HAZIR_LISTE_SURUMU });
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

describe('2 → 3: yerinde yükseltme (katalogDamgasi)', () => {
  let depo;
  const getir = (belge) => async () => ({ ok: true, json: async () => belge });
  beforeEach(() => { depo = new BellekDepo(); });

  it('dokunulmamış liste kayıtlarına kimlik ve grup ekliyor, ilaç EKLEMİYOR, hekimin kaydına dokunmuyor', async () => {
    await hazirListeyiYukle(depo, getir(v2));
    expect(await depo.meta()).toMatchObject({ hazirListeSurumu: 2 });
    const hepsi = await depo.listele('ilaclar');
    // Hekim birinin dozunu düzeltmiş, birini de kendisi eklemiş.
    const duzeltilen = hepsi.find((k) => k.ad === 'Paracetamol' && k.form === 'tablet');
    await depo.kaydet('ilaclar', { ...duzeltilen, doz: '650 mg' });
    await depo.kaydet('ilaclar', { ad: 'Kendi ilacım', etkenMadde: 'Ibuprofen', form: 'tablet', doz: '200 mg' });

    const n = await hazirListeyiTazele(depo, getir(liste));
    const sonra = await depo.listele('ilaclar');
    expect(sonra).toHaveLength(v2.ilaclar.length + 1);
    expect(n).toBe(v2.ilaclar.length - 1);
    for (const k of sonra.filter((x) => x.hazir && x.doz !== '650 mg')) {
      const h = liste.ilaclar.find((x) => x.hid === k.hazirId);
      expect(h, k.ad).toBeTruthy();
      expect(ilacAnahtari(h)).toBe(ilacAnahtari(k));
      expect(k.grup).toBe(h.grup);
    }
    const elli = sonra.find((k) => k.id === duzeltilen.id);
    expect(elli.hazirId).toBeUndefined();
    expect(elli.grup).toBeUndefined();
    expect(sonra.find((k) => k.ad === 'Kendi ilacım').hazirId).toBeUndefined();
    expect(await depo.meta()).toMatchObject({ hazirListeSurumu: 3 });
    // İkinci açılışta listeyi okumuyor bile.
    expect(await hazirListeyiTazele(depo, async () => { throw new Error('okunmamalı'); })).toBe(0);
  });

  it('damga bir kez: kimliği olan kayda ikinci kez dokunmuyor', () => {
    const h = liste.ilaclar[0];
    const m = { id: 'a', ...listeKaydi({ ...h, hid: undefined, grup: undefined }) };
    const [damgali] = katalogDamgasi([m], liste.ilaclar);
    expect(damgali).toMatchObject({ id: 'a', hazirId: h.hid, grup: h.grup });
    expect(katalogDamgasi([damgali], liste.ilaclar)).toEqual([]);
    // Silinmiş ve listeden gelmemiş kayda da dokunulmuyor.
    expect(katalogDamgasi([{ ...m, silindi: 1 }, { ...m, hazir: undefined }], liste.ilaclar)).toEqual([]);
  });
});

describe('listeKaydi 3. sürüm alanları', () => {
  it('kimliği, grubu, marka işaretini ve öneki kayda taşıyor', () => {
    const h = liste.ilaclar.find((x) => x.marka && x.kisa);
    expect(listeKaydi(h)).toMatchObject({ hazirId: h.hid, grup: h.grup, marka: 1, kisa: h.kisa, hazir: 1 });
    const jenerik = listeKaydi({ ad: 'X', form: 'tablet' });
    for (const a of ['hazirId', 'grup', 'marka', 'kisa']) expect(a in jenerik, a).toBe(false);
  });
});

describe('havuz ve seçilince kayda dönüşme', () => {
  const katalog = liste.ilaclar;

  it('kayda dönüşmüş liste satırı ikinci kez çıkmıyor (kimlikle de, ad|doz|şekille de)', () => {
    const [a, b, c, d] = katalog;
    const kayitlar = [
      { id: '1', ...listeKaydi(a) },                              // kimliğiyle
      { id: '2', ad: b.ad, doz: b.doz, form: b.form },              // elle, aynı ürün
      { id: '3', ...listeKaydi(c), silindi: 1 },                  // silinmiş: satır geri gelir
      { id: '4', ...listeKaydi(d), doz: 'hekimin düzelttiği' },   // seçilmiş, sonra düzeltilmiş
    ];
    const h = havuz(kayitlar, katalog);
    expect(h).toHaveLength(3 + katalog.length - 3);
    expect(h.filter((x) => x.katalog && [a, b, d].some((y) => y.hid === x.hid))).toEqual([]);
    expect(h.some((x) => x.katalog && x.hid === c.hid)).toBe(true);
    expect(h.find((x) => x.katalog).id).toBeUndefined();
  });

  it('iki kez seçmek kopya oluşturmuyor; kayıt olan ilaç olduğu gibi dönüyor', async () => {
    const depo = new BellekDepo();
    const satir = havuz([], katalog).find((x) => x.marka);
    const ilk = await katalogdanKaydet(depo, satir);
    const ikinci = await katalogdanKaydet(depo, satir);
    expect(ilk.id).toBeTruthy();
    expect(ikinci.id).toBe(ilk.id);
    expect(await depo.say('ilaclar')).toBe(1);
    expect(ilk).toMatchObject({ hazirId: satir.hid, hazir: 1, ad: satir.ad });
    expect(ilk.katalog).toBeUndefined();
    expect(await katalogdanKaydet(depo, ilk)).toBe(ilk);
  });
});

describe('katalogOku', () => {
  it('listeyi oturumda bir kez okuyor: arama her tuşta ağa gitmiyor', async () => {
    katalogBelleginiBosalt();
    let n = 0;
    const getir = async () => { n++; return { ok: true, json: async () => liste }; };
    expect(await katalogOku(getir)).toBe(await katalogOku(getir));
    expect(n).toBe(1);
    katalogBelleginiBosalt();
    await expect(katalogOku(async () => { throw new Error('ağ yok'); })).rejects.toMatchObject({ kod: 'liste_okunamadi' });
    // Başarısız okuma saklanmıyor: sonraki çağrı yeniden deniyor.
    expect((await katalogOku(getir)).surum).toBe(3);
    katalogBelleginiBosalt();
  });
});
