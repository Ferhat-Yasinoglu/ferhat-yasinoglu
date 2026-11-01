// Hakkinda (portre + terminal), teknoloji karolari, diller, sayilar,
// aktivite ve alt bilgi (seyir defteri). Veri GitHub API'sinden gelir.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { S, esc, f1, tw, uid, kok, stil, zemin, koseler, koseStil, yildiz8, kicker, dikis, sayac, gezgin } from "./kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// Portre: kaynak fotograf depoda yok; buradaki dosya islenmis hali
// (gri, normalize, kenarlari vinyetli, 300x400). Altin duotone SVG tarafinda.
const PORTRE = readFileSync(join(HERE, "..", "portre.png")).toString("base64");

// ---------------------------------------------------------------- hakkinda

// Sol: altin duotone portre, tarama cizgisi ve HUD etiketleri. Sag: Seyir
// terminali (uc nokta ember/altin/koyu altin, sekmeler); komutlar harf harf
// yazilir, ciktilar belirir, dizi bitince bastan baslar (SMIL, dongu). Taban
// hal tam metin: SMIL calismayan yerde terminal bos kalmaz.
export function hakkinda(satirlar) {
  const W = 1000;
  const PX = 28;
  const PY = 64;
  const PW = 276;
  const PH = 368;
  const TX = PX + PW + 28;
  const TW = W - TX - 24;
  const boy = 14.5;
  const cw = boy * 0.6;
  const satirH = 26;
  const ust = 118;
  const H = Math.max(PY + PH + 60, ust + satirlar.length * satirH + 36);

  let t = 0.6;
  const zaman = satirlar.map((s) => {
    const n = [...s.metin].length;
    const sure = s.tip === "komut" ? n * 0.05 : 0.2;
    const bas = t;
    t += sure + (s.tip === "komut" ? 0.4 : 0.25);
    return { bas, sure };
  });
  const dongu = t + 5;
  const at = (s) => f1(Math.max(0, Math.min(1, s / dongu)) * 10000) / 10000;

  let govde = "";
  satirlar.forEach((s, i) => {
    const { bas, sure } = zaman[i];
    const y = ust + i * satirH;
    const kom = s.tip === "komut";
    const metin = s.metin;
    const ic = kom
      ? `<tspan fill="${S.gold}">$ </tspan><tspan fill="${S.foam}">${esc(metin)}</tspan>`
      : `<tspan fill="${s.renk || S.mist}">  ${esc(metin)}</tspan>`;
    if (kom) {
      const w = f1(([...metin].length + 2) * cw + 6);
      govde += `<clipPath id="tk${i}"><rect x="${TX + 18}" y="${y - 16}" width="${w}" height="22">
        <animate attributeName="width" values="0;0;${w};${w};0" keyTimes="0;${at(bas)};${at(bas + sure)};${at(dongu - 0.1)};1" dur="${f1(dongu)}s" repeatCount="indefinite" />
      </rect></clipPath>
      <text class="mono" x="${TX + 18}" y="${y}" font-size="${boy}" clip-path="url(#tk${i})" xml:space="preserve">${ic}</text>`;
    } else {
      govde += `<g><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${at(bas)};${at(bas + sure)};${at(dongu - 0.1)};1" dur="${f1(dongu)}s" repeatCount="indefinite" />
        <text class="mono" x="${TX + 18}" y="${y}" font-size="${boy}" xml:space="preserve">${ic}</text></g>`;
    }
  });
  // imlec: her satirin sonunda
  const durak = satirlar.map((s, i) => ({ bitis: at(zaman[i].bas + zaman[i].sure), x: TX + 18 + ([...s.metin].length + 2) * cw + 3, y: ust + i * satirH - 12 }));
  const kt = ["0", ...durak.map((d) => d.bitis), "1"].join(";");
  const ix = [TX + 18, ...durak.map((d) => f1(d.x)), f1(durak.at(-1).x)].join(";");
  const iy = [durak[0].y, ...durak.map((d) => d.y), durak.at(-1).y].join(";");

  // portre HUD
  const hud = (x, y, a, b) => `<text class="mono" x="${x}" y="${y}" font-size="10" letter-spacing="1.2" fill="${S.mistDim}">${esc(a)}</text><text class="mono" x="${x}" y="${y + 14}" font-size="11.5" fill="${S.goldHi}">${esc(b)}</text>`;

  const sekme = ["whoami", "stack", "log"];
  let sx = TX + 112;
  const sekmeler = sekme
    .map((s, i) => {
      const w = tw(s, 11, "mono") + 22;
      const out = `<rect x="${f1(sx)}" y="${PY + 9}" width="${f1(w)}" height="22" rx="6" fill="${i === 0 ? S.bezel : "none"}" stroke="${i === 0 ? S.goldLo : S.rule}" />
        <text class="mono" x="${f1(sx + 11)}" y="${PY + 24}" font-size="11" fill="${i === 0 ? S.goldHi : S.mistDim}">${s}</text>`;
      sx += w + 6;
      return out;
    })
    .join("");

  const ic = `
  ${zemin(W, H, { r: 16, parilti: { cx: PX + PW / 2, cy: PY + PH / 2, r: 340, o: 0.1 } })}
  <defs>
    <filter id="duo" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="0.92 0 0 0 0.06  0.70 0 0 0 0.045  0.24 0 0 0 0.02  0 0 0 1 0" />
    </filter>
    <pattern id="tara" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2.6" fill="#fff" /></pattern>
    <mask id="cizgi"><rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" fill="url(#tara)" /></mask>
    <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${S.goldHi}" stop-opacity="0" /><stop offset=".5" stop-color="${S.goldHi}" stop-opacity=".45" /><stop offset="1" stop-color="${S.goldHi}" stop-opacity="0" />
    </linearGradient>
    <clipPath id="pan"><rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="6" /></clipPath>
    ${stil(`${koseStil}
      .tarayici { animation: kay 6s linear infinite; }
      @keyframes kay { from { transform: translateY(${PY - 50}px); } to { transform: translateY(${PY + PH}px); } }`)}
  </defs>
  ${kicker(PX, 38, 180, "Bridge log", { gec: 0.1 })}
  <!-- portre -->
  <g clip-path="url(#pan)">
    <rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" fill="${S.void}" />
    <image x="${PX}" y="${PY}" width="${PW}" height="${PH}" preserveAspectRatio="xMidYMid slice" filter="url(#duo)" mask="url(#cizgi)" href="data:image/png;base64,${PORTRE}" />
    <rect class="tarayici" x="${PX}" y="0" width="${PW}" height="50" fill="url(#band)" />
  </g>
  <rect x="${PX + 0.5}" y="${PY + 0.5}" width="${PW - 1}" height="${PH - 1}" rx="6" fill="none" stroke="${S.rule}" />
  ${koseler(PX - 6, PY - 6, PW + 12, PH + 12, { L: 14, gec: 0.2 })}
  <g class="fade" style="animation-delay:.6s">
    <rect x="${PX + 10}" y="${PY + PH - 58}" width="${PW - 20}" height="48" rx="8" fill="${S.void}" fill-opacity=".72" stroke="${S.rule}" />
    ${hud(PX + 22, PY + PH - 39, "SUBJECT", "Farhad Yaqoobi")}
    ${hud(PX + 158, PY + PH - 39, "POSITION", "51°13′N 6°46′E")}
    <circle class="breathe" cx="${PX + PW - 20}" cy="${PY + 18}" r="4" fill="${S.ember}" />
    <text class="mono" x="${PX + PW - 30}" y="${PY + 22}" font-size="10.5" letter-spacing="1.2" text-anchor="end" fill="${S.foam}">REC</text>
  </g>
  <!-- terminal -->
  <rect x="${TX}" y="${PY}" width="${TW}" height="${H - PY - 28}" rx="12" fill="${S.deck}" stroke="${S.rule}" />
  <rect x="${TX}" y="${PY}" width="${TW}" height="40" rx="12" fill="${S.bezel}" />
  <rect x="${TX}" y="${PY + 28}" width="${TW}" height="12" fill="${S.bezel}" />
  <line x1="${TX}" y1="${PY + 40.5}" x2="${TX + TW}" y2="${PY + 40.5}" stroke="${S.rule}" />
  <circle cx="${TX + 20}" cy="${PY + 20}" r="5" fill="${S.ember}" /><circle cx="${TX + 38}" cy="${PY + 20}" r="5" fill="${S.gold}" /><circle cx="${TX + 56}" cy="${PY + 20}" r="5" fill="${S.goldDeep}" />
  ${sekmeler}
  <text class="mono" x="${TX + TW - 18}" y="${PY + 24}" font-size="11" text-anchor="end" fill="${S.mistDim}">farhad@fy: ~</text>
  ${govde}
  <rect width="${f1(boy * 0.58)}" height="${f1(boy * 1.08)}" fill="${S.goldHi}" class="blink">
    <animate attributeName="x" values="${ix}" keyTimes="${kt}" dur="${f1(dongu)}s" repeatCount="indefinite" calcMode="discrete" />
    <animate attributeName="y" values="${iy}" keyTimes="${kt}" dur="${f1(dongu)}s" repeatCount="indefinite" calcMode="discrete" />
  </rect>`;
  return kok(W, H, `Farhad Yaqoobi · ${satirlar.map((s) => s.metin).join(" · ")}`, ic);
}

