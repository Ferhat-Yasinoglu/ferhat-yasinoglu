import { describe, expect, it } from "vitest";
import { parseRules, type Rule } from "../src/rules.js";
import { Runtime } from "../src/runtime.js";
import { SettingsStore, type FileIO } from "../src/store.js";

const RULES = parseRules([{ name: "fiyat", keywords: ["fiyat"], reply: "DM'den yazıyoruz" }]);

function memoryStore(env: NodeJS.ProcessEnv = {}) {
  const files = new Map<string, string>();
  const io: FileIO = {
    read: (file) => {
      const content = files.get(file);
      if (content === undefined) {
        const error = new Error("ENOENT") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return content;
    },
    write: (file, content) => void files.set(file, content),
  };
  return new SettingsStore({ dir: "data", env, io });
}

function runtime(store: SettingsStore, rules: Rule[] = RULES) {
  return new Runtime({
    store,
    // No Anthropic client and no rules file: this test is about the wiring.
    makeReplier: () => undefined,
    readRules: () => rules,
  });
}

describe("Runtime", () => {
  it("builds the channels the settings ask for", () => {
    const store = memoryStore({ IG_ACCESS_TOKEN: "t", IG_USER_ID: "ig1", IG_VERIFY_TOKEN: "v" });

    expect(runtime(store).current.channels.map((channel) => channel.name)).toEqual(["instagram"]);
  });

  it("turns a channel on without a restart", () => {
    const store = memoryStore();
    const live = runtime(store);
    expect(live.current.channels).toHaveLength(0);

    store.save({ WA_ACCESS_TOKEN: "t", WA_PHONE_NUMBER_ID: "p1", WA_VERIFY_TOKEN: "v" });
    live.reload();

    expect(live.current.channels.map((channel) => channel.name)).toEqual(["whatsapp"]);
    expect(live.current.missing).toEqual([]);
  });

  it("routes a request path to the channel mounted there", () => {
    const store = memoryStore({ IG_ACCESS_TOKEN: "t", IG_USER_ID: "ig1", IG_VERIFY_TOKEN: "v" });
    const live = runtime(store);

    expect(live.channelFor("/webhook/instagram")?.name).toBe("instagram");
    expect(live.channelFor("/webhook/whatsapp")).toBeUndefined();
  });

  it("keeps the old runtime when a reload fails", () => {
    const store = memoryStore({ IG_ACCESS_TOKEN: "t", IG_USER_ID: "ig1", IG_VERIFY_TOKEN: "v" });
    let rules = RULES;
    const live = new Runtime({
      store,
      makeReplier: () => undefined,
      readRules: () => {
        if (rules === undefined) throw new Error("rules.json: bozuk");
        return rules;
      },
    });
    const before = live.current;

    rules = undefined as never;
    expect(() => live.reload()).toThrow("bozuk");

    // Same object, so the server is still serving the bot it was serving.
    expect(live.current).toBe(before);
    expect(live.current.channels).toHaveLength(1);
  });

  it("reports what a half-configured channel is missing instead of throwing", () => {
    const store = memoryStore({ IG_ACCESS_TOKEN: "t" });

    expect(runtime(store).current.missing).toContain("IG_VERIFY_TOKEN");
  });

  it("hands the new rules to the bot after a reload", async () => {
    const store = memoryStore({ IG_ACCESS_TOKEN: "t", IG_USER_ID: "ig1", IG_VERIFY_TOKEN: "v" });
    let rules = RULES;
    const live = new Runtime({ store, makeReplier: () => undefined, readRules: () => rules });
    const channel = live.channelFor("/webhook/instagram");

    rules = parseRules([{ name: "kargo", keywords: ["kargo"], reply: "1-3 gün" }]);
    live.reload();

    const action = await live.current.bot.decide(
      { channel: "instagram", id: "c1", text: "kargo ne zaman?", authorId: "u1", username: "x", at: new Date() },
      channel!,
    );
    expect(action).toMatchObject({ kind: "reply", text: "1-3 gün" });
  });

  it("writes every handled message into the journal", async () => {
    const store = memoryStore({ IG_ACCESS_TOKEN: "t", IG_USER_ID: "ig1", IG_VERIFY_TOKEN: "v", BOT_DRY_RUN: "1" });
    const live = runtime(store);
    const channel = live.channelFor("/webhook/instagram");

    await live.current.bot.handle(
      { channel: "instagram", id: "c1", text: "fiyat?", authorId: "u1", username: "ali", at: new Date() },
      channel!,
    );

    expect(live.journal.list()).toHaveLength(1);
    expect(live.journal.list()[0]).toMatchObject({ from: "ali", kind: "reply", reason: "rule:fiyat" });
  });

  it("does not journal a webhook retry twice", async () => {
    const store = memoryStore({ IG_ACCESS_TOKEN: "t", IG_USER_ID: "ig1", IG_VERIFY_TOKEN: "v", BOT_DRY_RUN: "1" });
    const live = runtime(store);
    const channel = live.channelFor("/webhook/instagram");
    const message = { channel: "instagram" as const, id: "c1", text: "fiyat?", authorId: "u1", username: "ali", at: new Date() };

    await live.current.bot.handle(message, channel!);
    await live.current.bot.handle(message, channel!);

    expect(live.journal.list()).toHaveLength(1);
  });

  it("carries dry run through from the settings", () => {
    const store = memoryStore({ IG_ACCESS_TOKEN: "t", IG_USER_ID: "ig1", IG_VERIFY_TOKEN: "v" });
    const live = runtime(store);
    expect(live.current.config.dryRun).toBe(false);

    store.save({ BOT_DRY_RUN: "1" });
    live.reload();
    expect(live.current.config.dryRun).toBe(true);
  });
});
