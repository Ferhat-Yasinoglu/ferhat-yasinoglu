# Sosyal Stüdyo Worker

Cloudflare Worker: Telegram ve Meta (Instagram/WhatsApp) webhook'ları, akış motoru, kişiler,
toplu mesaj, AI proxy, 5 dakikalık bekçi cron. Ücretsiz katman yeter: günde 100.000 istek,
D1'de 100.000 satır yazma (≈ 15–20 bin gelen mesaj/gün).

Neden Worker: ilk sürüm sürekli açık bir sunucu istiyordu, o yüzden silindi. Worker
uyur, mesaj gelince uyanır; makine yok, fatura yok. Anahtarlar tarayıcıya hiç inmez.

## Kurulum: GitHub Actions ile (önerilen, yalnız tarayıcı)

Cloudflare tarafındaki her şeyi `.github/workflows/sosyal-studyo-worker.yml` yapar: D1
veritabanını oluşturur, göçleri uygular, Worker'ı dağıtır, secret'ları GitHub'dan Cloudflare'e
taşır, Telegram token'ı varsa webhook'u kurar, sağlık kontrolü yapıp adresi iş özetine yazar.
Senin yapacağın üç şey var; hepsi tarayıcıda, hepsi bir kez.

**1. Cloudflare (ücretsiz hesap)**

- https://dash.cloudflare.com/sign-up → hesap aç (kart istemez).
- Sol menüden **Workers & Pages** sayfasını bir kez aç; alt alan adı (`xxx.workers.dev`) seçmeni
  isterse seç. Sağ tarafta **Account ID** yazar, kopyala.
- https://dash.cloudflare.com/profile/api-tokens → **Create Token** → **Edit Cloudflare Workers**
  şablonu → **Use template**. Permissions'a iki satır ekle: **Account · D1 · Edit** ve
  **Account · Workers AI · Edit**. Continue → Create Token → token'ı kopyala (bir daha gösterilmez).

**2. Telegram (isteğe bağlı, 2 dakika)**

- Telegram'da **@BotFather** → `/newbot` → ad ve kullanıcı adı ver → verdiği token'ı kopyala.

**3. GitHub → depo → Settings → Secrets and variables → Actions**

| Sekme | Ad | Değer |
|---|---|---|
| Secrets | `CLOUDFLARE_API_TOKEN` | 1. adımdaki token |
| Secrets | `CLOUDFLARE_ACCOUNT_ID` | 1. adımdaki Account ID |
| Secrets | `YONETICI_ANAHTARI` | en az 32 karakterlik rastgele şifre; aynısını uygulamaya gireceksin |
| Secrets | `TELEGRAM_BOT_TOKEN` | 2. adımdaki token (yoksa boş bırak) |
| Variables | `WORKER_DAGITIMI_ACIK` | `1` |

Sonra **Actions → Sosyal Studyo Worker → Run workflow**. 1–2 dakika içinde iş özetinde
Worker adresi görünür: `https://sosyal-studyo.<altalan>.workers.dev`. Uygulamada
**Ayarlar → Worker**'a bu adresi ve `YONETICI_ANAHTARI` değerini gir, "Bağlan / doğrula".
Doktor listesi D1, PROVA, Telegram, Meta, AI ve cron durumunu gösterir.

Telegram token'ı verdiysen webhook kendiliğinden kurulmuştur: botuna `/start` ya da `fiyat`
yaz; Sohbetler'de görünür, karar günlüğe düşer ama PROVA'da mesaj gitmez.

Diğer secret'lar da aynı yere eklenir, sonraki dağıtımda Cloudflare'e taşınır:
`META_APP_SECRET`, `META_VERIFY_TOKEN`, `IG_ACCESS_TOKEN`, `IG_USER_ID`, `WA_ACCESS_TOKEN`,
`WA_PHONE_NUMBER_ID`, `ANTHROPIC_API_KEY`. `TELEGRAM_WEBHOOK_SECRET` ayrıca gerekmez; yönetici
anahtarından türetilir. `worker/**` altına her push yeniden dağıtır; secret'lar korunur.

## Kurulum: bilgisayardan (alternatif)

Gerekenler: ücretsiz Cloudflare hesabı, Node.js 22+. Depo kökünde `npm ci` sonrası:

```bash
cd sosyal-studyo/worker
npx wrangler login                              # tarayıcıda Cloudflare'e giriş
npx wrangler d1 create sosyal-studyo            # çıkan database_id'yi wrangler.toml'daki D1_ID_BURAYA yerine yaz
npx wrangler d1 migrations apply sosyal-studyo --remote
npx wrangler secret put YONETICI_ANAHTARI       # ≥32 rastgele karakter: openssl rand -hex 32
npx wrangler secret put TELEGRAM_BOT_TOKEN      # @BotFather /newbot çıktısı
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET # kendin uydur: openssl rand -hex 16
npx wrangler deploy
```

