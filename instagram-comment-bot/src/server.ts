/**
 * The webhook Meta calls: a GET that proves you own the endpoint, and a POST
 * carrying comments.
 *
 * The POST answers 200 before the replies are written. Meta gives a webhook a
 * few seconds and retries anything slower — which, for a bot that posts on
 * delivery, would mean the same comment answered twice. Work therefore happens
 * after the response, and `inflight` exposes it so tests (and a graceful
 * shutdown) can wait for it.
 */

import express, { type Request, type Response } from "express";
import type { Bot } from "./bot.js";
import { parseComments } from "./events.js";
import { verifySignature } from "./signature.js";

export type AppOptions = {
  bot: Bot;
  /** The string you type into "Verify token" in the Meta app dashboard. */
  verifyToken: string;
  /** App secret for `X-Hub-Signature-256`. Empty disables the check — local only. */
  appSecret?: string;
  path?: string;
  log?: (message: string, detail?: unknown) => void;
};

export function createApp(options: AppOptions) {
  const { bot, verifyToken, appSecret = "", path = "/webhook" } = options;
  const log = options.log ?? (() => {});
  const app = express();

  // The signature covers the bytes Meta sent, so the raw body has to survive
  // JSON parsing intact — a re-serialized object would not hash the same.
  app.use(express.json({ limit: "1mb", verify: (req, _res, buf) => ((req as RawRequest).rawBody = buf) }));

  let inflight: Promise<unknown> = Promise.resolve();

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok", webhook: path, signatureCheck: Boolean(appSecret) });
  });

  app.get(path, (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === verifyToken && typeof challenge === "string") {
      res.type("text/plain").send(challenge);
      return;
    }
    log("webhook verification rejected", { mode, token });
    res.sendStatus(403);
  });

  app.post(path, (req: Request, res: Response) => {
    const raw = (req as RawRequest).rawBody ?? Buffer.alloc(0);
    if (appSecret && !verifySignature(raw, req.header("x-hub-signature-256"), appSecret)) {
      log("webhook signature rejected");
      res.sendStatus(403);
      return;
    }

    const events = parseComments(req.body);
    res.sendStatus(200);

    if (!events.length) return;
    // Sequential: two comments on the same post would otherwise race for the
    // same rate limit, and there is nothing to gain from answering them at once.
    inflight = inflight
      .then(async () => {
        for (const event of events) await bot.handle(event);
      })
      .catch((error) => log("webhook processing failed", error));
  });

  return Object.assign(app, {
    /** Resolves once every comment delivered so far has been handled. */
    inflight: () => inflight,
  });
}

type RawRequest = Request & { rawBody?: Buffer };
