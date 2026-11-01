// Baslik (000° · köprü), menu cipleri ve istasyon basliklari.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { S, esc, f1, tw, kir, uid, kok, stil, zemin, koseler, koseStil, yildiz8, yildiz4, kadran, kicker, dikis, cip, sayac } from "./kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// FY logosu: degismeden kalir (fy-ajans/tools/build-logo.mjs uretir). Kok
// <svg> etiketi soyulup viewBox korunarak ic ice yerlestirilir; kendi
// animasyonlari ve id'leri ("mg" onekli) dosyanin icinde gelir.
const FY_LOGO = readFileSync(join(HERE, "..", "fy-logo.svg"), "utf8");
function logo(cx, cy, w) {
  const vb = /viewBox="([^"]+)"/.exec(FY_LOGO)[1];
  const [, , vw, vh] = vb.split(/\s+/).map(Number);
  const h = (w * vh) / vw;
  const inner = FY_LOGO.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return `<svg x="${f1(cx - w / 2)}" y="${f1(cy - h / 2)}" width="${w}" height="${f1(h)}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}

// Istasyonlar: README'deki bolumler, her biri bir pusula acisi.
export const ISTASYONLAR = [
  { aci: 0, id: "fy", etiket: "FY" },
  { aci: 45, id: "products", etiket: "Products" },
  { aci: 90, id: "ai", etiket: "AI & Platforms" },
  { aci: 135, id: "sites", etiket: "Sites" },
  { aci: 180, id: "about", etiket: "About" },
  { aci: 225, id: "tech", etiket: "Tech" },
  { aci: 270, id: "logbook", etiket: "Logbook" },
  { aci: 315, id: "contact", etiket: "Contact" },
];

const rad = (d) => (d * Math.PI) / 180;
const pol = (cx, cy, r, aci) => [cx + r * Math.sin(rad(aci)), cy - r * Math.cos(rad(aci))];

// ---------------------------------------------------------------- derece bandi

// Heading tape: −180°..540° serit, 3px/°, 5°'de centik, 15°'de uzun, her
// 45°'de istasyon. Serit istasyonlar arasinda yayla durarak kayar; ortada
// ember karet sabit. Kenarlar maskeyle solar.
function bant(x, y, w) {
  const pxd = 3;
  const id = uid("t");
  const orta = x + w / 2;
  let c = "";
  for (let d = -180; d <= 540; d += 5) {
    const px = f1(orta + d * pxd);
    const uzun = d % 15 === 0;
    c += `<line x1="${px}" y1="${y + 36}" x2="${px}" y2="${y + (uzun ? 27 : 31)}" stroke="${uzun ? S.goldLo : S.rule}" />`;
  }
  for (let d = -180; d <= 540; d += 45) {
    const ist = ISTASYONLAR[((d % 360) + 360) % 360 / 45];
    const px = orta + d * pxd;
    c += `<text class="sans" x="${f1(px)}" y="${y + 14}" font-size="10.5" font-weight="600" text-anchor="middle" fill="${S.mist}">${esc(ist.etiket)}</text>
      <text class="mono" x="${f1(px)}" y="${y + 24}" font-size="9.5" text-anchor="middle" fill="${S.gold}">${String(((d % 360) + 360) % 360).padStart(3, "0")}</text>`;
  }
  // Durak zaman cizelgesi: her istasyonda 3 sn bekle, 1 sn'de gec (8 x 4 = 32 sn)
  const kare = [];
  const T = 8;
  for (let i = 0; i <= T; i++) {
    const p0 = (i / T) * 100;
    const tx = -i * 45 * pxd;
    kare.push(`${f1(p0)}% { transform: translateX(${tx}px); }`);
    if (i < T) kare.push(`${f1(p0 + 75 / T)}% { transform: translateX(${tx}px); animation-timing-function: cubic-bezier(.3,1.35,.45,1); }`);
  }
  const m = uid("k");
  const mg = uid("kg");
  return `
  <defs>
    <linearGradient id="${mg}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0" /><stop offset=".2" stop-color="#fff" />
      <stop offset=".8" stop-color="#fff" /><stop offset="1" stop-color="#fff" stop-opacity="0" />
    </linearGradient>
    <mask id="${m}"><rect x="${x}" y="${y - 2}" width="${w}" height="36" fill="url(#${mg})" /></mask>
    <style>.${id} { animation: ${id} 32s linear 1.2s infinite; }
      @keyframes ${id} { ${kare.join(" ")} }</style>
  </defs>
  <g mask="url(#${m})"><g class="${id}">${c}</g></g>
  <path d="M${orta - 5} ${y - 4}H${orta + 5}L${orta} ${y + 2}Z" fill="${S.ember}" />`;
}

// ---------------------------------------------------------------- cayro

// Fibonacci kure: yildizlar = projeler ve dersler degil, sadece gok; on yuz
// parlak, arka yuz soluk. Projeksiyon ortografik, eksen 23.4° egik.
function yildizlar(cx, cy, R, n = 130) {
  const g = Math.PI * (3 - Math.sqrt(5));
  const egim = rad(23.4);
  const yaw = rad(38);
  let on = "";
  let arka = "";
  for (let i = 0; i < n; i++) {
    const yy = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - yy * yy);
    const ph = i * g + yaw;
    let x = r * Math.cos(ph);
    let z = r * Math.sin(ph);
    const y1 = yy * Math.cos(egim) - z * Math.sin(egim);
    const z1 = yy * Math.sin(egim) + z * Math.cos(egim);
    const px = f1(cx + R * x);
    const py = f1(cy - R * y1);
    // logonun arkasinda kalanlari atla (logo okunur kalsin)
    if (Math.abs(px - cx) < 112 && Math.abs(py - cy) < 74 && z1 > 0) continue;
    if (z1 > 0) {
      const tw = i % 7 === 0;
      on += `<circle ${tw ? `class="twinkle" style="animation-delay:${f1((i % 11) * 0.37)}s" ` : ""}cx="${px}" cy="${py}" r="${f1(1 + z1 * 1.3)}" fill="${i % 9 === 0 ? S.goldHi : S.gold}" opacity="${f1(0.45 + z1 * 0.5)}" />`;
    } else {
      arka += `<circle cx="${px}" cy="${py}" r=".9" fill="${S.goldLo}" opacity="${f1(0.3 + (1 + z1) * 0.25)}" />`;
    }
  }
  return { on, arka };
}

// Elips halkasi (gok kuresinin dairesi): rx, ry, donus. On yari ayri cizilir
// (logonun onunden gecer: «sandvic»).
function halka(cx, cy, rx, ry, rot, { o = 0.5, dash = "2 7", cls = "flow" } = {}) {
  const tam = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="none" stroke="${S.gold}" stroke-opacity="${f1(o * 0.55)}" stroke-dasharray="${dash}" class="${cls}" />`;
  const on = `<path d="M${cx - rx} ${cy}A${rx} ${ry} 0 0 0 ${cx + rx} ${cy}" transform="rotate(${rot} ${cx} ${cy})" fill="none" stroke="${S.gold}" stroke-opacity="${o}" stroke-width="1.2" />`;
  return { tam, on };
}

