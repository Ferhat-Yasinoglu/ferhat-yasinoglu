// FY Reklam'ın tek Durable Object'i (idFromName('reklam')): oturumlar, ortak
// kayıt (kim, ne zaman, hangi ürünü, hangi kanaldan paylaştı) ve Meta'nın
// çekeceği JPEG'ler. Yalnız Worker çağırır; dışarıya açık değil.
//
// Yalnız DO'nun SQLite arayüzüne (`storage.sql.exec(...)` imleci) ve
// WebCrypto'ya dayanır: aynı kod workerd'da, yerel.mjs'in node:sqlite
// taklidinde ve testlerde birebir çalışır. Meta çağrıları burada DEĞİL
// Worker'da (worker.js): DO yalnız kaydı açar ve sonucu yazar.

import {
  ApiHatasi, AYAR, GORSEL_KIMLIGI, JETON_KALIBI, Pencere, bearer, ipAnahtari, jpegMi, jsonYanit, ozetHex, rastgeleJeton,
  rastgeleKimlik, reklamciListesi,
} from './cekirdek.js';

/** CREATE ... IF NOT EXISTS: her açılışta çalışır, ucuz ve tekrarlanabilir. */
const SEMA = [
  `CREATE TABLE IF NOT EXISTS oturumlar (
     ozet TEXT PRIMARY KEY, eposta TEXT NOT NULL, ad TEXT NOT NULL, resim TEXT NOT NULL,
     olusturuldu INTEGER NOT NULL, bitis INTEGER NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS oturumlar_bitis ON oturumlar(bitis)',
  /* Ortak kayıt. durum: yapildi (API'siz kanal) | gonderiliyor | yayinlandi |
     prova | hata. dis_id: Meta'nın verdiği gönderi kimliği (provada 'prova-N').
     hata: Meta hatasının kodu (yeniden_baglan, izin, oran, gorsel, kota…).
     metin_ozet: yayın metninin özeti (tekrar koruması; API'siz kanalda null). */
  `CREATE TABLE IF NOT EXISTS kayitlar (
     id INTEGER PRIMARY KEY AUTOINCREMENT, zaman INTEGER NOT NULL, kim TEXT NOT NULL, urun TEXT NOT NULL,
     kanal TEXT NOT NULL, bicim TEXT NOT NULL, durum TEXT NOT NULL, baslik TEXT NOT NULL, dis_id TEXT, hata TEXT,
     metin_ozet TEXT)`,
  'CREATE INDEX IF NOT EXISTS kayitlar_zaman ON kayitlar(zaman)',
  'CREATE INDEX IF NOT EXISTS kayitlar_tekrar ON kayitlar(kanal, metin_ozet, zaman)',
  /* Meta görseli herkese açık bir adresten çeker; uygulama JPEG'i buraya
     yükler, Worker /g/<id>.jpg olarak verir. 7 gün sonra silinir. */
  `CREATE TABLE IF NOT EXISTS gorseller (
     id TEXT PRIMARY KEY, veri BLOB NOT NULL, boyut INTEGER NOT NULL, olusturuldu INTEGER NOT NULL, kim TEXT NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS gorseller_zaman ON gorseller(olusturuldu)',
];

const YAYIN_DURUMLARI = new Set(['prova', 'yayinlandi', 'hata']);
const oturumHatasi = () => new ApiHatasi(401, 'oturum');
const gecersiz = (alan) => new ApiHatasi(400, 'gecersiz', alan ? { alan } : {});

/** Satır → API'deki kayıt (eksik alanlar null). */
const kayitCikti = (r) => ({
  id: r.id, zaman: r.zaman, kim: r.kim, urun: r.urun, kanal: r.kanal, bicim: r.bicim, durum: r.durum, baslik: r.baslik,
  dis_id: r.dis_id ?? null, hata: r.hata ?? null,
});

/** BLOB olarak bağlanacak ArrayBuffer (görünümün yalnız kendi dilimi). */
const tampon = (b) => (b instanceof Uint8Array ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) : b);

