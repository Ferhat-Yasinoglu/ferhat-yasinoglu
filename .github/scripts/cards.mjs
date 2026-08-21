#!/usr/bin/env node
// GitHub profilindeki animasyonlu SVG kartlarini uretir.
// Veriyi GitHub GraphQL API'sinden ceker, assets/ altina SVG yazar.
// Yerel deneme icin: node cards.mjs --mock

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "assets");

const T = {
  bg: "#1a1b27",
  bg2: "#24283b",
  line: "#2f334d",
  text: "#c0caf5",
  muted: "#7982a9",
  blue: "#70a5fd",
  purple: "#bf91f3",
  green: "#9ece6a",
  pink: "#f7768e",
  yellow: "#e0af68",
  cyan: "#2ac3de",
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c])
  );

const short = (n) =>
  n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n);

const FONT = "'Segoe UI', Ubuntu, 'Helvetica Neue', Helvetica, sans-serif";

// Her kartin basinda duran ortak stil: kademeli giris + yumusak hareket.
const baseStyle = `
    text { font-family: ${FONT}; }
    .card-bg { fill: url(#bg); stroke: ${T.line}; stroke-width: 1; }
    /* Her animasyon "backwards" ile kurulur: animasyon hic calismazsa
       ogenin dogal hali gecerli olur, yani icerik yine de gorunur. */
    .rise { animation: rise .7s cubic-bezier(.2,.7,.3,1) backwards; }
    @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: .01ms !important; animation-delay: 0s !important; }
    }`;

const defsBg = (id = "bg") => `
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${T.bg}" />
      <stop offset="100%" stop-color="${T.bg2}" />
    </linearGradient>`;

// ---------------------------------------------------------------- baslik

