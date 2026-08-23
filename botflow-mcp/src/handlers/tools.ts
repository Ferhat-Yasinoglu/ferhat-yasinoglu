import type { App } from "../app.js";
import { DEFAULT_SEND_INTERVAL_MS, describeBroadcast } from "../broadcast.js";
import { validateSteps, type Step } from "../engine/steps.js";
import { TelegramError, looksLikeToken } from "../telegram.js";
import type { ToolHandler, ToolResult } from "../types.js";
import { handlers } from "./index.js";

/**
 * The real implementations behind `spec/tools.json`.
 *
 * Each returns both a human-readable summary and `structuredContent` matching
 * the tool's declared outputSchema, so a model can either read the prose or
 * consume the fields.
 */

/** Register every tool against a live App. */
export function registerTools(app: App): void {
  for (const [name, handler] of Object.entries(build(app))) {
    handlers.set(name, handler);
  }
}

function build(app: App): Record<string, ToolHandler> {
  const store = app.store;

  /** Look up a bot or fail with a message naming what exists. */
  const requireBot = (botId: string) => {
    const bot = store.getBot(botId);
    if (!bot) {
      const known = store.listBots().map((b) => b.id);
      throw new Error(`Unknown bot "${botId}".${known.length ? ` Known bots: ${known.join(", ")}.` : " Connect one with connect_bot."}`);
    }
    return bot;
  };

  const requireFlow = (flowId: string) => {
    const flow = store.getFlow(flowId);
    if (!flow) throw new Error(`Unknown flow "${flowId}".`);
    return flow;
  };

  const requireSubscriber = (subscriberId: string) => {
    const subscriber = store.getSubscriber(subscriberId);
    if (!subscriber) throw new Error(`Unknown subscriber "${subscriberId}".`);
    return subscriber;
  };

  return {
    connect_bot: async (args) => {
      const token = String(args.token);
      if (!looksLikeToken(token)) {
        throw new Error("That does not look like a Telegram bot token. Expected the form 123456:AA... from @BotFather.");
      }

      const me = await app.clientForToken(token).getMe();
      if (!me.is_bot) throw new Error("That token belongs to a user account, not a bot.");

      const username = me.username ?? me.first_name;
      const existing = store.getBotByUsername(username);
      if (existing) {
        throw new Error(`@${username} is already connected as ${existing.id}. Disconnect it first to re-register.`);
      }

      const label = typeof args.label === "string" && args.label.trim() ? args.label.trim() : `@${username}`;
      const bot = store.createBot(token, username, label);

      return result(`Connected @${username} as ${bot.id}.`, {
        bot_id: bot.id,
        username,
        label: bot.label,
      });
    },

    list_bots: async () => {
      const bots = store.listBots().map((b) => ({
        bot_id: b.id,
        username: b.username,
        label: b.label,
        subscribers: Number(b.subscribers),
        connected_at: b.created_at,
      }));
      const summary = bots.length
        ? bots.map((b) => `${b.bot_id}  @${b.username}  ${b.subscribers} subscriber(s)`).join("\n")
        : "No bots connected yet. Use connect_bot with a token from @BotFather.";
      return result(summary, { bots });
    },

    disconnect_bot: async (args) => {
      const bot = requireBot(String(args.bot_id));
      const deleted = store.deleteBot(bot.id);
      app.forgetClient(bot.id);
      return result(
        `Disconnected @${bot.username} and deleted its flows, triggers, subscribers and history.`,
        { bot_id: bot.id, deleted },
      );
    },

    create_flow: async (args) => {
      const bot = requireBot(String(args.bot_id));
      const steps = args.steps as Step[];
      const problems = validateSteps(steps);
      if (problems.length) throw new Error(`This flow will not run:\n${problems.map((p) => `  - ${p}`).join("\n")}`);

      const flow = store.createFlow(bot.id, String(args.name), steps);
      return result(
        `Created "${flow.name}" (${flow.id}) with ${steps.length} step(s), as a draft. Publish it to make triggers fire it.`,
        { flow_id: flow.id, name: flow.name, step_count: steps.length, status: flow.status },
      );
    },

    list_flows: async (args) => {
      const bot = requireBot(String(args.bot_id));
      const status = args.status as string | undefined;
      const flows = store.listFlows(bot.id, status).map((f) => ({
        flow_id: f.id,
        name: f.name,
        status: f.status,
        step_count: (JSON.parse(f.steps) as Step[]).length,
        active_runs: Number(f.active_runs),
      }));
      const summary = flows.length
        ? flows.map((f) => `${f.flow_id}  ${f.name}  [${f.status}]  ${f.step_count} steps, ${f.active_runs} active`).join("\n")
        : "No flows yet.";
      return result(summary, { flows });
    },

    get_flow: async (args) => {
      const flow = requireFlow(String(args.flow_id));
      const steps = JSON.parse(flow.steps) as Step[];
      return result(`${flow.name} [${flow.status}], ${steps.length} step(s).`, {
        flow_id: flow.id,
        name: flow.name,
        status: flow.status,
        steps,
      });
    },

    update_flow: async (args) => {
      const flow = requireFlow(String(args.flow_id));
      if (args.steps !== undefined) {
        const problems = validateSteps(args.steps);
        if (problems.length) throw new Error(`This flow will not run:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
      }

      const updated = store.updateFlow(flow.id, {
        name: args.name as string | undefined,
        steps: args.steps,
      });
      if (!updated) throw new Error(`Flow "${flow.id}" disappeared while updating.`);

      const stepCount = (JSON.parse(updated.steps) as Step[]).length;
      return result(
        `Updated "${updated.name}". It is back to draft — publish it again. Runs already in progress keep the version they started on.`,
        { flow_id: updated.id, status: updated.status, step_count: stepCount },
      );
    },

    publish_flow: async (args) => {
      const flow = requireFlow(String(args.flow_id));
      const published = store.publishFlow(flow.id);
      return result(`Published "${flow.name}". Triggers pointing at it will now fire.`, {
        flow_id: flow.id,
        status: published?.status ?? "published",
        published_at: published?.published_at ?? undefined,
      });
    },

    delete_flow: async (args) => {
      const flow = requireFlow(String(args.flow_id));
      const deleted = store.deleteFlow(flow.id);
      return result(`Deleted "${flow.name}", its triggers and any in-progress runs.`, {
        flow_id: flow.id,
        deleted,
      });
    },

    set_trigger: async (args) => {
      const flow = requireFlow(String(args.flow_id));
      const event = String(args.event);
      const keywords = (args.keywords as string[] | undefined) ?? [];

      if (event === "keyword" && keywords.length === 0) {
        throw new Error("A keyword trigger needs at least one keyword.");
      }
      if (event !== "keyword" && keywords.length > 0) {
        throw new Error(`Keywords only apply to keyword triggers, not "${event}".`);
      }

      const trigger = store.createTrigger(flow.bot_id, flow.id, event, keywords);
      const note = flow.status === "published" ? "" : ` Note: "${flow.name}" is still a draft, so this will not fire until you publish it.`;
      return result(
        `Trigger ${trigger.id} set: ${describeTrigger(event, keywords)} runs "${flow.name}".${note}`,
        { trigger_id: trigger.id, event, active: flow.status === "published" },
      );
    },

    list_triggers: async (args) => {
      const bot = requireBot(String(args.bot_id));
      const triggers = store.listTriggers(bot.id).map((t) => ({
        trigger_id: t.id,
        flow_id: t.flow_id,
        flow_name: t.flow_name,
        event: t.event,
        keywords: JSON.parse(t.keywords) as string[],
      }));
      const summary = triggers.length
        ? triggers.map((t) => `${t.trigger_id}  ${describeTrigger(t.event, t.keywords)} -> ${t.flow_name}`).join("\n")
        : "No triggers yet.";
      return result(summary, { triggers });
    },

    delete_trigger: async (args) => {
      const id = String(args.trigger_id);
      const deleted = store.deleteTrigger(id);
      if (!deleted) throw new Error(`Unknown trigger "${id}".`);
      return result(`Deleted trigger ${id}. The flow itself is untouched.`, { trigger_id: id, deleted });
    },

    start_flow: async (args) => {
      const flow = requireFlow(String(args.flow_id));
      const subscriber = requireSubscriber(String(args.subscriber_id));

      if (flow.status !== "published") throw new Error(`"${flow.name}" is a draft. Publish it before running it.`);
      if (subscriber.bot_id !== flow.bot_id) throw new Error("That subscriber belongs to a different bot.");

      const run = store.createRun(flow.id, subscriber.id, JSON.parse(flow.steps) as Step[]);
      const outcome = await app.runner.advance(run);
      return result(
        `Ran "${flow.name}" for ${subscriber.name}: ${outcome.stepsExecuted} step(s), now ${outcome.status}.`,
        { run_id: outcome.run.id, status: outcome.status, steps_executed: outcome.stepsExecuted },
      );
    },

    send_message: async (args) => {
      const subscriber = requireSubscriber(String(args.subscriber_id));
      const text = String(args.text);
      const buttons = args.buttons as string[] | undefined;

      try {
        const sent = await app.clientForBot(subscriber.bot_id).sendMessage(subscriber.chat_id, text, {
          ...(buttons?.length ? { replyButtons: buttons } : {}),
        });
        store.logMessage(subscriber.bot_id, subscriber.id, "out", text);
        return result(`Sent to ${subscriber.name}.`, {
          message_id: String(sent.message_id),
          delivered: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof TelegramError && error.isBlocked) {
          store.setSubscriberBlocked(subscriber.id, true);
        }
        return result(`Could not send to ${subscriber.name}: ${message}`, { delivered: false, error: message });
      }
    },

    broadcast: async (args) => {
      const bot = requireBot(String(args.bot_id));
      const text = String(args.text);
      const tags = (args.tags as string[] | undefined) ?? [];

      const recipients = store.segment(bot.id, tags).filter((s) => !s.blocked);

      if (args.dry_run === true) {
        return result(`${recipients.length} subscriber(s) would receive this. Nothing was sent.`, {
          recipients: recipients.length,
          status: "dry_run",
          sent: 0,
          failed: 0,
        });
      }
      if (recipients.length === 0) {
        throw new Error(
          tags.length ? `No unblocked subscriber carries all of: ${tags.join(", ")}.` : "This bot has no reachable subscribers yet.",
        );
      }

      // Queued rather than sent inline: delivery is paced to Telegram's limits,
      // so a large list takes minutes and must not hold this call open.
      const broadcast = store.createBroadcast(bot.id, text, tags, recipients.length);
      app.broadcasts.start(broadcast.id);

      const estimate = Math.ceil((recipients.length * DEFAULT_SEND_INTERVAL_MS) / 1000);
      return result(
        `Queued ${broadcast.id} to ${recipients.length} subscriber(s); roughly ${estimate}s at Telegram's rate limit. ` +
          `Check progress with get_broadcast.`,
        describeBroadcast(store.getBroadcast(broadcast.id)!),
      );
    },

    get_broadcast: async (args) => {
      const id = String(args.broadcast_id);
      const broadcast = store.getBroadcast(id);
      if (!broadcast) throw new Error(`Unknown broadcast "${id}".`);

      const pct = broadcast.recipients > 0 ? Math.round((broadcast.cursor / broadcast.recipients) * 100) : 100;
      return result(
        `${broadcast.id} is ${broadcast.status}: ${broadcast.sent} sent, ${broadcast.failed} failed, ` +
          `${broadcast.cursor}/${broadcast.recipients} processed (${pct}%).`,
        describeBroadcast(broadcast),
      );
    },

    list_broadcasts: async (args) => {
      const bot = requireBot(String(args.bot_id));
      const broadcasts = store.listBroadcasts(bot.id, Number(args.limit ?? 20)).map(describeBroadcast);
      const summary = broadcasts.length
        ? broadcasts.map((b) => `${b.broadcast_id}  [${b.status}]  ${b.sent} sent, ${b.failed} failed`).join("\n")
        : "No broadcasts yet.";
      return result(summary, { broadcasts });
    },

    list_subscribers: async (args) => {
      const bot = requireBot(String(args.bot_id));
      const tag = args.tag as string | undefined;
      const limit = Number(args.limit ?? 50);
      const offset = Number(args.offset ?? 0);

      const rows = store.listSubscribers(bot.id, tag, limit, offset);
      const subscribers = rows.map((s) => ({
        subscriber_id: s.id,
        name: s.name,
        username: s.username ?? undefined,
        tags: store.getTags(s.id),
        blocked: s.blocked === 1,
        subscribed_at: s.created_at,
      }));
      const total = store.countSubscribers(bot.id, tag);
      const summary = subscribers.length
        ? `${subscribers.length} of ${total}:\n` +
          subscribers.map((s) => `${s.subscriber_id}  ${s.name}${s.tags.length ? `  [${s.tags.join(", ")}]` : ""}`).join("\n")
        : "No subscribers match.";
      return result(summary, { subscribers, total });
    },

    tag_subscriber: async (args) => {
      const subscriber = requireSubscriber(String(args.subscriber_id));
      const add = (args.add as string[] | undefined) ?? [];
      const remove = (args.remove as string[] | undefined) ?? [];
      if (add.length === 0 && remove.length === 0) throw new Error("Pass tags to add, to remove, or both.");

      if (add.length) store.addTags(subscriber.id, add);
      if (remove.length) store.removeTags(subscriber.id, remove);

      const tags = store.getTags(subscriber.id);
      return result(`${subscriber.name} now has: ${tags.length ? tags.join(", ") : "(no tags)"}.`, {
        subscriber_id: subscriber.id,
        tags,
      });
    },

    get_analytics: async (args) => {
      const bot = requireBot(String(args.bot_id));
      const days = Number(args.days ?? 30);
      const since = new Date(Date.now() - days * 86400_000).toISOString();

      const payload = {
        window_days: days,
        subscribers_total: store.countSubscribers(bot.id),
        subscribers_new: store.countNewSubscribers(bot.id, since),
        messages_in: store.countMessages(bot.id, "in", since),
        messages_out: store.countMessages(bot.id, "out", since),
        runs_started: store.countRuns(bot.id, since),
        runs_completed: store.countRuns(bot.id, since, "finished"),
        flows: store.runStatsByFlow(bot.id, since),
      };

      const summary = [
        `Last ${days} day(s) for @${bot.username}:`,
        `  subscribers: ${payload.subscribers_total} total, ${payload.subscribers_new} new`,
        `  messages:    ${payload.messages_in} in, ${payload.messages_out} out`,
        `  flow runs:   ${payload.runs_started} started, ${payload.runs_completed} completed`,
        ...payload.flows.map((f) => `    ${f.name}: ${f.started} started, ${f.completed} completed`),
      ].join("\n");

      return result(summary, payload);
    },
  };
}

function describeTrigger(event: string, keywords: string[]): string {
  if (event === "keyword") return `keyword(${keywords.join(", ")})`;
  return event;
}

function result(text: string, structured: Record<string, unknown>): ToolResult {
  return { content: [{ type: "text", text }], structuredContent: structured };
}

