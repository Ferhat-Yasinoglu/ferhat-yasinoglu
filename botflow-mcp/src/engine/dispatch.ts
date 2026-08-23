import type { Store } from "../store/index.js";
import { containsKeyword } from "../text.js";
import type { TelegramClient, TelegramUpdate } from "../telegram.js";
import type { FlowRunner } from "./runner.js";
import type { Step } from "./steps.js";

/**
 * Turns an incoming Telegram update into flow activity.
 *
 * The precedence matters and is deliberate: an answer to a question the bot just
 * asked always wins over a trigger. Otherwise someone typing a word that happens
 * to be a keyword mid-conversation would derail their own funnel.
 */

export type DispatchOutcome =
  | { kind: "resumed"; runId: string; status: string }
  | { kind: "started"; runId: string; flowId: string; status: string }
  | { kind: "ignored"; reason: string };

export class Dispatcher {
  constructor(
    private readonly store: Store,
    private readonly runner: FlowRunner,
    private readonly clientFor: (botId: string) => TelegramClient,
  ) {}

  async handle(botId: string, update: TelegramUpdate): Promise<DispatchOutcome> {
    if (update.callback_query) return this.handleCallback(botId, update.callback_query);
    if (update.message) return this.handleMessage(botId, update.message);
    return { kind: "ignored", reason: "update carries neither a message nor a callback query" };
  }

  private async handleMessage(botId: string, message: NonNullable<TelegramUpdate["message"]>): Promise<DispatchOutcome> {
    const text = message.text?.trim() ?? "";
    if (!text) return { kind: "ignored", reason: "message has no text" };

    const chat = message.chat;
    const name = message.from?.first_name ?? chat.first_name ?? chat.title ?? "Unknown";
    const subscriber = this.store.upsertSubscriber(
      botId,
      String(chat.id),
      name,
      message.from?.username ?? chat.username ?? null,
    );
    // Contact means they are reachable again, whatever we recorded before.
    if (subscriber.blocked) this.store.setSubscriberBlocked(subscriber.id, false);
    this.store.logMessage(botId, subscriber.id, "in", text);

    const active = this.store.activeRunFor(subscriber.id);

    // A parked question takes the message as its answer.
    if (active?.waiting_for === "reply") {
      const result = await this.runner.resume(active, { kind: "reply", text });
      if (result) return { kind: "resumed", runId: result.run.id, status: result.status };
    }

    // A parked buttons step also accepts a typed label, for people who type
    // instead of tapping.
    if (active?.waiting_for === "choice") {
      const result = await this.runner.resume(active, { kind: "choice", text });
      if (result) return { kind: "resumed", runId: result.run.id, status: result.status };
    }

    return this.fireTrigger(botId, subscriber.id, text, active !== undefined);
  }

  private async handleCallback(
    botId: string,
    query: NonNullable<TelegramUpdate["callback_query"]>,
  ): Promise<DispatchOutcome> {
    // Always acknowledge, even if we cannot act, so the client stops spinning.
    await this.clientFor(botId).answerCallbackQuery(query.id).catch(() => undefined);

    const parsed = query.data ? this.runner.choiceIndexFromCallback(query.data) : null;
    if (!parsed) return { kind: "ignored", reason: "callback data is not a flow choice" };

    const run = this.store.getRun(parsed.runId);
    if (!run || run.status !== "waiting" || run.waiting_for !== "choice") {
      return { kind: "ignored", reason: "the run this button belongs to is no longer waiting" };
    }

    const label = this.runner.labelForChoice(run, parsed.index);
    if (label === null) return { kind: "ignored", reason: "choice index is out of range" };

    this.store.logMessage(botId, run.subscriber_id, "in", label);
    const result = await this.runner.resume(run, { kind: "choice", text: label });
    return result
      ? { kind: "resumed", runId: result.run.id, status: result.status }
      : { kind: "ignored", reason: "run refused the choice" };
  }

  /** Pick a published flow whose trigger matches, and start it. */
  private async fireTrigger(
    botId: string,
    subscriberId: string,
    text: string,
    hasActiveRun: boolean,
  ): Promise<DispatchOutcome> {
    const isStart = text === "/start" || text.startsWith("/start ");

    const candidates = this.store.listTriggers(botId).filter((trigger) => {
      if (trigger.flow_status !== "published") return false;
      switch (trigger.event) {
        case "start":
          return isStart;
        case "keyword": {
          const keywords = JSON.parse(trigger.keywords) as string[];
          return keywords.some((k) => containsKeyword(text, k));
        }
        case "any_message":
          // A catch-all should not interrupt a conversation already running.
          return !hasActiveRun;
        default:
          return false;
      }
    });

    // Specific beats general when several match the same message.
    const order = { start: 0, keyword: 1, any_message: 2 } as Record<string, number>;
    const chosen = candidates.sort((a, b) => (order[a.event] ?? 9) - (order[b.event] ?? 9))[0];
    if (!chosen) return { kind: "ignored", reason: "no published trigger matched" };

    const flow = this.store.getFlow(chosen.flow_id);
    if (!flow) return { kind: "ignored", reason: "trigger points at a missing flow" };

    const run = this.store.createRun(flow.id, subscriberId, JSON.parse(flow.steps) as Step[]);
    const result = await this.runner.advance(run);
    return { kind: "started", runId: result.run.id, flowId: flow.id, status: result.status };
  }
}
