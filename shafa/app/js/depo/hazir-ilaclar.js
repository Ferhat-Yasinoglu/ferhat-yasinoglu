// Hazır ilaç listesini depoya yükler.
//
// Liste uygulamayla birlikte geliyor (veri/ilaclar.json) ve service worker'ın
// önbelleğinde olduğu için çevrimdışı da yüklenebiliyor. Kendiliğinden
// yüklenmez: hekim Ayarlar'dan açıkça ister. Reçete yazarken ise yüklemeden
// de aranıyor (`katalogOku` + paylasilan/ilac-listesi.js `havuz`); seçilen
// satır o an kayda dönüşüyor (`katalogdanKaydet`).
import {
  eksikleriBul, eskiKayitlariBul, listeKaydi, listeGecerliMi, katalogDamgasi, ilacAnahtari,
} from '../paylasilan/ilac-listesi.js';
import { DepoHatasi } from './depo.js';

const YOL = new URL('../../veri/ilaclar.json', import.meta.url);

/** veri/ilaclar.json'daki `surum` (birim testi ikisini eşit tutuyor).
 *  Açılışta listeyi indirmeden «eski sürüm yüklü mü?» diye bakabilmek için. */
export const HAZIR_LISTE_SURUMU = 3;

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

let bellek = null;   // Oturumda bir kez okunuyor: arama her tuşta ağa gitmesin.

/** Listeyi bir kez okuyup saklar (reçete araması için); ikinci çağrı ağa gitmez.
 *  Ayarlar'daki yükleme `listeyiOku` ile her seferinde tazesini okuyor. */
export async function katalogOku(getir = fetch) {
  if (!bellek) bellek = await listeyiOku(getir);
  return bellek;
}

/** Testler için: saklanan belgeyi unut. */
export const katalogBelleginiBosalt = () => { bellek = null; };

/**
 * Reçetede seçilen ilacı kayda dönüştürür: liste satırıysa (`katalog`)
 * depoya yazar, zaten kayıtsa olduğu gibi döner. Satır o arada (başka
 * sekmede ya da eşitlemeyle) kayda dönüşmüşse yenisi yazılmaz, o kayıt
 * döner — aynı ilaç iki kez oluşmasın. Kimliği (`id`) olan kayıt sayesinde
 * sık yazılanlar, muadiller, alerji uyarısı ve «son kullanım» çalışıyor.
 */
export async function katalogdanKaydet(depo, secilen) {
  if (!secilen?.katalog) return secilen;
  const anahtar = ilacAnahtari(secilen);
  const var_ = (await depo.listele('ilaclar')).find((m) => m.hazirId === secilen.hid || ilacAnahtari(m) === anahtar);
  return var_ || depo.kaydet('ilaclar', listeKaydi(secilen));
}

/** Eski sürümden kalan kayıtları yerinde günceller: önce eski adlar yeni
 *  adlarına, sonra dokunulmamış kayıtlara kimlik ve grup. Sıra önemli: ad
 *  yenilenmeden damga liste satırını bulamaz. */
async function eskileriGuncelle(depo, belge) {
  const guncel = eskiKayitlariBul(await depo.listele('ilaclar'), belge.ilaclar);
  for (const k of guncel) await depo.kaydet('ilaclar', k);
  const damgali = katalogDamgasi(await depo.listele('ilaclar'), belge.ilaclar);
  for (const k of damgali) await depo.kaydet('ilaclar', k);
  return guncel.length + damgali.length;
}

/**
 * Listeyi depoya ekler. Zaten olan ilaç atlanır: iki kez çalıştırmak kopya
 * oluşturmaz ve hekimin kendi düzenlediği kayda dokunmaz. Eski sürümden
 * kalan kayıtlar önce yeni adlarına çekiliyor, yoksa yenisi kopya olarak
 * eklenirdi.
 * @returns {Promise<{eklendi: number, guncellendi: number, atlandi: number, toplam: number}>}
 */
export async function hazirListeyiYukle(depo, getir) {
  const belge = await listeyiOku(getir);
  const guncellendi = await eskileriGuncelle(depo, belge);
  const mevcutlar = await depo.listele('ilaclar');
  const eklenecek = eksikleriBul(mevcutlar, belge.ilaclar);

  for (const h of eklenecek) await depo.kaydet('ilaclar', listeKaydi(h));
  await depo.metaKaydet({ hazirListeSurumu: belge.surum ?? 1 });

  return { eklendi: eklenecek.length, guncellendi, atlandi: belge.ilaclar.length - eklenecek.length, toplam: belge.ilaclar.length };
}

/**
 * Açılışta bir kez: liste eski bir sürümden yüklenmişse oradan gelen
 * kayıtların adlarını yeniler. Yeni ilaç EKLEMİYOR (onu hekim ister);
 * yalnız Türkçe kalmış eski adlar ve «100.000 IU/ml» gibi yanlış okunan
 * dozlar hekim listeyi yeniden yüklemeyi beklemeden düzelsin. 3. sürümde
 * ayrıca dokunulmamış kayıtlara kalıcı kimlik ve grup damgalanıyor
 * (katalogDamgasi): grup süzgeci onları da tanısın.
 * @returns {Promise<number>} güncellenen kayıt sayısı
 */
export async function hazirListeyiTazele(depo, getir) {
  const { hazirListeSurumu } = await depo.meta();
  if (!hazirListeSurumu || hazirListeSurumu >= HAZIR_LISTE_SURUMU) return 0;
  const belge = await listeyiOku(getir);
  const n = await eskileriGuncelle(depo, belge);
  await depo.metaKaydet({ hazirListeSurumu: belge.surum ?? 1 });
  return n;
}