// ---------------------------------------------------------------- teknoloji

// Tek logoluk karo (README'de <a> ile sarilir). Logolar marka rengi yerine
// altin gradyanla cizilir: Seyir paleti; bir isik dalgasi karolar boyunca
// sirayla gecer (gecikme sira numarasindan).
export function ikonKaro(ic, sira = 0) {
  const W = 96;
  const H = 112;
  const sc = 40 / 24;
  const gid = uid("ig");
  const sw = uid("is");
  const cl = uid("ic");
  const gec = f1(sira * 0.22);
  const ad = ic.ad;
  const boy = tw(ad, 11, "mono") > 80 ? 9.5 : 11;
  const icx = `
  <defs>
    <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${S.phosphor}" /><stop offset=".45" stop-color="${S.goldHi}" /><stop offset="1" stop-color="${S.gold}" />
    </linearGradient>
    <linearGradient id="${sw}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${S.goldHi}" stop-opacity="0" /><stop offset=".5" stop-color="${S.goldHi}" stop-opacity=".22" /><stop offset="1" stop-color="${S.goldHi}" stop-opacity="0" />
    </linearGradient>
    <clipPath id="${cl}"><rect width="${W}" height="${H}" rx="14" /></clipPath>
    ${stil(`.dalga { animation: dalga 7s cubic-bezier(.37,0,.63,1) ${gec}s infinite; }
      @keyframes dalga { 0% { transform: translateX(-70px); } 30%, 100% { transform: translateX(${W + 20}px); } }
      .yuz { transform-box: fill-box; transform-origin: center; animation: yuz 7s ease-in-out ${gec}s infinite; }
      @keyframes yuz { 0%, 30%, 100% { transform: scale(1); } 12% { transform: scale(1.07); } }`)}
  </defs>
  <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="${S.hull}" stroke="${S.rule}" />
  <circle cx="${W / 2}" cy="44" r="31" fill="${S.void}" stroke="${S.ruleSoft}" />
  ${[0, 90, 180, 270].map((a) => { const r = (a * Math.PI) / 180; return `<line x1="${f1(W / 2 + 31 * Math.sin(r))}" y1="${f1(44 - 31 * Math.cos(r))}" x2="${f1(W / 2 + 35 * Math.sin(r))}" y2="${f1(44 - 35 * Math.cos(r))}" stroke="${S.goldLo}" />`; }).join("")}
  <g class="yuz"><g transform="translate(${W / 2 - 20} 24) scale(${f1(sc * 1000) / 1000})"><path d="${ic.path}" fill="url(#${gid})" /></g></g>
  <g clip-path="url(#${cl})"><rect class="dalga" x="0" y="0" width="60" height="${H}" fill="url(#${sw})" /></g>
  <text class="mono" x="${W / 2}" y="${H - 16}" font-size="${boy}" text-anchor="middle" fill="${S.foam}">${esc(ad)}</text>`;
  return kok(W, H, ad, icx);
}

