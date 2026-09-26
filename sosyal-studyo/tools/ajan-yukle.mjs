#!/usr/bin/env node
// Hazır bir AI ajanını (varsayılan: Shafa destek, worker/hazir/shafa-ajan.json) Worker'a yükler.
// Sahibin elle yapacağı hiçbir şey kalmasın diye dört adımı tek seferde yapar:
//   1. Brifingi dosyadaki SABİT id ile yazar (idempotent: tekrar çalıştırmak aynı kaydı günceller,
//      dosya kaynaktır). Aynı kanalda onu gölgeleyecek başka aktif brifing varsa pasife alır;
//      kanalı olmayan genel brifingler (ör. FY Ajans) diğer kanallarda sürsün diye dokunulmaz.
//   2. Telegram hesabını 'canli' yapar (değilse). Hesap hiç yoksa webhook kurulumuyla oluşturur.
//   3. Yol denetimi: /api/prova ile Telegram'dan gelmiş gibi bir mesajın hangi brifinge düştüğünü
//      ve bir akışın araya girip girmediğini sorar (PROVA zorlanır, dışarı mesaj gitmez).
//   4. /api/ai/ajan_cevap ile örnek soruları sorar, cevapları yazar ($GITHUB_STEP_SUMMARY'ye de).
// Ortam: WORKER_URL (ya da URL), YONETICI_ANAHTARI, AJAN_DOSYASI (isteğe bağlı), GITHUB_STEP_SUMMARY.
// Gizli değer hiçbir çıktıya yazılmaz; yönetici anahtarı her satırda ayrıca maskelenir.
import { readFileSync, appendFileSync } from 'node:fs';

export const VARSAYILAN_DOSYA = new URL('../worker/hazir/shafa-ajan.json', import.meta.url);
const SEMA = '1';
const BILGI_TAVANI = 32000;             // ai.js ajanCevap bilgi tabanını bu uzunlukta keser
const KESEN_TETIKLER = ['start', 'keyword', 'any_message', 'ref_link'];
const EMOJI = /\p{Extended_Pictographic}/u;
// Dil denetimi yazı türüyle yapılır: İngilizce cevap içinde «دانلود پشتیبان» gibi Dari düğme
// adları geçebilir; kelime sezgisi onu Farsça sanardı. Çoğunluk hangi yazıdaysa o sayılır.
const ARAP_HARF = /\p{Script=Arabic}/gu;
const LATIN_HARF = /\p{Script=Latin}/gu;
export const yaziTuru = (m) => ((String(m).match(ARAP_HARF) || []).length > (String(m).match(LATIN_HARF) || []).length ? 'dari' : 'latin');
const DOZ = /[0-9۰-۹٠-٩]+([.,٫][0-9۰-۹٠-٩]+)?\s*(mg|mcg|ml|µg|milligram|ملی|میلی|گرام|قطره|tablet|قرص)/i;

const kanalli = (b) => Array.isArray(b?.kanallar) && b.kanallar.length > 0;
const canlilar = (v) => (v?.kayitlar || []).filter((k) => !k.silindi);

/** Yönetici API istemcisi: Bearer anahtar + şema başlığı. {ok:false} yanıtını hataya çevirir. */
export function istemci({ url, anahtar, fetchFn = fetch }) {
  const kok = String(url || '').trim().replace(/\/+$/, '');
  const basliklar = { Authorization: 'Bearer ' + anahtar, 'X-SS-Sema': SEMA, 'Content-Type': 'application/json' };
  async function api(yol, { method = 'GET', govde, ekBaslik = {} } = {}) {
    const r = await fetchFn(kok + yol, { method, headers: { ...basliklar, ...ekBaslik }, body: govde === undefined ? undefined : JSON.stringify(govde) });
    const j = await r.json().catch(() => ({ ok: false, mesaj: `yanıt JSON değil (HTTP ${r.status})` }));
    if (!j || !j.ok) throw Object.assign(new Error((j && j.mesaj) || `HTTP ${r.status}`), { durum: r.status, kod: j && j.hata });
    return j.veri;
  }
  async function saglik() {
    try { const r = await fetchFn(kok + '/health', { method: 'GET' }); return await r.json(); } catch { return {}; }
  }
  return { api, saglik, kok };
}

/** Bilgi tabanının modele giden uzunluğu (ai.js ile aynı birleştirme). */
export function bilgiUzunlugu(brifing) {
  return (brifing.bilgi_tabani || []).filter((b) => b.aktif !== 0).map((b) => `## ${b.baslik}\n${b.metin}`).join('\n\n').length;
}

