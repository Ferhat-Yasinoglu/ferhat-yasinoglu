// Giriş: Google jetonu + REKLAMCILAR allowlist, oturum, çıkış, hız sınırı,
// geliştirme girişi ve yapılandırma eksikleri (fail-closed).
import { describe, it, expect } from 'vitest';
import { kur, SAHIP, ARKADAS, ISTEMCI, googleJetonu, googleTaklidi, jwtImzala, GOOGLE } from './yardim.js';
import { JETON_KALIBI } from '../../sunucu/cekirdek.js';

const YABANCI = 'yabanci@gmail.com';

describe('GET /v1/durum', () => {
  it('jetonsuz: sürüm, istemci kimliği, prova ve kanal bağlılığı (token değeri yok)', async () => {
    const k = kur({ META_SAYFA_TOKEN: 'gizli-sayfa', META_SAYFA_ID: '111' });
    const d = await k.jsonIste('durum');
    expect(d.durum).toBe(200);
    expect(d.veri).toEqual({
      ok: true, surum: '0.1.0', gelistirme: false, istemciKimligi: ISTEMCI, prova: true,
      kanallar: { facebook: { bagli: true }, instagram: { bagli: false } },
    });
    expect(JSON.stringify(d.veri)).not.toContain('gizli-sayfa');
  });
});

