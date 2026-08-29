import { describe, expect, it } from "vitest";
import { instagramChannel, parseComments } from "../src/channels/instagram.js";
import type { Incoming } from "../src/channels/types.js";
import { MetaError } from "../src/meta.js";
import { commentWebhook, fakeGraph } from "./fake-graph.js";

function channel(fetcher: typeof fetch, failing = false) {
  return instagramChannel({
    accessToken: "token",
    igUserId: "ig1",
    verifyToken: "v",
    appSecret: "s",
    fetcher,
    baseUrl: failing ? "https://graph.test/v21.0" : "https://graph.test/v21.0/",
  });
}

const comment: Incoming = {
  channel: "instagram",
  id: "c1",
  text: "fiyat?",
  authorId: "9001",
  username: "musteri",
  at: new Date(),
};

describe("parseComments", () => {
  it("flattens every comment in a delivery", () => {
    const messages = parseComments(
      commentWebhook([
        { id: "c1", text: "fiyat?" },
        { id: "c2", text: "kargo?", username: "ali" },
      ]),
    );

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ channel: "instagram", id: "c1", text: "fiyat?", username: "musteri" });
    expect(messages[1]).toMatchObject({ id: "c2", username: "ali", context: "17900000000000000" });
  });

  it("ignores fields the bot does not answer", () => {
    const body = { entry: [{ changes: [{ field: "mentions", value: { id: "m1", text: "hi", from: { id: "9" } } }] }] };
    expect(parseComments(body)).toEqual([]);
  });

  it("drops comments with no text or no author rather than throwing", () => {
    const messages = parseComments({
      entry: [
        {
          changes: [
            { field: "comments", value: { id: "c4", text: "   ", from: { id: "9" } } },
            { field: "comments", value: { id: "c5", text: "merhaba" } },
            { field: "comments", value: { text: "merhaba", from: { id: "9" } } },
          ],
        },
      ],
    });
    expect(messages).toEqual([]);
  });

  it("survives a body that is not a webhook at all", () => {
    expect(parseComments({})).toEqual([]);
    expect(parseComments(null)).toEqual([]);
    expect(parseComments("garbage")).toEqual([]);
    expect(parseComments({ entry: [{ changes: "nope" }] })).toEqual([]);
  });
});

describe("instagram channel", () => {
  it("can do all three things a public comment allows", () => {
    expect(channel(fakeGraph().fetcher).can).toEqual({ reply: true, privateReply: true, hide: true });
  });

  it("posts a threaded reply", async () => {
    const graph = fakeGraph();
    await channel(graph.fetcher).send(comment, "merhaba");

    expect(graph.calls[0]).toMatchObject({
      path: "/v21.0/c1/replies",
      fields: { message: "merhaba", access_token: "token" },
    });
  });

  it("sends a private reply addressed to the comment", async () => {
    const graph = fakeGraph();
    await channel(graph.fetcher).sendPrivate!(comment, "fiyat listemiz");

    const call = graph.calls[0]!;
    expect(call.path).toBe("/v21.0/ig1/messages");
    expect(JSON.parse(call.fields.recipient!)).toEqual({ comment_id: "c1" });
    expect(JSON.parse(call.fields.message!)).toEqual({ text: "fiyat listemiz" });
  });

  it("hides a comment", async () => {
    const graph = fakeGraph();
    await channel(graph.fetcher).hide!(comment);
    expect(graph.calls[0]).toMatchObject({ path: "/v21.0/c1", fields: { hide: "true" } });
  });

  it("never refuses on age — comments have no window", () => {
    expect(channel(fakeGraph().fetcher).refuse).toBeUndefined();
  });

  it("classifies a throttle as retryable", async () => {
    const graph = fakeGraph({ failOn: { path: "/replies", status: 400, code: 4, message: "rate limited" } });
    const error = (await channel(graph.fetcher).send(comment, "hi").catch((thrown) => thrown)) as MetaError;

    expect(error).toBeInstanceOf(MetaError);
    expect(error.isRateLimited).toBe(true);
    expect(error.isGone).toBe(false);
  });

  it("classifies an expired token", async () => {
    const graph = fakeGraph({ failOn: { path: "/replies", status: 400, code: 190, message: "token expired" } });
    const error = (await channel(graph.fetcher).send(comment, "hi").catch((thrown) => thrown)) as MetaError;
    expect(error.isAuthFailure).toBe(true);
  });

  it("still throws when the body is not JSON at all", async () => {
    const fetcher: typeof fetch = async () => new Response("<html>502</html>", { status: 502 });
    await expect(channel(fetcher).send(comment, "hi")).rejects.toThrow(/502/);
  });
});
