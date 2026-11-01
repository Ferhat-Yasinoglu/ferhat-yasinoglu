# Kartlarin yazi tipleri

Kartlar `<img>` olarak gosterildigi icin dis yazi tipi yukleyemez; bu dosyalar
her karta, yalnizca o kartta gecen harflere indirgenmis (subset) woff2 olarak
`@font-face` icinde gomulur (`../seyir/fontlar.mjs`, `../subset.py`).

| Dosya | Yazi tipi | Lisans |
|---|---|---|
| `instrument-serif-*.woff2` | Instrument Serif (duz ve italik; latin + latin-ext) | SIL OFL 1.1, `InstrumentSerif-OFL.txt` |
| `geist-latin.woff2` | Geist (degisken agirlik) | SIL OFL 1.1, `Geist-OFL.txt` |
| `geistmono-latin.woff2` | Geist Mono (degisken agirlik) | SIL OFL 1.1, `GeistMono-OFL.txt` |
| `vazirmatn-arabic.woff2` | Vazirmatn (Dari adlari icin) | SIL OFL 1.1, `Vazirmatn-OFL.txt` |

Kaynak: fy-ajans ve fy-merkez depolarinin `fonts/` klasorleri (ayni dosyalar).
