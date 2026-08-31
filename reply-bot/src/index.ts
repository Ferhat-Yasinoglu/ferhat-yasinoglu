#!/usr/bin/env node
/**
 * Three ways in:
 *
 *   reply-bot                                 serve every configured channel
 *   reply-bot --doctor                        check the setup before the first message
 *   reply-bot --try "fiyat?"                  answer one message on the terminal
 *   reply-bot --try --whatsapp "merhaba"      …as the WhatsApp channel would
 *
 * `--try` sends nothing and needs no credentials, which makes it the way to
 * write rules: change the file, run it, see the reply. `--doctor` only reads.
 *
 * Settings come from the environment, with anything the web panel has saved
 * laid over the top — so every entry point here sees the same configuration the
 * running server does, whether it was typed into a `.env` or into a browser.
 */

import type { Router } from "express";
import { claudeReplier } from "./ai.js";
import { Bot } from "./bot.js";
import { instagramChannel } from "./channels/instagram.js";
import type { Channel, ChannelName } from "./channels/types.js";
import { whatsappChannel } from "./channels/whatsapp.js";
import { loadConfig, loadRules, type Config } from "./config.js";
import { runDoctor, webhookLines, worstStatus, type Status } from "./doctor.js";
import { Auth } from "./panel/auth.js";
import { panelRouter } from "./panel/routes.js";
import type { Rule } from "./rules.js";
import { Runtime } from "./runtime.js";
import { createApp } from "./server.js";
import { SettingsStore } from "./store.js";

const log = (message: string, detail?: unknown) => {
  const stamp = new Date().toISOString();
  if (detail === undefined) console.log(`${stamp} ${message}`);
  else console.log(`${stamp} ${message}`, detail);
};

const MARK: Record<Status, string> = { ok: "✓", warn: "!", fail: "✗" };
const PANEL_PATH = "/panel";

async function doctor(config: Config, argv: string[], store: SettingsStore): Promise<number> {
  // Rules are reported as a check rather than thrown, so one run shows
  // everything that is wrong instead of stopping at the first thing.
  let rules: Rule[] | undefined;
  let rulesError: string | undefined;
  try {
    rules = loadRules(config.rulesFile);
  } catch (error) {
    rulesError = (error as Error).message;
  }

  const urlIndex = argv.indexOf("--url");
  const publicUrl = urlIndex !== -1 ? argv[urlIndex + 1] : undefined;
  const offline = argv.includes("--offline");

  const checks = await runDoctor({
    config,
    ...(rules ? { rules } : {}),
    ...(rulesError ? { rulesError } : {}),
    ...(offline ? {} : { fetcher: fetch }),
    ...(publicUrl ? { publicUrl } : {}),
  });

  checks.push(...panelChecks(config, store));

  console.log();
  for (const check of checks) {
    console.log(`  ${MARK[check.status]} ${check.name.padEnd(18)} ${check.detail}`);
  }

  const lines = webhookLines(config, publicUrl);
  if (lines.length) {
    console.log("\n  Meta paneline yapıştırılacak:");
    for (const line of lines) console.log(`    ${line}`);
    if (!publicUrl) console.log("    (herkese açık adresini --url ile verirsen tam hâlini yazar)");
  }

  const worst = worstStatus(checks);
  console.log(
    `\n  ${worst === "fail" ? "Eksik var, bot bu hâliyle çalışmaz." : worst === "warn" ? "Çalışır — yukarıdaki uyarılara bak." : "Hazır."}\n`,
  );
  return worst === "fail" ? 1 : 0;
}

/** The panel's own preflight — it holds tokens, so its lock is worth checking. */
function panelChecks(config: Config, store: SettingsStore): { name: string; status: Status; detail: string }[] {
  const checks: { name: string; status: Status; detail: string }[] = [];
  const password = process.env.PANEL_PASSWORD ?? "";

  if (!password) {
    checks.push({ name: "panel", status: "warn", detail: "kapalı: PANEL_PASSWORD yok, panel hiç açılmıyor" });
  } else if (password.length < 12) {
    checks.push({
      name: "panel",
      status: "fail",
      detail: `şifre ${password.length} karakter — en az 12 olmalı, panel token'ları tutuyor`,
    });
  } else {
    checks.push({ name: "panel", status: "ok", detail: `açık, ${PANEL_PATH} altında` });
  }

  if (store.error) {
    checks.push({ name: "panel kaydı", status: "fail", detail: store.error });
  } else if (password) {
    const saved = store.state().filter((field) => field.source === "panel").length;
    checks.push({
      name: "panel kaydı",
      status: "ok",
      detail: `${store.file}: panelden ${saved} değer`,
    });
  }

  // A channel deliberately parked under the panel prefix would be shadowed by
  // it, and the delivery would 404 with nothing in the log to explain why.
  for (const channel of [config.instagram, config.whatsapp]) {
    if (channel && (channel.path === PANEL_PATH || channel.path.startsWith(`${PANEL_PATH}/`))) {
      checks.push({
        name: "webhook yolu",
        status: "fail",
        detail: `${channel.path} panelin altında kalıyor — teslimatlar panele düşer`,
      });
    }
  }
  return checks;
}

