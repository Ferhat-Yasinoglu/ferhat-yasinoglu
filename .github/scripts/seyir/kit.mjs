// Seyir kiti: profil kartlarinin ortak tasarim dili.
//
// Kaynak: fy-ajans/docs/seyir-tasarim.md (Pusula «landing-redesign» dili).
// Siyah/altin/kopuk palet, serif basliklar, mono okuma degerleri, her bolumun
// bir pusula acisi (000° · FY, 045° · Products ...), ember kuzey ibresi,
// rota dikisi (course seam), split-flap sayaclar, kose kosebentleri.
//
// Kartlar <img> olarak gosterilir: betik yok, dis kaynak yok. Hareket CSS
// (transform ve opacity) ve SMIL ile. prefers-reduced-motion acikken CSS
// animasyonlari tek turda biter ve oge taban haline yerlesir; bu yuzden taban
// hal her zaman okunur hal olmali (animasyonlar "backwards" ile kurulur).
// SMIL donguleri (gezgin isiklari, terminal) medya sorgusundan etkilenmez;
// onlarin da taban hali gorunur.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OLCU = JSON.parse(readFileSync(join(HERE, "olcu.json"), "utf8"));

// ------------------------------------------------------------------ palet

export const S = {
  void: "#040405",
  hull: "#0a0a0c",
  deck: "#111013",
  bezel: "#1a1712",
  rule: "#2e281b",
  ruleSoft: "#1d1a13",
  goldDeep: "#6b4a12",
  goldLo: "#8c6a1e",
  gold: "#d4a840",
  goldHi: "#ffd36e",
  phosphor: "#fff1c9",
  foam: "#f7f0df",
  mist: "#bfb293",
  mistDim: "#8a7e64",
  ember: "#ff7a45",
};

// Gomulu yazi tipleri FY* adlariyla gelir (fontlar.mjs); gomulemezse yigindaki
// sistem yazi tiplerine dusulur.
export const F = {
  serif: "FYSerif, 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
  sans: "FYSans, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  mono: "FYMono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fa: "FYFa, Vazirmatn, Tahoma, sans-serif",
};

// ------------------------------------------------------------------ metin

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);

const n1 = (v) => Math.round(v * 10) / 10;
export const f1 = n1;

// Metnin genisligi (px). Harf genislikleri gomulu yazi tiplerinden olculdu
// (olcu.json); kalin agirlikta Geist biraz genisler.
export function tw(text, size, aile = "sans", { ls = 0, kalin = false } = {}) {
  const t = OLCU[aile] || OLCU.sans;
  let w = 0;
  for (const ch of String(text)) w += t.g[ch] ?? t.ort;
  w *= size;
  if (kalin && aile !== "mono") w *= 1.045;
  return w + ls * [...String(text)].length;
}

// Basit satir kirici: kelimeleri genislik dolana kadar dizer.
export function kir(text, size, maxW, aile = "sans", opt = {}) {
  const satirlar = [];
  let cur = "";
  for (const k of String(text).split(/\s+/).filter(Boolean)) {
    const dene = cur ? cur + " " + k : k;
    if (cur && tw(dene, size, aile, opt) > maxW) {
      satirlar.push(cur);
      cur = k;
    } else cur = dene;
  }
  if (cur) satirlar.push(cur);
  return satirlar;
}

// ------------------------------------------------------------------ kok

let SAYAC = 0;
export const uid = (on = "u") => `${on}${(SAYAC++).toString(36)}`;
export const sifirla = () => {
  SAYAC = 0;
};

export const kok = (W, H, etiket, ic) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
  `width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(etiket)}">\n` +
  `<title>${esc(etiket)}</title>\n${ic}\n</svg>\n`;

