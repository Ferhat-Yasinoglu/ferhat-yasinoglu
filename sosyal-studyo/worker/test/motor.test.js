import { beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index.js';
import { Veritabani } from '../src/db.js';
import { olayIsle, gecikenleriKostur } from '../src/motor.js';
import { ortam, sahteFetch } from './sahte-d1.js';
import { DEMO_AKIS, DEMO_TETIKLEYICILER } from '../../app/js/paylasilan/demo-veri.js';

const ctx = { waitUntil: (p) => { ctx.bekleyen.push(p); }, bekleyen: [] };
const bekle = async () => { await Promise.all(ctx.bekleyen); ctx.bekleyen = []; };

async function tohumla(env, { canli = false } = {}) {
  const db = new Veritabani(env.DB);
  const hesap = await db.kaydet('hesaplar', { kanal: 'telegram', ad: '@demo_bot', dis_id: 'demo_bot', durum: canli ? 'canli' : 'prova' }, { onek: 'hes' });
  await db.kaydet('akislar', DEMO_AKIS, { onek: 'akis' });
  for (const t of DEMO_TETIKLEYICILER) await db.kaydet('tetikleyiciler', { ...t, hesap_id: null }, { onek: 'tet' });
  return { db, hesap };
}
const tgIstek = (update, env, gizli = env.TELEGRAM_WEBHOOK_SECRET) => new Request('https://w.example/tg/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': gizli }, body: JSON.stringify(update) });
const mesaj = (id, text, chat = 42) => ({ update_id: id, message: { message_id: id, date: 1700000000, chat: { id: chat }, from: { id: chat, first_name: 'Ali', username: 'ali' }, text } });

describe('Telegram uçtan uca (canlı)', () => {
  let env, f, db;
  beforeEach(async () => { env = ortam({ PROVA: '0' }); f = sahteFetch(); ({ db } = await tohumla(env, { canli: true })); });

  it('"fiyat" akışı başlatır, butonlar gönderilir; buton → soru → cevap → bitiş; puan ve etiketler yazılır', async () => {
    const r1 = await olayIsle(env, db, { kaynak: 'telegram', kanal: 'telegram', dis_id: '42', ad: 'Ali', kullanici_adi: 'ali', olay_id: 'tg:1', tip: 'dm', text: 'Fiyat nedir?', zaman: new Date().toISOString() }, { fetchFn: f });
    expect(r1.karar).toBe('akis'); expect(r1.durum).toBe('waiting');
    const gonderilen = f.cagrilar.filter((c) => c.url.endsWith('/sendMessage'));
    expect(gonderilen).toHaveLength(2);
    expect(gonderilen[1].govde.reply_markup.inline_keyboard).toHaveLength(3);
    expect(gonderilen[1].govde.reply_markup.inline_keyboard[1][0].callback_data).toBe('s:4:1');
    const kisi = await db.kisiBul('', '42') || (await db.listele('kisiler'))[0];
    expect(kisi.ad).toBe('Ali');
    const r2 = await olayIsle(env, db, { kaynak: 'telegram', kanal: 'telegram', dis_id: '42', ad: 'Ali', olay_id: 'tg:cq:9', tip: 'buton', adim: 4, secenekIdx: 1, callback_id: '9', zaman: new Date().toISOString() }, { fetchFn: f });
    expect(r2.durum).toBe('waiting');
    expect(f.cagrilar.some((c) => c.url.endsWith('/answerCallbackQuery'))).toBe(true);
    await olayIsle(env, db, { kaynak: 'telegram', kanal: 'telegram', dis_id: '42', ad: 'Ali', olay_id: 'tg:3', tip: 'dm', text: '800 €', zaman: new Date().toISOString() }, { fetchFn: f });
    const r4 = await olayIsle(env, db, { kaynak: 'telegram', kanal: 'telegram', dis_id: '42', ad: 'Ali', olay_id: 'tg:4', tip: 'dm', text: 'Evet, teklif istiyorum', zaman: new Date().toISOString() }, { fetchFn: f });
    expect(r4.durum).toBe('finished');
    const k = (await db.listele('kisiler'))[0];
    expect(k.etiketler).toEqual(expect.arrayContaining(['ilgi-bot', 'lead-fiyat', 'teklif-istedi']));
    expect(k.puan).toBe(5);
    expect(k.degiskenler.butce).toBe('800 €');
    expect(await db.listele('puan_olaylari')).toHaveLength(1);
    expect((await db.listele('gunluk')).every((g) => g.prova === 0 && g.gonderildi === 1)).toBe(true);
    expect((await db.listele('mesajlar')).length).toBeGreaterThan(5);
  });

  it('aynı olay ikinci kez gelirse yutulur; cevap bekleyen koşu "fiyat" kelimesiyle raydan çıkmaz', async () => {
    const olay = { kaynak: 'telegram', kanal: 'telegram', dis_id: '7', ad: 'B', olay_id: 'tg:100', tip: 'dm', text: 'fiyat', zaman: new Date().toISOString() };
    await olayIsle(env, db, olay, { fetchFn: f });
    expect((await olayIsle(env, db, olay, { fetchFn: f })).atlandi).toBe('tekrar');
    await olayIsle(env, db, { ...olay, olay_id: 'tg:101', tip: 'buton', adim: 4, secenekIdx: 0 }, { fetchFn: f });
    const r = await olayIsle(env, db, { ...olay, olay_id: 'tg:102', text: 'fiyat 500' }, { fetchFn: f }); // soru bekliyor → cevap sayılır
    expect(r.karar).toBe('akis');
    const k = (await db.listele('kisiler'))[0];
    expect(k.degiskenler.butce).toBe('fiyat 500');
  });

  it('webhook: yanlış gizli 401; doğru gizli 200 ve olay işlenir', async () => {
    expect((await worker.fetch(tgIstek(mesaj(1, 'selam'), env, 'yanlis'), env, ctx)).status).toBe(401);
    const r = await worker.fetch(tgIstek(mesaj(2, 'fiyat?'), env), env, ctx);
    expect(r.status).toBe(200); await bekle();
    expect((await db.listele('kosular')).length).toBe(1);
  });
});

