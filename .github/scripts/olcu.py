#!/usr/bin/env python3
"""Gomulu yazi tiplerinin harf genisliklerini seyir/olcu.json'a yazar.

Kartlar metni ortalarken, cip genisligini hesaplarken ve satir kirarken bu
tabloyu kullanir (yazi tipi gomulu oldugu icin olcu tarayicidakiyle ayni).
Yalnizca fonts/ degisince yeniden calistirilir: python3 olcu.py
Degisken yazi tiplerinde varsayilan eksen (wght 400) olculur.
"""
import json
from pathlib import Path
from fontTools.ttLib import TTFont

BURA = Path(__file__).parent
AILE = {
    "serif": ["instrument-serif-latin.woff2", "instrument-serif-latin-ext.woff2"],
    "it": ["instrument-serif-italic-latin.woff2", "instrument-serif-italic-latin-ext.woff2"],
    "sans": ["geist-latin.woff2"],
    "mono": ["geistmono-latin.woff2"],
    "fa": ["vazirmatn-arabic.woff2"],
}
cikti = {}
for aile, dosyalar in AILE.items():
    gen = {}
    for d in dosyalar:
        f = TTFont(BURA / "fonts" / d)
        upm = f["head"].unitsPerEm
        hmtx = f["hmtx"]
        for kod, glif in f.getBestCmap().items():
            ch = chr(kod)
            if ch not in gen:
                gen[ch] = round(hmtx[glif][0] / upm, 4)
    ort = round(sum(gen[c] for c in "etaoinshrdlucmfwyp") / 18, 4) if "e" in gen else 0.5
    cikti[aile] = {"ort": ort, "g": gen}
(BURA / "seyir" / "olcu.json").write_text(json.dumps(cikti, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print({k: (v["ort"], len(v["g"])) for k, v in cikti.items()})
