// Yönlendiricinin tek sözü: ekrandaki sayfa en son gidilen sayfadır.
// Sayfalar veriyi bekledikten sonra kökü kendileri yazıyor; beklerken başka
// bir sayfaya geçilirse eski çizim yenisinin üstüne yazıyordu (kaydedilen
// reçetenin sayfası, hekim yeni reçeteye geçtikten sonra yüklenip formu
// siliyordu). ctx.guncel() sayfaya «hâlâ sen mi gösteriliyorsun» diye sorar.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Yonlendirici } from '../app/js/cekirdek/yonlendirici.js';

// Yönlendiricinin dokunduğu tarayıcı parçaları: adres, kaydırma, kök öğe.
beforeEach(() => {
  globalThis.location = { hash: '' };
  globalThis.window = { scrollTo() {}, addEventListener() {} };
});
afterEach(() => {
  delete globalThis.location;
  delete globalThis.window;
});

const sahteKok = () => ({ yazan: [], classList: { add() {}, remove() {} }, offsetWidth: 0, querySelector: () => null });

/** Veriyi `kapi` açılınca alan, sonra (hâlâ güncelse) kökü yazan sayfa.
 *  `basladi` çizim başlayınca çağrılır. */
const sayfa = (ad, kapi = Promise.resolve(), basladi = () => {}) => ({
  default: {
    async cizim(kok, ctx) {
      basladi();
      await kapi;
      if (!ctx.guncel()) return;
      kok.yazan.push(ad);
    },
  },
});

describe('Yonlendirici — ctx.guncel', () => {
  it('veri beklenirken başka sayfaya geçilince eski sayfa yazmıyor; yeni sayfa yazıyor', async () => {
    let ac;
    let basladi;
    const kapi = new Promise((r) => { ac = r; });
    const cizimde = new Promise((r) => { basladi = r; });
    const kok = sahteKok();
    const y = new Yonlendirici([
      { yol: '/recete/kagit', yukle: async () => sayfa('kagit') },
      { yol: '/recete/:id', yukle: async () => sayfa('recete', kapi, basladi) },
    ], { kok });
    location.hash = '#/recete/rec_1';
    const eski = y.calistir();
    // Eski sayfa çizime girmiş, verisini bekliyor: tam o sırada gezinme.
    await cizimde;
    location.hash = '#/recete/kagit';
    await y.calistir();
    ac();
    await eski;
    expect(kok.yazan).toEqual(['kagit']);
  });

  it('tek gezinmede sayfa günceldir ve yazar', async () => {
    const kok = sahteKok();
    const y = new Yonlendirici([{ yol: '/panel', yukle: async () => sayfa('panel') }], { kok });
    location.hash = '#/panel';
    await y.calistir();
    expect(kok.yazan).toEqual(['panel']);
  });
});
