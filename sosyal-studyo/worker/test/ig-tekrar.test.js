// Instagram olay tekrarı: Meta bir webhook'u yeniden gönderirse aynı kişiye
// aynı mesaj iki kez gitmemeli. Koruma kanal bağımsız (motor.js → gelenKaydet,
// gelen_kutusu_olay UNIQUE indeksi) ama Instagram için kanıtlanmamıştı.
import { beforeEach, describe, expect, it } from 'vitest';
import { Veritabani } from '../src/db.js';
import { olayIsle } from '../src/motor.js';
import { ortam, sahteFetch } from './sahte-d1.js';
import { DEMO_AKIS, DEMO_TETIKLEYICILER } from '../../app/js/paylasilan/demo-veri.js';

const igOlay = (mid, text = 'fiyat') => ({
  kaynak: 'instagram', kanal: 'instagram', dis_id: '17841400000', ad: 'Ayşe',
  kullanici_adi: 'ayse', olay_id: `ig:${mid}`, tip: 'dm', text,
  zaman: new Date().toISOString(),
});

describe('Instagram tekrar koruması', () => {
  let env, f, db;
  beforeEach(async () => {
    env = ortam({ PROVA: '0' }); f = sahteFetch();
    db = new Veritabani(env.DB);
    await db.kaydet('hesaplar', { kanal: 'instagram', ad: '@fy', dis_id: 'fy', durum: 'canli' }, { onek: 'hes' });
    await db.kaydet('akislar', { ...DEMO_AKIS, kanal: null }, { onek: 'akis' });
    for (const t of DEMO_TETIKLEYICILER) await db.kaydet('tetikleyiciler', { ...t, hesap_id: null }, { onek: 'tet' });
  });

  it('aynı mid ikinci kez gelince atlanır', async () => {
    const bir = await olayIsle(env, db, igOlay('m1'), { fetchFn: f.fetch });
    const iki = await olayIsle(env, db, igOlay('m1'), { fetchFn: f.fetch });
    expect(bir.atlandi).toBeUndefined();
    expect(iki.atlandi).toBe('tekrar');
  });

  it('tekrar hiç dışarı istek üretmez', async () => {
    await olayIsle(env, db, igOlay('m2'), { fetchFn: f.fetch });
    const sayi = f.cagrilar.length;
    await olayIsle(env, db, igOlay('m2'), { fetchFn: f.fetch });
    expect(f.cagrilar.length).toBe(sayi);
  });

  it('farklı mid ayrı olaydır, atlanmaz', async () => {
    await olayIsle(env, db, igOlay('m3'), { fetchFn: f.fetch });
    const baska = await olayIsle(env, db, igOlay('m4'), { fetchFn: f.fetch });
    expect(baska.atlandi).toBeUndefined();
  });

  it('yorum olayları da korunur (ig:c: öneki)', async () => {
    const yorum = () => ({ ...igOlay('x'), olay_id: 'ig:c:555', tip: 'comment', yorumId: '555' });
    await olayIsle(env, db, yorum(), { fetchFn: f.fetch });
    const iki = await olayIsle(env, db, yorum(), { fetchFn: f.fetch });
    expect(iki.atlandi).toBe('tekrar');
  });
});