async function main(argv: string[]): Promise<number> {
  const store = new SettingsStore();
  const config = loadConfig(store.environment());

  if (argv.includes("--doctor")) return doctor(config, argv, store);

  const tryIndex = argv.indexOf("--try");
  if (tryIndex !== -1) {
    const rules = loadRules(config.rulesFile);
    const rest = argv.slice(tryIndex + 1);
    const channelName: ChannelName = rest.includes("--whatsapp") ? "whatsapp" : "instagram";
    const text = rest.filter((word) => word !== "--whatsapp" && word !== "--instagram").join(" ").trim();

    if (!text) {
      console.error('usage: reply-bot --try [--whatsapp] "the message text"');
      return 2;
    }

    // A stand-in channel: same capabilities as the real one, sends nothing.
    const channel: Channel =
      channelName === "whatsapp"
        ? whatsappChannel({ accessToken: "", phoneNumberId: "try", verifyToken: "", appSecret: "" })
        : instagramChannel({ accessToken: "", igUserId: "try", verifyToken: "", appSecret: "" });

    const replier =
      config.anthropicApiKey && config.persona
        ? claudeReplier({
            persona: config.persona,
            apiKey: config.anthropicApiKey,
            model: config.model,
            maxChars: config.maxChars,
          })
        : undefined;
    const bot = new Bot({ rules, ...(replier ? { replier } : {}), maxChars: config.maxChars, dryRun: true });
    const action = await bot.decide(
      {
        channel: channelName,
        id: "try",
        text,
        authorId: "try-user",
        username: "someone",
        at: new Date(),
      },
      channel,
    );

    console.log(`\n  kanal    ${channelName}`);
    console.log(`  mesaj    ${text}`);
    console.log(`  karar    ${action.kind} (${action.reason})`);
    if (action.kind === "reply") {
      if (action.text) console.log(`  cevap    ${action.text}`);
      if (action.privateReply) console.log(`  dm       ${action.privateReply}`);
    }
    console.log();
    return 0;
  }

  const runtime = new Runtime({ store, log });
  const snapshot = runtime.current;

  if (snapshot.missing.length) {
    // With the panel on, a bare machine is a legitimate starting point: you
    // deploy it empty and fill it in from the browser. Without one, there is
    // nothing this process can do but stop.
    if (!process.env.PANEL_PASSWORD) {
      console.error(`Eksik ortam değişkeni: ${snapshot.missing.join(", ")}. Bakınız .env.example.`);
      return 2;
    }
    log("no channel is ready yet — open the panel and fill it in", { missing: snapshot.missing });
  }

  const password = process.env.PANEL_PASSWORD ?? "";
  let panel: Router | undefined;
  if (password.length >= 12) {
    const auth = new Auth({ password });
    panel = panelRouter({
      runtime,
      store,
      auth,
      fetcher: fetch,
      ...(process.env.PANEL_PUBLIC_URL ? { publicUrl: process.env.PANEL_PUBLIC_URL } : {}),
      log,
    });
  } else if (password) {
    console.error("PANEL_PASSWORD en az 12 karakter olmalı; panel açılmadı.");
  }

  const app = createApp({
    source: runtime,
    log,
    ...(panel ? { panel, panelPath: PANEL_PATH } : {}),
  });

  // Behind Fly's edge every request arrives from the same proxy address, which
  // would make the panel's per-address lockout global. Opt in only when a proxy
  // you trust is setting X-Forwarded-For, because that header is otherwise the
  // easiest thing in the world to forge.
  if (process.env.PANEL_TRUST_PROXY === "1") app.set("trust proxy", true);

  app.listen(config.port, config.host, () => {
    log(`listening on http://${config.host}:${config.port}`, {
      channels: runtime.paths(),
      rules: snapshot.rules.length,
      model: snapshot.modelOn ? config.model : "off (rules only)",
      dryRun: config.dryRun,
      panel: panel ? PANEL_PATH : "off",
    });
    for (const channel of snapshot.channels) {
      if (!channel.appSecret) {
        log(`${channel.name}: app secret boş — URL'yi bulan herkes botu çalıştırabilir`);
      }
    }
  });
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    if (code !== 0) process.exit(code);
  },
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
