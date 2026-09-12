import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BellekDepo, DepoHatasi } from '../../app/js/depo/depo.js';
import { IdbDepo } from '../../app/js/depo/idb.js';
import { tohumla } from '../../app/js/depo/tohum.js';
import { hatirlatmaGerekli } from '../../app/js/depo/yedek.js';

for (const [ad, ac] of [['BellekDepo', async () => new BellekDepo()], ['IdbDepo', async () => new IdbDepo('test-' + Math.random()).ac()]]) {
  describe(ad, () => {
    let depo;
    beforeEach(async () => { depo = await ac(); });

    it('kaydet zarflar, rev artırır, listele/al/sil çalışır', async () => {
      const a = await depo.kaydet('akislar', { ad: 'x', adimlar: [] });
      expect(a.id).toMatch(/^akis_/);
      expect(a.rev).toBe(1);
      const b = await depo.kaydet('akislar', { ...a, ad: 'y' });
      expect(b.rev).toBe(2);
      expect((await depo.al('akislar', a.id)).ad).toBe('y');
      expect(await depo.say('akislar')).toBe(1);
      await depo.sil('akislar', a.id);
      expect(await depo.al('akislar', a.id)).toBeNull();
      expect(await depo.listele('akislar', { silinmisDahil: true })).toHaveLength(1);
    });

    it('rev çakışması yakalanır', async () => {
      const a = await depo.kaydet('kisiler', { ad: 'a', hesap_id: 'h', dis_id: '1' });
      await depo.kaydet('kisiler', { ...a, ad: 'b' });
      await expect(depo.kaydet('kisiler', { ...a, ad: 'c' }, { rev: 1 })).rejects.toBeInstanceOf(DepoHatasi);
    });

    it('dinleyiciler ve ayarlar', async () => {
      const olaylar = [];
      const cik = depo.dinle('etiketler', (o) => olaylar.push(o.tur));
      await depo.kaydet('etiketler', { ad: 'vip' });
      cik();
      await depo.kaydet('etiketler', { ad: 'yeni' });
      expect(olaylar).toEqual(['kaydet']);
      await depo.ayarKaydet('dil', 'de');
      expect(await depo.ayar('dil')).toBe('de');
      expect(await depo.ayar('yok', 'vars')).toBe('vars');
    });

    it('tohum, dışa aktarım (gizli hariç) ve içe aktarım stratejileri', async () => {
      const n = await tohumla(depo);
      expect(n).toBeGreaterThan(5);
      expect(await tohumla(depo)).toBe(0);
      await depo.gizliKaydet('yonetici', 'GIZLI-ANAHTAR-9f3a');
      const belge = await depo.disaAktar();
      expect(belge.koleksiyonlar.gizli).toBeUndefined();
      expect(belge.sayim.akislar).toBe(1);
      expect(JSON.stringify(belge)).not.toMatch(/GIZLI-ANAHTAR/);
      // değiştir: akışı düzenle, yedeği geri yükle → eski ad geri gelir
      const akis = (await depo.listele('akislar'))[0];
      await depo.kaydet('akislar', { ...akis, ad: 'değişti' });
      const prova = await depo.iceAktar(belge, { strateji: 'birlestir', prova: true });
      expect(prova.ok).toBe(true);
      expect(prova.rapor.akislar.atlandi).toBe(1); // yerel daha yeni
      const r = await depo.iceAktar(belge, { strateji: 'degistir' });
      expect(r.ok).toBe(true);
      expect((await depo.al('akislar', akis.id)).ad).toBe('[Demo] Fiyat sorusu');
      expect(await depo.demoSil()).toBeGreaterThan(5);
      expect(await depo.say('akislar')).toBe(0);
    });

    it('bozuk yedek reddedilir', async () => {
      const r = await depo.iceAktar({ format: 'x' });
      expect(r.ok).toBe(false);
    });
  });
}

describe('hatirlatmaGerekli', () => {
  it('yedek yoksa ve değişiklik varsa; 7 gün geçtiyse; eşik aşıldıysa', () => {
    expect(hatirlatmaGerekli({ degisiklik_sayaci: 3 }).gerekli).toBe(true);
    expect(hatirlatmaGerekli({ degisiklik_sayaci: 0 }).gerekli).toBe(false);
    expect(hatirlatmaGerekli({ son_yedek: new Date(Date.now() - 8 * 86400e3).toISOString(), degisiklik_sayaci: 1 }).gerekli).toBe(true);
    expect(hatirlatmaGerekli({ son_yedek: new Date().toISOString(), degisiklik_sayaci: 25 }).gerekli).toBe(true);
    expect(hatirlatmaGerekli({ son_yedek: new Date().toISOString(), degisiklik_sayaci: 2 }).gerekli).toBe(false);
  });
});
