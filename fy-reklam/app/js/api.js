// Sunucuyla konuşma: oturum jetonu, hata biçimi, yayınlama ve kayıt uçları.
// Worker yoksa (yalnız statik yayın) uygulama yine çalışır: giriş istenmez,
// tasarla / metin / indir / paylaş yerelde; yalnız «Yayınla» ve ortak kayıt kapalı.
import { SUNUCU } from './ayar.js';

const OTURUM = 'fyr.oturum';

/** Sunucunun yanıtı hata ise: durum + makinece okunur kod + ek alanlar. */
export class SunucuHatasi extends Error {
  constructor(durum, veri = {}) {
    super(veri.hata || 'ag');
    this.durum = durum;
    this.kod = veri.hata || 'ag';
    this.veri = veri;
  }
}

function oku(anahtar) {
  try { return JSON.parse(localStorage.getItem(anahtar)); } catch { return null; }
}
function yaz(anahtar, deger) {
  try {
    if (deger === null) localStorage.removeItem(anahtar);
    else localStorage.setItem(anahtar, JSON.stringify(deger));
  } catch { /* gizli pencere: oturum yalnız bu sekmede yaşar */ }
}

let oturum = oku(OTURUM);
const dinleyiciler = new Set();
let durumOnbellek = null;

/** Oturum düşünce (401) çağrılır: uygulama giriş ekranına döner. */
export const oturumDusunce = (f) => dinleyiciler.add(f);

export const oturumVar = () => !!oturum?.jeton;
export const kullanici = () => oturum?.kullanici ?? null;

async function gonder(yol, { method = 'GET', govde, jeton, ham } = {}) {
  const basliklar = {};
  if (govde !== undefined && !ham) basliklar['Content-Type'] = 'application/json';
  if (ham) basliklar['Content-Type'] = ham;
  if (jeton) basliklar.Authorization = 'Bearer ' + jeton;
  let r;
  try {
    r = await fetch(SUNUCU + '/v1/' + yol, {
      method, headers: basliklar, cache: 'no-store',
      body: govde === undefined ? undefined : (ham ? govde : JSON.stringify(govde)),
    });
  } catch {
    throw new SunucuHatasi(0, { hata: 'ag' });
  }
  let veri = {};
  try { veri = await r.json(); } catch { veri = {}; }
  if (!r.ok) {
    if (r.status === 401 && jeton) { oturum = null; yaz(OTURUM, null); for (const f of dinleyiciler) f(); }
    throw new SunucuHatasi(r.status, veri);
  }
  return veri;
}

/** Oturumlu istek: jeton yoksa 'oturum' hatası. */
const oturumlu = (yol, sec = {}) => {
  if (!oturum?.jeton) return Promise.reject(new SunucuHatasi(401, { hata: 'oturum' }));
  return gonder(yol, { ...sec, jeton: oturum.jeton });
};

/** GET /v1/durum: sunucu var mı, Google istemcisi, geliştirme kipi, Meta kanalları. 10 sn önbellek. */
export async function durum(taze = false) {
  if (!taze && durumOnbellek && Date.now() - durumOnbellek.zaman < 10_000) return durumOnbellek.veri;
  const veri = await gonder('durum');
  durumOnbellek = { zaman: Date.now(), veri };
  return veri;
}

/** Sunucu adresi var mı (yerelde boş ama aynı köken: var sayılır). */
export const sunucuVar = () => SUNUCU !== '' || ['localhost', '127.0.0.1'].includes(location.hostname);

async function girisBitir(veri) {
  oturum = { jeton: veri.jeton, kullanici: veri.kullanici };
  yaz(OTURUM, oturum);
  return oturum;
}

export const girisGoogle = (kimlik) => gonder('giris', { method: 'POST', govde: { kimlik } }).then(girisBitir);
export const girisGelistirme = (eposta) => gonder('gelistirme/giris', { method: 'POST', govde: { eposta } }).then(girisBitir);

export async function cikis() {
  try { await oturumlu('cikis', { method: 'POST' }); } catch { /* sunucuya ulaşılamadıysa yine çıkılır */ }
  oturum = null;
  yaz(OTURUM, null);
}

/** Ortak kayıt (işlem kaydı): kim, ne zaman, hangi ürün, hangi kanal, sonuç. */
export const kayitlar = (sinir = 100) => oturumlu(`kayit?sinir=${sinir}`);
export const kayitYaz = (k) => oturumlu('kayit', { method: 'POST', govde: k });

/** JPEG'i Worker'a yükler; döner { id, adres } — adres herkese açık (Meta oradan çeker). */
export const gorselYukle = (blob) => oturumlu('gorsel', { method: 'POST', govde: blob, ham: 'image/jpeg' });

/** Yayınla: kanal 'instagram' | 'facebook'; gorsel id'leri (1 ya da 2–10: carousel), metin. */
export const yayinla = (govde) => oturumlu('yayinla', { method: 'POST', govde });

/** Meta kanallarının durumu (bağlı mı, PROVA mı, günlük kota). */
export const kanallar = () => oturumlu('kanallar');
