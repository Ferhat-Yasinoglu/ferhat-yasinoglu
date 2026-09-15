#!/usr/bin/env node
// GitHub profilindeki animasyonlu SVG kartlarini uretir.
// Veriyi GitHub GraphQL API'sinden ceker, assets/ altina SVG yazar.
// Yerel deneme icin: node cards.mjs --mock

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

// Varsayilan hedef depodaki assets/. CI'da ornek veriyle deneme yaparken
// --out ile gecici bir klasore yazilir, boylece gercek kartlar bozulmaz.
const outFlag = process.argv.indexOf("--out");
const outArg = outFlag > -1 ? process.argv[outFlag + 1] : null;
if (outFlag > -1 && (!outArg || outArg.startsWith("--"))) {
  throw new Error("--out bir klasor yolu bekliyor");
}
const OUT = outArg ? resolve(outArg) : join(ROOT, "assets");

// simple-icons'tan bir kez cikarilmis marka logolari (24x24 viewBox yollari).
const ICONS = JSON.parse(await readFile(join(HERE, "icons.json"), "utf8"));

// FY ajans logosu (fy-ajans deposundaki tools/build-logo.mjs uretir; buraya kopyalanir).
// Baslik kartinin sagindaki koyu rozette ic ice <svg> olarak gomulur: kendi animasyonlari
// (gezen isik, ag dugumleri, goz) ve reduced-motion kurali dosyanin icinde gelir.
const FY_LOGO = await readFile(join(HERE, "fy-logo.svg"), "utf8");

// Terminal kartinin solundaki portre. Kaynak fotograf depoda durmuyor; buradaki
// dosya onun islenmis hali ve su islemlerden gecti (sharp):
//   extract({ left: 125, top: 258, width: 440, height: 560 })  -- yuze sikica kirpma
//   greyscale().normalise().linear(1.15, -14)                  -- teni yukari, saci asagi
//   radyal vinyetle carpma (cx .46, cy .44, r .72)             -- gun batimi gokyuzunu sondur
//   normalise().linear(1.12, -6).resize(300, 382)
// Vinyet sart: fotografta arka plan yuzden parlak, duz cevrilirse portre kendi
// arka plani icinde kayboluyor. Altin duotone ve tarama cizgisi SVG tarafinda.
const PORTRE = (await readFile(join(HERE, "portre.png"))).toString("base64");

// FY - Yapay Zeka Ajansi paleti. Degerler ajansin kendi tasarim
// sisteminden (fy-ajans/css/style.css tokenlari) birebir aliniyor:
// sicak siyah zemin, krem metin, altin vurgu.
// Vurgu tonlari ayri renkler degil, kremden koyu altina inen tek bir
// merdiven: kartlardaki ogeleri birbirinden ayirmaya yetiyor ama
// hicbiri markanin disina cikmiyor.
const FY = {
  bg: "#15120b", // ink-2, kart gradyaninin ustu
  bg2: "#070604", // ink-0, dibi
  line: "#d4af37", // altin hat
  text: "#f4ecd8", // krem
  muted: "#9b8f72", // soluk krem
  krem: "#f4ecd8",
  sampanya: "#e8d9a8",
  parlak: "#f5d76e", // parlak altin
  altin: "#d4af37", // marka altini
  bronz: "#c08a3e",
  derin: "#a9821e", // koyu altin
};


// Kart uretilirken gecerli olan palet. Her tema turunde degistirilir.
let T = FY;
let SAYFA_KOYU = true; // ikon tiles saydam: sayfa temasina gore renk uyarlama

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c])
  );

const short = (n) =>
  n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n);

const FONT = "'Segoe UI', Ubuntu, 'Helvetica Neue', Helvetica, sans-serif";
const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

// Her kartin basinda duran ortak stil. Kartlar artik cam degil: duz siyah
// zemin, sac teli altin kenar, uzerinde soluk bir izgara -- bir baski devre
// karti gibi. Kose yaricapi da buyuk olcude dusuruldu.
const baseStyle = () => `
    text { font-family: ${FONT}; }
    .card-bg { fill: ${T.bg2}; stroke: ${T.altin}; stroke-opacity: .3; stroke-width: 1; }
    /* Her animasyon "backwards" ile kurulur: animasyon hic calismazsa
       ogenin dogal hali gecerli olur, yani icerik yine de gorunur. */
    .rise { animation: rise .7s cubic-bezier(.2,.7,.3,1) backwards; }
    @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: .01ms !important; animation-delay: 0s !important; }
    }`;

// Soluk altin izgara. README'de kartlar ayni sayfada yan yana duruyor ve
// <img> ile gomulse bile id'ler kart icinde benzersiz olmali; her cagri
// kendi onekini veriyor.
const izgaraDef = (on) => `
    <pattern id="${on}izg" width="36" height="36" patternUnits="userSpaceOnUse">
      <path d="M36 0 H0 V36" fill="none" stroke="${T.altin}" stroke-opacity=".06" stroke-width="1" />
    </pattern>`;

const zemin = (on, W, H, r = 4) => `
  <rect class="card-bg" width="${W}" height="${H}" rx="${r}" />
  <rect width="${W}" height="${H}" rx="${r}" fill="url(#${on}izg)" />`;

