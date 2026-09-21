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
