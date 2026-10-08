// Yayınlama: PROVA'da dış çağrı yok; canlıda Facebook (tek fotoğraf, çoklu
// fotoğraf) ve Instagram (tek görsel, karusel) Graph çağrıları doğru alanlarla;
// token Authorization başlığında (URL'de asla), appsecret_proof; konak ve token
// seçimi (IG > kullanıcı > Sayfa); Meta hata sözlüğü ve kayda eşleme; kota ön
// denetimi; tekrar koruması; alt metin; doğrulama; token sızmaz; kendi /g/
// adresini çekmez.
import { describe, it, expect } from 'vitest';
import { kur, KOK, SAHIP, ARKADAS, metaTaklidi, appsecretProofHesapla } from './yardim.js';
import { fbFotoYayinla, igYayinla, hataKodu, MetaHatasi } from '../../sunucu/meta.js';

const SAYFA_TOKEN = 'EAAGsayfaGIZLI123';
const IG_TOKEN = 'IGQVJigGIZLI456';
const KULLANICI_TOKEN = 'EAAGkullaniciGIZLI789';
const APP_SECRET = 'cok-gizli-app-secret';
const IG_ID = '17841400000';
const CANLI = { PROVA: '0', META_SAYFA_TOKEN: SAYFA_TOKEN, META_SAYFA_ID: '111222', META_IG_ID: IG_ID };
const GIZLILER = [SAYFA_TOKEN, IG_TOKEN, KULLANICI_TOKEN, APP_SECRET];

/** Canlı ortam + sahte Meta; döner { k, m, j (jeton) }. */
async function canli(ek = {}, taklit = {}) {
  const m = metaTaklidi(taklit);
  const k = kur({ ...CANLI, ...ek }, { getir: m.getir });
  const j = await k.gir(SAHIP);
  return { k, m, j };
}

const yayinla = (k, j, govde) => k.jsonIste('yayinla', { method: 'POST', jeton: j, govde: { urun: 'dawayar', baslik: 'Tanıtım', metin: 'Merhaba', ...govde } });

/** Her çağrı: yalnız Graph konakları (kendi /g/ adresi değil), token yalnız Bearer başlığında, URL'de ve gövdede hiçbir gizli değer yok. */
function cagrilarTemiz(m, token) {
  expect(m.cagrilar.length).toBeGreaterThan(0);
  for (const c of m.cagrilar) {
    expect(c.konak).toMatch(/^graph\.(facebook|instagram)\.com$/);
    expect(c.basliklar.authorization).toBe('Bearer ' + token);
    expect(c.ham).not.toContain('access_token=');
    for (const g of GIZLILER) expect(c.ham).not.toContain(g);
    expect(c.alanlar.access_token).toBeUndefined();
  }
}

describe('PROVA', () => {
  it('dış çağrı yok; kayıt prova, dis_id prova-N; secret olmasa da çalışır', async () => {
    const m = metaTaklidi();
    const k = kur({ PROVA: '1' }, { getir: m.getir });
    const j = await k.gir(ARKADAS);
    const [id] = await k.gorseller(j);
    const r = await yayinla(k, j, { kanal: 'instagram', gorseller: [id] });
    expect(r.durum).toBe(200);
    expect(r.veri.sonuc).toEqual({ dis_id: 'prova-1', prova: true });
    expect(r.veri.kayit).toMatchObject({ id: 1, kim: ARKADAS, urun: 'dawayar', kanal: 'instagram', bicim: 'tek', durum: 'prova', dis_id: 'prova-1', hata: null, baslik: 'Tanıtım' });
    expect(m.cagrilar).toHaveLength(0);
    const l = await k.jsonIste('kayit', { jeton: j });
    expect(l.veri.kayitlar[0]).toMatchObject({ durum: 'prova', dis_id: 'prova-1' });
    // Karusel biçimi kendiliğinden; aynı metin provada tekrar sayılmaz (yalnız 'yayinlandi' sayılır).
    const ids = await k.gorseller(j, 3);
    expect((await yayinla(k, j, { kanal: 'facebook', gorseller: ids })).veri.kayit.bicim).toBe('karusel');
    expect((await yayinla(k, j, { kanal: 'instagram', gorseller: [id] })).durum).toBe(200);
    // Kanallar PROVA'da da gerçek secret durumunu söyler; kota sorulmaz.
    expect((await k.jsonIste('kanallar', { jeton: j })).veri).toMatchObject({ prova: true, facebook: { bagli: false }, instagram: { bagli: false, kullaniciToken: false, kota: null } });
    expect(m.cagrilar).toHaveLength(0);
  });
});

