import type { PromptHandler, ResourceHandler, ToolHandler } from "../types.js";
import { mockHandler } from "./mock.js";

/**
 * What is actually implemented, keyed by name — one registry per server.
 *
 * Everything absent from `tools` falls through to `mockHandler`, which answers
 * in the shape the tool's outputSchema declares. That is what lets a surface be
 * complete on day one and get filled in tool by tool. Prompts and resources
 * work the same way: with no handler they are answered from the spec itself,
 * from the inline text or a stub, and a handler takes over when there is
 * something real behind it — which is how a prompt or resource served on
 * another server's behalf gets forwarded instead of stubbed.
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
export type Registry = {
  tools: Map<string, ToolHandler>;
  prompts: Map<string, PromptHandler>;
  resources: Map<string, ResourceHandler>;
  /**
   * Handlers for URIs that exist only as templates, so there is no list entry
   * to key on. Matched in registration order, after `resources` misses.
   */
  routers: { match: (uri: string) => boolean; handler: ResourceHandler }[];
};

export function createRegistry(): Registry {
  return { tools: new Map(), prompts: new Map(), resources: new Map(), routers: [] };
}

/**
 * The registry every server uses unless it is handed its own.
 *
 * One process normally runs one server, so a module-level default keeps
 * registration to `handlers.set(...)`. Two servers in one process — a test
 * standing an upstream up beside the server under test — need separate
 * registries, or each would answer with the other's handlers.
 */
export const defaultRegistry: Registry = createRegistry();

/** The default registry's tool map, which is where `registerTools` writes. */
export const handlers = defaultRegistry.tools;
export const promptHandlers = defaultRegistry.prompts;
export const resourceHandlers = defaultRegistry.resources;
export const resourceRouters = defaultRegistry.routers;

export function handlerFor(name: string, registry: Registry = defaultRegistry): ToolHandler {
  return registry.tools.get(name) ?? mockHandler;
}

export function isImplemented(name: string, registry: Registry = defaultRegistry): boolean {
  return registry.tools.has(name);
}

export function promptHandlerFor(name: string, registry: Registry = defaultRegistry): PromptHandler | undefined {
  return registry.prompts.get(name);
}

export function resourceHandlerFor(uri: string, registry: Registry = defaultRegistry): ResourceHandler | undefined {
  return registry.resources.get(uri) ?? registry.routers.find((route) => route.match(uri))?.handler;
}

export { mockHandler };
