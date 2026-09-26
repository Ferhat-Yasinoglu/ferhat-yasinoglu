// Hazır ilaç listesinin üreticisi (tools/ilac-uret.mjs): çıktı tekrarlanabilir,
// kimlikler kararlı, nuskha'nın ilaç başına kullanımı hiçbir yoldan sızmıyor.
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  ilacListesiUret, belgeMetni, listeyiDenetle, dozYaz, kaynakKopyasi, YASAK_KAYNAK,
} from '../tools/ilac-uret.mjs';

const oku = async (yol) => readFile(new URL(yol, import.meta.url), 'utf8');
const gonderilenMetin = await oku('../app/veri/ilaclar.json');
const gonderilen = JSON.parse(gonderilenMetin);
const v2 = JSON.parse(await oku('./veri/ilaclar-v2.json'));
const kaynak = JSON.parse(await oku('../tools/kaynak/nuskha-ilaclar.json'));

describe('üretim tekrarlanabilir', () => {
  // Gönderilen dosya elle düzenlenmedi, araçtan çıktı: 2. sürüm + depodaki
  // nuskha kopyası bayt bayt aynı dosyayı veriyor.
  it('2. sürümden sıfırdan üretim gönderilen dosyanın aynısı', () => {
    expect(belgeMetni(ilacListesiUret(v2, kaynak.drugs).belge)).toBe(gonderilenMetin);
  });

  // İkinci çalıştırma hiçbir satırı eklememeli, kimlik kaydırmamalı.
  it('gönderilen dosyadan yeniden üretim hiçbir şeyi değiştirmiyor', () => {
    expect(belgeMetni(ilacListesiUret(gonderilen, kaynak.drugs).belge)).toBe(gonderilenMetin);
  });

  it('678 ilaç: Shafa\'nın 123\'ü h0001–h0123, nuskha\'dan 555', () => {
    expect(gonderilen.ilaclar).toHaveLength(678);
    expect(gonderilen.ilaclar.slice(0, 123).map((x) => x.hid)).toEqual(v2.ilaclar.map((_, i) => `h${String(i + 1).padStart(4, '0')}`));
    expect(gonderilen.ilaclar.slice(0, 123).map((x) => x.ad)).toEqual(v2.ilaclar.map((x) => x.ad));
  });

  it('kaynaktan çıkarılan satır listeden silinmiyor (birinin cihazında o kimlik var)', () => {
    const amoxil = (d) => d.brand === 'Amoxil';
    expect(kaynak.drugs.filter(amoxil).length).toBeGreaterThan(0);
    const { belge } = ilacListesiUret(gonderilen, kaynak.drugs.filter((d) => !amoxil(d)));
    expect(belgeMetni(belge)).toBe(gonderilenMetin);
  });

  it('yeni nuskha satırı sıradaki kimliği alıyor, eskiler kaymıyor', () => {
    const yeni = { form: 'Tab', generic: 'Paracetamol', brand: 'Deneme', strength: '325', unit: 'mg', frequent: false };
    const { belge } = ilacListesiUret(gonderilen, [...kaynak.drugs, yeni]);
    expect(belge.ilaclar).toHaveLength(679);
    expect(belge.ilaclar.at(-1)).toMatchObject({ hid: 'h0679', ad: 'Deneme', etkenMadde: 'Paracetamol', marka: 1, grup: 'musakkin' });
  });

  it('elle kuralın kaynağı değişmişse sessizce devam etmiyor', () => {
    const eksik = kaynak.drugs.filter((d) => !(d.generic === 'Oral Rehydration Salts' && d.form === 'Sachet'));
    expect(() => ilacListesiUret(v2, eksik)).toThrow(/elle kurallar/);
  });
});

describe('ilaç başına kullanım sızmıyor', () => {
  it('depodaki nuskha kopyasında dose/timing/tariqa/n yok', () => {
    for (const d of kaynak.drugs) for (const k of YASAK_KAYNAK) expect(k in d, `${d.brand || d.generic}: ${k}`).toBe(false);
    expect(kaynak.kaynak).toMatch(/nuskha/);
  });

  it('kopya kurulurken yasak alanlar atılıyor', () => {
    const k = kaynakKopyasi({ drugs: [{ form: 'Tab', generic: 'X', dose: '۱ دانه', timing: 'بعد از غذا', tariqa: 'روزانه ۳ بار', n: '15' }] }, 'not');
    expect(k.drugs).toEqual([{ form: 'Tab', generic: 'X' }]);
  });

  // Öbür depodaki ham dosya doğrudan verilse de (--nuskha) çıktı değişmez.
  it('ham nuskha satırları (kullanımıyla) verilse de çıktı aynı', () => {
    const ham = kaynak.drugs.map((d) => ({ ...d, dose: '۱ دانه', timing: 'بعد از غذا', tariqa: 'روزانه ۳ بار', n: '15' }));
    expect(belgeMetni(ilacListesiUret(v2, ham).belge)).toBe(gonderilenMetin);
  });

  it('denetim izinsiz alanı yakalıyor', () => {
    expect(listeyiDenetle(gonderilen)).toEqual([]);
    const bozuk = { ...gonderilen, ilaclar: [{ ...gonderilen.ilaclar[0], kullanim: 'روزانه 3 بار' }, ...gonderilen.ilaclar.slice(1)] };
    expect(listeyiDenetle(bozuk).join('\n')).toMatch(/izinsiz alan kullanim/);
  });

  it('denetim kimlik, grup, şekil ve doz yazımını da yakalıyor', () => {
    const [a, b] = gonderilen.ilaclar;
    const denetle = (x) => listeyiDenetle({ ...gonderilen, ilaclar: [x, b] }).join('\n');
    expect(denetle({ ...a, hid: b.hid })).toMatch(/hid tekrarı/);
    expect(denetle({ ...a, grup: 'yok' })).toMatch(/grup/);
    expect(denetle({ ...a, form: 'Tab' })).toMatch(/şekil/);
    expect(denetle({ ...a, doz: '100.000 IU' })).toMatch(/doz yazımı/);
    expect(denetle({ ...a, kisa: 'Tablet' })).toMatch(/kisa/);
  });
});

describe('dozYaz', () => {
  it.each([
    ['500', 'mg', '500 mg'],
    ['250', 'mg/5ml', '250 mg/5 ml'],
    ['1', '%', '1%'],
    ['1200000', 'IU', '1,200,000 IU'],
    ['100000', 'IU/ml', '100,000 IU/ml'],
    ['5000', 'IU', '5000 IU'],
    ['500/400', 'mg/IU', '500 mg/400 IU'],
    ['', '', ''],
  ])('%s %s → %s', (g, b, beklenen) => expect(dozYaz(g, b)).toBe(beklenen));
});
