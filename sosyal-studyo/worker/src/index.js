/* Sosyal Stüdyo Worker — giriş. Yollar:
   GET  /health                 herkese açık sağlık
   GET  /meta/webhook           Meta el sıkışması (hub.verify_token)
   POST /meta/webhook           Instagram + WhatsApp olayları (X-Hub-Signature-256)
   POST /tg/webhook             Telegram (X-Telegram-Bot-Api-Secret-Token)
   *    /api/*                  yönetici API'si (Bearer)
   scheduled                    5 dk bekçi: gecikmeli koşular, bekleyen olaylar, toplu mesaj, yorum polling, temizlik
   Fail-closed: D1/anahtar/origin eksikse /api 503; webhook'lar 200 döner ama işlemez (Meta yeniden denemesin). */
import { Veritabani, simdi } from './db.js';
import { json, ok, hata, metaImzaGecerli, telegramGizliGecerli, yapilandirmaEksikleri, corsBasliklari } from './guvenlik.js';
import { olayIsle, gecikenleriKostur } from './motor.js';
import { topluParcaGonder } from './toplu.js';
import { apiIsle } from './api.js';
import * as tg from './telegram.js';
import * as meta from './meta.js';
import { saglayici } from './ai.js';
import { SEMA_SURUMU } from '../../app/js/paylasilan/sema/surum.js';

// /health herkese açık: her kaynaktan, özel başlıklarla da (X-SS-Sema) çağrılabilir.
const HEALTH_CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-SS-Sema', 'Access-Control-Max-Age': '86400' };

export default {
  // Her istek tek bir try/catch içinden geçer: yakalanmayan hata Cloudflare'in genel 1101 sayfası yerine
  // JSON (hata: 'sunucu', mesaj, yol) döner ve console.error ile günlüğe düşer. Gizli değer içermez.
  async fetch(istek, env, ctx) {
    try { return await isle(istek, env, ctx); } catch (e) {
      console.error('fetch', e);
      return json({ ok: false, hata: 'sunucu', mesaj: String((e && e.message) || e), yol: new URL(istek.url).pathname }, 500, { 'Access-Control-Allow-Origin': '*' });
    }
  },

  async scheduled(olay, env, ctx) {
    if (yapilandirmaEksikleri(env).length) return;
    const db = new Veritabani(env.DB);
    const ozet = { geciken: 0, bekleyen: 0, toplu: 0, yorum: 0, silinen: 0 };
    try { ozet.geciken = await gecikenleriKostur(env, db); } catch (e) { console.error('geciken', e); }
    try { const esik = new Date(Date.now() - 2 * 60000).toISOString(); for (const o of await db.bekleyenGelenler(esik)) { await db.gelenBitir(o.olay_id, 'retry'); try { o.olay_id = o.olay_id + ':r'; await olayIsle(env, db, o); ozet.bekleyen++; } catch (e) { console.error('retry', e); } } } catch (e) { console.error('bekleyen', e); }
    try { ozet.toplu = await topluParcaGonder(env, db); } catch (e) { console.error('toplu', e); }
    try {
      const ig = (await db.listele('hesaplar')).find((h) => h.kanal === 'instagram' && h.polling?.aktif);
      if (ig && env.IG_ACCESS_TOKEN) { const yorumlar = await meta.igYorumlariCek(env); for (const y of yorumlar) { const r = await olayIsle(env, db, { kaynak: 'instagram', kanal: 'instagram', hesap_id: ig.id, dis_id: String(y.from?.id || y.username), ad: y.username, kullanici_adi: y.username, olay_id: `ig:c:${y.yorumId}`, tip: 'comment', text: y.text, yorumId: y.yorumId, gonderiId: y.gonderiId, zaman: y.zaman }); if (!r.atlandi) ozet.yorum++; } }
    } catch (e) { console.error('polling', e); }
    try { const gun = Number(env.GUNLUK_SAKLAMA_GUN || 30); ozet.silinen = await db.eskiGunlukSil(new Date(Date.now() - gun * 86400e3).toISOString()); } catch (e) { console.error('temizlik', e); }
    await db.metaKaydet('son_cron', simdi() + ' ' + JSON.stringify(ozet));
  },
};

async function isle(istek, env, ctx) {
  const url = new URL(istek.url);
  const eksik = yapilandirmaEksikleri(env);
  // CORS ön kontrolü (OPTIONS) her yol için burada cevaplanır; yoksa tarayıcı özel başlıklı isteği hiç göndermez.
  if (istek.method === 'OPTIONS') return new Response(null, { status: 204, headers: url.pathname === '/health' ? HEALTH_CORS : corsBasliklari(env, istek.headers.get('Origin') || '') });
  if (url.pathname === '/health') return json({ ok: eksik.length === 0, surum: env.SURUM || 'dev', sema: SEMA_SURUMU, prova: String(env.PROVA || '1') === '1', saglayici: saglayici(env), eksik }, eksik.length ? 503 : 200, HEALTH_CORS);
  if (url.pathname.startsWith('/api/')) {
    if (eksik.length) return hata('yapilandirma', eksik.join('; '), 503, corsBasliklari(env, istek.headers.get('Origin') || ''));
    return apiIsle(env, new Veritabani(env.DB), istek, url, { ctx });
  }
  if (eksik.length && !url.pathname.startsWith('/meta/webhook')) return json({ ok: false, hata: 'yapilandirma' }, 503);

  if (url.pathname === '/meta/webhook' && istek.method === 'GET') {
    if (env.META_VERIFY_TOKEN && url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === env.META_VERIFY_TOKEN) return new Response(url.searchParams.get('hub.challenge') || '', { status: 200 });
    return new Response('reddedildi', { status: 403 });
  }
  if (url.pathname === '/meta/webhook' && istek.method === 'POST') {
    const ham = await istek.text();
    if (eksik.length || !(await metaImzaGecerli(env, ham, istek.headers.get('X-Hub-Signature-256')))) return new Response('imza', { status: 401 });
    let govde; try { govde = JSON.parse(ham); } catch { return new Response('json', { status: 400 }); }
    const db = new Veritabani(env.DB);
    const hesaplar = await db.listele('hesaplar');
    const olaylar = meta.olaylaraCevir(govde, hesaplar);
    // Meta 200'ü hızlı ister; iş waitUntil'da sürer. Başarısız olay gelen kutusunda 'pending' kalır, cron yeniden dener.
    ctx.waitUntil((async () => { for (const o of olaylar) { try { await olayIsle(env, db, o, { hesaplar }); } catch (e) { console.error('meta olay', e); } } })());
    return new Response('ok', { status: 200 });
  }
  if (url.pathname === '/tg/webhook' && istek.method === 'POST') {
    if (!telegramGizliGecerli(env, istek)) return new Response('gizli', { status: 401 });
    let update; try { update = await istek.json(); } catch { return new Response('json', { status: 400 }); }
    const db = new Veritabani(env.DB);
    const hesaplar = await db.listele('hesaplar');
    const hesap = hesaplar.find((h) => h.kanal === 'telegram');
    const olay = tg.olayaCevir(update, hesap?.id);
    if (olay) ctx.waitUntil(olayIsle(env, db, olay, { hesaplar }).catch((e) => console.error('tg olay', e)));
    return new Response('ok', { status: 200 });
  }
  return json({ ok: false, hata: 'yol' }, 404);
}
