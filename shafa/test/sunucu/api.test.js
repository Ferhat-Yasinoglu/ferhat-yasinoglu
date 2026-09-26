// Hesap sunucusunun uçtan uca davranışı: Worker yönlendiricisi + Hesap/Sinir
// DO'ları, bellekteki DO taklidiyle. Zaman `Date` taklidiyle ilerletilir.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { kur, anahtar, sarili, kasaGovdesi, KOKEN, DAVET } from './yardim.js';
import { AYAR, ozet, hex, utf8, b64urlYaz } from '../../sunucu/cekirdek.js';

const BASLANGIC = new Date('2026-09-25T08:00:00Z').getTime();
let saat;
const ilerle = (ms) => { saat += ms; vi.setSystemTime(saat); };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  saat = BASLANGIC;
  vi.setSystemTime(saat);
});
afterEach(() => vi.useRealTimers());

/* Megabaytlık dizilerde toEqual eleman eleman karşılaştırıp saniyeler harcıyor. */
const baytlar = async (r) => Buffer.from(await r.arrayBuffer());
const ayni = (a, b) => expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);

const PUT = (k, jeton, govde, surum, ek = {}) =>
  k.jsonIste('veri', { method: 'PUT', jeton, govde, basliklar: surum === undefined ? {} : { 'If-Match': `"${surum}"` }, ...ek });

