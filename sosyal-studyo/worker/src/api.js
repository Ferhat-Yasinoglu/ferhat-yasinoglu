// Yönetici API'si: /api/* — Bearer anahtar, CORS, şema başlığı. Yanıt {ok, veri} | {ok:false, hata, mesaj}.
import { ok, hata, yoneticiMi, corsBasliklari } from './guvenlik.js';
import { SEMA_SURUMU, KOLEKSIYONLAR, YEDEGE_GIRMEZ } from '../../app/js/paylasilan/sema/surum.js';
import { yedekOlustur, yedekDogrula } from '../../app/js/paylasilan/sema/yedek-belgesi.js';
import { adimlariDogrula } from '../../app/js/paylasilan/akis/adimlar.js';
import { ozellikCalistir, saglayici, transkript } from './ai.js';
import { olayIsle } from './motor.js';
import { webhookKur } from './telegram.js';
import { simdi } from './db.js';

const YAZAR_KOLEKSIYONLAR = new Set(['ayarlar', 'hesaplar', 'akislar', 'tetikleyiciler', 'kurallar', 'etiketler', 'segmentler', 'puan_kurallari', 'toplu_mesajlar', 'kancalar', 'fikirler', 'senaryolar', 'video_analizleri', 'karuseller', 'galeri', 'ai_brifingler', 'cevapsiz_sorular', 'hos_geldin', 'referans_linkleri', 'kisiler']);

