// Hesap servisi (app/js/senkron/hesap-servisi.js).
//  1. Zamanlayıcının kararları: sahte saat, sahte fetch, turun kendisi taklit.
//  2. Akışlar GERÇEK sunucu koduna karşı: Worker + bellekteki DO'lar
//     (sunucu/yerel.mjs), iki-üç "cihaz" = ayrı IndexedDB'ler. Parola türetme
//     gerçek (600 bin tur), bu yüzden süreler uzun.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import worker from '../sunucu/worker.js';
import { bellekOrtami } from '../sunucu/yerel.mjs';
import { IdbDepo } from '../app/js/depo/idb.js';
import { HesapServisi, ZAMAN } from '../app/js/senkron/hesap-servisi.js';
import { kurtarmaKoduUret } from '../app/js/senkron/hesap.js';
import { kasadanAl } from '../app/js/paylasilan/kasa.js';
import { kurtarmaNormal } from '../app/js/paylasilan/hesap-kurallari.js';
import { ornekYukle } from '../app/js/depo/ornek.js';

const ADRES = 'https://shafa-sunucu.test';
const JETON = 'ZHIubmVtdW5h.' + 'A'.repeat(43);
const rastgeleAd = (on) => `${on}-${Math.random().toString(36).slice(2)}`;
const yeniDepo = (on) => new IdbDepo(rastgeleAd(on)).ac();
/** IndexedDB taklidi gerçek setImmediate ile ilerliyor (sahte saatten bağımsız). */
const dinlen = async (n = 60) => { for (let i = 0; i < n; i++) await new Promise((c) => setImmediate(c)); };
const jsonYanit = (veri, durum = 200) => new Response(JSON.stringify(veri), { status: durum, headers: { 'Content-Type': 'application/json' } });