// Her kartin <style> blogu. /*@FONTS@*/ yerine fontlar.mjs, kartta gecen
// harflere indirgenmis @font-face kurallarini yazar.
export const stil = (ek = "") => `<style>/*@FONTS@*/
  text { font-family: ${F.sans}; }
  .serif { font-family: ${F.serif}; font-weight: 400; }
  .it { font-family: ${F.serif}; font-style: italic; font-weight: 400; }
  .sans { font-family: ${F.sans}; }
  .mono { font-family: ${F.mono}; }
  .fa { font-family: ${F.fa}; }
  .rise { animation: rise .9s cubic-bezier(.16,1,.3,1) backwards; }
  @keyframes rise { from { opacity: 0; transform: translateY(14px); } }
  .fade { animation: fade .9s ease-out backwards; }
  @keyframes fade { from { opacity: 0; } }
  .breathe { animation: breathe 4s ease-in-out infinite; }
  @keyframes breathe { 0%,100% { opacity: .45; } 50% { opacity: 1; } }
  .blink { animation: blink 1.1s steps(1) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  .twinkle { animation: twinkle 3.2s ease-in-out infinite; }
  @keyframes twinkle { 0%,100% { opacity: .25; } 50% { opacity: 1; } }
  .flow { animation: flow 2.4s linear infinite; }
  @keyframes flow { to { stroke-dashoffset: -24; } }
  .flow-r { animation: flowr 3.6s linear infinite; }
  @keyframes flowr { to { stroke-dashoffset: 24; } }
  .draw { animation: draw 1.6s cubic-bezier(.16,1,.3,1) backwards; }
  @keyframes draw { from { stroke-dashoffset: var(--len, 1000); } }
  ${ek}
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: .001ms !important; animation-delay: 0s !important; animation-iteration-count: 1 !important; }
  }
</style>`;

// ------------------------------------------------------------------ zemin

// Ust ust: void dolgu, 48px graticule (soluk altin izgara), istege bagli
// radyal parilti. Kenar: sac teli rule.
export function zemin(W, H, { r = 14, parilti = null, izgara = 48, kenar = true } = {}) {
  const g = uid("g");
  const p = uid("p");
  const h = uid("h");
  return `
  <defs>
    <linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${S.hull}" /><stop offset="1" stop-color="${S.void}" />
    </linearGradient>
    <pattern id="${p}" width="${izgara}" height="${izgara}" patternUnits="userSpaceOnUse">
      <path d="M${izgara} 0H0V${izgara}" fill="none" stroke="${S.gold}" stroke-opacity=".07" />
    </pattern>
    ${
      parilti
        ? `<radialGradient id="${h}" cx="${parilti.cx}" cy="${parilti.cy}" r="${parilti.r}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${parilti.renk || S.gold}" stop-opacity="${parilti.o ?? 0.22}" />
      <stop offset="1" stop-color="${parilti.renk || S.gold}" stop-opacity="0" />
    </radialGradient>`
        : ""
    }
  </defs>
  <rect width="${W}" height="${H}" rx="${r}" fill="url(#${g})" />
  <rect width="${W}" height="${H}" rx="${r}" fill="url(#${p})" />
  ${parilti ? `<rect width="${W}" height="${H}" rx="${r}" fill="url(#${h})" />` : ""}
  ${kenar ? `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${r - 0.5}" fill="none" stroke="${S.rule}" />` : ""}`;
}

// 10px kose L'leri (.bracketed). Guc acilisi: koseler %6 distan iceri oturur.
export function koseler(x, y, w, h, { L = 12, renk = S.gold, o = 0.85, anim = true, gec = 0 } = {}) {
  const c = (px, py, sx, sy, i) =>
    `<path d="M${px} ${py + sy * L}V${py}H${px + sx * L}" fill="none" stroke="${renk}" stroke-opacity="${o}" stroke-width="1.5"` +
    (anim
      ? ` class="kose" style="--dx:${-sx * 8}px;--dy:${-sy * 8}px;animation-delay:${gec + i * 0.05}s"`
      : "") +
    ` />`;
  return [
    c(x, y, 1, 1, 0),
    c(x + w, y, -1, 1, 1),
    c(x, y + h, 1, -1, 2),
    c(x + w, y + h, -1, -1, 3),
  ].join("");
}
export const koseStil = `.kose { animation: kose .7s cubic-bezier(.16,1,.3,1) backwards; }
  @keyframes kose { from { opacity: 0; transform: translate(var(--dx), var(--dy)); } }`;

// ------------------------------------------------------------------ isaretler

// 8 koseli yildiz (star8): pusula gulu isareti.
export function yildiz8(cx, cy, r, { renk = S.gold, rot = 0, ic = 0.38, cls = "" } = {}) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = ((i * 22.5 + rot - 90) * Math.PI) / 180;
    const rr = i % 2 === 0 ? (i % 4 === 0 ? r : r * 0.62) : r * ic;
    pts.push(`${n1(cx + rr * Math.cos(a))},${n1(cy + rr * Math.sin(a))}`);
  }
  return `<polygon ${cls ? `class="${cls}" ` : ""}points="${pts.join(" ")}" fill="${renk}" />`;
}

