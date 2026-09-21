// QR kod üreteci. Dışarıdan kütüphane almıyoruz: uygulama çevrimdışı çalışır ve
// içerik güvenlik politikası dış betiğe izin vermez. Bayt kipi (UTF-8), hata
// düzeltme seviyesi M, sürüm 1–20 — reçete için fazlasıyla yeter.
// Saf modül: matris döndürür, çizimi çağıran yapar.

/* ---------- Tablolar ---------- */
// Her sürüm için: [hata düzeltme kodsözcüğü/blok, [blok sayısı, blok başına veri]…]
const BLOKLAR_M = {
  1: [10, [[1, 16]]],
  2: [16, [[1, 28]]],
  3: [26, [[1, 44]]],
  4: [18, [[2, 32]]],
  5: [24, [[2, 43]]],
  6: [16, [[4, 27]]],
  7: [18, [[4, 31]]],
  8: [22, [[2, 38], [2, 39]]],
  9: [22, [[3, 36], [2, 37]]],
  10: [26, [[4, 43], [1, 44]]],
  11: [30, [[1, 50], [4, 51]]],
  12: [22, [[6, 36], [2, 37]]],
  13: [22, [[8, 37], [1, 38]]],
  14: [24, [[4, 40], [5, 41]]],
  15: [24, [[5, 41], [5, 42]]],
  16: [28, [[7, 45], [3, 46]]],
  17: [28, [[10, 46], [1, 47]]],
  18: [26, [[9, 43], [4, 44]]],
  19: [26, [[3, 44], [11, 45]]],
  20: [26, [[3, 41], [13, 42]]],
};

const HIZALAMA = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62], 14: [6, 26, 46, 66],
  15: [6, 26, 48, 70], 16: [6, 26, 50, 74], 17: [6, 30, 54, 78],
  18: [6, 30, 56, 82], 19: [6, 30, 58, 86], 20: [6, 34, 62, 90],
};

/** Sürümün taşıyabileceği veri kodsözcüğü sayısı. */
function veriKapasitesi(surum) {
  const [, gruplar] = BLOKLAR_M[surum];
  return gruplar.reduce((t, [n, veri]) => t + n * veri, 0);
}

/* ---------- Galois cismi (GF(256), 0x11D) ---------- */
const USTEL = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    USTEL[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) USTEL[i] = USTEL[i - 255];
})();

const carp = (a, b) => (a === 0 || b === 0 ? 0 : USTEL[LOG[a] + LOG[b]]);

/** Reed–Solomon üreteç polinomu. */
function uretec(derece) {
  let p = [1];
  for (let i = 0; i < derece; i++) {
    const y = [...p, 0];
    for (let j = 0; j < p.length; j++) y[j + 1] ^= carp(p[j], USTEL[i]);
    p = y;
  }
  return p;
}

/** Bir veri bloğunun hata düzeltme kodsözcükleri. */
function hataKodsozcukleri(veri, sayi) {
  const g = uretec(sayi);
  const kalan = new Uint8Array(veri.length + sayi);
  kalan.set(veri);
  for (let i = 0; i < veri.length; i++) {
    const k = kalan[i];
    if (!k) continue;
    for (let j = 0; j < g.length; j++) kalan[i + j] ^= carp(g[j], k);
  }
  return kalan.slice(veri.length);
}

/* ---------- Bit tamponu ---------- */
class Bitler {
  constructor() { this.bitler = []; }
  ekle(deger, uzunluk) {
    for (let i = uzunluk - 1; i >= 0; i--) this.bitler.push((deger >> i) & 1);
  }
  get uzunluk() { return this.bitler.length; }
}

/* ---------- BCH: biçim ve sürüm bilgisi ---------- */
function bicimBilgisi(maske) {
  const veri = (0b00 << 3) | maske;   // 00 = hata düzeltme seviyesi M
  let d = veri << 10;
  for (let i = 0; i < 5; i++) if (d & (1 << (14 - i))) d ^= 0x537 << (4 - i);
  return ((veri << 10) | d) ^ 0x5412;
}

