// Şikâyet/tanı listesini okur.
//
// İlaç listesinden farklı olarak bu liste depoya YAZILMIYOR: hekimin
// düzenleyeceği bir kayıt değil, sabit bir seçim listesi. Uygulamayla
// geliyor, service worker önbeleğinde, yani çevrimdışı da açılıyor.
import { taniListesiGecerliMi } from '../paylasilan/tani.js';
import { DepoHatasi } from './depo.js';

const YOL = new URL('../../veri/tanilar.json', import.meta.url);

let bellek = null;   // Bir kez okunup saklanıyor: her reçetede ağa gitmesin.

/** Listeyi okur; ikinci çağrıda ağa gitmeden aynı belgeyi verir. */
export async function tanilariOku(getir = fetch) {
  if (bellek) return bellek;
  let belge;
  try {
    const yanit = await getir(YOL);
    if (!yanit.ok) throw new Error(String(yanit.status));
    belge = await yanit.json();
  } catch (e) {
    throw new DepoHatasi('tani_okunamadi', 'Tanı listesi okunamadı: ' + (e?.message || e));
  }
  if (!taniListesiGecerliMi(belge)) throw new DepoHatasi('tani_bozuk', 'Tanı listesi beklenen biçimde değil.');
  bellek = belge;
  return belge;
}

/** Testler için: saklanan belgeyi unut. */
export const bellegiBosalt = () => { bellek = null; };
