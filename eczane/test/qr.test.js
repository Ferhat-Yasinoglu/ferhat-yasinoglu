// QR üreteci kendi yazdığımız için doğruluğu bağımsız bir çözücüyle kanıtlanır:
// ürettiğimiz matris gerçek bir QR okuyucudan geçiyor mu?
import { describe, it, expect } from 'vitest';
import jsQR from 'jsqr';
import { qrMatris, qrYolu, surumSec, QrHatasi } from '../app/js/paylasilan/qr.js';

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
    const baglanti = 'https://wa.me/93702397511';
    expect(okut(baglanti)).toBe(baglanti);
  });
  it('Farsça metni (UTF-8) okunabilir üretir', () => {
    const metin = 'داکتر فدا محمد — نسخه ۱۴۰۵';
    expect(okut(metin)).toBe(metin);
  });
  it('Türkçe harfleri bozmadan taşır', () => {
    const metin = 'Reçete 2026-09-21-01 · İlaç: Parol 500 mg, günde 2×1';
    expect(okut(metin)).toBe(metin);
  });
  it('çok satırlı uzun reçete metnini taşır', () => {
    const metin = [
      'Dr. Feda Mohammad (Ehsan)',
      'Hasta: Zeynep Kaya (10)',
      'Tanı: Üst solunum yolu enfeksiyonu · J06.9',
      '1) Nurofen 400 mg Tablet — 2 kutu — Günde 2×1 — 5 gün',
      '2) Parol 500 mg Tablet — 1 kutu — Günde 3×1 — 5 gün',
      'Tel: 0702397511',
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
