// «NRW ⇄ Kabil» kopru haritasi (fyajan.com/projects'teki haritanin karti).
// Iki ulke ayni olcekte (gercek boy orani), her biri kendi yerel duzleminde;
// aradaki 5.000 km'lik bosluk bir yayla gosterilir. Veri: harita.json
// (fy-ajans/tools/build-harita.mjs, Natural Earth 1:50m, kamu mali).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { S, esc, f1, kir, uid, kok, stil, zemin, koseler, koseStil, kicker, gezgin, cip } from "./kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const H_ = JSON.parse(readFileSync(join(HERE, "..", "harita.json"), "utf8"));

const ADLAR = {
  dus: "NRW · FY",
  ber: "Berlin",
  ham: "Hamburg",
  muc: "Munich",
  fra: "Frankfurt",
  kbl: "Kabul",
  hrt: "Herat",
  mzr: "Mazar-i-Sharif",
  knd: "Kunduz",
  fyz: "Faizabad",
  bmy: "Bamyan",
  gzn: "Ghazni",
  kdh: "Kandahar",
  jlb: "Jalalabad",
};

// Ulkeyi (ox, oy) sol-ust koseye, s px/km olcekle cizer.
function ulke(u, ox, oy, s, { gec = 0 } = {}) {
  const raw = Buffer.from(u.grid, "base64");
  const X = (km) => f1(ox + (km - u.x0) * s);
  const Y = (km) => f1(oy + (km - u.y0) * s);
  let d = "";
  for (let i = 0; i < u.cols * u.rows; i++) {
    if (!((raw[i >> 3] >> (i & 7)) & 1)) continue;
    const c = i % u.cols;
    const r = (i - c) / u.cols;
    d += `M${X(u.x0 + (c + 0.5) * u.pitch)} ${Y(u.y0 + (r + 0.5) * u.pitch)}h0`;
  }
  const halka = u.ring
    .map((r) => {
      let p = "";
      for (let k = 0; k < r.length; k += 2) p += `${k ? "L" : "M"}${X(r[k])} ${Y(r[k + 1])}`;
      return p + "Z";
    })
    .join("");
  return {
    X,
    Y,
    svg: `<g class="fade" style="animation-delay:${gec}s"><path d="${d}" stroke="${S.goldLo}" stroke-opacity=".75" stroke-width="2.6" stroke-linecap="round" /></g>
    <path d="${halka}" fill="none" stroke="${S.gold}" stroke-opacity=".7" stroke-width="1.1" pathLength="100" stroke-dasharray="100" class="draw" style="--len:100;animation-duration:2.6s;animation-delay:${gec}s" />`,
  };
}

function sehir(x, y, ad, { ana = false, sag = true, gec = 0 } = {}) {
  const k = uid("ch");
  const tw0 = ad.length * 6.6 + 14;
  const lx = sag ? x + 8 : x - 8 - tw0;
  return `<g class="rise" style="animation-delay:${gec}s">
    ${ana ? `<style>.${k} { transform-box: fill-box; transform-origin: center; animation: ${k} 2.8s ease-out ${gec}s infinite; } @keyframes ${k} { from { transform: scale(.4); opacity: .9; } to { transform: scale(3); opacity: 0; } }</style><circle class="${k}" cx="${x}" cy="${y}" r="7" fill="none" stroke="${S.goldHi}" />` : ""}
    <circle cx="${x}" cy="${y}" r="${ana ? 4.5 : 3}" fill="${ana ? S.goldHi : S.gold}" />
    <rect x="${f1(lx)}" y="${f1(y - 10)}" width="${f1(tw0)}" height="20" rx="10" fill="${S.void}" fill-opacity=".85" stroke="${ana ? S.goldLo : S.rule}" />
    <text class="mono" x="${f1(lx + 7)}" y="${f1(y + 4)}" font-size="11" fill="${ana ? S.goldHi : S.foam}">${esc(ad)}</text>
  </g>`;
}

