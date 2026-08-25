import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { authFromEnv } from "../src/auth.js";
import { handlers } from "../src/handlers/index.js";
import { startHttpServer } from "../src/http.js";
import type { ServerSpec, ToolHandler } from "../src/types.js";
import {
  attachUpstream,
  localName,
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
    const handlerMap = new Map<string, ToolHandler>();

    const { added, skipped } = await attachUpstream(spec, upstream, handlerMap);

    expect(added).toEqual(["up_echo", "up_boom"]);
    expect(skipped).toEqual([]);
    expect(spec.tools.map((t) => t.name)).toEqual(["up_echo", "up_boom"]);
    expect([...handlerMap.keys()]).toEqual(["up_echo", "up_boom"]);

    await upstream.close();
  });

  it("records where each forwarded tool came from", async () => {
    const spec = localSpec();
    const upstream = connectTo();
    await attachUpstream(spec, upstream, new Map());

    expect(spec.tools[0]?._meta?.[UPSTREAM_META_KEY]).toEqual({
      server: "up",
      url: upstreamUrl,
      tool: "echo",
    });

    await upstream.close();
  });

  it("tells the model which tools are forwarded and passes the upstream's instructions on", async () => {
    const spec = localSpec();
    const upstream = connectTo();
    await attachUpstream(spec, upstream, new Map());

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
    const handlerMap = new Map<string, ToolHandler>();

    const { added, skipped } = await attachUpstream(spec, upstream, handlerMap);

    expect(added).toEqual(["boom"]);
    expect(skipped).toEqual([{ tool: "echo", reason: '"echo" is already served here' }]);
    expect(handlerMap.has("echo")).toBe(false);
    expect(spec.tools.find((t) => t.name === "echo")?.description).toBe("Ours.");

    await upstream.close();
  });
});

describe("a server with an upstream attached", () => {
  let local: HttpServer;
  let localUrl: URL;
  let upstream: UpstreamServer;

  beforeAll(async () => {
    const spec = localSpec([
      { name: "ping", description: "Local tool.", inputSchema: { type: "object", properties: {} } },
    ]);
    upstream = connectTo();
    await attachUpstream(spec, upstream, handlers);

    local = await startHttpServer({ spec, auth: authFromEnv({} as NodeJS.ProcessEnv), port: 0, host: "127.0.0.1", upstreams: [upstream] });
    const { port } = local.address() as AddressInfo;
    localUrl = new URL(`http://127.0.0.1:${port}/mcp`);
  });

  afterAll(async () => {
    handlers.delete("up_echo");
    handlers.delete("up_boom");
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
});
