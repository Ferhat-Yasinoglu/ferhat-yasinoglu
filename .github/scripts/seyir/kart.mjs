// Proje kartlari: iki sablon.
//   ikili(p) : 500 x 416, README'de yan yana iki kart (katalog duvari)
//   genis(p) : 1000 x ~360, one cikan proje (Pusula, fyajan.com, harita)
// Her kartin ust/sol kisminda projenin kendi canli cizimi (sanat.mjs) durur.

import { S, esc, f1, tw, kir, uid, kok, stil, zemin, koseler, koseStil, kadran, cip, cipler } from "./kit.mjs";
import { SANAT } from "./sanat.mjs";

const DURUM = {
  live: { metin: "LIVE", ton: "ember", led: "nefes" },
  open: { metin: "OPEN SOURCE", ton: "gold", led: "gold" },
  source: { metin: "SOURCE ON GITHUB", ton: "gold", led: "gold" },
  internal: { metin: "IN-HOUSE", ton: "dim", led: null },
  private: { metin: "PRIVATE BETA", ton: "dim", led: null },
};

// Sanat kutusu: koyu deck paneli, kendi ince izgarasi ve kose L'leri.
function sanatKutu(p, x, y, w, h) {
  const pat = uid("ap");
  const cl = uid("ac");
  const fn = SANAT[p.sanat];
  return `
  <defs>
    <pattern id="${pat}" x="${x}" y="${y}" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0H0V24" fill="none" stroke="${S.gold}" stroke-opacity=".055" />
    </pattern>
    <clipPath id="${cl}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" /></clipPath>
  </defs>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${S.deck}" />
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="url(#${pat})" />
  <g clip-path="url(#${cl})"><g transform="translate(${x} ${y})">${fn ? fn(x, y, w, h, p) : ""}</g></g>
  <rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="9.5" fill="none" stroke="${S.rule}" />
  ${koseler(x - 4, y - 4, w + 8, h + 8, { L: 10, o: 0.7, gec: 0.1 })}`;
}

function durumCip(p, x, y) {
  const d = DURUM[p.durum] || DURUM.live;
  return cip(x, y, d.metin, { ton: d.ton, led: d.led, boy: 11, h: 22, sag: true }).svg;
}

function baslikSatiri(p, x, y, boy, maxX) {
  let s = `<text class="serif" x="${x - 1}" y="${y}" font-size="${boy}" letter-spacing="-.4" fill="${S.foam}">${esc(p.ad)}</text>`;
  if (p.fa) {
    const fx = f1(x + tw(p.ad, boy, "serif", { ls: -0.4 }) + 14);
    if (fx + tw(p.fa, boy * 0.52, "fa") < maxX)
      s += `<text class="fa" x="${fx}" y="${y - 2}" font-size="${f1(boy * 0.52)}" fill="${S.goldLo}">${esc(p.fa)}</text>`;
  }
  return s;
}

function kickerSatir(x, y, p) {
  const no = String(p.no).padStart(2, "0");
  const derece = String(p.aci).padStart(3, "0") + "°";
  return `${kadran(x + 9, y - 4, 9, p.aci, { gec: 0.3 })}
  <text class="mono" x="${x + 26}" y="${y}" font-size="11.5" letter-spacing="1.4" fill="${S.gold}">${derece} · ${no}  ·  ${esc(p.tur.toUpperCase())}</text>`;
}

// ---------------------------------------------------------------- ikili