describe('durum, yönlendirme, ortak başlıklar', () => {
  it('GET durum → { ok: true }; no-store ve nosniff', async () => {
    const { jsonIste } = kur();
    const { durum, veri, r } = await jsonIste('durum');
    expect(durum).toBe(200);
    expect(veri).toEqual({ ok: true });
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('bilinmeyen yol ve yöntem 404 yok', async () => {
    const { jsonIste } = kur();
    expect((await jsonIste('yokboyle')).veri).toEqual({ hata: 'yok' });
    expect((await jsonIste('durum', { method: 'POST', govde: {} })).durum).toBe(404);
    expect((await jsonIste('giris')).durum).toBe(404);
  });

  it('CORS yalnız izinli kökene; localhost yalnız geliştirme bayrağıyla', async () => {
    const yayin = kur();
    const izinli = await yayin.iste('durum');
    expect(izinli.headers.get('Access-Control-Allow-Origin')).toBe(KOKEN);
    expect(izinli.headers.get('Vary')).toContain('Origin');
    const yabanci = await yayin.iste('durum', { koken: 'https://kotu.example' });
    expect(yabanci.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const yerelKoken = await yayin.iste('durum', { koken: 'http://localhost:8788' });
    expect(yerelKoken.headers.get('Access-Control-Allow-Origin')).toBeNull();
    // Alt alan adı ya da önek taklidi izinli sayılmaz.
    for (const koken of [KOKEN + '.kotu.example', 'https://ferhat-yasinoglu.github.io.evil', 'http://ferhat-yasinoglu.github.io']) {
      expect((await yayin.iste('durum', { koken })).headers.get('Access-Control-Allow-Origin')).toBeNull();
    }

    const gel = kur({ DAVET_KODU: DAVET, GELISTIRME: '1' });
    for (const koken of ['http://localhost:8788', 'http://127.0.0.1:9101', 'http://localhost']) {
      expect((await gel.iste('durum', { koken })).headers.get('Access-Control-Allow-Origin')).toBe(koken);
    }
    expect((await gel.iste('durum', { koken: 'http://localhost.kotu.example' })).headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('ön-uçuş (OPTIONS) 204 ve tam CORS başlıkları', async () => {
    const { iste } = kur();
    for (const yol of ['veri', 'giris', 'kurtar/bitir']) {
      const r = await iste(yol, { method: 'OPTIONS', basliklar: { 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'authorization,if-match' } });
      expect(r.status).toBe(204);
      expect(r.headers.get('Access-Control-Allow-Origin')).toBe(KOKEN);
      expect(r.headers.get('Access-Control-Allow-Methods')).toBe('GET, PUT, POST, OPTIONS');
      expect(r.headers.get('Access-Control-Allow-Headers')).toBe('Authorization, Content-Type, If-Match');
      expect(r.headers.get('Access-Control-Expose-Headers')).toBe('X-Surum');
      expect(r.headers.get('Access-Control-Max-Age')).toBe('7200');
      expect(r.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    }
  });

  it('büyük ya da bozuk JSON gövde: 413 buyuk / 400 gecersiz', async () => {
    const { jsonIste } = kur();
    const koca = { kullanici: 'dr.nemuna', giris: anahtar(), dolgu: 'x'.repeat(5000) };
    expect((await jsonIste('giris', { method: 'POST', govde: koca })).veri).toEqual({ hata: 'buyuk' });
    expect((await jsonIste('giris', { method: 'POST', govde: '{bozuk' })).veri).toEqual({ hata: 'gecersiz' });
    expect((await jsonIste('giris', { method: 'POST', govde: '[1,2]' })).veri).toEqual({ hata: 'gecersiz' });
    expect((await jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: 'kisa' } })).veri).toEqual({ hata: 'gecersiz' });
  });
});

describe('kayıt', () => {
  it('davet kodu secret\'ı yoksa kayıt kapalı', async () => {
    const { jsonIste } = kur({});
    const r = await jsonIste('kayit', { method: 'POST', govde: { kullanici: 'dr.a', davet: 'x' } });
    expect(r).toMatchObject({ durum: 403, veri: { hata: 'kayit_kapali' } });
  });

  it('yanlış davet 403; doğru davet (Dari rakam, büyük/küçük harf, boşluk farkıyla) 201 + jeton', async () => {
    const k = kur({ DAVET_KODU: 'Bahar1404' });
    const govde = { kullanici: 'dr.a1', giris: anahtar(), kurtarma: anahtar(), sarili: sarili(), kurtarmaSarili: sarili() };
    expect((await k.jsonIste('kayit', { method: 'POST', govde: { ...govde, davet: 'bahar1403' } })).veri).toEqual({ hata: 'davet' });
    expect(await k.depoAnahtarlari('dr.a1')).toEqual([]);
    const r = await k.jsonIste('kayit', { method: 'POST', govde: { ...govde, davet: ' BAHAR۱۴۰۴ ' } });
    expect(r.durum).toBe(201);
    // Jetonun ilk parçası yönlendirme için kullanıcı adı.
    expect(r.veri.jeton.split('.')[0]).toBe(b64urlYaz(utf8('dr.a1')));
    const anahtarlar = await k.depoAnahtarlari('dr.a1');
    expect(anahtarlar).toContain('hesap');
    expect(anahtarlar.filter((a) => a.startsWith('oturum:'))).toHaveLength(1);
  });

  it('sunucu parolayı, K\'yi ya da anahtarların kendisini saklamaz: yalnız tuzlu özetler', async () => {
    const k = kur();
    const h = await k.hesapAc('dr.nemuna');
    const kayit = await k.env.HESAP.nesneler.get('dr.nemuna').cekirdek.depo.get('hesap');
    const metin = JSON.stringify(kayit);
    expect(metin).not.toContain(h.giris);
    expect(metin).not.toContain(h.kurtarma);
    expect(kayit.girisTuzu).toMatch(/^[0-9a-f]{32}$/);
    expect(kayit.girisOzeti).toBe(hex(await ozet(Uint8Array.from(kayit.girisTuzu.match(/../g), (x) => parseInt(x, 16)),
      Uint8Array.from(atob(h.giris.replace(/-/g, '+').replace(/_/g, '/') + '='), (c) => c.charCodeAt(0)))));
    expect(kayit.sarili).toEqual(h.sarili);
  });

  it('alınmış ad 409; ad sunucuda da normalleşir (Ali = ali)', async () => {
    const k = kur();
    await k.hesapAc('ali.karimi');
    const govde = { kullanici: ' ALI.Karimi ', davet: DAVET, giris: anahtar(), kurtarma: anahtar(), sarili: sarili(), kurtarmaSarili: sarili() };
    expect(await k.jsonIste('kayit', { method: 'POST', govde })).toMatchObject({ durum: 409, veri: { hata: 'alinmis' } });
  });

  it('geçersiz ad ve bozuk alanlar 400', async () => {
    const { jsonIste } = kur();
    const temel = { kullanici: 'dr.a', davet: DAVET, giris: anahtar(), kurtarma: anahtar(), sarili: sarili(), kurtarmaSarili: sarili() };
    for (const bozuk of [
      { kullanici: 'ab' }, { kullanici: '.abc' }, { kullanici: 'احمد' }, { kullanici: 'a'.repeat(33) },
      { giris: anahtar() + 'A' }, { kurtarma: 123 }, { sarili: { iv: 'x', veri: 'y' } },
      { kurtarmaSarili: { ...sarili(), fazla: 1 } }, { sarili: { iv: sarili().iv, veri: 'A'.repeat(1000) } },
    ]) {
      expect((await jsonIste('kayit', { method: 'POST', govde: { ...temel, ...bozuk } })).veri).toEqual({ hata: 'gecersiz' });
    }
  });

  it('IP başına saatte 20 kayıt denemesi', async () => {
    const k = kur();
    for (let i = 0; i < 20; i++) await k.hesapAc('dr.ip' + i);
    const r = await k.jsonIste('kayit', { method: 'POST', govde: { kullanici: 'dr.ip20' } });
    expect(r).toMatchObject({ durum: 429, veri: { hata: 'cok_istek' } });
    expect(r.veri.bekle).toBeGreaterThan(3000);
    await k.hesapAc('dr.baska', { ip: '198.51.100.9' });
    ilerle(60 * 60 * 1000);
    await k.hesapAc('dr.ip20');
  });

  it('günlük genel kayıt tavanı (300); kayıt başına tek sayaç yazması; ertesi gün açılır', async () => {
    const k = kur();
    await k.hesapAc('dr.bir');
    const genel = k.env.SINIR.nesneler.get('genel').cekirdek;
    expect(await genel.depo.get('kayit')).toEqual({ gun: '2026-09-25', sayi: 1 });
    // 299 kaydı tek tek açmak yerine sayaç (bellekteki kopyası) tavana çekiliyor.
    genel.kayit = { gun: '2026-09-25', sayi: AYAR.gunlukKayit };
    const r = await k.jsonIste('kayit', { method: 'POST', ip: '198.51.100.1', govde: { kullanici: 'dr.iki', davet: DAVET, giris: anahtar(), kurtarma: anahtar(), sarili: sarili(), kurtarmaSarili: sarili() } });
    expect(r).toMatchObject({ durum: 429, veri: { hata: 'cok_istek' } });
    expect(await k.depoAnahtarlari('dr.iki')).toEqual([]);
    ilerle(24 * 60 * 60 * 1000);
    await k.hesapAc('dr.iki', { ip: '198.51.100.1' });
    expect(await genel.depo.get('kayit')).toEqual({ gun: '2026-09-26', sayi: 1 });
  });
});

describe('giriş ve bilinmeyen kullanıcı eşdeğerliği', () => {
  it('doğru anahtar → jeton + sarılı K; yanlış → 401 yanlis', async () => {
    const k = kur();
    const h = await k.hesapAc();
    const r = await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'DR.Nemuna', giris: h.giris } });
    expect(r.durum).toBe(200);
    expect(r.veri.sarili).toEqual(h.sarili);
    expect(r.veri.jeton).not.toBe(h.jeton);
    expect((await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: anahtar() } })).veri).toEqual({ hata: 'yanlis' });
  });

  it('bilinmeyen kullanıcı yanlış parolayla AYNI yanıtı alır ve Hesap deposuna hiçbir şey yazılmaz', async () => {
    const k = kur();
    await k.hesapAc('dr.var');
    const var_ = await k.iste('giris', { method: 'POST', govde: { kullanici: 'dr.var', giris: anahtar() } });
    const yok = await k.iste('giris', { method: 'POST', govde: { kullanici: 'dr.yok', giris: anahtar() } });
    expect(yok.status).toBe(var_.status);
    expect(await yok.text()).toBe(await var_.text());
    expect([...yok.headers.keys()].sort()).toEqual([...var_.headers.keys()].sort());
    expect(await k.depoAnahtarlari('dr.yok')).toEqual([]);
    // Kurtarma ve jetonlu uçlar da bilinmeyen adda iz bırakmaz.
    await k.jsonIste('kurtar/ac', { method: 'POST', govde: { kullanici: 'dr.yok', kurtarma: anahtar() } });
    const sahteJeton = b64urlYaz(utf8('dr.yok')) + '.' + b64urlYaz(new Uint8Array(32));
    expect((await k.jsonIste('veri', { jeton: sahteJeton })).veri).toEqual({ hata: 'oturum' });
    expect((await k.jsonIste('cikis', { method: 'POST', jeton: sahteJeton })).veri).toEqual({ ok: true });
    expect(await k.depoAnahtarlari('dr.yok')).toEqual([]);
  });

  it('en çok 20 oturum: en uzun süredir kullanılmayan düşer', async () => {
    const k = kur();
    const h = await k.hesapAc();
    const jetonlar = [h.jeton];
    for (let i = 0; i < 20; i++) {
      ilerle(1000);
      jetonlar.push((await k.jsonIste('giris', { method: 'POST', ip: '198.51.100.' + i, govde: { kullanici: 'dr.nemuna', giris: h.giris } })).veri.jeton);
    }
    expect((await k.depoAnahtarlari('dr.nemuna')).filter((a) => a.startsWith('oturum:'))).toHaveLength(20);
    expect((await k.jsonIste('veri/surum', { jeton: jetonlar[0] })).veri).toEqual({ hata: 'oturum' });
    expect((await k.jsonIste('veri/surum', { jeton: jetonlar[1] })).veri).toEqual({ surum: '' });
  });
});

