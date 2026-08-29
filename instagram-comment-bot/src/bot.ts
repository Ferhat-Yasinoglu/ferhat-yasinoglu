/**
 * The decision and the act: what to do with one comment, then doing it.
 *
 * Deciding is deliberately pure — given a comment it returns an action and a
 * reason — so the interesting cases (own comment, spam, no rule and no model)
 * are testable without a Graph API, and so a dry run can print exactly what the
 * live bot would have posted.
 */

import type { Replier } from "./ai.js";
import type { CommentEvent } from "./events.js";
import { InstagramError, type InstagramClient } from "./instagram.js";
import { matchRule, type Rule } from "./rules.js";
import { clamp, normalize, pick, render } from "./text.js";

export type Action =
  | { kind: "skip"; reason: string }
  | { kind: "hide"; reason: string }
  | { kind: "reply"; text?: string; privateReply?: string; reason: string };

export type BotOptions = {
  rules: Rule[];
  /** Model fallback for comments no rule matches. Omit to answer rules only. */
  replier?: Replier;
  instagram?: InstagramClient;
  /** Instagram-scoped ids whose comments are never answered — your own, above all. */
  ownIds?: string[];
  /** Post nothing; decide and log only. */
  dryRun?: boolean;
  maxChars?: number;
  /** How many handled comment ids to remember, so a webhook retry is a no-op. */
  memory?: number;
  log?: (message: string, detail?: unknown) => void;
};

export type Handled = { event: CommentEvent; action: Action; posted: boolean; error?: Error };

export class Bot {
  private readonly rules: Rule[];
  private readonly replier?: Replier;
  private readonly instagram?: InstagramClient;
  private readonly ownIds: Set<string>;
  private readonly dryRun: boolean;
  private readonly maxChars: number;
  private readonly memory: number;
  private readonly log: (message: string, detail?: unknown) => void;
  /** Insertion-ordered, so pruning the oldest is just taking the first key. */
  private readonly seen = new Set<string>();

  constructor(options: BotOptions) {
    this.rules = options.rules;
    this.replier = options.replier;
    this.instagram = options.instagram;
    this.ownIds = new Set(options.ownIds?.filter(Boolean));
    this.dryRun = options.dryRun ?? false;
    this.maxChars = options.maxChars ?? 280;
    this.memory = options.memory ?? 5000;
    this.log = options.log ?? (() => {});
  }

  /** What the bot would do with this comment, and why. */
  async decide(event: CommentEvent): Promise<Action> {
    if (this.ownIds.has(event.fromId)) {
      return { kind: "skip", reason: "own comment" };
    }

    const vars = { username: event.username, text: event.text };
    const match = matchRule(this.rules, event.text);

    if (match) {
      const { rule, replies } = match;
      if (rule.hide) return { kind: "hide", reason: `rule:${rule.name}` };
      if (rule.ignore) return { kind: "skip", reason: `rule:${rule.name} (ignore)` };

      const text = replies.length ? clamp(render(pick(replies, event.commentId), vars), this.maxChars) : undefined;
      const privateReply = rule.privateReply ? clamp(render(rule.privateReply, vars), this.maxChars) : undefined;
      return { kind: "reply", ...(text ? { text } : {}), ...(privateReply ? { privateReply } : {}), reason: `rule:${rule.name}` };
    }

    if (!this.replier) return { kind: "skip", reason: "no rule matched" };

    // "❤️", "🔥🔥", "..." — nothing to answer, and a model call would only
    // invent something. Two letters is the cheapest test that catches them.
    if (normalize(event.text).replace(/[^\p{L}]/gu, "").length < 2) {
      return { kind: "skip", reason: "no words to answer" };
    }

    try {
      const text = await this.replier.generate({ text: event.text, username: event.username });
      if (!text) return { kind: "skip", reason: "model declined" };
      return { kind: "reply", text: clamp(text, this.maxChars), reason: "model" };
    } catch (error) {
      this.log("model call failed", error);
      return { kind: "skip", reason: "model error" };
    }
  }

  /** Decide and carry it out. Repeat deliveries of a comment are dropped. */
  async handle(event: CommentEvent): Promise<Handled> {
    if (this.seen.has(event.commentId)) {
      return { event, action: { kind: "skip", reason: "already handled" }, posted: false };
    }
    this.remember(event.commentId);

    const action = await this.decide(event);
    this.log(`comment ${event.commentId} → ${action.kind} (${action.reason})`, {
      from: event.username,
      text: event.text,
      ...(action.kind === "reply" ? { reply: action.text, dm: action.privateReply } : {}),
    });

    if (action.kind === "skip" || this.dryRun || !this.instagram) {
      return { event, action, posted: false };
    }

    try {
      if (action.kind === "hide") {
        await this.instagram.hideComment(event.commentId);
      } else {
        if (action.text) await this.instagram.replyToComment(event.commentId, action.text);
        if (action.privateReply) await this.instagram.sendPrivateReply(event.commentId, action.privateReply);
      }
      return { event, action, posted: true };
    } catch (error) {
      // A deleted comment is normal; anything else is worth seeing in the log.
      const failure = error as Error;
      if (failure instanceof InstagramError && failure.isGone) {
        this.log(`comment ${event.commentId} gone before the reply landed`);
      } else {
        this.log(`posting to comment ${event.commentId} failed`, failure);
      }
      return { event, action, posted: false, error: failure };
    }
  }

  private remember(commentId: string): void {
    this.seen.add(commentId);
    while (this.seen.size > this.memory) {
      const oldest = this.seen.values().next().value;
      if (oldest === undefined) break;
      this.seen.delete(oldest);
    }
  }
}