describe('Facebook (canlı)', () => {
  it('tek görsel → POST /{sayfa}/photos: url = /g/ adresi, caption, published=true; token Bearer başlığında, URL\'de değil', async () => {
    const { k, m, j } = await canli();
    const [id] = await k.gorseller(j);
    const r = await yayinla(k, j, { kanal: 'facebook', gorseller: [id], metin: 'Dawayar çıktı!\n\n#eczane' });
    expect(r.durum).toBe(200);
    expect(r.veri.sonuc).toEqual({ dis_id: 'sayfa_1', prova: false });
    expect(r.veri.kayit).toMatchObject({ durum: 'yayinlandi', dis_id: 'sayfa_1', hata: null, kanal: 'facebook' });
    expect(m.cagrilar).toHaveLength(1);
    const c = m.cagrilar[0];
    expect(c.konak).toBe('graph.facebook.com');
    expect(c.yol).toBe('/v26.0/111222/photos');
    expect(c.method).toBe('POST');
    expect(c.govde).toEqual({ url: `${KOK}/g/${id}.jpg`, caption: 'Dawayar çıktı!\n\n#eczane', published: 'true' });
    expect(c.govde.message).toBeUndefined();
    expect(c.query).toEqual({});
    cagrilarTemiz(m, SAYFA_TOKEN);
  });

  it('3 görsel → 3×photos published=false + 1×feed message + attached_media', async () => {
    const { k, m, j } = await canli();
    const ids = await k.gorseller(j, 3);
    const r = await yayinla(k, j, { kanal: 'facebook', gorseller: ids, metin: 'Üç görsel' });
    expect(r.durum).toBe(200);
    expect(r.veri.sonuc.dis_id).toBe('akis_4');
    expect(m.cagrilar).toHaveLength(4);
    for (let i = 0; i < 3; i++) {
      expect(m.cagrilar[i].yol).toBe('/v26.0/111222/photos');
      expect(m.cagrilar[i].govde).toEqual({ url: `${KOK}/g/${ids[i]}.jpg`, published: 'false' });
    }
    const akis = m.cagrilar[3];
    expect(akis.yol).toBe('/v26.0/111222/feed');
    expect(akis.govde.message).toBe('Üç görsel');
    expect(JSON.parse(akis.govde.attached_media)).toEqual([{ media_fbid: 'foto1' }, { media_fbid: 'foto2' }, { media_fbid: 'foto3' }]);
    cagrilarTemiz(m, SAYFA_TOKEN);
  });

  it('GRAPH_SURUM yoldadır; Facebook kotaya bakmaz', async () => {
    const { k, m, j } = await canli({ GRAPH_SURUM: 'v27.0' });
    const [id] = await k.gorseller(j);
    await yayinla(k, j, { kanal: 'facebook', gorseller: [id] });
    expect(m.cagrilar.map((c) => c.yol)).toEqual(['/v27.0/111222/photos']);
  });
});

