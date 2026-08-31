# reply-bot

Instagram yorumlarını ve WhatsApp mesajlarını otomatik cevaplayan bot. Önce
anahtar kelime kuralları, kural yoksa Claude — hiçbiri uymuyorsa susuyor.

```
instagram:  "bunu ne ile yaptın?"       → kural:teknoloji-tr → "Vanilla JavaScript + Firestore — framework yok."
instagram:  "bedava takipçi kazan"      → kural:spam         → yorum gizlenir
whatsapp:   "merhaba"                   → kural:selam-tr     → "Merhaba! Nasıl yardımcı olabilirim? 🙂"
whatsapp:   "casino linki"              → kural:spam         → sessiz (sohbette gizlenecek bir şey yok)
her ikisi:  "bu fotoğrafı nerede çektin?" → model            → mesajın dilinde kısa cevap
her ikisi:  "❤️🔥"                        → cevap yok (model çağrısı da yapılmaz)
```

## Neden iki katman

Gelen mesajların çoğu aynı birkaç soru: ne ile yaptın, kaynak kodu nerede,
nereden başlamalıyım, bir de iş teklifi, övgü ve spam. Bunları dosyadan
cevaplamak anında, ücretsiz ve tam istediğiniz cümleyle olur. Geriye kalan,
gerçekten farklı olan mesajlar modele gider — o da emin olmadığında cevap
yazmak yerine susar.

| | |
| --- | --- |
| Kanallar | Instagram yorumları ve WhatsApp mesajları; biri, öteki ya da ikisi birden |
| Kurallar | Anahtar kelime + regex, Türkçe/Almanca/Farsça duyarlı, kanala göre kısıtlanabilir |
| Aksiyonlar | Açık cevap, DM (Instagram), yorumu gizleme (Instagram), sessiz kalma |
| Model | Claude (`claude-opus-5`), kural eşleşmeyen mesajlar için — isteğe bağlı |
| Güvenlik | Kanal başına `X-Hub-Signature-256`, kendi mesajlarını yanıtlamama, tekrar gelen webhook'u yutma |
| Deneme | `--try` ile terminalde; `BOT_DRY_RUN=1` ile canlıda hiçbir şey göndermeden |
| Panel | `/panel` — ayarlar, kurallar, son kararlar; şifre koymazsan hiç açılmaz |
| Bağımlılık | express + Anthropic SDK. Veritabanı yok |

## Hızlı başlangıç

```bash
npm install
npm test                              # 165 test, ağ gerekmez
cp rules.example.json rules.json
npm run try -- "bunu ne ile yaptın?"
npm run try -- --whatsapp "merhaba"
```

Kurulumun tamam olup olmadığını çalıştırmadan önce sormak için:

```bash
npm run doctor          # .env, kurallar ve token'lar — sadece okur
```

`--try` hiçbir şey göndermez ve hesap bilgisi istemez — kuralları böyle yazın:
dosyayı değiştirin, çalıştırın, cevabı görün.

`rules.example.json` bu hesap için hazır geliyor: proje/iş sorusu, kaynak kod,
kullanılan teknoloji, öğrenmeye nereden başlanacağı ve övgü — dördü de Türkçe,
Almanca, İngilizce ve Farsça ayrı kurallarla. Selamlaşma kuralları yalnızca
WhatsApp'ta çalışıyor; yorum altında selama otomatik cevap tuhaf kaçardı.

Sunucuyu başlatmak için:

```bash
cp .env.example .env          # doldurun
npm run dev                   # /webhook/instagram ve /webhook/whatsapp
```

`npm run dev`, `npm start` ve `npm run try` `.env`'i kendileri okur (Node'un
`--env-file-if-exists`'i, bu yüzden Node 22.9+). Kabuğunuzda **zaten export
edilmiş** bir değişkeni `.env` ezmez — ortamdaki değer kazanır.

## İki kanal, tek çekirdek

Kural motoru, Claude katmanı, Türkçe normalize etme ve imza doğrulama iki
kanalda da aynı kodu kullanıyor. Kanala özgü olan tek şey adaptör: neyi
ayrıştırdığı, ne yapabildiği ve nereye yazdığı.

