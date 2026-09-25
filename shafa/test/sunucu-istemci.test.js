// İstemcinin HTTP katmanı (app/js/senkron/sunucu.js) sahte fetch ve sahte
// saatle: hata kodlarının eşlenmesi, zaman aşımları, sınırlar ve başlıklar.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { sunucuIstemcisi, sunucuTasima, SURELER } from '../app/js/senkron/sunucu.js';
import { sunucuAdresi, VARSAYILAN_SUNUCU } from '../app/js/senkron/sunucu-adresi.js';
import { VERI_SINIRI } from '../app/js/paylasilan/hesap-kurallari.js';

const ADRES = 'https://shafa-sunucu.test';
const JETON = 'ZHIubmVtdW5h.' + 'A'.repeat(43);

const jsonYanit = (veri, durum = 200, basliklar = {}) =>
  new Response(JSON.stringify(veri), { status: durum, headers: { 'Content-Type': 'application/json', ...basliklar } });

/** İstekleri kaydeden sahte fetch; `yanit(url, init)` ne dönerse o. */
function sahte(yanit) {
  const istekler = [];
  const fetch = vi.fn(async (url, init = {}) => {
    istekler.push({ url, init, basliklar: new Headers(init.headers) });
    return yanit(url, init);
  });
  return { fetch, istekler };
}

/** Sinyal kesilene kadar hiç yanıt vermeyen fetch (asılı kalan sunucu). */
const asili = () => sahte((url, init) => new Promise((_, red) => {
  init.signal.addEventListener('abort', () => red(new DOMException('kesildi', 'AbortError')));
}));

const kodu = async (soz) => { try { await soz; return 'HATA_YOK'; } catch (e) { return e.kod; } };

describe('hata eşlemesi', () => {
  const istemci = (yanit, cevrimici = true) => sunucuIstemcisi(ADRES, { fetch: sahte(yanit).fetch, cevrimici: () => cevrimici });

  it('çevrimiçiyken ulaşılamayan sunucu "sunucu_yok", çevrimdışıyken "ag"', async () => {
    const dusen = () => { throw new TypeError('Failed to fetch'); };
    expect(await kodu(istemci(dusen, true).giris({}))).toBe('sunucu_yok');
    expect(await kodu(istemci(dusen, false).giris({}))).toBe('ag');
  });

  it('sunucunun kodları olduğu gibi geçiyor', async () => {
    for (const [durum, hata] of [[400, 'gecersiz'], [403, 'davet'], [403, 'kayit_kapali'], [409, 'alinmis'], [401, 'yanlis'],
      [401, 'oturum'], [409, 'cakisma'], [413, 'buyuk'], [429, 'cok_istek'], [429, 'kilitli']]) {
      expect(await kodu(istemci(() => jsonYanit({ hata }, durum)).giris({}))).toBe(hata);
    }
  });

  it('sunucu kotası "sunucu_dolu" (cihazın "kota"sıyla karışmıyor), gerisi "sunucu_hata"', async () => {
    expect(await kodu(istemci(() => jsonYanit({ hata: 'kota' }, 503)).giris({}))).toBe('sunucu_dolu');
    expect(await kodu(istemci(() => jsonYanit({ hata: 'sunucu' }, 500)).giris({}))).toBe('sunucu_hata');
    expect(await kodu(istemci(() => jsonYanit({ hata: 'yok' }, 404)).giris({}))).toBe('sunucu_hata');
    expect(await kodu(istemci(() => new Response('<html>1027</html>', { status: 429 })).giris({}))).toBe('sunucu_hata');
    expect(await kodu(istemci(() => new Response('<html>portal</html>', { status: 200 })).giris({}))).toBe('sunucu_hata');
  });

  it('bekleme süresi dakikaya çevriliyor', async () => {
    const i = istemci(() => jsonYanit({ hata: 'kilitli', bekle: 125 }, 429));
    await expect(i.giris({})).rejects.toMatchObject({ kod: 'kilitli', veri: { bekle: 125, dakika: 3, durum: 429 } });
  });

  it('kodda bir hata ağ hatası diye örtülmüyor', async () => {
    const i = istemci(() => { throw new RangeError('hata'); });
    await expect(i.giris({})).rejects.toBeInstanceOf(RangeError);
  });

  it('adres yoksa hiç istek yok', () => {
    expect(() => sunucuIstemcisi('')).toThrow(expect.objectContaining({ kod: 'sunucu_adresi_yok' }));
  });
});

