// Doğrulama ve depo hatalarının arayüz metni.
// Saf modüller (paylasilan/, depo/) yalnız kod döndürür; metin ve çeviri burada.
// Böylece alan mantığı dilden bağımsız kalır ve hata mesajları da çevrilir.
import { t } from './i18n.js';

const DOGRULAMA = {
  ad_gerekli: 'İlaç adı gerekli.',
  soyad_gerekli: 'Soyad gerekli.',
  barkod_bicim: 'Barkod 6–14 rakam olmalı.',
  tarih_gecersiz: 'Tarih geçersiz.',
  kimlik_bicim: 'Kimlik numarası yalnız rakamlardan oluşmalı.',
  dogum_gelecek: 'Doğum tarihi gelecekte olamaz.',
  eposta_gecersiz: 'E-posta geçersiz.',
  hasta_gerekli: 'Hasta seçilmeli.',
  ilac_gerekli: 'En az bir ilaç eklenmeli.',
  sablon_ad_gerekli: 'Şablon adı gerekli.',
  sablon_ad_tekrar: 'Aynı adla bir şablon zaten var.',
  adet_gecersiz: 'Her satırın adedi sıfırdan büyük olmalı.',
};

const DEPO = {
  koleksiyon: 'Bilinmeyen kayıt türü.',
  cakisma: 'Kayıt başka bir yerde değiştirildi.',
  kota: 'Cihazda yer kalmadı. Yedek alıp eski kayıtları temizle.',
  yazma: 'Kayıt yazılamadı.',
  kilit: 'Veritabanı başka bir sekmede açık.',
  liste_okunamadi: 'İlaç listesi okunamadı.',
  liste_bozuk: 'İlaç listesi beklenen biçimde değil.',
  tani_okunamadi: 'Tanı listesi okunamadı.',
  tani_bozuk: 'Tanı listesi beklenen biçimde değil.',
  recete_bulunamadi: 'Reçete bulunamadı.',
  gorsel_yok: 'Dosya seçilmedi.',
  gorsel_tur: 'Seçilen dosya bir görsel değil.',
  gorsel_bozuk: 'Görsel açılamadı.',
  gorsel_buyuk: 'Görsel çok büyük; daha küçük bir fotoğraf seç.',
  // Eşitleme, kasa ve hesap. Türkçe kalan bir kod Farsça arayüzün ortasına
  // Türkçe cümle basıyor — görsel yükleme eklenirken tam bu olmuştu.
  parola_yok: 'Önce hesaba giriş yapılmalı.',
  parola: 'Sunucudaki kopya bu hesabın anahtarıyla açılmadı. Başka bir cihaz farklı bir anahtarla yazmış olabilir; bu cihazdaki kayıtlar sağlam.',
  kasa_bozuk: 'Sunucudaki kopya bir Shafa kasası değil ya da bozuk; bu cihazdakilerle birleştirilmedi.',
  uzak_bozuk: 'Sunucudaki kopya bir Shafa kopyası değil.',
  kripto: 'Bu tarayıcı şifreleme desteklemiyor; eşitleme çalışmaz.',
  bicim: 'Dosya tanınmadı.',
  surum: 'Sunucudaki kopya bu sürümden yeni; önce uygulamayı güncelle.',
  bozuk: 'Dosyanın içi okunamadı.',
  gzip_yok: 'Bu tarayıcı sıkıştırılmış kopyayı açamıyor. Tarayıcıyı güncelle (Chrome ya da Safari).',
  // Ağ: hekimi doğru yere göndermek için üçü ayrı. İnternet varken sunucuya
  // ulaşılamaması "internet yok" değil.
  ag: 'İnternet yok. Kayıtlar bu cihazda; internet gelince eşitlenir.',
  zaman_asimi: 'Sunucu zamanında yanıt vermedi. İnternet yavaş olabilir; sonra yeniden denenir.',
  sunucu_yok: 'Sunucuya şu an ulaşılamıyor.',
  sunucu_hata: 'Sunucuda bir sorun oldu; sonra yeniden dene.',
  sunucu_dolu: 'Sunucunun günlük sınırı doldu; birkaç saat sonra kendiliğinden yeniden denenir.',
  sunucu_adresi_yok: 'Hesaplar henüz açık değil. Şimdilik dosya yedeğini kullan.',
  // Sunucunun kodları (sunucu/cekirdek.js, §3.1).
  gecersiz: 'Sunucu isteği kabul etmedi. Uygulamayı güncelle.',
  davet: 'Davet kodu yanlış.',
  kayit_kapali: 'Yeni hesap açma şu an kapalı.',
  alinmis: 'Bu kullanıcı adı alınmış; başka bir ad seç.',
  cok_istek: 'Çok fazla deneme. {dakika} dakika sonra yeniden dene.',
  yanlis: 'Kullanıcı adı ya da parola yanlış.',
  kilitli: 'Çok fazla yanlış deneme; bu hesap {dakika} dakika kilitli. Bu arada öbür cihazlar eşitlenmeye devam eder.',
  oturum: 'Oturum artık geçerli değil (parola başka yerde değişmiş olabilir). Parolayı yeniden yaz.',
  buyuk: 'Sunucudaki kopya 20 MB sınırına ulaştı, eşitleme durdu. Dosya yedeği al.',
  // İstemcinin kendi denetimleri (senkron/hesap-servisi.js, hesap.js).
  anahtar_bozuk: 'Hesabın anahtarı açılamadı. Sunucudaki hesap kaydı bozulmuş olabilir; bu cihazdaki kayıtlar sağlam.',
  kullanici_gecersiz: 'Kullanıcı adı 3–32 karakter olmalı: küçük Latin harf, rakam, nokta, tire ya da alt çizgi; harf ya da rakamla başlamalı.',
  parola_bos: 'Parolayı yaz.',
  parola_kisa: 'Parola en az 10 karakter olmalı.',
  parola_telefon: 'Parola bir telefon numarası olamaz.',
  parola_rakam: 'Parola yalnız rakamlardan oluşamaz.',
  parola_kullanici: 'Parola kullanıcı adını içeremez.',
  parola_yaygin: 'Bu parola çok yaygın, kolay tahmin edilir. Kısa bir cümle dene.',
  // Kartın kendi denetimleri (hesap-arayuz.js): ağdan ve kutulardan önce.
  parola_farkli: 'İki parola aynı değil.',
  davet_bos: 'Davet kodunu yaz. Kodu uygulamanın sahibi verir.',
  kurtarma_gecersiz: 'Kurtarma kodu 24 harf ve rakamdan oluşmalı.',
  kurtarma_yanlis: 'Kullanıcı adı ya da kurtarma kodu yanlış.',
  girisli: 'Bu cihaz zaten bir hesaba bağlı; önce çıkış yap.',
  giris_yok: 'Önce hesaba giriş yap.',
  hesap_degisimi: 'Bu cihazda {sayi} kayıt var. Önce onlara ne olacağını seç.',
  senkron_olmadi: 'Eşitleme olmadı; sonra yeniden denenir.',
};

