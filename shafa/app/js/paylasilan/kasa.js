// Kasa: Drive'a yüklenmeden önce veriyi şifreler, indirildikten sonra çözer.
//
// Neden: bu uygulamanın baştan beri verdiği söz "hasta bilgisi bu cihazdan
// çıkmaz" idi. Eşitleme o sözü tek başına bozardı. Kasa sözü şu hale getiriyor:
// veri cihazdan çıkar ama OKUNABİLİR halde çıkmaz. Google'ın elinde rastgele
// baytlar durur; açacak parola yalnız hekimin iki cihazında.
//
// Parola kaybolursa buluttaki kopya bir daha açılamaz. Cihazdaki veri ve
// indirilen yedek dosyaları bundan etkilenmez — kayıp, yedeğin yedeği kadardır.
//
// Saf modül: yalnız WebCrypto kullanır, DOM'a dokunmaz.

export const KASA_BICIMI = 'shafa-kasa';
export const KASA_SURUMU = 1;

/** OWASP'ın PBKDF2-SHA256 için verdiği alt sınır. Telefonda ~0,3 sn sürüyor;
 *  eşitleme başına bir kez çalıştığı için hissedilmiyor. */
export const DONGU = 310000;

export class KasaHatasi extends Error {
  constructor(kod, mesaj) { super(mesaj || kod); this.kod = kod; }
}

/* Base64'e PARÇA PARÇA çeviriliyor. `String.fromCharCode(...dizi)` bütün
   baytları ayrı argüman olarak yığına koyuyor ve ~128KB'da yığını taşırıyor:
   ayarlardaki Clinical fotoğrafı tek başına 220KB'a çıkabildiği için, fotoğraf
   yüklemiş bir hekimde İLK eşitleme çöküyordu. Testler küçük nesnelerle
   geçtiği, tarayıcı denemesi de sınırın hemen altında kaldığı için görünmedi. */
const ADIM = 0x8000;
const b64Yaz = (baytlar) => {
  const b = new Uint8Array(baytlar);
  let metin = '';
  for (let i = 0; i < b.length; i += ADIM) metin += String.fromCharCode(...b.subarray(i, i + ADIM));
  return btoa(metin);
};
const b64Oku = (metin) => Uint8Array.from(atob(metin), (c) => c.charCodeAt(0));

function altyapi() {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new KasaHatasi('kripto', 'Bu tarayıcıda şifreleme yok.');
  return c;
}

/** Dosyadaki tur sayısı kullanılır ama sınırlanır: çok düşük bir değer
 *  anahtarı zayıflatır, çok yüksek bir değer tarayıcıyı dakikalarca kilitler.
 *  Dosyayı değiştirebilen biri ikisini de deneyebilir. Eski kasalarda alan
 *  yoksa bugünkü sayı varsayılır. */
const EN_AZ_DONGU = 100000;
const EN_COK_DONGU = 2000000;
export const donguSayisi = (paket) => {
  const n = Math.trunc(Number(paket?.dongu));
  if (!Number.isFinite(n) || n <= 0) return DONGU;
  return Math.min(EN_COK_DONGU, Math.max(EN_AZ_DONGU, n));
};

/** Parola + tuz → AES-GCM anahtarı. Tuz kasanın açık başlığında durur. */
async function anahtarTuret(parola, tuz, dongu = DONGU) {
  const c = altyapi();
  const ham = await c.subtle.importKey('raw', new TextEncoder().encode(String(parola)), 'PBKDF2', false, ['deriveKey']);
  return c.subtle.deriveKey(
    { name: 'PBKDF2', salt: tuz, iterations: dongu, hash: 'SHA-256' },
    ham, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/**
 * Nesneyi kasaya koyar. Dönen paket JSON'a yazılabilir; içinde tuz ve IV
 * AÇIK durur (durmaları gerekir, gizli değiller), veri şifrelidir.
 * `tuz` verilirse yeniden kullanılır — aynı kasaya yazarken anahtar
 * yeniden türetilmesin diye değil, kasanın kimliği değişmesin diye.
 */
export async function kasayaKoy(nesne, parola, { tuz } = {}) {
  if (!parola) throw new KasaHatasi('parola_yok', 'Parola gerekli.');
  const c = altyapi();
  const t = tuz ? b64Oku(tuz) : c.getRandomValues(new Uint8Array(16));
  const iv = c.getRandomValues(new Uint8Array(12));
  const anahtar = await anahtarTuret(parola, t);
  const acik = new TextEncoder().encode(JSON.stringify(nesne));
  const kapali = await c.subtle.encrypt({ name: 'AES-GCM', iv }, anahtar, acik);
  return { bicim: KASA_BICIMI, surum: KASA_SURUMU, dongu: DONGU, tuz: b64Yaz(t), iv: b64Yaz(iv), veri: b64Yaz(kapali) };
}

/** Kasayı açar. Parola yanlışsa AES-GCM etiketi tutmaz ve 'parola' hatası düşer. */
export async function kasadanAl(paket, parola) {
  if (!paket || paket.bicim !== KASA_BICIMI) throw new KasaHatasi('bicim', 'Bu bir Shafa kasası değil.');
  if (Number(paket.surum) > KASA_SURUMU) throw new KasaHatasi('surum', 'Kasa bu sürümden yeni; önce uygulamayı güncelle.');
  if (!parola) throw new KasaHatasi('parola_yok', 'Parola gerekli.');
  const c = altyapi();
  // Başlığın çözülmesi AYRI deneniyor: bozuk bir dosyada da "parola tutmuyor"
  // deseydik hekim olmayan bir parola sorununun peşine düşerdi.
  let tuz, iv, veri;
  try { tuz = b64Oku(paket.tuz); iv = b64Oku(paket.iv); veri = b64Oku(paket.veri); }
  catch { throw new KasaHatasi('bozuk', 'Buluttaki dosya bozuk.'); }
  if (!tuz.length || iv.length !== 12 || !veri.length) throw new KasaHatasi('bozuk', 'Buluttaki dosya bozuk.');

  let acik;
  try {
    const anahtar = await anahtarTuret(parola, tuz, donguSayisi(paket));
    acik = await c.subtle.decrypt({ name: 'AES-GCM', iv }, anahtar, veri);
  } catch { throw new KasaHatasi('parola', 'Parola tutmuyor.'); }
  try { return JSON.parse(new TextDecoder().decode(acik)); }
  catch { throw new KasaHatasi('bozuk', 'Kasa açıldı ama içi okunamadı.'); }
}

/** Kasanın tuzu — aynı kasaya yazmaya devam etmek için. */
export const kasaTuzu = (paket) => (paket?.bicim === KASA_BICIMI ? paket.tuz || '' : '');

export const kasaMi = (p) => !!p && p.bicim === KASA_BICIMI;
