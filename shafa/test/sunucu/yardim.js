// Sunucu testlerinin ortak kurulumu: Worker'ın kendisi (worker.js) bellekteki
// DO taklidiyle (yerel.mjs) çalıştırılır; istekler gerçek Request/Response.
// Anahtarlar burada rastgele baytlar: sunucu onların parola ya da kurtarma
// kodundan nasıl türetildiğini bilmez, bilmesi de gerekmez.
import worker from '../../sunucu/worker.js';
import { bellekOrtami } from '../../sunucu/yerel.mjs';
import { b64urlYaz } from '../../sunucu/cekirdek.js';

export const KOKEN = 'https://ferhat-yasinoglu.github.io';
export const DAVET = 'Kabul-Bahar';

const rastgele = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
const b64 = (b) => btoa(String.fromCharCode(...b));
export const anahtar = () => b64urlYaz(rastgele(32));
export const sarili = () => ({ iv: b64(rastgele(12)), veri: b64(rastgele(40)) });

/** Kasa gibi başlayan, içi belirli bir desenle dolu gövde (bütünlük denetimi için). */
export function kasaGovdesi(boy, tohum = 0) {
  const onek = new TextEncoder().encode('{"bicim":"shafa-kasa","surum":2,"veri":"');
  const b = new Uint8Array(boy);
  for (let i = 0; i < boy; i++) b[i] = 65 + ((i * 7 + tohum) % 26);
  b.set(onek.subarray(0, Math.min(onek.length, boy)));
  return b;
}

export function kur(degiskenler = { DAVET_KODU: DAVET }) {
  const env = bellekOrtami(degiskenler);
  /** Worker'a tek istek. `govde` nesneyse JSON'a çevrilir. */
  const iste = (yol, { method = 'GET', govde, jeton, ip = '203.0.113.7', koken = KOKEN, basliklar = {} } = {}) => {
    const h = new Headers(basliklar);
    if (koken) h.set('Origin', koken);
    if (ip) h.set('CF-Connecting-IP', ip);
    if (jeton) h.set('Authorization', 'Bearer ' + jeton);
    let body = govde;
    if (govde && !(govde instanceof Uint8Array) && !(govde instanceof ReadableStream) && typeof govde !== 'string') {
      body = JSON.stringify(govde);
      h.set('Content-Type', 'application/json');
    }
    return worker.fetch(new Request('https://shafa-sunucu.test/v1/' + yol, { method, headers: h, body, duplex: 'half' }), env);
  };
  const jsonIste = async (yol, secenek) => {
    const r = await iste(yol, secenek);
    return { durum: r.status, veri: r.status === 204 ? null : await r.json(), r };
  };
  /** Hesap açar; sonraki adımlarda kullanılacak her şeyi döndürür. */
  const hesapAc = async (kullanici = 'dr.nemuna', ek = {}) => {
    const h = { kullanici, giris: anahtar(), kurtarma: anahtar(), sarili: sarili(), kurtarmaSarili: sarili() };
    const r = await jsonIste('kayit', { method: 'POST', govde: { ...h, davet: DAVET }, ...ek });
    if (r.durum !== 201) throw new Error('hesap açılamadı: ' + JSON.stringify(r.veri));
    return { ...h, jeton: r.veri.jeton };
  };
  /** Bir DO nesnesinin deposundaki bütün anahtarlar. */
  const depoAnahtarlari = async (ad, alan = 'HESAP') => {
    const n = env[alan].nesneler.get(ad);
    return n ? [...(await n.cekirdek.depo.list()).keys()] : [];
  };
  return { env, iste, jsonIste, hesapAc, depoAnahtarlari };
}
