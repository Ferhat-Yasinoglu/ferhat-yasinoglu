#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { authFromEnv } from "./auth.js";
import { startHttpServer } from "./http.js";
import { createServer } from "./server.js";
import { defaultSpecPath, loadSpec } from "./spec.js";

/**
 * Two ways to run:
 *
 *   --http   (default) Streamable HTTP, the way mcp.chatplace.io/mcp is served.
 *   --stdio            Local subprocess, for wiring straight into a desktop client.
 */
async function main(argv: string[]): Promise<void> {
  const mode = argv.includes("--stdio") ? "stdio" : "http";
  const specPath = valueOf(argv, "--spec") ?? defaultSpecPath();
  const spec = loadSpec(specPath);

  if (mode === "stdio") {
    // stdout is the protocol channel here, so every log line must go to stderr.
    const server = createServer({ spec, apiKey: process.env.CHATPLACE_API_KEY ?? null });
    await server.connect(new StdioServerTransport());
    console.error(`chatplace-mcp: ${spec.tools.length} tools over stdio (${spec.source.origin} spec)`);
    return;
  }

  const auth = authFromEnv();
  const path = valueOf(argv, "--path") ?? process.env.MCP_PATH ?? "/mcp";
  const port = Number(valueOf(argv, "--port") ?? process.env.PORT ?? 3000);
  const httpServer = await startHttpServer({ spec, auth, path, port });
  const address = httpServer.address();
  const shown = typeof address === "object" && address ? `${address.address}:${address.port}` : String(address);

  console.error(`chatplace-mcp listening on http://${shown}${path}`);
  console.error(`  tools:  ${spec.tools.length} (${spec.source.origin} spec from ${specPath})`);
  console.error(
    auth.disabled
      ? `  auth:   DISABLED — set CHATPLACE_API_KEYS before exposing this publicly`
      : `  auth:   Bearer token, ${auth.keys.size} key(s) configured`,
  );

  if (spec.source.origin === "placeholder") {
    console.error(
      `\n  NOTE: serving the placeholder tool surface. To match the real server,\n` +
        `  run \`npm run import-spec\` with a live tools/list response.`,
    );
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
