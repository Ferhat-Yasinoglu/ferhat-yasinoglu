/**
 * The webhooks Meta calls: for each channel a GET that proves you own the
 * endpoint and a POST carrying what people said.
 *
 * The POST answers 200 before the replies are written. Meta gives a webhook a
 * few seconds and retries anything slower — which, for a bot that sends on
 * delivery, would mean the same message answered twice. Work therefore happens
 * after the response, and `inflight` exposes it so tests (and a graceful
 * shutdown) can wait for it.
 *
 * Channels are looked up per request rather than mounted once, because the
 * panel can turn one on, change its path, or replace its credentials while the
 * process is running. A route registered at boot would still be pointing at a
 * channel that no longer exists.
 */

import express, { type Request, type Response } from "express";
import type { Bot } from "./bot.js";
import type { Channel } from "./channels/types.js";
import { verifySignature } from "./signature.js";

/** What the server needs from a runtime — implemented by `Runtime`. */
export type ChannelSource = {
  channelFor: (path: string) => Channel | undefined;
  paths: () => string[];
  current: { bot: Bot };
};

export type AppOptions = {
  source: ChannelSource;
  log?: (message: string, detail?: unknown) => void;
  /** Mounted under `panelPath` when given. */
  panel?: express.Router;
  panelPath?: string;
};

/** A source for a bot and channels that never change — the shape tests want. */
export function fixedSource(bot: Bot, channels: Channel[]): ChannelSource {
  return {
    channelFor: (path) => channels.find((channel) => channel.path === path),
    paths: () => channels.map((channel) => channel.path),
    current: { bot },
  };
}

export function createApp(options: AppOptions) {
  const { source } = options;
  const log = options.log ?? (() => {});
  const panelPath = options.panelPath ?? "/panel";
  const app = express();

  // The signature covers the bytes Meta sent, so the raw body has to survive
  // JSON parsing intact — a re-serialized object would not hash the same.
  app.use(express.json({ limit: "1mb", verify: (req, _res, buf) => ((req as RawRequest).rawBody = buf) }));

  let inflight: Promise<unknown> = Promise.resolve();

  app.get("/healthz", (_req, res) => {
    res.json({
      status: "ok",
      channels: source.paths().map((path) => {
        const channel = source.channelFor(path);
        return {
          name: channel?.name,
          webhook: path,
          signatureCheck: Boolean(channel?.appSecret),
        };
      }),
    });
  });

  // The panel is mounted ahead of the webhooks. Its prefix is fixed and the
  // panel cannot move a channel onto it, so there is nothing to shadow; doctor
  // reports the reverse case, a channel path deliberately set under /panel.
  if (options.panel) app.use(panelPath, options.panel);

  app.use((req: Request, res: Response, next: express.NextFunction) => {
    const channel = source.channelFor(req.path);
    if (!channel) {
      next();
      return;
    }

    if (req.method === "GET") {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === channel.verifyToken && typeof challenge === "string") {
        res.type("text/plain").send(challenge);
        return;
      }
      log(`${channel.name}: webhook verification rejected`, { mode, token });
      res.sendStatus(403);
      return;
    }

    if (req.method !== "POST") {
      next();
      return;
    }

    const raw = (req as RawRequest).rawBody ?? Buffer.alloc(0);
    if (channel.appSecret && !verifySignature(raw, req.header("x-hub-signature-256"), channel.appSecret)) {
      log(`${channel.name}: webhook signature rejected`);
      res.sendStatus(403);
      return;
    }

    const messages = channel.parse(req.body);
    res.sendStatus(200);

    if (!messages.length) return;
    // The bot is read from the source per delivery, so a reload between two
    // webhooks is picked up by the second one.
    const bot = source.current.bot;
    // Sequential: two messages from the same person would otherwise race for
    // the same rate limit, and there is nothing to gain from answering them
    // at once.
    inflight = inflight
      .then(async () => {
        for (const message of messages) await bot.handle(message, channel);
      })
      .catch((error) => log(`${channel.name}: webhook processing failed`, error));
  });

  return Object.assign(app, {
    /** Resolves once everything delivered so far has been handled. */
    inflight: () => inflight,
  });
}

type RawRequest = Request & { rawBody?: Buffer };
