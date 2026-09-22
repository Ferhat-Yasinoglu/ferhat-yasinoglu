// Tarih yardımcıları. Uygulama gün bazlı çalışır (son kullanma, doğum, reçete günü),
// bu yüzden anahtar biçim yerel saate göre "YYYY-MM-DD"dir. UTC'ye çevirmek
// Türkiye'de tarihleri bir gün geri kaydırabilirdi.

export function isoGun(d = new Date()) {
  const t = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(t.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

export const bugun = () => isoGun(new Date());

/** b - a, tam gün olarak. Saat farkları yok sayılır. */
export function gunFarki(a, b) {
  if (!a || !b) return null;
  const [y1, a1, g1] = String(a).slice(0, 10).split('-').map(Number);
  const [y2, a2, g2] = String(b).slice(0, 10).split('-').map(Number);
  if (!y1 || !y2) return null;
  const t1 = Date.UTC(y1, a1 - 1, g1);
  const t2 = Date.UTC(y2, a2 - 1, g2);
  return Math.round((t2 - t1) / 86400000);
}

/* Hekim ve hastaları ŞEMSİ (hicri şemsi) takvim kullanıyor: reçetede,
   listelerde ve kâğıtta görünen tarih o takvimde olmalı.

   Depoda tarih MİLADİ ISO (YYYY-MM-DD) kalıyor ve öyle kalmalı: sıralama,
   reçete numarası (YYYY-MM-DD-NN) ve sahtecilik özeti hep ona bağlı.
   Değişen yalnız GÖSTERİM.

   Intl bu takvimi kendi biliyor, ek bir kütüphane gerekmiyor — projenin
   çalışma anında hiç bağımlılığı yok, öyle kalıyor. `nu-latn` rakamları
   Latin tutuyor: uygulamanın geri kalanı da öyle. */
const SEMSI = new Intl.DateTimeFormat('fa-AF-u-ca-persian-nu-latn', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC',
});

const semsiParcala = (yil, ay, gun) => {
  const p = {};
  for (const x of SEMSI.formatToParts(new Date(Date.UTC(yil, ay - 1, gun)))) {
    if (x.type !== 'literal') p[x.type] = x.value;
  }
  return p;
};

/* ---------- Şemsi ↔ miladi çevrim ----------

   Intl yalnız TEK YÖNE çeviriyor: miladi → şemsi. Tarih seçicide ters yön
   de gerekiyor (hekim şemsi yazıyor, depoya miladi giriyor) ve Intl bunu
   vermiyor.

   Takvim kurallarını (artık yıl çevrimi, ay uzunlukları) elle yazmak yerine
   tahmin + DÜZELTME kullanılıyor: kaba bir gün sayısı tahmin ediliyor,
   sonuç Intl'e sorulup fark kadar kaydırılıyor, sonunda ±8 günlük tarama
   kesin günü buluyor. Böylece çevrim Intl'in kullandığı takvimin AYNISINI
   kullanıyor; giriş ile gösterim hiçbir tarihte ayrışamaz — kendi artık yıl
   kuralımızı yazsaydık ayrışabilirdi.

   1900–2100 arası 73.414 günün tamamı gidiş-dönüş denendi (bkz.
   test/tarih.test.js), uyuşmazlık yok. */

const GUN_MS = 86400000;
const gunNo = (y, a, g) => Math.round(Date.UTC(y, a - 1, g) / GUN_MS);
const gunden = (n) => { const d = new Date(n * GUN_MS); return { yil: d.getUTCFullYear(), ay: d.getUTCMonth() + 1, gun: d.getUTCDate() }; };

const semsiGunden = (n) => {
  const p = {};
  for (const x of SEMSI.formatToParts(new Date(n * GUN_MS))) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return { yil: p.year, ay: p.month, gun: p.day };
};

// Aynı ay defalarca çiziliyor (takvim ızgarası, ileri/geri gezinme):
// bulunan günler saklanıyor ki her seferinde yeniden aranmasın.
const bellek = new Map();

/** Şemsi (yıl, ay, gün) → UTC gün sayısı. Geçersizse null. */
function semsiGunNo(sy, sa, sg) {
  if (!Number.isInteger(sy) || !Number.isInteger(sa) || !Number.isInteger(sg)) return null;
  if (sa < 1 || sa > 12 || sg < 1 || sg > 31 || sy < 1 || sy > 3000) return null;
  const anahtar = sy * 10000 + sa * 100 + sg;
  if (bellek.has(anahtar)) return bellek.get(anahtar);
  // Çapa: 2026-09-22 = 1405/06/31.
  let n = gunNo(2026, 9, 22) + Math.round((sy - 1405) * 365.2425 + (sa - 6) * 30.44 + (sg - 31));
  for (let i = 0; i < 6; i++) {
    const p = semsiGunden(n);
    if (p.yil === sy && p.ay === sa && p.gun === sg) { bellek.set(anahtar, n); return n; }
    const fark = Math.round((sy - p.yil) * 365.2425 + (sa - p.ay) * 30.44 + (sg - p.gun));
    if (fark === 0) break;
    n += fark;
  }
  for (let k = -8; k <= 8; k++) {
    const p = semsiGunden(n + k);
    if (p.yil === sy && p.ay === sa && p.gun === sg) { bellek.set(anahtar, n + k); return n + k; }
  }
  // Buraya düşmek "böyle bir gün yok" demek (31 حوت gibi).
  bellek.set(anahtar, null);
  return null;
}

/** ISO tarihi şemsi parçalarına ayırır: '2026-09-22' → { yil: 1405, ay: 6, gun: 31 } */
export function semsiye(iso) {
  const g = String(iso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g)) return null;
  const [y, a, gun] = g.split('-').map(Number);
  const d = new Date(Date.UTC(y, a - 1, gun));
  if (Number.isNaN(d.getTime())) return null;
  return semsiGunden(gunNo(y, a, gun));
}