// Dik acili bakir izler, donuslerinde lehim pedleri, uzerlerinde gezen isik.
// mpath hem href hem xlink:href tasiyor; eski WebKit yalnizca ikincisini
// taniyor. xlink ad alani kartlarin kok <svg> etiketinde tanimli.
function izler(on, yollar) {
  const cizgi = yollar
    .map(
      (y, i) => `
  <path id="${on}y${i}" d="${y.d}" fill="none" stroke="${T.altin}" stroke-opacity=".32" stroke-width="1.4" />
  <circle r="2.8" fill="${T.parlak}" opacity="0">
    <animateMotion dur="${y.sure}s" begin="${y.gec}s" repeatCount="indefinite" calcMode="linear">
      <mpath href="#${on}y${i}" xlink:href="#${on}y${i}" />
    </animateMotion>
    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.12;.88;1"
             dur="${y.sure}s" begin="${y.gec}s" repeatCount="indefinite" />
  </circle>`
    )
    .join("");
  const ped = yollar
    .flatMap((y) => y.ped || [])
    .map(([x, yy]) => `<rect x="${x - 3}" y="${yy - 3}" width="6" height="6" fill="${T.altin}" fill-opacity=".5" />`)
    .join("");
  return cizgi + ped;
}

// Kok <svg> etiketi: xlink ad alani mpath icin gerekli, bildirilmezse
// tarayici SVG'yi XML olarak ayristirirken hata verir ve kart hic cizilmez.
const svgKok = (W, H, etiket) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
  `width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(etiket)}">`;

// ---------------------------------------------------------------- baslik

// Baslik karti "devre" dilinin en genis ornegi: kenarlardan giren bakir
// izler, izler uzerinde gezen isik, sagda altin halka icinde FY logosu.
// Logo dosyasinin kok <svg> etiketi soyulup viewBox'i korunarak ic ice
// yerlestiriliyor; id'leri "m" onekli oldugundan kartin id'leriyle cakismaz.
function fyMark(cx, cy, r, w, h) {
  const vb = /viewBox="([^"]+)"/.exec(FY_LOGO)[1];
  const inner = FY_LOGO.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return `
    <g class="halka">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${T.altin}" stroke-opacity=".55" stroke-width="1.4" />
      <circle cx="${cx}" cy="${cy}" r="${r + 8}" fill="none" stroke="${T.altin}" stroke-opacity=".2"
              stroke-width="1" stroke-dasharray="2 9" />
      <svg x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" viewBox="${vb}"
           preserveAspectRatio="xMidYMid meet">${inner}</svg>
    </g>`;
}

function header({ name, tagline }) {
  const W = 1000;
  const H = 300;
  const on = "h";
  const yollar = [
    { d: "M0 92 H140 V46 H300 V120 H452", sure: 6, gec: 0, ped: [[140, 46], [300, 120]] },
    { d: "M0 176 H96 V214 H262 V150 H452", sure: 7.7, gec: 0.9, ped: [[96, 214], [262, 150]] },
    { d: "M0 258 H196 V236 H360 V262 H452", sure: 9.4, gec: 1.8, ped: [[196, 236], [360, 262]] },
    { d: "M1000 60 H880 V128 H700", sure: 8.1, gec: 2.7, ped: [[880, 128]] },
    { d: "M1000 246 H842 V186 H700", sure: 6.8, gec: 3.6, ped: [[842, 186]] },
  ];

  return `${svgKok(W, H, name)}
  <defs>
    ${izgaraDef(on)}
    <radialGradient id="${on}hale" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="${T.altin}" stop-opacity=".30" />
      <stop offset="1" stop-color="${T.altin}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="${on}ad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${T.krem}" />
      <stop offset="1" stop-color="${T.parlak}" />
    </linearGradient>
    <clipPath id="${on}kirp"><rect width="${W}" height="${H}" rx="4" /></clipPath>
    <style>${baseStyle()}
      .gir { animation: gir .8s cubic-bezier(.2,.7,.3,1) backwards; }
      @keyframes gir { from { opacity: 0; transform: translateX(-14px); } }
      .halka { animation: nefes 9s ease-in-out infinite; transform-origin: 806px 150px; }
      @keyframes nefes { 0%,100% { transform: scale(1); opacity: .85; } 50% { transform: scale(1.03); opacity: 1; } }
      .etiket { font-size: 13px; font-weight: 700; fill: ${T.altin}; letter-spacing: 4.5px; }
      .ad { font-size: 60px; font-weight: 800; letter-spacing: -1.4px; }
      .slogan { font-size: 19px; fill: ${T.muted}; }
    </style>
  </defs>
  <g clip-path="url(#${on}kirp)">
    ${zemin(on, W, H)}
    <circle cx="806" cy="150" r="190" fill="url(#${on}hale)" />
    ${izler(on, yollar)}
    <g class="gir"><text class="etiket" x="56" y="98">FY · YAPAY ZEKÂ AJANSI</text></g>
    <g class="gir" style="animation-delay:.1s"><text class="ad" x="54" y="170" fill="url(#${on}ad)">${esc(name)}</text></g>
    <g class="gir" style="animation-delay:.2s"><text class="slogan" x="56" y="212">${esc(tagline)}</text></g>
    ${fyMark(806, 150, 104, 168, 136)}
  </g>
</svg>
`;
}

// ------------------------------------------------------------------ dalga

