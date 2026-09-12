import type { Fetcher, TelegramUpdate } from "../src/telegram.js";

/**
 * An in-memory stand-in for the Telegram Bot API.
 *
 * It implements the four methods this project calls, records everything sent,
 * and can be told to fail in the ways that matter — a user blocking the bot, a
 * rate limit, a revoked token. That makes the whole stack testable end to end
 * with no network and no real bot.
 */

export type SentMessage = {
  chatId: string;
  text: string;
  inlineButtons?: { text: string; callback_data: string }[];
  replyButtons?: string[];
};

export class FakeTelegram {
  readonly sent: SentMessage[] = [];
  readonly acknowledgedCallbacks: string[] = [];

  private readonly updates: TelegramUpdate[] = [];
  private readonly blocked = new Set<string>();
  private nextMessageId = 1000;
  private nextUpdateId = 1;
  private failure?: { code: number; description: string; retryAfter?: number; times: number };

  /** Bot identity returned by getMe, keyed by token prefix. */
  username = "test_bot";

  /** Queue an inbound text message from a user. */
  receiveText(chatId: string, text: string, from?: { first_name?: string; username?: string }): TelegramUpdate {
    const update: TelegramUpdate = {
      update_id: this.nextUpdateId++,
      message: {
        message_id: this.nextMessageId++,
        from: {
          id: Number(chatId),
          is_bot: false,
          first_name: from?.first_name ?? "Tester",
          ...(from?.username ? { username: from.username } : {}),
        },
        chat: { id: Number(chatId), first_name: from?.first_name ?? "Tester" },
        text,
        date: Math.floor(Date.now() / 1000),
      },
    };
    this.updates.push(update);
    return update;
  }

  /** Queue a button press carrying the callback payload the bot sent earlier. */
  pressButton(chatId: string, callbackData: string): TelegramUpdate {
    const update: TelegramUpdate = {
      update_id: this.nextUpdateId++,
      callback_query: {
        id: `cb_${this.nextUpdateId}`,
        from: { id: Number(chatId), is_bot: false, first_name: "Tester" },
        data: callbackData,
      },
    };
    this.updates.push(update);
    return update;
  }

  /** The callback payload of the Nth inline button of the last sent message. */
  lastInlineButtonData(index: number): string {
    const last = this.sent[this.sent.length - 1];
    const button = last?.inlineButtons?.[index];
    if (!button) throw new Error(`Last sent message has no inline button at index ${index}.`);
    return button.callback_data;
  }

  /** Make every send to this chat fail as if the user blocked the bot. */
  blockChat(chatId: string): void {
    this.blocked.add(chatId);
  }

  /** Undo blockChat, the way a person unblocking the bot would. */
  unblockChat(chatId: string): void {
    this.blocked.delete(chatId);
  }

  failNext(code: number, description: string, options: { retryAfter?: number; times?: number } = {}): void {
    this.failure = { code, description, retryAfter: options.retryAfter, times: options.times ?? 1 };
  }

  sentTo(chatId: string): string[] {
    return this.sent.filter((m) => m.chatId === chatId).map((m) => m.text);
  }

  get fetcher(): Fetcher {
    return (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = url.split("/").pop() ?? "";
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};

      if (this.failure && this.failure.times > 0) {
        this.failure.times -= 1;
        const { code, description, retryAfter } = this.failure;
        if (this.failure.times === 0) this.failure = undefined;
        return this.error(code, description, retryAfter);
      }

      switch (method) {
        case "getMe":
          return this.ok({ id: 42, is_bot: true, first_name: "Test Bot", username: this.username });

        case "sendMessage": {
          const chatId = String(body.chat_id);
          if (this.blocked.has(chatId)) {
            return this.error(403, "Forbidden: bot was blocked by the user");
          }
          const markup = body.reply_markup as
            | { inline_keyboard?: { text: string; callback_data: string }[][]; keyboard?: { text: string }[][] }
            | undefined;

          this.sent.push({
            chatId,
            text: String(body.text),
            ...(markup?.inline_keyboard ? { inlineButtons: markup.inline_keyboard.flat() } : {}),
            ...(markup?.keyboard ? { replyButtons: markup.keyboard.flat().map((k) => k.text) } : {}),
          });
          return this.ok({ message_id: this.nextMessageId++, chat: { id: Number(chatId) }, date: 0 });
        }

        case "getUpdates": {
          const offset = Number(body.offset ?? 0);
          const pending = this.updates.filter((u) => u.update_id >= offset);
          return this.ok(pending);
        }

        case "answerCallbackQuery":
          this.acknowledgedCallbacks.push(String(body.callback_query_id));
          return this.ok(true);

        default:
          return this.error(404, `Unknown method ${method}`);
      }
    }) as Fetcher;
  }

  private ok(result: unknown): Response {
    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  private error(code: number, description: string, retryAfter?: number): Response {
    return new Response(
      JSON.stringify({
        ok: false,
        error_code: code,
        description,
        // Explicit undefined check: retry_after of 0 is meaningful (retry now),
        // and a truthiness test would drop it.
        ...(retryAfter !== undefined ? { parameters: { retry_after: retryAfter } } : {}),
      }),
      { status: code, headers: { "Content-Type": "application/json" } },
    );
  }
}

/** A token shaped the way Telegram issues them, for tests that need a valid one. */
export const VALID_TOKEN = "123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw0";