function surumBilgisi(surum) {
  let d = surum << 12;
  for (let i = 0; i < 6; i++) if (d & (1 << (17 - i))) d ^= 0x1f25 << (5 - i);
  return (surum << 12) | d;
}

/* ---------- Maskeler ---------- */
const MASKELER = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/* ---------- Matris kurulumu ---------- */
function bosMatris(boy) {
  return { modul: Array.from({ length: boy }, () => new Int8Array(boy).fill(-1)), boy };
}

function desenleriYerlestir(m, surum) {
  const { modul, boy } = m;
  const koy = (r, c, v) => { if (r >= 0 && r < boy && c >= 0 && c < boy) modul[r][c] = v; };

  // Bulucu desenler ve çevresindeki ayırıcılar
  for (const [sr, sc] of [[0, 0], [0, boy - 7], [boy - 7, 0]]) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const icinde = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const halka = r === 0 || r === 6 || c === 0 || c === 6;
        const goz = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        koy(sr + r, sc + c, icinde && (halka || goz) ? 1 : 0);
      }
    }
  }

  // Zamanlama desenleri
  for (let i = 8; i < boy - 8; i++) {
    modul[6][i] = i % 2 === 0 ? 1 : 0;
    modul[i][6] = i % 2 === 0 ? 1 : 0;
  }

  // Hizalama desenleri (bulucularla çakışanlar atlanır)
  const yerler = HIZALAMA[surum];
  for (const r of yerler) {
    for (const c of yerler) {
      if ((r <= 7 && c <= 7) || (r <= 7 && c >= boy - 8) || (r >= boy - 8 && c <= 7)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const kenar = Math.abs(dr) === 2 || Math.abs(dc) === 2;
          koy(r + dr, c + dc, kenar || (dr === 0 && dc === 0) ? 1 : 0);
        }
      }
    }
  }

  // Her zaman koyu olan modül
  modul[boy - 8][8] = 1;

  // Biçim bilgisi alanları şimdilik ayrılır (0 değil, "dolu" olarak işaretlenir)
  for (let i = 0; i < 9; i++) {
    if (modul[8][i] === -1) modul[8][i] = 0;
    if (modul[i][8] === -1) modul[i][8] = 0;
  }
  for (let i = 0; i < 8; i++) {
    if (modul[8][boy - 1 - i] === -1) modul[8][boy - 1 - i] = 0;
    if (modul[boy - 1 - i][8] === -1) modul[boy - 1 - i][8] = 0;
  }

  // Sürüm bilgisi alanları (7 ve üstü)
  if (surum >= 7) {
    const bilgi = surumBilgisi(surum);
    for (let i = 0; i < 18; i++) {
      const bit = (bilgi >> i) & 1;
      modul[Math.floor(i / 3)][boy - 11 + (i % 3)] = bit;
      modul[boy - 11 + (i % 3)][Math.floor(i / 3)] = bit;
    }
  }
}

/** Veriyi zikzak düzende yerleştirir. */
function veriyiYerlestir(m, veri) {
  const { modul, boy } = m;
  let bit = 0;
  let yukari = true;
  for (let sutun = boy - 1; sutun > 0; sutun -= 2) {
    if (sutun === 6) sutun--;   // zamanlama sütunu atlanır
    for (let i = 0; i < boy; i++) {
      const r = yukari ? boy - 1 - i : i;
      for (const c of [sutun, sutun - 1]) {
        if (modul[r][c] !== -1) continue;
        modul[r][c] = bit < veri.length ? veri[bit] : 0;
        bit++;
      }
    }
    yukari = !yukari;
  }
}