export function harita() {
  const W = 1000;
  const H = 560;
  const s = 0.39;
  const de = H_.de;
  const af = H_.af;
  const deO = { x: 118, y: H - 34 - de.h * s };
  const afO = { x: W - 30 - af.w * s, y: H - 40 - af.h * s };
  const D = ulke(de, deO.x, deO.y, s, { gec: 0.2 });
  const A = ulke(af, afO.x, afO.y, s, { gec: 0.5 });
  const dus = de.city[0];
  const kbl = af.city[0];
  const x1 = +D.X(dus.x);
  const y1 = +D.Y(dus.y);
  const x2 = +A.X(kbl.x);
  const y2 = +A.Y(kbl.y);
  const yay = uid("ya");
  const mx = (x1 + x2) / 2;
  const tepe = Math.min(y1, y2) - 170;
  const yol = `M${f1(x1)} ${f1(y1)}Q${f1(mx)} ${f1(tepe)} ${f1(x2)} ${f1(y2)}`;

  let sehirler = "";
  // Etiketli sehirler: kalabalik olmasin diye bir kismi yalnizca nokta
  const ETIKET = { ber: 1, ham: 1, muc: 1, fra: 1, hrt: 1, mzr: 0, fyz: 1, kdh: 1 };
  const nokta = (x, y) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${S.gold}" />`;
  de.city.slice(1).forEach((c, i) => (sehirler += c.id in ETIKET ? sehir(+D.X(c.x), +D.Y(c.y), ADLAR[c.id], { gec: 1 + i * 0.08, sag: !!ETIKET[c.id] }) : nokta(D.X(c.x), D.Y(c.y))));
  af.city.slice(1).forEach((c, i) => (sehirler += c.id in ETIKET ? sehir(+A.X(c.x), +A.Y(c.y), ADLAR[c.id], { gec: 1.3 + i * 0.08, sag: !!ETIKET[c.id] }) : nokta(A.X(c.x), A.Y(c.y))));
  sehirler += sehir(x1, y1, ADLAR.dus, { ana: true, sag: false, gec: 0.9 });
  sehirler += sehir(x2, y2, ADLAR.kbl, { ana: true, gec: 1.2 });

  const km = H_.km.toLocaleString("en-US");
  const metinE = `${km} km · ${String(H_.brg).padStart(3, "0")}°`;
  const tepeY = (y1 + 2 * tepe + y2) / 4;
  const ew = cip(0, 0, metinE, { boy: 12, h: 26 }).w;
  const etiket = cip(mx - ew / 2, tepeY - 40, metinE, { boy: 12, ton: "gold", h: 26 });

  const ic = `
  ${zemin(W, H, { r: 16, parilti: { cx: x2, cy: y2, r: 420, o: 0.12 } })}
  <defs>${stil(koseStil)}</defs>
  ${kicker(28, 52, 45, "51°13′N 6°46′E  →  34°33′N 69°12′E", { gec: 0.1 })}
  <g class="rise" style="animation-delay:.2s"><text class="serif" x="26" y="106" font-size="44" letter-spacing="-.6" fill="${S.foam}">Written in NRW, running in Afghanistan</text></g>
  <g class="rise" style="animation-delay:.3s"><text class="it" x="28" y="140" font-size="20" fill="${S.goldHi}">Light in fibre crosses the gap in ${H_.ms} ms; the power grid is another story.</text></g>
  ${koseler(deO.x - 14, deO.y - 14, de.w * s + 28, de.h * s + 28, { L: 12, o: 0.6, gec: 0.3 })}
  ${koseler(afO.x - 14, afO.y - 14, af.w * s + 28, af.h * s + 28, { L: 12, o: 0.6, gec: 0.5 })}
  ${D.svg}
  ${A.svg}
  <path id="${yay}" d="${yol}" fill="none" stroke="${S.gold}" stroke-opacity=".75" stroke-width="1.3" pathLength="100" stroke-dasharray="100" class="draw" style="--len:100;animation-duration:2.2s;animation-delay:1s" />
  <path d="${yol}" fill="none" stroke="${S.goldHi}" stroke-opacity=".35" stroke-dasharray="2 10" class="flow" />
  ${gezgin(yay, { sure: 3.4, gec: 2, r: 3 })}
  ${gezgin(yay, { sure: 3.4, gec: 3.7, r: 2.2 })}
  <g class="fade" style="animation-delay:1.8s">${etiket.svg}</g>
  ${sehirler}`;
  return kok(W, H, `Written in NRW, running in Afghanistan — ${km} km between them`, ic);
}
