import { describe, it, expect, beforeEach } from 'vitest';
import { BellekDepo, DepoHatasi } from '../app/js/depo/depo.js';
import { IdbDepo } from '../app/js/depo/idb.js';
import { hareketUygula, ilacHareketleri } from '../app/js/depo/stok.js';
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

describe('stok hareketleri', () => {
  let ilac;
  beforeEach(async () => { ilac = await depo.kaydet('ilaclar', { ad: 'Parol', stok: 10 }); });

  it('giriş stoğu artırır', async () => {
    await hareketUygula(depo, { ilacId: ilac.id, tur: 'giris', adet: 5 });
    expect((await depo.al('ilaclar', ilac.id)).stok).toBe(15);
  });
  it('reçete çıkışı stoğu azaltır', async () => {
    await hareketUygula(depo, { ilacId: ilac.id, tur: 'recete', adet: 4, receteId: 'rec_1' });
    expect((await depo.al('ilaclar', ilac.id)).stok).toBe(6);
  });
  it('stoğu eksiye düşüren hareketi reddeder', async () => {
    await expect(hareketUygula(depo, { ilacId: ilac.id, tur: 'recete', adet: 11 })).rejects.toThrow(/Stok yetersiz/);
    expect((await depo.al('ilaclar', ilac.id)).stok).toBe(10);
  });
  it('sayım stoğu mutlak değere eşitler', async () => {
    await hareketUygula(depo, { ilacId: ilac.id, tur: 'sayim', adet: 3 });
    expect((await depo.al('ilaclar', ilac.id)).stok).toBe(3);
  });
  it('hareket öncesi ve sonrası stoğu kaydeder', async () => {
    await hareketUygula(depo, { ilacId: ilac.id, tur: 'fire', adet: 2, aciklama: 'kırıldı' });
    const [h] = await ilacHareketleri(depo, ilac.id);
    expect(h).toMatchObject({ oncesi: 10, sonrasi: 8, adet: -2, aciklama: 'kırıldı' });
  });
  it('olmayan ilaçta hata verir', async () => {
    await expect(hareketUygula(depo, { ilacId: 'yok', tur: 'giris', adet: 1 })).rejects.toThrow(/bulunamadı/);
  });
  it('geçmişi yeniden eskiye sıralar', async () => {
    await hareketUygula(depo, { ilacId: ilac.id, tur: 'giris', adet: 1, aciklama: 'ilk' });
    await new Promise((r) => setTimeout(r, 2));
    await hareketUygula(depo, { ilacId: ilac.id, tur: 'giris', adet: 1, aciklama: 'son' });
    const g = await ilacHareketleri(depo, ilac.id);
    expect(g[0].aciklama).toBe('son');
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
    const idb = await new IdbDepo('eczane-test-' + Math.random().toString(36).slice(2)).ac();
    const i = await idb.kaydet('ilaclar', { ad: 'Parol', stok: 3, barkod: '8699514013059' });
    expect((await idb.al('ilaclar', i.id)).ad).toBe('Parol');
    expect(idb.db.objectStoreNames.contains('receteler')).toBe(true);
    expect(idb.db.transaction('ilaclar').objectStore('ilaclar').indexNames.contains('barkod')).toBe(true);
    expect((await idb.meta()).degisiklikSayaci).toBe(1);
  });
});
