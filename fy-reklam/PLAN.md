# FY Reklam — plan ve kararlar

*8 Ekim 2026. Üç bağımsız tasarım önerisi, Meta kurallarının kaynaklı doğrulaması ve iki hakem turundan
sentezlendi; sonra bu depodaki ilk sürüme göre güncellendi. Kararlar sahibinin: değişen her şey burada da değişir.*

## 1. Kısa cevap

Yapılabilir ve ilk sürümü bu klasörde. Asıl iş kod değil Meta'nın kuralları: Instagram hesabı **profesyonel ve
herkese açık** olmalı; Facebook'a API ile yalnız bir **Sayfa**ya gönderi atılır (kişisel profile değil); görsel Meta'nın
çekebileceği **herkese açık bir JPEG adresinde** durmalı; token'lar yalnız sunucuda yaşamalı. İlk gerçek gönderi
API'siz bugün çıkar (JPEG indir / telefondan paylaş / Business Suite); tek düğmeyle Instagram + Facebook yayını
Meta tarafı kurulunca (Kurulum rehberi) açılır.

## 2. Ne olacak (kullanıcı gözünden)

1. **Giriş** — Google ile; yalnız iki Gmail (`REKLAMCILAR`). Sunucu yoksa uygulama *yerel kipte* girişsiz çalışır.
2. **Projeler** — on ürün kartı; metinler ürünlerin kendi README'lerinden, uydurma vaat yok.
3. **Tasarla** — biçim (kare 1:1, dikey 4:5, hikâye 9:16) · şablon (başlık, özellikler, akış) · içerik dili (TR/DE/EN/FA,
   Dari sağdan sola) · başlık (`*vurgu*`), alt metin, özellikler, çağrı; canlı önizleme; her değişiklik taslağa yazılır.
4. **Metin** — kanca / değer / çağrı / etiketler. Canlı denetim: ≤2.200 karakter, ≤30 etiket, ≤20 @etiketleme,
   emoji ≤1, bağırma yok, baskı kalıbı yok, 4–5 niş etiket, Instagram'da bağlantı uyarısı; «daha fazla» kesmesiyle önizleme.
5. **Paylaş** — JPEG (yazı tipleri gömülü SVG → canvas), indir / telefonun paylaşım menüsü / metni kopyala /
   Business Suite. Worker bağlıysa **Instagram'a yayınla · Facebook'a yayınla** (PROVA etiketiyle).
6. **Kayıt** — kim, ne zaman, hangi ürün, hangi kanal, sonuç; ortak liste (Worker) + bu cihaz.
7. **Daha** — dil, tema, bağlantı doktoru, hesap, **Kurulum rehberi** (Meta adımları, onay kutulu).

## 3. Nerede yaşar ve neden

- **Bugün:** `ferhat-yasinoglu/fy-reklam/` (profil deposu, `botflow-mcp/` gibi bir alt proje). Kodda hiçbir anahtar,
  kimlik ya da liste yok; o yüzden herkese açık depoda durması zararsız.
- **Önerilen:** kendi **gizli** deposu `fy-reklam` (Pages `fy-reklam.pages.dev` + Worker `fy-reklam-sunucu`).
  Taşıma: `git subtree split -P fy-reklam -b fy-reklam-ayir` → yeni depoya push; `.github/workflows/fy-reklam*.yml`
  yeni depoda `paths`/`working-directory` olmadan kullanılır. Bu oturumda yeni depo açılamadı (yetki kapsamı), o yüzden
  taşıma sahibinde.
- **Neden FY Merkez'in içinde değil:** FY Merkez para, lisans ve kasanın merkezi; oradaki iki yönetici (sahip + satıcı)
  ile buradaki iki kullanıcı (sahip + reklamcı) aynı kişiler değil. Reklamcıyı `YONETICILER`e eklemek ona ödemeleri açar.
- **Neden Sosyal Stüdyo'nun içinde değil:** müşteriye satılan ürün; girişi tek paylaşımlı anahtar («kim yayınladı»
  yazılamaz); içine yayın düğmesi koymak müşteriler için App Review yoluna girmek demek. Buradaki ihtiyaç iç kullanım.
