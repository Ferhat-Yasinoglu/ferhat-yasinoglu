#!/usr/bin/env python3
"""Uretilen kartlari dogrular.

Beklenen dosyalar yerinde mi ve her SVG ayristirilabiliyor mu diye bakar.
Kartlar elle duzenlenen bir sablondan degil, string birlestirerek uretiliyor;
kacan bir tirnak ya da kapanmayan bir etiket ancak tarayicida fark edilirdi.

Kullanim: python3 .github/scripts/check-cards.py <klasor>
"""

import sys
from pathlib import Path
from xml.dom.minidom import parse

ZORUNLU = ["header.svg", "footer.svg", "terminal.svg", "languages.svg", "stats.svg", "activity.svg"]


def main(argv):
    if len(argv) != 2:
        print(__doc__)
        return 2

    klasor = Path(argv[1])
    svgler = sorted(klasor.glob("*.svg"))
    if not svgler:
        print(f"hata: {klasor} icinde hic SVG yok")
        return 1

    adlar = {yol.name for yol in svgler}
    eksik = [ad for ad in ZORUNLU if ad not in adlar]
    if eksik:
        print("hata: uretilmeyen kartlar: " + ", ".join(eksik))
        return 1
    if not any(ad.startswith("icon-") for ad in adlar):
        print("hata: hic ikon karti uretilmedi")
        return 1

    for yol in svgler:
        try:
            belge = parse(str(yol))
        except Exception as hata:
            print(f"hata: {yol.name} ayristirilamadi: {hata}")
            return 1
        if belge.documentElement.tagName != "svg":
            print(f"hata: {yol.name} kok ogesi <svg> degil")
            return 1

    print(f"{len(svgler)} kart dogrulandi")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
