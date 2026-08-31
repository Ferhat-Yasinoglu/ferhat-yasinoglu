/**
 * The panel's HTTP surface: a page, a login, and a small JSON API.
 *
 * Two rules run through all of it.
 *
 * Secrets go in and never come out. A saved access token can be replaced or
 * cleared from the browser but never read back — the API answers with "set" and
 * the last four characters, which is enough to tell two tokens apart and not
 * enough to use one. That is what makes it survivable if you leave the panel
 * open on a shared screen.
 *
 * A bad save must not cost you a working bot. Settings are written, the runtime
 * is rebuilt, and only a rebuild that succeeds is installed; if the new values
 * cannot produce a bot the old one keeps answering and the panel returns the
 * reason. The same holds for rules: they are parsed before the file is touched.
 */

import { writeFileSync } from "node:fs";
import { Router, type Request, type Response } from "express";
import { Bot } from "../bot.js";
import { instagramChannel } from "../channels/instagram.js";
import type { Channel, ChannelName } from "../channels/types.js";
import { whatsappChannel } from "../channels/whatsapp.js";
import { runDoctor, webhookLines, worstStatus } from "../doctor.js";
import { parseRules } from "../rules.js";
import type { Runtime } from "../runtime.js";
import type { SettingsStore, WritableKey } from "../store.js";
import { Auth, CSRF_HEADER, readCookie, SESSION_COOKIE } from "./auth.js";
import { page } from "./page.js";

export type PanelOptions = {
  runtime: Runtime;
  store: SettingsStore;
  auth: Auth;
  /** Public base URL, when known, so the panel can print the webhook lines. */
  publicUrl?: string;
  /** Left out, the live token checks are skipped. */
  fetcher?: typeof fetch;
  log?: (message: string, detail?: unknown) => void;
};