describe('zamanlayıcı', () => {
  afterEach(() => vi.useRealTimers());

  async function kur({ girisli = true, surum = '3', cevrimici = true, sonEsitleme } = {}) {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const depo = await yeniDepo('zaman');
    const durum = { surum, cevrimici, yanit: null };
    const istekler = [];
    const fetch = async (url) => { istekler.push(new URL(url).pathname); return durum.yanit || jsonYanit({ surum: durum.surum }); };
    const pencere = new EventTarget();
    const belge = new EventTarget();
    belge.visibilityState = 'visible';
    const servis = new HesapServisi(depo, { adres: ADRES, ortam: { fetch, cevrimici: () => durum.cevrimici }, pencere, belge, kilitler: null });
    const tur = vi.spyOn(servis, '_tur').mockResolvedValue({});
    if (girisli) {
      await depo.hesapKaydet({
        kullanici: 'dr.nemuna', jeton: JETON, kasa: 'K', bilinenSurum: '3', esitlenenSayac: 0,
        sonEsitleme: sonEsitleme ?? new Date().toISOString(),
      });
    }
    return { depo, servis, tur, istekler, durum, pencere, belge };
  }
  const ilerle = async (ms) => { await vi.advanceTimersByTimeAsync(ms); await dinlen(); };

  it('hesap yokken hiçbir tetik ağa çıkmıyor', async () => {
    const { depo, servis, tur, istekler, pencere, belge } = await kur({ girisli: false });
    servis.baslat();
    await ilerle(ZAMAN.acilis + 10);
    await depo.kaydet('hastalar', { ad: 'Ali', soyad: 'Ahmadi' });
    pencere.dispatchEvent(new Event('online'));
    belge.dispatchEvent(new Event('visibilitychange'));
    await ilerle(ZAMAN.degisiklik + 10);
    expect(istekler).toEqual([]);
    expect(tur).not.toHaveBeenCalled();
    servis.durdur();
  });

  it('açılışta 1,5 sn sonra ön denetim; sürüm aynı ve değişiklik yoksa tur yok', async () => {
    const { servis, tur, istekler } = await kur();
    servis.baslat();
    await ilerle(ZAMAN.acilis - 1);
    expect(istekler).toEqual([]);
    await ilerle(1);
    expect(istekler).toEqual(['/v1/veri/surum']);
    expect(tur).not.toHaveBeenCalled();
    servis.durdur();
  });

  it('sunucudaki sürüm değiştiyse tam tur', async () => {
    const { servis, tur } = await kur({ surum: '4' });
    servis.baslat();
    await ilerle(ZAMAN.acilis);
    expect(tur).toHaveBeenCalledTimes(1);
    servis.durdur();
  });

  it('yerel değişiklik: son değişiklikten 2 dk sonra, ön denetimsiz tur', async () => {
    const { depo, servis, tur, istekler } = await kur();
    servis.baslat();
    await ilerle(ZAMAN.acilis);
    istekler.length = 0;
    await depo.kaydet('hastalar', { ad: 'Ali', soyad: 'Ahmadi' });
    await ilerle(60000);
    await depo.kaydet('hastalar', { ad: 'Sara', soyad: 'Zadran' });   // sayaç yeniden başlar
    await ilerle(ZAMAN.degisiklik - 1);
    expect(tur).not.toHaveBeenCalled();
    await ilerle(1);
    expect(tur).toHaveBeenCalledTimes(1);
    expect(istekler).toEqual([]);          // bekleyen değişiklik varken ön denetime gerek yok
    servis.durdur();
  });

  it('internet gelince 30 sn sonra tek tur (art arda gelen olaylar birleşiyor)', async () => {
    const { servis, istekler, pencere } = await kur();
    servis.baslat();
    await ilerle(ZAMAN.acilis);
    istekler.length = 0;
    for (let i = 0; i < 3; i++) { pencere.dispatchEvent(new Event('online')); await ilerle(5000); }
    await ilerle(ZAMAN.cevrimici - 5001);
    expect(istekler).toEqual([]);
    await ilerle(1);
    expect(istekler).toEqual(['/v1/veri/surum']);
    servis.durdur();
  });

  it('uygulamaya dönünce yalnız son tur 10 dk\'dan eskiyse', async () => {
    const { depo, servis, istekler, belge } = await kur();
    servis.baslat();
    await ilerle(ZAMAN.acilis);
    istekler.length = 0;
    await depo.hesapKaydet({ sonEsitleme: new Date(Date.now() - 5 * 60000).toISOString() });
    belge.dispatchEvent(new Event('visibilitychange'));
    await ilerle(0);
    expect(istekler).toEqual([]);
    await depo.hesapKaydet({ sonEsitleme: new Date(Date.now() - 11 * 60000).toISOString() });
    belge.visibilityState = 'hidden';
    belge.dispatchEvent(new Event('visibilitychange'));
    await ilerle(0);
    expect(istekler).toEqual([]);
    belge.visibilityState = 'visible';
    belge.dispatchEvent(new Event('visibilitychange'));
    await ilerle(0);
    expect(istekler).toEqual(['/v1/veri/surum']);
    servis.durdur();
  });

  it('çevrimdışıyken denenmiyor', async () => {
    const { servis, istekler } = await kur({ cevrimici: false });
    servis.baslat();
    await ilerle(ZAMAN.acilis);
    expect(istekler).toEqual([]);
    servis.durdur();
  });

  it('oturum düşünce jeton ve K siliniyor, kendiliğinden eşitleme duruyor', async () => {
    const { depo, servis, istekler, durum, pencere } = await kur();
    durum.yanit = jsonYanit({ hata: 'oturum' }, 401);
    servis.baslat();
    await ilerle(ZAMAN.acilis);
    expect(istekler).toEqual(['/v1/veri/surum']);
    expect(await depo.hesap()).toMatchObject({ jeton: '', kasa: '', hataKodu: 'oturum', kullanici: 'dr.nemuna' });
    expect(await servis.hesapDurumu()).toMatchObject({ girisli: false, oturumBitti: true, kaliciHata: true, kullanici: 'dr.nemuna' });
    pencere.dispatchEvent(new Event('online'));
    await ilerle(ZAMAN.cevrimici);
    expect(istekler).toHaveLength(1);
    servis.durdur();
  });

  it('ağ hatası sessiz: kaydediliyor ama kalıcı hata sayılmıyor', async () => {
    const { servis, durum } = await kur();
    durum.cevrimici = true;
    servis.ortam.fetch = async () => { throw new TypeError('Failed to fetch'); };
    expect((await servis.otomatikTur()).hata).toMatchObject({ kod: 'sunucu_yok' });
    expect(await servis.hesapDurumu()).toMatchObject({ hataKodu: 'sunucu_yok', kaliciHata: false, girisli: true });
  });

  it('tur sürerken gelen tetik ağa çıkmıyor, bitince yeniden deneniyor', async () => {
    const { servis, istekler } = await kur({ surum: '4' });
    servis.suruyor = true;
    expect(await servis.otomatikTur()).toEqual({ atlandi: 'suruyor' });
    expect(istekler).toEqual([]);
    expect(servis._tekrar).toBe(true);
  });

  it('durdur olayları ve sayaçları bırakıyor', async () => {
    const { servis, istekler, pencere } = await kur();
    servis.baslat();
    servis.durdur();
    pencere.dispatchEvent(new Event('online'));
    await ilerle(ZAMAN.acilis + ZAMAN.cevrimici);
    expect(istekler).toEqual([]);
  });
});

