import { describe, it, expect, beforeEach } from 'vitest';
import { BellekDepo } from '../app/js/depo/depo.js';
import { senkronEt, bellekTasima, SenkronHatasi } from '../app/js/depo/senkron.js';
import { ayarlariBirlestir, anahtarlariBirlestir, belgeyiTemizle, belgeParmakIzi, CIHAZA_OZEL_AYARLAR, bozukKimligiAyikla } from '../app/js/paylasilan/senkron.js';
import { kasayaKoy, kasadanAl, kasaMi, KasaHatasi, donguSayisi, DONGU } from '../app/js/paylasilan/kasa.js';
import { kodUret, metniDogrula, anahtarlar } from '../app/js/depo/dogrulama.js';
import { belgeDerle } from '../app/js/depo/yedek.js';

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
    const paket = await kasayaKoy({ a: 1 }, PAROLA);
    const bozuk = { ...paket, veri: paket.veri.slice(0, -2) + (paket.veri.at(-2) === 'A' ? 'B' : 'A') + paket.veri.at(-1) };
    await expect(kasadanAl(bozuk, PAROLA)).rejects.toThrow(KasaHatasi);
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

describe('bozuk istemci kimliği', () => {
  const GECERLI = '992727769946-82oa2himlups0dihvjau26hp7det5pu8.apps.googleusercontent.com';

  it('yarım kalmış kimliği kenara alıyor, silmiyor', () => {
    const yama = bozukKimligiAyikla({ senkronIstemciId: '992727769946-82oa2him' });
    expect(yama).toEqual({ senkronIstemciId: '', senkronIstemciIdBozuk: '992727769946-82oa2him' });
  });
  it('geçerli kimliğe dokunmuyor', () => {
    // Kendi Google Cloud projesini kullanan hekimin değeri kaybolmamalı.
    expect(bozukKimligiAyikla({ senkronIstemciId: GECERLI })).toBe(null);
    expect(bozukKimligiAyikla({ senkronIstemciId: ' ' + GECERLI + ' ' })).toBe(null);
  });
  it('alan zaten boşsa bir şey yapmıyor', () => {
    expect(bozukKimligiAyikla({})).toBe(null);
    expect(bozukKimligiAyikla({ senkronIstemciId: '' })).toBe(null);
    expect(bozukKimligiAyikla(null)).toBe(null);
  });
  it('kenara alınan değer buluta gitmiyor', () => {
    expect(CIHAZA_OZEL_AYARLAR).toContain('senkronIstemciIdBozuk');
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

  it('parola cihazda kalıyor, buluta gitmiyor', async () => {
    await a.ayarKaydet({ senkronParolasi: PAROLA, senkronIstemciId: 'gizli.apps', doktorAd: 'Ahmad' });
    await es(a);
    const icerik = await kasadanAl(bulut.icerik, PAROLA);
    const ayar = icerik.koleksiyonlar.ayarlar[0];
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

  it('bulutta şifresiz bir belge varsa yine de okunuyor', async () => {
    await a.kaydet('hastalar', { ad: 'Ali', soyad: 'Ahmadi' });
    const acik = bellekTasima(belgeyiTemizle(await belgeDerle(a)));
    await senkronEt(b, acik, { parola: PAROLA });
    expect(await adlar(b)).toEqual(['Ahmadi']);
    expect(kasaMi(acik.icerik)).toBe(true);   // bir daha şifreli yazılıyor
  });

  it('bozuk bir dosya eşitlemeyi patlatıyor ama yereli bozmuyor', async () => {
    await b.kaydet('hastalar', { ad: 'Sara', soyad: 'Zadran' });
    const bozuk = bellekTasima({ bicim: 'shafa-yedek', koleksiyonlar: { yok_boyle: [] } });
    await expect(senkronEt(b, bozuk, { parola: PAROLA })).rejects.toThrow(SenkronHatasi);
    expect(await adlar(b)).toEqual(['Zadran']);
  });
});