describe('Instagram (canlı)', () => {
  it('tek görsel → kota → media (image_url, caption) → durum döngüsü (IN_PROGRESS, FINISHED) → media_publish creation_id; Sayfa token\'ıyla graph.facebook.com', async () => {
    const { k, m, j } = await canli({}, { durumlar: ['IN_PROGRESS', 'FINISHED'] });
    const [id] = await k.gorseller(j);
    const r = await yayinla(k, j, { kanal: 'instagram', gorseller: [id], metin: 'Instagram açıklaması' });
    expect(r.durum).toBe(200);
    expect(r.veri.sonuc.dis_id).toBe('ig_2');
    expect(m.cagrilar.map((c) => `${c.method} ${c.yol}`)).toEqual([
      `GET /v26.0/${IG_ID}/content_publishing_limit`,
      `POST /v26.0/${IG_ID}/media`, 'GET /v26.0/kap1', 'GET /v26.0/kap1', `POST /v26.0/${IG_ID}/media_publish`,
    ]);
    expect(m.cagrilar.every((c) => c.konak === 'graph.facebook.com')).toBe(true);
    expect(m.cagrilar[1].govde).toEqual({ image_url: `${KOK}/g/${id}.jpg`, caption: 'Instagram açıklaması' });
    expect(m.cagrilar[2].query).toEqual({ fields: 'status_code,status' });
    expect(m.cagrilar[4].govde).toEqual({ creation_id: 'kap1' });
    cagrilarTemiz(m, SAYFA_TOKEN);
    expect((await k.jsonIste('kanallar', { jeton: j })).veri.instagram).toEqual({ bagli: true, igId: IG_ID, yol: 'facebook', kullaniciToken: false, kota: { kullanilan: 3, sinir: 50 } });
  });

  it('karusel → çocuklar is_carousel_item (açıklamasız) → her çocuk FINISHED → kap CAROUSEL children → yayın', async () => {
    const { k, m, j } = await canli();
    const ids = await k.gorseller(j, 3);
    const r = await yayinla(k, j, { kanal: 'instagram', gorseller: ids, metin: 'Karusel' });
    expect(r.durum).toBe(200);
    const yollar = m.cagrilar.slice(1).map((c) => `${c.method} ${c.yol.replace('/v26.0/', '')}`);
    expect(yollar).toEqual([
      `POST ${IG_ID}/media`, `POST ${IG_ID}/media`, `POST ${IG_ID}/media`,
      'GET kap1', 'GET kap2', 'GET kap3',
      `POST ${IG_ID}/media`, 'GET kap4', `POST ${IG_ID}/media_publish`,
    ]);
    for (let i = 1; i <= 3; i++) expect(m.cagrilar[i].govde).toEqual({ image_url: `${KOK}/g/${ids[i - 1]}.jpg`, is_carousel_item: 'true' });
    expect(m.cagrilar[7].govde).toEqual({ media_type: 'CAROUSEL', children: 'kap1,kap2,kap3', caption: 'Karusel' });
    expect(m.cagrilar[9].govde).toEqual({ creation_id: 'kap4' });
    expect(r.veri.kayit).toMatchObject({ bicim: 'karusel', durum: 'yayinlandi', dis_id: 'ig_5' });
  });

  it('altMetin → media çağrılarında alt_text (tek görsel ve karusel çocukları; CAROUSEL kabında ve Facebook\'ta yok)', async () => {
    const { k, m, j } = await canli();
    const ids = await k.gorseller(j, 3);
    await yayinla(k, j, { kanal: 'instagram', gorseller: [ids[0]], altMetin: ' Mavi arka planda Dawayar logosu ' });
    const medya = m.cagrilar.filter((c) => c.yol.endsWith('/media'));
    expect(medya).toHaveLength(1);
    expect(medya[0].govde.alt_text).toBe('Mavi arka planda Dawayar logosu');
    m.cagrilar.length = 0;
    await yayinla(k, j, { kanal: 'instagram', gorseller: ids.slice(1), metin: 'iki', altMetin: 'Ürün ekranı' });
    const kaplar = m.cagrilar.filter((c) => c.yol.endsWith('/media'));
    expect(kaplar).toHaveLength(3);
    expect(kaplar[0].govde).toEqual({ image_url: `${KOK}/g/${ids[1]}.jpg`, is_carousel_item: 'true', alt_text: 'Ürün ekranı' });
    expect(kaplar[1].govde.alt_text).toBe('Ürün ekranı');
    expect(kaplar[2].govde).toEqual({ media_type: 'CAROUSEL', children: 'kap3,kap4', caption: 'iki' }); // kap1 ve ig_2 ilk yayından
    m.cagrilar.length = 0;
    await yayinla(k, j, { kanal: 'facebook', gorseller: [ids[0]], metin: 'fb', altMetin: 'yok sayılır' });
    expect(m.cagrilar[0].ham).not.toContain('alt_text');
    // alt metin 1000 karaktere kısaltılır, metin değilse 400
    expect(await yayinla(k, j, { kanal: 'facebook', gorseller: [ids[0]], metin: 'x', altMetin: 7 })).toMatchObject({ durum: 400, veri: { hata: 'gecersiz', alan: 'altMetin' } });
  });

  it('META_IG_TOKEN varsa graph.instagram.com + o token; Facebook yine graph.facebook.com + Sayfa token\'ı', async () => {
    const { k, m, j } = await canli({ META_IG_TOKEN: IG_TOKEN, META_KULLANICI_TOKEN: KULLANICI_TOKEN });
    const ids = await k.gorseller(j, 2);
    await yayinla(k, j, { kanal: 'instagram', gorseller: [ids[0]] });
    expect(m.cagrilar.every((c) => c.konak === 'graph.instagram.com')).toBe(true);
    cagrilarTemiz(m, IG_TOKEN); // IG > kullanıcı > Sayfa
    m.cagrilar.length = 0;
    await yayinla(k, j, { kanal: 'facebook', gorseller: [ids[1]], metin: 'fb' });
    expect(m.cagrilar[0].konak).toBe('graph.facebook.com');
    cagrilarTemiz(m, SAYFA_TOKEN);
    m.cagrilar.length = 0;
    expect((await k.jsonIste('kanallar', { jeton: j })).veri.instagram).toMatchObject({ yol: 'instagram', kullaniciToken: true });
    expect(m.cagrilar.at(-1)).toMatchObject({ konak: 'graph.instagram.com', yol: `/v26.0/${IG_ID}/content_publishing_limit` });
  });

  it('META_KULLANICI_TOKEN varsa (IG token yok) Instagram kap, durum sorgusu ve yayın onunla; Facebook Sayfa token\'ıyla', async () => {
    const { k, m, j } = await canli({ META_KULLANICI_TOKEN: KULLANICI_TOKEN }, { durumlar: ['IN_PROGRESS', 'FINISHED'] });
    const ids = await k.gorseller(j, 2);
    await yayinla(k, j, { kanal: 'instagram', gorseller: [ids[0]] });
    expect(m.cagrilar.map((c) => c.method)).toEqual(['GET', 'POST', 'GET', 'GET', 'POST']);
    expect(m.cagrilar.every((c) => c.konak === 'graph.facebook.com')).toBe(true);
    cagrilarTemiz(m, KULLANICI_TOKEN);
    m.cagrilar.length = 0;
    await yayinla(k, j, { kanal: 'facebook', gorseller: [ids[1]], metin: 'fb' });
    cagrilarTemiz(m, SAYFA_TOKEN);
    expect((await k.jsonIste('kanallar', { jeton: j })).veri.instagram).toMatchObject({ bagli: true, yol: 'facebook', kullaniciToken: true });
    // Yalnız kullanıcı token'ı + IG kimliği de Instagram'ı bağlar.
    expect((await k.jsonIste('durum')).veri.kanallar.instagram.bagli).toBe(true);
    const k2 = kur({ PROVA: '0', META_IG_ID: IG_ID, META_KULLANICI_TOKEN: KULLANICI_TOKEN });
    expect((await k2.jsonIste('durum')).veri.kanallar).toEqual({ facebook: { bagli: false }, instagram: { bagli: true } });
  });

  it('META_APP_SECRET varsa her çağrıda doğru appsecret_proof (POST form, GET sorgu); secret URL\'de ve gövdede yok', async () => {
    const { k, m, j } = await canli({ META_APP_SECRET: APP_SECRET, META_IG_TOKEN: IG_TOKEN }, { durumlar: ['IN_PROGRESS', 'FINISHED'] });
    const ids = await k.gorseller(j, 2);
    await yayinla(k, j, { kanal: 'instagram', gorseller: [ids[0]] });
    const igProof = await appsecretProofHesapla(IG_TOKEN, APP_SECRET);
    expect(m.cagrilar).toHaveLength(5);
    for (const c of m.cagrilar) {
      expect(c.method === 'GET' ? c.query.appsecret_proof : c.govde.appsecret_proof).toBe(igProof);
      expect(c.method === 'GET' ? c.govde.appsecret_proof : c.query.appsecret_proof).toBeUndefined();
    }
    cagrilarTemiz(m, IG_TOKEN);
    m.cagrilar.length = 0;
    await yayinla(k, j, { kanal: 'facebook', gorseller: [ids[1]], metin: 'fb' });
    expect(m.cagrilar[0].govde.appsecret_proof).toBe(await appsecretProofHesapla(SAYFA_TOKEN, APP_SECRET)); // Sayfa token'ının kanıtı
    expect(igProof).not.toBe(m.cagrilar[0].govde.appsecret_proof);
  });

  it('kap ERROR → 502 gorsel ve kayıt hata; yayın çağrısı yapılmaz', async () => {
    const { k, m, j } = await canli({}, { durumlar: ['IN_PROGRESS', 'ERROR'] });
    const [id] = await k.gorseller(j);
    const r = await yayinla(k, j, { kanal: 'instagram', gorseller: [id] });
    expect(r).toMatchObject({ durum: 502, veri: { hata: 'meta', kod: 'gorsel', meta_kod: null, meta_alt_kod: null } });
    expect(m.cagrilar.some((c) => c.yol.endsWith('/media_publish'))).toBe(false);
    expect((await k.jsonIste('kayit', { jeton: j })).veri.kayitlar[0]).toMatchObject({ durum: 'hata', hata: 'gorsel', dis_id: null });
  });

  it('kap 12 denemede hazır olmazsa 502 kod bekle; bekle her aralıkta çağrılır', async () => {
    const m = metaTaklidi({ durumlar: ['IN_PROGRESS'] });
    const beklemeler = [];
    const k = kur(CANLI, { getir: m.getir, bekle: async (ms) => { beklemeler.push(ms); } });
    const j = await k.gir();
    const [id] = await k.gorseller(j);
    const r = await yayinla(k, j, { kanal: 'instagram', gorseller: [id] });
    expect(r).toMatchObject({ durum: 502, veri: { hata: 'meta', kod: 'bekle' } });
    expect(m.cagrilar.filter((c) => c.method === 'GET' && c.query.fields === 'status_code,status')).toHaveLength(12);
    expect(beklemeler).toEqual(Array(11).fill(1500));
    expect((await k.jsonIste('kayit', { jeton: j })).veri.kayitlar[0]).toMatchObject({ durum: 'hata', hata: 'bekle' });
  });

  it('kota doluysa 429 kota, kayıt hata/kota, Meta\'ya yayın çağrısı yok; kota okunamazsa devam', async () => {
    const { k, m, j } = await canli({}, { kota: { quota_usage: 50, config: { quota_total: 50, quota_duration: 'DAY' } } });
    const [id] = await k.gorseller(j);
    expect(await yayinla(k, j, { kanal: 'instagram', gorseller: [id] })).toMatchObject({ durum: 429, veri: { hata: 'kota', kullanilan: 50, sinir: 50 } });
    expect(m.cagrilar.map((c) => c.yol)).toEqual([`/v26.0/${IG_ID}/content_publishing_limit`]);
    expect((await k.jsonIste('kayit', { jeton: j })).veri.kayitlar[0]).toMatchObject({ durum: 'hata', hata: 'kota', kanal: 'instagram' });
    // Kota yanıtı beklenen biçimde değilse engel yok.
    const bos = await canli({}, { kota: {} });
    const [id2] = await bos.k.gorseller(bos.j);
    expect((await yayinla(bos.k, bos.j, { kanal: 'instagram', gorseller: [id2] })).durum).toBe(200);
    expect(bos.m.cagrilar.map((c) => c.method)).toEqual(['GET', 'POST', 'GET', 'POST']);
    // Kota çağrısı patlasa da (ağ) engel yok.
    let ilk = true;
    const m3 = metaTaklidi();
    const getir = async (u, o) => { if (ilk) { ilk = false; throw new TypeError('fetch failed'); } return m3.getir(u, o); };
    const k3 = kur(CANLI, { getir });
    const j3 = await k3.gir();
    const [id3] = await k3.gorseller(j3);
    expect((await yayinla(k3, j3, { kanal: 'instagram', gorseller: [id3] })).durum).toBe(200);
  });
});

