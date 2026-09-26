import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BellekDepo } from '../app/js/depo/depo.js';
import { IdbDepo } from '../app/js/depo/idb.js';
import { senkronEt, bellekTasima, SenkronHatasi, eskiSenkronAyarlariniSil } from '../app/js/depo/senkron.js';
import { ayarlariBirlestir, anahtarlariBirlestir, belgeyiTemizle, belgeParmakIzi, CIHAZA_OZEL_AYARLAR, ESKI_SENKRON_AYARLARI } from '../app/js/paylasilan/senkron.js';
import { kasayaKoy, kasadanAl, kasaMi, KasaHatasi, donguSayisi, DONGU, KASA_SURUMU } from '../app/js/paylasilan/kasa.js';
import { kodUret, metniDogrula, anahtarlar } from '../app/js/depo/dogrulama.js';
import { belgeDerle, yedekOlustur, iceAktar } from '../app/js/depo/yedek.js';
import { ornekYukle } from '../app/js/depo/ornek.js';

const PAROLA = 'kabil-1404';

describe('kasa', () => {
  it('kapatıp açınca aynı nesne çıkar', async () => {
    const paket = await kasayaKoy({ a: 1, b: ['x', 'y'] }, PAROLA);
    expect(kasaMi(paket)).toBe(true);
    expect(await kasadanAl(paket, PAROLA)).toEqual({ a: 1, b: ['x', 'y'] });
  });
  it('şifreli metinde açık veri görünmüyor', async () => {
    const paket = await kasayaKoy({ hasta: 'عبدالله' }, PAROLA);
    expect(JSON.stringify(paket)).not.toContain('عبدالله');
    expect(JSON.stringify(paket)).not.toContain(PAROLA);
  });
  it('yanlış parola açmıyor', async () => {
    const paket = await kasayaKoy({ a: 1 }, PAROLA);
    await expect(kasadanAl(paket, 'başka')).rejects.toMatchObject({ kod: 'parola' });
  });
  it('bir bayt oynanmış kasa açılmıyor', async () => {
    // Base64 METNİNDE karakter değiştirmek yetmiyor: değişiklik dolgu bitlerine
    // denk gelirse çözülen baytlar aynı kalıyor ve test kendiliğinden geçiyordu.
    // (Yerelde geçti, CI'da düştü.) Artık gerçek bayt çevriliyor.
    const paket = await kasayaKoy({ a: 1 }, PAROLA);
    const ham = Uint8Array.from(atob(paket.veri), (c) => c.charCodeAt(0));
    for (const yer of [0, Math.floor(ham.length / 2), ham.length - 1]) {
      const oynanmis = Uint8Array.from(ham);
      oynanmis[yer] ^= 0xff;
      const bozuk = { ...paket, veri: btoa(String.fromCharCode(...oynanmis)) };
      expect(bozuk.veri).not.toBe(paket.veri);
      await expect(kasadanAl(bozuk, PAROLA)).rejects.toThrow(KasaHatasi);
    }
  });
  it('gerçek boyutta veriyi taşıyor', async () => {
    // Küçük nesnelerle geçen testler bir yığın taşmasını gizlemişti: base64'e
    // çevirme bütün baytları ayrı argüman olarak yığına koyuyordu ve ~128KB'da
    // çöküyordu. Ayarlardaki Clinical fotoğrafı tek başına 220KB'a çıkabiliyor,
    // yani fotoğraf yüklemiş bir hekimde ilk eşitleme çökerdi.
    const buyuk = { foto: 'data:image/jpeg;base64,' + 'A'.repeat(300 * 1024), hasta: 'عبدالله' };
    const paket = await kasayaKoy(buyuk, PAROLA);
    const geri = await kasadanAl(paket, PAROLA);
    expect(geri.foto.length).toBe(buyuk.foto.length);
    expect(geri.hasta).toBe('عبدالله');
    expect(JSON.stringify(paket)).not.toContain('عبدالله');
  });
  it('başka tur sayısıyla yazılmış kasa yine açılıyor', async () => {
    // Tur sayısı ileride artarsa eski kasalar açılmaya devam etmeli; sabit
    // sayıya baksaydık doğru parolada bile "parola tutmuyor" derdi.
    const paket = await kasayaKoy({ a: 1 }, PAROLA);
    expect(paket.dongu).toBe(DONGU);
    expect(donguSayisi(paket)).toBe(DONGU);
    expect(await kasadanAl({ ...paket }, PAROLA)).toEqual({ a: 1 });
  });
  it('dosyadaki tur sayısı sınırlanıyor', () => {
    expect(donguSayisi({ dongu: 1 })).toBe(100000);       // anahtarı zayıflatma
    expect(donguSayisi({ dongu: 1e12 })).toBe(2000000);   // tarayıcıyı kilitleme
    expect(donguSayisi({})).toBe(DONGU);                  // eski kasa
    expect(donguSayisi({ dongu: 'abc' })).toBe(DONGU);
  });
  it('bozuk dosyaya "parola tutmuyor" demiyor', async () => {
    const paket = await kasayaKoy({ a: 1 }, PAROLA);
    await expect(kasadanAl({ ...paket, veri: '!!!' }, PAROLA)).rejects.toMatchObject({ kod: 'bozuk' });
    await expect(kasadanAl({ ...paket, iv: '' }, PAROLA)).rejects.toMatchObject({ kod: 'bozuk' });
  });
  it('Shafa kasası olmayanı reddeder', async () => {
    await expect(kasadanAl({ bicim: 'başka' }, PAROLA)).rejects.toMatchObject({ kod: 'bicim' });
  });
  it('her kasa ayrı IV kullanıyor — aynı veri iki kez farklı çıkıyor', async () => {
    const a = await kasayaKoy({ x: 1 }, PAROLA);
    const b = await kasayaKoy({ x: 1 }, PAROLA, { tuz: a.tuz });
    expect(a.veri).not.toBe(b.veri);
  });
});

