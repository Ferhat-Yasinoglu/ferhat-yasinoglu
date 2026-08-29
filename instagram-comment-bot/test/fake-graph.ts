/**
 * A fake Graph API: records what the bot posted and can be told to fail the way
 * Instagram fails — a deleted comment, a throttled app, an expired token.
 */

export type Call = { path: string; fields: Record<string, string> };

export type FakeGraphOptions = {
  /** Replies matching this path fragment fail with the given Graph error. */
  failOn?: { path: string; status: number; code?: number; message?: string };
};

export function fakeGraph(options: FakeGraphOptions = {}) {
  const calls: Call[] = [];

  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const fields = Object.fromEntries(new URLSearchParams(String(init?.body)));
    calls.push({ path: url.pathname, fields });

    const failure = options.failOn;
    if (failure && url.pathname.includes(failure.path)) {
      return new Response(
        JSON.stringify({
          error: { message: failure.message ?? "fake failure", code: failure.code, error_subcode: 0 },
        }),
        { status: failure.status, headers: { "content-type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ id: `posted_${calls.length}` }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  return {
    fetcher,
    calls,
    /** Fields of the calls whose path contains `fragment`. */
    callsTo: (fragment: string) => calls.filter((call) => call.path.includes(fragment)),
    /** Public replies, in order. */
    replies: () => calls.filter((call) => call.path.endsWith("/replies")).map((call) => call.fields.message!),
  };
}

/** A webhook body shaped like the ones Meta sends. */
export function commentWebhook(
  comments: { id: string; text: string; fromId?: string; username?: string }[],
  igUserId = "17841400000000000",
) {
  return {
    object: "instagram",
    entry: [
      {
        id: igUserId,
        time: 1700000000,
        changes: comments.map((comment) => ({
          field: "comments",
          value: {
            id: comment.id,
            text: comment.text,
            from: { id: comment.fromId ?? "9001", username: comment.username ?? "musteri" },
            media: { id: "17900000000000000", media_product_type: "FEED" },
          },
        })),
      },
    ],
  };
}