describe('tekrar koruması', () => {
  it('aynı kanalda son 24 saatte yayınlanmış aynı metin (boşluk farkı önemsiz) → 409 tekrar; zorla geçer; başka kanal ve 24 saat sonrası serbest', async () => {
    const { k, m, j } = await canli();
    const ids = await k.gorseller(j, 3);
    expect((await yayinla(k, j, { kanal: 'facebook', gorseller: [ids[0]], metin: 'Aynı  metin\n#etiket ' })).durum).toBe(200);
    const r = await yayinla(k, j, { kanal: 'facebook', gorseller: [ids[1]], metin: ' Aynı metin #etiket' });
    expect(r.durum).toBe(409);
    expect(r.veri).toMatchObject({ hata: 'tekrar', onceki: { id: 1 } });
    expect(m.cagrilar).toHaveLength(1); // Meta'ya gidilmedi
    expect(k.sql('SELECT durum FROM kayitlar')).toEqual([{ durum: 'yayinlandi' }]); // reddedilen istek kayıt açmaz
    // Farklı metin ve başka kanal serbest.
    expect((await yayinla(k, j, { kanal: 'facebook', gorseller: [ids[1]], metin: 'Aynı metin #etiket2' })).durum).toBe(200);
    expect((await yayinla(k, j, { kanal: 'instagram', gorseller: [ids[2]], metin: 'Aynı metin #etiket' })).durum).toBe(200);
    // İkinci reklamcı da aynı korumaya takılır; zorla geçer.
    const j2 = await k.gir(ARKADAS);
    expect((await yayinla(k, j2, { kanal: 'facebook', gorseller: [ids[2]], metin: 'Aynı metin #etiket' })).durum).toBe(409);
    expect((await yayinla(k, j2, { kanal: 'facebook', gorseller: [ids[2]], metin: 'Aynı metin #etiket', zorla: true })).durum).toBe(200);
    expect(await yayinla(k, j2, { kanal: 'facebook', gorseller: [ids[2]], metin: 'x', zorla: 'evet' })).toMatchObject({ durum: 400, veri: { hata: 'gecersiz', alan: 'zorla' } });
    // 24 saat geçince serbest.
    k.sql('UPDATE kayitlar SET zaman = zaman - 25 * 3600000');
    expect((await yayinla(k, j, { kanal: 'facebook', gorseller: [ids[0]], metin: 'Aynı metin #etiket' })).durum).toBe(200);
  });

  it('hata ve prova kayıtları sayılmaz; boş metin denetlenmez', async () => {
    const { k, m, j } = await canli({}, { hata: { code: 1, message: 'geçici' } });
    const ids = await k.gorseller(j, 2);
    expect((await yayinla(k, j, { kanal: 'facebook', gorseller: [ids[0]], metin: 'Deneme' })).durum).toBe(502);
    m.hata = null;
    expect((await yayinla(k, j, { kanal: 'facebook', gorseller: [ids[0]], metin: 'Deneme' })).durum).toBe(200); // hata kaydı engel değil
    expect((await yayinla(k, j, { kanal: 'facebook', gorseller: [ids[0]], metin: '' })).durum).toBe(200);
    expect((await yayinla(k, j, { kanal: 'facebook', gorseller: [ids[1]], metin: '  ' })).durum).toBe(200); // boş metin tekrar değil
    expect(k.sql('SELECT metin_ozet FROM kayitlar WHERE id = 3')).toEqual([{ metin_ozet: null }]);
  });
});