describe('ayar birleştirme', () => {
  const kayit = (alanlar, t) => ({ id: 'genel', rev: 1, guncellendi: t, olusturuldu: t, ...alanlar });

  it('bir tarafta boş olan alan dolu kalıyor', () => {
    const { sonuc, cakisan } = ayarlariBirlestir(
      kayit({ doktorAd: 'Ahmad', telefon: '' }, '2026-01-02T00:00:00.000Z'),
      kayit({ doktorAd: '', telefon: '0700' }, '2026-01-01T00:00:00.000Z'));
    expect(sonuc.doktorAd).toBe('Ahmad');
    expect(sonuc.telefon).toBe('0700');
    expect(cakisan).toHaveLength(0);
  });
  it('iki taraf da doluysa yenisi kazanıyor ama eskisi rapora giriyor', () => {
    const { sonuc, cakisan } = ayarlariBirlestir(
      kayit({ telefon: 'yeni' }, '2026-01-02T00:00:00.000Z'),
      kayit({ telefon: 'eski' }, '2026-01-01T00:00:00.000Z'));
    expect(sonuc.telefon).toBe('yeni');
    expect(cakisan).toEqual([{ alan: 'telefon', yerel: 'yeni', uzak: 'eski', secilen: 'yerel' }]);
  });
  it('guncellendi ileri atılmıyor — yoksa ayarlar iki cihaz arasında gidip gelir', () => {
    const a = kayit({ doktorAd: 'A' }, '2026-01-02T00:00:00.000Z');
    const b = kayit({ telefon: 'B' }, '2026-01-01T00:00:00.000Z');
    const { sonuc } = ayarlariBirlestir(a, b);
    expect(sonuc.guncellendi).toBe('2026-01-02T00:00:00.000Z');
    // ikinci tur hiçbir şey değiştirmiyor
    expect(ayarlariBirlestir(sonuc, b).degisti).toBe(false);
    expect(ayarlariBirlestir(sonuc, sonuc).degisti).toBe(false);
  });
  it('cihaza özel alanlar uzaktan gelmiyor, yereldeki kalıyor', () => {
    const { sonuc } = ayarlariBirlestir(
      kayit({ senkronParolasi: 'benim' }, '2026-01-01T00:00:00.000Z'),
      kayit({ senkronParolasi: 'onunki', senkronIstemciId: 'x' }, '2026-01-02T00:00:00.000Z'));
    expect(sonuc.senkronParolasi).toBe('benim');
    expect(sonuc.senkronIstemciId).toBeUndefined();
  });
  it('yerelde ayar kaydı yokken de uzaktakinin cihaza özel alanları alınmıyor', () => {
    const { sonuc } = ayarlariBirlestir(null, kayit({ doktorAd: 'A', senkronParolasi: 'onunki', hesapJetonu: 'j' }, 'T'));
    expect(sonuc.doktorAd).toBe('A');
    expect(sonuc.senkronParolasi).toBeUndefined();
    expect(sonuc.hesapJetonu).toBeUndefined();
  });
  it('kaybeden doğrulama anahtarı silinmiyor, eskiye düşüyor', () => {
    const r = anahtarlariBirlestir({ dogrulamaAnahtari: 'YENI' }, { dogrulamaAnahtari: 'ESKI' });
    expect(r.dogrulamaAnahtari).toBe('YENI');
    expect(r.eskiAnahtarlar).toEqual(['ESKI']);
  });
  it('eski anahtar listesi iki cihazda da aynı sırada çıkıyor', () => {
    const a = anahtarlariBirlestir({ dogrulamaAnahtari: 'A', eskiAnahtarlar: ['C'] }, { dogrulamaAnahtari: 'B' });
    const b = anahtarlariBirlestir({ dogrulamaAnahtari: 'A', eskiAnahtarlar: ['B'] }, { dogrulamaAnahtari: 'C' });
    expect(a.eskiAnahtarlar).toEqual(b.eskiAnahtarlar);
  });
});

