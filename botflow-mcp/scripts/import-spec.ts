/**
 * Turn a captured `tools/list` response into spec/tools.json.
 *
 * Use this when the machine running the clone can't reach the source server —
 * capture the response anywhere you like, then feed it in:
 *
 *   curl -sS https://mcp.chatplace.io/mcp \
 *     -H "Authorization: Bearer $KEY" \
 *     -H "Content-Type: application/json" \
 *     -H "Accept: application/json, text/event-stream" \
 *     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' > tools-list.json
 *
 *   npm run import-spec -- tools-list.json
 *   cat tools-list.json | npm run import-spec
 *
 * Accepts the full JSON-RPC envelope, a bare `result`, a `{"tools":[...]}`
 * object, or an SSE-framed response.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { extractSseData, specFromToolsList } from "../src/spec.js";

async function main(argv: string[]): Promise<void> {
  const out = resolve(valueOf(argv, "--out") ?? "spec/tools.json");
  const server = valueOf(argv, "--server") ?? "https://mcp.chatplace.io/mcp";
  const input = argv.find((a) => !a.startsWith("--") && !isFlagValue(argv, a));

  const raw = input ? readFileSync(resolve(input), "utf8") : await readStdin();
  if (!raw.trim()) {
    throw new Error("No input. Pass a file path or pipe the tools/list response on stdin.");
  }

  const spec = specFromToolsList(JSON.parse(extractSseData(raw)), { server });

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(spec, null, 2)}\n`, "utf8");

  console.log(`Imported ${spec.tools.length} tools into ${out}`);
  for (const tool of spec.tools) {
    console.log(`  - ${tool.name}`);
  }
  console.log(`\nStart the clone with: npm run dev`);
}

function readStdin(): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolvePromise(data));
    process.stdin.on("error", reject);
  });
}

function valueOf(argv: string[], flag: string): string | undefined {
  const inline = argv.find((a) => a.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** True when `arg` is the value belonging to a preceding `--flag`. */
function isFlagValue(argv: string[], arg: string): boolean {
  const i = argv.indexOf(arg);
  return i > 0 && argv[i - 1]!.startsWith("--") && !argv[i - 1]!.includes("=");
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