describe('hesap kilidi (Sinir, kullanıcı adının özetine bağlı)', () => {
  const yanlisGiris = (k, kullanici) => k.jsonIste('giris', { method: 'POST', govde: { kullanici, giris: anahtar() } });

  it('ilk 10 hata serbest; sonra 60 sn × 2^(n−10), tavan 1 saat; kilitliyken doğru parola da bekler', async () => {
    const k = kur();
    const h = await k.hesapAc();
    for (let i = 0; i < 10; i++) expect((await yanlisGiris(k, 'dr.nemuna')).veri).toEqual({ hata: 'yanlis' });
    const kilit = await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: h.giris } });
    expect(kilit).toMatchObject({ durum: 429, veri: { hata: 'kilitli', bekle: 60 } });
    ilerle(61 * 1000);
    expect((await yanlisGiris(k, 'dr.nemuna')).veri).toEqual({ hata: 'yanlis' });
    expect((await yanlisGiris(k, 'dr.nemuna')).veri).toEqual({ hata: 'kilitli', bekle: 120 });
    // Tavan: 16. hatadan sonra 60·2^6 = 3840 sn yerine 3600 sn.
    for (let i = 0; i < 5; i++) { ilerle(2 * 60 * 60 * 1000); await yanlisGiris(k, 'dr.nemuna'); }
    expect((await yanlisGiris(k, 'dr.nemuna')).veri).toEqual({ hata: 'kilitli', bekle: 3600 });
    // Süre dolunca doğru parola girer ve sayaç sıfırlanır (kilit nesnesi boşalır).
    ilerle(60 * 60 * 1000 + 1000);
    expect((await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: h.giris } })).durum).toBe(200);
    const kilitAdi = 'u:' + hex(await ozet(utf8('dr.nemuna')));
    expect(await k.depoAnahtarlari(kilitAdi, 'SINIR')).toEqual([]);
    for (let i = 0; i < 10; i++) expect((await yanlisGiris(k, 'dr.nemuna')).veri).toEqual({ hata: 'yanlis' });
  });

  it('aynı anda gönderilen denemeler de tek tek sayılır: 30 paralel denemeden en çok 10\'u parolaya ulaşır', async () => {
    const k = kur();
    const h = await k.hesapAc();
    // Parolanın gerçekten kaç kez denendiği Hesap DO'sunda sayılır: yanıtın
    // "kilitli" olması yetmez, deneme parolaya ulaştıysa zarar verilmiştir.
    const deneme = vi.spyOn(k.env.HESAP.nesneler.get('dr.nemuna').cekirdek, 'giris');
    const sonuclar = await Promise.all(Array.from({ length: 30 }, (_, i) =>
      k.jsonIste('giris', { method: 'POST', ip: '198.51.100.' + i, govde: { kullanici: 'dr.nemuna', giris: anahtar() } })));
    const hatalar = sonuclar.map((r) => r.veri.hata);
    expect(hatalar.filter((x) => x === 'yanlis')).toHaveLength(10);
    expect(hatalar.filter((x) => x === 'kilitli')).toHaveLength(20);
    expect(deneme).toHaveBeenCalledTimes(10);
    expect((await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: h.giris } })).veri.hata).toBe('kilitli');
  });

  it('bilinmeyen ad aynı kilide takılır (varlık sızmaz)', async () => {
    const k = kur();
    await k.hesapAc('dr.var');
    for (const ad of ['dr.var', 'dr.yok']) {
      for (let i = 0; i < 10; i++) await yanlisGiris(k, ad);
      expect((await yanlisGiris(k, ad)).veri).toEqual({ hata: 'kilitli', bekle: 60 });
    }
    expect(await k.depoAnahtarlari('dr.yok')).toEqual([]);
  });

  it('kilit yalnız yeni girişi durdurur: açık oturum eşitler, parolayı değiştirir, kodu yeniler, hesabı siler', async () => {
    const k = kur();
    const h = await k.hesapAc();
    // Yabancı yalnız adı biliyor: farklı IP'lerden yanlış girişlerle hesabı kilitler.
    const yabanci = async () => {
      for (let i = 0; i < 10; i++) await k.jsonIste('giris', { method: 'POST', ip: '198.51.100.' + i, govde: { kullanici: 'dr.nemuna', giris: anahtar() } });
      expect((await yanlisGiris(k, 'dr.nemuna')).veri.hata).toBe('kilitli');
    };
    await yabanci();
    expect((await k.jsonIste('veri/surum', { jeton: h.jeton })).veri).toEqual({ surum: '' });
    expect((await PUT(k, h.jeton, kasaGovdesi(100), '')).veri).toEqual({ surum: '1' });
    expect((await k.iste('veri', { jeton: h.jeton })).status).toBe(200);
    const kod = { yeniKurtarma: anahtar(), yeniKurtarmaSarili: sarili() };
    expect((await k.jsonIste('kurtarma/yenile', { method: 'POST', jeton: h.jeton, govde: { giris: h.giris, ...kod } })).veri).toEqual({ ok: true });
    // Parolayı bilen hekim kendini kanıtladı: yabancının kilidi sıfırlandı.
    expect((await yanlisGiris(k, 'dr.nemuna')).veri.hata).toBe('yanlis');
    // Çalınan cihazı düşürmek için parola değişimi kilitliyken de yapılır.
    await yabanci();
    const yeni = { yeniGiris: anahtar(), yeniSarili: sarili() };
    const p = await k.jsonIste('parola', { method: 'POST', jeton: h.jeton, govde: { giris: h.giris, ...yeni } });
    expect(p.durum).toBe(200);
    await yabanci();
    expect((await k.jsonIste('hesap/sil', { method: 'POST', jeton: p.veri.jeton, govde: { giris: yeni.yeniGiris } })).veri).toEqual({ ok: true });
  });

  it('jetonlu işlemde yanlış parola oturum başına sayılır: 5. yanlışta oturum düşer, hesap kilidine dokunulmaz', async () => {
    const k = kur();
    const h = await k.hesapAc();
    const ikinci = (await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: h.giris } })).veri.jeton;
    const yanlisParola = (jeton) => k.jsonIste('parola', { method: 'POST', jeton, govde: { giris: anahtar(), yeniGiris: anahtar(), yeniSarili: sarili() } });
    for (let i = 1; i < AYAR.oturumHataSiniri; i++) expect((await yanlisParola(h.jeton)).veri).toEqual({ hata: 'yanlis' });
    // Başarı sayacı sıfırlar: doğru parolayla kod yenilenir, sonra yine 4 hak var.
    expect((await k.jsonIste('kurtarma/yenile', { method: 'POST', jeton: h.jeton, govde: { giris: h.giris, yeniKurtarma: anahtar(), yeniKurtarmaSarili: sarili() } })).veri).toEqual({ ok: true });
    expect(await k.depoAnahtarlari('dr.nemuna')).not.toContainEqual(expect.stringMatching(/^hata:/));
    for (let i = 1; i < AYAR.oturumHataSiniri; i++) expect((await yanlisParola(h.jeton)).veri).toEqual({ hata: 'yanlis' });
    expect((await k.jsonIste('hesap/sil', { method: 'POST', jeton: h.jeton, govde: { giris: anahtar() } })).veri).toEqual({ hata: 'oturum' });
    // Oturum ve sayacı gitti; doğru parola da artık bu jetonla geçmez.
    expect((await k.jsonIste('hesap/sil', { method: 'POST', jeton: h.jeton, govde: { giris: h.giris } })).veri).toEqual({ hata: 'oturum' });
    expect((await k.jsonIste('veri/surum', { jeton: h.jeton })).veri).toEqual({ hata: 'oturum' });
    expect((await k.depoAnahtarlari('dr.nemuna')).filter((a) => /^(oturum|hata):/.test(a))).toHaveLength(1);
    // Öbür oturum etkilenmez; yeni giriş için hesap kilidi temiz.
    expect((await k.jsonIste('veri/surum', { jeton: ikinci })).durum).toBe(200);
    const kilitAdi = 'u:' + hex(await ozet(utf8('dr.nemuna')));
    expect(await k.depoAnahtarlari(kilitAdi, 'SINIR')).toEqual([]);
    expect((await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: h.giris } })).durum).toBe(200);
  });

  it('aynı oturumla aynı anda gönderilen 30 yanlış parola: en çok 5\'i parolaya ulaşır', async () => {
    const k = kur();
    const h = await k.hesapAc();
    const deneme = vi.spyOn(k.env.HESAP.nesneler.get('dr.nemuna').cekirdek, 'anahtarTutar');
    const sonuclar = await Promise.all(Array.from({ length: 30 }, (_, i) =>
      k.jsonIste('parola', { method: 'POST', ip: '198.51.100.' + i, jeton: h.jeton, govde: { giris: anahtar(), yeniGiris: anahtar(), yeniSarili: sarili() } })));
    const hatalar = sonuclar.map((r) => r.veri.hata);
    expect(deneme).toHaveBeenCalledTimes(AYAR.oturumHataSiniri);
    expect(hatalar.filter((x) => x === 'yanlis')).toHaveLength(AYAR.oturumHataSiniri - 1);
    expect(hatalar.filter((x) => x === 'oturum')).toHaveLength(30 - AYAR.oturumHataSiniri + 1);
    expect((await k.jsonIste('parola', { method: 'POST', jeton: h.jeton, govde: { giris: h.giris, yeniGiris: anahtar(), yeniSarili: sarili() } })).veri).toEqual({ hata: 'oturum' });
  });

  it('geçersiz oturumla gelen parolalı istek hiçbir sayaca dokunmaz', async () => {
    const k = kur();
    const h = await k.hesapAc();
    await k.jsonIste('cikis', { method: 'POST', jeton: h.jeton });
    for (let i = 0; i < 15; i++) {
      expect((await k.jsonIste('parola', { method: 'POST', jeton: h.jeton, govde: { giris: anahtar(), yeniGiris: anahtar(), yeniSarili: sarili() } })).veri).toEqual({ hata: 'oturum' });
    }
    expect((await k.depoAnahtarlari('dr.nemuna')).filter((a) => /^hata:/.test(a))).toEqual([]);
    expect((await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: h.giris } })).durum).toBe(200);
  });

  it('boşta 24 saat kalan kilit alarmla tamamen silinir', async () => {
    const k = kur();
    await yanlisGiris(k, 'dr.hayalet');
    const ad = 'u:' + hex(await ozet(utf8('dr.hayalet')));
    const nesne = k.env.SINIR.nesneler.get(ad);
    expect(await k.depoAnahtarlari(ad, 'SINIR')).toEqual(['kilit']);
    ilerle(23 * 60 * 60 * 1000);
    await nesne.alarm();            // erken çalışırsa (ör. yeni hatadan sonra) silmez, yeniden kurar
    expect(await k.depoAnahtarlari(ad, 'SINIR')).toEqual(['kilit']);
    ilerle(60 * 60 * 1000);
    await nesne.alarm();
    expect(await k.depoAnahtarlari(ad, 'SINIR')).toEqual([]);
    await nesne.cekirdek.depo.deleteAlarm();
  });
});

