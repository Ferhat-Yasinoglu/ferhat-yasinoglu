#!/usr/bin/env node
// Yerel sunucu: `node sunucu/yerel.mjs [port] [--gelistirme]`.
//
// Uygulamayı (../app) statik olarak VE hesap API'sini (/v1/) AYNI kökenden
// sunar. Worker kodu (worker.js) değiştirilmeden çalışır; Durable Object'lerin
// yerine bellekte duran bir ad alanı taklidi geçer. Tarayıcı denemesi
// (tools/tarayici.mjs) ve geliştirme bunu kullanır; birim testleri de aynı
// taklidi içe aktarır. Veri süreç kapanınca gider — kalıcı bir şey yok.
//
//   port         argüman ya da PORT ortam değişkeni (varsayılan 8788)
//   --gelistirme localhost/127.0.0.1 kökenlerine CORS izni (başka porttaki bir
//                geliştirme sayfası için; aynı kökende gerekmez)
//   DAVET_KODU   ortam değişkeni; yoksa kayıt kapalıdır (403 kayit_kapali),
//                yayındaki sunucuyla aynı kural.
//
// İstemci IP'si SOKETTEN alınır: istekle gelen CF-Connecting-IP silinir.
// Cloudflare'de o başlığı Cloudflare yazar; burada istemci yazabilirdi ve
// IP sınırı taklit edilebilirdi.
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import worker, { Hesap, Sinir } from './worker.js';
import { statikSun } from '../tools/sun.mjs';

/* SQLite tabanlı DO'nun sınırları: anahtar + değer en çok 2 MB, bir put/get/
   delete çağrısında en çok 128 anahtar. Taklit bunları gerçekten uygular ki
   sınırı aşan bir kod burada da patlasın, ilk kez yayında değil. */
const DEGER_SINIRI = 2_000_000;
const ANAHTAR_SINIRI = 128;

const boyut = (d) => (ArrayBuffer.isView(d) || d instanceof ArrayBuffer ? d.byteLength : JSON.stringify(d ?? null).length);
function sayiDenetle(anahtarlar) {
  if (anahtarlar.length > ANAHTAR_SINIRI) throw new Error(`tek çağrıda en çok ${ANAHTAR_SINIRI} anahtar`);
}

/** DO KV depolamasının bellek taklidi. Değerler yazılırken ve okunurken
 *  kopyalanır (gerçek depo da serileştirir): bir nesneyi yazdıktan sonra
 *  değiştirmek depodakini değiştirmez. */
class BellekDepolama {
  #veri = new Map();
  #alarm = null;
  #zamanlayici = null;
  #alarmCagir;

  constructor(alarmCagir = () => {}) { this.#alarmCagir = alarmCagir; }

  async get(a) {
    if (!Array.isArray(a)) return structuredClone(this.#veri.get(a));
    sayiDenetle(a);
    const m = new Map();
    for (const k of a) if (this.#veri.has(k)) m.set(k, structuredClone(this.#veri.get(k)));
    return m;
  }

  async put(a, d) {
    const girdiler = typeof a === 'string' ? { [a]: d } : a;
    const liste = Object.entries(girdiler);
    sayiDenetle(liste);
    // Hepsi önce denetlenir, sonra yazılır: gerçek put(entries) gibi ya hep ya hiç.
    for (const [k, v] of liste) if (k.length + boyut(v) > DEGER_SINIRI) throw new Error(`değer çok büyük: ${k}`);
    for (const [k, v] of liste) this.#veri.set(k, structuredClone(v));
  }

  async delete(a) {
    if (!Array.isArray(a)) return this.#veri.delete(a);
    sayiDenetle(a);
    return a.filter((k) => this.#veri.delete(k)).length;
  }

  async list({ prefix = '' } = {}) {
    const m = new Map();
    for (const k of [...this.#veri.keys()].sort()) if (k.startsWith(prefix)) m.set(k, structuredClone(this.#veri.get(k)));
    return m;
  }

  async deleteAll() { this.#veri.clear(); }

  async setAlarm(t) {
    await this.deleteAlarm();
    this.#alarm = Number(t);
    this.#zamanlayici = setTimeout(() => { this.#alarm = null; this.#alarmCagir(); }, Math.max(0, this.#alarm - Date.now()));
    this.#zamanlayici.unref?.();
  }

  async deleteAlarm() {
    clearTimeout(this.#zamanlayici);
    this.#alarm = null;
  }
}

/** DO ad alanı taklidi: `idFromName` + `get(id).fetch(...)`. Her ad için tek
 *  nesne, ilk istekte kurulur. `nesneler` testlerin içeriye bakabilmesi için. */
function bellekAdAlani(Sinif, env) {
  const nesneler = new Map();
  const nesne = (ad) => {
    if (!nesneler.has(ad)) {
      const storage = new BellekDepolama(() => nesneler.get(ad).alarm?.());
      nesneler.set(ad, new Sinif({ id: { name: ad }, storage }, env));
    }
    return nesneler.get(ad);
  };
  return {
    nesneler,
    idFromName: (ad) => ({ name: String(ad), toString: () => String(ad) }),
    get: (id) => ({
      fetch: (girdi, ayar) => nesne(id.name).fetch(girdi instanceof Request && !ayar ? girdi : new Request(girdi, ayar)),
    }),
  };
}

/** Worker'ın `env`'i: iki DO bağı + değişkenler. */
export function bellekOrtami(degiskenler = {}) {
  const env = { IZINLI_KOKENLER: 'https://ferhat-yasinoglu.github.io', ...degiskenler };
  env.HESAP = bellekAdAlani(Hesap, env);
  env.SINIR = bellekAdAlani(Sinir, env);
  return env;
}

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

function yerelSunucu({ gelistirme = false, davet = '' } = {}) {
  const env = bellekOrtami({ DAVET_KODU: davet, GELISTIRME: gelistirme ? '1' : '' });
  const kok = fileURLToPath(new URL('../app/', import.meta.url));
  return createServer((istek, yanit) => {
    if (!new URL(istek.url, 'http://x').pathname.startsWith('/v1/')) return statikSun(kok, istek, yanit);
    apiSun(env, istek, yanit).catch(() => {
      // worker.fetch hatayı kendisi yanıta çeviriyor; buraya ancak soket koparsa düşülür.
      if (!yanit.headersSent) yanit.writeHead(500);
      yanit.end();
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argumanlar = process.argv.slice(2);
  const port = Number(argumanlar.find((a) => /^\d+$/.test(a)) || process.env.PORT || 8788);
  const gelistirme = argumanlar.includes('--gelistirme');
  yerelSunucu({ gelistirme, davet: process.env.DAVET_KODU || '' })
    .listen(port, () => console.log(`sunuluyor: http://localhost:${port}/  (uygulama + /v1/ API${gelistirme ? ', geliştirme CORS' : ''})`));
}
