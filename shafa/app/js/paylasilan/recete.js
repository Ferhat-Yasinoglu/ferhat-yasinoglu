// Reçete alanı: reçete türleri, satırlar, numara üretimi, klinik uyarılar.
// Reçete başlığındaki alanlar (numara, tanı, doktor bilgileri…) sema tarafında
// tutulur.
//
// Burada "karşılama" (ne verildi, ne verilmedi) yok: hasta ilacını dışarıdaki
// eczaneden kendi alıyor, hekim neyin verildiğini zaten bilemez. Reçete
// yazılır, kâğıda basılır, gönderilir — hikâye burada biter.

export const RECETE_TURLERI = [
  ['normal', 'Normal reçete'], ['kirmizi', 'Kırmızı reçete'], ['yesil', 'Yeşil reçete'],
  ['mor', 'Mor reçete'], ['turuncu', 'Turuncu reçete'],
];
export const receteTuruAdi = (k) => RECETE_TURLERI.find(([v]) => v === k)?.[1] || k;

/** Listelerde gösterilen sayılar. */
export function receteOzet(recete) {
  return { toplam: (recete?.satirlar || []).length };
}

/** Boş reçete satırı. */
export function bosSatir() {
  return { ilacId: '', ilacAdi: '', form: '', adet: 1, kullanim: '', sure: '', yol: '', not: '' };
}

/** Gün içinde artan reçete numarası: "2026-09-20-03". Aynı güne ait en büyük
 *  numaranın sırasını bir artırır; numara elle de yazılabilir. */
