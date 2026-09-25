// Eşitleme: iki cihazın aynı veriyi kullanması.
//
// Akış her seferinde aynı ve tek yönlü değil, gidiş-dönüş:
//   1. Uzaktaki kasayı indir, parolayla aç
//   2. İçindekini YERELE birleştir (iceAktar: kayıt kayıt, yenisi kazanır)
//   3. Birleşmiş halin tamamını derle, şifrele, geri yükle
// Böylece iki cihaz da her eşitlemede birleşimi alıyor; hangisinin önce
// eşitlendiği sonucu değiştirmiyor.
//
// Taşıyıcı bir arayüz: `oku()` ve `yaz()`. Hesap sunucusu (senkron/sunucu.js)
// bunun gerçeklemesi; testler bellekte duran sahte bir taşıyıcı kullanıyor.
// Eşitleme mantığının doğruluğu ağa bağlı değil, bu ayrım bilerek.
//
// Buluta giden belgede cihaza özel ayarlar ve örnek (demo) kayıtlar yok;
// buluttan gelende de olsalar yok sayılır.
import { belgeDerle, iceAktar, yedekDogrula } from './yedek.js';
import { belgeyiTemizle, belgeParmakIzi, raporToplami, ornekleriAyikla, ESKI_SENKRON_AYARLARI } from '../paylasilan/senkron.js';
import { kasayaKoy, kasadanAl, kasaMi, kasaTuzu, KasaHatasi } from '../paylasilan/kasa.js';

export class SenkronHatasi extends Error {
  constructor(kod, mesaj, veri = null) { super(mesaj || kod); this.kod = kod; this.veri = veri; }
}

/** Uzak taraf bizim okumamızdan sonra değiştiyse yazma reddedilir ve
 *  baştan başlarız. Üç deneme: ikisi bile pratikte fazla, tek kullanıcı var. */
const DENEME = 3;

/* Kasa hatalarından bu kodlar olduğu gibi geçer: her biri hekime ayrı bir
   şey söylüyor (anahtar tutmuyor / uygulamayı güncelle / tarayıcıyı güncelle).
   Gerisi "bulutta bozuk bir kasa" demek. */
const GECEN_KASA_HATALARI = ['parola', 'surum', 'gzip_yok'];

/**
 * Bir eşitleme turu.
 * tasima: { oku(): {paket, surum}, yaz(paket, {surum}): {surum} }
 * Döner: { indirildi, yuklendi, rapor, cakisan, surum }
 *
 * `sifresizKabul` VARSAYILANDA KAPALI: uzaktaki paket bir kasa değilse
 * birleştirilmez, 'kasa_bozuk' düşer. Kasa AES-GCM ile K'ye bağlı; K'yi
 * bilmeyen biri (jetonu çalan, sahte bir sunucu, ele geçirilmiş bir dağıtım)
 * yalnız kasa DIŞI bir paket koyabilir. Onu kabul etseydik sahte hasta,
 * antet ve reçete doğrulama anahtarı bütün cihazlara yayılır, sonra her cihaz
 * onu kendi K'siyle şifreleyip "meşru" hale getirirdi. Seçenek yalnız bilerek
 * açık belge okuyan çağıranlar için (testler).
 */