/** Şemsi tarihten miladi ISO: (1405, 6, 31) → '2026-09-22'. Yoksa ''.
 *
 *  Sözleşme kesin: ya `YYYY-MM-DD` ya boş dize. Sonuç biçimi burada
 *  DENETLENİYOR — çağıran kod (tarih seçici, doğrulayıcılar) buna güveniyor.
 *  Önce denetlenmiyordu: şemsi yıl 378'den küçükken üç haneli bir metin
 *  çıkıyordu ('761-09-22'); daha sinsisi, 379–999 arası yıllar dört haneli
 *  ama bambaşka bir ISO veriyordu (405 → '1026-09-22') ve doğrulama
 *  düzeneğinin hepsini geçip sessizce yanlış yıla kaydediyordu. Dolu bir
 *  kutuda «1405»in başındaki 1'i silmek bunun için yetiyordu. */
const ISO_KALIBI = /^\d{4}-\d{2}-\d{2}$/;
export function semsiden(sy, sa, sg) {
  const n = semsiGunNo(Number(sy), Number(sa), Number(sg));
  if (n === null) return '';
  const p = gunden(n);
  const iki = (x) => String(x).padStart(2, '0');
  const iso = `${p.yil}-${iki(p.ay)}-${iki(p.gun)}`;
  return ISO_KALIBI.test(iso) ? iso : '';
}

/** Şemsi ayın kaç gün çektiği. Ay uzunlukları elle yazılmıyor: ayın 1'i ile
 *  sonraki ayın 1'i arasındaki fark ne ise o. */
export function semsiAyGunu(sy, sa) {
  const bas = semsiGunNo(sy, sa, 1);
  const son = sa === 12 ? semsiGunNo(sy + 1, 1, 1) : semsiGunNo(sy, sa + 1, 1);
  return (bas === null || son === null) ? 30 : son - bas;
}

/* Ay adları Afganistan'ınki (حمل، ثور، جوزا…), İran'ınki değil — `fa-AF`
   ikisini ayırıyor ve hekim bunları kullanıyor.
   CLDR سنبله'yi izafet hemzesiyle ("سنبلهٔ") veriyor; o biçim tamlamada
   doğru, takvim başlığında değil — sondaki hemze siliniyor. */