describe('IP sınırı (bellekte, IPv6 /64)', () => {
  it('10 dakikada 60 kimlik denemesi; başka IP ayrı; aynı /64 ortak', async () => {
    const k = kur();
    const dene = (ip) => k.jsonIste('kurtar/ac', { method: 'POST', ip, govde: { kullanici: 'dr.x', kurtarma: anahtar() } });
    for (let i = 0; i < 60; i++) expect((await dene('2001:db8:1:2::' + i.toString(16))).veri).toEqual({ hata: 'yanlis' });
    const r = await dene('2001:db8:1:2:ffff::1');
    expect(r).toMatchObject({ durum: 429, veri: { hata: 'cok_istek' } });
    expect(r.veri.bekle).toBeGreaterThan(500);
    expect((await dene('2001:db8:1:3::1')).veri).toEqual({ hata: 'yanlis' });
    expect((await dene('203.0.113.50')).veri).toEqual({ hata: 'yanlis' });
    ilerle(10 * 60 * 1000);
    expect((await dene('2001:db8:1:2::1')).veri).toEqual({ hata: 'yanlis' });
  });

  it('istemcinin yazdığı IP değil CF-Connecting-IP sayılır (yerel sunucu onu soketten yazar)', async () => {
    const k = kur();
    for (let i = 0; i < 60; i++) {
      await k.jsonIste('kurtar/ac', { method: 'POST', basliklar: { 'X-Forwarded-For': '10.0.0.' + i }, govde: { kullanici: 'dr.x', kurtarma: anahtar() } });
    }
    expect((await k.jsonIste('giris', { method: 'POST', basliklar: { 'X-Forwarded-For': '10.9.9.9' }, govde: { kullanici: 'dr.x', giris: anahtar() } })).veri.hata).toBe('cok_istek');
  });
});

