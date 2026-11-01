// Kartlara indirgenmis yazi tiplerini gomer.
//
// Her kartin <style>'inda /*@FONTS@*/ yer tutucusu var. Burada kartin <text>
// ogeleri okunur, hangi ailede hangi harflerin gectigi cikarilir ve tum
// kartlarin isleri tek bir Python cagrisiyla (subset.py, fonttools) indirgenir.
// fonttools yoksa kartlar yine uretilir, sistem yazi tiplerine dusulur.

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FONTS = join(HERE, "..", "fonts");

const AILELER = {
  serif: { ad: "FYSerif", stil: "normal", dosyalar: ["instrument-serif-latin.woff2", "instrument-serif-latin-ext.woff2"] },
  it: { ad: "FYSerif", stil: "italic", dosyalar: ["instrument-serif-italic-latin.woff2", "instrument-serif-italic-latin-ext.woff2"] },
  sans: { ad: "FYSans", stil: "normal", agirlik: "100 900", dosyalar: ["geist-latin.woff2"] },
  mono: { ad: "FYMono", stil: "normal", agirlik: "100 900", dosyalar: ["geistmono-latin.woff2"] },
  fa: { ad: "FYFa", stil: "normal", agirlik: "100 900", dosyalar: ["vazirmatn-arabic.woff2"] },
};

const varlik = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");

function aileOf(attrs) {
  const m = /class="([^"]*)"/.exec(attrs);
  const c = m ? m[1].split(/\s+/) : [];
  for (const a of ["it", "serif", "mono", "fa", "sans"]) if (c.includes(a)) return a;
  return null;
}

// Kartta aile -> harf kumesi
function harfler(svg) {
  const kume = {};
  const ekle = (aile, metin) => {
    if (!metin) return;
    (kume[aile] ||= new Set());
    for (const ch of varlik(metin)) if (ch.trim()) kume[aile].add(ch);
  };
  for (const m of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const aile = aileOf(m[1]) || "sans";
    const ic = m[2];
    // tspan'in kendi sinifi varsa onun ailesine de ekle
    for (const t of ic.matchAll(/<tspan\b([^>]*)>([^<]*)<\/tspan>/g)) {
      const ta = aileOf(t[1]);
      if (ta) ekle(ta, t[2]);
    }
    ekle(aile, ic.replace(/<[^>]+>/g, ""));
  }
  // serif ve italik ayni metinde karisabiliyor; rakam ve noktalama hep olsun
  for (const a of Object.keys(kume)) for (const ch of "0123456789.,·°") kume[a].add(ch);
  return kume;
}

const aralik = (kodlar) => {
  const r = [];
  let bas = null;
  let son = null;
  for (const k of kodlar) {
    if (bas === null) bas = son = k;
    else if (k === son + 1) son = k;
    else {
      r.push(bas === son ? `U+${bas.toString(16)}` : `U+${bas.toString(16)}-${son.toString(16)}`);
      bas = son = k;
    }
  }
  if (bas !== null) r.push(bas === son ? `U+${bas.toString(16)}` : `U+${bas.toString(16)}-${son.toString(16)}`);
  return r.join(",");
};

// kartlar: { dosyaAdi: svg } -> ayni nesne, yer tutucular doldurulmus
export function gom(kartlar) {
  const isler = [];
  const plan = {};
  for (const [ad, svg] of Object.entries(kartlar)) {
    if (!svg.includes("/*@FONTS@*/")) continue;
    const kume = harfler(svg);
    plan[ad] = [];
    for (const [aile, set] of Object.entries(kume)) {
      const A = AILELER[aile];
      if (!A) continue;
      const metin = [...set].sort().join("");
      for (const d of A.dosyalar) {
        plan[ad].push({ aile, i: isler.length });
        isler.push({ file: join(FONTS, d), text: metin });
      }
    }
  }

  let sonuc = null;
  try {
    const out = execFileSync("python3", [join(HERE, "..", "subset.py")], {
      input: JSON.stringify(isler),
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
      // fonttools bazi kumeleri Python'un karma sirasiyla geziyor; tohum
      // sabit olmazsa ayni girdi her calismada baska bayt uretiyor ve is
      // akisi her seferinde butun kartlari yeniden commit'liyor.
      env: { ...process.env, PYTHONHASHSEED: "0" },
    });
    sonuc = JSON.parse(out.toString("utf8"));
  } catch (e) {
    console.warn("uyari: yazi tipleri gomulemedi (python3 + fonttools + brotli gerekli); sistem yazi tipleri kullanilacak");
    console.warn(String(e.stderr || e.message).split("\n").slice(-3).join("\n"));
  }

  const cikti = {};
  for (const [ad, svg] of Object.entries(kartlar)) {
    if (!plan[ad]) {
      cikti[ad] = svg;
      continue;
    }
    let css = "";
    if (sonuc) {
      for (const { aile, i } of plan[ad]) {
        const r = sonuc[i];
        if (!r) continue;
        const A = AILELER[aile];
        css +=
          `@font-face{font-family:${A.ad};font-style:${A.stil};` +
          (A.agirlik ? `font-weight:${A.agirlik};` : "") +
          `unicode-range:${aralik(r.kodlar)};src:url(data:font/woff2;base64,${r.b64}) format("woff2");}`;
      }
    }
    cikti[ad] = svg.replace("/*@FONTS@*/", css);
  }
  return cikti;
}
