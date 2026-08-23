#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { App } from "./app.js";
import { authFromEnv } from "./auth.js";
import { registerTools } from "./handlers/tools.js";
import { startHttpServer } from "./http.js";
import { createServer } from "./server.js";
import { defaultSpecPath, loadSpec } from "./spec.js";
import { Worker } from "./worker.js";

/**
 * Two ways to run:
 *
 *   --http   (default) Streamable HTTP, for use as a remote MCP connector.
 *   --stdio            Local subprocess, for wiring straight into a desktop client.
 *
 * Either way a background worker long-polls Telegram for the connected bots, so
 * flows keep running between tool calls. Pass --no-worker to leave it off.
 */
async function main(argv: string[]): Promise<void> {
  const mode = argv.includes("--stdio") ? "stdio" : "http";
  const specPath = valueOf(argv, "--spec") ?? defaultSpecPath();
  const spec = loadSpec(specPath);

  const dbPath = valueOf(argv, "--db") ?? process.env.BOTFLOW_DB ?? "botflow.db";
  const app = new App({ dbPath });
  registerTools(app);

  const worker = new Worker(app);
  if (!argv.includes("--no-worker")) {
    worker.start();
    // A broadcast interrupted by a restart resumes from its checkpoint rather
    // than messaging the first N recipients twice.
    app.broadcasts.resumeUnfinished();
  }

  const shutdown = async () => {
    await worker.stop();
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
  const httpServer = await startHttpServer({ spec, auth, path, port });
  const address = httpServer.address();
  const shown = typeof address === "object" && address ? `${address.address}:${address.port}` : String(address);

  const bots = app.store.listBots();
  console.error(`botflow-mcp listening on http://${shown}${path}`);
  console.error(`  tools:  ${spec.tools.length}`);
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
