import { describe, it, expect } from 'vitest';
import { temizle, sorunlar, adaylar, duzelt, calistir } from '../tools/secretleri-duzelt.mjs';

describe('secretleri-duzelt', () => {
  it('boşluk ve görünmez karakterleri atar', () => {
    expect(temizle('  abc\u200B\n')).toBe('abc');
    expect(temizle('\uFEFFtoken ')).toBe('token');
    expect(temizle(undefined)).toBe('');
  });

  it('ASCII dışı karakterleri konumuyla bulur', () => {
    expect(sorunlar('abc')).toEqual([]);
    expect(sorunlar('aıb')).toEqual([{ konum: 1, karakter: 'ı' }]);
  });

  it('ı ve İ için i/I adaylarını üretir, temiz değeri olduğu gibi bırakır', () => {
    expect(adaylar('abc')).toEqual(['abc']);
    expect(new Set(adaylar('xıy'))).toEqual(new Set(['xiy', 'xIy']));
    expect(adaylar('ıİ')).toHaveLength(4);
  });

  it('bilinmeyen karakter ya da çok fazla bozuk harf varsa aday üretmez', () => {
    expect(adaylar('ab…')).toEqual([]);
    expect(adaylar('ı'.repeat(7))).toEqual([]);
  });

  it('doğrulayıcının kabul ettiği adayı seçer ve düzeltildi der', async () => {
    const dogru = 'Ab3Ixyz';
    const sonuc = await duzelt({ ad: 'T', deger: ' Ab3ıxyz ', dogrula: async (v) => v === dogru });
    expect(sonuc.durum).toBe('duzeltildi');
    expect(sonuc.deger).toBe(dogru);
    expect(sonuc.sorun).toContain('U+0131');
  });

  it('temiz ama sağlayıcının reddettiği değer geçersizdir', async () => {
    const sonuc = await duzelt({ ad: 'T', deger: 'abc', dogrula: async () => false });
    expect(sonuc.durum).toBe('gecersiz');
    expect(sonuc.deger).toBe('');
  });

  it('calistir: zorunlu eksikse hata, isteğe bağlı eksikse atlar, değerleri loga yazmaz', async () => {
    const satirlar = [];
    const girdiler = [
      { ad: 'A', zorunlu: true, dogrula: async () => true, ipucu: 'ipucu-a' },
      { ad: 'B', zorunlu: false, dogrula: async () => true, ipucu: 'ipucu-b' },
      { ad: 'C', zorunlu: true, dogrula: async (v) => v === 'GIZLI-DEGER-9f3a', ipucu: 'ipucu-c' },
    ];
    const { hata, cikti } = await calistir({ env: { HAM_A: '', HAM_B: '', HAM_C: 'GİZLİ-DEGER-9f3a' }, girdiler, yaz: (s) => satirlar.push(s) });
    expect(hata).toBe(1);
    expect(satirlar.some((s) => s.startsWith('::error::A'))).toBe(true);
    expect(satirlar.some((s) => s.includes('B: verilmemiş'))).toBe(true);
    expect(cikti).toEqual([{ ad: 'C', deger: 'GIZLI-DEGER-9f3a' }]);
    expect(satirlar.join('\n')).not.toContain('GIZLI-DEGER');
  });

  it('açıklama metni yapıştırılmışsa sablon der', async () => {
    for (const m of ['1. adımdaki token', '2. adimdaki bot token', 'buraya yapıştır', '<token>']) {
      expect((await duzelt({ ad: 'T', deger: m, dogrula: async () => true })).durum).toBe('sablon');
    }
  });

  it('biçime uymayan değer bicim der, uyan aday sağlayıcıya sorulur', async () => {
    const hex32 = /^[0-9a-f]{32}$/;
    expect((await duzelt({ ad: 'H', deger: 'abc', dogrula: async (v) => hex32.test(v), bicim: hex32 })).durum).toBe('bicim');
    const sonuc = await duzelt({ ad: 'H', deger: '0123456789abcdef0123456789abcdef', dogrula: async () => true, bicim: hex32 });
    expect(sonuc.durum).toBe('ok');
    const tg = /^\d{8,12}:[A-Za-z0-9_-]{30,}$/;
    const bozuk = '123456789:AAHıxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    const s2 = await duzelt({ ad: 'TG', deger: bozuk, dogrula: async (v) => v.includes(':AAHI'), bicim: tg });
    expect(s2.durum).toBe('duzeltildi');
    expect(s2.deger).toBe(bozuk.replace('ı', 'I'));
  });

  it('fazladan metin varsa değeri ayıklar; biçim uymasa bile sağlayıcı kabul ederse geçer', async () => {
    const tokenBicim = /^[A-Za-z0-9_-]{40}$/; const tokenAyikla = /[A-Za-z0-9_-]{40,}/g;
    const token = 'A'.repeat(20) + 'b'.repeat(20);
    const s1 = await duzelt({ ad: 'CF', deger: `Bearer ${token}`, dogrula: async (v) => v === token, bicim: tokenBicim, ayikla: tokenAyikla });
    expect(s1.durum).toBe('ayiklandi'); expect(s1.deger).toBe(token);
    const uzun = 'x'.repeat(53);
    const s2 = await duzelt({ ad: 'CF', deger: uzun, dogrula: async (v) => v === uzun, bicim: tokenBicim, ayikla: tokenAyikla });
    expect(s2.durum).toBe('ok'); expect(s2.deger).toBe(uzun);
    const s3 = await duzelt({ ad: 'CF', deger: uzun, dogrula: async () => false, bicim: tokenBicim, ayikla: tokenAyikla });
    expect(s3.durum).toBe('bicim'); expect(s3.uzunluk).toBe(53);
    const hex = '0123456789abcdef0123456789abcdef';
    const s4 = await duzelt({ ad: 'ID', deger: `Account ID: ${hex}`, dogrula: async (v) => /^[0-9a-f]{32}$/.test(v), bicim: /^[0-9a-f]{32}$/, ayikla: /[0-9a-f]{32}/g });
    expect(s4.durum).toBe('ayiklandi'); expect(s4.deger).toBe(hex);
  });
});