export async function senkronEt(depo, tasima, { parola, sifresizKabul = false } = {}) {
  if (!parola) throw new SenkronHatasi('parola_yok', 'Kasa parolası gerekli.');

  for (let deneme = 1; deneme <= DENEME; deneme++) {
    const { paket, surum } = await tasima.oku();

    let uzakBelge = null;
    if (paket) {
      if (kasaMi(paket)) {
        try { uzakBelge = await kasadanAl(paket, parola); }
        catch (e) {
          if (e instanceof KasaHatasi) throw new SenkronHatasi(GECEN_KASA_HATALARI.includes(e.kod) ? e.kod : 'kasa_bozuk', e.message);
          throw e;
        }
      } else if (sifresizKabul && paket.bicim) {
        uzakBelge = paket;
      } else {
        throw new SenkronHatasi('kasa_bozuk', 'Uzaktaki paket bir kasa değil; birleştirilmedi.');
      }
      // Örnek kayıtlar (eski bir istemci yüklemiş olabilir) hiçbir zaman
      // indirilmez: hekim onları bu cihazda silmiş olabilir.
      if (uzakBelge && typeof uzakBelge === 'object') uzakBelge = ornekleriAyikla(uzakBelge);
    }

    let rapor = {};
    let cakisan = [];
    if (uzakBelge) {
      const dogrulama = yedekDogrula(uzakBelge);
      if (!dogrulama.gecerli) throw new SenkronHatasi('uzak_bozuk', dogrulama.hatalar.join(' '));
      const sonuc = await iceAktar(depo, uzakBelge, { strateji: 'birlestir' });
      if (!sonuc.ok) throw new SenkronHatasi('uzak_bozuk', sonuc.hatalar.join(' '));
      rapor = sonuc.rapor;
      cakisan = sonuc.cakisan;
    }

    const yerel = ornekleriAyikla(belgeyiTemizle(await belgeDerle(depo)));
    const indirildi = raporToplami(rapor);

    // Birleşim uzaktakiyle bire bir aynıysa yüklemeye gerek yok. Parmak izi
    // rev'e bakmıyor: her içe aktarma rev'i artırdığı için aynı içerik iki
    // cihazda farklı rev taşıyor ve buna baksaydık boş yere yazıp dururduk.
    //
    // ŞİFRESİZ kopya (yalnız sifresizKabul ile okunur) bu kısayoldan muaf:
    // içerik aynı diye atlasaydık hasta bilgisi orada açık haliyle kalırdı;
    // "değişen bir şey yok" doğru ama "yapılacak bir şey yok" değil.
    const degismedi = uzakBelge && kasaMi(paket)
      && belgeParmakIzi(belgeyiTemizle(uzakBelge)) === belgeParmakIzi(yerel);
    if (degismedi) return { indirildi, yuklendi: false, rapor, cakisan, surum };

    const yeniPaket = await kasayaKoy(yerel, parola, { tuz: kasaTuzu(paket) });
    try {
      const sonuc = await tasima.yaz(yeniPaket, { surum });
      return { indirildi, yuklendi: true, rapor, cakisan, surum: sonuc?.surum || '' };
    } catch (e) {
      // Öbür cihaz arada yazmış: okuduğumuz hal eskidi, baştan birleştir.
      if (e?.kod === 'cakisma' && deneme < DENEME) continue;
      throw e;
    }
  }
  throw new SenkronHatasi('cakisma', 'Uzak kopya sürekli değişiyor; sonra dene.');
}

/** Bellekte duran sahte taşıyıcı — testler ve tarayıcı denemesi için.
 *  Sunucunun davranışını taklit eder: sürüm tutmayan yazma reddedilir. */
export function bellekTasima(baslangic = null) {
  let paket = baslangic;
  let surum = baslangic ? '1' : '';
  return {
    ad: 'bellek',
    get icerik() { return paket; },
    async oku() { return { paket, surum }; },
    async yaz(yeni, { surum: beklenen } = {}) {
      if ((beklenen || '') !== surum) throw new SenkronHatasi('cakisma', 'Uzak kopya değişti.');
      paket = yeni;
      surum = String(Number(surum || 0) + 1);
      return { surum };
    },
  };
}

/**
 * Google döneminin ayarlarını (kasa anahtarı, istemci kimliği, Drive dosya
 * kimliği…) bu cihazın ayar kaydından bir kez siler. Her açılışta çağrılır;
 * alan yoksa hiçbir şey yazmaz.
 *
 * `kaydet` yerine doğrudan yazılıyor: bunlar cihaza özel alanlar, eşitlemeye
 * de yedeğe de girmiyorlar. `kaydet` damgayı ve değişiklik sayacını artırıp
 * olmayan bir değişikliği hem yedek hatırlatmasına hem eşitlemeye sayardı.
 */
export async function eskiSenkronAyarlariniSil(depo) {
  const ayar = await depo._oku('ayarlar', 'genel');
  if (!ayar || !ESKI_SENKRON_AYARLARI.some((a) => a in ayar)) return false;
  const temiz = { ...ayar };
  for (const a of ESKI_SENKRON_AYARLARI) delete temiz[a];
  await depo._yaz('ayarlar', temiz);
  return true;
}