describe('Meta hataları', () => {
  it('Graph 190 → 502 kod yeniden_baglan, meta_kod 190, meta_alt_kod; kayıt hata/yeniden_baglan', async () => {
    const { k, j } = await canli({}, { hata: { code: 190, subcode: 463, message: 'Error validating access token: Session has expired' } });
    const [id] = await k.gorseller(j);
    const r = await yayinla(k, j, { kanal: 'facebook', gorseller: [id] });
    expect(r.durum).toBe(502);
    expect(r.veri).toEqual({ hata: 'meta', kod: 'yeniden_baglan', meta_kod: 190, meta_alt_kod: 463 });
    const l = await k.jsonIste('kayit', { jeton: j });
    expect(l.veri.kayitlar).toHaveLength(1);
    expect(l.veri.kayitlar[0]).toMatchObject({ durum: 'hata', hata: 'yeniden_baglan', dis_id: null, kanal: 'facebook' });
  });

  it('mesajda kimlik onayı → kod kimlik_dogrulama; alt kod eşlemesi yanıtta', async () => {
    const { k, j } = await canli({}, { hata: { code: 200, message: '(#200) The page requires Page Publishing Authorization before posting' } });
    const [id] = await k.gorseller(j);
    expect(await yayinla(k, j, { kanal: 'facebook', gorseller: [id] })).toMatchObject({ durum: 502, veri: { kod: 'kimlik_dogrulama', meta_kod: 200 } });
    const k2 = await canli({}, { hata: { code: 1, subcode: 2207042, message: 'quota' } });
    const [id2] = await k2.k.gorseller(k2.j);
    expect(await yayinla(k2.k, k2.j, { kanal: 'instagram', gorseller: [id2] })).toMatchObject({ durum: 502, veri: { kod: 'kota', meta_kod: 1, meta_alt_kod: 2207042 } });
  });

  it('hata sözlüğü (kod, altKod, mesaj)', () => {
    expect(hataKodu(190)).toBe('yeniden_baglan');
    expect(hataKodu(190, 460, 'confirm your identity')).toBe('yeniden_baglan'); // 190 her alt kodda
    for (const [kod, alt] of [[9004, 2207052], [36001, 2207005], [36000, 2207004], [36003, 2207009]]) {
      expect(hataKodu(kod)).toBe('gorsel');
      expect(hataKodu(1, alt)).toBe('gorsel');
    }
    expect(hataKodu(36004)).toBe('metin_uzun');
    expect(hataKodu(1, 2207010)).toBe('metin_uzun');
    expect(hataKodu(9)).toBe('kota');
    expect(hataKodu(1, 2207042)).toBe('kota');
    for (const kod of [4, 17, 32, 613]) expect(hataKodu(kod)).toBe('oran');
    expect(hataKodu(1, 2207051)).toBe('oran');
    expect(hataKodu(9007)).toBe('bekle');
    expect(hataKodu(1, 2207027)).toBe('bekle');
    expect(hataKodu(506)).toBe('tekrar');
    expect(hataKodu(100, 33)).toBe('izin');
    expect(hataKodu(100)).toBe('meta');
    for (const kod of [10, 200, 230, 299]) expect(hataKodu(kod)).toBe('izin');
    expect(hataKodu(200, undefined, 'requires Page Publishing Authorization')).toBe('kimlik_dogrulama');
    expect(hataKodu(1, undefined, 'Please confirm your identity to continue')).toBe('kimlik_dogrulama');
    expect(hataKodu(368, undefined, 'identity verification required')).toBe('kimlik_dogrulama');
    for (const kod of [1, 2, 300, 36008, null, undefined]) expect(hataKodu(kod)).toBe('meta');
  });

  it('ağ hatası (fetch fırlatır) → 502 kod meta, meta_kod null; kayıt hata', async () => {
    const k = kur(CANLI, { getir: async () => { throw new TypeError('fetch failed'); } });
    const j = await k.gir();
    const [id] = await k.gorseller(j);
    expect(await yayinla(k, j, { kanal: 'facebook', gorseller: [id] })).toMatchObject({ durum: 502, veri: { hata: 'meta', kod: 'meta', meta_kod: null, meta_alt_kod: null } });
    expect((await k.jsonIste('kayit', { jeton: j })).veri.kayitlar[0]).toMatchObject({ durum: 'hata', hata: 'meta' });
  });

  it('gizli değerler hiçbir hata mesajında ve yanıtta yok (Meta yankılasa bile)', async () => {
    const env = { ...CANLI, META_IG_TOKEN: IG_TOKEN, META_KULLANICI_TOKEN: KULLANICI_TOKEN, META_APP_SECRET: APP_SECRET };
    const yankila = async (url, o) => new Response(JSON.stringify({ error: {
      code: 190, message: `Invalid request ${url} access_token=${SAYFA_TOKEN} ${o.headers.Authorization} ${IG_TOKEN} ${KULLANICI_TOKEN} ${APP_SECRET}`,
    } }), { status: 400 });
    const e1 = await fbFotoYayinla(env, { gorselAdresi: 'https://x/g/a.jpg', mesaj: '' }, yankila).catch((e) => e);
    expect(e1).toBeInstanceOf(MetaHatasi);
    expect(e1.kod).toBe('yeniden_baglan');
    for (const g of GIZLILER) expect(e1.message).not.toContain(g);
    expect(e1.message).toContain('access_token=***');
    const e2 = await igYayinla(env, { gorselAdresi: 'https://x/g/a.jpg' }, yankila, { bekle: async () => {} }).catch((e) => e);
    for (const g of GIZLILER) expect(e2.message).not.toContain(g);
    // Ağ hatası mesajı da süzülür.
    const e3 = await fbFotoYayinla(env, { gorselAdresi: 'x' }, async (url, o) => { throw new Error('ECONNRESET ' + url + ' ' + o.headers.Authorization); }).catch((e) => e);
    for (const g of GIZLILER) expect(e3.message).not.toContain(g);
    // Worker yanıtında da yok.
    const { k, j } = await canli({ META_IG_TOKEN: IG_TOKEN, META_APP_SECRET: APP_SECRET }, { hata: { code: 190, message: `bad ${SAYFA_TOKEN} ${IG_TOKEN}` } });
    const [id] = await k.gorseller(j);
    const r = await yayinla(k, j, { kanal: 'instagram', gorseller: [id] });
    for (const g of GIZLILER) expect(JSON.stringify(r.veri)).not.toContain(g);
    for (const g of GIZLILER) expect(JSON.stringify((await k.jsonIste('kanallar', { jeton: j })).veri)).not.toContain(g);
  });
});

