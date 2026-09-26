// Telegram ajanının sohbet davranışı: modele sohbetin EN YENİ mesajları gider, model
// düşünürken "yazıyor…" görünür, <skip> sessizlik değil hazır "bulamadım" cevabı olur.
import { describe, it, expect } from 'vitest';
import { Veritabani } from '../src/db.js';
import { olayIsle, sohbetGecmisi } from '../src/motor.js';
import { ortam, sahteFetch } from './sahte-d1.js';

const BILINMEYEN = { fa: 'ببخشید، جواب را پیدا نکردم.', en: 'Sorry, I could not find an answer.' };

async function kur({ prova = '0', brifingEk = {} } = {}) {
  const env = ortam({ PROVA: prova, ANTHROPIC_API_KEY: 'k' }); const db = new Veritabani(env.DB);
  await db.kaydet('hesaplar', { kanal: 'telegram', ad: 'tg', dis_id: 'tg', durum: 'canli' }, { onek: 'hes' });
  await db.kaydet('ai_brifingler', { id: 'brif_shafa', ad: 'shafa', kimlik: 'K', kanallar: ['telegram'], bilgi_tabani: [{ baslik: 'b', metin: 'm', aktif: 1 }], aktif: 1, maxKarakter: 300, ...brifingEk });
  return { env, db };
}
let n = 0;
const mesaj = (env, db, f, text, dis_id = '7') => olayIsle(env, db, { kaynak: 'telegram', kanal: 'telegram', dis_id, ad: 'Dr', olay_id: 'tg:' + ++n, tip: 'dm', text, zaman: new Date().toISOString() }, { fetchFn: f });
const anthropicGecmisi = (f) => f.cagrilar.filter((c) => c.url.includes('anthropic')).map((c) => c.govde.messages);

describe('db.listele sonDan', () => {
  it('en yeni kayıtları eskiden yeniye sıralı döner', async () => {
    const env = ortam(); const db = new Veritabani(env.DB);
    for (let i = 1; i <= 5; i++) await db.kaydet('mesajlar', { sohbet_id: 's1', yon: 'gelen', metin: 'm' + i, zaman: new Date().toISOString() }, { onek: 'msj' });
    expect((await db.listele('mesajlar', { k1: 's1', limit: 2 })).map((m) => m.metin)).toEqual(['m1', 'm2']);
    expect((await db.listele('mesajlar', { k1: 's1', limit: 2, sonDan: true })).map((m) => m.metin)).toEqual(['m4', 'm5']);
  });
});

describe('sohbetGecmisi', () => {
  const suAn = Date.parse('2026-09-26T12:00:00Z');
  const m = (yon, metin, saatOnce = 0) => ({ yon, metin, zaman: new Date(suAn - saatOnce * 36e5).toISOString() });

  it('son 24 saat, gönderilmemiş ve hazır cevaplar dışarıda, şu anki mesaj tekrar edilmez, en fazla 6', () => {
    const mesajlar = [m('gelen', 'dünkü', 30), m('giden', '[prova] deneme', 1), m('giden', '⚠️ gitmedi', 1), m('gelen', 'soru1', 1), m('giden', 'cevap1', 1), m('gelen', 'soru2'), m('giden', BILINMEYEN.fa), m('gelen', 'şimdiki')];
    expect(sohbetGecmisi(mesajlar, { suAn, simdiki: 'şimdiki', haric: Object.values(BILINMEYEN) }).map((x) => x.metin)).toEqual(['soru1', 'cevap1', 'soru2']);
    const uzun = Array.from({ length: 10 }, (_, i) => m(i % 2 ? 'giden' : 'gelen', 'x' + i));
    expect(sohbetGecmisi(uzun, { suAn }).map((x) => x.metin)).toEqual(['x4', 'x5', 'x6', 'x7', 'x8', 'x9']);
  });
});

