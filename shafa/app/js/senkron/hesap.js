// Hesabın şifrelemesi: paroladan ve kurtarma kodundan anahtar türetme, kasa
// anahtarını (K) sarma ve açma. Yalnız cihazda, yalnız WebCrypto ile çalışır.
//
// Sunucuya giden tek şey `giris` / `kurtarma` doğrulayıcılarıdır. Bunlar
// HKDF'nin AYRI etiketli çıktıları: sunucu `giris`ten ne `sarma` anahtarını
// ne parolayı geri çıkarabilir. K'yi açan `sarma` anahtarı cihazdan çıkmaz
// (içe aktarılamaz: extractable false). Parola, K ve kurtarma kodu da çıkmaz.
//
// Bu dosyadaki her sabit (etiketler, tur sayısı, tuzun biçimi) bir anahtarın
// girdisi. Biri değişirse bütün hesaplar kilitlenir: bilinen-cevap testleri
// (test/hesap.test.js) hepsini bağımsız bir gerçeklemeyle hesaplanmış
// değerlere sabitliyor. Değiştirmek gerekirse yeni bir etiket (v2) açılır.
//
// Saf modül: DOM yok, ağ yok.
import { kullaniciAdiNormal, parolaNormal, kurtarmaNormal } from '../paylasilan/hesap-kurallari.js';
import { kasaKoduUret } from '../paylasilan/kimlik.js';

/** Tur sayısı İSTEMCİDE sabit, sunucudan alınmıyor: sahte bir sunucu düşük
 *  bir sayı söyleyip parolayı ucuz kırılır hale getiremesin. */
export const PAROLA_DONGU = 600000;

/** Kurtarma kodu 24 harf × 32 seçenek = 120 bit; K 20 harf = 100 bit. */
export const KURTARMA_UZUNLUGU = 24;
const KASA_UZUNLUGU = 20;

export class HesapHatasi extends Error {
  constructor(kod, mesaj, veri = null) { super(mesaj || kod); this.kod = kod; this.veri = veri; }
}

const utf8 = (s) => new TextEncoder().encode(s);

function altyapi() {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new HesapHatasi('kripto', 'Bu tarayıcıda şifreleme yok.');
  return c;
}

/* Sunucuya giden anahtarlar base64url (dolgusuz, 43 karakter); sarılmış K
   standart base64 ({iv, veri}). İkisinin biçimi de sunucuda denetleniyor. */
