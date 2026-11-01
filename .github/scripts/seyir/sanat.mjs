// Projelerin canli cizimleri. Her fonksiyon (x, y, w, h) kutusuna cizer ve
// SVG metni dondurur; kutu kart sablonunda kirpilir. Cizimler kutunun yerel
// koordinatinda tasarlanir (T ile kaydirilir). Dongusel hareketler "pencere"
// ile kurulur: bir oge, turun belli bir diliminde gorunur.

import { S, esc, f1, tw, uid, ibre, kadran, yildiz8, yildiz4, gezgin, yaz, sayac } from "./kit.mjs";

const T = (x, y, ic) => `<g transform="translate(${x} ${y})">${ic}</g>`;
const rad = (d) => (d * Math.PI) / 180;

const yazi = (x, y, t, { boy = 11, renk = S.mist, cls = "mono", anchor = "start", ls = 0, w = null, ek = "" } = {}) =>
  `<text class="${cls}" x="${f1(x)}" y="${f1(y)}" font-size="${boy}"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}${ls ? ` letter-spacing="${ls}"` : ""}${w ? ` font-weight="${w}"` : ""} fill="${renk}"${ek}>${esc(t)}</text>`;

// Tur icinde [a0, a1] (0..1) diliminde gorunen oge sinifi. Taban opaklik
// "sabit": animasyon calismazsa ya da hareket azaltilinca (tek tur, hemen
// biter) oge bu halde kalir. Varsayilan 1 (gorunur); birbirinin yerine gecen
// durumlarda (cevrimdisi/cevrimici, aktif saglayici) yalniz biri 1 olur.
function pencere(sure, a0, a1, { gec = 0, min = 0, yumusak = 0.015, sabit = 1 } = {}) {
  const k = uid("w");
  const p = (v) => f1(Math.max(0, Math.min(100, v * 100)));
  const css = `.${k} { opacity: ${sabit}; animation: ${k} ${sure}s linear ${gec}s infinite backwards; }
    @keyframes ${k} { 0%, ${p(a0)}% { opacity: ${min}; } ${p(a0 + yumusak)}%, ${p(a1 - yumusak)}% { opacity: 1; } ${p(a1)}%, 100% { opacity: ${min}; } }`;
  return { k, css };
}

// Bir grup pencereyi tek <style>'da toplar
function pencereler(liste) {
  const css = liste.map((p) => p.css).join("\n");
  return `<style>${css}</style>`;
}

const kutu = (x, y, w, h, { r = 6, fill = S.bezel, stroke = S.rule, o = 1, ek = "" } = {}) =>
  `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${r}" fill="${fill}" stroke="${stroke}"${o !== 1 ? ` opacity="${o}"` : ""}${ek} />`;

const hap = (x, y, t, { boy = 10.5, renk = S.foam, kenar = S.rule, zem = S.bezel, h = 20, led = null } = {}) => {
  const w = tw(t, boy, "mono") + 16 + (led ? 10 : 0);
  return {
    w,
    svg: `${kutu(x, y, w, h, { r: h / 2, fill: zem, stroke: kenar })}${led ? `<circle cx="${f1(x + 10)}" cy="${f1(y + h / 2)}" r="2.6" fill="${led}" />` : ""}${yazi(x + 8 + (led ? 10 : 0), y + h / 2 + boy * 0.36, t, { boy, renk })}`,
  };
};

