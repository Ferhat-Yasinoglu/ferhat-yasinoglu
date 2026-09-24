// Simge seti. Bilinmeyen bir ad hata vermiyor, sessizce "bilgi" simgesini
// çiziyor; yanlış yazılmış bir ad ekranda yanlış simge olarak kalırdı. Bu
// yüzden reçete sayfası tasarımının istediği dolgulu adlar tek tek aranıyor.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sahteDomKur } from './sahte-dom.js';
import { simge, simgeVar, doluSimgeAdlari } from '../app/js/cekirdek/simge.js';

let kaldir;
beforeAll(() => { kaldir = sahteDomKur(); });
afterAll(() => kaldir());

// Tasarım belgesinin simge tablosu (kenar, üst çubuk, form, Clinical,
// düğmeler, kâğıt). Sonraki adımlar bu adlarla çağırıyor.
const GEREKEN = [
  'logo', 'panel', 'hastalar', 'recete', 'kagazi', 'liste', 'ilac', 'tani', 'tup', 'rapor', 'ayarlar',
  'takvim', 'gece', 'gunduz', 'zil',
  'yeni-recete', 'hasta-grup', 'stetoskop', 'hasta',
  'tansiyon', 'nabiz', 'akciger', 'tarti', 'termometre', 'oksijen', 'boy', 'kan',
  'kapsul', 'cop', 'goz', 'yazdir', 'kalp',
  'kum-saati', 'belge', 'arti-kalin', 'mide', 'bobrek', 'sise', 'romatizma', 'bas-agrisi', 'konum', 'telefon',
];

const ozellikler = (svg) => Object.fromEntries(svg.attributes);

describe('simge — çizgi tablosu', () => {
  it('eski görünüm değişmedi: 24×24, dolgusuz, 1.8 kontur', () => {
    const svg = simge('takvim', { boy: 18, sinif: 'x' });
    expect(ozellikler(svg)).toMatchObject({
      viewBox: '0 0 24 24', width: '18', height: '18', fill: 'none', stroke: 'currentColor',
      'stroke-width': '1.8', 'aria-hidden': 'true', class: 'simge x',
    });
    expect(svg.children.map((c) => c.tagName)).toEqual(['rect', 'path']);
  });
  it('simgeVar yalnız çizgi tablosuna bakar', () => {
    expect(simgeVar('takvim')).toBe(true);
    expect(simgeVar('kum-saati')).toBe(false);
  });
});

describe('simge — dolgulu tablo', () => {
  it('tasarımın istediği her ad tabloda var', () => {
    const eksik = GEREKEN.filter((ad) => !simgeVar(ad, { dolu: true }));
    expect(eksik).toEqual([]);
  });

  it('her dolgulu simge currentColor ile dolgulu ve geçerli bir viewBox ile çiziliyor', () => {
    for (const ad of doluSimgeAdlari()) {
      const svg = simge(ad, { dolu: true, boy: 24 });
      const o = ozellikler(svg);
      expect(o.viewBox, ad).toMatch(/^0 0 (16|24) (16|24)$/);
      expect(o.fill, ad).toBe('currentColor');
      expect(o.stroke, ad).toBeUndefined();
      // Gerçek delik: beyaz boyanmış şekil yok (karanlık temada ve renkli
      // düğmede beyaz leke olarak görünürdü). Maskenin kendi içi hariç.
      const gorunen = svg.torunlar().filter((e) => e.tagName !== 'mask' && !svg.torunlar()
        .some((m) => m.tagName === 'mask' && m.torunlar().includes(e)));
      for (const e of gorunen) {
        expect([e.getAttribute('fill'), e.getAttribute('stroke')], `${ad} <${e.tagName}>`).not.toContain('#fff');
      }
    }
  });

  it('oyuklu simgeler kendi tekil maskesini kullanır', () => {
    const bir = simge('tansiyon', { dolu: true });
    const iki = simge('tansiyon', { dolu: true });
    const maske = (svg) => svg.children.find((c) => c.tagName === 'mask');
    const grup = (svg) => svg.children.find((c) => c.tagName === 'g');
    expect(maske(bir).getAttribute('id')).not.toBe(maske(iki).getAttribute('id'));
    expect(grup(bir).getAttribute('mask')).toBe(`url(#${maske(bir).getAttribute('id')})`);
  });

  it('bilinmeyen dolgulu ad çizgi "bilgi" simgesine düşer', () => {
    const svg = simge('yok-boyle-bir-ad', { dolu: true });
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('fill')).toBe('none');
    expect(simgeVar('yok-boyle-bir-ad', { dolu: true })).toBe(false);
  });
});
