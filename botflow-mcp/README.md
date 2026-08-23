# botflow-mcp

Build and run Telegram chatbot funnels from an MCP client.

Connect a bot, describe a flow in plain steps, decide what triggers it, and the
server runs the conversation — asking questions, remembering answers, branching
on buttons, tagging people, and broadcasting to the segments those tags create.
Because it speaks [MCP](https://modelcontextprotocol.io), the whole thing is
driven from a chat with a model rather than a dashboard.

```
you:   connect the bot with token 123456:AA…, then build a welcome funnel
       that asks for a name and splits into "learning" and "business"
model: → connect_bot → create_flow → publish_flow → set_trigger
```

## What it does today

| | |
| --- | --- |
| Telegram | Working. Long-polling, so no public URL or TLS certificate is needed |
| Flows | Working. Messages, questions, inline-button branching, delays, tagging, `goto` |
| Variables | Working. Answers are captured and interpolated as `{{name}}` |
| Triggers | Working. `/start`, keyword, or any-message |
| Broadcasts | Working. AND-segments by tag, with `dry_run` and blocked-user handling |
| Analytics | Working. Subscribers, messages, per-flow completion |
| Storage | SQLite, no external service |
| Instagram / TikTok | Not built. Both need a Meta or TikTok app and their review process |

## Quick start

```bash
npm install
npm test          # 127 tests, no network needed
npm run dev       # http://localhost:3000/mcp
```

Then, from an MCP client, get a bot token from [@BotFather](https://t.me/BotFather)
and call `connect_bot`. The server verifies the token against Telegram, starts
polling for that bot, and everything else becomes available.

To run it the way you would deploy it:

```bash
npm run build
BOTFLOW_API_KEYS="$(openssl rand -hex 32)" BOTFLOW_DB=./botflow.db npm start
```

## How a flow works

A flow is an ordered list of steps. The runner executes them in order until one
needs to wait — for a reply, a button press, or a timer — then parks the run and
picks it up again when the input arrives.

```jsonc
[
  { "type": "message",  "text": "Hey! Welcome aboard." },
  { "type": "question", "text": "What should I call you?", "save_as": "name" },
  { "type": "message",  "text": "Nice to meet you, {{name}}." },
  { "type": "buttons",  "text": "What brings you here?", "save_as": "goal",
    "choices": [
      { "label": "Learning", "goto": 5 },
      { "label": "Business", "goto": 8 }
    ] },
  { "type": "end" },

  { "type": "tag",      "add_tags": ["learner"] },
  { "type": "message",  "text": "Great — I'll send you tutorials." },
  { "type": "end" },

  { "type": "tag",      "add_tags": ["business"] },
  { "type": "message",  "text": "Perfect — I'll send you case studies." }
]
```

Step types: `message`, `question`, `buttons`, `delay`, `tag`, `goto`, `end`.

Flows are validated when they are created, not when they run — a `goto` pointing
past the end, a `buttons` step with duplicate labels, or a negative delay is
rejected up front rather than stranding someone mid-conversation.

A flow starts as a draft. `publish_flow` makes it runnable; editing a published
flow returns it to draft. Runs already in progress finish on the version they
started with, because each run snapshots its steps.

### Two behaviours worth knowing

**An answer beats a trigger.** If the bot just asked "which city?" and the reply
happens to contain a keyword that triggers another flow, the answer wins. The
alternative is people derailing their own funnel by saying an ordinary word.

**Matching ignores case and diacritics.** `İNDİRİM`, `indirim` and `İndirim` all
match the keyword `indirim`, and `gunaydin` matches `günaydın`. This is not what
`toLowerCase()` does on its own — Turkish `İ` lowercases to `i` plus a combining
dot, and dotless `ı` does not decompose at all — so `src/text.ts` handles both
explicitly.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `BOTFLOW_API_KEYS` | *(empty)* | Comma-separated keys accepted as `Authorization: Bearer`. Empty disables auth |
| `BOTFLOW_AUTH_DISABLED` | — | Set to `1` to force auth off. Local only |
| `BOTFLOW_DB` | `botflow.db` | SQLite file. `:memory:` for a throwaway instance |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Listen address |
| `MCP_PATH` | `/mcp` | Endpoint path |
| `TELEGRAM_API_URL` | `https://api.telegram.org` | Override to point at a mock |

Auth is **off** when no keys are configured — fine locally, wrong in public. The
startup banner says which mode it is in, and `/healthz` reports `authRequired`.

Bot tokens are stored in the database in plain text, because the server has to
present them to Telegram on every call. Treat the database file as a secret.

## Connecting a client

**As a remote connector** (needs a public HTTPS URL):

```
https://your-host.example.com/mcp
```

with an API key as the bearer token.

**As a local stdio server:**

```jsonc
{
  "mcpServers": {
    "botflow": {
      "command": "node",
      "args": [
        "--disable-warning=ExperimentalWarning",
        "/path/to/botflow-mcp/dist/src/index.js",
        "--stdio"
      ],
      "env": { "BOTFLOW_DB": "/path/to/botflow.db" }
    }
  }
}
```

## Docker

```bash
docker build -t botflow-mcp .
docker run -p 3000:3000 -v botflow-data:/data -e BOTFLOW_API_KEYS=… botflow-mcp
```

The volume matters: the database holds your bots, flows and subscribers.

## Layout

```
spec/tools.json        the tool surface — names, schemas, descriptions
src/handlers/tools.ts  what each tool actually does
src/engine/steps.ts    step definitions, flow validation, {{variable}} interpolation
src/engine/runner.ts   executes a run until it blocks or ends
src/engine/dispatch.ts routes an incoming Telegram update to a run or a trigger
src/store/             SQLite schema and all data access
src/telegram.ts        Bot API client, with fetch injected so it can be faked
src/worker.ts          long-polls Telegram, wakes runs parked on a delay
src/server.ts          builds the MCP server from the spec
src/http.ts            Streamable HTTP transport + bearer auth
```

The tool surface is loaded from `spec/tools.json` at startup rather than
declared in code, so adding a tool is a schema entry plus a handler. Anything in
the spec without a handler falls back to a stub that answers in the shape its
`outputSchema` declares — useful while sketching a new tool.

## Testing

```bash
npm test
```

127 tests, no network and no real bot token. `test/fake-telegram.ts` stands in
for the Bot API and can be told to fail the way Telegram does — a user blocking
the bot, a rate limit, a revoked token — so the end-to-end tests in
`test/e2e.test.ts` drive real flows over real SQLite through actual MCP tool
calls.

## Requirements

Node 22.5 or newer. The storage layer uses `node:sqlite`, which arrived in
22.5 and still prints an `ExperimentalWarning` when a database is opened. That
warning is emitted while ES modules are being linked, before any application
code runs, so it cannot be silenced from inside the process — the npm scripts
and the Dockerfile pass `--disable-warning=ExperimentalWarning` instead.

## License

MIT