export function panelRouter(options: PanelOptions): Router {
  const { runtime, store, auth } = options;
  const log = options.log ?? (() => {});
  const router = Router();

  const authed = (req: Request): boolean => auth.valid(readCookie(req.header("cookie"), SESSION_COOKIE));

  /** Guard for everything that reads or writes real data. */
  const guard = (req: Request, res: Response): boolean => {
    if (!authed(req)) {
      res.status(401).json({ error: "Giriş gerekiyor." });
      return false;
    }
    // Reads are safe cross-site; writes are not, and this header is the part a
    // form post from another origin cannot forge.
    if (req.method !== "GET" && req.header(CSRF_HEADER) !== "1") {
      res.status(403).json({ error: "Eksik panel başlığı." });
      return false;
    }
    return true;
  };

  router.get("/", (_req, res) => {
    res.type("html").send(page());
  });

  router.post("/login", (req, res) => {
    const address = req.ip ?? "bilinmeyen";
    const wait = auth.lockedFor(address);
    if (wait > 0) {
      res.status(429).json({ error: `Çok fazla deneme. ${Math.ceil(wait / 1000)} saniye sonra tekrar dene.` });
      return;
    }

    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const cookie = auth.login(password, address);
    if (!cookie) {
      log("panel: failed login", { address });
      res.status(401).json({ error: "Şifre yanlış." });
      return;
    }

    res.cookie(SESSION_COOKIE, cookie, {
      httpOnly: true,
      sameSite: "lax",
      // Fly terminates TLS and forwards the original scheme; on a local
      // http://localhost run this stays off so the cookie is still accepted.
      secure: req.protocol === "https" || req.header("x-forwarded-proto") === "https",
      maxAge: auth.maxAgeSeconds * 1000,
      path: "/",
    });
    res.json({ ok: true });
  });

  router.post("/logout", (req, res) => {
    if (req.header(CSRF_HEADER) !== "1") {
      res.status(403).json({ error: "Eksik panel başlığı." });
      return;
    }
    auth.revoke(readCookie(req.header("cookie"), SESSION_COOKIE));
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ ok: true });
  });

  router.get("/api/state", async (req, res) => {
    if (!guard(req, res)) return;

    const snapshot = runtime.current;
    // The live token checks cost a Graph call each, so the page asks for them
    // deliberately rather than on every poll.
    const live = req.query.live === "1" && options.fetcher;
    const checks = await runDoctor({
      config: snapshot.config,
      rules: snapshot.rules,
      ...(live && options.fetcher ? { fetcher: options.fetcher } : {}),
      ...(options.publicUrl ? { publicUrl: options.publicUrl } : {}),
    });

    res.json({
      checks,
      worst: worstStatus(checks),
      webhooks: webhookLines(snapshot.config, options.publicUrl),
      fields: store.state(),
      storeError: store.error ?? null,
      storeFile: store.file,
      missing: snapshot.missing,
      modelOn: snapshot.modelOn,
      dryRun: snapshot.config.dryRun,
      rulesFile: snapshot.config.rulesFile,
      ruleCount: snapshot.rules.length,
      channels: snapshot.channels.map((channel) => ({ name: channel.name, path: channel.path })),
      journal: runtime.journal.list({ limit: 60 }),
      summary: runtime.journal.summary(),
      reloadedAt: snapshot.at.toISOString(),
    });
  });

  router.post("/api/settings", (req, res) => {
    if (!guard(req, res)) return;

    const patch = req.body?.settings;
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      res.status(400).json({ error: "settings bir nesne olmalı." });
      return;
    }

    const before = store.environment();
    try {
      store.save(patch as Partial<Record<WritableKey, string>>);
    } catch (error) {
      res.status(500).json({ error: `Kaydedilemedi: ${(error as Error).message}` });
      return;
    }

    try {
      runtime.reload();
    } catch (error) {
      // The file now holds settings the bot cannot run with. Put back what was
      // there so the panel and the running bot agree again, then say why.
      store.save(revertTo(before, patch as Record<string, unknown>));
      res.status(400).json({ error: `Ayarlar geçersiz, geri alındı: ${(error as Error).message}` });
      return;
    }

    log("panel: settings saved", { keys: Object.keys(patch) });
    res.json({ ok: true, missing: runtime.current.missing });
  });

  router.get("/api/rules", (req, res) => {
    if (!guard(req, res)) return;
    res.json({ file: runtime.current.config.rulesFile, rules: runtime.current.rules });
  });

  router.put("/api/rules", (req, res) => {
    if (!guard(req, res)) return;

    const text = typeof req.body?.text === "string" ? req.body.text : undefined;
    if (text === undefined) {
      res.status(400).json({ error: "text alanı gerekiyor." });
      return;
    }

    // Parsed before anything is written: a rules file the bot cannot load is
    // the one failure that takes every channel down at once.
    let parsed;
    try {
      parsed = parseRules(JSON.parse(text));
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }

    const file = runtime.current.config.rulesFile;
    try {
      writeFileSync(file, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
      runtime.reload();
    } catch (error) {
      res.status(500).json({ error: `Yazılamadı: ${(error as Error).message}` });
      return;
    }

    log("panel: rules saved", { file, count: parsed.length });
    res.json({ ok: true, count: parsed.length });
  });

  router.post("/api/try", async (req, res) => {
    if (!guard(req, res)) return;

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) {
      res.status(400).json({ error: "Denenecek bir mesaj yaz." });
      return;
    }
    const channelName: ChannelName = req.body?.channel === "whatsapp" ? "whatsapp" : "instagram";
    const snapshot = runtime.current;

    // A stand-in with the real channel's capabilities and no credentials, so
    // pressing "dene" can never send anything to anyone.
    const channel: Channel =
      channelName === "whatsapp"
        ? whatsappChannel({ accessToken: "", phoneNumberId: "try", verifyToken: "", appSecret: "" })
        : instagramChannel({ accessToken: "", igUserId: "try", verifyToken: "", appSecret: "" });

    const bot = new Bot({
      rules: snapshot.rules,
      ...(snapshot.replier ? { replier: snapshot.replier } : {}),
      maxChars: snapshot.config.maxChars,
      dryRun: true,
    });

    try {
      const action = await bot.decide(
        {
          channel: channelName,
          id: `panel-${Date.now()}`,
          text,
          authorId: "panel-deneme",
          username: "birisi",
          at: new Date(),
        },
        channel,
      );
      res.json({ action });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}

/**
 * The keys a failed save touched, restored to what the environment had before
 * it. A key that came from the environment is cleared rather than rewritten, so
 * it falls back exactly as it did.
 */
function revertTo(before: NodeJS.ProcessEnv, patch: Record<string, unknown>): Record<string, string> {
  const undo: Record<string, string> = {};
  for (const key of Object.keys(patch)) undo[key] = before[key] ?? "";
  return undo;
}
