// Dil sezgisi: ajan müşterinin dilinde cevap vermek zorunda. Küçük modeller
// genel kuralı tutmadığı için dil deterministik saptanıp isteme yazılıyor.
import { describe, it, expect } from 'vitest';
import { dilSez, cevapDili, brifingSec } from '../src/ai.js';
import { dilKodu, olayaCevir } from '../src/telegram.js';

describe('dilSez', () => {
  it('Farsçayı alfabeden tanır', () => {
    expect(dilSez('سلام، قیمت وبسایت چقدر است؟')).toBe('fa');
  });

  it('Almancayı kelime ve harften tanır', () => {
    expect(dilSez('Was kostet eine Website?')).toBe('de');
    expect(dilSez('Können Sie mir helfen?')).toBe('de');
    expect(dilSez('Guten Tag, ich brauche einen Bot')).toBe('de');
  });

  it('Türkçeyi kelime ve harften tanır', () => {
    expect(dilSez('Merhaba, fiyat ne kadar?')).toBe('tr');
    expect(dilSez('Bana bir bot yapar mısın')).toBe('tr');
    expect(dilSez('Sitenizi görebilir miyim?')).toBe('tr');
  });

  it('tanımadığını İngilizceye düşürür', () => {
    expect(dilSez('Do you build Telegram bots?')).toBe('en');
    expect(dilSez('hello')).toBe('en');
    expect(dilSez('')).toBe('en');
  });

  it('kesme işaretli İngilizce kısaltmaları Türkçe sanmaz', () => {
    // "I've" içindeki "ve" \b ile Türkçe "ve" gibi eşleşiyordu; İngilizce mesaja
    // Türkçe cevap verilmesine yol açan gerçek bir hataydı.
    expect(dilSez("I've worked on several Telegram bots")).toBe('en');
    expect(dilSez("We've built a few websites")).toBe('en');
    expect(dilSez("You've got a nice portfolio")).toBe('en');
    expect(dilSez("They've asked for a quote")).toBe('en');
  });

  it('Almanca ile Türkçeyi karıştırmaz', () => {
    // "site" her iki dilde de geçebilir; Almanca kanıtı ağır basmalı
    expect(dilSez('Ich brauche eine Website für mein Geschäft')).toBe('de');
    // Türkçe özel harfler tek başına Almancaya kaymamalı
    expect(dilSez('Çok güzel bir çalışma olmuş')).toBe('tr');
  });
});

describe('dilKodu', () => {
  it('desteklenen dilleri gecirir', () => {
    expect(dilKodu('tr')).toBe('tr');
    expect(dilKodu('de-DE')).toBe('de');
    expect(dilKodu('fa-IR')).toBe('fa');
    expect(dilKodu('en-US')).toBe('en');
  });
  it('yakin dilleri esler, tanimadigini Ingilizceye dusurur', () => {
    expect(dilKodu('az')).toBe('tr');   // Azerice → Türkçe
    expect(dilKodu('ps')).toBe('fa');   // Peştuca → Farsça
    expect(dilKodu('ru')).toBe('en');
    expect(dilKodu('')).toBe('en');
    expect(dilKodu(undefined)).toBe('en');
  });
});

describe('olayaCevir', () => {
  const guncelleme = (text, language_code) => ({
    update_id: 1,
    message: { text, date: 0, chat: { id: 42 }, from: { first_name: 'Ali', username: 'ali', language_code } },
  });

  it('/start olayini start tipiyle ve kullanicinin diliyle uretir', () => {
    const o = olayaCevir(guncelleme('/start', 'de-DE'), 'hes_1');
    expect(o.tip).toBe('start');
    expect(o.dil).toBe('de');
  });

  it('duz mesaji dm yapar ve dili tasir', () => {
    const o = olayaCevir(guncelleme('merhaba', 'tr'), 'hes_1');
    expect(o.tip).toBe('dm');
    expect(o.dil).toBe('tr');
  });

  it('dil bilinmiyorsa Ingilizceye duser', () => {
    expect(olayaCevir(guncelleme('/start', undefined), 'hes_1').dil).toBe('en');
  });

  it('/start ref parametresini ayirir', () => {
    const o = olayaCevir(guncelleme('/start ref_abc123', 'tr'), 'hes_1');
    expect(o.tip).toBe('start');
    expect(o.ref).toBe('abc123');
  });
});

describe('cevapDili', () => {
  it('metin dil kanıtı taşıyorsa arayüz dilini ezer', () => {
    expect(cevapDili('سلام، نسخه را چطور چاپ کنم؟', 'en')).toBe('fa');   // Telegram'ı İngilizce hekim Dari yazdı
    expect(cevapDili('How do I print a prescription?', 'fa')).toBe('en');
    expect(cevapDili('Merhaba, fiyat ne kadar?', 'de')).toBe('tr');
    expect(cevapDili('Was kostet eine Website?', 'tr')).toBe('de');
  });

  it('kanıt yoksa arayüz diline, o da yoksa sezgiye düşer', () => {
    expect(cevapDili('ok', 'fa')).toBe('fa');
    expect(cevapDili('salam, chap chetor?', 'fa')).toBe('fa');          // Latin harfli Dari
    expect(cevapDili('PDF', 'de')).toBe('de');
    expect(cevapDili('ok', undefined)).toBe('en');
    expect(cevapDili('ok', 'xx')).toBe('en');
  });
});

describe('brifingSec', () => {
  const genel = { id: 'b_genel', aktif: 1 };
  const tg = { id: 'b_tg', aktif: 1, kanallar: ['telegram'] };
  it('kanala özel brifing o kanalda genel brifingden önce gelir, sıradan bağımsız', () => {
    expect(brifingSec([genel, tg], 'telegram').id).toBe('b_tg');
    expect(brifingSec([tg, genel], 'telegram').id).toBe('b_tg');
  });
  it('kanala özel brifing başka kanalda konuşmaz; orada genel brifing sürer', () => {
    expect(brifingSec([genel, tg], 'instagram').id).toBe('b_genel');
    expect(brifingSec([tg], 'instagram')).toBeNull();
  });
  it('kanalı olmayan eski kayıtlarda davranış aynı: ilk aktif brifing', () => {
    expect(brifingSec([{ id: 'p', aktif: 0 }, { id: 'a', aktif: 1 }, { id: 'b', aktif: 1 }], 'telegram').id).toBe('a');
    expect(brifingSec([], 'telegram')).toBeNull();
    expect(brifingSec([{ ...tg, aktif: 0 }, genel], 'telegram').id).toBe('b_genel');
  });
});
