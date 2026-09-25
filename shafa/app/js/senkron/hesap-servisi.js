// Hesap servisi: giriş, kayıt, kurtarma, parola, çıkış ve kendiliğinden
// eşitleme. Kart (hesap-arayuz.js) yalnız bunu çağırır; DOM'a dokunmaz,
// testler sahte fetch, sahte pencere ve sahte saatle çalıştırır.
//
// HESABIN DURUMU cihaza özel: meta deposundaki 'hesap' kaydı (depo.hesap()).
//   kullanici      normalleşmiş kullanıcı adı
//   jeton          sunucunun oturum jetonu
//   kasa           K — kasanın anahtarı; senkronEt'e `parola` olarak gider
//   sonKullanici   bu cihazın en son BAŞARIYLA eşitlendiği hesap
//   bilinenSurum   o eşitlemede sunucudaki kasanın sürümü (ön denetim)
//   esitlenenSayac meta.senkronSayaci'nin o turun başındaki değeri
//   sonEsitleme    zaman damgası
//   hataKodu/hataVeri son turun hatası (arayüz çevirir)
//   girisOzeti     SHA-256(giris): parolanın cihazdaki doğrulayıcısı (bkz. kurtarmaYenile)
// Meta ne yedeğe ne sunucuya gider; içe aktarma da onu yazmaz.
//
// AĞ: hesap yokken tek istek atılmaz. Kendiliğinden turların kapısı
// `jeton && kasa` ve bir sunucu adresi.
import { senkronEt } from '../depo/senkron.js';
import { YEDEKLENEN } from '../depo/sema.js';
import { sunucuIstemcisi, sunucuTasima } from './sunucu.js';
import { sunucuAdresi } from './sunucu-adresi.js';
import { ORNEK_ANTET } from '../depo/ornek.js';
import { parolaAnahtarlari, kurtarmaAnahtarlari, sar, ac, kasaAnahtariUret, girisOzeti, HesapHatasi, KURTARMA_UZUNLUGU } from './hesap.js';
import { kullaniciAdiNormal, kullaniciGecerli, parolaNormal, parolaSorunu, kurtarmaNormal } from '../paylasilan/hesap-kurallari.js';
import { raporToplami } from '../paylasilan/senkron.js';
import { ANTET_ALANLARI } from '../paylasilan/antet.js';
import { simdi } from '../paylasilan/kimlik.js';

/** Kendiliğinden eşitlemenin zamanları (ms). */
export const ZAMAN = Object.freeze({
  /** Açılıştan sonra: ilk sayfa çizilsin, sonra ağ. */
  acilis: 1500,
  /** Son yerel değişiklikten sonra. Her kayıtta değil: her turda kasanın
   *  tamamı gidip geliyor, sunucu da her turun zamanını ve boyunu görüyor. */
  degisiklik: 2 * 60 * 1000,
  /** `online` Android'de ağ değiştikçe art arda düşüyor. */
  cevrimici: 30 * 1000,
  /** Uygulamaya dönülünce, son tur bundan eskiyse. */
  gorunur: 10 * 60 * 1000,
  /** Geçici hatadan sonra yeniden deneme: 30 sn, 1, 2, 4… dk, en çok 10 dk. */
  tekrar: 30 * 1000,
  tekrarTavan: 10 * 60 * 1000,
  /** Yeniden denemeye eklenen rastgele pay: iki cihaz aynı anda çakıştıysa
   *  aynı anda yeniden denemesinler. */
  tekrarSapma: 5 * 1000,
});

/** Kalıcı hatalar: kendiliğinden geçmez, kartta ve bantta görünmeli.
 *  Ağ hataları (ag, sunucu_yok, zaman_asimi) bilerek sessiz. */
export const KALICI_HATALAR = ['buyuk', 'kasa_bozuk', 'uzak_bozuk', 'parola', 'oturum', 'sunucu_dolu', 'gzip_yok', 'surum', 'anahtar_bozuk'];