// Ana sayfadaki «Bolum» plakalarinin karsiligi: projeler kure uzerinde
// plakalar; ember karet bezel uzerinde sirayla birine doner, o plaka yanar,
// merkezden ona kesikli bir isin cizilir. 7 plaka x 3 sn = 21 sn tur.
const PLAKALAR = [
  { ad: "Pusula", aci: 22, r: 0.9, not: "AI gateway" },
  { ad: "Dawayar", aci: 78, r: 0.9, not: "pharmacy" },
  { ad: "Zamin", aci: 145, r: 0.74, not: "land" },
  { ad: "Shafa", aci: 168, r: 0.8, not: "clinic" },
  { ad: "Mini Dakhl", aci: 214, r: 0.86, not: "ledger" },
  { ad: "Yayın", aci: 255, r: 0.84, not: "publishing" },
  { ad: "FY Merkez", aci: 335, r: 0.92, not: "licences" },
];

function plakalar(cx, cy, R) {
  const n = PLAKALAR.length;
  const tur = n * 3;
  let isin = "";
  let plak = "";
  let stilK = "";
  let bug = [];
  PLAKALAR.forEach((p, i) => {
    const [px, py] = pol(cx, cy, R * p.r, p.aci);
    const w = Math.ceil(tw(p.ad, 12, "mono") + 30);
    const sol = px < cx;
    const bx = sol ? px - w + 6 : px - 6;
    const by = py - 11;
    const k = uid("l");
    const a0 = (i / n) * 100;
    const a1 = ((i + 1) / n) * 100;
    // yanik pencere: [a0+2, a1-1]
    stilK += `.${k} { animation: ${k} ${tur}s linear 1.4s infinite backwards; }
      @keyframes ${k} { 0%, ${f1(a0 + 1.5)}% { opacity: 0; } ${f1(a0 + 3)}%, ${f1(a1 - 1.5)}% { opacity: 1; } ${f1(a1)}%, 100% { opacity: 0; } }\n`;
    const [ix, iy] = pol(cx, cy, 104, p.aci);
    isin += `<g class="${k}"><line x1="${f1(ix)}" y1="${f1(iy)}" x2="${f1(px)}" y2="${f1(py)}" stroke="${S.ember}" stroke-opacity=".75" stroke-dasharray="3 4" class="flow" />
      <circle cx="${f1(px)}" cy="${f1(py)}" r="9" fill="${S.ember}" opacity=".18" /></g>`;
    plak += `<g>
      <rect x="${f1(bx)}" y="${f1(by)}" width="${w}" height="22" rx="11" fill="${S.void}" fill-opacity=".82" stroke="${S.rule}" />
      <g class="${k}"><rect x="${f1(bx)}" y="${f1(by)}" width="${w}" height="22" rx="11" fill="rgba(255,122,69,.08)" stroke="${S.ember}" stroke-opacity=".6" /></g>
      <circle cx="${f1(bx + 11)}" cy="${f1(by + 11)}" r="3" fill="${S.goldLo}" />
      <circle class="${k}" cx="${f1(bx + 11)}" cy="${f1(by + 11)}" r="3" fill="${S.ember}" />
      <text class="mono" x="${f1(bx + 20)}" y="${f1(by + 15.2)}" font-size="12" fill="${S.foam}">${esc(p.ad)}</text>
    </g>`;
    bug.push(p.aci);
  });
  // bezel uzerindeki ember karetin donusu (durak + yay)
  const kare = [];
  let onceki = bug[0];
  let birikim = bug[0];
  const acilar = [];
  for (let i = 0; i < n; i++) {
    let hedef = bug[i];
    let d = hedef - (onceki % 360);
    if (d < -180) d += 360;
    if (d > 180) d -= 360;
    if (i > 0) birikim += d;
    acilar.push(birikim);
    onceki = hedef;
  }
  // donguyu kapat: son acidan ilk aciya (+360 farkiyla) kisa yoldan
  let dKapa = bug[0] - (bug[n - 1] % 360);
  if (dKapa < -180) dKapa += 360;
  if (dKapa > 180) dKapa -= 360;
  const son = birikim + dKapa;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 100;
    kare.push(`${f1(a0)}% { transform: rotate(${f1(acilar[i])}deg); animation-timing-function: linear; }`);
    kare.push(`${f1(a0 + 100 / n - 5)}% { transform: rotate(${f1(acilar[i])}deg); animation-timing-function: cubic-bezier(.3,1.5,.45,1); }`);
  }
  kare.push(`100% { transform: rotate(${f1(son)}deg); }`);
  const b = uid("b");
  stilK += `.${b} { transform-origin: ${cx}px ${cy}px; animation: ${b} ${tur}s linear 1.4s infinite; }
    @keyframes ${b} { ${kare.join(" ")} }
    /* son aciyla ilk aci ayni yon: dongu dikissiz */`;
  const caret = `<g class="${b}" style="transform: rotate(${bug[0]}deg)"><path d="M${cx - 7} ${cy - R - 26}H${cx + 7}L${cx} ${cy - R - 15}Z" fill="${S.ember}" />
    <line x1="${cx}" y1="${cy - R - 14}" x2="${cx}" y2="${cy - R - 2}" stroke="${S.ember}" stroke-width="1.5" /></g>`;
  // HUD metni: o anki plaka (sol tarafta)
  return { isin, plak, caret, stilK };
}

