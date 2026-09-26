// Ayarlar'daki «حساب» kartı, kurtarma kodu kutusu, hesap değişimi sorusu ve
// kalıcı hata bandı. Akışların kendisi senkron/hesap-servisi.js'te (DOM'suz,
// testli); burası yalnız kutu, düğme, metin ve sıra.
//
// Kartın hâlleri (TASARIM §1):
//   kapali   sunucu adresi yok: dürüst bir cümle, kutu yok
//   cikisli  giriş / hesap açma / kurtarma formları
//   oturum   oturum düştü (parola başka yerde değişti, hesap kurtarıldı):
//            kullanıcı adı hazır, yalnız parola sorulur
//   girisli  son eşitleme, «şimdi eşitle», çıkış, «پیشرفته»
// Kart servisin olaylarını dinler ve kendini tazeler. Formlar yalnız hâl
// değişince yeniden kurulur: kendiliğinden bir eşitleme turu biterken hekimin
// yarısını yazdığı parola silinmesin.
import { el, ekle, temizle, btnS, girdi, alan, kart, rozet } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { tarihMetni, tarihSaatMetni, bugun } from './paylasilan/tarih.js';
import { raporToplami } from './paylasilan/senkron.js';
import { kullaniciAdiNormal, kullaniciGecerli, parolaNormal, parolaSorunu, kurtarmaNormal } from './paylasilan/hesap-kurallari.js';
import { kurtarmaKoduUret, KURTARMA_UZUNLUGU } from './senkron/hesap.js';
import { yedekOlustur, indir } from './depo/yedek.js';
import { hataMetni } from './hatalar.js';
import { t } from './i18n.js';

/** Kendiliğinden geçen hatalar kartta da sessiz: internet yok, sunucu o an
 *  yok, iki cihazın yazım temposu (5 sn) ya da üç kez üst üste çakışma.
 *  Bir sonraki tetik yeniden dener; hekimin yapacağı bir şey yok. */
const GECICI_HATALAR = ['ag', 'sunucu_yok', 'zaman_asimi', 'cok_istek', 'cakisma'];

/** Formlarda ağa ulaşılamadı demek olan kodlar (bkz. form → goster). */
const AG_HATALARI = ['ag', 'sunucu_yok', 'zaman_asimi'];

/* Uygulama içi tarayıcılar (Facebook, Instagram, WhatsApp, Android WebView):
   depoları ayrı ve geçici, indirme ve pano da çoğu zaman sessizce çalışmıyor.
   Hekim hesabı orada açarsa kurtarma kodunu kaydedemeyebilir, kayıtlar da
   Chrome'daki uygulamada görünmez. */
const UYGULAMA_ICI = /FBAN|FBAV|FB_IAB|Instagram|Line\/|; wv\)|WhatsApp|Snapchat|musical_ly|TikTok/i;

export const uygulamaIciMi = (ua = globalThis.navigator?.userAgent || '') => UYGULAMA_ICI.test(ua);

/** Latin kullanıcı adı Farsça cümlenin içinde kendi yönünde kalsın (FSI…PDI):
 *  «dr.ahmad» sağdan sola satırda «ahmad.dr»ye dönmesin. */
const yalit = (s) => `⁨${s}⁩`;

/** İnen kayıtları tek cümleye indirir (açılıştaki sessiz turun bildirimi). */
export function senkronOzeti(sonuc) {
  const { eklendi, guncellendi } = raporToplami(sonuc?.rapor);
  return t('hesap.indi', '{n} kayıt öbür cihazlardan geldi.', { n: eklendi + guncellendi });
}

/**
 * Kurtarma kodunun kâğıda/dosyaya giden metni: kullanıcı adı, kod, uygulamanın
 * adresi ve tarih. Kullanıcı adı bilerek içinde — idFromName tek yönlü, adını
 * unutan hekimin hesabını uygulamanın sahibi de bulamaz. Dari + İngilizce:
 * dosya yıllar sonra başka birinin (bir yardımcının) eline geçebilir.
 */
export function kurtarmaMetni({ kullanici, kod, adres, tarih }) {
  return [
    `${t('hesap.kod_baslik', 'Hesap kurtarma kodu')} — Shafa account recovery code`,
    '',
    `${t('hesap.kullanici', 'Kullanıcı adı')} / Username: ${kullanici}`,
    `${t('hesap.kurtarma_kodu', 'Kurtarma kodu')} / Recovery code: ${kod}`,
    `${t('hesap.adres', 'Uygulamanın adresi')} / App address: ${adres}`,
    `${t('genel.tarih', 'Tarih')} / Date: ${tarihMetni(tarih)} (${tarih})`,
    '',
    t('hesap.kod_dosya_not', 'Bu kodu güvenli bir yerde tut ve kimseye verme. Kullanıcı adı ve bu kodla hesap açılıp yeni parola konabilir. Kod başka hiçbir yerde saklanmıyor; kullanılınca yenisi verilir.'),
    'Keep this code safe and private. With the username and this code the account can be opened and a new password set. The code is not stored anywhere else; once used, a new one is given.',
  ].join('\n');
}

