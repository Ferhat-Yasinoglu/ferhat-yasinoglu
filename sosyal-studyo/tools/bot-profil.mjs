#!/usr/bin/env node
// Telegram botunun profilini worker/hazir/shafa-bot-profil.json'dan kurar: ad, kısa açıklama
// (profil ve paylaşım kartı), açıklama (boş sohbette "Bu bot ne yapar?") ve profil resmi.
//
// Her dil için önce mevcut değer okunur, yalnız farklıysa yazılır: setMyName sıkı sınırlıdır
// ve her dağıtımda aynı değeri yeniden göndermek 429 getirir. Profil resmi Telegram'da
// karşılaştırılamaz (her yükleme yeni bir resimdir); bu yüzden yalnız botun hiç resmi yoksa
// ya da BOT_FOTO_YENILE=true verilirse yüklenir.
//
// Ortam: TELEGRAM_BOT_TOKEN, BOT_FOTO_YENILE (isteğe bağlı), BOT_PROFIL_DOSYASI (isteğe bağlı),
// GITHUB_STEP_SUMMARY. Bağımlılık yok; token hiçbir çıktıya düşmez.
import { readFileSync, appendFileSync } from 'node:fs';

export const VARSAYILAN_PROFIL = new URL('../worker/hazir/shafa-bot-profil.json', import.meta.url);
const SINIR = { ad: 64, kisa: 120, uzun: 512 };

/** Dosyayı denetler: her dilde üç metin dolu ve Telegram sınırlarının içinde. */
export function profilHazirla(veri) {
  const diller = veri && veri.diller;
  if (!diller || !Object.keys(diller).length) throw new Error('profil dosyasında diller yok');
  if (!('' in diller)) throw new Error("profil dosyasında varsayılan dil ('') yok");
  for (const [dil, p] of Object.entries(diller)) {
    for (const [alan, sinir] of Object.entries(SINIR)) {
      const metin = String(p?.[alan] ?? '');
      if (!metin.trim()) throw new Error(`${dil || 'varsayılan'}: ${alan} boş`);
      if (metin.length > sinir) throw new Error(`${dil || 'varsayılan'}: ${alan} ${metin.length} karakter; sınır ${sinir}`);
    }
  }
  return { diller, foto: veri.foto || '' };
}

/** Telegram çağrıcısı. JSON gövde ya da (resim için) FormData. */
function istemci(token, fetchFn) {
  return async (yontem, govde = {}) => {
    const form = typeof FormData !== 'undefined' && govde instanceof FormData;
    const r = await fetchFn(`https://api.telegram.org/bot${token}/${yontem}`, form
      ? { method: 'POST', body: govde }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(`${yontem}: ${j.description || 'HTTP ' + r.status}`);
    return j.result;
  };
}

const ALANLAR = [
  { alan: 'ad', oku: 'getMyName', yaz: 'setMyName', anahtar: 'name' },
  { alan: 'kisa', oku: 'getMyShortDescription', yaz: 'setMyShortDescription', anahtar: 'short_description' },
  { alan: 'uzun', oku: 'getMyDescription', yaz: 'setMyDescription', anahtar: 'description' },
];

/** Profili uygular; ne yapıldığını satır satır döner. Hata atmaz, hataları rapora yazar. */
export async function profilUygula({ token, profil, fotoBayt, fotoYenile = false, fetchFn = fetch }) {
  const tg = istemci(token, fetchFn);
  const rapor = { satirlar: [], hatalar: [] };
  for (const [dil, p] of Object.entries(profil.diller)) {
    const lc = dil ? { language_code: dil } : {};
    const etiket = dil || 'varsayılan';
    for (const a of ALANLAR) {
      try {
        const mevcut = (await tg(a.oku, lc))?.[a.anahtar] ?? '';
        if (mevcut === p[a.alan]) { rapor.satirlar.push(`· ${etiket} ${a.alan}: aynı`); continue; }
        await tg(a.yaz, { [a.anahtar]: p[a.alan], ...lc });
        rapor.satirlar.push(`✓ ${etiket} ${a.alan}: yazıldı`);
      } catch (e) { rapor.hatalar.push(`${etiket} ${a.alan}: ${e.message}`); }
    }
  }
  if (!fotoBayt) return rapor;
  try {
    const ben = await tg('getMe');
    const resimVar = (await tg('getUserProfilePhotos', { user_id: ben.id, limit: 1 }))?.total_count > 0;
    if (resimVar && !fotoYenile) rapor.satirlar.push('· profil resmi: zaten var (yenilemek için bot_foto seç)');
    else {
      const form = new FormData();
      form.append('photo', JSON.stringify({ type: 'static', photo: 'attach://foto' }));
      form.append('foto', new Blob([fotoBayt], { type: 'image/jpeg' }), 'shafa-bot.jpg');
      await tg('setMyProfilePhoto', form);
      rapor.satirlar.push(`✓ profil resmi: ${resimVar ? 'yenilendi' : 'yüklendi'}`);
    }
  } catch (e) { rapor.hatalar.push('profil resmi: ' + e.message); }
  return rapor;
}

export async function calistir({ env = process.env, fetchFn = fetch, yaz = (s) => console.log(s) } = {}) {
  const token = env.TELEGRAM_BOT_TOKEN || '';
  const gizle = (s) => (token ? String(s).split(token).join('***') : String(s));
  if (!token) { yaz('::error::TELEGRAM_BOT_TOKEN yok'); return 1; }
  let profil, fotoBayt = null;
  try {
    const yol = env.BOT_PROFIL_DOSYASI ? new URL(env.BOT_PROFIL_DOSYASI, `file://${process.cwd()}/`) : VARSAYILAN_PROFIL;
    profil = profilHazirla(JSON.parse(readFileSync(yol, 'utf8')));
    if (profil.foto) fotoBayt = readFileSync(new URL(profil.foto, yol));
  } catch (e) { yaz('::error::profil dosyası: ' + e.message); return 1; }
  const rapor = await profilUygula({ token, profil, fotoBayt, fotoYenile: String(env.BOT_FOTO_YENILE) === 'true', fetchFn });
  for (const s of rapor.satirlar) yaz(gizle(s));
  for (const h of rapor.hatalar) yaz('::warning::' + gizle(h));
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, gizle(['## Telegram bot profili', '', ...rapor.satirlar.map((s) => '- ' + s), ...rapor.hatalar.map((h) => '- ⚠ ' + h), ''].join('\n')) + '\n');
  return 0;
}

const dogrudan = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (dogrudan) process.exit(await calistir());
