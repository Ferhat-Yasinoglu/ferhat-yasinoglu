import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { handlers as defaultHandlers } from "./handlers/index.js";
import type { ServerSpec, ToolHandler, ToolResult, ToolSpec } from "./types.js";

/**
 * Speak MCP as a *client* to another MCP server and republish its tools as ours.
 *
 * This is the other direction from `scripts/probe.ts`: probe copies a surface
 * into `spec/tools.json` once, at build time. Here the surface is discovered at
 * startup and the calls are forwarded live, so a remote connector such as
 * `https://mcp.chatplace.io/mcp` becomes part of the tool list this server
 * advertises without anyone writing its schemas down first.
 *
 *   BOTFLOW_UPSTREAM_URL=https://mcp.chatplace.io/mcp BOTFLOW_UPSTREAM_KEY=… npm start
 *
 * Upstream tools are namespaced (`chatplace_send_message`) so they can never
 * collide with, or quietly shadow, a tool this server implements itself.
 */

const CLIENT_INFO = { name: "botflow-mcp", version: "0.1.0" };

/** Where an upstream tool came from, carried in `_meta` so callers can see it. */
export const UPSTREAM_META_KEY = "botflow/upstream";

export type UpstreamConfig = {
  /** Short handle for this server. Used in logs and, by default, as the prefix. */
  name: string;
  url: string;
  /** Sent as `Authorization: Bearer`. Omit for a server that needs no auth. */
  apiKey?: string;
  /** Tool-name prefix. Defaults to `<name>_`; an empty string disables it. */
  prefix?: string;
  /** Per-request timeout in milliseconds, including the handshake. */
  timeoutMs?: number;
};

export type UpstreamInfo = {
  serverInfo?: { name: string; version: string; title?: string };
  instructions?: string;
};

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * A lazily-connected client for one upstream server.
 *
 * The connection is opened on first use and reopened if it drops: a hosted
 * connector will close idle streams, and a tool call that arrives an hour later
 * should reconnect rather than fail. Concurrent callers share one attempt.
 */
export class UpstreamServer {
  readonly name: string;
  readonly url: string;
  readonly prefix: string;

  #apiKey: string | undefined;
  #timeoutMs: number;
  #client: Client | null = null;
  #connecting: Promise<Client> | null = null;
  #info: UpstreamInfo = {};

