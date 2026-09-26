// Hesap kartının DOM'suz parçaları: uygulama içi tarayıcı tanıma ve
// kurtarma kodunun kâğıda/dosyaya giden metni. Kartın kendisi (kutular,
// sıra, iki cihaz) tarayıcı denemesinde (tools/tarayici.mjs).
import { describe, it, expect } from 'vitest';
import { uygulamaIciMi, kurtarmaMetni } from '../app/js/hesap-arayuz.js';

describe('uygulama içi tarayıcı', () => {
  it('Facebook, Instagram, WhatsApp ve Android WebView tanınıyor', () => {
    for (const ua of [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.37.108;]',
      'Mozilla/5.0 (Linux; Android 14; SM-A145F Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 Instagram 337.0.0.35.102 Android',
      'Mozilla/5.0 (Linux; Android 13; TECNO KI5k; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/24.12.78',
    ]) expect(uygulamaIciMi(ua), ua).toBe(true);
  });

  it('gerçek tarayıcılar uyarı almıyor', () => {
    for (const ua of [
      'Mozilla/5.0 (Linux; Android 14; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    ]) expect(uygulamaIciMi(ua), ua).toBe(false);
  });
});

describe('kurtarma kodunun metni', () => {
  const metin = kurtarmaMetni({
    kullanici: 'dr.deneme', kod: 'ABCD-EFGH-JKLM-NPQR-STUV-WXYZ',
    adres: 'https://ornek.test/shafa/app/', tarih: '2026-09-25',
  });

  it('kullanıcı adı, kod, adres ve tarih (şemsi + miladi) içinde', () => {
    expect(metin).toContain('dr.deneme');
    expect(metin).toContain('ABCD-EFGH-JKLM-NPQR-STUV-WXYZ');
    expect(metin).toContain('https://ornek.test/shafa/app/');
    expect(metin).toContain('1405/07/03');
    expect(metin).toContain('2026-09-25');
  });

  it('iki dilli: İngilizce etiketler sözlüğe bağlı değil', () => {
    for (const s of ['Username:', 'Recovery code:', 'App address:', 'Date:']) expect(metin).toContain(s);
  });
});