// Sayfayi kapatan serit. Eskiden bir deniz dalgasiydi; artik devrenin
// veri yolu: yatay izler, uzerlerinde akan isik ve iki ucta soluklasan
// altin bir hat. Zemin saydam, GitHub'in kendi sayfa rengi goruniyor.
function footer() {
  const W = 1000;
  const H = 120;
  const on = "f";
  const yollar = [
    { d: "M0 30 H300 V58 H620 V30 H1000", sure: 9, gec: 0, ped: [[300, 58], [620, 30]] },
    { d: "M0 70 H180 V44 H420 V78 H760 V56 H1000", sure: 12, gec: 1.4, ped: [[180, 44], [420, 78], [760, 56]] },
    { d: "M0 96 H520 V72 H840 V96 H1000", sure: 10.5, gec: 2.8, ped: [[520, 72], [840, 96]] },
  ];

  return `${svgKok(W, H, "")}
  <defs>
    <linearGradient id="${on}hat" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${T.altin}" stop-opacity="0" />
      <stop offset=".2" stop-color="${T.altin}" stop-opacity=".75" />
      <stop offset=".8" stop-color="${T.altin}" stop-opacity=".75" />
      <stop offset="1" stop-color="${T.altin}" stop-opacity="0" />
    </linearGradient>
    <mask id="${on}sonum">
      <rect width="${W}" height="${H}" fill="url(#${on}hat)" />
    </mask>
    <style>${baseStyle()}</style>
  </defs>
  <g mask="url(#${on}sonum)">${izler(on, yollar)}</g>
  <rect x="0" y="110" width="${W}" height="1.6" fill="url(#${on}hat)" />
</svg>
`;
}

// ------------------------------------------------------------------ terminal

// Iki sutun: solda portre, sagda yazilan satirlar. Komut satirlari harf harf
// yazilir, ciktilar beliriverir; tum dizi bitince bastan baslar.
// Portre altin duotone (feColorMatrix) ve yatay tarama cizgisi maskesiyle
// veriliyor; uzerinden asagi dogru surekli bir tarama bandi geciyor.
//
// Gercek ASCII (karakter) denendi ve birakildi: SVG icinde karakter hizasi
// yazi tipine bagli, farkli tarayicida portre dagiliyor. Rect tabanli tarama
// maskesi her yerde ayni cikiyor.
function terminal(satirlar) {
  const on = "t";
  const PW = 300;   // portre paneli
  const PH = 382;
  const PX = 28;
  const PY = 66;
  const METX = PX + PW + 32; // metin sutununun sol kenari
  const satirH = 29;
  const ustBosluk = 78;
  const size = 17;
  const charW = size * 0.6;
  const bekle = 4.5; // dizi bitince ekranda kalma suresi

  const enUzun = Math.max(...satirlar.map((s) => [...s.metin].length + 2));
  const W = METX + Math.round(enUzun * charW) + 28;
  const H = ustBosluk + satirlar.length * satirH + 34;

  // Her satirin baslangic ani: komutlar yazilma suresince, ciktilar kisa.
  let t = 0.5;
  const zaman = satirlar.map((s) => {
    const sure = s.tip === "komut" ? [...s.metin].length * 0.055 : 0.25;
    const bas = t;
    t += sure + (s.tip === "komut" ? 0.45 : 0.2);
    return { bas, sure };
  });
  const dongu = t + bekle;
  const at = (s) => Math.max(0, Math.min(1, s / dongu));

  const govde = satirlar
    .map((s, i) => {
      const { bas, sure } = zaman[i];
      const y = ustBosluk + i * satirH;
      const metin = (s.tip === "komut" ? "$ " : "  ") + s.metin;
      const w = ([...metin].length * charW + 6).toFixed(1);
      const renk = s.tip === "komut" ? T.text : s.renk || T.muted;

      if (s.tip === "komut") {
        return `
    <clipPath id="${on}k${i}"><rect x="0" y="${y - 16}" width="0" height="22">
      <animate attributeName="width" values="0;0;${w};${w};0"
               keyTimes="0;${at(bas)};${at(bas + sure)};${at(dongu - 0.05)};1"
               dur="${dongu.toFixed(2)}s" repeatCount="indefinite" />
    </rect></clipPath>
    <g clip-path="url(#${on}k${i})">
      <text class="tr" x="0" y="${y}" fill="${renk}">${esc(metin)}</text>
    </g>`;
      }
      return `
    <g opacity="0">
      <animate attributeName="opacity" values="0;0;1;1;0"
               keyTimes="0;${at(bas)};${at(bas + sure)};${at(dongu - 0.05)};1"
               dur="${dongu.toFixed(2)}s" repeatCount="indefinite" calcMode="linear" />
      <text class="tr" x="0" y="${y}" fill="${renk}">${esc(metin)}</text>
    </g>`;
    })
    .join("");

  // Imlec, tamamlanan son satirin sonuna zipliyor.
  const durak = satirlar.map((s, i) => {
    const metin = (s.tip === "komut" ? "$ " : "  ") + s.metin;
    return {
      bitis: at(zaman[i].bas + zaman[i].sure),
      x: [...metin].length * charW,
      y: ustBosluk + i * satirH,
    };
  });
  const imlecKey = ["0", ...durak.map((d) => d.bitis.toFixed(4)), "1"].join(";");
  const imlecX = [0, ...durak.map((d) => d.x.toFixed(1)), durak.at(-1).x.toFixed(1)].join(";");
  const imlecY = [durak[0].y, ...durak.map((d) => d.y), durak.at(-1).y].map((y) => y + 10).join(";");
  const pim = [0, 1, 2]
    .map((i) => `<rect x="${24 + i * 14}" y="22" width="7" height="7" fill="${T.altin}" fill-opacity="${0.75 - i * 0.2}" />`)
    .join("");

  const ozet = `Farhad Yaqoobi · ${satirlar.map((s) => s.metin).join(" · ")}`;

  return `${svgKok(W, H, ozet)}
  <defs>
    ${izgaraDef(on)}
    <!-- Gri portreyi altina cevirir: kirmizi kanal krem, yesil altin, mavi kisik. -->
    <filter id="${on}duo" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="0.96 0 0 0 0.03  0.78 0 0 0 0.02  0.30 0 0 0 0.01  0 0 0 1 0" />
    </filter>
    <pattern id="${on}tara" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="2" fill="#ffffff" />
    </pattern>
    <mask id="${on}cizgi"><rect width="${PW}" height="${PH}" fill="url(#${on}tara)" /></mask>
    <linearGradient id="${on}band" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${T.parlak}" stop-opacity="0" />
      <stop offset=".5" stop-color="${T.parlak}" stop-opacity=".5" />
      <stop offset="1" stop-color="${T.parlak}" stop-opacity="0" />
    </linearGradient>
    <clipPath id="${on}pan"><rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" /></clipPath>
    <style>${baseStyle()}
      .tr { font-family: ${MONO}; font-size: ${size}px; }
      .baslik { font-size: 12px; fill: ${T.altin}; fill-opacity: .8; font-family: ${MONO}; letter-spacing: 1.4px; }
      .ad { font-size: 11px; fill: ${T.altin}; font-family: ${MONO}; letter-spacing: 2.6px; }
      .imlec { animation: blink 1.05s steps(1) infinite; }
      @keyframes blink { 0%,50% { opacity: 1; } 50.01%,100% { opacity: 0; } }
      .tarayici { animation: kay 6s linear infinite; }
      @keyframes kay { from { transform: translateY(${PY - 40}px); } to { transform: translateY(${PY + PH}px); } }
    </style>
  </defs>
  ${zemin(on, W, H)}
  ${pim}
  <text class="baslik" x="${W / 2}" y="31" text-anchor="middle">farhad@fy ~</text>
  <line x1="0" y1="48" x2="${W}" y2="48" stroke="${T.altin}" stroke-opacity=".38" stroke-width="1" />

  <!-- Yalniz href: <image> icin butun guncel tarayicilarda calisiyor ve
       base64'u iki kez gomersek kart 100 KB birden sisiyor. -->
  <image x="${PX}" y="${PY}" width="${PW}" height="${PH}" filter="url(#${on}duo)" mask="url(#${on}cizgi)"
         href="data:image/png;base64,${PORTRE}" />
  <g clip-path="url(#${on}pan)">
    <rect class="tarayici" x="${PX}" y="0" width="${PW}" height="40" fill="url(#${on}band)" />
  </g>
  <rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" fill="none" stroke="${T.altin}" stroke-opacity=".45" />
  <rect x="${PX - 3}" y="${PY - 3}" width="6" height="6" fill="${T.altin}" fill-opacity=".6" />
  <rect x="${PX + PW - 3}" y="${PY + PH - 3}" width="6" height="6" fill="${T.altin}" fill-opacity=".6" />
  <path d="M${PX + PW} ${PY + PH / 2} H${METX - 16}" stroke="${T.altin}" stroke-opacity=".32" stroke-width="1.4" fill="none" />
  <text class="ad" x="${PX}" y="${PY + PH + 22}">FARHAD YAQOOBI · NRW</text>

  <g transform="translate(${METX} 0)">
    ${govde}
    <g class="imlec">
      <rect x="0" y="${durak[0].y + 10}" width="9" height="2.5" fill="${T.altin}">
        <animate attributeName="x" values="${imlecX}" keyTimes="${imlecKey}"
                 dur="${dongu.toFixed(2)}s" repeatCount="indefinite" calcMode="discrete" />
        <animate attributeName="y" values="${imlecY}" keyTimes="${imlecKey}"
                 dur="${dongu.toFixed(2)}s" repeatCount="indefinite" calcMode="discrete" />
      </rect>
    </g>
  </g>
</svg>
`;
}

