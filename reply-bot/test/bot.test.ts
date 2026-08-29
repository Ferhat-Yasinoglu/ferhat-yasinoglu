import { describe, expect, it } from "vitest";
import type { Replier } from "../src/ai.js";
import { Bot } from "../src/bot.js";
import { instagramChannel } from "../src/channels/instagram.js";
import type { Channel, ChannelName, Incoming } from "../src/channels/types.js";
import { whatsappChannel } from "../src/channels/whatsapp.js";
import { parseRules } from "../src/rules.js";
import { fakeGraph } from "./fake-graph.js";

const rules = parseRules([
  { name: "spam", pattern: "(bedava takipci|casino)", hide: true },
  { name: "tags", pattern: "^\\s*@\\w+[\\s@\\w]*$", ignore: true, channels: ["instagram"] },
  {
    name: "price",
    keywords: ["fiyat", "ne kadar"],
    reply: ["Merhaba {{username}}, DM'den yazıyoruz!", "Selam {{username}}, DM kutumuz açık!"],
    privateReply: "Fiyat listemiz: ...",
  },
  { name: "shipping", keywords: ["kargo"], reply: "1-3 iş günü 📦" },
  { name: "greeting", keywords: ["merhaba"], reply: "Merhaba! Nasıl yardımcı olabilirim?", channels: ["whatsapp"] },
]);

function ig(fetcher = fakeGraph().fetcher, ownIds = "ig1"): Channel {
  return instagramChannel({ accessToken: "t", igUserId: ownIds, verifyToken: "v", appSecret: "s", fetcher });
}

function wa(fetcher = fakeGraph().fetcher, windowHours = 24): Channel {
  return whatsappChannel({
    accessToken: "t",
    phoneNumberId: "p1",
    verifyToken: "v",
    appSecret: "s",
    fetcher,
    windowHours,
  });
}

function msg(overrides: Partial<Incoming> = {}, channel: ChannelName = "instagram"): Incoming {
  return {
    channel,
    id: "c1",
    text: "fiyat nedir?",
    authorId: "9001",
    username: "musteri",
    at: new Date(),
    ...overrides,
  };
}

function staticReplier(reply: string | undefined): Replier {
  return { generate: async () => reply };
}

describe("decide", () => {
  it("answers from a rule and fills the username", async () => {
    const action = await new Bot({ rules }).decide(msg(), ig());

    expect(action.kind).toBe("reply");
    if (action.kind !== "reply") return;
    expect(action.text).toContain("musteri");
    expect(action.privateReply).toBe("Fiyat listemiz: ...");
    expect(action.reason).toBe("rule:price");
  });

  it("never answers its own account, which is what stops a reply loop", async () => {
    const bot = new Bot({ rules, replier: staticReplier("hi") });
    const action = await bot.decide(msg({ authorId: "ig1" }), ig());
    expect(action).toEqual({ kind: "skip", reason: "own message" });
  });

  it("hides spam on Instagram", async () => {
    const action = await new Bot({ rules }).decide(msg({ text: "bedava takipci kazan" }), ig());
    expect(action.kind).toBe("hide");
  });

  it("stays silent on the same spam in WhatsApp, where nothing can be hidden", async () => {
    const action = await new Bot({ rules }).decide(msg({ text: "casino linki" }, "whatsapp"), wa());
    expect(action).toEqual({ kind: "skip", reason: "rule:spam (whatsapp gizleyemez)" });
  });

  it("drops the DM on a channel that has no separate DM", async () => {
    const action = await new Bot({ rules }).decide(msg({ text: "fiyat?" }, "whatsapp"), wa());

    expect(action.kind).toBe("reply");
    if (action.kind !== "reply") return;
    expect(action.text).toBeTruthy();
    expect(action.privateReply).toBeUndefined();
  });

  it("applies a channel-scoped rule only on its channel", async () => {
    const bot = new Bot({ rules });
    expect((await bot.decide(msg({ text: "merhaba" }, "whatsapp"), wa())).reason).toBe("rule:greeting");
    expect(await bot.decide(msg({ text: "merhaba" }), ig())).toEqual({ kind: "skip", reason: "no rule matched" });
  });

  it("refuses a WhatsApp message older than the window", async () => {
    const old = new Date(Date.now() - 30 * 3600_000);
    const action = await new Bot({ rules }).decide(msg({ text: "fiyat?", at: old }, "whatsapp"), wa());
    expect(action.kind).toBe("skip");
    expect(action.reason).toMatch(/24 saat penceresi/);
  });

  it("has no such window on Instagram", async () => {
    const old = new Date(Date.now() - 400 * 3600_000);
    const action = await new Bot({ rules }).decide(msg({ text: "kargo?", at: old }), ig());
    expect(action.kind).toBe("reply");
  });

  it("falls back to the model when no rule matches", async () => {
    const bot = new Bot({ rules, replier: staticReplier("İstanbul'da çektik 🙂") });
    const action = await bot.decide(msg({ text: "bu fotoğrafı nerede çektiniz?" }), ig());
    expect(action).toMatchObject({ kind: "reply", reason: "model" });
  });

  it("tells the model which room it is writing into", async () => {
    const seen: string[] = [];
    const replier: Replier = {
      generate: async (context) => {
        seen.push(context.channel);
        return "ok";
      },
    };
    const bot = new Bot({ rules, replier });
    await bot.decide(msg({ text: "nerede çektiniz?" }), ig());
    await bot.decide(msg({ text: "nerede çektiniz?" }, "whatsapp"), wa());

    expect(seen).toEqual(["instagram", "whatsapp"]);
  });

  it("does not spend a model call on emoji", async () => {
    let calls = 0;
    const replier: Replier = { generate: async () => (calls++, "hi") };
    const action = await new Bot({ rules, replier }).decide(msg({ text: "❤️🔥🔥" }), ig());

    expect(action).toEqual({ kind: "skip", reason: "no words to answer" });
    expect(calls).toBe(0);
  });

  it("stays silent when the model declines or fails", async () => {
    const declined = await new Bot({ rules, replier: staticReplier(undefined) }).decide(
      msg({ text: "memnun kalmadım" }),
      ig(),
    );
    expect(declined).toEqual({ kind: "skip", reason: "model declined" });

    const failing: Replier = {
      generate: async () => {
        throw new Error("429");
      },
    };
    const failed = await new Bot({ rules, replier: failing }).decide(msg({ text: "nerede çektiniz?" }), ig());
    expect(failed).toEqual({ kind: "skip", reason: "model error" });
  });
});

