import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import express from "express";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHttpApp } from "../src/http.js";
import { createRegistry } from "../src/handlers/index.js";
import { FileOAuthProvider, storePathFor } from "../src/oauth.js";
import type { ServerSpec } from "../src/types.js";
import { normalizeConfig, UpstreamServer, upstreamsFromEnv } from "../src/upstream.js";
import { startFakeAuthServer, type FakeAuthServer } from "./fake-oauth.js";

/**
 * OAuth against an upstream, driven end to end: a real authorization server on
 * one loopback port, a real MCP server behind a token check on another, and the
 * upstream client working its own way through discovery, registration, PKCE,
 * the token exchange and a refresh.
 *
 * The resource server is this server's own HTTP app. Its bearer check already
 * does what a protected resource does — reject an unknown token with 401 — so
 * pointing it at the set of tokens the authorization server has issued makes it
 * a genuine OAuth resource without a line of pretending.
 */
const upstreamSpec: ServerSpec = {
  source: { origin: "authored" },
  serverInfo: { name: "fake-upstream", version: "1.0.0" },
  tools: [{ name: "ping", description: "Ping.", inputSchema: { type: "object", properties: {} } }],
};

let as: FakeAuthServer;
let resource: HttpServer;
let resourceUrl: string;
let store: string;

beforeAll(async () => {
  as = await startFakeAuthServer();

  // The protected resource: RFC 9728 metadata in front, the MCP app behind, and
  // the authorization server's live token set standing in for the key list.
  const app = express();
  const metadata = (_req: express.Request, res: express.Response) => {
    res.json({ resource: resourceUrl, authorization_servers: [as.url] });
  };
  app.get("/.well-known/oauth-protected-resource", metadata);
  app.get("/.well-known/oauth-protected-resource/mcp", metadata);
  app.use(
    createHttpApp({
      spec: upstreamSpec,
      auth: { keys: as.validTokens, disabled: false },
      registry: createRegistry(),
    }),
  );

  resource = await new Promise<HttpServer>((resolvePromise, reject) => {
    const listening = app.listen(0, "127.0.0.1", () => resolvePromise(listening));
    listening.on("error", reject);
  });
  const { port } = resource.address() as AddressInfo;
  resourceUrl = `http://127.0.0.1:${port}/mcp`;

  store = mkdtempSync(join(tmpdir(), "botflow-oauth-"));
  process.env.BOTFLOW_OAUTH_STORE = store;
});

afterAll(async () => {
  delete process.env.BOTFLOW_OAUTH_STORE;
  rmSync(store, { recursive: true, force: true });
  resource.closeAllConnections();
  await new Promise<void>((resolvePromise) => resource.close(() => resolvePromise()));
  await as.close();
});

beforeEach(() => {
  as.grants.length = 0;
});

describe("client credentials", () => {
  it("gets its own token and calls the upstream with it", async () => {
    const upstream = new UpstreamServer({
      name: "cc",
      url: resourceUrl,
      oauth: { clientId: as.clientCredentials.clientId, clientSecret: as.clientCredentials.clientSecret },
      timeoutMs: 5_000,
    });

    const tools = await upstream.listTools();

    expect(tools.map((t) => t.name)).toEqual(["ping"]);
    expect(as.grants).toEqual(["client_credentials"]);
    // Nothing was registered: configured credentials are used as they are.
    expect(as.registrations).toHaveLength(0);
    expect(upstream.authMode).toBe("oauth-client-credentials");

    await upstream.close();
  });

  it("says what to check when the secret is wrong", async () => {
    const upstream = new UpstreamServer({
      name: "cc-bad",
      url: resourceUrl,
      oauth: { clientId: as.clientCredentials.clientId, clientSecret: "wrong" },
      timeoutMs: 5_000,
    });

    await expect(upstream.connect()).rejects.toThrow(/client id and secret/);
    await upstream.close();
  });
});

describe("signing in as a person", () => {
  /** What `npm run login` does, with the browser step done by fetch. */
  async function signIn(name: string): Promise<FileOAuthProvider> {
    let authorizationUrl: URL | undefined;
    const provider = new FileOAuthProvider(storePathFor(name, store), {
      redirectUrl: "http://127.0.0.1:9999/callback",
      onAuthorizationUrl: (url) => {
        authorizationUrl = url;
      },
    });

    const started = await auth(provider, { serverUrl: resourceUrl });
    expect(started).toBe("REDIRECT");
    expect(authorizationUrl).toBeDefined();

    // Stand in for the browser: follow the redirect and read the code off it.
    const response = await fetch(authorizationUrl!, { redirect: "manual" });
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const code = new URL(location!).searchParams.get("code");
    expect(code).toBeTruthy();

    const finished = await auth(provider, { serverUrl: resourceUrl, authorizationCode: code! });
    expect(finished).toBe("AUTHORIZED");
    return provider;
  }

  it("registers a client, completes PKCE, and stores a refreshable session", async () => {
    const provider = await signIn("person");

    expect(as.grants).toEqual(["authorization_code"]);
    expect(as.registrations.at(-1)?.redirect_uris).toEqual(["http://127.0.0.1:9999/callback"]);
    expect(provider.tokens()?.access_token).toMatch(/^at-/);
    expect(provider.tokens()?.refresh_token).toMatch(/^rt-/);

    // The one-time PKCE secret has done its job and is not left lying around.
    const stored = JSON.parse(readFileSync(provider.storePath, "utf8"));
    expect(stored).not.toHaveProperty("codeVerifier");
  });

  it("lets the server connect afterwards with nothing configured but the store", async () => {
    await signIn("later");
    as.grants.length = 0;

    const upstream = new UpstreamServer({ name: "later", url: resourceUrl, oauth: true, timeoutMs: 5_000 });
    const tools = await upstream.listTools();

    expect(tools.map((t) => t.name)).toEqual(["ping"]);
    // The stored access token was still good, so no grant was needed at all.
    expect(as.grants).toEqual([]);
    expect(upstream.authMode).toBe("oauth-user");

    await upstream.close();
  });

  it("refreshes an expired token by itself rather than failing the call", async () => {
    const provider = await signIn("stale");
    const refreshToken = provider.tokens()?.refresh_token;
    as.grants.length = 0;

    // Expire what we hold, the way an hour of uptime would.
    as.expireAll();

    const upstream = new UpstreamServer({ name: "stale", url: resourceUrl, oauth: true, timeoutMs: 5_000 });
    const tools = await upstream.listTools();

    expect(tools.map((t) => t.name)).toEqual(["ping"]);
    expect(as.grants).toEqual(["refresh_token"]);

    // The new token landed in the store, and the refresh token survived it.
    const stored = JSON.parse(readFileSync(storePathFor("stale", store), "utf8"));
    expect(as.validTokens.has(stored.tokens.access_token)).toBe(true);
    expect(stored.tokens.refresh_token).toBe(refreshToken);

    await upstream.close();
  });

  it("points at the login command when there is no session to use", async () => {
    const upstream = new UpstreamServer({ name: "nobody", url: resourceUrl, oauth: true, timeoutMs: 5_000 });

    await expect(upstream.connect()).rejects.toThrow(/npm run login/);

    await upstream.close();
  });
});

