/**
 * The bit both channels share: talking to Meta's Graph API and reading its
 * errors.
 *
 * `fetch` is injected rather than imported so the whole stack above this file
 * can be exercised against a fake Graph in tests — no network, no real token,
 * and failure modes (rate limits, an expired token, a comment deleted between
 * the webhook and the reply) reproducible on demand.
 */

export type Fetcher = typeof fetch;

/** A Graph API error carrying enough detail to decide whether to retry. */
export class MetaError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly subcode?: number,
  ) {
    super(message);
    this.name = "MetaError";
  }

  /** Application-level throttling: back off, the message is still there. */
  get isRateLimited(): boolean {
    return this.status === 429 || this.code === 4 || this.code === 32 || this.code === 613;
  }

  /** The comment or thread is gone — deleted between the webhook and the reply. */
  get isGone(): boolean {
    return this.status === 404 || this.code === 100;
  }

  /** The token expired or lost a permission; sends will keep failing. */
  get isAuthFailure(): boolean {
    return this.status === 401 || this.code === 190 || this.code === 10 || this.code === 200;
  }
}

export type GraphCall = {
  baseUrl: string;
  path: string;
  accessToken: string;
  fetcher: Fetcher;
  /**
   * How the call carries its payload. Instagram's comment endpoints take form
   * fields with the token among them; WhatsApp Cloud API takes JSON with the
   * token in an Authorization header.
   */
  form?: Record<string, string>;
  json?: unknown;
};

export async function callGraph<T = unknown>(call: GraphCall): Promise<T> {
  const url = `${call.baseUrl.replace(/\/+$/, "")}${call.path}`;
  const init: RequestInit = call.json
    ? {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${call.accessToken}` },
        body: JSON.stringify(call.json),
      }
    : {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ ...call.form, access_token: call.accessToken }),
      };

  const response = await call.fetcher(url, init);
  const text = await response.text();

  let payload: { error?: { message?: string; code?: number; error_subcode?: number } } = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    // A proxy or an outage can return HTML; the status still tells the story.
  }

  if (!response.ok || payload.error) {
    throw new MetaError(
      payload.error?.message ?? `Graph API ${response.status} on ${call.path}`,
      response.status,
      payload.error?.code,
      payload.error?.error_subcode,
    );
  }
  return payload as T;
}
