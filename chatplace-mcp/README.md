# chatplace-mcp

A spec-driven clone of the ChatPlace remote MCP server (`mcp.chatplace.io/mcp`).

`mcp.chatplace.io/mcp` is not a web page — it is a [Model Context
Protocol](https://modelcontextprotocol.io) endpoint that lets Claude, ChatGPT and
other MCP clients drive [ChatPlace](https://chatplace.io) (Instagram / Telegram /
TikTok chatbots, funnels, carousels, broadcasts) from a chat. This project
reproduces that *shape*: a remote MCP server over Streamable HTTP, authenticated
with a bearer API key, exposing a tool surface loaded from data.

## What is and isn't cloneable

|                                   | Status |
| --------------------------------- | ------ |
| Transport, framing, handshake     | Done — real Streamable HTTP, verified against the official SDK client |
| Bearer API-key auth               | Done — constant-time check against a configured allowlist |
| Tool surface (names, schemas)     | Reproducible exactly — see [Matching the real surface](#matching-the-real-surface) |
| Tool behaviour                    | Stubbed. Each tool answers in the shape its `outputSchema` promises |
| ChatPlace's backend               | Not cloneable. Their Instagram automation runs on a Meta API partnership; you would need your own Meta app and app review |

So: the interface can be made byte-for-byte equivalent, and the plumbing is real.
What each tool *does* is yours to implement.

## Quick start

```bash
npm install
npm test          # 54 tests, including a real HTTP handshake
npm run dev       # http://localhost:3000/mcp
```

`npm run dev` starts with auth disabled and the placeholder tool surface. To run
it the way a hosted connector would:

```bash
CHATPLACE_API_KEYS="$(openssl rand -hex 32)" npm run build && npm start
```

Check it is up:

```bash
curl -s localhost:3000/healthz
# {"status":"ok","server":{...},"tools":12,"specOrigin":"placeholder","authRequired":true}
```

## Matching the real surface

`spec/tools.json` is the **entire** tool surface. No tool is listed in code, so
replacing that file replaces what the server is.

What ships in it today is a **placeholder** — names and schemas reconstructed
from public descriptions of ChatPlace, not read off the real server. Its
`source.origin` says `"placeholder"` and the server prints a warning at startup
so this is never mistaken for the real thing.

To make it exact, point the probe at the live server:

```bash
npm run probe -- --url https://mcp.chatplace.io/mcp --key "$CHATPLACE_API_KEY"
```

That connects as a real MCP client, calls `tools/list`, and rewrites
`spec/tools.json` with `source.origin: "imported"`. Restart, and the clone serves
that surface verbatim.

If the machine running this can't reach `chatplace.io`, capture the response
somewhere that can and import it:

```bash
curl -sS https://mcp.chatplace.io/mcp \
  -H "Authorization: Bearer $CHATPLACE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' > tools-list.json

npm run import-spec -- tools-list.json
```

The importer takes a full JSON-RPC envelope, a bare `result`, a
`{"tools":[...]}` object, or an SSE-framed response, so a copy-pasted curl result
works as-is.

Fidelity is enforced by a test: `test/http.test.ts` probes the running server and
asserts the result deep-equals the spec it was handed. If a round-trip through
the wire preserved our own surface, it preserves an imported one too.

More detail in [`spec/README.md`](spec/README.md).

## Implementing a tool

Everything not in the handler map falls through to a stub that validates the
arguments, then synthesizes a response matching the tool's `outputSchema`. To
make one real, add it to `src/handlers/index.ts`:

```ts
import { handlers } from "./index.js";

handlers.set("send_message", async (args, ctx) => {
  // args is already validated against inputSchema, with defaults applied.
  // ctx.apiKey is the key the caller authenticated with.
  const res = await fetch("https://api.example.com/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${ctx.apiKey}` },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`send failed: ${res.status}`);

  return { content: [{ type: "text", text: "Sent." }] };
});
```

Throwing is fine — the error is returned as an `isError` tool result so the model
can see it and adjust, rather than breaking the connection.

## Connecting a client

**As a remote connector** (Claude, ChatGPT — needs a public HTTPS URL):

```
https://your-host.example.com/mcp
```

with the API key as a bearer token.

**As a local stdio server:**

```jsonc
{
  "mcpServers": {
    "chatplace-clone": {
      "command": "node",
      "args": ["/path/to/chatplace-mcp/dist/src/index.js", "--stdio"]
    }
  }
}
```

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `CHATPLACE_API_KEYS` | *(empty)* | Comma-separated accepted keys. Empty disables auth |
| `CHATPLACE_AUTH_DISABLED` | — | Set to `1` to force auth off. Local only |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Listen address |
| `MCP_PATH` | `/mcp` | Endpoint path |
| `CHATPLACE_SPEC` | `./spec/tools.json` | Tool spec location |

Auth is **off** when no keys are configured. That is convenient locally and wrong
in public — the startup banner says so, and `/healthz` reports `authRequired`.

## Layout

```
spec/tools.json        the tool surface — the thing you swap to match upstream
src/spec.ts            loads and validates it; converts a tools/list response into one
src/server.ts          builds an MCP server from the spec
src/jsonschema.ts      argument validation and default-filling
src/handlers/          real implementations; anything missing falls back to a stub
src/http.ts            Streamable HTTP transport + bearer auth
src/index.ts           entry point (--http | --stdio)
scripts/probe.ts       read a live server's surface into spec/tools.json
scripts/import-spec.ts same, from a captured response
```

## A note on scope

Cloning an interface to build your own implementation behind it is ordinary
engineering. Passing your deployment off as ChatPlace, or reusing their name and
branding, is not — this repo is a working skeleton for building your own thing,
not a way to impersonate theirs.

## License

MIT
