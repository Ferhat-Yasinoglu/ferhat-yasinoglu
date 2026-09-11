// Gelen olay döngüsü: doğrula → tekilleştir → kişi → koşu → eşle → koş → gönder → yaz.
// Paylaşılan saf motorlar app/js/paylasilan/ altından gelir; tarayıcıdaki simülatörle aynı kod.
import { esle } from '../../app/js/paylasilan/akis/tetikleyici.js';
import { baslat, ilerlet } from '../../app/js/paylasilan/akis/kosucu.js';
import { kurallariAyristir, karar as kuralKarari } from '../../app/js/paylasilan/kurallar.js';
import { pencereAcik } from '../../app/js/paylasilan/kanallar.js';
import { kelimeVar } from '../../app/js/paylasilan/metin.js';
import * as tg from './telegram.js';
import * as meta from './meta.js';
import { ajanCevap } from './ai.js';
import { simdi } from './db.js';

async function kisiUpsert(db, olay) {
  let kisi = await db.kisiBul(olay.hesap_id || '', olay.dis_id);
  const guncel = { hesap_id: olay.hesap_id || '', kanal: olay.kanal, dis_id: olay.dis_id, ad: olay.ad || kisi?.ad || olay.kullanici_adi || olay.dis_id, kullanici_adi: olay.kullanici_adi || kisi?.kullanici_adi || '', son_gelen: olay.zaman || simdi(), kaynak: kisi?.kaynak || (olay.tip === 'comment' ? 'yorum' : olay.tip === 'ref_link' ? 'ref' : 'dm'), etiketler: kisi?.etiketler || [], degiskenler: kisi?.degiskenler || {}, puan: kisi?.puan || 0 };
  if (olay.tip === 'comment' || olay.tip === 'live_comment') guncel.son_gelen = kisi?.son_gelen || null; // yorum pencere açmaz
  if (olay.ref && !kisi?.ref) guncel.ref = olay.ref;
  return db.kaydet('kisiler', { ...(kisi || {}), ...guncel }, { onek: 'kisi' });
}

async function gunlukYaz(db, olay, kisi, karar, ek = {}) {
  await db.kaydet('gunluk', { zaman: simdi(), kanal: olay.kanal, hesap_id: olay.hesap_id || '', kisi_id: kisi?.id, akis_id: karar.akisId, olay_tipi: olay.tip, olay_id: olay.olay_id, metin_ozeti: String(olay.text || olay.payload || '').slice(0, 200), karar, ...ek }, { onek: 'gun' });
}

async function sohbetGuncelle(db, kisi, olay, yon, metin) {
  const mevcut = (await db.listele('sohbetler', { k1: kisi.id, limit: 1 }))[0];
  const s = await db.kaydet('sohbetler', { ...(mevcut || {}), kisi_id: kisi.id, hesap_id: olay.hesap_id || '', son_mesaj_ozeti: String(metin || '').slice(0, 120), son_yon: yon, son_zaman: simdi(), durum: mevcut?.durum === 'kapali' ? 'acik' : mevcut?.durum || 'acik', okunmamis: yon === 'gelen' ? (mevcut?.okunmamis || 0) + 1 : mevcut?.okunmamis || 0 }, { onek: 'sohbet' });
  await db.kaydet('mesajlar', { sohbet_id: s.id, kisi_id: kisi.id, yon, metin: String(metin || '').slice(0, 4000), zaman: simdi(), kaynak: olay.tip }, { onek: 'msj' });
  return s;
}

