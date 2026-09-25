// Örnek veri: uygulamayı denemek için. Kendiliğinden yüklenmez — Ayarlar'dan
// açıkça istenir ve tek tuşla silinir. Gerçek hasta kayıtlarıyla karışmasın diye
// her kayıt `ornek: 1` taşır ve arayüzde "örnek" rozetiyle görünür.
//
// Kayıtlar HEKİMİN ÜLKESİNE göre: Afganistan. Önceki örnek veri Türkiye'den
// devralınmıştı — Ayşe Yılmaz / Kadıköy-İstanbul / SGK / 0532 numaraları ve
// Parol, Majezik gibi yalnız Türkiye'de satılan markalar. Farsça arayüzün
// içinde hem yabancı duruyordu hem de yanıltıcıydı: hekim örnek veriyi
// yükleyince ülkesinde bulunmayan ilaçları listesinde görüyordu.
//
// İlaç adları hazır listedeki (veri/ilaclar.json) gibi uluslararası
// adlandırmayı izliyor. Barkod BİLEREK boş: uydurulan barkod gerçek bir
// ürünün barkoduyla çakışabilir.
//
// Hastalar kurgudur; gerçek kimse değildir.
export const ORNEK_ILACLAR = [
  { ad: 'Panadol', etkenMadde: 'Paracetamol', form: 'tablet', doz: '500 mg', kutuAdedi: 20, barkod: '', receteli: false, uretici: 'GSK' },
  // Aynı etken madde, başka şekil: "muadil" kartı bunun üzerinden çalışıyor.
  { ad: 'Panadol Syrup', etkenMadde: 'Paracetamol', form: 'surup', doz: '120 mg/5 ml', kutuAdedi: 1, barkod: '', receteli: false, uretici: 'GSK' },
  { ad: 'Brufen', etkenMadde: 'Ibuprofen', form: 'tablet', doz: '400 mg', kutuAdedi: 20, barkod: '', receteli: false, uretici: 'Abbott' },
  { ad: 'Augmentin', etkenMadde: 'Amoxicillin + Clavulanic acid', form: 'tablet', doz: '1000 mg', kutuAdedi: 14, barkod: '', receteli: true, uretici: 'GSK' },
  { ad: 'Co-Amoxiclav', etkenMadde: 'Amoxicillin + Clavulanic acid', form: 'tablet', doz: '625 mg', kutuAdedi: 14, barkod: '', receteli: true, uretici: 'Getz' },
  { ad: 'Ventolin', etkenMadde: 'Salbutamol', form: 'sprey', doz: '100 mcg', kutuAdedi: 1, barkod: '', receteli: true, uretici: 'GSK' },
  { ad: 'Flagyl', etkenMadde: 'Metronidazole', form: 'tablet', doz: '500 mg', kutuAdedi: 20, barkod: '', receteli: true, uretici: 'Sanofi' },
  { ad: 'Glucophage', etkenMadde: 'Metformin', form: 'tablet', doz: '1000 mg', kutuAdedi: 100, barkod: '', receteli: true, uretici: 'Merck' },
];

// Sigorta 'yok' (نقدی): Afganistan'da hasta ilacını kendi alıyor, devlet
// sigortası yok. Eski örnekte üçü de 'sgk' idi — o Türkiye'ye ait bir kurum.
export const ORNEK_HASTALAR = [
  { ad: 'فاطمه', soyad: 'احمدی', kimlikNo: '', dogumTarihi: '1985-04-12', cinsiyet: 'kadin', telefon: '0700 000 001', kanGrubu: 'A Rh+', alerjiler: ['Penicillin'], kronikHastaliklar: ['میگرن'], surekliIlaclar: [], sigorta: 'yok', adres: 'کابل', notlar: 'سابقه بثورات جلدی با آنتی‌بیوتیک‌های گروه پنی‌سیلین دارد.' },
  { ad: 'محمد نعیم', soyad: 'رحیمی', kimlikNo: '', dogumTarihi: '1962-11-03', cinsiyet: 'erkek', telefon: '0700 000 002', kanGrubu: '0 Rh+', alerjiler: [], kronikHastaliklar: ['دیابت نوع ۲', 'فشار خون بلند'], surekliIlaclar: ['Metformin 1000 mg'], sigorta: 'yok', adres: 'مزار شریف', notlar: '' },
  { ad: 'زهرا', soyad: 'صدیقی', kimlikNo: '', dogumTarihi: '2016-07-21', cinsiyet: 'kadin', telefon: '0700 000 003', kanGrubu: 'B Rh−', alerjiler: ['Ibuprofen'], kronikHastaliklar: ['آسم'], surekliIlaclar: ['Salbutamol'], sigorta: 'yok', adres: 'کندز', notlar: 'مریض طفل — شکل شربت ترجیح داده می‌شود.' },
];