| | Instagram | WhatsApp |
| --- | --- | --- |
| Ortam | Herkese açık yorum | Bire bir sohbet |
| Açık cevap | ✓ | ✓ (mesajı alıntılayarak) |
| DM | ✓ (yorum başına bir kez, 7 gün) | — cevabın kendisi zaten özel |
| Gizleme | ✓ | — sohbette gizlenecek bir şey yok |
| Zaman sınırı | yok | **24 saat**: kişinin son mesajından sonra |
| Gönderim | form + `access_token` | JSON + `Authorization: Bearer` |
| Yok sayılan | yorum dışı alanlar | teslimat bildirimleri, fotoğraf/ses/sticker |

Bir kural iki kanalda da geçerlidir; `"channels": ["whatsapp"]` yazarsanız
yalnızca orada çalışır. Kanalın yapamayacağı bir aksiyon istenirse bot sessiz
kalır: WhatsApp'ta `hide` eşleşen bir kural yorumu gizlemeye çalışmaz, hiç
cevap vermez.

### 24 saat penceresi

WhatsApp'ta serbest metinle ancak kişinin son mesajından sonraki 24 saat içinde
yazabilirsiniz; dışında yalnızca Meta'nın önceden onayladığı şablonlar gider.
Bot, geç gelen bir teslimatı **göndermeyi denemek yerine** atlar ve sebebini
loglar. Şablon desteği yok; onay süreci gerektirdiği için bilerek dışarıda
bırakıldı.

## Kural dosyası

`rules.json` bir liste; **ilk eşleşen kural kazanır**, o yüzden dar kuralları
üste koyun. Alanlar:

```jsonc
[
  {
    "name": "spam",                          // logda görünen ad
    "pattern": "(bedava takipci|casino)",    // normalize edilmiş metne regex
    "hide": true                             // Instagram'da gizler, WhatsApp'ta susar
  },
  {
    "name": "is-tr",
    "keywords": ["iş teklifi", "site yapar mısın", "fiyat"],  // herhangi biri geçerse eşleşir
    "reply": [                               // birden fazlaysa gönderene göre değişir
      "Merhaba {{username}}! Detayları DM'den konuşalım 🙂",
      "Selam {{username}}, DM'den yazabilirsin 🙂"
    ],
    "privateReply": "Merhaba! Projeden biraz bahseder misin?"  // yalnızca Instagram
  },
  {
    "name": "selam-tr",
    "keywords": ["merhaba", "selam"],
    "reply": "Merhaba {{username}}! Nasıl yardımcı olabilirim? 🙂",
    "channels": ["whatsapp"]                 // yalnızca bu kanalda
  }
]
```

`{{username}}` ve `{{text}}` yerine gönderenin adı ve mesaj metni geçer.
Eşleştirme normalize edilmiş metin üzerinde yapılır: "FİYAT", "fiyat", "fıyat"
hepsi aynı kurala düşer. Aynı folding Almanca ve Farsça için de çalışır —
"schön" ile "schon", "عالیه" ile harekeli hâli aynı yere düşer.

Çok dilli kurallarda tek dikkat edilecek şey, bir dilin kural listesine başka
bir dilde de kullanılan bir ifadeyi koymamak: Almanca kuralda "open source"
yazarsa İngilizce mesaj ona düşer ve Almanca cevap alır.

Bozuk ya da eksik bir kural dosyası uygulamayı **açılışta** durdurur, gece
yarısı değil.

| Alan | Sonuç |
| --- | --- |
| `reply` | Açık cevap (yorum altına ya da sohbete) |
| `privateReply` | Yoruma DM — Instagram'da; WhatsApp'ta yok sayılır |
| `hide` | Yorumu gizle — Instagram'da; WhatsApp'ta sessizlik |
| `ignore` | Hiçbir şey yapma — modeli de devre dışı bırakır |
| `channels` | Kuralı bu kanallarla sınırla; yoksa hepsinde geçerli |

## Model katmanı

`ANTHROPIC_API_KEY` **ve** `BOT_PERSONA` doluysa, kural eşleşmeyen mesajlar
Claude'a gider. `BOT_PERSONA` hesap brifingidir: modelin kullanabileceği
gerçekler ve ses tonu — `.env.example` içindekiler bu hesap için hazır. Sistem
promptu modele şunu dayatır:

- mesajın dilinde cevap ver, iki cümleyi geçme,
- brifingde olmayan şeyi **uydurma** (fiyat, tarih, teknik detay),
- kişi gerektiren konularda "dönüş yapacağım" de, kendi başına söz verme,
- emin değilsen hiç cevap yazma.