describe('kurtarma', () => {
  it('kod K\'nin kurtarma sarmasını açar; yanlış ve bilinmeyen ad aynı 401', async () => {
    const k = kur();
    const h = await k.hesapAc();
    expect((await k.jsonIste('kurtar/ac', { method: 'POST', govde: { kullanici: 'dr.nemuna', kurtarma: h.kurtarma } })).veri).toEqual({ kurtarmaSarili: h.kurtarmaSarili });
    const yanlis = await k.jsonIste('kurtar/ac', { method: 'POST', govde: { kullanici: 'dr.nemuna', kurtarma: anahtar() } });
    const yok = await k.jsonIste('kurtar/ac', { method: 'POST', govde: { kullanici: 'dr.yok', kurtarma: anahtar() } });
    expect(yanlis).toMatchObject({ durum: 401, veri: { hata: 'yanlis' } });
    expect(yok.veri).toEqual(yanlis.veri);
  });

  it('kurtarma tek kullanımlık: yeni kod ve parola yazılır, bütün oturumlar düşer, eski kod ve parola geçmez', async () => {
    const k = kur();
    const h = await k.hesapAc();
    const ikinci = (await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: h.giris } })).veri.jeton;
    const yeni = { giris: anahtar(), sarili: sarili(), yeniKurtarma: anahtar(), yeniKurtarmaSarili: sarili() };
    const r = await k.jsonIste('kurtar/bitir', { method: 'POST', govde: { kullanici: 'dr.nemuna', kurtarma: h.kurtarma, ...yeni } });
    expect(r.durum).toBe(200);
    for (const eski of [h.jeton, ikinci]) expect((await k.jsonIste('veri/surum', { jeton: eski })).veri).toEqual({ hata: 'oturum' });
    expect((await k.jsonIste('veri/surum', { jeton: r.veri.jeton })).veri).toEqual({ surum: '' });
    expect((await k.jsonIste('kurtar/ac', { method: 'POST', govde: { kullanici: 'dr.nemuna', kurtarma: h.kurtarma } })).veri).toEqual({ hata: 'yanlis' });
    expect((await k.jsonIste('kurtar/bitir', { method: 'POST', govde: { kullanici: 'dr.nemuna', kurtarma: h.kurtarma, ...yeni } })).veri).toEqual({ hata: 'yanlis' });
    expect((await k.jsonIste('kurtar/ac', { method: 'POST', govde: { kullanici: 'dr.nemuna', kurtarma: yeni.yeniKurtarma } })).veri).toEqual({ kurtarmaSarili: yeni.yeniKurtarmaSarili });
    expect((await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: h.giris } })).veri).toEqual({ hata: 'yanlis' });
    expect((await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: yeni.giris } })).veri.sarili).toEqual(yeni.sarili);
  });

  it('yeni kurtarma kodu eskisiyle aynı olamaz', async () => {
    const k = kur();
    const h = await k.hesapAc();
    const r = await k.jsonIste('kurtar/bitir', { method: 'POST', govde: { kullanici: 'dr.nemuna', kurtarma: h.kurtarma, giris: anahtar(), sarili: sarili(), yeniKurtarma: h.kurtarma, yeniKurtarmaSarili: sarili() } });
    expect(r).toMatchObject({ durum: 400, veri: { hata: 'gecersiz' } });
    expect((await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: h.giris } })).durum).toBe(200);
  });

  it('kurtarma hesap kilidine takılmaz ve bitince kilidi sıfırlar', async () => {
    const k = kur();
    const h = await k.hesapAc();
    for (let i = 0; i < 12; i++) await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: anahtar() } });
    expect((await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: h.giris } })).veri.hata).toBe('kilitli');
    const yeni = { giris: anahtar(), sarili: sarili(), yeniKurtarma: anahtar(), yeniKurtarmaSarili: sarili() };
    expect((await k.jsonIste('kurtar/bitir', { method: 'POST', govde: { kullanici: 'dr.nemuna', kurtarma: h.kurtarma, ...yeni } })).durum).toBe(200);
    expect((await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: yeni.giris } })).durum).toBe(200);
  });

  it('oturumdayken kod yenilenir (parola gerekir); eski kod geçersiz, oturumlar kalır', async () => {
    const k = kur();
    const h = await k.hesapAc();
    const yeni = { yeniKurtarma: anahtar(), yeniKurtarmaSarili: sarili() };
    expect((await k.jsonIste('kurtarma/yenile', { method: 'POST', jeton: h.jeton, govde: { giris: anahtar(), ...yeni } })).veri).toEqual({ hata: 'yanlis' });
    expect((await k.jsonIste('kurtarma/yenile', { method: 'POST', govde: { giris: h.giris, ...yeni } })).veri).toEqual({ hata: 'oturum' });
    expect((await k.jsonIste('kurtarma/yenile', { method: 'POST', jeton: h.jeton, govde: { giris: h.giris, ...yeni } })).veri).toEqual({ ok: true });
    expect((await k.jsonIste('kurtar/ac', { method: 'POST', govde: { kullanici: 'dr.nemuna', kurtarma: h.kurtarma } })).veri).toEqual({ hata: 'yanlis' });
    expect((await k.jsonIste('kurtar/ac', { method: 'POST', govde: { kullanici: 'dr.nemuna', kurtarma: yeni.yeniKurtarma } })).veri).toEqual({ kurtarmaSarili: yeni.yeniKurtarmaSarili });
    expect((await k.jsonIste('veri/surum', { jeton: h.jeton })).durum).toBe(200);
  });
});