function metniIndir(metin, dosyaAdi) {
  // BOM: eski Windows Not Defteri UTF-8'i ancak onunla tanıyor, yoksa Dari
  // satırlar bozuk harf olarak açılıyor.
  const u = URL.createObjectURL(new Blob(['﻿' + metin], { type: 'text/plain;charset=utf-8' }));
  const a = el('a', { href: u, download: dosyaAdi });
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}

/**
 * Kurtarma kodu kutusu. Hesap açılmadan (ya da kod değişmeden) ÖNCE açılır:
 * kutu açıkken uygulama kapanırsa (iOS arkadaki PWA'yı öldürür) ortada kodunu
 * kimsenin görmediği bir hesap kalmasın. Onay kutusu işaretlenmeden devam
 * edilmez. Döner: true (devam) | false (vazgeçildi).
 */
export async function kurtarmaKoduGoster(ctx, { kullanici, kod }) {
  const adres = location.origin + location.pathname;
  const tarih = bugun();
  const metin = kurtarmaMetni({ kullanici, kod, adres, tarih });
  const onay = el('input', {
    type: 'checkbox', name: 'kodOnay',
    onchange: () => { onay.closest('.modal')?.querySelector('.modal__ayak .btn--birincil')?.toggleAttribute('disabled', !onay.checked); },
  });
  // Gruplar ayrı kutucuk: dar telefonda satır ancak tirede kırılsın, bir
  // grubun ortasında değil.
  const gruplar = kod.split('-');
  const kodKutusu = el('code', { class: 'kod kod--buyuk', dir: 'ltr' },
    ...gruplar.flatMap((g, i) => [i ? '-' : null, el('span', {}, g)]));
  const bilgi = (etiket, deger) => el('div', {}, `${etiket}: `, el('bdi', { dir: 'ltr' }, deger));
  const paylasilir = typeof navigator.share === 'function';
  const r = await ctx.modal({
    baslik: t('hesap.kod_baslik', 'Hesap kurtarma kodu'),
    sinif: 'modal--kod',
    govde: el('div', { class: 'kod-kutu' },
      el('p', {}, t('hesap.kod_alt', 'Parolayı unutursan hesabı yalnız bu kodla açabilirsin. Başka kimsede yok ve bir daha gösterilmeyecek.')),
      kodKutusu,
      el('div', { class: 'kod-kutu__bilgi' },
        bilgi(t('hesap.kullanici', 'Kullanıcı adı'), kullanici),
        bilgi(t('hesap.adres', 'Uygulamanın adresi'), adres),
        el('div', {}, `${t('genel.tarih', 'Tarih')}: `, el('bdi', { dir: 'ltr' }, tarihMetni(tarih)))),
      el('div', { class: 'satir' },
        paylasilir
          ? btnS('git', t('hesap.paylas', 'Paylaş'), { class: 'btn btn--kucuk', onclick: async () => {
            try { await navigator.share({ title: t('hesap.kod_baslik', 'Hesap kurtarma kodu'), text: metin }); }
            catch { /* hekim paylaşımı kapattı ya da tarayıcı reddetti: kopyala/indir duruyor */ }
          } })
          : null,
        btnS('kaydet', t('hesap.kopyala', 'Kopyala'), { class: 'btn btn--kucuk', onclick: async () => {
          try { await navigator.clipboard.writeText(metin); ctx.basari(t('hesap.kopyalandi', 'Kopyalandı')); }
          catch { ctx.uyar(t('hesap.kopya_olmadi', 'Kopyalanamadı; kodu elle yaz.')); }
        } }),
        btnS('indir', t('hesap.indir', 'Dosya indir'), { class: 'btn btn--kucuk', onclick: () => metniIndir(metin, `shafa-kurtarma-${kullanici}.txt`) })),
      el('div', { class: 'uyari' }, simge('uyari', { boy: 16 }),
        el('span', {}, t('hesap.kod_ipucu', 'Kâğıda yaz ya da bu ekranın fotoğrafını çek ve güvenli bir yerde sakla; yalnız bu telefonda tutma.'))),
      el('label', { class: 'onay kod-kutu__onay' }, onay, el('span', {}, t('hesap.kod_onay', 'Bu kodu güvenli bir yere yazdım')))),
    dugmeler: [
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: t('hesap.devam', 'Devam'), sinif: 'btn--birincil', pasif: true, cb: () => onay.checked || false },
    ],
  });
  return r === true;
}

/**
 * Bu cihazda başka (ya da hiçbir) hesapla eşitlenmemiş kayıt var: sessizce
 * bu hesaba eklenmesin, başka bir hekimin hastaları olabilir. «Ekle» öne
 * çıkarılmıyor (birincil değil): odak kapat düğmesinde, Enter vazgeçer.
 * Döner: 'ekle' | 'temizle' | null
 */
