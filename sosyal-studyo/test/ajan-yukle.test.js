// tools/ajan-yukle.mjs: istek kurulumu (sahte fetch ile) ve gerçek Worker koduna karşı uçtan uca yükleme.
import { describe, it, expect } from 'vitest';
import { istemci, brifingYaz, rakipleriPasifYap, telegramCanli, yolDenetimi, ornekleriSor, calistir, ajanDosyasiOku, ajanHazirla, yaziTuru } from '../tools/ajan-yukle.mjs';
import worker from '../worker/src/index.js';
import { Veritabani } from '../worker/src/db.js';
import { olayIsle } from '../worker/src/motor.js';
import { ortam } from '../worker/test/sahte-d1.js';

const ANAHTAR = 'k'.repeat(40);
const URL_ = 'https://sosyal-studyo.ornek.workers.dev';

/** Kayıt tutan sahte fetch: yol → yanıt tablosu (veri ya da {_http, govde}); tanımsız yol 404 döner. */
function kayitci(tablo = {}) {
  const cagrilar = [];
  const f = async (url, init = {}) => {
    const u = new URL(url);
    const yol = u.pathname + u.search;
    const cagri = { url: String(url), yol, method: init.method || 'GET', basliklar: { ...(init.headers || {}) }, govde: init.body ? JSON.parse(init.body) : undefined };
    cagrilar.push(cagri);
    const h = tablo[`${cagri.method} ${yol}`] ?? tablo[`${cagri.method} ${u.pathname}`];
    if (h === undefined) return new Response(JSON.stringify({ ok: false, hata: 'yok', mesaj: 'kayıt yok' }), { status: 404 });
    const r = typeof h === 'function' ? h(cagri) : h;
    return new Response(JSON.stringify(r._http ? r.govde : { ok: true, veri: r }), { status: r._http || 200 });
  };
  f.cagrilar = cagrilar;
  return f;
}

const brifing = { id: 'brif_shafa', ad: 'Shafa', kanallar: ['telegram'], kimlik: 'kimlik', aktif: 1, bilgi_tabani: [{ baslik: 'a', metin: 'b', aktif: 1 }] };

