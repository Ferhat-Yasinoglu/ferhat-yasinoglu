// GitHub Secrets'tan gelen değerleri dağıtımdan önce temizler ve doğrular.
// - Baştaki/sondaki boşlukları ve görünmez karakterleri (zero-width, NBSP) atar.
// - Türkçe klavyenin bozduğu harfleri (ı→i/I, İ→I/i, ş, ğ, ç, ö, ü) olası ASCII karşılıklarıyla
//   dener; hangisinin doğru olduğunu sağlayıcıya (Cloudflare / Telegram) doğrulatır.
// - Sonucu `::add-mask::` ile maskeler ve $GITHUB_ENV'e yazar. Değerler HİÇBİR ZAMAN loga yazılmaz.
// Kullanım (workflow): HAM_<AD> ortam değişkenleri verilir; çıktı <AD> olarak sonraki adımlara geçer.
import { appendFileSync } from 'node:fs';

const GORUNMEZ = /[\u200B-\u200D\uFEFF\u00A0\u2060]/g;
const DEGISIMLER = {
  'ı': ['i', 'I'], 'İ': ['I', 'i'], 'ş': ['s', 'S'], 'Ş': ['S', 's'], 'ğ': ['g', 'G'], 'Ğ': ['G', 'g'],
  'ç': ['c', 'C'], 'Ç': ['C', 'c'], 'ö': ['o', 'O'], 'Ö': ['O', 'o'], 'ü': ['u', 'U'], 'Ü': ['U', 'u'],
};
const ADAY_TAVANI = 64;

export function temizle(deger) { return String(deger ?? '').replace(GORUNMEZ, '').trim(); }

export function sorunlar(deger) {
  const liste = [];
  for (let i = 0; i < deger.length; i++) {
    const kod = deger.charCodeAt(i);
    if (kod < 32 || kod > 126) liste.push({ konum: i, karakter: deger[i] });
  }
  return liste;
}

export function adaylar(deger) {
  const s = sorunlar(deger);
  if (!s.length) return [deger];
  if (s.some((x) => !DEGISIMLER[x.karakter])) return [];
  if (2 ** s.length > ADAY_TAVANI) return [];
  let liste = [deger];
  for (const { konum, karakter } of s) {
    const yeni = [];
    for (const aday of liste) for (const harf of DEGISIMLER[karakter]) yeni.push(aday.slice(0, konum) + harf + aday.slice(konum + 1));
    liste = yeni;
  }
  return liste;
}

const sorunMetni = (s) => s.map((x) => `${x.konum + 1}. karakter '${x.karakter}' (U+${x.karakter.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')})`).join(', ');

// dogrula(aday) → true/false. Dönüş: { durum: 'bos'|'ok'|'duzeltildi'|'duzeltilemez'|'gecersiz', deger, sorun }
export async function duzelt({ ad, deger, dogrula }) {
  const temiz = temizle(deger);
  if (!temiz) return { ad, durum: 'bos', deger: '' };
  const s = sorunlar(temiz);
  const liste = adaylar(temiz);
  if (!liste.length) return { ad, durum: 'duzeltilemez', deger: '', sorun: sorunMetni(s) };
  for (const aday of liste) {
    if (await dogrula(aday)) return { ad, durum: s.length ? 'duzeltildi' : 'ok', deger: aday, sorun: s.length ? sorunMetni(s) : '' };
  }
  return { ad, durum: 'gecersiz', deger: '', sorun: sorunMetni(s) };
}

async function cfDogrula(token) {
  const r = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  return !!(j.success && j.result?.status === 'active');
}
async function tgDogrula(token) {
  const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const j = await r.json().catch(() => ({}));
  return !!j.ok;
}

export const GIRDILER = [
  { ad: 'CLOUDFLARE_API_TOKEN', zorunlu: true, dogrula: cfDogrula, ipucu: 'Cloudflare → My Profile → API Tokens → token\'ı yeniden oluşturup kopyala (Edit Cloudflare Workers şablonu + D1 Edit + Workers AI Edit)' },
  { ad: 'CLOUDFLARE_ACCOUNT_ID', zorunlu: true, dogrula: async (v) => /^[0-9a-fA-F]{32}$/.test(v), ipucu: 'Cloudflare → Workers & Pages sayfasının sağındaki 32 karakterlik Account ID' },
  { ad: 'YONETICI_ANAHTARI', zorunlu: true, dogrula: async (v) => v.length >= 32, ipucu: 'en az 32 karakter, yalnız İngilizce harf ve rakam' },
  { ad: 'TELEGRAM_BOT_TOKEN', zorunlu: false, dogrula: tgDogrula, ipucu: '@BotFather → /mybots → API Token' },
];

export async function calistir({ env = process.env, girdiler = GIRDILER, yaz = console.log } = {}) {
  let hata = 0;
  const cikti = [];
  for (const g of girdiler) {
    const sonuc = await duzelt({ ad: g.ad, deger: env['HAM_' + g.ad], dogrula: g.dogrula });
    if (sonuc.durum === 'bos') {
      if (g.zorunlu) { yaz(`::error::${g.ad} secret'i yok. ${g.ipucu}`); hata++; } else yaz(`${g.ad}: verilmemiş, atlandı`);
      continue;
    }
    if (sonuc.durum === 'ok') yaz(`${g.ad}: ok`);
    else if (sonuc.durum === 'duzeltildi') yaz(`${g.ad}: Türkçe karakter düzeltildi ve doğrulandı (${sonuc.sorun}). GitHub'daki değeri de düzeltmen iyi olur ama şart değil.`);
    else if (sonuc.durum === 'duzeltilemez') { yaz(`::error::${g.ad} içinde düzeltilemeyen karakter var: ${sonuc.sorun}. Değeri yeniden kopyalayıp yapıştır. ${g.ipucu}`); hata++; continue; }
    else { yaz(`::error::${g.ad} doğrulanamadı${sonuc.sorun ? ` (bozuk karakterler: ${sonuc.sorun})` : ''}: sağlayıcı kabul etmedi. ${g.ipucu}`); hata++; continue; }
    cikti.push({ ad: g.ad, deger: sonuc.deger });
  }
  return { hata, cikti };
}

const dogrudan = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (dogrudan) {
  const { hata, cikti } = await calistir();
  const dosya = process.env.GITHUB_ENV;
  for (const { ad, deger } of cikti) {
    console.log(`::add-mask::${deger}`);
    if (dosya) { const sinir = 'SS_' + Math.random().toString(36).slice(2); appendFileSync(dosya, `${ad}<<${sinir}\n${deger}\n${sinir}\n`); }
  }
  if (hata) process.exit(1);
}