describe('doğrulama', () => {
  it('metin 2201 karakter → 422 metin_uzun; 2200 geçer (kod noktası sayılır)', async () => {
    const { k, m, j } = await canli();
    const [id] = await k.gorseller(j);
    expect(await yayinla(k, j, { kanal: 'facebook', gorseller: [id], metin: 'a'.repeat(2201) })).toMatchObject({ durum: 422, veri: { hata: 'metin_uzun' } });
    expect(m.cagrilar).toHaveLength(0);
    expect((await yayinla(k, j, { kanal: 'facebook', gorseller: [id], metin: '😀'.repeat(2200) })).durum).toBe(200);
    expect(k.sql('SELECT durum FROM kayitlar')).toEqual([{ durum: 'yayinlandi' }]); // reddedilen istek kayıt açmaz
  });

  it('görsel yok / bilinmeyen / biçimsiz → 422 gorsel_yok; 11 görsel → 422 cok_gorsel', async () => {
    const { k, m, j } = await canli();
    expect(await yayinla(k, j, { kanal: 'facebook', gorseller: [] })).toMatchObject({ durum: 422, veri: { hata: 'gorsel_yok' } });
    expect(await yayinla(k, j, { kanal: 'facebook', gorseller: ['0123456789abcdef'] })).toMatchObject({ durum: 422, veri: { hata: 'gorsel_yok', eksik: ['0123456789abcdef'] } });
    expect(await yayinla(k, j, { kanal: 'facebook', gorseller: ['../etc'] })).toMatchObject({ durum: 422, veri: { hata: 'gorsel_yok' } });
    expect(await yayinla(k, j, { kanal: 'facebook', gorseller: Array.from({ length: 11 }, (_, i) => i.toString(16).padStart(16, '0')) })).toMatchObject({ durum: 422, veri: { hata: 'cok_gorsel' } });
    expect(await yayinla(k, j, { kanal: 'facebook', gorseller: 'abc' })).toMatchObject({ durum: 400, veri: { hata: 'gecersiz', alan: 'gorseller' } });
    expect(await yayinla(k, j, { kanal: 'twitter', gorseller: [] })).toMatchObject({ durum: 400, veri: { hata: 'gecersiz', alan: 'kanal' } });
    expect(m.cagrilar).toHaveLength(0);
    expect(k.sql('SELECT 1 FROM kayitlar')).toHaveLength(0);
  });

  it('Sayfa secret\'ı yokken facebook → 422 kanal_kapali; Instagram secret\'ı yokken instagram da', async () => {
    const m = metaTaklidi();
    const k = kur({ PROVA: '0', META_IG_ID: IG_ID, META_IG_TOKEN: IG_TOKEN }, { getir: m.getir });
    const j = await k.gir();
    const [id] = await k.gorseller(j);
    expect(await yayinla(k, j, { kanal: 'facebook', gorseller: [id] })).toMatchObject({ durum: 422, veri: { hata: 'kanal_kapali', kanal: 'facebook' } });
    expect((await yayinla(k, j, { kanal: 'instagram', gorseller: [id] })).durum).toBe(200);
    const k2 = kur({ PROVA: '0', META_SAYFA_TOKEN: SAYFA_TOKEN, META_SAYFA_ID: '1' }, { getir: m.getir });
    const j2 = await k2.gir();
    const [id2] = await k2.gorseller(j2);
    expect(await yayinla(k2, j2, { kanal: 'instagram', gorseller: [id2] })).toMatchObject({ durum: 422, veri: { hata: 'kanal_kapali' } });
    expect((await k2.jsonIste('kanallar', { jeton: j2 })).veri).toMatchObject({ prova: false, facebook: { bagli: true, sayfaId: '1' }, instagram: { bagli: false, igId: null, kullaniciToken: false, kota: null } });
  });

  it('jetonsuz 401; süresi geçmiş görsel bilinmiyor sayılır', async () => {
    const { k, j } = await canli();
    const [id] = await k.gorseller(j);
    expect(await k.jsonIste('yayinla', { method: 'POST', govde: { kanal: 'facebook', gorseller: [id], urun: 'dawayar' } })).toMatchObject({ durum: 401, veri: { hata: 'oturum' } });
    k.sql('UPDATE gorseller SET olusturuldu = olusturuldu - 8 * 86400000');
    expect(await yayinla(k, j, { kanal: 'facebook', gorseller: [id] })).toMatchObject({ durum: 422, veri: { hata: 'gorsel_yok' } });
  });
});
