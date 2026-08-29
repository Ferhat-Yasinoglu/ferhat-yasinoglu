/**
 * A thin Instagram Graph API client — the three calls this bot makes.
 *
 * `fetch` is injected rather than imported so the whole stack above this file
 * can be exercised against a fake Graph in tests: no network, no real access
 * token, and failure modes (rate limits, expired tokens, a comment deleted
 * between webhook and reply) reproducible on demand.
 */

export type Fetcher = typeof fetch;

/** A Graph API error carrying enough detail to decide whether to retry. */
export class InstagramError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly subcode?: number,
  ) {
    super(message);
    this.name = "InstagramError";
  }

  /** Application-level throttling: back off, the comment is still there. */
  get isRateLimited(): boolean {
    return this.status === 429 || this.code === 4 || this.code === 32 || this.code === 613;
  }

  /** The comment or media is gone — deleted between the webhook and the reply. */
  get isGone(): boolean {
    return this.status === 404 || this.code === 100;
  }

  /** The token expired or lost a permission; replies will keep failing. */
  get isAuthFailure(): boolean {
    return this.status === 401 || this.code === 190 || this.code === 10 || this.code === 200;
  }
}

export type InstagramOptions = {
  accessToken: string;
  /** The Instagram professional account id that owns the media. */
  igUserId: string;
  fetcher?: Fetcher;
  /** Override for tests, or to pin a Graph version. */
  baseUrl?: string;
};

export class InstagramClient {
  private readonly accessToken: string;
  private readonly igUserId: string;
  private readonly fetcher: Fetcher;
  private readonly baseUrl: string;

  constructor(options: InstagramOptions) {
    this.accessToken = options.accessToken;
    this.igUserId = options.igUserId;
    this.fetcher = options.fetcher ?? fetch;
    this.baseUrl = (options.baseUrl ?? "https://graph.facebook.com/v21.0").replace(/\/+$/, "");
  }

  /** Public reply, threaded under the comment. Returns the new comment id. */
  async replyToComment(commentId: string, message: string): Promise<string> {
    const result = await this.post<{ id: string }>(`/${commentId}/replies`, { message });
    return result.id;
  }

  /**
   * Private reply: a DM answering a comment. Instagram allows exactly one per
   * comment and only within 7 days of it, so a failure here is not retryable.
   */
  async sendPrivateReply(commentId: string, message: string): Promise<void> {
    await this.post(`/${this.igUserId}/messages`, {
      recipient: JSON.stringify({ comment_id: commentId }),
      message: JSON.stringify({ text: message }),
    });
  }

  /** Hide a comment instead of answering it — spam, abuse, competitor links. */
  async hideComment(commentId: string): Promise<void> {
    await this.post(`/${commentId}`, { hide: "true" });
  }

  private async post<T = unknown>(path: string, fields: Record<string, string>): Promise<T> {
    const body = new URLSearchParams({ ...fields, access_token: this.accessToken });
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });

    const text = await response.text();
    let payload: { error?: { message?: string; code?: number; error_subcode?: number } } = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      // A proxy or an outage can return HTML; the status still tells the story.
    }

    if (!response.ok || payload.error) {
      throw new InstagramError(
        payload.error?.message ?? `Graph API ${response.status} on ${path}`,
        response.status,
        payload.error?.code,
        payload.error?.error_subcode,
      );
    }
    return payload as T;
  }
}