- **Ödünç alınanlar:** FY Merkez'den Google girişi / JWKS doğrulama / işlem kaydı / Worker sarmalayıcı / iş akışı
  kalıbı; Sosyal Stüdyo'dan PROVA kapısı, dürüst kanal etiketleri, kurulum rehberi kalıbı, Graph çağrı deseni;
  FY Ajans'tan **tasarım dili v3 «Yeşil»** (tokenlar birebir), yazı tipleri, logo, marka sesi kuralları (`icerik-uret`).

## 4. Meta bağlantısı (doğrulanmış kurallar, Ekim 2026)

**Yol.** Instagram **ve** Facebook Sayfası birlikte isteniyorsa tek yol *Instagram API with Facebook Login*
(bir uygulama ya Facebook Login ya Instagram Login kullanır, ikisini birden değil). IG hesabı Sayfaya bağlı olur;
tek yetkilendirme; `graph.facebook.com`. İzinler: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
`instagram_basic`, `instagram_content_publish`. **B planı:** Sayfa istemezsen Instagram için *Instagram Login*
(`graph.instagram.com`, `instagram_business_*`, 60 günlük token; Worker `META_IG_TOKEN` ile bunu da destekler) ve
Facebook için Business Suite.

**Kim bağlar.** Sahip, bir kez. Reklamcı Meta'da OAuth yapmaz: FY Reklam'a Google ile girer, «Yayınla»ya basar,
Worker sahibin bağlantısıyla gönderir, kayıtta onun adı yazar. Reklamcı yine de uygulamaya **Tester** eklenir
(normal Facebook hesabı yeter; Meta «çalışan ya da anlaşma» şartı koyar, bir paragraf yeter).

**App Review gerekmez, Live gerekir.** Yalnız rol sahiplerinin kendi varlıkları için Standard Access yeter.
Ama Development modunda Sayfaya API ile atılan gönderi yalnız rol sahiplerine görünür → ilk canlı yayından önce
uygulama Live'a alınır (gizlilik politikası URL'si, hizmet şartları, simge, kategori, e-posta). İlk gönderi çıkış
yapılmış tarayıcıdan kontrol edilir.