export function receteNoUret(mevcutNolar, gun) {
  const onek = String(gun).slice(0, 10);
  const enBuyuk = (mevcutNolar || [])
    .map((n) => String(n ?? ''))
    .filter((n) => n.startsWith(onek + '-'))
    .map((n) => Number(n.slice(onek.length + 1)))
    .filter(Number.isFinite)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${onek}-${String(enBuyuk + 1).padStart(2, '0')}`;
}

/** Sık kullanılan kullanım şekilleri — yazmak yerine seçilebilsin diye. */
export const KULLANIM_ONERILERI = [
  'Günde 1×1', 'Günde 2×1', 'Günde 3×1', 'Günde 1×2', 'Günde 2×2',
  '12 saatte bir', '8 saatte bir', 'Aç karnına', 'Tok karnına', 'Gerektikçe',
];

/** Yeni reçete iskeleti. Doktor bilgileri ayarlardan gelir ve reçeteye
 *  mühürlenir: ayarlar sonradan değişse bile eski reçete yazıldığı günkü
 *  bilgiyi taşır. */
export function bosRecete(ayar = {}, gun = '') {
  return {
    receteNo: '', tarih: gun, tur: 'normal', hastaId: '',
    belirtiler: '', tani: '', taniKodu: '', laboratuvar: '', kanGrubu: '', protokolNo: '', notlar: '', satirlar: [],
    olcumler: {},
    doktorAd: ayar.doktorAd || '', doktorUnvan: ayar.doktorUnvan || '',
    diplomaNo: ayar.diplomaNo || '', kurum: ayar.kurum || '',
  };
}

/** Reçete kâğıdının sol sütunundaki klinik ölçümler.
 *  [anahtar, Türkçe ad, kısaltma, birim] — kısaltma çıktıda değişmez. */
/** Kan grupları. Hastanın kaydında da duruyor; reçeteye SEÇİLDİĞİ ANDAKİ
 *  hâliyle mühürleniyor — doktor bilgileri gibi. Sonradan hasta kaydı
 *  değişse bile basılmış reçete o günkü bilgiyi taşır. */
export const KAN_GRUPLARI = [
  'A Rh+', 'A Rh−', 'B Rh+', 'B Rh−', 'AB Rh+', 'AB Rh−', '0 Rh+', '0 Rh−',
];

/** İlacın veriliş yolu. Şekil çoğu zaman yolu ima ediyor ama ampulde
 *  (عضلی mi وریدی mi) ima etmiyor; hekim seçsin diye duruyor. */
export const YOLLAR = [
  'Ağızdan', 'Kas içine', 'Damar içine', 'Deri üstüne', 'Göze', 'Kulağa',
  'Buruna', 'Solunumla', 'Makattan', 'Dil altına',
];

/** Süre için hazır seçenekler. Kullanım önerileri gibi bunlar da yalnız
 *  YAZIM kısayolu: hangi ilacın kaç gün süreceğine hekim karar verir,
 *  liste ilaçla eşleştirilmiş değil. */
export const SURE_ONERILERI = [
  '3 gün', '5 gün', '7 gün', '10 gün', '15 gün', '1 ay', 'Tek doz', 'Sürekli',
];

/**
 * Hekimin en çok yazdığı ilaçlar, çok yazılandan aza.
 * Reçete satırındaki ilaç kimliğine göre sayar; silinmiş ilaç listede
 * bulunmadığı için kendiliğinden düşer — buradan tekrar seçilemez zaten.
 * (Panel'deki sayım ADA göre: orada silinmiş ilaç da geçmişte görünmeli.)
 */
export function sikIlaclar(receteler, ilaclar, sinir = 8) {
  const sayim = new Map();
  for (const r of receteler || []) {
    for (const satir of r?.satirlar || []) {
      const id = satir?.ilacId;
      if (id) sayim.set(id, (sayim.get(id) || 0) + 1);
    }
  }
  return [...sayim.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => (ilaclar || []).find((i) => i.id === id))
    .filter(Boolean)
    .slice(0, sinir);
}

/* Birimler İNGİLİZCE: Clinical sütunu kâğıtta da ekranda da İngilizce
   ("BP", "Temperature", "SpO2"). Türkçe "/dk" onların arasında yabancı
   duruyordu. Kâğıda basılmıyorlar, yalnız form yer tutucusu. */
export const OLCUMLER = [
  ['bp', 'Kan basıncı', 'BP', 'mmHg / mmHg'],
  ['pr', 'Nabız', 'PR', '/min'],
  ['rr', 'Solunum', 'RR', '/min'],
  ['bw', 'Kilo', 'BW', 'kg'],
  ['temp', 'Ateş', 'T', '°C'],
  ['spo2', 'Oksijen', 'SpO₂', '%'],
  ['ht', 'Boy', 'Ht', 'cm'],
];

/** Dolu olan ölçümler: çıktıda ve kartta yalnız bunlar gösterilir. */
export const doluOlcumler = (recete) =>
  OLCUMLER.filter(([k]) => String(recete?.olcumler?.[k] ?? '').trim() !== '');

/** Alan → hata kodu. Metni arayüz çevirir (bkz. hatalar.js). */
export function receteDogrula(recete) {
  const h = {};
  if (!recete.hastaId) h.hastaId = 'hasta_gerekli';
  if (!String(recete.tarih ?? '').match(/^\d{4}-\d{2}-\d{2}$/)) h.tarih = 'tarih_gecersiz';
  if (!recete.satirlar?.length) h.satirlar = 'ilac_gerekli';
  else if (recete.satirlar.some((s) => !(Number(s.adet) > 0))) h.satirlar = 'adet_gecersiz';
  return h;
}

/**
 * Reçetenin klinik uyarıları. Saf: hasta ve ilaç kayıtlarını dışarıdan alır,
 * metin değil kod ve değişken döndürür — cümleyi arayüz kurar.
 * Her uyarı hangi satıra ait olduğunu `satir` alanında taşır
 * (reçetenin tamamına ait uyarılarda -1).
 */
export function receteUyarilari(satirlar, hasta, ilaclar, sec = {}) {
  const { alerjiBul } = sec;
  const u = [];
  const bul = (id) => (ilaclar || []).find((x) => x.id === id);
  const etkenSayaci = new Map();

  (satirlar || []).forEach((s, i) => {
    const ilac = bul(s.ilacId);
    if (!ilac) return;

    if (alerjiBul && hasta) {
      const a = alerjiBul(hasta, ilac);
      if (a) u.push({ satir: i, tur: 'hata', kod: 'alerji', veri: { ad: ilac.ad, a } });
    }

    const etken = String(ilac.etkenMadde || '').trim().toLocaleLowerCase('tr');
    if (etken) etkenSayaci.set(etken, [...(etkenSayaci.get(etken) || []), { i, ad: ilac.ad }]);
  });

  // Aynı etken madde iki satırda: çift doz riski.
  for (const [, satirlarDizisi] of etkenSayaci) {
    if (satirlarDizisi.length > 1) {
      u.push({
        satir: satirlarDizisi[1].i, tur: 'uyari', kod: 'cift_etken',
        veri: { liste: satirlarDizisi.map((x) => x.ad).join(', ') },
      });
    }
  }
  return u;
}

/**
 * Reçetenin düz metin hali: WhatsApp, e-posta ve QR için.
 * Etiketler dışarıdan verilir — bu modül saf kalır, dili çağıran bilir.
 */
export function receteMetni(recete, hasta, ayar = {}, etiket = {}) {
  const e = {
    recete: 'Reçete', tarih: 'Tarih', hasta: 'Hasta', yas: 'Yaş', tani: 'Tanı',
    belirtiler: 'Belirtiler', laboratuvar: 'Laboratuvar',
    ilaclar: 'İlaçlar', not: 'Not', doktor: 'Doktor', alerji: 'Alerji',
    adet: 'kutu', ...etiket,
  };
  const satirlar = [];
  const ekle = (etiketi, deger) => { if (deger) satirlar.push(`${etiketi}: ${deger}`); };

  const doktor = [recete.doktorUnvan, recete.doktorAd].filter(Boolean).join(' ');
  if (ayar.klinikAdi) satirlar.push(ayar.klinikAdi);
  if (doktor) satirlar.push(doktor);
  if (satirlar.length) satirlar.push('');

  ekle(e.recete, recete.receteNo);
  ekle(e.tarih, String(recete.tarih || '').slice(0, 10));
  ekle(e.hasta, etiket.hastaAdi || '');
  ekle(e.belirtiler, recete.belirtiler);
  ekle(e.tani, [recete.tani, recete.taniKodu].filter(Boolean).join(' · '));
  if ((hasta?.alerjiler || []).length) ekle(e.alerji, hasta.alerjiler.join(', '));

  if ((recete.satirlar || []).length) {
    satirlar.push('', e.ilaclar + ':');
    recete.satirlar.forEach((s, i) => {
      const parcalar = [`${s.adet} ${e.adet}`, s.kullanim, s.sure, s.yol].filter(Boolean).join(' · ');
      satirlar.push(`${i + 1}) ${s.ilacAdi}${parcalar ? ' — ' + parcalar : ''}${s.not ? ` (${s.not})` : ''}`);
    });
  }
  if (recete.laboratuvar) { satirlar.push(''); ekle(e.laboratuvar, recete.laboratuvar); }
  if (recete.notlar) { satirlar.push(''); ekle(e.not, recete.notlar); }
  if (ayar.telefon) { satirlar.push(''); satirlar.push(ayar.telefon); }

  return satirlar.join('\n').trim();
}
