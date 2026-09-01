#!/usr/bin/env node
// GitHub profilindeki animasyonlu SVG kartlarini uretir.
// Veriyi GitHub GraphQL API'sinden ceker, assets/ altina SVG yazar.
// Yerel deneme icin: node cards.mjs --mock
//
// Kartlarin hepsi ayni terminal temasini paylasiyor: koyu zemin, tek piksel
// cerceve, sol ustte "> etiket" sekmesi. Panel cizimi tek yerden (kutu)
// gectigi icin yeni kart eklemek birkac satir.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT = join(ROOT, "assets");

// simple-icons'tan bir kez cikarilmis marka logolari (24x24 viewBox yollari).
const ICONS = JSON.parse(await readFile(join(HERE, "icons.json"), "utf8"));

const T = {
  zemin: "#050a05",
  panel: "#0a120b",
  cerceve: "#1e3a20",
  etiket: "#4ade80",
  anahtar: "#6fbf78",
  metin: "#d4f5d6",
  parlak: "#22ff88",
  sonuk: "#3d6b42",
  cubuk: "#22c55e",

  sari: "#fbbf24",
  mavi: "#60a5fa",
  mor: "#a78bfa",
  pembe: "#f472b6",
};

const MONO =
  "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c])
  );

const short = (n) =>
  n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n);

// Her kartin basinda duran ortak stil. Animasyonlar "backwards" ile kuruluyor:
// animasyon hic calismazsa ogenin dogal hali gecerli olur, icerik yine gorunur.
const stil = () => `
    text { font-family: ${MONO}; }
    .panel { fill: ${T.panel}; stroke: ${T.cerceve}; stroke-width: 1; }
    .etiket { font-size: 12px; fill: ${T.etiket}; }
    .anahtar { font-size: 12.5px; fill: ${T.anahtar}; }
    .deger { font-size: 12.5px; fill: ${T.metin}; }
    .kucuk { font-size: 11px; fill: ${T.sonuk}; }
    .gir { animation: gir .6s ease-out backwards; }
    @keyframes gir { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    .yanip { animation: yanip 1.1s steps(1) infinite; }
    @keyframes yanip { 0%,50% { opacity: 1; } 50.01%,100% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: .01ms !important; animation-delay: 0s !important; }
    }`;

// Etiketli panel: cerceve, sol ustte "> ad" ve altinda ayirici. Ad bos
// birakilirsa sekme cizilmez (hero ve footer kendi baslik satirini yaziyor).
function kutu(W, H, ad, icerik, { basY = 34 } = {}) {
  const sekme = ad
    ? `
  <text class="etiket" x="14" y="21">&gt; ${esc(ad)}</text>`
    : "";
  return `
  <rect class="panel" x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="3" />${sekme}
  <line x1="0" y1="${basY - 6}" x2="${W}" y2="${basY - 6}" stroke="${T.cerceve}" stroke-width="1" />
  ${icerik}`;
}

const sarmal = (W, H, etiketMetni, govde) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(etiketMetni)}">
  <defs><style>${stil()}</style></defs>
  <rect width="${W}" height="${H}" fill="${T.zemin}" />
  ${govde}
