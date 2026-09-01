#!/usr/bin/env python3
"""GitHub avatarini ASCII izgaraya cevirip assets/portrait.json'a yazar.

Neden ayri bir script: cards.mjs sifir bagimlilikla calisiyor ve Node'da JPEG
cozucu yok. Avatar da nadiren degistigi icin ASCII'yi her kart uretiminde
yeniden hesaplamanin anlami yok -- bir kez uretilip depoda veri olarak durur,
cards.mjs onu okuyup SVG'ye cizer.

Avatarini degistirdiginde tek komut:

    pip install pillow && python3 .github/scripts/portrait.py

Cikti bicimi: her hucre icin bir rampa karakteri (parlaklik) ve bir palet
indeksi (renk). Renkler 64 renge indirgenip satir basina tek dizgede
tutuluyor; boylece dosya ~20 KB'da kaliyor.
"""

import json
import os
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps

LOGIN = os.environ.get("GH_LOGIN", "Ferhat-Yasinoglu")
COLS = 130
ROWS = 78  # hucre orani 0.6 -> kare bir avatar bu oranda kare gorunur
RAMP = " .:-=+*#%@"
PALET = 64
# Palet indekslerini tek karaktere sigdiran alfabe (PALET ile ayni uzunlukta).
ALFABE = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/"

KOK = Path(__file__).resolve().parents[2]
CIKTI = KOK / "assets" / "portrait.json"


def avatar(login):
    # 400 px avatar'in en buyuk makul boyutu; kucultmeyi biz yapiyoruz.
    url = f"https://avatars.githubusercontent.com/{login}?size=400"
    istek = urllib.request.Request(url, headers={"User-Agent": "portrait.py"})
    with urllib.request.urlopen(istek, timeout=30) as r:
        return Image.open(BytesIO(r.read())).convert("RGB")


def main():
    im = avatar(LOGIN).resize((COLS, ROWS), Image.LANCZOS)

    # Karakteri parlakliktan sec: autocontrast olmadan koyu avatarlar tumuyle
    # bosluga dusuyor.
    lum = ImageOps.autocontrast(im.convert("L")).load()

    # Rengi ayri tut: 64 renge indirgemek dosyayi kucultuyor, goze fark etmiyor.
    kucuk = im.quantize(colors=PALET, method=Image.MEDIANCUT)
    ham = kucuk.getpalette()[: PALET * 3]
    palet = ["#%02x%02x%02x" % tuple(ham[i * 3 : i * 3 + 3]) for i in range(PALET)]
    idx = kucuk.load()

    chars, colors = [], []
    for y in range(ROWS):
        chars.append("".join(RAMP[min(len(RAMP) - 1, lum[x, y] * len(RAMP) // 256)]
                             for x in range(COLS)))
        colors.append("".join(ALFABE[idx[x, y]] for x in range(COLS)))

    CIKTI.write_text(
        json.dumps(
            {
                "login": LOGIN,
                "cols": COLS,
                "rows": ROWS,
                "alfabe": ALFABE,
                "palet": palet,
                "chars": chars,
                "colors": colors,
            },
            indent=1,
        )
        + "\n",
        encoding="utf8",
    )
    print(f"yazildi: assets/portrait.json ({CIKTI.stat().st_size} bayt)")


if __name__ == "__main__":
    main()
