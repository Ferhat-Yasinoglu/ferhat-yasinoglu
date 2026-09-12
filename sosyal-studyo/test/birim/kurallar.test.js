import { describe, expect, it } from 'vitest';
import { karar, kurallariAyristir } from '../../app/js/paylasilan/kurallar.js';

const ornek = [
  { name: 'spam', pattern: '(bedava takipci|casino)', hide: true },
  { name: 'etiket', pattern: '^\\s*(@[\\w.]+\\s*)+$', ignore: true, channels: ['instagram'] },
  { name: 'is-tr', keywords: ['fiyat', 'ücret'], reply: ['Merhaba {{username}}! DM\'den konuşalım', 'Selam {{username}}, DM at'], privateReply: 'Merhaba! Ayrıntılar burada.' },
  { name: 'selam', keywords: ['merhaba'], reply: 'Merhaba!', channels: ['whatsapp'] },
];

describe('kurallar', () => {
  it('ayrıştırma hatalı regex ve eksik eylemi yakalar', () => {
    const r = kurallariAyristir([{ name: 'x', pattern: '(' }, { name: 'y', keywords: ['a'] }]);
    expect(r.hatalar).toHaveLength(2);
  });
  it('ilk eşleşen kazanır; gizle yalnız Instagram\'da; kanal kısıtı çalışır', () => {
    const { kurallar, hatalar } = kurallariAyristir(ornek);
    expect(hatalar).toEqual([]);
    expect(karar(kurallar, { text: 'bedava takipçi kazan', kanal: 'instagram' })).toMatchObject({ tur: 'gizle', gizle: true });
    expect(karar(kurallar, { text: 'casino', kanal: 'whatsapp' }).gizle).toBe(false);
    expect(karar(kurallar, { text: '@ali @veli', kanal: 'instagram' }).tur).toBe('yoksay');
    const c = karar(kurallar, { text: 'FİYAT nedir', kanal: 'instagram', username: 'ayse', anahtar: 'y1' });
    expect(c.tur).toBe('cevap');
    expect(c.metin).toMatch(/ayse/);
    expect(c.ozelYanit).toMatch(/Ayrıntılar/);
    expect(karar(kurallar, { text: 'merhaba', kanal: 'instagram' }).tur).toBe('sessiz');
    expect(karar(kurallar, { text: 'merhaba', kanal: 'whatsapp' }).metin).toBe('Merhaba!');
  });
  it('yalnız emoji için model bile çağrılmaz', () => {
    const { kurallar } = kurallariAyristir(ornek);
    expect(karar(kurallar, { text: '❤️🔥', kanal: 'instagram' })).toMatchObject({ tur: 'sessiz', sebep: 'kelime yok' });
  });
});
