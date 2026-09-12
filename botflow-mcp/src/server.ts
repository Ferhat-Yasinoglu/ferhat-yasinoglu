import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  defaultRegistry,
  handlerFor,
  isImplemented,
  promptHandlerFor,
  resourceHandlerFor,
  type Registry,
} from "./handlers/index.js";
import { applyDefaults, formatErrors, isPlainObject, validate } from "./jsonschema.js";
import type { ServerSpec, ToolResult, ToolSpec } from "./types.js";

export type CreateServerOptions = {
  spec: ServerSpec;
  /** The authenticated caller's key, threaded through to handlers. */
  apiKey?: string | null;
  /**
   * Where the implementations live. Defaults to the process-wide registry;
   * pass one when a second server has to answer with handlers of its own.
   */
  registry?: Registry;
};

/**
 * Build an MCP server that serves exactly the tool surface in `spec`.
 *
 * We use the low-level `Server` rather than `McpServer` because the tool list is
 * loaded from data at runtime; there is nothing to register statically.
 */
export function createServer({ spec, apiKey = null, registry = defaultRegistry }: CreateServerOptions): Server {
  const hasPrompts = spec.prompts !== undefined;
  const hasResources = spec.resources !== undefined || spec.resourceTemplates !== undefined;

  const server = new Server(
    {
      name: spec.serverInfo.name,
      version: spec.serverInfo.version,
      ...(spec.serverInfo.title ? { title: spec.serverInfo.title } : {}),
    },
    {
      // Advertise only what the spec actually declares. Claiming a capability we
      // cannot serve would make the clone diverge from upstream on handshake.
      capabilities: {
        tools: { listChanged: false },
        ...(hasPrompts ? { prompts: { listChanged: false } } : {}),
        ...(hasResources ? { resources: { listChanged: false, subscribe: false } } : {}),
      },
      ...(spec.instructions ? { instructions: spec.instructions } : {}),
    },
  );

  const byName = new Map(spec.tools.map((tool) => [tool.name, tool]));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: spec.tools.map(toWireTool),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    const tool = byName.get(name);

    if (!tool) {
      return errorResult(
        `Unknown tool "${name}". Available tools: ${spec.tools.map((t) => t.name).join(", ") || "(none)"}.`,
      );
    }

    const args = isPlainObject(rawArgs) ? rawArgs : {};

    try {
      // Validation is inside the try as well: schemas can be imported from
      // another server, and a malformed one must surface as a tool error rather
      // than an opaque protocol failure.
      const errors = validate(args, tool.inputSchema);
      if (errors.length > 0) {
        return errorResult(`Invalid arguments for "${name}":\n${formatErrors(errors)}`);
      }

      const withDefaults = applyDefaults(args, tool.inputSchema) as Record<string, unknown>;
      const result = await handlerFor(name, registry)(withDefaults, {
        apiKey,
        tool,
        live: isImplemented(name, registry),
      });
      return result as unknown as Record<string, unknown>;
    } catch (cause) {
      // Tool execution errors belong in the result, not the protocol layer, so
      // the model can see what went wrong and adjust.
      const message = cause instanceof Error ? cause.message : String(cause);
      return errorResult(`"${name}" failed: ${message}`);
    }
  });

  if (hasPrompts) registerPrompts(server, spec, apiKey, registry);
  if (hasResources) registerResources(server, spec, apiKey, registry);

  return server;
}

function registerPrompts(server: Server, spec: ServerSpec, apiKey: string | null, registry: Registry): void {
  const prompts = spec.prompts ?? [];
  const byName = new Map(prompts.map((prompt) => [prompt.name, prompt]));

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const prompt = byName.get(name);
    if (!prompt) throw new Error(`Unknown prompt "${name}".`);

    const missing = (prompt.arguments ?? [])
      .filter((arg) => arg.required && !(args ?? {})[arg.name])
      .map((arg) => arg.name);
    if (missing.length > 0) {
      throw new Error(`Prompt "${name}" is missing required arguments: ${missing.join(", ")}.`);
    }

    const handler = promptHandlerFor(name, registry);
    if (handler) return await handler(args ?? {}, { apiKey, prompt });

    // Stubbed like tools: the shape is real, the wording is a placeholder until
    // the prompt is implemented.
    const filled = Object.entries(args ?? {})
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join("\n");
    return {
      ...(prompt.description ? { description: prompt.description } : {}),
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [`[stub] Prompt "${name}" has no implementation yet.`, filled && `\nArguments:\n${filled}`]
              .filter(Boolean)
              .join("\n"),
          },
        },
      ],
    };
  });
}

function registerResources(server: Server, spec: ServerSpec, apiKey: string | null, registry: Registry): void {
  const resources = spec.resources ?? [];
  const resourceTemplates = spec.resourceTemplates ?? [];
  const byUri = new Map(resources.map((resource) => [resource.uri, resource]));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    // `text` is our storage for inline content, not part of the list wire shape.
    resources: resources.map(({ text: _text, ...rest }) => rest),
  }));

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const resource = byUri.get(uri);

    // A handler wins over the spec's inline text, the same way a tool handler
    // wins over the stub — and it is the only way a templated URI resolves.
    const handler = resourceHandlerFor(uri, registry);
    if (handler) return await handler(uri, { apiKey, ...(resource ? { resource } : {}) });

    if (!resource) throw new Error(`Unknown resource "${uri}".`);

    return {
      contents: [
        {
          uri,
          ...(resource.mimeType ? { mimeType: resource.mimeType } : {}),
          text: resource.text ?? `[stub] "${resource.name}" has no content in the spec.`,
        },
      ],
    };
  });
}

/** Strip our spec-only fields and emit the MCP `Tool` wire shape. */
function toWireTool(tool: ToolSpec): Record<string, unknown> {
  return {
    name: tool.name,
    ...(tool.title ? { title: tool.title } : {}),
    ...(tool.description ? { description: tool.description } : {}),
    inputSchema: { type: "object", ...tool.inputSchema },
    ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
    ...(tool.annotations ? { annotations: tool.annotations } : {}),
    ...(tool._meta ? { _meta: tool._meta } : {}),
  };
}

function errorResult(text: string): ToolResult & Record<string, unknown> {
  return { content: [{ type: "text", text }], isError: true };
}
