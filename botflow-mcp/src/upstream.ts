import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { OAuthError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { defaultRegistry, type Registry } from "./handlers/index.js";
import { FileOAuthProvider, storePathFor, type OAuthSettings } from "./oauth.js";
import type {
  PromptResult,
  PromptSpec,
  ResourceResult,
  ResourceSpec,
  ResourceTemplateSpec,
  ServerSpec,
  ToolResult,
  ToolSpec,
} from "./types.js";

/**
 * Speak MCP as a *client* to another MCP server and republish its surface as ours.
 *
 * This is the other direction from `scripts/probe.ts`: probe copies a surface
 * into `spec/tools.json` once, at build time. Here the surface is discovered at
 * startup and the calls are forwarded live, so a remote connector such as
 * `https://mcp.chatplace.io/mcp` becomes part of what this server advertises
 * without anyone writing its schemas down first.
 *
 *   BOTFLOW_UPSTREAM_URL=https://mcp.chatplace.io/mcp BOTFLOW_UPSTREAM_KEY=… npm start
 *
 * Tools and prompts are namespaced (`chatplace_send_message`) so they can never
 * collide with, or quietly shadow, something this server serves itself.
 * Resources keep their URIs, which already identify them globally.
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
  /**
   * Authorize with OAuth instead of a static key. `true` takes the defaults;
   * a client id and secret select the client_credentials grant, and anything
   * else expects a session stored by `npm run login`. See src/oauth.ts.
   */
  oauth?: boolean | OAuthSettings;
  /** Tool-name prefix. Defaults to `<name>_`; an empty string disables it. */
  prefix?: string;
  /** Per-request timeout in milliseconds, including the handshake. */
  timeoutMs?: number;
};