/** Kendiliğinden geçen hatalar: kendiliğinden tur bunlarla biterse servis
 *  yeniden denemeyi KENDİ kurar. Kurmasaydı iki cihaz aynı anda eşitlediğinde
 *  kaybeden cihazın değişikliği (sunucunun 5 sn'lik yazım temposu: 429,
 *  ya da 409) hekim başka bir şey değiştirene ya da uygulamayı yeniden açana
 *  kadar — açık duran bir masaüstü sekmesinde saatlerce — cihazda kalıyordu.
 *  'ag' yok: onu `online` olayı zaten tetikliyor. */
const TEKRAR_HATALARI = ['sunucu_yok', 'zaman_asimi', 'cok_istek', 'cakisma', 'sunucu_hata', 'sunucu_dolu'];

/** Sekmeler arası tek tur: iki sekme aynı anda yükleyip birbirini
 *  çakışmaya düşürmesin. */
const KILIT_ADI = 'shafa-senkron';

const YEREL_SECIMLER = ['ekle', 'temizle'];

/**
 * Ayar kaydı hekime ait bir şey taşıyor mu: kendi yazdığı antet (örnek
 * antetten farklı bir değer), Clinical ya da imza görseli, reçete doğrulama
 * anahtarı. Tema, kâğıt boyu gibi tercihler kişisel değil, sayılmaz.
 * Doğrulama anahtarı tek başına da yeter: başka bir hesaba giderse o hesabın
 * bütün cihazları bu cihazın bastığı reçeteleri "geçerli" sayar.
 */
export function kisiselAyarMi(ayar) {
  if (!ayar || ayar.silindi) return false;
  if (ayar.dogrulamaAnahtari || ayar.eskiAnahtarlar?.length || ayar.saglikGorseli || ayar.imzaGorseli) return true;
  return ANTET_ALANLARI.some(([a]) => {
    const deger = String(ayar[a] ?? '').trim();
    return deger !== '' && deger !== String(ORNEK_ANTET[a] ?? '').trim();
  });
}

/** Hesap düşünce silinen alanlar (sonKullanici ayrı karar). */
const OTURUMSUZ = { jeton: '', kasa: '', girisOzeti: '', bilinenSurum: '', hataKodu: '', hataVeri: null };

export class HesapServisi {
  /**
   * secenek: { adres, ortam: { fetch, cevrimici }, pencere, belge, kilitler }
   * Verilmeyenler tarayıcınınkiler; pencere/belge yoksa (testler) olay dinlenmez.
   */
  constructor(depo, { adres = sunucuAdresi(), ortam = {}, pencere = globalThis.window, belge = globalThis.document, kilitler = globalThis.navigator?.locks } = {}) {
    this.depo = depo;
    this.adres = adres;
    this.ortam = ortam;
    this.pencere = pencere;
    this.belge = belge;
    this.kilitler = kilitler;
    this.suruyor = false;
    this._tekrar = false;
    this._dinleyiciler = new Set();
    this._zamanlar = new Map();
    this._birak = [];
    /* Çıkış ile süren tur yarışmasın diye (bkz. _kes): her çıkış/silme
       kuşağı bir artırır, tur kendi kuşağı geçtiyse yerele ya da sunucuya
       yazmadan durur. `_surenler` bu sekmede süren turlar, `_kesici` onların
       ağ isteklerini keser. */
    this._nesil = 0;
    this._kesici = new AbortController();
    this._surenler = new Set();
    this._deneme = 0;
  }

  get sunucuVar() { return !!this.adres; }

  _istemci() {
    if (!this.adres) throw new HesapHatasi('sunucu_adresi_yok', 'Hesap sunucusu tanımlı değil.');
    return sunucuIstemcisi(this.adres, this.ortam);
  }

  _cevrimici() {
    return this.ortam.cevrimici ? this.ortam.cevrimici() : globalThis.navigator?.onLine !== false;
  }

  /** Durum değişince (tur başladı/bitti, giriş, çıkış) ve kayıt inince
   *  çağrılır: { tur: 'durum' } | { tur: 'indi', sonuc }. */
  dinle(cb) {
    this._dinleyiciler.add(cb);
    return () => this._dinleyiciler.delete(cb);
  }