describe('POST /v1/giris', () => {
  it('geçerli Google jetonu + allowlist → 200, jeton ve kullanıcı', async () => {
    const k = kur();
    const g = await k.girisYap(SAHIP);
    expect(g.durum).toBe(200);
    expect(g.veri.jeton).toMatch(JETON_KALIBI);
    expect(g.veri.kullanici).toEqual({ eposta: SAHIP, ad: 'Kullanıcı sahip', resim: 'https://lh3.googleusercontent.com/a/ornek' });
    // Jetonun kendisi depoda yok, yalnız özeti.
    expect(k.sql('SELECT ozet FROM oturumlar').map((r) => r.ozet)).not.toContain(g.veri.jeton);
    expect(k.sql('SELECT ozet FROM oturumlar')).toHaveLength(1);
  });

  it('ikinci reklamcı de girer; büyük harf ve boşluklu liste normalleşir', async () => {
    const k = kur({ REKLAMCILAR: ` ${SAHIP} ; ARKADAS@FY.AF ` });
    expect((await k.girisYap('Arkadas@fy.af')).durum).toBe(200);
  });

  it('allowlist dışı → 403 yetki (adresle)', async () => {
    const k = kur();
    expect(await k.girisYap(YABANCI)).toMatchObject({ durum: 403, veri: { hata: 'yetki', eposta: YABANCI } });
    expect(k.sql('SELECT 1 FROM oturumlar')).toHaveLength(0);
  });

  it('bozuk, yanlış aud, süresi dolmuş ya da başka anahtarla imzalı jeton → 401 kimlik', async () => {
    const k = kur();
    expect(await k.girisYap(SAHIP, { kimlik: 'abc.def' })).toMatchObject({ durum: 401, veri: { hata: 'kimlik' } });
    expect(await k.girisYap(SAHIP, { jetonEk: { aud: 'baska-uygulama' } })).toMatchObject({ durum: 401, veri: { hata: 'kimlik' } });
    const s = Math.floor(Date.now() / 1000);
    expect(await k.girisYap(SAHIP, { jetonEk: { iat: s - 7200, nbf: s - 7200, exp: s - 3600 } })).toMatchObject({ durum: 401, veri: { hata: 'kimlik' } });
    expect(await k.girisYap(SAHIP, { jetonEk: { email_verified: false } })).toMatchObject({ durum: 401, veri: { hata: 'kimlik' } });
    const sahte = await googleTaklidi(GOOGLE.kid); // aynı kid, başka anahtar
    expect(await k.girisYap(SAHIP, { google: sahte })).toMatchObject({ durum: 401, veri: { hata: 'kimlik' } });
    // alg none / HS256 kabul edilmez
    const yuk = { iss: 'https://accounts.google.com', aud: ISTEMCI, sub: 'x', email: SAHIP, email_verified: true, iat: s, exp: s + 3600 };
    const hs = await jwtImzala({ alg: 'none', kid: GOOGLE.kid }, yuk, GOOGLE.cift.privateKey);
    expect(await k.girisYap(SAHIP, { kimlik: hs })).toMatchObject({ durum: 401, veri: { hata: 'kimlik' } });
  });

  it('eksik ya da çok uzun kimlik → 400 gecersiz', async () => {
    const k = kur();
    expect(await k.jsonIste('giris', { method: 'POST', govde: {} })).toMatchObject({ durum: 400, veri: { hata: 'gecersiz', alan: 'kimlik' } });
    expect(await k.jsonIste('giris', { method: 'POST', govde: 'bozuk json' })).toMatchObject({ durum: 400, veri: { hata: 'gecersiz' } });
  });

  it('gmail normalizasyonu: Sahip.X+y@googlemail.com = sahipx@gmail.com', async () => {
    const k = kur({ REKLAMCILAR: 'sahipx@gmail.com' });
    const g = await k.girisYap('Sahip.X+y@googlemail.com');
    expect(g.durum).toBe(200);
    expect(g.veri.kullanici.eposta).toBe('sahipx@gmail.com');
    // Başka alanda nokta anlamlı: sahip.x@fy.af ≠ sahipx@fy.af
    const k2 = kur({ REKLAMCILAR: 'sahipx@fy.af' });
    expect((await k2.girisYap('sahip.x@fy.af')).durum).toBe(403);
  });

  it('aynı IP\'den 20 başarısız giriş → 429 oran (geçerli jeton bile); başka IP girer', async () => {
    const k = kur();
    for (let i = 0; i < 20; i++) {
      const r = await k.girisYap(SAHIP, { ip: '198.51.100.9', kimlik: 'bozuk.jeton.' + i });
      expect(r.durum).toBe(401);
    }
    expect(await k.girisYap(SAHIP, { ip: '198.51.100.9' })).toMatchObject({ durum: 429, veri: { hata: 'oran' } });
    expect((await k.girisYap(SAHIP, { ip: '198.51.100.10' })).durum).toBe(200);
  });

  it('allowlist dışı denemeler de sayılır; IPv6 aynı /64 tek anahtardır', async () => {
    const k = kur();
    for (let i = 0; i < 20; i++) expect((await k.girisYap(YABANCI, { ip: `2001:db8:1:2::${(i + 1).toString(16)}` })).durum).toBe(403);
    expect((await k.girisYap(SAHIP, { ip: '2001:db8:1:2:ffff::1' })).durum).toBe(429);
    expect((await k.girisYap(SAHIP, { ip: '2001:db8:1:3::1' })).durum).toBe(200);
  });

  it('REKLAMCILAR boş → 503 yapilandirma (Google jetonu denetlenmeden)', async () => {
    const k = kur({ REKLAMCILAR: '' });
    expect(await k.girisYap(SAHIP)).toMatchObject({ durum: 503, veri: { hata: 'yapilandirma' } });
    expect(await k.girisYap(SAHIP, { kimlik: 'bozuk' })).toMatchObject({ durum: 503, veri: { hata: 'yapilandirma' } });
  });

  it('istemci kimliği boş → 503 yapilandirma', async () => {
    const k = kur({ GOOGLE_ISTEMCI_KIMLIGI: '' });
    expect(await k.girisYap(SAHIP)).toMatchObject({ durum: 503, veri: { hata: 'yapilandirma' } });
    expect((await k.jsonIste('durum')).veri.istemciKimligi).toBe('');
  });

  it('DO bağı yoksa 503 yapilandirma, 500 değil', async () => {
    const k = kur();
    delete k.env.REKLAM;
    expect(await k.girisYap(SAHIP)).toMatchObject({ durum: 503, veri: { hata: 'yapilandirma' } });
  });
});