// Sabit tohumlu sozde rastgele (her uretimde ayni kart)
function rnd(tohum) {
  let s = tohum >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---------------------------------------------------------------- Pusula

function pusula(x, y, w, h) {
  const araclar = ["Claude Code", "Codex", "Cursor", "Cline", "Copilot"];
  const saglayici = ["Claude", "GPT", "Gemini", "Groq", "Mistral", "Qwen"];
  const hx = w * 0.5;
  const hy = h * 0.42;
  const sure = saglayici.length * 2.6;
  const n = saglayici.length;
  let s = "";
  let stilK = [];
  // sol: araclar
  araclar.forEach((a, i) => {
    const ay = 34 + i * 38;
    const hp = hap(14, ay, a, { boy: 10.5 });
    const yid = uid("pa");
    s += `<path id="${yid}" d="M${f1(14 + hp.w)} ${ay + 10}C${f1(hx - 70)} ${ay + 10} ${f1(hx - 80)} ${hy} ${f1(hx - 44)} ${hy}" fill="none" stroke="${S.goldLo}" stroke-opacity=".55" stroke-dasharray="3 5" class="flow" />`;
    s += hp.svg + gezgin(yid, { sure: 2.2 + i * 0.35, gec: i * 0.5, r: 2 });
  });
  // sag: saglayicilar ve yollar
  const px = w - 86;
  const acilar = [];
  saglayici.forEach((a, i) => {
    const py = 26 + i * 33;
    const yid = uid("pp");
    const ac = (Math.atan2(px - hx, -(py + 10 - hy)) * 180) / Math.PI;
    acilar.push(ac);
    const aktif = pencere(sure, i / n, (i + 1) / n, { gec: 0.6, sabit: i === 0 ? 1 : 0 });
    const kapali = pencere(sure, (i + 1) / n, Math.min(1, (i + 2.4) / n), { gec: 0.6, yumusak: 0.01, sabit: 0 });
    stilK.push(aktif, kapali);
    s += `<path id="${yid}" d="M${f1(hx + 44)} ${f1(hy)}C${f1(hx + 90)} ${f1(hy)} ${f1(px - 50)} ${py + 10} ${px} ${py + 10}" fill="none" stroke="${S.rule}" />`;
    s += `<g class="${aktif.k}"><path d="M${f1(hx + 44)} ${f1(hy)}C${f1(hx + 90)} ${f1(hy)} ${f1(px - 50)} ${py + 10} ${px} ${py + 10}" fill="none" stroke="${S.goldHi}" stroke-opacity=".85" stroke-width="1.4" stroke-dasharray="4 4" class="flow" />${gezgin(yid, { sure: 1.1, r: 2.4 })}</g>`;
    const hp = hap(px, py, a, { boy: 10.5, led: S.goldLo });
    s += hp.svg;
    s += `<g class="${aktif.k}">${kutu(px, py, hp.w, 20, { r: 10, fill: "rgba(255,211,110,.10)", stroke: S.goldHi })}<circle cx="${px + 10}" cy="${py + 10}" r="2.6" fill="${S.goldHi}" /></g>`;
    s += `<g class="${kapali.k}">${kutu(px, py, hp.w, 20, { r: 10, fill: "rgba(255,122,69,.08)", stroke: S.ember, ek: ' stroke-dasharray="3 3"' })}${yazi(px + hp.w + 6, py + 14, "429", { boy: 9.5, renk: S.ember })}</g>`;
  });
  // merkez: Pusula gobegi, ibre aktif saglayiciya doner
  const kare = [];
  acilar.forEach((a, i) => {
    const p0 = (i / n) * 100;
    kare.push(`${f1(p0)}% { transform: rotate(${f1(a)}deg); }`);
    kare.push(`${f1(p0 + 100 / n - 4)}% { transform: rotate(${f1(a)}deg); animation-timing-function: cubic-bezier(.3,1.5,.45,1); }`);
  });
  kare.push(`100% { transform: rotate(${f1(acilar[0] + 360 * 0)}deg); }`);
  const ib = uid("pi");
  let centik = "";
  for (let i = 0; i < 36; i++) {
    const a = rad(i * 10);
    const r1 = i % 9 === 0 ? 34 : 38;
    centik += `<line x1="${f1(hx + r1 * Math.sin(a))}" y1="${f1(hy - r1 * Math.cos(a))}" x2="${f1(hx + 42 * Math.sin(a))}" y2="${f1(hy - 42 * Math.cos(a))}" stroke="${i % 9 === 0 ? S.gold : S.goldLo}" />`;
  }
  s += `<g class="breathe"><circle cx="${hx}" cy="${f1(hy)}" r="64" fill="${S.gold}" opacity=".08" /></g>
    <circle cx="${hx}" cy="${f1(hy)}" r="44" fill="${S.void}" stroke="${S.goldLo}" />${centik}
    <style>.${ib} { transform-origin: ${hx}px ${f1(hy)}px; animation: ${ib} ${sure}s linear .6s infinite backwards; } @keyframes ${ib} { ${kare.join(" ")} }</style>
    <g class="${ib}"><path d="M${hx} ${f1(hy - 30)}L${hx + 5} ${f1(hy)}H${hx - 5}Z" fill="${S.ember}" /><path d="M${hx - 5} ${f1(hy)}H${hx + 5}L${hx} ${f1(hy + 24)}Z" fill="${S.gold}" /></g>
    <circle cx="${hx}" cy="${f1(hy)}" r="4" fill="${S.gold}" /><circle cx="${hx}" cy="${f1(hy)}" r="1.6" fill="${S.goldHi}" />
    ${yazi(hx, hy + 62, "PUSULA · /v1", { boy: 10.5, renk: S.gold, anchor: "middle", ls: 1.4 })}`;
  // alt: sikistirma cubugu
  const by = h - 54;
  const bw = w - 28;
  const kb = uid("pk");
  s += `${yazi(14, by - 8, "RTK + CAVEMAN COMPRESSION", { boy: 9.5, renk: S.mistDim, ls: 1.2 })}
    ${kutu(14, by, bw, 14, { r: 7, fill: S.bezel })}
    <style>.${kb} { transform-origin: 14px 0; animation: ${kb} 6s cubic-bezier(.65,0,.35,1) 1s infinite backwards; }
      @keyframes ${kb} { 0%, 15% { transform: scaleX(1); } 55%, 85% { transform: scaleX(.108); } 100% { transform: scaleX(1); } }</style>
    <rect class="${kb}" x="14" y="${by}" width="${bw}" height="14" rx="7" fill="${S.gold}" opacity=".85" />
    ${yazi(14, by + 32, "10,000 tok", { boy: 10.5, renk: S.mist })}
    ${yazi(14 + bw, by + 32, "→ ~1,080 tok in the stacked example", { boy: 10.5, renk: S.goldHi, anchor: "end" })}`;
  return pencereler(stilK) + s;
}

// ---------------------------------------------------------------- Dawayar

function dawayar(x, y, w, h) {
  const R = rnd(7);
  let s = "";
  // barkod
  let bx = 22;
  let bars = "";
  while (bx < 132) {
    const bw = [1, 1, 2, 3][Math.floor(R() * 4)];
    bars += `<rect x="${bx}" y="36" width="${bw}" height="66" fill="${S.foam}" opacity=".88" />`;
    bx += bw + [1, 2, 2, 3][Math.floor(R() * 4)];
  }
  const lz = uid("dl");
  s += `${kutu(14, 26, 126, 98, { r: 6, fill: S.void })}${bars}
    ${yazi(77, 116, "6 291041 500213", { boy: 9.5, renk: S.mist, anchor: "middle", ls: 0.6 })}
    <style>.${lz} { animation: ${lz} 2.4s cubic-bezier(.37,0,.63,1) infinite alternate; } @keyframes ${lz} { from { transform: translateY(0); } to { transform: translateY(62px); } }</style>
    <g class="${lz}"><rect x="16" y="38" width="122" height="7" fill="${S.ember}" opacity=".16" /><rect x="16" y="41" width="122" height="1.5" fill="${S.ember}" /></g>`;
  // fis
  const fx = 160;
  const kalem = [
    ["Paracetamol 500", "x2"],
    ["Amoxicillin 250", "x1"],
    ["ORS sachet", "x4"],
  ];
  const sure = 9;
  const pen = [];
  let fis = `<path d="M${fx} 16H${fx + 128}V140l-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6V16Z" fill="${S.bezel}" stroke="${S.rule}" />
    ${yazi(fx + 10, 33, "RECEIPT", { boy: 9.5, renk: S.gold, ls: 1 })}${yazi(fx + 118, 34, "دوایار", { boy: 11, renk: S.goldHi, anchor: "end", cls: "fa" })}
    <line x1="${fx + 10}" y1="42" x2="${fx + 118}" y2="42" stroke="${S.rule}" stroke-dasharray="2 3" />`;
  kalem.forEach(([a, b], i) => {
    const p = pencere(sure, 0.05 + i * 0.12, 0.92, { gec: 0.4 });
    pen.push(p);
    fis += `<g class="${p.k}">${yazi(fx + 10, 60 + i * 17, a, { boy: 9.5, renk: S.foam })}${yazi(fx + 118, 60 + i * 17, b, { boy: 9.5, renk: S.mist, anchor: "end" })}</g>`;
  });
  const top = pencere(sure, 0.45, 0.92, { gec: 0.4 });
  pen.push(top);
  fis += `<g class="${top.k}"><line x1="${fx + 10}" y1="${f1(60 + 3 * 17 - 6)}" x2="${fx + 118}" y2="${f1(60 + 3 * 17 - 6)}" stroke="${S.rule}" />
    ${yazi(fx + 10, 126, "TOTAL", { boy: 10, renk: S.gold, ls: 1 })}${yazi(fx + 118, 126, "1,250 AFG", { boy: 11, renk: S.goldHi, anchor: "end", w: 600 })}</g>`;
  s += fis;
  // cihazlar ve esitleme
  const dx = 312;
  const off = pencere(sure, 0, 0.5, { gec: 0.4, sabit: 0 });
  const on = pencere(sure, 0.5, 1, { gec: 0.4 });
  pen.push(off, on);
  const yid = uid("dy");
  s += `${kutu(dx, 72, 62, 42, { r: 4, fill: S.void })}<rect x="${dx - 6}" y="114" width="74" height="5" rx="2" fill="${S.rule}" />
    ${kutu(dx + 104, 64, 30, 54, { r: 5, fill: S.void })}
    ${yazi(dx + 31, 97, "PC", { boy: 9.5, renk: S.mistDim, anchor: "middle" })}${yazi(dx + 119, 95, "TEL", { boy: 8.5, renk: S.mistDim, anchor: "middle" })}
    <path id="${yid}" d="M${dx + 31} 70C${dx + 40} 26 ${dx + 110} 26 ${dx + 119} 62" fill="none" stroke="${S.goldLo}" stroke-dasharray="3 4" />
    <g class="${on.k}">${gezgin(yid, { sure: 1.6, r: 2.4 })}<path d="M${dx + 31} 70C${dx + 40} 26 ${dx + 110} 26 ${dx + 119} 62" fill="none" stroke="${S.goldHi}" stroke-opacity=".7" stroke-dasharray="3 4" class="flow" /></g>
    <g class="${off.k}">${hap(dx + 20, 132, "OFFLINE · SELLING", { boy: 9, renk: S.ember, kenar: S.ember, zem: "rgba(255,122,69,.08)", h: 18 }).svg}</g>
    <g class="${on.k}">${hap(dx + 30, 132, "ONLINE · SYNCED", { boy: 9, renk: S.goldHi, kenar: S.goldLo, h: 18 }).svg}</g>`;
  return pencereler(pen) + s;
}

// ---------------------------------------------------------------- Mini Dakhl

function minidakhl(x, y, w, h) {
  const satir = [
    ["AFG", "1,250,000", [3, 6, 4, 8, 7, 11, 10]],
    ["USD", "8,420", [6, 5, 7, 6, 9, 8, 10]],
    ["PKR", "312,500", [9, 7, 8, 5, 6, 4, 6]],
    ["EUR", "1,980", [2, 4, 3, 5, 7, 6, 9]],
  ];
  let s = yazi(18, 26, "BALANCES · EACH CURRENCY ITS OWN", { boy: 9.5, renk: S.mistDim, ls: 1.1 });
  satir.forEach(([kod, deger, seri], i) => {
    const yy = 42 + i * 28;
    const mx = Math.max(...seri);
    const pts = seri.map((v, k) => `${f1(78 + k * 14)},${f1(yy + 16 - (v / mx) * 14)}`).join(" ");
    s += `<g class="rise" style="animation-delay:${f1(0.3 + i * 0.12)}s">${kutu(14, yy - 4, 262, 24, { r: 5, fill: S.void })}
      ${yazi(24, yy + 12, kod, { boy: 11, renk: S.gold, w: 600 })}
      <polyline points="${pts}" fill="none" stroke="${S.goldHi}" stroke-width="1.3" pathLength="100" stroke-dasharray="100" class="draw" style="--len:100;animation-delay:${f1(0.6 + i * 0.15)}s" />
      ${yazi(266, yy + 12, deger, { boy: 11, renk: S.foam, anchor: "end" })}</g>`;
  });
  // havale yayi
  const yid = uid("mh");
  s += `<circle cx="318" cy="118" r="5" fill="${S.gold}" /><circle cx="318" cy="118" r="11" fill="none" stroke="${S.gold}" stroke-opacity=".4" class="breathe" />
    <circle cx="436" cy="70" r="5" fill="${S.gold}" /><circle cx="436" cy="70" r="11" fill="none" stroke="${S.gold}" stroke-opacity=".4" class="breathe" style="animation-delay:2s" />
    ${yazi(318, 142, "HERAT", { boy: 9.5, renk: S.mist, anchor: "middle", ls: 1 })}${yazi(436, 94, "KABUL", { boy: 9.5, renk: S.mist, anchor: "middle", ls: 1 })}
    <path id="${yid}" d="M318 118C330 40 410 30 436 70" fill="none" stroke="${S.goldLo}" stroke-dasharray="3 4" class="flow" />
    ${gezgin(yid, { sure: 3.2, r: 2.6 })}
    ${yazi(378, 34, "حواله", { boy: 13, renk: S.goldHi, anchor: "middle", cls: "fa" })}
    ${yazi(378, 50, "HAWALA · FEE", { boy: 9, renk: S.mistDim, anchor: "middle", ls: 1 })}`;
  return s;
}

// ---------------------------------------------------------------- Shafa

function qr(x0, y0, n, hucre, tohum, sure) {
  const R = rnd(tohum);
  let s = "";
  const bulucu = (bx, by) =>
    `<rect x="${x0 + bx * hucre}" y="${y0 + by * hucre}" width="${7 * hucre}" height="${7 * hucre}" fill="none" stroke="${S.foam}" stroke-width="${hucre}" transform="translate(${hucre / 2} ${hucre / 2})" />` +
    `<rect x="${x0 + (bx + 2) * hucre}" y="${y0 + (by + 2) * hucre}" width="${3 * hucre}" height="${3 * hucre}" fill="${S.foam}" />`;
  const icinde = (i, j) => (i < 8 && j < 8) || (i >= n - 8 && j < 8) || (i < 8 && j >= n - 8);
  const k = uid("q");
  let css = "";
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      if (icinde(i, j) || R() < 0.52) continue;
      const g = f1(((i + j) / (2 * n)) * 1.2);
      s += `<rect class="${k}" style="animation-delay:${g}s" x="${x0 + i * hucre}" y="${y0 + j * hucre}" width="${hucre}" height="${hucre}" fill="${S.foam}" />`;
    }
  css = `<style>.${k} { animation: ${k} ${sure}s ease-out infinite backwards; } @keyframes ${k} { 0% { opacity: 0; } 12%, 88% { opacity: 1; } 100% { opacity: 0; } }</style>`;
  return css + bulucu(0, 0) + bulucu(n - 7, 0) + bulucu(0, n - 7) + s;
}

