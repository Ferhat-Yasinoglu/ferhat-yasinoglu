import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/store/index.js";

let dir: string;
let dbPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "botflow-"));
  dbPath = join(dir, "test.db");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("persistence", () => {
  it("keeps data across a reopen", () => {
    const first = new Store(dbPath);
    const bot = first.createBot("tok", "mybot", "My Bot");
    const sub = first.upsertSubscriber(bot.id, "100", "Ayse", "ayse");
    first.addTags(sub.id, ["vip"]);
    const flow = first.createFlow(bot.id, "Welcome", [{ type: "message", text: "hi" }]);
    first.publishFlow(flow.id);
    first.setOffset(bot.id, 42);
    first.close();

    const second = new Store(dbPath);
    expect(second.getBot(bot.id)?.username).toBe("mybot");
    expect(second.getTags(sub.id)).toEqual(["vip"]);
    expect(second.getFlow(flow.id)?.status).toBe("published");
    expect(second.getOffset(bot.id)).toBe(42);
    second.close();
  });
});

describe("cascading deletes", () => {
  it("removes everything belonging to a deleted bot", () => {
    const store = new Store(dbPath);
    const bot = store.createBot("tok", "b", "B");
    const sub = store.upsertSubscriber(bot.id, "1", "A", null);
    const flow = store.createFlow(bot.id, "F", [{ type: "message", text: "x" }]);
    const trigger = store.createTrigger(bot.id, flow.id, "start", []);
    const run = store.createRun(flow.id, sub.id, [{ type: "message", text: "x" }]);
    store.addTags(sub.id, ["t"]);
    store.logMessage(bot.id, sub.id, "in", "hello");

    store.deleteBot(bot.id);

    expect(store.getFlow(flow.id)).toBeUndefined();
    expect(store.getSubscriber(sub.id)).toBeUndefined();
    expect(store.getRun(run.id)).toBeUndefined();
    expect(store.listTriggers(bot.id)).toEqual([]);
    expect(store.getTags(sub.id)).toEqual([]);
    expect(trigger.id).toMatch(/^trg_/);
    store.close();
  });

  it("removes runs and triggers when only a flow is deleted", () => {
    const store = new Store(dbPath);
    const bot = store.createBot("tok", "b", "B");
    const sub = store.upsertSubscriber(bot.id, "1", "A", null);
    const flow = store.createFlow(bot.id, "F", []);
    store.createTrigger(bot.id, flow.id, "start", []);
    const run = store.createRun(flow.id, sub.id, []);

    store.deleteFlow(flow.id);

    expect(store.getRun(run.id)).toBeUndefined();
    expect(store.listTriggers(bot.id)).toEqual([]);
    // The subscriber belongs to the bot, not the flow, so they survive.
    expect(store.getSubscriber(sub.id)).toBeDefined();
    store.close();
  });
});

describe("subscribers", () => {
  it("returns the same subscriber for a repeat chat rather than duplicating", () => {
    const store = new Store(dbPath);
    const bot = store.createBot("tok", "b", "B");

    const first = store.upsertSubscriber(bot.id, "500", "Ayse", null);
    const second = store.upsertSubscriber(bot.id, "500", "Ayse", null);

    expect(second.id).toBe(first.id);
    expect(store.countSubscribers(bot.id)).toBe(1);
    store.close();
  });

  it("picks up a changed display name on the next contact", () => {
    const store = new Store(dbPath);
    const bot = store.createBot("tok", "b", "B");

    const first = store.upsertSubscriber(bot.id, "500", "Ayse", null);
    const renamed = store.upsertSubscriber(bot.id, "500", "Ayşe", "ayse");

    expect(renamed.id).toBe(first.id);
    expect(renamed.name).toBe("Ayşe");
    expect(store.getSubscriber(first.id)?.username).toBe("ayse");
    store.close();
  });

  it("keeps the same chat id separate across two bots", () => {
    const store = new Store(dbPath);
    const a = store.createBot("t1", "a", "A");
    const b = store.createBot("t2", "b", "B");

    const subA = store.upsertSubscriber(a.id, "500", "X", null);
    const subB = store.upsertSubscriber(b.id, "500", "X", null);

    expect(subA.id).not.toBe(subB.id);
    store.close();
  });
});

describe("segments", () => {
  it("requires every tag, not just one", () => {
    const store = new Store(dbPath);
    const bot = store.createBot("tok", "b", "B");

    const both = store.upsertSubscriber(bot.id, "1", "Both", null);
    const one = store.upsertSubscriber(bot.id, "2", "One", null);
    store.addTags(both.id, ["vip", "tr"]);
    store.addTags(one.id, ["vip"]);

    expect(store.segment(bot.id, ["vip"]).map((s) => s.id).sort()).toEqual([both.id, one.id].sort());
    expect(store.segment(bot.id, ["vip", "tr"]).map((s) => s.id)).toEqual([both.id]);
    expect(store.segment(bot.id, [])).toHaveLength(2);
    store.close();
  });

  it("does not double-count a subscriber carrying a tag twice", () => {
    const store = new Store(dbPath);
    const bot = store.createBot("tok", "b", "B");
    const sub = store.upsertSubscriber(bot.id, "1", "A", null);

    store.addTags(sub.id, ["vip"]);
    store.addTags(sub.id, ["vip"]);

    expect(store.getTags(sub.id)).toEqual(["vip"]);
    expect(store.segment(bot.id, ["vip"])).toHaveLength(1);
    store.close();
  });
});

describe("runs", () => {
  it("reports only runs whose delay has already elapsed", () => {
    const store = new Store(dbPath);
    const bot = store.createBot("tok", "b", "B");
    const sub = store.upsertSubscriber(bot.id, "1", "A", null);
    const flow = store.createFlow(bot.id, "F", []);

    const past = store.createRun(flow.id, sub.id, []);
    const future = store.createRun(flow.id, sub.id, []);
    store.saveRun({ ...past, waiting_for: "delay", resume_at: new Date(Date.now() - 1000).toISOString() });
    store.saveRun({ ...future, waiting_for: "delay", resume_at: new Date(Date.now() + 60_000).toISOString() });

    expect(store.dueRuns().map((r) => r.id)).toEqual([past.id]);
    store.close();
  });

  it("does not report a run that is waiting on a person rather than a timer", () => {
    const store = new Store(dbPath);
    const bot = store.createBot("tok", "b", "B");
    const sub = store.upsertSubscriber(bot.id, "1", "A", null);
    const flow = store.createFlow(bot.id, "F", []);

    const run = store.createRun(flow.id, sub.id, []);
    store.saveRun({ ...run, waiting_for: "reply", resume_at: new Date(Date.now() - 1000).toISOString() });

    expect(store.dueRuns()).toEqual([]);
    store.close();
  });

  it("treats the newest waiting run as the subscriber's active one", () => {
    const store = new Store(dbPath);
    const bot = store.createBot("tok", "b", "B");
    const sub = store.upsertSubscriber(bot.id, "1", "A", null);
    const flow = store.createFlow(bot.id, "F", []);

    const first = store.createRun(flow.id, sub.id, []);
    store.saveRun({ ...first, status: "finished" });
    const second = store.createRun(flow.id, sub.id, []);

    expect(store.activeRunFor(sub.id)?.id).toBe(second.id);
    store.close();
  });
});