  _yay(olay) {
    for (const cb of this._dinleyiciler) { try { cb(olay); } catch (e) { console.error(e); } }
  }

  /** Kartın ihtiyaç duyduğu her şey tek nesnede. */
  async hesapDurumu() {
    const h = await this.depo.hesap();
    const m = await this.depo.meta();
    return {
      sunucuVar: this.sunucuVar,
      girisli: !!(h.jeton && h.kasa),
      kullanici: h.kullanici || '',
      sonKullanici: h.sonKullanici || '',
      sonEsitleme: h.sonEsitleme || '',
      hataKodu: h.hataKodu || '',
      hataVeri: h.hataVeri || null,
      kaliciHata: KALICI_HATALAR.includes(h.hataKodu),
      oturumBitti: h.hataKodu === 'oturum',
      esitleniyor: this.suruyor,
      bekleyen: Math.max(0, (m.senkronSayaci || 0) - (h.esitlenenSayac || 0)),
    };
  }

  /**
   * Hesap değişimi sorusu gerekiyor mu? Bu cihazda örnek olmayan kayıt varsa
   * ve cihaz en son BAŞKA bir hesapla (ya da hiç) eşitlenmişse, o kayıtlar
   * sessizce bu hesaba eklenmemeli: başka bir hekimin hastaları olabilir.
   *
   * Ayarlar da sayılır, ama yalnız kişisel bir şey taşıyorsa (bkz.
   * kisiselAyarMi): yalnız antedini doldurmuş bir cihazda soru sorulmasaydı
   * o hekimin adı, telefonu ve reçete doğrulama anahtarı alan alan başka bir
   * hekimin hesabına, oradan onun bütün cihazlarına ve basılan kâğıtlarına
   * giderdi. Ayarlar tek kayıt: `sayi`ya bir eklenir, `antet` ayrıca söylenir.
   * Döner: { soru, sayi, onceki, antet }
   */
  async hesapDegisimi(kullanici) {
    const u = kullaniciAdiNormal(kullanici);
    const h = await this.depo.hesap();
    let sayi = 0;
    for (const ad of YEDEKLENEN) {
      if (ad === 'ayarlar') continue;
      sayi += (await this.depo.listele(ad)).filter((k) => k.ornek !== 1).length;
    }
    const antet = kisiselAyarMi(await this.depo.ayarlar());
    if (antet) sayi++;
    const onceki = h.sonKullanici || '';
    return { soru: sayi > 0 && onceki !== u, sayi, onceki, antet };
  }

  // --- giriş akışları ------------------------------------------------------

  _kullanici(ham) {
    const u = kullaniciAdiNormal(ham);
    if (!kullaniciGecerli(u)) throw new HesapHatasi('kullanici_gecersiz', 'Kullanıcı adı geçersiz.');
    return u;
  }

  _yeniParola(parola, u) {
    const sorun = parolaSorunu(parola, u);
    if (sorun) throw new HesapHatasi('parola_' + sorun, 'Parola kurala uymuyor: ' + sorun);
  }

  _kod(kod) {
    if (kurtarmaNormal(kod).length !== KURTARMA_UZUNLUGU) throw new HesapHatasi('kurtarma_gecersiz', 'Kurtarma kodu eksik ya da bozuk.');
  }

  async _girisliDegil() {
    const h = await this.depo.hesap();
    if (h.jeton && h.kasa) throw new HesapHatasi('girisli', 'Önce bu cihazdaki hesaptan çık.');
  }

  /* Soru gerekiyorsa karar (yerel: 'ekle' | 'temizle') verilmeden giriş
     yapılmaz. Karar ağ isteğinden ÖNCE denetleniyor, uygulanması ise giriş
     başarılı olduktan SONRA: yanlış parola yüzünden kayıtlar silinmesin. */
  async _yerelKarari(u, yerel) {
    if (yerel !== undefined && !YEREL_SECIMLER.includes(yerel)) throw new TypeError('yerel: ' + yerel);
    const d = await this.hesapDegisimi(u);
    if (d.soru && !yerel) throw new HesapHatasi('hesap_degisimi', 'Bu cihazdaki kayıtlar için karar gerekli.', { sayi: d.sayi, kullanici: u });
  }