describe('Google döneminin ayarları', () => {
  // Google yedeği kalktı ama eski bir cihazın yedeğinde ya da kasasında bu
  // alanlar hâlâ gelebilir: hiçbiri bir daha cihazdan çıkmamalı.
  it('eski adların hepsi cihaza özel listede kalıyor', () => {
    for (const a of ['senkronParolasi', 'senkronIstemciId', 'senkronIstemciIdBozuk', 'senkronAcik', 'senkronHesap', 'senkronDosyaId']) {
      expect(ESKI_SENKRON_AYARLARI).toContain(a);
      expect(CIHAZA_OZEL_AYARLAR).toContain(a);
    }
  });
});

describe('parmak izi', () => {
  it('rev farkını görmezden geliyor — yoksa her tur boşuna yükleniyor', () => {
    const b = (rev) => ({ koleksiyonlar: { ilaclar: [{ id: 'ila_1', rev, ad: 'Parol', guncellendi: 'T' }] } });
    expect(belgeParmakIzi(b(1))).toBe(belgeParmakIzi(b(9)));
  });
  it('sıra farkını görmezden geliyor', () => {
    const k = (l) => ({ koleksiyonlar: { ilaclar: l } });
    const x = { id: 'ila_1', ad: 'A' }, y = { id: 'ila_2', ad: 'B' };
    expect(belgeParmakIzi(k([x, y]))).toBe(belgeParmakIzi(k([y, x])));
  });
  it('aynı damgayla farklı ayar içeriğini AYIRT EDİYOR', () => {
    const k = (ayar) => ({ koleksiyonlar: { ayarlar: [{ id: 'genel', guncellendi: 'T', ...ayar }] } });
    expect(belgeParmakIzi(k({ doktorAd: 'A' }))).not.toBe(belgeParmakIzi(k({ doktorAd: 'A', telefon: '1' })));
  });
});

