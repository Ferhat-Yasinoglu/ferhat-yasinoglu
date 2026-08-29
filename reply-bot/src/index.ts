#!/usr/bin/env node
/**
 * Two ways in:
 *
 *   reply-bot                                 serve every configured channel
 *   reply-bot --try "fiyat?"                  answer one message on the terminal
 *   reply-bot --try --whatsapp "merhaba"      …as the WhatsApp channel would
 *
 * `--try` sends nothing and needs no credentials, which makes it the way to
 * write rules: change the file, run it, see the reply.
 */

import { claudeReplier } from "./ai.js";
import { Bot } from "./bot.js";
import { instagramChannel } from "./channels/instagram.js";
import type { Channel, ChannelName } from "./channels/types.js";
import { whatsappChannel } from "./channels/whatsapp.js";
import { loadConfig, loadRules, missingForServe, type Config } from "./config.js";
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

async function main(argv: string[]): Promise<number> {
  const config = loadConfig();
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