  async _girisiTamamla(u, jeton, kasa, giris, yerel) {
    if (yerel === 'temizle') await this.depo.hepsiniSil();
    // bilinenSurum sıfırlanır (OTURUMSUZ): ilk tur olmazsa bir sonraki ön
    // denetim eski ya da başka bir hesabın sürümüne bakıp turu atlamasın.
    await this.depo.hesapKaydet({ ...OTURUMSUZ, kullanici: u, jeton, kasa, girisOzeti: await girisOzeti(giris) });
    this._yay({ tur: 'durum' });
    // İlk tur hemen: hesap açıldı/girildi, eşitlemenin sonucu ayrıca döner.
    // Tur olmazsa giriş geri alınmaz; hata kartta görünür, sonra yeniden denenir.
    try { return { esitleme: await this._tur(), hata: null }; }
    catch (e) { return { esitleme: null, hata: e }; }
  }

  /**
   * Yeni hesap. `kod` kurtarma kodu: arayüz onu kurtarmaKoduUret() ile ÖNCE
   * üretip hekime gösterir ve onay alır, SONRA bu çağrılır — hesap, kodu
   * kimse görmeden var olmasın.
   */
  async kayitOl({ kullanici, parola, davet, kod, yerel } = {}) {
    const u = this._kullanici(kullanici);
    this._yeniParola(parola, u);
    this._kod(kod);
    if (!parolaNormal(davet)) throw new HesapHatasi('davet_bos', 'Davet kodu gerekli.');
    await this._girisliDegil();
    await this._yerelKarari(u, yerel);
    const istemci = this._istemci();
    const K = kasaAnahtariUret();
    const [pa, ka] = await Promise.all([parolaAnahtarlari(u, parola), kurtarmaAnahtarlari(u, kod)]);
    const [sarili, kurtarmaSarili] = await Promise.all([sar(pa.sarma, K, 'parola', u), sar(ka.sarma, K, 'kurtarma', u)]);
    const { jeton } = await istemci.kayit({ kullanici: u, davet: String(davet), giris: pa.giris, kurtarma: ka.kurtarma, sarili, kurtarmaSarili });
    return this._girisiTamamla(u, jeton, K, pa.giris, yerel);
  }

  async girisYap({ kullanici, parola, yerel } = {}) {
    const u = this._kullanici(kullanici);
    if (!parolaNormal(parola)) throw new HesapHatasi('parola_bos', 'Parola yazılmadı.');
    await this._girisliDegil();
    await this._yerelKarari(u, yerel);
    const istemci = this._istemci();
    const pa = await parolaAnahtarlari(u, parola);
    const r = await istemci.giris({ kullanici: u, giris: pa.giris });
    let K;
    try { K = await ac(pa.sarma, r.sarili, 'parola', u); }
    catch (e) {
      // Açılmayan bir anahtarla oturum açık kalmasın.
      await istemci.cikis(r.jeton).catch(() => {});
      throw e;
    }
    return this._girisiTamamla(u, r.jeton, K, pa.giris, yerel);
  }

