# instagram-comment-bot

Instagram yorumlarını otomatik cevaplayan bot. Önce anahtar kelime kuralları,
kural yoksa Claude — hiçbiri uymuyorsa susuyor.

```
yorum:  "FİYAT ne kadar?"          → kural:price   → "Selam! Güncel fiyat için DM kutumuz açık 🙂" + DM
yorum:  "bedava takipçi kazan"     → kural:spam    → yorum gizlenir
yorum:  "bu fotoğrafı nerede çektiniz?" → model    → "İstanbul'daki atölyemizde 🙂"
yorum:  "❤️🔥"                      → cevap yok (model çağrısı da yapılmaz)
```

## Neden iki katman

Bir işletme gönderisinin altındaki yorumların çoğu aynı beş soru: fiyat, kargo,
beden, stok, bir de övgü ve spam. Bunları dosyadan cevaplamak anında, ücretsiz
ve tam istediğiniz cümleyle olur. Geriye kalan, gerçekten farklı olan yorumlar
modele gider — o da emin olmadığında cevap yazmak yerine susar.

| | |
| --- | --- |
| Kurallar | Anahtar kelime + regex, Türkçe büyük/küçük ve aksan duyarsız |
| Aksiyonlar | Herkese açık cevap, DM (private reply), yorumu gizleme, sessiz kalma |
| Model | Claude (`claude-opus-5`), kural eşleşmeyen yorumlar için — isteğe bağlı |
| Güvenlik | `X-Hub-Signature-256` doğrulaması, kendi yorumlarını yanıtlamama, tekrar gelen webhook'u yutma |
| Deneme | `--try` ile terminalde; `IG_DRY_RUN=1` ile canlıda hiçbir şey göndermeden |
| Bağımlılık | express + Anthropic SDK. Veritabanı yok |

## Hızlı başlangıç

```bash
npm install
npm test                      # 62 test, ağ gerekmez
cp rules.example.json rules.json
npm run try -- "fiyat ne kadar?"
```

`--try` hiçbir şey göndermez ve Instagram bilgisi istemez — kuralları böyle
yazın: dosyayı değiştirin, çalıştırın, cevabı görün.

Sunucuyu başlatmak için:

```bash
cp .env.example .env          # doldurun
npm run dev                   # http://localhost:3000/webhook
```

## Meta tarafında kurulum

