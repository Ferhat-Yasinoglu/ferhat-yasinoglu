import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { AddressInfo } from "node:net";
import type { Server as HttpServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authFromEnv } from "../src/auth.js";
import { startHttpServer } from "../src/http.js";
import { loadSpec, specFromToolsList } from "../src/spec.js";
import type { ToolSpec } from "../src/types.js";

/**
 * Exercises the real transport a hosted connector uses: Streamable HTTP over a
 * listening socket, with the bearer-token check in front of it.
 */
const API_KEY = "test-key-abc";

let server: HttpServer;
let url: URL;

beforeAll(async () => {
  server = await startHttpServer({
    spec: loadSpec(),
    auth: authFromEnv({ CHATPLACE_API_KEYS: API_KEY } as NodeJS.ProcessEnv),
    port: 0,
    host: "127.0.0.1",
  });
  const { port } = server.address() as AddressInfo;
  url = new URL(`http://127.0.0.1:${port}/mcp`);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function transportWith(key?: string): StreamableHTTPClientTransport {
  return new StreamableHTTPClientTransport(url, {
    requestInit: key ? { headers: { Authorization: `Bearer ${key}` } } : undefined,
  });
}

describe("streamable http endpoint", () => {
  it("completes the handshake and lists tools with a valid key", async () => {
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(transportWith(API_KEY));

    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.map((t) => t.name)).toContain("list_channels");

    await client.close();
  });

  it("reports server info from the spec", async () => {
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(transportWith(API_KEY));

    expect(client.getServerVersion()?.name).toBe("chatplace-mcp");

    await client.close();
  });

  it("calls a tool end to end", async () => {
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(transportWith(API_KEY));

    const result = await client.callTool({ name: "list_channels", arguments: { platform: "instagram" } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toHaveProperty("channels");

    await client.close();
  });

  it("refuses the handshake without a key", async () => {
    const client = new Client({ name: "test", version: "0.0.0" });
    await expect(client.connect(transportWith())).rejects.toThrow();
  });

  it("refuses the handshake with a wrong key", async () => {
    const client = new Client({ name: "test", version: "0.0.0" });
    await expect(client.connect(transportWith("nope"))).rejects.toThrow();
  });

  it("serves a health check without auth", async () => {
    const res = await fetch(new URL("/healthz", url));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "ok", authRequired: true });
  });
});

describe("spec round-trip", () => {
  /**
   * The core guarantee: probing this server reproduces the spec it was given.
   * If that holds against ourselves, then probing the real ChatPlace server and
   * serving the result reproduces *its* surface too.
   */
  it("reproduces the served spec exactly when probed", async () => {
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(transportWith(API_KEY));

    const { tools } = await client.listTools();
    const reimported = specFromToolsList({ tools }, { server: url.toString() });
    await client.close();

    expect(normalize(reimported.tools)).toEqual(normalize(loadSpec().tools));
  });

  it("marks a probed spec as imported rather than placeholder", async () => {
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(transportWith(API_KEY));
    const { tools } = await client.listTools();
    await client.close();

    expect(specFromToolsList({ tools }).source.origin).toBe("imported");
  });
});

/** Key order and the implicit `inputSchema.type` are not part of the surface. */
function normalize(tools: ToolSpec[]): Record<string, ToolSpec> {
  return Object.fromEntries(
    tools.map((tool) => [tool.name, { ...tool, inputSchema: { type: "object", ...tool.inputSchema } }]),
  );
}
