// Hesabın şifrelemesi (app/js/senkron/hesap.js). Bilinen-cevap değerleri
// BAĞIMSIZ bir gerçeklemeyle hesaplandı (Python hashlib.pbkdf2_hmac + elle
// yazılmış RFC 5869 HKDF) ve buraya sabitlendi. Bunlardan biri değişirse
// bütün hekimlerin parolası "yanlış" çıkar: test düşüyorsa kodu değil,
// değişikliği sorgula.
import { describe, it, expect } from 'vitest';
import {
  parolaAnahtarlari, kurtarmaAnahtarlari, sar, ac, kurtarmaKoduUret, kasaAnahtariUret, PAROLA_DONGU, KURTARMA_UZUNLUGU,
} from '../app/js/senkron/hesap.js';
import { kurtarmaNormal } from '../app/js/paylasilan/hesap-kurallari.js';

const hexOku = (h) => Uint8Array.from(h.match(/../g), (x) => parseInt(x, 16));
const aesAnahtari = (hex) => crypto.subtle.importKey('raw', hexOku(hex), 'AES-GCM', false, ['encrypt', 'decrypt']);
const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)));

// Normalleşmeden SONRA: 'dr.nemuna' ve 'کتابخانه ی123 Bahar-1404' (Farsça ک ve ی).
const KAT = {
  giris: 'E6eCYfVKI3KnV4vsgMu62i9TLjYkmipxGbat2INrezI',
  sarma: '032e21bcdfdd81513a9bb333c95dcab477cd64fe2b59176473694cab15a626bf',
  kurtarma: 'SCPAYuVPNb6wHsM76jStC5XC8geOHNKD_HccVOG9S6w',
  kurtarmaSarma: 'e52d8f6133ae608f6fa0ba5774bd05613c25452117b94a98ab95e6487c459df5',
};
// Aynı ad ve parola, hekimin ekranında olabileceği gibi: büyük harf, boşluk,
// Arapça ك/ي, Arapça-Hint ve Farsça rakamlar, ZWNJ.
const HAM_AD = ' Dr.Nemuna ';
const HAM_PAROLA = ' ‌كتاب‌خانه ي١٢٣ Bahar-۱۴۰۴ ';
const HAM_KOD = '۲۳۴۵-۶۷۸۹ abcd-efgh-jklm-npqr';

/** Bilinen sarma anahtarıyla elle sarılmış K: `ac` açabiliyorsa, türetilen
 *  anahtar KAT'taki baytlarla aynıdır ve AAD biçimi tutuyor. */
async function elleSar(hexAnahtar, K, aad) {
  const iv = new Uint8Array(12).fill(7);
  const kapali = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) },
    await aesAnahtari(hexAnahtar), new TextEncoder().encode(K));
  return { iv: b64(iv), veri: b64(kapali) };
}

