import { describe, expect, it } from 'vitest';
import worker from '../src/index.js';
import { ortam, sahteFetch } from './sahte-d1.js';
import { Veritabani } from '../src/db.js';

const ctx = { waitUntil: () => {} };
const istek = (yol, { method = 'GET', anahtar, govde, basliklar = {} } = {}, env) => new Request('https://w.example' + yol, { method, headers: { Origin: 'https://ferhat-yasinoglu.github.io', 'X-SS-Sema': '1', ...(anahtar ? { Authorization: 'Bearer ' + anahtar } : {}), ...(govde ? { 'Content-Type': 'application/json' } : {}), ...basliklar }, body: govde ? JSON.stringify(govde) : undefined });

describe('/health ve fail-closed', () => {
  it('yapılandırma eksikse health 503 ve api 503', async () => {
    const env = ortam({ YONETICI_ANAHTARI: 'kisa' });
    const h = await worker.fetch(istek('/health'), env, ctx); expect(h.status).toBe(503); expect((await h.json()).eksik.join()).toMatch(/YONETICI/);
    expect((await worker.fetch(istek('/api/durum'), env, ctx)).status).toBe(503);
  });
  it('CORS ön kontrolü: /health ve /api için OPTIONS 204 ve X-SS-Sema başlığına izin', async () => {
    const env = ortam();
    const on = (yol) => new Request('https://w.test' + yol, { method: 'OPTIONS', headers: { Origin: 'https://ferhat-yasinoglu.github.io', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'x-ss-sema,authorization' } });
    for (const yol of ['/health', '/api/durum']) {
      const r = await worker.fetch(on(yol), env, ctx);
      expect(r.status).toBe(204);
      expect(r.headers.get('Access-Control-Allow-Headers')).toMatch(/X-SS-Sema/);
      expect(r.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    }
  });
  it('tam yapılandırmada health 200', async () => { const r = await worker.fetch(istek('/health'), ortam(), ctx); expect(r.status).toBe(200); expect((await r.json()).sema).toBe(1); });
});

describe('/api yetki, CORS, koleksiyonlar', () => {
  it('anahtarsız 401, 5 denemeden sonra 429; doğru anahtarla durum döner', async () => {
    const env = ortam();
    for (let i = 0; i < 5; i++) expect((await worker.fetch(istek('/api/durum'), env, ctx)).status).toBe(401);
    expect((await worker.fetch(istek('/api/durum'), env, ctx)).status).toBe(429);
    const r = await worker.fetch(istek('/api/durum', { anahtar: env.YONETICI_ANAHTARI }), env, ctx);
    expect(r.status).toBe(200); const j = await r.json(); expect(j.ok).toBe(true); expect(j.veri.doktor.length).toBeGreaterThan(3);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://ferhat-yasinoglu.github.io');
  });
  it('OPTIONS 204; yabancı origin ilk izinliye düşer (Origin kimlik değildir)', async () => {
    const env = ortam();
    const o = await worker.fetch(istek('/api/durum', { method: 'OPTIONS' }), env, ctx); expect(o.status).toBe(204);
    const r = await worker.fetch(istek('/api/durum', { anahtar: env.YONETICI_ANAHTARI, basliklar: { Origin: 'https://kotu.example' } }), env, ctx);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://ferhat-yasinoglu.github.io');
  });
  it('şema uyuşmazlığı 409', async () => { const env = ortam(); expect((await worker.fetch(istek('/api/durum', { anahtar: env.YONETICI_ANAHTARI, basliklar: { 'X-SS-Sema': '9' } }), env, ctx)).status).toBe(409); });
  it('PUT/GET/DELETE ve If-Match çakışması; yayında akış doğrulanır; salt okunur koleksiyon yazılamaz', async () => {
    const env = ortam(); const a = env.YONETICI_ANAHTARI;
    let r = await worker.fetch(istek('/api/k/akislar/akis_1', { method: 'PUT', anahtar: a, govde: { ad: 'x', durum: 'taslak', adimlar: [{ type: 'message', text: 'hi' }] } }), env, ctx);
    expect(r.status).toBe(200); expect(r.headers.get('ETag')).toBe('1');
    r = await worker.fetch(istek('/api/k/akislar/akis_1', { method: 'PUT', anahtar: a, govde: { ad: 'y', durum: 'taslak', adimlar: [] }, basliklar: { 'If-Match': '5' } }), env, ctx); expect(r.status).toBe(409);
    r = await worker.fetch(istek('/api/k/akislar/akis_1', { method: 'PUT', anahtar: a, govde: { ad: 'y', durum: 'yayinda', adimlar: [{ type: 'goto', goto: 9 }] } }), env, ctx); expect(r.status).toBe(422);
    r = await worker.fetch(istek('/api/k/akislar?since=0', { anahtar: a }), env, ctx); const j = await r.json(); expect(j.veri.kayitlar).toHaveLength(1); expect(j.veri.son_no).toBeGreaterThan(0);
    r = await worker.fetch(istek('/api/k/gunluk/x', { method: 'PUT', anahtar: a, govde: {} }), env, ctx); expect(r.status).toBe(403);
    r = await worker.fetch(istek('/api/k/akislar/akis_1', { method: 'DELETE', anahtar: a }), env, ctx); expect((await r.json()).veri.silindi).toBe(true);
    r = await worker.fetch(istek('/api/k/gizli/x', { anahtar: a }), env, ctx); expect(r.status).toBe(404);
  });
  it('komut idempotent: aynı komut_id ikinci kez uygulanmaz', async () => {
    const env = ortam(); const a = env.YONETICI_ANAHTARI;
    await worker.fetch(istek('/api/k/kisiler/kisi_1', { method: 'PUT', anahtar: a, govde: { ad: 'A', hesap_id: 'h', dis_id: '1', kanal: 'telegram', puan: 0, etiketler: [] } }), env, ctx);
    await worker.fetch(istek('/api/komut', { method: 'POST', anahtar: a, govde: { ad: 'puan_ekle', yuk: { kisi_id: 'kisi_1', delta: 5 }, komut_id: 'k1' } }), env, ctx);
    const r = await worker.fetch(istek('/api/komut', { method: 'POST', anahtar: a, govde: { ad: 'puan_ekle', yuk: { kisi_id: 'kisi_1', delta: 5 }, komut_id: 'k1' } }), env, ctx);
    expect((await r.json()).veri.tekrar).toBe(true);
    const k = await (await worker.fetch(istek('/api/k/kisiler/kisi_1', { anahtar: a }), env, ctx)).json(); expect(k.veri.puan).toBe(5);
  });
  it('yedek belgesi gizli içermez ve doğrulanır; ice-aktar çalışır', async () => {
    const env = ortam(); const a = env.YONETICI_ANAHTARI;
    await worker.fetch(istek('/api/k/akislar/akis_2', { method: 'PUT', anahtar: a, govde: { ad: 'z', durum: 'taslak', adimlar: [] } }), env, ctx);
    const y = await (await worker.fetch(istek('/api/yedek', { anahtar: a }), env, ctx)).json();
    expect(y.veri.format).toBe('sosyal-studyo/yedek'); expect(y.veri.sayim.akislar).toBe(1); expect(y.veri.koleksiyonlar.gizli).toBeUndefined();
    const env2 = ortam();
    const r = await worker.fetch(istek('/api/ice-aktar', { method: 'POST', anahtar: a, govde: y.veri }), env2, ctx);
    expect((await r.json()).veri.rapor.akislar).toBe(1);
  });
  it('AI özelliği Anthropic ile JSON döner; sağlayıcı yoksa hata', async () => {
    const env = ortam({ ANTHROPIC_API_KEY: 'k' }); const a = env.YONETICI_ANAHTARI;
    const f = sahteFetch({ anthropicMetin: '{"kancalar":["a","b"]}' });
    const { apiIsle } = await import('../src/api.js'); const { Veritabani } = await import('../src/db.js');
    const r = await apiIsle(env, new Veritabani(env.DB), istek('/api/ai/kanca_oner', { method: 'POST', anahtar: a, govde: { konu: 'x' } }), new URL('https://w.example/api/ai/kanca_oner'), { fetchFn: f });
    expect((await r.json()).veri.kancalar).toEqual(['a', 'b']);
    const env2 = ortam(); const r2 = await apiIsle(env2, new Veritabani(env2.DB), istek('/api/ai/kanca_oner', { method: 'POST', anahtar: a, govde: { konu: 'x' } }), new URL('https://w.example/api/ai/kanca_oner'), { fetchFn: f });
    expect((await r2.json()).ok).toBe(false);
  });
  it('telegram/kur getMe + setWebhook çağırır ve hesabı prova yazar', async () => {
    const env = ortam(); const a = env.YONETICI_ANAHTARI; const f = sahteFetch();
    const { apiIsle } = await import('../src/api.js'); const { Veritabani } = await import('../src/db.js'); const db = new Veritabani(env.DB);
    const r = await apiIsle(env, db, istek('/api/kanal/telegram/kur', { method: 'POST', anahtar: a }), new URL('https://w.example/api/kanal/telegram/kur'), { fetchFn: f });
    const j = await r.json(); expect(j.veri.bot.username).toBe('demo_bot');
    expect(f.cagrilar.find((c) => c.url.endsWith('/setWebhook')).govde).toMatchObject({ url: 'https://w.example/tg/webhook', secret_token: 'gizli-token' });
    expect((await db.listele('hesaplar'))[0]).toMatchObject({ kanal: 'telegram', durum: 'prova', dis_id: 'demo_bot' });
  });
});

describe('webhook nöbeti ve hesap tekilleştirme', () => {
  it('cron: webhook silinmişse yeniden kurar, kuruluysa dokunmaz', async () => {
    const env = ortam();
    const db = new Veritabani(env.DB);
    await db.metaKaydet('worker_url', 'https://w.example');

    const silinmis = sahteFetch({ webhookUrl: '', bekleyen: 3 });
    globalThis.fetch = silinmis;
    await worker.scheduled({}, env, ctx);
    expect(silinmis.cagrilar.some((c) => c.url.endsWith('/setWebhook'))).toBe(true);
    expect(String(await db.metaAl('son_cron'))).toMatch(/yeniden kuruldu/);

    const kurulu = sahteFetch({ webhookUrl: 'https://w.example/tg/webhook' });
    globalThis.fetch = kurulu;
    await worker.scheduled({}, env, ctx);
    expect(kurulu.cagrilar.some((c) => c.url.endsWith('/setWebhook'))).toBe(false);
  });

  it('telegram kurulumu aynı kanaldaki fazla hesapları tekilleştirir, canlı olanı korur', async () => {
    const env = ortam();
    const db = new Veritabani(env.DB);
    await db.kaydet('hesaplar', { kanal: 'telegram', ad: 'eski1', durum: 'prova' }, { onek: 'hes' });
    const canli = await db.kaydet('hesaplar', { kanal: 'telegram', ad: 'eski2', durum: 'canli' }, { onek: 'hes' });
    await db.kaydet('hesaplar', { kanal: 'telegram', ad: 'eski3', durum: 'prova' }, { onek: 'hes' });

    globalThis.fetch = sahteFetch({ webhookUrl: '' });
    const r = await worker.fetch(new Request('https://w.test/api/kanal/telegram/kur', { method: 'POST', headers: { Authorization: 'Bearer ' + env.YONETICI_ANAHTARI, 'X-SS-Sema': '1', 'Content-Type': 'application/json' }, body: '{}' }), env, ctx);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.veri.tekillestirilen).toBe(2);

    const kalan = (await db.listele('hesaplar')).filter((h) => h.kanal === 'telegram' && !h.silindi);
    expect(kalan).toHaveLength(1);
    expect(kalan[0].id).toBe(canli.id);
    expect(kalan[0].durum).toBe('canli');
  });
});
