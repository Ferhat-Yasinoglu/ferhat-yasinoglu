# Eczane Yönetim

İlaç stoğu, hasta kayıtları ve reçete takibi için çerçevesiz, derleme adımsız bir PWA.
Bütün veriler tarayıcıda (IndexedDB) durur: sunucu yok, hesap yok, hiçbir kayıt
cihazdan çıkmaz. İnternet olmadan da tam çalışır.

**Neden böyle:** Hasta verisi hassas veri. En güvenli sunucu, olmayan sunucudur —
bu yüzden veri cihazda tutulur ve tek güvence yedektir. Uygulama yedek almayı
hatırlatır, yedek tek JSON dosyasıdır.

## Çalıştırma

```bash
cd eczane
npm install          # yalnız geliştirme bağımlılıkları (vitest, fake-indexeddb)
npm run sun          # http://localhost:8788/  — uygulama app/ klasöründen sunulur
npm test             # alan mantığı, depo, stok ve yedek testleri
npm run kontrol      # statik denetimler (mantıksal CSS, innerHTML yok, saf modüller)
npm run deneme       # gerçek tarayıcıda uçtan uca deneme (playwright kuruluysa)
```

Tarayıcıda `?nosw=1` ile service worker atlanır (yerel geliştirmede önbellek karışmasın).

`npm run deneme` playwright ister; proje bağımlılığı değildir (tarayıcı indirmesi ağır),
kurulu değilse betik kendini atlar:
`npm i -D playwright && npx playwright install chromium`.

## Ne yapar

| Bölüm | İçerik |
|---|---|
| **Panel** | Stok uyarıları, son kullanma tarihi yaklaşanlar, bekleyen reçeteler, sayaçlar |
| **İlaçlar** | Künye, barkod, etken madde, fiyat, raf; stok ve SKT uyarıları; muadil bulma |
| **Stok hareketleri** | Mal girişi, iade, sayım düzeltmesi, fire — her değişiklik geçmişe yazılır |
| **Hastalar** | Kayıt, alerjiler, kronik hastalıklar, sürekli ilaçlar, reçete geçmişi |
| **Ayarlar** | Yedek al/geri yükle, örnek veri, depolama durumu, tema, tüm veriyi silme |

**Stok yalnız hareketle değişir.** İlaç kartındaki stok alanı elle düzenlenmez;
mal girişi, sayım, fire ya da reçete karşılama üzerinden değişir ve her işlem
öncesi/sonrası stoğuyla birlikte kaydedilir. "Stok neden 3'e düştü?" sorusunun
cevabı her zaman kayıtlıdır. Stoğu eksiye düşüren işlem reddedilir.

## Yapılacaklar

- [x] İskelet: depo, yönlendirici, tema, bileşenler
- [x] İlaçlar ve stok hareketleri
- [x] Hastalar
- [ ] Reçete yazma (hasta + ilaç satırları, alerji ve stok uyarıları)
- [ ] Reçete karşılama: satır satır "verildi / verilmedi", stoğa otomatik düşme
- [ ] Reçete yazdırma (A4/A5)

## Dosyalar

```
app/                      PWA (statik olarak olduğu gibi sunulur)
  index.html sw.js manifest.webmanifest
  css/                    tokenlar · bilesenler · uygulama · yazdirma
  js/
    uygulama.js           giriş: depo, menü, arama, yönlendirici
    cekirdek/             dom · yonlendirici · modal · bildirim · simge · tema
    depo/                 sema · depo · idb · stok · yedek · ornek
    paylasilan/           saf alan mantığı: ilac · hasta · recete · tarih · metin · kimlik
    sayfalar/             panel · ilaclar · ilac · hastalar · hasta · ayarlar · bulunamadi
test/                     vitest
tools/                    sun (statik sunucu) · kontrol (statik denetim) · tarayici (uçtan uca)
```

### Kurallar

- `paylasilan/` saf kalır: DOM yok, depo yok, `node:` yok. Testler buradan başlar.
- `innerHTML` kullanılmaz; her metin `textContent` üzerinden yazılır.
- CSS'te yalnız mantıksal yön özellikleri (`inset-inline-start`, `margin-inline`…).
- Sayfa modülü sözleşmesi: `export default { baslik, cizim(kok, ctx) → temizleyici|void }`.
- Kayıtlar zarflıdır: `id, rev, olusturuldu, guncellendi, silindi`. Silme mezar taşıdır —
  yedek geri yüklenirken silinmiş kayıt dirilmesin diye.

## Sınırlar

- **e-Reçete / Medula entegrasyonu yoktur.** Resmî kurum kimliği gerektirir. Bu uygulama
  kendi içinde çalışan bir kayıt ve takip sistemidir; çıktısı yazdırılabilir reçetedir.
- Veri tek cihazdadır. Başka cihaza geçmek için yedek dosyası taşınır.
- Tarayıcı verisi temizlenirse kayıtlar silinir. Düzenli yedek şart.
- Yedek dosyası şifresiz JSON'dur ve hasta bilgisi içerir; güvenli bir yerde saklanmalı.
