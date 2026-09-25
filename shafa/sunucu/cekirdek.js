// Sunucunun saf mantığı: hesap, oturum, şifreli kasa ve kötüye kullanım sınırları.
//
// Yalnız Durable Object'in KV depolama arayüzüne (get/put/delete/list/deleteAll,
// alarm) ve WebCrypto'ya dayanır; Cloudflare'e özgü hiçbir şey içe aktarmaz. Böylece
// aynı kod workerd'da, Node'daki yerel sunucuda (yerel.mjs) ve testlerde Map
// tabanlı sahte depoyla birebir çalışır.
//
// Sunucu hiçbir zaman parolayı, kasa anahtarını (K), kurtarma kodunu ya da açık
// kaydı görmez: eline yalnız cihazda türetilmiş `giris`/`kurtarma` anahtarları,
// K'nin sarılmış (şifreli) hali ve şifreli kasa baytları geçer. Anahtarların
// kendisi bile saklanmaz; tuzlu SHA-256 özetleri saklanır.

import { kullaniciAdiNormal, kullaniciGecerli, parolaNormal, VERI_SINIRI } from '../app/js/paylasilan/hesap-kurallari.js';

const SANIYE = 1000;
const DAKIKA = 60 * SANIYE;
const SAAT = 60 * DAKIKA;
const GUN = 24 * SAAT;

export const AYAR = Object.freeze({
  jsonSiniri: 4096,
  oturumOmru: 365 * GUN,
  enFazlaOturum: 20,
  /* SQLite tabanlı DO'da anahtar + değer en çok 2 MB. 1,9 MB'lık parçalarla
     20 MB'lık kasa 11 satıra sığar: tek put(entries) (128 anahtar sınırı) ve
     yükleme başına az satır yazma (ücretsiz planda günde 100 bin). */
  parcaBoyu: 1_900_000,
  veriSiniri: VERI_SINIRI,
  yazimAraligi: 5 * SANIYE,
  gunlukYazim: 1000,
  kilitBedava: 10,
  kilitTaban: DAKIKA,
  kilitTavan: SAAT,
  kilitTemizlik: GUN,
  ipPencereleri: { giris: { sayi: 60, sure: 10 * DAKIKA }, kayit: { sayi: 20, sure: SAAT } },
  ipBellekTavani: 20000,
  gunlukKayit: 300,
});

/** Yanıta dönüşecek bilinen hata: durum kodu + makinece okunur kod (+ ek alanlar). */
export class ApiHatasi extends Error {
  constructor(durum, kod, ek = {}) { super(kod); this.durum = durum; this.kod = kod; this.ek = ek; }
}

// --- baytlar ---------------------------------------------------------------

const kodlayici = new TextEncoder();
export const utf8 = (s) => kodlayici.encode(String(s));