function hud(x, y, cx) {
  const n = PLAKALAR.length;
  const tur = n * 3;
  let out = "";
  let stilK = "";
  PLAKALAR.forEach((p, i) => {
    const k = uid("hd");
    const a0 = (i / n) * 100;
    const a1 = ((i + 1) / n) * 100;
    // ilk plaka acilista ve turun basinda dogrudan gorunur (bos HUD kalmasin)
    stilK +=
      i === 0
        ? `.${k} { opacity: 1; animation: ${k} ${tur}s linear 1.4s infinite; }
      @keyframes ${k} { 0%, ${f1(a1 - 1.5)}% { opacity: 1; } ${f1(a1)}%, ${f1(100 - 1.5)}% { opacity: 0; } 100% { opacity: 1; } }\n`
        : `.${k} { opacity: 0; animation: ${k} ${tur}s linear 1.4s infinite; }
      @keyframes ${k} { 0%, ${f1(a0 + 0.5)}% { opacity: 0; } ${f1(a0 + 2)}%, ${f1(a1 - 1.5)}% { opacity: 1; } ${f1(a1)}%, 100% { opacity: 0; } }\n`;
    out += `<g class="${k}">
      <text class="mono" x="${x + 112}" y="${y + 17}" font-size="13" fill="${S.goldHi}">${String(p.aci).padStart(3, "0")}°</text>
      <text class="mono" x="${x + 160}" y="${y + 17}" font-size="13" fill="${S.foam}">${esc(p.ad)}<tspan fill="${S.mistDim}">  · ${esc(p.not)}</tspan></text>
    </g>`;
  });
  return {
    stilK,
    svg: `<g class="rise" style="animation-delay:.5s">
      <rect x="${x}" y="${y}" width="${cx}" height="26" rx="13" fill="${S.bezel}" stroke="${S.rule}" />
      <circle class="breathe" cx="${x + 14}" cy="${y + 13}" r="3.4" fill="${S.ember}" />
      <text class="mono" x="${x + 26}" y="${y + 17}" font-size="12" letter-spacing="1.2" fill="${S.gold}">HEADING</text>
      <line x1="${x + 100}" y1="${y + 6}" x2="${x + 100}" y2="${y + 20}" stroke="${S.rule}" />
      ${out}
    </g>`,
  };
}

