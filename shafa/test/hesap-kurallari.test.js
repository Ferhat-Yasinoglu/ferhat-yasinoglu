// Hesap kuralları: normalleştirme bilinen-cevap testleriyle SABİTLENİR.
// parolaNormal anahtar türetmenin girdisi: burada bir karakter değişirse o
// karaktere sahip her parola başka bir anahtar üretir ve hekim kendi
// hesabına giremez. Bu yüzden testler "doğru çalışıyor" değil "hiç değişmedi" der.
import { describe, it, expect } from 'vitest';
import {
  parolaNormal, kullaniciAdiNormal, kullaniciGecerli, kurtarmaNormal, parolaSorunu, rakamlariCevir,
  YAYGIN_PAROLALAR, EN_AZ_PAROLA, VERI_SINIRI,
} from '../app/js/paylasilan/hesap-kurallari.js';
import { kasaKoduUret } from '../app/js/paylasilan/kimlik.js';

describe('parolaNormal (bilinen cevaplar)', () => {
  it('Arapça ي/ك → Farsça ی/ک; başka harfe dokunulmaz', () => {
    expect(parolaNormal('يك')).toBe('یک');
    expect(parolaNormal('كابل زيبا')).toBe('کابل زیبا');
    expect(parolaNormal('کابل زیبا')).toBe('کابل زیبا');
    // ۀ (U+06C0) ve ة (U+0629) yazıldığı gibi kalır.
    expect(parolaNormal('ۀةه')).toBe('ۀةه');
  });
  it('Farsça ve Arapça-Hint rakamlar ASCII', () => {
    expect(parolaNormal('۱۲۳۴۵۶۷۸۹۰')).toBe('1234567890');
    expect(parolaNormal('١٢٣٤٥٦٧٨٩٠')).toBe('1234567890');
    expect(rakamlariCevir('a۱b١c1')).toBe('a1b1c1');
  });
  it('ZWNJ/ZWJ ve yön işaretleri atılır, kenarlar kırpılır', () => {
    expect(parolaNormal('می‌خواهم')).toBe('میخواهم');
    expect(parolaNormal('‏ab‍c‎؜')).toBe('abc');
    expect(parolaNormal('  ab c \t')).toBe('ab c');
  });
  it('NFKC: sunum biçimleri ve tam genişlik harfler temel biçime', () => {
    expect(parolaNormal('ﻱ')).toBe('ی');           // ARABIC LETTER YEH ISOLATED FORM
    expect(parolaNormal('ﻙ')).toBe('ک');           // ARABIC LETTER KAF ISOLATED FORM
    expect(parolaNormal('ＡＢＣ１')).toBe('ABC1');
    // Büyük/küçük harf korunur (yalnız kullanıcı adında küçültülür).
    expect(parolaNormal('Kabul')).toBe('Kabul');
  });
  it('bayt düzeyinde sabit: bir cümlenin UTF-8 çıktısı', () => {
    const b = [...new TextEncoder().encode(parolaNormal(' كتاب‌ها ۱۴۰۴ '))].map((x) => x.toString(16).padStart(2, '0')).join('');
    expect(b).toBe('daa9d8aad8a7d8a8d987d8a72031343034'); // «کتابها 1404»
  });
});

describe('kullanıcı adı', () => {
  it('küçük harf, rakamlar ASCII, görünmezler atılır', () => {
    expect(kullaniciAdiNormal(' Dr.Ahmad۱ ')).toBe('dr.ahmad1');
    expect(kullaniciAdiNormal('DR_‌NEMUNA')).toBe('dr_nemuna');
    expect(kullaniciAdiNormal(null)).toBe('');
  });
  it('3–32 karakter, [a-z0-9._-], harf ya da rakamla başlar', () => {
    for (const u of ['abc', 'dr.ahmad', 'ahmad_1', 'a-b', '1abc', 'a'.repeat(32)]) expect(kullaniciGecerli(u)).toBe(true);
    for (const u of ['ab', '.abc', '-abc', '_abc', 'a b', 'Abc', 'احمد', 'a'.repeat(33), 'ab@c', '', null, 123]) expect(kullaniciGecerli(u)).toBe(false);
  });
});