</svg>
`;

// ------------------------------------------------------------------ hero

function hero({ ad, rol, satirlar, iletisim }) {
  const W = 1000;
  const H = 400;

  // Sagdaki matris yagmuru: sabit sutunlar, kaydirmali opaklik. Rastgelelik
  // uretim aninda degil, sabit bir diziden geliyor ki her kosuda ayni dosya
  // ciksin ve workflow bos commit atmasin.
  const harfler = "01<>{}[]()/*+=;:$#@&%!?abcdefgxyz";
  const yagmur = Array.from({ length: 14 }, (_, i) => {
    const x = 646 + i * 24;
    const sure = 6 + ((i * 7) % 9);
    const kolon = Array.from({ length: 22 }, (_, j) =>
      harfler[(i * 13 + j * 7) % harfler.length]
    ).join("");
    return `
    <text x="${x}" y="0" fill="${T.cubuk}" font-size="12" opacity=".3">
      <animate attributeName="opacity" values=".12;.4;.12" dur="${sure}s"
               repeatCount="indefinite" begin="-${i * 0.7}s" />
      ${kolon
        .split("")
        .map((c, j) => `<tspan x="${x}" dy="${j === 0 ? 56 : 15}">${esc(c)}</tspan>`)
        .join("")}
    </text>`;
  }).join("");

  const yorum = satirlar
    .map(
      (s, i) => `
    <text class="gir" style="animation-delay:${(0.5 + i * 0.12).toFixed(2)}s"
          x="58" y="${226 + i * 22}" font-size="13.5" fill="${T.anahtar}">// ${esc(s)}</text>`
    )
    .join("");

  const bilgi = iletisim
    .map(
      (s, i) => `
    <text class="gir" style="animation-delay:${(1.0 + i * 0.1).toFixed(2)}s"
          x="58" y="${312 + i * 22}" font-size="13" fill="${T.metin}">${esc(s.ikon)}  ${esc(s.metin)}</text>`
    )
    .join("");

  return sarmal(
    W,
    H,
    `${ad} - ${rol}. ${satirlar.join(" ")}`,
    `
  <clipPath id="kirp"><rect x="600" y="40" width="386" height="332" /></clipPath>
  ${kutu(
    W,
    H,
    "",
    `
    <g clip-path="url(#kirp)">${yagmur}</g>
    ${Array.from({ length: 16 }, (_, i) => `<text class="kucuk" x="22" y="${64 + i * 21}" font-size="9" opacity=".55">${String(i + 1).padStart(2, "0")}</text>`).join("")}
    <line x1="38" y1="48" x2="38" y2="${H - 34}" stroke="${T.cerceve}" stroke-width="1" />
    <text class="etiket" x="14" y="21">ferhat@github:~$ cat README.md</text>
    <text class="kucuk" x="${W - 14}" y="21" text-anchor="end">v2.0</text>
    <text x="56" y="120" font-size="58" font-weight="700" letter-spacing="6"
          fill="none" stroke="${T.parlak}" stroke-width="1.2" opacity=".85">${esc(
            ad.split(" ")[0].toUpperCase()
          )}</text>
    <text x="56" y="186" font-size="58" font-weight="700" letter-spacing="6"
          fill="none" stroke="${T.metin}" stroke-width="1" opacity=".7">${esc(
            ad.split(" ").slice(1).join(" ").toUpperCase()
          )}</text>
    <text class="etiket" x="482" y="106" font-size="15">&gt; ${esc(rol.toUpperCase())}</text>
    ${yorum}
    ${bilgi}
    <text class="etiket" x="58" y="${H - 18}" font-size="13">ferhat@github:~$ <tspan class="yanip">_</tspan></text>`
  )}`
  );
}

// ----------------------------------------------------------- system_info

function systemInfo(alanlar, diller) {
  const W = 500;
  const H = 350;
  const satir = alanlar
    .map(
      ([k, v], i) => `
    <text class="anahtar" x="16" y="${54 + i * 26}">${esc(k.padEnd(12, " "))}:</text>
    <text class="deger" x="120" y="${54 + i * 26}">${esc(v)}</text>`
    )
    .join("");

  // Alanlarin altinda gercek veri: depolardaki dil dagilimi. Tek satirlik
  // yigilmis cubuk, altinda yuzdeler.
  const ayirici = 54 + alanlar.length * 26 + 12;
  const dilY = ayirici + 30;
  const toplam = diller.reduce((s, d) => s + d.size, 0) || 1;
  const barW = W - 32;
  let kaydir = 16;
  const dilCubuk = diller
    .map((d) => {
      const w = (d.size / toplam) * barW;
      const parca = `<rect x="${kaydir.toFixed(1)}" y="${dilY}" width="${w.toFixed(1)}" height="8" fill="${d.color}" />`;
      kaydir += w;
      return parca;
    })
    .join("");
  const dilYazi = diller
    .slice(0, 4)
    .map((d, i) => {
      const x = 16 + (i % 2) * ((W - 32) / 2);
      const y = dilY + 28 + Math.floor(i / 2) * 20;
      return `
    <circle cx="${x + 4}" cy="${y - 4}" r="4" fill="${d.color}" />
    <text class="anahtar" x="${x + 14}" y="${y}" font-size="11.5">${esc(d.name)}</text>
    <text class="kucuk" x="${x + (W - 32) / 2 - 14}" y="${y}" text-anchor="end">${(
        (d.size / toplam) * 100
      ).toFixed(1)}%</text>`;
    })
    .join("");

  const okuma = [
    ...alanlar.map(([k, v]) => `${k}: ${v}`),
    "Diller: " + diller.map((d) => `${d.name} %${((d.size / toplam) * 100).toFixed(1)}`).join(", "),
  ].join(", ");
  return sarmal(
    W,
    H,
    okuma,
    kutu(
      W,
      H,
      "system_info",
      satir +
        `
    <line x1="16" y1="${ayirici}" x2="${W - 16}" y2="${ayirici}"
          stroke="${T.cerceve}" stroke-width=".8" stroke-dasharray="2 3" />
    <text class="kucuk" x="16" y="${dilY - 12}">depolardaki dil dagilimi</text>` +
        dilCubuk +
        dilYazi
    )
  );
}