  constructor(config: UpstreamConfig) {
    this.name = config.name;
    this.url = config.url;
    this.prefix = config.prefix ?? `${config.name}_`;
    this.#apiKey = config.apiKey;
    this.#timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** What the upstream said about itself during the handshake. */
  get info(): UpstreamInfo {
    return this.#info;
  }

  get connected(): boolean {
    return this.#client !== null;
  }

  async connect(): Promise<void> {
    await this.#connected();
  }

  /** The upstream's advertised tools, in its own naming, unmodified. */
  async listTools(): Promise<ToolSpec[]> {
    const client = await this.#connected();
    const { tools } = await client.listTools(undefined, { timeout: this.#timeoutMs });
    return tools.map((tool) => ({
      name: tool.name,
      ...(tool.title ? { title: tool.title } : {}),
      ...(tool.description ? { description: tool.description } : {}),
      inputSchema: tool.inputSchema as ToolSpec["inputSchema"],
      ...(tool.outputSchema ? { outputSchema: tool.outputSchema as ToolSpec["outputSchema"] } : {}),
      ...(tool.annotations ? { annotations: tool.annotations as ToolSpec["annotations"] } : {}),
      ...(tool._meta ? { _meta: tool._meta } : {}),
    }));
  }

  /**
   * Forward one call, retrying once if the connection had gone away.
   *
   * An `McpError` means the upstream answered and refused — a bad argument, an
   * unknown tool — so it is returned as-is. A connection we thought was open
   * failing is worth one reconnect. A connection that never opened is not: that
   * would only spend the timeout twice on a server that is plainly down.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const wasOpen = this.connected;
    try {
      return await this.#call(name, args);
    } catch (cause) {
      if (cause instanceof McpError || !wasOpen) throw cause;
      this.#drop();
      return await this.#call(name, args);
    }
  }

  async close(): Promise<void> {
    const client = this.#client;
    this.#client = null;
    if (client) await client.close();
  }

  async #call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const client = await this.#connected();
    const result = await client.callTool({ name, arguments: args }, undefined, {
      timeout: this.#timeoutMs,
    });
    // Passed through verbatim. The SDK's result type is wider than ours (audio
    // and resource_link content), and re-shaping it here would lose whatever the
    // upstream meant to say.
    return result as unknown as ToolResult;
  }

  #connected(): Promise<Client> {
    const open = this.#client;
    if (open) return Promise.resolve(open);

    this.#connecting ??= this.#open().finally(() => {
      this.#connecting = null;
    });
    return this.#connecting;
  }

  async #open(): Promise<Client> {
    const transport = new StreamableHTTPClientTransport(new URL(this.url), {
      requestInit: this.#apiKey ? { headers: { Authorization: `Bearer ${this.#apiKey}` } } : undefined,
    });
    const client = new Client(CLIENT_INFO);
    // A dropped stream must not leave a dead client cached for the next call.
    client.onclose = () => {
      if (this.#client === client) this.#client = null;
    };

    try {
      await client.connect(transport, { timeout: this.#timeoutMs });
    } catch (cause) {
      await client.close().catch(() => {});
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`Could not connect to upstream "${this.name}" at ${this.url}: ${message}`, { cause });
    }

    const serverInfo = client.getServerVersion();
    const instructions = client.getInstructions();
    this.#info = {
      ...(serverInfo ? { serverInfo: serverInfo as UpstreamInfo["serverInfo"] } : {}),
      ...(instructions ? { instructions } : {}),
    };
    this.#client = client;
    return client;
  }

  #drop(): void {
    const client = this.#client;
    this.#client = null;
    void client?.close().catch(() => {});
  }
}

export type UpstreamAttachment = {
  upstream: UpstreamServer;
  /** Local names now served on the upstream's behalf. */
  added: string[];
  /** Upstream tools left out, and why. */
  skipped: { tool: string; reason: string }[];
};

/**
 * Discover an upstream's tools and splice them into the surface we serve.
 *
 * The spec is data, so adding tools is a push and a handler registration —
 * `createServer` reads `spec.tools` on every request and picks them up. Call
 * this at startup, before the first request is served.
 *
 * Arguments reach the forwarding handler already validated against the
 * upstream's own `inputSchema` and with its defaults applied, because that is
 * what the local surface now promises callers.
 */
export async function attachUpstream(
  spec: ServerSpec,
  upstream: UpstreamServer,
  handlers: Map<string, ToolHandler> = defaultHandlers,
): Promise<UpstreamAttachment> {
  const tools = await upstream.listTools();
  const taken = new Set(spec.tools.map((tool) => tool.name));

  const added: string[] = [];
  const skipped: { tool: string; reason: string }[] = [];

  for (const tool of tools) {
    const local = localName(upstream.prefix, tool.name);
    if (taken.has(local)) {
      // Never shadow a local tool: the caller asked for ours, they get ours.
      skipped.push({ tool: tool.name, reason: `"${local}" is already served here` });
      continue;
    }

    spec.tools.push({
      ...tool,
      name: local,
      _meta: {
        ...tool._meta,
        [UPSTREAM_META_KEY]: { server: upstream.name, url: upstream.url, tool: tool.name },
      },
    });
    handlers.set(local, forwarder(upstream, tool.name));
    taken.add(local);
    added.push(local);
  }

  if (added.length > 0) spec.instructions = withUpstreamNote(spec.instructions, upstream, added.length);

  return { upstream, added, skipped };
}

function forwarder(upstream: UpstreamServer, remoteName: string): ToolHandler {
  return (args) => upstream.callTool(remoteName, args);
}

/**
 * Namespace a tool name, keeping it to the characters MCP clients accept.
 *
 * Anything else becomes `_`, so a dotted or slashed upstream name still arrives
 * as something a model can address.
 */
export function localName(prefix: string, remoteName: string): string {
  return sanitize(`${prefix}${remoteName}`);
}

function sanitize(name: string): string {
  return name.replace(/[^A-Za-z0-9_-]/g, "_");
}

function withUpstreamNote(instructions: string | undefined, upstream: UpstreamServer, count: number): string {
  const label = upstream.info.serverInfo?.title ?? upstream.info.serverInfo?.name ?? upstream.name;
  const note = [
    upstream.prefix
      ? `The ${count} tools named ${upstream.prefix}* are served by ${label} (${upstream.url}) and forwarded there.`
      : `${count} of the tools here are served by ${label} (${upstream.url}) and forwarded there.`,
    upstream.info.instructions,
  ]
    .filter(Boolean)
    .join(" ");

  return [instructions, note].filter(Boolean).join("\n\n");
}

/**
 * Read upstream configuration from the environment.
 *
 * One server, the common case:
 *
 *   BOTFLOW_UPSTREAM_URL=https://mcp.chatplace.io/mcp
 *   BOTFLOW_UPSTREAM_KEY=…                 # optional
 *   BOTFLOW_UPSTREAM_NAME=chatplace        # optional, else derived from the host
 *   BOTFLOW_UPSTREAM_PREFIX=cp_            # optional, else "<name>_"
 *
 * Several, as a JSON array — this wins outright when set:
 *
 *   BOTFLOW_UPSTREAMS='[{"name":"chatplace","url":"https://mcp.chatplace.io/mcp","apiKey":"…"}]'
 */
export function upstreamsFromEnv(env: NodeJS.ProcessEnv = process.env): UpstreamConfig[] {
  const json = env.BOTFLOW_UPSTREAMS?.trim();
  if (json) return parseUpstreams(json);

  const url = env.BOTFLOW_UPSTREAM_URL?.trim();
  if (!url) return [];

  return [
    normalizeConfig({
      name: env.BOTFLOW_UPSTREAM_NAME?.trim() || undefined,
      url,
      apiKey: env.BOTFLOW_UPSTREAM_KEY?.trim() || undefined,
      prefix: env.BOTFLOW_UPSTREAM_PREFIX,
      timeoutMs: env.BOTFLOW_UPSTREAM_TIMEOUT_MS ? Number(env.BOTFLOW_UPSTREAM_TIMEOUT_MS) : undefined,
    }),
  ];
}

function parseUpstreams(json: string): UpstreamConfig[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (cause) {
    throw new Error("BOTFLOW_UPSTREAMS is not valid JSON.", { cause });
  }
  if (!Array.isArray(parsed)) {
    throw new Error('BOTFLOW_UPSTREAMS must be a JSON array, like [{"name":"…","url":"…"}].');
  }

  const configs = parsed.map((entry, i) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`BOTFLOW_UPSTREAMS[${i}] must be an object.`);
    }
    return normalizeConfig(entry as Partial<UpstreamConfig>, `BOTFLOW_UPSTREAMS[${i}]`);
  });

