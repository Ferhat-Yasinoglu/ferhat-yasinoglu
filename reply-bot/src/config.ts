/**
 * Everything comes from the environment. Shared settings carry a `BOT_` prefix;
 * each channel keeps its own credentials under `IG_` or `WA_` and is switched
 * on simply by having them — a bot with only WhatsApp credentials serves only
 * WhatsApp.
 *
 * The parts that matter only when sending are checked only then, so `--try`
 * runs with an empty environment and a rules file.
 */

import { readFileSync } from "node:fs";
import { parseRules, type Rule } from "./rules.js";

export type ChannelConfig = {
  accessToken: string;
  verifyToken: string;
  appSecret: string;
  path: string;
  graphUrl: string;
};

export type InstagramConfig = ChannelConfig & { igUserId: string };
export type WhatsAppConfig = ChannelConfig & { phoneNumberId: string; windowHours: number };

export type Config = {
  port: number;
  host: string;
  rulesFile: string;
  persona: string;
  anthropicApiKey: string;
  model: string;
  maxChars: number;
  dryRun: boolean;
  instagram?: InstagramConfig;
  whatsapp?: WhatsAppConfig;
};

const GRAPH = "https://graph.facebook.com/v21.0";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const shared = {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? "0.0.0.0",
    rulesFile: env.BOT_RULES_FILE ?? "rules.json",
    persona: env.BOT_PERSONA ?? "",
    anthropicApiKey: env.ANTHROPIC_API_KEY ?? "",
    model: env.BOT_MODEL ?? "claude-opus-5",
    maxChars: Number(env.BOT_MAX_REPLY_CHARS ?? 280),
    dryRun: env.BOT_DRY_RUN === "1",
  };

  // A channel is configured when it has anything of its own; what is missing
  // is reported by `missingForServe` rather than silently defaulted.
  const wantsInstagram = Boolean(env.IG_ACCESS_TOKEN || env.IG_USER_ID || env.IG_VERIFY_TOKEN);
  const wantsWhatsApp = Boolean(env.WA_ACCESS_TOKEN || env.WA_PHONE_NUMBER_ID || env.WA_VERIFY_TOKEN);

  return {
    ...shared,
    ...(wantsInstagram
      ? {
          instagram: {
            accessToken: env.IG_ACCESS_TOKEN ?? "",
            igUserId: env.IG_USER_ID ?? "",
            verifyToken: env.IG_VERIFY_TOKEN ?? "",
            appSecret: env.IG_APP_SECRET ?? "",
            path: env.IG_WEBHOOK_PATH ?? "/webhook/instagram",
            graphUrl: env.IG_GRAPH_URL ?? GRAPH,
          },
        }
      : {}),
    ...(wantsWhatsApp
      ? {
          whatsapp: {
            accessToken: env.WA_ACCESS_TOKEN ?? "",
            phoneNumberId: env.WA_PHONE_NUMBER_ID ?? "",
            verifyToken: env.WA_VERIFY_TOKEN ?? "",
            appSecret: env.WA_APP_SECRET ?? "",
            path: env.WA_WEBHOOK_PATH ?? "/webhook/whatsapp",
            graphUrl: env.WA_GRAPH_URL ?? GRAPH,
            windowHours: Number(env.WA_WINDOW_HOURS ?? 24),
          },
        }
      : {}),
  };
}

/** What must be set before the bot can serve. */
export function missingForServe(config: Config): string[] {
  const missing: string[] = [];
  if (!config.instagram && !config.whatsapp) {
    missing.push("IG_* ya da WA_* değişkenlerinden en az bir kanal");
    return missing;
  }

  if (config.instagram) {
    if (!config.instagram.verifyToken) missing.push("IG_VERIFY_TOKEN");
    if (!config.dryRun && !config.instagram.accessToken) missing.push("IG_ACCESS_TOKEN");
    if (!config.dryRun && !config.instagram.igUserId) missing.push("IG_USER_ID");
  }
  if (config.whatsapp) {
    if (!config.whatsapp.verifyToken) missing.push("WA_VERIFY_TOKEN");
    if (!config.dryRun && !config.whatsapp.accessToken) missing.push("WA_ACCESS_TOKEN");
    if (!config.dryRun && !config.whatsapp.phoneNumberId) missing.push("WA_PHONE_NUMBER_ID");
  }
  return missing;
}

export function loadRules(file: string): Rule[] {
  let source: string;
  try {
    source = readFileSync(file, "utf8");
  } catch (error) {
    // The first run always lands here: the example file is committed, the live
    // one is gitignored because it carries the replies you keep editing.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Rules file not found: ${file}. Start from the example: cp rules.example.json ${file}`);
    }
    throw error;
  }

  try {
    return parseRules(JSON.parse(source));
  } catch (error) {
    throw new Error(`${file}: ${(error as Error).message}`);
  }
}
