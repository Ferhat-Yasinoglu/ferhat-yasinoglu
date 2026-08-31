/**
 * The last few hundred decisions, kept in memory so the panel can show what the
 * bot has been doing.
 *
 * Deliberately not a database and deliberately not the log file. The log is for
 * `fly logs` and grows without bound; this is a fixed-size window meant to
 * answer one question — "what did it just say to people, and why" — which is
 * the question you actually have at 9am after a night of comments.
 *
 * It holds message text from strangers, so it is never persisted: a restart
 * empties it, and nothing here outlives the process.
 */

import type { Action } from "./bot.js";
import type { Incoming } from "./channels/types.js";
import type { ChannelName } from "./channels/types.js";

export type Entry = {
  /** Monotonic within a process; the panel uses it to fetch only what is new. */
  seq: number;
  at: string;
  channel: ChannelName;
  messageId: string;
  from: string;
  text: string;
  kind: Action["kind"];
  reason: string;
  reply?: string;
  privateReply?: string;
  sent: boolean;
  error?: string;
};

export type Recorded = {
  message: Incoming;
  action: Action;
  sent: boolean;
  error?: Error;
};

export class Journal {
  private readonly limit: number;
  private entries: Entry[] = [];
  private next = 1;

  constructor(limit = 300) {
    this.limit = Math.max(1, limit);
  }

  record(handled: Recorded): Entry {
    const { message, action } = handled;
    const entry: Entry = {
      seq: this.next++,
      at: new Date().toISOString(),
      channel: message.channel,
      messageId: message.id,
      from: message.username || message.authorId,
      text: message.text,
      kind: action.kind,
      reason: action.reason,
      ...(action.kind === "reply" && action.text ? { reply: action.text } : {}),
      ...(action.kind === "reply" && action.privateReply ? { privateReply: action.privateReply } : {}),
      sent: handled.sent,
      ...(handled.error ? { error: handled.error.message } : {}),
    };

    this.entries.push(entry);
    if (this.entries.length > this.limit) {
      this.entries = this.entries.slice(this.entries.length - this.limit);
    }
    return entry;
  }

  /** Newest first, optionally only what arrived after `since`. */
  list(options: { since?: number; limit?: number } = {}): Entry[] {
    const since = options.since ?? 0;
    const wanted = options.limit ?? this.limit;
    const fresh = since > 0 ? this.entries.filter((entry) => entry.seq > since) : this.entries;
    return fresh.slice(-wanted).reverse();
  }

  /** How the panel summarises the window without listing it. */
  summary(): { total: number; sent: number; skipped: number; failed: number } {
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const entry of this.entries) {
      if (entry.error) failed++;
      else if (entry.sent) sent++;
      else skipped++;
    }
    return { total: this.entries.length, sent, skipped, failed };
  }

  get size(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries = [];
  }
}