describe('parola, çıkış, silme', () => {
  it('parola değişince yeni jeton döner, öbür oturumlar düşer', async () => {
    const k = kur();
    const h = await k.hesapAc();
    const ikinci = (await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: h.giris } })).veri.jeton;
    const yeni = { yeniGiris: anahtar(), yeniSarili: sarili() };
    expect((await k.jsonIste('parola', { method: 'POST', jeton: h.jeton, govde: { giris: anahtar(), ...yeni } })).veri).toEqual({ hata: 'yanlis' });
    const r = await k.jsonIste('parola', { method: 'POST', jeton: h.jeton, govde: { giris: h.giris, ...yeni } });
    expect(r.durum).toBe(200);
    for (const eski of [h.jeton, ikinci]) expect((await k.jsonIste('veri/surum', { jeton: eski })).veri).toEqual({ hata: 'oturum' });
    expect((await k.jsonIste('veri/surum', { jeton: r.veri.jeton })).durum).toBe(200);
    expect((await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: h.giris } })).veri).toEqual({ hata: 'yanlis' });
    expect((await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: yeni.yeniGiris } })).veri.sarili).toEqual(yeni.yeniSarili);
  });

  it('çıkış yalnız o oturumu kapatır', async () => {
    const k = kur();
    const h = await k.hesapAc();
    const ikinci = (await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: h.giris } })).veri.jeton;
    expect((await k.jsonIste('cikis', { method: 'POST', jeton: h.jeton })).veri).toEqual({ ok: true });
    expect((await k.jsonIste('veri/surum', { jeton: h.jeton })).veri).toEqual({ hata: 'oturum' });
    expect((await k.jsonIste('veri/surum', { jeton: ikinci })).durum).toBe(200);
  });

  it('silme parola ister, bütün depoyu boşaltır; ad yeniden alınabilir', async () => {
    const k = kur();
    const h = await k.hesapAc();
    await PUT(k, h.jeton, kasaGovdesi(3000), '');
    expect((await k.jsonIste('hesap/sil', { method: 'POST', jeton: h.jeton, govde: { giris: anahtar() } })).veri).toEqual({ hata: 'yanlis' });
    expect((await k.jsonIste('hesap/sil', { method: 'POST', jeton: h.jeton, govde: { giris: h.giris } })).veri).toEqual({ ok: true });
    expect(await k.depoAnahtarlari('dr.nemuna')).toEqual([]);
    expect((await k.jsonIste('veri', { jeton: h.jeton })).veri).toEqual({ hata: 'oturum' });
    expect((await k.jsonIste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: h.giris } })).veri).toEqual({ hata: 'yanlis' });
    ilerle(AYAR.yazimAraligi);
    const yeni = await k.hesapAc('dr.nemuna');
    expect((await k.jsonIste('veri/surum', { jeton: yeni.jeton })).veri).toEqual({ surum: '' });
  });
});

describe('jeton ve oturum', () => {
  it('jetonsuz, bozuk ya da başka hesabın önekiyle gelen jeton 401 oturum', async () => {
    const k = kur();
    const a = await k.hesapAc('dr.a1');
    const b = await k.hesapAc('dr.b1');
    const [, aGovde] = a.jeton.split('.');
    const [bOnek] = b.jeton.split('.');
    for (const jeton of [undefined, 'bozuk', a.jeton + '.x', `${bOnek}.${aGovde}`, `${b64urlYaz(utf8('DR.A1'))}.${aGovde}`, `${b64urlYaz(utf8('dr.a1'))}.${b64urlYaz(new Uint8Array(32))}`]) {
      const r = await k.jsonIste('veri/surum', { jeton });
      expect(r).toMatchObject({ durum: 401, veri: { hata: 'oturum' } });
    }
    expect((await k.jsonIste('veri/surum', { jeton: a.jeton })).durum).toBe(200);
  });

  it('365 gün kullanılmayan oturum düşer; son kullanım günde en çok bir kez yazılır', async () => {
    const k = kur();
    const h = await k.hesapAc();
    const depo = k.env.HESAP.nesneler.get('dr.nemuna').cekirdek.depo;
    const anahtarAdi = (await k.depoAnahtarlari('dr.nemuna')).find((a) => a.startsWith('oturum:'));
    ilerle(60 * 60 * 1000);
    await k.jsonIste('veri/surum', { jeton: h.jeton });
    expect((await depo.get(anahtarAdi)).son).toBe(BASLANGIC);
    ilerle(24 * 60 * 60 * 1000);
    await k.jsonIste('veri/surum', { jeton: h.jeton });
    expect((await depo.get(anahtarAdi)).son).toBe(saat);
    ilerle(364 * 24 * 60 * 60 * 1000);
    expect((await k.jsonIste('veri/surum', { jeton: h.jeton })).durum).toBe(200);
    ilerle(366 * 24 * 60 * 60 * 1000);
    expect((await k.jsonIste('veri/surum', { jeton: h.jeton })).veri).toEqual({ hata: 'oturum' });
    expect(await depo.get(anahtarAdi)).toBeUndefined();
  });
});

