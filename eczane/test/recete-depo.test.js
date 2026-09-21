// Karşılama, stoğa dokunduğu için en kritik kısım: reçetedeki "verildi" ile
// stok geçmişinin hep birbirini tutması bu testlerle güvence altında.
import { describe, it, expect, beforeEach } from 'vitest';
import { BellekDepo } from '../app/js/depo/depo.js';
import { receteKaydet, satirVer, satirVerilmedi, satirGeriAl, hepsiniVer } from '../app/js/depo/recete.js';
import { ilacHareketleri } from '../app/js/depo/stok.js';
import { satirDurumu, durumHesapla } from '../app/js/paylasilan/recete.js';

let depo, ilac, ilac2, hasta;

const satir = (ilacId, adet, ad) => ({ ilacId, ilacAdi: ad, adet, verilenAdet: 0, sebep: '', birimFiyat: 10, kullanim: 'Günde 2×1', sure: '7 gün', not: '' });

beforeEach(async () => {
  depo = new BellekDepo();
  ilac = await depo.kaydet('ilaclar', { ad: 'Parol', stok: 10 });
  ilac2 = await depo.kaydet('ilaclar', { ad: 'Augmentin', stok: 1 });
  hasta = await depo.kaydet('hastalar', { ad: 'Ayşe', soyad: 'Yılmaz' });
});

const receteYaz = (satirlar, ek = {}) => receteKaydet(depo, {
  hastaId: hasta.id, tarih: '2026-09-21', tur: 'normal', satirlar, ...ek,
});

describe('receteKaydet', () => {
  it('numarası boşsa günün sıradaki numarasını verir', async () => {
    const a = await receteYaz([satir(ilac.id, 1, 'Parol')]);
    const b = await receteYaz([satir(ilac.id, 1, 'Parol')]);
    expect(a.receteNo).toBe('2026-09-21-01');
    expect(b.receteNo).toBe('2026-09-21-02');
  });
  it('elle verilen numaraya dokunmaz', async () => {
    const r = await receteYaz([satir(ilac.id, 1, 'Parol')], { receteNo: 'ÖZEL-7' });
    expect(r.receteNo).toBe('ÖZEL-7');
  });
  it('durumu kayıtta tutar', async () => {
    const r = await receteYaz([satir(ilac.id, 1, 'Parol')]);
    expect(r.durum).toBe('bekliyor');
  });
});

describe('satirVer', () => {
  it('stoktan düşer ve satırı verildi yapar', async () => {
    const r = await receteYaz([satir(ilac.id, 3, 'Parol')]);
    const y = await satirVer(depo, r.id, 0);
    expect(y.satirlar[0].verilenAdet).toBe(3);
    expect(satirDurumu(y.satirlar[0])).toBe('verildi');
    expect((await depo.al('ilaclar', ilac.id)).stok).toBe(7);
    expect(y.durum).toBe('tamamlandi');
  });
  it('kısmi verince satır kısmi kalır ve reçete kısmi olur', async () => {
    const r = await receteYaz([satir(ilac.id, 3, 'Parol')]);
    const y = await satirVer(depo, r.id, 0, 1);
    expect(y.satirlar[0].verilenAdet).toBe(1);
    expect(satirDurumu(y.satirlar[0])).toBe('kismi');
    expect(y.durum).toBe('kismi');
    expect((await depo.al('ilaclar', ilac.id)).stok).toBe(9);
  });
  it('kalandan fazlasını vermez', async () => {
    const r = await receteYaz([satir(ilac.id, 2, 'Parol')]);
    const y = await satirVer(depo, r.id, 0, 99);
    expect(y.satirlar[0].verilenAdet).toBe(2);
    expect((await depo.al('ilaclar', ilac.id)).stok).toBe(8);
  });
  it('stok yetmezse reddeder ve hiçbir şeyi değiştirmez', async () => {
    const r = await receteYaz([satir(ilac2.id, 3, 'Augmentin')]);
    await expect(satirVer(depo, r.id, 0)).rejects.toThrow(/Stok yetersiz/);
    const sonra = await depo.al('receteler', r.id);
    expect(sonra.satirlar[0].verilenAdet).toBe(0);
    expect((await depo.al('ilaclar', ilac2.id)).stok).toBe(1);
  });
  it('tamamı verilmiş satırı yeniden vermez', async () => {
    const r = await receteYaz([satir(ilac.id, 1, 'Parol')]);
    await satirVer(depo, r.id, 0);
    await expect(satirVer(depo, r.id, 0)).rejects.toThrow(/zaten verilmiş/);
  });
  it('hareket geçmişine reçete numarasını yazar', async () => {
    const r = await receteYaz([satir(ilac.id, 2, 'Parol')]);
    await satirVer(depo, r.id, 0);
    const [h] = await ilacHareketleri(depo, ilac.id);
    expect(h).toMatchObject({ tur: 'recete', adet: -2, receteId: r.id });
    expect(h.aciklama).toContain(r.receteNo);
  });
  it('olmayan satırda hata verir', async () => {
    const r = await receteYaz([satir(ilac.id, 1, 'Parol')]);
    await expect(satirVer(depo, r.id, 5)).rejects.toThrow(/satırı bulunamadı/);
  });
});