function shafa(x, y, w, h) {
  let s = `${kutu(16, 12, 210, 136, { r: 4, fill: S.bezel })}
    <rect x="16" y="12" width="210" height="22" rx="4" fill="${S.goldDeep}" opacity=".35" />
    ${yazi(26, 27, "DR. — CLINIC · KABUL", { boy: 9, renk: S.goldHi, ls: 1 })}${yazi(216, 28, "شفا", { boy: 12, renk: S.goldHi, anchor: "end", cls: "fa" })}
    <text class="it" x="26" y="70" font-size="30" fill="${S.gold}">Rx</text>`;
  const satir = [118, 92, 132, 76];
  satir.forEach((L, i) => {
    s += `<line x1="64" y1="${54 + i * 18}" x2="${64 + L}" y2="${54 + i * 18}" stroke="${S.foam}" stroke-opacity=".55" stroke-width="2" stroke-linecap="round" pathLength="100" stroke-dasharray="100" class="draw" style="--len:100;animation-delay:${f1(0.5 + i * 0.35)}s;animation-duration:1s" />`;
  });
  s += `<path d="M150 134c8-12 14-12 12-2s8 4 12-4 6 2 10 0 8-6 14-2" fill="none" stroke="${S.goldHi}" stroke-width="1.4" pathLength="100" stroke-dasharray="100" class="draw" style="--len:100;animation-delay:2s" />
    ${hap(26, 120, "ALLERGY · PENICILLIN", { boy: 8.5, renk: S.ember, kenar: S.ember, zem: "rgba(255,122,69,.08)", h: 17 }).svg.replace("<rect", '<rect class="breathe"')}`;
  // QR ve dogrulama kodu
  s += `${kutu(252, 14, 96, 96, { r: 4, fill: S.void })}${qr(258, 20, 21, 4, 31, 7)}
    ${yazi(300, 128, "VERIFY CODE", { boy: 9, renk: S.mistDim, anchor: "middle", ls: 1.4 })}
    ${yaz(258, 146, [["K7QM", S.goldHi], ["-", S.mistDim], ["2XPA", S.goldHi]], { boy: 12, gec: 1.6, imlec: true })}
    ${yazi(370, 34, "24", { boy: 30, renk: S.goldHi, cls: "serif" })}${yazi(370, 50, "LETTERHEADS", { boy: 8.5, renk: S.mistDim, ls: 1 })}
    ${yazi(370, 92, "A4 · A5", { boy: 12, renk: S.foam })}${yazi(370, 108, "PDF · WHATSAPP", { boy: 8.5, renk: S.mistDim, ls: 1 })}`;
  return s;
}

// ---------------------------------------------------------------- Nusha