/** Dosya içeriğini Worker'a yazılacak brifinge çevirir ve denetler. */
export function ajanHazirla(veri) {
  const kaynak = veri && veri.brifing;
  if (!kaynak || !kaynak.id) throw new Error('ajan dosyasında brifing.id yok');
  const brifing = { ...kaynak, aktif: 1 };
  if (Array.isArray(brifing.kimlik)) brifing.kimlik = brifing.kimlik.join('\n');
  if (!String(brifing.kimlik || '').trim()) throw new Error('ajan dosyasında kimlik boş');
  if (!Array.isArray(brifing.bilgi_tabani) || !brifing.bilgi_tabani.length) throw new Error('ajan dosyasında bilgi_tabani boş');
  brifing.bilgi_tabani = brifing.bilgi_tabani.map((b, i) => {
    if (!b || !String(b.baslik || '').trim() || !String(b.metin || '').trim()) throw new Error(`bilgi_tabani[${i}] başlık ya da metin boş`);
    return { baslik: b.baslik, metin: b.metin, aktif: b.aktif === 0 ? 0 : 1 };
  });
  const uzunluk = bilgiUzunlugu(brifing);
  if (uzunluk > BILGI_TAVANI) throw new Error(`bilgi tabanı ${uzunluk} karakter; sınır ${BILGI_TAVANI}`);
  for (const a of ['rev', 'degisiklik_no', 'guncellendi', 'silindi']) delete brifing[a];
  const sorular = (veri.deneme_sorulari || []).map((s) => (typeof s === 'string' ? { soru: s, tur: 'normal' } : { soru: String(s.soru || ''), tur: s.tur || 'normal' })).filter((s) => s.soru.trim());
  return { brifing, sorular, yolSorusu: veri.yol_denetimi_sorusu || sorular[0]?.soru || 'سلام' };
}

export function ajanDosyasiOku(yol = VARSAYILAN_DOSYA) {
  return ajanHazirla(JSON.parse(readFileSync(yol, 'utf8')));
}

/** 1a. Brifingi sabit id ile yazar. Kayıt varsa rev ile (If-Match) günceller; çakışırsa bir kez yeniden dener. */
export async function brifingYaz(api, brifing) {
  const yol = `/api/k/ai_brifingler/${encodeURIComponent(brifing.id)}`;
  for (let deneme = 0; ; deneme++) {
    let mevcut = null;
    try { mevcut = await api(yol); } catch (e) { if (e.durum !== 404) throw e; }
    try {
      const kayit = await api(yol, { method: 'PUT', govde: brifing, ekBaslik: mevcut ? { 'If-Match': String(mevcut.rev) } : {} });
      return { kayit, yeni: !mevcut || !!mevcut.silindi };
    } catch (e) {
      if (e.durum === 409 && deneme === 0) continue;
      throw e;
    }
  }
}

/** 1b. Bizim brifingi aynı kanalda gölgeleyecek başka aktif brifingleri pasife alır.
 *  Kanala özel brifingimiz genel brifinglerden zaten önce gelir (ai.js brifingSec);
 *  yalnız aynı kanalı isteyen başka bir kanala özel brifing ona rakip olur. */
export async function rakipleriPasifYap(api, brifing) {
  const hepsi = canlilar(await api('/api/k/ai_brifingler?limit=200'));
  const cakisir = (b) => (kanalli(brifing) ? kanalli(b) && b.kanallar.some((k) => brifing.kanallar.includes(k)) : !kanalli(b));
  const pasif = [];
  const genel = [];
  for (const b of hepsi) {
    if (b.id === brifing.id || !b.aktif) continue;
    if (!cakisir(b)) { if (!kanalli(b)) genel.push({ id: b.id, ad: b.ad || '' }); continue; }
    const govde = { ...b, aktif: 0 };
    for (const a of ['rev', 'degisiklik_no', 'guncellendi', 'silindi']) delete govde[a];
    await api(`/api/k/ai_brifingler/${encodeURIComponent(b.id)}`, { method: 'PUT', govde, ekBaslik: { 'If-Match': String(b.rev) } });
    pasif.push({ id: b.id, ad: b.ad || '' });
  }
  return { pasif, genel };
}