describe('iki cihaz', () => {
  let a, b, bulut;
  beforeEach(() => { a = new BellekDepo(); b = new BellekDepo(); bulut = bellekTasima(); });
  const es = (depo) => senkronEt(depo, bulut, { parola: PAROLA });
  const adlar = async (depo) => (await depo.listele('hastalar', { sirala: 'soyad' })).map((h) => h.soyad);

  it('bilgisayardaki kayıtlar telefona geçiyor', async () => {
    await a.kaydet('hastalar', { ad: 'Ali', soyad: 'Ahmadi' });
    await es(a);
    await es(b);
    expect(await adlar(b)).toEqual(['Ahmadi']);
  });

  it('iki cihazda ayrı ayrı eklenenler birleşiyor', async () => {
    await a.kaydet('hastalar', { ad: 'Ali', soyad: 'Ahmadi' });
    await b.kaydet('hastalar', { ad: 'Sara', soyad: 'Zadran' });
    await es(a);            // a → bulut
    await es(b);            // bulut → b, sonra b → bulut
    await es(a);            // bulut → a
    expect(await adlar(a)).toEqual(['Ahmadi', 'Zadran']);
    expect(await adlar(b)).toEqual(['Ahmadi', 'Zadran']);
  });

  it('bir cihazdaki silme öbüründe de siliyor, kayıt dirilmiyor', async () => {
    const h = await a.kaydet('hastalar', { ad: 'Ali', soyad: 'Ahmadi' });
    await es(a); await es(b);
    expect(await adlar(b)).toEqual(['Ahmadi']);
    await a.sil('hastalar', h.id);
    await es(a); await es(b);
    expect(await adlar(b)).toEqual([]);
    // b yüklediğinde mezar taşı bulutta kalmalı, a yeniden diriltmemeli
    await es(a);
    expect(await adlar(a)).toEqual([]);
  });

  it('aynı kaydın iki cihazdaki değişikliğinde yenisi kazanıyor', async () => {
    const h = await a.kaydet('hastalar', { ad: 'Ali', soyad: 'Ahmadi' });
    await es(a); await es(b);
    const bh = (await b.listele('hastalar'))[0];
    await b.kaydet('hastalar', { ...bh, telefon: 'telefondan' });
    await a.kaydet('hastalar', { ...h, telefon: 'bilgisayardan' });
    await es(b); await es(a); await es(b);
    const son = (await a.listele('hastalar'))[0].telefon;
    expect(son).toBe('bilgisayardan');           // a sonra kaydetti
    expect((await b.listele('hastalar'))[0].telefon).toBe(son);
  });

  it('antet iki cihazdan parça parça dolduğunda ikisi de kalıyor', async () => {
    await a.ayarKaydet({ doktorAd: 'Ahmad', telefon: '' });
    await b.ayarKaydet({ doktorAd: '', telefon: '0700' });
    await es(a); await es(b); await es(a);
    for (const depo of [a, b]) {
      const ayar = await depo.ayarlar();
      expect(ayar.doktorAd).toBe('Ahmad');
      expect(ayar.telefon).toBe('0700');
    }
  });

  it('eşitlemeden önce basılmış reçete öbür cihazda da doğrulanıyor', async () => {
    const ozet = 'نسخه: 1\nتاریخ: 2026-01-01\nمریض: Ali';
    const kod = await kodUret(a, ozet);                 // a kendi anahtarını üretti
    await kodUret(b, 'başka');                          // b de kendi anahtarını üretti
    const aAnahtar = (await a.ayarlar()).dogrulamaAnahtari;
    const bAnahtar = (await b.ayarlar()).dogrulamaAnahtari;
    expect(aAnahtar).not.toBe(bAnahtar);

    await es(a); await es(b); await es(a);

    for (const depo of [a, b]) {
      const r = await metniDogrula(depo, `${ozet}\nکد تأیید: ${kod}`);
      expect(r.durum).toBe('gecerli');
      expect((await anahtarlar(depo)).length).toBe(2);
    }
  });

  it('parola ve imza görseli cihazda kalıyor, buluta gitmiyor', async () => {
    await a.ayarKaydet({ senkronParolasi: PAROLA, senkronIstemciId: 'gizli.apps', doktorAd: 'Ahmad', imzaGorseli: 'data:image/jpeg;base64,IMZA' });
    await es(a);
    const icerik = await kasadanAl(bulut.icerik, PAROLA);
    const ayar = icerik.koleksiyonlar.ayarlar[0];
    expect(CIHAZA_OZEL_AYARLAR).toContain('imzaGorseli');
    expect(JSON.stringify(icerik)).not.toContain('IMZA');
    for (const alan of CIHAZA_OZEL_AYARLAR) expect(ayar[alan]).toBeUndefined();
    expect(ayar.doktorAd).toBe('Ahmad');
  });

  it('iki cihaz aynı anteti ayrı ayrı yazdıysa gidip gelmiyor', async () => {
    // Aynı içerik, farklı damga. Birleşme "değişen yok" deyip yazmazsa iki
    // cihaz sonsuza kadar birbirine kendi damgasını yükleyip durur.
    await a.ayarKaydet({ doktorAd: 'Ahmad' });
    await new Promise((c) => setTimeout(c, 2));
    await b.ayarKaydet({ doktorAd: 'Ahmad' });
    await es(a); await es(b); await es(a); await es(b);
    expect((await es(a)).yuklendi).toBe(false);
    expect((await es(b)).yuklendi).toBe(false);
    expect((await a.ayarlar()).guncellendi).toBe((await b.ayarlar()).guncellendi);
  });

  it('değişiklik yoksa ikinci tur bir şey yüklemiyor', async () => {
    await a.kaydet('hastalar', { ad: 'Ali', soyad: 'Ahmadi' });
    expect((await es(a)).yuklendi).toBe(true);
    expect((await es(a)).yuklendi).toBe(false);
    await es(b);
    expect((await es(b)).yuklendi).toBe(false);
    expect((await es(a)).yuklendi).toBe(false);
  });

  it('yanlış parolayla eşitleme veriyi bozmuyor', async () => {
    await a.kaydet('hastalar', { ad: 'Ali', soyad: 'Ahmadi' });
    await es(a);
    await expect(senkronEt(b, bulut, { parola: 'yanlış' })).rejects.toMatchObject({ kod: 'parola' });
    expect(await adlar(b)).toEqual([]);
    expect(await kasadanAl(bulut.icerik, PAROLA)).toBeTruthy();
  });

  it('parolasız eşitleme reddediliyor', async () => {
    await expect(senkronEt(a, bulut, {})).rejects.toMatchObject({ kod: 'parola_yok' });
  });

  it('uzak kopya arada değişirse baştan birleştirip yine de yazıyor', async () => {
    await a.kaydet('hastalar', { ad: 'Ali', soyad: 'Ahmadi' });
    await es(a);
    await b.kaydet('hastalar', { ad: 'Sara', soyad: 'Zadran' });

    // b okuduktan SONRA, yazmadan önce a araya giriyor.
    const gercekOku = bulut.oku.bind(bulut);
    let birKez = false;
    bulut.oku = async () => {
      const r = await gercekOku();
      if (!birKez) {
        birKez = true;
        await a.kaydet('hastalar', { ad: 'Omar', soyad: 'Karimi' });
        await es(a);
      }
      return r;
    };
    await senkronEt(b, bulut, { parola: PAROLA });
    bulut.oku = gercekOku;
    await es(a);
    expect(await adlar(a)).toEqual(['Ahmadi', 'Karimi', 'Zadran']);
    expect(await adlar(b)).toEqual(['Ahmadi', 'Karimi', 'Zadran']);
  });

  it('şifresiz belge YALNIZ açıkça istenirse okunuyor ve şifreli yazılıyor', async () => {
    await a.kaydet('hastalar', { ad: 'Ali', soyad: 'Ahmadi' });
    const acik = bellekTasima(belgeyiTemizle(await belgeDerle(a)));
    await senkronEt(b, acik, { parola: PAROLA, sifresizKabul: true });
    expect(await adlar(b)).toEqual(['Ahmadi']);
    expect(kasaMi(acik.icerik)).toBe(true);   // bir daha şifreli yazılıyor
  });

  it('varsayılanda şifresiz uzak paket REDDEDİLİYOR, yerele hiçbir şey yazılmıyor', async () => {
    // K'yi bilmeyen biri (jetonu çalan, sahte sunucu) yalnız kasa dışı bir
    // paket koyabilir: sahte hasta, antet ve reçete doğrulama anahtarı.
    await b.kaydet('hastalar', { ad: 'Sara', soyad: 'Zadran' });
    const once = await b.ayarlar();
    const sahte = bellekTasima({
      bicim: 'shafa-yedek', semaSurumu: 3,
      koleksiyonlar: {
        hastalar: [{ id: 'has_sahte', ad: 'Sahte', soyad: 'Hasta', rev: 1, guncellendi: '2099-01-01T00:00:00.000Z' }],
        ayarlar: [{ id: 'genel', doktorAd: 'Saldırgan', eskiAnahtarlar: ['QUFBQQ=='], guncellendi: '2099-01-01T00:00:00.000Z' }],
      },
    });
    await expect(senkronEt(b, sahte, { parola: PAROLA })).rejects.toMatchObject({ kod: 'kasa_bozuk' });
    expect(await adlar(b)).toEqual(['Zadran']);
    expect(await b.ayarlar()).toEqual(once);
    expect(kasaMi(sahte.icerik)).toBe(false);  // üstüne de yazılmadı
  });

  it('bozuk bir dosya eşitlemeyi patlatıyor ama yereli bozmuyor', async () => {
    await b.kaydet('hastalar', { ad: 'Sara', soyad: 'Zadran' });
    const bozuk = bellekTasima({ bicim: 'shafa-yedek', koleksiyonlar: { yok_boyle: [] } });
    await expect(senkronEt(b, bozuk, { parola: PAROLA })).rejects.toThrow(SenkronHatasi);
    expect(await adlar(b)).toEqual(['Zadran']);
  });
});

