// Anthropic anahtarı reddedilince Workers AI'ya düşme ve brifingin yasak desen denetimi.
// Anahtar geçersizken bot susmasın; küçük model "doz söyleme" kuralını çiğnerse doz dışarı çıkmasın.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { modelCagir, ajanCevap, yasakDesen } from '../src/ai.js';
import { Veritabani } from '../src/db.js';
import { ortam } from './sahte-d1.js';

const json = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'Content-Type': 'application/json' } });
const anthropicHatasi = (status, message) => async () => json({ type: 'error', error: { type: 'x', message } }, status);
const anthropicOk = (text) => async () => json({ content: [{ type: 'text', text }], usage: { input_tokens: 3, output_tokens: 2 } });

/** Sahte Workers AI: model adına göre cevap ya da hata; çağrıları kaydeder. */
function sahteAi(cevaplar) {
  const cagrilar = [];
  return {
    cagrilar,
    run: async (model, girdi) => {
      cagrilar.push({ model, girdi });
      const c = cevaplar[model];
      if (c === undefined || c instanceof Error) throw c || new Error('5007: No such model');
      return c;
    },
  };
}

const istek = { sistem: 'S', mesajlar: [{ role: 'user', content: 'soru' }], maxToken: 50 };

describe('modelCagir: Anthropic reddederse Workers AI', () => {
  it('401 (geçersiz anahtar) → Workers AI cevaplar, hata raporda kalır', async () => {
    const AI = sahteAi({ '@cf/a': { response: 'yedek cevap' } });
    const r = await modelCagir({ ANTHROPIC_API_KEY: 'k', AI, AI_MODEL: '@cf/a' }, { ...istek, fetchFn: anthropicHatasi(401, 'invalid x-api-key') });
    expect(r).toMatchObject({ metin: 'yedek cevap', saglayici: 'workers-ai', model: '@cf/a', anthropicHatasi: '401: invalid x-api-key' });
    expect(AI.cagrilar[0].girdi.messages[0]).toEqual({ role: 'system', content: 'S' });
  });

  it('403 ve bitmiş kredi (400 credit balance) de düşer', async () => {
    const AI = sahteAi({ '@cf/a': { response: 'ok' } });
    const env = { ANTHROPIC_API_KEY: 'k', AI, AI_MODEL: '@cf/a' };
    expect((await modelCagir(env, { ...istek, fetchFn: anthropicHatasi(403, 'forbidden') })).saglayici).toBe('workers-ai');
    expect((await modelCagir(env, { ...istek, fetchFn: anthropicHatasi(400, 'Your credit balance is too low') })).saglayici).toBe('workers-ai');
  });

  it('geçici ya da istek hataları düşmez: eskisi gibi yukarı çıkar', async () => {
    const AI = sahteAi({ '@cf/a': { response: 'ok' } });
    const env = { ANTHROPIC_API_KEY: 'k', AI, AI_MODEL: '@cf/a' };
    await expect(modelCagir(env, { ...istek, fetchFn: anthropicHatasi(429, 'rate limit') })).rejects.toThrow('anthropic 429: rate limit');
    await expect(modelCagir(env, { ...istek, fetchFn: anthropicHatasi(400, 'messages: bad') })).rejects.toThrow('anthropic 400');
    expect(AI.cagrilar).toHaveLength(0);
  });

  it('Workers AI bağlı değilse 401 yine hata', async () => {
    await expect(modelCagir({ ANTHROPIC_API_KEY: 'k' }, { ...istek, fetchFn: anthropicHatasi(401, 'invalid x-api-key') })).rejects.toThrow('anthropic 401');
  });

  it('anahtar geçerliyse Anthropic kullanılır, Workers AI çağrılmaz', async () => {
    const AI = sahteAi({ '@cf/a': { response: 'yedek' } });
    const r = await modelCagir({ ANTHROPIC_API_KEY: 'k', AI, AI_MODEL: '@cf/a' }, { ...istek, fetchFn: anthropicOk('claude') });
    expect(r).toMatchObject({ metin: 'claude', saglayici: 'anthropic' });
    expect(r.anthropicHatasi).toBeUndefined();
    expect(AI.cagrilar).toHaveLength(0);
  });

  it('AI_MODEL sırası: kaldırılmış model atlanır; OpenAI biçimli cevap da okunur', async () => {
    const AI = sahteAi({ '@cf/yok': new Error('5007: No such model'), '@cf/b': { choices: [{ message: { content: ' ikinci ' } }] } });
    const r = await modelCagir({ AI, AI_MODEL: '@cf/yok, @cf/b' }, istek);
    expect(r).toMatchObject({ metin: 'ikinci', model: '@cf/b' });
    expect(AI.cagrilar.map((c) => c.model)).toEqual(['@cf/yok', '@cf/b']);
  });

  it('sıradaki hiçbir model çalışmazsa son hata yukarı çıkar', async () => {
    const AI = sahteAi({ '@cf/a': new Error('4006: daily free allocation exceeded') });
    await expect(modelCagir({ AI, AI_MODEL: '@cf/a' }, istek)).rejects.toThrow('4006');
  });
});

