import type { App } from "./app.js";
import { TelegramError } from "./telegram.js";

/**
 * The background half of the server.
 *
 * MCP tools are request/response, but a chatbot has to react to people writing
 * in at any time. This loop long-polls Telegram for each connected bot, hands
 * updates to the dispatcher, and wakes runs parked on a `delay` step.
 *
 * Long-polling rather than webhooks on purpose: it needs no public URL and no
 * TLS certificate, so a bot works the moment a token is added.
 */

export type WorkerOptions = {
  /** Seconds Telegram holds a getUpdates call open. */
  pollTimeout?: number;
  /** How often to check for delay-parked runs that are due. */
  tickMs?: number;
  onError?: (error: unknown, context: string) => void;
};

export class Worker {
  private running = false;
  private readonly pollTimeout: number;
  private readonly tickMs: number;
  private readonly onError: (error: unknown, context: string) => void;
  private readonly loops = new Map<string, Promise<void>>();
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly app: App,
    options: WorkerOptions = {},
  ) {
    this.pollTimeout = options.pollTimeout ?? 25;
    this.tickMs = options.tickMs ?? 5_000;
    this.onError = options.onError ?? ((error, context) => console.error(`[worker] ${context}:`, error));
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    // Re-scan for bots each tick so a bot connected mid-session starts polling
    // without a restart.
    this.timer = setInterval(() => {
      this.syncLoops();
      void this.wakeDueRuns();
    }, this.tickMs);
    // Do not hold the process open on this timer alone.
    this.timer.unref?.();

    this.syncLoops();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    await Promise.allSettled([...this.loops.values()]);
    this.loops.clear();
  }

  /** One poll-and-dispatch cycle for a bot. Exposed for tests. */
  async pollOnce(botId: string): Promise<number> {
    const client = this.app.clientForBot(botId);
    const offset = this.app.store.getOffset(botId);
    const updates = await client.getUpdates(offset, 0);

    for (const update of updates) {
      try {
        await this.app.dispatcher.handle(botId, update);
      } catch (error) {
        // One bad update must not stall the cursor behind it forever.
        this.onError(error, `dispatching update ${update.update_id} for ${botId}`);
      }
      this.app.store.setOffset(botId, update.update_id + 1);
    }
    return updates.length;
  }

  /** Advance any run whose delay has elapsed. Exposed for tests. */
  async wakeDueRuns(): Promise<number> {
    const due = this.app.store.dueRuns();
    let advanced = 0;

    for (const run of due) {
      try {
        // Clear the parking marker first so a slow advance is not picked up twice.
        run.waiting_for = null;
        run.resume_at = null;
        this.app.store.saveRun(run);

        await this.app.runner.advance(run);
        advanced += 1;
      } catch (error) {
        this.onError(error, `waking run ${run.id}`);
      }
    }
    return advanced;
  }

  private syncLoops(): void {
    if (!this.running) return;
    for (const bot of this.app.store.listBots()) {
      if (!this.loops.has(bot.id)) this.loops.set(bot.id, this.loopFor(bot.id));
    }
  }

  private async loopFor(botId: string): Promise<void> {
    let backoff = 1_000;

    while (this.running) {
      if (!this.app.store.getBot(botId)) break; // disconnected

      try {
        const client = this.app.clientForBot(botId);
        const offset = this.app.store.getOffset(botId);
        const updates = await client.getUpdates(offset, this.pollTimeout);
        backoff = 1_000;

        for (const update of updates) {
          try {
            await this.app.dispatcher.handle(botId, update);
          } catch (error) {
            this.onError(error, `dispatching update ${update.update_id} for ${botId}`);
          }
          this.app.store.setOffset(botId, update.update_id + 1);
        }
      } catch (error) {
        if (error instanceof TelegramError && error.isRateLimited && error.retryAfter) {
          await sleep(error.retryAfter * 1000);
          continue;
        }
        this.onError(error, `polling ${botId}`);
        await sleep(backoff);
        // Back off to a minute so a revoked token does not spin the CPU.
        backoff = Math.min(backoff * 2, 60_000);
      }
    }

    this.loops.delete(botId);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
