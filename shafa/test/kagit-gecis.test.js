// Lacivert kâğıt herkesin varsayılanı oldu. Eski sürüm 'modern'i hekim hiç
// seçmeden kaydediyordu; o değer bir kez laciverte dönüyor. Bilerek seçilmiş
// stiller (klasik, eski adıyla renkli, sade) ve güncellemeden SONRA seçilen
// modern dokunulmadan kalmalı: yoksa hekimin seçimi her açılışta ezilir.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sahteDomKur } from './sahte-dom.js';
import { kagitStiliGecisi, kagitStiliCoz, KAGIT_STILLERI, KAGIT_STILI_SURUMU } from '../app/js/paylasilan/antet.js';

describe('kagitStiliGecisi', () => {
  it('boş ya da damgasız modern laciverte dönüyor ve damgalanıyor', () => {
    for (const ayar of [{}, { kagitStili: 'modern' }, { kagitStili: 'modern', kagitStiliSurum: 1 }]) {
      expect(kagitStiliGecisi(ayar)).toEqual({ kagitStili: 'lacivert', kagitStiliSurum: 2 });
    }
    expect(KAGIT_STILI_SURUMU).toBe(2);
  });
  it('bilerek seçilmiş stiller dokunulmuyor', () => {
    for (const kagitStili of ['klasik', 'renkli', 'sade', 'lacivert']) expect(kagitStiliGecisi({ kagitStili })).toBeNull();
  });
  it('damgalı modern (güncellemeden sonra seçilmiş) kalıyor', () => {
    expect(kagitStiliGecisi({ kagitStili: 'modern', kagitStiliSurum: 2 })).toBeNull();
  });
  it('bir kez uygulanınca bir daha değişiklik yok', () => {
    const ayar = { kagitStili: 'modern', doktorAd: 'x' };
    const sonra = { ...ayar, ...kagitStiliGecisi(ayar) };
    expect(kagitStiliGecisi(sonra)).toBeNull();
    expect(sonra.doktorAd).toBe('x');
  });
});

describe('kagitStiliCoz', () => {
  it('Ayarlar sırası: lacivert ilk ve varsayılan', () => {
    expect(KAGIT_STILLERI).toEqual(['lacivert', 'modern', 'klasik', 'sade']);
    expect(kagitStiliCoz({})).toBe('lacivert');
    expect(kagitStiliCoz()).toBe('lacivert');
    expect(kagitStiliCoz({ kagitStili: 'bilinmeyen' })).toBe('lacivert');
  });
  it('eski «renkli» klasik çiziliyor, öbürleri kendisi', () => {
    expect(kagitStiliCoz({ kagitStili: 'renkli' })).toBe('klasik');
    for (const k of ['modern', 'klasik', 'sade', 'lacivert']) expect(kagitStiliCoz({ kagitStili: k })).toBe(k);
  });
});

// Örnek antet (yeni kurulumda ve tanıtımda görünen) lacivert antede
// sığmalı: yoksa hekim daha ilk açılışta «sığmıyor» uyarısı görür ve örnek
// kâğıtta bir çalışma yeri sessizce düşer.
describe('antetTasiyor', () => {
  let kaldir;
  beforeAll(() => { kaldir = sahteDomKur(); });
  afterAll(() => kaldir());
  it('örnek antet sığıyor; sekiz İngilizce hizmet satırı sığmıyor', async () => {
    const { antetTasiyor } = await import('../app/js/kagit-lacivert.js');
    const { ORNEK_ANTET } = await import('../app/js/depo/ornek.js');
    expect(antetTasiyor(ORNEK_ANTET)).toBe(false);
    expect(antetTasiyor({ ...ORNEK_ANTET, deneyimEn: 'Sample Hospital\nSample Diagnostic Clinic' })).toBe(true);
    expect(antetTasiyor({ hizmetlerEn: Array.from({ length: 8 }, (_, i) => `Service ${i}`).join('\n') })).toBe(true);
    expect(antetTasiyor({})).toBe(false);
  });
});
