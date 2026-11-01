#!/usr/bin/env node
// GitHub profilinin butun kartlarini uretir (Seyir tasarimi).
//
// Tasarim dili fyajan.com'un «Seyir»idir (Pusula «landing-redesign»): siyah,
// altin ve kopuk; serif basliklar, mono okuma degerleri, her bolum bir pusula
// acisi. Ortak parcalar seyir/ altinda:
//   kit.mjs       palet, yazi olcusu, kadran, ibre, rota dikisi, split-flap ...
//   fontlar.mjs   kartta gecen harflere indirgenmis yazi tiplerini gomer (subset.py)
//   baslik.mjs    baslik (FY logosu degismeden, cayro-pusulanin ortasinda),
//                 menu cipleri, istasyon basliklari
//   kart.mjs      proje kartlari (ikili / genis) + sanat.mjs (her projenin cizimi)
//   projeler.mjs  butun projeler (metinler projelerin kendi README'lerinden)
//   harita.mjs    NRW ⇄ Kabil haritasi
//   veri.mjs      hakkinda, teknoloji, diller, sayilar, aktivite, alt bilgi
//
// Yerel deneme: node cards.mjs --mock [--out klasor]
// Gereken: Node 20+; yazi tiplerini gommek icin python3 + fonttools + brotli
// (yoksa kartlar sistem yazi tipleriyle uretilir).

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { sifirla } from "./seyir/kit.mjs";
import { gom } from "./seyir/fontlar.mjs";
import { header, navCip, istasyon, ISTASYONLAR } from "./seyir/baslik.mjs";
import { ikili, genis } from "./seyir/kart.mjs";
import { PROJELER, BOLUM_ACI } from "./seyir/projeler.mjs";
import { harita } from "./seyir/harita.mjs";
import { hakkinda, ikonKaro, diller, sayilar, aktivite, altbilgi } from "./seyir/veri.mjs";
import { S } from "./seyir/kit.mjs";

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

// README'deki teknoloji sirasi (slug). Dalga bu sirayla gecer.
const TEKNOLOJI = [
  "javascript", "typescript", "html5", "css", "python", "nodejs", "nextdotjs", "react", "electron", "pwa",
  "cloudflareworkers", "sqlite", "firebase", "mcp", "anthropic", "telegram", "leaflet", "vitest", "git", "github", "linux", "figma",
];

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
      const prev = byLang.get(e.node.name) || { name: e.node.name, color: e.node.color || "#8a7e64", size: 0 };
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
  const bugun = Date.UTC(2026, 10, 1);
  const days = Array.from({ length: 120 }, (_, i) => ({
    date: new Date(bugun - (119 - i) * 864e5).toISOString().slice(0, 10),
    count: i < 50 ? 0 : Math.round(Math.abs(Math.sin(i / 3.3) * 9) + (i % 11 === 0 ? 14 : 0)),
  }));
  return {
    name: "Ferhat Yasinoglu",
    totalContributions: 1342,
    commits: 1180,
    prs: 64,
    repos: 3,
    stars: 4,
    followers: 2,
    langs: [
      { name: "JavaScript", color: "#f1e05a", size: 62000 },
      { name: "TypeScript", color: "#3178c6", size: 30000 },
      { name: "Python", color: "#3572A5", size: 14000 },
      { name: "HTML", color: "#e34c26", size: 9000 },
      { name: "CSS", color: "#563d7c", size: 6000 },
      { name: "Shell", color: "#89e051", size: 1200 },
    ],
    days,
  };
}

// ------------------------------------------------------------------ main

// GitHub profilindeki ad alani sustu harfler icerebiliyor; basligi sabit tutuyoruz.
const AD = "Farhad Yaqoobi";
const ITALIK = "Software that keeps working when the power doesn't.";
const GIRIS =
  "Offline-first apps for small businesses in Afghanistan, an AI gateway for coding agents, and the sites that tell their story — built by hand in NRW, Germany.";

// --veri dosya.json: API'ye gitmeden kayitli bir veriyle uret (yerel onizleme)
const useMock = process.argv.includes("--mock");
const veriFlag = process.argv.indexOf("--veri");
const login = process.env.GH_LOGIN || "Ferhat-Yasinoglu";
const data = useMock
  ? mockData()
  : veriFlag > -1
    ? JSON.parse(await readFile(resolve(process.argv[veriFlag + 1]), "utf8"))
    : await fetchData(login, process.env.GITHUB_TOKEN);

const stamp = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
}).format(new Date());