describe('kasa 2. sürüm: gzip', () => {
  afterEach(() => vi.unstubAllGlobals());
  // Eski kod (1. sürüm, sıkıştırmasız) ile üretilmiş gerçek bir kasa: bugünkü
  // okuyucu onu açabilmeli. Değer git geçmişindeki kasa.js ile üretildi.
  const V1 = {
    bicim: 'shafa-kasa', surum: 1, dongu: 310000, tuz: 'IGo8j9AxFLt+KpnJVJ7X/Q==', iv: 'e8A1H1220jBN9cHu',
    veri: 'B9958V3aDHmpfauInf3nvxIkUWjFJ46TRhoZisQQ3deMMDr4NKVXvN+m0fO1PyEagSsG8n+FXvsmexdMXvA33rt2YLql9q4ToPymT2lONkfGGAoIY/GyAjXpXir5SHMqGEwzhQ6dfqdNxqvf1fbSdySXg/FZ',
  };

  it('1. sürüm kasa hâlâ açılıyor', async () => {
    const b = await kasadanAl(V1, 'eski-kasa-kodu');
    expect(b.koleksiyonlar.hastalar[0]).toMatchObject({ id: 'has_v1', soyad: 'Sultani' });
  });

  it('gzip\'li kasa gidip geliyor ve gerçekten küçülüyor', async () => {
    const buyuk = { hastalar: Array.from({ length: 300 }, (_, i) => ({ id: 'has_' + i, ad: 'عبدالله', soyad: 'احمدی', notlar: 'سابقه ندارد' })) };
    const sikisik = await kasayaKoy(buyuk, PAROLA);
    const duz = await kasayaKoy(buyuk, PAROLA, { sikistir: false });
    expect(sikisik).toMatchObject({ surum: KASA_SURUMU, sikistirma: 'gzip' });
    expect(duz.sikistirma).toBeUndefined();
    expect(sikisik.veri.length * 5).toBeLessThan(duz.veri.length);
    expect(await kasadanAl(sikisik, PAROLA)).toEqual(buyuk);
    expect(await kasadanAl(duz, PAROLA)).toEqual(buyuk);
    expect(JSON.stringify(sikisik)).not.toContain('عبدالله');
  });

  it('paket JSON\'u sunucunun beklediği önekle başlıyor', async () => {
    for (const sikistir of [true, false]) {
      const p = await kasayaKoy({ a: 1 }, PAROLA, { sikistir });
      expect(JSON.stringify(p).startsWith('{"bicim":"shafa-kasa"')).toBe(true);
    }
  });

  it('CompressionStream olmayan tarayıcı sıkıştırmasız yazıyor, öbürleri okuyor', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    const p = await kasayaKoy({ a: 1 }, PAROLA);
    expect(p.sikistirma).toBeUndefined();
    vi.unstubAllGlobals();
    expect(await kasadanAl(p, PAROLA)).toEqual({ a: 1 });
  });

  it('DecompressionStream yoksa gzip\'li kasa "tarayıcıyı güncelle" diyor, parola suçlanmıyor', async () => {
    const p = await kasayaKoy({ a: 1 }, PAROLA);
    vi.stubGlobal('DecompressionStream', undefined);
    await expect(kasadanAl(p, PAROLA)).rejects.toMatchObject({ kod: 'gzip_yok' });
  });

  it('tanınmayan sıkıştırma "daha yeni sürüm" sayılıyor', async () => {
    const p = await kasayaKoy({ a: 1 }, PAROLA);
    await expect(kasadanAl({ ...p, sikistirma: 'brotli' }, PAROLA)).rejects.toMatchObject({ kod: 'surum' });
  });

  it('sıkıştırma etiketi oynanırsa "bozuk", açık veri sızmıyor', async () => {
    const p = await kasayaKoy({ a: 1 }, PAROLA);
    const { sikistirma, ...etiketsiz } = p;
    expect(sikistirma).toBe('gzip');
    await expect(kasadanAl(etiketsiz, PAROLA)).rejects.toMatchObject({ kod: 'bozuk' });
  });

  it('eşitleme gzip_yok ve surum kodlarını yutmuyor', async () => {
    const a = new BellekDepo();
    const bulut = bellekTasima();
    await a.kaydet('hastalar', { ad: 'Ali', soyad: 'Ahmadi' });
    await senkronEt(a, bulut, { parola: PAROLA });
    vi.stubGlobal('DecompressionStream', undefined);
    await expect(senkronEt(new BellekDepo(), bulut, { parola: PAROLA })).rejects.toMatchObject({ kod: 'gzip_yok' });
    vi.unstubAllGlobals();
    const ileri = bellekTasima({ ...bulut.icerik, surum: 99 });
    await expect(senkronEt(new BellekDepo(), ileri, { parola: PAROLA })).rejects.toMatchObject({ kod: 'surum' });
  });
});

