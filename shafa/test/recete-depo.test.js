// Reçete kaydetme: numara üretimi ve doğrulama kodunun reçeteye işlenmesi.
import { describe, it, expect, beforeEach } from 'vitest';
import { BellekDepo } from '../app/js/depo/depo.js';
import { receteKaydet } from '../app/js/depo/recete.js';
import { metniDogrula } from '../app/js/depo/dogrulama.js';
import { ozetMetni, kodSatiri } from '../app/js/paylasilan/dogrulama.js';

let depo, ilac, hasta;

const satir = (ilacId, adet, ad) => ({ ilacId, ilacAdi: ad, adet, kullanim: 'Günde 2×1', sure: '7 gün', not: '' });

beforeEach(async () => {
  depo = new BellekDepo();
  ilac = await depo.kaydet('ilaclar', { ad: 'Parol' });
  hasta = await depo.kaydet('hastalar', { ad: 'Ayşe', soyad: 'Yılmaz' });
});

const receteYaz = (satirlar, ek = {}) => receteKaydet(depo, {
  hastaId: hasta.id, tarih: '2026-09-21', tur: 'normal', satirlar, ...ek,
});

describe('receteKaydet', () => {
  it('numarası boşsa günün sıradaki numarasını verir', async () => {
    const a = await receteYaz([satir(ilac.id, 1, 'Parol')]);
    const b = await receteYaz([satir(ilac.id, 1, 'Parol')]);
    expect(a.receteNo).toBe('2026-09-21-01');
    expect(b.receteNo).toBe('2026-09-21-02');
  });

  it('elle verilen numaraya dokunmaz', async () => {
    const r = await receteYaz([satir(ilac.id, 1, 'Parol')], { receteNo: 'ÖZEL-7' });
    expect(r.receteNo).toBe('ÖZEL-7');
  });

  it('doğrulama kodunu reçeteye işler', async () => {
    const r = await receteYaz([satir(ilac.id, 2, 'Parol')]);
    expect(r.dogrulamaKodu).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  });

  it('kaydedilen reçetenin metni kendi koduyla doğrulanır', async () => {
    const r = await receteYaz([satir(ilac.id, 2, 'Parol')]);
    const metin = `${ozetMetni(r, 'Ayşe Yılmaz')}\n\n${kodSatiri(r.dogrulamaKodu)}`;
    expect((await metniDogrula(depo, metin)).durum).toBe('gecerli');
  });

  it('adedi değiştirilmiş reçete koda uymaz', async () => {
    const r = await receteYaz([satir(ilac.id, 2, 'Parol')]);
    const sahte = { ...r, satirlar: [{ ...r.satirlar[0], adet: 20 }] };
    const metin = `${ozetMetni(sahte, 'Ayşe Yılmaz')}\n\n${kodSatiri(r.dogrulamaKodu)}`;
    expect((await metniDogrula(depo, metin)).durum).toBe('gecersiz');
  });
});