function nusha(x, y, w, h) {
  const sayfa = (sx, sy, sw, sh, gec) => {
    let t = `${kutu(sx, sy, sw, sh, { r: 2, fill: S.foam, stroke: "none", o: 0.92 })}
      <rect x="${sx}" y="${sy}" width="${sw}" height="${f1(sh * 0.14)}" fill="${S.goldLo}" opacity=".85" />
      <text class="it" x="${f1(sx + sw * 0.1)}" y="${f1(sy + sh * 0.4)}" font-size="${f1(sh * 0.2)}" fill="${S.goldDeep}">Rx</text>`;
    for (let i = 0; i < 4; i++)
      t += `<rect x="${f1(sx + sw * 0.36)}" y="${f1(sy + sh * (0.28 + i * 0.15))}" width="${f1(sw * (0.5 - (i % 2) * 0.14))}" height="${f1(Math.max(1.4, sh * 0.035))}" fill="${S.hull}" opacity=".55" class="fade" style="animation-delay:${f1(gec + i * 0.2)}s" />`;
    return t;
  };
  let s = "";
  // monitor (Windows)
  s += `${kutu(18, 22, 170, 104, { r: 6, fill: S.void })}<rect x="18" y="22" width="170" height="14" rx="6" fill="${S.bezel}" />
    <circle cx="28" cy="29" r="2.5" fill="${S.ember}" /><circle cx="37" cy="29" r="2.5" fill="${S.gold}" /><circle cx="46" cy="29" r="2.5" fill="${S.goldDeep}" />
    ${yazi(180, 32, "WINDOWS", { boy: 8, renk: S.mistDim, anchor: "end", ls: 1 })}
    ${sayfa(70, 42, 66, 78, 0.4)}<path d="M88 126h30l6 14H82z" fill="${S.rule}" />`;
  // telefon (Android)
  s += `${kutu(214, 30, 54, 100, { r: 9, fill: S.void })}<rect x="233" y="35" width="16" height="3" rx="1.5" fill="${S.rule}" />
    ${sayfa(221, 46, 40, 62, 0.8)}${yazi(241, 124, "APK", { boy: 8, renk: S.mistDim, anchor: "middle", ls: 1 })}`;
  // yazici: kagit cikar
  const kg = uid("ny");
  s += `<style>.${kg} { animation: ${kg} 4s cubic-bezier(.16,1,.3,1) infinite; } @keyframes ${kg} { 0% { transform: translateY(34px); opacity: 0; } 15% { opacity: 1; } 60%, 85% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(0); opacity: 0; } }</style>
    <g class="${kg}">${sayfa(318, 18, 58, 74, 0)}</g>
    <rect x="296" y="86" width="104" height="40" rx="6" fill="${S.bezel}" stroke="${S.rule}" />
    <rect x="308" y="86" width="80" height="5" fill="${S.void}" /><circle class="breathe" cx="388" cy="114" r="3" fill="${S.gold}" />
    ${yazi(348, 146, "PRINT = SAVE", { boy: 9, renk: S.gold, anchor: "middle", ls: 1.2 })}
    ${yazi(430, 40, "WEB", { boy: 10, renk: S.foam, anchor: "middle" })}${yazi(430, 58, "APK", { boy: 10, renk: S.foam, anchor: "middle" })}${yazi(430, 76, "EXE", { boy: 10, renk: S.foam, anchor: "middle" })}
    ${yazi(430, 100, "نسخه", { boy: 13, renk: S.goldLo, anchor: "middle", cls: "fa" })}`;
  return s;
}

// ---------------------------------------------------------------- Zamin

function zamin(x, y, w, h) {
  const R = rnd(99);
  let s = "";
  // uydu dokusu: tarlalar
  for (let i = 0; i < 28; i++) {
    const fx = R() * w;
    const fy = R() * h;
    s += `<rect x="${f1(fx)}" y="${f1(fy)}" width="${f1(20 + R() * 46)}" height="${f1(12 + R() * 26)}" transform="rotate(${f1(-20 + R() * 40)} ${f1(fx)} ${f1(fy)})" fill="${R() < 0.5 ? S.goldDeep : S.ruleSoft}" opacity="${f1(0.18 + R() * 0.22)}" />`;
  }
  const P = [
    [92, 34],
    [236, 22],
    [286, 92],
    [214, 140],
    [96, 124],
    [64, 78],
  ];
  const d = "M" + P.map((p) => p.join(" ")).join("L") + "Z";
  s += `<path d="${d}" fill="${S.gold}" fill-opacity=".1" />
    <path d="${d}" fill="none" stroke="${S.goldHi}" stroke-width="1.6" pathLength="100" stroke-dasharray="100" class="draw" style="--len:100;animation-duration:2.4s;animation-delay:.6s" />`;
  P.forEach(([px, py], i) => {
    s += `<g class="rise" style="animation-delay:${f1(0.3 + i * 0.18)}s"><circle cx="${px}" cy="${py}" r="4" fill="${S.void}" stroke="${S.goldHi}" stroke-width="1.5" /></g>`;
  });
  // bolme cizgileri (esit cephe)
  s += `<line x1="140" y1="28" x2="148" y2="132" stroke="${S.ember}" stroke-dasharray="4 3" class="fade" style="animation-delay:2.8s" />
    <line x1="190" y1="25" x2="182" y2="136" stroke="${S.ember}" stroke-dasharray="4 3" class="fade" style="animation-delay:3s" />
    ${yazi(116, 86, "1", { boy: 11, renk: S.foam, anchor: "middle", cls: "mono" })}${yazi(166, 86, "2", { boy: 11, renk: S.foam, anchor: "middle" })}${yazi(226, 86, "3", { boy: 11, renk: S.foam, anchor: "middle" })}`;
  // GPS halkasi
  const g = uid("zg");
  s += `<style>.${g} { transform-box: fill-box; transform-origin: center; animation: ${g} 2.4s ease-out infinite; } @keyframes ${g} { from { transform: scale(.3); opacity: .9; } to { transform: scale(2.4); opacity: 0; } }</style>
    <circle class="${g}" cx="236" cy="22" r="10" fill="none" stroke="${S.goldHi}" />
    ${kutu(318, 18, 136, 98, { r: 8, fill: S.void, o: 0.92 })}
    ${yazi(330, 38, "AREA", { boy: 9, renk: S.mistDim, ls: 1.2 })}
    ${yazi(330, 62, "2.40 jerib", { boy: 17, renk: S.goldHi, w: 500 })}
    ${yazi(330, 82, "48 biswa", { boy: 11, renk: S.foam })}${yazi(330, 100, "4,800 m²", { boy: 11, renk: S.foam })}
    ${yazi(442, 100, "نقشه", { boy: 12, renk: S.goldLo, anchor: "end", cls: "fa" })}
    ${kadran(424, 140, 11, 0, { gec: 0.8 })}
    <line x1="318" y1="142" x2="388" y2="142" stroke="${S.foam}" stroke-opacity=".7" /><line x1="318" y1="138" x2="318" y2="146" stroke="${S.foam}" stroke-opacity=".7" /><line x1="388" y1="138" x2="388" y2="146" stroke="${S.foam}" stroke-opacity=".7" />
    ${yazi(353, 136, "20 m", { boy: 9, renk: S.mist, anchor: "middle" })}`;
  return s;
}

// ---------------------------------------------------------------- NetStore