describe('örnek kayıtlar eşitlenmiyor', () => {
  it('yüklenmiyor; eski bir istemcinin yüklediği örnek de inmiyor', async () => {
    const a = new BellekDepo();
    await ornekYukle(a);
    await a.kaydet('hastalar', { ad: 'Ali', soyad: 'Ahmadi' });
    const bulut = bellekTasima();
    await senkronEt(a, bulut, { parola: PAROLA });
    const icerik = await kasadanAl(bulut.icerik, PAROLA);
    const tumu = Object.values(icerik.koleksiyonlar).flat();
    expect(tumu.some((k) => k.ornek === 1)).toBe(false);
    expect(icerik.koleksiyonlar.hastalar.map((h) => h.soyad)).toEqual(['Ahmadi']);

    // Eski istemci örnekleri de yüklemiş olsun: öbür cihaza inmemeli.
    const eski = await kasayaKoy(belgeyiTemizle(await belgeDerle(a)), PAROLA);
    const b = new BellekDepo();
    await senkronEt(b, bellekTasima(eski), { parola: PAROLA });
    expect((await b.listele('hastalar')).map((h) => h.soyad)).toEqual(['Ahmadi']);
    expect(await b.say('ilaclar')).toBe(0);
  });

  it('bu cihazda silinen örnekler eşitlemeyle geri gelmiyor', async () => {
    const a = new BellekDepo();
    const bulut = bellekTasima();
    await ornekYukle(a);
    await senkronEt(a, bulut, { parola: PAROLA });
    await a.ornekSil();
    await senkronEt(a, bulut, { parola: PAROLA });
    expect(await a.say('hastalar')).toBe(0);
    expect(await a.say('ilaclar')).toBe(0);
  });
});