  /**
   * Parolayı unutan hekim: kurtarma koduyla K açılır, yeni parola ve YENİ bir
   * kurtarma kodu (yeniKod, arayüz önceden gösterip onaylatır) sunucuya gider.
   * Eski kod bir daha çalışmaz, öbür cihazların oturumları düşer.
   *
   * `yeniKod` bir işlev de olabilir (arayüz böyle veriyor): eski kod sunucuda
   * TUTTUKTAN sonra çağrılır, yeni kodu gösterip onaylatır ve döndürür; null
   * dönerse kurtarma 'iptal'le biter, sunucuda hiçbir şey değişmez. Yoksa
   * eski kodu yanlış yazan hekim her denemede yeni bir kodu boşuna kâğıda
   * yazardı.
   */
  async kurtar({ kullanici, kod, yeniParola, yeniKod, yerel } = {}) {
    const u = this._kullanici(kullanici);
    this._kod(kod);
    const kodSor = typeof yeniKod === 'function' ? yeniKod : null;
    if (!kodSor) this._kod(yeniKod);
    this._yeniParola(yeniParola, u);
    await this._girisliDegil();
    await this._yerelKarari(u, yerel);
    const istemci = this._istemci();
    const ka = await kurtarmaAnahtarlari(u, kod);
    let kurtarmaSarili;
    try { ({ kurtarmaSarili } = await istemci.kurtarAc({ kullanici: u, kurtarma: ka.kurtarma })); }
    catch (e) {
      // Sunucu 'yanlis' diyor; hekime "parola yanlış" değil "kod yanlış" denmeli.
      if (e?.kod === 'yanlis') throw new HesapHatasi('kurtarma_yanlis', 'Kullanıcı adı ya da kurtarma kodu yanlış.');
      throw e;
    }
    const K = await ac(ka.sarma, kurtarmaSarili, 'kurtarma', u);
    const yeni = kodSor ? await kodSor() : yeniKod;
    if (!yeni) throw new HesapHatasi('iptal', 'Kurtarma yarıda bırakıldı.');
    this._kod(yeni);
    const [pa, yka] = await Promise.all([parolaAnahtarlari(u, yeniParola), kurtarmaAnahtarlari(u, yeni)]);
    const [sarili, yeniKurtarmaSarili] = await Promise.all([sar(pa.sarma, K, 'parola', u), sar(yka.sarma, K, 'kurtarma', u)]);
    const { jeton } = await istemci.kurtarBitir({
      kullanici: u, kurtarma: ka.kurtarma, giris: pa.giris, sarili, yeniKurtarma: yka.kurtarma, yeniKurtarmaSarili,
    });
    return this._girisiTamamla(u, jeton, K, pa.giris, yerel);
  }

  // --- oturum açıkken ------------------------------------------------------

  async _girisli() {
    const h = await this.depo.hesap();
    if (!h.jeton || !h.kasa) throw new HesapHatasi('giris_yok', 'Önce hesaba giriş yapılmalı.');
    return h;
  }

  /* Oturum düştüyse (parola başka yerde değişti, hesap kurtarıldı, süre
     doldu) jeton ve K silinir: kendiliğinden eşitleme parola yeniden
     girilene kadar durur. Kullanıcı adı kalır, kart onu hazır doldurur. */
  async _jetonlu(is) {
    try { return await is(); }
    catch (e) {
      if (e?.kod === 'oturum') { await this._hataKaydet(e); this._yay({ tur: 'durum' }); }
      throw e;
    }
  }

  async parolaDegistir({ eskiParola, yeniParola } = {}) {
    const h = await this._girisli();
    this._yeniParola(yeniParola, h.kullanici);
    const [eski, yeni] = await Promise.all([parolaAnahtarlari(h.kullanici, eskiParola), parolaAnahtarlari(h.kullanici, yeniParola)]);
    const yeniSarili = await sar(yeni.sarma, h.kasa, 'parola', h.kullanici);
    const { jeton } = await this._jetonlu(() => this._istemci().parola(h.jeton, { giris: eski.giris, yeniGiris: yeni.giris, yeniSarili }));
    await this.depo.hesapKaydet({ jeton, girisOzeti: await girisOzeti(yeni.giris) });
    this._yay({ tur: 'durum' });
  }