function netstore(x, y, w, h) {
  let s = "";
  const kpi = [
    ["SALES", "84,200"],
    ["PROFIT", "12,940"],
    ["DEBT", "6,310"],
  ];
  kpi.forEach(([a, b], i) => {
    s += `<g class="rise" style="animation-delay:${f1(0.2 + i * 0.1)}s">${kutu(14 + i * 94, 14, 86, 44, { r: 6, fill: S.void })}${yazi(24 + i * 94, 30, a, { boy: 8.5, renk: S.mistDim, ls: 1.2 })}${yazi(24 + i * 94, 49, b, { boy: 13.5, renk: i === 2 ? S.ember : S.goldHi, w: 500 })}</g>`;
  });
  // cubuk grafik
  const v = [38, 52, 44, 66, 58, 74, 62, 86, 70, 92, 80, 98];
  v.forEach((val, i) => {
    const bh = val * 0.82;
    s += `<rect x="${18 + i * 22}" y="${f1(148 - bh)}" width="14" height="${f1(bh)}" rx="2" fill="${i === v.length - 1 ? S.goldHi : S.gold}" opacity="${i === v.length - 1 ? 1 : 0.55}" style="transform-box: fill-box; transform-origin: bottom; animation: ns-b 1.2s cubic-bezier(.16,1,.3,1) ${f1(0.3 + i * 0.06)}s backwards" />`;
  });
  s += `<style>@keyframes ns-b { from { transform: scaleY(0); } }</style>`;
  const pts = v.map((val, i) => `${25 + i * 22},${f1(140 - val * 0.82 - 6)}`).join(" ");
  s += `<polyline points="${pts}" fill="none" stroke="${S.phosphor}" stroke-width="1.2" pathLength="100" stroke-dasharray="100" class="draw" style="--len:100;animation-delay:1.2s" />`;
  // dusuk stok listesi
  const lst = [
    ["USB-C cable", "42", S.foam],
    ["Power bank", "17", S.foam],
    ["Earbuds", "2", S.ember],
  ];
  s += `${kutu(298, 14, 156, 134, { r: 6, fill: S.void })}${yazi(310, 32, "STOCK", { boy: 8.5, renk: S.mistDim, ls: 1.2 })}`;
  lst.forEach(([a, b, c], i) => {
    s += `<line x1="306" y1="${40 + i * 26}" x2="446" y2="${40 + i * 26}" stroke="${S.rule}" />
      ${yazi(310, 58 + i * 26, a, { boy: 10.5, renk: S.foam, cls: "sans" })}${c === S.ember ? `<g class="blink">${yazi(444, 58 + i * 26, b, { boy: 11, renk: c, anchor: "end" })}</g>` : yazi(444, 58 + i * 26, b, { boy: 11, renk: c, anchor: "end" })}`;
  });
  s += hap(310, 122, "LOW STOCK", { boy: 8.5, renk: S.ember, kenar: S.ember, zem: "rgba(255,122,69,.08)", h: 18, led: S.ember }).svg;
  return s;
}

// ---------------------------------------------------------------- FY Language

function fylang(x, y, w, h) {
  const gun = ["SAT", "SUN", "MON", "TUE", "WED", "THU"];
  const ogr = 5;
  const R = rnd(5);
  let s = "";
  gun.forEach((g, i) => (s += yazi(98 + i * 32, 24, g, { boy: 8.5, renk: S.mistDim, anchor: "middle", ls: 0.8 })));
  const adlar = ["Ahmad", "Maryam", "Sami", "Hila", "Nabi"];
  const sure = 8;
  const pen = [];
  for (let r = 0; r < ogr; r++) {
    s += yazi(18, 46 + r * 22, adlar[r], { boy: 10, renk: S.foam, cls: "sans" });
    for (let c = 0; c < gun.length; c++) {
      const cx = 98 + c * 32;
      const cy = 42 + r * 22;
      const t = R();
      const sira = (c * ogr + r) / (ogr * gun.length);
      const p = pencere(sure, 0.02 + sira * 0.7, 0.95, { gec: 0.3 });
      pen.push(p);
      s += `<rect x="${cx - 11}" y="${cy - 8}" width="22" height="16" rx="4" fill="${S.void}" stroke="${S.ruleSoft}" />`;
      const isaret =
        t < 0.74
          ? `<circle cx="${cx}" cy="${cy}" r="3.6" fill="${S.gold}" />`
          : t < 0.87
            ? `<path d="M${cx - 3.5} ${cy - 3.5}l7 7m0-7l-7 7" stroke="${S.ember}" stroke-width="1.6" />`
            : `<circle cx="${cx}" cy="${cy}" r="3.6" fill="none" stroke="${S.goldHi}" stroke-width="1.4" />`;
      s += `<g class="${p.k}">${isaret}</g>`;
    }
  }
  s += `${yazi(98, 156, "● present   ✕ absent   ○ late", { boy: 8.5, renk: S.mistDim })}`;
  // sertifika muhru
  const m = uid("fm");
  s += `<style>.${m} { transform-origin: 400px 70px; animation: ${m} 30s linear infinite; } @keyframes ${m} { to { transform: rotate(360deg); } }</style>
    <circle cx="400" cy="70" r="40" fill="${S.void}" stroke="${S.goldLo}" />
    <g class="${m}"><circle cx="400" cy="70" r="34" fill="none" stroke="${S.gold}" stroke-dasharray="1.5 4" /></g>
    ${yildiz8(400, 70, 18, { renk: S.gold, rot: 22.5 })}
    ${yazi(400, 128, "CERTIFICATE", { boy: 9, renk: S.goldHi, anchor: "middle", ls: 1.4 })}
    ${yazi(400, 144, "DARI · ENGLISH", { boy: 8, renk: S.mistDim, anchor: "middle", ls: 1 })}`;
  return pencereler(pen) + s;
}

// ---------------------------------------------------------------- FY Merkez

function fymerkez(x, y, w, h) {
  const cx = w * 0.5;
  const cy = h * 0.52;
  const urun = ["Dawayar", "Shafa", "Nüsha", "Zamin", "Mini Dakhl", "NetStore", "FY Language", "Sosyal Stüdyo"];
  let s = "";
  const n = urun.length;
  urun.forEach((u, i) => {
    const a = rad(-90 + (i * 360) / n);
    const ux = cx + Math.cos(a) * 168;
    const uy = cy + Math.sin(a) * 56;
    const yid = uid("my");
    s += `<path id="${yid}" d="M${f1(cx)} ${f1(cy)}L${f1(ux)} ${f1(uy)}" stroke="${S.goldLo}" stroke-opacity=".5" stroke-dasharray="2 4" class="flow" />
      ${gezgin(yid, { sure: 2.4, gec: i * 0.45, r: 2.2 })}`;
    const hw = tw(u, 9.5, "mono") + 14;
    s += `${kutu(ux - hw / 2, uy - 9, hw, 18, { r: 9, fill: S.void })}${yazi(ux, uy + 3.4, u, { boy: 9.5, renk: S.foam, anchor: "middle" })}`;
  });
  const hm = uid("mm");
  s += `<style>.${hm} { transform-origin: ${cx}px ${f1(cy)}px; animation: ${hm} 3s ease-out infinite; } @keyframes ${hm} { from { transform: scale(.6); opacity: .8; } to { transform: scale(1.8); opacity: 0; } }</style>
    <circle class="${hm}" cx="${cx}" cy="${f1(cy)}" r="30" fill="none" stroke="${S.goldHi}" />
    <circle cx="${cx}" cy="${f1(cy)}" r="28" fill="${S.void}" stroke="${S.gold}" />
    ${yildiz8(cx, cy, 13, { renk: S.gold })}
    ${yazi(14, 22, "FREE TRIAL · ONE DEVICE", { boy: 9, renk: S.mistDim, ls: 1.1 })}
    ${yazi(w - 14, h - 12, "CASH · M-PAISA · HESABPAY", { boy: 9, renk: S.mistDim, anchor: "end", ls: 1.1 })}`;
  return s;
}

// ---------------------------------------------------------------- Yayin