/** Eylemleri kanala gönderir ya da PROVA'da yalnız günlüğe yazar. */
export async function eylemleriGonder(env, db, { hesap, kisi, olay, eylemler, fetchFn = fetch }) {
  const canli = hesap?.durum === 'canli' && String(env.PROVA || '1') !== '1' || hesap?.durum === 'canli' && String(env.PROVA) === '0';
  const sonuc = [];
  for (const e of eylemler) {
    if (!['mesaj', 'ozel_yanit', 'yorum_yanit', 'gizle'].includes(e.tip)) continue;
    let gonderildi = 0, hata = null;
    if (canli) {
      try {
        if (kisi.kanal === 'telegram') await tg.gonder(env, kisi, e, fetchFn);
        else if (kisi.kanal === 'instagram') { if (e.tip === 'mesaj' && !pencereAcik(kisi)) throw Object.assign(new Error('24 saat penceresi kapalı'), { pencere: true }); await meta.igGonder(env, kisi, e, fetchFn); }
        else if (kisi.kanal === 'whatsapp') { if (!pencereAcik(kisi)) throw Object.assign(new Error('24 saat penceresi kapalı'), { pencere: true }); await meta.waGonder(env, kisi, e, fetchFn); }
        gonderildi = 1;
      } catch (err) { hata = String(err.message || err); }
    }
    if (e.tip === 'mesaj' || e.tip === 'ozel_yanit') await sohbetGuncelle(db, kisi, olay, 'giden', (gonderildi ? '' : canli ? '⚠️ ' : '[prova] ') + e.text);
    sonuc.push({ tip: e.tip, gonderildi, prova: canli ? 0 : 1, hata });
  }
  return sonuc;
}