function bicimiYaz(modul, boy, maske) {
  const bilgi = bicimBilgisi(maske);
  for (let i = 0; i < 15; i++) {
    const bit = (bilgi >> i) & 1;
    // Sol üst
    if (i < 6) modul[8][i] = bit;
    else if (i === 6) modul[8][7] = bit;
    else if (i === 7) modul[8][8] = bit;
    else if (i === 8) modul[7][8] = bit;
    else modul[14 - i][8] = bit;
    // Sağ üst ve sol alt
    if (i < 8) modul[8][boy - 1 - i] = bit;
    else modul[boy - 15 + i][8] = bit;
  }
}

/* ---------- Ceza puanı (maske seçimi) ---------- */
function cezaPuani(modul, boy) {
  let puan = 0;

  const seri = (getir) => {
    for (let a = 0; a < boy; a++) {
      let say = 1;
      for (let b = 1; b < boy; b++) {
        if (getir(a, b) === getir(a, b - 1)) {
          say++;
        } else {
          if (say >= 5) puan += 3 + (say - 5);
          say = 1;
        }
      }
      if (say >= 5) puan += 3 + (say - 5);
    }
  };
  seri((r, c) => modul[r][c]);
  seri((c, r) => modul[r][c]);

  for (let r = 0; r < boy - 1; r++) {
    for (let c = 0; c < boy - 1; c++) {
      const v = modul[r][c];
      if (v === modul[r][c + 1] && v === modul[r + 1][c] && v === modul[r + 1][c + 1]) puan += 3;
    }
  }

  const desen = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const tersDesen = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const desenAra = (getir) => {
    for (let a = 0; a < boy; a++) {
      for (let b = 0; b <= boy - 11; b++) {
        let d1 = true, d2 = true;
        for (let k = 0; k < 11; k++) {
          const v = getir(a, b + k);
          if (v !== desen[k]) d1 = false;
          if (v !== tersDesen[k]) d2 = false;
        }
        if (d1) puan += 40;
        if (d2) puan += 40;
      }
    }
  };
  desenAra((r, c) => modul[r][c]);
  desenAra((c, r) => modul[r][c]);

  let koyu = 0;
  for (let r = 0; r < boy; r++) for (let c = 0; c < boy; c++) koyu += modul[r][c];
  const oran = (koyu * 100) / (boy * boy);
  puan += Math.floor(Math.abs(oran - 50) / 5) * 10;

  return puan;
}

/* ---------- Genel arayüz ---------- */

/** Metni UTF-8 bayta çevirir. TextEncoder yoksa elle kodlar (testte de çalışsın). */
function baytlar(metin) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(metin);
  const cikti = [];
  for (const harf of String(metin)) {
    let kod = harf.codePointAt(0);
    if (kod < 0x80) cikti.push(kod);
    else if (kod < 0x800) cikti.push(0xc0 | (kod >> 6), 0x80 | (kod & 63));
    else if (kod < 0x10000) cikti.push(0xe0 | (kod >> 12), 0x80 | ((kod >> 6) & 63), 0x80 | (kod & 63));
    else cikti.push(0xf0 | (kod >> 18), 0x80 | ((kod >> 12) & 63), 0x80 | ((kod >> 6) & 63), 0x80 | (kod & 63));
  }
  return Uint8Array.from(cikti);
}

export class QrHatasi extends Error {}

/** Metni tutacak en küçük sürüm. Sığmıyorsa hata atar. */
export function surumSec(baytSayisi) {
  for (let s = 1; s <= 20; s++) {
    const sayacBiti = s <= 9 ? 8 : 16;
    const gerekli = 4 + sayacBiti + baytSayisi * 8;
    if (gerekli <= veriKapasitesi(s) * 8) return s;
  }
  throw new QrHatasi('Metin QR koda sığmayacak kadar uzun.');
}

/**
 * Metinden QR matrisi üretir.
 * Döner: { boy, modul } — modul[r][c] 0 ya da 1.
 */
