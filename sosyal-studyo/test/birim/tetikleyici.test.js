import { describe, expect, it } from 'vitest';
import { cakismaBul, esle } from '../../app/js/paylasilan/akis/tetikleyici.js';

const akislar = { a1: { id: 'a1', durum: 'yayinda' }, a2: { id: 'a2', durum: 'yayinda' }, a3: { id: 'a3', durum: 'taslak' } };
const tets = [
  { id: 't1', akis_id: 'a1', tip: 'keyword', anahtar_kelimeler: ['fiyat'], eslesme: 'contains', aktif: 1, yeniden_baslatma_sn: 3600 },
  { id: 't2', akis_id: 'a2', tip: 'any_message', aktif: 1 },
  { id: 't3', akis_id: 'a3', tip: 'keyword', anahtar_kelimeler: ['taslak'], aktif: 1 },
  { id: 't4', akis_id: 'a1', tip: 'comment', anahtar_kelimeler: ['fiyat'], gonderi_idleri: ['g1'], aktif: 1 },
];
const simdi = () => '2026-09-11T12:00:00.000Z';

describe('esle', () => {
  it('cevap bekleyen koşu varsa cevap kazanır', () => {
    const r = esle({ olay: { tip: 'dm', text: 'fiyat' }, tetikleyiciler: tets, akislar, aktifKosu: { durum: 'waiting', bekleme: 'reply' }, simdi });
    expect(r.karar).toBe('cevap');
  });
  it('anahtar kelime any_message\'dan önce gelir; taslak akış tetiklenmez', () => {
    expect(esle({ olay: { tip: 'dm', text: 'FİYAT?' }, tetikleyiciler: tets, akislar, aktifKosu: null, simdi }).akis.id).toBe('a1');
    expect(esle({ olay: { tip: 'dm', text: 'selam' }, tetikleyiciler: tets, akislar, aktifKosu: null, simdi }).akis.id).toBe('a2');
    expect(esle({ olay: { tip: 'dm', text: 'taslak' }, tetikleyiciler: tets, akislar, aktifKosu: null, simdi }).akis.id).toBe('a2');
  });
  it('yeniden başlatma süresi dolmadıysa aynı akış tetiklenmez', () => {
    const r = esle({ olay: { tip: 'dm', text: 'fiyat' }, tetikleyiciler: tets, akislar, aktifKosu: null, sonBaslatmalar: { a1: '2026-09-11T11:30:00.000Z' }, simdi });
    expect(r.akis.id).toBe('a2');
  });
  it('yorum tetikleyicisi gönderi filtresine uyar ve bekleyen delay koşusunu bastırır', () => {
    const bekleyen = { id: 'k', durum: 'waiting', bekleme: 'delay' };
    expect(esle({ olay: { tip: 'comment', text: 'fiyat?', gonderiId: 'g2' }, tetikleyiciler: tets, akislar, aktifKosu: bekleyen, simdi }).karar).toBe('yok');
    const r = esle({ olay: { tip: 'comment', text: 'fiyat?', gonderiId: 'g1' }, tetikleyiciler: tets, akislar, aktifKosu: bekleyen, simdi });
    expect(r.karar).toBe('tetik');
    expect(r.bastir).toBe(bekleyen);
  });
  it('cakismaBul aynı kelimeyi iki yayında akışta yakalar', () => {
    const c = cakismaBul([...tets, { id: 't5', akis_id: 'a2', tip: 'keyword', anahtar_kelimeler: ['Fiyat'], aktif: 1 }], akislar);
    expect(c).toHaveLength(1);
    expect(c[0].akislar).toEqual(['a1', 'a2']);
  });
});