export function b64urlYaz(baytlar) {
  let s = '';
  for (const b of baytlar) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Geçersiz girdide null: çağıran bunu 400/401'e çevirir, istisna sızmaz. */
export function b64urlOku(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
  try {
    const ikili = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
    return Uint8Array.from(ikili, (c) => c.charCodeAt(0));
  } catch { return null; }
}

export const hex = (baytlar) => Array.from(baytlar, (b) => b.toString(16).padStart(2, '0')).join('');
const hexOku = (s) => Uint8Array.from(s.match(/../g) || [], (h) => parseInt(h, 16));

function rastgele(n) {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

/** SHA-256(a ‖ b ‖ …) */
export async function ozet(...parcalar) {
  const boy = parcalar.reduce((t, p) => t + p.length, 0);
  const birlesik = new Uint8Array(boy);
  let i = 0;
  for (const p of parcalar) { birlesik.set(p, i); i += p.length; }
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', birlesik));
}

/**
 * Sabit zamanlı karşılaştırma (dize ya da bayt dizisi). XOR döngüsü bilerek
 * elle yazıldı: `crypto.subtle.timingSafeEqual` yalnız workerd'da var, Node'daki
 * yerel sunucuda ve testlerde yok. Döngü her zaman uzun olanın boyu kadar döner;
 * sızabilecek tek şey uzunluk, o da bu kullanımda (sabit boylu özetler) gizli değil.
 */
export function esitMi(a, b) {
  const x = typeof a === 'string' ? utf8(a) : a;
  const y = typeof b === 'string' ? utf8(b) : b;
  const n = Math.max(x.length, y.length);
  let fark = x.length ^ y.length;
  for (let i = 0; i < n; i++) fark |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return fark === 0;
}

// --- jeton ------------------------------------------------------------------

/* Jeton `<b64url(u)>.<b64url(32 rastgele bayt)>`. İlk parça yalnız YÖNLENDİRME
   içindir (Worker hangi hesabın DO'suna gideceğini bilsin, ortak bir jeton
   dizini gerekmesin). Yetki ikinci parçadan gelir: DO jetonun TAMAMININ
   özetini saklar, ilk parça oynanmış bir jeton hiçbir özetle eşleşmez. */
export const jetonUret = (u) => `${b64urlYaz(utf8(u))}.${b64urlYaz(rastgele(32))}`;

export function jetonKullanicisi(jeton) {
  if (typeof jeton !== 'string' || jeton.length > 200) return null;
  const [onek, govde, fazla] = jeton.split('.');
  if (fazla !== undefined || b64urlOku(govde)?.length !== 32) return null;
  const baytlar = b64urlOku(onek);
  if (!baytlar) return null;
  let u;
  try { u = new TextDecoder('utf-8', { fatal: true }).decode(baytlar); } catch { return null; }
  return kullaniciGecerli(u) && kullaniciAdiNormal(u) === u ? u : null;
}

const oturumAnahtari = async (jeton) => 'oturum:' + hex(await ozet(utf8(jeton)));

// --- istek gövdesi ----------------------------------------------------------

/**
 * Akışı okur, `sinir`i aşınca 413 atar ve baytları `parcaBoyu`luk parçalara
 * böler. Content-Length'e güvenmek yetmez (yoksa ya da yalansa diye) —
 * her okumada sayılır. Bütün gövde tek bir büyük tampona toplanmaz: parçalar
 * doğrudan depoya yazılacak boyda doğar.
 */
export async function akisiParcala(akis, sinir, parcaBoyu = sinir) {
  const parcalar = [];
  let toplam = 0;
  let tampon = null;
  let dolu = 0;
  if (!akis) return { parcalar, toplam };
  const okuyucu = akis.getReader();
  try {
    for (;;) {
      const { done, value } = await okuyucu.read();
      if (done) break;
      const bayt = value instanceof Uint8Array ? value : new Uint8Array(value);
      toplam += bayt.length;
      if (toplam > sinir) throw new ApiHatasi(413, 'buyuk');
      for (let i = 0; i < bayt.length;) {
        if (!tampon) { tampon = new Uint8Array(parcaBoyu); dolu = 0; }
        const n = Math.min(parcaBoyu - dolu, bayt.length - i);
        tampon.set(bayt.subarray(i, i + n), dolu);
        dolu += n; i += n;
        if (dolu === parcaBoyu) { parcalar.push(tampon); tampon = null; }
      }
    }
  } catch (e) {
    okuyucu.cancel().catch(() => {});
    throw e;
  }
  if (tampon) parcalar.push(tampon.slice(0, dolu));
  return { parcalar, toplam };
}

/**
 * Okunmayacak bir gövdeyi sonuna kadar tüketir (en çok `sinir` bayt).
 * workerd'da Worker kasa gövdesini DO'ya yerel bir boruyla aktarıyor; DO
 * gövdeyi okumadan yanıt verirse (401, 429…) boru yanıt gittikten SONRA
 * okumaya devam ediyor ve çalışma zamanı bağlantıyı koparıyor: istemci
 * 401 yerine ağ hatası görüyordu (wrangler dev ile görüldü). Sınırı aşan
 * gövde yine kesilir — o durumda dürüst bir istemci zaten yoktur
 * (Content-Length'i sınırın üstündekini Worker gövdeye dokunmadan reddeder).
 */
async function akisiAt(akis, sinir) {
  if (!akis || akis.locked) return;
  const okuyucu = akis.getReader();
  let toplam = 0;
  try {
    for (;;) {
      const { done, value } = await okuyucu.read();
      if (done) return;
      toplam += value.byteLength;
      if (toplam > sinir) break;
    }
  } catch { return; }
  okuyucu.cancel().catch(() => {});
}

/** Kimlik uçlarının küçük JSON gövdesi (≤ 4 KB). Düz nesne değilse 400. */
export async function jsonOku(istek) {
  if (Number(istek.headers.get('Content-Length')) > AYAR.jsonSiniri) throw new ApiHatasi(413, 'buyuk');
  const { parcalar } = await akisiParcala(istek.body, AYAR.jsonSiniri);
  let veri;
  try { veri = JSON.parse(new TextDecoder().decode(parcalar[0] || new Uint8Array())); }
  catch { throw new ApiHatasi(400, 'gecersiz'); }
  if (!veri || typeof veri !== 'object' || Array.isArray(veri)) throw new ApiHatasi(400, 'gecersiz');
  return veri;
}

// --- gövde şeması -----------------------------------------------------------

const ANAHTAR = /^[A-Za-z0-9_-]{43}$/;           // 32 bayt, b64url, dolgusuz
const B64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/* Sarılmış K: `{ iv, veri }`, ikisi de standart base64. iv 12 bayt; veri
   K'nin (24 karakter) AES-GCM çıktısı — pay bırakılarak sınırlanıyor ki
   sunucu keyfi büyüklükte veri saklama yerine dönmesin. */
function sariliMi(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  if (Object.keys(o).sort().join() !== 'iv,veri') return false;
  return typeof o.iv === 'string' && o.iv.length === 16 && B64.test(o.iv)
    && typeof o.veri === 'string' && o.veri.length >= 24 && o.veri.length <= 512 && B64.test(o.veri);
}

const ALAN_TURU = {
  kullanici: (v) => typeof v === 'string' && v.length <= 64 && kullaniciGecerli(kullaniciAdiNormal(v)),
  davet: (v) => typeof v === 'string' && v.length > 0 && v.length <= 200,
  sarili: sariliMi,
  anahtar: (v) => typeof v === 'string' && ANAHTAR.test(v) && b64urlOku(v)?.length === 32,
};
const alanTuru = (ad) => (ad === 'kullanici' || ad === 'davet' ? ad : /sarili$/i.test(ad) ? 'sarili' : 'anahtar');

const ALANLAR = Object.freeze({
  'kayit': ['kullanici', 'davet', 'giris', 'kurtarma', 'sarili', 'kurtarmaSarili'],
  'giris': ['kullanici', 'giris'],
  'kurtar/ac': ['kullanici', 'kurtarma'],
  'kurtar/bitir': ['kullanici', 'kurtarma', 'giris', 'sarili', 'yeniKurtarma', 'yeniKurtarmaSarili'],
  'kurtarma/yenile': ['giris', 'yeniKurtarma', 'yeniKurtarmaSarili'],
  'parola': ['giris', 'yeniGiris', 'yeniSarili'],
  'hesap/sil': ['giris'],
});

/** Uç için gereken alanları denetler ve YALNIZ onları döndürür (kullanıcı adı
 *  normalleşmiş olarak). Fazla alan sessizce atılır, eksik ya da bozuk alan 400. */
export function govdeDogrula(islem, veri) {
  const temiz = {};
  for (const ad of ALANLAR[islem]) {
    if (!ALAN_TURU[alanTuru(ad)](veri[ad])) throw new ApiHatasi(400, 'gecersiz');
    temiz[ad] = ad === 'kullanici' ? kullaniciAdiNormal(veri[ad]) : veri[ad];
  }
  return temiz;
}

/** Davet kodu hekime WhatsApp'la gider, telefonda Dari klavyesiyle yazılır:
 *  parola gibi normalleşir, büyük/küçük harf fark etmez. */
export const davetNormal = (s) => parolaNormal(s).toLowerCase();

// --- IP ---------------------------------------------------------------------

/** IPv4 olduğu gibi; IPv6 /64 önekine indirgenir (bir istemci bütün /64'ü
 *  kullanabildiği için adres değiştirerek sınırı aşmasın). IPv4-mapped
 *  IPv6 (::ffff:1.2.3.4) IPv4'e döner. */
export function ipAnahtari(ip) {
  const s = String(ip || '').trim().toLowerCase();
  if (!s.includes(':')) return s || 'bilinmiyor';
  const eslesen = s.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (eslesen) return eslesen[1];
  const [bas, son = ''] = s.split('%')[0].split('::');
  const sol = bas ? bas.split(':') : [];
  const sag = s.includes('::') && son ? son.split(':') : [];
  const tam = s.includes('::') ? [...sol, ...Array(Math.max(0, 8 - sol.length - sag.length)).fill('0'), ...sag] : sol;
  return tam.slice(0, 4).map((h) => (parseInt(h, 16) || 0).toString(16)).join(':') + '::/64';
}

/** 16 bellek parçasından hangisi: basit FNV-1a, kriptografik olması gerekmez. */
export function ipParcasi(anahtar) {
  let h = 0x811c9dc5;
  for (const c of utf8(anahtar)) h = Math.imul(h ^ c, 0x01000193);
  return (h >>> 0) % 16;
}

const saniye = (ms) => Math.max(1, Math.ceil(ms / SANIYE));
const utcGun = (t) => new Date(t).toISOString().slice(0, 10);
const gunSonunaKalan = (t) => GUN - (t % GUN);

// --- Hesap DO ---------------------------------------------------------------

/* Hesap yoksa karşılaştırma yine yapılır: "bilinmeyen kullanıcı" ile "yanlış
   parola" aynı işi yapsın, aynı cevabı versin, hiçbir şey yazmasın. */
const SAHTE_TUZ = new Uint8Array(16);
const SAHTE_OZET = '0'.repeat(64);

export class HesapCekirdek {
  constructor(depo) {
    this.depo = depo;
    this.yuklendi = null;
  }

  /* Bu nesnenin durumu (hesap, kasa başlığı, yazım temposu) bellekte tutulur.
     DO tek iş parçacıklıdır ve bu anahtarlara yalnız bu nesne yazar; bellek
     kopyası sayesinde sürüm denetimi ile yazma arasında HİÇ await olmaz. */
  yukle() {
    this.yuklendi ??= this.depo.get(['hesap', 'veri:bas', 'yazim']).then((m) => {
      this.hesap = m.get('hesap') || null;
      this.bas = m.get('veri:bas') || null;
      this.yazim = m.get('yazim') || null;
    }, (e) => { this.yuklendi = null; throw e; });
    return this.yuklendi;
  }

  /* Yazma başarısız olursa (ör. günlük kota) bellek kopyası depoyla
     uyuşmayabilir: bir sonraki istek depodan yeniden okusun. */
  async yaz(islemler) {
    try { await Promise.all(islemler); }
    catch (e) { this.yuklendi = null; throw e; }
  }

  async ozetle(tuzHex, anahtarB64) {
    const anahtar = b64urlOku(anahtarB64);
    if (anahtar?.length !== 32) throw new ApiHatasi(400, 'gecersiz');
    return hex(await ozet(tuzHex ? hexOku(tuzHex) : SAHTE_TUZ, anahtar));
  }

  async yeniOzet(anahtarB64) {
    const tuz = hex(rastgele(16));
    return { tuz, ozet: await this.ozetle(tuz, anahtarB64) };
  }

  /** `giris` ya da `kurtarma` anahtarı hesaptakiyle tutuyor mu? Hesap yoksa
   *  sahte tuzla aynı iş yapılır ve false döner. */
  async anahtarTutar(tur, anahtarB64) {
    const h = this.hesap;
    const hesaplanan = await this.ozetle(h ? h[tur + 'Tuzu'] : null, anahtarB64);
    return esitMi(hesaplanan, h ? h[tur + 'Ozeti'] : SAHTE_OZET) && !!h;
  }

  async oturumHazirla(u) {
    const jeton = jetonUret(u);
    return { jeton, anahtar: await oturumAnahtari(jeton) };
  }

  /** Oturum sınırı aşılacaksa en uzun süredir kullanılmayanlar düşer. */
  async fazlaOturumlar() {
    const liste = [...(await this.depo.list({ prefix: 'oturum:' }))].sort((a, b) => a[1].son - b[1].son);
    return liste.slice(0, Math.max(0, liste.length - AYAR.enFazlaOturum + 1)).map(([a]) => a);
  }

  async oturumDogrula(jeton) {
    await this.yukle();
    if (!this.hesap || typeof jeton !== 'string') throw new ApiHatasi(401, 'oturum');
    const anahtar = await oturumAnahtari(jeton);
    const o = await this.depo.get(anahtar);
    if (!o) throw new ApiHatasi(401, 'oturum');
    const simdi = Date.now();
    if (simdi - o.son > AYAR.oturumOmru) {
      await this.yaz([this.depo.delete(anahtar)]);
      throw new ApiHatasi(401, 'oturum');
    }
    // Son kullanım günde en çok bir kez yazılır: her eşitlemede satır yazmasın.
    if (simdi - o.son > GUN) await this.yaz([this.depo.put(anahtar, { ...o, son: simdi })]);
    return anahtar;
  }

  async kayit(g) {
    await this.yukle();
    if (this.hesap) throw new ApiHatasi(409, 'alinmis');
    const [giris, kurtarma, oturum] = await Promise.all([
      this.yeniOzet(g.giris), this.yeniOzet(g.kurtarma), this.oturumHazirla(g.kullanici)]);
    if (this.hesap) throw new ApiHatasi(409, 'alinmis');
    const simdi = Date.now();
    const hesap = {
      kullanici: g.kullanici,
      girisOzeti: giris.ozet, girisTuzu: giris.tuz,
      kurtarmaOzeti: kurtarma.ozet, kurtarmaTuzu: kurtarma.tuz,
      sarili: g.sarili, kurtarmaSarili: g.kurtarmaSarili,
      olusturuldu: simdi,
    };
    const yazma = this.depo.put({ hesap, [oturum.anahtar]: { olusturuldu: simdi, son: simdi } });
    this.hesap = hesap;
    await this.yaz([yazma]);
    return { jeton: oturum.jeton };
  }

  async giris(g) {
    await this.yukle();
    if (!(await this.anahtarTutar('giris', g.giris))) throw new ApiHatasi(401, 'yanlis');
    const h = this.hesap;
    const [oturum, fazla] = await Promise.all([this.oturumHazirla(h.kullanici), this.fazlaOturumlar()]);
    const simdi = Date.now();
    const yazma = [this.depo.put(oturum.anahtar, { olusturuldu: simdi, son: simdi })];
    if (fazla.length) yazma.push(this.depo.delete(fazla));
    await this.yaz(yazma);
    return { jeton: oturum.jeton, sarili: h.sarili };
  }

  async kurtarAc(g) {
    await this.yukle();
    if (!(await this.anahtarTutar('kurtarma', g.kurtarma))) throw new ApiHatasi(401, 'yanlis');
    return { kurtarmaSarili: this.hesap.kurtarmaSarili };
  }

  /**
   * Hesabın sırlarını değiştirir ve (istenirse) bütün oturumları düşürüp tek
   * yeni oturum açar. Bütün özetler ÖNCE hesaplanır; hesabın arada
   * değişmediği denetlenir ve yazma tek eşzamanlı blokta yapılır.
   */
  async sirlariDegistir(h, yama, { oturumlariSifirla }) {
    const hesaplar = {};
    for (const [tur, anahtar] of Object.entries(yama.anahtarlar)) {
      const y = await this.yeniOzet(anahtar);
      hesaplar[tur + 'Ozeti'] = y.ozet;
      hesaplar[tur + 'Tuzu'] = y.tuz;
    }
    const oturum = oturumlariSifirla ? await this.oturumHazirla(h.kullanici) : null;
    const eskiler = oturumlariSifirla ? [...(await this.depo.list({ prefix: 'oturum:' })).keys()] : [];
    if (this.hesap !== h) throw new ApiHatasi(409, 'cakisma');
    const hesap = { ...h, ...hesaplar, ...yama.alanlar };
    const girdiler = { hesap };
    const simdi = Date.now();
    if (oturum) girdiler[oturum.anahtar] = { olusturuldu: simdi, son: simdi };
    const yazma = [];
    if (eskiler.length) yazma.push(this.depo.delete(eskiler));
    yazma.push(this.depo.put(girdiler));
    this.hesap = hesap;
    await this.yaz(yazma);
    return oturum && { jeton: oturum.jeton };
  }

  /* Kurtarma kodu tek kullanımlık: kurtarma bitince yenisi yazılır, bütün
     oturumlar düşer. Yeni kod eskisiyle aynıysa (istemci hatası ya da eski
     kodu "yenilemiş gibi" yapan biri) reddedilir. */
  async kurtarBitir(g) {
    await this.yukle();
    if (!(await this.anahtarTutar('kurtarma', g.kurtarma))) throw new ApiHatasi(401, 'yanlis');
    const h = this.hesap;
    if (await this.anahtarTutar('kurtarma', g.yeniKurtarma)) throw new ApiHatasi(400, 'gecersiz');
    return this.sirlariDegistir(h, {
      anahtarlar: { giris: g.giris, kurtarma: g.yeniKurtarma },
      alanlar: { sarili: g.sarili, kurtarmaSarili: g.yeniKurtarmaSarili },
    }, { oturumlariSifirla: true });
  }

  async girisGerekli(jeton, girisB64) {
    await this.oturumDogrula(jeton);
    if (!(await this.anahtarTutar('giris', girisB64))) throw new ApiHatasi(401, 'yanlis');
    return this.hesap;
  }

  async kurtarmaYenile(jeton, g) {
    const h = await this.girisGerekli(jeton, g.giris);
    if (await this.anahtarTutar('kurtarma', g.yeniKurtarma)) throw new ApiHatasi(400, 'gecersiz');
    await this.sirlariDegistir(h, {
      anahtarlar: { kurtarma: g.yeniKurtarma }, alanlar: { kurtarmaSarili: g.yeniKurtarmaSarili },
    }, { oturumlariSifirla: false });
    return { ok: true };
  }

  async parola(jeton, g) {
    const h = await this.girisGerekli(jeton, g.giris);
    return this.sirlariDegistir(h, {
      anahtarlar: { giris: g.yeniGiris }, alanlar: { sarili: g.yeniSarili },
    }, { oturumlariSifirla: true });
  }

  async cikis(jeton) {
    await this.yukle();
    if (this.hesap && typeof jeton === 'string') await this.yaz([this.depo.delete(await oturumAnahtari(jeton))]);
    return { ok: true };
  }

  async sil(jeton, g) {
    await this.girisGerekli(jeton, g.giris);
    const yazma = this.depo.deleteAll();
    this.hesap = this.bas = this.yazim = null;
    await this.yaz([yazma]);
    return { ok: true };
  }

  async surum(jeton) {
    await this.oturumDogrula(jeton);
    return { surum: this.bas?.surum ?? '' };
  }

  /** Kasa yoksa `govde: null`. Parçalar birleştirilip boyu başlıkla karşılaştırılır:
   *  eksik bir kasa hiçbir koşulda "tamam" diye dönmez. */
  async veriOku(jeton) {
    await this.oturumDogrula(jeton);
    const bas = this.bas;
    if (!bas) return { surum: '', govde: null };
    const anahtarlar = Array.from({ length: bas.parca }, (_, i) => 'veri:p:' + i);
    const m = await this.depo.get(anahtarlar);
    const govde = new Uint8Array(bas.boy);
    let i = 0;
    for (const a of anahtarlar) {
      const p = m.get(a);
      if (!p || i + p.length > bas.boy) throw new Error('kasa parçaları eksik');
      govde.set(p, i);
      i += p.length;
    }
    if (i !== bas.boy) throw new Error('kasa parçaları eksik');
    return { surum: bas.surum, govde };
  }

  /**
   * Kasayı değiştirir. `beklenen` If-Match'ten gelen sürüm ("" = henüz kasa yok,
   * null = başlık yok).
   * Gövde okunurken await'ler var; okunduktan SONRA sürüm denetimi, bütün
   * parçaların, başlığın ve yazım temposunun put'u ile artık parçaların
   * silinmesi tek eşzamanlı blokta yapılır. DO, aralarında await olmayan
   * yazmaları tek atomik işlem olarak işler: okuyan hiçbir zaman yarım kasa görmez,
   * iki cihaz aynı sürüme aynı anda yazarsa biri 409 alır.
   */
  async veriYaz(jeton, { beklenen, akis }) {
    try {
      // If-Match yoksa 400: sürümsüz bir PUT başkasının yazdığını körlemesine ezerdi.
      if (beklenen === null) throw new ApiHatasi(400, 'gecersiz');
      await this.oturumDogrula(jeton);
      this.tempoDenetle(Date.now());
    } catch (e) {
      await akisiAt(akis, AYAR.veriSiniri);
      throw e;
    }
    const { parcalar, toplam } = await akisiParcala(akis, AYAR.veriSiniri, AYAR.parcaBoyu);
    if (!kasaOnekiMi(parcalar[0])) throw new ApiHatasi(400, 'gecersiz');

    // --- buradan sonra await yok ---
    if (!this.hesap) throw new ApiHatasi(401, 'oturum');
    const simdiki = this.bas?.surum ?? '';
    if (beklenen !== simdiki) throw new ApiHatasi(409, 'cakisma');
    const simdi = Date.now();
    this.tempoDenetle(simdi);
    const gun = utcGun(simdi);
    const bas = { surum: String((Number(simdiki) || 0) + 1), parca: parcalar.length, boy: toplam };
    const yazim = { son: simdi, gun, sayi: (this.yazim?.gun === gun ? this.yazim.sayi : 0) + 1 };
    const girdiler = { 'veri:bas': bas, yazim };
    parcalar.forEach((p, i) => { girdiler['veri:p:' + i] = p; });
    const artik = [];
    for (let i = parcalar.length; i < (this.bas?.parca || 0); i++) artik.push('veri:p:' + i);
    const yazma = [this.depo.put(girdiler)];
    if (artik.length) yazma.push(this.depo.delete(artik));
    this.bas = bas;
    this.yazim = yazim;
    // --- eşzamanlı blok sonu ---

    await this.yaz(yazma);
    return { surum: bas.surum };
  }

  /* Hesap başına yazım temposu: iki PUT arası en az 5 sn, günde en çok 1000.
     Bozuk bir istemci döngüye girse bile ücretsiz planın günlük satır yazma
     kotasını tek başına bitiremesin. */
  tempoDenetle(simdi) {
    const y = this.yazim;
    if (!y) return;
    if (simdi - y.son < AYAR.yazimAraligi) throw new ApiHatasi(429, 'cok_istek', { bekle: saniye(y.son + AYAR.yazimAraligi - simdi) });
    if (y.gun === utcGun(simdi) && y.sayi >= AYAR.gunlukYazim) throw new ApiHatasi(429, 'cok_istek', { bekle: saniye(gunSonunaKalan(simdi)) });
  }
}

/* Sunucu kasanın içini açamaz ama biçimini biçim etiketinden tanır. Şifresiz
   bir yedeği (shafa-yedek) ya da çöpü saklamayı reddeder; asıl koruma
   istemcide (şifresiz paket asla birleştirilmez), bu ikinci kat. */
const KASA_ONEKI = utf8('{"bicim":"shafa-kasa"');
const kasaOnekiMi = (p) => !!p && p.length >= KASA_ONEKI.length && KASA_ONEKI.every((b, i) => p[i] === b);

// --- Sinir DO ---------------------------------------------------------------

/**
 * Üç ayrı iş, üç ayrı nesne adıyla:
 *  - `u:<SHA-256(u)>` hesap kilidi (kalıcı; boşta 24 saat sonra alarm siler).
 *    Bilinen ve bilinmeyen kullanıcı adı AYNI yoldan geçer: kilidin varlığı
 *    hesabın varlığını ele vermez.
 *  - `ip:<0..15>` IP pencereleri (yalnız bellek; nesne düşerse sıfırlanır,
 *    kabul edilebilir — depoya satır yazmak IP başına kalıcı çöp üretirdi).
 *  - `genel` günlük kayıt tavanı (kalıcı, kayıt başına tek küçük yazma).
 */
export class SinirCekirdek {
  constructor(depo) {
    this.depo = depo;
    this.pencereler = new Map();
  }

  ipDene(tur, anahtar) {
    const p = AYAR.ipPencereleri[tur];
    const simdi = Date.now();
    const ad = tur + '|' + anahtar;
    let k = this.pencereler.get(ad);
    if (!k || simdi - k.bas >= p.sure) {
      this.bellekBudama(simdi);
      k = { bas: simdi, sayi: 0 };
      this.pencereler.set(ad, k);
    }
    if (k.sayi >= p.sayi) return { izin: false, bekle: saniye(k.bas + p.sure - simdi) };
    k.sayi++;
    return { izin: true };
  }

  /* Bellek sınırsız büyümesin: tavan aşılınca süresi dolanlar atılır, yine
     sığmıyorsa hepsi (sınırı bir pencere boyunca gevşetmek, nesnenin
     düşmesinden iyidir). */
  bellekBudama(simdi) {
    if (this.pencereler.size < AYAR.ipBellekTavani) return;
    for (const [ad, k] of this.pencereler) {
      if (simdi - k.bas >= AYAR.ipPencereleri[ad.split('|')[0]].sure) this.pencereler.delete(ad);
    }
    if (this.pencereler.size >= AYAR.ipBellekTavani) this.pencereler.clear();
  }

  /* Kilit ve kayıt sayacı bellekte tutulur, depoya yazılan her değişiklik
     önce bellekte yapılır: denetim ile artırma arasında await olmaz, aynı anda
     gelen yüz deneme de tek tek sayılır (bkz. kilitDene). */
  yukle() {
    this.yuklendi ??= this.depo.get(['kilit', 'kayit']).then((m) => {
      this.kilit = m.get('kilit') || null;
      this.kayit = m.get('kayit') || null;
    }, (e) => { this.yuklendi = null; throw e; });
    return this.yuklendi;
  }

  async yaz(islemler) {
    try { await Promise.all(islemler); }
    catch (e) { this.yuklendi = null; throw e; }
  }

  /**
   * Bir deneme hakkı ister ve denemeyi SONUCU BEKLEMEDEN hata sayar; doğru
   * çıkarsa Worker `kilitSifirla` çağırır. Önce denetleyip sonra saysaydık,
   * paralel gönderilen denemelerin hepsi denetimi sayaç artmadan geçerdi ve
   * 10 hak sınırı dağıtık bir saldırganda hiçbir şey ifade etmezdi.
   *
   * İlk 10 deneme serbest; 10. ve sonrakiler 60 sn × 2^(n−10) kilit bırakır
   * (en çok 1 saat). Kilit yalnız YENİ girişi durdurur: açık oturumlar
   * eşitlemeye devam eder, yani adı bilen biri hekimin çalışan cihazlarını
   * kilitleyemez.
   */
  async kilitDene() {
    await this.yukle();
    const simdi = Date.now();
    const k = this.kilit;
    if (k && k.kilitSonu > simdi) return { kilitli: true, bekle: saniye(k.kilitSonu - simdi) };
    const sayi = (k?.sayi || 0) + 1;
    const kilitSonu = sayi >= AYAR.kilitBedava
      ? simdi + Math.min(AYAR.kilitTavan, AYAR.kilitTaban * 2 ** (sayi - AYAR.kilitBedava)) : 0;
    this.kilit = { sayi, kilitSonu, son: simdi };
    await this.yaz([this.depo.put('kilit', this.kilit), this.depo.setAlarm(simdi + AYAR.kilitTemizlik)]);
    return { kilitli: false };
  }

  async kilitSifirla() {
    this.kilit = null;
    await this.yaz([this.depo.deleteAlarm(), this.depo.delete('kilit')]);
    return { ok: true };
  }

  /* Rastgele adlarla yapılan denemeler kalıcı nesne bırakmasın: 24 saat
     boşta kalan kilit tamamen silinir. */
  async alarm() {
    await this.yukle();
    if (this.kilit && Date.now() - this.kilit.son < AYAR.kilitTemizlik) return this.depo.setAlarm(this.kilit.son + AYAR.kilitTemizlik);
    this.kilit = this.kayit = null;
    return this.depo.deleteAll();
  }

  async genelKayit() {
    await this.yukle();
    const simdi = Date.now();
    const gun = utcGun(simdi);
    const sayi = this.kayit?.gun === gun ? this.kayit.sayi : 0;
    if (sayi >= AYAR.gunlukKayit) return { izin: false, bekle: saniye(gunSonunaKalan(simdi)) };
    this.kayit = { gun, sayi: sayi + 1 };
    await this.yaz([this.depo.put('kayit', this.kayit)]);
    return { izin: true };
  }
}