  /**
   * Yeni kurtarma kodu; eskisi geçersizleşir. Kod, kayıttaki gibi sunucuya
   * gitmeden ÖNCE gösterilip onaylatılır. `kod` bir işlev de olabilir
   * (arayüz böyle veriyor, kurtar()'daki yeniKod gibi): ancak parola bu
   * cihazdaki doğrulayıcıyla (girisOzeti) TUTTUKTAN sonra çağrılır, null
   * dönerse 'iptal'. Yoksa parolayı yanlış yazan hekim hiç geçerli olmayacak
   * bir kodu "güvenli yere yazdım" diye onaylar, eski kâğıdı atardı.
   * Doğrulayıcı yalnız cihazda: sunucuya ek bir istek (ve parolaya ek bir
   * deneme hakkı) gerekmiyor. Yoksa (eski bir oturum) karar sunucuya kalır.
   */
  async kurtarmaYenile({ parola, kod } = {}) {
    const h = await this._girisli();
    const kodSor = typeof kod === 'function' ? kod : null;
    if (!kodSor) this._kod(kod);
    const pa = await parolaAnahtarlari(h.kullanici, parola);
    if (h.girisOzeti && h.girisOzeti !== await girisOzeti(pa.giris)) throw new HesapHatasi('yanlis', 'Parola yanlış.');
    const yeni = kodSor ? await kodSor() : kod;
    if (!yeni) throw new HesapHatasi('iptal', 'Kod yenileme yarıda bırakıldı.');
    this._kod(yeni);
    const yka = await kurtarmaAnahtarlari(h.kullanici, yeni);
    const yeniKurtarmaSarili = await sar(yka.sarma, h.kasa, 'kurtarma', h.kullanici);
    await this._jetonlu(() => this._istemci().kurtarmaYenile(h.jeton, { giris: pa.giris, yeniKurtarma: yka.kurtarma, yeniKurtarmaSarili }));
  }

  /* Süren turları durdurur: kuşak artar (tur yerele ya da sunucuya yazmadan
     önce bakıyor), ağ istekleri kesilir. */
  _kes() {
    this._nesil++;
    this._kesici.abort();
    this._kesici = new AbortController();
    this._deneme = 0;
  }

  /** Sekmeler arası tek iş (eşitleme turuyla aynı kilit). */
  _kilitli(is) {
    return this.kilitler?.request ? this.kilitler.request(KILIT_ADI, is) : is();
  }

  /**
   * Bu cihazdan çıkış: jeton ve K silinir. Sunucuya haber verilir ama
   * verilemese de (internet yok) çıkış olur — anahtarlar cihazdan gider.
   * `sil`: bu cihazdaki kayıtlar da silinir (sunucudaki kopya durur).
   *
   * SIRA ÖNEMLİ: süren bir tur (indirmesi yavaş bir mobil hatta sürüyor)
   * silmeden sonra biterse hesabın bütün hastalarını az önce silinen cihaza
   * geri yazıyordu — ortak bir klinik bilgisayarında hekimin "bu cihazdakileri
   * de sil" isteği sessizce boşa çıkıyordu. Önce tur durdurulur (_kes) ve
   * anahtarlar silinir (öbür sekmelerin turu da jetonun gittiğini görüp
   * durur); bu sekmedeki turun bitmesi beklenir; silme de sekmeler arası
   * eşitleme kilidinin içinde yapılır.
   */
  async cikisYap({ sil = false } = {}) {
    this._kes();
    const h = await this.depo.hesap();
    await this.depo.hesapKaydet({ ...OTURUMSUZ, kullanici: '', sonEsitleme: '', ...(sil ? { sonKullanici: '' } : {}) });
    await Promise.allSettled([...this._surenler]);
    if (sil) await this._kilitli(() => this.depo.hepsiniSil());
    if (h.jeton && this.adres) await this._istemci().cikis(h.jeton).catch(() => {});
    this._zamanlayicilariSil();
    this._yay({ tur: 'durum' });
  }

  /** Hesabı sunucudan siler (parola ister). Cihazdaki kayıtlar kalır. */
  async hesabiSil({ parola } = {}) {
    const h = await this._girisli();
    const pa = await parolaAnahtarlari(h.kullanici, parola);
    await this._jetonlu(() => this._istemci().hesapSil(h.jeton, { giris: pa.giris }));
    this._kes();
    // Hesap yok artık: bu cihaz kimseyle eşitlenmemiş sayılır, bir sonraki
    // girişte kayıtları için yeniden sorulur.
    await this.depo.hesapKaydet({ ...OTURUMSUZ, kullanici: '', sonEsitleme: '', sonKullanici: '' });
    this._zamanlayicilariSil();
    this._yay({ tur: 'durum' });
  }

  /** «Şimdi eşitle»: ön denetimsiz tam tur; hata fırlatır. */
  async simdiEsitle() {
    await this._girisli();
    return this._tur();
  }