async function degisimSor(ctx, { sayi, kullanici, antet }) {
  const secim = await ctx.modal({
    baslik: t('hesap.degisim_baslik', 'Bu cihazdaki kayıtlar'),
    govde: el('div', {},
      el('p', {}, t('hesap.degisim_soru', 'Bu cihazda {n} kayıt var. {u} hesabına eklensin mi?', { n: sayi, u: yalit(kullanici) })),
      // Antet kayıt sayısında tek satır; neyin gideceği ayrıca söylenmeli.
      antet ? el('p', {}, t('hesap.degisim_antet', 'Bu cihazdaki antet (doktor adı, telefon…) ve reçete doğrulama anahtarı da bunlara dahil.')) : null,
      el('div', { class: 'uyari' }, simge('uyari', { boy: 16 }),
        el('span', {}, t('hesap.degisim_alt', 'Bu kayıtlar başka bir hekiminse bu hesaba ekleme: o hesabın bütün cihazlarına gider.')))),
    dugmeler: [
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: t('hesap.temizle', 'Önce bu cihazı temizle'), deger: 'temizle' },
      { metin: t('hesap.ekle', 'Ekle'), deger: 'ekle' },
    ],
  });
  if (secim !== 'temizle') return secim === 'ekle' ? 'ekle' : null;
  // Silmeden önce yedek önerilir; silme ancak giriş başarılı olunca yapılır.
  const onay = await ctx.modal({
    baslik: t('hesap.temizle', 'Önce bu cihazı temizle'),
    govde: el('div', {},
      el('p', {}, t('hesap.temizle_alt', 'Girişten sonra bu cihazdaki {n} kayıt silinir ve yalnız hesabınkiler gelir. Önce yedek al.', { n: sayi })),
      btnS('indir', t('yedek.indir', 'Yedek indir'), { class: 'btn', onclick: async () => {
        indir(await yedekOlustur(ctx.depo));
        ctx.basari(t('yedek.indirildi', 'Yedek indirildi'));
      } })),
    dugmeler: [
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: t('hesap.temizle_evet', 'Temizle ve devam et'), sinif: 'btn--tehlike', deger: true },
    ],
  });
  return onay === true ? 'temizle' : null;
}

/** Kalıcı hata bandı (zil kutusu / telefonda sayfanın tepesi). Ağ hataları yok. */
export function hesapBandi(durum, git) {
  if (!durum?.kaliciHata) return null;
  return el('div', { class: 'bant bant--hata', dataset: { bant: 'hesap' } }, simge('uyari', { boy: 18 }),
    el('span', {}, hataMetni({ kod: durum.hataKodu, veri: durum.hataVeri })),
    el('button', { type: 'button', class: 'btn btn--kucuk', onclick: () => git('/ayarlar?hesap=1') }, t('hesap.baslik', 'Hesap')));
}

/* Hâl değişince hatırlanan seçimler: kart yeniden kurulunca hekim açtığı
   sekmeye ve «پیشرفته»ye geri dönsün. */
let kip = 'giris';
let gelismisAcik = false;

/** Kartın hangi formu göstereceği; ilk açılıştaki «حساب دارید؟» bağlantısı girişi ister. */
export function hesapKipi(yeni) { kip = yeni; }

/** Yerel denetim: kutu ya da ağdan önce, hekim hatasını hemen görsün. */
function denetle({ u, parola, tekrar, davet, kod }, tur) {
  if (!kullaniciGecerli(u)) return 'kullanici_gecersiz';
  if (tur === 'kurtar' && kurtarmaNormal(kod).length !== KURTARMA_UZUNLUGU) return 'kurtarma_gecersiz';
  if (tur === 'giris') return parolaNormal(parola) ? null : 'parola_bos';
  const sorun = parolaSorunu(parola, u);
  if (sorun) return 'parola_' + sorun;
  if (parola !== tekrar) return 'parola_farkli';
  if (tur === 'kayit' && !parolaNormal(davet)) return 'davet_bos';
  return null;
}

const kullaniciKutusu = () => girdi({
  name: 'kullanici', autocomplete: 'username', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false',
  dir: 'ltr', inputmode: 'email', maxlength: '40', required: true,
  // Farsça/Arapça rakam ve büyük harf yazılırken düzelir: kural hekime
  // "geçersiz" demeden önce kutuda görünsün.
  oninput: (e) => {
    const n = kullaniciAdiNormal(e.target.value);
    if (n !== e.target.value) e.target.value = n;
  },
});
const parolaKutusu = (name, autocomplete) => girdi({ type: 'password', name, autocomplete, dir: 'auto', required: true });

/**
 * Kart. `durum` HesapServisi.hesapDurumu() (Ayarlar zaten okudu, kart ilk
 * çizimde boş durmasın). `yenileSayfa` bu cihazdaki kayıtlar silinince
 * (temizle, çıkışta sil) Ayarlar'ın sayılarını tazeler.
 * Döner: { kart, birak } — birak servis dinleyicisini bırakır.
 */
