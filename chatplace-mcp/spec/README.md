# The tool spec

`tools.json` is the entire tool surface this server exposes. The runtime reads it
at startup; no code lists tools. Swapping this file swaps what the server is.

## What is in here right now

A **placeholder**. `source.origin` says `"placeholder"`, which means the tool
names and schemas were reconstructed from public descriptions of ChatPlace
(Instagram / Telegram / TikTok chatbots, funnels, carousels, broadcasts). They
are a reasonable guess at the shape, **not a measurement of the real server**.
Do not assume any name here matches `mcp.chatplace.io/mcp`.

## Making it exact

Two routes, depending on whether the machine can reach the source server.

### 1. Direct probe

```bash
npm run probe -- --url https://mcp.chatplace.io/mcp --key "$CHATPLACE_API_KEY"
```

Connects as a real MCP client, calls `tools/list`, and rewrites `tools.json`
with `source.origin: "imported"`. Also drops `tools.raw.json` beside it (git
ignored) so later imports can be diffed against the first one.

### 2. Import a captured response

When the clone's host is firewalled off from the source, capture the response
anywhere that can reach it:

```bash
curl -sS https://mcp.chatplace.io/mcp \
  -H "Authorization: Bearer $CHATPLACE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' > tools-list.json
```

Then feed it in:

```bash
npm run import-spec -- tools-list.json
```

The importer accepts the full JSON-RPC envelope, a bare `result` object, a
`{"tools":[...]}` object, or an SSE-framed (`text/event-stream`) response, so a
copy-pasted curl result works as-is.

Some servers require an `initialize` handshake before `tools/list`. If the curl
above returns an error about session state, use route 1 instead — the SDK client
does the handshake for you.

## Format

```jsonc
{
  "source":     { "origin": "placeholder" | "imported", "server": "...", "importedAt": "..." },
  "serverInfo": { "name": "...", "version": "...", "title": "..." },
  "instructions": "shown to the model when it connects",
  "tools": [
    {
      "name": "list_channels",
      "title": "List connected channels",
      "description": "...",
      "inputSchema":  { "type": "object", "properties": { ... }, "required": [ ... ] },
      "outputSchema": { "type": "object", "properties": { ... } },   // optional
      "annotations":  { "readOnlyHint": true }                        // optional
    }
  ]
}
```

`inputSchema` must be an object schema — MCP requires it, and the loader rejects
anything else. `outputSchema` is optional but worth keeping: the stub handler
uses it to synthesize structurally valid sample responses, so an unimplemented
tool still answers in the right shape.