const b64Yaz = (b) => btoa(String.fromCharCode(...b));
const b64Oku = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64urlYaz = (b) => b64Yaz(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const sha256 = async (metin) => new Uint8Array(await altyapi().subtle.digest('SHA-256', utf8(metin)));

/* HKDF'nin iki çıktısı aynı gizden, ayrı etiketle: biri sunucuya giden
   doğrulayıcı (ham bayt), öbürü K'yi saran AES-GCM anahtarı. Tuz boş
   (RFC 5869: HashLen sıfır bayta eşdeğer); gizin kendisi zaten tuzlu. */
async function ikiAnahtar(gizBaytlari, tuz, girisEtiketi, sarmaEtiketi) {
  const c = altyapi();
  const giz = await c.subtle.importKey('raw', gizBaytlari, 'HKDF', false, ['deriveBits', 'deriveKey']);
  const hkdf = (etiket) => ({ name: 'HKDF', hash: 'SHA-256', salt: tuz, info: utf8(etiket) });
  const dogrulayici = new Uint8Array(await c.subtle.deriveBits(hkdf(girisEtiketi), giz, 256));
  const sarma = await c.subtle.deriveKey(hkdf(sarmaEtiketi), giz, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  return { dogrulayici: b64urlYaz(dogrulayici), sarma };
}

/**
 * Parola anahtarları. Tuz kullanıcı adından türüyor (deterministik): istemci
 * girişten önce sunucuya hiçbir şey sormadan hesaplayabilsin diye. Bilinen
 * bir ad için önceden sözlük hazırlanabilmesi kabul edilmiş bir bedel.
 * PBKDF2 TEK blok (256 bit) çalışıyor, iki anahtar HKDF ile ayrılıyor: iki
 * blok isteseydik saldırgan yalnız birini hesaplayıp maliyetin yarısından
 * kurtulurdu.
 * Döner: { giris: base64url (sunucuya), sarma: CryptoKey (cihazda kalır) }
 */
export async function parolaAnahtarlari(kullanici, parola) {
  const c = altyapi();
  const u = kullaniciAdiNormal(kullanici);
  const P = parolaNormal(parola);
  if (!u || !P) throw new HesapHatasi('parola_bos', 'Kullanıcı adı ve parola gerekli.');
  const ham = await c.subtle.importKey('raw', utf8(P), 'PBKDF2', false, ['deriveBits']);
  const M = new Uint8Array(await c.subtle.deriveBits(
    { name: 'PBKDF2', salt: await sha256('shafa-hesap-v1|' + u), iterations: PAROLA_DONGU, hash: 'SHA-256' }, ham, 256));
  const { dogrulayici, sarma } = await ikiAnahtar(M, new Uint8Array(0), 'shafa-giris-v1', 'shafa-sarma-v1');
  return { giris: dogrulayici, sarma };
}

/**
 * Kurtarma anahtarları. Kod 120 bit rastgele olduğu için yavaş türetme
 * gerekmiyor; HKDF'nin girdisi normalleşmiş kod (tiresiz, büyük harf), tuzu
 * kullanıcı adı. Kayıtta da kurtarmada da AYNI kurtarmaNormal çalışır.
 * Döner: { kurtarma: base64url (sunucuya), sarma: CryptoKey }
 */
export async function kurtarmaAnahtarlari(kullanici, kod) {
  const u = kullaniciAdiNormal(kullanici);
  const R = kurtarmaNormal(kod);
  if (!u || R.length !== KURTARMA_UZUNLUGU) throw new HesapHatasi('kurtarma_gecersiz', 'Kurtarma kodu eksik ya da bozuk.');
  const { dogrulayici, sarma } = await ikiAnahtar(utf8(R), await sha256('shafa-kurtarma-v1|' + u),
    'shafa-kurtarma-giris-v1', 'shafa-kurtarma-sarma-v1');
  return { kurtarma: dogrulayici, sarma };
}

/* Ek doğrulanan veri (AAD) sarmanın AMACINI ve kullanıcı adını bağlıyor:
   parolayla sarılmış K kurtarma yerine ya da başka bir hesabın kaydı olarak
   geri oynanırsa etiket tutmaz. */
const AMACLAR = ['parola', 'kurtarma'];
function ekVeri(amac, kullanici) {
  if (!AMACLAR.includes(amac)) throw new TypeError('Bilinmeyen sarma amacı: ' + amac);
  return utf8(`shafa-sarili-v1|${amac}|${kullaniciAdiNormal(kullanici)}`);
}

/** K'yi sarar. Her sarma yeni bir 12 baytlık IV kullanır. Döner: { iv, veri } (base64). */
export async function sar(anahtar, kasa, amac, kullanici) {
  const c = altyapi();
  const iv = c.getRandomValues(new Uint8Array(12));
  const kapali = await c.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: ekVeri(amac, kullanici) }, anahtar, utf8(kasa));
  return { iv: b64Yaz(iv), veri: b64Yaz(new Uint8Array(kapali)) };
}

/**
 * Sarılmış K'yi açar. Sunucu `giris`i kabul ettiği halde açılmıyorsa kayıt
 * sunucuda bozulmuş ya da değiştirilmiştir: bu bir parola hatası DEĞİL,
 * hekim parolasıyla uğraşmasın diye ayrı kod ('anahtar_bozuk').
 */
export async function ac(anahtar, sarili, amac, kullanici) {
  const c = altyapi();
  const ek = ekVeri(amac, kullanici);
  try {
    const acik = await c.subtle.decrypt({ name: 'AES-GCM', iv: b64Oku(sarili.iv), additionalData: ek }, anahtar, b64Oku(sarili.veri));
    return new TextDecoder('utf-8', { fatal: true }).decode(acik);
  } catch { throw new HesapHatasi('anahtar_bozuk', 'Hesabın anahtarı açılamadı.'); }
}

/** Yeni kurtarma kodu: dörtlü gruplar, karışan harfler (0/O, 1/I) yok. */
export const kurtarmaKoduUret = () => kasaKoduUret(KURTARMA_UZUNLUGU);

/** Yeni kasa anahtarı K: eşitlemede kasanın parolası olarak kullanılır. */
export const kasaAnahtariUret = () => kasaKoduUret(KASA_UZUNLUGU);