export function ikili(p, H = 416) {
  const W = 500;
  const ax = 16;
  const ay = 16;
  const aw = W - 32;
  const ah = 160;
  const x = 24;
  const maxW = W - 48;
  const acik = kir(p.aciklama, 13.5, maxW, "sans");
  if (acik.length > 4) console.warn(`uyari: ${p.ad} aciklamasi ${acik.length} satir (en cok 4)`);
  if (cipler(0, 0, p.cipler, maxW, { boy: 11, h: 22 }).y > 22) console.warn(`uyari: ${p.ad} cipleri tek satira sigmiyor`);
  let y = ay + ah + 32;
  const ic = `
  ${zemin(W, H, { r: 14, parilti: { cx: W * 0.7, cy: 40, r: 320, o: 0.07 } })}
  <defs>${stil(koseStil + (p.stil || ""))}</defs>
  ${sanatKutu(p, ax, ay, aw, ah)}
  <g class="rise" style="animation-delay:.1s">${kickerSatir(x, y, p)}${durumCip(p, W - 24, y - 15)}</g>
  <g class="rise" style="animation-delay:.18s">${baslikSatiri(p, x, (y += 40), 34, W - 24)}</g>
  <g class="rise" style="animation-delay:.26s"><text class="it" x="${x}" y="${(y += 28)}" font-size="17.5" fill="${S.goldHi}">${esc(p.italik)}</text></g>
  <g class="rise" style="animation-delay:.34s">${acik
    .map((t, i) => `<text x="${x}" y="${f1(y + 27 + i * 19.5)}" font-size="13.5" fill="${S.mist}">${esc(t)}</text>`)
    .join("")}</g>
  <g class="fade" style="animation-delay:.5s">${cipler(x, H - 42, p.cipler, maxW, { boy: 11, h: 22, ton: "mist" }).svg}</g>`;
  return kok(W, H, `${p.ad} — ${p.italik} ${p.aciklama}`, ic);
}

// ---------------------------------------------------------------- genis

export function genis(p) {
  const W = 1000;
  const ax = 16;
  const ay = 16;
  const aw = p.sanatW || 440;
  const x = ax + aw + 32;
  const maxW = W - x - 28;
  const acik = kir(p.aciklama, 15, maxW, "sans");
  let y = 64;
  let govde = `
  <g class="rise" style="animation-delay:.1s">${kickerSatir(x, y, p)}</g>
  <g class="rise" style="animation-delay:.18s">${baslikSatiri(p, x, (y += 50), 46, W - 24)}</g>
  <g class="rise" style="animation-delay:.26s">${kir(p.italik, 21, maxW, "it")
    .map((t) => `<text class="it" x="${x}" y="${(y += 32)}" font-size="21" fill="${S.goldHi}">${esc(t)}</text>`)
    .join("")}</g>
  <g class="rise" style="animation-delay:.34s">${acik
    .map((t, i) => `<text x="${x}" y="${f1(y + 32 + i * 22)}" font-size="15" fill="${S.mist}">${esc(t)}</text>`)
    .join("")}</g>`;
  y += 32 + (acik.length - 1) * 22 + 22;
  if (p.olcum?.length) {
    const hw = maxW / p.olcum.length;
    govde += `<g class="fade" style="animation-delay:.6s">` + p.olcum
      .map(
        (o, i) => `${i ? `<line x1="${f1(x + i * hw - 10)}" y1="${y + 6}" x2="${f1(x + i * hw - 10)}" y2="${y + 48}" stroke="${S.rule}" />` : ""}
        <text class="mono" x="${f1(x + i * hw)}" y="${y + 34}" font-size="28" font-weight="500" fill="${S.goldHi}">${esc(o.deger)}</text>
        <text class="mono" x="${f1(x + i * hw)}" y="${y + 52}" font-size="10.5" letter-spacing="1" fill="${S.mistDim}">${esc(o.etiket.toUpperCase())}</text>`
      )
      .join("") + `</g>`;
    y += 70;
  }
  const c = cipler(x, y, p.cipler, maxW, { boy: 11, h: 22, ton: "mist" });
  govde += `<g class="fade" style="animation-delay:.5s">${c.svg}</g>`;
  const H = Math.max(p.minH || 360, c.y + 28);
  const ah = H - 32;
  const ic = `
  ${zemin(W, H, { r: 16, parilti: { cx: ax + aw / 2, cy: H / 2, r: 420, o: 0.12 } })}
  <defs>${stil(koseStil + (p.stil || ""))}</defs>
  ${sanatKutu(p, ax, ay, aw, ah)}
  ${durumCip(p, W - 24, 24)}
  ${govde}`;
  return kok(W, H, `${p.ad} — ${p.italik} ${p.aciklama}`, ic);
}