function yayin(x, y, w, h) {
  const proj = [
    ["dil-platform", "dil-platform.fyajan.com"],
    ["your-site", "your-site.fyajan.com"],
  ];
  let s = yazi(14, 22, "PROJECT", { boy: 9, renk: S.mistDim, ls: 1.2 }) + yazi(w - 14, 22, "YOUR DOMAIN", { boy: 9, renk: S.mistDim, ls: 1.2, anchor: "end" });
  proj.forEach(([r, d], i) => {
    const yy = 36 + i * 34;
    const a = hap(14, yy, r, { boy: 10, led: S.goldLo });
    const b = hap(0, 0, d, { boy: 10 });
    const bx = w - 14 - b.w;
    const yid = uid("yy");
    s += a.svg + hap(bx, yy, d, { boy: 10, renk: S.goldHi, kenar: S.goldLo }).svg;
    s += `<path id="${yid}" d="M${f1(14 + a.w + 4)} ${yy + 10}H${f1(bx - 4)}" stroke="${S.goldLo}" stroke-dasharray="2 4" class="flow" />${gezgin(yid, { sure: 2 + i * 0.4, gec: i * 0.7, r: 2.2 })}`;
  });
  // 24 saatlik durum izi + tarama
  const bas = 14;
  const by = 128;
  const n = 48;
  const bw = (w - 28) / n;
  s += yazi(14, by - 10, "24 H STATUS TRACE · CRON EVERY 10 MIN", { boy: 8.5, renk: S.mistDim, ls: 1 });
  for (let i = 0; i < n; i++) {
    const kes = i === 31;
    s += `<rect x="${f1(bas + i * bw + 1)}" y="${by}" width="${f1(bw - 2)}" height="18" rx="1.5" fill="${kes ? S.ember : S.gold}" opacity="${kes ? 0.9 : 0.35 + (i % 5) * 0.08}" />`;
  }
  const t = uid("yt");
  s += `<style>.${t} { animation: ${t} 6s linear infinite; } @keyframes ${t} { from { transform: translateX(0); } to { transform: translateX(${f1(w - 28)}px); } }</style>
    <g class="${t}"><rect x="${bas - 1}" y="${by - 4}" width="2" height="26" fill="${S.phosphor}" /><rect x="${bas - 12}" y="${by - 4}" width="12" height="26" fill="${S.goldHi}" opacity=".15" /></g>`;
  return s;
}

// ---------------------------------------------------------------- Sosyal Studyo

function sosyal(x, y, w, h) {
  // Akis kosucusu siradan ilerleyen bir durum makinesi: dogrusal zincir.
  const dugum = [
    { x: 16, y: 62, t: "TRIGGER · keyword", r: S.ember },
    { x: 152, y: 62, t: "ASK · name" },
    { x: 246, y: 62, t: "TAG · lead" },
  ];
  const kanal = ["Telegram", "Instagram", "WhatsApp"];
  let s = "";
  const kenar = [
    [0, 1],
    [1, 2],
  ];
  const genis = dugum.map((d) => tw(d.t, 9.5, "mono") + 18);
  kenar.forEach(([a, b], i) => {
    const A = dugum[a];
    const B = dugum[b];
    const yid = uid("sk");
    const x1 = A.x + genis[a];
    const y1 = A.y + 11;
    const x2 = B.x;
    const y2 = B.y + 11;
    s += `<path id="${yid}" d="M${f1(x1)} ${y1}H${f1(x2)}" fill="none" stroke="${S.goldLo}" stroke-dasharray="3 4" class="flow" />${gezgin(yid, { sure: 1.6, gec: i * 0.6, r: 2.2 })}`;
  });
  dugum.forEach((d, i) => {
    s += `<g class="rise" style="animation-delay:${f1(0.2 + i * 0.15)}s">${kutu(d.x, d.y, genis[i], 22, { r: 6, fill: S.void, stroke: d.r || S.rule })}${yazi(d.x + 9, d.y + 14.5, d.t, { boy: 9.5, renk: d.r || S.foam })}</g>`;
  });
  const sx = dugum[2].x + genis[2];
  kanal.forEach((k, i) => {
    const ky = 26 + i * 40;
    const yid = uid("sc");
    s += `<path id="${yid}" d="M${f1(sx)} 73C${f1(sx + 20)} 73 ${f1(sx + 8)} ${ky + 10} ${f1(sx + 28)} ${ky + 10}" fill="none" stroke="${S.rule}" />${gezgin(yid, { sure: 1.8, gec: 1 + i * 0.5, r: 2 })}`;
    s += hap(sx + 28, ky, k, { boy: 9.5, renk: S.goldHi, kenar: S.goldLo }).svg;
  });
  s += `${yazi(16, 148, "16 STEP TYPES · LOCAL MODE WORKS WITHOUT A SERVER", { boy: 8.5, renk: S.mistDim, ls: 1 })}`;
  return s;
}

// ---------------------------------------------------------------- FY Reklam

function fyreklam(x, y, w, h) {
  const cer = [
    { t: "1:1", w: 92, h: 92 },
    { t: "4:5", w: 84, h: 105 },
    { t: "9:16", w: 66, h: 117 },
  ];
  let s = "";
  let cx = 18;
  const sure = 7.5;
  const pen = [];
  cer.forEach((c, i) => {
    const cy = 134 - c.h;
    const p = pencere(sure, i / 3, (i + 1) / 3, { gec: 0.3, sabit: i === 0 ? 1 : 0 });
    pen.push(p);
    s += `${kutu(cx, cy, c.w, c.h, { r: 5, fill: S.void })}
      <rect x="${cx + 6}" y="${cy + 6}" width="${c.w - 12}" height="${f1(c.h * 0.42)}" rx="3" fill="${S.goldDeep}" opacity=".45" />
      ${yildiz4(cx + c.w / 2, cy + 6 + c.h * 0.21, 8, S.goldHi)}
      <text class="it" x="${cx + 8}" y="${f1(cy + c.h * 0.62)}" font-size="${f1(Math.min(14, c.w / 6))}" fill="${S.foam}">Dawayar</text>
      <rect x="${cx + 8}" y="${f1(cy + c.h * 0.7)}" width="${f1(c.w * 0.6)}" height="3" rx="1.5" fill="${S.mist}" opacity=".5" />
      <rect x="${cx + 8}" y="${f1(cy + c.h * 0.79)}" width="${f1(c.w * 0.42)}" height="3" rx="1.5" fill="${S.mist}" opacity=".35" />
      <g class="${p.k}"><rect x="${cx - 3}" y="${cy - 3}" width="${c.w + 6}" height="${c.h + 6}" rx="7" fill="none" stroke="${S.goldHi}" stroke-width="1.4" /></g>
      ${yazi(cx + c.w / 2, 150, c.t, { boy: 9.5, renk: S.mist, anchor: "middle" })}`;
    cx += c.w + 14;
  });
  const ix = cx + 12;
  s += `${yazi(ix, 32, "CAPTION CHECK", { boy: 9, renk: S.mistDim, ls: 1.2 })}
    ${yazi(ix, 56, "≤ 2,200 chars", { boy: 11, renk: S.foam })}${yazi(ix, 76, "≤ 30 hashtags", { boy: 11, renk: S.foam })}${yazi(ix, 96, "≤ 1 emoji · no shouting", { boy: 11, renk: S.foam })}
    ${hap(ix, 116, "PUBLISH · META API", { boy: 9, renk: S.goldHi, kenar: S.goldLo, h: 20, led: S.ember }).svg}`;
  return pencereler(pen) + s;
}

// ---------------------------------------------------------------- botflow-mcp

