// Ortak kayıt: API'siz kanalların (indir, paylaş, kopyala, Business Suite)
// kaydı, kim alanı oturumdan, sınır ve sıralama.
import { describe, it, expect } from 'vitest';
import { kur, SAHIP, ARKADAS } from './yardim.js';

describe('POST /v1/kayit', () => {
  it('kaydı yazar: kim oturumun e-postası, durum yapildi, dis_id/hata null', async () => {
    const k = kur();
    const j = await k.gir(ARKADAS);
    const r = await k.jsonIste('kayit', { method: 'POST', jeton: j, govde: { urun: 'dawayar', kanal: 'indir', bicim: 'kare', baslik: 'Dawayar tanıtım' } });
    expect(r.durum).toBe(200);
    expect(r.veri.kayit).toMatchObject({ id: 1, kim: ARKADAS, urun: 'dawayar', kanal: 'indir', bicim: 'kare', durum: 'yapildi', baslik: 'Dawayar tanıtım', dis_id: null, hata: null });
    expect(typeof r.veri.kayit.zaman).toBe('number');
  });

  it('bicim ve baslik isteğe bağlı; başlık temizlenir ve kısaltılır', async () => {
    const k = kur();
    const j = await k.gir();
    const r = await k.jsonIste('kayit', { method: 'POST', jeton: j, govde: { urun: 'shafa', kanal: 'business_suite', baslik: ' a' + String.fromCharCode(0x202e) + 'b\tc ' + 'x'.repeat(300) } });
    expect(r.durum).toBe(200);
    expect(r.veri.kayit.bicim).toBe('');
    expect(r.veri.kayit.baslik.startsWith('a b c x')).toBe(true);
    expect(r.veri.kayit.baslik.length).toBe(200);
  });

  it('bilinmeyen kanal ya da bozuk ürün 400 gecersiz; facebook/instagram buradan yazılamaz', async () => {
    const k = kur();
    const j = await k.gir();
    expect(await k.jsonIste('kayit', { method: 'POST', jeton: j, govde: { urun: 'dawayar', kanal: 'telegram' } })).toMatchObject({ durum: 400, veri: { hata: 'gecersiz', alan: 'kanal' } });
    expect(await k.jsonIste('kayit', { method: 'POST', jeton: j, govde: { urun: 'dawayar', kanal: 'instagram' } })).toMatchObject({ durum: 400, veri: { hata: 'gecersiz', alan: 'kanal' } });
    expect(await k.jsonIste('kayit', { method: 'POST', jeton: j, govde: { urun: 'Büyük Ürün', kanal: 'indir' } })).toMatchObject({ durum: 400, veri: { hata: 'gecersiz', alan: 'urun' } });
    expect(await k.jsonIste('kayit', { method: 'POST', jeton: j, govde: { urun: 'dawayar', kanal: 'indir', baslik: 5 } })).toMatchObject({ durum: 400, veri: { hata: 'gecersiz', alan: 'baslik' } });
  });

  it('jetonsuz 401 oturum ve kayıt yazılmaz', async () => {
    const k = kur();
    expect(await k.jsonIste('kayit', { method: 'POST', govde: { urun: 'dawayar', kanal: 'indir' } })).toMatchObject({ durum: 401, veri: { hata: 'oturum' } });
    expect(k.sql('SELECT 1 FROM kayitlar')).toHaveLength(0);
  });
});

describe('GET /v1/kayit', () => {
  it('yeniden eskiye; iki yöneticinin kayıtları ortak', async () => {
    const k = kur();
    const a = await k.gir(SAHIP);
    const b = await k.gir(ARKADAS);
    for (const [j, kanal] of [[a, 'indir'], [b, 'paylas'], [a, 'kopyala']]) {
      expect((await k.jsonIste('kayit', { method: 'POST', jeton: j, govde: { urun: 'nuskha', kanal } })).durum).toBe(200);
    }
    const r = await k.jsonIste('kayit', { jeton: b });
    expect(r.durum).toBe(200);
    expect(r.veri.kayitlar.map((x) => [x.id, x.kim, x.kanal])).toEqual([[3, SAHIP, 'kopyala'], [2, ARKADAS, 'paylas'], [1, SAHIP, 'indir']]);
  });

  it('sinir uygulanır (varsayılan 100, en çok 500, bozuk değer varsayılan)', async () => {
    const k = kur();
    const j = await k.gir();
    for (let i = 0; i < 120; i++) k.cekirdek().kayitEkle(SAHIP, { urun: 'zamin', kanal: 'indir', bicim: '', baslik: String(i) });
    expect((await k.jsonIste('kayit', { jeton: j })).veri.kayitlar).toHaveLength(100);
    expect((await k.jsonIste('kayit?sinir=5', { jeton: j })).veri.kayitlar.map((x) => x.baslik)).toEqual(['119', '118', '117', '116', '115']);
    expect((await k.jsonIste('kayit?sinir=9999', { jeton: j })).veri.kayitlar).toHaveLength(120);
    expect((await k.jsonIste('kayit?sinir=abc', { jeton: j })).veri.kayitlar).toHaveLength(100);
    expect((await k.jsonIste('kayit?sinir=0', { jeton: j })).veri.kayitlar).toHaveLength(100);
  });

  it('jetonsuz 401', async () => {
    const k = kur();
    expect(await k.jsonIste('kayit')).toMatchObject({ durum: 401, veri: { hata: 'oturum' } });
  });
});
