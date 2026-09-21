// Stok hareketleri: stok yalnız buradan değişir.
// Her değişiklik bir hareket kaydı bırakır — "stok neden 3'e düştü?" sorusunun
// cevabı her zaman kayıtlıdır. Reçete karşılama da bu kapıdan geçer.
import { DepoHatasi } from './depo.js';
import { hareketYonu } from '../paylasilan/ilac.js';
import { simdi } from '../paylasilan/kimlik.js';

/**
 * Bir stok hareketi uygular: ilacın stoğunu günceller ve hareketi kaydeder.
 * `tur === 'sayim'` ise `adet` yeni mutlak stok sayısıdır, diğerlerinde değişim miktarıdır.
 * Stoğu eksiye düşüren hareket reddedilir.
 */
export async function hareketUygula(depo, { ilacId, tur, adet, aciklama = '', receteId = '' }) {
  const ilac = await depo.al('ilaclar', ilacId);
  if (!ilac) throw new DepoHatasi('ilac_bulunamadi', 'İlaç bulunamadı.');

  const miktar = Math.abs(Number(adet) || 0);
  if (!miktar && tur !== 'sayim') throw new DepoHatasi('miktar', 'Miktar sıfırdan büyük olmalı.');

  const oncesi = Number(ilac.stok || 0);
  const sonrasi = tur === 'sayim' ? miktar : oncesi + hareketYonu(tur) * miktar;
  if (sonrasi < 0) {
    throw new DepoHatasi('stok_yetersiz',
      `Stok yetersiz: ${ilac.ad} için ${oncesi} adet var, ${miktar} adet isteniyor.`,
      { ad: ilac.ad, var: oncesi, istenen: miktar });
  }

  await depo.kaydet('ilaclar', { ...ilac, stok: sonrasi });
  return depo.kaydet('hareketler', {
    ilacId, ilacAdi: ilac.ad, tur, adet: sonrasi - oncesi, oncesi, sonrasi,
    tarih: simdi(), aciklama, receteId,
  });
}

/** Bir ilacın hareket geçmişi, yeniden eskiye. */
export async function ilacHareketleri(depo, ilacId, limit = 50) {
  const hepsi = await depo.listele('hareketler', { filtre: { ilacId }, sirala: 'tarih', azalan: true });
  return limit ? hepsi.slice(0, limit) : hepsi;
}
