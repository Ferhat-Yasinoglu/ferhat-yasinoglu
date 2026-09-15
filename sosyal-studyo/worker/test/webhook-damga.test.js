// Kurulum hatalarının en pahalı kör noktası: imza reddi 401 dönüp hiçbir iz bırakmıyordu.
// "Instagram'dan mesaj gelmiyor" dendiğinde "Meta hiç uğramadı" ile "uğradı ama
// META_APP_SECRET eşleşmedi" ayırt edilemiyor, ikisi de bambaşka iş gerektiriyor.
import { describe, expect, it } from 'vitest';
import worker from '../src/index.js';
import { ortam } from './sahte-d1.js';
import { Veritabani } from '../src/db.js';

const ctx = { waitUntil: (p) => p };
const GIZLI = 'app-secret-abc';

async function imzala(gizli, ham) {
  const enc = new TextEncoder();
  const anahtar = await crypto.subtle.importKey('raw', enc.encode(gizli), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const imza = await crypto.subtle.sign('HMAC', anahtar, enc.encode(ham));
  return 'sha256=' + [...new Uint8Array(imza)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const govde = { object: 'instagram', entry: [{ id: '17841449824821129', messaging: [{ sender: { id: '555' }, recipient: { id: '17841449824821129' }, timestamp: 1, message: { mid: 'm1', text: 'fiyat' } }] }] };

function istek(ham, imza) {
  return new Request('https://w.example/meta/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(imza ? { 'X-Hub-Signature-256': imza } : {}) }, body: ham });
}

describe('Meta webhook damgası', () => {
  it('imza uyuşmazsa sebep yazılır ve META_APP_SECRET adıyla anılır', async () => {
    const env = ortam({ META_APP_SECRET: GIZLI, META_VERIFY_TOKEN: 'v' });
    const ham = JSON.stringify(govde);
    const r = await worker.fetch(istek(ham, await imzala('yanlis-gizli', ham)), env, ctx);
    expect(r.status).toBe(200); // Meta'ya hata dönmüyoruz: hata dönmek aboneliği kapattırıyor
    const red = await new Veritabani(env.DB).metaAl('meta_webhook_red');
    expect(red).toMatch(/META_APP_SECRET/);
    expect(await new Veritabani(env.DB).metaAl('meta_webhook_kabul')).toBeNull();
  });

  it('imza başlığı hiç yoksa sebep bunu söyler', async () => {
    const env = ortam({ META_APP_SECRET: GIZLI, META_VERIFY_TOKEN: 'v' });
    const r = await worker.fetch(istek(JSON.stringify(govde)), env, ctx);
    expect(r.status).toBe(200);
    expect(await new Veritabani(env.DB).metaAl('meta_webhook_red')).toMatch(/imza başlığı yok/);
  });

  it('imza doğruysa kabul damgası yazılır, red damgası yazılmaz', async () => {
    const env = ortam({ META_APP_SECRET: GIZLI, META_VERIFY_TOKEN: 'v' });
    const ham = JSON.stringify(govde);
    const r = await worker.fetch(istek(ham, await imzala(GIZLI, ham)), env, ctx);
    expect(r.status).toBe(200);
    const db = new Veritabani(env.DB);
    expect(await db.metaAl('meta_webhook_kabul')).toMatch(/instagram/);
    expect(await db.metaAl('meta_webhook_red')).toBeNull();
  });

  it('gövde ve imza hiçbir damgaya sızmaz', async () => {
    const env = ortam({ META_APP_SECRET: GIZLI, META_VERIFY_TOKEN: 'v' });
    const ham = JSON.stringify(govde);
    const imza = await imzala('yanlis-gizli', ham);
    await worker.fetch(istek(ham, imza), env, ctx);
    const red = await new Veritabani(env.DB).metaAl('meta_webhook_red');
    expect(red).not.toContain(GIZLI);
    expect(red).not.toContain(imza.slice(7));
    expect(red).not.toContain('fiyat');
  });

  it('aynı env içinde red yazımı dakikada bire kısılır (kota selini önler)', async () => {
    const env = ortam({ META_APP_SECRET: GIZLI, META_VERIFY_TOKEN: 'v' });
    const db = new Veritabani(env.DB);
    const ham = JSON.stringify(govde);
    const kotu = await imzala('yanlis-gizli', ham);
    await worker.fetch(istek(ham, kotu), env, ctx);
    const ilk = await db.metaAl('meta_webhook_red');
    expect(ilk).toBeTruthy();
    // Aynı env ile 20 rica daha: uç herkese açık, her reddi yazmak yazma kotasını tüketirdi.
    for (let i = 0; i < 20; i++) expect((await worker.fetch(istek(ham, kotu), env, ctx)).status).toBe(200);
    expect(await db.metaAl('meta_webhook_red')).toBe(ilk);
    // Yeni env (yeni isolate) kendi sayacıyla başlar: ilk red yine yazılır.
    const env2 = ortam({ META_APP_SECRET: GIZLI, META_VERIFY_TOKEN: 'v' });
    await worker.fetch(istek(ham, kotu), env2, ctx);
    expect(await new Veritabani(env2.DB).metaAl('meta_webhook_red')).toBeTruthy();
  });


  it('imzasız gövde 200 alsa bile hiçbir olaya çevrilmez', async () => {
    const env = ortam({ META_APP_SECRET: GIZLI, META_VERIFY_TOKEN: 'v' });
    const db = new Veritabani(env.DB);
    const ham = JSON.stringify(govde);
    const r = await worker.fetch(istek(ham, await imzala('yanlis-gizli', ham)), env, ctx);
    expect(r.status).toBe(200);
    // Meta'ya 200 dönmek yalnızca aboneliğin düşmesini engelliyor; veri güvenilmez olduğu için
    // hiçbir kişi, sohbet ya da mesaj kaydı oluşmamalı.
    for (const kol of ['kisiler', 'sohbetler', 'mesajlar', 'gunluk']) {
      const kayitlar = await db.listele(kol);
      expect(kayitlar).toHaveLength(0);
    }
    expect(await db.metaAl('meta_webhook_kabul')).toBeNull();
  });


  // Durum kodu artık iki durumu da 200 gösteriyor (Meta aboneliği düşürmesin diye). Ayrımı
  // başlık taşıyor; sonda buna bakıyor. Bir süre 401'e bakan sonda, Worker 200 dönmeye
  // başlayınca koşulsuz "secret'lar aynı" yazar hale gelmişti — bu testler o sessiz
  // yanlışın tekrarını engelliyor.
  it('yanıt başlığı geçerli/geçersiz imzayı ayırt eder', async () => {
    const env = ortam({ META_APP_SECRET: GIZLI, META_VERIFY_TOKEN: 'v' });
    const ham = JSON.stringify(govde);
    const iyi = await worker.fetch(istek(ham, await imzala(GIZLI, ham)), env, ctx);
    expect(iyi.status).toBe(200);
    expect(iyi.headers.get('X-SS-Imza')).toBe('gecerli');

    const env2 = ortam({ META_APP_SECRET: GIZLI, META_VERIFY_TOKEN: 'v' });
    const kotu = await worker.fetch(istek(ham, await imzala('yanlis-gizli', ham)), env2, ctx);
    expect(kotu.status).toBe(200);
    expect(kotu.headers.get('X-SS-Imza')).toBe('gecersiz');
  });

  // Instagram Login akışındaki uygulamanın iki secret'ı var (Meta App Secret ve Instagram App
  // Secret) ve Meta hangisinin imzaladığını belgelememiş. Tahmin etmek bize bir kesinti
  // yaşattı; ikisini de kabul ediyoruz.
  it('ikinci secret (IG_APP_SECRET) ile imzalanmış gövde de kabul edilir', async () => {
    const IG_GIZLI = 'instagram-app-secret-xyz';
    const env = ortam({ META_APP_SECRET: GIZLI, IG_APP_SECRET: IG_GIZLI, META_VERIFY_TOKEN: 'v' });
    const ham = JSON.stringify(govde);
    const r = await worker.fetch(istek(ham, await imzala(IG_GIZLI, ham)), env, ctx);
    expect(r.status).toBe(200);
    expect(r.headers.get('X-SS-Imza')).toBe('gecerli');
    expect(await new Veritabani(env.DB).metaAl('meta_webhook_kabul')).toMatch(/instagram/);
  });

  it('iki secret de tutmazsa yine reddedilir', async () => {
    const env = ortam({ META_APP_SECRET: GIZLI, IG_APP_SECRET: 'ikinci', META_VERIFY_TOKEN: 'v' });
    const ham = JSON.stringify(govde);
    const r = await worker.fetch(istek(ham, await imzala('ucuncu-yanlis', ham)), env, ctx);
    expect(r.headers.get('X-SS-Imza')).toBe('gecersiz');
    expect(await new Veritabani(env.DB).metaAl('meta_webhook_kabul')).toBeNull();
  });

  it('doktor son kabul ve son reddi gösterir', async () => {
    const env = ortam({ META_APP_SECRET: GIZLI, META_VERIFY_TOKEN: 'v' });
    const ham = JSON.stringify(govde);
    await worker.fetch(istek(ham, await imzala(GIZLI, ham)), env, ctx);
    const d = await worker.fetch(new Request('https://w.example/api/durum', { headers: { Origin: 'https://ferhat-yasinoglu.github.io', 'X-SS-Sema': '1', Authorization: 'Bearer ' + env.YONETICI_ANAHTARI } }), env, ctx);
    const satir = (await d.json()).veri.doktor.find((x) => x.ad === 'Meta webhook');
    expect(satir.durum).toBe('ok');
    expect(satir.detay).toMatch(/son kabul/);
  });

  it('hiç olay gelmemişse doktor bunu açıkça söyler', async () => {
    const env = ortam({ META_APP_SECRET: GIZLI, META_VERIFY_TOKEN: 'v' });
    const d = await worker.fetch(new Request('https://w.example/api/durum', { headers: { Origin: 'https://ferhat-yasinoglu.github.io', 'X-SS-Sema': '1', Authorization: 'Bearer ' + env.YONETICI_ANAHTARI } }), env, ctx);
    const satir = (await d.json()).veri.doktor.find((x) => x.ad === 'Meta webhook');
    expect(satir.durum).toBe('warn');
    expect(satir.detay).toMatch(/henüz hiç olay göndermedi/);
  });
});