describe('akışlar gerçek sunucu koduna karşı', () => {
  const DAVET = 'Kabul-Bahar';
  const P = 'باغ بالا در بهار 1404';
  const P2 = 'دریای آمو آرام است';
  const P3 = 'کوه بابا برف دارد';
  let env, saat, A, B, kod, kilitAdlari;

  /** Sunucunun yazım temposu (iki PUT arası 5 sn) için saat ileri alınır. */
  const ilerle = (ms = 6000) => { saat += ms; vi.setSystemTime(saat); };

  function sunucuFetch(ip, sayac) {
    return async (url, init = {}) => {
      sayac.n++;
      const { cache, ...ayar } = init;
      const h = new Headers(ayar.headers);
      h.set('CF-Connecting-IP', ip);
      return worker.fetch(new Request(url, { ...ayar, headers: h, duplex: 'half' }), env);
    };
  }

  async function cihaz(ad, ip) {
    const depo = await yeniDepo('cihaz-' + ad);
    const istek = { n: 0 };
    const kilitler = { request: async (isim, is) => { kilitAdlari.push(isim); return is(); } };
    const servis = new HesapServisi(depo, { adres: ADRES, ortam: { fetch: sunucuFetch(ip, istek), cevrimici: () => true }, pencere: null, belge: null, kilitler });
    return { depo, servis, istek };
  }

  const soyadlar = async (depo) => (await depo.listele('hastalar', { sirala: 'soyad' })).filter((h) => h.ornek !== 1).map((h) => h.soyad);
  const depoMetni = async (u) => {
    const n = env.HESAP.nesneler.get(u);
    const cozucu = new TextDecoder();
    return [...(await n.cekirdek.depo.list()).values()]
      .map((v) => (v instanceof Uint8Array ? cozucu.decode(v) : JSON.stringify(v))).join('\n');
  };

  beforeAll(async () => {
    saat = Date.parse('2026-09-25T08:00:00Z');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(saat);
    env = bellekOrtami({ DAVET_KODU: DAVET });
    kilitAdlari = [];
    A = await cihaz('a', '203.0.113.1');
    B = await cihaz('b', '203.0.113.2');
    kod = kurtarmaKoduUret();
  });
  afterAll(() => vi.useRealTimers());

  it('hesap yokken servis ağa çıkmıyor', async () => {
    expect(await A.servis.hesapDurumu()).toMatchObject({ sunucuVar: true, girisli: false, kullanici: '' });
    expect(await A.servis.otomatikTur()).toEqual({ atlandi: 'kapi' });
    await expect(A.servis.simdiEsitle()).rejects.toMatchObject({ kod: 'giris_yok' });
    expect(A.istek.n).toBe(0);
  });

  it('kayıt: kayıtlı hasta varken karar verilmeden hesap açılmıyor (ağa da çıkılmıyor)', async () => {
    await A.depo.kaydet('hastalar', { ad: 'Zarghuna', soyad: 'Karimzada', telefon: '0700 111 222' });
    await ornekYukle(A.depo);
    const d = await A.servis.hesapDegisimi('dr.nemuna');
    expect(d).toEqual({ soru: true, sayi: 1, onceki: '' });     // örnekler sayılmıyor
    await expect(A.servis.kayitOl({ kullanici: 'Dr.Nemuna', parola: P, davet: DAVET, kod }))
      .rejects.toMatchObject({ kod: 'hesap_degisimi', veri: { sayi: 1 } });
    expect(A.istek.n).toBe(0);
  });

  it('kayıt yerel denetimleri ağdan önce', async () => {
    const k = { kullanici: 'dr.nemuna', parola: P, davet: DAVET, kod, yerel: 'ekle' };
    await expect(A.servis.kayitOl({ ...k, kullanici: 'ab' })).rejects.toMatchObject({ kod: 'kullanici_gecersiz' });
    await expect(A.servis.kayitOl({ ...k, parola: '0700123456' })).rejects.toMatchObject({ kod: 'parola_telefon' });
    await expect(A.servis.kayitOl({ ...k, parola: 'dr.nemuna-1404' })).rejects.toMatchObject({ kod: 'parola_kullanici' });
    await expect(A.servis.kayitOl({ ...k, kod: '2345' })).rejects.toMatchObject({ kod: 'kurtarma_gecersiz' });
    await expect(A.servis.kayitOl({ ...k, davet: ' ' })).rejects.toMatchObject({ kod: 'davet' });
    expect(A.istek.n).toBe(0);
  });

  it('kayıt: ilk tur yükleniyor; sunucuda yalnız şifreli veri, sırlar yok', async () => {
    const r = await A.servis.kayitOl({ kullanici: 'Dr.Nemuna', parola: P, davet: DAVET, kod, yerel: 'ekle' });
    expect(r.hata).toBe(null);
    expect(r.esitleme.yuklendi).toBe(true);
    const h = await A.depo.hesap();
    expect(h).toMatchObject({ kullanici: 'dr.nemuna', sonKullanici: 'dr.nemuna', bilinenSurum: '1', hataKodu: '' });
    expect(h.kasa).toMatch(/^[2-9A-HJ-NP-Z-]{24}$/);
    expect(kilitAdlari).toContain('shafa-senkron');

    const metin = await depoMetni('dr.nemuna');
    for (const gizli of ['Karimzada', 'Zarghuna', '0700 111 222', P, h.kasa, kod, kurtarmaNormal(kod), 'فاطمه']) {
      expect(metin).not.toContain(gizli);
    }
    // Sunucudaki kasa K ile açılıyor: hasta orada, örnekler yok.
    const bas = env.HESAP.nesneler.get('dr.nemuna').cekirdek.bas;
    const kasaMetni = metin.split('\n').find((s) => s.startsWith('{"bicim":"shafa-kasa"'));
    expect(bas.surum).toBe('1');
    const icerik = await kasadanAl(JSON.parse(kasaMetni), h.kasa);
    expect(icerik.koleksiyonlar.hastalar.map((x) => x.soyad)).toEqual(['Karimzada']);
    expect(Object.values(icerik.koleksiyonlar).flat().some((x) => x.ornek === 1)).toBe(false);
  }, 30000);

  it('öbür cihaz: yanlış parola "yanlis"; doğru parolayla kayıtlar geliyor', async () => {
    await expect(B.servis.girisYap({ kullanici: 'dr.nemuna', parola: P + 'x' })).rejects.toMatchObject({ kod: 'yanlis' });
    expect((await B.depo.hesap()).jeton).toBeFalsy();
    const r = await B.servis.girisYap({ kullanici: 'DR.NEMUNA', parola: P });
    expect(r.hata).toBe(null);
    expect(await soyadlar(B.depo)).toEqual(['Karimzada']);
    expect(await B.servis.hesapDurumu()).toMatchObject({ girisli: true, kullanici: 'dr.nemuna', bekleyen: 0 });
  }, 30000);

  it('B\'deki değişiklik kendiliğinden gidiyor, A ön denetimle görüp indiriyor', async () => {
    await B.depo.kaydet('hastalar', { ad: 'Omar', soyad: 'Sultani' });
    expect((await B.servis.hesapDurumu()).bekleyen).toBeGreaterThan(0);
    ilerle();
    const b = await B.servis.otomatikTur();
    expect(b.sonuc.yuklendi).toBe(true);
    expect((await B.servis.hesapDurumu()).bekleyen).toBe(0);
    const olaylar = [];
    A.servis.dinle((o) => olaylar.push(o.tur));
    const a = await A.servis.otomatikTur();
    expect(a.sonuc.yuklendi).toBe(false);
    expect(await soyadlar(A.depo)).toEqual(['Karimzada', 'Sultani']);
    expect(olaylar).toContain('indi');
    // Değişen bir şey yok: ön denetim turu başlatmıyor.
    expect(await A.servis.otomatikTur()).toEqual({ atlandi: 'ayni' });
    expect(await B.servis.otomatikTur()).toEqual({ atlandi: 'ayni' });
  }, 30000);

  it('hesap değişimi: "temizle" bu cihazın kayıtlarını silip hesabınkini alıyor', async () => {
    const C = await cihaz('c', '203.0.113.3');
    await C.depo.kaydet('hastalar', { ad: 'Baska', soyad: 'Hekiminhastasi' });
    const r = await C.servis.girisYap({ kullanici: 'dr.nemuna', parola: P, yerel: 'temizle' });
    expect(r.hata).toBe(null);
    expect(await soyadlar(C.depo)).toEqual(['Karimzada', 'Sultani']);
    const icerik = await kasadanAl(JSON.parse((await depoMetni('dr.nemuna')).split('\n').find((s) => s.startsWith('{"bicim"'))), (await A.depo.hesap()).kasa);
    expect(JSON.stringify(icerik)).not.toContain('Hekiminhastasi');
  }, 30000);

  it('hesap değişimi: "ekle" bu cihazın kayıtlarını hesaba katıyor', async () => {
    const D = await cihaz('d', '203.0.113.4');
    await D.depo.kaydet('hastalar', { ad: 'Nazo', soyad: 'Wardak' });
    ilerle();
    await D.servis.girisYap({ kullanici: 'dr.nemuna', parola: P, yerel: 'ekle' });
    expect(await soyadlar(D.depo)).toEqual(['Karimzada', 'Sultani', 'Wardak']);
    await A.servis.otomatikTur();
    expect(await soyadlar(A.depo)).toEqual(['Karimzada', 'Sultani', 'Wardak']);
  }, 30000);

  it('"temizle" kararı ancak giriş başarılıysa uygulanıyor; girişliyken ikinci hesap açılmıyor', async () => {
    const C = await cihaz('c2', '203.0.113.9');
    await C.depo.kaydet('hastalar', { ad: 'Kalsin', soyad: 'Yerelde' });
    await expect(C.servis.girisYap({ kullanici: 'dr.nemuna', parola: 'yanlis parola', yerel: 'temizle' })).rejects.toMatchObject({ kod: 'yanlis' });
    expect(await soyadlar(C.depo)).toEqual(['Yerelde']);
    await expect(A.servis.kayitOl({ kullanici: 'dr.baska', parola: P, davet: DAVET, kod: kurtarmaKoduUret(), yerel: 'ekle' }))
      .rejects.toMatchObject({ kod: 'girisli' });
    await expect(A.servis.girisYap({ kullanici: 'dr.nemuna', parola: P })).rejects.toMatchObject({ kod: 'girisli' });
  }, 30000);

  it('tur sürerken çıkış yapılırsa tur sonucu da hatası da yazılmıyor', async () => {
    const X = await cihaz('x', '203.0.113.10');
    let bekle = null;
    let geldi;
    const asilFetch = X.servis.ortam.fetch;
    X.servis.ortam.fetch = async (url, init) => {
      const once = bekle?.once;
      if (once && new URL(url).pathname === '/v1/veri') { geldi(); await once; }
      const r = await asilFetch(url, init);
      if (bekle?.sonra && new URL(url).pathname === '/v1/veri') { geldi(); await bekle.sonra; }
      return r;
    };
    const dene = async (asama) => {
      await X.servis.girisYap({ kullanici: 'dr.nemuna', parola: P, yerel: 'ekle' });
      let birak;
      const kapi = new Promise((c) => { birak = c; });
      const ulasti = new Promise((c) => { geldi = c; });
      bekle = { [asama]: kapi };
      const tur = X.servis.simdiEsitle().then(() => null, (e) => e);
      await ulasti;
      await X.servis.cikisYap();
      birak();
      const sonuc = await tur;
      bekle = null;
      expect(await X.depo.hesap()).toMatchObject({ jeton: '', kasa: '', hataKodu: '', sonEsitleme: '' });
      return sonuc;
    };
    // Sunucu isteği çıkıştan SONRA işliyor: oturum düşmüş, 401 gelir.
    expect(await dene('once')).toMatchObject({ kod: 'oturum' });
    // Sunucu isteği çıkıştan ÖNCE işlemiş: tur başarıyla biter ama yazılmaz.
    expect(await dene('sonra')).toBe(null);
  }, 30000);

  it('giriş bilinen sürümü sıfırlıyor: ilk tur olmasa da sonraki ön denetim turu atlamıyor', async () => {
    const Y = await cihaz('y', '203.0.113.11');
    const asil = Y.servis.ortam.fetch;
    Y.servis.ortam.fetch = async (url, init) => {
      if (new URL(url).pathname === '/v1/veri') throw new TypeError('Failed to fetch');
      return asil(url, init);
    };
    await Y.depo.hesapKaydet({ sonKullanici: 'dr.nemuna', bilinenSurum: String(env.HESAP.nesneler.get('dr.nemuna').cekirdek.bas.surum) });
    const r = await Y.servis.girisYap({ kullanici: 'dr.nemuna', parola: P });
    expect(r.hata).toMatchObject({ kod: 'sunucu_yok' });
    Y.servis.ortam.fetch = asil;
    expect((await Y.servis.otomatikTur()).sonuc).toBeTruthy();
    expect(await soyadlar(Y.depo)).toContain('Karimzada');
  }, 30000);

  it('10 yanlış denemeden sonra kilit; mevcut oturumlar eşitlemeye devam ediyor', async () => {
    const E = await cihaz('e', '203.0.113.5');
    for (let i = 0; i < 10; i++) {
      await expect(E.servis.girisYap({ kullanici: 'dr.nemuna', parola: 'yanlis parola ' + i })).rejects.toMatchObject({ kod: 'yanlis' });
    }
    await expect(E.servis.girisYap({ kullanici: 'dr.nemuna', parola: P })).rejects.toMatchObject({ kod: 'kilitli', veri: { dakika: 1 } });
    await A.depo.kaydet('hastalar', { ad: 'Laila', soyad: 'Yusufzai' });
    ilerle();
    expect((await A.servis.otomatikTur()).sonuc.yuklendi).toBe(true);
    ilerle(61 * 60000);    // kilit en çok bir saat
  }, 60000);

  it('parola değişince öbür cihaz "oturum"a düşüyor, yeni parolayla soru sorulmadan dönüyor', async () => {
    await A.servis.parolaDegistir({ eskiParola: P, yeniParola: P2 });
    expect((await A.servis.hesapDurumu()).girisli).toBe(true);
    ilerle();
    expect((await A.servis.simdiEsitle()).surum).toBeTruthy();       // A'nın yeni jetonu çalışıyor
    await B.servis.otomatikTur();
    expect(await B.servis.hesapDurumu()).toMatchObject({ girisli: false, oturumBitti: true, kullanici: 'dr.nemuna' });
    expect(await B.servis.otomatikTur()).toEqual({ atlandi: 'kapi' });
    await expect(B.servis.girisYap({ kullanici: 'dr.nemuna', parola: P })).rejects.toMatchObject({ kod: 'yanlis' });
    const r = await B.servis.girisYap({ kullanici: 'dr.nemuna', parola: P2 });
    expect(r.hata).toBe(null);
    expect(await soyadlar(B.depo)).toContain('Yusufzai');
  }, 60000);

  it('kurtarma: kod tek kullanımlık, yeni kod çalışıyor, öbür cihazlar düşüyor', async () => {
    const yeniKod = kurtarmaKoduUret();
    await B.servis.cikisYap();
    expect(await B.servis.hesapDurumu()).toMatchObject({ girisli: false, kullanici: '' });
    expect(await soyadlar(B.depo)).toContain('Karimzada');            // çıkış kayıtları silmiyor
    await expect(B.servis.kurtar({ kullanici: 'dr.nemuna', kod: kurtarmaKoduUret(), yeniParola: P3, yeniKod }))
      .rejects.toMatchObject({ kod: 'kurtarma_yanlis' });
    // Arayüzün yolu: yeni kod ancak eski kod TUTUNCA sorulur (yanlış kodla
    // hekim boşuna yeni kod yazmasın); vazgeçerse sunucuda bir şey değişmez,
    // eski kod çalışmaya devam eder.
    const sorulan = [];
    const sor = (donen) => async () => { sorulan.push(donen); return donen; };
    await expect(B.servis.kurtar({ kullanici: 'dr.nemuna', kod: kurtarmaKoduUret(), yeniParola: P3, yeniKod: sor(yeniKod) }))
      .rejects.toMatchObject({ kod: 'kurtarma_yanlis' });
    expect(sorulan).toEqual([]);
    await expect(B.servis.kurtar({ kullanici: 'dr.nemuna', kod, yeniParola: P3, yeniKod: sor(null) }))
      .rejects.toMatchObject({ kod: 'iptal' });
    expect(sorulan).toEqual([null]);
    expect(await B.servis.hesapDurumu()).toMatchObject({ girisli: false });
    const r = await B.servis.kurtar({ kullanici: 'dr.nemuna', kod, yeniParola: P3, yeniKod: sor(yeniKod) });
    expect(sorulan).toEqual([null, yeniKod]);
    expect(r.hata).toBe(null);
    await B.servis.cikisYap();
    await expect(B.servis.kurtar({ kullanici: 'dr.nemuna', kod, yeniParola: P3, yeniKod: kurtarmaKoduUret() }))
      .rejects.toMatchObject({ kod: 'kurtarma_yanlis' });
    await B.servis.girisYap({ kullanici: 'dr.nemuna', parola: P3 });
    await A.servis.otomatikTur();
    expect(await A.servis.hesapDurumu()).toMatchObject({ oturumBitti: true });
    kod = yeniKod;
  }, 60000);

  it('kurtarma kodu yenilenince eskisi çalışmıyor', async () => {
    const kod3 = kurtarmaKoduUret();
    await expect(B.servis.kurtarmaYenile({ parola: P2, kod: kod3 })).rejects.toMatchObject({ kod: 'yanlis' });
    await B.servis.kurtarmaYenile({ parola: P3, kod: kod3 });
    expect((await B.servis.hesapDurumu()).girisli).toBe(true);        // oturum sürüyor
    const F = await cihaz('f', '203.0.113.6');
    const ortak = { kullanici: 'dr.nemuna', yeniParola: P3, yeniKod: kurtarmaKoduUret(), yerel: 'ekle' };
    await expect(F.servis.kurtar({ ...ortak, kod })).rejects.toMatchObject({ kod: 'kurtarma_yanlis' });
  }, 60000);

  it('sunucuya konmuş şifresiz paket reddediliyor, yerel bozulmuyor', async () => {
    // K'yi bilmeyen biri (sunucu dahil) yalnız kasa olmayan bir paket koyabilir.
    const c = env.HESAP.nesneler.get('dr.nemuna').cekirdek;
    const sahte = new TextEncoder().encode(JSON.stringify({
      bicim: 'shafa-yedek', semaSurumu: 3,
      koleksiyonlar: { hastalar: [{ id: 'has_sahte', ad: 'Sahte', soyad: 'Enjekte', guncellendi: '2099-01-01T00:00:00.000Z' }] },
    }));
    const bas = { surum: '99', parca: 1, boy: sahte.length };
    await c.depo.put({ 'veri:bas': bas, 'veri:p:0': sahte });
    c.bas = bas;
    await expect(B.servis.simdiEsitle()).rejects.toMatchObject({ kod: 'kasa_bozuk' });
    expect(await soyadlar(B.depo)).not.toContain('Enjekte');
    expect(await B.servis.hesapDurumu()).toMatchObject({ hataKodu: 'kasa_bozuk', kaliciHata: true });
  }, 30000);

  it('çıkış "sil" ile bu cihazın kayıtlarını da siliyor', async () => {
    await B.servis.cikisYap({ sil: true });
    expect(await B.depo.say('hastalar')).toBe(0);
    expect(await B.depo.hesap()).toMatchObject({ jeton: '', kasa: '', kullanici: '', sonKullanici: '' });
  });

  it('hesap silinince sunucuda hiçbir şey kalmıyor, cihazdaki kayıtlar duruyor', async () => {
    const G = await cihaz('g', '203.0.113.7');
    await G.servis.girisYap({ kullanici: 'dr.nemuna', parola: P3 });
    await expect(G.servis.hesabiSil({ parola: P2 })).rejects.toMatchObject({ kod: 'yanlis' });
    await G.servis.hesabiSil({ parola: P3 });
    expect([...(await env.HESAP.nesneler.get('dr.nemuna').cekirdek.depo.list()).keys()]).toEqual([]);
    expect(await G.depo.hesap()).toMatchObject({ jeton: '', kasa: '', sonKullanici: '' });
    await expect(G.servis.girisYap({ kullanici: 'dr.nemuna', parola: P3, yerel: 'ekle' })).rejects.toMatchObject({ kod: 'yanlis' });
  }, 30000);

  it('sunucudaki sarılı anahtar oynanmışsa giriş "anahtar_bozuk", oturum açık kalmıyor', async () => {
    const H = await cihaz('h', '203.0.113.8');
    await H.servis.kayitOl({ kullanici: 'dr.kabul', parola: P, davet: DAVET, kod: kurtarmaKoduUret() });
    await H.servis.cikisYap();
    const c = env.HESAP.nesneler.get('dr.kabul').cekirdek;
    const hesap = { ...c.hesap, sarili: { ...c.hesap.sarili, iv: btoa('baska bir iv') } };
    await c.depo.put('hesap', hesap);
    c.hesap = hesap;
    const once = [...(await c.depo.list({ prefix: 'oturum:' })).keys()].length;
    await expect(H.servis.girisYap({ kullanici: 'dr.kabul', parola: P })).rejects.toMatchObject({ kod: 'anahtar_bozuk' });
    expect([...(await c.depo.list({ prefix: 'oturum:' })).keys()].length).toBe(once);
    expect((await H.depo.hesap()).jeton).toBeFalsy();
  }, 30000);
});
