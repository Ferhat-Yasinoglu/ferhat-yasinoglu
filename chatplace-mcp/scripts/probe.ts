/**
 * Read the tool surface off a live MCP server and write it to spec/tools.json.
 *
 * This is the step that turns the placeholder clone into an exact one:
 *
 *   npm run probe -- --url https://mcp.chatplace.io/mcp --key "$CHATPLACE_KEY"
 *
 * Requires network access to the target. If your machine can't reach it, use
 * `npm run import-spec` with a hand-captured response instead.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { specFromToolsList } from "../src/spec.js";

async function main(argv: string[]): Promise<void> {
  const url = valueOf(argv, "--url") ?? process.env.MCP_URL;
  const key = valueOf(argv, "--key") ?? process.env.MCP_API_KEY;
  const out = resolve(valueOf(argv, "--out") ?? "spec/tools.json");

  if (!url) {
    throw new Error("Pass the server URL: npm run probe -- --url https://mcp.chatplace.io/mcp --key <API_KEY>");
  }

  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: key ? { headers: { Authorization: `Bearer ${key}` } } : undefined,
  });

  const client = new Client({ name: "chatplace-mcp-probe", version: "0.1.0" });
  await client.connect(transport);

  const serverInfo = client.getServerVersion();
  const instructions = client.getInstructions();
  const { tools } = await client.listTools();

  const spec = specFromToolsList(
    { tools },
    {
      server: url,
      serverInfo: serverInfo
        ? { name: serverInfo.name, version: serverInfo.version }
        : { name: "chatplace-mcp", version: "0.1.0" },
    },
  );
  if (instructions) spec.instructions = instructions;

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(spec, null, 2)}\n`, "utf8");

  // Keep the untouched response next to it for diffing against future imports.
  const rawPath = out.replace(/\.json$/, ".raw.json");
  writeFileSync(rawPath, `${JSON.stringify({ serverInfo, instructions, tools }, null, 2)}\n`, "utf8");

  console.log(`Wrote ${spec.tools.length} tools to ${out}`);
  console.log(`Raw response saved to ${rawPath}`);
  for (const tool of spec.tools) {
    const required = tool.inputSchema.required?.length ?? 0;
    const total = Object.keys(tool.inputSchema.properties ?? {}).length;
    console.log(`  - ${tool.name}  (${total} args, ${required} required)`);
  }

  await client.close();
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
