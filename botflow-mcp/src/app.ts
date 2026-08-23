import { Dispatcher } from "./engine/dispatch.js";
import { FlowRunner } from "./engine/runner.js";
import { Store } from "./store/index.js";
import { TelegramClient, type Fetcher } from "./telegram.js";

/**
 * Wires the layers together and hands the tool handlers one object to reach for.
 *
 * `fetcher` and `telegramBaseUrl` are settable so the entire stack can be run
 * against a fake Telegram — that is how the end-to-end tests exercise real flow
 * execution without a network or a bot token.
 */
export type AppOptions = {
  dbPath?: string;
  fetcher?: Fetcher;
  telegramBaseUrl?: string;
};

export class App {
  readonly store: Store;
  readonly runner: FlowRunner;
  readonly dispatcher: Dispatcher;

  private readonly fetcher: Fetcher;
  private readonly telegramBaseUrl: string;
  private readonly clients = new Map<string, TelegramClient>();

  constructor(options: AppOptions = {}) {
    this.store = new Store(options.dbPath ?? process.env.BOTFLOW_DB ?? ":memory:");
    this.fetcher = options.fetcher ?? fetch;
    this.telegramBaseUrl = options.telegramBaseUrl ?? process.env.TELEGRAM_API_URL ?? "https://api.telegram.org";

    const clientFor = (botId: string) => this.clientForBot(botId);
    this.runner = new FlowRunner(this.store, clientFor);
    this.dispatcher = new Dispatcher(this.store, this.runner, clientFor);
  }

  /** A client bound to a stored bot's token, cached per bot. */
  clientForBot(botId: string): TelegramClient {
    const cached = this.clients.get(botId);
    if (cached) return cached;

    const bot = this.store.getBot(botId);
    if (!bot) throw new Error(`Unknown bot "${botId}".`);

    const client = new TelegramClient(bot.token, this.fetcher, this.telegramBaseUrl);
    this.clients.set(botId, client);
    return client;
  }

  /** A client for a token that is not stored yet, used when connecting a bot. */
  clientForToken(token: string): TelegramClient {
    return new TelegramClient(token, this.fetcher, this.telegramBaseUrl);
  }

  forgetClient(botId: string): void {
    this.clients.delete(botId);
  }

  close(): void {
    this.store.close();
  }
}