// ------------------------------------------------------------------ araclar

const kanallar = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Algilanan parlaklik (WCAG bagil luminans): bir rengin zemine gore
// okunup okunmadigina karar verirken kullaniliyor.
function luminans(hex) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = kanallar(hex).map((c) => lin(c / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const karistir = (hex, hedef, oran) => {
  const h = kanallar(hedef);
  return (
    "#" +
    kanallar(hex)
      .map((c, i) => Math.round(c + (h[i] - c) * oran).toString(16).padStart(2, "0"))
      .join("")
  );
};

// Marka renkleri zemine gore okunmayabiliyor (GitHub siyah, JavaScript sari).
// Cok koyu olani acik, cok acik olani koyu tarafa cekiyoruz.
function fitColor(hex, zeminKoyu = SAYFA_KOYU) {
  const lum = luminans(hex);
  if (zeminKoyu && lum < 0.16) return karistir(hex, "#ffffff", 0.86);
  if (!zeminKoyu && lum > 0.62) return karistir(hex, "#000000", 0.3);
  return hex;
}

// Dil renkleri tek bir cubukta yan yana duruyor; hepsini beyaza cekmek
// hepsini birbirine benzetirdi. Bu yuzden yalnizca koyulari, koyulari
// oraninda aciyoruz: CSS'in moru cam zeminde okunur hale geliyor ama mor
// kaliyor. Renk hic gelmediyse kartin kisik tonuna dusuyoruz.
function dilRengi(c) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(c || "") ? c : T.muted;
  const esik = 0.22;
  const lum = luminans(hex);
  if (lum >= esik) return hex;
  return karistir(hex, "#ffffff", Math.min(0.72, ((esik - lum) / esik) * 0.8));
}

// Her logoya kendi hareketi: hepsi ayni ritimde sallanirsa cansiz duruyor.
const KARAKTER = {
  JavaScript: "nabiz",
  HTML5: "sallan",
  CSS: "nabiz",
  Firebase: "alev",
  PWA: "nabiz",
  "Node.js": "sallan",
  TypeScript: "nabiz",
  Cloudflare: "sallan",
  SQLite: "nabiz",
  MCP: "don",
  Git: "don",
  GitHub: "nabiz",
  Linux: "sallan",
  Figma: "sallan",
  Markdown: "nabiz",
  JSON: "don",
};

// Tek logoluk kucuk kart. Izgara tek parca SVG olsaydi icindeki baglantilar
// <img> olarak gosterilirken calismazdi; bu yuzden her logo ayri dosya ve
// README'de <a> ile sariliyor. Karo artik bir yonga: duz siyah, altin sac
// teli kenar, iki kosesinde lehim pedi.
function iconTile(ic) {
  const W = 92;
  const H = 108;
  const scale = 40 / 24;
  const kar = KARAKTER[ic.ad] || "nabiz";
  const renk = fitColor(ic.hex, true);
  const cx = W / 2;
  const on = "i";
  return `${svgKok(W, H, ic.ad)}
  <defs>
    ${izgaraDef(on)}
    <filter id="${on}h" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="9" />
    </filter>
    <style>${baseStyle()}
      .etk { font-size: 13px; font-weight: 600; fill: ${T.text}; }
      /* Hareket bilincli sekilde hafif: sayfada baska seyler de oynuyor,
         ikonlar dikkati calmadan yasiyor olsun. */
      .bob { animation: bob 5s ease-in-out infinite alternate; }
      @keyframes bob { from { transform: translateY(-1.5px); } to { transform: translateY(1.5px); } }
      .nabiz { animation: nabiz 4.5s ease-in-out infinite; }
      @keyframes nabiz { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
      .sallan { animation: sallan 5s ease-in-out infinite; }
      @keyframes sallan { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
      .don { animation: don 22s linear infinite; }
      @keyframes don { to { transform: rotate(360deg); } }
      .alev { animation: alev 3s ease-in-out infinite; }
      @keyframes alev {
        0%,100% { transform: scale(1) rotate(-1.5deg); }
        50% { transform: scale(1.05) rotate(1.5deg); }
      }
      .isik { animation: isik 4.5s ease-in-out infinite; }
      @keyframes isik { 0%,100% { opacity: .05; } 50% { opacity: .16; } }
    </style>
  </defs>
  ${zemin(on, W, H)}
  <rect x="10" y="10" width="5" height="5" fill="${T.altin}" fill-opacity=".45" />
  <rect x="${W - 15}" y="${H - 15}" width="5" height="5" fill="${T.altin}" fill-opacity=".45" />
  <g transform="translate(${cx} 40)">
    <circle class="isik" r="24" fill="${renk}" filter="url(#${on}h)" opacity=".1" />
    <g class="bob">
      <g class="${kar}">
        <g transform="translate(-20 -20) scale(${scale.toFixed(4)})">
          <path d="${ic.path}" fill="${renk}" />
        </g>
      </g>
    </g>
  </g>
  <text class="etk" x="${cx}" y="${H - 18}" text-anchor="middle">${esc(ic.ad)}</text>
</svg>
`;
}

// ------------------------------------------------------------------ diller

// Dil cubugu artik bir veri yolu: segmentler arasinda bosluk var, iki
// ucunda lehim pedi duruyor ve yol kartin kenarlarina kadar uzuyor.
// Segment renkleri GitHub'in dil renkleri; veri tasidiklari icin altina
// cevrilmiyorlar, yalnizca koyu zeminde okunacak kadar aciliyorlar.
function languages(langs) {
  const W = 480;
  const H = 190;
  const on = "d";
  const total = langs.reduce((s, l) => s + l.size, 0) || 1;
  const barX = 40;
  const barW = W - 80;
  const ara = 3;
  const kullanilabilir = barW - ara * Math.max(0, langs.length - 1);

  let cursor = barX;
  const segs = langs
    .map((l, i) => {
      const w = Math.max(2, (l.size / total) * kullanilabilir);
      const seg = `
    <rect x="${cursor.toFixed(1)}" y="72" width="${w.toFixed(1)}" height="10"
          fill="${dilRengi(l.color)}" class="seg" style="animation-delay:${(0.15 + i * 0.11).toFixed(2)}s" />`;
      cursor += w + ara;
      return seg;
    })
    .join("");

  const legend = langs
    .map((l, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 40 + col * 210;
      const y = 120 + row * 26;
      const pct = ((l.size / total) * 100).toFixed(1);
      return `
    <g class="rise" style="animation-delay:${(0.35 + i * 0.08).toFixed(2)}s">
      <rect x="${x}" y="${y - 9}" width="8" height="8" fill="${dilRengi(l.color)}" />
      <text class="lg" x="${x + 18}" y="${y}">${esc(l.name)}</text>
      <text class="pc" x="${x + 186}" y="${y}" text-anchor="end">${pct}%</text>
    </g>`;
    })
    .join("");

  return `${svgKok(W, H, "Most used languages")}
  <defs>
    ${izgaraDef(on)}
    <style>${baseStyle()}
      .title { font-size: 16px; font-weight: 700; fill: ${T.text}; }
      .lg { font-size: 13px; fill: ${T.text}; }
      .pc { font-size: 13px; fill: ${T.muted}; font-variant-numeric: tabular-nums; }
      .seg { transform-box: fill-box; transform-origin: left center; animation: wipe .9s cubic-bezier(.2,.7,.3,1) backwards; }
      @keyframes wipe { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      .dugum { animation: dugum 3.4s ease-in-out infinite; }
      @keyframes dugum { 0%,100% { fill-opacity: .45; } 50% { fill-opacity: 1; } }
    </style>
  </defs>
  ${zemin(on, W, H)}
  <path d="M0 34 H22" stroke="${T.altin}" stroke-opacity=".32" stroke-width="1.4" fill="none" />
  <rect class="dugum" x="24" y="30" width="8" height="8" fill="${T.altin}" />
  <text class="title" x="44" y="39">Most used languages</text>
  <path d="M0 77 H${barX - 10} M${W - barX + 10} 77 H${W}" stroke="${T.altin}" stroke-opacity=".3" stroke-width="1.4" fill="none" />
  <rect x="${barX - 9}" y="73" width="7" height="7" fill="${T.altin}" fill-opacity=".55" />
  <rect x="${W - barX + 2}" y="73" width="7" height="7" fill="${T.altin}" fill-opacity=".55" />
  ${segs}
  ${legend}
</svg>
`;
}

// ------------------------------------------------------------- sayilar

// Depo, katki ve yildiz sayilari zaten cekiliyordu ama hicbir kartta
// gorunmuyordu. Alti rakam, ucer ucer iki sira. Genislik ve yukseklik
// languages.svg ile ayni: README'de yan yana konunca ayni boyda duruyorlar.
// Her hucre kirik koseli bir yonga govdesi; solundaki pim onu veri yoluna
// baglıyor.
function stats(d) {
  const W = 480;
  const H = 190;
  const kutuW = 132;
  const kutuH = 54;
  const bosluk = 12;
  const solKenar = (W - (3 * kutuW + 2 * bosluk)) / 2;

  // "1y" olanlar GitHub'in son bir yillik katki penceresinden geliyor;
  // digerleri hesabin o anki toplami.
  const hucreler = [
    { deger: d.totalContributions, etiket: "contributions · 1y", renk: T.krem },
    { deger: d.commits, etiket: "commits · 1y", renk: T.sampanya },
    { deger: d.prs, etiket: "pull requests · 1y", renk: T.altin },
    { deger: d.repos, etiket: "public repos", renk: T.bronz },
    { deger: d.stars, etiket: "stars earned", renk: T.parlak },
    { deger: d.followers, etiket: "followers", renk: T.derin },
  ];

  const kutular = hucreler
    .map((h, i) => {
      const x = solKenar + (i % 3) * (kutuW + bosluk);
      const y = 62 + Math.floor(i / 3) * (kutuH + 12);
      const gecikme = (0.12 + i * 0.07).toFixed(2);
      const govde = `M${x + 9} ${y} H${x + kutuW} V${y + kutuH} H${x} V${y + 9} Z`;
      return `
    <g class="rise" style="animation-delay:${gecikme}s">
      <path d="${govde}" fill="${h.renk}" fill-opacity=".07" stroke="${h.renk}" stroke-opacity=".3" stroke-width="1" />
      <rect class="pim" x="${x - 4}" y="${y + kutuH / 2 - 4}" width="8" height="8" fill="${h.renk}"
            style="animation-delay:${gecikme}s" />
      <text class="num" x="${x + 16}" y="${y + 29}" fill="${h.renk}">${short(h.deger)}</text>
      <text class="etk" x="${x + 16}" y="${y + 45}">${esc(h.etiket)}</text>
    </g>`;
    })
    .join("");

  const ozet = hucreler.map((h) => `${h.deger} ${h.etiket.replace(" · 1y", "")}`).join(", ");

  return `${svgKok(W, H, `By the numbers: ${ozet}`)}
  <defs>
    ${izgaraDef("s")}
    <style>${baseStyle()}
      .title { font-size: 16px; font-weight: 700; fill: ${T.text}; }
      .num { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -.5px; }
      .etk { font-size: 11px; fill: ${T.muted}; letter-spacing: .3px; }
      .pim { transform-box: fill-box; transform-origin: center;
             animation: cikar .5s cubic-bezier(.2,.7,.3,1) backwards; }
      @keyframes cikar { from { transform: scale(0); } to { transform: scale(1); } }
      .dugum { animation: dugum 3.4s ease-in-out infinite; }
      @keyframes dugum { 0%,100% { fill-opacity: .45; } 50% { fill-opacity: 1; } }
    </style>
  </defs>
  ${zemin("s", W, H)}
  <path d="M0 34 H22" stroke="${T.altin}" stroke-opacity=".32" stroke-width="1.4" fill="none" />
  <rect class="dugum" x="24" y="30" width="8" height="8" fill="${T.altin}" />
  <text class="title" x="44" y="39">By the numbers</text>
  ${kutular}
</svg>
`;
}

// --------------------------------------------------------------- hareket

// Son 90 gunun egrisi artik bir bakir iz: altin, hafif parlayan bir hat ve
// uzerinde bastan sona akan bir isik noktasi. Egrinin sonundaki ped bugunu
// isaretliyor.
function activity(days, updatedAt) {
  const W = 820;
  const H = 200;
  const padL = 34;
  const padR = 24;
  const top = 62;
  const bottom = H - 40;
  const on = "a";
  // Yeni bir hesapta ya da API bos donerse dizi bos kalabiliyor; kart o
  // durumda cizim yaparken patlamasin diye duz bir cizgiye duserek uretiliyor.
  const son90 = days.length
    ? days.slice(-90)
    : Array.from({ length: 90 }, () => ({ date: "", count: 0 }));

  // Gunleri ikiserli kovalara topluyoruz: egri ayni kaliyor ama yol verisi
  // ucte birine iniyor. Buyuk "d" niteligi tarayicida gec cizilmeye yol aciyor.
  const pts = [];
  for (let i = 0; i < son90.length; i += 2) {
    pts.push({ count: son90.slice(i, i + 2).reduce((s, d) => s + d.count, 0) });
  }

  const max = Math.max(1, ...pts.map((p) => p.count));
  const stepX = (W - padL - padR) / Math.max(1, pts.length - 1);

  const xy = pts.map((p, i) => [
    Math.round(padL + i * stepX),
    Math.round(bottom - (p.count / max) * (bottom - top)),
  ]);

  // Yumusak egri: her nokta arasinda kubik bezier.
  let path = `M${xy[0][0]} ${xy[0][1]}`;
  for (let i = 1; i < xy.length; i++) {
    const [px, py] = xy[i - 1];
    const [cx, cy] = xy[i];
    const mx = Math.round((px + cx) / 2);
    path += `C${mx} ${py} ${mx} ${cy} ${cx} ${cy}`;
  }
  const area = `${path}L${xy.at(-1)[0]} ${bottom}L${xy[0][0]} ${bottom}Z`;

  const busiest = son90.reduce((a, b) => (b.count > a.count ? b : a), son90[0]);
  const sum = son90.reduce((s, d) => s + d.count, 0);
  const [sx, sy] = xy.at(-1);

  return `${svgKok(W, H, "Contribution graph, last 90 days")}
  <defs>
    ${izgaraDef(on)}
    <linearGradient id="${on}alan" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${T.altin}" stop-opacity=".38" />
      <stop offset="100%" stop-color="${T.altin}" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="${on}hat" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${T.derin}" />
      <stop offset="100%" stop-color="${T.parlak}" />
    </linearGradient>
    <filter id="${on}par" x="-20%" y="-60%" width="140%" height="260%">
      <feGaussianBlur stdDeviation="3" />
    </filter>
    <style>${baseStyle()}
      .title { font-size: 21px; font-weight: 700; fill: ${T.text}; }
      .meta { font-size: 16px; fill: ${T.muted}; }
      .iz { fill: none; stroke: url(#${on}hat); stroke-width: 2.4; stroke-linecap: round;
            animation: draw 2.6s .2s cubic-bezier(.4,0,.2,1) backwards; }
      @keyframes draw {
        from { stroke-dasharray: 4000; stroke-dashoffset: 4000; }
        to { stroke-dasharray: 4000; stroke-dashoffset: 0; }
      }
      .dolgu { animation: fade 1.2s 1.5s backwards; }
      .uc { animation: fade .6s 2.6s backwards; }
      .stamp { font-size: 14px; fill: ${T.muted}; animation: fade .8s 3s backwards; }
      .ping { animation: ping 2s ease-out infinite; transform-origin: center; }
      @keyframes ping { 0% { r: 4; opacity: .9; } 70%,100% { r: 13; opacity: 0; } }
      .dugum { animation: dugum 3.4s ease-in-out infinite; }
      @keyframes dugum { 0%,100% { fill-opacity: .45; } 50% { fill-opacity: 1; } }
    </style>
  </defs>
  ${zemin(on, W, H)}
  <path d="M0 38 H22" stroke="${T.altin}" stroke-opacity=".32" stroke-width="1.4" fill="none" />
  <rect class="dugum" x="24" y="33" width="8" height="8" fill="${T.altin}" />
  <text class="title" x="46" y="42">Last 90 days</text>
  <text class="meta" x="${W - 30}" y="42" text-anchor="end">${sum} contributions · busiest day ${busiest.count}</text>
  <path class="dolgu" d="${area}" fill="url(#${on}alan)" />
  <path class="iz" id="${on}egri" d="${path}" filter="url(#${on}par)" opacity=".55" />
  <path class="iz" d="${path}" />
  <circle r="3" fill="${T.parlak}" opacity="0">
    <animateMotion dur="9s" repeatCount="indefinite" calcMode="linear">
      <mpath href="#${on}egri" xlink:href="#${on}egri" />
    </animateMotion>
    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.08;.92;1" dur="9s" repeatCount="indefinite" />
  </circle>
  <g class="uc">
    <circle class="ping" cx="${sx}" cy="${sy}" r="4" fill="${T.parlak}" />
    <rect x="${sx - 4}" y="${sy - 4}" width="8" height="8" fill="${T.krem}" />
  </g>
  <text class="stamp" x="30" y="${H - 12}">updated <tspan class="tarih">${esc(updatedAt)}</tspan> · checked every 6 hours</text>
</svg>
`;
}

// ------------------------------------------------------------------ veri

const QUERY = `query($login: String!) {
  user(login: $login) {
    name login
    followers { totalCount }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
      totalCount
      nodes {
        stargazerCount
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name color } }
        }
      }
    }
  }
}`;

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

// GitHub API ara sira 5xx ya da 429 donuyor. Alti saatte bir calisan bir is
// icin tek denemede pes etmenin anlami yok: gecici hatalarda artan araliklarla
// yeniden deniyor, kalici olanlarda (401, 404) hemen biraktiriyoruz.
async function apiFetch(url, init, deneme = 4) {
  for (let i = 1; ; i++) {
    let res = null;
    let hata = null;
    try {
      res = await fetch(url, init);
    } catch (e) {
      hata = e;
    }
    if (res?.ok) return res;

    const gecici = !res || res.status === 429 || res.status >= 500;
    if (!gecici || i === deneme) {
      throw hata ?? new Error(`GitHub API ${res.status}: ${await res.text()}`);
    }
    const ms = 2 ** i * 1000;
    console.warn(
      `GitHub API ${res ? res.status : hata.message}; ${ms / 1000}s sonra yeniden (${i}/${deneme - 1})`
    );
    await bekle(ms);
  }
}

async function fetchData(login, token) {
  const res = await apiFetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));

  const u = json.data.user;
  const c = u.contributionsCollection;

  const byLang = new Map();
  for (const repo of u.repositories.nodes) {
    for (const e of repo.languages.edges) {
      const prev = byLang.get(e.node.name) || { name: e.node.name, color: e.node.color || T.muted, size: 0 };
      prev.size += e.size;
      byLang.set(e.node.name, prev);
    }
  }

  const days = c.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .map((d) => ({ date: d.date, count: d.contributionCount }));

  return {
    name: u.name?.trim() || u.login,
    totalContributions: c.contributionCalendar.totalContributions,
    commits: c.totalCommitContributions + c.restrictedContributionsCount,
    prs: c.totalPullRequestContributions,
    repos: u.repositories.totalCount,
    stars: u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0),
    followers: u.followers.totalCount,
    langs: [...byLang.values()].sort((a, b) => b.size - a.size).slice(0, 6),
    days,
  };
}