// Istasyon basliklari (README bolumleri)
const ISTASYON_METNI = {
  products: {
    baslik: "Software for Afghan small businesses",
    italik: "The till keeps selling when the power goes out.",
    giris:
      "Pharmacies, clinics, shops, land agents and language schools. Every app installs from the browser, keeps its records on the device, works without internet or electricity and syncs when the line comes back. Licences, trials and payments run through one hub, FY Merkez.",
  },
  ai: {
    baslik: "AI tools and platforms",
    italik: "Gateways, studios and bots that do the work.",
    giris:
      "An open-source gateway that keeps coding agents running across hundreds of model providers, a one-Worker publishing platform, studios for social flows and ad posts, a Telegram funnel server driven over MCP, and a scraper that turns the web into Markdown.",
  },
  sites: {
    baslik: "Sites, written by hand",
    italik: "No framework, no build step, no tracking.",
    giris:
      "Plain HTML, CSS and JavaScript in four languages — right-to-left in Persian, readable offline, and every animation stops when the system asks for less motion.",
  },
  about: {
    baslik: "Who's on the bridge",
    italik: "IT student, developer, founder of FY.",
    giris:
      "I live in North Rhine-Westphalia and speak German, Turkish, English and Persian. I build things to understand them, and I keep everything in a repository — code that never reached one is lost.",
  },
  tech: {
    baslik: "Instruments on the bridge",
    italik: "What the projects above are built with.",
    giris: "Currently learning Cloudflare D1, the Meta Graph API, and how far an AI agent can be trusted inside a product.",
  },
  logbook: {
    baslik: "Logbook",
    italik: "Read from the GitHub API every six hours.",
    giris: "No third-party card service: a script in this repository draws these from live data and commits only what changed.",
  },
  contact: {
    baslik: "Say hello",
    italik: "Offline-first apps, messaging APIs, AI agents — or whatever you're building.",
    giris: "",
  },
};

const TERMINAL = [
  { tip: "komut", metin: "whoami" },
  { tip: "cikti", metin: "Farhad Yaqoobi — developer, founder of FY, NRW", renk: S.foam },
  { tip: "komut", metin: "cat stack.txt" },
  { tip: "cikti", metin: "JavaScript · TypeScript · PWA · Node · Workers", renk: S.goldHi },
  { tip: "komut", metin: "ls ~/projects | wc -l" },
  { tip: "cikti", metin: `${PROJELER.length} — 8 of them work offline`, renk: S.gold },
  { tip: "komut", metin: "locale -a" },
  { tip: "cikti", metin: "de_DE  tr_TR  en_US  fa_AF", renk: S.mist },
  { tip: "komut", metin: "cat learning.md" },
  { tip: "cikti", metin: "Cloudflare D1 · Meta Graph API · MCP", renk: S.gold },
  { tip: "komut", metin: "echo $MOTTO" },
  { tip: "cikti", metin: "Build it to understand it.", renk: S.goldHi },
  { tip: "komut", metin: "tail -1 lessons.md" },
  { tip: "cikti", metin: "Code that never reached the repo is lost.", renk: S.mistDim },
];

// Kartlar her calismada bastan uretiliyor ama icerikleri cogu zaman ayni
// kaliyor; yalnizca zaman damgasi yuzunden commit atmamak icin dosyaya ancak
// tarih disinda bir sey degistiyse dokunuyoruz.
const tarihsiz = (svg) => svg.replace(/<tspan class="tarih">[^<]*<\/tspan>/, "");

async function yazDegistiyse(file, svg) {
  const yol = join(OUT, file);
  const onceki = await readFile(yol, "utf8").catch(() => null);
  if (onceki !== null && tarihsiz(onceki) === tarihsiz(svg)) return false;
  await writeFile(yol, svg, "utf8");
  return true;
}

await mkdir(OUT, { recursive: true });

const kartlar = {};
const kart = (ad, f) => {
  sifirla(); // id sayaci her kartta sifirdan: ayni girdi, ayni bayt
  kartlar[ad] = f();
};

kart("header.svg", () =>
  header({
    ad: AD,
    italik: ITALIK,
    giris: GIRIS,
    almanak: [
      { deger: PROJELER.length, etiket: "projects shipped" },
      { deger: data.totalContributions, etiket: "contributions this year" },
      { deger: 6, etiket: "interface languages" },
      { deger: 8, etiket: "apps that run offline" },
      { deger: 5236, etiket: "km from NRW to Kabul" },
    ],
  })
);
for (const ist of ISTASYONLAR.slice(1)) {
  kart(`nav-${ist.id}.svg`, () => navCip(ist));
  kart(`station-${ist.id}.svg`, () => istasyon({ aci: ist.aci, etiket: ist.etiket, ...ISTASYON_METNI[ist.id] }));
}
kart("map.svg", () => harita());
const sira = {};
for (const p of PROJELER) {
  sira[p.bolum] = (sira[p.bolum] || 0) + 1;
  const q = { ...p, no: sira[p.bolum], aci: BOLUM_ACI[p.bolum] };
  kart(`project-${p.id}.svg`, () => (p.genis ? genis(q) : ikili(q)));
}
kart("about.svg", () => hakkinda(TERMINAL));
TEKNOLOJI.forEach((slug, i) => {
  const ic = ICONS.find((x) => x.slug === slug);
  if (!ic) throw new Error(`icons.json'da yok: ${slug}`);
  kart(`icon-${slug}.svg`, () => ikonKaro(ic, i));
});
kart("languages.svg", () => diller(data.langs));
kart("stats.svg", () => sayilar(data));
kart("activity.svg", () => aktivite(data.days, stamp));
kart("footer.svg", () => altbilgi());

const hazir = gom(kartlar);
let degisen = 0;
for (const [file, svg] of Object.entries(hazir)) {
  if (await yazDegistiyse(file, svg)) {
    degisen++;
    console.log(`yazildi: ${file} (${svg.length} bayt)`);
  }
}
console.log(`${degisen}/${Object.keys(hazir).length} kart guncellendi`);