Prompt hangi odada olduğunu da söylüyor: Instagram'da yazdığı şeyi gönderiyi
gören herkes okur, WhatsApp'ta yalnızca tek kişi. İkisi ayrı önbellek öneki
kullanır.

İkisinden biri boşsa bot sadece kurallarla çalışır — model katmanı tamamen
isteğe bağlıdır.

## Ortam değişkenleri

Tamamı ve açıklamaları `.env.example` içinde. Kısaca:

| Değişken | Ne işe yarar |
| --- | --- |
| `IG_ACCESS_TOKEN`, `IG_USER_ID` | Instagram kanalını açar |
| `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID` | WhatsApp kanalını açar |
| `IG_VERIFY_TOKEN`, `WA_VERIFY_TOKEN` | Meta panelindeki Verify token ile aynı olmalı |
| `IG_APP_SECRET`, `WA_APP_SECRET` | Webhook imzasını doğrular. **Boş bırakmayın** |
| `WA_WINDOW_HOURS` | 24 saat penceresi (varsayılan 24) |
| `BOT_RULES_FILE` | Kural dosyası yolu (varsayılan `rules.json`) |
| `BOT_DRY_RUN=1` | Karar ver, logla, hiçbir şey gönderme |
| `ANTHROPIC_API_KEY`, `BOT_PERSONA` | Model katmanı (ikisi de gerekli) |
| `PANEL_PASSWORD` | `/panel` web panelini açar (en az 12 karakter) |
| `BOT_DATA_DIR` | Panelin yazdığı yer (varsayılan `data`) |

Yukarıdakilerin çoğu panelden de girilebilir; panelden yazılan değer ortamdaki
değerin üstüne biner. `PORT`, `HOST`, `BOT_RULES_FILE`, webhook yolları ve
panelin kendi şifresi bunun dışında — panelin kendi kapısını taşıyabilmesi,
sizi dışarıda bırakabilmesi demek olurdu.

## Nasıl çalışıyor

```
Meta webhook ─► kanalın imzası ─► 200 (hemen) ─► kuyruk
                                                   │
                                    ┌──────────────┴───────────────┐
                                    │ kendi mesajın mı? → atla     │
                                    │ pencere kapandı mı? → atla   │
                                    │ daha önce geldi mi? → atla   │
                                    │ kural var mı? → cevap/gizle  │
                                    │ model var mı? → cevap/sus    │
                                    └──────────────┬───────────────┘
                                                   ▼
                                     Graph API: cevap / DM / gizle
```

Webhook cevapları **işten önce** 200 döner: Meta birkaç saniyede yanıt alamazsa
aynı teslimatı tekrar gönderir, o da aynı mesaja iki cevap demektir. İşlenen
id'ler kanal adıyla birlikte hafızada tutulduğu için tekrar gelen teslimat
yutulur ve iki kanaldaki aynı id birbirini gölgelemez.

Kendi hesabınızın mesajları hiçbir zaman cevaplanmaz. WhatsApp'ta gönderdiğiniz
her mesaj teslimat bildirimi olarak geri gelir; ayrıştırma onları yok sayar —
biri gelen mesaj sanılsaydı bot kendi bildirimlerine sonsuza kadar cevap
yazardı.

## Ön kontrol

`npm run doctor` bir mesaj beklemeden önce her şeyi bir turda denetler ve
yalnızca **okur** — test mesajı göndermez:

```
  ✓ kurallar           rules.json: 27 kural, 5 tanesi kanala özel
  ! model              kapalı: bot yalnızca kurallarla çalışır, gerisine susar (ücretsiz)
  ✓ mod                canlı — cevaplar gerçekten gönderilir
  ✓ instagram          hesap 17841…, yol /webhook/instagram
  ✓ instagram imza     gelen teslimatlar doğrulanacak
  ✓ instagram token    farhad___yaqoobi
  ✗ whatsapp           eksik: WA_PHONE_NUMBER_ID

  Meta paneline yapıştırılacak:
    instagram  https://…/webhook/instagram   alan: comments   verify: …
```

Token'ların gerçekten yaşadığını Meta'ya tek bir okuma isteğiyle sorar; ağa
çıkmasını istemezseniz `--offline`, adresleri tam yazdırmak için
`--url https://…` ekleyin. Bir şey `✗` ise çıkış kodu 1 olur, yani dağıtım
betiğine de koyabilirsiniz.

