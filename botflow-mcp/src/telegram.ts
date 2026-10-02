/**
 * A thin Telegram Bot API client.
 *
 * `fetch` is injected rather than imported so the whole stack above this file
 * can be exercised against a fake Telegram in tests — no network, no real bot
 * token, and failure modes (429, 403 "blocked by user") reproducible on demand.
 */

export type Fetcher = typeof fetch;

export type TelegramUser = { id: number; is_bot: boolean; first_name: string; username?: string };

export type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: { id: number; first_name?: string; title?: string; username?: string };
  text?: string;
  date: number;
};

export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

/** A Telegram API error carrying enough detail to decide whether to retry. */
export class TelegramError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "TelegramError";
  }

  /** 403 means the user blocked the bot — permanent, and worth recording. */
  get isBlocked(): boolean {
    return this.code === 403;
  }

  get isRateLimited(): boolean {
    return this.code === 429;
  }
}

export type SendOptions = {
  /** Inline buttons, which come back as callback queries carrying `data`. */
  inlineButtons?: { label: string; data: string }[];
  /** Reply-keyboard buttons, which come back as ordinary text messages. */
  replyButtons?: string[];
};

export class TelegramClient {
  constructor(
    private readonly token: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly baseUrl = "https://api.telegram.org",
  ) {}

  async getMe(): Promise<TelegramUser> {
    return this.call<TelegramUser>("getMe", {});
  }

  async sendMessage(chatId: string, text: string, options: SendOptions = {}): Promise<TelegramMessage> {
    const body: Record<string, unknown> = { chat_id: chatId, text };

    if (options.inlineButtons?.length) {
      body.reply_markup = {
        // One button per row: labels are user-authored and can be long.
        inline_keyboard: options.inlineButtons.map((b) => [{ text: b.label, callback_data: b.data }]),
      };
    } else if (options.replyButtons?.length) {
      body.reply_markup = {
        keyboard: options.replyButtons.map((label) => [{ text: label }]),
        resize_keyboard: true,
        one_time_keyboard: true,
      };
    }

    return this.call<TelegramMessage>("sendMessage", body);
  }

  /** Acknowledge a button press so Telegram stops showing a loading spinner. */
  async answerCallbackQuery(id: string): Promise<void> {
    await this.call("answerCallbackQuery", { callback_query_id: id });
  }

  async getUpdates(offset: number, timeoutSeconds = 25): Promise<TelegramUpdate[]> {
    return this.call<TelegramUpdate[]>("getUpdates", {
      offset,
      timeout: timeoutSeconds,
      allowed_updates: ["message", "callback_query"],
    });
  }

  private async call<T>(method: string, body: Record<string, unknown>): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    let payload: { ok?: boolean; result?: T; description?: string; parameters?: { retry_after?: number } };
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      throw new TelegramError(`${method}: non-JSON response (HTTP ${response.status})`, response.status);
    }

    if (!payload.ok) {
      throw new TelegramError(
        `${method}: ${payload.description ?? `HTTP ${response.status}`}`,
        response.status,
        payload.parameters?.retry_after,
      );
    }
    return payload.result as T;
  }
}

/** Telegram's own token shape, checked before we bother making a request. */
export function looksLikeToken(token: string): boolean {
  return /^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token);
}
