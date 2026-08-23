import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/app.js";
import { handlers } from "../src/handlers/index.js";
import { registerTools } from "../src/handlers/tools.js";
import { createServer } from "../src/server.js";
import { loadSpec } from "../src/spec.js";
import { Worker } from "../src/worker.js";
import { FakeTelegram, VALID_TOKEN } from "./fake-telegram.js";

/**
 * The whole product, driven the way a model would drive it: through MCP tool
 * calls, against a fake Telegram, with real SQLite underneath.
 *
 * Nothing here is stubbed except the Telegram API itself.
 */

let app: App;
let telegram: FakeTelegram;
let client: Client;

async function connectClient(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({ spec: loadSpec(), apiKey: null });
  const c = new Client({ name: "e2e", version: "1" });
  await Promise.all([server.connect(serverTransport), c.connect(clientTransport)]);
  return c;
}

/** Call a tool and return its structuredContent, failing loudly on tool errors. */
async function call<T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) {
    const text = (result.content as { text?: string }[])?.map((c) => c.text).join("\n");
    throw new Error(`${name} failed: ${text}`);
  }
  return result.structuredContent as T;
}

beforeEach(async () => {
  handlers.clear();
  telegram = new FakeTelegram();
  app = new App({ dbPath: ":memory:", fetcher: telegram.fetcher, telegramBaseUrl: "https://fake.telegram" });
  registerTools(app);
  client = await connectClient();
});

afterEach(async () => {
  await client.close();
  app.close();
  handlers.clear();
});

describe("connecting a bot", () => {
  it("verifies the token against Telegram and stores the bot", async () => {
    const out = await call<{ bot_id: string; username: string }>("connect_bot", { token: VALID_TOKEN });

    expect(out.username).toBe("test_bot");
    expect(out.bot_id).toMatch(/^bot_/);

    const { bots } = await call<{ bots: unknown[] }>("list_bots");
    expect(bots).toHaveLength(1);
  });

  it("rejects a malformed token without calling Telegram", async () => {
    await expect(call("connect_bot", { token: "not-a-token" })).rejects.toThrow(/does not look like/i);
    expect(telegram.sent).toHaveLength(0);
  });

  it("refuses to connect the same bot twice", async () => {
    await call("connect_bot", { token: VALID_TOKEN });
    await expect(call("connect_bot", { token: VALID_TOKEN })).rejects.toThrow(/already connected/i);
  });

  it("surfaces a revoked token as a tool error", async () => {
    telegram.failNext(401, "Unauthorized");
    await expect(call("connect_bot", { token: VALID_TOKEN })).rejects.toThrow(/Unauthorized/);
  });
});

