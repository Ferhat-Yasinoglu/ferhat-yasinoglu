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
  // Eşitleme ve kasa. Türkçe kalan bir kod Farsça arayüzün ortasına Türkçe
  // cümle basıyor — görsel yükleme eklenirken tam bu olmuştu.
  parola_yok: 'Önce Google ile giriş yapılmalı.',
  parola: 'Bu yedek başka bir cihazda yapılmış. O cihazın kodunu gir.',
  kasa_bozuk: 'Google\'daki dosya açılamadı.',
  uzak_bozuk: 'Buluttaki dosya bir Shafa kopyası değil.',
  kripto: 'Bu tarayıcı şifreleme desteklemiyor; eşitleme çalışmaz.',
  bicim: 'Dosya tanınmadı.',
  surum: 'Buluttaki kopya bu sürümden yeni; önce uygulamayı güncelle.',
  bozuk: 'Dosyanın içi okunamadı.',
  istemci_yok: 'Google istemci kimliği girilmemiş.',
  yetki: 'Google izin vermedi. Hesabı seç ve erişime izin ver.',
  hesap_izinsiz: 'Google bu hesaba izin vermedi. Ya izni vermeden pencereyi kapattın, ya da bu adres henüz uygulamanın listesinde değil. Her hâlükârda «Yedek indir» her hesapla ve internetsiz çalışır — dosyayı kendin sakla.',
  pencere: 'Tarayıcı Google penceresini engelledi. Engeli kaldırıp yeniden dene.',
  ag: 'Google\'a ulaşılamadı. İnternet bağlantısını denetle.',
  drive: 'Drive isteği başarısız oldu.',
  betik: 'Google giriş betiği yüklenemedi. İnternet var ama betik engellenmiş: reklam engelleyiciyi kapat, sayfayı zorla yenile (Ctrl+Shift+R) ve tekrar dene.',
  zaman_asimi: 'Google yanıt vermedi. Pencere engellenmiş olabilir; yeniden dene.',
  belge_bitti: 'Giriş süresi doldu; yeniden eşitle.',
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