/** Ana giriş: bir olayı işler. `secenekler.fetchFn` testlerde sahte ağ. */
export async function olayIsle(env, db, olay, { fetchFn = fetch, hesaplar } = {}) {
  if (!olay || !olay.dis_id) return { atlandi: 'olay yok' };
  if (!(await db.gelenKaydet(olay))) return { atlandi: 'tekrar' };
  try {
    hesaplar = hesaplar || (await db.listele('hesaplar'));
    const hesap = hesaplar.find((h) => h.id === olay.hesap_id) || hesaplar.find((h) => h.kanal === olay.kanal) || null;
    if (hesap && !olay.hesap_id) olay.hesap_id = hesap.id;
    const kisi = await kisiUpsert(db, olay);
    if (olay.tip === 'dm' || olay.tip === 'story_reply') await sohbetGuncelle(db, kisi, olay, 'gelen', olay.text);
    if (olay.tip === 'buton' && olay.callback_id && olay.kanal === 'telegram') await tg.callbackKapat(env, olay.callback_id, fetchFn);

    const aktifKosu = await db.aktifKosu(kisi.id);
    const akislarListe = await db.listele('akislar');
    const akislar = Object.fromEntries(akislarListe.map((a) => [a.id, a]));
    const tetikleyiciler = await db.listele('tetikleyiciler');
    const ctx = { simdi, pencereAcik: (k) => pencereAcik(k), ai: async (a, kosu, k) => { const brif = a.brief_id ? await db.al('ai_brifingler', a.brief_id) : (await db.listele('ai_brifingler')).find((b) => b.aktif); return ajanCevap(env, db, { brifing: brif, mesaj: olay.text, kanal: olay.kanal }, fetchFn); }, webhook: async (a, kosu, k) => { const r = await fetchFn(a.url, { method: a.method || 'POST', headers: { 'Content-Type': 'application/json' }, body: a.method === 'GET' ? undefined : (a.body ? a.body.replace(/\{\{(\w+)\}\}/g, (_, n) => kosu.degiskenler[n] ?? k.degiskenler?.[n] ?? '') : JSON.stringify({ kisi: k.id, degiskenler: kosu.degiskenler })), signal: AbortSignal.timeout(a.timeout_ms || 5000) }); if (!r.ok) throw new Error('webhook ' + r.status); const ct = r.headers.get('content-type') || ''; return ct.includes('json') ? r.json() : r.text(); } };

    let sonuc;
    // Buton olayı: bekleyen koşuya doğrudan uygula.
    if (olay.tip === 'buton') {
      if (!aktifKosu) { await gunlukYaz(db, olay, kisi, { tur: 'yok', sebep: 'bekleyen koşu yok' }); await db.gelenBitir(olay.olay_id); return { karar: 'yok' }; }
      const adim = aktifKosu.adimlar_anlik[olay.adim]; const secenek = adim?.choices?.[olay.secenekIdx];
      sonuc = await ilerlet(aktifKosu, kisi, { tur: 'buton', label: secenek?.label || olay.text, value: secenek?.value, adim: olay.adim }, ctx);
      sonuc.akisId = aktifKosu.akis_id;
    } else {
      const e = esle({ olay: { ...olay, tip: olay.tip === 'story_reply' ? 'story_reply' : olay.tip }, tetikleyiciler, akislar, aktifKosu, sonBaslatmalar: kisi.son_baslatmalar || {}, simdi });
      if (e.karar === 'cevap') { sonuc = await ilerlet(e.kosu, kisi, { tur: e.kosu.bekleme === 'window' ? 'pencere' : 'metin', text: olay.text }, ctx); sonuc.akisId = e.kosu.akis_id; }
      else if (e.karar === 'tetik') {
        if (e.bastir) await db.kaydet('kosular', { ...e.bastir, durum: 'superseded' }, { onek: 'kosu' });
        sonuc = await baslat({ akis: e.akis, kisi, hesap_id: olay.hesap_id, tetik: e.tetik.tip, baglam: { yorumId: olay.yorumId, gonderiId: olay.gonderiId, ref: olay.ref } }, ctx);
        sonuc.akisId = e.akis.id; sonuc.tetik = e.tetik;
        sonuc.kisi.son_baslatmalar = { ...(kisi.son_baslatmalar || {}), [e.akis.id]: simdi() };
      } else {
        // Akış yok: yorumlarda kural motoru; DM'de aktif ajan.
        if (olay.tip === 'comment' || olay.tip === 'live_comment') {
          const kurallar = await db.listele('kurallar');
          const { kurallar: k } = kurallariAyristir(kurallar.sort((a, b) => (a.sira || 0) - (b.sira || 0)));
          const gunlukLimit = hesap?.yorum_yanit?.gunlukLimit || 150;
          const bugun = await db.sayac('yorum_yanit');
          const c = kuralKarari(k, { text: olay.text, kanal: olay.kanal, username: olay.kullanici_adi, anahtar: olay.yorumId });
          const eylemler = [];
          if (c.tur === 'gizle' && c.gizle) eylemler.push({ tip: 'gizle', yorumId: olay.yorumId });
          if (c.tur === 'cevap' && bugun < gunlukLimit) { if (c.metin) eylemler.push({ tip: 'yorum_yanit', text: c.metin, yorumId: olay.yorumId }); if (c.ozelYanit) eylemler.push({ tip: 'ozel_yanit', text: c.ozelYanit, yorumId: olay.yorumId }); }
          const gonderim = await eylemleriGonder(env, db, { hesap, kisi, olay, eylemler, fetchFn });
          if (gonderim.some((g) => g.tip === 'yorum_yanit')) await db.sayacArtir('yorum_yanit');
          await gunlukYaz(db, olay, kisi, { tur: 'kural', kural: c.kural, sonuc: c.tur, sebep: c.sebep, limitDoldu: bugun >= gunlukLimit }, { eylemler: gonderim, prova: gonderim[0]?.prova ?? 1, gonderildi: gonderim.some((g) => g.gonderildi) ? 1 : 0 });
          await db.gelenBitir(olay.olay_id);
          return { karar: 'kural', kural: c.kural, tur: c.tur };
        }
        const brif = (await db.listele('ai_brifingler')).find((b) => b.aktif);
        if (brif && (olay.tip === 'dm' || (olay.tip === 'story_reply' && brif.storylereCevap)) && kelimeVar(olay.text) && !(kisi.ai_sustur_bitis && kisi.ai_sustur_bitis > simdi())) {
          const devir = (brif.devirKelimeleri || []).some((d) => olay.text.toLowerCase().includes(d.toLowerCase()));
          const gecmis = await db.listele('mesajlar', { k1: (await db.listele('sohbetler', { k1: kisi.id, limit: 1 }))[0]?.id, limit: 8 });
          const cevap = devir ? null : await ajanCevap(env, db, { brifing: brif, mesaj: olay.text, gecmis, kanal: olay.kanal }, fetchFn);
          if (cevap) {
            const gonderim = await eylemleriGonder(env, db, { hesap, kisi, olay, eylemler: [{ tip: 'mesaj', text: cevap }], fetchFn });
            await gunlukYaz(db, olay, kisi, { tur: 'ai', brifing: brif.id }, { eylemler: gonderim, prova: gonderim[0]?.prova ?? 1, gonderildi: gonderim[0]?.gonderildi || 0 });
          } else {
            await db.kaydet('cevapsiz_sorular', { soru: String(olay.text).slice(0, 300), kisi_id: kisi.id, durum: 'acik', devir }, { onek: 'soru' });
            await gunlukYaz(db, olay, kisi, { tur: 'ai', sonuc: devir ? 'devir' : 'skip' });
          }
          await db.gelenBitir(olay.olay_id);
          return { karar: 'ai', cevapVar: !!cevap };
        }
        await gunlukYaz(db, olay, kisi, { tur: 'yok', sebep: 'tetikleyici eşleşmedi' });
        await db.gelenBitir(olay.olay_id);
        return { karar: 'yok' };
      }
    }
    // Koşu ilerledi: eylemleri gönder, koşu/kişi/puan/günlük yaz.
    const gonderim = await eylemleriGonder(env, db, { hesap, kisi: sonuc.kisi, olay, eylemler: sonuc.eylemler, fetchFn });
    for (const e of sonuc.eylemler) if (e.tip === 'puan') { try { await db.kaydet('puan_olaylari', { kisi_id: kisi.id, delta: e.delta, neden: e.reason, kaynak: 'akis', olay_anahtari: e.olay_anahtari, akis_id: sonuc.akisId }, { onek: 'puan' }); } catch {} }
    if (sonuc.kosu.bekleme === 'window') sonuc.kosu.devam_zamani = '';
    await db.kaydet('kosular', sonuc.kosu, { onek: 'kosu' });
    await db.kaydet('kisiler', { ...sonuc.kisi, son_gelen: kisi.son_gelen, son_baslatmalar: sonuc.kisi.son_baslatmalar || kisi.son_baslatmalar }, { onek: 'kisi' });
    await gunlukYaz(db, olay, kisi, { tur: 'akis', akisId: sonuc.akisId, kosuId: sonuc.kosu.id, adim: sonuc.kosu.adim, durum: sonuc.kosu.durum, tetik: sonuc.tetik?.tip }, { eylemler: gonderim, prova: gonderim[0]?.prova ?? 1, gonderildi: gonderim.some((g) => g.gonderildi) ? 1 : 0 });
    if (olay.tip === 'start' || olay.tip === 'dm' || olay.tip === 'story_reply') await db.sayacArtir('olay');
    if (sonuc.kosu.durum === 'finished') await db.sayacArtir('akis_bitti');
    if (sonuc.tetik) await db.sayacArtir('akis_basladi');
    await db.gelenBitir(olay.olay_id);
    return { karar: 'akis', kosu: sonuc.kosu.id, durum: sonuc.kosu.durum, eylemler: gonderim.length };
  } catch (err) {
    await db.gelenBitir(olay.olay_id, 'hata');
    throw err;
  }
}

