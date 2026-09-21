// Hazır ilaç listesini depoya yükler.
//
// Liste uygulamayla birlikte geliyor (veri/ilaclar.json) ve service worker'ın
// önbelleğinde olduğu için çevrimdışı da yüklenebiliyor. Kendiliğinden
// yüklenmez: hekim Ayarlar'dan açıkça ister.
import { eksikleriBul, listeKaydi, listeGecerliMi } from '../paylasilan/ilac-listesi.js';
import { DepoHatasi } from './depo.js';

const YOL = new URL('../../veri/ilaclar.json', import.meta.url);

/** Listeyi okur. Ağ yoksa ve önbellekte de yoksa hata atar. */
export async function listeyiOku(getir = fetch) {
  let belge;
  try {
    const yanit = await getir(YOL);
    if (!yanit.ok) throw new Error(String(yanit.status));
    belge = await yanit.json();
  } catch (e) {
    throw new DepoHatasi('liste_okunamadi', 'İlaç listesi okunamadı: ' + (e?.message || e));
  }
  if (!listeGecerliMi(belge)) throw new DepoHatasi('liste_bozuk', 'İlaç listesi beklenen biçimde değil.');
  return belge;
}

/**
 * Listeyi depoya ekler. Zaten olan ilaç atlanır: iki kez çalıştırmak kopya
 * oluşturmaz ve hekimin kendi düzenlediği kayda dokunmaz.
 * @returns {Promise<{eklendi: number, atlandi: number, toplam: number}>}
 */
export async function hazirListeyiYukle(depo, getir) {
  const belge = await listeyiOku(getir);
  const mevcutlar = await depo.listele('ilaclar');
  const eklenecek = eksikleriBul(mevcutlar, belge.ilaclar);

  for (const h of eklenecek) await depo.kaydet('ilaclar', listeKaydi(h));
  await depo.metaKaydet({ hazirListeSurumu: belge.surum ?? 1 });

  return { eklendi: eklenecek.length, atlandi: belge.ilaclar.length - eklenecek.length, toplam: belge.ilaclar.length };
}