describe('satirVerilmedi', () => {
  it('sebeple kapatır, stoğa dokunmaz', async () => {
    const r = await receteYaz([satir(ilac.id, 2, 'Parol')]);
    const y = await satirVerilmedi(depo, r.id, 0, 'hasta_istemedi', 'sonra alacak');
    expect(satirDurumu(y.satirlar[0])).toBe('verilmedi');
    expect(y.satirlar[0].not).toBe('sonra alacak');
    expect(y.durum).toBe('tamamlandi');
    expect((await depo.al('ilaclar', ilac.id)).stok).toBe(10);
    expect(await ilacHareketleri(depo, ilac.id)).toHaveLength(0);
  });
  it('sebepsiz kapatmaz', async () => {
    const r = await receteYaz([satir(ilac.id, 1, 'Parol')]);
    await expect(satirVerilmedi(depo, r.id, 0, '')).rejects.toThrow(/Sebep/);
  });
});

describe('satirGeriAl', () => {
  it('verilen kutuları iade hareketiyle stoğa döndürür', async () => {
    const r = await receteYaz([satir(ilac.id, 4, 'Parol')]);
    await satirVer(depo, r.id, 0);
    expect((await depo.al('ilaclar', ilac.id)).stok).toBe(6);

    const y = await satirGeriAl(depo, r.id, 0);
    expect(satirDurumu(y.satirlar[0])).toBe('bekliyor');
    expect(y.satirlar[0].verilenAdet).toBe(0);
    expect((await depo.al('ilaclar', ilac.id)).stok).toBe(10);

    const [h] = await ilacHareketleri(depo, ilac.id);
    expect(h).toMatchObject({ tur: 'iade', adet: 4 });
  });
  it('verilmedi işaretini kaldırır, stoğa dokunmaz', async () => {
    const r = await receteYaz([satir(ilac.id, 2, 'Parol')]);
    await satirVerilmedi(depo, r.id, 0, 'stok_yok');
    const y = await satirGeriAl(depo, r.id, 0);
    expect(satirDurumu(y.satirlar[0])).toBe('bekliyor');
    expect((await depo.al('ilaclar', ilac.id)).stok).toBe(10);
    expect(await ilacHareketleri(depo, ilac.id)).toHaveLength(0);
  });
  it('zaten bekleyen satırda hiçbir şey yapmaz', async () => {
    const r = await receteYaz([satir(ilac.id, 2, 'Parol')]);
    await satirGeriAl(depo, r.id, 0);
    expect(await ilacHareketleri(depo, ilac.id)).toHaveLength(0);
  });
});

describe('hepsiniVer', () => {
  it('verebildiklerini verir, stoğu yetmeyenleri atlar', async () => {
    const r = await receteYaz([satir(ilac.id, 2, 'Parol'), satir(ilac2.id, 3, 'Augmentin')]);
    const rapor = await hepsiniVer(depo, r.id);

    expect(rapor.verilen).toBe(1);
    expect(rapor.atlanan).toHaveLength(1);
    expect(rapor.atlanan[0].ad).toBe('Augmentin');

    const sonra = await depo.al('receteler', r.id);
    expect(satirDurumu(sonra.satirlar[0])).toBe('verildi');
    expect(satirDurumu(sonra.satirlar[1])).toBe('bekliyor');
    expect(durumHesapla(sonra.satirlar)).toBe('kismi');
    expect((await depo.al('ilaclar', ilac.id)).stok).toBe(8);
    expect((await depo.al('ilaclar', ilac2.id)).stok).toBe(1);
  });
  it('kapanmış satırları tekrar vermez', async () => {
    const r = await receteYaz([satir(ilac.id, 1, 'Parol')]);
    await satirVer(depo, r.id, 0);
    const rapor = await hepsiniVer(depo, r.id);
    expect(rapor).toEqual({ verilen: 0, atlanan: [] });
    expect((await depo.al('ilaclar', ilac.id)).stok).toBe(9);
  });
});

describe('reçete ile stok geçmişi tutarlılığı', () => {
  it('ver → geri al → ver döngüsünde stok ve satır aynı kalır', async () => {
    const r = await receteYaz([satir(ilac.id, 3, 'Parol')]);
    await satirVer(depo, r.id, 0, 2);
    await satirGeriAl(depo, r.id, 0);
    const y = await satirVer(depo, r.id, 0);

    expect(y.satirlar[0].verilenAdet).toBe(3);
    expect((await depo.al('ilaclar', ilac.id)).stok).toBe(7);

    // Hareketlerin toplamı stoğun düştüğü kadarını açıklamalı.
    const hareketler = await ilacHareketleri(depo, ilac.id);
    const toplam = hareketler.reduce((t, h) => t + h.adet, 0);
    expect(toplam).toBe(-3);
  });
});
