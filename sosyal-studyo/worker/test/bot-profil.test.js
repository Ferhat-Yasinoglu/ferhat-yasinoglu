// Telegram bot profili: dosya denetimi, yalnız farklı alanı yazma, resmin yalnız gerektiğinde yüklenmesi.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { profilHazirla, profilUygula, calistir } from '../../tools/bot-profil.mjs';

const ham = JSON.parse(readFileSync(new URL('../hazir/shafa-bot-profil.json', import.meta.url), 'utf8'));

/** Sahte Telegram: profil alanlarını dil başına tutar, çağrıları kaydeder. */
function sahteTelegram({ mevcut = {}, resimSayisi = 0 } = {}) {
  const durum = JSON.parse(JSON.stringify(mevcut));
  const cagrilar = [];
  const OKU = { getMyName: 'name', getMyShortDescription: 'short_description', getMyDescription: 'description' };
  const YAZ = { setMyName: 'name', setMyShortDescription: 'short_description', setMyDescription: 'description' };
  const f = async (url, init) => {
    const yontem = String(url).split('/').at(-1);
    const form = init.body instanceof FormData;
    const govde = form ? Object.fromEntries(init.body.entries()) : JSON.parse(init.body || '{}');
    cagrilar.push({ yontem, govde, url: String(url) });
    const ok = (result) => new Response(JSON.stringify({ ok: true, result }));
    const dil = govde.language_code || '';
    if (OKU[yontem]) return ok({ [OKU[yontem]]: durum[dil]?.[OKU[yontem]] ?? '' });
    if (YAZ[yontem]) { durum[dil] = { ...durum[dil], [YAZ[yontem]]: govde[YAZ[yontem]] }; return ok(true); }
    if (yontem === 'getMe') return ok({ id: 42, username: 'rabatshafa_bot' });
    if (yontem === 'getUserProfilePhotos') return ok({ total_count: resimSayisi, photos: [] });
    if (yontem === 'setMyProfilePhoto') { resimSayisi++; return ok(true); }
    return new Response(JSON.stringify({ ok: false, description: 'bilinmeyen ' + yontem }));
  };
  f.cagrilar = cagrilar;
  return f;
}
const yazilanlar = (f) => f.cagrilar.filter((c) => c.yontem.startsWith('set')).map((c) => `${c.yontem}:${c.govde.language_code || ''}`);

describe('Shafa bot profil dosyası', () => {
  it('varsayılan Dari + İngilizce; ad, kısa ve uzun açıklama Telegram sınırlarında', () => {
    const p = profilHazirla(ham);
    expect(Object.keys(p.diller).sort()).toEqual(['', 'en']);
    expect(p.diller[''].kisa).toMatch(/شفا/);
    expect(p.diller[''].uzun).toMatch(/دوز دوا/);             // doz tavsiyesi vermediğini söyler
    expect(p.diller[''].uzun).toMatch(/معلومات مریض/);        // hasta bilgisi göndermeyin
    expect(p.diller.en.uzun).toMatch(/doses/);
    for (const d of Object.values(p.diller)) expect(d.uzun).toContain('https://ferhat-yasinoglu.github.io/ferhat-yasinoglu/shafa/');
  });

  it('resim 640×640 JPG', () => {
    const b = readFileSync(new URL('../hazir/' + ham.foto, import.meta.url));
    expect([b[0], b[1]]).toEqual([0xff, 0xd8]);                  // JPEG imzası
    let i = 2, olcu = null;
    while (i < b.length && !olcu) {                               // SOF0/SOF2 çerçevesinden boyut
      const tip = b[i + 1], uzunluk = b.readUInt16BE(i + 2);
      if (tip === 0xc0 || tip === 0xc2) olcu = { boy: b.readUInt16BE(i + 5), en: b.readUInt16BE(i + 7) };
      i += 2 + uzunluk;
    }
    expect(olcu).toEqual({ boy: 640, en: 640 });
    expect(b.length).toBeLessThan(5 * 1024 * 1024);
  });

  it('sınırı aşan ya da boş metni reddeder', () => {
    expect(() => profilHazirla({ diller: { '': { ad: 'a', kisa: 'x'.repeat(121), uzun: 'u' } } })).toThrow(/kisa 121/);
    expect(() => profilHazirla({ diller: { '': { ad: '', kisa: 'k', uzun: 'u' } } })).toThrow(/ad boş/);
    expect(() => profilHazirla({ diller: { en: { ad: 'a', kisa: 'k', uzun: 'u' } } })).toThrow(/varsayılan/);
  });
});

