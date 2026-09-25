// Doğrulama kodunun tek işi var: kâğıtta oynanmışsa tutmamak.
// Testler bunu iki yönden kovalıyor — aynı içerik aynı kodu vermeli,
// değişen her şey kodu bozmalı.
import { describe, it, expect, beforeEach } from 'vitest';
import { ozetMetni, koduBicimle, metniAyir, kodEsit, kodSatiri, KOD_ALFABE } from '../app/js/paylasilan/dogrulama.js';
import { kodUret, receteKodu, metniDogrula, anahtarAl } from '../app/js/depo/dogrulama.js';
import { BellekDepo } from '../app/js/depo/depo.js';
import { receteKaydet } from '../app/js/depo/recete.js';

const recete = () => ({
  receteNo: '2026-09-21-01', tarih: '2026-09-21', tani: 'Üst solunum yolu enfeksiyonu', taniKodu: 'J06.9',
  satirlar: [
    { ilacAdi: 'Nurofen 400 mg', adet: 2, kullanim: 'Günde 2×1', sure: '5 gün' },
    { ilacAdi: 'Parol 500 mg', adet: 1, kullanim: '', sure: '' },
  ],
});

describe('ozetMetni', () => {
  it('reçeteyi kararlı bir metne indirger', () => {
    const m = ozetMetni(recete(), 'Zeynep Kaya');
    expect(m).toContain('2026-09-21-01');
    expect(m).toContain('Zeynep Kaya');
    expect(m).toContain('1) Nurofen 400 mg × 2 — Günde 2×1 — 5 gün');
    expect(m).toContain('2) Parol 500 mg × 1');
  });
  it('aynı reçete hep aynı özeti verir', () => {
    expect(ozetMetni(recete(), 'A')).toBe(ozetMetni(recete(), 'A'));
  });
  it('karşılama özeti değiştirmez — verilen adet koda girmez', () => {
    const r = recete();
    const once = ozetMetni(r, 'A');
    r.satirlar[0].verilenAdet = 2;
    r.satirlar[0].verilmeTarihi = '2026-09-21T10:00:00Z';
    expect(ozetMetni(r, 'A')).toBe(once);
  });
  it('boşluk farkları özeti değiştirmez', () => {
    const r = recete();
    r.satirlar[0].kullanim = '  Günde   2×1 ';
    expect(ozetMetni(r, 'A')).toBe(ozetMetni(recete(), 'A'));
  });
});

describe('koduBicimle', () => {
  it('sekiz harfli, tireli kod üretir', () => {
    const kod = koduBicimle(new Uint8Array([0, 1, 2, 3, 4, 5, 6]));
    expect(kod).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  });
  it('yalnız karıştırılmayan harfleri kullanır', () => {
    for (let i = 0; i < 40; i++) {
      const kod = koduBicimle(new Uint8Array([i, i * 3, i * 7, i * 11, i * 13]));
      for (const h of kod.replace('-', '')) expect(KOD_ALFABE).toContain(h);
    }
    expect(KOD_ALFABE).not.toMatch(/[01IO]/);
  });
});

describe('metniAyir / kodEsit', () => {
  it('kod satırını ayırır', () => {
    const { ozet, kod } = metniAyir('satır bir\nsatır iki\n' + kodSatiri('4F9K-2P7R'));
    expect(ozet).toBe('satır bir\nsatır iki');
    expect(kod).toBe('4F9K-2P7R');
  });
  it('kod yoksa boş döner', () => {
    expect(metniAyir('yalnız metin').kod).toBe('');
  });
  it('büyük/küçük harf ve tire farkını yutar', () => {
    expect(kodEsit('4f9k2p7r', '4F9K-2P7R')).toBe(true);
    expect(kodEsit('', '')).toBe(false);
    expect(kodEsit('4F9K-2P7R', '4F9K-2P7S')).toBe(false);
  });
});

describe('kod üretimi', () => {
  let depo;
  beforeEach(() => { depo = new BellekDepo(); });

  it('aynı metin aynı kodu verir', async () => {
    expect(await kodUret(depo, 'merhaba')).toBe(await kodUret(depo, 'merhaba'));
  });
  it('metin değişince kod değişir', async () => {
    expect(await kodUret(depo, 'merhaba')).not.toBe(await kodUret(depo, 'merhabo'));
  });
  it('başka cihaz (başka anahtar) başka kod üretir', async () => {
    const digerDepo = new BellekDepo();
    expect(await kodUret(depo, 'merhaba')).not.toBe(await kodUret(digerDepo, 'merhaba'));
  });
  it('anahtar bir kez üretilir, sonra sabit kalır', async () => {
    const a = await anahtarAl(depo);
    const b = await anahtarAl(depo);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(a).toHaveLength(32);
  });
});