  const seen = new Set<string>();
  for (const config of configs) {
    if (seen.has(config.name)) throw new Error(`BOTFLOW_UPSTREAMS: duplicate upstream name "${config.name}".`);
    seen.add(config.name);
  }
  return configs;
}

/** Fill in the name from the host and reject a URL we could not dial. */
export function normalizeConfig(config: Partial<UpstreamConfig>, at = "upstream"): UpstreamConfig {
  const url = config.url?.trim();
  if (!url) throw new Error(`${at}: "url" is required.`);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (cause) {
    throw new Error(`${at}: "${url}" is not a valid URL.`, { cause });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${at}: "${url}" must be an http(s) URL.`);
  }

  const name = sanitize(config.name?.trim() || nameFromUrl(parsed));
  const timeoutMs = config.timeoutMs;
  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
    throw new Error(`${at}: "timeoutMs" must be a positive number.`);
  }

  return {
    name,
    url,
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    ...(config.prefix !== undefined ? { prefix: sanitize(config.prefix) } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  };
}

/**
 * `https://mcp.chatplace.io/mcp` → `chatplace`.
 *
 * Connector hostnames are nearly always `mcp.<product>.<tld>` or
 * `api.<product>.<tld>`, so dropping that first label and the public suffix
 * leaves the name a person would have chosen anyway. An address rather than a
 * name has no product in it to find, so it is kept whole.
 */
export function nameFromUrl(url: URL): string {
  const hostname = url.hostname;
  if (isAddress(hostname)) return sanitize(hostname.replace(/^\[|\]$/g, ""));

  const labels = hostname.split(".").filter(Boolean);
  while (labels.length > 1 && ["mcp", "api", "www", "server"].includes(labels[0]!)) labels.shift();
  if (labels.length > 1) labels.pop();
  return labels[0] ?? hostname;
}

/** An IPv4 dotted quad, or the `[…]` form the URL parser gives IPv6. */
function isAddress(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith("[");
}
