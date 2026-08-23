import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";
import { loadSpec } from "../src/spec.js";
import type { ServerSpec } from "../src/types.js";

let spec: ServerSpec;

beforeAll(() => {
  spec = loadSpec();
});

async function connect(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({ spec, apiKey: "test-key" });
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("tools/list", () => {
  it("serves every tool in the spec", async () => {
    const client = await connect();
    const { tools } = await client.listTools();

    expect(tools).toHaveLength(spec.tools.length);
    expect(tools.map((t) => t.name).sort()).toEqual(spec.tools.map((t) => t.name).sort());
    await client.close();
  });

  it("gives every tool an object input schema", async () => {
    const client = await connect();
    const { tools } = await client.listTools();

    for (const tool of tools) {
      expect(tool.inputSchema.type, `${tool.name} input schema`).toBe("object");
    }
    await client.close();
  });
});

describe("tools/call", () => {
  it("rejects an unknown tool without crashing the connection", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "no_such_tool", arguments: {} });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Unknown tool");
    await client.close();
  });

  it("rejects arguments that violate the input schema", async () => {
    const client = await connect();
    // list_bots requires channel_id.
    const result = await client.callTool({ name: "list_bots", arguments: {} });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("channel_id");
    await client.close();
  });

  it("rejects a value of the wrong type", async () => {
    const client = await connect();
    const result = await client.callTool({
      name: "list_bots",
      arguments: { channel_id: "ch_1", limit: "twenty" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("expected integer");
    await client.close();
  });

  it("stubs a valid call with content matching the output schema", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "list_channels", arguments: {} });

    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as { channels?: unknown[] } | undefined;
    expect(Array.isArray(structured?.channels)).toBe(true);
    await client.close();
  });

  it("applies schema defaults before handing arguments to the handler", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "list_bots", arguments: { channel_id: "ch_1" } });

    // The stub echoes what it received; limit has a default of 20.
    expect(textOf(result)).toContain('"limit": 20');
    await client.close();
  });
});

function textOf(result: unknown): string {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  return content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
}