// ---------------------------------------------------------------- diller

// Pusula gulu gibi bir halka: her dil bir yay (altin merdiveni), yaylar
// sirayla cizilir; sagda mono yuzdeler ve GitHub dil rengiyle kucuk nokta.
const MERDIVEN = [S.goldHi, S.gold, "#b88a2c", S.goldLo, "#7a5a18", S.goldDeep];
export function diller(langs) {
  const W = 490;
  const H = 300;
  const cx = 128;
  const cy = 168;
  const R = 82;
  const top = langs.reduce((s, l) => s + l.size, 0) || 1;
  const cevre = 2 * Math.PI * R;
  let acc = 0;
  let yay = "";
  let lej = "";
  langs.forEach((l, i) => {
    const pay = l.size / top;
    const len = pay * cevre;
    const bosluk = Math.min(3, len * 0.3);
    const r = MERDIVEN[i % MERDIVEN.length];
    yay += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${r}" stroke-width="16" stroke-dasharray="${f1(Math.max(0.5, len - bosluk))} ${f1(cevre)}" stroke-dashoffset="${f1(-acc)}" transform="rotate(-90 ${cx} ${cy})"
      style="animation: dl-in 1.2s cubic-bezier(.16,1,.3,1) ${f1(0.3 + i * 0.15)}s backwards" />`;
    acc += len;
    const y = 96 + i * 30;
    const yz = (pay * 100).toFixed(1) + "%";
    lej += `<g class="rise" style="animation-delay:${f1(0.4 + i * 0.1)}s">
      <rect x="250" y="${y - 10}" width="12" height="12" rx="3" fill="${r}" />
      <text x="272" y="${y}" font-size="14" fill="${S.foam}">${esc(l.name)}</text>
      <text class="mono" x="${W - 28}" y="${y}" font-size="13" text-anchor="end" fill="${S.goldHi}">${yz}</text>
      <rect x="272" y="${y + 6}" width="${f1((W - 300) * pay)}" height="2" rx="1" fill="${r}" opacity=".7" />
    </g>`;
  });
  let centik = "";
  for (let i = 0; i < 72; i++) {
    const a = (i * 5 * Math.PI) / 180;
    const r1 = i % 9 === 0 ? R + 14 : R + 11;
    centik += `<line x1="${f1(cx + (R + 9) * Math.sin(a))}" y1="${f1(cy - (R + 9) * Math.cos(a))}" x2="${f1(cx + r1 * Math.sin(a))}" y2="${f1(cy - r1 * Math.cos(a))}" stroke="${S.goldLo}" stroke-opacity=".7" />`;
  }
  const ilk = langs[0];
  const ic = `
  ${zemin(W, H, { r: 16, parilti: { cx, cy, r: 200, o: 0.12 } })}
  <defs>${stil(`@keyframes dl-in { from { stroke-dasharray: 0 ${f1(cevre)}; } }
    .yavas { transform-origin: ${cx}px ${cy}px; animation: yavas 120s linear infinite; } @keyframes yavas { to { transform: rotate(360deg); } }`)}</defs>
  ${kicker(24, 44, 270, "Languages", { gec: 0.1 })}
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${S.bezel}" stroke-width="16" />
  <g class="yavas">${centik}</g>
  ${yay}
  <circle cx="${cx}" cy="${cy}" r="${R - 14}" fill="${S.void}" stroke="${S.rule}" />
  ${ilk ? `<text class="serif" x="${cx}" y="${cy + 6}" font-size="34" text-anchor="middle" fill="${S.foam}">${((ilk.size / top) * 100).toFixed(0)}%</text>
  <text class="mono" x="${cx}" y="${cy + 26}" font-size="10.5" letter-spacing="1" text-anchor="middle" fill="${S.mistDim}">${esc(ilk.name.toUpperCase())}</text>` : ""}
  ${yildiz8(cx, cy - R - 26, 6, { renk: S.ember })}
  ${lej}
  <text class="mono" x="24" y="${H - 18}" font-size="10" letter-spacing="1" fill="${S.mistDim}">PUBLIC REPOS · BY BYTES</text>`;
  return kok(W, H, `Most used languages: ${langs.map((l) => `${l.name} ${((l.size / top) * 100).toFixed(1)}%`).join(", ")}`, ic);
}

// ---------------------------------------------------------------- sayilar

export function sayilar(d) {
  const W = 490;
  const H = 300;
  const kalem = [
    { deger: d.totalContributions, etiket: "contributions", alt: "last 12 months" },
    { deger: d.commits, etiket: "commits", alt: "+ private activity" },
    { deger: d.prs, etiket: "pull requests", alt: "opened" },
    { deger: d.repos, etiket: "repositories", alt: "public, own" },
    { deger: d.stars, etiket: "stars", alt: "earned" },
    { deger: d.followers, etiket: "followers", alt: "on GitHub" },
  ];
  let g = "";
  kalem.forEach((k, i) => {
    const c = i % 2;
    const r = Math.floor(i / 2);
    const x = 24 + c * 226;
    const y = 76 + r * 70;
    const s = sayac(x, y, k.deger, { kw: 22, kh: 34, boy: 22, ara: 3, gec: 0.4 + i * 0.12 });
    g += `<g class="fade" style="animation-delay:${f1(0.3 + i * 0.08)}s">${s.svg}
      <text x="${f1(x + s.w + 12)}" y="${y + 15}" font-size="13.5" fill="${S.foam}">${esc(k.etiket)}</text>
      <text class="mono" x="${f1(x + s.w + 12)}" y="${y + 31}" font-size="10" letter-spacing=".8" fill="${S.mistDim}">${esc(k.alt.toUpperCase())}</text></g>`;
    if (c === 0) g += `<line x1="${24}" y1="${y + 52}" x2="${W - 24}" y2="${y + 52}" stroke="${S.ruleSoft}" />`;
  });
  const ic = `
  ${zemin(W, H, { r: 16, parilti: { cx: W, cy: 0, r: 300, o: 0.1 } })}
  <defs>${stil()}</defs>
  ${kicker(24, 44, 270, "By the numbers", { gec: 0.1 })}
  ${g}`;
  return kok(W, H, `By the numbers: ${kalem.map((k) => `${k.deger} ${k.etiket}`).join(", ")}`, ic);
}

// ---------------------------------------------------------------- aktivite

// Son 90 gun: altin sutunlar, ustunde yumusak bir egri (osiloskop), en
// yogun gune ember isaret, haftalik centikler. Tarih <tspan class="tarih">
// icinde: is akisi yalniz tarih degisti diye commit atmasin.
export function aktivite(days, stamp) {
  const W = 1000;
  const H = 300;
  const son = days.slice(-90);
  if (!son.length)
    return kok(W, H, "Contribution graph: no data", `${zemin(W, H, { r: 16 })}<defs>${stil()}</defs>${kicker(24, 44, 270, "Last 90 days")}
  <text class="mono" x="${W / 2}" y="${H / 2 + 10}" font-size="13" text-anchor="middle" fill="${S.mistDim}">no contribution data</text>`);
  const mx = Math.max(1, ...son.map((d) => d.count));
  const toplam = son.reduce((s, d) => s + d.count, 0);
  const x0 = 28;
  const x1 = W - 28;
  const yb = 250;
  const yh = 140;
  const bw = (x1 - x0) / son.length;
  let sut = "";
  let pts = [];
  let tepe = 0;
  son.forEach((d, i) => {
    const h = (d.count / mx) * yh;
    const x = x0 + i * bw;
    if (d.count >= son[tepe].count) tepe = i;
    if (d.count > 0)
      sut += `<rect x="${f1(x + 1)}" y="${f1(yb - h)}" width="${f1(bw - 2)}" height="${f1(Math.max(1.5, h))}" rx="1.5" fill="${S.gold}" opacity="${f1(0.35 + (d.count / mx) * 0.6)}" style="transform-box: fill-box; transform-origin: bottom; animation: ak-b 1s cubic-bezier(.16,1,.3,1) ${f1(0.2 + i * 0.012)}s backwards" />`;
    else sut += `<rect x="${f1(x + bw / 2 - 1)}" y="${yb - 2}" width="2" height="2" fill="${S.rule}" />`;
    pts.push([x + bw / 2, yb - h]);
  });
  // yumusak egri (Catmull-Rom -> Bezier). Kontrol noktalari cizim alanina
  // kistirilir: yoksa sifir gunun yanindaki tepe egriyi eksenin altina (eksi
  // katki) sarkitiyor.
  const ky = (v) => f1(Math.min(yb, Math.max(yb - yh, v)));
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${ky(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${ky(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  const egri = uid("eg");
  let hafta = "";
  for (let i = 0; i < son.length; i += 7) {
    const x = x0 + i * bw;
    hafta += `<line x1="${f1(x)}" y1="${yb + 6}" x2="${f1(x)}" y2="${yb + 12}" stroke="${S.goldLo}" />`;
  }
  const tx = pts[tepe][0];
  const ty = pts[tepe][1];
  const tarih = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : s);
  const solda = tx > W - 200;
  const ic = `
  ${zemin(W, H, { r: 16, parilti: { cx: tx, cy: ty, r: 380, o: 0.1 } })}
  <defs>
    <linearGradient id="dolgu" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${S.goldHi}" stop-opacity=".22" /><stop offset="1" stop-color="${S.goldHi}" stop-opacity="0" />
    </linearGradient>
    ${stil(`@keyframes ak-b { from { transform: scaleY(0); } }`)}
  </defs>
  ${kicker(24, 44, 270, "Last 90 days", { gec: 0.1 })}
  <text class="mono" x="${W - 24}" y="44" font-size="12" text-anchor="end" fill="${S.mist}"><tspan fill="${S.goldHi}">${toplam}</tspan> contributions · busiest day <tspan fill="${S.goldHi}">${son[tepe].count}</tspan></text>
  ${[0.25, 0.5, 0.75, 1].map((k) => `<line x1="${x0}" y1="${f1(yb - yh * k)}" x2="${x1}" y2="${f1(yb - yh * k)}" stroke="${S.ruleSoft}" stroke-dasharray="2 6" />`).join("")}
  <line x1="${x0}" y1="${yb + 0.5}" x2="${x1}" y2="${yb + 0.5}" stroke="${S.rule}" />
  ${sut}
  <path d="${d}L${f1(pts.at(-1)[0])} ${yb}L${f1(pts[0][0])} ${yb}Z" fill="url(#dolgu)" class="fade" style="animation-delay:1.2s" />
  <path id="${egri}" d="${d}" fill="none" stroke="${S.phosphor}" stroke-width="1.4" stroke-opacity=".9" pathLength="100" stroke-dasharray="100" class="draw" style="--len:100;animation-duration:2.4s;animation-delay:.8s" />
  ${gezgin(egri, { sure: 9, gec: 3, r: 2.6 })}
  ${hafta}
  <g class="rise" style="animation-delay:1.6s">
    <line x1="${f1(tx)}" y1="${f1(ty - 6)}" x2="${f1(tx)}" y2="${f1(ty - 30)}" stroke="${S.ember}" stroke-dasharray="2 3" />
    <circle cx="${f1(tx)}" cy="${f1(ty)}" r="4.5" fill="${S.ember}" /><circle class="breathe" cx="${f1(tx)}" cy="${f1(ty)}" r="10" fill="none" stroke="${S.ember}" />
    <text class="mono" x="${f1(solda ? tx - 8 : tx + 8)}" y="${f1(ty - 24)}" font-size="11" ${solda ? 'text-anchor="end" ' : ""}fill="${S.ember}">${esc(tarih(son[tepe].date))} · ${son[tepe].count}</text>
  </g>
  <text class="mono" x="${x0}" y="${yb + 30}" font-size="10.5" fill="${S.mistDim}">${esc(tarih(son[0].date))}</text>
  <text class="mono" x="${x1}" y="${yb + 30}" font-size="10.5" text-anchor="end" fill="${S.mistDim}">${esc(tarih(son.at(-1).date))} · updated <tspan class="tarih">${esc(stamp)}</tspan></text>`;
  return kok(W, H, `Contribution graph, last 90 days: ${toplam} contributions`, ic);
}

// ---------------------------------------------------------------- alt bilgi

// Seyir defteri: 360° dikis, rota satiri (NRW -> Kabil) uzerinde giden ibre,
// kayit seridi (kayan derece cetveli) ve imza.
export function altbilgi() {
  const W = 1000;
  const H = 220;
  const yol = uid("ro");
  const yx0 = 250;
  const yx1 = 750;
  let cetvel = "";
  for (let d = 0; d <= 720; d += 5) {
    const x = d * 3;
    const uzun = d % 45 === 0;
    cetvel += `<line x1="${x}" y1="${H - 30}" x2="${x}" y2="${H - (uzun ? 44 : 37)}" stroke="${uzun ? S.goldLo : S.rule}" />`;
    if (uzun) cetvel += `<text class="mono" x="${x}" y="${H - 50}" font-size="9" text-anchor="middle" fill="${S.mistDim}">${String(d % 360).padStart(3, "0")}</text>`;
  }
  const ic = `
  <defs>
    <linearGradient id="sol" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0" /><stop offset=".15" stop-color="#fff" /><stop offset=".85" stop-color="#fff" /><stop offset="1" stop-color="#fff" stop-opacity="0" />
    </linearGradient>
    <mask id="sm"><rect width="${W}" height="${H}" fill="url(#sol)" /></mask>
    ${stil(`.kay { animation: kay 60s linear infinite; } @keyframes kay { to { transform: translateX(-1080px); } }`)}
  </defs>
  ${zemin(W, H, { r: 16, parilti: { cx: W / 2, cy: 80, r: 420, o: 0.08 } })}
  ${dikis(0, W, 18, 0, { gec: 0.4 })}
  <text class="mono" x="72" y="23" font-size="12" letter-spacing="1.6" fill="${S.gold}">360° · END OF LOG</text>
  <text class="mono" x="${yx0 - 16}" y="${76}" font-size="11.5" text-anchor="end" fill="${S.foam}">NRW</text>
  <text class="mono" x="${yx0 - 16}" y="${92}" font-size="10" text-anchor="end" fill="${S.mistDim}">51°13′N 6°46′E</text>
  <text class="mono" x="${yx1 + 16}" y="${76}" font-size="11.5" fill="${S.foam}">KABUL</text>
  <text class="mono" x="${yx1 + 16}" y="${92}" font-size="10" fill="${S.mistDim}">34°33′N 69°12′E</text>
  <path id="${yol}" d="M${yx0} 80H${yx1}" stroke="${S.goldLo}" stroke-dasharray="3 6" class="flow" />
  <circle cx="${yx0}" cy="80" r="4" fill="${S.gold}" /><circle cx="${yx1}" cy="80" r="4" fill="${S.goldHi}" />
  ${gezgin(yol, { sure: 7, r: 3 })}
  ${gezgin(yol, { sure: 7, gec: 3.5, r: 2 })}
  <text class="mono" x="${W / 2}" y="${110}" font-size="10.5" letter-spacing="1" text-anchor="middle" fill="${S.mistDim}">5,236 KM · BEARING 085° · 25.6 MS</text>
  <text class="it" x="${W / 2}" y="${142}" font-size="19" text-anchor="middle" fill="${S.goldHi}">Fair winds — Farhad</text>
  <g mask="url(#sm)"><g class="kay">${cetvel}</g></g>
  <path d="M${W / 2 - 5} ${H - 52}H${W / 2 + 5}L${W / 2} ${H - 45}Z" fill="${S.ember}" />
  <line x1="0" y1="${H - 29.5}" x2="${W}" y2="${H - 29.5}" stroke="${S.rule}" />`;
  return kok(W, H, "", ic);
}