/** 2. Telegram hesabını canlı yapar. Hesap yoksa webhook kurulumu hesabı oluşturur. */
export async function telegramCanli(api) {
  let hesaplar = canlilar(await api('/api/k/hesaplar?limit=200')).filter((h) => h.kanal === 'telegram');
  const sonuc = { kuruldu: false, canliyaAlinan: [], zatenCanli: [], hesaplar: [] };
  if (!hesaplar.length) {
    const r = await api('/api/kanal/telegram/kur', { method: 'POST', govde: {} });
    sonuc.kuruldu = true;
    hesaplar = r && r.hesap ? [r.hesap] : [];
  }
  for (const h of hesaplar) {
    if (h.durum === 'canli') { sonuc.zatenCanli.push(h.id); continue; }
    await api('/api/kanal/hesap/durum', { method: 'POST', govde: { hesap_id: h.id, durum: 'canli' } });
    sonuc.canliyaAlinan.push(h.id);
  }
  sonuc.hesaplar = hesaplar.map((h) => ({ id: h.id, ad: h.ad || '' }));
  return sonuc;
}

/** 3a. Telegram'da ajandan önce mesajı yakalayabilecek yayındaki akışlar (değiştirilmez, raporlanır). */
export async function kesenTetikler(api, hesapId) {
  const [akislar, tetler] = await Promise.all([
    api('/api/k/akislar?limit=500').then(canlilar),
    api('/api/k/tetikleyiciler?limit=500').then(canlilar),
  ]);
  const akis = Object.fromEntries(akislar.map((a) => [a.id, a]));
  return tetler
    .filter((t) => t.aktif !== 0 && t.aktif !== false && KESEN_TETIKLER.includes(t.tip) && (!t.hesap_id || !hesapId || t.hesap_id === hesapId))
    .filter((t) => akis[t.akis_id] && akis[t.akis_id].durum === 'yayinda')
    .map((t) => ({ id: t.id, tip: t.tip, akis: akis[t.akis_id].ad || t.akis_id, kelimeler: t.anahtar_kelimeler || [] }));
}

/** 3b. Gerçek motorla karar: Telegram'dan gelen bir mesaj hangi brifinge düşüyor? (gönderimsiz) */
export async function yolDenetimi(api, { brifingId, hesapId, soru }) {
  const r = await api('/api/prova', { method: 'POST', govde: { olay: { kanal: 'telegram', hesap_id: hesapId, dis_id: 'shafa_yukleyici', tip: 'dm', text: soru } } });
  if (r && r.karar === 'ai' && r.brifing === brifingId) return { durum: 'ok', cevapVar: !!r.cevapVar, karar: r };
  if (r && r.karar === 'ai' && !r.brifing) return { durum: 'bilinmiyor', karar: r };
  return { durum: 'hata', karar: r || {} };
}

/** 4. Örnek sorular: brifinge doğrudan sorulur, kontrol edilir. */
export async function ornekleriSor(api, brifingId, sorular) {
  const sonuclar = [];
  for (const s of sorular) {
    let cevap = null, hata = '';
    try { cevap = (await api('/api/ai/ajan_cevap', { method: 'POST', govde: { brifing_id: brifingId, mesaj: s.soru, deneme: true } }))?.cevap || null; } catch (e) { hata = e.message; }
    const uyarilar = [];
    if (cevap && EMOJI.test(cevap)) uyarilar.push('emoji kullandı');
    if (cevap && yaziTuru(cevap) !== yaziTuru(s.soru)) uyarilar.push(`soru ${yaziTuru(s.soru)} yazısıyla, cevap ${yaziTuru(cevap)}`);
    if (cevap && s.tur === 'tibbi' && DOZ.test(cevap)) uyarilar.push('tıbbi soruya doz/miktar yazdı');
    sonuclar.push({ ...s, cevap, hata, uyarilar });
  }
  return sonuclar;
}

const blok = (metin) => String(metin).split('\n').map((s) => '> ' + s).join('\n');