**Token'lar.** Uzun ömürlü **kullanıcı token'ı** (≈60 gün; ayda bir `fb_exchange_token` ile yenilenmezse yeni Sayfa
token'ı türetilemez) ve ondan `/me/accounts` ile alınan **Sayfa token'ı** (süresiz; şifre değişikliği, uygulamanın
kaldırılması, Sayfa rolü kaybı → hata 190). Sayfa gönderisi Sayfa token'ı; Instagram kap/yayın ve özellikle kap durum
sorgusu kullanıcı token'ı (Mayıs 2026'da Sayfa token'ıyla durum sorgusu hata verdi). Secret'lar: `META_SAYFA_TOKEN`,
`META_SAYFA_ID`, `META_IG_ID`, `META_APP_SECRET`, isteğe bağlı `META_KULLANICI_TOKEN`. Graph çağrılarında token
`Authorization: Bearer` başlığında (Workers izleri tam URL'yi kaydeder), `appsecret_proof` eklenir.

**Görsel.** Meta görseli `facebookexternalhit` ile kendisi çeker. Tarayıcı JPEG'i Worker'a yükler, Worker DO'ya yazar,
`/g/<id>.jpg` olarak sunar: kimliksiz, yönlendirmesiz, `image/jpeg`, immutable önbellek, listeleme yok, 7 gün sonra
silinir; `/robots.txt` bu çekiciye izin verir. Yalnız yayınlanan gönderinin görseli dışarı çıkar.

| Kısıt | Instagram (API) | Facebook Sayfası (API) |
|---|---|---|
| Biçim | yalnız JPEG (PNG reddedilir) | jpeg/png/gif/bmp/tiff |
| Boyut | ≤ 8 MB; genişlik 320–1440 px (biz 1080) | ≤ 10 MB |
| En-boy | 4:5 … 1.91:1 (hikâye 9:16 yalnız elle) | belgelenmemiş |
| Metin | ≤ 2.200 karakter, ≤ 30 etiket, ≤ 20 @etiketleme; `alt_text` ≤ 1.000 | `caption` |
| Karusel | 2–10 öğe | `published=false` fotoğraflar + `/feed` `attached_media` |
| Günlük | belgeler 50 ile 100 arasında tutarsız → `content_publishing_limit` canlı okunur | 506 «Duplicate Post»: ardışık aynı metin reddedilir |
| Kap ömrü | 24 saat; FINISHED olmadan yayın yok | — |

**API'siz alternatif (bugün çalışır):** Meta Business Suite ücretsiz; tek seferde Sayfa + Instagram, zamanlama dahil.

## 5. Aşamalar

| Faz | Ne | Durum |
|---|---|---|
| 0 | Meta hazırlığı (hesap, Sayfa, uygulama, roller, Live, token'lar) + bilgisayardan curl kanıtı | Sahipte; uygulamada Kurulum rehberi |
| 1 | API'siz stüdyo: tasarla → metin → indir/paylaş/kopyala/Business Suite; kayıt | **Bu klasörde hazır** |
| 2 | Worker: Google girişi, ortak kayıt, görsel barındırma, Instagram + Facebook yayını, PROVA | **Bu klasörde hazır** (PROVA=1; secret'lar girilince canlı) |
| 3 | Karusel yayını (adaptörde var, arayüzde tek görsel), OAuth «Bağlan», token yenileme cron'u, kuyruk/zamanlama, sağlık kartı (kalan gün), FY Merkez `urun-bilgi` ile canlı fiyat/WhatsApp, AI metin taslağı, `gonderi-uret` skill'i | Sonra |
| 4 | Reels/video, Story API, insights | Çok sonra |

**Kapı:** Faz 3'e geçmeden iki haftada en az 6 gönderi ve ikiniz de en az 2 kez girmiş olun. Tutmuyorsa Business
Suite ile devam edilir; kod büyütülmez.

## 6. Riskler ve frenler

| Risk | Fren |
|---|---|
| Meta ön koşulu eksik (gizli hesap, Sayfa yok, IG bağlı değil) | Kurulum rehberi; elle yol her zaman çalışır |
| Development modunda gönderi görünmez | Live kontrol listesi; ilk gönderi çıkış yapılmış tarayıcıdan |
| Token ölümü (190) | iki token; «yeniden bağlan» kodu; 190'da yeniden deneme yok |
| Token sızıntısı | Bearer başlığı, `appsecret_proof`, loglarda gövde/token yok, hata mesajlarından token süzülür |
| Yanlış/çift gönderi | PROVA varsayılan; onay sorusu; aynı metin 24 saatte aynı kanala ikinci kez → 409 |
| Görsel reddi | yalnız JPEG, sabit oranlar, sunucu sihirli bayt/boyut denetimi, robots.txt, image/jpeg |
| Taslak sızması | görsel yalnız yayınlarken yüklenir, rastgele kimlik, listeleme yok, 7 gün |
| Kurallar değişken | kota canlı okunur; her kural README'de kaynaklı |
| Kapsam kayması («müşterilere de satalım») | yalnız kendi hesapları, Standard Access; satış kararı Sosyal Stüdyo'ya |
| Telefon gerçekliği | Web Share dosya desteği cihaza göre; «JPEG indir» yedeği; metin panoya |
| AI uydurma | AI yok; metinler katalogdan; denetim kuralları |

## 7. Açık sorular (cevabı tasarımı değiştirir)

1. Facebook Sayfan var mı, açacak mısın? Hayır ise: Instagram Login + Business Suite yolu.
2. Reklamcı yalnız FY hesaplarına mı paylaşacak, kendi hesabına da mı? Kendi hesabı: Tester + ikinci hesap satırı.
3. İkiniz de doğrudan yayınlar mısınız, yoksa biri hazırlar biri onaylar mı? Onay akışı «onay bekliyor» durumu getirir.
4. İçerik dilleri: Afganistan ürünleri Dari, NRW işletmeleri Almanca varsayıldı; ürün başına varsayılan dil katalogda.
5. Reels/video ilk sürümde istenmiyor varsayıldı.

## Kaynaklar

Meta birincil belgeleri (doğrulama turunda okundu): content-publishing, instagram-platform overview ve app-review,
instagram-api-with-facebook-login/get-started, create-an-instagram-app, ig-user/media · media_publish ·
content_publishing_limit, error-codes, pages-api/posts, page/photos, page/feed, access-levels, permissions,
app-modes, app-roles, business-verification, basic-settings, facebook-login-for-business, access-tokens
(get-long-lived, debugging-and-error-handling, security), graph-api error-handling; Meta Business Suite yardım sayfaları.
Hepsi `developers.facebook.com` ve `facebook.com/business/help` altında.