export function hesapKarti(ctx, durum, { yenileSayfa = () => {} } = {}) {
  const { hesap, basari, hata } = ctx;
  const baslik = el('h2', { tabindex: '-1' }, t('hesap.baslik', 'Hesap'));
  const bas = el('div', { class: 'kart__bas' }, baslik);
  const ozet = el('div', { class: 'hesap-ozet' });
  const govde = el('div', { class: 'hesap-govde' });
  const kok = kart({ id: 'hesap-karti' }, bas, ozet, govde);
  let gorunum = '';
  let sira = 0;
  let son = durum;

  /* Meşgul: anahtar türetme (600 bin tur PBKDF2) telefonda saniyeler sürüyor.
     Kartın bütün düğme ve kutuları kilitlenir — ikinci bir basış ikinci bir
     istek olmasın — ve «لطفاً صبر کنید…» yazar. */
  async function mesgul(durumYeri, is, metin = t('hesap.bekle', 'Lütfen bekle…')) {
    const kilitlenen = [...kok.querySelectorAll('button, input')].filter((x) => !x.disabled);
    for (const x of kilitlenen) x.disabled = true;
    kok.setAttribute('aria-busy', 'true');
    durumYeri.textContent = metin;
    try { return await is(); }
    finally {
      for (const x of kilitlenen) x.disabled = false;
      kok.removeAttribute('aria-busy');
      durumYeri.textContent = '';
    }
  }

  /** Form: alanlar, hata kutusu, gönder düğmesi, durum satırı. `gonder`
   *  hata fırlatırsa kutuda gösterilir ('iptal' sessiz). */
  function form(ad, alanlar, { metin, simgesi = 'onay', sinif = 'btn--birincil', ek = [], yanlis }, gonder) {
    const hataKutusu = el('div', { class: 'hesap-hata', role: 'alert' });
    const durumYeri = el('p', { class: 'hesap-durum', role: 'status' });
    const f = el('form', { class: 'hesap-form', dataset: { form: ad }, novalidate: true },
      ...alanlar, hataKutusu,
      el('div', { class: 'satir' },
        el('button', { type: 'submit', class: `btn ${sinif}` }, simge(simgesi, { boy: 18 }), metin), ...ek),
      durumYeri);
    const goster = (e) => {
      temizle(hataKutusu);
      if (!e || e.kod === 'iptal') return;
      // Giriş yapmışken sunucunun 'yanlis'ı yalnız parola demek: kullanıcı adı zaten doğru.
      // Ağ hatasında hataMetni eşitlemeyi anlatıyor ("internet gelince eşitlenir");
      // bir form ise kendiliğinden yeniden gönderilmez, hesap sonra açılmaz.
      const m = e.kod === 'yanlis' && yanlis ? yanlis
        : AG_HATALARI.includes(e.kod) ? t('hesap.ag_form', 'İnternet ya da sunucu yok. Bağlanınca yeniden dene.')
          : hataMetni(e, t('genel.islem_olmadi', 'İşlem yapılamadı'));
      hataKutusu.appendChild(el('div', { class: 'uyari uyari--hata' }, simge('hata', { boy: 16 }),
        el('span', {}, m, e.kodKaydedilmedi ? el('br') : null, e.kodKaydedilmedi ? t('hesap.kod_kaydedilmedi', 'Yeni kod kaydedilmedi; eski kurtarma kodu hâlâ geçerli.') : null)));
    };
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (kok.getAttribute('aria-busy')) return;
      goster(null);
      const v = {};
      for (const g of f.querySelectorAll('input[name]')) v[g.name] = g.value;
      try { await gonder(v, (is, m) => mesgul(durumYeri, is, m), f); }
      catch (hataNesnesi) {
        // Kodlu hata hekimin hatası ya da sunucunun cevabı; kodsuz olan bir kusur.
        if (!hataNesnesi?.kod) console.error(hataNesnesi);
        goster(hataNesnesi);
      }
    });
    return f;
  }

  /** Giriş ya da hesap açılışının ortak sonu. */
  function girisSonucu(r, mesaj, yerel) {
    // Bir sonraki çıkışta kart giriş formuyla açılsın, kurtarmayla değil.
    kip = 'giris';
    basari(mesaj);
    if (r.hata && !GECICI_HATALAR.includes(r.hata.kod)) hata(hataMetni(r.hata, t('hata.senkron_olmadi', 'Eşitleme olmadı.')));
    if (yerel === 'temizle') { ctx.yenileMenu?.(); yenileSayfa(); }
  }

  /** Hesap değişimi sorusu gerekiyorsa sorar. undefined: soru yok; null: vazgeçildi. */
  async function yerelKarari(u) {
    const d = await hesap.hesapDegisimi(u);
    return d.soru ? degisimSor(ctx, { sayi: d.sayi, kullanici: u, antet: d.antet }) : undefined;
  }

  const hataVer = (kod) => { const e = new Error(kod); e.kod = kod; throw e; };

  // --- çıkışlı: giriş / hesap aç / kurtar -----------------------------------

  function girisFormu() {
    return form('giris', [
      alan(t('hesap.kullanici', 'Kullanıcı adı'), kullaniciKutusu()),
      alan(t('hesap.parola', 'Parola'), parolaKutusu('parola', 'current-password')),
    ], {
      metin: t('hesap.giris', 'Giriş'), simgesi: 'kilit',
      ek: [el('button', { type: 'button', class: 'btn btn--sade', onclick: () => { kip = 'kurtar'; yeniden(); } }, t('hesap.unuttum', 'Parolayı mı unuttun?'))],
    }, async (v, calis) => {
      const u = kullaniciAdiNormal(v.kullanici);
      const sorun = denetle({ u, parola: v.parola }, 'giris');
      if (sorun) hataVer(sorun);
      const yerel = await yerelKarari(u);
      if (yerel === null) return;
      await calis(async () => {
        const r = await hesap.girisYap({ kullanici: u, parola: v.parola, yerel });
        girisSonucu(r, t('hesap.girildi', 'Hesaba girildi.'), yerel);
      });
    });
  }

  function kayitFormu() {
    return form('kayit', [
      alan(t('hesap.kullanici', 'Kullanıcı adı'), kullaniciKutusu(), { ipucu: t('hesap.kullanici_ipucu', 'Küçük Latin harf, rakam, nokta ya da tire; 3–32 karakter.') }),
      alan(t('hesap.parola', 'Parola'), parolaKutusu('parola', 'new-password'),
        { ipucu: t('hesap.parola_ipucu', 'En az 10 karakter. Parola Dari ya da İngilizce harflerle olabilir; kısa bir cümle daha iyi.') }),
      alan(t('hesap.parola_tekrar', 'Parola (tekrar)'), parolaKutusu('parolaTekrar', 'new-password')),
      alan(t('hesap.davet', 'Davet kodu'), girdi({ name: 'davet', autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', dir: 'auto', required: true }),
        { ipucu: t('hesap.davet_ipucu', 'Bu kodu uygulamanın sahibi verir.') }),
    ], { metin: t('hesap.kayit', 'Hesap aç'), simgesi: 'arti' }, async (v, calis) => {
      const u = kullaniciAdiNormal(v.kullanici);
      const sorun = denetle({ u, parola: v.parola, tekrar: v.parolaTekrar, davet: v.davet }, 'kayit');
      if (sorun) hataVer(sorun);
      const yerel = await yerelKarari(u);
      if (yerel === null) return;
      // Sıra (TASARIM §1): önce kod üretilip gösterilir ve onaylanır, hesap SONRA açılır.
      const kod = kurtarmaKoduUret();
      if (!await kurtarmaKoduGoster(ctx, { kullanici: u, kod })) return;
      await calis(async () => {
        const r = await hesap.kayitOl({ kullanici: u, parola: v.parola, davet: v.davet, kod, yerel });
        girisSonucu(r, t('hesap.olusturuldu', 'Hesap açıldı.'), yerel);
      });
    });
  }

  function kurtarmaFormu() {
    return form('kurtar', [
      el('p', { class: 'kart__alt' }, t('hesap.kurtarma_alt', 'Hesap açarken yazdığın kurtarma kodunu gir ve yeni bir parola koy. Eski kod bundan sonra çalışmaz, sana yeni bir kod verilir.')),
      alan(t('hesap.kullanici', 'Kullanıcı adı'), kullaniciKutusu()),
      alan(t('hesap.kurtarma_kodu', 'Kurtarma kodu'), girdi({
        name: 'kurtarmaKodu', autocomplete: 'off', autocapitalize: 'characters', autocorrect: 'off', spellcheck: 'false',
        dir: 'ltr', maxlength: '40', required: true, placeholder: 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX',
      })),
      alan(t('hesap.yeni_parola', 'Yeni parola'), parolaKutusu('yeniParola', 'new-password'),
        { ipucu: t('hesap.parola_ipucu', 'En az 10 karakter. Parola Dari ya da İngilizce harflerle olabilir; kısa bir cümle daha iyi.') }),
      alan(t('hesap.yeni_parola_tekrar', 'Yeni parola (tekrar)'), parolaKutusu('yeniParolaTekrar', 'new-password')),
    ], {
      metin: t('hesap.kurtar', 'Hesabı aç'), simgesi: 'kilit',
      ek: [el('button', { type: 'button', class: 'btn btn--sade', onclick: () => { kip = 'giris'; yeniden(); } }, t('hesap.girise_don', 'Girişe dön'))],
    }, async (v, calis) => {
      const u = kullaniciAdiNormal(v.kullanici);
      const sorun = denetle({ u, kod: v.kurtarmaKodu, parola: v.yeniParola, tekrar: v.yeniParolaTekrar }, 'kurtar');
      if (sorun) hataVer(sorun);
      const yerel = await yerelKarari(u);
      if (yerel === null) return;
      await calis(async () => {
        const r = await hesap.kurtar({
          kullanici: u, kod: v.kurtarmaKodu, yeniParola: v.yeniParola, yerel,
          // Yeni kod ancak eski kod sunucuda tutunca gösterilir (servis çağırır).
          yeniKod: async () => {
            const kod = kurtarmaKoduUret();
            return (await kurtarmaKoduGoster(ctx, { kullanici: u, kod })) ? kod : null;
          },
        });
        girisSonucu(r, t('hesap.kurtarildi', 'Hesap açıldı, yeni parola kaydedildi. Öbür cihazlar yeni parolayla girmeli.'), yerel);
      });
    });
  }

  function cikisliGovde() {
    const sekme = (ad, metin) => el('button', {
      type: 'button', class: 'sekme', role: 'tab', 'aria-selected': String(kip === ad || (ad === 'giris' && kip === 'kurtar')),
      onclick: () => { if (kip !== ad) { kip = ad; yeniden(); } },
    }, metin);
    return [
      el('div', { class: 'sekmeler', role: 'tablist' },
        sekme('giris', t('hesap.giris', 'Giriş')), sekme('kayit', t('hesap.kayit', 'Hesap aç'))),
      kip === 'kayit' ? kayitFormu() : kip === 'kurtar' ? kurtarmaFormu() : girisFormu(),
    ];
  }

  // --- oturum düştü -----------------------------------------------------------

  function oturumGovde(d) {
    return [form('oturum', [
      // Parola yöneticisi hangi hesabın parolası olduğunu bilsin.
      el('input', { type: 'text', name: 'kullanici', autocomplete: 'username', value: d.kullanici, hidden: true, readonly: true }),
      alan(t('hesap.parola', 'Parola'), parolaKutusu('parola', 'current-password')),
    ], {
      // Sunucu silinmiş hesapla yanlış parolayı bilerek ayırmıyor (ad
      // sızmasın); hesap başka cihazda silinmişse doğru parola da bunu alır.
      metin: t('hesap.giris', 'Giriş'), simgesi: 'kilit',
      yanlis: t('hesap.oturum_yanlis', 'Parola yanlış ya da bu hesap başka bir cihazda silinmiş. Bu cihazdaki kayıtlar sağlam.'),
      ek: [el('button', { type: 'button', class: 'btn btn--sade', onclick: async () => { await hesap.cikisYap(); } }, t('hesap.baska_hesap', 'Başka hesapla gir'))],
    }, async (v, calis) => {
      if (!parolaNormal(v.parola)) hataVer('parola_bos');
      // Cihaz bu hesapla hiç eşitlenmeden oturumu düştüyse soru yine gerekir.
      const yerel = await yerelKarari(d.kullanici);
      if (yerel === null) return;
      await calis(async () => {
        const r = await hesap.girisYap({ kullanici: d.kullanici, parola: v.parola, yerel });
        girisSonucu(r, t('hesap.girildi', 'Hesaba girildi.'), yerel);
      });
    })];
  }

  // --- girişli --------------------------------------------------------------

  async function cikisSor() {
    const sil = el('input', { type: 'checkbox', name: 'cikisSil' });
    const r = await ctx.modal({
      baslik: t('hesap.cikis', 'Bu cihazdan çık'),
      govde: el('div', {},
        el('p', {}, t('hesap.cikis_alt', 'Hesabın anahtarı bu cihazdan silinir. Sunucudaki kopya ve öbür cihazlar olduğu gibi kalır.')),
        el('label', { class: 'onay' }, sil, el('span', {}, t('hesap.cikis_sil', 'Bu cihazdaki kayıtları da sil')))),
      dugmeler: [
        { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
        { metin: t('hesap.cikis_evet', 'Çık'), sinif: 'btn--birincil', cb: () => ({ sil: sil.checked }) },
      ],
    });
    if (!r) return;
    await hesap.cikisYap({ sil: r.sil });
    basari(r.sil ? t('hesap.cikildi_silindi', 'Çıkıldı; bu cihazdaki kayıtlar silindi.') : t('hesap.cikildi', 'Hesaptan çıkıldı.'));
    if (r.sil) { ctx.yenileMenu?.(); yenileSayfa(); }
  }

  function girisliGovde(d) {
    const simdiDurum = el('p', { class: 'hesap-durum', role: 'status' });
    const yanlis = t('hesap.parola_yanlis', 'Parola yanlış.');
    const bolum = (b, alt, f) => el('div', { class: 'gelismis__bolum' }, el('h3', {}, b), alt ? el('p', { class: 'kart__alt' }, alt) : null, f);
    const gizliAd = () => el('input', { type: 'text', name: 'kullanici', autocomplete: 'username', value: d.kullanici, hidden: true, readonly: true });

    const parolaFormu = form('parola', [
      gizliAd(),
      alan(t('hesap.mevcut_parola', 'Şimdiki parola'), parolaKutusu('eskiParola', 'current-password')),
      alan(t('hesap.yeni_parola', 'Yeni parola'), parolaKutusu('yeniParola', 'new-password'),
        { ipucu: t('hesap.parola_ipucu', 'En az 10 karakter. Parola Dari ya da İngilizce harflerle olabilir; kısa bir cümle daha iyi.') }),
      alan(t('hesap.yeni_parola_tekrar', 'Yeni parola (tekrar)'), parolaKutusu('yeniParolaTekrar', 'new-password')),
    ], { metin: t('hesap.parola_degistir', 'Parolayı değiştir'), simgesi: 'kaydet', sinif: '', yanlis }, async (v, calis, f) => {
      if (!parolaNormal(v.eskiParola)) hataVer('parola_bos');
      const sorun = denetle({ u: d.kullanici, parola: v.yeniParola, tekrar: v.yeniParolaTekrar }, 'parola');
      if (sorun) hataVer(sorun);
      await calis(() => hesap.parolaDegistir({ eskiParola: v.eskiParola, yeniParola: v.yeniParola }));
      f.reset();
      basari(t('hesap.parola_degisti', 'Parola değişti. Öbür cihazlar yeni parolayla yeniden girmeli.'));
    });

    const kodFormu = form('kod', [
      gizliAd(),
      alan(t('hesap.parola', 'Parola'), parolaKutusu('kodParola', 'current-password')),
    ], { metin: t('hesap.yeni_kod', 'Yeni kurtarma kodu'), simgesi: 'yenile', sinif: '', yanlis }, async (v, calis, f) => {
      if (!parolaNormal(v.kodParola)) hataVer('parola_bos');
      // Kod ancak parola tutunca gösterilir (servis çağırır). Gösterilip
      // onaylandıktan SONRA bir şey ters giderse (ağ, oturum) hekim bunu
      // açıkça okumalı: az önce yazdığı kod geçersiz, eski kâğıdı atmamalı.
      let gosterildi = false;
      try {
        await calis(() => hesap.kurtarmaYenile({
          parola: v.kodParola,
          kod: async () => {
            const kod = kurtarmaKoduUret();
            if (!await kurtarmaKoduGoster(ctx, { kullanici: d.kullanici, kod })) return null;
            gosterildi = true;
            return kod;
          },
        }));
      } catch (e) {
        if (gosterildi && e && typeof e === 'object') e.kodKaydedilmedi = true;
        throw e;
      }
      f.reset();
      basari(t('hesap.yeni_kod_hazir', 'Yeni kurtarma kodu kaydedildi; eskisi artık çalışmaz.'));
    });

    const silFormu = form('sil', [
      gizliAd(),
      alan(t('hesap.parola', 'Parola'), parolaKutusu('silParola', 'current-password')),
    ], { metin: t('hesap.sil', 'Hesabı sil'), simgesi: 'cop', sinif: 'btn--tehlike', yanlis }, async (v, calis) => {
      if (!parolaNormal(v.silParola)) hataVer('parola_bos');
      const evet = await ctx.onayla(t('hesap.sil_onay', '{u} hesabı ve sunucudaki şifreli kopyası kalıcı olarak silinsin mi? Bu cihazdaki kayıtlar kalır.', { u: yalit(d.kullanici) }),
        { baslik: t('hesap.sil', 'Hesabı sil'), evet: t('genel.sil', 'Sil'), tehlikeli: true });
      if (!evet) return;
      await calis(() => hesap.hesabiSil({ parola: v.silParola }));
      basari(t('hesap.silindi', 'Hesap silindi. Bu cihazdaki kayıtlar duruyor.'));
    });

    const gelismis = el('details', { class: 'gelismis', ...(gelismisAcik ? { open: '' } : {}) },
      el('summary', {}, t('hesap.gelismis', 'Gelişmiş')),
      gizlilikKutusu(),
      bolum(t('hesap.parola_degistir', 'Parolayı değiştir'), t('hesap.parola_degistir_alt', 'Öbür cihazlar çıkarılır; yeni parolayla yeniden girerler.'), parolaFormu),
      bolum(t('hesap.yeni_kod', 'Yeni kurtarma kodu'), t('hesap.yeni_kod_alt', 'Eski kod artık çalışmaz. Yeni kod için parolanı yaz.'), kodFormu),
      bolum(t('hesap.sil', 'Hesabı sil'), t('hesap.sil_alt', 'Hesap ve şifreli kopya sunucudan silinir; bu cihazdaki kayıtlar kalır. Şifreli kopya sunucu şirketinin yedeklerinde 30 güne kadar durabilir.'), silFormu));
    gelismis.addEventListener('toggle', () => { gelismisAcik = gelismis.open; });

    return [
      el('div', { class: 'satir' },
        btnS('yenile', t('hesap.simdi', 'Şimdi eşitle'), { class: 'btn btn--birincil', onclick: async () => {
          await mesgul(simdiDurum, async () => {
            try {
              const s = await hesap.simdiEsitle();
              const { eklendi, guncellendi } = raporToplami(s?.rapor);
              basari(eklendi + guncellendi ? senkronOzeti(s) : t('hesap.esitlendi', 'Eşitlendi.'));
            } catch (e) {
              // Tur sürerken çıkış yapıldı (ör. «tüm verileri sil»): söylenecek bir hata yok.
              if (e?.kod !== 'iptal') hata(hataMetni(e, t('hata.senkron_olmadi', 'Eşitleme olmadı.')));
            }
          }, t('hesap.esitleniyor', 'Eşitleniyor…'));
        } }),
        btnS('kapat', t('hesap.cikis', 'Bu cihazdan çık'), { class: 'btn btn--sade', onclick: cikisSor })),
      simdiDurum,
      gelismis,
    ];
  }

  function gizlilikKutusu() {
    return el('div', { class: 'uyari uyari--bilgi hesap-gizlilik' }, simge('kilit', { boy: 16 }),
      el('span', {}, t('hesap.gizlilik', 'Parolan güçlüyse bu kopyayı sunucunun sahibi dahil kimse açamaz. Sunucu kullanıcı adını, zamanları, boyutu ve IP adreslerini görür. Parolayı da kurtarma kodunu da kaybedersen çevrimiçi kopya açılamaz (bu cihazdaki kayıtlar kalır). Asıl yedek yine dosya yedeğidir.')));
  }

  // --- çizim ------------------------------------------------------------------

  const gorunumAdi = (d) => {
    if (!d.sunucuVar) return 'kapali';
    if (d.girisli) return 'girisli';
    if (d.oturumBitti && d.kullanici) return 'oturum';
    return 'cikisli:' + kip;
  };

  /** Başlık rozeti ve özet her olayda; formlar yalnız hâl değişince. */
  function ciz(d, zorla = false) {
    son = d;
    const ad = gorunumAdi(d);
    const odakIcerde = kok.contains(document.activeElement);
    // ekle(): null parçalar atlanır (append onları «null» yazısı olarak basar).
    temizle(bas);
    ekle(bas, [baslik,
      d.girisli ? (d.esitleniyor ? rozet(t('hesap.esitleniyor', 'Eşitleniyor…'), 'mavi') : rozet(t('hesap.bagli', 'bağlı'), 'yesil'))
        : ad === 'oturum' ? rozet(t('hesap.oturum_rozet', 'giriş gerekli'), 'sari') : null]);

    temizle(ozet);
    const alt = (m) => el('p', { class: 'kart__alt' }, m);
    if (ad === 'kapali') {
      ekle(ozet, [alt(t('hesap.kapali', 'Hesaplar henüz açık değil. Kayıtlar yalnız bu cihazda; şimdilik tek yedek dosya yedeği.'))]);
    } else if (ad === 'girisli') {
      ekle(ozet, [
        el('p', { class: 'hesap-kim' }, t('hesap.girisli', 'Giriş yapıldı:'), ' ', el('bdi', { dir: 'ltr' }, d.kullanici)),
        // Tarih ile saat kendi yönünde (yalit): yoksa saat tarihin önüne geçiyor.
        alt(d.sonEsitleme ? t('hesap.son', 'Son eşitleme: {t}', { t: yalit(tarihSaatMetni(d.sonEsitleme)) }) : t('hesap.hic', 'Henüz eşitlenmedi.')),
        d.bekleyen ? alt(t('hesap.bekleyen', '{n} değişiklik henüz sunucuya gitmedi.', { n: d.bekleyen })) : null,
        d.hataKodu && !GECICI_HATALAR.includes(d.hataKodu)
          ? el('div', { class: 'uyari uyari--hata', role: 'alert' }, simge('hata', { boy: 16 }),
            el('span', {}, hataMetni({ kod: d.hataKodu, veri: d.hataVeri }, t('hata.senkron_olmadi', 'Eşitleme olmadı.'))))
          : null]);
    } else if (ad === 'oturum') {
      ekle(ozet, [
        el('div', { class: 'uyari uyari--hata', role: 'alert' }, simge('kilit', { boy: 16 }), el('span', {}, hataMetni({ kod: 'oturum' }))),
        el('p', { class: 'hesap-kim' }, t('hesap.hesap', 'Hesap:'), ' ', el('bdi', { dir: 'ltr' }, d.kullanici)),
        alt(t('hesap.oturum_alt', 'Parolayı yeniden yazana kadar eşitleme durur. Bu cihazdaki kayıtlar duruyor.'))]);
    } else {
      ekle(ozet, [
        alt(t('hesap.alt', 'Hesapla bilgisayar ve telefondaki kayıtlar aynı olur. Kayıtlar bu cihazda kalır; uygulamanın sunucusunda (uygulamanın sahibi Cloudflare\'de işletiyor) şifreli bir kopyası durur.')),
        uygulamaIciMi()
          ? el('div', { class: 'uyari', role: 'alert' }, simge('uyari', { boy: 16 }),
            el('span', {}, t('hesap.uygulama_ici', 'Bu sayfa başka bir uygulamanın (Facebook, Instagram, WhatsApp gibi) içinde açılmış. Onun hafızası ayrı ve silinebilir. Önce uygulamayı Chrome ya da Safari\'de aç, sonra hesap aç ya da gir.')))
          : null,
        gizlilikKutusu()]);
    }

    if (ad !== gorunum || zorla) {
      gorunum = ad;
      temizle(govde);
      if (ad === 'girisli') ekle(govde, girisliGovde(d));
      else if (ad === 'oturum') ekle(govde, oturumGovde(d));
      else if (ad !== 'kapali') ekle(govde, cikisliGovde());
      // Odak kartın içindeydi ve öğesi söküldüyse başlığa: klavyeyle çalışan
      // hekim sayfanın başına düşmesin.
      if (odakIcerde && !kok.contains(document.activeElement)) baslik.focus({ preventScroll: true });
    }
  }

  /* Sekme ya da «رمز را فراموش کرده‌اید؟» formu değiştirir. Odak seçili
     sekmede kalır: kutuya verilseydi telefonda her sekme değişiminde klavye
     açılırdı; klavyeyle çalışan hekim Tab'la forma iner. */
  function yeniden() {
    ciz(son, true);
    kok.querySelector('[role=tab][aria-selected=true]')?.focus();
  }

  async function tazele() {
    const benim = ++sira;
    const d = await hesap.hesapDurumu();
    if (benim === sira) ciz(d);
  }

  ciz(durum);
  const birak = hesap.dinle((o) => { if (o.tur === 'durum') tazele(); });
  return { kart: kok, birak };
}