const AY_BICIMI = new Intl.DateTimeFormat('fa-AF-u-ca-persian', { month: 'long', timeZone: 'UTC' });
let ayAdlari = null;
export function semsiAyAdi(sa) {
  if (!ayAdlari) {
    ayAdlari = [];
    for (let m = 1; m <= 12; m++) {
      const n = semsiGunNo(1405, m, 1);
      ayAdlari.push(AY_BICIMI.format(new Date(n * GUN_MS)).replace(/\u0654$/, ''));
    }
  }
  return ayAdlari[sa - 1] || String(sa);
}

/** Hafta günleri, haftanın BAŞLADIĞI günden (شنبه) başlayarak.
 *  [{ kisa: 'ش', tam: 'شنبه' }, …] — Farsçada `short` tam adı veriyor ve
 *  yedi sütuna sığmıyor; takvimlerdeki tek harfli biçim `narrow`da. */
const GUN_KISA = new Intl.DateTimeFormat('fa-AF', { weekday: 'narrow', timeZone: 'UTC' });
const GUN_TAM = new Intl.DateTimeFormat('fa-AF', { weekday: 'long', timeZone: 'UTC' });
let gunAdlari = null;
export function semsiGunAdlari() {
  // 2026-09-19 bir cumartesi (شنبه): Afganistan'da hafta orada başlıyor.
  if (!gunAdlari) {
    gunAdlari = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 8, 19 + i));
      return { kisa: GUN_KISA.format(d), tam: GUN_TAM.format(d) };
    });
  }
  return gunAdlari;
}

/** Ayın 1'i haftanın kaçıncı sütununa düşüyor (0 = شنبه). */
export function semsiAyBasiSutunu(sy, sa) {
  const n = semsiGunNo(sy, sa, 1);
  if (n === null) return 0;
  // getUTCDay: 0 pazar … 6 cumartesi. Cumartesi'yi 0'a çekiyoruz.
  return (new Date(n * GUN_MS).getUTCDay() + 1) % 7;
}

/** ISO tarihi şemsi takvimde yazar: 2026-09-22 → 1405/06/31. */
export function tarihMetni(iso) {
  const g = String(iso ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g)) return '—';
  const [y, a, gun] = g.split('-').map(Number);
  const p = semsiParcala(y, a, gun);
  return `${p.year}/${p.month}/${p.day}`;
}

/** Zaman damgasını şemsi tarih + yerel saat olarak yazar. */
export function tarihSaatMetni(damga) {
  if (!damga) return '—';
  const d = new Date(damga);
  if (Number.isNaN(d.getTime())) return '—';
  const iki = (n) => String(n).padStart(2, '0');
  // Gün YEREL bileşenlerden: damgayı UTC'ye çevirip biçimlersek gece yarısı
  // civarında tarih bir gün kayıyor.
  const p = semsiParcala(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${p.year}/${p.month}/${p.day} ${iki(d.getHours())}:${iki(d.getMinutes())}`;
}

/** Doğum tarihinden yaş. Doğum günü henüz gelmediyse bir eksiltir. */
export function yasHesapla(dogum, referans = bugun()) {
  const fark = gunFarki(dogum, referans);
  if (fark === null || fark < 0) return null;
  const [dy, da, dg] = String(dogum).slice(0, 10).split('-').map(Number);
  const [ry, ra, rg] = String(referans).slice(0, 10).split('-').map(Number);
  let yas = ry - dy;
  if (ra < da || (ra === da && rg < dg)) yas--;
  return yas;
}

/**
 * Bugüne göre uzaklık. Metin değil kod döner — bu modül saf kalır, cümleyi
 * arayüz kurar: { kod: 'bugun'|'yarin'|'dun'|'sonra'|'once'|'yok', gun }
 */
export function goreliGun(iso, referans = bugun()) {
  const f = gunFarki(referans, String(iso ?? '').slice(0, 10));
  if (f === null) return { kod: 'yok', gun: 0 };
  if (f === 0) return { kod: 'bugun', gun: 0 };
  if (f === 1) return { kod: 'yarin', gun: 1 };
  if (f === -1) return { kod: 'dun', gun: 1 };
  return f > 0 ? { kod: 'sonra', gun: f } : { kod: 'once', gun: -f };
}