function mockData() {
  const days = Array.from({ length: 90 }, (_, i) => ({
    date: `gun-${i}`,
    count: i < 60 ? 0 : Math.round(Math.abs(Math.sin(i / 3) * 6) + (i > 85 ? 3 : 0)),
  }));
  return {
    name: "Ferhat Yasinoglu",
    totalContributions: 21,
    commits: 18,
    prs: 2,
    repos: 3,
    stars: 4,
    followers: 2,
    langs: [
      { name: "JavaScript", color: "#f1e05a", size: 62000 },
      { name: "HTML", color: "#e34c26", size: 24000 },
      { name: "CSS", color: "#563d7c", size: 12000 },
      { name: "Shell", color: "#89e051", size: 2000 },
    ],
    days,
  };
}

// ------------------------------------------------------------------ main

// GitHub profilindeki ad alani sustu harfler icerebiliyor; basligi sabit tutuyoruz.
const DISPLAY_NAME = "Farhad Yaqoobi";
const TAGLINE = "Offline-first web apps · vanilla JavaScript · bots on the edge";

const useMock = process.argv.includes("--mock");
const login = process.env.GH_LOGIN || "Ferhat-Yasinoglu";
const data = useMock ? mockData() : await fetchData(login, process.env.GITHUB_TOKEN);

