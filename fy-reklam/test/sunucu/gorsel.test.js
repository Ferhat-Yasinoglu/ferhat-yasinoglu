// JPEG barındırma: yükleme (tür, boyut, oturum), herkese açık /g/<id>.jpg,
// önbellek başlıkları, yedi günlük ömür.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { kur, KOK, jpeg, PNG } from './yardim.js';
import { AYAR } from '../../sunucu/cekirdek.js';

describe('POST /v1/gorsel', () => {
  it('JPEG yükle → 16 hex id ve bu kökende adres; GET /g/:id.jpg aynı baytları image/jpeg + uzun önbellekle verir', async () => {
    const k = kur();
    const j = await k.gir();
    const baytlar = jpeg(5000);
    const y = await k.gorselYukle(j, baytlar);
    expect(y.durum).toBe(200);
    expect(y.veri.id).toMatch(/^[a-f0-9]{16}$/);
    expect(y.veri.adres).toBe(`${KOK}/g/${y.veri.id}.jpg`);
    const r = await k.iste(`/g/${y.veri.id}.jpg`, { koken: null });
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toBe('image/jpeg');
    expect(r.headers.get('Cache-Control')).toBe('public, max-age=604800, immutable');
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(baytlar);
    expect(k.sql('SELECT kim, boyut FROM gorseller')).toEqual([{ kim: 'sahip@fy.af', boyut: 5000 }]);
  });

  it('PNG gövde → 415 gorsel_turu (Content-Type image/jpeg dese bile); başka Content-Type de 415', async () => {
    const k = kur();
    const j = await k.gir();
    expect(await k.gorselYukle(j, PNG)).toMatchObject({ durum: 415, veri: { hata: 'gorsel_turu' } });
    expect(await k.gorselYukle(j, jpeg(), 'image/png')).toMatchObject({ durum: 415, veri: { hata: 'gorsel_turu' } });
    expect(k.sql('SELECT 1 FROM gorseller')).toHaveLength(0);
  });

  it('1,9 MB üstü → 413 gorsel_buyuk (Content-Length ile de, akış sayılarak da)', async () => {
    const k = kur();
    const j = await k.gir();
    expect(await k.gorselYukle(j, jpeg(AYAR.gorselSiniri + 1))).toMatchObject({ durum: 413, veri: { hata: 'gorsel_buyuk' } });
    // Content-Length yalan söylese de gövde sayılır.
    const r = await k.iste('gorsel', { method: 'POST', jeton: j, govde: jpeg(AYAR.gorselSiniri + 10), tur: 'image/jpeg', basliklar: { 'Content-Length': '100' } });
    expect(r.status).toBe(413);
    // Tam sınır geçer.
    expect((await k.gorselYukle(j, jpeg(AYAR.gorselSiniri))).durum).toBe(200);
  });

  it('jetonsuz yükleme 401 oturum', async () => {
    const k = kur();
    expect(await k.gorselYukle(undefined)).toMatchObject({ durum: 401, veri: { hata: 'oturum' } });
  });
});

describe('GET /g/:id.jpg', () => {
  it('bozuk ya da bilinmeyen id 404 yok; yalnız 16 küçük hex kabul', async () => {
    const k = kur();
    expect((await k.iste('/g/0123456789abcdef.jpg', { koken: null })).status).toBe(404);
    expect((await k.iste('/g/0123456789ABCDEF.jpg', { koken: null })).status).toBe(404);
    expect((await k.iste('/g/abc.jpg', { koken: null })).status).toBe(404);
    expect((await k.iste('/g/0123456789abcdef.png', { koken: null })).status).toBe(404);
    expect((await k.iste('/g/0123456789abcdef.jpg', { method: 'POST', koken: null, govde: {} })).status).toBe(404);
  });

  it('HEAD başlıkları gövdesiz verir', async () => {
    const k = kur();
    const j = await k.gir();
    const [id] = await k.gorseller(j);
    const r = await k.iste(`/g/${id}.jpg`, { method: 'HEAD', koken: null });
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toBe('image/jpeg');
    expect(r.headers.get('Content-Length')).toBe('1024');
  });
});

describe('yedi günlük ömür', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it('7 günden eski görseller sonraki yüklemede silinir; süresi geçen artık verilmez', async () => {
    vi.setSystemTime(new Date('2026-10-02T08:00:00Z'));
    const k = kur();
    const j = await k.gir();
    const [eski] = await k.gorseller(j);
    vi.setSystemTime(new Date('2026-10-08T08:00:00Z')); // 6 gün: duruyor
    expect((await k.iste(`/g/${eski}.jpg`, { koken: null })).status).toBe(200);
    vi.setSystemTime(new Date('2026-10-09T09:00:00Z')); // 7 gün + 1 saat: süresi geçti
    expect((await k.iste(`/g/${eski}.jpg`, { koken: null })).status).toBe(404);
    const [yeni] = await k.gorseller(j);
    expect(k.sql('SELECT id FROM gorseller').map((r) => r.id)).toEqual([yeni]);
  });
});