export class ReklamCekirdek {
  constructor(depo, env = {}) {
    this.depo = depo;
    this.sql = depo.sql;
    this.env = env;
    this.basarisiz = new Pencere(AYAR.giris);
    this.reklamciHam = null;
    this.reklamcilar = new Set();
    for (const s of SEMA) this.sql.exec(s);
    /* Sütun sonradan eklendi: tablo bu sütun olmadan açılmışsa eklenir
       (CREATE TABLE IF NOT EXISTS var olan tabloya dokunmaz). */
    const sutunlar = new Set(this.sql.exec('PRAGMA table_info(kayitlar)').toArray().map((r) => r.name));
    if (!sutunlar.has('metin_ozet')) this.sql.exec('ALTER TABLE kayitlar ADD COLUMN metin_ozet TEXT');
  }

  /** REKLAMCILAR secret'ından reklamcı kümesi (secret değişince yeniden okunur). */
  reklamciKumesi() {
    const ham = this.env.REKLAMCILAR || '';
    if (ham !== this.reklamciHam) { this.reklamciHam = ham; this.reklamcilar = reklamciListesi(ham); }
    return this.reklamcilar;
  }

  // giriş ve oturum -----------------------------------------------------------

  /** Bu IP son 15 dakikada 20 kez başarısız olduysa 429: Google jetonu bile denetlenmez. */
  girisKapisi(ip, simdi = Date.now()) {
    const bekle = this.basarisiz.dolu(ipAnahtari(ip), simdi);
    if (bekle) throw new ApiHatasi(429, 'oran', { bekle });
    return { ok: true };
  }

  /** Worker Google jetonunu reddettiğinde (401 kimlik) sayar. */
  girisBasarisiz(ip, simdi = Date.now()) {
    this.basarisiz.say(ipAnahtari(ip), simdi);
    return { ok: true };
  }

  /**
   * Doğrulanmış kimlikle (Google ya da geliştirme girişi) oturum açar.
   * `g`: { eposta, ad, resim, ip }. REKLAMCILAR boşsa kimse giremez (503):
   * yanlış yapılandırma kapıyı açık değil kapalı bırakır. Listede olmayan
   * adres 403 `yetki` ve başarısız sayılır.
   */
  async giris(g) {
    const jeton = rastgeleJeton();
    const ozet = await ozetHex(jeton);
    // --- buradan sonra await yok ---
    const simdi = Date.now();
    this.girisKapisi(g.ip, simdi);
    const reklamcilar = this.reklamciKumesi();
    if (!reklamcilar.size) throw new ApiHatasi(503, 'yapilandirma');
    if (!reklamcilar.has(g.eposta)) {
      this.girisBasarisiz(g.ip, simdi);
      throw new ApiHatasi(403, 'yetki', { eposta: g.eposta });
    }
    this.sql.exec('DELETE FROM oturumlar WHERE bitis < ?', simdi);
    const kullanici = { eposta: g.eposta, ad: g.ad || g.eposta.split('@')[0], resim: g.resim || '' };
    this.sql.exec('INSERT INTO oturumlar (ozet, eposta, ad, resim, olusturuldu, bitis) VALUES (?, ?, ?, ?, ?, ?)',
      ozet, kullanici.eposta, kullanici.ad, kullanici.resim, simdi, simdi + AYAR.oturumOmru);
    return { jeton, kullanici };
  }

  /** Jetonu doğrular; yoksa ya da süresi dolduysa 401 `oturum`. Yönetici listeden çıkarıldıysa da 401. */
  async dogrula(jeton) {
    if (typeof jeton !== 'string' || !JETON_KALIBI.test(jeton)) throw oturumHatasi();
    const ozet = await ozetHex(jeton);
    const simdi = Date.now();
    const o = this.sql.exec('SELECT * FROM oturumlar WHERE ozet = ?', ozet).toArray()[0];
    if (!o) throw oturumHatasi();
    if (o.bitis <= simdi || !this.reklamciKumesi().has(o.eposta)) {
      this.sql.exec('DELETE FROM oturumlar WHERE ozet = ?', ozet);
      throw oturumHatasi();
    }
    return { eposta: o.eposta, ad: o.ad, resim: o.resim, olusturuldu: o.olusturuldu, bitis: o.bitis };
  }