describe('profilUygula', () => {
  const profil = profilHazirla(ham);
  const foto = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

  it('ilk çalıştırma: altı alan yazılır, resim yüklenir; ikinci çalıştırma hiçbir şey yazmaz', async () => {
    const f = sahteTelegram();
    const r = await profilUygula({ token: 'T', profil, fotoBayt: foto, fetchFn: f });
    expect(r.hatalar).toEqual([]);
    expect(yazilanlar(f).sort()).toEqual(['setMyDescription:', 'setMyDescription:en', 'setMyName:', 'setMyName:en', 'setMyProfilePhoto:', 'setMyShortDescription:', 'setMyShortDescription:en']);
    const resim = f.cagrilar.find((c) => c.yontem === 'setMyProfilePhoto').govde;
    expect(JSON.parse(resim.photo)).toEqual({ type: 'static', photo: 'attach://foto' });
    expect(resim.foto).toBeInstanceOf(Blob);
    f.cagrilar.length = 0;
    await profilUygula({ token: 'T', profil, fotoBayt: foto, fetchFn: f });
    expect(yazilanlar(f)).toEqual([]);                          // aynı metin yeniden gönderilmez; resim zaten var
  });

  it('yalnız değişen alan yazılır; resim bot_foto seçilince yenilenir', async () => {
    const mevcut = { '': { name: profil.diller[''].ad, short_description: 'eski', description: profil.diller[''].uzun }, en: { name: profil.diller.en.ad, short_description: profil.diller.en.kisa, description: profil.diller.en.uzun } };
    const f = sahteTelegram({ mevcut, resimSayisi: 1 });
    await profilUygula({ token: 'T', profil, fotoBayt: foto, fotoYenile: true, fetchFn: f });
    expect(yazilanlar(f)).toEqual(['setMyShortDescription:', 'setMyProfilePhoto:']);
  });

  it('Telegram hatası diğer alanları durdurmaz, rapora düşer', async () => {
    const f = sahteTelegram();
    const hatali = async (url, init) => (String(url).endsWith('/setMyName') ? new Response(JSON.stringify({ ok: false, description: 'Too Many Requests: retry after 30' })) : f(url, init));
    const r = await profilUygula({ token: 'T', profil, fetchFn: hatali });
    expect(r.hatalar.filter((h) => /ad: setMyName: Too Many/.test(h))).toHaveLength(2);
    expect(f.cagrilar.filter((c) => c.yontem === 'setMyDescription')).toHaveLength(2);
  });

  it('calistir: token çıktıya düşmez', async () => {
    const token = '123456:GIZLI-TOKEN';
    const f = sahteTelegram();
    const hatali = async (url, init) => (String(url).endsWith('/setMyDescription') ? new Response(JSON.stringify({ ok: false, description: `bad url https://api.telegram.org/bot${token}/x` })) : f(url, init));
    const satirlar = [];
    expect(await calistir({ env: { TELEGRAM_BOT_TOKEN: token }, fetchFn: hatali, yaz: (s) => satirlar.push(s) })).toBe(0);
    expect(satirlar.join('\n')).not.toContain(token);
    expect(satirlar.join('\n')).toContain('***');
    expect(await calistir({ env: {}, fetchFn: f, yaz: () => {} })).toBe(1);
  });
});
