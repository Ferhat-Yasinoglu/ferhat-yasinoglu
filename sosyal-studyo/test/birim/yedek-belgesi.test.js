import { describe, expect, it } from 'vitest';
import { kanonikJson, yedekDogrula, yedekOlustur } from '../../app/js/paylasilan/sema/yedek-belgesi.js';

describe('yedek belgesi', () => {
  it('kanonik JSON anahtar sırasından bağımsızdır', () => {
    expect(kanonikJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
  });
  it('oluştur → doğrula geçer; bozulan gövde ve gizli koleksiyon reddedilir', async () => {
    const belge = await yedekOlustur({ akislar: [{ id: 'a', ad: 'x' }], gizli: [{ id: 'g' }], kisiler: [{ id: 'k', sanal: 1 }] });
    expect(belge.koleksiyonlar.gizli).toBeUndefined();
    expect(belge.sayim).toEqual({ akislar: 1, kisiler: 0 });
    expect((await yedekDogrula(belge)).gecerli).toBe(true);
    const bozuk = JSON.parse(JSON.stringify(belge));
    bozuk.koleksiyonlar.akislar[0].ad = 'y';
    expect((await yedekDogrula(bozuk)).hatalar.join()).toMatch(/sağlama/);
    const yasak = JSON.parse(JSON.stringify(belge));
    yasak.koleksiyonlar.gizli = [];
    expect((await yedekDogrula(yasak)).hatalar.join()).toMatch(/yasak/);
  });
  it('daha yeni şema sürümü reddedilir', async () => {
    const belge = await yedekOlustur({ akislar: [] });
    belge.sema_surumu = 99;
    expect((await yedekDogrula(belge)).hatalar.join()).toMatch(/daha yeni/);
  });
});
