import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { assertSpec } from "../src/spec.js";
import { createServer } from "../src/server.js";
import type { ServerSpec } from "../src/types.js";

/**
 * Prompts and resources are optional halves of an MCP surface. A faithful clone
 * has to reproduce whatever upstream declares — including declaring *nothing*,
 * which is why the capability checks below matter as much as the content ones.
 */
const base = {
  serverInfo: { name: "test", version: "1" },
  tools: [{ name: "noop", inputSchema: { type: "object" as const } }],
};

async function connect(spec: ServerSpec): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({ spec });
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("capability advertisement", () => {
  it("advertises only tools when the spec has nothing else", async () => {
    const client = await connect(assertSpec(base));
    const caps = client.getServerCapabilities();

    expect(caps?.tools).toBeDefined();
    expect(caps?.prompts).toBeUndefined();
    expect(caps?.resources).toBeUndefined();
    await client.close();
  });

  it("advertises prompts once the spec declares them", async () => {
    const client = await connect(assertSpec({ ...base, prompts: [] }));
    expect(client.getServerCapabilities()?.prompts).toBeDefined();
    await client.close();
  });

  it("advertises resources when only templates are declared", async () => {
    const spec = assertSpec({ ...base, resourceTemplates: [] });
    const client = await connect(spec);
    expect(client.getServerCapabilities()?.resources).toBeDefined();
    await client.close();
  });

  it("keeps an empty declaration distinct from an absent one", () => {
    expect(assertSpec({ ...base, prompts: [] }).prompts).toEqual([]);
    expect(assertSpec(base).prompts).toBeUndefined();
  });
});

describe("prompts", () => {
  const spec = assertSpec({
    ...base,
    prompts: [
      {
        name: "welcome_funnel",
        description: "Draft a welcome funnel.",
        arguments: [
          { name: "audience", description: "Who it targets", required: true },
          { name: "tone", required: false },
        ],
      },
    ],
  });

  it("lists what the spec declares", async () => {
    const client = await connect(spec);
    const { prompts } = await client.listPrompts();

    expect(prompts).toHaveLength(1);
    expect(prompts[0]?.name).toBe("welcome_funnel");
    expect(prompts[0]?.arguments).toHaveLength(2);
    await client.close();
  });

  it("returns a stub message for a declared prompt", async () => {
    const client = await connect(spec);
    const result = await client.getPrompt({ name: "welcome_funnel", arguments: { audience: "creators" } });

    expect(result.messages[0]?.role).toBe("user");
    expect(JSON.stringify(result.messages[0]?.content)).toContain("creators");
    await client.close();
  });

  it("rejects a missing required argument", async () => {
    const client = await connect(spec);
    await expect(client.getPrompt({ name: "welcome_funnel", arguments: {} })).rejects.toThrow(/audience/);
    await client.close();
  });

  it("rejects an unknown prompt", async () => {
    const client = await connect(spec);
    await expect(client.getPrompt({ name: "nope" })).rejects.toThrow(/Unknown prompt/);
    await client.close();
  });
});

describe("resources", () => {
  const spec = assertSpec({
    ...base,
    resources: [
      { uri: "botflow://channels", name: "Channels", mimeType: "application/json", text: '{"channels":[]}' },
      { uri: "botflow://empty", name: "Empty" },
    ],
    resourceTemplates: [{ uriTemplate: "botflow://bot/{bot_id}", name: "Bot" }],
  });

  it("lists resources without leaking inline content into the listing", async () => {
    const client = await connect(spec);
    const { resources } = await client.listResources();

    expect(resources).toHaveLength(2);
    expect(resources[0]).not.toHaveProperty("text");
    expect(resources[0]?.uri).toBe("botflow://channels");
    await client.close();
  });

  it("lists resource templates", async () => {
    const client = await connect(spec);
    const { resourceTemplates } = await client.listResourceTemplates();

    expect(resourceTemplates[0]?.uriTemplate).toBe("botflow://bot/{bot_id}");
    await client.close();
  });

  it("reads inline content back", async () => {
    const client = await connect(spec);
    const { contents } = await client.readResource({ uri: "botflow://channels" });

    expect(contents[0]?.text).toBe('{"channels":[]}');
    expect(contents[0]?.mimeType).toBe("application/json");
    await client.close();
  });

  it("stubs a resource declared without content", async () => {
    const client = await connect(spec);
    const { contents } = await client.readResource({ uri: "botflow://empty" });

    expect(String(contents[0]?.text)).toContain("[stub]");
    await client.close();
  });

  it("rejects an unknown uri", async () => {
    const client = await connect(spec);
    await expect(client.readResource({ uri: "botflow://missing" })).rejects.toThrow(/Unknown resource/);
    await client.close();
  });
});

describe("spec validation of the optional halves", () => {
  it("rejects duplicate prompt names", () => {
    const prompts = [{ name: "a" }, { name: "a" }];
    expect(() => assertSpec({ ...base, prompts })).toThrow(/duplicate prompts name/);
  });

  it("rejects duplicate resource uris", () => {
    const resources = [
      { uri: "u", name: "A" },
      { uri: "u", name: "B" },
    ];
    expect(() => assertSpec({ ...base, resources })).toThrow(/duplicate resources uri/);
  });

  it("rejects a resource with no uri", () => {
    expect(() => assertSpec({ ...base, resources: [{ name: "A" }] })).toThrow(/has no "uri"/);
  });

  it("rejects a non-array declaration", () => {
    expect(() => assertSpec({ ...base, prompts: {} })).toThrow(/must be an array/);
  });
});
