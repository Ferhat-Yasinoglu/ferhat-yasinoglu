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
 * Each channel is mounted at its own path with its own verify token and app
 * secret, so Instagram and WhatsApp can live in one Meta app or in two.
 */

import express, { type Request, type Response } from "express";
import type { Bot } from "./bot.js";
import type { Channel } from "./channels/types.js";
import { verifySignature } from "./signature.js";

export type AppOptions = {
  bot: Bot;
  channels: Channel[];
  log?: (message: string, detail?: unknown) => void;
};

export function createApp(options: AppOptions) {
  const { bot, channels } = options;
  const log = options.log ?? (() => {});
  const app = express();

  // The signature covers the bytes Meta sent, so the raw body has to survive
  // JSON parsing intact — a re-serialized object would not hash the same.
  app.use(express.json({ limit: "1mb", verify: (req, _res, buf) => ((req as RawRequest).rawBody = buf) }));

  let inflight: Promise<unknown> = Promise.resolve();

  app.get("/healthz", (_req, res) => {
    res.json({
      status: "ok",
      channels: channels.map((channel) => ({
        name: channel.name,
        webhook: channel.path,
        signatureCheck: Boolean(channel.appSecret),
      })),
    });
  });

  for (const channel of channels) {
    app.get(channel.path, (req: Request, res: Response) => {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === channel.verifyToken && typeof challenge === "string") {
        res.type("text/plain").send(challenge);
        return;
      }
      log(`${channel.name}: webhook verification rejected`, { mode, token });
      res.sendStatus(403);
    });

    app.post(channel.path, (req: Request, res: Response) => {
      const raw = (req as RawRequest).rawBody ?? Buffer.alloc(0);
      if (channel.appSecret && !verifySignature(raw, req.header("x-hub-signature-256"), channel.appSecret)) {
        log(`${channel.name}: webhook signature rejected`);
        res.sendStatus(403);
        return;
      }

      const messages = channel.parse(req.body);
      res.sendStatus(200);

      if (!messages.length) return;
      // Sequential: two messages from the same person would otherwise race for
      // the same rate limit, and there is nothing to gain from answering them
      // at once.
      inflight = inflight
        .then(async () => {
          for (const message of messages) await bot.handle(message, channel);
        })
        .catch((error) => log(`${channel.name}: webhook processing failed`, error));
    });
  }

  return Object.assign(app, {
    /** Resolves once everything delivered so far has been handled. */
    inflight: () => inflight,
  });
}

type RawRequest = Request & { rawBody?: Buffer };