function header({ name, tagline }) {
  const W = 1000;
  const H = 200;
  // Arka planda suzulen isik lekeleri: sonsuz donen, yavas hareket.
  const orbs = [
    { cx: 160, cy: 60, r: 130, c: T.blue, dur: 19, dx: 60, dy: 24 },
    { cx: 820, cy: 150, r: 150, c: T.purple, dur: 23, dx: -70, dy: -30 },
    { cx: 520, cy: 30, r: 110, c: T.cyan, dur: 27, dx: 40, dy: 40 },
  ]
    .map(
      (o, i) => `
      <circle cx="${o.cx}" cy="${o.cy}" r="${o.r}" fill="${o.c}" opacity=".16" filter="url(#soft)">
        <animateTransform attributeName="transform" type="translate"
          values="0 0; ${o.dx} ${o.dy}; 0 0" dur="${o.dur}s" repeatCount="indefinite" />
        <animate attributeName="opacity" values=".10;.22;.10" dur="${o.dur / 2}s" repeatCount="indefinite" />
      </circle>`
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(name)}">
  <defs>
    ${defsBg()}
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="45" />
    </filter>
    <linearGradient id="ink" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${T.blue}">
        <animate attributeName="stop-color" values="${T.blue};${T.cyan};${T.purple};${T.blue}" dur="9s" repeatCount="indefinite" />
      </stop>
      <stop offset="100%" stop-color="${T.purple}">
        <animate attributeName="stop-color" values="${T.purple};${T.blue};${T.cyan};${T.purple}" dur="9s" repeatCount="indefinite" />
      </stop>
    </linearGradient>
    <clipPath id="round"><rect width="${W}" height="${H}" rx="16" /></clipPath>
    <style>${baseStyle}
      .name { font-size: 46px; font-weight: 800; fill: url(#ink); letter-spacing: -.5px; }
      .tag { font-size: 17px; fill: ${T.muted}; letter-spacing: .3px; }
      .bar { animation: grow 1.1s .35s cubic-bezier(.2,.7,.3,1) backwards; }
      @keyframes grow { from { width: 0; } }
    </style>
  </defs>
  <g clip-path="url(#round)">
    <rect class="card-bg" width="${W}" height="${H}" rx="16" />
    ${orbs}
    <g class="rise" style="animation-delay:.05s">
      <text class="name" x="50" y="92">${esc(name)}</text>
    </g>
    <rect class="bar" x="52" y="112" width="120" height="4" rx="2" fill="url(#ink)" />
    <g class="rise" style="animation-delay:.25s">
      <text class="tag" x="50" y="146">${esc(tagline)}</text>
    </g>
  </g>
</svg>
`;
}

// ------------------------------------------------------- yazan metin

// Satirlari sirayla yazip silen daktilo animasyonu.
// Her satir icin kirpma dikdortgeninin genisligi steps() ile buyur/kucultulur.
function typing(lines) {
  const W = 1000;
  const H = 64;
  const size = 26;
  const charW = size * 0.6; // monospace: karakter genisligi sabit
  const per = 3.4; // satir basina saniye
  const cycle = (lines.length * per).toFixed(2);

  const total = lines.length * per;
  const at = (s) => Math.min(1, s / total);

  // keyTimes 0 ile baslayip 1 ile bitmeli. Penceresi disinda her satir kapali (0)
  // baslar; ayni ana denk gelen adimlarda sonuncusu gecerli olur.
  const track = (t0, stops) => {
    const rows = [[0, 0], ...stops.map(([s, v]) => [at(t0 + s), v]), [1, stops.at(-1)[1]]];
    const keep = [];
    for (const row of rows) {
      if (keep.length && Math.abs(keep.at(-1)[0] - row[0]) < 1e-6) keep[keep.length - 1] = row;
      else keep.push(row);
    }
    return {
      keyTimes: keep.map(([k]) => k.toFixed(4)).join(";"),
      values: keep.map(([, v]) => v).join(";"),
    };
  };

  const groups = lines
    .map((line, i) => {
      const w = ([...line].length * charW).toFixed(1);
      const t0 = i * per;
      // yaz (1.3s) → bekle (1.3s) → sil (0.8s)
      const shape = [[0, 0], [1.3, w], [2.6, w], [3.4, 0]];
      const clip = track(t0, shape);
      const show = track(t0, [[0, 1], [3.4, 0]]);
      const left = ((W - w) / 2).toFixed(1); // her satir kendi genisligine gore ortalanir
      return `
    <clipPath id="clip${i}"><rect x="0" y="0" width="0" height="${H}">
      <animate attributeName="width" values="${clip.values}" keyTimes="${clip.keyTimes}"
               dur="${cycle}s" repeatCount="indefinite" />
    </rect></clipPath>
    <g opacity="0" transform="translate(${left} 0)">
      <animate attributeName="opacity" values="${show.values}" keyTimes="${show.keyTimes}"
               dur="${cycle}s" repeatCount="indefinite" calcMode="discrete" />
      <g clip-path="url(#clip${i})">
        <text class="ty" x="0" y="${size + 14}">${esc(line)}</text>
      </g>
      <rect class="caret" x="0" y="${size - 10}" width="2.5" height="${size + 2}" fill="${T.purple}">
        <animate attributeName="x" values="${clip.values}" keyTimes="${clip.keyTimes}"
                 dur="${cycle}s" repeatCount="indefinite" />
      </rect>
    </g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(lines.join(" · "))}">
  <defs>
    <style>
      .ty { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: ${size}px; font-weight: 600; fill: ${T.blue}; }
      .caret { animation: blink 1s steps(1) infinite; }
      @keyframes blink { 0%,50% { opacity: 1; } 50.01%,100% { opacity: 0; } }
    </style>
  </defs>
  <g>${groups}
  </g>
</svg>
`;
}

// ------------------------------------------------------------ istatistik

function stats(d) {
  const W = 480;
  const H = 190;
  const tiles = [
    { label: "Toplam katkı", value: d.totalContributions, color: T.blue },
    { label: "Commit", value: d.commits, color: T.green },
    { label: "Depo", value: d.repos, color: T.purple },
    { label: "Yıldız", value: d.stars, color: T.yellow },
    { label: "Takipçi", value: d.followers, color: T.cyan },
    { label: "Pull request", value: d.prs, color: T.pink },
  ];

  const cells = tiles
    .map((t, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 28 + col * 148;
      const y = 78 + row * 68;
      return `
    <g class="rise" style="animation-delay:${(0.12 + i * 0.09).toFixed(2)}s">
      <rect x="${x}" y="${y - 26}" width="3" height="40" rx="1.5" fill="${t.color}" />
      <text class="num" x="${x + 14}" y="${y}" fill="${t.color}">${esc(short(t.value))}</text>
      <text class="lbl" x="${x + 14}" y="${y + 18}">${esc(t.label)}</text>
    </g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub istatistikleri">
  <defs>
    ${defsBg()}
    <style>${baseStyle}
      .title { font-size: 16px; font-weight: 700; fill: ${T.text}; }
      .num { font-size: 25px; font-weight: 800; }
      .lbl { font-size: 12px; fill: ${T.muted}; }
      .pulse { animation: pulse 2.4s ease-in-out infinite; }
      @keyframes pulse { 0%,100% { opacity: .45; r: 4; } 50% { opacity: 1; r: 5.5; } }
    </style>
  </defs>
  <rect class="card-bg" width="${W}" height="${H}" rx="14" />
  <circle class="pulse" cx="30" cy="34" r="4" fill="${T.green}" />
  <text class="title" x="46" y="39">📊 GitHub İstatistikleri</text>
  ${cells}
</svg>
`;
}

// ------------------------------------------------------------------ diller

function languages(langs) {
  const W = 480;
  const H = 190;
  const total = langs.reduce((s, l) => s + l.size, 0) || 1;
  const barX = 28;
  const barW = W - 56;

  let cursor = barX;
  const segs = langs
    .map((l, i) => {
      const w = Math.max(2, (l.size / total) * barW);
      const seg = `
    <rect x="${cursor.toFixed(1)}" y="70" width="${w.toFixed(1)}" height="12"
          fill="${l.color}" class="seg" style="animation-delay:${(0.15 + i * 0.11).toFixed(2)}s" />`;
      cursor += w;
      return seg;
    })
    .join("");

  const legend = langs
    .map((l, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 30 + col * 226;
      const y = 118 + row * 26;
      const pct = ((l.size / total) * 100).toFixed(1);
      return `
    <g class="rise" style="animation-delay:${(0.35 + i * 0.08).toFixed(2)}s">
      <circle cx="${x + 5}" cy="${y - 4}" r="5" fill="${l.color}" />
      <text class="lg" x="${x + 18}" y="${y}">${esc(l.name)}</text>
      <text class="pc" x="${x + 200}" y="${y}" text-anchor="end">${pct}%</text>
    </g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="En çok kullanılan diller">
  <defs>
    ${defsBg()}
    <clipPath id="barclip"><rect x="${barX}" y="70" width="${barW}" height="12" rx="6" /></clipPath>
    <style>${baseStyle}
      .title { font-size: 16px; font-weight: 700; fill: ${T.text}; }
      .lg { font-size: 13px; fill: ${T.text}; }
      .pc { font-size: 13px; fill: ${T.muted}; font-variant-numeric: tabular-nums; }
      .seg { transform-box: fill-box; transform-origin: left center; animation: wipe .9s cubic-bezier(.2,.7,.3,1) backwards; }
      @keyframes wipe { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      .spin { animation: spin 6s linear infinite; transform-origin: 30px 34px; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </defs>
  <rect class="card-bg" width="${W}" height="${H}" rx="14" />
  <circle class="spin" cx="30" cy="34" r="4.5" fill="none" stroke="${T.purple}" stroke-width="2"
          stroke-dasharray="14 8" />
  <text class="title" x="46" y="39">🎨 En çok kullandığım diller</text>
  <g clip-path="url(#barclip)">${segs}</g>
  ${legend}
</svg>
`;
}

// --------------------------------------------------------------- hareket

function activity(days, updatedAt) {
  const W = 1000;
  const H = 200;
  const padL = 34;
  const padR = 24;
  const top = 58;
  const bottom = H - 34;
  const pts = days.slice(-90);
  const max = Math.max(1, ...pts.map((p) => p.count));
  const stepX = (W - padL - padR) / Math.max(1, pts.length - 1);

  const xy = pts.map((p, i) => [
    padL + i * stepX,
    bottom - (p.count / max) * (bottom - top),
  ]);

  // Yumusak egri: her nokta arasinda kubik bezier.
  let path = `M ${xy[0][0].toFixed(1)} ${xy[0][1].toFixed(1)}`;
  for (let i = 1; i < xy.length; i++) {
    const [px, py] = xy[i - 1];
    const [cx, cy] = xy[i];
    const mx = (px + cx) / 2;
    path += ` C ${mx.toFixed(1)} ${py.toFixed(1)}, ${mx.toFixed(1)} ${cy.toFixed(1)}, ${cx.toFixed(1)} ${cy.toFixed(1)}`;
  }
  const area = `${path} L ${xy[xy.length - 1][0].toFixed(1)} ${bottom} L ${xy[0][0].toFixed(1)} ${bottom} Z`;

  const busiest = pts.reduce((a, b) => (b.count > a.count ? b : a), pts[0]);
  const sum = pts.reduce((s, p) => s + p.count, 0);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Son 90 günün katkı grafiği">
  <defs>
    ${defsBg()}
    <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${T.purple}" stop-opacity=".45" />
      <stop offset="100%" stop-color="${T.purple}" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="stroke" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${T.blue}" />
      <stop offset="100%" stop-color="${T.purple}" />
    </linearGradient>
    <style>${baseStyle}
      .title { font-size: 16px; font-weight: 700; fill: ${T.text}; }
      .meta { font-size: 12px; fill: ${T.muted}; }
      .line { fill: none; stroke: url(#stroke); stroke-width: 2.5; stroke-linecap: round;
              animation: draw 2.6s .2s cubic-bezier(.4,0,.2,1) backwards; }
      @keyframes draw {
        from { stroke-dasharray: 4000; stroke-dashoffset: 4000; }
        to { stroke-dasharray: 4000; stroke-dashoffset: 0; }
      }
      .fill { animation: fade 1.2s 1.5s backwards; }
      .tip { animation: fade .6s 2.6s backwards; }
      .stamp { font-size: 10.5px; fill: ${T.muted}; animation: fade .8s 3s backwards; }
      .ping { animation: ping 2s ease-out infinite; transform-origin: center; }
      @keyframes ping { 0% { r: 4; opacity: .9; } 70%,100% { r: 13; opacity: 0; } }
    </style>
  </defs>
  <rect class="card-bg" width="${W}" height="${H}" rx="14" />
  <text class="title" x="30" y="39">📈 Son 90 gün</text>
  <text class="meta" x="${W - 30}" y="39" text-anchor="end">${sum} katkı · en yoğun gün ${busiest.count}</text>
  <path class="fill" d="${area}" fill="url(#area)" />
  <path class="line" d="${path}" />
  <g class="tip">
    <circle class="ping" cx="${xy[xy.length - 1][0].toFixed(1)}" cy="${xy[xy.length - 1][1].toFixed(1)}" r="4" fill="${T.purple}" />
    <circle cx="${xy[xy.length - 1][0].toFixed(1)}" cy="${xy[xy.length - 1][1].toFixed(1)}" r="4" fill="${T.text}" />
  </g>
  <text class="stamp" x="30" y="${H - 12}">🔄 ${esc(updatedAt)} · her 6 saatte bir yenilenir</text>
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

async function fetchData(login, token) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
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
const DISPLAY_NAME = "Ferhat Yasinoglu";
const TAGLINE = "Web geliştirici · Firebase · PWA · sade JavaScript";

const useMock = process.argv.includes("--mock");
const login = process.env.GH_LOGIN || "Ferhat-Yasinoglu";
const data = useMock ? mockData() : await fetchData(login, process.env.GITHUB_TOKEN);

const stamp = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
}).format(new Date());

await mkdir(OUT, { recursive: true });
const cards = {
  "header.svg": header({ name: DISPLAY_NAME, tagline: TAGLINE }),
  "typing.svg": typing([
    "Merhaba, ben Ferhat",
    "Web geliştirici",
    "Firebase ve PWA meraklısı",
    "Framework yok, sade JavaScript",
  ]),
  "stats.svg": stats(data),
  "languages.svg": languages(data.langs),
  "activity.svg": activity(data.days, stamp),
};

for (const [file, svg] of Object.entries(cards)) {
  await writeFile(join(OUT, file), svg, "utf8");
  console.log(`yazildi: assets/${file} (${svg.length} bayt)`);
}
