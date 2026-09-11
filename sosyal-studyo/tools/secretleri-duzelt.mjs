// GitHub Secrets'tan gelen değerleri dağıtımdan önce temizler ve doğrular.
// - Baştaki/sondaki boşlukları ve görünmez karakterleri (zero-width, NBSP) atar.
// - Gerçek değer yerine açıklama metni yapıştırılmışsa ("1. adımdaki token") bunu söyler.
// - Beklenen biçime uymayan değeri (32 hex, 40 karakter token, 123:AAH… bot token'ı) biçimiyle açıklar.
// - Türkçe klavyenin bozduğu harfleri (ı→i/I, İ→I/i, ş, ğ, ç, ö, ü) olası ASCII karşılıklarıyla
//   dener; hangisinin doğru olduğunu sağlayıcıya (Cloudflare / Telegram) doğrulatır.
// - Sonucu `::add-mask::` ile maskeler ve $GITHUB_ENV'e yazar. Değerler HİÇBİR ZAMAN loga yazılmaz.
// Kullanım (workflow): HAM_<AD> ortam değişkenleri verilir; çıktı <AD> olarak sonraki adımlara geçer.
import { appendFileSync } from 'node:fs';

const GORUNMEZ = /[\u200B-\u200D\uFEFF\u00A0\u2060]/g;
const SABLON_METNI = /ad[ıi]mdaki|buraya|yap[ıi][şs]t[ıi]r|<[^>]+>/i;
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

// dogrula(aday) → true/false; bicim: beklenen biçim (RegExp, isteğe bağlı).
// Dönüş: { durum: 'bos'|'sablon'|'ok'|'duzeltildi'|'duzeltilemez'|'bicim'|'gecersiz', deger, sorun }
export async function duzelt({ ad, deger, dogrula, bicim }) {
  const temiz = temizle(deger);
  if (!temiz) return { ad, durum: 'bos', deger: '' };
  if (SABLON_METNI.test(temiz)) return { ad, durum: 'sablon', deger: '' };
  const s = sorunlar(temiz);
  const liste = adaylar(temiz);
  if (!liste.length) return { ad, durum: 'duzeltilemez', deger: '', sorun: sorunMetni(s) };
  const uygun = bicim ? liste.filter((a) => bicim.test(a)) : liste;
  if (!uygun.length) return { ad, durum: 'bicim', deger: '', sorun: sorunMetni(s), uzunluk: temiz.length };
  for (const aday of uygun) {
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
  { ad: 'CLOUDFLARE_API_TOKEN', zorunlu: true, dogrula: cfDogrula, bicim: /^[A-Za-z0-9_-]{40}$/, beklenen: '40 karakter; yalnız İngilizce harf, rakam, _ ve -', ipucu: 'Cloudflare → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" şablonu + D1 Edit + Workers AI Edit → çıkan token\'ı kopyala' },
  { ad: 'CLOUDFLARE_ACCOUNT_ID', zorunlu: true, dogrula: async () => true, bicim: /^[0-9a-fA-F]{32}$/, beklenen: '32 karakter; yalnız 0-9 ve a-f', ipucu: 'Cloudflare → Workers & Pages sayfasının sağındaki Account ID' },
  { ad: 'YONETICI_ANAHTARI', zorunlu: true, dogrula: async () => true, bicim: /^[\x21-\x7E]{32,}$/, beklenen: 'en az 32 karakter; İngilizce harf ve rakam', ipucu: 'kendin uydur ya da verilen anahtarı kullan; aynısını uygulamada Ayarlar → Worker\'a gireceksin' },
  { ad: 'TELEGRAM_BOT_TOKEN', zorunlu: false, dogrula: tgDogrula, bicim: /^\d{8,12}:[A-Za-z0-9_-]{30,}$/, beklenen: '123456789:AAH... biçiminde, iki nokta üst üste içerir', ipucu: 'Telegram → @BotFather → /newbot (ya da /mybots → API Token)' },
];

export async function calistir({ env = process.env, girdiler = GIRDILER, yaz = console.log } = {}) {
  let hata = 0;
  const cikti = [];
  for (const g of girdiler) {
    const sonuc = await duzelt({ ad: g.ad, deger: env['HAM_' + g.ad], dogrula: g.dogrula, bicim: g.bicim });
    switch (sonuc.durum) {
      case 'bos':
        if (g.zorunlu) { yaz(`::error::${g.ad} secret'i yok. Nereden: ${g.ipucu}`); hata++; } else yaz(`${g.ad}: verilmemiş, atlandı`);
        continue;
      case 'sablon':
        yaz(`::error::${g.ad}: gerçek değer yerine açıklama metni yazılmış ("1. adımdaki token" gibi). GitHub'da bu secret'i güncelle. Beklenen: ${g.beklenen}. Nereden: ${g.ipucu}`); hata++; continue;
      case 'duzeltilemez':
        yaz(`::error::${g.ad} içinde düzeltilemeyen karakter var: ${sonuc.sorun}. Değeri yeniden kopyalayıp yapıştır. Nereden: ${g.ipucu}`); hata++; continue;
      case 'bicim':
        yaz(`::error::${g.ad} beklenen biçimde değil (girilen ${sonuc.uzunluk} karakter${sonuc.sorun ? `, bozuk: ${sonuc.sorun}` : ''}). Beklenen: ${g.beklenen}. Nereden: ${g.ipucu}`); hata++; continue;
      case 'gecersiz':
        yaz(`::error::${g.ad} biçimi doğru ama sağlayıcı kabul etmedi${sonuc.sorun ? ` (bozuk karakterler: ${sonuc.sorun})` : ''}: süresi dolmuş, silinmiş ya da izinleri eksik olabilir. Nereden: ${g.ipucu}`); hata++; continue;
      case 'duzeltildi':
        yaz(`${g.ad}: Türkçe karakter düzeltildi ve doğrulandı (${sonuc.sorun}). GitHub'daki değeri de düzeltmen iyi olur ama şart değil.`); break;
      default:
        yaz(`${g.ad}: ok`);
    }
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
