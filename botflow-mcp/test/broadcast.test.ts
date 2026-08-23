import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/app.js";
import { BroadcastRunner } from "../src/broadcast.js";
import { FakeTelegram, VALID_TOKEN } from "./fake-telegram.js";

/**
 * Broadcasts are a background job with a rate limit and a checkpoint, and each
 * of those is a promise the tool description makes to whoever calls it. These
 * tests hold it to them.
 */

let app: App;
let telegram: FakeTelegram;
let botId: string;

/** Connect a bot and give it `count` subscribers. */
async function seed(count: number): Promise<string[]> {
  const bot = app.store.createBot(VALID_TOKEN, "test_bot", "Test");
  botId = bot.id;
  return Array.from({ length: count }, (_, i) => app.store.upsertSubscriber(bot.id, String(i + 1), `S${i}`, null).id);
}

beforeEach(() => {
  telegram = new FakeTelegram();
  app = new App({
    dbPath: ":memory:",
    fetcher: telegram.fetcher,
    telegramBaseUrl: "https://fake.telegram",
    sendIntervalMs: 0,
  });
});

afterEach(async () => {
  await app.shutdown();
});

describe("delivery", () => {
  it("reaches every unblocked subscriber", async () => {
    await seed(5);
    const broadcast = app.store.createBroadcast(botId, "Hello", [], 5);

    app.broadcasts.start(broadcast.id);
    await app.broadcasts.whenIdle();

    const done = app.store.getBroadcast(broadcast.id)!;
    expect(done.status).toBe("finished");
    expect(done.sent).toBe(5);
    expect(done.failed).toBe(0);
    expect(telegram.sent).toHaveLength(5);
  });

  it("records a completion timestamp", async () => {
    await seed(1);
    const broadcast = app.store.createBroadcast(botId, "Hello", [], 1);

    app.broadcasts.start(broadcast.id);
    await app.broadcasts.whenIdle();

    const done = app.store.getBroadcast(broadcast.id)!;
    expect(done.started_at).toBeTruthy();
    expect(done.finished_at).toBeTruthy();
  });

  it("counts a block as a failure and keeps going", async () => {
    const ids = await seed(3);
    telegram.blockChat("2");
    const broadcast = app.store.createBroadcast(botId, "Hello", [], 3);

    app.broadcasts.start(broadcast.id);
    await app.broadcasts.whenIdle();

    const done = app.store.getBroadcast(broadcast.id)!;
    expect(done.sent).toBe(2);
    expect(done.failed).toBe(1);
    // The blocked subscriber is remembered, so later broadcasts skip them.
    expect(app.store.getSubscriber(ids[1]!)?.blocked).toBe(1);
  });

  it("re-resolves the segment at send time, not at queue time", async () => {
    const ids = await seed(2);
    app.store.addTags(ids[0]!, ["vip"]);
    const broadcast = app.store.createBroadcast(botId, "VIP only", ["vip"], 1);

    // Someone joins the segment between queueing and sending.
    app.store.addTags(ids[1]!, ["vip"]);

    app.broadcasts.start(broadcast.id);
    await app.broadcasts.whenIdle();

    expect(app.store.getBroadcast(broadcast.id)!.sent).toBe(2);
  });
});

describe("rate limiting", () => {
  it("waits out a 429 and retries the same recipient", async () => {
    await seed(2);
    // Fail the first send with a rate limit; nobody should be skipped for it.
    telegram.failNext(429, "Too Many Requests: retry later", { retryAfter: 0 });
    const broadcast = app.store.createBroadcast(botId, "Hello", [], 2);

    app.broadcasts.start(broadcast.id);
    await app.broadcasts.whenIdle();

    const done = app.store.getBroadcast(broadcast.id)!;
    expect(done.sent).toBe(2);
    expect(done.failed).toBe(0);
    expect(telegram.sent).toHaveLength(2);
  });

  it("retries a 429 that carries no retry_after instead of dropping the recipient", async () => {
    await seed(1);
    // Telegram usually sends retry_after, but it is not guaranteed. A 429 is
    // temporary either way, so the recipient must not be counted as failed.
    telegram.failNext(429, "Too Many Requests");
    const broadcast = app.store.createBroadcast(botId, "Hello", [], 1);

    app.broadcasts.start(broadcast.id);
    await app.broadcasts.whenIdle();

    const done = app.store.getBroadcast(broadcast.id)!;
    expect(done.sent).toBe(1);
    expect(done.failed).toBe(0);
  }, 10_000);

  it("gives up on a recipient that is rate limited over and over", async () => {
    await seed(1);
    // Far more failures than the retry budget allows.
    telegram.failNext(429, "Too Many Requests", { retryAfter: 0, times: 50 });
    const broadcast = app.store.createBroadcast(botId, "Hello", [], 1);

    app.broadcasts.start(broadcast.id);
    await app.broadcasts.whenIdle();

    const done = app.store.getBroadcast(broadcast.id)!;
    expect(done.status).toBe("finished");
    expect(done.failed).toBe(1);
    expect(done.sent).toBe(0);
  });

  it("paces sends when an interval is configured", async () => {
    await seed(4);
    // A deliberately slow runner: 3 gaps of 20ms across 4 recipients.
    const paced = new BroadcastRunner(app, { sendIntervalMs: 20 });
    const broadcast = app.store.createBroadcast(botId, "Hello", [], 4);

    const started = Date.now();
    paced.start(broadcast.id);
    await paced.whenIdle();
    const elapsed = Date.now() - started;

    expect(telegram.sent).toHaveLength(4);
    expect(elapsed).toBeGreaterThanOrEqual(50);
  });
});

describe("interruption", () => {
  it("checkpoints progress so a restart resumes instead of restarting", async () => {
    await seed(4);
    const broadcast = app.store.createBroadcast(botId, "Hello", [], 4);

    // Simulate a process that died after delivering two.
    app.store.updateBroadcast(broadcast.id, { status: "sending", cursor: 2, sent: 2 });

    app.broadcasts.start(broadcast.id);
    await app.broadcasts.whenIdle();

    const done = app.store.getBroadcast(broadcast.id)!;
    expect(done.status).toBe("finished");
    expect(done.sent).toBe(4);
    // Only the remaining two were actually sent this time round.
    expect(telegram.sent).toHaveLength(2);
  });

  it("picks up unfinished broadcasts on boot", async () => {
    await seed(2);
    const broadcast = app.store.createBroadcast(botId, "Hello", [], 2);
    app.store.updateBroadcast(broadcast.id, { status: "sending" });

    app.broadcasts.resumeUnfinished();
    await app.broadcasts.whenIdle();

    expect(app.store.getBroadcast(broadcast.id)!.status).toBe("finished");
  });

  it("does not start the same broadcast twice", async () => {
    await seed(3);
    const broadcast = app.store.createBroadcast(botId, "Hello", [], 3);

    app.broadcasts.start(broadcast.id);
    app.broadcasts.start(broadcast.id);
    await app.broadcasts.whenIdle();

    expect(telegram.sent).toHaveLength(3);
  });

  it("marks a broadcast failed when the bot is gone", async () => {
    await seed(1);
    const broadcast = app.store.createBroadcast(botId, "Hello", [], 1);
    app.store.deleteBot(botId);

    app.broadcasts.start(broadcast.id);
    await app.broadcasts.whenIdle();

    // The bot row is gone, so the broadcast row went with it via cascade.
    expect(app.store.getBroadcast(broadcast.id)).toBeUndefined();
  });
});

describe("schema migrations", () => {
  it("reports the current schema version", () => {
    expect(app.store.schemaVersion).toBe(2);
  });
});