## Web paneli

`PANEL_PASSWORD` verildiğinde `/panel` açılır: doctor'ın yazdığı kontroller,
ayarlar form olarak, kural dosyası düzenleyici olarak, tek mesajı bottan
geçiren bir kutu ve son kararların listesi. Terminale girmeden kurmak
isteyenler için — sunucuyu hiç durdurmadan çalışır.

```bash
PANEL_PASSWORD=en-az-on-iki-karakter npm run dev
# http://localhost:3000/panel
```

Şifre yoksa panel **hiç mount edilmez**; adresi bilen de bir şey bulamaz. On
iki karakterden kısa şifre kabul edilmiyor, çünkü arkasında erişim
anahtarlarınız duruyor.

Panelden girilen değerler `BOT_DATA_DIR/settings.json` dosyasına yazılır ve
ortam değişkenlerinin **üstüne** biner. Her alanın nereden geldiği (`panel` mi
`ortam` mı) yanında yazar; paneldeki değeri silmek ortamdakine geri döner. Bu
sıralamanın tersi — ortamın kazanması — paneli bozuk gösterirdi: anahtarı
yazarsınız, kaydedersiniz, hiçbir şey değişmez.

Kayıtlı bir anahtar tarayıcıya **hiç gönderilmez**. Panel yalnızca "dolu" ve
son dört karakteri gösterir; iki anahtarı ayırt etmeye yeter, birini kullanmaya
yetmez.

Kaydedilen ayar geçerli bir bot üretmiyorsa değişiklik geri alınır ve çalışan
bot yerinde kalır. Aynısı kurallar için de geçerli: dosyaya yazılmadan önce
ayrıştırılır — botun yükleyemediği bir kural dosyası, bütün kanalları aynı anda
düşüren tek şeydir.

| Değişken | Ne işe yarar |
| --- | --- |
| `PANEL_PASSWORD` | Paneli açar. En az 12 karakter. Yoksa panel yok |
| `BOT_DATA_DIR` | Panelin yazdığı yer (varsayılan `data`). Fly'da kalıcı disk olmalı |
| `PANEL_TRUST_PROXY` | `1` ise `X-Forwarded-For` okunur. Yalnızca güvendiğiniz bir proxy arkasında |
| `PANEL_PUBLIC_URL` | Paneldeki "Meta'ya yapıştır" kutusunda tam adresi yazar |

Oturum, açılışta üretilen bir sırla imzalanan çerezde durur: sunucu yeniden
başlayınca herkes çıkmış olur, "çıkış" düğmesi de çerezi gerçekten iptal eder.
Şifre yanlış girildikçe adres başına bekleme süresi büyür.

`PANEL_TRUST_PROXY` açık değilken bütün istekler proxy'nin adresinden gelmiş
görünür, yani bir kişinin yanlış denemeleri sizi de kilitler; açıkken başlık
sahte de olabilir. Fly arkasında açık olması doğrusu, ortada proxy yokken kapalı
olması.

## Yayına alma

```bash
npm run build
npm start
```

Tek süreç, durum tutmaz; HTTPS ve herkese açık bir adres yeterli. Birden fazla
kopya çalıştırırsanız yinelenen mesaj hafızası süreç başına olduğu için aynı
mesaja iki cevap gidebilir — o durumda tek kopya tutun.

### Docker

```bash
cp rules.example.json rules.json     # kurallar imajla birlikte gider
docker build -t reply-bot .
docker run -p 3000:3000 --env-file .env reply-bot
```

Kurallar imajın içine girer, kimlik bilgileri girmez: `.dockerignore` `.env`
dosyasını dışarıda tutar. Cevapları değiştirmek imajı yeniden kurmak demek —
taşınacak veri, bağlanacak veritabanı yok.

### Fly.io

`fly.toml` hazır. Gizli değerler depoya da imaja da girmez, `fly secrets` ile
konur:

```bash
fly launch --copy-config --no-deploy
fly volumes create botdata --size 1 --region fra
fly secrets set IG_ACCESS_TOKEN=… IG_USER_ID=… IG_VERIFY_TOKEN=… IG_APP_SECRET=…
fly deploy
```