// ------------------------------------------------------------ git_status

function gitStatus(satirlar) {
  const W = 500;
  const H = 350;
  const govde = satirlar
    .map(
      ([ikon, ad, deger], i) => `
    <g class="gir" style="animation-delay:${(i * 0.07).toFixed(2)}s">
      <text class="anahtar" x="16" y="${62 + i * 42}" font-size="13">${esc(ikon)}</text>
      <text class="anahtar" x="42" y="${62 + i * 42}">${esc(ad)}</text>
      <text class="deger" x="${W - 16}" y="${62 + i * 42}" text-anchor="end"
            fill="${T.parlak}">${esc(deger)}</text>
      <line x1="16" y1="${74 + i * 42}" x2="${W - 16}" y2="${74 + i * 42}"
            stroke="${T.cerceve}" stroke-width=".8" stroke-dasharray="2 3" />
    </g>`
    )
    .join("");
  return sarmal(
    W,
    H,
    satirlar.map(([, a, d]) => `${a}: ${d}`).join(", "),
    kutu(W, H, "git_status", govde)
  );
}

// -------------------------------------------------------- github_activity

function activity({ toplam, suan, enUzun, ustDil, aktifGun, oran }) {
  const W = 500;
  const H = 280;
  const cx = 116;
  const cy = 150;
  const r = 54;
  const cevre = 2 * Math.PI * r;
  // Halka gercek bir seyi gosteriyor: yilin kac gununde katki var.
  const son = (cevre * (1 - oran)).toFixed(1);

  const satirlar = [
    ["Current Streak", `${suan} gun`],
    ["Longest Streak", `${enUzun} gun`],
    ["Top Language", ustDil],
    ["Aktif gun", `${aktifGun}`],
  ]
    .map(
      ([k, v], i) => `
    <text class="anahtar" x="212" y="${112 + i * 24}">${esc(k)}</text>
    <text class="deger" x="${W - 16}" y="${112 + i * 24}" text-anchor="end">${esc(v)}</text>`
    )
    .join("");

  return sarmal(
    W,
    H,
    `Toplam ${toplam} katki, guncel seri ${suan} gun, en uzun seri ${enUzun} gun`,
    kutu(
      W,
      H,
      "github_activity",
      `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${T.cerceve}" stroke-width="11" />
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${T.cubuk}" stroke-width="11"
            stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
            stroke-dasharray="${cevre.toFixed(1)}" stroke-dashoffset="${son}">
      <animate attributeName="stroke-dashoffset" from="${cevre.toFixed(1)}" to="${son}"
               dur="1.4s" fill="freeze" calcMode="spline" keySplines=".2 .7 .3 1" />
    </circle>
    <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="21" font-weight="700"
          fill="${T.parlak}">${esc(short(toplam))}</text>
    <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="kucuk">Toplam katki</text>
    <text x="${cx}" y="${cy + r + 26}" text-anchor="middle" class="kucuk">gunlerin %${Math.round(
      oran * 100
    )}'inde aktif</text>
    ${satirlar}`
    )
  );
}

// ------------------------------------------------------ contribution_graph