function botflow(x, y, w, h) {
  const mesaj = [
    { b: true, t: "Hi! What's your name?" },
    { b: false, t: "Farhad" },
    { b: true, t: "Which product?" },
    { b: false, t: "[ Dawayar ]   [ Shafa ]", buton: true },
    { b: true, t: "Tagged #lead · thanks!" },
  ];
  const sure = 10;
  const pen = [];
  let s = `${kutu(14, 10, 230, 140, { r: 10, fill: S.void })}<rect x="14" y="10" width="230" height="20" rx="10" fill="${S.bezel}" />
    <circle cx="28" cy="20" r="5" fill="${S.gold}" />${yazi(40, 24, "@fy_bot · long polling", { boy: 9, renk: S.mist })}`;
  mesaj.forEach((m, i) => {
    const p = pencere(sure, 0.04 + i * 0.13, 0.94, { gec: 0.2 });
    pen.push(p);
    const mw = tw(m.t, 9.5, "sans") + 16;
    const mx = m.b ? 22 : 236 - mw;
    const my = 36 + i * 22;
    s += `<g class="${p.k}">${kutu(mx, my, mw, 17, { r: 8, fill: m.b ? S.bezel : "rgba(212,168,64,.16)", stroke: m.b ? S.rule : S.goldLo })}${yazi(mx + 8, my + 12, m.t, { boy: 9.5, renk: m.buton ? S.goldHi : S.foam, cls: "sans" })}</g>`;
  });
  // akis agaci (MCP)
  s += `${yazi(268, 24, "MCP · flow", { boy: 9, renk: S.mistDim, ls: 1.2 })}`;
  const d = [
    [300, 46, "ask"],
    [300, 82, "branch"],
    [262, 120, "Dawayar"],
    [350, 120, "Shafa"],
    [420, 82, "tag"],
  ];
  const kenar = [
    [0, 1],
    [1, 2],
    [1, 3],
    [1, 4],
  ];
  kenar.forEach(([a, b], i) => {
    const yid = uid("bk");
    s += `<path id="${yid}" d="M${d[a][0] + 22} ${d[a][1] + 9}L${d[b][0] + 22} ${d[b][1] - 1}" stroke="${S.goldLo}" stroke-dasharray="2 3" class="flow" />${gezgin(yid, { sure: 1.6, gec: i * 0.4, r: 1.8, kuyruk: false })}`;
  });
  d.forEach(([dx, dy, t]) => {
    const tw0 = tw(t, 9, "mono") + 12;
    s += `${kutu(dx + 22 - tw0 / 2, dy - 2, tw0, 16, { r: 8, fill: S.bezel })}${yazi(dx + 22, dy + 9.5, t, { boy: 9, renk: S.foam, anchor: "middle" })}`;
  });
  return pencereler(pen) + s;
}

// ---------------------------------------------------------------- kazi

function kazi(x, y, w, h) {
  const html = [
    [["<", S.mistDim], ["article", S.gold], [">", S.mistDim]],
    [["  <", S.mistDim], ["h1", S.gold], [">Report<", S.foam], ["/h1", S.gold], [">", S.mistDim]],
    [["  <", S.mistDim], ["p", S.gold], [">Q3 sales…<", S.foam], ["/p", S.gold], [">", S.mistDim]],
    [["  <", S.mistDim], ["a", S.gold], [" href", S.ember], ["=…>", S.mistDim]],
    [["  <", S.mistDim], ["script", S.gold], [">…", S.mistDim]],
  ];
  let s = `${kutu(14, 12, 186, 136, { r: 8, fill: S.void })}${yazi(24, 28, "page.html", { boy: 9, renk: S.mistDim, ls: 1 })}`;
  html.forEach((sat, i) => {
    s += `<text class="mono" x="24" y="${50 + i * 18}" font-size="10" xml:space="preserve">${sat.map(([t, r]) => `<tspan fill="${r}">${esc(t)}</tspan>`).join("")}</text>`;
  });
  const t = uid("kt");
  s += `<style>.${t} { animation: ${t} 3.2s cubic-bezier(.37,0,.63,1) infinite alternate; } @keyframes ${t} { from { transform: translateY(0); } to { transform: translateY(96px); } }</style>
    <g class="${t}"><rect x="16" y="36" width="182" height="16" fill="${S.goldHi}" opacity=".08" /><rect x="16" y="51" width="182" height="1" fill="${S.goldHi}" opacity=".7" /></g>`;
  // ok
  const yid = uid("ko");
  s += `<path id="${yid}" d="M206 80H252" stroke="${S.goldLo}" stroke-dasharray="3 4" class="flow" />${gezgin(yid, { sure: 1.4, r: 2.4 })}<path d="M252 75l7 5-7 5" fill="none" stroke="${S.gold}" stroke-width="1.5" />`;
  // markdown
  const md = [
    [["# ", S.ember], ["Report", S.foam]],
    [["", S.foam], ["Q3 sales…", S.mist]],
    [["- ", S.gold], ["[link](…)", S.goldHi]],
    [["## ", S.ember], ["Sayfa 2", S.foam], ["  (pdf)", S.mistDim]],
  ];
  s += `${kutu(266, 12, 188, 136, { r: 8, fill: S.void })}${yazi(276, 28, "page.md", { boy: 9, renk: S.mistDim, ls: 1 })}`;
  md.forEach((sat, i) => {
    s += `<g class="fade" style="animation-delay:${f1(0.6 + i * 0.35)}s"><text class="mono" x="276" y="${52 + i * 20}" font-size="10.5" xml:space="preserve">${sat.map(([tt, r]) => `<tspan fill="${r}">${esc(tt)}</tspan>`).join("")}</text></g>`;
  });
  s += yaz(276, 136, [["$ kazi crawl --depth 2", S.gold]], { boy: 9.5, gec: 0.8, imlec: true });
  return s;
}

// ---------------------------------------------------------------- fyajan.com

function fyajans(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2 + 6;
  const R = Math.min(w, h) * 0.36;
  let s = "";
  // halkalar
  s += `<g class="breathe"><circle cx="${cx}" cy="${cy}" r="${R + 30}" fill="${S.gold}" opacity=".06" /></g>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="${S.void}" stroke="${S.goldLo}" stroke-opacity=".6" />
    <ellipse cx="${cx}" cy="${cy}" rx="${R}" ry="${f1(R * 0.28)}" transform="rotate(-14 ${cx} ${cy})" fill="none" stroke="${S.gold}" stroke-opacity=".45" stroke-dasharray="2 6" class="flow" />
    <ellipse cx="${cx}" cy="${cy}" rx="${f1(R * 0.3)}" ry="${R}" transform="rotate(-14 ${cx} ${cy})" fill="none" stroke="${S.gold}" stroke-opacity=".3" stroke-dasharray="1.5 6" class="flow-r" />`;
  let c = "";
  for (let i = 0; i < 72; i++) {
    const a = rad(i * 5);
    const r1 = i % 9 === 0 ? R + 8 : R + 4;
    c += `<line x1="${f1(cx + (R + 1) * Math.sin(a))}" y1="${f1(cy - (R + 1) * Math.cos(a))}" x2="${f1(cx + r1 * Math.sin(a))}" y2="${f1(cy - r1 * Math.cos(a))}" stroke="${S.goldLo}" />`;
  }
  const sp = uid("fs");
  s += `<style>.${sp} { transform-origin: ${cx}px ${cy}px; animation: ${sp} 200s linear infinite; } @keyframes ${sp} { to { transform: rotate(-360deg); } }</style><g class="${sp}">${c}</g>`;
  // 341 bilgi blogu: fibonacci kure (ornek 120)
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 120; i++) {
    const yy = 1 - (2 * (i + 0.5)) / 120;
    const r = Math.sqrt(1 - yy * yy);
    const ph = i * g;
    const z = r * Math.sin(ph);
    s += `<circle ${i % 8 === 0 ? `class="twinkle" style="animation-delay:${f1((i % 13) * 0.3)}s" ` : ""}cx="${f1(cx + R * 0.92 * r * Math.cos(ph))}" cy="${f1(cy - R * 0.92 * yy)}" r="${f1(z > 0 ? 1.4 : 0.8)}" fill="${z > 0 ? S.gold : S.goldLo}" opacity="${z > 0 ? 0.85 : 0.45}" />`;
  }
  // bolum plakalari
  const bol = [
    ["Ch1", 300],
    ["Ch3", 40],
    ["Ch4", 120],
    ["Ch6", 210],
  ];
  bol.forEach(([b, a], i) => {
    const px = cx + R * 0.7 * Math.sin(rad(a));
    const py = cy - R * 0.7 * Math.cos(rad(a));
    s += `${kutu(px - 18, py - 9, 36, 18, { r: 9, fill: S.void })}${yazi(px, py + 3.6, b, { boy: 9.5, renk: S.foam, anchor: "middle" })}`;
  });
  s += ibre(cx, cy, R * 1.25, 40, { gec: 0.6 });
  // istasyon etiketleri
  const ist = ["FY", "Network", "Course", "Assistant", "Set up", "Web", "Academy", "Projects"];
  ist.forEach((t, i) => {
    const a = rad(i * 45);
    const lx = cx + (R + 24) * Math.sin(a);
    const ly = cy - (R + 24) * Math.cos(a);
    s += yazi(lx, ly + 3.5, `${String(i * 45).padStart(3, "0")}`, { boy: 9, renk: i === 0 ? S.ember : S.mistDim, anchor: "middle" });
  });
  s += `${yazi(18, 26, "fyajan.com · BRIDGE", { boy: 9.5, renk: S.gold, ls: 1.2 })}
    ${hap(18, h - 32, "SIMULATION", { boy: 9, renk: S.ember, kenar: S.ember, zem: "rgba(255,122,69,.07)", h: 20, led: S.ember }).svg}
    ${yazi(w - 18, h - 18, "7 chapters · 341 blocks", { boy: 9.5, renk: S.mist, anchor: "end" })}`;
  return s;
}

