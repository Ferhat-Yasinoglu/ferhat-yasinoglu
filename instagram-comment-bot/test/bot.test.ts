import { describe, expect, it } from "vitest";
import type { Replier } from "../src/ai.js";
import { Bot } from "../src/bot.js";
import type { CommentEvent } from "../src/events.js";
import { InstagramClient } from "../src/instagram.js";
import { parseRules } from "../src/rules.js";
import { fakeGraph } from "./fake-graph.js";

const rules = parseRules([
  { name: "spam", pattern: "(bedava takipci|casino)", hide: true },
  { name: "tags", pattern: "^\\s*@\\w+[\\s@\\w]*$", ignore: true },
  {
    name: "price",
    keywords: ["fiyat", "ne kadar"],
    reply: ["Merhaba {{username}}, DM'den yazıyoruz!", "Selam {{username}}, DM kutumuz açık!"],
    privateReply: "Fiyat listemiz: ...",
  },
  { name: "shipping", keywords: ["kargo"], reply: "1-3 iş günü 📦" },
]);

function comment(overrides: Partial<CommentEvent> = {}): CommentEvent {
  return {
    commentId: "c1",
    mediaId: "m1",
    text: "fiyat nedir?",
    fromId: "9001",
    username: "musteri",
    ...overrides,
  };
}

function staticReplier(reply: string | undefined): Replier {
  return { generate: async () => reply };
}

describe("decide", () => {
  it("answers from a rule and fills the username", async () => {
    const bot = new Bot({ rules });
    const action = await bot.decide(comment());

    expect(action.kind).toBe("reply");
    if (action.kind !== "reply") return;
    expect(action.text).toContain("musteri");
    expect(action.privateReply).toBe("Fiyat listemiz: ...");
    expect(action.reason).toBe("rule:price");
  });

  it("never answers its own account, which is what stops a reply loop", async () => {
    const bot = new Bot({ rules, ownIds: ["17841400000000000"], replier: staticReplier("hi") });
    const action = await bot.decide(comment({ fromId: "17841400000000000" }));
    expect(action).toEqual({ kind: "skip", reason: "own comment" });
  });

  it("hides spam instead of replying to it", async () => {
    const action = await new Bot({ rules }).decide(comment({ text: "bedava takipci kazan" }));
    expect(action.kind).toBe("hide");
  });

  it("stays silent on a rule marked ignore", async () => {
    const action = await new Bot({ rules, replier: staticReplier("hi") }).decide(comment({ text: "@ayse @veli" }));
    expect(action).toEqual({ kind: "skip", reason: "rule:tags (ignore)" });
  });

  it("falls back to the model when no rule matches", async () => {
    const bot = new Bot({ rules, replier: staticReplier("Bu ürünü İstanbul'da çektik 🙂") });
    const action = await bot.decide(comment({ text: "bu fotoğrafı nerede çektiniz?" }));
    expect(action).toMatchObject({ kind: "reply", reason: "model" });
  });

  it("says nothing when there is no model and no rule", async () => {
    const action = await new Bot({ rules }).decide(comment({ text: "nerede çektiniz?" }));
    expect(action).toEqual({ kind: "skip", reason: "no rule matched" });
  });

  it("does not spend a model call on emoji", async () => {
    let calls = 0;
    const replier: Replier = { generate: async () => (calls++, "hi") };
    const action = await new Bot({ rules, replier }).decide(comment({ text: "❤️🔥🔥" }));

    expect(action).toEqual({ kind: "skip", reason: "no words to answer" });
    expect(calls).toBe(0);
  });

  it("stays silent when the model declines", async () => {
    const bot = new Bot({ rules, replier: staticReplier(undefined) });
    const action = await bot.decide(comment({ text: "sizden hiç memnun kalmadım" }));
    expect(action).toEqual({ kind: "skip", reason: "model declined" });
  });

  it("stays silent when the model call fails", async () => {
    const replier: Replier = {
      generate: async () => {
        throw new Error("429");
      },
    };
    const action = await new Bot({ rules, replier }).decide(comment({ text: "nerede çektiniz?" }));
    expect(action).toEqual({ kind: "skip", reason: "model error" });
  });

  it("keeps replies inside the character limit", async () => {
    const bot = new Bot({ rules: parseRules([{ name: "long", keywords: ["uzun"], reply: "x".repeat(400) }]) });
    const action = await bot.decide(comment({ text: "uzun" }));
    if (action.kind !== "reply") throw new Error("expected a reply");
    expect(action.text!.length).toBeLessThanOrEqual(281);
  });
});

describe("handle", () => {
  it("posts the public reply and the DM", async () => {
    const graph = fakeGraph();
    const instagram = new InstagramClient({
      accessToken: "token",
      igUserId: "ig1",
      fetcher: graph.fetcher,
      baseUrl: "https://graph.test/v21.0",
    });

    const result = await new Bot({ rules, instagram }).handle(comment());

    expect(result.posted).toBe(true);
    expect(graph.replies()).toHaveLength(1);
    expect(graph.callsTo("/ig1/messages")).toHaveLength(1);
    expect(graph.calls[0]!.fields.access_token).toBe("token");
  });

  it("hides through the Graph API", async () => {
    const graph = fakeGraph();
    const instagram = new InstagramClient({ accessToken: "t", igUserId: "ig1", fetcher: graph.fetcher });
    await new Bot({ rules, instagram }).handle(comment({ text: "casino linki" }));

    expect(graph.calls[0]?.fields.hide).toBe("true");
  });

  it("answers a repeated delivery only once", async () => {
    const graph = fakeGraph();
    const instagram = new InstagramClient({ accessToken: "t", igUserId: "ig1", fetcher: graph.fetcher });
    const bot = new Bot({ rules, instagram });

    await bot.handle(comment({ text: "kargo?" }));
    const second = await bot.handle(comment({ text: "kargo?" }));

    expect(second.action).toEqual({ kind: "skip", reason: "already handled" });
    expect(graph.replies()).toHaveLength(1);
  });

  it("posts nothing in a dry run", async () => {
    const graph = fakeGraph();
    const instagram = new InstagramClient({ accessToken: "t", igUserId: "ig1", fetcher: graph.fetcher });
    const result = await new Bot({ rules, instagram, dryRun: true }).handle(comment());

    expect(result.action.kind).toBe("reply");
    expect(result.posted).toBe(false);
    expect(graph.calls).toHaveLength(0);
  });

  it("survives a comment deleted between the webhook and the reply", async () => {
    const graph = fakeGraph({ failOn: { path: "/replies", status: 400, code: 100, message: "does not exist" } });
    const instagram = new InstagramClient({ accessToken: "t", igUserId: "ig1", fetcher: graph.fetcher });
    const result = await new Bot({ rules, instagram }).handle(comment({ text: "kargo?" }));

    expect(result.posted).toBe(false);
    expect(result.error?.message).toContain("does not exist");
  });

  it("forgets the oldest ids once memory is full", async () => {
    const bot = new Bot({ rules, memory: 2 });
    await bot.handle(comment({ commentId: "a", text: "kargo?" }));
    await bot.handle(comment({ commentId: "b", text: "kargo?" }));
    await bot.handle(comment({ commentId: "c", text: "kargo?" }));

    const again = await bot.handle(comment({ commentId: "a", text: "kargo?" }));
    expect(again.action.kind).toBe("reply");
  });
});
