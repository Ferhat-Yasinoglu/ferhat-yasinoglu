import { describe, expect, it } from 'vitest';
import { adimlariDogrula } from '../../app/js/paylasilan/akis/adimlar.js';

describe('adimlariDogrula', () => {
  it('geçerli akışa hata vermez', () => {
    const { hatalar } = adimlariDogrula([
      { type: 'message', text: 'selam' },
      { type: 'buttons', text: 'seç', choices: [{ label: 'A', goto: 2 }, { label: 'B' }] },
      { type: 'end' },
    ]);
    expect(hatalar).toEqual([]);
  });
  it('dışarı taşan goto, kendine işaret, tekrar eden buton ve boş metin hata', () => {
    const { hatalar } = adimlariDogrula([
      { type: 'goto', goto: 5 },
      { type: 'goto', goto: 1 },
      { type: 'buttons', text: '', choices: [{ label: 'a' }, { label: 'A' }] },
    ]);
    expect(hatalar.join('\n')).toMatch(/dışında/);
    expect(hatalar.join('\n')).toMatch(/kendine/);
    expect(hatalar.join('\n')).toMatch(/tekrar eden/);
    expect(hatalar.join('\n')).toMatch(/boş olamaz/);
  });
  it('yorum adımları yorum tetikleyicisi ister; Instagram sınırları uyarı üretir', () => {
    const r = adimlariDogrula([{ type: 'comment_reply', texts: ['a'] }], { kanal: 'instagram' });
    expect(r.hatalar.join()).toMatch(/yorum tetikleyicisi/);
    expect(r.uyarilar.join()).toMatch(/10 varyant/);
    const r2 = adimlariDogrula([{ type: 'buttons', text: 'x', choices: [{ label: '1' }, { label: '2' }, { label: '3' }, { label: '4' }] }], { kanal: 'instagram' });
    expect(r2.hatalar).toEqual([]);
    expect(r2.uyarilar.join()).toMatch(/en fazla 3 buton/);
  });
  it('bilinmeyen tip ve özel ağ webhook reddedilir', () => {
    const { hatalar } = adimlariDogrula([{ type: 'x' }, { type: 'webhook', url: 'https://192.168.1.1/a' }]);
    expect(hatalar.join()).toMatch(/bilinmeyen tip/);
    expect(hatalar.join()).toMatch(/özel ağa/);
  });
});