describe('PROVA modu', () => {
  it('hiçbir dış çağrı yapılmaz, günlük prova=1', async () => {
    const env = ortam({ PROVA: '1' }); const f = sahteFetch(); const { db } = await tohumla(env, { canli: true });
    const r = await olayIsle(env, db, { kaynak: 'telegram', kanal: 'telegram', dis_id: '1', ad: 'P', olay_id: 'tg:p1', tip: 'dm', text: 'fiyat', zaman: new Date().toISOString() }, { fetchFn: f });
    expect(r.karar).toBe('akis');
    expect(f.cagrilar.filter((c) => c.url.includes('sendMessage'))).toHaveLength(0);
    const g = await db.listele('gunluk'); expect(g[0].prova).toBe(1);
    expect((await db.listele('mesajlar')).find((m) => m.yon === 'giden').metin).toMatch(/\[prova\]/);
  });
});

describe('Instagram yorumları ve kural motoru', () => {
  it('yorum tetikleyicisi: açık yanıt + özel yanıt, koşu pencere bekler; tetikleyici yoksa kural motoru gizler', async () => {
    const env = ortam({ PROVA: '0' }); const f = sahteFetch(); const db = new Veritabani(env.DB);
    const hesap = await db.kaydet('hesaplar', { kanal: 'instagram', ad: 'ig', dis_id: '999', durum: 'canli' }, { onek: 'hes' });
    await db.kaydet('akislar', DEMO_AKIS, { onek: 'akis' });
    for (const t of DEMO_TETIKLEYICILER) await db.kaydet('tetikleyiciler', { ...t, hesap_id: null }, { onek: 'tet' });
    await db.kaydet('kurallar', { name: 'spam', pattern: '(bedava takipci|casino)', hide: true, sira: 0 }, { onek: 'kural' });
    const r = await olayIsle(env, db, { kaynak: 'instagram', kanal: 'instagram', hesap_id: hesap.id, dis_id: 'u1', ad: 'sara', kullanici_adi: 'sara', olay_id: 'ig:c:1', tip: 'comment', text: 'fiyat?', yorumId: 'c1', gonderiId: 'm1', zaman: new Date().toISOString() }, { fetchFn: f });
    expect(r.karar).toBe('akis');
    const yollar = f.cagrilar.map((c) => c.url);
    expect(yollar.some((u) => u.includes('/c1/replies'))).toBe(true);
    expect(f.cagrilar.some((c) => c.govde?.recipient?.comment_id === 'c1')).toBe(true);
    const kosu = (await db.listele('kosular'))[0]; expect(kosu.bekleme).toBe('window');
    const r2 = await olayIsle(env, db, { kaynak: 'instagram', kanal: 'instagram', hesap_id: hesap.id, dis_id: 'u2', ad: 'bot', kullanici_adi: 'bot', olay_id: 'ig:c:2', tip: 'comment', text: 'bedava takipçi kazan!', yorumId: 'c2', gonderiId: 'm1', zaman: new Date().toISOString() }, { fetchFn: f });
    expect(r2).toMatchObject({ karar: 'kural', tur: 'gizle' });
    expect(f.cagrilar.some((c) => c.url.includes('/c2?') && c.url.includes('hide=true'))).toBe(true);
  });

  it('Meta webhook: imzasız 401, imzalı 200; el sıkışma challenge döner', async () => {
    const env = ortam(); const ctx2 = { waitUntil: () => {} };
    const el = new Request('https://w.example/meta/webhook?hub.mode=subscribe&hub.verify_token=dogrula&hub.challenge=123', { method: 'GET' });
    expect(await (await worker.fetch(el, env, ctx2)).text()).toBe('123');
    const govde = JSON.stringify({ object: 'instagram', entry: [] });
    expect((await worker.fetch(new Request('https://w.example/meta/webhook', { method: 'POST', body: govde }), env, ctx2)).status).toBe(401);
    const anahtar = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.META_APP_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const imza = 'sha256=' + [...new Uint8Array(await crypto.subtle.sign('HMAC', anahtar, new TextEncoder().encode(govde)))].map((b) => b.toString(16).padStart(2, '0')).join('');
    expect((await worker.fetch(new Request('https://w.example/meta/webhook', { method: 'POST', headers: { 'X-Hub-Signature-256': imza }, body: govde }), env, ctx2)).status).toBe(200);
  });
});

