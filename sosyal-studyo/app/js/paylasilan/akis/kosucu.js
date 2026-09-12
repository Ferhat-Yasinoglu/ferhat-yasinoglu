// Akış koşucusu: saf, yan etkisiz durum makinesi. Adımları sırayla yürütür,
// bir şey beklemesi gerekince (cevap, buton, gecikme, pencere) koşuyu parklar ve
// yapılması gereken eylemleri liste olarak döner. Gönderim, veritabanı, ağ
// burada YOK: tarayıcıdaki simülatör de, Worker da aynı dosyayı çalıştırır.
import { doldur, eslesir, normalize, varyantSec } from '../metin.js';

const EN_FAZLA_ADIM_TURU = 200; // sonsuz goto döngüsüne karşı kalkan

export function kosuOlustur({ akis, kisi, hesap_id, tetik, baglam = {}, id, zaman }) {
  return {
    id: id || `kosu_${Math.random().toString(16).slice(2, 10)}`,
    akis_id: akis.id, akis_surum: akis.surum || 1, kisi_id: kisi.id, hesap_id,
    adimlar_anlik: akis.adimlar, adim: 0, durum: 'waiting', bekleme: null,
    kaydet_alan: null, degiskenler: {}, devam_zamani: null,
    baglam: { tetik, ...baglam }, adim_izi: [], baslangic: zaman || new Date().toISOString(),
  };
}

/** Şablon değişkenleri: kişi alanları + kişi değişkenleri + koşu değişkenleri. */
export function degiskenler(kosu, kisi) {
  return {
    ad: kisi.ad || kisi.kullanici_adi || '', username: kisi.kullanici_adi || kisi.ad || '',
    kanal: kisi.kanal || '', puan: kisi.puan || 0,
    ...(kisi.degiskenler || {}), ...(kosu.degiskenler || {}),
  };
}

function kosulDegerlendir(kosul, kosu, kisi, ctx) {
  const etiketler = new Set(kisi.etiketler || []);
  switch (kosul.kind) {
    case 'tag': {
      const any = !kosul.any?.length || kosul.any.some((t) => etiketler.has(t));
      const all = !kosul.all?.length || kosul.all.every((t) => etiketler.has(t));
      const none = !kosul.none?.length || !kosul.none.some((t) => etiketler.has(t));
      return any && all && none;
    }
    case 'var': {
      const v = degiskenler(kosu, kisi)[kosul.name];
      const s = v === undefined || v === null ? '' : String(v);
      switch (kosul.op) {
        case 'set': return s !== '';
        case 'unset': return s === '';
        case 'eq': return normalize(s) === normalize(kosul.value);
        case 'ne': return normalize(s) !== normalize(kosul.value);
        case 'contains': return normalize(s).includes(normalize(kosul.value));
        case 'gt': return Number(s) > Number(kosul.value);
        case 'lt': return Number(s) < Number(kosul.value);
        default: return false;
      }
    }
    case 'follows': return kisi.takip_ediyor === true;
    case 'score': return kosul.op === 'gte' ? (kisi.puan || 0) >= kosul.value : (kisi.puan || 0) < kosul.value;
    case 'channel': return (kosul.in || []).includes(kisi.kanal);
    case 'window_open': return ctx.pencereAcik ? ctx.pencereAcik(kisi) : true;
    case 'time': {
      const t = ctx.simdi ? new Date(ctx.simdi()) : new Date();
      if (kosul.days?.length && !kosul.days.includes(t.getUTCDay())) return false;
      const hhmm = t.toISOString().slice(11, 16);
      if (kosul.from && hhmm < kosul.from) return false;
      if (kosul.to && hhmm > kosul.to) return false;
      return true;
    }
    default: return false;
  }
}

