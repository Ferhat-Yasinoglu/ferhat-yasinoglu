/**
 * Everything the bot needs comes from the environment, and the parts that only
 * matter when posting for real are checked only then — so `--try` runs with an
 * empty environment and a rules file.
 */

import { readFileSync } from "node:fs";
import { parseRules, type Rule } from "./rules.js";

export type Config = {
  port: number;
  host: string;
  path: string;
  verifyToken: string;
  appSecret: string;
  accessToken: string;
  igUserId: string;
  graphUrl: string;
  rulesFile: string;
  persona: string;
  anthropicApiKey: string;
  model: string;
  maxChars: number;
  dryRun: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? "0.0.0.0",
    path: env.IG_WEBHOOK_PATH ?? "/webhook",
    verifyToken: env.IG_VERIFY_TOKEN ?? "",
    appSecret: env.IG_APP_SECRET ?? "",
    accessToken: env.IG_ACCESS_TOKEN ?? "",
    igUserId: env.IG_USER_ID ?? "",
    graphUrl: env.IG_GRAPH_URL ?? "https://graph.facebook.com/v21.0",
    rulesFile: env.IG_RULES_FILE ?? "rules.json",
    persona: env.IG_PERSONA ?? "",
    anthropicApiKey: env.ANTHROPIC_API_KEY ?? "",
    model: env.IG_MODEL ?? "claude-opus-5",
    maxChars: Number(env.IG_MAX_REPLY_CHARS ?? 280),
    dryRun: env.IG_DRY_RUN === "1",
  };
}

/** What must be set before the bot can serve a webhook. */
export function missingForServe(config: Config): string[] {
  const missing: string[] = [];
  if (!config.verifyToken) missing.push("IG_VERIFY_TOKEN");
  if (!config.dryRun && !config.accessToken) missing.push("IG_ACCESS_TOKEN");
  if (!config.dryRun && !config.igUserId) missing.push("IG_USER_ID");
  return missing;
}

export function loadRules(file: string): Rule[] {
  let source: string;
  try {
    source = readFileSync(file, "utf8");
  } catch (error) {
    // The first run always lands here: the example file is committed, the live
    // one is gitignored because it carries prices and links.
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
