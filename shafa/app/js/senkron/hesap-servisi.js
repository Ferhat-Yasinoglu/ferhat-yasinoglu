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
// Meta ne yedeğe ne sunucuya gider; içe aktarma da onu yazmaz.
//
// AĞ: hesap yokken tek istek atılmaz. Kendiliğinden turların kapısı
// `jeton && kasa` ve bir sunucu adresi.
import { senkronEt } from '../depo/senkron.js';
import { YEDEKLENEN } from '../depo/sema.js';
import { sunucuIstemcisi, sunucuTasima } from './sunucu.js';
import { sunucuAdresi } from './sunucu-adresi.js';
import { parolaAnahtarlari, kurtarmaAnahtarlari, sar, ac, kasaAnahtariUret, HesapHatasi, KURTARMA_UZUNLUGU } from './hesap.js';
import { kullaniciAdiNormal, kullaniciGecerli, parolaNormal, parolaSorunu, kurtarmaNormal } from '../paylasilan/hesap-kurallari.js';
import { raporToplami } from '../paylasilan/senkron.js';
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
});

/** Kalıcı hatalar: kendiliğinden geçmez, kartta ve bantta görünmeli.
 *  Ağ hataları (ag, sunucu_yok, zaman_asimi) bilerek sessiz. */
export const KALICI_HATALAR = ['buyuk', 'kasa_bozuk', 'uzak_bozuk', 'parola', 'oturum', 'sunucu_dolu', 'gzip_yok', 'surum', 'anahtar_bozuk'];

/** Sekmeler arası tek tur: iki sekme aynı anda yükleyip birbirini
 *  çakışmaya düşürmesin. */
const KILIT_ADI = 'shafa-senkron';

const YEREL_SECIMLER = ['ekle', 'temizle'];