describe("a complete funnel", () => {
  /**
   * The scenario a user actually cares about: someone sends /start, the bot
   * greets them, asks a question, remembers the answer, branches on a button,
   * tags them, and the tag then drives a broadcast.
   */
  it("runs a subscriber from /start through to a segmented broadcast", async () => {
    const { bot_id } = await call<{ bot_id: string }>("connect_bot", { token: VALID_TOKEN });

    const { flow_id } = await call<{ flow_id: string }>("create_flow", {
      bot_id,
      name: "Welcome",
      steps: [
        { type: "message", text: "Hey! Welcome aboard." },
        { type: "question", text: "What should I call you?", save_as: "name" },
        { type: "message", text: "Nice to meet you, {{name}}." },
        {
          type: "buttons",
          text: "What brings you here, {{name}}?",
          save_as: "goal",
          choices: [
            { label: "Learning", goto: 5 },
            { label: "Business", goto: 8 },
          ],
        },
        { type: "end" },
        { type: "tag", add_tags: ["learner"] },
        { type: "message", text: "Great — I'll send you tutorials." },
        { type: "end" },
        { type: "tag", add_tags: ["business"] },
        { type: "message", text: "Perfect — I'll send you case studies." },
      ],
    });

    await call("publish_flow", { flow_id });
    await call("set_trigger", { flow_id, event: "start" });

    // A person opens the bot.
    const worker = new Worker(app, { tickMs: 60_000 });
    telegram.receiveText("555", "/start", { first_name: "Ayse" });
    await worker.pollOnce(bot_id);

    expect(telegram.sentTo("555")).toEqual(["Hey! Welcome aboard.", "What should I call you?"]);

    // They answer the question.
    telegram.receiveText("555", "Ayse");
    await worker.pollOnce(bot_id);

    const afterName = telegram.sentTo("555");
    expect(afterName[2]).toBe("Nice to meet you, Ayse.");
    expect(afterName[3]).toBe("What brings you here, Ayse?");

    // They tap the second button.
    telegram.pressButton("555", telegram.lastInlineButtonData(1));
    await worker.pollOnce(bot_id);

    expect(telegram.sentTo("555")).toContain("Perfect — I'll send you case studies.");

    // The branch tagged them, and the tag drives a segment.
    const { subscribers } = await call<{ subscribers: { subscriber_id: string; tags: string[] }[] }>(
      "list_subscribers",
      { bot_id },
    );
    expect(subscribers[0]?.tags).toEqual(["business"]);

    const dry = await call<{ recipients: number; sent: number }>("broadcast", {
      bot_id,
      text: "Case study drop",
      tags: ["business"],
      dry_run: true,
    });
    expect(dry).toMatchObject({ recipients: 1, sent: 0 });

    const real = await call<{ sent: number; failed: number }>("broadcast", {
      bot_id,
      text: "Case study drop",
      tags: ["business"],
    });
    expect(real).toMatchObject({ sent: 1, failed: 0 });
    expect(telegram.sentTo("555")).toContain("Case study drop");

    // And the run is recorded as completed.
    const stats = await call<{ runs_started: number; runs_completed: number; messages_in: number }>("get_analytics", {
      bot_id,
    });
    expect(stats.runs_started).toBe(1);
    expect(stats.runs_completed).toBe(1);
    expect(stats.messages_in).toBe(3); // /start, the name, the button label
  });

  it("does not let a keyword hijack a question the bot just asked", async () => {
    const { bot_id } = await call<{ bot_id: string }>("connect_bot", { token: VALID_TOKEN });

    const asking = await call<{ flow_id: string }>("create_flow", {
      bot_id,
      name: "Asking",
      steps: [{ type: "question", text: "Your city?", save_as: "city" }, { type: "message", text: "Got it: {{city}}" }],
    });
    const promo = await call<{ flow_id: string }>("create_flow", {
      bot_id,
      name: "Promo",
      steps: [{ type: "message", text: "PROMO!" }],
    });

    await call("publish_flow", { flow_id: asking.flow_id });
    await call("publish_flow", { flow_id: promo.flow_id });
    await call("set_trigger", { flow_id: asking.flow_id, event: "start" });
    await call("set_trigger", { flow_id: promo.flow_id, event: "keyword", keywords: ["istanbul"] });

    const worker = new Worker(app, { tickMs: 60_000 });
    telegram.receiveText("777", "/start");
    await worker.pollOnce(bot_id);

    // The answer happens to contain the promo keyword.
    telegram.receiveText("777", "Istanbul");
    await worker.pollOnce(bot_id);

    expect(telegram.sentTo("777")).toEqual(["Your city?", "Got it: Istanbul"]);
    expect(telegram.sentTo("777")).not.toContain("PROMO!");
  });

  it("fires a keyword trigger when no conversation is in progress", async () => {
    const { bot_id } = await call<{ bot_id: string }>("connect_bot", { token: VALID_TOKEN });
    const { flow_id } = await call<{ flow_id: string }>("create_flow", {
      bot_id,
      name: "Promo",
      steps: [{ type: "message", text: "PROMO!" }],
    });
    await call("publish_flow", { flow_id });
    await call("set_trigger", { flow_id, event: "keyword", keywords: ["indirim"] });

    const worker = new Worker(app, { tickMs: 60_000 });
    telegram.receiveText("888", "bugün İNDİRİM var mı?");
    await worker.pollOnce(bot_id);

    expect(telegram.sentTo("888")).toEqual(["PROMO!"]);
  });
});

describe("delays", () => {
  it("parks a run on a delay and resumes it when due", async () => {
    const { bot_id } = await call<{ bot_id: string }>("connect_bot", { token: VALID_TOKEN });
    const { flow_id } = await call<{ flow_id: string }>("create_flow", {
      bot_id,
      name: "Drip",
      steps: [
        { type: "message", text: "First" },
        { type: "delay", seconds: 3600 },
        { type: "message", text: "Second" },
      ],
    });
    await call("publish_flow", { flow_id });
    await call("set_trigger", { flow_id, event: "start" });

    const worker = new Worker(app, { tickMs: 60_000 });
    telegram.receiveText("999", "/start");
    await worker.pollOnce(bot_id);

    expect(telegram.sentTo("999")).toEqual(["First"]);

    // Not due yet.
    expect(await worker.wakeDueRuns()).toBe(0);
    expect(telegram.sentTo("999")).toEqual(["First"]);

    // Move the run's timer into the past, the way an hour passing would.
    const run = app.store.dueRuns(new Date(Date.now() + 7200_000).toISOString())[0];
    expect(run, "the run should be parked on a delay").toBeDefined();
    app.store.saveRun({ ...run!, resume_at: new Date(Date.now() - 1000).toISOString() });

    expect(await worker.wakeDueRuns()).toBe(1);
    expect(telegram.sentTo("999")).toEqual(["First", "Second"]);
  });

  it("treats a zero-second delay as no delay at all", async () => {
    const { bot_id } = await call<{ bot_id: string }>("connect_bot", { token: VALID_TOKEN });
    const { flow_id } = await call<{ flow_id: string }>("create_flow", {
      bot_id,
      name: "NoWait",
      steps: [{ type: "message", text: "A" }, { type: "delay", seconds: 0 }, { type: "message", text: "B" }],
    });
    await call("publish_flow", { flow_id });
    await call("set_trigger", { flow_id, event: "start" });

    const worker = new Worker(app, { tickMs: 60_000 });
    telegram.receiveText("111", "/start");
    await worker.pollOnce(bot_id);

    expect(telegram.sentTo("111")).toEqual(["A", "B"]);
  });
});

