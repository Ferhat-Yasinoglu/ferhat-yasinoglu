// Karusel gönderimi: koşucunun ürettiği buton indisi ile göndericinin yazdığı
// callback/payload indisi aynı olmalı — ayrışırsa kullanıcı yanlış adıma düşer.
import { describe, it, expect } from 'vitest';
import { gonder } from '../src/telegram.js';
import { igGonder } from '../src/meta.js';
import { karuselGotoButonlari } from '../../app/js/paylasilan/akis/adimlar.js';

const KARTLAR = [
  { title: 'Web', subtitle: 'Kurumsal', image_url: 'https://ornek.test/1.jpg', buttons: [{ label: 'Detay', goto: 3 }] },
  { title: 'Otomasyon', buttons: [{ label: 'Site', url: 'https://ornek.test' }, { label: 'İncele', goto: 5 }] },
];
const eylem = { tip: 'karusel', kartlar: KARTLAR, adim: 2 };
const kisi = { dis_id: '4242' };

function yakala() {
  const cagrilar = [];
  const fetchFn = async (url, opt) => {
    cagrilar.push({ url, govde: JSON.parse(opt.body || '{}') });
    return { ok: true, status: 200, json: async () => ({ ok: true, result: {} }), text: async () => '{}' };
  };
  return { cagrilar, fetchFn };
}

describe('Telegram karusel', () => {
  it('her kart ayrı mesaj; görselli kart sendPhoto ile gider', async () => {
    const { cagrilar, fetchFn } = yakala();
    await gonder({ TELEGRAM_BOT_TOKEN: 'x' }, kisi, eylem, fetchFn);
    expect(cagrilar).toHaveLength(2);
    expect(cagrilar[0].url).toContain('sendPhoto');
    expect(cagrilar[0].govde.photo).toBe('https://ornek.test/1.jpg');
    expect(cagrilar[1].url).toContain('sendMessage');
  });

  it('başlık ve altyazı tek metinde birleşir', async () => {
    const { cagrilar, fetchFn } = yakala();
    await gonder({ TELEGRAM_BOT_TOKEN: 'x' }, kisi, eylem, fetchFn);
    expect(cagrilar[0].govde.caption).toBe('Web\nKurumsal');
  });

  it('callback indisi koşucunun gördüğü sırayla aynı', async () => {
    const { cagrilar, fetchFn } = yakala();
    await gonder({ TELEGRAM_BOT_TOKEN: 'x' }, kisi, eylem, fetchFn);
    const gotolar = karuselGotoButonlari(KARTLAR);
    expect(cagrilar[0].govde.reply_markup.inline_keyboard[0][0].callback_data)
      .toBe(`s:2:${gotolar.findIndex((b) => b.label === 'Detay')}`);
    const ikinci = cagrilar[1].govde.reply_markup.inline_keyboard;
    expect(ikinci[0][0].url).toBe('https://ornek.test');          // bağlantı butonu
    expect(ikinci[1][0].callback_data).toBe(`s:2:${gotolar.findIndex((b) => b.label === 'İncele')}`);
  });
});

describe('Instagram karusel', () => {
  it('generic template olarak tek istekte gider', async () => {
    const { cagrilar, fetchFn } = yakala();
    await igGonder({ IG_ACCESS_TOKEN: 'x' }, kisi, eylem, fetchFn);
    expect(cagrilar).toHaveLength(1);
    const p = cagrilar[0].govde.message.attachment.payload;
    expect(p.template_type).toBe('generic');
    expect(p.elements).toHaveLength(2);
    expect(p.elements[0]).toMatchObject({ title: 'Web', subtitle: 'Kurumsal', image_url: 'https://ornek.test/1.jpg' });
  });

  it('url butonu web_url, goto butonu postback olur ve indis eşleşir', async () => {
    const { cagrilar, fetchFn } = yakala();
    await igGonder({ IG_ACCESS_TOKEN: 'x' }, kisi, eylem, fetchFn);
    const gotolar = karuselGotoButonlari(KARTLAR);
    const el2 = cagrilar[0].govde.message.attachment.payload.elements[1];
    expect(el2.buttons[0]).toMatchObject({ type: 'web_url', url: 'https://ornek.test' });
    expect(el2.buttons[1]).toMatchObject({ type: 'postback', payload: `s:2:${gotolar.findIndex((b) => b.label === 'İncele')}` });
  });

  it('10 kart tavanı uygulanır', async () => {
    const { cagrilar, fetchFn } = yakala();
    const cok = { tip: 'karusel', adim: 0, kartlar: Array.from({ length: 14 }, (_, i) => ({ title: 'k' + i })) };
    await igGonder({ IG_ACCESS_TOKEN: 'x' }, kisi, cok, fetchFn);
    expect(cagrilar[0].govde.message.attachment.payload.elements).toHaveLength(10);
  });
});
