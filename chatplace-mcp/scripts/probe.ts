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
  const capabilities = client.getServerCapabilities();

  const { tools } = await client.listTools();

  // Prompts and resources are optional halves of the surface. Only ask for the
  // ones the handshake advertised, and tolerate a server that advertises them
  // but answers "method not found" anyway.
  const prompts = capabilities?.prompts
    ? await tryList(() => client.listPrompts(), "prompts", "prompts")
    : undefined;
  const resources = capabilities?.resources
    ? await tryList(() => client.listResources(), "resources", "resources")
    : undefined;
  const resourceTemplates = capabilities?.resources
    ? await tryList(() => client.listResourceTemplates(), "resourceTemplates", "resourceTemplates")
    : undefined;

  const surface = {
    tools,
    ...(prompts ? { prompts } : {}),
    ...(resources ? { resources } : {}),
    ...(resourceTemplates ? { resourceTemplates } : {}),
  };

  const spec = specFromToolsList(surface, {
    server: url,
    serverInfo: serverInfo
      ? { name: serverInfo.name, version: serverInfo.version }
      : { name: "chatplace-mcp", version: "0.1.0" },
    ...(instructions ? { instructions } : {}),
  });

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(spec, null, 2)}\n`, "utf8");

  // Keep the untouched response next to it for diffing against future imports.
  const rawPath = out.replace(/\.json$/, ".raw.json");
  writeFileSync(
    rawPath,
    `${JSON.stringify({ serverInfo, instructions, capabilities, ...surface }, null, 2)}\n`,
    "utf8",
  );

  console.log(`Wrote ${out}`);
  console.log(`Raw response saved to ${rawPath}\n`);
  console.log(`${spec.tools.length} tools:`);
  for (const tool of spec.tools) {
    const required = tool.inputSchema.required?.length ?? 0;
    const total = Object.keys(tool.inputSchema.properties ?? {}).length;
    console.log(`  - ${tool.name}  (${total} args, ${required} required)`);
  }
  if (spec.prompts) console.log(`\n${spec.prompts.length} prompts:\n${list(spec.prompts.map((p) => p.name))}`);
  if (spec.resources) console.log(`\n${spec.resources.length} resources:\n${list(spec.resources.map((r) => r.uri))}`);
  if (spec.resourceTemplates) {
    console.log(`\n${spec.resourceTemplates.length} resource templates:\n${list(spec.resourceTemplates.map((r) => r.uriTemplate))}`);
  }

  await client.close();
}

/** Ask for an optional part of the surface, treating refusal as "not offered". */
async function tryList<T extends object, K extends keyof T>(
  call: () => Promise<T>,
  key: K,
  label: string,
): Promise<T[K] | undefined> {
  try {
    return (await call())[key];
  } catch (error) {
    console.error(`  (skipping ${label}: ${error instanceof Error ? error.message : String(error)})`);
    return undefined;
  }
}

function list(names: string[]): string {
  return names.map((n) => `  - ${n}`).join("\n");
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