describe('ajan-yukle: istek kurulumu', () => {
  it('her istek Bearer anahtar, X-SS-Sema: 1 ve JSON başlığı taşır; sondaki / atılır', async () => {
    const f = kayitci({ 'GET /api/durum': { tamam: 1 } });
    const { api } = istemci({ url: URL_ + '/', anahtar: ANAHTAR, fetchFn: f });
    expect(await api('/api/durum')).toEqual({ tamam: 1 });
    expect(f.cagrilar[0].url).toBe(URL_ + '/api/durum');
    expect(f.cagrilar[0].basliklar).toEqual({ Authorization: 'Bearer ' + ANAHTAR, 'X-SS-Sema': '1', 'Content-Type': 'application/json' });
    expect(f.cagrilar[0].govde).toBeUndefined();
  });

  it('{ok:false} yanıtı HTTP durumuyla hataya döner', async () => {
    const { api } = istemci({ url: URL_, anahtar: ANAHTAR, fetchFn: kayitci() });
    await expect(api('/api/k/ai_brifingler/x')).rejects.toMatchObject({ durum: 404, message: 'kayıt yok' });
  });

  it('yeni brifing: GET 404 → If-Match olmadan PUT; gövdede rev/degisiklik_no yok', async () => {
    const f = kayitci({ 'PUT /api/k/ai_brifingler/brif_shafa': (c) => ({ ...c.govde, rev: 1 }) });
    const { api } = istemci({ url: URL_, anahtar: ANAHTAR, fetchFn: f });
    const r = await brifingYaz(api, brifing);
    expect(r.yeni).toBe(true);
    const put = f.cagrilar.find((c) => c.method === 'PUT');
    expect(put.yol).toBe('/api/k/ai_brifingler/brif_shafa');
    expect(put.basliklar['If-Match']).toBeUndefined();
    expect(put.govde).toMatchObject({ id: 'brif_shafa', aktif: 1, kanallar: ['telegram'] });
    expect(put.govde).not.toHaveProperty('rev');
  });

  it('var olan brifing: rev ile If-Match gönderir (idempotent güncelleme)', async () => {
    const f = kayitci({
      'GET /api/k/ai_brifingler/brif_shafa': { ...brifing, rev: 7 },
      'PUT /api/k/ai_brifingler/brif_shafa': (c) => ({ ...c.govde, rev: 8 }),
    });
    const { api } = istemci({ url: URL_, anahtar: ANAHTAR, fetchFn: f });
    const r = await brifingYaz(api, brifing);
    expect(r).toMatchObject({ yeni: false, kayit: { rev: 8 } });
    expect(f.cagrilar.find((c) => c.method === 'PUT').basliklar['If-Match']).toBe('7');
  });

  it('aynı kanalı isteyen rakip brifing pasife alınır; genel brifinge dokunulmaz', async () => {
    const f = kayitci({
      'GET /api/k/ai_brifingler?limit=200': { kayitlar: [
        { id: 'brif_fy', ad: 'FY', aktif: 1, rev: 2 },
        { id: 'brif_eski_tg', ad: 'eski', aktif: 1, kanallar: ['telegram'], rev: 4 },
        { id: 'brif_ig', ad: 'ig', aktif: 1, kanallar: ['instagram'], rev: 1 },
        { id: 'brif_silik', aktif: 1, kanallar: ['telegram'], silindi: 1, rev: 9 },
        { ...brifing, rev: 3 },
      ] },
      'PUT /api/k/ai_brifingler/brif_eski_tg': (c) => ({ ...c.govde, rev: 5 }),
    });
    const { api } = istemci({ url: URL_, anahtar: ANAHTAR, fetchFn: f });
    const r = await rakipleriPasifYap(api, brifing);
    expect(r.pasif.map((b) => b.id)).toEqual(['brif_eski_tg']);
    expect(r.genel.map((b) => b.id)).toEqual(['brif_fy']);
    const puts = f.cagrilar.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0].govde).toMatchObject({ id: 'brif_eski_tg', aktif: 0 });
    expect(puts[0].basliklar['If-Match']).toBe('4');
  });

  it('telegram hesabı: yalnız canlı değilse durum isteği gider', async () => {
    const f = kayitci({
      'GET /api/k/hesaplar?limit=200': { kayitlar: [{ id: 'hes_tg', kanal: 'telegram', ad: '@rabatshafa_bot', durum: 'prova' }, { id: 'hes_ig', kanal: 'instagram', durum: 'prova' }] },
      'POST /api/kanal/hesap/durum': (c) => ({ id: c.govde.hesap_id, durum: c.govde.durum }),
    });
    const { api } = istemci({ url: URL_, anahtar: ANAHTAR, fetchFn: f });
    const r = await telegramCanli(api);
    expect(r.canliyaAlinan).toEqual(['hes_tg']);
    const post = f.cagrilar.filter((c) => c.method === 'POST');
    expect(post).toHaveLength(1);
    expect(post[0].govde).toEqual({ hesap_id: 'hes_tg', durum: 'canli' });

    const f2 = kayitci({ 'GET /api/k/hesaplar?limit=200': { kayitlar: [{ id: 'hes_tg', kanal: 'telegram', durum: 'canli' }] } });
    const r2 = await telegramCanli(istemci({ url: URL_, anahtar: ANAHTAR, fetchFn: f2 }).api);
    expect(r2.zatenCanli).toEqual(['hes_tg']);
    expect(f2.cagrilar.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('telegram hesabı yoksa webhook kurulumu çağrılır ve dönen hesap canlıya alınır', async () => {
    const f = kayitci({
      'GET /api/k/hesaplar?limit=200': { kayitlar: [] },
      'POST /api/kanal/telegram/kur': { bot: { username: 'rabatshafa_bot' }, hesap: { id: 'hes_yeni', kanal: 'telegram', ad: '@rabatshafa_bot', durum: 'prova' } },
      'POST /api/kanal/hesap/durum': { id: 'hes_yeni', durum: 'canli' },
    });
    const r = await telegramCanli(istemci({ url: URL_, anahtar: ANAHTAR, fetchFn: f }).api);
    expect(r).toMatchObject({ kuruldu: true, canliyaAlinan: ['hes_yeni'] });
    expect(f.cagrilar.map((c) => `${c.method} ${c.yol}`)).toEqual(['GET /api/k/hesaplar?limit=200', 'POST /api/kanal/telegram/kur', 'POST /api/kanal/hesap/durum']);
  });

  it('yol denetimi /api/prova\'ya telegram DM olayı gönderir ve seçilen brifingi karşılaştırır', async () => {
    const f = kayitci({ 'POST /api/prova': { karar: 'ai', cevapVar: true, brifing: 'brif_shafa' } });
    const { api } = istemci({ url: URL_, anahtar: ANAHTAR, fetchFn: f });
    expect((await yolDenetimi(api, { brifingId: 'brif_shafa', hesapId: 'hes_tg', soru: 'سلام' })).durum).toBe('ok');
    expect(f.cagrilar[0].govde).toEqual({ olay: { kanal: 'telegram', hesap_id: 'hes_tg', dis_id: 'shafa_yukleyici', tip: 'dm', text: 'سلام' } });
    const f2 = kayitci({ 'POST /api/prova': { karar: 'akis', kosu: 'kosu_1' } });
    expect((await yolDenetimi(istemci({ url: URL_, anahtar: ANAHTAR, fetchFn: f2 }).api, { brifingId: 'brif_shafa', soru: 'x' })).durum).toBe('hata');
  });

  it('örnek sorular ajan_cevap\'a brifing_id ve deneme ile gider; tıbbi soruda doz yazılırsa uyarır', async () => {
    const f = kayitci({ 'POST /api/ai/ajan_cevap': (c) => ({ cevap: c.govde.mesaj.includes('پاراستامول') ? '۲۵۰ ملی‌گرام بدهید' : c.govde.mesaj === 'free?' ? null : 'بلی' }) });
    const { api } = istemci({ url: URL_, anahtar: ANAHTAR, fetchFn: f });
    const r = await ornekleriSor(api, 'brif_shafa', [{ soru: 'چاپ؟', tur: 'normal' }, { soru: 'free?', tur: 'normal' }, { soru: 'پاراستامول چند؟', tur: 'tibbi' }]);
    expect(f.cagrilar.map((c) => c.govde)).toEqual([
      { brifing_id: 'brif_shafa', mesaj: 'چاپ؟', deneme: true },
      { brifing_id: 'brif_shafa', mesaj: 'free?', deneme: true },
      { brifing_id: 'brif_shafa', mesaj: 'پاراستامول چند؟', deneme: true },
    ]);
    expect(r[0]).toMatchObject({ cevap: 'بلی', uyarilar: [] });
    expect(r[1].cevap).toBeNull();
    expect(r[2].uyarilar).toContain('tıbbi soruya doz/miktar yazdı');
  });

  it('yazı türü: İngilizce cevaptaki Dari düğme adı dil uyarısı üretmez', () => {
    expect(yaziTuru('Go to Settings «دانلود پشتیبان» and download the file')).toBe('latin');
    expect(yaziTuru('از تنظیمات «دانلود پشتیبان» را بزنید')).toBe('dari');
  });

  it('calistir: ortam eksikse hata; anahtar hiçbir çıktıda ve özette görünmez', async () => {
    expect((await calistir({ env: {}, fetchFn: kayitci(), yaz: () => {} })).hata).toBe(1);

    const f = kayitci({
      'GET /health': { _http: 200, govde: { ok: true, prova: false, saglayici: 'anthropic', surum: 'abc1234' } },
      'GET /api/k/ai_brifingler/brif_shafa': { _http: 404, govde: { ok: false, hata: 'yok', mesaj: 'kayıt yok' } },
      'PUT /api/k/ai_brifingler/brif_shafa': (c) => ({ ...c.govde, rev: 1 }),
      'GET /api/k/ai_brifingler?limit=200': { kayitlar: [{ ...brifing, rev: 1 }] },
      'GET /api/k/hesaplar?limit=200': { kayitlar: [{ id: 'hes_tg', kanal: 'telegram', ad: '@rabatshafa_bot', durum: 'canli' }] },
      // Sunucu hata metninde anahtarı yansıtsa bile çıktıya maskeli düşmeli.
      'GET /api/k/akislar?limit=500': (c) => ({ _http: 500, govde: { ok: false, hata: 'sunucu', mesaj: 'beklenmeyen ' + c.basliklar.Authorization } }),
      'GET /api/k/tetikleyiciler?limit=500': { kayitlar: [] },
      'POST /api/prova': { karar: 'ai', cevapVar: true, brifing: 'brif_shafa' },
      'POST /api/ai/ajan_cevap': (c) => ({ cevap: 'جواب: ' + c.govde.mesaj }),
    });
    const satirlar = [];
    const { hata, ozet, rapor } = await calistir({ env: { WORKER_URL: URL_, YONETICI_ANAHTARI: ANAHTAR }, fetchFn: f, yaz: (s) => satirlar.push(s) });
    expect(hata).toBe(0);
    expect(rapor.yol.durum).toBe('ok');
    expect(rapor.ornekler.length).toBeGreaterThanOrEqual(4);
    const hepsi = satirlar.join('\n') + ozet;
    expect(hepsi).not.toContain(ANAHTAR);
    expect(satirlar.some((x) => x.includes('akışlar okunamadı') && x.includes('Bearer ***'))).toBe(true);
    expect(ozet).toContain('## AI ajanı');
    expect(ozet).toContain('brif_shafa');
    expect(ozet).toContain('> جواب: ');
    // Gerçek dosya yüklendi: başlıklar dosyadaki brifingden geliyor.
    const put = f.cagrilar.find((c) => c.method === 'PUT');
    expect(put.govde.kimlik).toContain('<skip>');
    expect(put.govde.bilgi_tabani.length).toBe(ajanDosyasiOku().brifing.bilgi_tabani.length);
  });
});

/** Gerçek Worker kodu (index.js → api.js → motor.js), D1 taklidi ve sahte Workers AI ile. */
function gercekWorker(envEk = {}) {
  const cagrilar = [];
  const env = ortam({ PROVA: '0', AI: { run: async (_model, { messages }) => { cagrilar.push(messages); return { response: 'جواب آزمایشی شفا' }; } }, ...envEk });
  const fetchFn = async (url, init = {}) => worker.fetch(new Request(url, init), env, { waitUntil: () => {} });
  return { env, fetchFn, db: new Veritabani(env.DB), modelCagrilari: cagrilar };
}

describe('ajan-yukle: gerçek Worker koduna karşı', () => {
  it('Shafa brifingini yazar, genel brifinge dokunmaz, telegramı canlı yapar; ikinci koşu aynı kaydı günceller', async () => {
    const w = gercekWorker();
    await w.db.kaydet('ai_brifingler', { id: 'brif_fy_ajans', ad: 'FY Ajans', kimlik: 'fy', bilgi_tabani: [], aktif: 1 }, { onek: 'brif' });
    await w.db.kaydet('hesaplar', { kanal: 'telegram', ad: '@rabatshafa_bot', dis_id: 'rabatshafa_bot', durum: 'prova' }, { onek: 'hes' });
    await w.db.kaydet('hesaplar', { kanal: 'instagram', ad: 'ig', dis_id: 'ig1', durum: 'canli' }, { onek: 'hes' });
    const env = { WORKER_URL: 'https://w.example', YONETICI_ANAHTARI: w.env.YONETICI_ANAHTARI };

    const r1 = await calistir({ env, fetchFn: w.fetchFn, yaz: () => {} });
    expect(r1.rapor.hatalar).toEqual([]);
    expect(r1.hata).toBe(0);
    expect(r1.rapor.yol.durum).toBe('ok');
    expect(r1.rapor.ornekler.every((o) => o.cevap === 'جواب آزمایشی شفا')).toBe(true);

    const shafa = await w.db.al('ai_brifingler', 'brif_shafa');
    expect(shafa).toMatchObject({ aktif: 1, kanallar: ['telegram'], maxKarakter: 600, rev: 1 });
    expect(shafa.kimlik.split('\n').length).toBeGreaterThan(5);
    expect((await w.db.al('ai_brifingler', 'brif_fy_ajans')).aktif).toBe(1);
    const tg = (await w.db.listele('hesaplar')).find((h) => h.kanal === 'telegram');
    expect(tg.durum).toBe('canli');

    const r2 = await calistir({ env, fetchFn: w.fetchFn, yaz: () => {} });
    expect(r2.hata).toBe(0);
    expect(r2.rapor.yeni).toBe(false);
    expect((await w.db.al('ai_brifingler', 'brif_shafa')).rev).toBe(2);
    expect((await w.db.listele('ai_brifingler')).filter((b) => b.ad === shafa.ad)).toHaveLength(1);

    // Motor: Telegram DM → Shafa, Instagram DM → genel brifing (FY Ajans).
    const simdi = new Date().toISOString();
    const t = await olayIsle({ ...w.env, PROVA: '1' }, w.db, { kaynak: 'telegram', kanal: 'telegram', dis_id: '77', ad: 'Dr', olay_id: 'tg:9001', tip: 'dm', text: 'نسخه را چطور چاپ کنم؟', dil: 'en', zaman: simdi });
    expect(t).toMatchObject({ karar: 'ai', brifing: 'brif_shafa' });
    const i = await olayIsle({ ...w.env, PROVA: '1' }, w.db, { kaynak: 'instagram', kanal: 'instagram', dis_id: 'ig77', ad: 'M', olay_id: 'ig:9001', tip: 'dm', text: 'Merhaba, web sitesi yapıyor musunuz?', zaman: simdi });
    expect(i).toMatchObject({ karar: 'ai', brifing: 'brif_fy_ajans' });
    // Arayüzü İngilizce olan hekim Dari yazdı: cevap dili Farsça (Dari) istenir.
    const sistem = w.modelCagrilari.at(-2)[0].content;
    expect(sistem).toMatch(/^CEVAP DİLİ: Farsça/);
  });

  it('yönetici anahtarı yanlışsa hiçbir şey yazılmaz ve hata döner', async () => {
    const w = gercekWorker();
    const r = await calistir({ env: { WORKER_URL: 'https://w.example', YONETICI_ANAHTARI: 'y'.repeat(40) }, fetchFn: w.fetchFn, yaz: () => {} });
    expect(r.hata).toBe(1);
    expect(r.rapor.hatalar[0]).toMatch(/brifing yazılamadı/);
    expect(await w.db.al('ai_brifingler', 'brif_shafa')).toBeNull();
  });

  it('ajanHazirla: bozuk dosyayı reddeder', () => {
    expect(() => ajanHazirla({})).toThrow(/brifing.id/);
    expect(() => ajanHazirla({ brifing: { id: 'x', kimlik: 'k', bilgi_tabani: [] } })).toThrow(/bilgi_tabani/);
    expect(() => ajanHazirla({ brifing: { id: 'x', kimlik: 'k', bilgi_tabani: [{ baslik: 'a', metin: 'b'.repeat(33000) }] } })).toThrow(/sınır/);
  });
});