const stamp = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
}).format(new Date());

// Kartlar her calismada bastan uretiliyor ama icerikleri cogu zaman ayni
// kaliyor; yalnizca zaman damgasi yuzunden commit atmak depo gecmisini ve
// kartin kendi gosterdigi katki grafigini sisiriyordu. Bu yuzden dosyaya
// ancak tarih disinda bir sey degistiyse dokunuyoruz. Karsilastirmadan
// yalnizca tarihin kendisi cikariliyor: damganin metni ya da yerlesimi
// degisirse kart yine de yenilensin.
const tarihsiz = (svg) => svg.replace(/<tspan class="tarih">[^<]*<\/tspan>/, "");

async function yazDegistiyse(file, svg) {
  const yol = join(OUT, file);
  const onceki = await readFile(yol, "utf8").catch(() => null);
  if (onceki !== null && tarihsiz(onceki) === tarihsiz(svg)) return false;
  await writeFile(yol, svg, "utf8");
  return true;
}

await mkdir(OUT, { recursive: true });

// Cam kartlar her iki GitHub temasinda ayni gorundugu icin tek surum uretilir.
{
  T = FY;
  SAYFA_KOYU = true;
  const cards = {
    "header.svg": header({ name: DISPLAY_NAME, tagline: TAGLINE }),
    ...Object.fromEntries(ICONS.map((ic) => [`icon-${ic.slug}.svg`, iconTile(ic)])),
    "footer.svg": footer(),
    "terminal.svg": terminal([
      { tip: "komut", metin: "whoami" },
      { tip: "cikti", metin: "Farhad Yaqoobi - developer, NRW", renk: T.krem },
      { tip: "komut", metin: "cat stack.txt" },
      { tip: "cikti", metin: "JavaScript - TypeScript - PWA - Node - Workers", renk: T.parlak },
      { tip: "komut", metin: "ls projects/" },
      { tip: "cikti", metin: "botflow-mcp/   acik-defter/   netstore/", renk: T.sampanya },
      { tip: "komut", metin: "cat learning.md" },
      { tip: "cikti", metin: "Cloudflare D1 - Meta Graph API - MCP", renk: T.altin },
      { tip: "komut", metin: "locale -a" },
      { tip: "cikti", metin: "de_DE   tr_TR   en_US   fa_AF", renk: T.bronz },
      { tip: "komut", metin: "echo $MOTTO" },
      { tip: "cikti", metin: "Build it to understand it", renk: T.parlak },
      { tip: "komut", metin: "tail -1 lessons.md" },
      { tip: "cikti", metin: "Code that never reached the repo is lost", renk: T.muted },
    ]),
    "languages.svg": languages(data.langs),
    "stats.svg": stats(data),
    "activity.svg": activity(data.days, stamp),
  };

  let degisen = 0;
  for (const [file, svg] of Object.entries(cards)) {
    if (await yazDegistiyse(file, svg)) {
      degisen++;
      console.log(`yazildi: ${file} (${svg.length} bayt)`);
    }
  }
  console.log(`${degisen}/${Object.keys(cards).length} kart guncellendi`);
}