// ---------------------------------------------------------------- baslik

export function header({ ad, italik, giris, almanak }) {
  const W = 1000;
  const H = 520;
  const cx = 772;
  const cy = 262;
  const R = 158;

  // gok
  const ys = yildizlar(cx, cy, R - 6);
  const h1 = halka(cx, cy, R, R * 0.27, -14, { o: 0.6 });
  const h2 = halka(cx, cy, R * 0.3, R, -14, { o: 0.42, dash: "1.5 6", cls: "flow-r" });
  const h3 = halka(cx, cy, R, R * 0.52, 9.4, { o: 0.38, dash: "1 5" });
  const pl = plakalar(cx, cy, R);

  // bezel: 120 centik (3°), her 10.'su uzun; −1°/s doner
  let centik = "";
  for (let i = 0; i < 120; i++) {
    const a = i * 3;
    const uzun = i % 10 === 0;
    const [x1, y1] = pol(cx, cy, R + 4, a);
    const [x2, y2] = pol(cx, cy, R + (uzun ? 16 : 10), a);
    centik += `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${uzun ? S.gold : S.goldLo}" stroke-opacity="${uzun ? 0.9 : 0.55}" />`;
  }
  let derece = "";
  for (let a = 0; a < 360; a += 30) {
    const [x, y] = pol(cx, cy, R + 30, a);
    const harf = { 0: "N", 90: "E", 180: "S", 270: "W" }[a];
    derece += `<text class="mono" x="${f1(x)}" y="${f1(y + 3.6)}" font-size="${harf ? 12 : 10}" text-anchor="middle" fill="${harf ? (a === 0 ? S.ember : S.gold) : S.mistDim}">${harf || String(a).padStart(3, "0")}</text>`;
  }
  // rhumb cizgileri: merkezden 32 yon
  let rhumb = "";
  for (let i = 0; i < 32; i++) {
    const [x, y] = pol(cx, cy, 640, i * 11.25);
    rhumb += `<line x1="${cx}" y1="${cy}" x2="${f1(x)}" y2="${f1(y)}" stroke="${S.gold}" stroke-opacity="${i % 4 === 0 ? 0.075 : 0.035}" />`;
  }

  // sol sutun
  const x0 = 48;
  const baslikBoy = 88;
  const itBoy = (() => {
    let b = 30;
    while (tw(italik, b, "it") > 520 && b > 18) b -= 1;
    return b;
  })();
  const giriSatir = kir(giris, 16.5, 500, "sans");
  const hd = hud(x0, 404, 468);

  // almanak (split-flap): hucre genisligi icerige gore, kalan bosluk esit
  const hucre = almanak.map((a) => {
    const s0 = sayac(0, 0, a.deger, { kw: 22, kh: 34, boy: 22, ara: 3 });
    const satir = kir(a.etiket, 12.5, 104, "sans");
    const lw = Math.max(...satir.map((t) => tw(t, 12.5, "sans")));
    return { a, sw: s0.w, satir, w: s0.w + 10 + lw };
  });
  const bos = (W - hucre.reduce((t, h) => t + h.w, 0)) / almanak.length;
  let alm = "";
  let hx = bos / 2;
  hucre.forEach((h, i) => {
    const s = sayac(hx, 460, h.a.deger, { kw: 22, kh: 34, boy: 22, ara: 3, gec: 1 + i * 0.12 });
    alm += `<g class="fade" style="animation-delay:${f1(0.8 + i * 0.1)}s">${s.svg}
      ${h.satir.map((t, k) => `<text x="${f1(hx + h.sw + 10)}" y="${f1(460 + 17 - (h.satir.length - 1) * 7.5 + k * 15 + 4)}" font-size="12.5" fill="${S.mist}">${esc(t)}</text>`).join("")}
    </g>`;
    if (i) alm += `<line x1="${f1(hx - bos / 2)}" y1="452" x2="${f1(hx - bos / 2)}" y2="502" stroke="${S.rule}" />`;
    hx += h.w + bos;
  });

  const kc = cip(x0, 92, "FY  ·  NRW → AF  ·  offline-first", { led: "nefes", ton: "foam", boy: 12, h: 26 });
  const sagC = cip(W - 24, 12, "51°13′N 6°46′E", { boy: 11, ton: "dim", h: 22, sag: true });

  const ic = `
  ${zemin(W, H, { r: 16, parilti: { cx, cy, r: 300, o: 0.2 } })}
  <defs>
    <clipPath id="hk"><rect width="${W}" height="${H}" rx="16" /></clipPath>
    <radialGradient id="hkure" cx="${cx}" cy="${cy}" r="${R}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1b150a" stop-opacity=".9" /><stop offset=".72" stop-color="${S.hull}" stop-opacity=".55" />
      <stop offset="1" stop-color="${S.void}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="hlogo" cx="${cx}" cy="${cy}" r="140" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${S.goldHi}" stop-opacity=".28" /><stop offset=".55" stop-color="${S.gold}" stop-opacity=".08" />
      <stop offset="1" stop-color="${S.gold}" stop-opacity="0" />
    </radialGradient>
    ${stil(`${koseStil}
      .spin { transform-origin: ${cx}px ${cy}px; animation: spin 360s linear infinite; }
      @keyframes spin { to { transform: rotate(-360deg); } }
      .gok { transform-origin: ${cx}px ${cy}px; animation: gok 240s linear infinite; }
      @keyframes gok { to { transform: rotate(360deg); } }
      .nabiz { transform-origin: ${cx}px ${cy}px; animation: nabiz 9s ease-in-out infinite; }
      @keyframes nabiz { 0%,100% { opacity: .75; transform: scale(1); } 50% { opacity: 1; transform: scale(1.04); } }
      .guc { transform-origin: ${cx}px ${cy}px; animation: guc 1.2s cubic-bezier(.16,1,.3,1) backwards; }
      @keyframes guc { from { opacity: 0; transform: scale(.94) rotate(-8deg); } }
      .sok { transform-origin: ${cx}px ${cy}px; animation: sok 7s cubic-bezier(.16,1,.3,1) 2s infinite; }
      @keyframes sok { 0% { opacity: .55; transform: scale(.72); } 40%,100% { opacity: 0; transform: scale(1.32); } }
      ${pl.stilK}
      ${hd.stilK}
    `)}
  </defs>
  <g clip-path="url(#hk)">
    <g class="fade">${rhumb}</g>
    <!-- ust cubuk: marka, derece bandi, koordinat -->
    <g>
      ${kadran(34, 23, 11, 45, { gec: 0.3 })}
      <text x="54" y="28.5" font-size="16" font-weight="700" fill="${S.foam}">FY</text>
      <text class="mono" x="80" y="27.5" font-size="11" fill="${S.mistDim}">farhad yaqoobi</text>
      ${bant(300, 6, 400)}
      ${sagC.svg}
    </g>
    <line x1="0" y1="44.5" x2="${W}" y2="44.5" stroke="${S.rule}" />

    <!-- cayro-pusula -->
    <g class="guc">
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#hkure)" />
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${S.goldLo}" stroke-opacity=".5" />
      <circle cx="${cx}" cy="${cy}" r="${R + 20}" fill="none" stroke="${S.rule}" />
      <g class="spin">${centik}</g>
      ${derece}
      <g class="gok">${ys.arka}</g>
      ${h1.tam}${h2.tam}${h3.tam}
      <circle class="sok" cx="${cx}" cy="${cy}" r="${R * 0.9}" fill="none" stroke="${S.goldHi}" stroke-opacity=".5" />
      ${pl.isin}
      <g class="gok">${ys.on}</g>
      <circle cx="${cx}" cy="${cy}" r="140" fill="url(#hlogo)" class="nabiz" />
      ${logo(cx, cy + 2, 214)}
      ${h1.on}${h3.on}
      ${pl.plak}
      ${pl.caret}
    </g>

    <!-- kopru metni -->
    <g class="rise" style="animation-delay:.15s">${kc.svg}</g>
    <g class="rise" style="animation-delay:.25s"><text class="serif" x="${x0 - 3}" y="214" font-size="${baslikBoy}" letter-spacing="-1.6" fill="${S.foam}">${esc(ad)}</text></g>
    <g class="rise" style="animation-delay:.38s"><text class="it" x="${x0}" y="${214 + 48}" font-size="${itBoy}" fill="${S.goldHi}">${esc(italik)}</text></g>
    <g class="rise" style="animation-delay:.5s">
      ${giriSatir.map((t, i) => `<text x="${x0}" y="${306 + i * 26}" font-size="16.5" fill="${S.mist}">${esc(t)}</text>`).join("")}
    </g>
    ${hd.svg}

    <!-- almanak -->
    <line x1="0" y1="440.5" x2="${W}" y2="440.5" stroke="${S.rule}" />
    <rect x="0" y="441" width="${W}" height="${H - 441}" fill="${S.void}" fill-opacity=".6" />
    ${alm}
  </g>`;
  return kok(W, H, `${ad} — ${italik}`, ic);
}

