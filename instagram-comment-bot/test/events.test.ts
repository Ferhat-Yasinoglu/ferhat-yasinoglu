import { describe, expect, it } from "vitest";
import { parseComments } from "../src/events.js";
import { commentWebhook } from "./fake-graph.js";

describe("parseComments", () => {
  it("flattens every comment in a delivery", () => {
    const events = parseComments(
      commentWebhook([
        { id: "c1", text: "fiyat?" },
        { id: "c2", text: "kargo?", username: "ali" },
      ]),
    );

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ commentId: "c1", text: "fiyat?", username: "musteri" });
    expect(events[1]).toMatchObject({ commentId: "c2", username: "ali", mediaId: "17900000000000000" });
  });

  it("keeps the parent id of a threaded reply", () => {
    const events = parseComments({
      entry: [
        {
          changes: [
            {
              field: "comments",
              value: { id: "c3", text: "teşekkürler", from: { id: "9", username: "a" }, parent_id: "c1" },
            },
          ],
        },
      ],
    });
    expect(events[0]?.parentId).toBe("c1");
  });

  it("ignores fields the bot does not answer", () => {
    const events = parseComments({
      entry: [{ changes: [{ field: "mentions", value: { id: "m1", text: "hi", from: { id: "9" } } }] }],
    });
    expect(events).toEqual([]);
  });

  it("drops comments with no text or no author rather than throwing", () => {
    const events = parseComments({
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
    expect(events).toEqual([]);
  });

  it("survives a body that is not a webhook at all", () => {
    expect(parseComments({})).toEqual([]);
    expect(parseComments(null)).toEqual([]);
    expect(parseComments("garbage")).toEqual([]);
    expect(parseComments({ entry: [{ changes: "nope" }] })).toEqual([]);
  });
});