function dogrula(tur, metin) {
  const s = String(metin ?? '').trim();
  if (tur === 'phone') return /^\+?[\d\s()-]{7,20}$/.test(s);
  if (tur === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  if (tur === 'number') return s !== '' && !Number.isNaN(Number(s.replace(',', '.')));
  return true;
}

/**
 * Koşuyu bir girdiyle ilerletir.
 * girdi: {tur:'baslat'} | {tur:'metin', text} | {tur:'buton', label, value, adim} | {tur:'zaman'} | {tur:'pencere'}
 * ctx: { simdi(), pencereAcik(kisi), ai(step, kosu, kisi) → metin|null, webhook(step, kosu, kisi) → deger|throws }
 * Döner: { kosu, kisi, eylemler[] } — kisi kopyası etiket/puan değişiklikleriyle.
 */
export async function ilerlet(kosuGirdi, kisiGirdi, girdi, ctx = {}) {
  const kosu = { ...kosuGirdi, degiskenler: { ...(kosuGirdi.degiskenler || {}) }, adim_izi: [...(kosuGirdi.adim_izi || [])] };
  const kisi = { ...kisiGirdi, etiketler: [...(kisiGirdi.etiketler || [])], degiskenler: { ...(kisiGirdi.degiskenler || {}) } };
  const eylemler = [];
  const simdi = () => (ctx.simdi ? ctx.simdi() : new Date().toISOString());
  const adimlar = kosu.adimlar_anlik;
  const etiketEkle = (liste = []) => { for (const t of liste) if (!kisi.etiketler.includes(t)) kisi.etiketler.push(t); if (liste.length) eylemler.push({ tip: 'etiket', add: [...liste] }); };
  const etiketSil = (liste = []) => { kisi.etiketler = kisi.etiketler.filter((t) => !liste.includes(t)); if (liste.length) eylemler.push({ tip: 'etiket', remove: [...liste] }); };
  const bitir = (durum = 'finished') => { kosu.durum = durum; kosu.bekleme = null; kosu.kaydet_alan = null; return { kosu, kisi, eylemler }; };

  if (kosu.durum !== 'waiting') return { kosu, kisi, eylemler };

  // 1) Bekleyen bir şey varsa girdiyi ona uygula.
  if (kosu.bekleme) {
    const adim = adimlar[kosu.adim];
    if (kosu.bekleme === 'reply') {
      if (girdi.tur !== 'metin') return { kosu, kisi, eylemler };
      if (adim.validate && adim.validate !== 'none' && !dogrula(adim.validate, girdi.text)) {
        const deneme = (kosu.degiskenler.__deneme || 0) + 1;
        kosu.degiskenler.__deneme = deneme;
        if (deneme <= (adim.retries ?? 2)) {
          eylemler.push({ tip: 'mesaj', text: doldur(adim.retry_text || 'Bunu anlayamadım, tekrar yazar mısın?', degiskenler(kosu, kisi)) });
          return { kosu, kisi, eylemler };
        }
      }
      delete kosu.degiskenler.__deneme;
      if (adim.save_as) { kosu.degiskenler[adim.save_as] = girdi.text; kisi.degiskenler[adim.save_as] = girdi.text; }
      kosu.bekleme = null; kosu.adim += 1;
    } else if (kosu.bekleme === 'choice') {
      let secim = null;
      if (girdi.tur === 'buton') {
        if (girdi.adim !== undefined && girdi.adim !== kosu.adim) return { kosu, kisi, eylemler }; // eski buton
        secim = adim.choices.find((c) => (girdi.value !== undefined && c.value === girdi.value) || normalize(c.label) === normalize(girdi.label));
      } else if (girdi.tur === 'metin') {
        secim = adim.choices.find((c) => normalize(c.label) === normalize(girdi.text) || (c.value && normalize(c.value) === normalize(girdi.text)));
      }
      if (!secim) {
        // Hiçbir seçeneğe uymayan cevap: soruyu yeniden sor, ilerleme yok.
        eylemler.push({ tip: 'mesaj', text: doldur(adim.text, degiskenler(kosu, kisi)), choices: adim.choices, adim: kosu.adim });
        return { kosu, kisi, eylemler };
      }
      if (adim.save_as) { kosu.degiskenler[adim.save_as] = secim.value ?? secim.label; kisi.degiskenler[adim.save_as] = secim.value ?? secim.label; }
      if (secim.add_tags?.length) etiketEkle(secim.add_tags);
      kosu.bekleme = null;
      kosu.adim = secim.goto !== undefined ? secim.goto : kosu.adim + 1;
    } else if (kosu.bekleme === 'delay') {
      if (girdi.tur !== 'zaman') return { kosu, kisi, eylemler };
      kosu.bekleme = null; kosu.devam_zamani = null; kosu.adim += 1;
    } else if (kosu.bekleme === 'window') {
      // Yorumdan gelen kişi DM'e cevap verdi: pencere açıldı, devam.
      if (girdi.tur !== 'pencere' && girdi.tur !== 'metin' && girdi.tur !== 'buton') return { kosu, kisi, eylemler };
      kosu.bekleme = null;
      if (girdi.tur === 'buton' && adim.choices) {
        const secim = adim.choices.find((c) => normalize(c.label) === normalize(girdi.label));
        kosu.adim = secim?.goto !== undefined ? secim.goto : kosu.adim + 1;
        if (secim?.add_tags?.length) etiketEkle(secim.add_tags);
      } else kosu.adim += 1;
    }
  }

  // 2) Bir şey beklemeden koşulabilen adımları sırayla yürüt.
  let tur = 0;
  while (kosu.adim < adimlar.length) {
    if (++tur > EN_FAZLA_ADIM_TURU) { kosu.hata = 'döngü sınırı'; return bitir('failed'); }
    const i = kosu.adim;
    const a = adimlar[i];
    kosu.adim_izi.push({ adim: i, zaman: simdi() });
    const d = degiskenler(kosu, kisi);
    switch (a.type) {
      case 'note': kosu.adim += 1; break;
      case 'message':
        eylemler.push({ tip: 'mesaj', text: doldur(a.text, d), media: a.media, adim: i });
        kosu.adim += 1; break;
      case 'question':
        eylemler.push({ tip: 'mesaj', text: doldur(a.text, d), adim: i });
        kosu.bekleme = 'reply'; kosu.kaydet_alan = a.save_as || null;
        return { kosu, kisi, eylemler };
      case 'buttons':
        eylemler.push({ tip: 'mesaj', text: doldur(a.text, d), choices: a.choices, adim: i });
        kosu.bekleme = 'choice'; kosu.kaydet_alan = a.save_as || null;
        return { kosu, kisi, eylemler };
      case 'delay':
        if (!a.seconds) { kosu.adim += 1; break; }
        kosu.bekleme = 'delay';
        kosu.devam_zamani = new Date(Date.parse(simdi()) + a.seconds * 1000).toISOString();
        eylemler.push({ tip: 'bekle', saniye: a.seconds, devam_zamani: kosu.devam_zamani });
        return { kosu, kisi, eylemler };
      case 'tag':
        etiketEkle(a.add_tags); etiketSil(a.remove_tags); kosu.adim += 1; break;
      case 'goto': kosu.adim = a.goto; break;
      case 'end': return bitir('finished');
      case 'condition':
        kosu.adim = kosulDegerlendir(a.check, kosu, kisi, ctx) ? a.then : a.else; break;
      case 'score': {
        const anahtar = a.once_per === 'run' ? `${kosu.id}:${i}` : a.once_per === 'day' ? `${kisi.id}:${i}:${simdi().slice(0, 10)}` : `${kosu.id}:${i}:${tur}`;
        kisi.puan = (kisi.puan || 0) + a.delta;
        eylemler.push({ tip: 'puan', delta: a.delta, reason: a.reason, olay_anahtari: anahtar });
        kosu.adim += 1; break;
      }
      case 'ai_reply': {
        let cevap = null;
        try { cevap = ctx.ai ? await ctx.ai(a, kosu, kisi) : null; } catch { cevap = null; }
        if (cevap) {
          if (a.save_as) { kosu.degiskenler[a.save_as] = cevap; }
          eylemler.push({ tip: 'mesaj', text: cevap, kaynak: 'ai', adim: i });
          kosu.adim += 1;
        } else if (a.on_skip_goto !== undefined) {
          eylemler.push({ tip: 'gunluk', mesaj: 'ai sustu' });
          kosu.adim = a.on_skip_goto;
        } else {
          if (a.fallback_text) eylemler.push({ tip: 'mesaj', text: doldur(a.fallback_text, d), adim: i });
          kosu.adim += 1;
        }
        break;
      }
      case 'webhook': {
        try {
          const sonuc = ctx.webhook ? await ctx.webhook(a, kosu, kisi) : null;
          if (a.save_as) kosu.degiskenler[a.save_as] = sonuc === null || sonuc === undefined ? '' : (typeof sonuc === 'string' ? sonuc : JSON.stringify(sonuc));
          eylemler.push({ tip: 'webhook', url: a.url, basarili: true });
          kosu.adim += 1;
        } catch (e) {
          eylemler.push({ tip: 'webhook', url: a.url, basarili: false, hata: String(e?.message || e) });
          if (a.on_error_goto !== undefined) kosu.adim = a.on_error_goto; else kosu.adim += 1;
        }
        break;
      }
      case 'comment_reply':
        eylemler.push({ tip: 'yorum_yanit', text: doldur(varyantSec(a.texts, kosu.baglam?.yorumId || kosu.id), d), yorumId: kosu.baglam?.yorumId });
        kosu.adim += 1; break;
      case 'private_reply':
        if (kosu.baglam?.ozelYanitGonderildi) { kosu.adim += 1; break; }
        kosu.baglam = { ...kosu.baglam, ozelYanitGonderildi: true };
        eylemler.push({ tip: 'ozel_yanit', text: doldur(a.text, d), choices: a.choices, yorumId: kosu.baglam?.yorumId, adim: i });
        kosu.bekleme = 'window';
        return { kosu, kisi, eylemler };
      case 'hide':
        eylemler.push({ tip: 'gizle', yorumId: kosu.baglam?.yorumId }); kosu.adim += 1; break;
      default:
        kosu.hata = `bilinmeyen adım: ${a.type}`; return bitir('failed');
    }
  }
  return bitir('finished');
}

/** Sonraki koşu başlangıcı için kısa yol: oluştur + ilk adımları koş. */
export async function baslat(args, ctx) {
  const kosu = kosuOlustur(args);
  return ilerlet(kosu, args.kisi, { tur: 'baslat' }, ctx);
}

/** Gelen metin, koşudaki beklentiyle uyuşuyor mu (cevap tetikleyiciyi yener kuralı için). */
export function cevapBekliyor(kosu) {
  return kosu && kosu.durum === 'waiting' && (kosu.bekleme === 'reply' || kosu.bekleme === 'choice');
}

export { eslesir };