describe('şifreli kasa (veri)', () => {
  it('boşken surum "" ve GET 204; PUT If-Match ile; GET aynı baytları X-Surum ile döndürür', async () => {
    const k = kur();
    const h = await k.hesapAc();
    expect((await k.jsonIste('veri/surum', { jeton: h.jeton })).veri).toEqual({ surum: '' });
    const bos = await k.iste('veri', { jeton: h.jeton });
    expect(bos.status).toBe(204);
    expect(bos.headers.get('X-Surum')).toBe('');
    const govde = kasaGovdesi(5000);
    const r = await PUT(k, h.jeton, govde, '');
    expect(r.veri).toEqual({ surum: '1' });
    expect(r.r.headers.get('X-Surum')).toBe('1');
    const geri = await k.iste('veri', { jeton: h.jeton });
    expect(geri.status).toBe(200);
    expect(geri.headers.get('X-Surum')).toBe('1');
    expect(geri.headers.get('Content-Type')).toContain('application/json');
    ayni(await baytlar(geri), govde);
    expect((await k.jsonIste('veri/surum', { jeton: h.jeton })).veri).toEqual({ surum: '1' });
    // Tırnaksız If-Match de kabul.
    ilerle(AYAR.yazimAraligi);
    expect((await k.jsonIste('veri', { method: 'PUT', jeton: h.jeton, govde: kasaGovdesi(100), basliklar: { 'If-Match': '1' } })).veri).toEqual({ surum: '2' });
  });

  it('If-Match yoksa 400; eski sürüme yazma 409 cakisma ve hiçbir şey değişmez', async () => {
    const k = kur();
    const h = await k.hesapAc();
    expect((await PUT(k, h.jeton, kasaGovdesi(100))).veri).toEqual({ hata: 'gecersiz' });
    await PUT(k, h.jeton, kasaGovdesi(100, 1), '');
    ilerle(AYAR.yazimAraligi);
    for (const eski of ['', '0', '2']) {
      expect(await PUT(k, h.jeton, kasaGovdesi(100, 2), eski)).toMatchObject({ durum: 409, veri: { hata: 'cakisma' } });
    }
    ayni(await baytlar(await k.iste('veri', { jeton: h.jeton })), kasaGovdesi(100, 1));
  });

  it('gövde kasa gibi başlamıyorsa 400 (şifresiz yedek saklanmaz)', async () => {
    const k = kur();
    const h = await k.hesapAc();
    for (const govde of [
      new TextEncoder().encode('{"bicim":"shafa-yedek","koleksiyonlar":{}}'),
      new TextEncoder().encode(' {"bicim":"shafa-kasa"}'),
      new TextEncoder().encode('{"bicim":"shafa-'),
      new Uint8Array(0),
    ]) {
      expect((await PUT(k, h.jeton, govde, '')).veri).toEqual({ hata: 'gecersiz' });
    }
    expect((await k.jsonIste('veri/surum', { jeton: h.jeton })).veri).toEqual({ surum: '' });
  });

  it('yazım temposu: iki PUT arası 5 sn, günde en çok 1000', async () => {
    const k = kur();
    const h = await k.hesapAc();
    await PUT(k, h.jeton, kasaGovdesi(100), '');
    ilerle(2000);
    expect(await PUT(k, h.jeton, kasaGovdesi(100), '1')).toMatchObject({ durum: 429, veri: { hata: 'cok_istek', bekle: 3 } });
    ilerle(3000);
    expect((await PUT(k, h.jeton, kasaGovdesi(100), '1')).veri).toEqual({ surum: '2' });
    const depo = k.env.HESAP.nesneler.get('dr.nemuna').cekirdek;
    expect(await depo.depo.get('yazim')).toMatchObject({ gun: '2026-09-25', sayi: 2 });
    depo.yazim = { son: saat, gun: '2026-09-25', sayi: AYAR.gunlukYazim };
    ilerle(AYAR.yazimAraligi);
    const r = await PUT(k, h.jeton, kasaGovdesi(100), '2');
    expect(r).toMatchObject({ durum: 429, veri: { hata: 'cok_istek' } });
    expect(r.veri.bekle).toBeGreaterThan(10 * 60 * 60);
  });

  it('gövdeyi okumadan verilen hatada (400, 401, 429) gövde sonuna kadar tüketilir', async () => {
    // workerd'da DO gövdeyi okumadan yanıt verirse Worker'daki aktarma borusu
    // yanıttan sonra okumaya devam ediyor ve bağlantı kopuyordu: istemci 401
    // ya da 429 yerine ağ hatası görüyordu (wrangler dev denemesinde yakalandı).
    const k = kur();
    const h = await k.hesapAc();
    const sayacli = () => {
      const d = { kapandi: false };
      let verilen = 0;
      d.akis = new ReadableStream({
        pull(c) {
          if (verilen >= 1024 * 1024) { d.kapandi = true; return c.close(); }
          c.enqueue(verilen === 0 ? kasaGovdesi(64 * 1024) : new Uint8Array(64 * 1024));
          verilen += 64 * 1024;
        },
      });
      return d;
    };
    await PUT(k, h.jeton, kasaGovdesi(100), '');
    const tempo = sayacli();
    expect((await PUT(k, h.jeton, tempo.akis, '1')).veri.hata).toBe('cok_istek');
    expect(tempo.kapandi).toBe(true);
    ilerle(AYAR.yazimAraligi);
    const surumsuz = sayacli();
    expect((await PUT(k, h.jeton, surumsuz.akis)).veri).toEqual({ hata: 'gecersiz' });
    expect(surumsuz.kapandi).toBe(true);
    await k.jsonIste('cikis', { method: 'POST', jeton: h.jeton });
    const oturumsuz = sayacli();
    expect((await PUT(k, h.jeton, oturumsuz.akis, '1')).veri).toEqual({ hata: 'oturum' });
    expect(oturumsuz.kapandi).toBe(true);
  });

  it('20 MB tavanı: Content-Length ile de, sayarak da 413 buyuk', async () => {
    const k = kur();
    const h = await k.hesapAc();
    const beyan = await PUT(k, h.jeton, kasaGovdesi(10), '', { basliklar: { 'If-Match': '""', 'Content-Length': String(AYAR.veriSiniri + 1) } });
    expect(beyan).toMatchObject({ durum: 413, veri: { hata: 'buyuk' } });
    // Uzunluk bildirilmeyen akış: sunucu okurken sayar.
    const MB = 1024 * 1024;
    let gonderilen = 0;
    const akis = new ReadableStream({
      pull(c) {
        if (gonderilen > AYAR.veriSiniri + MB) return c.close();
        c.enqueue(gonderilen === 0 ? kasaGovdesi(MB) : new Uint8Array(MB));
        gonderilen += MB;
      },
    });
    expect(await PUT(k, h.jeton, akis, '')).toMatchObject({ durum: 413, veri: { hata: 'buyuk' } });
    expect(gonderilen).toBeLessThan(AYAR.veriSiniri + 3 * MB);
    expect((await k.jsonIste('veri/surum', { jeton: h.jeton })).veri).toEqual({ surum: '' });
    // Tam sınırdaki kasa kabul.
    expect((await PUT(k, h.jeton, kasaGovdesi(AYAR.veriSiniri), '')).veri).toEqual({ surum: '1' });
  });

  it('4 MB\'tan büyük kasa ≤1,9 MB parçalara bölünür; daha küçüğüyle değişince artık parçalar da gider', async () => {
    const k = kur();
    const h = await k.hesapAc();
    const buyuk = kasaGovdesi(4.5 * 1024 * 1024, 3);
    expect((await PUT(k, h.jeton, buyuk, '')).veri).toEqual({ surum: '1' });
    const depo = k.env.HESAP.nesneler.get('dr.nemuna').cekirdek.depo;
    const parcalar = [...(await depo.list({ prefix: 'veri:p:' }))];
    expect(parcalar.map(([a]) => a)).toEqual(['veri:p:0', 'veri:p:1', 'veri:p:2']);
    for (const [, p] of parcalar) expect(p.length).toBeLessThanOrEqual(AYAR.parcaBoyu);
    expect(await depo.get('veri:bas')).toEqual({ surum: '1', parca: 3, boy: buyuk.length });
    ayni(await baytlar(await k.iste('veri', { jeton: h.jeton })), buyuk);

    ilerle(AYAR.yazimAraligi);
    const kucuk = kasaGovdesi(2000, 4);
    expect((await PUT(k, h.jeton, kucuk, '1')).veri).toEqual({ surum: '2' });
    expect([...(await depo.list({ prefix: 'veri:p:' })).keys()]).toEqual(['veri:p:0']);
    ayni(await baytlar(await k.iste('veri', { jeton: h.jeton })), kucuk);
  });

  it('bütün yazma (parçalar, başlık, tempo, artık parçaların silinmesi) tek eşzamanlı blokta', async () => {
    const k = kur();
    const h = await k.hesapAc();
    await PUT(k, h.jeton, kasaGovdesi(4.5 * 1024 * 1024), '');
    ilerle(AYAR.yazimAraligi);
    // Depoyu izleyen vekil: her yazma çağrısı, aralarında await olmayan
    // çağrıların paylaştığı bir "tur" numarasıyla kaydedilir.
    const cekirdek = k.env.HESAP.nesneler.get('dr.nemuna').cekirdek;
    const gercek = cekirdek.depo;
    const kayit = [];
    let tur = 0;
    let acik = false;
    cekirdek.depo = new Proxy(gercek, {
      get(hedef, ad) {
        const f = hedef[ad];
        if (typeof f !== 'function') return f;
        return (...a) => {
          if (['put', 'delete', 'deleteAll'].includes(ad)) {
            if (!acik) { acik = true; tur++; queueMicrotask(() => { acik = false; }); }
            kayit.push({ ad, tur, anahtarlar: typeof a[0] === 'string' ? [a[0]] : Array.isArray(a[0]) ? a[0] : Object.keys(a[0]) });
          }
          return f.apply(hedef, a);
        };
      },
    });
    expect((await PUT(k, h.jeton, kasaGovdesi(1000), '1')).veri).toEqual({ surum: '2' });
    expect(kayit.map((x) => x.ad).sort()).toEqual(['delete', 'put']);
    expect(new Set(kayit.map((x) => x.tur)).size).toBe(1);
    expect(kayit.flatMap((x) => x.anahtarlar).sort()).toEqual(['veri:bas', 'veri:p:0', 'veri:p:1', 'veri:p:2', 'yazim']);
  });

  it('aynı sürüme aynı anda iki yazma: biri kazanır, öbürü 409; kasa karışmaz', async () => {
    const k = kur();
    const h = await k.hesapAc();
    const denetimli = () => {
      let c;
      const akis = new ReadableStream({ start(x) { c = x; } });
      return { akis, c };
    };
    const a = denetimli();
    const b = denetimli();
    const ra = PUT(k, h.jeton, a.akis, '');
    const rb = PUT(k, h.jeton, b.akis, '');
    a.c.enqueue(kasaGovdesi(3000, 5));
    b.c.enqueue(kasaGovdesi(3000, 6));
    // İkisi de gövdeyi okumaya başlayana (oturum ve tempo denetimini geçene)
    // kadar beklenir. Sabit 10 ms yük altında yetmiyordu: ilk yazma bitmeden
    // ikincisi tempo denetimine bile varamıyor, 409 yerine 429 alıyordu.
    while (!(a.c.desiredSize > 0 && b.c.desiredSize > 0)) await new Promise((c) => setTimeout(c, 1));
    // İki gövde de AYNI anda biter: sürüm denetimi ile yazma arasında await
    // olsaydı ikisi de denetimi geçip yazardı.
    a.c.close();
    b.c.close();
    const sonuclar = [await ra, await rb];
    expect(sonuclar.map((r) => r.durum).sort()).toEqual([200, 409]);
    const kazanan = sonuclar[0].durum === 200 ? 5 : 6;
    ayni(await baytlar(await k.iste('veri', { jeton: h.jeton })), kasaGovdesi(3000, kazanan));
  });
});