export function ozetMetni(r) {
  const s = [];
  s.push('## AI ajanı: ' + (r.brifing?.ad || r.brifing?.id || '?'));
  s.push('');
  if (r.brifing) s.push(`- Brifing \`${r.brifing.id}\` ${r.yeni ? 'oluşturuldu' : 'güncellendi'} (rev ${r.rev ?? '?'}) · ${r.brifing.bilgi_tabani.length} bilgi parçası · ${r.uzunluk} karakter · kanallar: ${kanalli(r.brifing) ? r.brifing.kanallar.join(', ') : 'hepsi'}`);
  if (r.rakipler) {
    if (r.rakipler.pasif.length) s.push(`- Pasife alınan (aynı kanalda rakip): ${r.rakipler.pasif.map((b) => `\`${b.id}\` ${b.ad}`).join(', ')}`);
    if (r.rakipler.genel.length) s.push(`- Dokunulmayan genel brifing(ler), diğer kanallarda sürer: ${r.rakipler.genel.map((b) => `\`${b.id}\` ${b.ad}`).join(', ')}`);
  }
  if (r.telegram) {
    const t = r.telegram;
    s.push(`- Telegram hesabı: ${t.hesaplar.map((h) => h.ad || h.id).join(', ') || 'yok'}${t.kuruldu ? ' (webhook kurularak oluşturuldu)' : ''} · ${t.canliyaAlinan.length ? 'canlıya alındı' : 'zaten canlıydı'}${t.hesaplar.length > 1 ? ` · UYARI: ${t.hesaplar.length} telegram hesabı var` : ''}`);
  }
  if (r.saglik) s.push(`- PROVA: ${r.saglik.prova ? '**AÇIK — cevaplar Telegram\'a gönderilmez** (workflow\'u prova = 0 ile çalıştır)' : 'kapalı (cevaplar gerçekten gönderilir)'} · AI: ${r.saglik.saglayici || '?'} · sürüm ${r.saglik.surum || '?'}`);
  if (r.tetikler) s.push(r.tetikler.length ? `- Ajandan önce mesaj yakalayabilen yayındaki akışlar: ${r.tetikler.map((t) => `${t.tip}${t.kelimeler.length ? ' (' + t.kelimeler.slice(0, 6).join(', ') + ')' : ''} → ${t.akis}`).join(' · ')}` : '- Telegram\'da ajandan önce mesaj yakalayan yayında akış yok.');
  if (r.yol) {
    const y = r.yol;
    s.push(y.durum === 'ok' ? `- Yol denetimi: Telegram'dan gelen mesaj \`${r.brifing.id}\` brifingine düşüyor ✓${y.cevapVar ? '' : ' (ama cevap üretilmedi: AI tavanı ya da <skip>)'}`
      : y.durum === 'bilinmiyor' ? '- Yol denetimi: Worker hangi brifingin seçildiğini söylemiyor (eski sürüm olabilir); workflow Worker\'ı dağıttıktan sonra yeniden dene.'
      : `- Yol denetimi: **SORUN** — mesaj ajana değil şuraya gitti: ${JSON.stringify(y.karar).slice(0, 200)}`);
  }
  if (r.ornekler?.length) {
    s.push('', '### Örnek sorular (deneme; dışarı mesaj gitmez)', '');
    for (const o of r.ornekler) {
      s.push(`**Soru${o.tur === 'tibbi' ? ' (tıbbi, reddetmeli)' : ''}:** ${o.soru}`, '');
      s.push(o.hata ? blok('HATA: ' + o.hata) : o.cevap ? blok(o.cevap) : blok('(sustu: <skip> — soru cevapsızlar listesine düşer)'));
      if (o.uyarilar.length) s.push('', '⚠ ' + o.uyarilar.join(' · '));
      s.push('');
    }
  }
  if (r.hatalar?.length) s.push('', '### Hatalar', '', ...r.hatalar.map((h) => '- ' + h));
  return s.join('\n') + '\n';
}

