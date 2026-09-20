// Örnek veri: uygulamayı denemek için. Kendiliğinden yüklenmez — Ayarlar'dan
// açıkça istenir ve tek tuşla silinir. Gerçek hasta kayıtlarıyla karışmasın diye
// her kayıt `ornek: 1` taşır ve arayüzde "örnek" rozetiyle görünür.
// Hastalar kurgudur.
import { isoGun } from '../paylasilan/tarih.js';

function gunEkle(gun) {
  const d = new Date();
  d.setDate(d.getDate() + gun);
  return isoGun(d);
}

export const ORNEK_ILACLAR = [
  { ad: 'Parol', etkenMadde: 'Parasetamol', form: 'tablet', doz: '500 mg', kutuAdedi: 20, barkod: '8699514013059', stok: 42, kritikStok: 10, alisFiyati: 18.4, satisFiyati: 27.5, sonKullanma: gunEkle(540), receteli: false, uretici: 'Atabay', raf: 'A1' },
  { ad: 'Augmentin BID', etkenMadde: 'Amoksisilin + Klavulanik asit', form: 'tablet', doz: '1000 mg', kutuAdedi: 14, barkod: '8699522090014', stok: 6, kritikStok: 8, alisFiyati: 62.1, satisFiyati: 89.9, sonKullanma: gunEkle(300), receteli: true, uretici: 'GSK', raf: 'B2' },
  { ad: 'Nurofen', etkenMadde: 'İbuprofen', form: 'tablet', doz: '400 mg', kutuAdedi: 20, barkod: '8699546010158', stok: 25, kritikStok: 8, alisFiyati: 31.0, satisFiyati: 44.75, sonKullanma: gunEkle(60), receteli: false, uretici: 'Reckitt', raf: 'A2' },
  { ad: 'Ventolin', etkenMadde: 'Salbutamol', form: 'sprey', doz: '100 mcg', kutuAdedi: 1, barkod: '8699522570019', stok: 3, kritikStok: 4, alisFiyati: 48.9, satisFiyati: 71.2, sonKullanma: gunEkle(420), receteli: true, uretici: 'GSK', raf: 'C1' },
  { ad: 'Majezik', etkenMadde: 'Flurbiprofen', form: 'tablet', doz: '100 mg', kutuAdedi: 15, barkod: '8699532090012', stok: 0, kritikStok: 5, alisFiyati: 29.4, satisFiyati: 41.3, sonKullanma: gunEkle(210), receteli: true, uretici: 'Sanovel', raf: 'A3' },
  { ad: 'Amoklavin BID', etkenMadde: 'Amoksisilin + Klavulanik asit', form: 'tablet', doz: '1000 mg', kutuAdedi: 14, barkod: '8699508090015', stok: 18, kritikStok: 6, alisFiyati: 58.0, satisFiyati: 84.5, sonKullanma: gunEkle(365), receteli: true, uretici: 'Deva', raf: 'B2' },
  { ad: 'Zinnat', etkenMadde: 'Sefuroksim aksetil', form: 'surup', doz: '250 mg/5 ml', kutuAdedi: 1, barkod: '8699522570552', stok: 9, kritikStok: 4, alisFiyati: 54.3, satisFiyati: 78.9, sonKullanma: gunEkle(-20), receteli: true, uretici: 'GSK', raf: 'D1' },
  { ad: 'Glucophage', etkenMadde: 'Metformin', form: 'tablet', doz: '1000 mg', kutuAdedi: 100, barkod: '8699569090015', stok: 31, kritikStok: 10, alisFiyati: 44.0, satisFiyati: 63.2, sonKullanma: gunEkle(610), receteli: true, uretici: 'Merck', raf: 'E1' },
];

export const ORNEK_HASTALAR = [
  { ad: 'Ayşe', soyad: 'Yılmaz', kimlikNo: '', dogumTarihi: '1985-04-12', cinsiyet: 'kadin', telefon: '0532 000 00 01', kanGrubu: 'A Rh+', alerjiler: ['Penisilin'], kronikHastaliklar: ['Migren'], surekliIlaclar: [], sigorta: 'sgk', adres: 'Kadıköy / İstanbul', notlar: 'Penisilin grubu antibiyotiklerde döküntü öyküsü var.' },
  { ad: 'Mehmet', soyad: 'Demir', kimlikNo: '', dogumTarihi: '1962-11-03', cinsiyet: 'erkek', telefon: '0533 000 00 02', kanGrubu: '0 Rh+', alerjiler: [], kronikHastaliklar: ['Tip 2 diyabet', 'Hipertansiyon'], surekliIlaclar: ['Metformin 1000 mg'], sigorta: 'sgk', adres: 'Çankaya / Ankara', notlar: '' },
  { ad: 'Zeynep', soyad: 'Kaya', kimlikNo: '', dogumTarihi: '2016-07-21', cinsiyet: 'kadin', telefon: '0535 000 00 03', kanGrubu: 'B Rh−', alerjiler: ['İbuprofen'], kronikHastaliklar: ['Astım'], surekliIlaclar: ['Salbutamol sprey'], sigorta: 'sgk', adres: 'Konak / İzmir', notlar: 'Çocuk hasta — şurup formları tercih ediliyor.' },
];

/** Örnek kayıtları yükler. Zaten yüklüyse hiçbir şey yapmaz. */
export async function ornekYukle(depo) {
  const meta = await depo.meta();
  if (meta.ornekYuklendi) return { ilac: 0, hasta: 0 };
  for (const i of ORNEK_ILACLAR) await depo.kaydet('ilaclar', { ...i, ornek: 1, notlar: '' });
  for (const h of ORNEK_HASTALAR) await depo.kaydet('hastalar', { ...h, ornek: 1 });
  await depo.metaKaydet({ ornekYuklendi: 1 });
  return { ilac: ORNEK_ILACLAR.length, hasta: ORNEK_HASTALAR.length };
}
