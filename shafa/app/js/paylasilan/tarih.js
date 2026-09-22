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
