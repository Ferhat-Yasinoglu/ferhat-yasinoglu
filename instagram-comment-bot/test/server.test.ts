import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { Bot } from "../src/bot.js";
import { InstagramClient } from "../src/instagram.js";
import { parseRules } from "../src/rules.js";
import { createApp } from "../src/server.js";
import { sign } from "../src/signature.js";
import { commentWebhook, fakeGraph } from "./fake-graph.js";

const APP_SECRET = "app-secret";
const VERIFY_TOKEN = "verify-me";

const rules = parseRules([
  { name: "price", keywords: ["fiyat"], reply: "DM'den yazıyoruz!" },
  { name: "shipping", keywords: ["kargo"], reply: "1-3 iş günü 📦" },
]);

const servers: { close: () => void }[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

async function start(options: { appSecret?: string } = {}) {
  const graph = fakeGraph();
  const instagram = new InstagramClient({ accessToken: "t", igUserId: "ig1", fetcher: graph.fetcher });
  const bot = new Bot({ rules, instagram, ownIds: ["ig1"] });
  const app = createApp({
    bot,
    verifyToken: VERIFY_TOKEN,
    appSecret: options.appSecret ?? APP_SECRET,
  });

  const server = app.listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    graph,
    url: `http://127.0.0.1:${port}`,
    settled: () => app.inflight(),
  };
}

async function post(url: string, body: unknown, secret?: string) {
  const raw = JSON.stringify(body);
  return fetch(`${url}/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-hub-signature-256": sign(raw, secret) } : {}),
    },
    body: raw,
  });
}

describe("GET /webhook", () => {
  it("echoes the challenge when the verify token matches", async () => {
    const { url } = await start();
    const response = await fetch(
      `${url}/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=12345`,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("12345");
  });

  it("refuses a wrong token", async () => {
    const { url } = await start();
    const response = await fetch(`${url}/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1`);
    expect(response.status).toBe(403);
  });
});

describe("POST /webhook", () => {
  it("answers every comment in the delivery", async () => {
    const { url, graph, settled } = await start();
    const response = await post(
      url,
      commentWebhook([
        { id: "c1", text: "fiyat?" },
        { id: "c2", text: "kargo ne zaman?" },
      ]),
      APP_SECRET,
    );

    expect(response.status).toBe(200);
    await settled();
    expect(graph.replies()).toEqual(["DM'den yazıyoruz!", "1-3 iş günü 📦"]);
  });

  it("rejects an unsigned body", async () => {
    const { url, graph, settled } = await start();
    const response = await post(url, commentWebhook([{ id: "c1", text: "fiyat?" }]));

    expect(response.status).toBe(403);
    await settled();
    expect(graph.calls).toHaveLength(0);
  });

  it("rejects a body signed with the wrong secret", async () => {
    const { url } = await start();
    const response = await post(url, commentWebhook([{ id: "c1", text: "fiyat?" }]), "not-the-secret");
    expect(response.status).toBe(403);
  });

  it("answers a Meta retry of the same delivery once", async () => {
    const { url, graph, settled } = await start();
    const body = commentWebhook([{ id: "c1", text: "fiyat?" }]);

    await post(url, body, APP_SECRET);
    await post(url, body, APP_SECRET);
    await settled();

    expect(graph.replies()).toHaveLength(1);
  });

  it("accepts an unsigned body when no app secret is configured", async () => {
    const { url, graph, settled } = await start({ appSecret: "" });
    const response = await post(url, commentWebhook([{ id: "c1", text: "fiyat?" }]));

    expect(response.status).toBe(200);
    await settled();
    expect(graph.replies()).toHaveLength(1);
  });

  it("200s a payload it has nothing to do with, so Meta stops retrying", async () => {
    const { url, graph, settled } = await start();
    const response = await post(url, { object: "instagram", entry: [{ changes: [{ field: "story_insights" }] }] }, APP_SECRET);

    expect(response.status).toBe(200);
    await settled();
    expect(graph.calls).toHaveLength(0);
  });
});

describe("GET /healthz", () => {
  it("reports whether the signature check is on", async () => {
    const { url } = await start();
    expect(await (await fetch(`${url}/healthz`)).json()).toMatchObject({ status: "ok", signatureCheck: true });
  });
});