describe('kurtarmaNormal', () => {
  it('büyük harf, rakamlar ASCII, tire/boşluk ve alfabe dışı atılır', () => {
    expect(kurtarmaNormal('abcd-efgh ۲۳۴۵')).toBe('ABCDEFGH2345');
    // 0, 1, I, O alfabede yok: yanlışlıkla yazılsa bile koda karışmaz.
    expect(kurtarmaNormal('01IO-a')).toBe('A');
  });
  it('üretilen kod tiresiz haline döner', () => {
    for (let i = 0; i < 20; i++) {
      const kod = kasaKoduUret(24);
      expect(kurtarmaNormal(kod)).toBe(kod.replace(/-/g, ''));
      expect(kurtarmaNormal(kod.toLowerCase().replace(/-/g, ' '))).toBe(kod.replace(/-/g, ''));
    }
  });
});

describe('parolaSorunu', () => {
  it('uygun parolalar', () => {
    for (const p of ['kabul is green today', 'باران در بهار می‌بارد', 'Zmr7#vq!Lp2x', 'دوا و درمان ۱۴۰۴ کابل']) {
      expect(parolaSorunu(p, 'dr.nemuna')).toBeNull();
    }
  });
  it('kısa: normalleşmiş halde 10 karakterden az', () => {
    expect(EN_AZ_PAROLA).toBe(10);
    expect(parolaSorunu('Zmr7#vq!L')).toBe('kisa');
    // Görünmez karakterlerle 10'a tamamlanmış parola kısa sayılır.
    expect(parolaSorunu('Zmr7#vq!L‌‌')).toBe('kisa');
    expect(parolaSorunu('   Zmr7#vq!L   ')).toBe('kisa');
  });
  it('telefon numarası biçimi (Afgan ve genel), rakamlar ve ayraçlar hangi biçimde yazılırsa', () => {
    for (const p of ['0701234567', '+93701234567', '0093701234567', '+93 70 123 4567', '۰۷۰۱۲۳۴۵۶۷', '079-123-4567', '(0)701234567', '12345678901234']) {
      expect(parolaSorunu(p)).toBe('telefon');
    }
  });
  it('yalnız rakam', () => {
    expect(parolaSorunu('1234567890123456')).toBe('rakam');
  });
  it('kullanıcı adını içeren', () => {
    expect(parolaSorunu('dr.nemuna2024!', 'dr.nemuna')).toBe('kullanici');
    expect(parolaSorunu('DrNemuna is here', 'DR.Nemuna')).toBe('kullanici');
    expect(parolaSorunu('dr.nemuna2024!', '')).toBeNull();
  });
  it('yaygın parolalar ve rakam/işaret eklenmiş gövdeleri', () => {
    for (const p of ['password123', 'Password!!!!', 'qwertyuiop', 'Afghanistan2024', '1404kabul!!', 'bismillah786',
      'بسم الله ۱۲۳۴', 'افغانستان۱۴۰۴', 'ضصثقفغعهخحج', 'iloveyou1234', '1q2w3e4r5t']) {
      expect(parolaSorunu(p)).toBe('yaygin');
    }
  });
  it('listedeki her girdi normal biçimde ve ulaşılabilir (ölü girdi yok)', () => {
    expect(YAYGIN_PAROLALAR.size).toBeGreaterThan(250);
    const disIsaret = /^[0-9!@#$%^&*?+=~]+|[0-9!@#$%^&*?+=~]+$/g;
    for (const g of YAYGIN_PAROLALAR) {
      expect(parolaNormal(g).toLowerCase()).toBe(g);
      expect(g).not.toMatch(/[\s._-]/);
      // Ya tam hali (≥10) eşleşebilir ya da gövde olarak (≥4, kenarında rakam yok).
      expect(g.length >= EN_AZ_PAROLA || (g.length >= 4 && g.replace(disIsaret, '') === g)).toBe(true);
    }
  });
});

describe('veri sınırı', () => {
  it('20 MB', () => expect(VERI_SINIRI).toBe(20 * 1024 * 1024));
});
