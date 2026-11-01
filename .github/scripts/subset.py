#!/usr/bin/env python3
"""Kartlara gomulecek yazi tiplerini indirger (subset).

Girdi (stdin, JSON): [{"file": "fonts/x.woff2", "text": "kartta gecen harfler"}, ...]
Cikti (stdout, JSON): ayni sirada, her is icin base64 woff2 ya da null
(yazi tipinde o harflerden hicbiri yoksa).

Kartlar <img> ile gosterildigi icin dis yazi tipi yukleyemez; her kart kendi
harflerini tasir. Ayni (dosya, harfler) cifti bir kez indirgenir. Cikti
belirleyicidir (zaman damgasi yenilenmez): icerik degismeyen kart ayni bayt
olarak yazilir ve is akisi bos commit atmaz.

Gereken: pip install fonttools brotli
"""

import base64
import io
import json
import sys

from fontTools import subset
from fontTools.ttLib import TTFont


def indirge(dosya, metin, onbellek):
    anahtar = (dosya, metin)
    if anahtar in onbellek:
        return onbellek[anahtar]
    font = TTFont(dosya, recalcTimestamp=False)  # kaydederken head.modified "simdi" olmasin
    cmap = font.getBestCmap()
    kodlar = sorted({ord(c) for c in metin if ord(c) in cmap})
    if not kodlar:
        onbellek[anahtar] = None
        return None
    secenek = subset.Options()
    secenek.flavor = "woff2"
    secenek.layout_features = ["*"]  # Dari'de harf baglantilari (init/medi/fina) icin sart
    secenek.hinting = False
    secenek.desubroutinize = True
    secenek.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    secenek.recalc_timestamp = False
    alt = subset.Subsetter(secenek)
    alt.populate(unicodes=kodlar)
    alt.subset(font)
    tampon = io.BytesIO()
    font.flavor = "woff2"
    font.save(tampon)
    sonuc = {
        "b64": base64.b64encode(tampon.getvalue()).decode("ascii"),
        "kodlar": kodlar,
    }
    onbellek[anahtar] = sonuc
    return sonuc


def main():
    isler = json.load(sys.stdin)
    onbellek = {}
    cikti = [indirge(i["file"], i["text"], onbellek) for i in isler]
    json.dump(cikti, sys.stdout)


if __name__ == "__main__":
    main()