describe('her durumda CORS başlıkları (ağ hatası sanılmasın)', () => {
  const denetle = (r) => {
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(KOKEN);
    expect(r.headers.get('Access-Control-Expose-Headers')).toBe('X-Surum');
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
  };

  it('200, 201, 204, 400, 401, 403, 404, 409, 413, 429', async () => {
    const k = kur();
    const h = await k.hesapAc();
    const durumlar = {};
    const kaydet = async (p) => { const r = await p; durumlar[r.status] = true; denetle(r); };
    await kaydet(k.iste('durum'));
    await kaydet(k.iste('kayit', { method: 'POST', govde: { kullanici: 'dr.yeni', davet: DAVET, giris: anahtar(), kurtarma: anahtar(), sarili: sarili(), kurtarmaSarili: sarili() } }));
    await kaydet(k.iste('veri', { jeton: h.jeton }));
    await kaydet(k.iste('giris', { method: 'POST', govde: '{' }));
    await kaydet(k.iste('giris', { method: 'POST', govde: { kullanici: 'dr.nemuna', giris: anahtar() } }));
    await kaydet(k.iste('kayit', { method: 'POST', govde: { kullanici: 'dr.x', davet: 'yanlis', giris: anahtar(), kurtarma: anahtar(), sarili: sarili(), kurtarmaSarili: sarili() } }));
    await kaydet(k.iste('yok'));
    await kaydet(k.iste('kayit', { method: 'POST', govde: { kullanici: 'dr.nemuna', davet: DAVET, giris: anahtar(), kurtarma: anahtar(), sarili: sarili(), kurtarmaSarili: sarili() } }));
    await kaydet(k.iste('veri', { method: 'PUT', jeton: h.jeton, govde: kasaGovdesi(100), basliklar: { 'If-Match': '"9"' } }));
    await kaydet(k.iste('veri', { method: 'PUT', jeton: h.jeton, govde: kasaGovdesi(10), basliklar: { 'If-Match': '""', 'Content-Length': String(AYAR.veriSiniri + 1) } }));
    await PUT(k, h.jeton, kasaGovdesi(100), '');
    await kaydet(k.iste('veri', { method: 'PUT', jeton: h.jeton, govde: kasaGovdesi(100), basliklar: { 'If-Match': '"1"' } }));
    expect(Object.keys(durumlar).map(Number).sort((a, b) => a - b)).toEqual([200, 201, 204, 400, 401, 403, 404, 409, 413, 429]);
  });

  it('depolama kotası dolunca 503 kota; beklenmeyen hata 500 sunucu — ikisi de JSON ve CORS\'lu', async () => {
    const k = kur();
    const h = await k.hesapAc();
    const cekirdek = k.env.HESAP.nesneler.get('dr.nemuna').cekirdek;
    const hata = vi.spyOn(console, 'error').mockImplementation(() => {});
    const kota = vi.spyOn(cekirdek.depo, 'put').mockRejectedValueOnce(new Error('Exceeded allowed rows written in Durable Objects free tier.'));
    const r503 = await PUT(k, h.jeton, kasaGovdesi(100), '');
    expect(r503).toMatchObject({ durum: 503, veri: { hata: 'kota' } });
    denetle(r503.r);
    kota.mockRestore();
    // Başarısız yazma bellekteki durumu bozmadı: aynı sürüme yeniden yazılabilir.
    expect((await PUT(k, h.jeton, kasaGovdesi(100), '')).veri).toEqual({ surum: '1' });

    vi.spyOn(cekirdek.depo, 'get').mockRejectedValueOnce(new Error('beklenmedik'));
    const r500 = await k.jsonIste('veri', { jeton: h.jeton });
    expect(r500).toMatchObject({ durum: 500, veri: { hata: 'sunucu' } });
    denetle(r500.r);
    expect(hata.mock.calls.flat().join(' ')).not.toContain(h.jeton);
    hata.mockRestore();
  });

  it('kilitli ve IP sınırı 429 yanıtları da CORS\'lu', async () => {
    const k = kur();
    for (let i = 0; i < 10; i++) await k.iste('giris', { method: 'POST', govde: { kullanici: 'dr.z', giris: anahtar() } });
    const kilit = await k.iste('giris', { method: 'POST', govde: { kullanici: 'dr.z', giris: anahtar() } });
    expect(kilit.status).toBe(429);
    denetle(kilit);
  });
});
