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
 */

import { claudeReplier } from "./ai.js";
import { Bot } from "./bot.js";
import { instagramChannel } from "./channels/instagram.js";
import type { Channel, ChannelName } from "./channels/types.js";
import { whatsappChannel } from "./channels/whatsapp.js";
import { loadConfig, loadRules, missingForServe, type Config } from "./config.js";
import { runDoctor, webhookLines, worstStatus, type Status } from "./doctor.js";
import type { Rule } from "./rules.js";
import { createApp } from "./server.js";

const log = (message: string, detail?: unknown) => {
  const stamp = new Date().toISOString();
  if (detail === undefined) console.log(`${stamp} ${message}`);
  else console.log(`${stamp} ${message}`, detail);
};

function buildChannels(config: Config): Channel[] {
  const channels: Channel[] = [];

  if (config.instagram) {
    channels.push(
      instagramChannel({
        accessToken: config.instagram.accessToken,
        igUserId: config.instagram.igUserId,
        verifyToken: config.instagram.verifyToken,
        appSecret: config.instagram.appSecret,
        path: config.instagram.path,
        baseUrl: config.instagram.graphUrl,
      }),
    );
  }
  if (config.whatsapp) {
    channels.push(
      whatsappChannel({
        accessToken: config.whatsapp.accessToken,
        phoneNumberId: config.whatsapp.phoneNumberId,
        verifyToken: config.whatsapp.verifyToken,
        appSecret: config.whatsapp.appSecret,
        path: config.whatsapp.path,
        baseUrl: config.whatsapp.graphUrl,
        windowHours: config.whatsapp.windowHours,
      }),
    );
  }
  return channels;
}

const MARK: Record<Status, string> = { ok: "✓", warn: "!", fail: "✗" };

async function doctor(config: Config, argv: string[]): Promise<number> {
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

async function main(argv: string[]): Promise<number> {
  const config = loadConfig();

  if (argv.includes("--doctor")) return doctor(config, argv);

  const rules = loadRules(config.rulesFile);

  const replier =
    config.anthropicApiKey && config.persona
      ? claudeReplier({
          persona: config.persona,
          apiKey: config.anthropicApiKey,
          model: config.model,
          maxChars: config.maxChars,
        })
      : undefined;

  const tryIndex = argv.indexOf("--try");
  if (tryIndex !== -1) {
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

    const bot = new Bot({ rules, replier, maxChars: config.maxChars, dryRun: true });
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

  const missing = missingForServe(config);
  if (missing.length) {
    console.error(`Eksik ortam değişkeni: ${missing.join(", ")}. Bakınız .env.example.`);
    return 2;
  }

  const channels = buildChannels(config);
  const bot = new Bot({
    rules,
    replier,
    dryRun: config.dryRun,
    maxChars: config.maxChars,
    log,
  });

  const app = createApp({ bot, channels, log });

  app.listen(config.port, config.host, () => {
    log(`listening on http://${config.host}:${config.port}`, {
      channels: channels.map((channel) => channel.path),
      rules: rules.length,
      model: replier ? config.model : "off (rules only)",
      dryRun: config.dryRun,
    });
    for (const channel of channels) {
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
