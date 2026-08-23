import { existsSync, readFileSync } from "node:fs";
import { dirname, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ServerSpec, ToolSpec } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Locate `spec/tools.json` by walking up from this module.
 *
 * The depth differs by how we were started — `src/` under tsx, `dist/src/`
 * after a build — so searching upward is more reliable than a fixed `../..`.
 */
export function defaultSpecPath(): string {
  if (process.env.CHATPLACE_SPEC) return process.env.CHATPLACE_SPEC;

  const root = parse(here).root;
  for (let dir = here; ; dir = dirname(dir)) {
    const candidate = resolve(dir, "spec", "tools.json");
    if (existsSync(candidate)) return candidate;
    if (dir === root) break;
  }
  // Nothing found; return the conventional location so the error names it.
  return resolve(here, "..", "spec", "tools.json");
}

export function loadSpec(path: string = defaultSpecPath()): ServerSpec {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (cause) {
    throw new Error(
      `Could not read the tool spec at ${path}. ` +
        `Import one from a live server with \`npm run import-spec\`, or set CHATPLACE_SPEC.`,
      { cause },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`${path} is not valid JSON.`, { cause });
  }

  return assertSpec(parsed, path);
}

export function assertSpec(value: unknown, path = "spec"): ServerSpec {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${path}: expected an object at the top level.`);
  }
  const spec = value as Partial<ServerSpec>;

  if (!Array.isArray(spec.tools)) {
    throw new Error(`${path}: missing a "tools" array.`);
  }
  if (!spec.serverInfo?.name || !spec.serverInfo?.version) {
    throw new Error(`${path}: "serverInfo" needs both a name and a version.`);
  }

  const seen = new Set<string>();
  spec.tools.forEach((tool: ToolSpec, i: number) => {
    if (!tool?.name) throw new Error(`${path}: tools[${i}] has no name.`);
    if (seen.has(tool.name)) throw new Error(`${path}: duplicate tool name "${tool.name}".`);
    seen.add(tool.name);
    if (!tool.inputSchema || typeof tool.inputSchema !== "object") {
      throw new Error(`${path}: tool "${tool.name}" has no inputSchema.`);
    }
    // MCP requires the top-level input schema to be an object schema.
    if (tool.inputSchema.type !== undefined && tool.inputSchema.type !== "object") {
      throw new Error(`${path}: tool "${tool.name}" inputSchema.type must be "object".`);
    }
  });

  return {
    source: spec.source ?? { origin: "placeholder" },
    serverInfo: spec.serverInfo,
    instructions: spec.instructions,
    tools: spec.tools,
  };
}

/** Convert a raw `tools/list` result into a spec file we can serve. */
export function specFromToolsList(
  toolsListResult: unknown,
  meta: { server?: string; protocolVersion?: string; serverInfo?: { name: string; version: string } } = {},
): ServerSpec {
  const container = unwrapJsonRpc(toolsListResult);
  const tools = (container as { tools?: ToolSpec[] }).tools;
  if (!Array.isArray(tools)) {
    throw new Error(
      'Could not find a "tools" array. Pass either the full JSON-RPC response to tools/list, ' +
        'its "result" object, or a bare {"tools":[...]} object.',
    );
  }

  return assertSpec({
    source: {
      origin: "imported",
      server: meta.server,
      protocolVersion: meta.protocolVersion,
      importedAt: new Date().toISOString(),
      note: "Imported verbatim from a live tools/list response.",
    },
    serverInfo: meta.serverInfo ?? { name: "chatplace-mcp", version: "0.1.0" },
    tools,
  });
}

/** Accept a JSON-RPC envelope, a bare result, or an SSE-wrapped payload. */
function unwrapJsonRpc(value: unknown): unknown {
  if (typeof value === "string") return unwrapJsonRpc(JSON.parse(extractSseData(value)));
  if (typeof value !== "object" || value === null) return value;
  const obj = value as Record<string, unknown>;
  if (obj.error) {
    const err = obj.error as { code?: number; message?: string };
    throw new Error(`Server returned a JSON-RPC error ${err.code ?? ""}: ${err.message ?? "unknown"}`);
  }
  if (obj.result && typeof obj.result === "object") return obj.result;
  return obj;
}

/**
 * Streamable HTTP servers may answer with `text/event-stream`. Pull the JSON out
 * of the last `data:` line so a copy-pasted curl response still imports.
 */
export function extractSseData(body: string): string {
  const trimmed = body.trim();
  if (!trimmed.startsWith("event:") && !trimmed.startsWith("data:")) return trimmed;
  const payloads = trimmed
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim());
  if (payloads.length === 0) return trimmed;
  return payloads[payloads.length - 1]!;
}
