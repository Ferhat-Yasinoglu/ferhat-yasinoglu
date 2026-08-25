import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { authFromEnv } from "../src/auth.js";
import { createRegistry, handlers, type Registry } from "../src/handlers/index.js";
import { startHttpServer } from "../src/http.js";
import type { ServerSpec, ToolHandler } from "../src/types.js";
import {
  attachUpstream,
  localName,
  matcherFor,
  nameFromUrl,
  normalizeConfig,
  UpstreamServer,
  UPSTREAM_META_KEY,
  upstreamsFromEnv,
} from "../src/upstream.js";

/**
 * The upstream integration, exercised against a real MCP server over a real
 * Streamable HTTP socket — the same transport `https://mcp.chatplace.io/mcp`
 * speaks. Nothing here reaches the network beyond loopback.
 *
 * The "upstream" is another instance of this server serving a small spec of its
 * own, which is enough: the point of the integration is that any surface can be
 * discovered at runtime rather than written down in advance.
 */
const UPSTREAM_KEY = "upstream-key-123";

/** Every call the fake upstream's tools received, so forwarding can be asserted. */
const calls: { tool: string; args: Record<string, unknown> }[] = [];

const upstreamSpec: ServerSpec = {
  source: { origin: "authored" },
  serverInfo: { name: "fake-upstream", version: "9.9.9", title: "Fake Upstream" },
  instructions: "Upstream instructions.",
  tools: [
    {
      name: "echo",
      title: "Echo a message",
      description: "Echoes the message back.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: "object",
        properties: {
          message: { type: "string", minLength: 1 },
          shout: { type: "boolean", default: false },
        },
        required: ["message"],
        additionalProperties: false,
      },
      outputSchema: { type: "object", properties: { echoed: { type: "string" } } },
    },
    {
      name: "boom",
      description: "Always fails.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ],
  prompts: [
    { name: "greet", description: "Greets someone.", arguments: [{ name: "who", required: true }] },
  ],
  resources: [
    { uri: "memo://notes", name: "Notes", mimeType: "text/plain", text: "upstream note" },
    { uri: "memo://notes/7", name: "Note 7", text: "note seven" },
  ],
  resourceTemplates: [{ uriTemplate: "memo://notes/{id}", name: "One note" }],
};

const echoHandler: ToolHandler = (args) => {
  calls.push({ tool: "echo", args });
  const message = String(args.message);
  const echoed = args.shout === true ? message.toUpperCase() : message;
  return { content: [{ type: "text", text: echoed }], structuredContent: { echoed } };
};

const boomHandler: ToolHandler = (args) => {
  calls.push({ tool: "boom", args });
  throw new Error("upstream exploded");
};

let upstreamHttp: HttpServer;
let upstreamUrl: string;

beforeAll(async () => {
  handlers.set("echo", echoHandler);
  handlers.set("boom", boomHandler);

  upstreamHttp = await startHttpServer({
    spec: upstreamSpec,
    auth: authFromEnv({ BOTFLOW_API_KEYS: UPSTREAM_KEY } as NodeJS.ProcessEnv),
    port: 0,
    host: "127.0.0.1",
  });
  const { port } = upstreamHttp.address() as AddressInfo;
  upstreamUrl = `http://127.0.0.1:${port}/mcp`;
});

afterAll(async () => {
  handlers.delete("echo");
  handlers.delete("boom");
  await stop(upstreamHttp);
});

/** Keep-alive sockets would hold `close` open for seconds; drop them first. */
async function stop(server: HttpServer): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

beforeEach(() => {
  calls.length = 0;
});

function connectTo(url = upstreamUrl, key: string | undefined = UPSTREAM_KEY): UpstreamServer {
  return new UpstreamServer({ name: "up", url, ...(key ? { apiKey: key } : {}), timeoutMs: 5_000 });
}

/** A stand-in for this server's own surface, fresh for each test that mutates it. */
function localSpec(tools: ServerSpec["tools"] = []): ServerSpec {
  return {
    source: { origin: "authored" },
    serverInfo: { name: "botflow-mcp", version: "0.1.0" },
    instructions: "Local instructions.",
    tools,
  };
}

describe("UpstreamServer", () => {
  it("connects and reads the upstream's tools with their schemas intact", async () => {
    const upstream = connectTo();
    const tools = await upstream.listTools();

    expect(tools.map((t) => t.name)).toEqual(["echo", "boom"]);
    const echo = tools[0]!;
    expect(echo.title).toBe("Echo a message");
    expect(echo.inputSchema.required).toEqual(["message"]);
    expect(echo.outputSchema?.properties?.echoed).toEqual({ type: "string" });
    expect(echo.annotations?.readOnlyHint).toBe(true);

    await upstream.close();
  });

  it("reports what the upstream said about itself", async () => {
    const upstream = connectTo();
    await upstream.connect();

    expect(upstream.info.serverInfo?.name).toBe("fake-upstream");
    expect(upstream.info.instructions).toBe("Upstream instructions.");
    expect(upstream.connected).toBe(true);

    await upstream.close();
  });

  it("forwards a call and returns the upstream's own result", async () => {
    const upstream = connectTo();

    const result = await upstream.callTool("echo", { message: "hello", shout: true });

    expect(result.structuredContent).toEqual({ echoed: "HELLO" });
    expect(calls).toEqual([{ tool: "echo", args: { message: "hello", shout: true } }]);

    await upstream.close();
  });

  it("shares one connection attempt between concurrent callers", async () => {
    const upstream = connectTo();

    const [a, b] = await Promise.all([
      upstream.callTool("echo", { message: "a" }),
      upstream.callTool("echo", { message: "b" }),
    ]);

    expect([a.structuredContent, b.structuredContent]).toEqual([{ echoed: "a" }, { echoed: "b" }]);

    await upstream.close();
  });

  it("reconnects after the connection has gone away", async () => {
    const upstream = connectTo();
    await upstream.callTool("echo", { message: "first" });

    await upstream.close();
    expect(upstream.connected).toBe(false);

    const result = await upstream.callTool("echo", { message: "second" });
    expect(result.structuredContent).toEqual({ echoed: "second" });

    await upstream.close();
  });

  it("survives the upstream dropping its sockets underneath a live client", async () => {
    const upstream = connectTo();
    await upstream.callTool("echo", { message: "before" });

    upstreamHttp.closeAllConnections();

    const result = await upstream.callTool("echo", { message: "after" });
    expect(result.structuredContent).toEqual({ echoed: "after" });

    await upstream.close();
  });

  it("names the server and the URL when the upstream cannot be reached", async () => {
    const dead = await startHttpServer({ spec: upstreamSpec, port: 0, host: "127.0.0.1" });
    const { port } = dead.address() as AddressInfo;
    await stop(dead);

    const upstream = new UpstreamServer({ name: "gone", url: `http://127.0.0.1:${port}/mcp`, timeoutMs: 2_000 });
    await expect(upstream.connect()).rejects.toThrow(/Could not connect to upstream "gone" at http:\/\/127\.0\.0\.1:/);
  });

  it("fails to connect when the key is wrong", async () => {
    const upstream = connectTo(upstreamUrl, "not-the-key");
    await expect(upstream.connect()).rejects.toThrow(/Could not connect to upstream/);
  });

  it("retries a failed connection on the next call rather than caching the failure", async () => {
    const upstream = connectTo(upstreamUrl, "not-the-key");
    await expect(upstream.connect()).rejects.toThrow();
    await expect(upstream.connect()).rejects.toThrow();
  });
});

describe("attachUpstream", () => {
  it("adds the upstream's tools to the local surface under a prefix", async () => {
    const spec = localSpec();
    const upstream = connectTo();
    const targets = createRegistry();

    const attachment = await attachUpstream(spec, upstream, targets);

    expect(attachment.tools).toEqual(["up_echo", "up_boom"]);
    expect(attachment.skipped).toEqual([]);
    expect(spec.tools.map((t) => t.name)).toEqual(["up_echo", "up_boom"]);
    expect([...targets.tools.keys()]).toEqual(["up_echo", "up_boom"]);

    await upstream.close();
  });

  it("records where each forwarded thing came from", async () => {
    const spec = localSpec();
    const upstream = connectTo();
    await attachUpstream(spec, upstream, createRegistry());

    expect(spec.tools[0]?._meta?.[UPSTREAM_META_KEY]).toEqual({
      server: "up",
      url: upstreamUrl,
      kind: "tool",
      name: "echo",
    });
    expect(spec.prompts?.[0]?._meta?.[UPSTREAM_META_KEY]).toMatchObject({ kind: "prompt", name: "greet" });
    expect(spec.resources?.[0]?._meta?.[UPSTREAM_META_KEY]).toMatchObject({
      kind: "resource",
      name: "memo://notes",
    });

    await upstream.close();
  });

  it("tells the model which tools are forwarded and passes the upstream's instructions on", async () => {
    const spec = localSpec();
    const upstream = connectTo();
    await attachUpstream(spec, upstream, createRegistry());

    expect(spec.instructions).toContain("Local instructions.");
    expect(spec.instructions).toContain("up_*");
    expect(spec.instructions).toContain("Fake Upstream");
    expect(spec.instructions).toContain("Upstream instructions.");

    await upstream.close();
  });

  it("never shadows a tool this server implements itself", async () => {
    const spec = localSpec([
      { name: "echo", description: "Ours.", inputSchema: { type: "object", properties: {} } },
    ]);
    const upstream = new UpstreamServer({ name: "up", url: upstreamUrl, apiKey: UPSTREAM_KEY, prefix: "" });
    const targets = createRegistry();

    const attachment = await attachUpstream(spec, upstream, targets);

    expect(attachment.tools).toEqual(["boom"]);
    expect(attachment.skipped).toContainEqual({
      kind: "tool",
      name: "echo",
      reason: '"echo" is already served here',
    });
    expect(targets.tools.has("echo")).toBe(false);
    expect(spec.tools.find((t) => t.name === "echo")?.description).toBe("Ours.");

    await upstream.close();
  });

  it("brings the prompts across under the same prefix", async () => {
    const spec = localSpec();
    const upstream = connectTo();
    const targets = createRegistry();

    const attachment = await attachUpstream(spec, upstream, targets);

    expect(attachment.prompts).toEqual(["up_greet"]);
    expect(spec.prompts?.map((p) => p.name)).toEqual(["up_greet"]);
    expect(spec.prompts?.[0]?.arguments).toEqual([{ name: "who", required: true }]);
    expect(targets.prompts.has("up_greet")).toBe(true);

    await upstream.close();
  });

  it("keeps resource URIs as they are, because a URI is already global", async () => {
    const spec = localSpec();
    const upstream = connectTo();
    const targets = createRegistry();

    const attachment = await attachUpstream(spec, upstream, targets);

    expect(attachment.resources).toEqual(["memo://notes", "memo://notes/7"]);
    expect(spec.resources?.map((r) => r.uri)).toEqual(["memo://notes", "memo://notes/7"]);
    expect(targets.resources.has("memo://notes")).toBe(true);

    await upstream.close();
  });

  it("does not keep a copy of resource content that the upstream owns", async () => {
    const spec = localSpec();
    const upstream = connectTo();
    await attachUpstream(spec, upstream, createRegistry());

    expect(spec.resources?.[0]).not.toHaveProperty("text");

    await upstream.close();
  });

  it("routes a templated URI to the upstream by its shape", async () => {
    const spec = localSpec();
    const upstream = connectTo();
    const targets = createRegistry();

    const attachment = await attachUpstream(spec, upstream, targets);

    expect(attachment.resourceTemplates).toEqual(["memo://notes/{id}"]);
    expect(targets.routers).toHaveLength(1);
    const route = targets.routers[0]!;
    expect(route.match("memo://notes/42")).toBe(true);
    expect(route.match("other://notes/42")).toBe(false);

    // The router's handler is the forwarder: what comes back is the upstream's.
    const read = await route.handler("memo://notes/7", { apiKey: null });
    expect(read.contents[0]?.text).toBe("note seven");

    await upstream.close();
  });

  it("leaves out the halves an upstream does not offer", async () => {
    const toolsOnly = await startHttpServer({
      spec: { ...upstreamSpec, prompts: undefined, resources: undefined, resourceTemplates: undefined },
      port: 0,
      host: "127.0.0.1",
    });
    const { port } = toolsOnly.address() as AddressInfo;
    const upstream = connectTo(`http://127.0.0.1:${port}/mcp`, undefined);

    const spec = localSpec();
    const attachment = await attachUpstream(spec, upstream, createRegistry());

    expect(attachment.tools).toHaveLength(2);
    expect(attachment.prompts).toEqual([]);
    // Absent, not empty: presence is what decides the capabilities we advertise.
    expect(spec.prompts).toBeUndefined();
    expect(spec.resources).toBeUndefined();
    expect(spec.resourceTemplates).toBeUndefined();

    await upstream.close();
    await stop(toolsOnly);
  });
});

describe("a server with an upstream attached", () => {
  let local: HttpServer;
  let localUrl: URL;
  let upstream: UpstreamServer;

  /**
   * Its own registry, not the process-wide one: the fake upstream is a server
   * in this same process, and sharing implementations would have each forward
   * to the other for ever.
   */
  const registry: Registry = createRegistry();

  beforeAll(async () => {
    const spec = localSpec([
      { name: "ping", description: "Local tool.", inputSchema: { type: "object", properties: {} } },
    ]);
    upstream = connectTo();
    await attachUpstream(spec, upstream, registry);

    local = await startHttpServer({
      spec,
      auth: authFromEnv({} as NodeJS.ProcessEnv),
      port: 0,
      host: "127.0.0.1",
      upstreams: [upstream],
      registry,
    });
    const { port } = local.address() as AddressInfo;
    localUrl = new URL(`http://127.0.0.1:${port}/mcp`);
  });

  afterAll(async () => {
    await upstream.close();
    await stop(local);
  });

  async function client(): Promise<Client> {
    const c = new Client({ name: "test", version: "0.0.0" });
    await c.connect(new StreamableHTTPClientTransport(localUrl));
    return c;
  }

  it("advertises local and forwarded tools side by side", async () => {
    const c = await client();
    const { tools } = await c.listTools();

    expect(tools.map((t) => t.name)).toEqual(["ping", "up_echo", "up_boom"]);
    expect(tools.find((t) => t.name === "up_echo")?.description).toBe("Echoes the message back.");

    await c.close();
  });

  it("routes a call through to the upstream and back", async () => {
    const c = await client();

    const result = await c.callTool({ name: "up_echo", arguments: { message: "through" } });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ echoed: "through" });
    // The default from the upstream's own schema was filled in before forwarding.
    expect(calls).toEqual([{ tool: "echo", args: { message: "through", shout: false } }]);

    await c.close();
  });

  it("rejects bad arguments locally, without troubling the upstream", async () => {
    const c = await client();

    const result = await c.callTool({ name: "up_echo", arguments: { shout: true } });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("is required");
    expect(calls).toEqual([]);

    await c.close();
  });

  it("surfaces an upstream failure as a tool error rather than a dead connection", async () => {
    const c = await client();

    const result = await c.callTool({ name: "up_boom", arguments: {} });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("upstream exploded");

    await c.close();
  });

  it("advertises the capabilities the upstream brought with it", async () => {
    const c = await client();
    const caps = c.getServerCapabilities();

    // The local spec had tools only; prompts and resources arrived with the upstream.
    expect(caps?.prompts).toBeDefined();
    expect(caps?.resources).toBeDefined();

    await c.close();
  });

  it("serves a forwarded prompt from the upstream, not from a local stub", async () => {
    const c = await client();

    const { prompts } = await c.listPrompts();
    expect(prompts.map((p) => p.name)).toEqual(["up_greet"]);

    const result = await c.getPrompt({ name: "up_greet", arguments: { who: "world" } });
    const text = result.messages.map((m) => (m.content as { text?: string }).text ?? "").join("\n");
    // The upstream answered under its own name for the prompt, and saw the argument.
    expect(text).toContain('Prompt "greet"');
    expect(text).not.toContain("up_greet");
    expect(text).toContain("who: world");

    await c.close();
  });

  it("refuses a forwarded prompt that is missing a required argument", async () => {
    const c = await client();
    await expect(c.getPrompt({ name: "up_greet", arguments: {} })).rejects.toThrow(/who/);
    await c.close();
  });

  it("reads a forwarded resource's content from the upstream on every read", async () => {
    const c = await client();

    const { resources } = await c.listResources();
    expect(resources.map((r) => r.uri)).toEqual(["memo://notes", "memo://notes/7"]);

    const read = await c.readResource({ uri: "memo://notes" });
    // A local answer would be the spec stub; only the upstream knows this text.
    expect(read.contents[0]?.text).toBe("upstream note");

    await c.close();
  });

  it("passes a templated read through as well", async () => {
    const c = await client();

    const { resourceTemplates } = await c.listResourceTemplates();
    expect(resourceTemplates.map((t) => t.uriTemplate)).toEqual(["memo://notes/{id}"]);

    const read = await c.readResource({ uri: "memo://notes/7" });
    expect(read.contents[0]?.text).toBe("note seven");

    await c.close();
  });

  it("reports the upstream on the health check without leaking the key", async () => {
    const res = await fetch(new URL("/healthz", localUrl));
    const body = (await res.json()) as { upstreams: { name: string; url: string; connected: boolean }[] };

    expect(body.upstreams).toEqual([{ name: "up", url: upstreamUrl, prefix: "up_", connected: true }]);
    expect(JSON.stringify(body)).not.toContain(UPSTREAM_KEY);
  });
});