function graph(days, damga) {
  const W = 1000;
  const H = 260;
  const hucre = 14;
  const bosluk = 3;
  const adim = hucre + bosluk;

  // Haftalar sutun, gunler satir. Ilk gunun hafta ici konumuna gore hizala.
  const ilk = new Date(days[0]?.date || Date.now()).getDay();
  const kaydir = (ilk + 6) % 7; // pazartesi = 0
  const hucreler = days
    .map((d, i) => {
      const yer = i + kaydir;
      const hafta = Math.floor(yer / 7);
      const gun = yer % 7;
      const t = d.count === 0 ? 0 : Math.min(4, Math.ceil(d.count / 3));
      const renk = ["none", "#14532d", "#166534", "#22c55e", "#4ade80"][t];
      const cerceve = t === 0 ? ` stroke="${T.cerceve}" stroke-width=".8"` : "";
      return `<rect x="${(44 + hafta * adim).toFixed(1)}" y="${(64 + gun * adim).toFixed(1)}" width="${hucre}" height="${hucre}" rx="2.5" fill="${renk}"${cerceve} />`;
    })
    .join("");

  const gunAdi = ["Pzt", "Car", "Cum"]
    .map(
      (g, i) =>
        `<text class="kucuk" x="12" y="${64 + (i * 2 + 1) * adim - 3}" font-size="10">${g}</text>`
    )
    .join("");

  const aylar = [];
  let sonAy = -1;
  days.forEach((d, i) => {
    const t = new Date(d.date);
    if (Number.isNaN(t.getTime())) return;
    if (t.getDate() <= 7 && t.getMonth() !== sonAy) {
      sonAy = t.getMonth();
      const hafta = Math.floor((i + kaydir) / 7);
      aylar.push(
        `<text class="kucuk" x="${(44 + hafta * adim).toFixed(1)}" y="56" font-size="10">${
          ["Oca", "Sub", "Mar", "Nis", "May", "Haz", "Tem", "Agu", "Eyl", "Eki", "Kas", "Ara"][t.getMonth()]
        }</text>`
      );
    }
  });

  const efsane = ["none", "#14532d", "#166534", "#22c55e", "#4ade80"]
    .map(
      (c, i) =>
        `<rect x="${W - 150 + i * 16}" y="${H - 34}" width="11" height="11" rx="2.5" fill="${c}"${
          i === 0 ? ` stroke="${T.cerceve}" stroke-width=".8"` : ""
        } />`
    )
    .join("");

  const toplam = days.reduce((s, d) => s + d.count, 0);
  return sarmal(
    W,
    H,
    `Son bir yilin katki grafigi, toplam ${toplam} katki`,
    kutu(
      W,
      H,
      "contribution_graph",
      `
    <text class="kucuk" x="${W - 14}" y="21" text-anchor="end">${esc(damga)}</text>
    ${aylar}
    ${gunAdi}
    ${hucreler}
    <text class="anahtar" x="16" y="${H - 24}" font-size="12">Son bir yilda ${toplam} katki</text>
    <text class="kucuk" x="${W - 162}" y="${H - 25}" text-anchor="end">Az</text>
    ${efsane}
    <text class="kucuk" x="${W - 150 + 5 * 16 + 4}" y="${H - 25}">Cok</text>`
    )
  );
}

// ----------------------------------------------------- currently_learning

function learning(konular) {
  const W = 500;
  const H = 260;
  const govde = konular
    .map(([ad, yuzde], i) => {
      const y = 60 + i * 34;
      const gen = 200;
      return `
    <text class="anahtar" x="16" y="${y}">&gt;_ ${esc(ad)}</text>
    <rect x="230" y="${y - 9}" width="${gen}" height="7" rx="3.5" fill="${T.cerceve}" />
    <rect x="230" y="${y - 9}" width="${(gen * yuzde) / 100}" height="7" rx="3.5" fill="${T.cubuk}">
      <animate attributeName="width" from="0" to="${(gen * yuzde) / 100}" dur="1.1s"
               fill="freeze" calcMode="spline" keySplines=".2 .7 .3 1"
               begin="${(i * 0.12).toFixed(2)}s" />
    </rect>
    <text class="deger" x="${W - 16}" y="${y}" text-anchor="end">${yuzde}%</text>`;
    })
    .join("");
  return sarmal(
    W,
    H,
    konular.map(([a, y]) => `${a} %${y}`).join(", "),
    kutu(W, H, "currently_learning", govde) +
      `
  <text class="etiket" x="16" y="${H - 16}" font-size="12">ferhat@github:~$ keep_learning.sh <tspan class="yanip">_</tspan></text>`
  );
}