export async function apiIsle(env, db, istek, url, { fetchFn = fetch, ctx } = {}) {
  const origin = istek.headers.get('Origin') || '';
  const cors = corsBasliklari(env, origin);
  if (istek.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!yoneticiMi(env, istek)) {
    const ip = istek.headers.get('CF-Connecting-IP') || 'x';
    const deneme = await db.sayac('401:' + ip);
    if (deneme >= 5) return hata('kilit', '5 başarısız deneme; 15 dakika bekle', 429, cors);
    await db.sayacArtir('401:' + ip);
    return hata('yetki', 'yönetici anahtarı yanlış', 401, cors);
  }
  const sema = Number(istek.headers.get('X-SS-Sema') || SEMA_SURUMU);
  if (sema !== SEMA_SURUMU) return hata('sema_uyumsuz', `sunucu şema ${SEMA_SURUMU}`, 409, cors);
  const yol = url.pathname.replace(/^\/api\/?/, '');
  const parca = yol.split('/').filter(Boolean);
  const govde = async () => { try { return await istek.json(); } catch { return {}; } };

  try {
    // GET /api/durum — doktor
    if (yol === 'durum' && istek.method === 'GET') {
      const doktor = [];
      doktor.push({ ad: 'D1', durum: 'ok', detay: `şema ${await db.metaAl('sema_surumu')}` });
      doktor.push({ ad: 'PROVA', durum: String(env.PROVA || '1') === '1' ? 'warn' : 'ok', detay: String(env.PROVA || '1') === '1' ? 'canlı gönderim kapalı (varsayılan)' : 'canlı' });
      doktor.push({ ad: 'Telegram', durum: env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET ? 'ok' : 'warn', detay: env.TELEGRAM_BOT_TOKEN ? 'token var' : 'TELEGRAM_BOT_TOKEN yok' });
      doktor.push({ ad: 'Meta', durum: env.META_APP_SECRET && env.META_VERIFY_TOKEN ? 'ok' : 'warn', detay: env.META_APP_SECRET ? (env.IG_ACCESS_TOKEN ? 'IG token var' : 'IG token yok') : 'META_APP_SECRET yok' });
      doktor.push({ ad: 'AI', durum: saglayici(env) === 'yok' ? 'warn' : 'ok', detay: saglayici(env) });
      doktor.push({ ad: 'Cron', durum: (await db.metaAl('son_cron')) ? 'ok' : 'warn', detay: (await db.metaAl('son_cron')) || 'henüz çalışmadı' });
      const bugun = simdi().slice(0, 10);
      const kota = { olay: await db.sayac('olay', bugun), ai: await db.sayac('ai', bugun), yorum_yanit: await db.sayac('yorum_yanit', bugun) };
      return ok({ doktor, kota, surum: env.SURUM || 'dev', sema: SEMA_SURUMU, prova: String(env.PROVA || '1') === '1', secretler: { TELEGRAM_BOT_TOKEN: !!env.TELEGRAM_BOT_TOKEN, META_APP_SECRET: !!env.META_APP_SECRET, IG_ACCESS_TOKEN: !!env.IG_ACCESS_TOKEN, WA_ACCESS_TOKEN: !!env.WA_ACCESS_TOKEN, ANTHROPIC_API_KEY: !!env.ANTHROPIC_API_KEY } }, cors);
    }
    // Koleksiyonlar: GET /api/k/:kol?since=&limit=  · GET/PUT/DELETE /api/k/:kol/:id
    if (parca[0] === 'k' && parca[1]) {
      const kol = parca[1];
      if (!KOLEKSIYONLAR[kol] || YEDEGE_GIRMEZ.has(kol) && kol !== 'meta') return hata('koleksiyon', 'bilinmeyen koleksiyon', 404, cors);
      if (parca[2]) {
        const id = parca[2];
        if (istek.method === 'GET') { const k = await db.al(kol, id, { silinmisDahil: true }); return k ? ok(k, { ...cors, ETag: String(k.rev) }) : hata('yok', 'kayıt yok', 404, cors); }
        if (istek.method === 'PUT') {
          if (!YAZAR_KOLEKSIYONLAR.has(kol)) return hata('salt_okur', 'bu koleksiyon sunucu tarafından yazılır', 403, cors);
          const kayit = await govde();
          if (kol === 'akislar' && kayit.durum === 'yayinda') { const tetler = await db.listele('tetikleyiciler', { k1: id }); const d = adimlariDogrula(kayit.adimlar || [], { kanal: kayit.kanal, tetikleyiciTipleri: tetler.map((x) => x.tip) }); if (d.hatalar.length) return hata('dogrulama', d.hatalar.join('; '), 422, cors); }
          const rev = istek.headers.get('If-Match'); const r = await db.kaydet(kol, { ...kayit, id }, { rev: rev ? Number(rev) : undefined, onek: KOLEKSIYONLAR[kol].onek });
          if (r.cakisma) return hata('cakisma', 'kayıt sunucuda değişmiş', 409, cors);
          return ok(r, { ...cors, ETag: String(r.rev) });
        }
        if (istek.method === 'DELETE') { if (!YAZAR_KOLEKSIYONLAR.has(kol)) return hata('salt_okur', 'salt okunur', 403, cors); return ok({ silindi: await db.sil(kol, id) }, cors); }
      } else if (istek.method === 'GET') {
        const since = Number(url.searchParams.get('since') || 0); const limit = Math.min(1000, Number(url.searchParams.get('limit') || 500));
        const liste = await db.listele(kol, { since, limit, silinmisDahil: true });
        return ok({ kayitlar: liste, son_no: liste.at(-1)?.degisiklik_no ?? since, devam: liste.length === limit }, cors);
      }
    }
    // POST /api/komut — idempotent komutlar
    if (yol === 'komut' && istek.method === 'POST') {
      const { ad, yuk = {}, komut_id } = await govde();
      if (komut_id && (await db.al('komutlar', komut_id))) return ok({ tekrar: true }, cors);
      let sonuc = null;
      if (ad === 'etiket_ekle' || ad === 'etiket_kaldir') { const k = await db.al('kisiler', yuk.kisi_id); if (k) { const e = new Set(k.etiketler || []); for (const t of yuk.etiketler || []) ad === 'etiket_ekle' ? e.add(t) : e.delete(t); sonuc = await db.kaydet('kisiler', { ...k, etiketler: [...e] }); } }
      else if (ad === 'puan_ekle') { const k = await db.al('kisiler', yuk.kisi_id); if (k) { sonuc = await db.kaydet('kisiler', { ...k, puan: (k.puan || 0) + Number(yuk.delta || 0) }); await db.kaydet('puan_olaylari', { kisi_id: k.id, delta: Number(yuk.delta || 0), neden: yuk.neden || 'manuel', kaynak: 'manuel', olay_anahtari: 'manuel:' + (komut_id || simdi()) }, { onek: 'puan' }); } }
      else if (ad === 'kisi_sil') { const k = await db.al('kisiler', yuk.kisi_id); if (k) { sonuc = await db.kaydet('kisiler', { ...k, ad: 'silindi', kullanici_adi: '', degiskenler: {}, etiketler: [], silindi: 1 }); } }
      else if (ad === 'sohbet_durum') { const s = await db.al('sohbetler', yuk.sohbet_id); if (s) sonuc = await db.kaydet('sohbetler', { ...s, durum: yuk.durum, okunmamis: 0 }); }
      else if (ad === 'ajan_sustur') { const k = await db.al('kisiler', yuk.kisi_id); if (k) sonuc = await db.kaydet('kisiler', { ...k, ai_sustur_bitis: new Date(Date.now() + (yuk.dakika || 30) * 60000).toISOString() }); }
      else if (ad === 'mesaj_gonder') { const k = await db.al('kisiler', yuk.kisi_id); if (!k) return hata('yok', 'kişi yok', 404, cors); const hesap = (await db.listele('hesaplar')).find((h) => h.id === k.hesap_id) || null; const { eylemleriGonder } = await import('./motor.js'); const r = await eylemleriGonder(env, db, { hesap, kisi: k, olay: { kanal: k.kanal, hesap_id: k.hesap_id, tip: 'operator', text: '' }, eylemler: [{ tip: 'mesaj', text: String(yuk.metin || '').slice(0, 4000) }], fetchFn }); sonuc = r[0]; if (sonuc?.hata) return hata('gonderim', sonuc.hata, 422, cors); }
      else if (ad === 'akis_baslat') { const k = await db.al('kisiler', yuk.kisi_id); const a = await db.al('akislar', yuk.akis_id); if (!k || !a) return hata('yok', 'kişi ya da akış yok', 404, cors); sonuc = await olayIsle(env, db, { kaynak: k.kanal, kanal: k.kanal, hesap_id: k.hesap_id, dis_id: k.dis_id, ad: k.ad, kullanici_adi: k.kullanici_adi, olay_id: 'elle:' + (komut_id || simdi()), tip: 'dm', text: `__baslat__:${a.id}`, zaman: simdi() }, { fetchFn }); }
      else return hata('komut', 'bilinmeyen komut', 400, cors);
      if (komut_id) await db.kaydet('komutlar', { id: komut_id, ad, zaman: simdi() });
      return ok(sonuc, cors);
    }
    // GET /api/yedek
    if (yol === 'yedek' && istek.method === 'GET') {
      const koleksiyonlar = {};
      for (const [ad, b] of Object.entries(KOLEKSIYONLAR)) if (b.yedek || (url.searchParams.get('gunluk') === '1' && (ad === 'gunluk' || ad === 'mesajlar'))) koleksiyonlar[ad] = await db.listele(ad, { limit: 5000, silinmisDahil: true });
      return ok(await yedekOlustur(koleksiyonlar, { kaynak: { mod: 'bagli' }, uygulama_surumu: env.SURUM || 'dev' }), cors);
    }
    // POST /api/ice-aktar — tek parça (≤ ~1 MB)
    if (yol === 'ice-aktar' && istek.method === 'POST') {
      const belge = await govde(); const d = await yedekDogrula(belge); if (!d.gecerli) return hata('dogrulama', d.hatalar.join('; '), 422, cors);
      const rapor = {};
      for (const [ad, liste] of Object.entries(belge.koleksiyonlar)) { let n = 0; for (const k of liste) { const eski = await db.al(ad, k.id, { silinmisDahil: true }); if (eski && (eski.guncellendi || '') >= (k.guncellendi || '')) continue; await db.kaydet(ad, k, { onek: KOLEKSIYONLAR[ad]?.onek || ad }); n++; } rapor[ad] = n; }
      return ok({ rapor }, cors);
    }
    // POST /api/ai/:ozellik
    if (parca[0] === 'ai' && parca[1] && istek.method === 'POST') {
      const girdi = await govde();
      if (parca[1] === 'transkript') return ok(await transkript(env, girdi), cors);
      if (parca[1] === 'ajan_cevap') { const { ajanCevap } = await import('./ai.js'); const brif = girdi.brifing_id ? await db.al('ai_brifingler', girdi.brifing_id) : (await db.listele('ai_brifingler'))[0]; const c = await ajanCevap(env, db, { brifing: brif, mesaj: girdi.mesaj, kanal: 'test' }, fetchFn); return ok({ cevap: c }, cors); }
      return ok(await ozellikCalistir(env, db, parca[1], girdi, fetchFn), cors);
    }
    // POST /api/prova — gerçek yapılandırmayla karar, gönderimsiz
    if (yol === 'prova' && istek.method === 'POST') {
      const { olay } = await govde();
      const r = await olayIsle({ ...env, PROVA: '1' }, db, { kaynak: 'prova', kanal: olay.kanal || 'telegram', hesap_id: olay.hesap_id, dis_id: 'prova_' + (olay.dis_id || 'x'), ad: 'Prova', kullanici_adi: 'prova', olay_id: 'prova:' + simdi(), tip: olay.tip || 'dm', text: olay.text || '', yorumId: olay.yorumId, zaman: simdi() }, { fetchFn });
      return ok(r, cors);
    }
    // Kanal kurulumu
    if (yol === 'kanal/telegram/kur' && istek.method === 'POST') {
      if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) return hata('eksik', 'TELEGRAM_BOT_TOKEN ve TELEGRAM_WEBHOOK_SECRET secret\'ları gerekli', 422, cors);
      const r = await webhookKur(env, `${url.protocol}//${url.host}`, fetchFn);
      const mevcut = (await db.listele('hesaplar')).find((h) => h.kanal === 'telegram');
      await db.kaydet('hesaplar', { ...(mevcut || {}), kanal: 'telegram', ad: '@' + r.bot.username, dis_id: r.bot.username, durum: mevcut?.durum || 'prova' }, { onek: 'hes' });
      return ok(r, cors);
    }
    if (yol === 'kanal/hesap/durum' && istek.method === 'POST') {
      const { hesap_id, durum } = await govde(); const h = await db.al('hesaplar', hesap_id); if (!h) return hata('yok', 'hesap yok', 404, cors);
      return ok(await db.kaydet('hesaplar', { ...h, durum: durum === 'canli' ? 'canli' : 'prova' }), cors);
    }
    return hata('yol', 'bilinmeyen uç', 404, cors);
  } catch (err) {
    return hata('sunucu', String(err.message || err), 500, cors);
  }
}