Sonra uygulamada **Ayarlar → Kanallar → Telegram → Kurulum → "Webhook'u kur"**.

`ALLOWED_ORIGINS` (wrangler.toml) uygulamanın adresini içermeli; yerel geliştirmede
`worker/.dev.vars` dosyasına `ALLOWED_ORIGINS=http://localhost:8787` yaz (gitignore'da).

## Instagram / WhatsApp (Meta)

Meta tarafı Telegram gibi anında değil: bir Meta geliştirici uygulaması, işletme hesabı ve
mesajlaşma izinleri için Meta onayı gerekir (günler sürebilir). Gerekli secret'lar:
`META_APP_SECRET`, `META_VERIFY_TOKEN` (kendin uydur; Meta paneline aynısını yaz),
`IG_ACCESS_TOKEN` (60 günlük uzun ömürlü token), `IG_USER_ID`, `WA_ACCESS_TOKEN` (kalıcısı
için sistem kullanıcısı), `WA_PHONE_NUMBER_ID`.

Meta panelinde webhook adresi `https://<worker>/meta/webhook`, alanlar `messages` + `comments`.
Adım adım rehber uygulamada **Ayarlar → Kurulum → Instagram**. Yorum webhook'u onaysız
uygulamalarda gelmeyebilir; hesabın `polling.aktif` alanı açıksa cron 5 dakikada bir son
gönderilerin yorumlarını çeker.

## Canlıya alma

Worker `PROVA = "1"` ile gelir: hesap "canli" olsa bile hiçbir dış gönderim yapılmaz. İki adım:

1. GitHub → Variables → `SS_PROVA` = `0` → Actions'tan workflow'u yeniden çalıştır
   (bilgisayardan kuruyorsan `wrangler.toml` → `PROVA = "0"` → `npx wrangler deploy`)
2. Uygulamada Ayarlar → Kanallar → "Canlıya al" (CANLI yazarak onay)

İkisi birden olmadan mesaj gitmez. Geri almak için ikisinden biri yeter.

## AI

`ANTHROPIC_API_KEY` secret'ı girilirse `MODEL` (varsayılan `claude-haiku-4-5`) kullanılır;
yoksa Workers AI (`AI_MODEL`, günde 10.000 nöron ücretsiz). Günlük tavan `AI_GUNLUK_TAVAN`.
Anthropic panelinde aylık harcama tavanı koymadan anahtar girme — koda hiç güvenmeyen tek fren odur.

## Uç noktalar

| Yol | Koruma | İş |
|---|---|---|
| `GET /health` | yok | sürüm, şema, PROVA, AI sağlayıcısı, eksik yapılandırma |
| `GET/POST /meta/webhook` | verify token / HMAC-SHA256 | Instagram + WhatsApp olayları |
| `POST /tg/webhook` | secret başlığı | Telegram güncellemeleri |
| `GET /api/durum` | Bearer | doktor + kotalar |
| `GET/PUT/DELETE /api/k/:kol[/:id]` | Bearer | koleksiyonlar (`since` ile artımlı; `If-Match` ile rev) |
| `POST /api/komut` | Bearer | idempotent komutlar (etiket, puan, mesaj gönder, akış başlat, ajanı sustur) |
| `GET /api/yedek` · `POST /api/ice-aktar` | Bearer | yedek belgesi |
| `POST /api/ai/:ozellik` | Bearer | fikir, senaryo, kanca, karusel, video analizi, ajan testi, transkript |
| `POST /api/prova` | Bearer | gerçek yapılandırmayla karar, gönderimsiz |
| `POST /api/kanal/telegram/kur` | Bearer | setWebhook |

Yanıtlar `{ok:true, veri}` ya da `{ok:false, hata, mesaj}`. Her istek `X-SS-Sema: 1` taşımalı;
uyuşmazsa 409. 5 yanlış anahtar → 15 dakika 429.

## Güvenlik

- Fail-closed: D1, yönetici anahtarı (≥32) ya da `ALLOWED_ORIGINS` eksikse `/api` 503, webhook'lar işlemez.
- Meta gövdesi ham okunur, HMAC doğrulanmadan JSON.parse edilmez. Telegram secret başlığı zorunlu.
- Aynı olay iki kez gelirse (Meta 36 saat yeniden dener) `gelen_kutusu` tekilleştirir.
- Origin kimlik değildir; frenler anahtar, oran sınırı ve Cloudflare/Anthropic harcama tavanlarıdır.
- Kendi mesajlarına (echo) ve WhatsApp teslimat bildirimlerine (statuses) cevap yazılmaz.
- Secret'lar yalnızca GitHub Secrets ve Cloudflare'de durur; toml'a, koda, yedeğe, tarayıcıya girmez.

## Testler

```bash
npm test                # kök: uygulama + worker testleri (worker D1'i node:sqlite ile taklit eder)
npx wrangler dev        # yerel Worker (D1 yerel kopya, .dev.vars)
```
