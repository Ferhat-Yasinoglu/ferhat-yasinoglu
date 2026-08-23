import type { App } from "./app.js";
import type { Broadcast } from "./store/index.js";
import { TelegramError } from "./telegram.js";

/**
 * Broadcast delivery.
 *
 * Two things force this to be a background job rather than something a tool call
 * does inline:
 *
 * 1. Telegram caps bulk sending at roughly 30 messages per second. Twenty
 *    thousand subscribers is about eleven minutes of wall clock — far too long
 *    to hold an MCP call open.
 * 2. That cap has to actually be respected. Firing as fast as the event loop
 *    allows earns a 429, and repeatedly ignoring 429s earns a longer ban.
 *
 * So `broadcast` records the job and returns; this runner drains it at a fixed
 * pace, checkpointing its position after every send so a restart resumes rather
 * than starting the list over.
 */

/** Telegram's documented bulk ceiling is ~30/s; stay just under it. */
export const DEFAULT_SEND_INTERVAL_MS = 35;

/** Fallback pause when a 429 arrives without a `retry_after` value. */
const DEFAULT_RETRY_AFTER_MS = 1_000;

/** Give up on one recipient after this many rate-limited attempts. */
const MAX_RATE_LIMIT_RETRIES = 5;

export type BroadcastOptions = {
  /** Milliseconds between sends. Set to 0 in tests. */
  sendIntervalMs?: number;
  onError?: (error: unknown, context: string) => void;
};

export class BroadcastRunner {
  private readonly sendIntervalMs: number;
  private readonly onError: (error: unknown, context: string) => void;
  private readonly active = new Map<string, Promise<void>>();
  private stopped = false;

  constructor(
    private readonly app: App,
    options: BroadcastOptions = {},
  ) {
    this.sendIntervalMs = options.sendIntervalMs ?? DEFAULT_SEND_INTERVAL_MS;
    this.onError = options.onError ?? ((error, context) => console.error(`[broadcast] ${context}:`, error));
  }

  /** Pick up anything a previous process left unfinished. */
  resumeUnfinished(): void {
    for (const broadcast of this.app.store.unfinishedBroadcasts()) this.start(broadcast.id);
  }

  /** Begin (or resume) delivery. Returns immediately. */
  start(broadcastId: string): void {
    if (this.stopped || this.active.has(broadcastId)) return;
    const task = this.run(broadcastId).finally(() => this.active.delete(broadcastId));
    this.active.set(broadcastId, task);
  }

  /** Resolve once every in-flight broadcast has finished. Used by tests. */
  async whenIdle(): Promise<void> {
    while (this.active.size > 0) await Promise.allSettled([...this.active.values()]);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await this.whenIdle();
  }

  private async run(broadcastId: string): Promise<void> {
    const store = this.app.store;
    const broadcast = store.getBroadcast(broadcastId);
    if (!broadcast) return;

    store.updateBroadcast(broadcastId, {
      status: "sending",
      started_at: broadcast.started_at ?? new Date().toISOString(),
    });

    let sent = broadcast.sent;
    let failed = broadcast.failed;
    /** Consecutive rate-limited attempts on the recipient currently in hand. */
    let retries = 0;

    try {
      // Re-resolve the segment now rather than trusting a list captured at
      // queue time: people tagged since then should be included.
      const recipients = store
        .segment(broadcast.bot_id, JSON.parse(broadcast.tags) as string[])
        .filter((s) => !s.blocked);

      store.updateBroadcast(broadcastId, { recipients: recipients.length });

      const client = this.app.clientForBot(broadcast.bot_id);

      for (let i = broadcast.cursor; i < recipients.length; i += 1) {
        if (this.stopped) {
          // Leave it 'sending' with the cursor parked; resumeUnfinished picks
          // it up next boot.
          store.updateBroadcast(broadcastId, { cursor: i, sent, failed });
          return;
        }

        const subscriber = recipients[i]!;
        try {
          await client.sendMessage(subscriber.chat_id, broadcast.text);
          store.logMessage(broadcast.bot_id, subscriber.id, "out", broadcast.text);
          sent += 1;
          retries = 0;
        } catch (error) {
          if (error instanceof TelegramError && error.isRateLimited && retries < MAX_RATE_LIMIT_RETRIES) {
            // Rate limiting is temporary, so retry this same recipient rather
            // than dropping them. Telegram usually says how long to wait; when
            // it does not, back off by a default instead of treating the 429 as
            // permanent. The retry counter keeps a persistently limited chat
            // from looping forever.
            retries += 1;
            // Explicit undefined check: retry_after of 0 means "retry now", and
            // a truthiness test would turn that into a full default backoff.
            const waitMs = error.retryAfter !== undefined ? error.retryAfter * 1000 : DEFAULT_RETRY_AFTER_MS;
            await sleep(waitMs);
            i -= 1;
            continue;
          }
          if (error instanceof TelegramError && error.isBlocked) {
            store.setSubscriberBlocked(subscriber.id, true);
          }
          retries = 0;
          failed += 1;
        }

        // Checkpoint past the recipient just handled.
        store.updateBroadcast(broadcastId, { cursor: i + 1, sent, failed });
        if (this.sendIntervalMs > 0 && i + 1 < recipients.length) await sleep(this.sendIntervalMs);
      }

      store.updateBroadcast(broadcastId, {
        status: "finished",
        sent,
        failed,
        finished_at: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.updateBroadcast(broadcastId, {
        status: "failed",
        sent,
        failed,
        error: message,
        finished_at: new Date().toISOString(),
      });
      this.onError(error, `broadcast ${broadcastId}`);
    }
  }
}

/** Shape a stored broadcast into the tool's output. */
export function describeBroadcast(broadcast: Broadcast): Record<string, unknown> {
  return {
    broadcast_id: broadcast.id,
    status: broadcast.status,
    recipients: broadcast.recipients,
    sent: broadcast.sent,
    failed: broadcast.failed,
    ...(broadcast.started_at ? { started_at: broadcast.started_at } : {}),
    ...(broadcast.finished_at ? { finished_at: broadcast.finished_at } : {}),
    ...(broadcast.error ? { error: broadcast.error } : {}),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