// ---------------------------------------------------------------- menu cipi

// Her istasyon icin kucuk bir cip: kadran + «045° PRODUCTS». README'de
// <a href="#products"> ile sarilir (tek parca SVG'de baglanti calismaz).
export function navCip(ist) {
  const H = 36;
  const metin = `${String(ist.aci).padStart(3, "0")}°`;
  const etiket = ist.etiket.toUpperCase();
  const w = Math.ceil(44 + tw(metin, 12, "mono") + 8 + tw(etiket, 12, "mono", { ls: 1.2 }) + 16);
  const ic = `
  <defs>${stil()}</defs>
  <rect x=".5" y=".5" width="${w - 1}" height="${H - 1}" rx="${H / 2 - 0.5}" fill="${S.hull}" stroke="${S.rule}" />
  ${kadran(20, H / 2, 10, ist.aci, { gec: 0.2 + ist.aci / 300 })}
  <text class="mono" x="38" y="${H / 2 + 4.3}" font-size="12" fill="${S.gold}">${metin}</text>
  <text class="mono" x="${f1(38 + tw(metin, 12, "mono") + 8)}" y="${H / 2 + 4.3}" font-size="12" letter-spacing="1.2" fill="${S.foam}">${esc(etiket)}</text>`;
  return kok(w, H, `${metin} ${ist.etiket}`, ic);
}

