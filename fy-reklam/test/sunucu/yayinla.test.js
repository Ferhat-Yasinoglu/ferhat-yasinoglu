// Yayınlama: PROVA'da dış çağrı yok; canlıda Facebook (tek fotoğraf, çoklu
// fotoğraf) ve Instagram (tek görsel, karusel) Graph çağrıları doğru alanlarla;
// konak seçimi; Meta hatalarının koda ve kayda eşlenmesi; doğrulama; token sızmaz.
import { describe, it, expect } from 'vitest';
import { kur, KOK, SAHIP, ARKADAS, metaTaklidi } from './yardim.js';
import { fbFotoYayinla, igYayinla, hataKodu, MetaHatasi } from '../../sunucu/meta.js';

const SAYFA_TOKEN = 'EAAGsayfaGIZLI123';
const IG_TOKEN = 'IGQVJigGIZLI456';
const CANLI = { PROVA: '0', META_SAYFA_TOKEN: SAYFA_TOKEN, META_SAYFA_ID: '111222', META_IG_ID: '17841400000' };

/** Canlı ortam + sahte Meta; döner { k, m, j (jeton) }. */
async function canli(ek = {}, taklit = {}) {
  const m = metaTaklidi(taklit);
  const k = kur({ ...CANLI, ...ek }, { getir: m.getir });
  const j = await k.gir(SAHIP);
  return { k, m, j };
}

const yayinla = (k, j, govde) => k.jsonIste('yayinla', { method: 'POST', jeton: j, govde: { urun: 'dawayar', baslik: 'Tanıtım', metin: 'Merhaba', ...govde } });

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
    // Karusel biçimi kendiliğinden.
    const ids = await k.gorseller(j, 3);
    expect((await yayinla(k, j, { kanal: 'facebook', gorseller: ids })).veri.kayit.bicim).toBe('karusel');
    expect((await k.jsonIste('kanallar', { jeton: j })).veri).toMatchObject({ prova: true, instagram: { kota: null } });
  });
});

describe('Facebook (canlı)', () => {
  it('tek görsel → POST /{sayfa}/photos: url = /g/ adresi, message, published=true; access_token yalnız sorguda', async () => {
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
    expect(c.govde).toEqual({ url: `${KOK}/g/${id}.jpg`, message: 'Dawayar çıktı!\n\n#eczane', published: 'true' });
    expect(c.query).toEqual({ access_token: SAYFA_TOKEN });
    expect(c.govde.access_token).toBeUndefined();
  });

  it('3 görsel → 3×photos published=false + 1×feed attached_media', async () => {
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
    expect(akis.query).toEqual({ access_token: SAYFA_TOKEN });
  });

  it('GRAPH_SURUM yoldadır', async () => {
    const { k, m, j } = await canli({ GRAPH_SURUM: 'v27.0' });
    const [id] = await k.gorseller(j);
    await yayinla(k, j, { kanal: 'facebook', gorseller: [id] });
    expect(m.cagrilar[0].yol).toBe('/v27.0/111222/photos');
  });
});

