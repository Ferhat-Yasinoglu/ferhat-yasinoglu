// Eşitleme: iki cihazın aynı veriyi kullanması.
//
// Akış her seferinde aynı ve tek yönlü değil, gidiş-dönüş:
//   1. Uzaktaki kasayı indir, parolayla aç
//   2. İçindekini YERELE birleştir (iceAktar: kayıt kayıt, yenisi kazanır)
//   3. Birleşmiş halin tamamını derle, şifrele, geri yükle
// Böylece iki cihaz da her eşitlemede birleşimi alıyor; hangisinin önce
// eşitlendiği sonucu değiştirmiyor.
//
// Sunucu yok. Taşıyıcı bir arayüz: `oku()` ve `yaz()`. Google Drive bunun tek
// gerçeklemesi; testler bellekte duran sahte bir taşıyıcı kullanıyor. Eşitleme
// mantığının doğruluğu Google'a bağlı değil, bu ayrım bilerek.
import { belgeDerle, iceAktar, yedekDogrula } from './yedek.js';
import { belgeyiTemizle, belgeParmakIzi, raporToplami } from '../paylasilan/senkron.js';
import { kasayaKoy, kasadanAl, kasaMi, kasaTuzu, KasaHatasi } from '../paylasilan/kasa.js';

export class SenkronHatasi extends Error {
  constructor(kod, mesaj, veri = null) { super(mesaj || kod); this.kod = kod; this.veri = veri; }
}

/** Uzak taraf bizim okumamızdan sonra değiştiyse yazma reddedilir ve
 *  baştan başlarız. Üç deneme: ikisi bile pratikte fazla, tek kullanıcı var. */
const DENEME = 3;

/**
 * Bir eşitleme turu.
 * tasima: { oku(): {paket, surum}, yaz(paket, {surum}): {surum} }
 * Döner: { indirildi, yuklendi, rapor, cakisan, surum }
 */
export async function senkronEt(depo, tasima, { parola } = {}) {
  if (!parola) throw new SenkronHatasi('parola_yok', 'Kasa parolası gerekli.');

  for (let deneme = 1; deneme <= DENEME; deneme++) {
    const { paket, surum } = await tasima.oku();

    let uzakBelge = null;
    if (paket) {
      if (kasaMi(paket)) {
        try { uzakBelge = await kasadanAl(paket, parola); }
        catch (e) {
          if (e instanceof KasaHatasi) throw new SenkronHatasi(e.kod === 'parola' ? 'parola' : 'kasa_bozuk', e.message);
          throw e;
        }
      } else if (paket.bicim) {
        // Şifresiz belge: elle konmuş ya da kasa açılmadan önce yüklenmiş.
        // Reddetmiyoruz — veriyi geri vermemek kabul etmemekten kötü.
        uzakBelge = paket;
      } else {
        throw new SenkronHatasi('kasa_bozuk', 'Buluttaki dosya tanınmadı.');
      }
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

    const yerel = belgeyiTemizle(await belgeDerle(depo));
    const indirildi = raporToplami(rapor);

    // Birleşim uzaktakiyle bire bir aynıysa yüklemeye gerek yok. Parmak izi
    // rev'e bakmıyor: her içe aktarma rev'i artırdığı için aynı içerik iki
    // cihazda farklı rev taşıyor ve buna baksaydık boş yere yazıp dururduk.
    //
    // ŞİFRESİZ kopya bu kısayoldan muaf. Bulutta açık bir belge duruyorsa
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
 *  Google'ın davranışını taklit eder: sürüm tutmayan yazma reddedilir. */
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
