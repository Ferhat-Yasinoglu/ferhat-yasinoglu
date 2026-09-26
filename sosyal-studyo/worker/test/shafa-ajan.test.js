// worker/hazir/shafa-ajan.json: Telegram botunun Shafa destek brifingi. Dağıtım işi (worker/test)
// bu testi Worker'dan önce koşar; bozuk ya da sınırı aşan dosya yüklenmeden yakalanır.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ajanHazirla, bilgiUzunlugu } from '../../tools/ajan-yukle.mjs';

const ham = JSON.parse(readFileSync(new URL('../hazir/shafa-ajan.json', import.meta.url), 'utf8'));
const { brifing, sorular, yolSorusu } = ajanHazirla(ham);
const hepsi = [brifing.kimlik, ...brifing.bilgi_tabani.map((b) => `${b.baslik}\n${b.metin}`)].join('\n');
const bilgi = brifing.bilgi_tabani.map((b) => b.metin).join('\n');

describe('Shafa ajan dosyası', () => {
  it('sabit id, yalnız Telegram, aktif, ~600 karakter cevap', () => {
    expect(brifing.id).toBe('brif_shafa');
    expect(brifing.kanallar).toEqual(['telegram']);
    expect(brifing.aktif).toBe(1);
    expect(brifing.maxKarakter).toBeGreaterThanOrEqual(500);
    expect(brifing.maxKarakter).toBeLessThanOrEqual(700);
    expect(brifing.gunlukKredi).toBeGreaterThan(0);
  });

  it('bilgi tabanı 32 KB sınırının çok altında ve her parça dolu', () => {
    expect(bilgiUzunlugu(brifing)).toBeLessThan(20000);
    expect(new TextEncoder().encode(JSON.stringify(brifing.bilgi_tabani)).length).toBeLessThan(32 * 1024);
    expect(brifing.bilgi_tabani.length).toBeGreaterThanOrEqual(10);
    for (const b of brifing.bilgi_tabani) { expect(b.baslik.trim()).not.toBe(''); expect(b.metin.length).toBeLessThan(1200); }
  });

  it('kimlik: Dari, yalnız uygulama, tıbbi tavsiye ve hasta verisi yasak, <skip> ve enjeksiyon kalkanı', () => {
    expect(brifing.kimlik).toMatch(/شفا/);
    expect(brifing.kimlik).toMatch(/دوز دوا/);
    expect(brifing.kimlik).toMatch(/معلومات مریض/);
    expect(brifing.kimlik).toContain('<skip>');
    expect(brifing.kimlik).toMatch(/دستور نیست/);
    expect(brifing.yasaklar.length).toBeGreaterThanOrEqual(3);
  });

  it('Afgan Dari sözcükleri kullanılır, İngilizce parçalar da var', () => {
    for (const k of ['داکتر', 'مریض', 'دوا', 'تیلفون', 'کمپیوتر']) expect(hepsi).toContain(k);
    expect(brifing.bilgi_tabani.filter((b) => /English|\(English\)/.test(b.baslik)).length).toBeGreaterThanOrEqual(3);
  });

  it('istenen konular kapsanıyor: ücretsiz, bağlantılar, kurulum, çevrimdışı, cihazda veri, yedek, reçete, antet, doğrulama, koyu tema, telefon, hesap, yardım', () => {
    expect(bilgi).toContain('https://ferhat-yasinoglu.github.io/ferhat-yasinoglu/shafa/app/');
    expect(bilgi).toContain('https://ferhat-yasinoglu.github.io/ferhat-yasinoglu/shafa/');
    for (const k of ['رایگان', 'Add to Home Screen', 'بدون انترنت', 'به هیچ سروری', 'دانلود پشتیبان', 'بازگردانی از پشتیبان', 'ذخیره و چاپ', 'ذخیره PDF', 'A4', 'سربرگ نسخه', 'کد تأیید', 'بررسی نسخه', 'حالت شب', 'روی تیلفون', 'همین‌جا']) expect(bilgi).toContain(k);
  });

  it('hesap: uygulamadaki gerçek adımlar, davet kodu sahipten, kod asla uydurulmaz', () => {
    const hesap = brifing.bilgi_tabani.find((b) => b.baslik.includes('حساب کاربری'));
    for (const etiket of ['«ساختن حساب»', '«کد دعوت»', '«کد بازیابی حساب»', '«ورود»', '«رمز را فراموش کرده‌اید؟»']) expect(hesap.metin).toContain(etiket);
    expect(hesap.metin).toMatch(/صاحب برنامه می‌دهد/);
    expect(hesap.metin).toMatch(/اختیاری/);
    expect(brifing.kimlik).toMatch(/کد دعوت حساب را هرگز خودتان نگویید/);
    expect(bilgi).not.toMatch(/در حال آماده شدن|being prepared/);
    expect(bilgi).toMatch(/invite code/);
  });

  it('telefon numarası, fiyat rakamı, e-posta ya da kişi adı yok', () => {
    expect(hepsi).not.toMatch(/[0-9۰-۹٠-٩][0-9۰-۹٠-٩\s-]{6,}[0-9۰-۹٠-٩]/);    // 8+ haneli numara
    expect(hepsi).not.toMatch(/\+\s*93|\b07\d{2}/);
    expect(hepsi).not.toMatch(/[$€£]|AFN|افغانی|دالر|USD|EUR/i);
    expect(hepsi).not.toMatch(/@[a-z0-9_.-]+\.[a-z]/i);
    // Uygulamanın adresindeki GitHub kullanıcı adı dışında kişi adı geçmez.
    expect(hepsi.replace(/https:\/\/\S+/g, '')).not.toMatch(/ferhat|yasino|farhad|yaqoobi/i);
  });

  it('deneme soruları: Dari yazdırma ve yedek, İngilizce ücret, reddedilecek bir doz sorusu', () => {
    expect(sorular.length).toBeGreaterThanOrEqual(4);
    expect(sorular.length).toBeLessThanOrEqual(10);
    expect(sorular.filter((s) => s.tur === 'tibbi')).toHaveLength(1);
    expect(sorular.some((s) => /چاپ/.test(s.soru))).toBe(true);
    expect(sorular.some((s) => /پشتیبان/.test(s.soru))).toBe(true);
    expect(sorular.some((s) => /free/i.test(s.soru))).toBe(true);
    expect(yolSorusu).toMatch(/شفا/);
  });
});