// ----------------------------------------------------------------- motto

function quote(metin, kim) {
  const W = 1000;
  const H = 200;
  const satirlar = metin.split("\n");
  const govde = satirlar
    .map(
      (s, i) => `
    <text x="${W / 2}" y="${86 + i * 34}" text-anchor="middle" font-size="22"
          letter-spacing="1.5" fill="${T.parlak}" opacity=".92">${esc(s)}</text>`
    )
    .join("");
  const dugme = ["#3d6b42", "#3d6b42", "#f472b6"]
    .map((c, i) => `<circle cx="${W - 62 + i * 18}" cy="17" r="5" fill="none" stroke="${c}" stroke-width="1.2" />`)
    .join("");
  return sarmal(
    W,
    H,
    `${metin.replace(/\n/g, " ")} - ${kim}`,
    kutu(W, H, "terminal", dugme + govde) +
      `
  <text class="anahtar" x="${W - 16}" y="${86 + satirlar.length * 34 + 4}"
        text-anchor="end" font-size="13">- ${esc(kim)}</text>
  <text class="etiket" x="16" y="${H - 16}" font-size="12">ferhat@github:~$ always_building.sh <tspan class="yanip">_</tspan></text>`
  );
}

// ----------------------------------------------------------- last_commit

// Bot commit'leri elenmis oldugu icin burada gercekten elle yazilmis son
// commit duruyor; hic bulunamazsa kart uretilmiyor (main'de kontrol var).
function lastCommit({ repo, mesaj, kim, tarih }) {
  const W = 1000;
  const H = 130;
  return sarmal(
    W,
    H,
    `Son commit: ${mesaj} - ${repo} deposunda ${kim} tarafindan, ${ncOnce(tarih)}`,
    kutu(
      W,
      H,
      "last_commit",
      `
    <text class="kucuk" x="${W - 14}" y="21" text-anchor="end">${esc(repo)}</text>
    <text class="deger" x="16" y="62" font-size="14" fill="${T.parlak}">${esc(mesaj)}</text>
    <text class="anahtar" x="16" y="88">${esc(kim)} &#183; ${esc(ncOnce(tarih))}</text>
    <text class="kucuk" x="16" y="112">${esc(repo)} deposunda</text>`
    )
  );
}

// ------------------------------------------------------------ tech_stack

// Marka renkleri koyu zeminde kaybolabiliyor (GitHub neredeyse siyah).
// Cok koyu olanlari okunur bir parlakliga cekiyoruz, digerlerine dokunmuyoruz.
function fitColor(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const isik = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (isik >= 0.24) return hex;
  const k = 0.24 / Math.max(isik, 0.02);
  const cek = (v) => Math.round(Math.min(255, 40 + v * k));
  return `#${[cek(r), cek(g), cek(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function iconTile(ic) {
  const W = 92;
  const H = 104;
  const olcek = 38 / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ic.ad)}">
  <defs><style>${stil()}
    .kare { fill: ${T.panel}; stroke: ${T.cerceve}; stroke-width: 1; }
    .ad { font-size: 11px; fill: ${T.anahtar}; }
    .suz { animation: suz 4.5s ease-in-out infinite alternate; }
    @keyframes suz { from { transform: translateY(-1.5px); } to { transform: translateY(1.5px); } }
  </style></defs>
  <rect width="${W}" height="${H}" fill="${T.zemin}" />
  <rect class="kare" x=".5" y=".5" width="${W - 1}" height="${H - 22}" rx="3" />
  <!-- Konumlandirma disardaki grupta, animasyon icerdekinde: CSS transform
       ayni ogedeki transform OZNITELIGINI tumuyle eziyor, ikisi bir arada
       olursa tarayicida logo olceksiz halde sol uste dusuyor. -->
  <g transform="translate(${(W - 38) / 2} 22) scale(${olcek})">
    <g class="suz"><path d="${ic.path}" fill="${fitColor(ic.hex)}" /></g>
  </g>
  <text class="ad" x="${W / 2}" y="${H - 5}" text-anchor="middle">${esc(ic.ad)}</text>
</svg>
`;
}