/** Ana akış. Ağ, ortam ve çıktı dışarıdan verilir (testler sahte fetch kullanır). */
export async function calistir({ env = process.env, fetchFn = fetch, yaz = (s) => console.log(s), ajan } = {}) {
  const url = env.WORKER_URL || env.URL;
  const anahtar = env.YONETICI_ANAHTARI || '';
  const gizle = (s) => (anahtar ? String(s).split(anahtar).join('***') : String(s));
  const cikti = (s) => yaz(gizle(s));
  const rapor = { hatalar: [] };
  const hataVer = (m) => { rapor.hatalar.push(m); cikti('::error::' + m); };
  if (!url || !anahtar) { hataVer('WORKER_URL ya da YONETICI_ANAHTARI yok'); return { hata: 1, rapor, ozet: '' }; }

  let hazir;
  try { hazir = ajan || ajanDosyasiOku(env.AJAN_DOSYASI || VARSAYILAN_DOSYA); } catch (e) { hataVer('ajan dosyası okunamadı: ' + e.message); return { hata: 1, rapor, ozet: '' }; }
  const { brifing, sorular, yolSorusu } = hazir;
  rapor.brifing = brifing;
  rapor.uzunluk = bilgiUzunlugu(brifing);
  const { api, saglik } = istemci({ url, anahtar, fetchFn });

  rapor.saglik = await saglik();
  cikti(`Worker: sürüm ${rapor.saglik.surum || '?'} · PROVA ${rapor.saglik.prova ? 'açık' : 'kapalı'} · AI ${rapor.saglik.saglayici || '?'}`);
  if (rapor.saglik.prova) cikti('::warning::PROVA açık: ajan karar verir ama Telegram\'a mesaj gitmez. Canlı için workflow\'u prova = 0 ile çalıştır.');

  try {
    const { kayit, yeni } = await brifingYaz(api, brifing);
    rapor.yeni = yeni; rapor.rev = kayit?.rev;
    cikti(`✓ brifing ${yeni ? 'oluşturuldu' : 'güncellendi'}: ${brifing.id} · rev ${kayit?.rev} · ${brifing.bilgi_tabani.length} bilgi parçası · ${rapor.uzunluk} karakter`);
    rapor.rakipler = await rakipleriPasifYap(api, brifing);
    for (const b of rapor.rakipler.pasif) cikti(`✓ aynı kanalda rakip brifing pasife alındı: ${b.id} ${b.ad}`);
    for (const b of rapor.rakipler.genel) cikti(`· genel brifing korundu (diğer kanallarda sürer): ${b.id} ${b.ad}`);
  } catch (e) {
    hataVer('brifing yazılamadı: ' + e.message);
    return { hata: 1, rapor, ozet: gizle(ozetMetni(rapor)) };
  }

  let hesapId = null;
  if (!kanalli(brifing) || brifing.kanallar.includes('telegram')) {
    try {
      rapor.telegram = await telegramCanli(api);
      hesapId = rapor.telegram.hesaplar[0]?.id || null;
      cikti(`✓ telegram hesabı ${rapor.telegram.hesaplar.map((h) => h.ad || h.id).join(', ')}: ${rapor.telegram.canliyaAlinan.length ? 'canlıya alındı' : 'zaten canlı'}`);
      if (rapor.telegram.hesaplar.length > 1) cikti(`::warning::${rapor.telegram.hesaplar.length} telegram hesabı var; hepsi canlı yapıldı. Fazlası Worker dağıtımındaki webhook kurulumunda temizlenir.`);
    } catch (e) {
      hataVer('telegram hesabı canlı yapılamadı: ' + e.message);
    }
    try {
      rapor.tetikler = await kesenTetikler(api, hesapId);
      for (const t of rapor.tetikler) cikti(`::warning::Telegram'da "${t.tip}" tetikleyicisi yayındaki "${t.akis}" akışını başlatıyor${t.kelimeler.length ? ' (' + t.kelimeler.join(', ') + ')' : ''}; eşleşen mesajlara ajan değil akış cevap verir.`);
    } catch (e) { cikti('::warning::akışlar okunamadı: ' + e.message); }
    try {
      rapor.yol = await yolDenetimi(api, { brifingId: brifing.id, hesapId, soru: yolSorusu });
      if (rapor.yol.durum === 'ok') cikti(`✓ yol denetimi: Telegram mesajı ${brifing.id} brifingine düşüyor${rapor.yol.cevapVar ? '' : ' (cevap üretilmedi)'}`);
      else if (rapor.yol.durum === 'bilinmiyor') cikti('::warning::yol denetimi: Worker seçilen brifingi bildirmiyor (eski sürüm olabilir).');
      else hataVer(`yol denetimi: Telegram mesajı ajana ulaşmıyor: ${JSON.stringify(rapor.yol.karar).slice(0, 200)}`);
    } catch (e) { cikti('::warning::yol denetimi yapılamadı: ' + e.message); }
  }

  rapor.ornekler = await ornekleriSor(api, brifing.id, sorular);
  cikti('--- örnek sorular (deneme: dışarı mesaj gitmez) ---');
  for (const o of rapor.ornekler) {
    cikti(`? ${o.soru}`);
    cikti(o.hata ? `  HATA: ${o.hata}` : o.cevap ? '  ' + o.cevap.replace(/\n/g, ' ') : '  <skip> (sustu)');
    for (const u of o.uyarilar) cikti(`::warning::"${o.soru.slice(0, 40)}": ${u}`);
  }
  if (rapor.ornekler.length && rapor.ornekler.every((o) => o.hata)) hataVer('hiçbir örnek soru cevaplanamadı (AI sağlayıcısı ya da günlük tavan)');

  return { hata: rapor.hatalar.length ? 1 : 0, rapor, ozet: gizle(ozetMetni(rapor)) };
}

const dogrudan = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (dogrudan) {
  const { hata, ozet } = await calistir();
  if (ozet && process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, ozet);
  process.exit(hata);
}
