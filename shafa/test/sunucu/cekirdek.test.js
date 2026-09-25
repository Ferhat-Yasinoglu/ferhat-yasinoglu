// Sunucu çekirdeğinin küçük parçaları: sabit zamanlı karşılaştırma, jeton,
// IP anahtarı, akış parçalama, gövde şeması.
import { describe, it, expect } from 'vitest';
import {
  esitMi, jetonUret, jetonKullanicisi, ipAnahtari, ipParcasi, akisiParcala, govdeDogrula,
  b64urlYaz, b64urlOku, utf8, ApiHatasi, HesapCekirdek,
} from '../../sunucu/cekirdek.js';
import { anahtar, sarili } from './yardim.js';

const akisOlarak = (...parcalar) => new ReadableStream({
  start(c) { for (const p of parcalar) c.enqueue(p); c.close(); },
});

describe('esitMi (taşınabilir sabit zamanlı karşılaştırma)', () => {
  it('eşit, farklı ve farklı uzunluk', () => {
    expect(esitMi('abc', 'abc')).toBe(true);
    expect(esitMi('abc', 'abd')).toBe(false);
    expect(esitMi('abc', 'abcd')).toBe(false);
    expect(esitMi('', '')).toBe(true);
    expect(esitMi('a', '')).toBe(false);
    expect(esitMi(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(esitMi(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    // Uzunluk farkı sıfır baytla doldurulmuş gibi "eşit" görünmemeli.
    expect(esitMi(new Uint8Array([1, 0]), new Uint8Array([1]))).toBe(false);
  });
  it('WebCrypto\'nun workerd\'a özgü timingSafeEqual\'ına dayanmıyor', async () => {
    const kaynak = await import('node:fs').then((fs) => fs.readFileSync(new URL('../../sunucu/cekirdek.js', import.meta.url), 'utf8'));
    expect(kaynak).not.toMatch(/timingSafeEqual\s*\(/);
  });
});

describe('jeton', () => {
  it('ilk parça kullanıcı adı (yönlendirme), ikincisi 32 rastgele bayt', () => {
    const j = jetonUret('dr.nemuna');
    const [onek, govde] = j.split('.');
    expect(onek).toBe(b64urlYaz(utf8('dr.nemuna')));
    expect(b64urlOku(govde)).toHaveLength(32);
    expect(jetonKullanicisi(j)).toBe('dr.nemuna');
    expect(jetonUret('dr.nemuna')).not.toBe(j);
  });
  it('bozuk ya da normalleşmemiş önek reddedilir', () => {
    const govde = b64urlYaz(new Uint8Array(32));
    for (const j of [null, '', 'abc', `${b64urlYaz(utf8('DR.A'))}.${govde}`, `${b64urlYaz(utf8('ab'))}.${govde}`,
      `${b64urlYaz(utf8('dr.a'))}.${b64urlYaz(new Uint8Array(31))}`, `${b64urlYaz(utf8('dr.a'))}.${govde}.x`,
      `${b64urlYaz(new Uint8Array([0xff, 0xfe, 0x41]))}.${govde}`, `!!!.${govde}`]) {
      expect(jetonKullanicisi(j)).toBeNull();
    }
  });
});

describe('ipAnahtari', () => {
  it('IPv4 olduğu gibi, IPv4-mapped IPv6 IPv4\'e iner', () => {
    expect(ipAnahtari('203.0.113.7')).toBe('203.0.113.7');
    expect(ipAnahtari('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(ipAnahtari('')).toBe('bilinmiyor');
  });
  it('IPv6 /64 önekine indirgenir; yazım biçimi fark etmez', () => {
    const a = ipAnahtari('2001:db8:1:2::5');
    expect(a).toBe('2001:db8:1:2::/64');
    expect(ipAnahtari('2001:0db8:0001:0002:ffff:ffff:ffff:ffff')).toBe(a);
    expect(ipAnahtari('2001:DB8:1:2:0:0:0:1')).toBe(a);
    expect(ipAnahtari('2001:db8:1:3::5')).not.toBe(a);
    expect(ipAnahtari('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(ipAnahtari('::1')).toBe('0:0:0:0::/64');
    expect(ipAnahtari('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
  });
  it('16 parçaya dağılır', () => {
    const parcalar = new Set();
    for (let i = 0; i < 200; i++) parcalar.add(ipParcasi(`198.51.100.${i}`));
    expect([...parcalar].every((p) => p >= 0 && p < 16)).toBe(true);
    expect(parcalar.size).toBe(16);
  });
});

describe('akisiParcala', () => {
  it('parça sınırlarında doğru böler', async () => {
    const b = Uint8Array.from({ length: 25 }, (_, i) => i);
    const { parcalar, toplam } = await akisiParcala(akisOlarak(b.subarray(0, 7), b.subarray(7, 10), b.subarray(10)), 100, 10);
    expect(toplam).toBe(25);
    expect(parcalar.map((p) => [...p])).toEqual([[...b.subarray(0, 10)], [...b.subarray(10, 20)], [...b.subarray(20)]]);
    const tam = await akisiParcala(akisOlarak(b.subarray(0, 20)), 100, 10);
    expect(tam.parcalar.map((p) => p.length)).toEqual([10, 10]);
    expect(await akisiParcala(null, 100, 10)).toEqual({ parcalar: [], toplam: 0 });
  });
  it('sınırı aşan akış 413 atar ve okumayı keser', async () => {
    let cekilen = 0;
    const sonsuz = new ReadableStream({ pull(c) { cekilen++; c.enqueue(new Uint8Array(10)); } });
    await expect(akisiParcala(sonsuz, 35, 10)).rejects.toMatchObject({ durum: 413, kod: 'buyuk' });
    expect(cekilen).toBeLessThan(10);
  });
});

describe('govdeDogrula', () => {
  it('yalnız uç için gereken alanları döndürür, adı normalleştirir', () => {
    const g = { kullanici: ' Dr.Nemuna۱ ', giris: anahtar(), fazla: 'x', sarili: sarili() };
    expect(govdeDogrula('giris', g)).toEqual({ kullanici: 'dr.nemuna1', giris: g.giris });
  });
  it('eksik ya da bozuk alan 400', () => {
    for (const g of [{}, { kullanici: 'dr.a' }, { kullanici: 'dr.a', giris: 'A'.repeat(43) + '=' }, { kullanici: ['dr.a'], giris: anahtar() }]) {
      expect(() => govdeDogrula('giris', g)).toThrow(ApiHatasi);
    }
    expect(() => govdeDogrula('parola', { giris: anahtar(), yeniGiris: anahtar(), yeniSarili: { iv: 'AAAA', veri: 'AAAA' } })).toThrow(ApiHatasi);
  });
});

/** DO depolamasının en yalın taklidi: değerler kopyalanarak yazılır ve okunur. */
class MapDepo {
  m = new Map();
  async get(a) {
    if (!Array.isArray(a)) return structuredClone(this.m.get(a));
    return new Map(a.filter((k) => this.m.has(k)).map((k) => [k, structuredClone(this.m.get(k))]));
  }
  async put(a, d) { for (const [k, v] of Object.entries(typeof a === 'string' ? { [a]: d } : a)) this.m.set(k, structuredClone(v)); }
  async delete(a) { for (const k of [].concat(a)) this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix))); }
  async deleteAll() { this.m.clear(); }
}

describe('eşzamanlı sır değişimi (HesapCekirdek)', () => {
  /* İkinci istek birincinin await'leri arasına farklı derinliklerde sokulur.
     Tek kullanımlık kod ve eski parola, hangi anda gelirse gelsin yalnız BİR
     kez geçmeli; öbür istek 401 ya da 409 almalı. */
  const aradan = async (n) => {
    for (let i = 0; i < n; i++) await new Promise((c) => (n % 2 ? setImmediate(c) : process.nextTick(c)));
  };
  const sonuc = (p) => p.then(() => 'ok', (e) => e.kod);

  it('aynı kurtarma kodu, aynı eski parola ve silme+parola: her gecikmede yalnız biri geçer', async () => {
    for (let gecikme = 0; gecikme < 48; gecikme++) {
      const c = new HesapCekirdek(new MapDepo());
      const h = { kullanici: 'dr.yaris', giris: anahtar(), kurtarma: anahtar(), sarili: sarili(), kurtarmaSarili: sarili() };
      await c.kayit(h);
      const bitir = () => sonuc(c.kurtarBitir({ kullanici: h.kullanici, kurtarma: h.kurtarma, giris: anahtar(), sarili: sarili(), yeniKurtarma: anahtar(), yeniKurtarmaSarili: sarili() }));
      const p1 = bitir();
      await aradan(gecikme);
      expect([await p1, await bitir()].filter((x) => x === 'ok')).toHaveLength(1);

      const c2 = new HesapCekirdek(new MapDepo());
      const { jeton: j2 } = await c2.kayit(h);
      const degistir = () => sonuc(c2.parola(j2, { giris: h.giris, yeniGiris: anahtar(), yeniSarili: sarili() }));
      const d1 = degistir();
      await aradan(gecikme);
      expect([await d1, await degistir()].filter((x) => x === 'ok')).toHaveLength(1);

      // Silme, arada değişen parolayı eski parolayla doğrulanmış halde silmesin.
      const c3 = new HesapCekirdek(new MapDepo());
      const { jeton: j3 } = await c3.kayit(h);
      const s1 = sonuc(c3.parola(j3, { giris: h.giris, yeniGiris: anahtar(), yeniSarili: sarili() }));
      await aradan(gecikme);
      const s2 = sonuc(c3.sil(j3, { giris: h.giris }));
      const ikisi = [await s1, await s2];
      expect(ikisi.filter((x) => x === 'ok')).toHaveLength(1);
      if (ikisi[0] === 'ok') expect(c3.hesap).not.toBe(null);

      // Eski parolayla giriş, parola değişimiyle yarışırsa açılan oturum
      // değişimin düşürmesinden kurtulmamalı.
      const c4 = new HesapCekirdek(new MapDepo());
      const { jeton: j4 } = await c4.kayit(h);
      const g1 = sonuc(c4.parola(j4, { giris: h.giris, yeniGiris: anahtar(), yeniSarili: sarili() }));
      await aradan(gecikme);
      const eskiGiris = c4.giris({ kullanici: h.kullanici, giris: h.giris }).catch(() => null);
      expect(await g1).toBe('ok');
      const acilan = await eskiGiris;
      if (acilan) await expect(c4.oturumDogrula(acilan.jeton)).rejects.toMatchObject({ kod: 'oturum' });
    }
  });
});
