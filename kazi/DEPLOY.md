# kazi'yi telefondan yayınlama

Amaç: kazi'yi internette kendi adresine koymak. Sonra telefonda o adresi açar, bir sayfanın adresini yapıştırır ve sayfanın temiz yazısını (Markdown) görürsün.

Bu rehber **Render** sitesinin **ücretsiz** planını kullanır. Her şeyi telefon tarayıcısından yapabilirsin. Bilgisayar gerekmez.

Not: Render'ın ekranlarında yazan adlar zamanla değişebilir. Aşağıdaki adlar Render'ın belgelerine göre yazıldı ve telefonda uçtan uca denenmedi. Ekranda biraz farklı yazıyorsa en yakın olanı seç.

## Başlamadan önce

1. Bir **GitHub** hesabın olmalı (var).
2. kazi'nin web arayüzü GitHub'da **`main`** dalında olmalı. Render o dalı okur. (Aşağıda Adım 0.)
3. Bir **Render** hesabı açacaksın. Ücretsiz, GitHub ile birkaç dokunuşta açılır (Adım 1).

## Adım 0: Kod GitHub'da `main` dalında mı?

1. GitHub uygulamasını ya da github.com'u aç. `ferhat-yasinoglu` deposuna gir.
2. Üstteki dal (branch) adına dokun. `main` dalını seç.
3. Dosya listesinde `kazi` klasörüne gir. İçinde `Dockerfile`, `render.yaml` ve `src` varsa hazırsın. Adım 1'e geç.
4. Yoksa değişiklikler henüz başka bir dalda demektir. **Pull requests** sekmesine gir, web arayüzünün olduğu isteği aç ve **Merge pull request** düğmesine dokun. Emin değilsen bunu Claude'dan iste.

## Adım 1: Render hesabı aç

1. Telefonda **render.com** adresini aç.
2. **Get Started** (ya da **Sign up**) düğmesine dokun.
3. **GitHub** ile devam et. GitHub izin sorarsa onayla.

## Adım 2: Yayını başlat (Yol A: Blueprint, kolay yol)

`render.yaml` dosyası Render'a ne kuracağını söyler. Sen sadece dosyanın yerini gösterirsin.

1. Render panelinde sağ üstteki **New** (ya da **+**) düğmesine dokun. **Blueprint** seç.
2. Render GitHub'a bağlanmak ister: **Connect GitHub** (ya da **Configure account**) düğmesine dokun. GitHub'da bir izin sayfası açılır.
   - **Only select repositories** seç.
   - `ferhat-yasinoglu` deposunu işaretle ve kaydet. Böylece Render yalnız bu depoyu görür.
3. Listeden `ferhat-yasinoglu` deposunu seç.
4. Render dosya yolunu sorarsa şunu yaz: `kazi/render.yaml`
5. Bir kutu **ANTHROPIC_API_KEY** ister. Anahtarın yoksa **boş bırak**. Bu anahtar isteğe bağlıdır ve ücretlidir (aşağıda anlatıldı). Render boş geçmene izin vermezse Yol B'yi kullan.
6. Plan olarak **Free** yazdığını kontrol et. Ücretli plan seçersen para çekilir.
7. **Apply** (ya da **Deploy Blueprint**) düğmesine dokun.

Render `render.yaml` bulamadı derse ya da yol kutusunu göstermezse Yol B'ye geç.

## Adım 2 (alternatif): Yol B: Web Service

Yol A çalışmadıysa:

1. **New** → **Web Service**. Depoyu seç: `ferhat-yasinoglu`.
2. Şu alanları doldur:
   - **Language / Runtime:** `Docker`
   - **Branch:** `main`
   - **Root Directory:** boş bırak
   - **Dockerfile Path:** `./kazi/Dockerfile`
   - **Docker Build Context Directory:** `./kazi` (bu alan "Advanced" bölümünde olabilir)
   - **Instance Type:** `Free`
