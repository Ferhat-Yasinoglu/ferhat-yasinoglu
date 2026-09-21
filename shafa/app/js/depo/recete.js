// Reçete kaydetme: numara ve doğrulama kodu burada verilir.
//
// Karşılama yok: hasta ilacını dışarıdaki eczaneden kendi alıyor. Reçete
// yazılır, numarasını ve kodunu alır, kâğıda basılır.
import { receteNoUret } from '../paylasilan/recete.js';
import { bugun } from '../paylasilan/tarih.js';
import { receteKodu } from './dogrulama.js';
import { tamAd } from '../paylasilan/hasta.js';

/** Reçeteyi kaydeder; numarası boşsa o güne ait sıradaki numarayı verir. */
export async function receteKaydet(depo, recete) {
  const kayit = { ...recete };
  if (!String(kayit.receteNo || '').trim()) {
    const hepsi = await depo.listele('receteler');
    kayit.receteNo = receteNoUret(hepsi.map((r) => r.receteNo), kayit.tarih || bugun());
  }

  // Doğrulama kodu kaydederken üretilir ve reçeteye işlenir: aynı reçete
  // yeniden basıldığında kod değişmez.
  const hasta = kayit.hastaId ? await depo.al('hastalar', kayit.hastaId) : null;
  kayit.dogrulamaKodu = await receteKodu(depo, kayit, tamAd(hasta));

  return depo.kaydet('receteler', kayit);
}
