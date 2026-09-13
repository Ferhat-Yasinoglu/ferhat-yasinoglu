import { describe, expect, it } from 'vitest';
import { adimlariDogrula, karuselGotoButonlari } from '../../app/js/paylasilan/akis/adimlar.js';
import { baslat, ilerlet } from '../../app/js/paylasilan/akis/kosucu.js';

const kisi = () => ({ id: 'kisi_1', ad: 'Ali', kullanici_adi: 'ali', kanal: 'telegram', etiketler: [], degiskenler: {}, puan: 0, son_gelen: new Date().toISOString() });
const ctx = { simdi: () => '2026-09-13T12:00:00.000Z', pencereAcik: () => true };

const KARUSEL_AKIS = {
  id: 'akis_k', ad: 'Karusel', kanal: 'telegram', durum: 'yayinda',
  adimlar: [
    { type: 'carousel', cards: [
      { title: 'Web sitesi', subtitle: 'Kurumsal', image_url: 'https://ornek.test/1.jpg', buttons: [{ label: 'Detay', goto: 1 }] },
      { title: 'Otomasyon', buttons: [{ label: 'İncele', goto: 2 }, { label: 'Site', url: 'https://ornek.test' }] },
    ] },
    { type: 'message', text: 'Web seçtin' },
    { type: 'message', text: 'Otomasyon seçtin' },
  ],
};

describe('karusel: doğrulama', () => {
  it('geçerli karusel hatasız', () => {
    const { hatalar } = adimlariDogrula(KARUSEL_AKIS.adimlar, { kanal: 'telegram' });
    expect(hatalar).toEqual([]);
  });

  it('boş cards ve başlıksız kart reddedilir', () => {
    expect(adimlariDogrula([{ type: 'carousel', cards: [] }], {}).hatalar).toContain('adim[0]: cards boş');
    expect(adimlariDogrula([{ type: 'carousel', cards: [{ subtitle: 'x' }] }], {}).hatalar).toContain('adim[0]: cards[0].title boş');
  });

  it('10 kart sınırı ve http görsel reddedilir', () => {
    const cok = Array.from({ length: 11 }, (_, i) => ({ title: 'k' + i }));
    expect(adimlariDogrula([{ type: 'carousel', cards: cok }], {}).hatalar).toContain('adim[0]: en fazla 10 kart');
    const h = adimlariDogrula([{ type: 'carousel', cards: [{ title: 'a', image_url: 'http://x.test/a.png' }] }], {}).hatalar;
    expect(h).toContain('adim[0]: cards[0].image_url https olmalı');
  });

  it('butonda ne url ne goto varsa hata', () => {
    const h = adimlariDogrula([{ type: 'carousel', cards: [{ title: 'a', buttons: [{ label: 'x' }] }] }], {}).hatalar;
    expect(h).toContain('adim[0]: cards[0].buttons[0]: url ya da goto gerekli');
  });

  it('akış dışına işaret eden goto yakalanır', () => {
    const h = adimlariDogrula([{ type: 'carousel', cards: [{ title: 'a', buttons: [{ label: 'x', goto: 9 }] }] }], {}).hatalar;
    expect(h.some((x) => x.includes('akışın dışında'))).toBe(true);
  });
});

describe('karusel: buton indisi tek kaynaktan', () => {
  it('yalnız goto taşıyan butonlar, kart sırasıyla', () => {
    const b = karuselGotoButonlari(KARUSEL_AKIS.adimlar[0].cards);
    expect(b.map((x) => x.label)).toEqual(['Detay', 'İncele']);  // 'Site' bir bağlantı, seçim değil
  });
});

describe('karusel: koşucu', () => {
  it('kartları gönderir ve seçim bekler', async () => {
    const r = await baslat({ akis: KARUSEL_AKIS, kisi: kisi(), hesap_id: 'h', tetik: 'keyword' }, ctx);
    const kar = r.eylemler.find((e) => e.tip === 'karusel');
    expect(kar).toBeTruthy();
    expect(kar.kartlar).toHaveLength(2);
    expect(r.kosu.bekleme).toBe('choice');
  });

  it('kart butonu doğru adıma dallanır', async () => {
    let r = await baslat({ akis: KARUSEL_AKIS, kisi: kisi(), hesap_id: 'h', tetik: 'keyword' }, ctx);
    r = await ilerlet(r.kosu, r.kisi, { tur: 'buton', label: 'İncele', adim: r.kosu.adim }, ctx);
    expect(r.eylemler.at(-1).text).toBe('Otomasyon seçtin');
  });

  it('tanınmayan cevapta karusel yeniden gönderilir, ilerleme olmaz', async () => {
    let r = await baslat({ akis: KARUSEL_AKIS, kisi: kisi(), hesap_id: 'h', tetik: 'keyword' }, ctx);
    const adimOnce = r.kosu.adim;
    r = await ilerlet(r.kosu, r.kisi, { tur: 'metin', text: 'alakasız' }, ctx);
    expect(r.kosu.adim).toBe(adimOnce);
    expect(r.eylemler.at(-1).tip).toBe('karusel');
  });

  it('yalnız URL butonu olan karusel beklemeden ilerler', async () => {
    const akis = { ...KARUSEL_AKIS, adimlar: [
      { type: 'carousel', cards: [{ title: 'a', buttons: [{ label: 'Site', url: 'https://ornek.test' }] }] },
      { type: 'message', text: 'devam' },
    ] };
    const r = await baslat({ akis, kisi: kisi(), hesap_id: 'h', tetik: 'keyword' }, ctx);
    expect(r.eylemler.map((e) => e.tip)).toEqual(['karusel', 'mesaj']);
  });

  it('kart metni değişken doldurur', async () => {
    const akis = { ...KARUSEL_AKIS, adimlar: [{ type: 'carousel', cards: [{ title: 'Merhaba {{ad}}' }] }] };
    const r = await baslat({ akis, kisi: kisi(), hesap_id: 'h', tetik: 'keyword' }, ctx);
    expect(r.eylemler[0].kartlar[0].title).toBe('Merhaba Ali');
  });
});