3. **Environment Variables** bölümünde ekle:
   - Ad: `KAZI_TOKEN`. Değer: kendi şifren. Boşluksuz, **en az 16 karakter**, rastgele olsun. **Türkçe harf (ç ğ ı ö ş ü İ) ve boşluk kullanma**: yalnızca İngilizce harf, rakam ve `-` `_` gibi işaretler olsun. Aksi halde servis hiç başlamaz. Telefonun şifre yöneticisinin "güçlü şifre oluştur" özelliğini kullanabilirsin. Bunu not et, Adım 5'te lazım olacak.
4. **Health Check Path** alanı varsa `/api/health` yaz.
5. **Create Web Service** düğmesine dokun.

## Adım 3: Bekle

Render kurulumu yapar. İlk seferde birkaç dakika sürebilir (süre değişir). Servis sayfasında **Logs** sekmesinden ilerlemeyi görürsün. Durum **Live** olunca hazırdır.

Sonraki yayınlar otomatik olur: GitHub'da `kazi` klasöründe bir şey değişince Render kendiliğinden yeniden kurar.

## Adım 4: Şifreni (KAZI_TOKEN) gör

Yol A kullandıysan şifreyi Render senin için üretti:

1. Render'da servisin sayfasını aç (adı `kazi`).
2. **Environment** sekmesine gir.
3. `KAZI_TOKEN` satırını bul. Değer gizli olabilir; yanındaki göz simgesine ya da **Reveal / Göster** yazısına dokun.
4. Değere basılı tut ve **Kopyala**'ya dokun. Uzun ve karışık bir yazıdır. **Elle yazmaya çalışma, kopyala-yapıştır yap.**

## Adım 5: Linki aç ve gir

1. Servis sayfasının üstünde `.onrender.com` ile biten adresi bul. Ona dokun.
2. Render ilk seferde "yükleniyor" sayfası gösterebilir. Bir dakika kadar bekle (aşağıda "Ücretsiz plan" bölümüne bak).
3. kazi'nin giriş ekranı açılır. **Şifre (token)** kutusuna kopyaladığın şifreyi yapıştır. **Giriş yap**'a dokun.
4. Şifre telefonda saklanır. Bir daha sormaz (tarayıcı verisini silmezsen).

## Adım 6: Dene

1. **Sayfayı çevir** sekmesinde **Sayfa adresi** kutusuna bir sayfanın adresini yapıştır. Örnek: `https://example.com`
2. **Çevir** düğmesine dokun. Sayfanın temiz Markdown'ı ekrana gelir.
3. **Kopyala** ile metni alabilir, **Metni indir (.md)** ile dosya yapabilirsin.
4. Yazı eksik geliyorsa **Daha fazla yazı al** kutusunu işaretleyip tekrar dene. Çoğu sayfada sonuç değişmez. Menü ve alt kısımlar yine gelmez.

İpucu: Tarayıcının menüsünden **Ana ekrana ekle** deyip kazi'yi telefonun ana ekranına koyabilirsin.

## Ücretsiz planın sınırları (dürüst liste)

Bunlar Render'ın belgelerinde yazanlar. Sayılar ve kurallar değişebilir; güncelini render.com/docs/free sayfasında görürsün.

- **Uyur.** Yaklaşık 15 dakika kimse kullanmazsa servis uyur. Sonraki ilk açılış yaklaşık bir dakika sürebilir. Bu normal; bekle ve sayfayı yenile.
- **Aylık saat sınırı var.** Render hesap başına ayda belli sayıda ücretsiz çalışma saati veriyor (yazıldığı tarihte 750). Biterse ay sonuna kadar servis durur.
- **Dosya tutmaz.** Servis yeniden başlayınca yerel dosyalar silinir. kazi zaten bir şey kaydetmez; şifre Render ayarlarında durur.
- **Her an yeniden başlayabilir.** Render ücretsiz servisi istediği zaman yeniden başlatabilir.
- **Yavaş ve küçüktür.** Büyük sayfalar ve PDF'ler yavaş gelebilir. Sunucu bir isteği varsayılan olarak 90 saniyede bırakır.
- **Çok trafik yapma.** Ücretsiz servisin dışarıya olağandışı çok trafik üretmesi askıya alınmasına yol açabilir. Tek tek sayfa okumak sorun değil; arka arkaya yüzlerce sayfa çekme.
- Render ücretsiz planı "ciddi/ticari kullanım için değil" diye tanımlıyor. Kişisel deneme için uygun.