// ---------------------------------------------------------------- footer

function footer() {
  const W = 1000;
  const H = 90;
  return sarmal(
    W,
    H,
    "SYSTEM ONLINE - ziyaretin icin tesekkurler",
    kutu(
      W,
      H,
      "",
      `
    <text class="etiket" x="20" y="40" font-size="14" font-weight="700">SYSTEM ONLINE</text>
    <text class="anahtar" x="20" y="62" font-size="12.5">Ugradigin icin tesekkurler.</text>
    <text class="kucuk" x="${W - 20}" y="62" text-anchor="end">Bu sayfadaki kartlar bu depoda uretiliyor.</text>
    <circle cx="${W - 24}" cy="34" r="4" fill="${T.parlak}">
      <animate attributeName="opacity" values="1;.25;1" dur="2.4s" repeatCount="indefinite" />
    </circle>`,
      { basY: 26 }
    )
  );
}

// ------------------------------------------------------------------ veri

const QUERY = `
query($login: String!) {
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
    sonRepolar: repositories(first: 5, ownerAffiliations: OWNER, isFork: false,
                             orderBy: {field: PUSHED_AT, direction: DESC}) {
      nodes {
        name
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: 15) {
                nodes { messageHeadline committedDate author { user { login } name } }
              }
            }
          }
        }
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
      const prev = byLang.get(e.node.name) || { name: e.node.name, color: e.node.color || T.sonuk, size: 0 };
      prev.size += e.size;
      byLang.set(e.node.name, prev);
    }
  }

  const days = c.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .map((d) => ({ date: d.date, count: d.contributionCount }));

  return {
    sonCommit: sonCommitSec(u.sonRepolar.nodes),
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

// Kart uretimi commit atiyor; bot commit'leri "son commit" olarak gosterilirse
// kart kendi kendini anlatir hale geliyor, o yuzden onlari atliyoruz.
const BOT = /\[bot\]|github-actions/i;
// Merge commit'leri de elenir: yazilmis bir is degil, birlestirme kaydi.
// Kalanlar gercekten elle yazilmis commit'ler oluyor.
const MERGE = /^Merge (pull request|branch|remote-tracking)/i;

function sonCommitSec(repolar) {
  for (const r of repolar) {
    for (const c of r.defaultBranchRef?.target?.history?.nodes || []) {
      const kim = c.author?.user?.login || c.author?.name || "";
      if (BOT.test(kim) || MERGE.test(c.messageHeadline)) continue;
      return { repo: r.name, mesaj: c.messageHeadline, kim, tarih: c.committedDate };
    }
  }
  return null;
}

// "2 saat once" gibi. Kart alti saatte bir uretildigi icin dakika hassasiyeti
// zaten anlamsiz, en yakin buyuk birim yeterli.
function ncOnce(tarih) {
  const fark = (Date.now() - new Date(tarih).getTime()) / 1000;
  const birim = [
    [31536000, "yil"], [2592000, "ay"], [604800, "hafta"],
    [86400, "gun"], [3600, "saat"], [60, "dakika"],
  ];
  for (const [sn, ad] of birim) {
    if (fark >= sn) return `${Math.floor(fark / sn)} ${ad} once`;
  }
  return "az once";
}

function mockData() {
  const bugun = new Date();
  const days = Array.from({ length: 371 }, (_, i) => {
    const t = new Date(bugun);
    t.setDate(t.getDate() - (370 - i));
    return {
      date: t.toISOString().slice(0, 10),
      count: i < 300 ? 0 : Math.max(0, Math.round(Math.sin(i / 3) * 4 + 2)),
    };
  });
  return {
    sonCommit: {
      repo: "acik-defter",
      mesaj: "Notlar sayfasina etiket filtresi ekle",
      kim: "Ferhat-Yasinoglu",
      tarih: new Date(Date.now() - 7200e3).toISOString(),
    },
    name: "Ferhat Yasinoglu",
    totalContributions: 21,
    commits: 18,
    prs: 2,
    repos: 3,
    stars: 4,
    followers: 2,
    langs: [
      { name: "JavaScript", color: "#f1e05a", size: 62000 },
      { name: "TypeScript", color: "#3178c6", size: 41000 },
      { name: "HTML", color: "#e34c26", size: 24000 },
      { name: "CSS", color: "#563d7c", size: 12000 },
    ],
    days,
  };
}

// Seri: bugunden geriye kesintisiz dolu gun sayisi. Bugun henuz bos olabilir,
// o yuzden son gunu atlayip devam etmeye izin veriyoruz.
function seriler(days) {
  let enUzun = 0;
  let kosu = 0;
  for (const d of days) {
    kosu = d.count > 0 ? kosu + 1 : 0;
    if (kosu > enUzun) enUzun = kosu;
  }
  let suan = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) suan++;
    else if (i === days.length - 1) continue;
    else break;
  }
  return { suan, enUzun };
}

// ------------------------------------------------------------------ main

const AD = "Ferhat Yasinoglu";
const ROL = "Full Stack Developer";

const useMock = process.argv.includes("--mock");
const login = process.env.GH_LOGIN || "Ferhat-Yasinoglu";
const data = useMock ? mockData() : await fetchData(login, process.env.GITHUB_TOKEN);

const stamp = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
}).format(new Date());

const { suan, enUzun } = seriler(data.days);
const aktifGun = data.days.filter((d) => d.count > 0).length;
const oran = aktifGun / Math.max(1, data.days.length);

await mkdir(OUT, { recursive: true });

const cards = {
  "hero.svg": hero({
    ad: AD,
    rol: ROL,
    satirlar: [
      "Dusunur, tasarlar ve kodlarim.",
      "Kullanici deneyimini onemseyen,",
      "cevrimdisi calisan web uygulamalari gelistiriyorum.",
      "Her gun daha iyisini uretmek icin calisiyorum.",
    ],
    iletisim: [
      { ikon: "@", metin: "Dusseldorf, Germany" },
      { ikon: "#", metin: "farhadyaqoobi.kunduz@gmail.com" },
      { ikon: "~", metin: "ferhat-yasinoglu.github.io" },
    ],
  }),
  "system-info.svg": systemInfo(
    [
      ["Name", AD],
      ["Role", ROL],
      ["Status", "Building cool stuff"],
      ["Experience", "2+ yil"],
      ["Location", "Dusseldorf, Germany"],
      ["Focus", "Web Development"],
      ["Languages", "de / tr / en / fa"],
    ],
    data.langs
  ),
  // Son commit bulunamazsa (butun gecmis bot commit'i) kart uretilmez.
  ...(data.sonCommit ? { "last-commit.svg": lastCommit(data.sonCommit) } : {}),
  "git-status.svg": gitStatus([
    ["[]", "Repositories", short(data.repos)],
    ["<>", "Followers", short(data.followers)],
    ["*", "Stars", short(data.stars)],
    ["^", "Commits", short(data.commits)],
    ["%", "Pull Requests", short(data.prs)],
    ["+", "Contributions", short(data.totalContributions)],
  ]),
  "activity.svg": activity({
    toplam: data.totalContributions,
    suan,
    enUzun,
    ustDil: data.langs[0]?.name || "-",
    aktifGun,
    oran,
  }),
  "graph.svg": graph(data.days, stamp),
  "learning.svg": learning([
    ["React", 70],
    ["Node.js", 60],
    ["Firebase", 80],
    ["Backend", 65],
  ]),
  "quote.svg": quote("BUILD IT\nTO UNDERSTAND IT", AD),
  ...Object.fromEntries(ICONS.map((ic) => [`icon-${ic.slug}.svg`, iconTile(ic)])),
  "footer.svg": footer(),
};

for (const [file, svg] of Object.entries(cards)) {
  await writeFile(join(OUT, file), svg, "utf8");
  console.log(`yazildi: assets/${file} (${svg.length} bayt)`);
}
