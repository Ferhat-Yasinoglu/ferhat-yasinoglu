#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { App } from "./app.js";
import { authFromEnv } from "./auth.js";
import { registerTools } from "./handlers/tools.js";
import { startHttpServer } from "./http.js";
import { createServer } from "./server.js";
import { defaultSpecPath, loadSpec } from "./spec.js";
import type { ServerSpec } from "./types.js";
import { attachUpstream, normalizeConfig, UpstreamServer, upstreamsFromEnv } from "./upstream.js";
import { Worker } from "./worker.js";

/**
 * Two ways to run:
 *
 *   --http   (default) Streamable HTTP, for use as a remote MCP connector.
 *   --stdio            Local subprocess, for wiring straight into a desktop client.
 *
 * Either way a background worker long-polls Telegram for the connected bots, so
 * flows keep running between tool calls. Pass --no-worker to leave it off.
 *
 * Pass --upstream <url> (or set BOTFLOW_UPSTREAM_URL) to also republish another
 * MCP server's tools through this one; see src/upstream.ts.
 */
async function main(argv: string[]): Promise<void> {
  const mode = argv.includes("--stdio") ? "stdio" : "http";
  const specPath = valueOf(argv, "--spec") ?? defaultSpecPath();
  const spec = loadSpec(specPath);

  const dbPath = valueOf(argv, "--db") ?? process.env.BOTFLOW_DB ?? "botflow.db";
  const app = new App({ dbPath });
  registerTools(app);

  const upstreams = await connectUpstreams(argv, spec);

  const worker = new Worker(app);
  if (!argv.includes("--no-worker")) {
    worker.start();
    // A broadcast interrupted by a restart resumes from its checkpoint rather
    // than messaging the first N recipients twice.
    app.broadcasts.resumeUnfinished();
  }

  const shutdown = async () => {
    await worker.stop();
    await Promise.all(upstreams.map((upstream) => upstream.close().catch(() => {})));
    await app.shutdown();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  if (mode === "stdio") {
    // stdout is the protocol channel here, so every log line must go to stderr.
    const server = createServer({ spec, apiKey: process.env.BOTFLOW_API_KEY ?? null });
    await server.connect(new StdioServerTransport());
    console.error(`botflow-mcp: ${spec.tools.length} tools over stdio, database ${dbPath}`);
    return;
  }

  const auth = authFromEnv();
  const path = valueOf(argv, "--path") ?? process.env.MCP_PATH ?? "/mcp";
  const port = Number(valueOf(argv, "--port") ?? process.env.PORT ?? 3000);
  const httpServer = await startHttpServer({ spec, auth, path, port, upstreams });
  const address = httpServer.address();
  const shown = typeof address === "object" && address ? `${address.address}:${address.port}` : String(address);

  const bots = app.store.listBots();
  console.error(`botflow-mcp listening on http://${shown}${path}`);
  console.error(`  tools:  ${spec.tools.length}`);
  for (const upstream of upstreams) {
    console.error(`  from:   ${upstream.name} → ${upstream.url}`);
  }
  console.error(`  db:     ${dbPath} (${bots.length} bot(s) connected)`);
  console.error(
    auth.disabled
      ? `  auth:   DISABLED — set BOTFLOW_API_KEYS before exposing this publicly`
      : `  auth:   Bearer token, ${auth.keys.size} key(s) configured`,
  );
  if (bots.length === 0) {
    console.error(`\n  No bots yet. Call connect_bot with a token from @BotFather to start.`);
  }
}

/**
 * Bring up every configured upstream and splice its tools into `spec`.
 *
 * An unreachable upstream is reported and skipped rather than fatal: a
 * connector being down should not take this server's own tools with it. The
 * ones that did connect are returned so they can be closed on shutdown.
 */
async function connectUpstreams(argv: string[], spec: ServerSpec): Promise<UpstreamServer[]> {
  const flagUrl = valueOf(argv, "--upstream");
  const configs = flagUrl
    ? [normalizeConfig({ url: flagUrl, apiKey: process.env.BOTFLOW_UPSTREAM_KEY, name: valueOf(argv, "--upstream-name") })]
    : upstreamsFromEnv();

  const connected: UpstreamServer[] = [];
  for (const config of configs) {
    const upstream = new UpstreamServer(config);
    try {
      const { added, skipped } = await attachUpstream(spec, upstream);
      console.error(`upstream ${config.name}: ${added.length} tool(s) from ${config.url}`);
      for (const { tool, reason } of skipped) {
        console.error(`  skipped ${tool}: ${reason}`);
      }
      connected.push(upstream);
    } catch (cause) {
      await upstream.close().catch(() => {});
      const message = cause instanceof Error ? cause.message : String(cause);
      console.error(`upstream ${config.name}: unavailable, continuing without its tools — ${message}`);
    }
  }
  return connected;
}

function valueOf(argv: string[], flag: string): string | undefined {
  const inline = argv.find((a) => a.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