describe('cihaza özel ayarlar dosya yedeğine ve içe aktarmaya karışmıyor', () => {
  // İmza görseli de cihaza özel: imza cihazdan çıkarsa sahte reçete basılır.
  const SIRLAR = { senkronParolasi: 'GIZLI-KASA-KODU', senkronIstemciId: 'x.apps', senkronAcik: 1, hesapJetonu: 'jeton-gizli', imzaGorseli: 'data:image/jpeg;base64,IMZA-VERISI' };

  it('yedek dosyasında jeton, K ya da Google dönemi sırrı yok', async () => {
    const d = await new IdbDepo('yedek-sir-' + Math.random().toString(36).slice(2)).ac();
    await d.ayarKaydet({ ...SIRLAR, doktorAd: 'Ahmad' });
    await d.hesapKaydet({ kullanici: 'dr.nemuna', jeton: 'ZHIubmVtdW5h.jeton-degeri', kasa: 'KASA-ANAHTARI-K' });
    const metin = JSON.stringify(await yedekOlustur(d));
    for (const deger of [...Object.values(SIRLAR).map(String).filter((v) => v.length > 2), 'jeton-degeri', 'KASA-ANAHTARI-K']) {
      expect(metin).not.toContain(deger);
    }
    for (const alan of CIHAZA_OZEL_AYARLAR) expect(metin).not.toContain(`"${alan}"`);
    expect(metin).not.toContain('"meta"');
    expect(metin).toContain('Ahmad');
  });

  for (const strateji of ['birlestir', 'degistir']) {
    it(`içe aktarma (${strateji}) gelen cihaza özel alanları yok sayıyor, yereldekini koruyor`, async () => {
      const d = new BellekDepo();
      await d.ayarKaydet({ senkronParolasi: 'BENIM', doktorAd: 'Eski' });
      const belge = {
        bicim: 'shafa-yedek', semaSurumu: 3,
        koleksiyonlar: { ayarlar: [{ id: 'genel', rev: 1, guncellendi: '2099-01-01T00:00:00.000Z', doktorAd: 'Yeni', ...SIRLAR, senkronParolasi: 'ONUNKI' }] },
      };
      await iceAktar(d, belge, { strateji });
      const ayar = await d.ayarlar();
      expect(ayar.doktorAd).toBe('Yeni');
      expect(ayar.senkronParolasi).toBe('BENIM');
      expect(ayar.hesapJetonu).toBeUndefined();
      expect(ayar.senkronIstemciId).toBeUndefined();
      expect(ayar.imzaGorseli).toBeUndefined();
    });
  }

  it('ayar kaydı olmayan cihaza da gelen cihaza özel alan yazılmıyor', async () => {
    const d = new BellekDepo();
    const belge = { bicim: 'shafa-yedek', semaSurumu: 3, koleksiyonlar: { ayarlar: [{ id: 'genel', guncellendi: 'T', doktorAd: 'Yeni', ...SIRLAR }] } };
    await iceAktar(d, belge);
    const ayar = await d.ayarlar();
    expect(ayar.doktorAd).toBe('Yeni');
    for (const alan of Object.keys(SIRLAR)) expect(ayar[alan]).toBeUndefined();
  });

  it('dosyadaki "meta" koleksiyonu cihazın hesap durumunu ezmiyor', async () => {
    // Başka birinin jetonunu ve K'sini taşıyan bir dosya cihazı onun hesabına
    // bağlayıp bu cihazın hastalarını ona yükletebilirdi.
    const d = new BellekDepo();
    await d.hesapKaydet({ kullanici: 'dr.nemuna', jeton: 'benim-jetonum', kasa: 'BENIM-K' });
    const belge = {
      bicim: 'shafa-yedek', semaSurumu: 3,
      koleksiyonlar: { meta: [{ id: 'hesap', kullanici: 'saldirgan', jeton: 'onun-jetonu', kasa: 'ONUN-K' }, { id: 'meta', senkronSayaci: -5 }] },
    };
    for (const strateji of ['birlestir', 'degistir']) {
      expect((await iceAktar(d, belge, { strateji })).ok).toBe(true);
      expect(await d.hesap()).toMatchObject({ kullanici: 'dr.nemuna', jeton: 'benim-jetonum', kasa: 'BENIM-K' });
      expect((await d.meta()).senkronSayaci).toBeUndefined();
    }
  });
});