// 4 koseli yildiz (star4): parilti isareti.
export function yildiz4(cx, cy, r, renk = S.goldHi, cls = "") {
  const k = r * 0.22;
  return `<path ${cls ? `class="${cls}" ` : ""}d="M${cx} ${cy - r}L${n1(cx + k)} ${n1(cy - k)}L${cx + r} ${cy}L${n1(cx + k)} ${n1(cy + k)}L${cx} ${cy + r}L${n1(cx - k)} ${n1(cy + k)}L${cx - r} ${cy}L${n1(cx - k)} ${n1(cy - k)}Z" fill="${renk}" />`;
}

// Ibre: 32 birimlik kutu, pivot (16,16). Kuzey ember iki fasetli, kuyruk
// altin, pivot altin, pim gold-hi. aci derece (0 = kuzey, saat yonu).
// salin: gorunur olunca 90° geriden yayla salinir (Needle swingOnView).
export function ibre(cx, cy, boy, aci, { salin = true, gec = 0, cls = "" } = {}) {
  const s = boy / 32;
  const id = uid("n");
  const k = salin
    ? `<style>
    .${id} { transform-origin: ${cx}px ${cy}px; animation: ${id} 2.2s cubic-bezier(.3,1.4,.45,1) ${gec}s backwards; }
    @keyframes ${id} {
      0% { transform: rotate(-90deg); }
      45% { transform: rotate(9deg); }
      70% { transform: rotate(-3.5deg); }
      86% { transform: rotate(1.2deg); }
      100% { transform: rotate(0deg); }
    }</style>`
    : "";
  return `${k}<g class="${salin ? id : ""} ${cls}"><g transform="translate(${n1(cx - 16 * s)} ${n1(cy - 16 * s)}) scale(${n1(s * 1000) / 1000}) rotate(${aci} 16 16)">
    <path d="M16 2L19 16H13Z" fill="${S.ember}" />
    <path d="M16 2L16 16H13Z" fill="${S.ember}" fill-opacity=".66" />
    <path d="M13 16H19L16 29Z" fill="${S.gold}" />
    <path d="M13 16H16L16 29Z" fill="${S.goldLo}" />
    <circle cx="16" cy="16" r="2.6" fill="${S.gold}" />
    <circle cx="16" cy="16" r=".95" fill="${S.goldHi}" />
  </g></g>`;
}