describe('metniDogrula', () => {
  let depo;
  beforeEach(() => { depo = new BellekDepo(); });

  const kagitMetni = async () => {
    const ozet = ozetMetni(recete(), 'Zeynep Kaya');
    return `${ozet}\n${kodSatiri(await receteKodu(depo, recete(), 'Zeynep Kaya'))}`;
  };

  it('dokunulmamış reçeteyi geçerli sayar', async () => {
    expect((await metniDogrula(depo, await kagitMetni())).durum).toBe('gecerli');
  });
  it('adedi değiştirilmiş reçeteyi yakalar', async () => {
    const bozuk = (await kagitMetni()).replace('× 2', '× 20');
    expect((await metniDogrula(depo, bozuk)).durum).toBe('gecersiz');
  });
  it('ilaç eklenmiş reçeteyi yakalar', async () => {
    const m = await kagitMetni();
    const bozuk = m.replace('2) Parol 500 mg × 1', '2) Parol 500 mg × 1\n3) Majezik 100 mg × 5');
    expect((await metniDogrula(depo, bozuk)).durum).toBe('gecersiz');
  });
  it('hasta adı değiştirilmiş reçeteyi yakalar', async () => {
    const bozuk = (await kagitMetni()).replace('Zeynep Kaya', 'Ahmet Kaya');
    expect((await metniDogrula(depo, bozuk)).durum).toBe('gecersiz');
  });
  it('başka cihazdan uydurulmuş kodu yakalar', async () => {
    const sahte = new BellekDepo();
    const ozet = ozetMetni(recete(), 'Zeynep Kaya');
    const metin = `${ozet}\n${kodSatiri(await receteKodu(sahte, recete(), 'Zeynep Kaya'))}`;
    expect((await metniDogrula(depo, metin)).durum).toBe('gecersiz');
  });
  it('kodsuz metni ayırt eder ve olması gereken kodu söyler', async () => {
    const r = await metniDogrula(depo, ozetMetni(recete(), 'Zeynep Kaya'));
    expect(r.durum).toBe('kodsuz');
    expect(r.beklenen).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  });
  it('boş metinde çökmez', async () => {
    expect((await metniDogrula(depo, '   ')).durum).toBe('kodsuz');
  });
  // Reçete özeti QR'a sığmayınca kâğıt yalnız kod satırını basıyor («Scan
  // to Verify»). O metin «metinde kod yok» diyordu; oysa metin koddan ibaret.
  it('salt kod metni: kaydı bu cihazdaysa o reçetenin özetiyle «kayıtlı»', async () => {
    const hasta = await depo.kaydet('hastalar', { ad: 'Zeynep', soyad: 'Kaya' });
    const y = await receteKaydet(depo, { ...recete(), hastaId: hasta.id });
    const r = await metniDogrula(depo, kodSatiri(y.dogrulamaKodu.toLowerCase()));
    expect(r).toMatchObject({ durum: 'kayitli', receteNo: y.receteNo, ozet: ozetMetni(y, 'Zeynep Kaya'), eskiyle: false });
  });
  it('salt kod metni: kayıt yoksa «bilinmiyor», kaydı sonradan değişmişse «geçersiz»', async () => {
    expect((await metniDogrula(depo, kodSatiri('ABCD-EFGH'))).durum).toBe('bilinmiyor');
    const y = await receteKaydet(depo, recete());
    await depo.kaydet('receteler', { ...y, satirlar: [{ ilacAdi: 'Başka ilaç', adet: 9 }] });
    expect((await metniDogrula(depo, kodSatiri(y.dogrulamaKodu))).durum).toBe('gecersiz');
  });
});

describe('receteKaydet', () => {
  it('kaydederken kodu reçeteye işler', async () => {
    const depo = new BellekDepo();
    const hasta = await depo.kaydet('hastalar', { ad: 'Zeynep', soyad: 'Kaya' });
    const y = await receteKaydet(depo, { ...recete(), hastaId: hasta.id });
    expect(y.dogrulamaKodu).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect((await metniDogrula(depo, `${ozetMetni(y, 'Zeynep Kaya')}\n${kodSatiri(y.dogrulamaKodu)}`)).durum).toBe('gecerli');
  });
  it('ilaç değişince kod da değişir', async () => {
    const depo = new BellekDepo();
    const hasta = await depo.kaydet('hastalar', { ad: 'Zeynep', soyad: 'Kaya' });
    const a = await receteKaydet(depo, { ...recete(), hastaId: hasta.id });
    const b = await receteKaydet(depo, { ...a, satirlar: [{ ilacAdi: 'Başka ilaç', adet: 9 }] });
    expect(b.dogrulamaKodu).not.toBe(a.dogrulamaKodu);
  });
});