// ---------------------------------------------------------------- Acik Defter

function acikdefter(x, y, w, h) {
  let s = `<rect x="22" y="12" width="${w - 44}" height="${h - 20}" rx="4" fill="#efe6cf" opacity=".93" />`;
  for (let yy = 40; yy < h - 10; yy += 16) s += `<line x1="22" y1="${yy}" x2="${w - 22}" y2="${yy}" stroke="#6f8fb6" stroke-opacity=".38" />`;
  s += `<line x1="70" y1="12" x2="70" y2="${h - 8}" stroke="#c4473a" stroke-opacity=".75" />
    <line x1="34" y1="18" x2="34" y2="${h - 14}" stroke="#7a6a48" stroke-opacity=".5" stroke-dasharray="4 4" />
    <text class="it" x="82" y="36" font-size="20" fill="#2a2418">Açık Defter</text>
    <text class="it" x="82" y="68" font-size="13" fill="#3a3122">an IT student's open notebook</text>
    <text class="it" x="82" y="100" font-size="13" fill="#3a3122">07 · offline cache works ✓</text>
    <text class="it" x="82" y="132" font-size="13" fill="#3a3122">08 · RTL with logical CSS</text>
    <text class="mono" x="48" y="100" font-size="9" fill="#c4473a" text-anchor="middle">07</text>
    <text class="mono" x="48" y="132" font-size="9" fill="#c4473a" text-anchor="middle">08</text>`;
  // ayrac sekmeleri
  ["#c4473a", "#d4a840", "#6f8fb6"].forEach((r, i) => (s += `<rect x="${w - 92 + i * 22}" y="2" width="16" height="22" rx="2" fill="${r}" opacity=".9" />`));
  // yapiskan not
  const n = uid("an");
  s += `<style>.${n} { transform-origin: ${w - 90}px 60px; animation: ${n} 6s ease-in-out infinite; } @keyframes ${n} { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(-2deg); } }</style>
    <g class="${n}"><rect x="${w - 140}" y="44" width="100" height="70" fill="${S.goldHi}" opacity=".92" /><rect x="${w - 112}" y="38" width="44" height="12" fill="#fff" opacity=".45" />
      <text class="it" x="${w - 130}" y="74" font-size="14" fill="#3a2a08">4 languages</text><text class="it" x="${w - 130}" y="96" font-size="14" fill="#3a2a08">no framework</text></g>`;
  // lamba isigi
  const l = uid("al");
  s += `<defs><radialGradient id="${l}g"><stop offset="0" stop-color="${S.goldHi}" stop-opacity=".35" /><stop offset="1" stop-color="${S.goldHi}" stop-opacity="0" /></radialGradient></defs>
    <style>.${l} { animation: ${l} 9s ease-in-out infinite alternate; } @keyframes ${l} { from { transform: translate(0,0); } to { transform: translate(220px, 30px); } }</style>
    <circle class="${l}" cx="110" cy="60" r="90" fill="url(#${l}g)" />`;
  return s;
}

// ---------------------------------------------------------------- bu profil

function profil(x, y, w, h) {
  const dosya = ["header.svg", "map.svg", "about.svg", "activity.svg", "stats.svg", "languages.svg"];
  let s = `${hap(14, 18, "GitHub GraphQL", { boy: 10, led: S.goldLo }).svg}
    ${hap(14, 70, "cards.mjs", { boy: 10, renk: S.goldHi, kenar: S.goldLo }).svg}
    ${hap(14, 122, "subset.py · fonts", { boy: 10 }).svg}`;
  const y1 = uid("pr");
  const y2 = uid("pr");
  s += `<path id="${y1}" d="M60 38V70" stroke="${S.goldLo}" stroke-dasharray="2 3" class="flow" />${gezgin(y1, { sure: 1.6, r: 2 })}
    <path id="${y2}" d="M60 122V90" stroke="${S.goldLo}" stroke-dasharray="2 3" class="flow" />${gezgin(y2, { sure: 1.6, gec: 0.8, r: 2 })}`;
  const sure = 9;
  const pen = [];
  dosya.forEach((d, i) => {
    const p = pencere(sure, 0.05 + i * 0.1, 0.92, { gec: 0.3 });
    pen.push(p);
    const yy = 22 + i * 21;
    s += `<g class="${p.k}">${yazi(176, yy + 4, "+", { boy: 11, renk: S.gold })}${yazi(190, yy + 4, `assets/${d}`, { boy: 10.5, renk: S.foam })}</g>`;
  });
  const yid = uid("pf");
  s += `<path id="${yid}" d="M108 80C140 80 140 60 170 60" fill="none" stroke="${S.goldLo}" stroke-dasharray="2 3" class="flow" />${gezgin(yid, { sure: 1.4, r: 2 })}`;
  // 6 saatlik saat
  const cx = w - 52;
  const cy = 78;
  let t = "";
  for (let i = 0; i < 4; i++) {
    const a = rad(i * 90);
    t += `<line x1="${f1(cx + 28 * Math.sin(a))}" y1="${f1(cy - 28 * Math.cos(a))}" x2="${f1(cx + 34 * Math.sin(a))}" y2="${f1(cy - 34 * Math.cos(a))}" stroke="${S.gold}" />`;
  }
  const el = uid("pc");
  s += `<circle cx="${cx}" cy="${cy}" r="36" fill="${S.void}" stroke="${S.goldLo}" />${t}
    <style>.${el} { transform-origin: ${cx}px ${cy}px; animation: ${el} 6s linear infinite; } @keyframes ${el} { to { transform: rotate(360deg); } }</style>
    <g class="${el}"><line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 26}" stroke="${S.ember}" stroke-width="1.6" /></g><circle cx="${cx}" cy="${cy}" r="2.6" fill="${S.gold}" />
    ${yazi(cx, cy + 54, "EVERY 6 H", { boy: 9, renk: S.mistDim, anchor: "middle", ls: 1.2 })}`;
  return pencereler(pen) + s;
}

export const SANAT = {
  pusula,
  dawayar,
  minidakhl,
  shafa,
  nusha,
  zamin,
  netstore,
  fylang,
  fymerkez,
  yayin,
  sosyal,
  fyreklam,
  botflow,
  kazi,
  fyajans,
  acikdefter,
  profil,
};