// Kucuk kadran: bezel halka + 8 rüzgâr centigi + ibre.
export function kadran(cx, cy, r, aci, opt = {}) {
  let c = "";
  for (let i = 0; i < 8; i++) {
    const a = (i * 45 * Math.PI) / 180;
    const r1 = r - (i % 2 ? 2.5 : 4);
    c += `<line x1="${n1(cx + r1 * Math.sin(a))}" y1="${n1(cy - r1 * Math.cos(a))}" x2="${n1(cx + r * Math.sin(a))}" y2="${n1(cy - r * Math.cos(a))}" stroke="${S.goldLo}" stroke-width="1" />`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${S.bezel}" stroke="${S.rule}" />${c}${ibre(cx, cy, r * 1.7, aci, opt)}`;
}

// Bolum kickeri: kadran + «045° · PRODUCTS» (mono, altin, genis aralik).
export function kicker(x, y, aci, etiket, { gec = 0, renk = S.gold, boy = 13 } = {}) {
  const derece = String(aci).padStart(3, "0") + "°";
  return `<g class="rise" style="animation-delay:${gec}s">
    ${kadran(x + 12, y - 4, 12, aci, { gec: gec + 0.1 })}
    <text class="mono" x="${x + 34}" y="${y}" font-size="${boy}" letter-spacing="${(boy * 0.14).toFixed(2)}" fill="${renk}">${derece}  ·  ${esc(etiket.toUpperCase())}</text>
  </g>`;
}

// Rota dikisi (CourseSeam): 1px cizgi, solda void daire icinde rotaya donuk
// 8 koseli yildiz, cizgi boyunca 9 sn'de bir gecen altin nabiz.
export function dikis(x1, x2, y, aci = 0, { gec = 0, sure = 9 } = {}) {
  const gr = uid("s");
  const m = uid("m");
  const len = x2 - x1;
  return `
  <defs>
    <linearGradient id="${gr}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${S.goldHi}" stop-opacity="0" />
      <stop offset=".75" stop-color="${S.goldHi}" stop-opacity=".95" />
      <stop offset="1" stop-color="${S.phosphor}" stop-opacity="0" />
    </linearGradient>
    <clipPath id="${m}"><rect x="${x1}" y="${y - 6}" width="${len}" height="12" /></clipPath>
    <style>.${gr} { animation: ${gr} ${sure}s cubic-bezier(.37,0,.63,1) ${gec}s infinite; }
      @keyframes ${gr} { 0% { transform: translateX(-140px); } 34%,100% { transform: translateX(${len + 20}px); } }</style>
  </defs>
  <line x1="${x1}" y1="${y + 0.5}" x2="${x2}" y2="${y + 0.5}" stroke="${S.rule}" />
  <g clip-path="url(#${m})"><g class="${gr}"><rect x="${x1}" y="${y - 0.5}" width="120" height="2" fill="url(#${gr})" />
    <rect x="${x1 + 96}" y="${y - 4}" width="24" height="9" rx="4.5" fill="${S.goldHi}" opacity=".18" /></g></g>
  <circle cx="${x1 + 36}" cy="${y + 0.5}" r="12" fill="${S.void}" stroke="${S.rule}" />
  ${yildiz8(x1 + 36, y + 0.5, 8, { renk: S.gold, rot: aci })}`;
}

// Hap/cip: mono etiket, bezel plaka, ince kenar. Doner: {svg, w}.
export function cip(x, y, metin, { boy = 12, ton = "gold", led = null, h = 24, sag = false } = {}) {
  const pad = 10;
  const ledW = led ? 14 : 0;
  const w = Math.ceil(tw(metin, boy, "mono", { ls: 0.4 }) + pad * 2 + ledW);
  const x0 = sag ? x - w : x;
  const renk = { gold: S.gold, foam: S.foam, mist: S.mist, ember: S.ember, dim: S.mistDim }[ton] || ton;
  const kenar = ton === "ember" ? S.ember : S.rule;
  const zem = ton === "ember" ? "rgba(255,122,69,.07)" : S.bezel;
  const ledS = led
    ? `<circle class="${led === "nefes" ? "breathe" : ""}" cx="${x0 + pad + 3}" cy="${y + h / 2}" r="3.2" fill="${led === "gold" ? S.gold : S.ember}" />`
    : "";
  return {
    w,
    svg: `<g><rect x="${x0}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${zem}" stroke="${kenar}" stroke-opacity="${ton === "ember" ? 0.38 : 1}" />${ledS}
    <text class="mono" x="${x0 + pad + ledW}" y="${n1(y + h / 2 + boy * 0.36)}" font-size="${boy}" letter-spacing=".4" fill="${renk}">${esc(metin)}</text></g>`,
  };
}

// Yan yana cipler; satira sigmayani alt satira atar. Doner: {svg, y}
export function cipler(x, y, liste, maxW, opt = {}) {
  let cx = x;
  let cy = y;
  const h = opt.h || 24;
  let out = "";
  for (const m of liste) {
    const dene = cip(0, 0, m, opt);
    if (cx > x && cx + dene.w > x + maxW) {
      cx = x;
      cy += h + 8;
    }
    const c = cip(cx, cy, m, opt);
    out += c.svg;
    cx += c.w + 8;
  }
  return { svg: out, y: cy + h };
}

// ------------------------------------------------------------------ sayac

// Split-flap/LiveNumber: her hane ayri karo; rakam seridi 0..9 + hedef
// yukari yuvarlanir (1400 ms, 60 ms kademe). Karonun ortasinda mentese
// cizgisi, alt yari biraz koyu: gercek split-flap gibi.
export function sayac(x, y, deger, { kw = 30, kh = 42, boy = 30, ara = 4, gec = 0 } = {}) {
  const s = String(deger);
  let out = "";
  let cx = x;
  [...s].forEach((ch, i) => {
    const cl = uid("c");
    const isRakam = /\d/.test(ch);
    if (!isRakam) {
      out += `<text class="mono" x="${cx + 6}" y="${y + kh * 0.7}" font-size="${boy * 0.8}" fill="${S.mist}">${esc(ch)}</text>`;
      cx += 14;
      return;
    }
    const hedef = +ch;
    const tur = 10 + hedef; // tam bir tur + hedef
    let serit = "";
    for (let k = 0; k <= tur; k++)
      serit += `<text class="mono" x="${cx + kw / 2}" y="${n1(y + kh * 0.5 + boy * 0.36 + k * kh)}" font-size="${boy}" font-weight="500" text-anchor="middle" fill="${S.foam}">${k % 10}</text>`;
    const an = uid("r");
    out += `<clipPath id="${cl}"><rect x="${cx}" y="${y}" width="${kw}" height="${kh}" rx="4" /></clipPath>
    <rect x="${cx}" y="${y}" width="${kw}" height="${kh}" rx="4" fill="${S.bezel}" stroke="${S.rule}" />
    <rect x="${cx}" y="${y + kh / 2}" width="${kw}" height="${kh / 2}" rx="4" fill="#000" opacity=".22" />
    <g clip-path="url(#${cl})"><style>.${an} { transform: translateY(${-tur * kh}px); animation: ${an} 1.4s cubic-bezier(.16,1,.3,1) ${n1((gec + i * 0.06) * 100) / 100}s backwards; }
      @keyframes ${an} { from { transform: translateY(0); } }</style><g class="${an}">${serit}</g></g>
    <line x1="${cx}" y1="${y + kh / 2}" x2="${cx + kw}" y2="${y + kh / 2}" stroke="${S.void}" stroke-width="1.5" />`;
    cx += kw + ara;
  });
  return { svg: out, w: cx - x - ara };
}

// ------------------------------------------------------------------ yardimci

// Daktilo satiri: mono metin, soldan saga acilan kirpma (steps). Geist Mono
// tam 0.6em genislikte oldugu icin her adim bir harf.
export function yaz(x, y, parcalar, { boy = 14, gec = 0, cps = 38, imlec = false } = {}) {
  const metin = parcalar.map((p) => p[0]).join("");
  const n = [...metin].length;
  const w = n * boy * 0.6;
  const cl = uid("y");
  const sure = n / cps;
  const spans = parcalar.map(([t, renk]) => `<tspan fill="${renk || S.foam}">${esc(t)}</tspan>`).join("");
  return `<clipPath id="${cl}"><rect x="${x - 2}" y="${y - boy * 1.1}" width="${n1(w + 4)}" height="${n1(boy * 1.5)}" class="${cl}" /></clipPath>
  <style>.${cl} { transform-origin: ${x}px ${y}px; animation: ${cl} ${n1(sure * 100) / 100}s steps(${n}) ${gec}s backwards; }
    @keyframes ${cl} { from { transform: scaleX(0); } }</style>
  <text class="mono" x="${x}" y="${y}" font-size="${boy}" clip-path="url(#${cl})" xml:space="preserve">${spans}</text>${
    imlec
      ? `<rect class="blink" x="${n1(x + w + 3)}" y="${n1(y - boy * 0.82)}" width="${n1(boy * 0.58)}" height="${n1(boy * 1.05)}" fill="${S.goldHi}" style="animation-delay:${gec + sure}s" />`
      : ""
  }`;
}

// Bir yol boyunca gezen isik (SMIL animateMotion). mpath href + xlink:href.
// keyPoints sart: Firefox keyPoints yoksa yolun her parcasini ayri deger
// sayar, keyTimes ile tutmayinca animasyonu atar ve isik (0,0)'da kalir.
export function gezgin(yolId, { sure = 4, gec = 0, r = 2.6, renk = S.goldHi, kuyruk = true } = {}) {
  return `<g opacity="0">
    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.85;1" dur="${sure}s" begin="${gec}s" repeatCount="indefinite" />
    <animateMotion dur="${sure}s" begin="${gec}s" repeatCount="indefinite" rotate="auto" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines=".37 0 .63 1">
      <mpath href="#${yolId}" xlink:href="#${yolId}" />
    </animateMotion>
    ${kuyruk ? `<rect x="-14" y="-1" width="14" height="2" rx="1" fill="${renk}" opacity=".35" />` : ""}
    <circle r="${r * 2.4}" fill="${renk}" opacity=".18" />
    <circle r="${r}" fill="${renk}" />
  </g>`;
}

// Isimli renk -> deger (kartlarda kisayol)
export const renk = (ad) => S[ad] || ad;
