#!/usr/bin/env node
/**
 * Two ways in:
 *
 *   instagram-comment-bot                  serve the webhook
 *   instagram-comment-bot --try "fiyat?"   answer one comment on the terminal
 *
 * `--try` posts nothing and needs no Instagram credentials, which makes it the
 * way to write rules: change the file, run it, see the reply.
 */

import { claudeReplier } from "./ai.js";
import { Bot } from "./bot.js";
import { loadConfig, loadRules, missingForServe } from "./config.js";
import { InstagramClient } from "./instagram.js";
import { createApp } from "./server.js";

const log = (message: string, detail?: unknown) => {
  const stamp = new Date().toISOString();
  if (detail === undefined) console.log(`${stamp} ${message}`);
  else console.log(`${stamp} ${message}`, detail);
};

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
    const text = argv.slice(tryIndex + 1).join(" ").trim();
    if (!text) {
      console.error('usage: instagram-comment-bot --try "the comment text"');
      return 2;
    }

    const bot = new Bot({ rules, replier, maxChars: config.maxChars, dryRun: true });
    const action = await bot.decide({
      commentId: "try",
      mediaId: "try",
      text,
      fromId: "try-user",
      username: "someone",
    });

    console.log(`\n  comment  ${text}`);
    console.log(`  action   ${action.kind} (${action.reason})`);
    if (action.kind === "reply") {
      if (action.text) console.log(`  reply    ${action.text}`);
      if (action.privateReply) console.log(`  dm       ${action.privateReply}`);
    }
    console.log();
    return 0;
  }

  const missing = missingForServe(config);
  if (missing.length) {
    console.error(`Missing environment: ${missing.join(", ")}. See .env.example.`);
    return 2;
  }

  const instagram = config.dryRun
    ? undefined
    : new InstagramClient({
        accessToken: config.accessToken,
        igUserId: config.igUserId,
        baseUrl: config.graphUrl,
      });

  const bot = new Bot({
    rules,
    replier,
    instagram,
    ownIds: [config.igUserId],
    dryRun: config.dryRun,
    maxChars: config.maxChars,
    log,
  });

  const app = createApp({
    bot,
    verifyToken: config.verifyToken,
    appSecret: config.appSecret,
    path: config.path,
    log,
  });

  app.listen(config.port, config.host, () => {
    log(`listening on http://${config.host}:${config.port}${config.path}`, {
      rules: rules.length,
      model: replier ? config.model : "off (rules only)",
      signatureCheck: Boolean(config.appSecret),
      dryRun: config.dryRun,
    });
    if (!config.appSecret) log("IG_APP_SECRET is unset — anyone who finds this URL can drive the bot");
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
