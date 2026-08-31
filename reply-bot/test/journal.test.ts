import { describe, expect, it } from "vitest";
import type { Incoming } from "../src/channels/types.js";
import { Journal } from "../src/journal.js";

const message = (over: Partial<Incoming> = {}): Incoming => ({
  channel: "instagram",
  id: "c1",
  text: "fiyat ne kadar?",
  authorId: "u1",
  username: "birisi",
  at: new Date("2026-08-31T09:00:00Z"),
  ...over,
});

describe("Journal", () => {
  it("records what was decided and whether it went out", () => {
    const journal = new Journal();
    journal.record({
      message: message(),
      action: { kind: "reply", text: "DM'den yazıyoruz", reason: "rule:fiyat" },
      sent: true,
    });

    const [entry] = journal.list();
    expect(entry).toMatchObject({
      seq: 1,
      channel: "instagram",
      from: "birisi",
      text: "fiyat ne kadar?",
      kind: "reply",
      reason: "rule:fiyat",
      reply: "DM'den yazıyoruz",
      sent: true,
    });
  });

  it("falls back to the author id when there is no username", () => {
    const journal = new Journal();
    journal.record({ message: message({ username: "" }), action: { kind: "skip", reason: "x" }, sent: false });

    expect(journal.list()[0]?.from).toBe("u1");
  });

  it("keeps the error message when a send failed", () => {
    const journal = new Journal();
    journal.record({
      message: message(),
      action: { kind: "reply", text: "hi", reason: "rule:x" },
      sent: false,
      error: new Error("Graph API 400"),
    });

    expect(journal.list()[0]?.error).toBe("Graph API 400");
  });

  it("drops the oldest once it is full", () => {
    const journal = new Journal(3);
    for (let index = 1; index <= 5; index++) {
      journal.record({ message: message({ id: `c${index}` }), action: { kind: "skip", reason: "r" }, sent: false });
    }

    expect(journal.size).toBe(3);
    expect(journal.list().map((entry) => entry.messageId)).toEqual(["c5", "c4", "c3"]);
  });

  it("lists newest first", () => {
    const journal = new Journal();
    journal.record({ message: message({ id: "a" }), action: { kind: "skip", reason: "r" }, sent: false });
    journal.record({ message: message({ id: "b" }), action: { kind: "skip", reason: "r" }, sent: false });

    expect(journal.list().map((entry) => entry.messageId)).toEqual(["b", "a"]);
  });

  it("can return only what is newer than a sequence number", () => {
    const journal = new Journal();
    journal.record({ message: message({ id: "a" }), action: { kind: "skip", reason: "r" }, sent: false });
    journal.record({ message: message({ id: "b" }), action: { kind: "skip", reason: "r" }, sent: false });

    expect(journal.list({ since: 1 }).map((entry) => entry.messageId)).toEqual(["b"]);
    expect(journal.list({ since: 2 })).toEqual([]);
  });

  it("counts sent, skipped and failed separately", () => {
    const journal = new Journal();
    journal.record({ message: message({ id: "a" }), action: { kind: "reply", text: "x", reason: "r" }, sent: true });
    journal.record({ message: message({ id: "b" }), action: { kind: "skip", reason: "r" }, sent: false });
    journal.record({
      message: message({ id: "c" }),
      action: { kind: "reply", text: "x", reason: "r" },
      sent: false,
      error: new Error("boom"),
    });

    expect(journal.summary()).toEqual({ total: 3, sent: 1, skipped: 1, failed: 1 });
  });
});