/** Hesap düşünce silinen alanlar (sonKullanici ayrı karar). */
const OTURUMSUZ = { jeton: '', kasa: '', bilinenSurum: '', hataKodu: '', hataVeri: null };

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
   * Döner: { soru, sayi, onceki }
   */
  async hesapDegisimi(kullanici) {
    const u = kullaniciAdiNormal(kullanici);
    const h = await this.depo.hesap();
    let sayi = 0;
    for (const ad of YEDEKLENEN) {
      if (ad === 'ayarlar') continue;
      sayi += (await this.depo.listele(ad)).filter((k) => k.ornek !== 1).length;
    }
    const onceki = h.sonKullanici || '';
    return { soru: sayi > 0 && onceki !== u, sayi, onceki };
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

  async _girisiTamamla(u, jeton, kasa, yerel) {
    if (yerel === 'temizle') await this.depo.hepsiniSil();
    // bilinenSurum sıfırlanır (OTURUMSUZ): ilk tur olmazsa bir sonraki ön
    // denetim eski ya da başka bir hesabın sürümüne bakıp turu atlamasın.
    await this.depo.hesapKaydet({ ...OTURUMSUZ, kullanici: u, jeton, kasa });
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
    if (!parolaNormal(davet)) throw new HesapHatasi('davet', 'Davet kodu gerekli.');
    await this._girisliDegil();
    await this._yerelKarari(u, yerel);
    const istemci = this._istemci();
    const K = kasaAnahtariUret();
    const [pa, ka] = await Promise.all([parolaAnahtarlari(u, parola), kurtarmaAnahtarlari(u, kod)]);
    const [sarili, kurtarmaSarili] = await Promise.all([sar(pa.sarma, K, 'parola', u), sar(ka.sarma, K, 'kurtarma', u)]);
    const { jeton } = await istemci.kayit({ kullanici: u, davet: String(davet), giris: pa.giris, kurtarma: ka.kurtarma, sarili, kurtarmaSarili });
    return this._girisiTamamla(u, jeton, K, yerel);
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
    return this._girisiTamamla(u, r.jeton, K, yerel);
  }

  /**
   * Parolayı unutan hekim: kurtarma koduyla K açılır, yeni parola ve YENİ bir
   * kurtarma kodu (yeniKod, arayüz önceden gösterip onaylatır) sunucuya gider.
   * Eski kod bir daha çalışmaz, öbür cihazların oturumları düşer.
   */
  async kurtar({ kullanici, kod, yeniParola, yeniKod, yerel } = {}) {
    const u = this._kullanici(kullanici);
    this._kod(kod);
    this._kod(yeniKod);
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
    const [pa, yka] = await Promise.all([parolaAnahtarlari(u, yeniParola), kurtarmaAnahtarlari(u, yeniKod)]);
    const [sarili, yeniKurtarmaSarili] = await Promise.all([sar(pa.sarma, K, 'parola', u), sar(yka.sarma, K, 'kurtarma', u)]);
    const { jeton } = await istemci.kurtarBitir({
      kullanici: u, kurtarma: ka.kurtarma, giris: pa.giris, sarili, yeniKurtarma: yka.kurtarma, yeniKurtarmaSarili,
    });
    return this._girisiTamamla(u, jeton, K, yerel);
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
    await this.depo.hesapKaydet({ jeton });
    this._yay({ tur: 'durum' });
  }

  /** Yeni kurtarma kodu (kayıttaki gibi önce gösterilir); eskisi geçersizleşir. */
  async kurtarmaYenile({ parola, kod } = {}) {
    const h = await this._girisli();
    this._kod(kod);
    const [pa, yka] = await Promise.all([parolaAnahtarlari(h.kullanici, parola), kurtarmaAnahtarlari(h.kullanici, kod)]);
    const yeniKurtarmaSarili = await sar(yka.sarma, h.kasa, 'kurtarma', h.kullanici);
    await this._jetonlu(() => this._istemci().kurtarmaYenile(h.jeton, { giris: pa.giris, yeniKurtarma: yka.kurtarma, yeniKurtarmaSarili }));
  }

  /**
   * Bu cihazdan çıkış: jeton ve K silinir. Sunucuya haber verilir ama
   * verilemese de (internet yok) çıkış olur — anahtarlar cihazdan gider.
   * `sil`: bu cihazdaki kayıtlar da silinir (sunucudaki kopya durur).
   */
  async cikisYap({ sil = false } = {}) {
    const h = await this.depo.hesap();
    if (h.jeton && this.adres) await this._istemci().cikis(h.jeton).catch(() => {});
    if (sil) await this.depo.hepsiniSil();
    await this.depo.hesapKaydet({ ...OTURUMSUZ, kullanici: '', sonEsitleme: '', ...(sil ? { sonKullanici: '' } : {}) });
    this._zamanlayicilariSil();
    this._yay({ tur: 'durum' });
  }

  /** Hesabı sunucudan siler (parola ister). Cihazdaki kayıtlar kalır. */
  async hesabiSil({ parola } = {}) {
    const h = await this._girisli();
    const pa = await parolaAnahtarlari(h.kullanici, parola);
    await this._jetonlu(() => this._istemci().hesapSil(h.jeton, { giris: pa.giris }));
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

  /** Tam tur: indir, birleştir, gerekiyorsa yükle. Hata kaydedilir ve fırlatılır. */
  async _tur() {
    let jeton = '';
    const calistir = async () => {
      const h = await this.depo.hesap();
      if (!h.jeton || !h.kasa) throw new HesapHatasi('giris_yok', 'Önce hesaba giriş yapılmalı.');
      jeton = h.jeton;
      this.suruyor = true;
      this._yay({ tur: 'durum' });
      try {
        // Sayaç turdan ÖNCE okunur: tur sürerken yapılan değişiklik
        // gönderilmemiş sayılır ve bir sonraki turu tetikler.
        const sayac = (await this.depo.meta()).senkronSayaci || 0;
        const sonuc = await senkronEt(this.depo, sunucuTasima(this.adres, h.jeton, this.ortam), { parola: h.kasa });
        // Tur sürerken çıkış yapıldıysa ya da hesap değiştiyse sonuç yazılmaz.
        if ((await this.depo.hesap()).jeton !== h.jeton) return sonuc;
        await this.depo.hesapKaydet({
          bilinenSurum: sonuc.surum, esitlenenSayac: sayac, sonKullanici: h.kullanici,
          sonEsitleme: simdi(), hataKodu: '', hataVeri: null,
        });
        const inen = raporToplami(sonuc.rapor);
        if (inen.eklendi + inen.guncellendi) this._yay({ tur: 'indi', sonuc });
        return sonuc;
      } finally { this.suruyor = false; }
    };
    try {
      return this.kilitler?.request ? await this.kilitler.request(KILIT_ADI, calistir) : await calistir();
    } catch (e) {
      // Tur sürerken çıkış yapıldıysa hatası da yazılmaz: çıkışla düşen
      // oturumun 401'i hekime "parolayı yeniden yaz" dedirtmesin.
      if (jeton && (await this.depo.hesap()).jeton === jeton) await this._hataKaydet(e);
      throw e;
    } finally {
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
    try {
      const m = await this.depo.meta();
      const bekleyen = (m.senkronSayaci || 0) - (h.esitlenenSayac || 0);
      if (bekleyen <= 0) {
        const surum = await this._jetonlu(() => this._istemci().surum(h.jeton));
        if (surum === (h.bilinenSurum || '')) return { atlandi: 'ayni' };
      }
      return { sonuc: await this._tur() };
    } catch (e) {
      if (e?.kod !== 'oturum') await this._hataKaydet(e);
      this._yay({ tur: 'durum' });
      return { hata: e };
    }
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
