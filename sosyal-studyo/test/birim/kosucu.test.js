import { describe, expect, it } from 'vitest';
import { baslat, ilerlet } from '../../app/js/paylasilan/akis/kosucu.js';
import { DEMO_AKIS } from '../../app/js/paylasilan/demo-veri.js';

const kisi = () => ({ id: 'kisi_1', ad: 'Ali', kullanici_adi: 'ali', kanal: 'telegram', etiketler: [], degiskenler: {}, puan: 0, son_gelen: new Date().toISOString() });
const ctx = { simdi: () => '2026-09-11T12:00:00.000Z', pencereAcik: () => true };

describe('koşucu: demo fiyat akışı', () => {
  it('DM senaryosu baştan sona: etiketler, puan, bitiş', async () => {
    let r = await baslat({ akis: DEMO_AKIS, kisi: kisi(), hesap_id: 'hes_1', tetik: 'keyword' }, ctx);
    // pencere açık → 3. adım (mesaj) → 4. adım (butonlar) beklenir
    expect(r.eylemler.map((e) => e.tip)).toEqual(['mesaj', 'mesaj']);
    expect(r.kosu.bekleme).toBe('choice');
    r = await ilerlet(r.kosu, r.kisi, { tur: 'buton', label: 'Otomasyon / bot', adim: r.kosu.adim }, ctx);
    expect(r.kisi.etiketler).toContain('ilgi-bot');
    expect(r.kosu.bekleme).toBe('reply');
    r = await ilerlet(r.kosu, r.kisi, { tur: 'metin', text: '800 €' }, ctx);
    expect(r.kosu.degiskenler.butce).toBe('800 €');
    expect(r.eylemler[0].text).toMatch(/800 €/);
    expect(r.kisi.etiketler).toContain('lead-fiyat');
    expect(r.kisi.puan).toBe(5);
    expect(r.kosu.bekleme).toBe('choice');
    r = await ilerlet(r.kosu, r.kisi, { tur: 'metin', text: 'Evet, teklif istiyorum' }, ctx);
    expect(r.kisi.etiketler).toContain('teklif-istedi');
    expect(r.kosu.durum).toBe('finished');
  });
  it('yorum senaryosu: açık yanıt + özel yanıt, pencere beklenir, sonra devam', async () => {
    const k = kisi(); k.kanal = 'instagram';
    let r = await baslat({ akis: DEMO_AKIS, kisi: k, hesap_id: 'hes_1', tetik: 'comment', baglam: { yorumId: 'y1' } }, { ...ctx, pencereAcik: () => false });
    expect(r.eylemler.map((e) => e.tip)).toEqual(['yorum_yanit', 'ozel_yanit']);
    expect(r.kosu.bekleme).toBe('window');
    r = await ilerlet(r.kosu, r.kisi, { tur: 'buton', label: 'Devam edelim' }, ctx);
    expect(r.kosu.adim).toBe(4); // mesaj (3) koşuldu, butonlar (4) bekliyor
    expect(r.kosu.bekleme).toBe('choice');
  });
  it('seçeneğe uymayan cevap soruyu yeniden sorar, ilerlemez', async () => {
    let r = await baslat({ akis: DEMO_AKIS, kisi: kisi(), hesap_id: 'h', tetik: 'keyword' }, ctx);
    const adim = r.kosu.adim;
    r = await ilerlet(r.kosu, r.kisi, { tur: 'metin', text: 'bilmem' }, ctx);
    expect(r.kosu.adim).toBe(adim);
    expect(r.eylemler[0].choices).toBeTruthy();
  });
  it('eski butona basmak hiçbir şey yapmaz', async () => {
    let r = await baslat({ akis: DEMO_AKIS, kisi: kisi(), hesap_id: 'h', tetik: 'keyword' }, ctx);
    const once = JSON.stringify(r.kosu);
    r = await ilerlet(r.kosu, r.kisi, { tur: 'buton', label: 'Web sitesi', adim: 99 }, ctx);
    expect(JSON.stringify(r.kosu)).toBe(once);
  });
});

describe('koşucu: özel adımlar', () => {
  it('delay parklar, zaman gelince devam eder', async () => {
    const akis = { id: 'a', adimlar: [{ type: 'delay', seconds: 60 }, { type: 'message', text: 'sonra' }] };
    let r = await baslat({ akis, kisi: kisi(), hesap_id: 'h', tetik: 'start' }, ctx);
    expect(r.kosu.bekleme).toBe('delay');
    expect(r.kosu.devam_zamani).toBe('2026-09-11T12:01:00.000Z');
    r = await ilerlet(r.kosu, r.kisi, { tur: 'zaman' }, ctx);
    expect(r.eylemler[0].text).toBe('sonra');
    expect(r.kosu.durum).toBe('finished');
  });
  it('question validate: geçersiz e-posta yeniden sorar, sonra kabul eder', async () => {
    const akis = { id: 'a', adimlar: [{ type: 'question', text: 'e-posta?', save_as: 'eposta', validate: 'email', retries: 1, retry_text: 'tekrar' }] };
    let r = await baslat({ akis, kisi: kisi(), hesap_id: 'h', tetik: 'start' }, ctx);
    r = await ilerlet(r.kosu, r.kisi, { tur: 'metin', text: 'yanlış' }, ctx);
    expect(r.eylemler[0].text).toBe('tekrar');
    r = await ilerlet(r.kosu, r.kisi, { tur: 'metin', text: 'a@b.co' }, ctx);
    expect(r.kosu.degiskenler.eposta).toBe('a@b.co');
  });
  it('ai_reply: model susarsa on_skip_goto\'ya gider; goto döngüsü kalkanı', async () => {
    const akis = { id: 'a', adimlar: [{ type: 'ai_reply', on_skip_goto: 2 }, { type: 'message', text: 'ai' }, { type: 'message', text: 'sustu' }] };
    let r = await baslat({ akis, kisi: kisi(), hesap_id: 'h', tetik: 'start' }, { ...ctx, ai: async () => null });
    expect(r.eylemler.find((e) => e.tip === 'mesaj').text).toBe('sustu');
    const dongu = { id: 'd', adimlar: [{ type: 'goto', goto: 1 }, { type: 'goto', goto: 0 }] };
    r = await baslat({ akis: dongu, kisi: kisi(), hesap_id: 'h', tetik: 'start' }, ctx);
    expect(r.kosu.durum).toBe('failed');
  });
  it('webhook hatası on_error_goto\'ya yönlenir, başarı save_as\'a yazar', async () => {
    const akis = { id: 'a', adimlar: [{ type: 'webhook', url: 'https://x.y/z', save_as: 'w', on_error_goto: 2 }, { type: 'message', text: 'ok {{w}}' }, { type: 'message', text: 'hata' }] };
    let r = await baslat({ akis, kisi: kisi(), hesap_id: 'h', tetik: 'start' }, { ...ctx, webhook: async () => ({ a: 1 }) });
    expect(r.eylemler.find((e) => e.tip === 'mesaj').text).toBe('ok {"a":1}');
    r = await baslat({ akis, kisi: kisi(), hesap_id: 'h', tetik: 'start' }, { ...ctx, webhook: async () => { throw new Error('x'); } });
    expect(r.eylemler.find((e) => e.tip === 'mesaj').text).toBe('hata');
  });
});
