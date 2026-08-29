/**
 * The decision and the act: what to do with one message, then doing it.
 *
 * Deciding is deliberately pure — given a message it returns an action and a
 * reason — so the interesting cases (own message, spam, no rule and no model,
 * an action the channel cannot perform) are testable without a Graph API, and
 * so a dry run can print exactly what the live bot would have sent.
 */

import type { Replier } from "./ai.js";
import type { Channel, Incoming } from "./channels/types.js";
import { MetaError } from "./meta.js";
import { matchRule, type Rule } from "./rules.js";
import { clamp, normalize, pick, render } from "./text.js";

export type Action =
  | { kind: "skip"; reason: string }
  | { kind: "hide"; reason: string }
  | { kind: "reply"; text?: string; privateReply?: string; reason: string };

export type BotOptions = {
  rules: Rule[];
  /** Model fallback for messages no rule matches. Omit to answer rules only. */
  replier?: Replier;
  /** Send nothing; decide and log only. */
  dryRun?: boolean;
  maxChars?: number;
  /** How many handled ids to remember, so a webhook retry is a no-op. */
  memory?: number;
  log?: (message: string, detail?: unknown) => void;
  /** Injectable clock, so window expiry is testable. */
  now?: () => Date;
};

export type Handled = { message: Incoming; action: Action; sent: boolean; error?: Error };

export class Bot {
  private readonly rules: Rule[];
  private readonly replier?: Replier;
  private readonly dryRun: boolean;
  private readonly maxChars: number;
  private readonly memory: number;
  private readonly log: (message: string, detail?: unknown) => void;
  private readonly now: () => Date;
  /** Insertion-ordered, so pruning the oldest is just taking the first key. */
  private readonly seen = new Set<string>();

  constructor(options: BotOptions) {
    this.rules = options.rules;
    this.replier = options.replier;
    this.dryRun = options.dryRun ?? false;
    this.maxChars = options.maxChars ?? 280;
    this.memory = options.memory ?? 5000;
    this.log = options.log ?? (() => {});
    this.now = options.now ?? (() => new Date());
  }

  /** What the bot would do with this message on this channel, and why. */
  async decide(message: Incoming, channel: Channel): Promise<Action> {
    if (channel.ownIds.includes(message.authorId)) {
      return { kind: "skip", reason: "own message" };
    }

    // WhatsApp's 24-hour window: outside it nothing but a template would be
    // delivered, so silence beats a send that bounces.
    const refusal = channel.refuse?.(message, this.now());
    if (refusal) return { kind: "skip", reason: refusal };

    const vars = { username: message.username, text: message.text };
    const match = matchRule(this.rules, message.text, channel.name);

    if (match) {
      const { rule, replies } = match;

      if (rule.hide) {
        return channel.can.hide
          ? { kind: "hide", reason: `rule:${rule.name}` }
          : { kind: "skip", reason: `rule:${rule.name} (${channel.name} gizleyemez)` };
      }
      if (rule.ignore) return { kind: "skip", reason: `rule:${rule.name} (ignore)` };

      const text = replies.length ? clamp(render(pick(replies, message.id), vars), this.maxChars) : undefined;
      const privateReply =
        rule.privateReply && channel.can.privateReply
          ? clamp(render(rule.privateReply, vars), this.maxChars)
          : undefined;

      return {
        kind: "reply",
        ...(text ? { text } : {}),
        ...(privateReply ? { privateReply } : {}),
        reason: `rule:${rule.name}`,
      };
    }

    if (!this.replier) return { kind: "skip", reason: "no rule matched" };

    // "❤️", "🔥🔥", "..." — nothing to answer, and a model call would only
    // invent something. Two letters is the cheapest test that catches them.
    if (normalize(message.text).replace(/[^\p{L}]/gu, "").length < 2) {
      return { kind: "skip", reason: "no words to answer" };
    }

    try {
      const text = await this.replier.generate({
        text: message.text,
        username: message.username,
        channel: message.channel,
      });
      if (!text) return { kind: "skip", reason: "model declined" };
      return { kind: "reply", text: clamp(text, this.maxChars), reason: "model" };
    } catch (error) {
      this.log("model call failed", error);
      return { kind: "skip", reason: "model error" };
    }
  }

  /** Decide and carry it out. Repeat deliveries of a message are dropped. */
  async handle(message: Incoming, channel: Channel): Promise<Handled> {
    const key = `${message.channel}:${message.id}`;
    if (this.seen.has(key)) {
      return { message, action: { kind: "skip", reason: "already handled" }, sent: false };
    }
    this.remember(key);

    const action = await this.decide(message, channel);
    this.log(`${message.channel} ${message.id} → ${action.kind} (${action.reason})`, {
      from: message.username || message.authorId,
      text: message.text,
      ...(action.kind === "reply" ? { reply: action.text, dm: action.privateReply } : {}),
    });

    if (action.kind === "skip" || this.dryRun) {
      return { message, action, sent: false };
    }

    try {
      if (action.kind === "hide") {
        await channel.hide?.(message);
      } else {
        if (action.text) await channel.send(message, action.text);
        if (action.privateReply) await channel.sendPrivate?.(message, action.privateReply);
      }
      return { message, action, sent: true };
    } catch (error) {
      // A deleted comment is normal; anything else is worth seeing in the log.
      const failure = error as Error;
      if (failure instanceof MetaError && failure.isGone) {
        this.log(`${message.channel} ${message.id} gone before the reply landed`);
      } else {
        this.log(`sending to ${message.channel} ${message.id} failed`, failure);
      }
      return { message, action, sent: false, error: failure };
    }
  }

  private remember(key: string): void {
    this.seen.add(key);
    while (this.seen.size > this.memory) {
      const oldest = this.seen.values().next().value;
      if (oldest === undefined) break;
      this.seen.delete(oldest);
    }
  }
}
