// Butun projeler. Metinler projelerin kendi README'lerinden ve fyajan.com/projects
// sayfasindan; orada olmayan vaat ya da rakam yazilmaz. Ozel depolarin kodu
// paylasilmaz: kartta yalnizca ne yaptiklari ve kimin icin olduklari var.
//
// durum: live (yayinda, baglanti acilir) · open (acik kaynak, lisansli) ·
//        source (kaynak GitHub'da ama lisans yok: acik kaynak denmez) · internal (ekip ici)
// sanat: sanat.mjs'teki cizim

export const PROJELER = [
  // ------------------------------------------------------------ 045° urunler
  {
    id: "dawayar",
    bolum: "products",
    ad: "Dawayar",
    fa: "دوایار",
    tur: "Pharmacy",
    italik: "The till keeps selling when the power doesn't.",
    aciklama:
      "Stock by batch and expiry, a barcode till, purchases, customer and supplier credit and reports for Afghan pharmacies. Records live in the browser first; a small Worker syncs the devices when the line comes back.",
    cipler: ["Dari · Pashto · English", "Shamsi", "IndexedDB", "Workers"],
    durum: "live",
    link: "https://dawayar.pages.dev/",
    sanat: "dawayar",
  },
  {
    id: "mini-dakhl",
    bolum: "products",
    ad: "Mini Dakhl",
    fa: "مینی دخل",
    tur: "Accounting",
    italik: "Exact books, a balance for every currency.",
    aciklama:
      "Day book, receivables, stock and warehouse, buying and selling, hawala transfers and currency exchange for shops, wholesalers, sarrafs and fuel stations. Offline first, synced across the business's devices.",
    cipler: ["Dari · Pashto · English", "AFG · USD · PKR", "PWA", "Workers"],
    durum: "live",
    link: "https://mini-dakhl.pages.dev/",
    sanat: "minidakhl",
  },
  {
    id: "shafa",
    bolum: "products",
    ad: "Shafa",
    fa: "شفا",
    tur: "Clinic",
    italik: "A prescription, written the way it is on paper.",
    aciklama:
      "Prescriptions and patient records for a clinic doctor: 24 letterhead designs, a signed 8-character code against forged prescriptions, allergy and duplicate-ingredient warnings. Patient data stays on the device.",
    cipler: ["Dari · Pashto · English", "opt-in encrypted sync"],
    durum: "live",
    link: "https://shafa.pages.dev/",
    sanat: "shafa",
  },
  {
    id: "nusha",
    bolum: "products",
    ad: "Nüsha",
    fa: "نسخه‌نویسی",
    tur: "Prescriptions",
    italik: "Shafa's forerunner: write, print, keep the record.",
    aciklama:
      "A computer prescription system for one doctor — on the web, as an Android APK and as a Windows install. Six paper templates, bilingual letterhead, patient history with vitals and diagnosis. Patient data never leaves the machine.",
    cipler: ["Web · Android · Windows", "Dari · English", "offline"],
    durum: "live",
    link: "https://nuskha.pages.dev/",
    sanat: "nusha",
  },
  {
    id: "zamin",
    bolum: "products",
    ad: "Zamin",
    fa: "نقشهٔ زمین",
    tur: "Land",
    italik: "Measure a plot from the sky, by GPS, or by its sides.",
    aciklama:
      "Land measuring, dividing and selling for Afghan property agents: satellite map, GPS, side lengths and coordinates; jerib, biswa and m²; split by frontage, area or inheritance share; A4 report, sale poster and 43 calculators.",
    cipler: ["PWA + Android", "Leaflet", "Dari · Pashto · English"],
    durum: "live",
    link: "https://naqsha-zamin.pages.dev/",
    sanat: "zamin",
  },
  {
    id: "netstore",
    bolum: "products",
    ad: "NetStore",
    tur: "Shop",
    italik: "Who bought what, who owes what, what runs out.",
    aciklama:
      "Stock, sales, customers, debt and collections for a retail shop: a dashboard of investment, sales, profit and low stock, invoices that print, dark and light themes, Dari with Persian numerals — and it keeps working offline.",
    cipler: ["vanilla JS", "Dari · Turkish · English", "PWA"],
    durum: "live",
    link: "https://fy-netstore.pages.dev/",
    sanat: "netstore",
  },
  {
    id: "fy-language",
    bolum: "products",
    ad: "FY Language",
    tur: "Language school",
    italik: "Attendance in seconds, receipts without gaps.",
    aciklama:
      "Students, classes, timetable, attendance, fees by Shamsi month, receipts with the amount in words, exams and bilingual certificates for private language courses in Afghanistan. Works without internet too.",
    cipler: ["Dari · Pashto · English", "Shamsi · Kabul time", "Workers"],
    durum: "live",
    link: "https://dil-platform.fyajan.com/",
    sanat: "fylang",
  },
  {
    id: "fy-merkez",
    bolum: "products",
    ad: "FY Merkez",
    tur: "Licence hub",
    italik: "One hub for every app's licences, customers and cash.",
    aciklama:
      "The panel and server behind all the apps: Gmail sign-in, free trials (15 days by default), one-device licences and cloned-session detection; payments in cash, M-Paisa or HesabPay; a cash desk and a map of customers by city.",
    cipler: ["Worker + Durable Object", "SQLite", "Turkish · Dari"],
    durum: "internal",
    link: null,
    sanat: "fymerkez",
  },

  // ------------------------------------------------------------ 090° AI ve platformlar
  {
    id: "pusula",
    bolum: "ai",
    genis: true,
    ad: "Pusula",
    tur: "AI gateway",
    italik: "Never stop coding: when one quota runs out, the next provider answers.",
    aciklama:
      "Claude Code, Codex, Cursor and Cline talk to Pusula instead of a single vendor. It keeps the keys and sign-ins for hundreds of providers, serves them through one OpenAI-compatible endpoint, falls back automatically and stacks RTK and Caveman compression so prompts cost fewer tokens. A rebrand and continuation of OmniRoute (MIT), kept in sync with upstream.",
    olcum: [
      { deger: "375", etiket: "providers" },
      { deger: "20", etiket: "routing strategies" },
      { deger: "4", etiket: "UI languages" },
    ],
    cipler: ["TypeScript", "Next.js", "SQLite", "MCP", "Electron", "MIT"],
    durum: "open",
    link: "https://github.com/Ferhat-Yasinoglu/pusula",
    sanat: "pusula",
    sanatW: 452,
    minH: 380,
  },
  {
    id: "yayin",
    bolum: "ai",
    ad: "Yayın",
    tur: "Publishing",
    italik: "Your GitHub sites, under your own domain.",
    aciklama:
      "Add a static site from a GitHub repository and it is served at its own subdomain — the FY Language site runs at dil-platform.fyajan.com. One Cloudflare Worker, no build step; a cron checks every project every ten minutes.",
    cipler: ["one Worker", "KV", "cron", "no dependencies"],
    durum: "internal",
    link: null,
    sanat: "yayin",
  },
  {
    id: "sosyal-studyo",
    bolum: "ai",
    ad: "Sosyal Stüdyo",
    tur: "Social automation",
    italik: "Build a flow once; it runs the same way every time.",
    aciklama:
      "Flows, contacts and scores, bulk messages, growth tools, an AI agent and tools for ideas, scripts, hooks and carousels. Fully usable in local mode; a Worker adds Telegram, Instagram, WhatsApp and AI.",
    cipler: ["PWA", "D1", "Workers AI", "4 languages"],
    durum: "live",
    link: "https://sosyal-studyo.pages.dev/",
    sanat: "sosyal",
  },
  {
    id: "fy-reklam",
    bolum: "ai",
    ad: "FY Reklam",
    tur: "Ad studio",
    italik: "Designs the post, writes the caption, ships it.",
    aciklama:
      "A studio for Instagram and Facebook posts about the products: square, portrait and story formats, five templates, captions checked live against platform limits, JPEG export with fonts embedded, publishing through the Meta API.",
    cipler: ["Meta Graph API", "SVG → canvas", "PWA"],
    durum: "internal",
    link: null,
    sanat: "fyreklam",
  },
  {
    id: "botflow-mcp",
    bolum: "ai",
    ad: "botflow-mcp",
    tur: "Telegram funnels",
    italik: "Chatbot funnels, built by talking to a model.",
    aciklama:
      "Connect a bot, describe a flow in plain steps, and the server runs the conversation: questions, answers, button branches, tags and broadcasts to tagged segments. It speaks MCP; Telegram is reached by long polling.",
    cipler: ["TypeScript", "MCP", "node:sqlite", "Vitest"],
    durum: "open",
    link: "https://github.com/Ferhat-Yasinoglu/ferhat-yasinoglu/tree/main/botflow-mcp",
    sanat: "botflow",
  },
  {
    id: "kazi",
    bolum: "ai",
    ad: "kazi",
    tur: "Scraper",
    italik: "Web pages and PDFs in, clean Markdown out.",
    aciklama:
      "A small, personal Firecrawl-like tool: scrape, map and crawl sites into Markdown, read PDFs page by page, extract JSON to a schema with Claude and search the web from the terminal; scrape, map and extract also run in a token-guarded web UI.",
    cipler: ["Python", "Playwright", "Claude API", "SSRF guard"],
    durum: "source",
    link: "https://github.com/Ferhat-Yasinoglu/ferhat-yasinoglu/tree/main/kazi",
    sanat: "kazi",
  },

  // ------------------------------------------------------------ 135° siteler
  {
    id: "fy-ajans",
    bolum: "sites",
    genis: true,
    ad: "fyajan.com",
    tur: "AI agency",
    italik: "A bearing that finds the right knowledge — the design this profile borrows.",
    aciklama:
      "The agency's site in the Seyir design: a gyro-compass bridge, eight stations, a free seven-chapter AI course in four languages, the FY assistant with voice, a language academy and a ten-step station that sets up your own assistant. No framework, no tracking.",
    olcum: [
      { deger: "8", etiket: "stations" },
      { deger: "140", etiket: "lessons" },
      { deger: "4", etiket: "languages" },
    ],
    cipler: ["HTML · CSS · JS", "Canvas", "Workers", "no tracking"],
    durum: "live",
    link: "https://fyajan.com/",
    sanat: "fyajans",
    sanatW: 452,
    minH: 380,
  },
  {
    id: "acik-defter",
    bolum: "sites",
    ad: "Açık Defter",
    tur: "Personal site",
    italik: "An IT student's open notebook.",
    aciklama:
      "A lined school notebook on a desk — red margin, stitched spine, bookmark tabs; dark mode is the same notebook under a lamp. Four languages, right-to-left in Persian, readable offline, checked in a real browser.",
    cipler: ["no framework", "View Transitions", "Service Worker"],
    durum: "live",
    link: "https://ferhat-yasinoglu.github.io/acik-defter/",
    sanat: "acikdefter",
  },
  {
    id: "profil",
    bolum: "sites",
    ad: "This profile",
    tur: "Generated",
    italik: "Every card here is drawn by a script in this repo.",
    aciklama:
      "A Node script reads the GitHub API and writes these animated SVGs, with fonts subset and embedded per card. A workflow reruns it every six hours and commits only the cards whose content changed.",
    cipler: ["Node", "SVG + CSS", "fonttools", "Actions"],
    durum: "source",
    link: "https://github.com/Ferhat-Yasinoglu/ferhat-yasinoglu/blob/main/.github/scripts/cards.mjs",
    sanat: "profil",
  },
];

export const BOLUM_ACI = { products: 45, ai: 90, sites: 135 };