describe('Instagram (canlı)', () => {
  it('tek görsel → media (image_url, caption) → durum döngüsü (IN_PROGRESS, FINISHED) → media_publish creation_id; Sayfa token\'ıyla graph.facebook.com', async () => {
    const { k, m, j } = await canli({}, { durumlar: ['IN_PROGRESS', 'FINISHED'] });
    const [id] = await k.gorseller(j);
    const r = await yayinla(k, j, { kanal: 'instagram', gorseller: [id], metin: 'Instagram açıklaması' });
    expect(r.durum).toBe(200);
    expect(r.veri.sonuc.dis_id).toBe('ig_2');
    expect(m.cagrilar.map((c) => `${c.method} ${c.yol}`)).toEqual([
      'POST /v26.0/17841400000/media', 'GET /v26.0/kap1', 'GET /v26.0/kap1', 'POST /v26.0/17841400000/media_publish',
    ]);
    expect(m.cagrilar.every((c) => c.konak === 'graph.facebook.com' && c.query.access_token === SAYFA_TOKEN)).toBe(true);
    expect(m.cagrilar[0].govde).toEqual({ image_url: `${KOK}/g/${id}.jpg`, caption: 'Instagram açıklaması' });
    expect(m.cagrilar[1].query.fields).toBe('status_code,status');
    expect(m.cagrilar[3].govde).toEqual({ creation_id: 'kap1' });
    expect((await k.jsonIste('kanallar', { jeton: j })).veri.instagram).toMatchObject({ bagli: true, igId: '17841400000', yol: 'facebook', kota: { kullanilan: 3, sinir: 50 } });
  });

  it('karusel → çocuklar is_carousel_item (açıklamasız) → her çocuk FINISHED → kap CAROUSEL children → yayın', async () => {
    const { k, m, j } = await canli();
    const ids = await k.gorseller(j, 3);
    const r = await yayinla(k, j, { kanal: 'instagram', gorseller: ids, metin: 'Karusel' });
    expect(r.durum).toBe(200);
    const yollar = m.cagrilar.map((c) => `${c.method} ${c.yol.replace('/v26.0/', '')}`);
    expect(yollar).toEqual([
      'POST 17841400000/media', 'POST 17841400000/media', 'POST 17841400000/media',
      'GET kap1', 'GET kap2', 'GET kap3',
      'POST 17841400000/media', 'GET kap4', 'POST 17841400000/media_publish',
    ]);
    for (let i = 0; i < 3; i++) expect(m.cagrilar[i].govde).toEqual({ image_url: `${KOK}/g/${ids[i]}.jpg`, is_carousel_item: 'true' });
    expect(m.cagrilar[6].govde).toEqual({ media_type: 'CAROUSEL', children: 'kap1,kap2,kap3', caption: 'Karusel' });
    expect(m.cagrilar[8].govde).toEqual({ creation_id: 'kap4' });
    expect(r.veri.kayit).toMatchObject({ bicim: 'karusel', durum: 'yayinlandi', dis_id: 'ig_5' });
  });

  it('META_IG_TOKEN varsa graph.instagram.com + o token; Facebook yine graph.facebook.com + Sayfa token\'ı', async () => {
    const { k, m, j } = await canli({ META_IG_TOKEN: IG_TOKEN });
    const ids = await k.gorseller(j, 2);
    await yayinla(k, j, { kanal: 'instagram', gorseller: [ids[0]] });
    expect(m.cagrilar.every((c) => c.konak === 'graph.instagram.com' && c.query.access_token === IG_TOKEN)).toBe(true);
    expect(m.cagrilar.some((c) => c.ham.includes(SAYFA_TOKEN))).toBe(false);
    m.cagrilar.length = 0;
    await yayinla(k, j, { kanal: 'facebook', gorseller: [ids[1]] });
    expect(m.cagrilar[0].konak).toBe('graph.facebook.com');
    expect(m.cagrilar[0].query.access_token).toBe(SAYFA_TOKEN);
    expect((await k.jsonIste('kanallar', { jeton: j })).veri.instagram.yol).toBe('instagram');
    expect(m.cagrilar.at(-1)).toMatchObject({ konak: 'graph.instagram.com', yol: '/v26.0/17841400000/content_publishing_limit' });
  });

  it('kap ERROR → 502 gorsel ve kayıt hata; yayın çağrısı yapılmaz', async () => {
    const { k, m, j } = await canli({}, { durumlar: ['IN_PROGRESS', 'ERROR'] });
    const [id] = await k.gorseller(j);
    const r = await yayinla(k, j, { kanal: 'instagram', gorseller: [id] });
    expect(r).toMatchObject({ durum: 502, veri: { hata: 'meta', kod: 'gorsel', meta_kod: null } });
    expect(m.cagrilar.some((c) => c.yol.endsWith('/media_publish'))).toBe(false);
    expect((await k.jsonIste('kayit', { jeton: j })).veri.kayitlar[0]).toMatchObject({ durum: 'hata', hata: 'gorsel', dis_id: null });
  });

  it('kap 12 denemede hazır olmazsa 502 meta; bekle her aralıkta çağrılır', async () => {
    const m = metaTaklidi({ durumlar: ['IN_PROGRESS'] });
    const beklemeler = [];
    const k = kur(CANLI, { getir: m.getir, bekle: async (ms) => { beklemeler.push(ms); } });
    const j = await k.gir();
    const [id] = await k.gorseller(j);
    const r = await yayinla(k, j, { kanal: 'instagram', gorseller: [id] });
    expect(r).toMatchObject({ durum: 502, veri: { hata: 'meta', kod: 'meta' } });
    expect(m.cagrilar.filter((c) => c.method === 'GET')).toHaveLength(12);
    expect(beklemeler).toEqual(Array(11).fill(1500));
  });
});