describe('oturum ve çıkış', () => {
  it('jeton kanallar ucunu açar; çıkıştan sonra 401 oturum; çıkış tekrarı yine ok', async () => {
    const k = kur();
    const j = await k.gir(SAHIP);
    expect((await k.jsonIste('kanallar', { jeton: j })).durum).toBe(200);
    expect(await k.jsonIste('cikis', { method: 'POST', jeton: j })).toMatchObject({ durum: 200, veri: { ok: true } });
    expect(await k.jsonIste('kanallar', { jeton: j })).toMatchObject({ durum: 401, veri: { hata: 'oturum' } });
    expect(await k.jsonIste('cikis', { method: 'POST', jeton: j })).toMatchObject({ durum: 200, veri: { ok: true } });
    expect(await k.jsonIste('cikis', { method: 'POST' })).toMatchObject({ durum: 200, veri: { ok: true } });
  });

  it('jetonsuz, biçimsiz ya da uydurma jeton → 401 oturum', async () => {
    const k = kur();
    expect(await k.jsonIste('kanallar')).toMatchObject({ durum: 401, veri: { hata: 'oturum' } });
    expect(await k.jsonIste('kanallar', { jeton: 'kisa' })).toMatchObject({ durum: 401, veri: { hata: 'oturum' } });
    expect(await k.jsonIste('kanallar', { jeton: 'A'.repeat(43) })).toMatchObject({ durum: 401, veri: { hata: 'oturum' } });
  });

  it('reklamcı listeden çıkarılınca açık oturumu da düşer', async () => {
    const k = kur();
    const j = await k.gir(ARKADAS);
    k.env.REKLAMCILAR = SAHIP;
    expect(await k.jsonIste('kanallar', { jeton: j })).toMatchObject({ durum: 401, veri: { hata: 'oturum' } });
  });

  it('iki yönetici aynı anda ayrı oturumlarla çalışır', async () => {
    const k = kur();
    const a = await k.gir(SAHIP);
    const b = await k.gir(ARKADAS);
    expect((await k.jsonIste('kanallar', { jeton: a })).durum).toBe(200);
    expect((await k.jsonIste('kanallar', { jeton: b })).durum).toBe(200);
  });
});

describe('POST /v1/gelistirme/giris', () => {
  it('yayında (GELISTIRME yok) 404 yok: bilinmeyen yoldan farksız', async () => {
    const k = kur();
    expect(await k.jsonIste('gelistirme/giris', { method: 'POST', govde: { eposta: SAHIP } })).toMatchObject({ durum: 404, veri: { hata: 'yok' } });
    expect(k.sql('SELECT 1 FROM oturumlar')).toHaveLength(0);
  });

  it('GELISTIRME=1: Google\'sız giriş, allowlist yine uygulanır', async () => {
    const k = kur({ GELISTIRME: '1' });
    const g = await k.jsonIste('gelistirme/giris', { method: 'POST', govde: { eposta: SAHIP } });
    expect(g.durum).toBe(200);
    expect(g.veri.kullanici).toEqual({ eposta: SAHIP, ad: 'sahip', resim: '' });
    expect((await k.jsonIste('kanallar', { jeton: g.veri.jeton })).durum).toBe(200);
    expect(await k.jsonIste('gelistirme/giris', { method: 'POST', govde: { eposta: YABANCI } })).toMatchObject({ durum: 403, veri: { hata: 'yetki' } });
    expect(await k.jsonIste('gelistirme/giris', { method: 'POST', govde: { eposta: 'bozuk' } })).toMatchObject({ durum: 400, veri: { hata: 'gecersiz', alan: 'eposta' } });
  });
});

describe('genel', () => {
  it('bilinmeyen yol ya da yöntem 404 yok; her yanıt no-store + nosniff', async () => {
    const k = kur();
    const r = await k.iste('olmayan');
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ hata: 'yok' });
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect((await k.iste('durum', { method: 'POST', govde: {} })).status).toBe(404);
    expect((await k.iste('/baska/yol')).status).toBe(404);
  });

  it('64 KB\'den büyük JSON gövde 413 buyuk', async () => {
    const k = kur();
    const j = await k.gir(SAHIP);
    const r = await k.jsonIste('kayit', { method: 'POST', jeton: j, govde: { urun: 'dawayar', kanal: 'indir', baslik: 'x'.repeat(70 * 1024) } });
    expect(r).toMatchObject({ durum: 413, veri: { hata: 'buyuk' } });
  });
});
