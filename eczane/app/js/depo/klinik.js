// Klinik seçim listelerini (belirti, tanı, laboratuvar) okur.
//
// İlaç listesinden farklı olarak bunlar depoya YAZILMIYOR: hekimin
// düzenleyeceği kayıtlar değil, sabit seçim listeleri. Uygulamayla geliyor,
// service worker önbelleğinde, yani çevrimdışı da açılıyor.
import { klinikGecerliMi } from '../paylasilan/klinik.js';
import { DepoHatasi } from './depo.js';

const YOL = new URL('../../veri/klinik.json', import.meta.url);

let bellek = null;   // Bir kez okunup saklanıyor: her reçetede ağa gitmesin.

/** Listeleri okur; ikinci çağrıda ağa gitmeden aynı belgeyi verir. */
export async function klinigiOku(getir = fetch) {
  if (bellek) return bellek;
  let belge;
  try {
    const yanit = await getir(YOL);
    if (!yanit.ok) throw new Error(String(yanit.status));
    belge = await yanit.json();
  } catch (e) {
    throw new DepoHatasi('tani_okunamadi', 'Klinik listeler okunamadı: ' + (e?.message || e));
  }
  if (!klinikGecerliMi(belge)) throw new DepoHatasi('tani_bozuk', 'Klinik listeler beklenen biçimde değil.');
  bellek = belge;
  return belge;
}

/** Testler için: saklanan belgeyi unut. */
export const bellegiBosalt = () => { bellek = null; };
