import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { handlerFor, isImplemented } from "./handlers/index.js";
import { applyDefaults, formatErrors, isPlainObject, validate } from "./jsonschema.js";
import type { ServerSpec, ToolResult, ToolSpec } from "./types.js";

export type CreateServerOptions = {
  spec: ServerSpec;
  /** The authenticated caller's key, threaded through to handlers. */
  apiKey?: string | null;
};

/**
 * Build an MCP server that serves exactly the tool surface in `spec`.
 *
 * We use the low-level `Server` rather than `McpServer` because the tool list is
 * loaded from data at runtime; there is nothing to register statically.
 */
export function createServer({ spec, apiKey = null }: CreateServerOptions): Server {
  const server = new Server(
    {
      name: spec.serverInfo.name,
      version: spec.serverInfo.version,
      ...(spec.serverInfo.title ? { title: spec.serverInfo.title } : {}),
    },
    {
      capabilities: { tools: { listChanged: false } },
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
    const errors = validate(args, tool.inputSchema);
    if (errors.length > 0) {
      return errorResult(`Invalid arguments for "${name}":\n${formatErrors(errors)}`);
    }

    const withDefaults = applyDefaults(args, tool.inputSchema) as Record<string, unknown>;

    try {
      const result = await handlerFor(name)(withDefaults, {
        apiKey,
        tool,
        live: isImplemented(name),
      });
      return result as unknown as Record<string, unknown>;
    } catch (cause) {
      // Tool execution errors belong in the result, not the protocol layer, so
      // the model can see what went wrong and adjust.
      const message = cause instanceof Error ? cause.message : String(cause);
      return errorResult(`"${name}" failed: ${message}`);
    }
  });

  return server;
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