## Güvenlik: şifreni kimseyle paylaşma

- `KAZI_TOKEN` senin anahtarın. Bilen herkes **senin sunucunu** kullanabilir (ve `ANTHROPIC_API_KEY` ekliysen **senin paranla** çalıştırabilir).
- Şifreyi mesajla, e-postayla, ekran görüntüsüyle kimseye gönderme. GitHub'a yazma.
- Adres herkese açıktır ama giriş ekranından öteye şifresiz geçilemez.
- Şifre sızdı ya da emin değilsen: Render'da servis → **Environment** → `KAZI_TOKEN` → düzenle → yeni uzun bir değer yaz → kaydet. Servis yeniden başlar. Telefonda yeni şifreyi gir.
- Ortak kullandığın bir telefondan işin bitince arayüzde **Çıkış**'a dokun (şifre telefondan silinir).

## Veri çıkarma (isteğe bağlı, ücretli)

kazi'nin **Bilgi çıkar** sekmesi (sunucu mesajlarında "Veri çıkarma") Claude kullanır. Bunun için **ANTHROPIC_API_KEY** gerekir.

- **Ücretlidir.** Her kullanımda Anthropic'e para ödersin. Claude aboneliğin bunun yerine geçmez; ayrı faturalanır.
- **İstemezsen ekleme.** Anahtar yoksa **Bilgi çıkar** sekmesi hiç görünmez. Sayfayı Markdown'a çevirme (**Çevir**) ve **Adresleri listele** tamamen çalışır.
- Eklemek için: Render'da servis → **Environment** → **Add Environment Variable** → ad `ANTHROPIC_API_KEY`, değer anahtarın (`sk-ant-...`) → kaydet. Servis yeniden başlar, sekme görünür olur.
- Anahtarı Anthropic'in geliştirici sayfasından (console.anthropic.com) alırsın. Orada harcama sınırı koymanı öneririm.

## JavaScript modu kapalı

Bazı siteler yazısını sayfa açıldıktan sonra JavaScript ile yükler. Bu kurulumda bunları okumak **bilerek kapalı**: imajda tarayıcı yok ve ücretsiz planın belleği bir tarayıcı çalıştırmaya yetmez. Bu yüzden arayüzde **JavaScript'li site** kutusu görünmez. Bu tür sitelerde sonuç boş gelir ve ekranda "Bu sayfadan okunacak yazı çıkmadı" yazar; başka bir adres dene.

## Alternatifler

### Kendi bilgisayarında, telefon aynı Wi-Fi'de

Render'a gerek yok. Bilgisayarda (Python 3.10+ kurulu) terminalde:

```bash
cd kazi
pip install -e '.[web,extract]'
export KAZI_TOKEN="en-az-16-karakterlik-bir-sifre"      # Windows PowerShell: $env:KAZI_TOKEN="..."
kazi serve --host 0.0.0.0 --port 8000
```

Sonra bilgisayarın yerel adresini bul (Windows: `ipconfig`, Mac/Linux: `hostname -I` ya da ağ ayarları; çoğu zaman `192.168...` ile başlar). Telefonda tarayıcıya `http://192.168.x.x:8000` yaz, şifreyi gir.

- Bu adres `https` değil `http`. Şifre ev ağında şifrelenmeden gider. Yalnız güvendiğin ağda kullan.
- Bilgisayarın güvenlik duvarı izin sorabilir.
- Bilgisayar kapanırsa ya da uykuya geçerse çalışmaz. Dışarıdayken (mobil veriyle) açılmaz.
- Yalnız o bilgisayarda denemek istersen: `kazi serve --host 127.0.0.1 --no-auth` ve tarayıcıda `http://127.0.0.1:8000`. Bu modda şifre yoktur ama sunucu dışarıya açılmaz.

