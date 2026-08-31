/**
 * What the bot currently *is*, in one replaceable object.
 *
 * Before the panel this did not need to exist: `main` built a config, a rule
 * list, some channels and a bot, and that was the program until it was killed.
 * A panel that can turn WhatsApp on has to be able to build a WhatsApp channel
 * at 3pm on a running process, so the pieces move behind one handle and the
 * server asks for them per request instead of closing over them at boot.
 *
 * Rebuilding is all-or-nothing. If the new settings do not produce a working
 * bot — a broken rules file, a channel with no verify token — `reload` throws
 * and the previous runtime is still installed and still answering. The worst
 * outcome of a bad save is an error message in the panel, never a dead bot.
 */

import { claudeReplier, type Replier } from "./ai.js";
import { Bot } from "./bot.js";
import { instagramChannel } from "./channels/instagram.js";
import type { Channel } from "./channels/types.js";
import { whatsappChannel } from "./channels/whatsapp.js";
import { loadConfig, loadRules, missingForServe, type Config } from "./config.js";
import { Journal } from "./journal.js";
import type { Rule } from "./rules.js";
import type { SettingsStore } from "./store.js";

export type RuntimeOptions = {
  store: SettingsStore;
  journal?: Journal;
  log?: (message: string, detail?: unknown) => void;
  /** Swapped out in tests so no Anthropic client is constructed. */
  makeReplier?: (config: Config) => Replier | undefined;
  /** Swapped out in tests to avoid touching a rules file on disk. */
  readRules?: (file: string) => Rule[];
};

export type Snapshot = {
  config: Config;
  rules: Rule[];
  bot: Bot;
  channels: Channel[];
  /**
   * The model layer, when it is on. Carried on the snapshot rather than hidden
   * inside the bot so the panel's "try this message" can reuse the one client
   * instead of constructing another per keystroke.
   */
  replier?: Replier;
  /** Empty when the bot can serve; otherwise what stops it. */
  missing: string[];
  modelOn: boolean;
  at: Date;
};

export function buildChannels(config: Config): Channel[] {
  const channels: Channel[] = [];

  if (config.instagram) {
    channels.push(
      instagramChannel({
        accessToken: config.instagram.accessToken,
        igUserId: config.instagram.igUserId,
        verifyToken: config.instagram.verifyToken,
        appSecret: config.instagram.appSecret,
        path: config.instagram.path,
        baseUrl: config.instagram.graphUrl,
      }),
    );
  }
  if (config.whatsapp) {
    channels.push(
      whatsappChannel({
        accessToken: config.whatsapp.accessToken,
        phoneNumberId: config.whatsapp.phoneNumberId,
        verifyToken: config.whatsapp.verifyToken,
        appSecret: config.whatsapp.appSecret,
        path: config.whatsapp.path,
        baseUrl: config.whatsapp.graphUrl,
        windowHours: config.whatsapp.windowHours,
      }),
    );
  }
  return channels;
}

function defaultReplier(config: Config): Replier | undefined {
  return config.anthropicApiKey && config.persona
    ? claudeReplier({
        persona: config.persona,
        apiKey: config.anthropicApiKey,
        model: config.model,
        maxChars: config.maxChars,
      })
    : undefined;
}

export class Runtime {
  readonly journal: Journal;
  private readonly store: SettingsStore;
  private readonly log: (message: string, detail?: unknown) => void;
  private readonly makeReplier: (config: Config) => Replier | undefined;
  private readonly readRules: (file: string) => Rule[];
  private snapshot: Snapshot;

  constructor(options: RuntimeOptions) {
    this.store = options.store;
    this.journal = options.journal ?? new Journal();
    this.log = options.log ?? (() => {});
    this.makeReplier = options.makeReplier ?? defaultReplier;
    this.readRules = options.readRules ?? loadRules;
    this.snapshot = this.build();
  }

  get current(): Snapshot {
    return this.snapshot;
  }

  /**
   * Rebuild from whatever the store now says. Throws — leaving the running
   * snapshot untouched — if the new settings cannot produce a bot.
   */
  reload(): Snapshot {
    const next = this.build();
    this.snapshot = next;
    this.log("settings reloaded", {
      channels: next.channels.map((channel) => channel.path),
      rules: next.rules.length,
      model: next.modelOn ? next.config.model : "off",
      dryRun: next.config.dryRun,
      missing: next.missing,
    });
    return next;
  }

  /** The channel mounted at this request path, if any. */
  channelFor(path: string): Channel | undefined {
    return this.snapshot.channels.find((channel) => channel.path === path);
  }

  /** Every path a channel currently listens on — used to keep the panel clear of them. */
  paths(): string[] {
    return this.snapshot.channels.map((channel) => channel.path);
  }

  private build(): Snapshot {
    const config = loadConfig(this.store.environment());
    const rules = this.readRules(config.rulesFile);
    const replier = this.makeReplier(config);

    const bot = new Bot({
      rules,
      ...(replier ? { replier } : {}),
      dryRun: config.dryRun,
      maxChars: config.maxChars,
      log: this.log,
      onHandled: (handled) => this.journal.record(handled),
    });

    return {
      config,
      rules,
      bot,
      ...(replier ? { replier } : {}),
      channels: buildChannels(config),
      missing: missingForServe(config),
      modelOn: Boolean(replier),
      at: new Date(),
    };
  }
}
