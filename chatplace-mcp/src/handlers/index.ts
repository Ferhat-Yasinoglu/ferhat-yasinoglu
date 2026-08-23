import type { ToolHandler } from "../types.js";
import { mockHandler } from "./mock.js";

/**
 * Real implementations, keyed by tool name.
 *
 * Everything absent from this map falls through to `mockHandler`, which answers
 * in the shape the tool's outputSchema declares. That is what lets the cloned
 * surface be complete on day one and get filled in tool by tool.
 *
 * To implement a tool:
 *
 *   handlers.set("send_message", async (args, ctx) => {
 *     const res = await fetch(...);
 *     return { content: [{ type: "text", text: "sent" }] };
 *   });
 *
 * Arguments arrive already validated against the tool's inputSchema and with
 * schema defaults applied, so a handler can trust its input.
 */
export const handlers = new Map<string, ToolHandler>();

export function handlerFor(name: string): ToolHandler {
  return handlers.get(name) ?? mockHandler;
}

export function isImplemented(name: string): boolean {
  return handlers.has(name);
}

export { mockHandler };
