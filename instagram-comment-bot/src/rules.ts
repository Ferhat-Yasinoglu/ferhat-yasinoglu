/**
 * Keyword rules: the fast, predictable half of the bot.
 *
 * Most comments under a business post are the same five questions — price,
 * shipping, sizes, "is it in stock", plus praise and spam. Answering those from
 * a file keeps them instant, free and exactly on-message; only what no rule
 * matches is worth spending a model call on.
 */

import { contains, normalize } from "./text.js";

export type Rule = {
  name: string;
  /** Any of these substrings in the comment matches the rule (accent/case folded). */
  keywords?: string[];
  /** A regular expression matched against the normalized comment. */
  pattern?: string;
  /** Public reply under the comment. Several variants rotate per commenter. */
  reply?: string | string[];
  /** Sent as a DM instead of, or alongside, the public reply. */
  privateReply?: string;
  /** Hide the comment (spam, abuse) rather than answer it. */
  hide?: boolean;
  /** Match but stay silent — useful to stop the model answering something. */
  ignore?: boolean;
};

export type RuleMatch = {
  rule: Rule;
  replies: string[];
};

export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}

/** Validate rules loaded from JSON, so a typo fails at startup, not at 3am. */
export function parseRules(input: unknown): Rule[] {
  if (!Array.isArray(input)) throw new RuleError("rules must be a JSON array");

  return input.map((raw, index) => {
    const rule = raw as Rule;
    const where = `rule #${index + 1}`;
    if (!rule || typeof rule !== "object") throw new RuleError(`${where} is not an object`);
    if (!rule.name) throw new RuleError(`${where} has no name`);

    const hasMatcher =
      (Array.isArray(rule.keywords) && rule.keywords.length > 0) || typeof rule.pattern === "string";
    if (!hasMatcher) throw new RuleError(`${rule.name}: needs keywords or a pattern`);

    if (rule.pattern) {
      try {
        new RegExp(rule.pattern, "i");
      } catch (error) {
        throw new RuleError(`${rule.name}: invalid pattern — ${(error as Error).message}`);
      }
    }

    const acts = rule.reply || rule.privateReply || rule.hide || rule.ignore;
    if (!acts) throw new RuleError(`${rule.name}: needs reply, privateReply, hide or ignore`);
    return rule;
  });
}

/** The first rule that matches, in file order — put narrow rules first. */
export function matchRule(rules: readonly Rule[], text: string): RuleMatch | undefined {
  const normalized = normalize(text);

  for (const rule of rules) {
    const byKeyword = rule.keywords?.some((keyword) => contains(text, keyword)) ?? false;
    const byPattern = rule.pattern ? new RegExp(rule.pattern, "i").test(normalized) : false;
    if (!byKeyword && !byPattern) continue;

    const replies = rule.reply === undefined ? [] : Array.isArray(rule.reply) ? rule.reply : [rule.reply];
    return { rule, replies };
  }
  return undefined;
}