describe('istekler', () => {
  it('kimlik çağrısı JSON POST, jetonlu çağrı Bearer taşıyor', async () => {
    const { fetch, istekler } = sahte(() => jsonYanit({ jeton: 'x' }));
    const i = sunucuIstemcisi(ADRES + '/', { fetch });
    await i.kayit({ kullanici: 'dr.nemuna' });
    await i.parola(JETON, { giris: 'g' });
    expect(istekler[0].url).toBe(ADRES + '/v1/kayit');
    expect(istekler[0].init.method).toBe('POST');
    expect(JSON.parse(istekler[0].init.body)).toEqual({ kullanici: 'dr.nemuna' });
    expect(istekler[0].basliklar.get('Authorization')).toBe(null);
    expect(istekler[1].url).toBe(ADRES + '/v1/parola');
    expect(istekler[1].basliklar.get('Authorization')).toBe('Bearer ' + JETON);
  });

  it('PUT ham bayt, tırnaklı If-Match ve yeni sürüm', async () => {
    const { fetch, istekler } = sahte(() => jsonYanit({ surum: '8' }, 200, { 'X-Surum': '8' }));
    const i = sunucuIstemcisi(ADRES, { fetch });
    const govde = new TextEncoder().encode('{"bicim":"shafa-kasa"}');
    expect(await i.veriYaz(JETON, govde, '7')).toEqual({ surum: '8' });
    expect(await i.veriYaz(JETON, govde, '')).toEqual({ surum: '8' });
    expect(istekler[0].init.method).toBe('PUT');
    expect(istekler[0].init.body).toBe(govde);
    expect(istekler[0].basliklar.get('If-Match')).toBe('"7"');
    expect(istekler[1].basliklar.get('If-Match')).toBe('""');
  });

  it('sınırdan büyük kasa hiç gönderilmiyor', async () => {
    const { fetch } = sahte(() => jsonYanit({}));
    const i = sunucuIstemcisi(ADRES, { fetch });
    await expect(i.veriYaz(JETON, new Uint8Array(VERI_SINIRI + 1), '1')).rejects.toMatchObject({ kod: 'buyuk' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('GET veri: 204 kasa yok, 200 baytlar ve X-Surum', async () => {
    let bos = true;
    const { fetch } = sahte(() => (bos ? new Response(null, { status: 204, headers: { 'X-Surum': '' } })
      : new Response('{"bicim":"shafa-kasa"}', { headers: { 'X-Surum': '3' } })));
    const i = sunucuIstemcisi(ADRES, { fetch });
    expect(await i.veriOku(JETON)).toEqual({ baytlar: null, surum: '' });
    bos = false;
    const r = await i.veriOku(JETON);
    expect(new TextDecoder().decode(r.baytlar)).toBe('{"bicim":"shafa-kasa"}');
    expect(r.surum).toBe('3');
  });

  it('taşıyıcı: kasa JSON\'u okunamıyorsa "kasa_bozuk"; yazma okunan sürümle', async () => {
    const { fetch, istekler } = sahte((url, init) => (init.method === 'PUT' ? jsonYanit({ surum: '2' })
      : new Response('{bozuk', { headers: { 'X-Surum': '1' } })));
    const t = sunucuTasima(ADRES, JETON, { fetch });
    await expect(t.oku()).rejects.toMatchObject({ kod: 'kasa_bozuk' });
    expect(await t.yaz({ bicim: 'shafa-kasa', surum: 2 }, { surum: '1' })).toEqual({ surum: '2' });
    expect(new TextDecoder().decode(istekler[1].init.body)).toBe('{"bicim":"shafa-kasa","surum":2}');
  });

  it('409 cakisma taşıyıcıdan eşitlemenin beklediği kodla çıkıyor', async () => {
    const t = sunucuTasima(ADRES, JETON, { fetch: sahte(() => jsonYanit({ hata: 'cakisma' }, 409)).fetch });
    await expect(t.yaz({ bicim: 'shafa-kasa' }, { surum: '1' })).rejects.toMatchObject({ kod: 'cakisma' });
  });
});

describe('zaman aşımları', () => {
  afterEach(() => vi.useRealTimers());
  const saat = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

  it('kimlik çağrısı 20 sn sonra "zaman_asimi"', async () => {
    saat();
    const i = sunucuIstemcisi(ADRES, { fetch: asili().fetch });
    const soz = kodu(i.giris({}));
    await vi.advanceTimersByTimeAsync(SURELER.kimlik - 1);
    let bitti = false;
    soz.then(() => { bitti = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(bitti).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await soz).toBe('zaman_asimi');
  });

  it('indirme: bayt geldikçe süre baştan başlıyor, toplam süreye sınır yok; 30 sn sessizlikte kesiliyor', async () => {
    saat();
    let akisDenetim;
    const { fetch } = sahte((url, init) => {
      const akis = new ReadableStream({
        start(d) {
          akisDenetim = d;
          init.signal.addEventListener('abort', () => d.error(new DOMException('kesildi', 'AbortError')));
        },
      });
      return new Response(akis, { headers: { 'X-Surum': '5' } });
    });
    const i = sunucuIstemcisi(ADRES, { fetch });
    const soz = i.veriOku(JETON).then((r) => r, (e) => e);
    // 4 parça, aralarında 25'er sn: toplam 100 sn, hiçbir aralık 30 sn değil.
    for (let n = 0; n < 4; n++) {
      await vi.advanceTimersByTimeAsync(25000);
      akisDenetim.enqueue(new Uint8Array([65 + n]));
    }
    await vi.advanceTimersByTimeAsync(SURELER.bosta - 1);
    let bitti = false;
    soz.then(() => { bitti = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(bitti).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await soz).toMatchObject({ kod: 'zaman_asimi' });
  });

  it('indirme tamamlanırsa baytlar birleşiyor', async () => {
    const parcalar = [new Uint8Array([1, 2]), new Uint8Array([3])];
    const { fetch } = sahte(() => new Response(new ReadableStream({
      start(d) { for (const p of parcalar) d.enqueue(p); d.close(); },
    }), { headers: { 'X-Surum': '9' } }));
    const r = await sunucuIstemcisi(ADRES, { fetch }).veriOku(JETON);
    expect([...r.baytlar]).toEqual([1, 2, 3]);
  });

  it('sınırı aşan indirme kesiliyor', async () => {
    const { fetch } = sahte(() => new Response(new ReadableStream({
      pull(d) { d.enqueue(new Uint8Array(4 * 1024 * 1024)); },
    })));
    await expect(sunucuIstemcisi(ADRES, { fetch }).veriOku(JETON)).rejects.toMatchObject({ kod: 'buyuk' });
  });

  it('yükleme süresi boyla büyüyor: 60 sn + her 10 KB için 1 sn', async () => {
    saat();
    const i = sunucuIstemcisi(ADRES, { fetch: asili().fetch });
    const govde = new Uint8Array(100 * 1024);             // 10 sn pay
    const soz = kodu(i.veriYaz(JETON, govde, '1'));
    let bitti = false;
    soz.then(() => { bitti = true; });
    await vi.advanceTimersByTimeAsync(SURELER.yuklemeTaban + 10000 - 1);
    expect(bitti).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await soz).toBe('zaman_asimi');
  });
});

describe('sunucu adresi', () => {
  it('yayında adres henüz yok: hesaplar kapalı', () => {
    expect(VARSAYILAN_SUNUCU).toBe('');
    expect(sunucuAdresi({ hostname: 'ferhat-yasinoglu.github.io', origin: 'https://ferhat-yasinoglu.github.io' })).toBe('');
    expect(sunucuAdresi(undefined)).toBe('');
  });
  it('yerelde (localhost, 127.0.0.1) API aynı kökenden', () => {
    expect(sunucuAdresi({ hostname: 'localhost', origin: 'http://localhost:8788' })).toBe('http://localhost:8788');
    expect(sunucuAdresi({ hostname: '127.0.0.1', origin: 'http://127.0.0.1:9' })).toBe('http://127.0.0.1:9');
    expect(sunucuAdresi({ hostname: 'localhost.evil.test', origin: 'http://localhost.evil.test' })).toBe('');
  });
});
