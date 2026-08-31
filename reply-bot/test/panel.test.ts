import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Auth, CSRF_HEADER } from "../src/panel/auth.js";
import { panelRouter } from "../src/panel/routes.js";
import { Runtime } from "../src/runtime.js";
import { createApp } from "../src/server.js";
import { SettingsStore, type FileIO } from "../src/store.js";

const PASSWORD = "yeterince-uzun-sifre";
const RULES = [{ name: "fiyat", keywords: ["fiyat"], reply: "DM'den yazıyoruz" }];

const opened: { close: () => void }[] = [];
const dirs: string[] = [];

afterEach(() => {
  for (const server of opened.splice(0)) server.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function memoryIO() {
  const files = new Map<string, string>();
  const io: FileIO = {
    read: (file) => {
      const content = files.get(file);
      if (content === undefined) {
        const error = new Error("ENOENT") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return content;
    },
    write: (file, content) => void files.set(file, content),
  };
  return { io, files };
}

async function start(env: NodeJS.ProcessEnv = {}) {
  // The rules file is real, because saving rules writes one.
  const dir = mkdtempSync(join(tmpdir(), "panel-"));
  dirs.push(dir);
  const rulesFile = join(dir, "rules.json");
  writeFileSync(rulesFile, JSON.stringify(RULES));

  const { io, files } = memoryIO();
  const store = new SettingsStore({ dir, env: { ...env, BOT_RULES_FILE: rulesFile }, io });
  const runtime = new Runtime({ store, makeReplier: () => undefined });
  const auth = new Auth({ password: PASSWORD });

  const app = createApp({
    source: runtime,
    panel: panelRouter({ runtime, store, auth }),
    panelPath: "/panel",
  });
  const server = app.listen(0);
  opened.push(server);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;

  return { url: `http://127.0.0.1:${port}`, store, runtime, rulesFile, files };
}

async function login(url: string, password = PASSWORD) {
  const response = await fetch(`${url}/panel/login`, {
    method: "POST",
    headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
    body: JSON.stringify({ password }),
  });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  return { response, cookie };
}

const withCookie = (cookie: string | undefined, extra: Record<string, string> = {}) => ({
  ...(cookie ? { cookie } : {}),
  ...extra,
});

describe("panel", () => {
  it("serves the page without a session — the page itself asks for the password", async () => {
    const { url } = await start();
    const response = await fetch(`${url}/panel/`);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("reply-bot");
  });

  it("refuses the API without a session", async () => {
    const { url } = await start();
    expect((await fetch(`${url}/panel/api/state`)).status).toBe(401);
  });

  it("refuses a wrong password and accepts the right one", async () => {
    const { url } = await start();

    expect((await login(url, "yanlis")).response.status).toBe(401);

    const { response, cookie } = await login(url);
    expect(response.status).toBe(200);
    expect(cookie).toContain("reply_bot_panel=");
  });

  it("marks the session cookie httpOnly", async () => {
    const { url } = await start();
    const response = await fetch(`${url}/panel/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });

    expect(response.headers.get("set-cookie")?.toLowerCase()).toContain("httponly");
  });

  it("reads state once logged in", async () => {
    const { url } = await start({ IG_ACCESS_TOKEN: "t", IG_USER_ID: "ig1", IG_VERIFY_TOKEN: "v" });
    const { cookie } = await login(url);

    const body = await (await fetch(`${url}/panel/api/state`, { headers: withCookie(cookie) })).json();

    expect(body.channels).toEqual([{ name: "instagram", path: "/webhook/instagram" }]);
    expect(body.ruleCount).toBe(1);
    expect(body.webhooks[0]).toContain("/webhook/instagram");
  });

  it("never sends a saved secret back to the browser", async () => {
    const { url } = await start();
    const { cookie } = await login(url);

    await fetch(`${url}/panel/api/settings`, {
      method: "POST",
      headers: withCookie(cookie, { "content-type": "application/json", [CSRF_HEADER]: "1" }),
      body: JSON.stringify({ settings: { IG_ACCESS_TOKEN: "EAAG-cok-gizli-4242" } }),
    });

    const response = await fetch(`${url}/panel/api/state`, { headers: withCookie(cookie) });
    const raw = await response.text();

    expect(raw).not.toContain("EAAG-cok-gizli-4242");
    const field = JSON.parse(raw).fields.find((one: { key: string }) => one.key === "IG_ACCESS_TOKEN");
    expect(field).toMatchObject({ set: true, source: "panel", hint: "…4242" });
  });

  it("rejects a write without the panel header, even with a valid session", async () => {
    const { url, store } = await start();
    const { cookie } = await login(url);

    const response = await fetch(`${url}/panel/api/settings`, {
      method: "POST",
      headers: withCookie(cookie, { "content-type": "application/json" }),
      body: JSON.stringify({ settings: { IG_USER_ID: "sneaky" } }),
    });

    expect(response.status).toBe(403);
    expect(store.environment().IG_USER_ID).toBeUndefined();
  });

  it("turns a channel on from the browser, with no restart", async () => {
    const { url, runtime } = await start();
    const { cookie } = await login(url);
    expect(runtime.current.channels).toHaveLength(0);

    const response = await fetch(`${url}/panel/api/settings`, {
      method: "POST",
      headers: withCookie(cookie, { "content-type": "application/json", [CSRF_HEADER]: "1" }),
      body: JSON.stringify({
        settings: { WA_ACCESS_TOKEN: "t", WA_PHONE_NUMBER_ID: "p1", WA_VERIFY_TOKEN: "wa-verify" },
      }),
    });

    expect(response.status).toBe(200);
    expect(runtime.current.channels.map((channel) => channel.name)).toEqual(["whatsapp"]);

    // And the webhook it just created answers Meta's verification handshake.
    const verify = await fetch(
      `${url}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=wa-verify&hub.challenge=42`,
    );
    expect(await verify.text()).toBe("42");
  });

  it("saves rules through the API and puts them straight to work", async () => {
    const { url, runtime, rulesFile } = await start();
    const { cookie } = await login(url);

    const response = await fetch(`${url}/panel/api/rules`, {
      method: "PUT",
      headers: withCookie(cookie, { "content-type": "application/json", [CSRF_HEADER]: "1" }),
      body: JSON.stringify({ text: JSON.stringify([{ name: "kargo", keywords: ["kargo"], reply: "1-3 gün" }]) }),
    });

    expect(response.status).toBe(200);
    expect(runtime.current.rules[0]?.name).toBe("kargo");
    expect(JSON.parse(readFileSync(rulesFile, "utf8"))[0].name).toBe("kargo");
  });

  it("refuses invalid rules without touching the file", async () => {
    const { url, runtime, rulesFile } = await start();
    const { cookie } = await login(url);

    const response = await fetch(`${url}/panel/api/rules`, {
      method: "PUT",
      headers: withCookie(cookie, { "content-type": "application/json", [CSRF_HEADER]: "1" }),
      body: JSON.stringify({ text: JSON.stringify([{ name: "bos" }]) }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("keywords");
    // The bot is still answering with what it had.
    expect(runtime.current.rules[0]?.name).toBe("fiyat");
    expect(JSON.parse(readFileSync(rulesFile, "utf8"))[0].name).toBe("fiyat");
  });

  it("refuses rules that are not JSON at all", async () => {
    const { url } = await start();
    const { cookie } = await login(url);

    const response = await fetch(`${url}/panel/api/rules`, {
      method: "PUT",
      headers: withCookie(cookie, { "content-type": "application/json", [CSRF_HEADER]: "1" }),
      body: JSON.stringify({ text: "{ bu json degil" }),
    });

    expect(response.status).toBe(400);
  });

  it("answers a trial message without sending anything", async () => {
    const { url } = await start();
    const { cookie } = await login(url);

    const response = await fetch(`${url}/panel/api/try`, {
      method: "POST",
      headers: withCookie(cookie, { "content-type": "application/json", [CSRF_HEADER]: "1" }),
      body: JSON.stringify({ text: "fiyat ne kadar?", channel: "instagram" }),
    });

    expect((await response.json()).action).toMatchObject({ kind: "reply", text: "DM'den yazıyoruz" });
  });

  it("shows what the bot did in the journal", async () => {
    const { url, runtime } = await start({
      IG_ACCESS_TOKEN: "t",
      IG_USER_ID: "ig1",
      IG_VERIFY_TOKEN: "v",
      BOT_DRY_RUN: "1",
    });
    const { cookie } = await login(url);

    await runtime.current.bot.handle(
      { channel: "instagram", id: "c1", text: "fiyat?", authorId: "u1", username: "ali", at: new Date() },
      runtime.channelFor("/webhook/instagram")!,
    );

    const body = await (await fetch(`${url}/panel/api/state`, { headers: withCookie(cookie) })).json();
    expect(body.journal[0]).toMatchObject({ from: "ali", kind: "reply" });
    expect(body.summary.total).toBe(1);
  });

  it("logs out, and the cookie really stops working", async () => {
    const { url } = await start();
    const { cookie } = await login(url);
    expect((await fetch(`${url}/panel/api/state`, { headers: withCookie(cookie) })).status).toBe(200);

    const response = await fetch(`${url}/panel/logout`, {
      method: "POST",
      headers: withCookie(cookie, { [CSRF_HEADER]: "1" }),
    });
    expect(response.headers.get("set-cookie")).toContain("reply_bot_panel=;");

    // Not merely dropped by the browser: replaying the same value is refused,
    // which is what makes logging out on a borrowed laptop mean something.
    expect((await fetch(`${url}/panel/api/state`, { headers: withCookie(cookie) })).status).toBe(401);
  });

  it("keeps webhook deliveries out of the panel's way", async () => {
    const { url } = await start({ IG_ACCESS_TOKEN: "t", IG_USER_ID: "ig1", IG_VERIFY_TOKEN: "v" });

    const verify = await fetch(`${url}/webhook/instagram?hub.mode=subscribe&hub.verify_token=v&hub.challenge=7`);
    expect(await verify.text()).toBe("7");
  });
});