// ---------------------------------------------------------------- istasyon

// Bolum basligi: rota dikisi, kicker (kadran + derece · etiket), serif h2,
// italik satir ve giris metni.
export function istasyon({ aci, etiket, baslik, italik, giris }) {
  const W = 1000;
  const satir = giris ? kir(giris, 16, 860, "sans") : [];
  const H = 200 + satir.length * 25 + (italik ? 0 : -30) + (satir.length ? 0 : -14);
  let y = 112;
  // Kendi koyu zemini var: GitHub'in acik temasinda da okunur.
  const ic = `
  ${zemin(W, H, { r: 16, parilti: { cx: 120, cy: 0, r: 520, o: 0.09 } })}
  <defs>${stil(koseStil)}</defs>
  ${dikis(0, W, 22, aci, { gec: 0.6 })}
  ${kicker(24, 74, aci, etiket, { gec: 0.1 })}
  <g class="rise" style="animation-delay:.22s"><text class="serif" x="22" y="${(y += 14)}" font-size="50" letter-spacing="-.8" fill="${S.foam}">${esc(baslik)}</text></g>
  ${italik ? `<g class="rise" style="animation-delay:.34s"><text class="it" x="24" y="${(y += 38)}" font-size="24" fill="${S.goldHi}">${esc(italik)}</text></g>` : ""}
  <g class="rise" style="animation-delay:.46s">${satir
    .map((t, i) => `<text x="24" y="${y + 34 + i * 25}" font-size="16" fill="${S.mist}">${esc(t)}</text>`)
    .join("")}</g>`;
  return kok(W, H, `${String(aci).padStart(3, "0")}° · ${etiket} — ${baslik}`, ic);
}
