/**
 * A fake Graph API: records what the bot sent and can be told to fail the way
 * Meta fails — a deleted comment, a throttled app, an expired token.
 *
 * Instagram posts form fields, WhatsApp posts JSON; the fake reads whichever
 * arrived so both channels can be asserted the same way.
 */

export type Call = { path: string; fields: Record<string, string>; json?: Record<string, unknown> };

export type FakeGraphOptions = {
  /** Calls whose path contains this fragment fail with the given Graph error. */
  failOn?: { path: string; status: number; code?: number; message?: string };
};

export function fakeGraph(options: FakeGraphOptions = {}) {
  const calls: Call[] = [];

  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const body = String(init?.body ?? "");
    const isJson = String((init?.headers as Record<string, string>)?.["content-type"] ?? "").includes("json");

    calls.push({
      path: url.pathname,
      fields: isJson ? {} : Object.fromEntries(new URLSearchParams(body)),
      ...(isJson ? { json: JSON.parse(body) as Record<string, unknown> } : {}),
    });

    const failure = options.failOn;
    if (failure && url.pathname.includes(failure.path)) {
      return new Response(
        JSON.stringify({
          error: { message: failure.message ?? "fake failure", code: failure.code, error_subcode: 0 },
        }),
        { status: failure.status, headers: { "content-type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ id: `sent_${calls.length}` }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  return {
    fetcher,
    calls,
    /** The calls whose path contains `fragment`. */
    callsTo: (fragment: string) => calls.filter((call) => call.path.includes(fragment)),
    /** Instagram public replies, in order. */
    replies: () => calls.filter((call) => call.path.endsWith("/replies")).map((call) => call.fields.message!),
    /** WhatsApp message bodies, in order. */
    whatsappTexts: () =>
      calls
        .filter((call) => call.json?.messaging_product === "whatsapp")
        .map((call) => (call.json?.text as { body?: string })?.body ?? ""),
  };
}

/** A comment webhook body shaped like the ones Meta sends. */
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

/** A WhatsApp message webhook body, with the contact list Meta includes. */
export function messageWebhook(
  messages: { id: string; text: string; from?: string; name?: string; at?: Date }[],
  phoneNumberId = "1555550000",
) {
  const contacts = messages.map((message) => ({
    wa_id: message.from ?? "905551112233",
    profile: { name: message.name ?? "Ali" },
  }));

  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "905550000000", phone_number_id: phoneNumberId },
              contacts,
              messages: messages.map((message) => ({
                from: message.from ?? "905551112233",
                id: message.id,
                timestamp: String(Math.floor((message.at ?? new Date()).getTime() / 1000)),
                type: "text",
                text: { body: message.text },
              })),
            },
          },
        ],
      },
    ],
  };
}

/** A delivery receipt: the shape every message the bot sends comes back as. */
export function statusWebhook(messageId = "wamid.sent") {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "905550000000", phone_number_id: "1555550000" },
              statuses: [{ id: messageId, status: "delivered", timestamp: "1700000000" }],
            },
          },
        ],
      },
    ],
  };
}