  // --- eşitleme turu -------------------------------------------------------

  async _hataKaydet(e) {
    const kod = typeof e?.kod === 'string' && e.kod ? e.kod : 'senkron_olmadi';
    if (kod === 'oturum') await this.depo.hesapKaydet({ ...OTURUMSUZ, hataKodu: 'oturum' });
    else await this.depo.hesapKaydet({ hataKodu: kod, hataVeri: e?.veri || null });
  }

  /** Tam tur: indir, birleştir, gerekiyorsa yükle. Hata kaydedilir ve fırlatılır;
   *  geçici bir hatadan sonra yeniden deneme kurulur (_tekrarPlanla). */
  async _tur() {
    const nesil = this._nesil;
    const kesici = this._kesici;
    let jeton = '';
    const calistir = async () => {
      // Kilit beklenirken çıkış yapılmış olabilir.
      if (nesil !== this._nesil) throw new HesapHatasi('iptal', 'Çıkış yapıldı.');
      const h = await this.depo.hesap();
      if (!h.jeton || !h.kasa) throw new HesapHatasi('giris_yok', 'Önce hesaba giriş yapılmalı.');
      jeton = h.jeton;
      this.suruyor = true;
      this._yay({ tur: 'durum' });
      // Tur hâlâ bu oturumun mu? Bu sekmede çıkış (kuşak) ya da başka bir
      // sekmede çıkış/hesap değişimi (jeton) turu keser.
      const devam = async () => nesil === this._nesil && (await this.depo.hesap()).jeton === h.jeton;
      try {
        // Sayaç turdan ÖNCE okunur: tur sürerken yapılan değişiklik
        // gönderilmemiş sayılır ve bir sonraki turu tetikler.
        const sayac = (await this.depo.meta()).senkronSayaci || 0;
        const tasima = sunucuTasima(this.adres, h.jeton, { ...this.ortam, sinyal: kesici.signal });
        const sonuc = await senkronEt(this.depo, tasima, { parola: h.kasa, devam });
        // Tur sürerken çıkış yapıldıysa ya da hesap değiştiyse sonuç yazılmaz.
        if (!(await devam())) return sonuc;
        await this.depo.hesapKaydet({
          bilinenSurum: sonuc.surum, esitlenenSayac: sayac, sonKullanici: h.kullanici,
          sonEsitleme: simdi(), hataKodu: '', hataVeri: null,
        });
        this._deneme = 0;
        const inen = raporToplami(sonuc.rapor);
        if (inen.eklendi + inen.guncellendi) this._yay({ tur: 'indi', sonuc });
        return sonuc;
      } finally { this.suruyor = false; }
    };
    const is = this._kilitli(calistir);
    this._surenler.add(is);
    try {
      return await is;
    } catch (e) {
      // Tur sürerken çıkış yapıldıysa hatası da yazılmaz: çıkışla düşen
      // oturumun 401'i hekime "parolayı yeniden yaz" dedirtmesin. Kuşak
      // eşzamanlı bakılır: çıkışın hesap kaydını temizlemesi henüz bitmemiş
      // olabilir, geç yazılan bir hata temizlenmiş kaydın üstüne düşmesin.
      if (jeton && nesil === this._nesil && e?.kod !== 'iptal' && (await this.depo.hesap()).jeton === jeton) {
        await this._hataKaydet(e);
        this._tekrarPlanla(e);
      }
      throw e;
    } finally {
      this._surenler.delete(is);
      this._yay({ tur: 'durum' });
      if (this._tekrar) { this._tekrar = false; this._planla('tekrar', 0); }
    }
  }