/** Örnek antet: reçete kâğıdının nasıl doldurulduğunu göstermek için.
 *  Kurgusal bir hekime aittir — gerçek kimse değildir. Ayarlardaki antet boşsa
 *  örnek veriyle birlikte yüklenir, doktor kendi bilgilerini üstüne yazar. */
export const ORNEK_ANTET = {
  doktorUnvan: 'داکتر',
  doktorAd: 'نمونه احمدی',
  doktorAdAlt: 'Dr. Nemuna Ahmadi',
  uzmanlik: 'معالج امراض داخله عمومی و اطفال',
  // Lacivert kâğıdın İngilizce sütunu. Uydurma ve açıkça örnek: gerçek bir
  // hekimin ya da kurumun adı değil.
  uzmanlikEn: 'Physician specializing in Internal Medicine and Pediatrics',
  hizmetlerEn: 'Specialist in Internal Medicine\nECG Recording and Interpretation\nTreatment of Heart, Lung, Stomach, Kidney Diseases\nDiabetes, Hypertension, Chronic Headaches',
  // Tek satır: sol sütunun altı madde satırına (4 hizmet, başlık, yer) sığsın.
  deneyimEn: 'Sample Hospital, Sample Diagnostic Clinic',
  slogan: 'سلامتی شما\nهدف ماست',
  hizmetler: 'ثبت و تشخیص گراف برقی قلب (ECG)\nماهر معاینات تلویزیونی (التراساند)',
  hizmetAlanlari: '(قلب ، شش ، معده ، گرده ، شکر ، روماتیزم ، سردردی دوامدار)',
  deneyim: 'سابقه کاری : شفاخانه نمونه و کلینیک تشخیصیه نمونه',
  adres: 'کابل، افغانستان',
  adresEn: 'Kabul, Afghanistan',
  telefon: '0700000000',
  ulkeKodu: '93',
  ayakEtiketleri: 'قلب, شش, معده, گرده, شکر, روماتیزم, سردرد',
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

/**
 * Örnek antetin bıraktığı alanları temizler.
 *
 * Örnek veri silinirken ayarlara dokunulmuyordu (depo.ornekSil 'ayarlar'
 * koleksiyonunu atlıyor). Sonuç: hekim örnek kayıtları sildikten sonra da
 * kâğıdın başında «داکتر نمونه احمدی», altında «شفاخانه نمونه» basılmaya
 * devam ediyordu — silinen veri kâğıtta yaşıyordu.
 *
 * Yalnız DEĞİŞMEMİŞ alanlar siliniyor: değer hâlâ örnekteki değerse bu alana
 * hekim dokunmamış demektir, temizlenir. Kendi bilgisini yazdıysa olduğu gibi
 * kalır — silme işlemi hekimin kendi antedini asla götürmemeli.
 */
export async function ornekAntetiSil(depo) {
  const ayar = await depo.ayarlar();
  const temiz = {};
  for (const [k, v] of Object.entries(ORNEK_ANTET)) {
    if (String(ayar[k] ?? '') === String(v)) temiz[k] = '';
  }
  if (Object.keys(temiz).length) await depo.ayarKaydet(temiz);
  return Object.keys(temiz).length;
}