describe("blocked subscribers", () => {
  it("records a block and keeps a broadcast going", async () => {
    const { bot_id } = await call<{ bot_id: string }>("connect_bot", { token: VALID_TOKEN });

    // Two subscribers arrive.
    const { flow_id } = await call<{ flow_id: string }>("create_flow", {
      bot_id,
      name: "Hi",
      steps: [{ type: "message", text: "hi" }],
    });
    await call("publish_flow", { flow_id });
    await call("set_trigger", { flow_id, event: "start" });

    const worker = new Worker(app, { tickMs: 60_000 });
    telegram.receiveText("201", "/start", { first_name: "A" });
    telegram.receiveText("202", "/start", { first_name: "B" });
    await worker.pollOnce(bot_id);

    // One of them blocks the bot.
    telegram.blockChat("201");

    const out = await call<{ sent: number; failed: number; recipients: number }>("broadcast", {
      bot_id,
      text: "Announcement",
    });

    expect(out).toMatchObject({ recipients: 2, sent: 1, failed: 1 });
    expect(telegram.sentTo("202")).toContain("Announcement");

    const { subscribers } = await call<{ subscribers: { name: string; blocked: boolean }[] }>("list_subscribers", {
      bot_id,
    });
    expect(subscribers.find((s) => s.name === "A")?.blocked).toBe(true);

    // A blocked subscriber is skipped next time rather than retried.
    const again = await call<{ recipients: number }>("broadcast", { bot_id, text: "Second", dry_run: true });
    expect(again.recipients).toBe(1);
  });
});

describe("flow lifecycle", () => {
  it("refuses to run a draft flow", async () => {
    const { bot_id } = await call<{ bot_id: string }>("connect_bot", { token: VALID_TOKEN });
    const { flow_id } = await call<{ flow_id: string }>("create_flow", {
      bot_id,
      name: "Draft",
      steps: [{ type: "message", text: "x" }],
    });

    const sub = app.store.upsertSubscriber(bot_id, "300", "C", null);
    await expect(call("start_flow", { flow_id, subscriber_id: sub.id })).rejects.toThrow(/draft/i);
  });

  it("sends a flow back to draft when it is edited", async () => {
    const { bot_id } = await call<{ bot_id: string }>("connect_bot", { token: VALID_TOKEN });
    const { flow_id } = await call<{ flow_id: string }>("create_flow", {
      bot_id,
      name: "Edited",
      steps: [{ type: "message", text: "v1" }],
    });
    await call("publish_flow", { flow_id });

    const updated = await call<{ status: string }>("update_flow", {
      flow_id,
      steps: [{ type: "message", text: "v2" }],
    });
    expect(updated.status).toBe("draft");
  });

  it("rejects a flow whose goto points nowhere", async () => {
    const { bot_id } = await call<{ bot_id: string }>("connect_bot", { token: VALID_TOKEN });

    await expect(
      call("create_flow", {
        bot_id,
        name: "Broken",
        steps: [{ type: "message", text: "a" }, { type: "goto", goto: 99 }],
      }),
    ).rejects.toThrow(/step 99 does not exist/);
  });

  it("deletes a bot and everything under it", async () => {
    const { bot_id } = await call<{ bot_id: string }>("connect_bot", { token: VALID_TOKEN });
    const { flow_id } = await call<{ flow_id: string }>("create_flow", {
      bot_id,
      name: "Gone",
      steps: [{ type: "message", text: "x" }],
    });
    await call("publish_flow", { flow_id });
    await call("set_trigger", { flow_id, event: "start" });
    app.store.upsertSubscriber(bot_id, "400", "D", null);

    await call("disconnect_bot", { bot_id });

    expect(app.store.getFlow(flow_id)).toBeUndefined();
    expect(app.store.listBots()).toHaveLength(0);
    const { bots } = await call<{ bots: unknown[] }>("list_bots");
    expect(bots).toHaveLength(0);
  });
});

describe("argument validation reaches the handlers", () => {
  it("rejects a keyword trigger with no keywords", async () => {
    const { bot_id } = await call<{ bot_id: string }>("connect_bot", { token: VALID_TOKEN });
    const { flow_id } = await call<{ flow_id: string }>("create_flow", {
      bot_id,
      name: "K",
      steps: [{ type: "message", text: "x" }],
    });

    await expect(call("set_trigger", { flow_id, event: "keyword" })).rejects.toThrow(/at least one keyword/);
  });

  it("names the known bots when given an unknown bot_id", async () => {
    await call("connect_bot", { token: VALID_TOKEN });
    await expect(call("list_flows", { bot_id: "bot_missing" })).rejects.toThrow(/Known bots: bot_/);
  });
});
