import { describe, expect, it } from "vitest";
import { assertSpec, extractSseData, loadSpec, specFromToolsList } from "../src/spec.js";

const minimalTool = { name: "a", inputSchema: { type: "object" as const } };
const minimalSpec = { serverInfo: { name: "x", version: "1" }, tools: [minimalTool] };

describe("loadSpec", () => {
  it("loads the checked-in spec", () => {
    const spec = loadSpec();
    expect(spec.tools.length).toBeGreaterThan(0);
    expect(spec.serverInfo.name).toBe("chatplace-mcp");
  });
});

describe("assertSpec", () => {
  it("rejects duplicate tool names", () => {
    expect(() => assertSpec({ ...minimalSpec, tools: [minimalTool, minimalTool] })).toThrow(/duplicate/i);
  });

  it("rejects a tool with no input schema", () => {
    expect(() => assertSpec({ ...minimalSpec, tools: [{ name: "a" }] })).toThrow(/inputSchema/);
  });

  it("rejects a non-object input schema", () => {
    expect(() =>
      assertSpec({ ...minimalSpec, tools: [{ name: "a", inputSchema: { type: "string" } }] }),
    ).toThrow(/must be "object"/);
  });

  it("rejects missing serverInfo", () => {
    expect(() => assertSpec({ tools: [] })).toThrow(/serverInfo/);
  });
});

describe("specFromToolsList", () => {
  const tools = [minimalTool];

  it("accepts a full JSON-RPC envelope", () => {
    const spec = specFromToolsList({ jsonrpc: "2.0", id: 1, result: { tools } });
    expect(spec.tools).toHaveLength(1);
    expect(spec.source.origin).toBe("imported");
  });

  it("accepts a bare result object", () => {
    expect(specFromToolsList({ tools }).tools).toHaveLength(1);
  });

  it("accepts a raw JSON string", () => {
    expect(specFromToolsList(JSON.stringify({ result: { tools } })).tools).toHaveLength(1);
  });

  it("surfaces a JSON-RPC error instead of writing an empty spec", () => {
    expect(() => specFromToolsList({ jsonrpc: "2.0", id: 1, error: { code: -32001, message: "Unauthorized" } })).toThrow(
      /Unauthorized/,
    );
  });

  it("explains itself when there is no tools array", () => {
    expect(() => specFromToolsList({ result: {} })).toThrow(/tools/);
  });
});

describe("extractSseData", () => {
  it("pulls JSON out of an SSE frame", () => {
    const body = 'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"tools":[]}}\n\n';
    expect(JSON.parse(extractSseData(body))).toMatchObject({ id: 1 });
  });

  it("takes the last data frame when several are present", () => {
    const body = 'data: {"n":1}\n\ndata: {"n":2}\n\n';
    expect(JSON.parse(extractSseData(body))).toEqual({ n: 2 });
  });

  it("passes plain JSON through untouched", () => {
    expect(extractSseData('  {"n":1}  ')).toBe('{"n":1}');
  });
});