describe("the session file", () => {
  it("is written where only its owner can read it", async () => {
    const path = storePathFor("perms", store);
    const provider = new FileOAuthProvider(path, {});
    provider.saveTokens({ access_token: "secret", token_type: "Bearer" });

    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(readFileSync(path, "utf8")).toContain("secret");
  });

  it("survives a file that is missing or corrupt", () => {
    const provider = new FileOAuthProvider(join(store, "nothing-here.json"), {});
    expect(provider.tokens()).toBeUndefined();

    const broken = join(store, "broken.json");
    writeFileSync(broken, "{ not json");
    expect(new FileOAuthProvider(broken, {}).tokens()).toBeUndefined();
  });

  it("drops what the authorization server says is no longer good", () => {
    const path = storePathFor("invalidate", store);
    const provider = new FileOAuthProvider(path, {});
    provider.saveClientInformation({ client_id: "c" });
    provider.saveTokens({ access_token: "a", token_type: "Bearer" });

    provider.invalidateCredentials("tokens");
    expect(provider.tokens()).toBeUndefined();
    expect(provider.clientInformation()).toEqual({ client_id: "c" });

    provider.invalidateCredentials("all");
    expect(provider.clientInformation()).toBeUndefined();
  });

  it("keeps a configured client id out of the file", () => {
    const path = storePathFor("configured", store);
    const provider = new FileOAuthProvider(path, { clientId: "from-config", clientSecret: "shh" });

    expect(provider.clientInformation()).toEqual({ client_id: "from-config", client_secret: "shh" });
    expect(provider.isClientCredentials).toBe(true);
    expect(provider.redirectUrl).toBeUndefined();
    expect(provider.prepareTokenRequest()?.get("grant_type")).toBe("client_credentials");
  });

  it("leaves the grant alone when it is not doing client credentials", () => {
    const provider = new FileOAuthProvider(storePathFor("interactive", store), {
      redirectUrl: "http://127.0.0.1:1/callback",
    });

    expect(provider.isClientCredentials).toBe(false);
    expect(provider.prepareTokenRequest()).toBeUndefined();
  });
});

describe("configuration", () => {
  it("turns on OAuth when asked", () => {
    const [config] = upstreamsFromEnv({
      BOTFLOW_UPSTREAM_URL: "https://mcp.chatplace.io/mcp",
      BOTFLOW_UPSTREAM_OAUTH: "1",
    } as NodeJS.ProcessEnv);

    expect(config?.oauth).toEqual({});
  });

  it("treats a client id and secret as meaning OAuth", () => {
    const [config] = upstreamsFromEnv({
      BOTFLOW_UPSTREAM_URL: "https://mcp.chatplace.io/mcp",
      BOTFLOW_UPSTREAM_CLIENT_ID: "abc",
      BOTFLOW_UPSTREAM_CLIENT_SECRET: "shh",
      BOTFLOW_UPSTREAM_SCOPE: "read write",
    } as NodeJS.ProcessEnv);

    expect(config?.oauth).toEqual({ clientId: "abc", clientSecret: "shh", scope: "read write" });
  });

  it("leaves OAuth off by default", () => {
    const [config] = upstreamsFromEnv({
      BOTFLOW_UPSTREAM_URL: "https://mcp.chatplace.io/mcp",
      BOTFLOW_UPSTREAM_KEY: "static",
    } as NodeJS.ProcessEnv);

    expect(config?.oauth).toBeUndefined();
    expect(config?.apiKey).toBe("static");
  });

  it("refuses an upstream configured with both an API key and OAuth", () => {
    expect(() => normalizeConfig({ url: "https://a.example.com/mcp", apiKey: "k", oauth: true })).toThrow(
      /either an API key or OAuth/,
    );
  });

  it("names the session file after the upstream, not its URL", () => {
    expect(storePathFor("chat/place", "/tmp/x")).toBe("/tmp/x/chat_place.json");
  });
});