  /** Bilinmeyen ya da zaten kapanmış jeton da `{ ok: true }` alır. */
  async cikis(jeton) {
    if (typeof jeton !== 'string' || !JETON_KALIBI.test(jeton)) return { ok: true };
    this.sql.exec('DELETE FROM oturumlar WHERE ozet = ?', await ozetHex(jeton));
    return { ok: true };
  }

  // ortak kayıt ---------------------------------------------------------------

  kayitOku(id) {
    const r = this.sql.exec('SELECT * FROM kayitlar WHERE id = ?', id).toArray()[0];
    return r ? kayitCikti(r) : null;
  }

  /** Yeniden eskiye, en çok `sinir` (1…500). */
  kayitlar(sinir) {
    const n = Math.min(Math.max(Number(sinir) || AYAR.listeVarsayilan, 1), AYAR.listeSiniri);
    return { kayitlar: this.sql.exec('SELECT * FROM kayitlar ORDER BY id DESC LIMIT ?', n).toArray().map(kayitCikti) };
  }

  /** Kaydı yazar ve döndürür. `g`: { urun, kanal, bicim, baslik, metin_ozet? } (Worker denetledi). */
  kayitEkle(kim, g, durum = 'yapildi', simdi = Date.now()) {
    this.sql.exec('INSERT INTO kayitlar (zaman, kim, urun, kanal, bicim, durum, baslik, dis_id, hata, metin_ozet) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)',
      simdi, kim, g.urun, g.kanal, g.bicim || '', durum, g.baslik || '', g.metin_ozet ?? null);
    const { id } = this.sql.exec('SELECT last_insert_rowid() AS id').one();
    return this.kayitOku(id);
  }

  // görseller -----------------------------------------------------------------

  /** JPEG'i saklar; her yüklemede 7 günden eskiler silinir (alarm gerekmez). Döner `{ id, boyut }`. */
  gorselYukle(kim, baytlar) {
    if (!jpegMi(baytlar)) throw new ApiHatasi(415, 'gorsel_turu');
    if (baytlar.byteLength > AYAR.gorselSiniri) throw new ApiHatasi(413, 'gorsel_buyuk');
    const simdi = Date.now();
    this.sql.exec('DELETE FROM gorseller WHERE olusturuldu < ?', simdi - AYAR.gorselOmru);
    let id = rastgeleKimlik();
    while (this.sql.exec('SELECT 1 FROM gorseller WHERE id = ?', id).toArray().length) id = rastgeleKimlik();
    this.sql.exec('INSERT INTO gorseller (id, veri, boyut, olusturuldu, kim) VALUES (?, ?, ?, ?, ?)', id, tampon(baytlar), baytlar.byteLength, simdi, kim);
    return { id, boyut: baytlar.byteLength };
  }

  /** Görselin baytları (ArrayBuffer) ya da null (yok / 7 günü geçmiş / bozuk kimlik). */
  gorselAl(id) {
    if (typeof id !== 'string' || !GORSEL_KIMLIGI.test(id)) return null;
    const r = this.sql.exec('SELECT veri FROM gorseller WHERE id = ? AND olusturuldu >= ?', id, Date.now() - AYAR.gorselOmru).toArray()[0];
    return r ? r.veri : null;
  }

  // yayınlama -----------------------------------------------------------------

  /**
   * Yayın kaydını açar: görsellerin hepsi burada olmalı (yoksa 422 `gorsel_yok`,
   * eksikler `eksik`te); aynı kanalda son 24 saatte aynı metin 'yayinlandi'
   * olmuşsa 409 `tekrar` (çift tıklama, iki reklamcının aynı gönderiyi
   * paylaşması) — `zorla` geçer; prova ve hata kayıtları sayılmaz, boş metin
   * denetlenmez. Kayıt 'gonderiliyor' durumuyla yazılır; Worker Meta'ya gidip
   * gelince `yayinBitir` sonucu yazar. Yarıda kalan istek kayıtta
   * 'gonderiliyor' olarak görünür — sessizce kaybolmaz.
   */
  yayinHazirla(kim, g) {
    const simdi = Date.now();
    const yer = g.gorseller.map(() => '?').join(', ');
    const varOlan = new Set(this.sql.exec(`SELECT id FROM gorseller WHERE olusturuldu >= ? AND id IN (${yer})`, simdi - AYAR.gorselOmru, ...g.gorseller)
      .toArray().map((r) => r.id));
    const eksik = g.gorseller.filter((id) => !varOlan.has(id));
    if (eksik.length) throw new ApiHatasi(422, 'gorsel_yok', { eksik });
    if (g.metin_ozet && !g.zorla) {
      const onceki = this.sql.exec(
        "SELECT id, zaman FROM kayitlar WHERE kanal = ? AND metin_ozet = ? AND durum = 'yayinlandi' AND zaman >= ? ORDER BY id DESC LIMIT 1",
        g.kanal, g.metin_ozet, simdi - AYAR.tekrarPenceresi,
      ).toArray()[0];
      if (onceki) throw new ApiHatasi(409, 'tekrar', { onceki: { id: onceki.id, zaman: onceki.zaman } });
    }
    return { kayit: this.kayitEkle(kim, g, 'gonderiliyor', simdi) };
  }

