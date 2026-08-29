import { describe, expect, it } from "vitest";
import type { Incoming } from "../src/channels/types.js";
import { parseMessages, whatsappChannel } from "../src/channels/whatsapp.js";
import { MetaError } from "../src/meta.js";
import { fakeGraph, messageWebhook, statusWebhook } from "./fake-graph.js";

function channel(fetcher: typeof fetch, windowHours = 24) {
  return whatsappChannel({
    accessToken: "token",
    phoneNumberId: "1555550000",
    verifyToken: "v",
    appSecret: "s",
    fetcher,
    baseUrl: "https://graph.test/v21.0",
    windowHours,
  });
}

const message: Incoming = {
  channel: "whatsapp",
  id: "wamid.abc",
  text: "merhaba",
  authorId: "905551112233",
  username: "Ali",
  at: new Date("2026-08-29T10:00:00Z"),
  context: "905551112233",
};

describe("parseMessages", () => {
  it("reads the message and the sender's name", () => {
    const at = new Date("2026-08-29T10:00:00Z");
    const messages = parseMessages(messageWebhook([{ id: "wamid.1", text: "fiyat?", name: "Ayşe", at }]));

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      channel: "whatsapp",
      id: "wamid.1",
      text: "fiyat?",
      username: "Ayşe",
      authorId: "905551112233",
    });
    expect(messages[0]!.at.toISOString()).toBe(at.toISOString());
  });

  it("ignores delivery receipts — answering them would never stop", () => {
    expect(parseMessages(statusWebhook())).toEqual([]);
  });

  it("skips photos, stickers and voice notes", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                messages: [
                  { from: "905551112233", id: "wamid.img", timestamp: "1700000000", type: "image", image: { id: "1" } },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(parseMessages(body)).toEqual([]);
  });

  it("reads button and list replies as text", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                messages: [
                  {
                    from: "905551112233",
                    id: "wamid.btn",
                    timestamp: "1700000000",
                    type: "interactive",
                    interactive: { button_reply: { title: "Fiyat" } },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(parseMessages(body)[0]).toMatchObject({ id: "wamid.btn", text: "Fiyat" });
  });

  it("survives a body that is not a webhook at all", () => {
    expect(parseMessages({})).toEqual([]);
    expect(parseMessages(null)).toEqual([]);
    expect(parseMessages({ entry: [{ changes: "nope" }] })).toEqual([]);
  });
});

describe("whatsapp channel", () => {
  it("can only reply — there is nothing to hide in a private chat", () => {
    expect(channel(fakeGraph().fetcher).can).toEqual({ reply: true, privateReply: false, hide: false });
  });

  it("replies as JSON with a bearer token, quoting the message", async () => {
    const graph = fakeGraph();
    await channel(graph.fetcher).send(message, "Merhaba Ali 🙂");

    const call = graph.calls[0]!;
    expect(call.path).toBe("/v21.0/1555550000/messages");
    expect(call.json).toMatchObject({
      messaging_product: "whatsapp",
      to: "905551112233",
      context: { message_id: "wamid.abc" },
      text: { body: "Merhaba Ali 🙂" },
    });
    expect(graph.whatsappTexts()).toEqual(["Merhaba Ali 🙂"]);
  });

  it("answers inside the 24-hour window", () => {
    const now = new Date(message.at.getTime() + 23 * 3600_000);
    expect(channel(fakeGraph().fetcher).refuse!(message, now)).toBeUndefined();
  });

  it("refuses outside it, because only a template would be delivered", () => {
    const now = new Date(message.at.getTime() + 25 * 3600_000);
    expect(channel(fakeGraph().fetcher).refuse!(message, now)).toMatch(/24 saat penceresi/);
  });

  it("honours a shortened window", () => {
    const now = new Date(message.at.getTime() + 2 * 3600_000);
    expect(channel(fakeGraph().fetcher, 1).refuse!(message, now)).toMatch(/penceresi kapandı/);
  });

  it("classifies an expired token the same way the other channel does", async () => {
    const graph = fakeGraph({ failOn: { path: "/messages", status: 401, code: 190, message: "expired" } });
    const error = (await channel(graph.fetcher).send(message, "hi").catch((thrown) => thrown)) as MetaError;

    expect(error).toBeInstanceOf(MetaError);
    expect(error.isAuthFailure).toBe(true);
  });
});
