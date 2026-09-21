// Reçete işlemleri: kaydetme ve karşılama. Karşılama stoğa dokunduğu için
// buradan geçer — verilen her kutu bir stok hareketi bırakır, geri alınınca
// iade hareketiyle stoğa döner. "Ne verildi, ne verilmedi" reçetede,
// "stok neden düştü" hareket geçmişinde durur; ikisi hep birbirini tutar.
import { DepoHatasi } from './depo.js';
import { hareketUygula } from './stok.js';
import { simdi } from '../paylasilan/kimlik.js';
import { satirKalan, satirDurumu, receteNoUret, durumHesapla } from '../paylasilan/recete.js';
import { bugun } from '../paylasilan/tarih.js';

/** Reçeteyi kaydeder; numarası boşsa o güne ait sıradaki numarayı verir. */
export async function receteKaydet(depo, recete) {
  const kayit = { ...recete };
  if (!String(kayit.receteNo || '').trim()) {
    const hepsi = await depo.listele('receteler');
    kayit.receteNo = receteNoUret(hepsi.map((r) => r.receteNo), kayit.tarih || bugun());
  }
  kayit.durum = durumHesapla(kayit.satirlar);
  return depo.kaydet('receteler', kayit);
}

async function satirAl(depo, receteId, indeks) {
  const recete = await depo.al('receteler', receteId);
  if (!recete) throw new DepoHatasi('bulunamadi', 'Reçete bulunamadı.');
  const satir = recete.satirlar?.[indeks];
  if (!satir) throw new DepoHatasi('bulunamadi', 'Reçete satırı bulunamadı.');
  return { recete, satir };
}

async function satirYaz(depo, recete, indeks, yeniSatir) {
  const satirlar = recete.satirlar.map((s, i) => (i === indeks ? yeniSatir : s));
  return depo.kaydet('receteler', { ...recete, satirlar, durum: durumHesapla(satirlar) });
}

/**
 * Satırdaki ilacı verir: stoktan düşer, satıra işler.
 * `adet` verilmezse kalanın tamamı verilir. Stok yetmezse hata atar —
 * kısmi vermek istenirse çağıran adedi küçültüp yeniden dener.
 */
export async function satirVer(depo, receteId, indeks, adet) {
  const { recete, satir } = await satirAl(depo, receteId, indeks);
  const kalan = satirKalan(satir);
  if (kalan <= 0) throw new DepoHatasi('kapali', 'Bu satırın tamamı zaten verilmiş.');

  const verilecek = Math.min(Math.max(1, Math.floor(Number(adet) || kalan)), kalan);
  if (satir.ilacId) {
    await hareketUygula(depo, {
      ilacId: satir.ilacId, tur: 'recete', adet: verilecek,
      aciklama: `Reçete ${recete.receteNo || ''}`.trim(), receteId,
    });
  }
  return satirYaz(depo, recete, indeks, {
    ...satir,
    verilenAdet: Number(satir.verilenAdet || 0) + verilecek,
    verilmeTarihi: simdi(),
    sebep: '',
  });
}

/** Satırı "verilmedi" diye kapatır: stoğa dokunmaz, sebebi kaydeder. */
export async function satirVerilmedi(depo, receteId, indeks, sebep, not = '') {
  const { recete, satir } = await satirAl(depo, receteId, indeks);
  if (!sebep) throw new DepoHatasi('sebep', 'Sebep seçilmeli.');
  return satirYaz(depo, recete, indeks, { ...satir, sebep, not: not || satir.not || '', verilmeTarihi: simdi() });
}

/** Satırı bekleyen haline döndürür; verilmiş kutular iade hareketiyle stoğa döner. */
export async function satirGeriAl(depo, receteId, indeks) {
  const { recete, satir } = await satirAl(depo, receteId, indeks);
  if (satirDurumu(satir) === 'bekliyor') return recete;

  const verilen = Number(satir.verilenAdet || 0);
  if (verilen > 0 && satir.ilacId) {
    await hareketUygula(depo, {
      ilacId: satir.ilacId, tur: 'iade', adet: verilen,
      aciklama: `Reçete ${recete.receteNo || ''} geri alındı`.trim(), receteId,
    });
  }
  return satirYaz(depo, recete, indeks, { ...satir, verilenAdet: 0, verilmeTarihi: '', sebep: '' });
}

/** Bekleyen bütün satırları sırayla verir. Stoğu yetmeyenler atlanır ve
 *  hangilerinin atlandığı geri döner — tezgâhta tek tuşla karşılamak için. */
export async function hepsiniVer(depo, receteId) {
  const recete = await depo.al('receteler', receteId);
  if (!recete) throw new DepoHatasi('bulunamadi', 'Reçete bulunamadı.');
  const rapor = { verilen: 0, atlanan: [] };
  for (let i = 0; i < (recete.satirlar || []).length; i++) {
    const satir = recete.satirlar[i];
    if (satirKalan(satir) <= 0) continue;
    try {
      await satirVer(depo, receteId, i);
      rapor.verilen++;
    } catch (e) {
      rapor.atlanan.push({ indeks: i, ad: satir.ilacAdi, sebep: e.message });
    }
  }
  return rapor;
}
