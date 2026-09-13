// Instagram ve WhatsApp ayrı Graph konaklarına gider. Karışırsa token reddedilir
// ve hata "imza" ya da "yetki" gibi görünüp asıl sebebi gizler; o yüzden test.
import { describe, it, expect } from 'vitest';
import { igGonder, waGonder, igYorumlariCek } from '../src/meta.js';

function yakala() {
  const cagrilar = [];
  const fetchFn = async (url, opt) => {
    cagrilar.push(String(url));
    return { ok: true, status: 200, json: async () => ({ data: [] }), text: async () => '{}' };
  };
  return { cagrilar, fetchFn };
}
const kisi = { dis_id: '4242', kanal: 'instagram' };

describe('Instagram → graph.instagram.com', () => {
  it('DM gönderimi', async () => {
    const { cagrilar, fetchFn } = yakala();
    await igGonder({ IG_ACCESS_TOKEN: 'x' }, kisi, { tip: 'mesaj', text: 'merhaba', adim: 0 }, fetchFn);
    expect(cagrilar[0]).toContain('https://graph.instagram.com/');
    expect(cagrilar[0]).not.toContain('graph.facebook.com');
  });

  it('yorum yanıtı ve gizleme', async () => {
    for (const eylem of [{ tip: 'yorum_yanit', yorumId: '9', text: 'sağol' }, { tip: 'gizle', yorumId: '9' }]) {
      const { cagrilar, fetchFn } = yakala();
      await igGonder({ IG_ACCESS_TOKEN: 'x' }, kisi, eylem, fetchFn);
      expect(cagrilar[0]).toContain('https://graph.instagram.com/');
    }
  });

  it('karusel', async () => {
    const { cagrilar, fetchFn } = yakala();
    await igGonder({ IG_ACCESS_TOKEN: 'x' }, kisi, { tip: 'karusel', adim: 0, kartlar: [{ title: 'a' }] }, fetchFn);
    expect(cagrilar[0]).toContain('https://graph.instagram.com/');
  });

  it('yorum çekme (polling)', async () => {
    const { cagrilar, fetchFn } = yakala();
    await igYorumlariCek({ IG_ACCESS_TOKEN: 'x' }, { limit: 5 }, fetchFn).catch(() => {});
    expect(cagrilar[0]).toContain('https://graph.instagram.com/');
  });
});

describe('WhatsApp → graph.facebook.com', () => {
  it('metin gönderimi facebook konağında kalır', async () => {
    const { cagrilar, fetchFn } = yakala();
    await waGonder({ WA_ACCESS_TOKEN: 'x', WA_PHONE_NUMBER_ID: '77' }, { dis_id: '90555' }, { tip: 'mesaj', text: 'selam', adim: 0 }, fetchFn);
    expect(cagrilar[0]).toContain('https://graph.facebook.com/');
    expect(cagrilar[0]).not.toContain('graph.instagram.com');
  });
});