1. [developers.facebook.com](https://developers.facebook.com) → yeni uygulama →
   **Instagram** ürününü ekleyin. Instagram hesabı **professional** (işletme ya da
   içerik üreticisi) olmalı ve bir Facebook sayfasına bağlı olmalı.
2. İzinler: `instagram_manage_comments` (cevap ve gizleme), DM cevabı da
   istiyorsanız `instagram_manage_messages`.
3. Webhooks → `comments` alanına abone olun. Callback URL olarak sunucunuzun
   herkese açık `https://.../webhook` adresini, Verify token olarak da
   `IG_VERIFY_TOKEN` değerini girin. Meta bu adrese bir GET atar, bot doğrular.
   Yerelde denemek için `ngrok http 3000` yeterli.
4. Uzun ömürlü access token'ı `IG_ACCESS_TOKEN`, hesabın Instagram id'sini
   `IG_USER_ID` olarak verin.

Yayına almadan önce `IG_DRY_RUN=1` ile bir gün çalıştırın: bot ne cevaplayacağını
loglar, hiçbir şey göndermez.

## Kural dosyası

`rules.json` bir liste; **ilk eşleşen kural kazanır**, o yüzden dar kuralları
üste koyun. Alanlar:

```jsonc
[
  {
    "name": "spam",                          // logda görünen ad
    "pattern": "(bedava takipci|casino)",    // normalize edilmiş metne regex
    "hide": true                             // cevaplama, yorumu gizle
  },
  {
    "name": "price",
    "keywords": ["fiyat", "ne kadar", "how much"],  // herhangi biri geçerse eşleşir
    "reply": [                               // birden fazlaysa yorumcuya göre değişir
      "Merhaba {{username}}, DM'den yazıyoruz!",
      "Selam {{username}}, DM kutumuz açık 🙂"
    ],
    "privateReply": "Fiyat listemiz: ..."    // ayrıca DM gönderir
  },
  {
    "name": "etiketleme",
    "pattern": "^\\s*@\\w+[\\s@\\w]*$",
    "ignore": true                           // eşleş ama sus (model de devreye girmez)
  }
]
```

`{{username}}` ve `{{text}}` yerine yorumcunun adı ve yorum metni geçer.
Eşleştirme normalize edilmiş metin üzerinde yapılır: "FİYAT", "fiyat", "fıyat"
hepsi aynı kurala düşer. Bozuk bir kural dosyası uygulamayı **açılışta**
durdurur, gece yarısı değil.

Kurallardan sadece biri çalışır ve sırayla bakılır:

| Alan | Sonuç |
| --- | --- |
| `reply` | Yorumun altına herkese açık cevap |
| `privateReply` | Yoruma DM (Instagram yorum başına 1 tane ve 7 gün içinde izin verir) |
| `hide` | Yorumu gizle |
| `ignore` | Hiçbir şey yapma — modeli de devre dışı bırakır |

## Model katmanı

`ANTHROPIC_API_KEY` **ve** `IG_PERSONA` doluysa, kural eşleşmeyen yorumlar
Claude'a gider. `IG_PERSONA` işletme brifingidir: modelin kullanabileceği
gerçekler ve ses tonu. Sistem promptu modele şunu dayatır:

- yorumun dilinde cevap ver, iki cümleyi geçme,
- brifingde olmayan fiyat/stok/kampanya **uydurma**,
- sipariş, şikâyet, iade gibi kişisel konularda "DM'den yazın" de,
- emin değilsen hiç cevap yazma.

İkisinden biri boşsa bot sadece kurallarla çalışır — model katmanı tamamen
isteğe bağlıdır.

## Ortam değişkenleri

Tamamı ve açıklamaları `.env.example` içinde. Kısaca:

| Değişken | Ne işe yarar |
| --- | --- |
| `IG_VERIFY_TOKEN` | Meta panelindeki Verify token ile aynı olmalı |
| `IG_APP_SECRET` | Webhook imzasını doğrular. **Boş bırakmayın**: URL'yi bulan herkes botu çalıştırabilir |
| `IG_ACCESS_TOKEN` | Uzun ömürlü token — şifre gibi saklayın |
| `IG_USER_ID` | Instagram hesap id'si; kendi yorumlarını atlamak için de kullanılır |
| `IG_RULES_FILE` | Kural dosyası yolu (varsayılan `rules.json`) |
| `IG_DRY_RUN=1` | Karar ver, logla, hiçbir şey gönderme |
| `ANTHROPIC_API_KEY`, `IG_PERSONA` | Model katmanı (ikisi de gerekli) |
| `IG_MAX_REPLY_CHARS` | Cevap uzunluk sınırı (varsayılan 280) |

## Nasıl çalışıyor

```
Meta webhook ─► imza doğrulama ─► 200 (hemen) ─► kuyruk
                                                   │
                                    ┌──────────────┴───────────────┐
                                    │ kendi yorumun mu? → atla     │
                                    │ daha önce geldi mi? → atla   │
                                    │ kural var mı? → cevap/gizle  │
                                    │ model var mı? → cevap/sus    │
                                    └──────────────┬───────────────┘
                                                   ▼
                                        Graph API: reply / DM / hide
```

Webhook cevapları **işten önce** 200 döner: Meta birkaç saniyede yanıt alamazsa
aynı yorumu tekrar gönderir, o da aynı yoruma iki cevap demektir. İşlenen yorum
id'leri hafızada tutulduğu için tekrar gelen teslimat yutulur.

Kendi hesabınızın yorumları hiçbir zaman cevaplanmaz — botun kendi cevabına
cevap yazıp sonsuz döngüye girmesini engelleyen şey budur.

## Yayına alma

```bash
npm run build
IG_VERIFY_TOKEN=… IG_APP_SECRET=… IG_ACCESS_TOKEN=… IG_USER_ID=… npm start
```

Tek süreç, durum tutmaz; HTTPS ve herkese açık bir adres yeterli. Birden fazla
kopya çalıştırırsanız yinelenen yorum hafızası süreç başına olduğu için aynı
yoruma iki cevap gidebilir — o durumda tek kopya tutun.

## Sınırlar

- Yorumları Meta'nın webhook'u getirir; geçmiş yorumlar taranmaz.
- DM cevabı (`privateReply`) yorum başına bir kez ve yorumdan sonraki 7 gün
  içinde gönderilebilir — Instagram'ın kuralı.
- Rate limit'e takılan cevap yeniden denenmez; loglanır ve geçilir.

MIT.
