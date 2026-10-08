// Günlük sıra: her gün bir ürün, iki kişi aynı günü görür, «yakında» ürünler sıraya girmez.
import { describe, it, expect } from 'vitest';
import { gunMetni, gunNumarasi, gununUrunu, onumuzdekiGunler, bugunYapildi, siradakiUrunler, BASLANGIC } from '../app/js/paylasilan/sira.js';
import { URUNLER } from '../app/js/paylasilan/urunler.js';

describe('gün', () => {
  it('Avrupa/Berlin günü: UTC gece yarısından önce de yeni gün', () => {
    expect(gunMetni(new Date('2026-10-08T22:30:00Z'))).toBe('2026-10-09');
    expect(gunMetni(new Date('2026-10-08T21:30:00Z'))).toBe('2026-10-08');
  });
  it('gün numarası başlangıçtan sayılır', () => {
    expect(gunNumarasi(BASLANGIC)).toBe(0);
    expect(gunNumarasi('2026-10-18')).toBe(10);
    expect(gunNumarasi('2026-10-07')).toBe(-1);
  });
});

describe('günün ürünü', () => {
  const liste = siradakiUrunler(URUNLER);
  it('yakında ürünler sıraya girmez', () => {
    expect(liste.some((u) => u.yayinda === false)).toBe(false);
    expect(liste.length).toBeGreaterThanOrEqual(5);
  });
  it('başlangıç günü ilk ürün, sonra sırayla, liste bitince başa döner', () => {
    expect(gununUrunu(URUNLER, BASLANGIC).urun.anahtar).toBe(liste[0].anahtar);
    expect(gununUrunu(URUNLER, '2026-10-09').urun.anahtar).toBe(liste[1].anahtar);
    const donus = new Date(Date.parse(BASLANGIC + 'T00:00:00Z') + liste.length * 86_400_000).toISOString().slice(0, 10);
    expect(gununUrunu(URUNLER, donus).urun.anahtar).toBe(liste[0].anahtar);
  });
  it('başlangıçtan önceki gün de tanımlı', () => {
    expect(gununUrunu(URUNLER, '2026-10-07').urun.anahtar).toBe(liste[liste.length - 1].anahtar);
  });
  it('önümüzdeki 7 gün ardışık ve farklı', () => {
    const g = onumuzdekiGunler(URUNLER, 7, BASLANGIC);
    expect(g).toHaveLength(7);
    expect(g.map((x) => x.gun)[6]).toBe('2026-10-14');
    expect(new Set(g.map((x) => x.urun.anahtar)).size).toBe(7);
  });
  it('sırada ürün yoksa null', () => { expect(gununUrunu([{ anahtar: 'x', yayinda: false }])).toBeNull(); });
});

describe('bugün yapıldı mı', () => {
  it('aynı gün ve ürün → evet; hata kaydı ve başka gün → hayır; sunucu zamanı sayı da olur', () => {
    const gun = '2026-10-08';
    expect(bugunYapildi([{ urun: 'dawayar', zaman: '2026-10-08T10:00:00Z', durum: 'yapildi' }], 'dawayar', gun)).toBe(true);
    expect(bugunYapildi([{ urun: 'dawayar', zaman: Date.parse('2026-10-08T10:00:00Z'), durum: 'yayinlandi' }], 'dawayar', gun)).toBe(true);
    expect(bugunYapildi([{ urun: 'dawayar', zaman: '2026-10-08T10:00:00Z', durum: 'hata' }], 'dawayar', gun)).toBe(false);
    expect(bugunYapildi([{ urun: 'dawayar', zaman: '2026-10-07T10:00:00Z', durum: 'yapildi' }], 'dawayar', gun)).toBe(false);
    expect(bugunYapildi([{ urun: 'shafa', zaman: '2026-10-08T10:00:00Z', durum: 'yapildi' }], 'dawayar', gun)).toBe(false);
  });
});