describe("configuration", () => {
  it("reads a single upstream from the environment", () => {
    const configs = upstreamsFromEnv({
      BOTFLOW_UPSTREAM_URL: "https://mcp.chatplace.io/mcp",
      BOTFLOW_UPSTREAM_KEY: "secret",
    } as NodeJS.ProcessEnv);

    expect(configs).toEqual([{ name: "chatplace", url: "https://mcp.chatplace.io/mcp", apiKey: "secret" }]);
  });

  it("takes an explicit name and prefix over the derived ones", () => {
    const configs = upstreamsFromEnv({
      BOTFLOW_UPSTREAM_URL: "https://mcp.chatplace.io/mcp",
      BOTFLOW_UPSTREAM_NAME: "cp",
      BOTFLOW_UPSTREAM_PREFIX: "",
    } as NodeJS.ProcessEnv);

    expect(configs[0]).toMatchObject({ name: "cp", prefix: "" });
  });

  it("reads several upstreams from JSON", () => {
    const configs = upstreamsFromEnv({
      BOTFLOW_UPSTREAMS: JSON.stringify([
        { name: "chatplace", url: "https://mcp.chatplace.io/mcp", apiKey: "a" },
        { url: "https://mcp.example.com/mcp" },
      ]),
    } as NodeJS.ProcessEnv);

    expect(configs.map((c) => c.name)).toEqual(["chatplace", "example"]);
  });

  it("prefers the JSON form when both are set", () => {
    const configs = upstreamsFromEnv({
      BOTFLOW_UPSTREAMS: JSON.stringify([{ url: "https://mcp.example.com/mcp" }]),
      BOTFLOW_UPSTREAM_URL: "https://mcp.chatplace.io/mcp",
    } as NodeJS.ProcessEnv);

    expect(configs.map((c) => c.name)).toEqual(["example"]);
  });

  it("returns nothing when no upstream is configured", () => {
    expect(upstreamsFromEnv({} as NodeJS.ProcessEnv)).toEqual([]);
  });

  it("rejects configuration that could not work", () => {
    expect(() => upstreamsFromEnv({ BOTFLOW_UPSTREAMS: "{" } as NodeJS.ProcessEnv)).toThrow(/not valid JSON/);
    expect(() => upstreamsFromEnv({ BOTFLOW_UPSTREAMS: "{}" } as NodeJS.ProcessEnv)).toThrow(/must be a JSON array/);
    expect(() =>
      upstreamsFromEnv({
        BOTFLOW_UPSTREAMS: JSON.stringify([{ url: "https://a.example.com/mcp" }, { url: "https://a.example.com/mcp" }]),
      } as NodeJS.ProcessEnv),
    ).toThrow(/duplicate upstream name/);
    expect(() => upstreamsFromEnv({ BOTFLOW_UPSTREAM_URL: "not-a-url" } as NodeJS.ProcessEnv)).toThrow(/not a valid URL/);
    expect(() => upstreamsFromEnv({ BOTFLOW_UPSTREAM_URL: "ftp://example.com" } as NodeJS.ProcessEnv)).toThrow(
      /must be an http\(s\) URL/,
    );
    expect(() => normalizeConfig({})).toThrow(/"url" is required/);
    expect(() => normalizeConfig({ url: "https://a.example.com/mcp", timeoutMs: 0 })).toThrow(/positive number/);
  });

  it("derives a name a person would have picked", () => {
    expect(nameFromUrl(new URL("https://mcp.chatplace.io/mcp"))).toBe("chatplace");
    expect(nameFromUrl(new URL("https://api.example.co.uk/mcp"))).toBe("example");
    expect(nameFromUrl(new URL("https://example.com/mcp"))).toBe("example");
    expect(nameFromUrl(new URL("http://localhost:3000/mcp"))).toBe("localhost");
    // An address has no product name hiding in it; keeping it whole beats "127".
    expect(nameFromUrl(new URL("http://127.0.0.1:3101/mcp"))).toBe("127_0_0_1");
    expect(nameFromUrl(new URL("http://[::1]:3101/mcp"))).toBe("__1");
  });

  it("keeps namespaced names to characters a client will accept", () => {
    expect(localName("cp_", "send_message")).toBe("cp_send_message");
    expect(localName("cp_", "chat.send")).toBe("cp_chat_send");
    expect(localName("", "chat/send")).toBe("chat_send");
  });

  it("matches a URI template against the URIs it covers, and nothing else", () => {
    const match = matcherFor("notes://{user}/posts/{id}");

    expect(match("notes://ada/posts/7")).toBe(true);
    expect(match("notes://ada/posts/7/extra")).toBe(false);
    expect(match("notes://ada/posts/")).toBe(false);
    expect(match("notes://ada/drafts/7")).toBe(false);

    // The literal halves are matched literally, dots and all.
    expect(matcherFor("file://a.b/{x}")("file://axb/1")).toBe(false);
  });
});