describe("handle", () => {
  it("sends the public reply and the DM on Instagram", async () => {
    const graph = fakeGraph();
    const result = await new Bot({ rules }).handle(msg(), ig(graph.fetcher));

    expect(result.sent).toBe(true);
    expect(graph.replies()).toHaveLength(1);
    expect(graph.callsTo("/ig1/messages")).toHaveLength(1);
  });

  it("sends one WhatsApp message and no DM", async () => {
    const graph = fakeGraph();
    const result = await new Bot({ rules }).handle(msg({ text: "fiyat?" }, "whatsapp"), wa(graph.fetcher));

    expect(result.sent).toBe(true);
    expect(graph.whatsappTexts()).toHaveLength(1);
    expect(graph.calls).toHaveLength(1);
  });

  it("answers a repeated delivery only once", async () => {
    const graph = fakeGraph();
    const bot = new Bot({ rules });
    const channel = ig(graph.fetcher);

    await bot.handle(msg({ text: "kargo?" }), channel);
    const second = await bot.handle(msg({ text: "kargo?" }), channel);

    expect(second.action).toEqual({ kind: "skip", reason: "already handled" });
    expect(graph.replies()).toHaveLength(1);
  });

  it("keeps the two channels' ids apart", async () => {
    const graph = fakeGraph();
    const bot = new Bot({ rules });

    await bot.handle(msg({ id: "same", text: "kargo?" }), ig(graph.fetcher));
    const other = await bot.handle(msg({ id: "same", text: "kargo?" }, "whatsapp"), wa(graph.fetcher));

    expect(other.action.kind).toBe("reply");
    expect(other.sent).toBe(true);
  });

  it("sends nothing in a dry run", async () => {
    const graph = fakeGraph();
    const result = await new Bot({ rules, dryRun: true }).handle(msg(), ig(graph.fetcher));

    expect(result.action.kind).toBe("reply");
    expect(result.sent).toBe(false);
    expect(graph.calls).toHaveLength(0);
  });

  it("survives a comment deleted between the webhook and the reply", async () => {
    const graph = fakeGraph({ failOn: { path: "/replies", status: 400, code: 100, message: "does not exist" } });
    const result = await new Bot({ rules }).handle(msg({ text: "kargo?" }), ig(graph.fetcher));

    expect(result.sent).toBe(false);
    expect(result.error?.message).toContain("does not exist");
  });

  it("forgets the oldest ids once memory is full", async () => {
    const bot = new Bot({ rules, memory: 2, dryRun: true });
    const channel = ig();
    await bot.handle(msg({ id: "a", text: "kargo?" }), channel);
    await bot.handle(msg({ id: "b", text: "kargo?" }), channel);
    await bot.handle(msg({ id: "c", text: "kargo?" }), channel);

    const again = await bot.handle(msg({ id: "a", text: "kargo?" }), channel);
    expect(again.action.kind).toBe("reply");
  });
});
