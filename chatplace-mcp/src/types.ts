/**
 * Shape of the tool surface this server exposes.
 *
 * The whole point of this project is that the surface is *data*, not code:
 * `spec/tools.json` is the single source of truth, and it can be replaced
 * wholesale by the real `tools/list` response from mcp.chatplace.io via
 * `npm run import-spec`. The runtime adapts; nothing here needs editing.
 */

/** A JSON Schema object, kept loose on purpose — we mirror whatever upstream sends. */
export type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema | JsonSchema[];
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  examples?: unknown[];
  description?: string;
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  [key: string]: unknown;
};

/** One entry of `tools/list`, matching the MCP `Tool` type. */
export type ToolSpec = {
  name: string;
  title?: string;
  description?: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  _meta?: Record<string, unknown>;
};

export type SpecSource = {
  /**
   * `placeholder` means these tools were reconstructed from public descriptions
   * of ChatPlace, not read off the real server. `imported` means they came from
   * an actual `tools/list` response and match it one-to-one.
   */
  origin: "placeholder" | "imported";
  server?: string;
  importedAt?: string;
  protocolVersion?: string;
  note?: string;
};

export type ServerSpec = {
  source: SpecSource;
  serverInfo: { name: string; version: string; title?: string };
  instructions?: string;
  tools: ToolSpec[];
};

/** Per-call context handed to every tool handler. */
export type ToolContext = {
  /** The API key the caller authenticated with, or null when auth is disabled. */
  apiKey: string | null;
  /** The tool being invoked, so shared handlers can branch on it. */
  tool: ToolSpec;
  /** Whether the server is running with real upstream credentials configured. */
  live: boolean;
};

export type ToolResultContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "resource"; resource: Record<string, unknown> };

export type ToolResult = {
  content: ToolResultContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<ToolResult> | ToolResult;
