// QR üreteci kendi yazdığımız için doğruluğu bağımsız bir çözücüyle kanıtlanır:
// ürettiğimiz matris gerçek bir QR okuyucudan geçiyor mu?
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jsQR from 'jsqr';
import { sahteDomKur } from './sahte-dom.js';
import { qrMatris, qrYolu, surumSec, QrHatasi, qrOkunurMu, QR_EN_KUCUK_MODUL_MM } from '../app/js/paylasilan/qr.js';

/** Matrisi jsQR'ın beklediği RGBA görüntüye çevirir (modül başına `olcek` piksel). */
function goruntule({ boy, modul }, olcek = 4, sessiz = 4) {
  const genislik = (boy + sessiz * 2) * olcek;
  const veri = new Uint8ClampedArray(genislik * genislik * 4).fill(255);
  for (let r = 0; r < boy; r++) {
    for (let c = 0; c < boy; c++) {
      if (!modul[r][c]) continue;
      for (let dy = 0; dy < olcek; dy++) {
        for (let dx = 0; dx < olcek; dx++) {
          const x = (c + sessiz) * olcek + dx;
          const y = (r + sessiz) * olcek + dy;
          const i = (y * genislik + x) * 4;
          veri[i] = veri[i + 1] = veri[i + 2] = 0;
        }
      }
    }
  }
  return { veri, genislik };
}

const okut = (metin) => {
  const { veri, genislik } = goruntule(qrMatris(metin));
  return jsQR(veri, genislik, genislik)?.data;
};

describe('qrMatris', () => {
  it('kısa metni okunabilir üretir', () => {
    expect(okut('MERHABA')).toBe('MERHABA');
  });
  it('bağlantıyı okunabilir üretir', () => {
    const baglanti = 'https://wa.me/93700000000';
    expect(okut(baglanti)).toBe(baglanti);
  });
  it('Farsça metni (UTF-8) okunabilir üretir', () => {
    const metin = 'داکتر نمونه احمدی — نسخه ۱۴۰۵';
    expect(okut(metin)).toBe(metin);
  });
  it('Türkçe harfleri bozmadan taşır', () => {
    const metin = 'Reçete 2026-09-21-01 · İlaç: Parol 500 mg, günde 2×1';
    expect(okut(metin)).toBe(metin);
  });
  it('çok satırlı uzun reçete metnini taşır', () => {
    const metin = [
      'Dr. Nemuna Ahmadi',
      'Hasta: Zeynep Kaya (10)',
      'Tanı: Üst solunum yolu enfeksiyonu · J06.9',
      '1) Nurofen 400 mg Tablet — 2 kutu — Günde 2×1 — 5 gün',
      '2) Parol 500 mg Tablet — 1 kutu — Günde 3×1 — 5 gün',
      'Tel: 0700000000',
    ].join('\n');
    expect(okut(metin)).toBe(metin);
  });
  it('sürüm 10 üstüne geçen metni de taşır (16 bitlik uzunluk alanı)', () => {
    const metin = 'A'.repeat(300);
    const { surum } = qrMatris(metin);
    expect(surum).toBeGreaterThanOrEqual(10);
    expect(okut(metin)).toBe(metin);
  });
});

describe('surumSec', () => {
  it('küçük veriye küçük sürüm seçer', () => expect(surumSec(10)).toBe(1));
  it('kapasite sınırında bir üst sürüme geçer', () => {
    expect(surumSec(14)).toBe(1);
    expect(surumSec(15)).toBe(2);
  });
  it('sığmayan metni reddeder', () => expect(() => surumSec(5000)).toThrow(QrHatasi));
});

describe('qrYolu', () => {
  it('sessiz alanla birlikte boyut verir', () => {
    const { yol, boy } = qrYolu('test');
    expect(boy).toBe(21 + 8);
    expect(yol.startsWith('M')).toBe(true);
  });
  it('boş içeriği reddeder', () => expect(() => qrYolu('')).toThrow(QrHatasi));
});

// Basılı QR'ın okunabilirliği: modül eni = basılı en / (modül sayısı + 2 ×
// sessiz alan). Reçete özeti QR'ı tek ilaçta bile 0,17 mm'ye iniyordu, on
// ilaçta hiç kurulamıyor ve kâğıttaki yer sessizce boş kalıyordu.
describe('qrOkunurMu', () => {
  it('eşik 0,30 mm', () => expect(QR_EN_KUCUK_MODUL_MM).toBe(0.3));
  it('WhatsApp bağlantısı 10 mm\'de okunur (sürüm 2: 25 + 4 modül)', () => {
    const baglanti = 'https://wa.me/93700000000';
    expect(qrMatris(baglanti).surum).toBe(2);
    expect(qrOkunurMu(baglanti, 10)).toBe(true);
    // 29 modül × 0,30 mm = 8,7 mm: altı okunmaz.
    expect(qrOkunurMu(baglanti, 8.6)).toBe(false);
  });
  it('uzun reçete özeti okunmaz sayılıyor; sürüm 20\'yi aşan metin hata atmıyor, okunmaz', () => {
    expect(qrOkunurMu('x'.repeat(260), 16)).toBe(false);
    expect(qrOkunurMu('x'.repeat(5000), 16)).toBe(false);
  });
  it('boş metin okunmaz', () => expect(qrOkunurMu('', 16)).toBe(false));
  it('karar gerçek matrisin sürümüyle aynı', () => {
    for (const n of [10, 40, 90, 150]) {
      const metin = 'a'.repeat(n);
      const { boy } = qrMatris(metin);
      expect(qrOkunurMu(metin, 12)).toBe(12 / (boy + 4) >= 0.3);
    }
  });
});