  /** `{ id, durum: prova|yayinlandi|hata, dis_id?, hata? }` → güncel kayıt. */
  yayinBitir(v) {
    if (!Number.isInteger(v?.id)) throw gecersiz('id');
    if (!YAYIN_DURUMLARI.has(v.durum)) throw gecersiz('durum');
    this.sql.exec('UPDATE kayitlar SET durum = ?, dis_id = ?, hata = ? WHERE id = ?', v.durum, v.dis_id ?? null, v.hata ?? null, v.id);
    const kayit = this.kayitOku(v.id);
    if (!kayit) throw new ApiHatasi(404, 'yok');
    return { kayit };
  }
}

// --- Durable Object ---------------------------------------------------------

/* DO'nun içinde ApiHatasi JSON yanıta çevrilir (istisna nesnesi DO sınırından
   türüyle geçmez). Diğer istisnalar (depolama) yukarı fırlar; Worker'daki
   sarmalayıcı onları 500 yapar. */
async function icYanit(is) {
  try { return await is(); } catch (e) {
    if (e instanceof ApiHatasi) return jsonYanit({ hata: e.kod, ...e.ek }, e.durum);
    throw e;
  }
}

const kullaniciBilgisi = (o) => ({ eposta: o.eposta, ad: o.ad, resim: o.resim });

/** Her şey burada. Yalnız Worker çağırabilir (DO dışarıya açık değil). */
export class Reklam {
  constructor(ctx, env) {
    this.cekirdek = new ReklamCekirdek(ctx.storage, env);
  }

  fetch(istek) {
    return icYanit(async () => {
      const c = this.cekirdek;
      const jeton = bearer(istek);
      const islem = new URL(istek.url).pathname.slice(1);
      const json = () => istek.json();
      switch (islem) {
        case 'giris/kapi': return jsonYanit(c.girisKapisi((await json()).ip));
        case 'giris/basarisiz': return jsonYanit(c.girisBasarisiz((await json()).ip));
        case 'giris': return jsonYanit(await c.giris(await json()));
        case 'oturum': return jsonYanit({ kullanici: kullaniciBilgisi(await c.dogrula(jeton)) });
        case 'cikis': return jsonYanit(await c.cikis(jeton));
        case 'kayitlar': { await c.dogrula(jeton); return jsonYanit(c.kayitlar((await json()).sinir)); }
        case 'kayit': { const o = await c.dogrula(jeton); return jsonYanit({ kayit: c.kayitEkle(o.eposta, await json()) }); }
        case 'gorsel/yukle': {
          const o = await c.dogrula(jeton);
          return jsonYanit(c.gorselYukle(o.eposta, new Uint8Array(await istek.arrayBuffer())));
        }
        case 'gorsel/al': {
          const veri = c.gorselAl((await json()).id);
          if (!veri) throw new ApiHatasi(404, 'yok');
          return new Response(veri, { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(veri.byteLength) } });
        }
        case 'yayin/hazirla': { const o = await c.dogrula(jeton); return jsonYanit(c.yayinHazirla(o.eposta, await json())); }
        case 'yayin/bitir': return jsonYanit(c.yayinBitir(await json()));
        default: throw new ApiHatasi(404, 'yok');
      }
    });
  }
}
