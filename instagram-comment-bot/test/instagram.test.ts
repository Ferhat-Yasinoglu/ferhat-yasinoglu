import { describe, expect, it } from "vitest";
import { InstagramClient, InstagramError } from "../src/instagram.js";
import { fakeGraph } from "./fake-graph.js";
import { sign, verifySignature } from "../src/signature.js";

function client(fetcher: typeof fetch) {
  return new InstagramClient({
    accessToken: "token",
    igUserId: "ig1",
    fetcher,
    baseUrl: "https://graph.test/v21.0/",
  });
}

describe("InstagramClient", () => {
  it("posts a threaded reply and returns the new comment id", async () => {
    const graph = fakeGraph();
    const id = await client(graph.fetcher).replyToComment("c1", "merhaba");

    expect(id).toBe("posted_1");
    expect(graph.calls[0]).toMatchObject({
      path: "/v21.0/c1/replies",
      fields: { message: "merhaba", access_token: "token" },
    });
  });

  it("sends a private reply addressed to the comment", async () => {
    const graph = fakeGraph();
    await client(graph.fetcher).sendPrivateReply("c1", "fiyat listemiz");

    const call = graph.calls[0]!;
    expect(call.path).toBe("/v21.0/ig1/messages");
    expect(JSON.parse(call.fields.recipient!)).toEqual({ comment_id: "c1" });
    expect(JSON.parse(call.fields.message!)).toEqual({ text: "fiyat listemiz" });
  });

  it("hides a comment", async () => {
    const graph = fakeGraph();
    await client(graph.fetcher).hideComment("c1");
    expect(graph.calls[0]).toMatchObject({ path: "/v21.0/c1", fields: { hide: "true" } });
  });

  it("classifies a throttle as retryable", async () => {
    const graph = fakeGraph({ failOn: { path: "/replies", status: 400, code: 4, message: "rate limited" } });
    const error = await client(graph.fetcher)
      .replyToComment("c1", "hi")
      .catch((thrown) => thrown as InstagramError);

    expect(error).toBeInstanceOf(InstagramError);
    expect((error as InstagramError).isRateLimited).toBe(true);
    expect((error as InstagramError).isGone).toBe(false);
  });

  it("classifies an expired token", async () => {
    const graph = fakeGraph({ failOn: { path: "/replies", status: 400, code: 190, message: "token expired" } });
    const error = (await client(graph.fetcher)
      .replyToComment("c1", "hi")
      .catch((thrown) => thrown)) as InstagramError;

    expect(error.isAuthFailure).toBe(true);
  });

  it("still throws when the body is not JSON at all", async () => {
    const fetcher: typeof fetch = async () => new Response("<html>502</html>", { status: 502 });
    await expect(client(fetcher).replyToComment("c1", "hi")).rejects.toThrow(/502/);
  });
});

describe("verifySignature", () => {
  const body = Buffer.from(JSON.stringify({ entry: [] }));

  it("accepts what Meta would send", () => {
    expect(verifySignature(body, sign(body, "secret"), "secret")).toBe(true);
  });

  it("rejects another secret, a tampered body, and a missing header", () => {
    expect(verifySignature(body, sign(body, "other"), "secret")).toBe(false);
    expect(verifySignature(Buffer.from("{}"), sign(body, "secret"), "secret")).toBe(false);
    expect(verifySignature(body, undefined, "secret")).toBe(false);
    expect(verifySignature(body, "sha1=abc", "secret")).toBe(false);
  });
});