// Kâğıdın QR içeriği (kagit.js qrBilgisi): «reçete metni» seçiliyken içerik
// basılı boyda okunamayacaksa QR yeri boş kalmıyor, iletişim bağlantısına
// (numara yoksa doğrulama koduna) düşüyor ve bunu `yedek` ile söylüyor
// (kâğıttaki alt yazı ve Ayarlar'daki ipucu buna bakıyor). Hangi yola
// düşülürse düşülsün basılan içerik lacivertin 10 mm'lik kartında okunur.
describe('qrBilgisi — basılan QR hiç sessizce kaybolmuyor', () => {
  let kaldir;
  let qrBilgisi;
  let qrBaskiMm;
  beforeAll(async () => {
    kaldir = sahteDomKur();
    ({ qrBilgisi, qrBaskiMm } = await import('../app/js/kagit.js'));
  });
  afterAll(() => kaldir());
  const recete = (n, kod = 'MWMW-WMWM') => ({
    receteNo: '2026-09-22-13', tarih: '2026-09-22', dogrulamaKodu: kod,
    satirlar: Array.from({ length: n }, (_, i) => ({ ilacAdi: `Panadol ${i + 1}`, adet: 10, kullanim: 'روزانه ۳ بار', zaman: 'بعد از غذا', sure: '۵ روز' })),
  });
  const hasta = { ad: 'محمد نعیم', soyad: 'رحیمی' };
  const WA = { whatsapp: '0700000000', ulkeKodu: '93' };

  it.each([1, 2, 15, 25, 60])('reçete metni, %i ilaç: okunmayan özet yerine iletişim QR\'ı, yedek olduğu söyleniyor', (n) => {
    const b = qrBilgisi({ ...WA, qrIcerik: 'recete' }, recete(n), hasta);
    expect(b).toEqual({ metin: 'https://wa.me/93700000000', tur: 'iletisim', yedek: true });
    expect(qrOkunurMu(b.metin, 10)).toBe(true);
  });
  it('numara yoksa doğrulama kodu basılıyor; kod da yoksa QR yok ama yedek bayrağı duruyor', () => {
    const kodlu = qrBilgisi({ qrIcerik: 'recete' }, recete(15), hasta);
    expect(kodlu).toEqual({ metin: 'کد تأیید: MWMW-WMWM', tur: 'kod', yedek: true });
    expect(qrOkunurMu(kodlu.metin, 10)).toBe(true);
    expect(qrBilgisi({ qrIcerik: 'recete' }, recete(15, ''), hasta)).toEqual({ metin: '', tur: 'yok', yedek: true });
  });
  // A5'te lacivert yaprak 0,701 ölçekle basılıyor: içerik kararı A4'ün 10
  // mm'siyle verilirse A5'te okunmayacak bir QR onaylanırdı. Basılan boyun
  // kendisi tarayıcı denemesinde ölçülüyor (en az bu kadar).
  it('içerik kararı basılan boydan: lacivert A5\'te kart küçük, eski stillerin A5\'i ölçeklenmiyor', () => {
    expect(qrBaskiMm({ kagitStili: 'lacivert' })).toBe(10);
    expect(qrBaskiMm({ kagitStili: 'lacivert', yazdirmaBoyutu: 'A5' })).toBeLessThan(10 * 0.9);
    expect(qrBaskiMm({ kagitStili: 'modern', yazdirmaBoyutu: 'A5' })).toBe(16);
    // Salt kod QR'ı A5'teki kartta da okunuyor.
    expect(qrOkunurMu('کد تأیید: MWMW-WMWM', qrBaskiMm({ kagitStili: 'lacivert', yazdirmaBoyutu: 'A5' }))).toBe(true);
  });
  it('varsayılan iletişim QR\'ı ve boş kâğıt yedek sayılmıyor; «basma» seçiliyse içerik yok', () => {
    expect(qrBilgisi(WA, recete(3), hasta)).toEqual({ metin: 'https://wa.me/93700000000', tur: 'iletisim', yedek: false });
    expect(qrBilgisi({ ...WA, qrIcerik: 'recete' }, null, null, { bos: true })).toEqual({ metin: 'https://wa.me/93700000000', tur: 'iletisim', yedek: false });
    expect(qrBilgisi({ ...WA, qrIcerik: 'yok' }, recete(3), hasta)).toEqual({ metin: '', tur: 'yok', yedek: false });
  });
});