### GitHub Codespaces

1. GitHub'da depoyu aç → yeşil **Code** düğmesi → **Codespaces** sekmesi → **Create codespace**.
2. Açılan terminalde yukarıdaki `pip install` ve `export KAZI_TOKEN` komutlarını yaz, sonra `kazi serve --port 8000`.
3. **Ports** (Bağlantı noktaları) sekmesinde 8000 için bir adres çıkar. Telefonda onu aç. Varsayılan olarak yalnız GitHub hesabınla açılır; bu güvenlidir, öyle bırak.

Sınırlar: GitHub ücretsiz hesapta aylık Codespaces kotası verir (değişebilir). Bir süre kullanılmayınca durur; durunca kazi de kapanır. Telefonda terminal yazmak zordur; bu yol, başlatmayı bilgisayardan yapmak içindir.

## Sorun giderme

İlk sütun, ekranda gördüğün cümledir. Aynı cümleyi burada ara.

| Ne görüyorsun | Ne yapmalı |
|---|---|
| Sayfa çok geç açılıyor, "yükleniyor" ekranı | Servis uyuyordu, uyanıyor. Yaklaşık bir dakika bekle, sayfayı yenile. |
| Giriş ekranı hiç gelmiyor, boş/beyaz sayfa | Yenile. Olmazsa başka tarayıcı dene. Render'da servis → **Logs** sekmesine bak. Durum **Live** değilse Adım 3'e dön. |
| Render'da kurulum **Failed** | **Logs**'u aç. En sık sebep: `kazi` klasörü GitHub'da `main` dalında yok (Adım 0), ya da Yol A'da dosya yolu `kazi/render.yaml` değil. Yol B'yi dene. |
| Servis açılıp hemen kapanıyor, logda "KAZI_TOKEN tanımlı değil" | **Environment** sekmesine `KAZI_TOKEN` ekle (Adım 4 / Yol B). Şifre yoksa sunucu bilerek başlamaz. |
| Servis açılıp hemen kapanıyor, logda "KAZI_TOKEN'da boşluk ve Türkçe harf (ç, ğ, ı, ö, ş, ü) olmamalı." | Şifrende boşluk ya da Türkçe harf var (Yol B). **Environment** → `KAZI_TOKEN` → yeni bir değer yaz: yalnız İngilizce harf, rakam ve `-` `_` gibi işaretler, en az 16 karakter. Kaydet. |
| "Şifre kabul edilmedi. Şifreyi yeniden girin, sonra işlemi tekrar deneyin." (giriş ekranına döner) | Şifre yanlış. **Environment**'tan `KAZI_TOKEN`'ı yeniden kopyala, yapıştır. Başında ya da sonunda boşluk olmasın. Elle yazma. |
| "Şifrede geçersiz bir karakter var. Boşluk ve Türkçe harf olmamalı." | Giriş kutusundaki şifrede boşluk ya da Türkçe harf var. Şifreyi **Environment**'tan kopyala-yapıştır yap. |
| "Çok fazla hatalı giriş denemesi. Biraz sonra tekrar deneyin." | Yanlış şifre art arda çok denendi. Doğru şifre bu durumda da çalışır: şifreyi **Environment**'tan kopyalayıp yapıştır. |
| "Çok fazla istek. 20 saniye sonra tekrar deneyin." (saniye değişir) | Dakikalık sınır doldu (varsayılan 30). Yazılan saniye kadar bekle. |
| "Sunucu şu an başka işlerle meşgul. Birkaç saniye sonra tekrar deneyin." | Aynı anda en fazla 3 sayfa çekilir. Birkaç saniye bekle. |
| "Sayfa çok geç yanıt verdi; işlem durduruldu. Daha sonra tekrar deneyin." | Ücretsiz plan küçük. Daha küçük bir sayfa dene; büyük PDF'ler yavaştır. |
| "Site geç yanıt verdi. Biraz sonra tekrar deneyin." | Açmaya çalıştığın site yavaş. Biraz sonra tekrar dene. |
| "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin." | Telefonun interneti yok ya da servis uyuyor. Bağlantıyı kontrol et, bir dakika sonra yenile. |
| "Sunucu çok geç cevap verdi. Biraz sonra tekrar deneyin." | Servis uyuyordu ya da yoğun. Bir dakika bekleyip tekrar dene. |
| "Site bu sayfayı açmaya izin vermedi (HTTP 403). Bazı siteler otomatik erişimi engeller." | Birçok site bulut sunuculardan gelen otomatik istekleri engeller. kazi bu engeli aşmaya çalışmaz. Başka bir adres dene; ya da kazi'yi kendi bilgisayarında çalıştırmayı dene (ev bağlantısı genelde engellenmez, garanti değil). |
| "Sayfa bulunamadı (HTTP 404). Adresi kontrol edin." | Adres yanlış ya da sayfa kaldırılmış. |
| "Site şu an hata veriyor (HTTP 503). Biraz sonra tekrar deneyin." (kod değişir) | Sorun açmaya çalıştığın sitede. Biraz sonra tekrar dene. |
| "Siteye bağlanılamadı. Adresi kontrol edin; site kapalı olabilir." | Adresi kontrol et. Doğruysa site kapalıdır. |
| "Sitenin güvenlik sertifikası geçersiz ya da süresi dolmuş. Güvenlik için açılmadı." | O sitenin https ayarı bozuk. kazi bunu bilerek açmaz. Başka bir adres dene. |
| "Siteyle güvenli bağlantı (https) kurulamadı. Adres http:// ile başlıyorsa onu yazın." | Site https desteklemiyor olabilir. Adresin başına `http://` yazıp dene. |
| "Siteyle bağlantı kurulamadı ya da koptu. Biraz sonra tekrar deneyin." | Sorun açmaya çalıştığın sitede ya da arada. Biraz sonra tekrar dene. |
| "Site sayfayı çok fazla yere yönlendirdi; açılamadı." | Site kendi içinde döngüye girmiş. Başka bir adres dene. |
| "Sitenin gönderdiği içerik bozuk; okunamadı." | Site bozuk bir yanıt verdi. Biraz sonra tekrar dene ya da başka bir adres dene. |
| "Sayfa çok büyük (en fazla 3 MB). Daha küçük bir sayfa deneyin." | Çok büyük sayfalar ve PDF'ler bu sunucuda açılmaz. |
| "Bu PDF dosyası okunamadı. Dosya bozuk ya da şifreli olabilir." | Başka bir PDF dene. Şifreli PDF'ler açılmaz. |
| "Bu sayfadan okunacak yazı çıkmadı. Adres bir resim ya da dosya olabilir, ya da site yazıyı sonradan yüklüyordur (bu sunucu onu okuyamaz). Başka bir adres deneyin." | Adres resim/dosya ise yazı çıkmaz. Site yazısını JavaScript ile yüklüyorsa bu kurulumda okunamaz (yukarıdaki "JavaScript modu kapalı" bölümü). **Daha fazla yazı al** kutusunu da deneyebilirsin. |
| "Bu adres iç ağa ya da özel bir adrese gidiyor; güvenlik için açılmaz." | `localhost` ve `192.168...` gibi özel adresler açılmaz. Herkese açık bir adres gir. |
| "Site adı bulunamadı; adresi kontrol edin." | Adreste yazım hatası var. |
| **Bilgi çıkar** sekmesi görünmüyor | Normal: `ANTHROPIC_API_KEY` eklemedin. İstersen yukarıdaki "Veri çıkarma" bölümündeki gibi ekle. |
| Servis hiç açılmıyor, "suspended" yazıyor | Aylık ücretsiz saat dolmuş olabilir. Render'da **Billing** sayfasına bak; ay başında yenilenir. |

Takıldığın yerde ekran görüntüsünü (**içinde şifre görünmesin**) Claude'a göster, birlikte bakarız.