describe('ajanCevap: yasak desen denetimi', () => {
  const DOZ = '[0-9۰-۹٠-٩]+([.,٫][0-9۰-۹٠-٩]+)?\\s*(mg|mcg|ml|µg|milligram|ملی|میلی|گرام|قطره|tablet|قرص)';
  const brifing = (ek = {}) => ({ id: 'brif_t', kimlik: 'k', bilgi_tabani: [{ baslik: 'b', metin: 'm', aktif: 1 }], aktif: 1, maxKarakter: 300, yasakDesenleri: [DOZ], ...ek });
  const RET = { fa: 'ببخشید، دربارهٔ دوز دوا معلومات نمی‌دهم.', en: 'Sorry, no dose information.' };
  const kur = (modelMetni) => {
    const env = ortam({ AI: sahteAi({ '@cf/a': { response: modelMetni } }), AI_MODEL: '@cf/a' });
    return { env, db: new Veritabani(env.DB) };
  };

  it('doz yazan cevap gitmez; soru dilinde hazır ret cümlesi gider', async () => {
    const { env, db } = kur('برای طفل ۲۵۰ ملی‌گرام پاراستامول بدهید.');
    const rapor = {};
    expect(await ajanCevap(env, db, { brifing: brifing({ yasakCevabi: RET }), mesaj: 'چند ملی‌گرام پاراستامول بدهم؟', rapor })).toBe(RET.fa);
    expect(rapor).toMatchObject({ saglayici: 'workers-ai', engellendi: DOZ });
    const k2 = kur('Give 250 mg every 6 hours.');
    expect(await ajanCevap(k2.env, k2.db, { brifing: brifing({ yasakCevabi: RET }), mesaj: 'How many mg of paracetamol?' })).toBe(RET.en);
  });

  it('hazır ret cümlesi yoksa susar (<skip> gibi)', async () => {
    const { env, db } = kur('Give 5 ml syrup.');
    expect(await ajanCevap(env, db, { brifing: brifing(), mesaj: 'dose?' })).toBeNull();
  });

  it('desene uymayan cevap olduğu gibi gider; desensiz brifing etkilenmez', async () => {
    const { env, db } = kur('از منوی «نسخه» دکمهٔ «چاپ» را بزنید.');
    expect(await ajanCevap(env, db, { brifing: brifing(), mesaj: 'چطور چاپ کنم؟' })).toBe('از منوی «نسخه» دکمهٔ «چاپ» را بزنید.');
    const k2 = kur('Take 2 tablet.');
    expect(await ajanCevap(k2.env, k2.db, { brifing: brifing({ yasakDesenleri: undefined }), mesaj: 'x' })).toBe('Take 2 tablet.');
  });

  it('bozuk desen Worker\'ı düşürmez, yalnız atlanır', () => {
    expect(yasakDesen({ yasakDesenleri: ['(', 'mg'] }, '5 mg')).toBe('mg');
    expect(yasakDesen({ yasakDesenleri: ['('] }, '5 mg')).toBeNull();
  });
});

describe('Shafa brifinginin doz deseni', () => {
  const { brifing } = JSON.parse(readFileSync(new URL('../hazir/shafa-ajan.json', import.meta.url), 'utf8'));

  it('dozu yakalar, bilgi tabanındaki hiçbir metni yakalamaz', () => {
    for (const t of ['۲۵۰ ملی‌گرام', '250 mg', '5 ml', '۱۰ قطره', '2 tablet', '1.5 mg']) expect(yasakDesen(brifing, t), t).not.toBeNull();
    for (const b of brifing.bilgi_tabani) expect(yasakDesen(brifing, `${b.baslik}\n${b.metin}`), b.baslik).toBeNull();
    expect(yasakDesen(brifing, brifing.yasakCevabi.fa)).toBeNull();
    expect(yasakDesen(brifing, brifing.yasakCevabi.en)).toBeNull();
  });
});
