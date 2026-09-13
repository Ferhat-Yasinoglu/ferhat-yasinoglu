// Aynı kanalda iki hesap kaydı olabiliyor: kurulum iki kez yapılırsa ya da kayıt hem
// yerelde hem Worker'da oluşursa. Eski eşleştirme `!h.dis_id` koşulunu birebir
// eşleşmeyle aynı kefeye koyduğu için sonuç listedeki *sıraya* bağlıydı — dis_id'si
// boş kayıt önce duruyorsa kimliği gerçekten eşleşen kaydı geçiyordu. Sonuç: olaylar
// yanlış hesaba yazılıyor, kullanıcı diğer hesaba bakıp "mesaj gelmiyor" sanıyor.
import { describe, it, expect } from 'vitest';
import { hesapEslestir, olaylaraCevir } from '../src/meta.js';

const IGSID = '17841449824821129';
const dm = (metin, gonderen = '999') => ({
  object: 'instagram',
  entry: [{ id: IGSID, messaging: [{ sender: { id: gonderen }, recipient: { id: IGSID }, timestamp: 1, message: { mid: 'm1', text: metin } }] }],
});

describe('hesapEslestir', () => {
  it('birebir eşleşen kayıt, dis_id boş kaydın önüne geçer (sıra ne olursa olsun)', () => {
    const bos = { id: 'hes_bos', kanal: 'instagram', dis_id: '', durum: 'canli' };
    const gercek = { id: 'hes_gercek', kanal: 'instagram', dis_id: IGSID, durum: 'canli' };
    expect(hesapEslestir([bos, gercek], 'instagram', IGSID).id).toBe('hes_gercek');
    expect(hesapEslestir([gercek, bos], 'instagram', IGSID).id).toBe('hes_gercek');
  });

  it('birebir eşleşme yoksa dis_id boş kayda düşer', () => {
    const bos = { id: 'hes_bos', kanal: 'instagram', dis_id: '', durum: 'prova' };
    const baska = { id: 'hes_baska', kanal: 'instagram', dis_id: '111', durum: 'canli' };
    expect(hesapEslestir([baska, bos], 'instagram', IGSID).id).toBe('hes_bos');
  });

  it('hiçbiri eşleşmezse kanaldaki canlı kayıt seçilir', () => {
    const a = { id: 'hes_a', kanal: 'instagram', dis_id: '111', durum: 'prova' };
    const b = { id: 'hes_b', kanal: 'instagram', dis_id: '222', durum: 'canli' };
    expect(hesapEslestir([a, b], 'instagram', IGSID).id).toBe('hes_b');
  });

  it('silinmiş kayıt seçilmez', () => {
    const silinmis = { id: 'hes_silinmis', kanal: 'instagram', dis_id: IGSID, durum: 'canli', silindi: 1 };
    const duran = { id: 'hes_duran', kanal: 'instagram', dis_id: '', durum: 'canli' };
    expect(hesapEslestir([silinmis, duran], 'instagram', IGSID).id).toBe('hes_duran');
  });

  it('başka kanalın kaydına taşmaz', () => {
    const tg = { id: 'hes_tg', kanal: 'telegram', dis_id: IGSID, durum: 'canli' };
    expect(hesapEslestir([tg], 'instagram', IGSID)).toBeUndefined();
  });

  it('hiç kayıt yoksa undefined döner', () => {
    expect(hesapEslestir([], 'instagram', IGSID)).toBeUndefined();
  });
});

describe('olaylaraCevir çift kayıtla', () => {
  it('olay kimliği eşleşen hesaba yazılır', () => {
    const hesaplar = [
      { id: 'hes_bos', kanal: 'instagram', dis_id: '', durum: 'canli' },
      { id: 'hes_gercek', kanal: 'instagram', dis_id: IGSID, durum: 'canli' },
    ];
    const olaylar = olaylaraCevir(dm('fiyat nedir'), hesaplar);
    expect(olaylar).toHaveLength(1);
    expect(olaylar[0].hesap_id).toBe('hes_gercek');
  });

  it('kimlik yazıldıktan sonra botun kendi echo\'su ayıklanır', () => {
    const hesaplar = [{ id: 'hes_gercek', kanal: 'instagram', dis_id: IGSID, durum: 'canli' }];
    // gönderen = hesabın kendisi: bot kendi mesajına cevap yazmasın
    expect(olaylaraCevir(dm('benim yazdığım', IGSID), hesaplar)).toHaveLength(0);
    // dis_id boşken aynı echo sızıyordu — kimlik yazmanın asıl sebebi bu
    expect(olaylaraCevir(dm('benim yazdığım', IGSID), [{ id: 'hes_bos', kanal: 'instagram', dis_id: '', durum: 'canli' }])).toHaveLength(1);
  });
});
