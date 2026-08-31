import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { Bot } from "../src/bot.js";
import { instagramChannel } from "../src/channels/instagram.js";
import { whatsappChannel } from "../src/channels/whatsapp.js";
import { parseRules } from "../src/rules.js";
import { createApp, fixedSource } from "../src/server.js";
import { sign } from "../src/signature.js";
import { commentWebhook, fakeGraph, messageWebhook } from "./fake-graph.js";

const IG_SECRET = "ig-secret";
const WA_SECRET = "wa-secret";
const IG_TOKEN = "ig-verify";
const WA_TOKEN = "wa-verify";

const rules = parseRules([
  { name: "price", keywords: ["fiyat"], reply: "DM'den yazıyoruz!" },
  { name: "shipping", keywords: ["kargo"], reply: "1-3 iş günü 📦" },
]);

const servers: { close: () => void }[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

async function start(options: { igSecret?: string } = {}) {
  const graph = fakeGraph();
  const channels = [
    instagramChannel({
      accessToken: "t",
      igUserId: "ig1",
      verifyToken: IG_TOKEN,
      appSecret: options.igSecret ?? IG_SECRET,
      fetcher: graph.fetcher,
    }),
    whatsappChannel({
      accessToken: "t",
      phoneNumberId: "p1",
      verifyToken: WA_TOKEN,
      appSecret: WA_SECRET,
      fetcher: graph.fetcher,
    }),
  ];

  const app = createApp({ source: fixedSource(new Bot({ rules }), channels) });
  const server = app.listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;

  return { graph, url: `http://127.0.0.1:${port}`, settled: () => app.inflight() };
}

async function post(url: string, path: string, body: unknown, secret?: string) {
  const raw = JSON.stringify(body);
  return fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-hub-signature-256": sign(raw, secret) } : {}),
    },
    body: raw,
  });
}

describe("webhook verification", () => {
  it("echoes each channel's challenge for its own token", async () => {
    const { url } = await start();

    const ig = await fetch(`${url}/webhook/instagram?hub.mode=subscribe&hub.verify_token=${IG_TOKEN}&hub.challenge=11`);
    const wa = await fetch(`${url}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=${WA_TOKEN}&hub.challenge=22`);

    expect(await ig.text()).toBe("11");
    expect(await wa.text()).toBe("22");
  });

  it("does not accept one channel's token on the other's path", async () => {
    const { url } = await start();
    const response = await fetch(
      `${url}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=${IG_TOKEN}&hub.challenge=1`,
    );
    expect(response.status).toBe(403);
  });
});

describe("deliveries", () => {
  it("answers comments on the Instagram path", async () => {
    const { url, graph, settled } = await start();
    const response = await post(
      url,
      "/webhook/instagram",
      commentWebhook([
        { id: "c1", text: "fiyat?" },
        { id: "c2", text: "kargo ne zaman?" },
      ]),
      IG_SECRET,
    );

    expect(response.status).toBe(200);
    await settled();
    expect(graph.replies()).toEqual(["DM'den yazıyoruz!", "1-3 iş günü 📦"]);
  });

  it("answers messages on the WhatsApp path", async () => {
    const { url, graph, settled } = await start();
    const response = await post(
      url,
      "/webhook/whatsapp",
      messageWebhook([{ id: "wamid.1", text: "fiyat ne kadar?" }]),
      WA_SECRET,
    );

    expect(response.status).toBe(200);
    await settled();
    expect(graph.whatsappTexts()).toEqual(["DM'den yazıyoruz!"]);
  });

  it("checks each path against its own app secret", async () => {
    const { url, graph, settled } = await start();

    const crossed = await post(url, "/webhook/whatsapp", messageWebhook([{ id: "w1", text: "fiyat?" }]), IG_SECRET);
    expect(crossed.status).toBe(403);

    const unsigned = await post(url, "/webhook/instagram", commentWebhook([{ id: "c1", text: "fiyat?" }]));
    expect(unsigned.status).toBe(403);

    await settled();
    expect(graph.calls).toHaveLength(0);
  });

  it("answers a Meta retry of the same delivery once", async () => {
    const { url, graph, settled } = await start();
    const body = commentWebhook([{ id: "c1", text: "fiyat?" }]);

    await post(url, "/webhook/instagram", body, IG_SECRET);
    await post(url, "/webhook/instagram", body, IG_SECRET);
    await settled();

    expect(graph.replies()).toHaveLength(1);
  });

  it("accepts an unsigned body when that channel has no app secret", async () => {
    const { url, graph, settled } = await start({ igSecret: "" });
    const response = await post(url, "/webhook/instagram", commentWebhook([{ id: "c1", text: "fiyat?" }]));

    expect(response.status).toBe(200);
    await settled();
    expect(graph.replies()).toHaveLength(1);
  });

  it("200s a payload it has nothing to do with, so Meta stops retrying", async () => {
    const { url, graph, settled } = await start();
    const response = await post(
      url,
      "/webhook/instagram",
      { object: "instagram", entry: [{ changes: [{ field: "story_insights" }] }] },
      IG_SECRET,
    );

    expect(response.status).toBe(200);
    await settled();
    expect(graph.calls).toHaveLength(0);
  });
});

describe("GET /healthz", () => {
  it("lists every mounted channel", async () => {
    const { url } = await start();
    const body = await (await fetch(`${url}/healthz`)).json();

    expect(body.status).toBe("ok");
    expect(body.channels).toEqual([
      { name: "instagram", webhook: "/webhook/instagram", signatureCheck: true },
      { name: "whatsapp", webhook: "/webhook/whatsapp", signatureCheck: true },
    ]);
  });
});
