# The tool spec

`tools.json` is the tool surface the server exposes. It is loaded at startup;
no tool is declared in code. Adding a tool means adding an entry here and a
handler in `src/handlers/tools.ts`.

`source.origin` says where the surface came from:

- `authored` — hand-written for this product. That is what ships here.
- `imported` — read off a live MCP server with `npm run probe`, matching it
  one-to-one.
- `placeholder` — a guess at some other server's shape with nothing behind it.
  Reported loudly so it is never mistaken for the real thing.

## Format

```jsonc
{
  "source":     { "origin": "authored", "note": "..." },
  "serverInfo": { "name": "botflow-mcp", "version": "0.1.0", "title": "Botflow" },
  "instructions": "shown to the model when it connects",

  "tools": [
    {
      "name": "list_bots",
      "title": "List connected bots",
      "description": "...",
      "inputSchema":  { "type": "object", "properties": { ... }, "required": [ ... ] },
      "outputSchema": { "type": "object", "properties": { ... } },   // optional
      "annotations":  { "readOnlyHint": true }                        // optional
    }
  ],

  // All three below are optional. Their PRESENCE decides which capabilities the
  // handshake advertises, so leave them out entirely if there are none.
  "prompts":           [ { "name": "...", "arguments": [ ... ] } ],
  "resources":         [ { "uri": "...", "name": "...", "text": "..." } ],
  "resourceTemplates": [ { "uriTemplate": "...", "name": "..." } ]
}
```

`inputSchema` must be an object schema — MCP requires it, and the loader rejects
anything else.

`outputSchema` is optional but worth writing. Arguments are validated against
`inputSchema` before a handler sees them, defaults are filled in, and a tool with
no handler yet falls back to a stub that synthesizes a response matching
`outputSchema` — so a tool can be designed and exercised before it is built.

An **empty array is not the same as an absent key**. `"prompts": []` means "this
server supports prompts and currently has none"; omitting `prompts` means "this
server does not support prompts at all". They produce different handshakes, so
the loader preserves the distinction.

## Importing a surface from another server

The spec loader can also take a surface from a running MCP server, which is
useful for mirroring an existing API or for testing against one:

```bash
npm run probe -- --url https://some-server.example.com/mcp --key "$KEY"
```

That connects as a real MCP client, reads `tools/list` — plus `prompts/list` and
`resources/list` when the handshake advertises them — and rewrites this file with
`source.origin: "imported"`.

When the machine running this cannot reach the source, capture the response
somewhere that can and import it:

```bash
curl -sS https://some-server.example.com/mcp \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' > tools-list.json

npm run import-spec -- tools-list.json
```

The importer accepts the full JSON-RPC envelope, a bare `result`, a
`{"tools":[...]}` object, or an SSE-framed response.

Round-trip fidelity is covered by a test: `test/http.test.ts` probes the running
server and asserts the result deep-equals the spec it was handed.
