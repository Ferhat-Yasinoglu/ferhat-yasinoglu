import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { claudeReplier } from "../src/ai.js";

type Request = Anthropic.Beta.BetaMessageCreateParamsNonStreaming;

/** Stands in for the SDK client: records the request, returns a canned message. */
function fakeClaude(reply: { text?: string; stop_reason?: string }) {
  const requests: Request[] = [];
  const client = {
    beta: {
      messages: {
        create: async (request: Request) => {
          requests.push(request);
          return {
            content: reply.text === undefined ? [] : [{ type: "text", text: reply.text }],
            stop_reason: reply.stop_reason ?? "end_turn",
          };
        },
      },
    },
  } as unknown as Anthropic;

  return { client, requests };
}

const persona = "Handmade leather goods. Prices go to DM.";

describe("claudeReplier", () => {
  it("returns the model's reply and passes the brief as a cached system prompt", async () => {
    const { client, requests } = fakeClaude({ text: "  Teşekkürler! 🤍  " });
    const reply = await claudeReplier({ persona, client }).generate({ text: "çok güzel", username: "ayse", channel: "instagram" });

    expect(reply).toBe("Teşekkürler! 🤍");
    const request = requests[0]!;
    expect(request.model).toBe("claude-opus-5");
    expect(JSON.stringify(request.system)).toContain(persona);
    expect((request.system as { cache_control?: unknown }[])[0]?.cache_control).toEqual({ type: "ephemeral" });
    expect(JSON.stringify(request.messages)).toContain("çok güzel");
  });

  it("stays silent when the model answers <skip>", async () => {
    const { client } = fakeClaude({ text: "<skip>" });
    expect(await claudeReplier({ persona, client }).generate({ text: "iade istiyorum", username: "a", channel: "instagram" })).toBeUndefined();
  });

  it("stays silent on a refusal", async () => {
    const { client } = fakeClaude({ text: "…", stop_reason: "refusal" });
    expect(await claudeReplier({ persona, client }).generate({ text: "...", username: "a", channel: "instagram" })).toBeUndefined();
  });

  it("stays silent on an empty response", async () => {
    const { client } = fakeClaude({});
    expect(await claudeReplier({ persona, client }).generate({ text: "hm", username: "a", channel: "instagram" })).toBeUndefined();
  });

  it("clamps a model that ignored the length rule", async () => {
    const { client } = fakeClaude({ text: "çok uzun bir cevap ".repeat(40) });
    const reply = await claudeReplier({ persona, client, maxChars: 100 }).generate({ text: "?", username: "a", channel: "instagram" });

    expect(reply!.length).toBeLessThanOrEqual(101);
  });

  it("honours the configured model", async () => {
    const { client, requests } = fakeClaude({ text: "ok" });
    await claudeReplier({ persona, client, model: "claude-haiku-4-5" }).generate({ text: "?", username: "a", channel: "instagram" });
    expect(requests[0]!.model).toBe("claude-haiku-4-5");
  });
});

describe("kanal", () => {
  it("tells the model which room it is writing into", async () => {
    const ig = fakeClaude({ text: "ok" });
    await claudeReplier({ persona, client: ig.client }).generate({ text: "?", username: "a", channel: "instagram" });

    const wa = fakeClaude({ text: "ok" });
    await claudeReplier({ persona, client: wa.client }).generate({ text: "?", username: "a", channel: "whatsapp" });

    expect(JSON.stringify(ig.requests[0]!.system)).toContain("public reply under an Instagram comment");
    expect(JSON.stringify(wa.requests[0]!.system)).toContain("WhatsApp message back to one person");
  });

  it("keeps the brief in both rooms", async () => {
    const wa = fakeClaude({ text: "ok" });
    await claudeReplier({ persona, client: wa.client }).generate({ text: "?", username: "a", channel: "whatsapp" });
    expect(JSON.stringify(wa.requests[0]!.system)).toContain(persona);
  });
});
