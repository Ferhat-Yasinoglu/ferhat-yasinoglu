// Dil sezgisi: ajan müşterinin dilinde cevap vermek zorunda. Küçük modeller
// genel kuralı tutmadığı için dil deterministik saptanıp isteme yazılıyor.
import { describe, it, expect } from 'vitest';
import { dilSez } from '../src/ai.js';
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