export type UpstreamInfo = {
  serverInfo?: { name: string; version: string; title?: string };
  instructions?: string;
  /** Which optional halves of the surface the handshake advertised. */
  hasPrompts?: boolean;
  hasResources?: boolean;
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
  #oauth: FileOAuthProvider | undefined;
  #timeoutMs: number;
  #client: Client | null = null;
  #connecting: Promise<Client> | null = null;
  #info: UpstreamInfo = {};

  constructor(config: UpstreamConfig) {
    this.name = config.name;
    this.url = config.url;
    this.prefix = config.prefix ?? `${config.name}_`;
    this.#apiKey = config.apiKey;
    this.#oauth = config.oauth ? oauthProviderFor(config) : undefined;
    this.#timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** What the upstream said about itself during the handshake. */
  get info(): UpstreamInfo {
    return this.#info;
  }

  get connected(): boolean {
    return this.#client !== null;
  }

  /** How this upstream authorizes, for logs and /healthz. */
  get authMode(): "none" | "api-key" | "oauth-client-credentials" | "oauth-user" {
    if (!this.#oauth) return this.#apiKey ? "api-key" : "none";
    return this.#oauth.isClientCredentials ? "oauth-client-credentials" : "oauth-user";
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
   * The optional halves of the surface, or `undefined` when the upstream does
   * not offer them.
   *
   * A server may advertise a capability and still answer "method not found",
   * which is a refusal rather than a failure — treat it as "nothing offered"
   * so one grumpy half does not sink the rest of the attachment.
   */
  async listPrompts(): Promise<PromptSpec[] | undefined> {
    const client = await this.#connected();
    if (!this.#info.hasPrompts) return undefined;
    return this.#tryList(async () => {
      const { prompts } = await client.listPrompts(undefined, { timeout: this.#timeoutMs });
      return prompts as PromptSpec[];
    });
  }

  async listResources(): Promise<ResourceSpec[] | undefined> {
    const client = await this.#connected();
    if (!this.#info.hasResources) return undefined;
    return this.#tryList(async () => {
      const { resources } = await client.listResources(undefined, { timeout: this.#timeoutMs });
      return resources as ResourceSpec[];
    });
  }

  async listResourceTemplates(): Promise<ResourceTemplateSpec[] | undefined> {
    const client = await this.#connected();
    if (!this.#info.hasResources) return undefined;
    return this.#tryList(async () => {
      const { resourceTemplates } = await client.listResourceTemplates(undefined, { timeout: this.#timeoutMs });
      return resourceTemplates as ResourceTemplateSpec[];
    });
  }

  async getPrompt(name: string, args: Record<string, string>): Promise<PromptResult> {
    const client = await this.#connected();
    const result = await client.getPrompt({ name, arguments: args }, { timeout: this.#timeoutMs });
    return result as unknown as PromptResult;
  }

  async readResource(uri: string): Promise<ResourceResult> {
    const client = await this.#connected();
    const result = await client.readResource({ uri }, { timeout: this.#timeoutMs });
    return result as unknown as ResourceResult;
  }

  async #tryList<T>(list: () => Promise<T>): Promise<T | undefined> {
    try {
      return await list();
    } catch (cause) {
      if (cause instanceof McpError) return undefined;
      throw cause;
    }
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
    // Say so before opening anything. Left to the SDK, an interactive upstream
    // with no stored session ends in a registration nobody asked for and an
    // error about token requests, neither of which names the fix.
    if (this.#oauth && !this.#oauth.isClientCredentials && !this.#oauth.hasSession) {
      throw new Error(
        `Upstream "${this.name}" at ${this.url} is set to use OAuth but has no stored session. ` +
          `Sign in once with \`npm run login -- --url ${this.url}\`, or set a client id and secret ` +
          `to use the client_credentials grant instead.`,
      );
    }

    // The auth provider owns the Authorization header when OAuth is in play:
    // it attaches the token, refreshes it, and retries a 401 on its own.
    const transport = new StreamableHTTPClientTransport(new URL(this.url), {
      ...(this.#oauth ? { authProvider: this.#oauth } : {}),
      ...(this.#apiKey && !this.#oauth
        ? { requestInit: { headers: { Authorization: `Bearer ${this.#apiKey}` } } }
        : {}),
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
      // An OAuth error carries a code and often no message at all, so say what
      // the code means for this upstream rather than passing an empty string on.
      if (this.#oauth && (cause instanceof UnauthorizedError || cause instanceof OAuthError)) {
        const detail = cause instanceof OAuthError ? cause.errorCode : "unauthorized";
        throw new Error(
          `Upstream "${this.name}" at ${this.url} refused the authorization (${detail}). ` +
            (this.#oauth.isClientCredentials
              ? `Check the client id and secret.`
              : `Sign in again with \`npm run login -- --url ${this.url}\`.`),
          { cause },
        );
      }
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`Could not connect to upstream "${this.name}" at ${this.url}: ${message}`, { cause });
    }

    const serverInfo = client.getServerVersion();
    const instructions = client.getInstructions();
    const capabilities = client.getServerCapabilities();
    this.#info = {
      ...(serverInfo ? { serverInfo: serverInfo as UpstreamInfo["serverInfo"] } : {}),
      ...(instructions ? { instructions } : {}),
      hasPrompts: capabilities?.prompts !== undefined,
      hasResources: capabilities?.resources !== undefined,
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
  /** Local names now served on the upstream's behalf, by kind. */
  tools: string[];
  prompts: string[];
  resources: string[];
  resourceTemplates: string[];
  /** What was left out, and why. */
  skipped: { kind: AttachKind; name: string; reason: string }[];
};

export type AttachKind = "tool" | "prompt" | "resource" | "resourceTemplate";

/**
 * Discover an upstream's surface and splice it into the one we serve.
 *
 * The spec is data, so adding a tool is a push and a handler registration —
 * `createServer` reads the spec on every request and picks them up. Call this
 * at startup, before the first request is served.
 *
 * All three halves come across: tools, prompts, and resources with their
 * templates. Whatever the upstream does not offer is left absent rather than
 * empty, because presence is what decides the capabilities we advertise — and
 * advertising prompts on behalf of a server that has none would be a lie the
 * first `prompts/list` exposes.
 *
 * Arguments reach the forwarding handler already validated against the
 * upstream's own `inputSchema` and with its defaults applied, because that is
 * what the local surface now promises callers.
 */
export async function attachUpstream(
  spec: ServerSpec,
  upstream: UpstreamServer,
  registry: Registry = defaultRegistry,
): Promise<UpstreamAttachment> {
  const at: UpstreamAttachment = {
    upstream,
    tools: [],
    prompts: [],
    resources: [],
    resourceTemplates: [],
    skipped: [],
  };

  // Tools first: listing them is what opens the connection, so the handshake
  // has told us which of the other halves are worth asking about.
  const tools = await upstream.listTools();
  const takenTools = new Set(spec.tools.map((tool) => tool.name));
  for (const tool of tools) {
    const local = localName(upstream.prefix, tool.name);
    if (takenTools.has(local)) {
      // Never shadow a local tool: the caller asked for ours, they get ours.
      at.skipped.push({ kind: "tool", name: tool.name, reason: `"${local}" is already served here` });
      continue;
    }
    spec.tools.push({ ...tool, name: local, _meta: origin(tool._meta, upstream, "tool", tool.name) });
    registry.tools.set(local, (args) => upstream.callTool(tool.name, args));
    takenTools.add(local);
    at.tools.push(local);
  }

  const prompts = await upstream.listPrompts();
  if (prompts) {
    spec.prompts ??= [];
    const taken = new Set(spec.prompts.map((prompt) => prompt.name));
    for (const prompt of prompts) {
      const local = localName(upstream.prefix, prompt.name);
      if (taken.has(local)) {
        at.skipped.push({ kind: "prompt", name: prompt.name, reason: `"${local}" is already served here` });
        continue;
      }
      spec.prompts.push({ ...prompt, name: local, _meta: origin(prompt._meta, upstream, "prompt", prompt.name) });
      registry.prompts.set(local, (args) => upstream.getPrompt(prompt.name, args));
      taken.add(local);
      at.prompts.push(local);
    }
  }

  // A resource is addressed by URI, which is already global — renaming one into
  // our namespace would break the very thing that identifies it.
  const resources = await upstream.listResources();
  if (resources) {
    spec.resources ??= [];
    const taken = new Set(spec.resources.map((resource) => resource.uri));
    for (const resource of resources) {
      if (taken.has(resource.uri)) {
        at.skipped.push({ kind: "resource", name: resource.uri, reason: "already served here" });
        continue;
      }
      // `text` is dropped on purpose: the content comes from the upstream on
      // every read, so caching a copy here would only let the two drift apart.
      const { text: _text, ...rest } = resource;
      spec.resources.push({ ...rest, _meta: origin(resource._meta, upstream, "resource", resource.uri) });
      registry.resources.set(resource.uri, (uri) => upstream.readResource(uri));
      taken.add(resource.uri);
      at.resources.push(resource.uri);
    }
  }

  const templates = await upstream.listResourceTemplates();
  if (templates) {
    spec.resourceTemplates ??= [];
    const taken = new Set(spec.resourceTemplates.map((template) => template.uriTemplate));
    for (const template of templates) {
      if (taken.has(template.uriTemplate)) {
        at.skipped.push({ kind: "resourceTemplate", name: template.uriTemplate, reason: "already served here" });
        continue;
      }
      spec.resourceTemplates.push({ ...template, _meta: origin(template._meta, upstream, "resourceTemplate", template.uriTemplate) });
      // A templated URI has no list entry to key a handler on, so route by shape.
      registry.routers.push({ match: matcherFor(template.uriTemplate), handler: (uri) => upstream.readResource(uri) });
      taken.add(template.uriTemplate);
      at.resourceTemplates.push(template.uriTemplate);
    }
  }

  if (at.tools.length > 0) {
    spec.instructions = withUpstreamNote(spec.instructions, upstream, at.tools.length);
  }

  return at;
}

/**
 * Build the OAuth provider for an upstream, storing its session under the
 * upstream's name so two of them never share a refresh token.
 */
export function oauthProviderFor(config: UpstreamConfig): FileOAuthProvider {
  const settings: OAuthSettings = typeof config.oauth === "object" ? config.oauth : {};
  return new FileOAuthProvider(storePathFor(config.name), settings);
}

/** Stamp where something came from, keeping whatever `_meta` it already had. */
function origin(
  meta: Record<string, unknown> | undefined,
  upstream: UpstreamServer,
  kind: AttachKind,
  name: string,
) {
  return { ...meta, [UPSTREAM_META_KEY]: { server: upstream.name, url: upstream.url, kind, name } };
}

/**
 * Turn `notes://{user}/{id}` into a test for the URIs it covers.
 *
 * RFC 6570 has far more in it than this, but MCP templates in the wild are
 * path-shaped, so a variable matches one segment and everything else is literal.
 */
export function matcherFor(uriTemplate: string): (uri: string) => boolean {
  const pattern = uriTemplate
    .split(/(\{[^}]*\})/)
    .map((part) => (part.startsWith("{") && part.endsWith("}") ? "[^/]+" : escapeRegExp(part)))
    .join("");
  const regex = new RegExp(`^${pattern}$`);
  return (uri: string) => regex.test(uri);
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  const oauth = oauthFromEnv(env);

  return [
    normalizeConfig({
      name: env.BOTFLOW_UPSTREAM_NAME?.trim() || undefined,
      url,
      apiKey: env.BOTFLOW_UPSTREAM_KEY?.trim() || undefined,
      prefix: env.BOTFLOW_UPSTREAM_PREFIX,
      timeoutMs: env.BOTFLOW_UPSTREAM_TIMEOUT_MS ? Number(env.BOTFLOW_UPSTREAM_TIMEOUT_MS) : undefined,
      ...(oauth ? { oauth } : {}),
    }),
  ];
}

/**
 * OAuth settings for the single-upstream form.
 *
 * Client credentials on their own are enough to mean "use OAuth" — nobody sets
 * a client id and secret for an upstream they intend to reach with an API key.
 */
function oauthFromEnv(env: NodeJS.ProcessEnv): OAuthSettings | undefined {
  const clientId = env.BOTFLOW_UPSTREAM_CLIENT_ID?.trim();
  const clientSecret = env.BOTFLOW_UPSTREAM_CLIENT_SECRET?.trim();
  const scope = env.BOTFLOW_UPSTREAM_SCOPE?.trim();
  const asked = env.BOTFLOW_UPSTREAM_OAUTH === "1";

  if (!asked && !clientId) return undefined;
  return {
    ...(clientId ? { clientId } : {}),
    ...(clientSecret ? { clientSecret } : {}),
    ...(scope ? { scope } : {}),
  };
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

  if (config.oauth && config.apiKey) {
    throw new Error(`${at}: set either an API key or OAuth for an upstream, not both.`);
  }

  return {
    name,
    url,
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    ...(config.oauth ? { oauth: config.oauth } : {}),
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