/** Doğrulama kodunu arayüz metnine çevirir. Kod tanınmazsa olduğu gibi döner. */
export function dogrulaMetni(kod) {
  if (!kod) return '';
  const tr = DOGRULAMA[kod];
  return tr ? t('dogrula.' + kod, tr) : kod;
}

/** Hata nesnesini arayüz metnine çevirir; tanınmayan hatada kendi mesajı kalır. */
export function hataMetni(e, varsayilan = '') {
  const tr = e?.kod ? DEPO[e.kod] : null;
  if (tr) return t('hata.' + e.kod, tr, e.veri || null);
  return e?.message || varsayilan || t('genel.islem_olmadi', 'İşlem yapılamadı');
}

const UYARI = {
  alerji: 'Hastanın "{a}" alerjisi var',
  cift_etken: 'Aynı etken madde birden fazla satırda: {liste}',
};

/** Uyarı kodunu cümleye çevirir. `veri.ad` varsa başına ilacın adı gelir. */
export function uyariMetni(u) {
  const tr = UYARI[u?.kod];
  const govde = tr ? t('uyari.' + u.kod, tr, u.veri || null) : (u?.kod || '');
  return u?.veri?.ad ? `${u.veri.ad}: ${govde}` : govde;
}

const GORELI = { bugun: 'bugün', yarin: 'yarın', dun: 'dün', sonra: '{n} gün sonra', once: '{n} gün önce' };

/** goreliGun() çıktısını cümleye çevirir. */
export function goreliMetni(g) {
  if (!g || g.kod === 'yok') return '—';
  return t('zaman.' + g.kod, GORELI[g.kod], { n: g.gun });
}