describe('Google döneminin ayarları açılışta siliniyor', () => {
  it('bir kez siliniyor, damga ve sayaç oynamıyor, antet kalıyor', async () => {
    const d = await new IdbDepo('eski-ayar-' + Math.random().toString(36).slice(2)).ac();
    await d.ayarKaydet({ senkronParolasi: 'ESKI-K', senkronAcik: 1, senkronIstemciId: 'x', senkronIstemciIdBozuk: 'y', senkronHesap: 'a@b', senkronDosyaId: 'z', doktorAd: 'Ahmad' });
    const once = await d.ayarlar();
    const metaOnce = await d.meta();
    expect(await eskiSenkronAyarlariniSil(d)).toBe(true);
    const sonra = await d.ayarlar();
    for (const a of ESKI_SENKRON_AYARLARI) expect(sonra[a]).toBeUndefined();
    expect(sonra).toMatchObject({ doktorAd: 'Ahmad', guncellendi: once.guncellendi, rev: once.rev });
    expect(await d.meta()).toEqual(metaOnce);
    expect(await eskiSenkronAyarlariniSil(d)).toBe(false);
  });
});

describe('eşitleme sayacı', () => {
  it('kayıt ve silme sayılıyor; silme yedek hatırlatmasını oynatmıyor', async () => {
    const d = await new IdbDepo('sayac-' + Math.random().toString(36).slice(2)).ac();
    const h = await d.kaydet('hastalar', { ad: 'Ali', soyad: 'Ahmadi' });
    expect(await d.meta()).toMatchObject({ degisiklikSayaci: 1, senkronSayaci: 1 });
    await d.sil('hastalar', h.id);
    expect(await d.meta()).toMatchObject({ degisiklikSayaci: 1, senkronSayaci: 2 });
    await yedekOlustur(d);
    expect(await d.meta()).toMatchObject({ degisiklikSayaci: 0, senkronSayaci: 2 });
  });

  it('eşzamanlı meta yazmaları birbirini ezmiyor', async () => {
    // Hesap durumu, yedek sayacı ve eşitleme sayacı aynı depoda; okuma ile
    // yazma arasına giren bir yazma öbürünü silmemeli.
    const d = await new IdbDepo('yaris-' + Math.random().toString(36).slice(2)).ac();
    await Promise.all([
      d.metaKaydet({ sonYedek: 'T' }),
      ...Array.from({ length: 10 }, () => d.degisiklikSay()),
      d.hesapKaydet({ jeton: 'j' }),
      d.hesapKaydet({ kasa: 'k' }),
    ]);
    expect(await d.meta()).toMatchObject({ degisiklikSayaci: 10, senkronSayaci: 10, sonYedek: 'T' });
    expect(await d.hesap()).toMatchObject({ jeton: 'j', kasa: 'k' });
  });
});