describe('parola anahtarları', () => {
  it('tur sayısı istemcide sabit: 600 bin', () => expect(PAROLA_DONGU).toBe(600000));

  it('bilinen cevap: giris (normalleşme dahil)', async () => {
    const { giris } = await parolaAnahtarlari(HAM_AD, HAM_PAROLA);
    expect(giris).toBe(KAT.giris);
    expect(giris).toMatch(/^[A-Za-z0-9_-]{43}$/);
  }, 20000);

  it('bilinen cevap: sarma anahtarı ve AAD biçimi', async () => {
    const { sarma } = await parolaAnahtarlari(HAM_AD, HAM_PAROLA);
    const K = 'ABCD-EFGH-JKLM-NPQR-STUV';
    const sarili = await elleSar(KAT.sarma, K, 'shafa-sarili-v1|parola|dr.nemuna');
    expect(await ac(sarma, sarili, 'parola', 'dr.nemuna')).toBe(K);
  }, 20000);

  it('sarma anahtarı cihazdan çıkamaz', async () => {
    const { sarma } = await parolaAnahtarlari('dr.nemuna', 'uzun bir parola cümlesi');
    expect(sarma.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', sarma)).rejects.toThrow();
  }, 20000);

  it('başka parola başka giris; boş parola reddediliyor', async () => {
    const a = await parolaAnahtarlari('dr.nemuna', 'kabul bahar 1404');
    const b = await parolaAnahtarlari('dr.nemuna', 'kabul bahar 1405');
    expect(a.giris).not.toBe(b.giris);
    await expect(parolaAnahtarlari('dr.nemuna', '  ‌ ')).rejects.toMatchObject({ kod: 'parola_bos' });
  }, 20000);
});

describe('kurtarma anahtarları', () => {
  it('kod tiresiz, büyük harfli ve ASCII rakamlı normalleşiyor', () => {
    expect(kurtarmaNormal(HAM_KOD)).toBe('23456789ABCDEFGHJKLMNPQR');
  });

  it('bilinen cevap: kurtarma ve kurtarma sarma anahtarı', async () => {
    const { kurtarma, sarma } = await kurtarmaAnahtarlari(HAM_AD, HAM_KOD);
    expect(kurtarma).toBe(KAT.kurtarma);
    const K = 'ABCD-EFGH-JKLM-NPQR-STUV';
    const sarili = await elleSar(KAT.kurtarmaSarma, K, 'shafa-sarili-v1|kurtarma|dr.nemuna');
    expect(await ac(sarma, sarili, 'kurtarma', 'dr.nemuna')).toBe(K);
  });

  it('eksik ya da fazla harfli kod reddediliyor', async () => {
    await expect(kurtarmaAnahtarlari('dr.nemuna', '2345-6789')).rejects.toMatchObject({ kod: 'kurtarma_gecersiz' });
    await expect(kurtarmaAnahtarlari('dr.nemuna', HAM_KOD + '2')).rejects.toMatchObject({ kod: 'kurtarma_gecersiz' });
  });
});

describe('sarma ve açma', () => {
  const K = 'WXYZ-2345-6789-ABCD-EFGH';

  it('sarılan K açılıyor; her sarma yeni IV', async () => {
    const { sarma } = await kurtarmaAnahtarlari('dr.nemuna', kurtarmaKoduUret());
    const a = await sar(sarma, K, 'parola', 'dr.nemuna');
    const b = await sar(sarma, K, 'parola', 'dr.nemuna');
    expect(a.iv).not.toBe(b.iv);
    expect(a.iv).toMatch(/^[A-Za-z0-9+/]{16}$/);
    expect(await ac(sarma, a, 'parola', 'dr.nemuna')).toBe(K);
    // Sunucunun kabul ettiği biçim: iv 16, veri 24–512 karakter base64.
    expect(a.veri.length).toBeGreaterThanOrEqual(24);
    expect(a.veri.length).toBeLessThanOrEqual(512);
    expect(JSON.stringify(a)).not.toContain(K);
  });

  it('AAD amacı bağlıyor: parola sarması kurtarma diye açılmıyor', async () => {
    const { sarma } = await kurtarmaAnahtarlari('dr.nemuna', kurtarmaKoduUret());
    const s = await sar(sarma, K, 'parola', 'dr.nemuna');
    await expect(ac(sarma, s, 'kurtarma', 'dr.nemuna')).rejects.toMatchObject({ kod: 'anahtar_bozuk' });
  });

  it('AAD kullanıcı adını bağlıyor: başka hesabın kaydı olarak açılmıyor', async () => {
    const { sarma } = await kurtarmaAnahtarlari('dr.nemuna', kurtarmaKoduUret());
    const s = await sar(sarma, K, 'parola', 'dr.nemuna');
    await expect(ac(sarma, s, 'parola', 'dr.baska')).rejects.toMatchObject({ kod: 'anahtar_bozuk' });
    // Normalleşme iki tarafta aynı: büyük harfli yazım aynı hesap.
    expect(await ac(sarma, s, 'parola', 'DR.NEMUNA')).toBe(K);
  });

  it('bozuk ya da eksik sarılı kayıt "anahtar_bozuk", parola hatası değil', async () => {
    const { sarma } = await kurtarmaAnahtarlari('dr.nemuna', kurtarmaKoduUret());
    const s = await sar(sarma, K, 'parola', 'dr.nemuna');
    const ham = Uint8Array.from(atob(s.veri), (c) => c.charCodeAt(0));
    ham[3] ^= 1;
    await expect(ac(sarma, { ...s, veri: b64(ham) }, 'parola', 'dr.nemuna')).rejects.toMatchObject({ kod: 'anahtar_bozuk' });
    await expect(ac(sarma, null, 'parola', 'dr.nemuna')).rejects.toMatchObject({ kod: 'anahtar_bozuk' });
  });

  it('bilinmeyen amaç programlama hatası', async () => {
    const { sarma } = await kurtarmaAnahtarlari('dr.nemuna', kurtarmaKoduUret());
    await expect(sar(sarma, K, 'baska', 'dr.nemuna')).rejects.toThrow(TypeError);
  });
});

describe('kod üretimi', () => {
  it('kurtarma kodu 24 harf (120 bit), K 20 harf (100 bit), alfabe karışmayan harflerden', () => {
    const R = kurtarmaKoduUret();
    const K = kasaAnahtariUret();
    expect(R).toMatch(/^[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){5}$/);
    expect(K).toMatch(/^[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){4}$/);
    expect(kurtarmaNormal(R)).toHaveLength(KURTARMA_UZUNLUGU);
    expect(new Set(Array.from({ length: 20 }, kurtarmaKoduUret)).size).toBe(20);
  });
});
