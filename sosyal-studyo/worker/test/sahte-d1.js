// Testler için D1 taklidi: node:sqlite üzerinde aynı prepare/bind/first/all/run yüzeyi.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function sahteD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_ilk.sql', import.meta.url), 'utf8'));
  const ifade = (sql, args = []) => ({
    bind: (...a) => ifade(sql, a),
    first: async (kolon) => { const r = db.prepare(sql).get(...args) ?? null; return kolon && r ? r[kolon] : r; },
    all: async () => ({ results: db.prepare(sql).all(...args), meta: {} }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
  });
  return { prepare: (sql) => ifade(sql), batch: async (ifadeler) => Promise.all(ifadeler.map((i) => i.run())), _db: db };
}

/** Sahte ağ: çağrıları kaydeder; Telegram/Meta/Anthropic için makul yanıtlar döner. */
export function sahteFetch({ anthropicMetin = 'Merhaba! Nasıl yardımcı olabilirim?', webhookUrl = 'https://w.example/tg/webhook', bekleyen = 0 } = {}) {
  const cagrilar = [];
  const f = async (url, init = {}) => {
    const u = String(url); const govde = init.body ? JSON.parse(init.body) : null;
    cagrilar.push({ url: u, govde, method: init.method || 'GET' });
    const cevap = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.includes('api.telegram.org')) {
      if (u.endsWith('/getMe')) return cevap({ ok: true, result: { id: 1, username: 'demo_bot' } });
      if (u.endsWith('/getWebhookInfo')) return cevap({ ok: true, result: { url: webhookUrl, pending_update_count: bekleyen } });
      return cevap({ ok: true, result: { message_id: cagrilar.length } });
    }
    if (u.includes('graph.facebook.com')) return cevap({ id: 'm' + cagrilar.length, recipient_id: 'x' });
    if (u.includes('api.anthropic.com')) return cevap({ content: [{ type: 'text', text: anthropicMetin }], usage: { input_tokens: 10, output_tokens: 5 } });
    return cevap({ ok: true });
  };
  f.cagrilar = cagrilar;
  return f;
}

export function ortam(ek = {}) {
  return { DB: sahteD1(), YONETICI_ANAHTARI: 'a'.repeat(40), ALLOWED_ORIGINS: 'https://ferhat-yasinoglu.github.io', PROVA: '1', TELEGRAM_BOT_TOKEN: '123:abc', TELEGRAM_WEBHOOK_SECRET: 'gizli-token', META_APP_SECRET: 'meta-secret', META_VERIFY_TOKEN: 'dogrula', IG_ACCESS_TOKEN: 'ig-token', SURUM: 'test', ...ek };
}
