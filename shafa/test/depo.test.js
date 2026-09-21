import { describe, it, expect, beforeEach } from 'vitest';
import { BellekDepo, DepoHatasi } from '../app/js/depo/depo.js';
import { IdbDepo } from '../app/js/depo/idb.js';
import { yedekOlustur, iceAktar, yedekDogrula, hatirlatmaGerekli } from '../app/js/depo/yedek.js';
import { ornekYukle } from '../app/js/depo/ornek.js';

let depo;
beforeEach(() => { depo = new BellekDepo(); });

describe('zarf', () => {
  it('id, rev ve zaman damgası ekler', async () => {
    const i = await depo.kaydet('ilaclar', { ad: 'Parol' });
    expect(i.id).toMatch(/^ila_/);
    expect(i.rev).toBe(1);
    expect(i.olusturuldu).toBe(i.guncellendi);
  });
  it('güncellemede rev artar, oluşturulma tarihi korunur', async () => {
    const a = await depo.kaydet('ilaclar', { ad: 'Parol' });
    const b = await depo.kaydet('ilaclar', { ...a, ad: 'Parol Plus' });
    expect(b.rev).toBe(2);
    expect(b.olusturuldu).toBe(a.olusturuldu);
  });
  it('bilinmeyen koleksiyonu reddeder', async () => {
    await expect(depo.kaydet('yok_boyle', {})).rejects.toThrow(DepoHatasi);
  });
  it('eski rev ile yazmayı çakışma sayar', async () => {
    const a = await depo.kaydet('ilaclar', { ad: 'Parol' });
    await depo.kaydet('ilaclar', { ...a, ad: 'A' });
    await expect(depo.kaydet('ilaclar', { ...a, ad: 'B' }, { rev: 1 })).rejects.toThrow(/değiştirildi/);
  });
});

describe('silme', () => {
  it('mezar taşı bırakır', async () => {
    const i = await depo.kaydet('ilaclar', { ad: 'Parol' });
    await depo.sil('ilaclar', i.id);
    expect(await depo.al('ilaclar', i.id)).toBe(null);
    expect(await depo.listele('ilaclar')).toHaveLength(0);
    expect(await depo.listele('ilaclar', { silinmisDahil: true })).toHaveLength(1);
  });
  it('olmayan kaydı silmeye çalışınca false döner', async () => {
    expect(await depo.sil('ilaclar', 'yok')).toBe(false);
  });
});

describe('listele', () => {
  beforeEach(async () => {
    await depo.kaydet('hastalar', { ad: 'Zeynep', soyad: 'Çelik' });
    await depo.kaydet('hastalar', { ad: 'Ayşe', soyad: 'Ateş' });
    await depo.kaydet('hastalar', { ad: 'Mehmet', soyad: 'Demir' });
  });
  it('Türkçe harf sırasına göre sıralar', async () => {
    const l = await depo.listele('hastalar', { sirala: 'soyad' });
    expect(l.map((h) => h.soyad)).toEqual(['Ateş', 'Çelik', 'Demir']);
  });
  it('nesne süzgeci uygular', async () => {
    expect(await depo.listele('hastalar', { filtre: { ad: 'Ayşe' } })).toHaveLength(1);
  });
  it('limit uygular', async () => {
    expect(await depo.listele('hastalar', { limit: 2 })).toHaveLength(2);
  });
});

describe('yedek', () => {
  it('alıp geri yükleyince veri aynı kalır', async () => {
    await depo.kaydet('ilaclar', { ad: 'Parol', stok: 7 });
    await depo.kaydet('hastalar', { ad: 'Ayşe', soyad: 'Yılmaz' });
    const belge = await yedekOlustur(depo);

    const yeni = new BellekDepo();
    const sonuc = await iceAktar(yeni, belge);
    expect(sonuc.ok).toBe(true);
    expect((await yeni.listele('ilaclar'))[0]).toMatchObject({ ad: 'Parol', stok: 7 });
    expect(await yeni.say('hastalar')).toBe(1);
  });
  it('yedek alınca değişiklik sayacı sıfırlanır', async () => {
    await depo.metaKaydet({ degisiklikSayaci: 12 });
    await yedekOlustur(depo);
    expect((await depo.meta()).degisiklikSayaci).toBe(0);
  });
  it('birleştirmede eski kayıt yeniyi ezmez', async () => {
    const i = await depo.kaydet('ilaclar', { ad: 'Parol', stok: 5 });
    const belge = await yedekOlustur(depo);
    await depo.kaydet('ilaclar', { ...i, stok: 99 });
    await iceAktar(depo, belge, { strateji: 'birlestir' });
    expect((await depo.al('ilaclar', i.id)).stok).toBe(99);
  });
  it('değiştirmede yedek kazanır', async () => {
    const i = await depo.kaydet('ilaclar', { ad: 'Parol', stok: 5 });
    const belge = await yedekOlustur(depo);
    await depo.kaydet('ilaclar', { ...i, stok: 99 });
    await iceAktar(depo, belge, { strateji: 'degistir' });
    expect((await depo.al('ilaclar', i.id)).stok).toBe(5);
  });
  it('provada hiçbir şey yazılmaz', async () => {
    const belge = { bicim: 'eczane-yedek', semaSurumu: 1, koleksiyonlar: { ilaclar: [{ id: 'ila_x', ad: 'X' }] } };
    await iceAktar(depo, belge, { prova: true });
    expect(await depo.say('ilaclar')).toBe(0);
  });
  it('yabancı dosyayı reddeder', () => {
    expect(yedekDogrula({ bicim: 'baska-uygulama' }).gecerli).toBe(false);
    expect(yedekDogrula(null).gecerli).toBe(false);
  });
  it('ileri sürümlü yedeği reddeder', () => {
    expect(yedekDogrula({ bicim: 'eczane-yedek', semaSurumu: 99, koleksiyonlar: {} }).gecerli).toBe(false);
  });
});