describe('Telegram ajanı', () => {
  it('uzun sohbette modele en eski değil en yeni mesajlar gider', async () => {
    const { env, db } = await kur();
    const f = sahteFetch({ anthropicMetin: 'cevap' });
    for (let i = 1; i <= 8; i++) await mesaj(env, db, f, 'eski soru ' + i);
    await mesaj(env, db, f, 'yeni soru');
    const son = anthropicGecmisi(f).at(-1).map((x) => x.content);
    expect(son.at(-1)).toBe('yeni soru');                 // şu anki mesaj en sonda, bir kez
    expect(son.filter((x) => x === 'yeni soru')).toHaveLength(1);
    expect(son).toContain('eski soru 8');                 // bir önceki soru geçmişte
    expect(son).not.toContain('eski soru 1');             // en eskiler değil
    expect(son.length).toBeLessThanOrEqual(7);
  });

  it('başka kişinin mesajları geçmişe karışmaz', async () => {
    const { env, db } = await kur();
    const f = sahteFetch({ anthropicMetin: 'cevap' });
    await mesaj(env, db, f, 'A kişisinin gizli sorusu', 'A');
    await mesaj(env, db, f, 'B soruyor', 'B');
    expect(anthropicGecmisi(f).at(-1).map((x) => x.content).join('|')).not.toContain('A kişisinin');
  });

  it('canlıda model çağrılmadan önce "yazıyor…" gider; provada gitmez', async () => {
    const { env, db } = await kur();
    const f = sahteFetch({ anthropicMetin: 'cevap' });
    await mesaj(env, db, f, 'نسخه را چطور چاپ کنم؟');
    const sira = f.cagrilar.map((c) => c.url.split('/').at(-1));
    expect(sira.indexOf('sendChatAction')).toBeGreaterThanOrEqual(0);
    expect(sira.indexOf('sendChatAction')).toBeLessThan(sira.indexOf('messages'));
    expect(f.cagrilar.find((c) => c.url.endsWith('sendChatAction')).govde).toEqual({ chat_id: '7', action: 'typing' });
    const p = await kur({ prova: '1' });
    const f2 = sahteFetch({ anthropicMetin: 'cevap' });
    await mesaj(p.env, p.db, f2, 'soru');
    expect(f2.cagrilar.some((c) => c.url.includes('api.telegram.org'))).toBe(false);
  });

  it('<skip>: sessizlik yerine soru dilinde hazır cevap gider, soru cevapsızlara düşer', async () => {
    const { env, db } = await kur({ brifingEk: { bilinmeyenCevabi: BILINMEYEN } });
    const f = sahteFetch({ anthropicMetin: '<skip>' });
    const r = await mesaj(env, db, f, 'این سوال در معلومات نیست؟');
    expect(r).toMatchObject({ karar: 'ai', cevapVar: false });
    expect(f.cagrilar.find((c) => c.url.endsWith('sendMessage')).govde.text).toBe(BILINMEYEN.fa);
    await mesaj(env, db, f, 'What is the weather like?');
    expect(f.cagrilar.filter((c) => c.url.endsWith('sendMessage')).at(-1).govde.text).toBe(BILINMEYEN.en);
    expect((await db.listele('cevapsiz_sorular')).map((s) => s.soru)).toEqual(['این سوال در معلومات نیست؟', 'What is the weather like?']);
    const g = (await db.listele('gunluk')).filter((x) => x.karar?.tur === 'ai');
    expect(g.map((x) => [x.karar.sonuc, x.karar.yedek, x.gonderildi])).toEqual([['skip', 1, 1], ['skip', 1, 1]]);
    // Hazır cevap sonraki soruda modele "önceki cevap" diye gitmez.
    await mesaj(env, db, f, 'bir soru daha');
    expect(anthropicGecmisi(f).at(-1).map((x) => x.content)).not.toContain(BILINMEYEN.fa);
  });

  it('hazır cevabı olmayan brifingde <skip> eskisi gibi susar', async () => {
    const { env, db } = await kur();
    const f = sahteFetch({ anthropicMetin: '<skip>' });
    await mesaj(env, db, f, 'bilinmeyen');
    expect(f.cagrilar.some((c) => c.url.endsWith('sendMessage'))).toBe(false);
    expect((await db.listele('cevapsiz_sorular'))).toHaveLength(1);
  });
});
