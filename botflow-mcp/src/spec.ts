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
  if (process.env.BOTFLOW_SPEC) return process.env.BOTFLOW_SPEC;

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
        `Import one from a live server with \`npm run import-spec\`, or set BOTFLOW_SPEC.`,
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

  assertUniqueNamed(spec.prompts, "prompts", "name", path);
  assertUniqueNamed(spec.resources, "resources", "uri", path);
  assertUniqueNamed(spec.resourceTemplates, "resourceTemplates", "uriTemplate", path);

  return {
    source: spec.source ?? { origin: "authored" },
    serverInfo: spec.serverInfo,
    instructions: spec.instructions,
    tools: spec.tools,
    // Keep these absent rather than empty: presence decides which capabilities
    // the server advertises, and an empty array is not the same as "no support".
    ...(spec.prompts ? { prompts: spec.prompts } : {}),
    ...(spec.resources ? { resources: spec.resources } : {}),
    ...(spec.resourceTemplates ? { resourceTemplates: spec.resourceTemplates } : {}),
  };
}

/** Every entry must exist, carry its identifying key, and be unique on it. */
function assertUniqueNamed(
  entries: unknown,
  field: string,
  key: string,
  path: string,
): void {
  if (entries === undefined) return;
  if (!Array.isArray(entries)) throw new Error(`${path}: "${field}" must be an array.`);

  const seen = new Set<string>();
  entries.forEach((entry, i) => {
    const id = (entry as Record<string, unknown> | null)?.[key];
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`${path}: ${field}[${i}] has no "${key}".`);
    }
    if (seen.has(id)) throw new Error(`${path}: duplicate ${field} ${key} "${id}".`);
    seen.add(id);
  });
}

/**
 * Convert a captured `tools/list` result into a spec file we can serve.
 *
 * The same object may also carry `prompts`, `resources` and `resourceTemplates`
 * (that is what `scripts/probe.ts` hands over), and those are carried through so
 * an imported spec reproduces the whole advertised surface, not just the tools.
 */
export function specFromToolsList(
  toolsListResult: unknown,
  meta: {
    server?: string;
    protocolVersion?: string;
    serverInfo?: { name: string; version: string };
    instructions?: string;
  } = {},
): ServerSpec {
  const container = unwrapJsonRpc(toolsListResult) as Record<string, unknown>;
  const tools = container.tools;
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
      note: "Imported verbatim from a live server's advertised surface.",
    },
    serverInfo: meta.serverInfo ?? { name: "botflow-mcp", version: "0.1.0" },
    ...(meta.instructions ? { instructions: meta.instructions } : {}),
    tools,
    ...(container.prompts ? { prompts: container.prompts } : {}),
    ...(container.resources ? { resources: container.resources } : {}),
    ...(container.resourceTemplates ? { resourceTemplates: container.resourceTemplates } : {}),
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
