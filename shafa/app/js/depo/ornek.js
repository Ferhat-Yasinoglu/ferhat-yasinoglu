// Örnek veri: uygulamayı denemek için. Kendiliğinden yüklenmez — Ayarlar'dan
// açıkça istenir ve tek tuşla silinir. Gerçek hasta kayıtlarıyla karışmasın diye
// her kayıt `ornek: 1` taşır ve arayüzde "örnek" rozetiyle görünür.
// Hastalar kurgudur.
export const ORNEK_ILACLAR = [
  { ad: 'Parol', etkenMadde: 'Parasetamol', form: 'tablet', doz: '500 mg', kutuAdedi: 20, barkod: '8699514013059', receteli: false, uretici: 'Atabay' },
  { ad: 'Augmentin BID', etkenMadde: 'Amoksisilin + Klavulanik asit', form: 'tablet', doz: '1000 mg', kutuAdedi: 14, barkod: '8699522090014', receteli: true, uretici: 'GSK' },
  { ad: 'Nurofen', etkenMadde: 'İbuprofen', form: 'tablet', doz: '400 mg', kutuAdedi: 20, barkod: '8699546010158', receteli: false, uretici: 'Reckitt' },
  { ad: 'Ventolin', etkenMadde: 'Salbutamol', form: 'sprey', doz: '100 mcg', kutuAdedi: 1, barkod: '8699522570019', receteli: true, uretici: 'GSK' },
  { ad: 'Majezik', etkenMadde: 'Flurbiprofen', form: 'tablet', doz: '100 mg', kutuAdedi: 15, barkod: '8699532090012', receteli: true, uretici: 'Sanovel' },
  { ad: 'Amoklavin BID', etkenMadde: 'Amoksisilin + Klavulanik asit', form: 'tablet', doz: '1000 mg', kutuAdedi: 14, barkod: '8699508090015', receteli: true, uretici: 'Deva' },
  { ad: 'Zinnat', etkenMadde: 'Sefuroksim aksetil', form: 'surup', doz: '250 mg/5 ml', kutuAdedi: 1, barkod: '8699522570552', receteli: true, uretici: 'GSK' },
  { ad: 'Glucophage', etkenMadde: 'Metformin', form: 'tablet', doz: '1000 mg', kutuAdedi: 100, barkod: '8699569090015', receteli: true, uretici: 'Merck' },
];

export const ORNEK_HASTALAR = [
  { ad: 'Ayşe', soyad: 'Yılmaz', kimlikNo: '', dogumTarihi: '1985-04-12', cinsiyet: 'kadin', telefon: '0532 000 00 01', kanGrubu: 'A Rh+', alerjiler: ['Penisilin'], kronikHastaliklar: ['Migren'], surekliIlaclar: [], sigorta: 'sgk', adres: 'Kadıköy / İstanbul', notlar: 'Penisilin grubu antibiyotiklerde döküntü öyküsü var.' },
  { ad: 'Mehmet', soyad: 'Demir', kimlikNo: '', dogumTarihi: '1962-11-03', cinsiyet: 'erkek', telefon: '0533 000 00 02', kanGrubu: '0 Rh+', alerjiler: [], kronikHastaliklar: ['Tip 2 diyabet', 'Hipertansiyon'], surekliIlaclar: ['Metformin 1000 mg'], sigorta: 'sgk', adres: 'Çankaya / Ankara', notlar: '' },
  { ad: 'Zeynep', soyad: 'Kaya', kimlikNo: '', dogumTarihi: '2016-07-21', cinsiyet: 'kadin', telefon: '0535 000 00 03', kanGrubu: 'B Rh−', alerjiler: ['İbuprofen'], kronikHastaliklar: ['Astım'], surekliIlaclar: ['Salbutamol sprey'], sigorta: 'sgk', adres: 'Konak / İzmir', notlar: 'Çocuk hasta — şurup formları tercih ediliyor.' },
];

/** Örnek antet: reçete kâğıdının nasıl doldurulduğunu göstermek için.
 *  Kurgusal bir hekime aittir — gerçek kimse değildir. Ayarlardaki antet boşsa
 *  örnek veriyle birlikte yüklenir, doktor kendi bilgilerini üstüne yazar. */
export const ORNEK_ANTET = {
  doktorUnvan: 'داکتر',
  doktorAd: 'نمونه احمدی',
  doktorAdAlt: 'Dr. Nemuna Ahmadi',
  uzmanlik: 'معالج امراض داخله عمومی و اطفال',
  slogan: 'سلامتی شما\nهدف ماست',
  hizmetler: 'ثبت و تشخیص گراف برقی قلب (ECG)\nماهر معاینات تلویزیونی (التراساند)',
  hizmetAlanlari: '(قلب ، شش ، معده ، گرده ، شکر ، روماتیزم ، سردردی دوامدار)',
  deneyim: 'سابقه کاری : شفاخانه نمونه و کلینیک تشخیصیه نمونه',
  adres: 'کابل، افغانستان',
  telefon: '0700000000',
  ulkeKodu: '93',
  ayakEtiketleri: 'قلب, شش, معده, اطفال',
};

/** Örnek kayıtları yükler. Zaten yüklüyse hiçbir şey yapmaz. */
export async function ornekYukle(depo) {
  const meta = await depo.meta();
  if (meta.ornekYuklendi) return { ilac: 0, hasta: 0 };
  for (const i of ORNEK_ILACLAR) await depo.kaydet('ilaclar', { ...i, ornek: 1, notlar: '' });
  for (const h of ORNEK_HASTALAR) await depo.kaydet('hastalar', { ...h, ornek: 1 });

  // Antet yalnız boşsa doldurulur: doktor kendi bilgilerini girdiyse silinmez.
  const ayar = await depo.ayarlar();
  if (!String(ayar.doktorAd ?? '').trim()) await depo.ayarKaydet(ORNEK_ANTET);

  await depo.metaKaydet({ ornekYuklendi: 1 });
  return { ilac: ORNEK_ILACLAR.length, hasta: ORNEK_HASTALAR.length };
}
