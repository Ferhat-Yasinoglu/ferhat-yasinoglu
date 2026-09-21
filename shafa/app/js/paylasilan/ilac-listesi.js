// Hazır ilaç listesinin birleştirme mantığı.
//
// Liste bir ad sözlüğüdür: hekim her ilacı sıfırdan yazmasın diye. Kullanım
// şekli, doz aralığı ve süre kararı hekimindir; liste bunları taşımaz.
//
// Saf modül: depo ve DOM buradan görünmez.
import { normalize } from './metin.js';

/** İki kaydın "aynı ilaç" sayılması için anahtar: ad + doz + şekil.
 *  Aynı etken maddenin 500 mg tableti ile 250 mg/5 ml şurubu ayrı kayıttır;
 *  hekim reçetede hangisini yazdığını seçebilmeli. */
export const ilacAnahtari = (i) =>
  [normalize(i?.ad), normalize(i?.doz), String(i?.form ?? '').trim()].join('|');

/**
 * Hazır listeden, depoda henüz olmayanları çıkarır.
 * İki kez yüklense de kopya oluşmaz; hekimin elle eklediği ya da düzenlediği
 * kayıtlara dokunulmaz — listeden geleni ezmek, onun yazdığını silmek olurdu.
 */
export function eksikleriBul(mevcutlar, hazirlar) {
  const var_ = new Set((mevcutlar || []).map(ilacAnahtari));
  const eklenecek = [];
  const gorulen = new Set();
  for (const h of hazirlar || []) {
    const a = ilacAnahtari(h);
    if (var_.has(a) || gorulen.has(a)) continue;   // listenin kendi içindeki tekrarı da at
    gorulen.add(a);
    eklenecek.push(h);
  }
  return eklenecek;
}

/** Listeden gelen kaydı depo kaydına çevirir. `hazir: 1` işareti, sonradan
 *  "listeden geleni temizle" diyebilmek için duruyor. */
export const listeKaydi = (h) => ({
  ad: h.ad ?? '', etkenMadde: h.etkenMadde ?? '', form: h.form ?? 'tablet',
  doz: h.doz ?? '', barkod: '', kutuAdedi: '', uretici: '', notlar: '',
  receteli: h.receteli !== false,
  hazir: 1,
});

/** Belgenin beklenen biçimde olup olmadığı. */
export function listeGecerliMi(belge) {
  return !!belge && Array.isArray(belge.ilaclar)
    && belge.ilaclar.every((i) => i && typeof i.ad === 'string' && i.ad.trim() !== '');
}
