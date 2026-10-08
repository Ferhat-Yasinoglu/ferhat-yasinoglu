#!/usr/bin/env node
// Yerel sunucu: `node sunucu/yerel.mjs [port] [--gelistirme]` (FY Reklam uygulaması + API).
//
// Uygulamayı (../app) statik olarak VE API'yi (/v1/, /g/) AYNI kökenden sunar.
// Worker kodu (worker.js) değiştirilmeden çalışır; Durable Object'in yerine
// bellekte duran tek bir Reklam örneği geçer ve onun `ctx.storage.sql`'i
// Node'un SQLite'ı (node:sqlite, ':memory:') üstünde. Birim testleri de aynı
// taklidi içe aktarır (bellekOrtami). Veri süreç kapanınca gider.
//
//   port          argüman ya da PORT ortam değişkeni (varsayılan 8796)
//   --gelistirme  GELISTIRME=1: Google'sız giriş (/v1/gelistirme/giris), localhost
//                 kökenlerine CORS izni, REKLAMCILAR varsayılanı, PROVA=1.
//                 GELISTIRME=1 ortam değişkeni de aynı işi görür.
//   REKLAMCILAR   giriş yapabilen e-postalar (virgülle); geliştirmede varsayılan aşağıda
//   GOOGLE_ISTEMCI_KIMLIGI  verilirse gerçek "Google ile giriş" de yerelde çalışır
//   PROVA         varsayılan 1. 0 + META_* değişkenleriyle gerçek Meta çağrısı denenebilir
//                 (ama Meta localhost'taki görseli çekemez; yalnız hata yollarını görmek için).
//   HOST          dinlenen adres (varsayılan 127.0.0.1: yalnız bu bilgisayar;
//                 aynı ağdaki biri geliştirme girişini kullanamasın). Telefonda
//                 denemek için bilerek HOST=0.0.0.0 verilir.
//
// İstemci IP'si SOKETTEN alınır: istekle gelen CF-Connecting-IP silinir.
// Cloudflare'de o başlığı Cloudflare yazar; burada istemci yazabilirdi ve
// IP sınırı taklit edilebilirdi.
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import worker, { Reklam } from './worker.js';
import { statikSun } from '../tools/sun.mjs';

/* node:sqlite Node 22'de hâlâ "deneysel" uyarısı basıyor; sunucunun her
   açılışında görünen bu satır gürültüden ibaret, yalnız o susturulur. */
async function sqliteYukle() {
  const asil = process.emitWarning;
  process.emitWarning = (uyari, ...a) => (/sqlite/i.test(String(uyari?.message ?? uyari)) ? undefined : asil.call(process, uyari, ...a));
  try { return await import('node:sqlite'); } finally { process.emitWarning = asil; }
}
const { DatabaseSync } = await sqliteYukle();

// --- ctx.storage.sql taklidi --------------------------------------------------

function baglanabilir(d) {
  if (d === null || typeof d === 'number' || typeof d === 'string' || typeof d === 'bigint') return d;
  if (d instanceof ArrayBuffer) return new Uint8Array(d);
  if (ArrayBuffer.isView(d)) return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
  // Gerçek API de undefined/boolean/nesne bağlamaz.
  throw new TypeError(`SQL'e bağlanamayan değer: ${typeof d}`);
}

/** Gerçek API BLOB'u ArrayBuffer verir; node:sqlite Uint8Array. Satır kopyalanırken çevrilir. */
const satirKopyala = (r) => {
  const k = {};
  for (const [a, d] of Object.entries(r)) k[a] = d instanceof Uint8Array ? d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) : d;
  return k;
};

/** `sql.exec()` imleci: yineleyici, next(), toArray(), one(), raw(), columnNames, rowsRead, rowsWritten. */
class SqlImleci {
  #satirlar;
  #i = 0;

  constructor(satirlar, sutunlar, yazilan) {
    this.#satirlar = satirlar;
    this.columnNames = sutunlar;
    this.rowsRead = satirlar.length;
    this.rowsWritten = yazilan;
  }

  next() {
    return this.#i < this.#satirlar.length ? { done: false, value: this.#satirlar[this.#i++] } : { done: true, value: undefined };
  }

