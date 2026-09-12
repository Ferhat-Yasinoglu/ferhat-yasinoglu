import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Request, type Response } from "express";
import type { Server as HttpServer } from "node:http";
import { authenticate, authFromEnv, type AuthConfig } from "./auth.js";
import type { Registry } from "./handlers/index.js";
import { createServer } from "./server.js";
import type { ServerSpec } from "./types.js";
import type { UpstreamServer } from "./upstream.js";

export type HttpOptions = {
  spec: ServerSpec;
  auth?: AuthConfig;
  /** Mount path for the MCP endpoint. ChatPlace serves its connector at /mcp. */
  path?: string;
  /** Upstream servers whose tools are forwarded, reported by /healthz. */
  upstreams?: UpstreamServer[];
  /** Handler registry for the servers this app builds. Defaults to the global one. */
  registry?: Registry;
};

/**
 * Serve the MCP endpoint over Streamable HTTP — the transport remote connectors
 * like `mcp.chatplace.io/mcp` use, and the one Claude and ChatGPT speak when you
 * add a custom connector by URL.
 *
 * Each request gets a fresh Server + transport pair (stateless mode). That costs
 * a little per call and buys horizontal scaling with no sticky sessions, which
 * is the right trade for a hosted connector.
 */
export function createHttpApp(options: HttpOptions) {
  const { spec, path = "/mcp", upstreams = [] } = options;
  const auth = options.auth ?? authFromEnv();
  const app = express();

  app.use(express.json({ limit: "4mb" }));

  app.get("/healthz", (_req, res) => {
    res.json({
      status: "ok",
      server: spec.serverInfo,
      tools: spec.tools.length,
      specOrigin: spec.source.origin,
      authRequired: !auth.disabled,
      // Never the key: just enough to see whether a forwarded surface is wired up.
      upstreams: upstreams.map((upstream) => ({
        name: upstream.name,
        url: upstream.url,
        prefix: upstream.prefix,
        auth: upstream.authMode,
        connected: upstream.connected,
      })),
    });
  });

  const handle = async (req: Request, res: Response) => {
    const result = authenticate(req.headers as Record<string, unknown>, auth);
    if (!result.ok) {
      // Advertise the scheme so clients know to retry with a bearer token.
      res.setHeader("WWW-Authenticate", 'Bearer realm="botflow-mcp"');
      res.status(result.status).json(jsonRpcError(-32001, result.message, req.body));
      return;
    }

    const server = createServer({ spec, apiKey: result.apiKey, ...(options.registry ? { registry: options.registry } : {}) });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    // The transport owns the response lifecycle; tear both down when it ends.
    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (cause) {
      if (!res.headersSent) {
        const message = cause instanceof Error ? cause.message : String(cause);
        res.status(500).json(jsonRpcError(-32603, `Internal error: ${message}`, req.body));
      }
    }
  };

  app.post(path, handle);
  // GET and DELETE are part of Streamable HTTP (server-initiated streams and
  // session teardown). In stateless mode the transport rejects them itself.
  app.get(path, handle);
  app.delete(path, handle);

  return app;
}

export function startHttpServer(options: HttpOptions & { port?: number; host?: string }): Promise<HttpServer> {
  const port = options.port ?? Number(process.env.PORT ?? 3000);
  const host = options.host ?? process.env.HOST ?? "0.0.0.0";
  const app = createHttpApp(options);

  return new Promise((resolvePromise, reject) => {
    const httpServer = app.listen(port, host, () => resolvePromise(httpServer));
    httpServer.on("error", reject);
  });
}

function jsonRpcError(code: number, message: string, body: unknown) {
  const id = typeof body === "object" && body !== null ? ((body as { id?: unknown }).id ?? null) : null;
  return { jsonrpc: "2.0", id, error: { code, message } };
}