/** Cron: zamanı gelen gecikmeli koşuları devam ettirir. */
export async function gecikenleriKostur(env, db, { fetchFn = fetch, limit = 50 } = {}) {
  const kosular = await db.zamaniGelenKosular(simdi(), limit);
  const hesaplar = await db.listele('hesaplar');
  let n = 0;
  for (const kosu of kosular) {
    const kisi = await db.al('kisiler', kosu.kisi_id); if (!kisi) { await db.kaydet('kosular', { ...kosu, durum: 'failed', hata: 'kişi yok' }); continue; }
    const hesap = hesaplar.find((h) => h.id === kosu.hesap_id) || hesaplar.find((h) => h.kanal === kisi.kanal);
    const sonuc = await ilerlet(kosu, kisi, { tur: 'zaman' }, { simdi, pencereAcik });
    const olay = { kanal: kisi.kanal, hesap_id: kosu.hesap_id, tip: 'zaman', text: '', dis_id: kisi.dis_id };
    const gonderim = await eylemleriGonder(env, db, { hesap, kisi: sonuc.kisi, olay, eylemler: sonuc.eylemler, fetchFn });
    await db.kaydet('kosular', sonuc.kosu, { onek: 'kosu' });
    await db.kaydet('kisiler', sonuc.kisi, { onek: 'kisi' });
    await gunlukYaz(db, olay, kisi, { tur: 'akis', akisId: kosu.akis_id, kosuId: kosu.id, adim: sonuc.kosu.adim, durum: sonuc.kosu.durum }, { eylemler: gonderim, prova: gonderim[0]?.prova ?? 1 });
    n++;
  }
  return n;
}