describe('hatirlatmaGerekli', () => {
  it('hiç yedek yoksa ve değişiklik varsa uyarır', () => {
    expect(hatirlatmaGerekli({ degisiklikSayaci: 3 }).gerekli).toBe(true);
  });
  it('boş depoda uyarmaz', () => {
    expect(hatirlatmaGerekli({ degisiklikSayaci: 0 }).gerekli).toBe(false);
  });
  it('20 değişiklikte uyarır', () => {
    expect(hatirlatmaGerekli({ sonYedek: new Date().toISOString(), degisiklikSayaci: 20 }).gerekli).toBe(true);
  });
  it('taze yedekte susar', () => {
    expect(hatirlatmaGerekli({ sonYedek: new Date().toISOString(), degisiklikSayaci: 2 }).gerekli).toBe(false);
  });
});

describe('örnek veri', () => {
  it('bir kez yüklenir ve tek tuşla silinir', async () => {
    const r = await ornekYukle(depo);
    expect(r.ilac).toBeGreaterThan(0);
    expect(await ornekYukle(depo)).toEqual({ ilac: 0, hasta: 0 });

    await depo.kaydet('ilaclar', { ad: 'Kendi ilacım' });
    await depo.ornekSil();
    const kalan = await depo.listele('ilaclar');
    expect(kalan).toHaveLength(1);
    expect(kalan[0].ad).toBe('Kendi ilacım');
  });
});

describe('IndexedDB deposu', () => {
  it('şemayı kurar, yazar ve okur', async () => {
    const idb = await new IdbDepo('shafa-test-' + Math.random().toString(36).slice(2)).ac();
    const i = await idb.kaydet('ilaclar', { ad: 'Parol', stok: 3, barkod: '8699514013059' });
    expect((await idb.al('ilaclar', i.id)).ad).toBe('Parol');
    expect(idb.db.objectStoreNames.contains('receteler')).toBe(true);
    expect(idb.db.transaction('ilaclar').objectStore('ilaclar').indexNames.contains('barkod')).toBe(true);
    expect((await idb.meta()).degisiklikSayaci).toBe(1);
  });
});

describe('düşmüş koleksiyon taşıyan eski yedek', () => {
  // Stok takibi kalkınca 'hareketler' koleksiyonu düştü. Doktorun elindeki
  // eski yedek dosyası hâlâ onu taşıyor: reddedilmemeli, sessizce atlanmalı.
  const eskiYedek = () => ({
    bicim: 'eczane-yedek', semaSurumu: 1, olusturuldu: '2026-01-01T00:00:00.000Z',
    koleksiyonlar: {
      ilaclar: [{ id: 'ila_1', ad: 'Parol', rev: 1, guncellendi: '2026-01-01T00:00:00.000Z' }],
      hastalar: [], receteler: [], ayarlar: [],
      hareketler: [{ id: 'hrk_1', ilacId: 'ila_1', adet: 5, rev: 1 }],
    },
  });

  it('geçerli sayılır', () => expect(yedekDogrula(eskiYedek()).gecerli).toBe(true));

  it('eski "eczane-yedek" biçim adı hâlâ kabul edilir', () => {
    // Uygulamanın adı Shafa oldu; kullanıcının elindeki eski dosya
    // adı değişti diye reddedilmemeli.
    expect(yedekDogrula({ ...eskiYedek(), bicim: 'eczane-yedek' }).gecerli).toBe(true);
    expect(yedekDogrula({ ...eskiYedek(), bicim: 'baska-sey' }).gecerli).toBe(false);
  });

  it('ilaçlar gelir, hareketler atlanır', async () => {
    const r = await iceAktar(depo, eskiYedek());
    expect(r.ok).toBe(true);
    expect(r.rapor.hareketler).toBeUndefined();
    expect((await depo.listele('ilaclar')).map((i) => i.ad)).toEqual(['Parol']);
  });

  it('bilinmeyen bir koleksiyon hâlâ reddedilir', () => {
    const b = eskiYedek();
    b.koleksiyonlar.kediler = [];
    expect(yedekDogrula(b).gecerli).toBe(false);
  });
});

describe('ayarların kısmi yedekten geri yüklenmesi', () => {
  // Ayarlar tek kayıt ve içinde doğrulama anahtarı var. Yalnız anteti taşıyan
  // bir yedek anahtarı silseydi eski reçetelerin kodları doğrulanamazdı.
  it('dosyada olmayan ayar alanları korunur', async () => {
    await depo.ayarKaydet({ dogrulamaAnahtari: 'gizli-anahtar', paraBirimi: 'AFN', doktorAd: 'Eski' });
    const belge = {
      bicim: 'shafa-yedek', semaSurumu: 2, olusturuldu: '2099-01-01T00:00:00.000Z',
      koleksiyonlar: {
        ayarlar: [{ id: 'genel', doktorAd: 'Yeni', adres: 'Kabil', rev: 1, guncellendi: '2099-01-01T00:00:00.000Z' }],
      },
    };
    const sonuc = await iceAktar(depo, belge);
    expect(sonuc.ok).toBe(true);
    const ayar = await depo.ayarlar();
    expect(ayar.doktorAd).toBe('Yeni');        // dosyadaki yazıldı
    expect(ayar.adres).toBe('Kabil');          // yeni alan eklendi
    expect(ayar.dogrulamaAnahtari).toBe('gizli-anahtar'); // dokunulmadı
    expect(ayar.paraBirimi).toBe('AFN');       // dokunulmadı
  });
});