export function qrMatris(metin) {
  const veri = baytlar(metin);
  if (!veri.length) throw new QrHatasi('QR için içerik boş.');
  const surum = surumSec(veri.length);
  const [ecSayisi, gruplar] = BLOKLAR_M[surum];
  const toplamVeri = veriKapasitesi(surum);

  // Bit akışı: kip + uzunluk + veri + sonlandırıcı + dolgu
  const bitler = new Bitler();
  bitler.ekle(0b0100, 4);
  bitler.ekle(veri.length, surum <= 9 ? 8 : 16);
  for (const b of veri) bitler.ekle(b, 8);
  const bosluk = toplamVeri * 8 - bitler.uzunluk;
  bitler.ekle(0, Math.min(4, bosluk));
  while (bitler.uzunluk % 8) bitler.bitler.push(0);
  const dolgu = [0xec, 0x11];
  for (let i = 0; bitler.uzunluk < toplamVeri * 8; i++) bitler.ekle(dolgu[i % 2], 8);

  // Kodsözcükler
  const kodsozcukler = new Uint8Array(toplamVeri);
  for (let i = 0; i < toplamVeri; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bitler.bitler[i * 8 + j];
    kodsozcukler[i] = b;
  }

  // Bloklara böl, her bloğun hata düzeltmesini hesapla
  const veriBloklari = [];
  const ecBloklari = [];
  let konum = 0;
  for (const [adet, uzunluk] of gruplar) {
    for (let i = 0; i < adet; i++) {
      const blok = kodsozcukler.slice(konum, konum + uzunluk);
      konum += uzunluk;
      veriBloklari.push(blok);
      ecBloklari.push(hataKodsozcukleri(blok, ecSayisi));
    }
  }

  // Blokları serpiştir
  const sonuc = [];
  const enUzunVeri = Math.max(...veriBloklari.map((b) => b.length));
  for (let i = 0; i < enUzunVeri; i++) {
    for (const b of veriBloklari) if (i < b.length) sonuc.push(b[i]);
  }
  for (let i = 0; i < ecSayisi; i++) {
    for (const b of ecBloklari) sonuc.push(b[i]);
  }

  // Bitlere aç
  const bitDizisi = [];
  for (const b of sonuc) for (let i = 7; i >= 0; i--) bitDizisi.push((b >> i) & 1);

  // Sekiz maskeyi dene, cezası en düşük olanı seç
  let enIyi = null;
  for (let maske = 0; maske < 8; maske++) {
    const m = bosMatris(17 + surum * 4);
    desenleriYerlestir(m, surum);
    const ayrilmis = m.modul.map((satir) => Int8Array.from(satir, (v) => (v === -1 ? 0 : 1)));
    // Desenler yerleşmiş matriste -1 kalan hücreler veri hücreleridir.
    const veriMatrisi = bosMatris(m.boy);
    veriMatrisi.modul = m.modul.map((s) => Int8Array.from(s));
    veriyiYerlestir(veriMatrisi, bitDizisi);
    for (let r = 0; r < m.boy; r++) {
      for (let c = 0; c < m.boy; c++) {
        if (!ayrilmis[r][c] && MASKELER[maske](r, c)) veriMatrisi.modul[r][c] ^= 1;
      }
    }
    bicimiYaz(veriMatrisi.modul, m.boy, maske);
    const puan = cezaPuani(veriMatrisi.modul, m.boy);
    if (!enIyi || puan < enIyi.puan) enIyi = { puan, modul: veriMatrisi.modul, boy: m.boy };
  }

  return { boy: enIyi.boy, modul: enIyi.modul.map((s) => Array.from(s)), surum };
}

/**
 * QR'ı tek bir SVG yol verisi olarak döndürür — çizimi çağıran yapar.
 * `sessizAlan` modül cinsinden kenar boşluğu (standart 4).
 */
export function qrYolu(metin, { sessizAlan = 4 } = {}) {
  const { boy, modul } = qrMatris(metin);
  const tamBoy = boy + sessizAlan * 2;
  let yol = '';
  for (let r = 0; r < boy; r++) {
    for (let c = 0; c < boy; c++) {
      if (modul[r][c]) yol += `M${c + sessizAlan} ${r + sessizAlan}h1v1h-1z`;
    }
  }
  return { yol, boy: tamBoy };
}
