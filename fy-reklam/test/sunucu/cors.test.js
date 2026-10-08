// CORS: izinli köken ön-uçuşu geçer, yabancı köken ACAO almaz, localhost
// yalnız geliştirmede, /g/ yolu kökensiz çalışır.
import { describe, it, expect } from 'vitest';
import { kur, KOKEN } from './yardim.js';

describe('CORS', () => {
  it('izinli kökenin ön-uçuşu 204 + ACAO, Allow-Headers Authorization ve Content-Type', async () => {
    const k = kur();
    const r = await k.iste('giris', { method: 'OPTIONS', basliklar: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' } });
    expect(r.status).toBe(204);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(KOKEN);
    expect(r.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(r.headers.get('Access-Control-Allow-Headers')).toMatch(/Authorization/);
    expect(r.headers.get('Access-Control-Allow-Headers')).toMatch(/Content-Type/);
    expect(r.headers.get('Vary')).toBe('Origin');
  });

  it('ikinci izinli köken de geçer (virgüllü liste)', async () => {
    const k = kur({ IZINLI_KOKENLER: `${KOKEN}, https://ferhat-yasinoglu.github.io` });
    const r = await k.iste('durum', { koken: 'https://ferhat-yasinoglu.github.io' });
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://ferhat-yasinoglu.github.io');
  });

  it('yabancı köken yanıt alır ama ACAO almaz (hata yanıtında da)', async () => {
    const k = kur();
    const r = await k.iste('durum', { koken: 'https://kotu.example' });
    expect(r.status).toBe(200);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const h = await k.iste('kanallar', { koken: 'https://kotu.example' });
    expect(h.status).toBe(401);
    expect(h.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(h.headers.get('Cache-Control')).toBe('no-store');
    // Alt alan ya da http ile tam eşleşme yok.
    expect((await k.iste('durum', { koken: 'https://fy-reklam.pages.dev.kotu.example' })).headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect((await k.iste('durum', { koken: 'http://fy-reklam.pages.dev' })).headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('localhost yalnız GELISTIRME=1 iken izinli', async () => {
    const yayin = kur();
    expect((await yayin.iste('durum', { koken: 'http://localhost:8796' })).headers.get('Access-Control-Allow-Origin')).toBeNull();
    const gel = kur({ GELISTIRME: '1' });
    expect((await gel.iste('durum', { koken: 'http://localhost:8796' })).headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8796');
    expect((await gel.iste('durum', { koken: 'http://127.0.0.1:8796' })).headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:8796');
    expect((await gel.iste('durum', { koken: 'http://localhost.kotu.example' })).headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('/g/ yolu kökensiz (Origin başlığı yok) çalışır; yabancı kökenle de görsel döner', async () => {
    const k = kur();
    const j = await k.gir();
    const [id] = await k.gorseller(j);
    const r = await k.iste(`/g/${id}.jpg`, { koken: null });
    expect(r.status).toBe(200);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect((await k.iste(`/g/${id}.jpg`, { koken: 'https://meta.example' })).status).toBe(200);
  });

  it('bilinmeyen yolun ön-uçuşu 404', async () => {
    const k = kur();
    expect((await k.iste('/baska', { method: 'OPTIONS' })).status).toBe(404);
  });
});