  [Symbol.iterator]() { return this; }

  toArray() {
    const kalan = this.#satirlar.slice(this.#i);
    this.#i = this.#satirlar.length;
    return kalan;
  }

  one() {
    const kalan = this.toArray();
    if (kalan.length !== 1) throw new Error(`Expected exactly one result from SQL query, but got ${kalan.length ? 'multiple' : 'no'} results.`);
    return kalan[0];
  }

  * raw() {
    for (let r = this.next(); !r.done; r = this.next()) yield Object.values(r.value);
  }
}

class SqlDepolama {
  #vt = new DatabaseSync(':memory:');
  #degisiklik = this.#vt.prepare('SELECT total_changes() AS n');

  #toplam() { return this.#degisiklik.get().n; }

  /**
   * Tek ifade + bağlanan değerler → imleç. Bağlama sayısı '?' sayısını
   * tutmazsa gerçek API gibi hata (yalnız çıplak '?' kullanıldığında sayılır).
   */
  exec(sorgu, ...baglar) {
    if (typeof sorgu !== 'string' || !sorgu.trim()) throw new TypeError('sorgu metin olmalı');
    if (!/\?\d|[:@$][A-Za-z_]/.test(sorgu)) {
      const yer = (sorgu.replace(/'[^']*'/g, '').match(/\?/g) || []).length;
      if (yer !== baglar.length) throw new Error(`Wrong number of parameter bindings for SQL query (beklenen ${yer}, verilen ${baglar.length})`);
    }
    const degerler = baglar.map(baglanabilir);
    const once = this.#toplam();
    const ifade = this.#vt.prepare(sorgu);
    const satirlar = ifade.all(...degerler).map(satirKopyala);
    const sutunlar = typeof ifade.columns === 'function' ? ifade.columns().map((c) => c.name) : Object.keys(satirlar[0] || {});
    return new SqlImleci(satirlar, sutunlar, this.#toplam() - once);
  }

  /** Veritabanının bayt boyu (gerçek API'deki gibi salt okunur özellik). */
  get databaseSize() {
    const s = this.#vt.prepare('PRAGMA page_count').get().page_count;
    return s * this.#vt.prepare('PRAGMA page_size').get().page_size;
  }

  hamCalistir(sorgu) { this.#vt.exec(sorgu); }
}

/** SQLite tabanlı DO'nun `ctx.storage`ı: `sql` + sade bir `transactionSync`. */
export function sqliteDepolama() {
  const sql = new SqlDepolama();
  return {
    sql,
    transactionSync(is) {
      sql.hamCalistir('BEGIN');
      let sonuc;
      try { sonuc = is(); } catch (e) { sql.hamCalistir('ROLLBACK'); throw e; }
      sql.hamCalistir('COMMIT');
      return sonuc;
    },
  };
}

// --- DO ad alanı taklidi ------------------------------------------------------

/** `idFromName` + `get(id).fetch(...)`. Her ad için tek nesne, ilk istekte kurulur.
 *  `nesne(ad)` testlerin içeriye bakabilmesi için. */
function bellekAdAlani(Sinif, env) {
  const nesneler = new Map();
  const nesne = (ad) => {
    if (!nesneler.has(ad)) nesneler.set(ad, new Sinif({ id: { name: ad, toString: () => ad }, storage: sqliteDepolama() }, env));
    return nesneler.get(ad);
  };
  return {
    nesneler,
    nesne,
    idFromName: (ad) => ({ name: String(ad), toString: () => String(ad) }),
    get: (id) => ({
      fetch: (girdi, ayar) => nesne(id.name).fetch(girdi instanceof Request && !ayar ? girdi : new Request(girdi, ayar)),
    }),
  };
}

/** Worker'ın `env`'i: DO bağı + değişkenler (toml'daki varsayılanlarla). */
export function bellekOrtami(degiskenler = {}) {
  const env = { IZINLI_KOKENLER: 'https://fy-reklam.pages.dev', GOOGLE_ISTEMCI_KIMLIGI: '', PROVA: '1', GRAPH_SURUM: 'v26.0', ...degiskenler };
  env.REKLAM = bellekAdAlani(Reklam, env);
  return env;
}

export const ORNEK_REKLAMCILAR = 'sahip@ornek.af,arkadas@ornek.af';

// --- HTTP ---------------------------------------------------------------------

/** Node isteğini Worker'a verir, yanıtı geri yazar. */
async function apiSun(env, istek, yanit) {
  const basliklar = new Headers();
  for (const [ad, deger] of Object.entries(istek.headers)) {
    if (ad === 'cf-connecting-ip') continue;
    for (const d of [].concat(deger)) basliklar.append(ad, d);
  }
  basliklar.set('CF-Connecting-IP', istek.socket.remoteAddress || '');
  const govdeli = !['GET', 'HEAD', 'OPTIONS'].includes(istek.method);
  const r = await worker.fetch(new Request(`http://${istek.headers.host || 'localhost'}${istek.url}`, {
    method: istek.method, headers: basliklar, body: govdeli ? Readable.toWeb(istek) : undefined, duplex: 'half',
  }), env);
  yanit.writeHead(r.status, Object.fromEntries(r.headers));
  if (r.body) for await (const p of r.body) yanit.write(p);
  yanit.end();
}

/**
 * HTTP sunucusu (dinlemeye başlamamış). `ortam` Worker'ın env'i. Geliştirmede
 * reklamcı verilmezse ORNEK_REKLAMCILAR. META_* ve PROVA ortam değişkenleri
 * olduğu gibi geçer (varsayılan PROVA=1).
 */
export function yerelSunucu({ gelistirme = false, reklamcilar, istemciKimligi = '', degiskenler = {} } = {}) {
  const env = bellekOrtami({
    GELISTIRME: gelistirme ? '1' : '',
    GOOGLE_ISTEMCI_KIMLIGI: istemciKimligi,
    REKLAMCILAR: reklamcilar || (gelistirme ? ORNEK_REKLAMCILAR : ''),
    ...degiskenler,
  });
  const kok = fileURLToPath(new URL('../app/', import.meta.url));
  const sunucu = createServer((istek, yanit) => {
    const yol = new URL(istek.url, 'http://x').pathname;
    // Worker'ın yolları: API, herkese açık görseller ve Meta çekicisine izin veren robots.txt.
    const api = yol.startsWith('/v1/') || yol.startsWith('/g/') || yol === '/robots.txt';
    // Yakalanmayan bir red Node'da süreci kapatır; tek bir bozuk istek sunucuyu düşürmesin.
    (api ? apiSun(env, istek, yanit) : statikSun(kok, istek, yanit)).catch(() => {
      if (!yanit.headersSent) yanit.writeHead(500);
      yanit.end();
    });
  });
  return Object.assign(sunucu, { ortam: env });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argumanlar = process.argv.slice(2);
  const port = Number(argumanlar.find((a) => /^\d+$/.test(a)) || process.env.PORT || 8796);
  const gelistirme = argumanlar.includes('--gelistirme') || process.env.GELISTIRME === '1';
  const host = process.env.HOST || '127.0.0.1';
  const degiskenler = { PROVA: process.env.PROVA || '1' };
  for (const a of ['META_SAYFA_TOKEN', 'META_SAYFA_ID', 'META_IG_ID', 'META_IG_TOKEN', 'META_KULLANICI_TOKEN', 'META_APP_SECRET', 'GRAPH_SURUM']) {
    if (process.env[a]) degiskenler[a] = process.env[a];
  }
  const sunucu = yerelSunucu({ gelistirme, reklamcilar: process.env.REKLAMCILAR || '', istemciKimligi: process.env.GOOGLE_ISTEMCI_KIMLIGI || '', degiskenler });
  sunucu.listen(port, host, () => {
    console.log(`sunuluyor: http://localhost:${port}/  (uygulama + /v1/ API${gelistirme ? ', GELİŞTİRME' : ''}, PROVA=${degiskenler.PROVA}, ${host})`);
    if (gelistirme) {
      console.log(`  reklamcı: ${sunucu.ortam.REKLAMCILAR}`);
      console.log('  giriş: POST /v1/gelistirme/giris {"eposta": "sahip@ornek.af"}  →  Authorization: Bearer <jeton>');
    }
  });
}