Fly'ın verdiği adres Meta paneline girecek olan adrestir; sonuna
`/webhook/instagram` ve `/webhook/whatsapp` eklenir. Makine uyumaya
bırakılmadı: her teslimatta soğuk açılış beklemek webhook'u yavaşlatır.

Kalıcı disk paneli anlamlı kılan şey: `fly.toml` onu `/data`'ya bağlıyor ve
panelden girilen ayarlar oraya yazılıyor. Makinenin kendi diski her yeniden
başlatmada — dağıtımda, bakımda, çökmede — sıfırlanır. Diski oluşturmadan
dağıtırsan Fly `fly.toml`'daki bağlamayı çözemez ve dağıtım başlamadan durur.

Sadece `PANEL_PASSWORD` verip dağıtabilirsin: makine boş açılır, kanal
bilgilerini `/panel` adresinden tarayıcıdan doldurursun. `fly secrets` ile
girilen değerler de çalışmaya devam eder; hiç değiştirmeyeceğin şeyler için
orası daha iyi bir yer.

### GitHub Actions'tan dağıtım

Yerelde Docker ya da `flyctl` kurmak istemiyorsan dağıtımı CI yapsın:
**Actions → "reply-bot dağıt" → Run workflow**. İmaj Fly'ın uzak kurucusunda
kurulur, senin makinende hiçbir şey gerekmez.

Bir kerelik hazırlık — hepsi tarayıcıdan, hiçbir token bir dosyaya ya da sohbete
yazılmadan (**Settings → Secrets and variables → Actions**):

| Gizli değer | Ne için |
| --- | --- |
| `FLY_API_TOKEN` | Zorunlu. `fly tokens create deploy` çıktısı |
| `IG_ACCESS_TOKEN`, `IG_USER_ID`, `IG_VERIFY_TOKEN`, `IG_APP_SECRET` | Instagram kanalı |
| `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_VERIFY_TOKEN`, `WA_APP_SECRET` | WhatsApp kanalı |
| `ANTHROPIC_API_KEY`, `BOT_PERSONA` | Model katmanı (isteğe bağlı) |
| `PANEL_PASSWORD` | Web paneli (isteğe bağlı, en az 12 karakter) |

`PANEL_PASSWORD` verirsen kanal değerlerini hiç girmeden de dağıtabilirsin:
`FLY_API_TOKEN` ve panel şifresi yeter, gerisi tarayıcıdan. Workflow kalıcı
diski de yoksa oluşturur.

Verilmeyen değer Fly'a hiç gönderilmez; o kanal kapalı kalır. Workflow önce
testleri koşar — kırıksa dağıtmaz — sonra imajı kurar, gizli değerleri
`--stage` ile koyar (her biri ayrı bir dağıtım tetiklemesin diye) ve tek
seferde dağıtır. Sonunda `/healthz`'e sorar; cevap gelmezse iş kırmızı olur.
Çalışma özetinde Meta paneline yapıştırılacak iki satır yazılı gelir.

**Prova** kutusu varsayılan olarak işaretli: `BOT_DRY_RUN=1` ile dağıtır, yani
bot karar verir ama hiçbir şey göndermez. Canlıya almak için kutuyu kaldırıp
tekrar çalıştır.

Uygulama adı küresel olarak benzersiz olmak zorunda; `reply-bot` doluysa
workflow'u çalıştırırken başka bir ad ver (`reply-bot-farhad` gibi).

## Sınırlar

- Yalnızca webhook'un getirdiği yeni mesajlar işlenir; geçmiş taranmaz.
- WhatsApp'ta 24 saat dışına düşen mesaja cevap verilmez (şablon desteği yok).
- DM (`privateReply`) Instagram'da yorum başına bir kez ve yedi gün içinde.
- Uzun ömürlü token 60 gün yaşar; bot süresi dolduğunu tanır ve loglar, ama
  kendi kendine yenilemez.
- Rate limit'e takılan bir cevap yeniden denenmez; loglanır ve geçilir.
- Fotoğraf, ses, sticker ve konum mesajları atlanır — metin olmayan şeye kural
  da model de bir şey söyleyemez.
- Paneldeki "son mesajlar" listesi hafızada durur ve yeniden başlatınca
  sıfırlanır; kalıcı kayıt tutulmuyor.
- Panelde tek şifre var, kullanıcı hesabı yok — bir kişinin botu için tasarlandı.

MIT.