  /**
   * Kendiliğinden tur. Kapı: sunucu adresi, jeton + K, çevrimiçi. Önce ucuz
   * ön denetim (veri/surum): sunucudaki sürüm bilinenle aynı ve gönderilmemiş
   * yerel değişiklik yoksa tur hiç başlamaz. Hata fırlatmaz, kaydeder.
   * Döner: { atlandi: 'kapi' | 'suruyor' | 'ayni' } | { sonuc } | { hata }
   */
  async otomatikTur() {
    const h = await this.depo.hesap();
    if (!this.adres || !h.jeton || !h.kasa || !this._cevrimici()) return { atlandi: 'kapi' };
    if (this.suruyor) { this._tekrar = true; return { atlandi: 'suruyor' }; }
    const m = await this.depo.meta();
    const bekleyen = (m.senkronSayaci || 0) - (h.esitlenenSayac || 0);
    if (bekleyen <= 0) {
      try {
        const surum = await this._jetonlu(() => this._istemci().surum(h.jeton));
        if (surum === (h.bilinenSurum || '')) { this._deneme = 0; return { atlandi: 'ayni' }; }
      } catch (e) {
        if (e?.kod !== 'oturum') { await this._hataKaydet(e); this._tekrarPlanla(e); }
        this._yay({ tur: 'durum' });
        return { hata: e };
      }
    }
    // Turun hatası orada kaydedildi ve yeniden denemesi kuruldu.
    try { return { sonuc: await this._tur() }; }
    catch (e) { return { hata: e }; }
  }

  // --- zamanlayıcı ---------------------------------------------------------

  _planla(neden, ms) {
    clearTimeout(this._zamanlar.get(neden));
    this._zamanlar.set(neden, setTimeout(() => { this._zamanlar.delete(neden); this.otomatikTur(); }, ms));
  }

  _zamanlayicilariSil() {
    for (const z of this._zamanlar.values()) clearTimeout(z);
    this._zamanlar.clear();
  }

  /* Geçici hatadan sonra yeniden deneme. Sunucu ne kadar bekleneceğini
     söylediyse (429 `bekle`: yazım temposu) o kadar, yoksa artan aralıkla.
     Yalnız kendiliğinden eşitleme kuruluyken (baslat): testler ve kurulmamış
     bir servis arkada zamanlayıcı bırakmasın. */
  _tekrarPlanla(e) {
    if (!this._birak.length || !TEKRAR_HATALARI.includes(e?.kod)) return;
    const bekle = Number(e.veri?.bekle) * 1000;
    const ms = bekle > 0 ? bekle : Math.min(ZAMAN.tekrarTavan, ZAMAN.tekrar * 2 ** this._deneme);
    this._deneme++;
    const sapma = globalThis.crypto.getRandomValues(new Uint16Array(1))[0] % ZAMAN.tekrarSapma;
    this._planla('yeniden', ms + sapma);
  }

  async _gorununce() {
    const h = await this.depo.hesap();
    const gecen = Date.now() - (Date.parse(h.sonEsitleme || '') || 0);
    if (gecen >= ZAMAN.gorunur) this.otomatikTur();
  }

  /**
   * Kendiliğinden eşitlemeyi kurar: açılışta (1,5 sn sonra), son yerel
   * değişiklikten 2 dk sonra, internet gelince (30 sn sonra) ve uygulamaya
   * dönülünce (son tur 10 dk'dan eskiyse). Her tetik kapıdan geçer; hesap
   * yoksa ağa çıkılmaz.
   */
  baslat() {
    if (this._birak.length) return;
    this._birak.push(this.depo.dinle('meta', (o) => { if (o?.tur === 'degisiklik') this._planla('degisiklik', ZAMAN.degisiklik); }));
    const cevrimici = () => this._planla('cevrimici', ZAMAN.cevrimici);
    const gorunurluk = () => { if (this.belge.visibilityState === 'visible') this._gorununce(); };
    if (this.pencere?.addEventListener) {
      this.pencere.addEventListener('online', cevrimici);
      this._birak.push(() => this.pencere.removeEventListener('online', cevrimici));
    }
    if (this.belge?.addEventListener) {
      this.belge.addEventListener('visibilitychange', gorunurluk);
      this._birak.push(() => this.belge.removeEventListener('visibilitychange', gorunurluk));
    }
    this._planla('acilis', ZAMAN.acilis);
  }

  durdur() {
    for (const b of this._birak.splice(0)) b();
    this._zamanlayicilariSil();
  }
}