// Sahadaki basılmış her kod bu metne bağlı: satıra yeni alan (zaman, doz)
// eklendi diye eski reçetenin özeti tek bayt değişirse o kodların hepsi
// «geçersiz» çıkar. Metin donduruldu.
describe('ozetMetni — eski reçeteler bayt bayt aynı', () => {
  const ALTIN = [
    'نسخه: 2026-09-21-01',
    'تاریخ: 2026-09-21',
    'مریض: Zeynep Kaya',
    'تشخیص: Üst solunum yolu enfeksiyonu · J06.9',
    '1) Nurofen 400 mg × 2 — Günde 2×1 — 5 gün',
    '2) Parol 500 mg × 1',
  ].join('\n');

  it('zaman ve doz alanı olmayan eski satırlar', () => {
    expect(ozetMetni(recete(), 'Zeynep Kaya')).toBe(ALTIN);
  });

  it('boş zaman ve doz özeti değiştirmiyor', () => {
    const r = recete();
    r.satirlar = r.satirlar.map((s) => ({ ...s, zaman: '', doz: '400 mg' }));
    expect(ozetMetni(r, 'Zeynep Kaya')).toBe(ALTIN);
  });

  it('dolu zaman kullanım ile süre arasına giriyor', () => {
    const r = recete();
    r.satirlar[0].zaman = 'بعد از غذا';
    expect(ozetMetni(r, 'Zeynep Kaya')).toContain('1) Nurofen 400 mg × 2 — Günde 2×1 — بعد از غذا — 5 gün');
  });
});

// Sahada basılmış bir kâğıt: kod bu değişiklikten ÖNCEKİ sürümün koduyla
// (origin/main'deki dogrulama.js) sabit bir anahtarla üretildi ve donduruldu.
// Satır biçimi (zaman, doz), klinik adlar ya da kod yolu değişirse eski
// kâğıtlar «geçersiz» çıkar; bu test o anda düşer.
describe('eski kâğıdın kodu yeni sürümde de tutuyor', () => {
  const ANAHTAR = 'CzBVep/E6Q4zWH2ix+wRNluApcrvFDleg6jN8hc8YYY=';
  const ESKI_KOD = 'HGFH-6GD9';
  // Yeniden tasarımdan önceki kayıt biçimi: zaman ve doz alanı yok, klinik
  // adlar Dari, kullanım tek metin.
  const eskiRecete = () => ({
    receteNo: '1405-06-30-07', tarih: '2026-09-21', tani: 'عفونت مجرای تنفسی فوقانی', taniKodu: 'J06.9',
    belirtiler: 'تب، سرفه', laboratuvar: 'CBC', notlar: 'استراحت',
    satirlar: [
      { ilacId: 'ila_1', ilacAdi: 'Brufen 400 mg Tablet', form: 'tablet', adet: 2, kullanim: 'روزانه ۳ بار بعد از غذا', sure: '۵ روز', yol: 'خوراکی', not: '' },
      { ilacId: 'ila_2', ilacAdi: 'Panadol 500 mg Tablet', form: 'tablet', adet: 1, kullanim: '', sure: '', yol: '', not: 'در صورت تب' },
    ],
  });
  const BASILI = [
    'نسخه: 1405-06-30-07', 'تاریخ: 2026-09-21', 'مریض: زهرا صدیقی', 'تشخیص: عفونت مجرای تنفسی فوقانی · J06.9',
    '1) Brufen 400 mg Tablet × 2 — روزانه ۳ بار بعد از غذا — ۵ روز', '2) Panadol 500 mg Tablet × 1', `کد تأیید: ${ESKI_KOD}`,
  ].join('\n');
  let depo;
  beforeEach(async () => {
    depo = new BellekDepo();
    await depo.ayarKaydet('dogrulamaAnahtari', ANAHTAR);
  });

  it('kayıtlı eski reçeteden aynı kod çıkıyor', async () => {
    expect(await receteKodu(depo, eskiRecete(), 'زهرا صدیقی')).toBe(ESKI_KOD);
  });
  it('kâğıttan (QR ya da elle) yapıştırılan eski metin geçerli; adedi değişmişse değil', async () => {
    expect((await metniDogrula(depo, BASILI)).durum).toBe('gecerli');
    expect((await metniDogrula(depo, BASILI.replace('× 2', '× 20'))).durum).toBe('gecersiz');
  });
  it('düzenlemede boş gelen zaman ve doz alanları kodu değiştirmiyor', async () => {
    const r = eskiRecete();
    r.satirlar = r.satirlar.map((s) => ({ ...s, zaman: '', doz: '' }));
    expect(await receteKodu(depo, r, 'زهرا صدیقی')).toBe(ESKI_KOD);
  });
});

describe('metniDogrula — yemek zamanı', () => {
  let depo;
  beforeEach(() => { depo = new BellekDepo(); });

  it('kâğıttaki zaman değiştirilirse kod tutmuyor', async () => {
    const r = recete();
    r.satirlar[0].zaman = 'بعد از غذا';
    const metin = `${ozetMetni(r, 'A')}\n${kodSatiri(await receteKodu(depo, r, 'A'))}`;
    expect((await metniDogrula(depo, metin)).durum).toBe('gecerli');
    expect((await metniDogrula(depo, metin.replace('بعد از غذا', 'قبل از غذا'))).durum).toBe('gecersiz');
  });
});