describe('Meta hataları', () => {
  it('Graph 190 → 502 kod yeniden_baglan, meta_kod 190; kayıt hata/yeniden_baglan', async () => {
    const { k, j } = await canli({}, { hata: { code: 190, message: 'Error validating access token: Session has expired' } });
    const [id] = await k.gorseller(j);
    const r = await yayinla(k, j, { kanal: 'facebook', gorseller: [id] });
    expect(r).toEqual({ durum: 502, veri: { hata: 'meta', kod: 'yeniden_baglan', meta_kod: 190 }, r: expect.anything() });
    const l = await k.jsonIste('kayit', { jeton: j });
    expect(l.veri.kayitlar).toHaveLength(1);
    expect(l.veri.kayitlar[0]).toMatchObject({ durum: 'hata', hata: 'yeniden_baglan', dis_id: null, kanal: 'facebook' });
  });

  it('kod eşlemesi: 10/200–299 izin, 4/17/32/613 oran, 9004/36000–36007 gorsel, gerisi meta', () => {
    expect(hataKodu(190)).toBe('yeniden_baglan');
    for (const kod of [10, 200, 230, 299]) expect(hataKodu(kod)).toBe('izin');
    for (const kod of [4, 17, 32, 613]) expect(hataKodu(kod)).toBe('oran');
    for (const kod of [9004, 36000, 36003, 36007]) expect(hataKodu(kod)).toBe('gorsel');
    for (const kod of [1, 100, 300, 36008, null, undefined]) expect(hataKodu(kod)).toBe('meta');
  });

  it('ağ hatası (fetch fırlatır) → 502 kod meta, meta_kod null; kayıt hata', async () => {
    const k = kur(CANLI, { getir: async () => { throw new TypeError('fetch failed'); } });
    const j = await k.gir();
    const [id] = await k.gorseller(j);
    expect(await yayinla(k, j, { kanal: 'instagram', gorseller: [id] })).toMatchObject({ durum: 502, veri: { hata: 'meta', kod: 'meta', meta_kod: null } });
    expect((await k.jsonIste('kayit', { jeton: j })).veri.kayitlar[0]).toMatchObject({ durum: 'hata', hata: 'meta' });
  });

  it('token hiçbir hata mesajında ve yanıtta yok (Meta adresi yankılasa bile)', async () => {
    const env = { ...CANLI, META_IG_TOKEN: IG_TOKEN };
    const yankila = async (url) => new Response(JSON.stringify({ error: { code: 190, message: `Invalid request ${url} token=${SAYFA_TOKEN} ${IG_TOKEN}` } }), { status: 400 });
    const e1 = await fbFotoYayinla(env, { gorselAdresi: 'https://x/g/a.jpg', mesaj: '' }, yankila).catch((e) => e);
    expect(e1).toBeInstanceOf(MetaHatasi);
    expect(e1.kod).toBe('yeniden_baglan');
    expect(e1.message).not.toContain(SAYFA_TOKEN);
    expect(e1.message).not.toContain(IG_TOKEN);
    expect(e1.message).toContain('access_token=***');
    const e2 = await igYayinla(env, { gorselAdresi: 'https://x/g/a.jpg' }, yankila, { bekle: async () => {} }).catch((e) => e);
    expect(e2.message).not.toContain(IG_TOKEN);
    expect(e2.message).not.toContain(SAYFA_TOKEN);
    // Ağ hatası mesajı da süzülür.
    const e3 = await fbFotoYayinla(env, { gorselAdresi: 'x' }, async (url) => { throw new Error('ECONNRESET ' + url); }).catch((e) => e);
    expect(e3.message).not.toContain(SAYFA_TOKEN);
    // Worker yanıtında da yok.
    const { k, j } = await canli({ META_IG_TOKEN: IG_TOKEN }, { hata: { code: 190, message: `bad ${SAYFA_TOKEN}` } });
    const [id] = await k.gorseller(j);
    const r = await yayinla(k, j, { kanal: 'instagram', gorseller: [id] });
    expect(JSON.stringify(r.veri)).not.toContain(SAYFA_TOKEN);
    expect(JSON.stringify(r.veri)).not.toContain(IG_TOKEN);
    expect(JSON.stringify((await k.jsonIste('kanallar', { jeton: j })).veri)).not.toMatch(new RegExp(`${SAYFA_TOKEN}|${IG_TOKEN}`));
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
    const k = kur({ PROVA: '0', META_IG_ID: '17841400000', META_IG_TOKEN: IG_TOKEN }, { getir: m.getir });
    const j = await k.gir();
    const [id] = await k.gorseller(j);
    expect(await yayinla(k, j, { kanal: 'facebook', gorseller: [id] })).toMatchObject({ durum: 422, veri: { hata: 'kanal_kapali', kanal: 'facebook' } });
    expect((await yayinla(k, j, { kanal: 'instagram', gorseller: [id] })).durum).toBe(200);
    const k2 = kur({ PROVA: '0', META_SAYFA_TOKEN: SAYFA_TOKEN, META_SAYFA_ID: '1' }, { getir: m.getir });
    const j2 = await k2.gir();
    const [id2] = await k2.gorseller(j2);
    expect(await yayinla(k2, j2, { kanal: 'instagram', gorseller: [id2] })).toMatchObject({ durum: 422, veri: { hata: 'kanal_kapali' } });
    expect((await k2.jsonIste('kanallar', { jeton: j2 })).veri).toMatchObject({ prova: false, facebook: { bagli: true, sayfaId: '1' }, instagram: { bagli: false, igId: null, kota: null } });
  });

  it('jetonsuz 401; süresi geçmiş görsel bilinmiyor sayılır', async () => {
    const { k, j } = await canli();
    const [id] = await k.gorseller(j);
    expect(await k.jsonIste('yayinla', { method: 'POST', govde: { kanal: 'facebook', gorseller: [id], urun: 'dawayar' } })).toMatchObject({ durum: 401, veri: { hata: 'oturum' } });
    k.sql('UPDATE gorseller SET olusturuldu = olusturuldu - 8 * 86400000');
    expect(await yayinla(k, j, { kanal: 'facebook', gorseller: [id] })).toMatchObject({ durum: 422, veri: { hata: 'gorsel_yok' } });
  });
});