describe('AI ajan ve gecikme', () => {
  it('tetikleyici yoksa aktif ajan cevaplar; <skip> ise cevapsız soruya düşer', async () => {
    const env = ortam({ PROVA: '0', ANTHROPIC_API_KEY: 'k' }); const db = new Veritabani(env.DB);
    await db.kaydet('hesaplar', { kanal: 'telegram', ad: 'b', dis_id: 'b', durum: 'canli' }, { onek: 'hes' });
    await db.kaydet('ai_brifingler', { ad: 'g', kimlik: 'asistan', bilgi_tabani: [{ baslik: 'saat', metin: '9-18', aktif: 1 }], aktif: 1, maxKarakter: 300, gunlukKredi: 10 }, { onek: 'brif' });
    const f = sahteFetch({ anthropicMetin: 'Saatlerimiz 9-18.' });
    const r = await olayIsle(env, db, { kaynak: 'telegram', kanal: 'telegram', dis_id: '5', ad: 'X', olay_id: 't:1', tip: 'dm', text: 'saat kaça kadar açıksınız?', zaman: new Date().toISOString() }, { fetchFn: f });
    expect(r).toMatchObject({ karar: 'ai', cevapVar: true });
    expect(f.cagrilar.find((c) => c.url.includes('sendMessage')).govde.text).toBe('Saatlerimiz 9-18.');
    const f2 = sahteFetch({ anthropicMetin: '<skip>' });
    const r2 = await olayIsle(env, db, { kaynak: 'telegram', kanal: 'telegram', dis_id: '5', ad: 'X', olay_id: 't:2', tip: 'dm', text: 'fil ne yer?', zaman: new Date().toISOString() }, { fetchFn: f2 });
    expect(r2.cevapVar).toBe(false);
    expect((await db.listele('cevapsiz_sorular'))[0].soru).toBe('fil ne yer?');
  });

  it('delay adımı cron ile devam eder', async () => {
    const env = ortam({ PROVA: '0' }); const f = sahteFetch(); const db = new Veritabani(env.DB);
    await db.kaydet('hesaplar', { kanal: 'telegram', ad: 'b', dis_id: 'b', durum: 'canli' }, { onek: 'hes' });
    const akis = await db.kaydet('akislar', { ad: 'g', durum: 'yayinda', adimlar: [{ type: 'message', text: 'bir' }, { type: 'delay', seconds: 1 }, { type: 'message', text: 'iki' }, { type: 'end' }] }, { onek: 'akis' });
    await db.kaydet('tetikleyiciler', { akis_id: akis.id, tip: 'any_message', aktif: 1 }, { onek: 'tet' });
    await olayIsle(env, db, { kaynak: 'telegram', kanal: 'telegram', dis_id: '8', ad: 'D', olay_id: 'd:1', tip: 'dm', text: 'hey', zaman: new Date().toISOString() }, { fetchFn: f });
    expect((await db.listele('kosular'))[0].bekleme).toBe('delay');
    expect(await gecikenleriKostur(env, db, { fetchFn: f })).toBe(0); // henüz zamanı gelmedi
    const k = (await db.listele('kosular'))[0]; await db.kaydet('kosular', { ...k, devam_zamani: new Date(Date.now() - 1000).toISOString() });
    expect(await gecikenleriKostur(env, db, { fetchFn: f })).toBe(1);
    expect(f.cagrilar.filter((c) => c.url.includes('sendMessage')).map((c) => c.govde.text)).toEqual(['bir', 'iki']);
    expect((await db.listele('kosular'))[0].durum).toBe('finished');
  });
});
