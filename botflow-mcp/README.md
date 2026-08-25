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
| Broadcasts | Working. Background jobs, rate-limited, resumable. AND-segments by tag, with `dry_run` |
| Analytics | Working. Subscribers, messages, per-flow completion |
| Storage | SQLite, no external service, migrated in place on upgrade |
| Upstream servers | Working. Another MCP server's tools, prompts and resources can be republished through this one |
| Instagram / TikTok | Not built. Both need a Meta or TikTok app and their review process |

## Quick start

```bash
npm install
npm test          # 199 tests, no network needed
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

### Behaviours worth knowing

**An answer beats a trigger.** If the bot just asked "which city?" and the reply
happens to contain a keyword that triggers another flow, the answer wins. The
alternative is people derailing their own funnel by saying an ordinary word.

**A trigger that does fire supersedes the running flow.** When nothing is being
asked and a trigger matches, the previous run is closed rather than left open.
Two live runs would compete for the next reply, and the loser's question would
sit unanswered forever.

**Old buttons stop working once you move on.** Telegram leaves inline keyboards
tappable indefinitely, so each button carries the step it belongs to. Tapping a
button from a question already answered does nothing, instead of applying that
answer to whatever is being asked now.

**A reply matching no choice re-asks the question.** It is not stored as if it
were a choice, and the flow does not advance past a question nobody answered.

**Matching ignores case and diacritics.** `İNDİRİM`, `indirim` and `İndirim` all
match the keyword `indirim`, and `gunaydin` matches `günaydın`. This is not what
`toLowerCase()` does on its own — Turkish `İ` lowercases to `i` plus a combining
dot, and dotless `ı` does not decompose at all — so `src/text.ts` handles both
explicitly.

**Broadcasts do not send inline.** Telegram caps bulk delivery at roughly 30
messages per second, so twenty thousand subscribers is about eleven minutes of
wall clock. `broadcast` queues the job and returns; delivery runs in the
background at that pace, checkpointing after every send. Poll `get_broadcast`
for progress. A restart resumes from the checkpoint rather than messaging the
first few thousand people twice.

The recipient list is frozen when the job is queued, so someone tagged into the
segment mid-flight is not included and nobody is messaged twice. Anyone who
blocks the bot before their turn comes is skipped and counted as failed.

## Borrowing another server's surface

This server can also be an MCP *client*. Point it at another server and its
tools, prompts and resources join the ones this server advertises, forwarded
call by call:

```bash
BOTFLOW_UPSTREAM_URL=https://mcp.chatplace.io/mcp \
BOTFLOW_UPSTREAM_KEY=… \
npm start
```

```
upstream chatplace: <n> tool(s), <n> prompt(s), <n> resource(s) from https://mcp.chatplace.io/mcp
botflow-mcp listening on http://0.0.0.0:3000/mcp
  tools:  20 + <n>
  from:   chatplace → https://mcp.chatplace.io/mcp
```

Nothing about that server is written down here. Its surface is read at startup
from `tools/list`, so its schemas, titles and descriptions are whatever it says
they are today — the opposite of `npm run probe`, which copies a surface into
`spec/tools.json` once and serves that copy.

All three halves come across. Tools and prompts are namespaced —
`chatplace_send_message` — from `BOTFLOW_UPSTREAM_NAME` or the hostname, and a
name that would collide with something this server serves itself is skipped
rather than allowed to shadow it. Set `BOTFLOW_UPSTREAM_PREFIX` to choose the
prefix, or to an empty string for none. Resources keep their own URIs, prefix or
no prefix, because a URI already identifies a thing globally; a resource
template is matched by shape, so `notes://{id}` sends `notes://7` upstream too.
For several upstreams at once, set `BOTFLOW_UPSTREAMS` to a JSON array of
`{name, url, apiKey, prefix, timeoutMs}`.

Whatever an upstream does not offer stays absent rather than empty, so this
server never advertises a capability on its behalf that it cannot serve.

Arguments are validated against the upstream's own schema before the call leaves
this process, and its result — content, structured output, errors — is passed
back untouched. Resource content is read from the upstream every time rather
than copied here, so the two cannot drift apart. `/healthz` lists each upstream
and whether it is currently connected.

An upstream that is down at startup is reported and skipped; this server's own
tools still come up. The connection is opened lazily and reopened if it drops,
so an idle connector closing its stream costs one reconnect rather than a failed
call.

One key holds for every caller. The upstream credential lives in this server's
environment, so anyone who can reach this endpoint can spend it — configure
`BOTFLOW_API_KEYS` before attaching an upstream to a server anyone else can
reach.

### When the upstream wants OAuth

Not every server issues API keys. For the ones that authorize with OAuth there
are two ways in, and which one you use is decided by what the upstream gives
you.

**A client id and secret** — nothing to sign in to, which is what a server that
starts unattended wants:

```bash
BOTFLOW_UPSTREAM_URL=https://mcp.chatplace.io/mcp \
BOTFLOW_UPSTREAM_CLIENT_ID=… \
BOTFLOW_UPSTREAM_CLIENT_SECRET=… \
npm start
```

It fetches its own token at startup and again whenever one expires. Check a pair
before deploying it with `npm run login -- --url … --client-id … --client-secret …`.

**A sign-in page** — a person authorizes once, and the server carries the
session from then on:

```bash
npm run login -- --url https://mcp.chatplace.io/mcp
# opens the upstream's sign-in page, catches the redirect on 127.0.0.1
BOTFLOW_UPSTREAM_URL=https://mcp.chatplace.io/mcp BOTFLOW_UPSTREAM_OAUTH=1 npm start
```

`login` registers a client if the upstream supports it, does the authorization
code exchange with PKCE, and writes the session to `.botflow-oauth/<name>.json`
(0600, and git-ignored). The server refreshes the token by itself after that;
the login is only needed again if the upstream revokes it or issued no refresh
token in the first place — `login` says so at the time if it did not.

Both paths use the SDK's own OAuth client, so discovery, dynamic registration
and refresh-on-401 are the standard behaviour rather than something invented
here. `/healthz` reports which mode each upstream is in.

That session file is a credential. It holds a refresh token in the clear, so it
belongs on the same footing as the database: back it up like a secret, and mount
it as one in a container.

## Upgrading

The database migrates itself in place on startup, tracked in SQLite's own
`PRAGMA user_version`. Migrations live in `src/store/schema.ts` as an ordered
list; each runs in a transaction, so a failure leaves the version untouched
rather than half-applied. Never edit a migration that has shipped — append a new
one, or existing databases will disagree with the code reading them.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `BOTFLOW_API_KEYS` | *(empty)* | Comma-separated keys accepted as `Authorization: Bearer`. Empty disables auth |
| `BOTFLOW_AUTH_DISABLED` | — | Set to `1` to force auth off. Local only |
| `BOTFLOW_DB` | `botflow.db` | SQLite file. `:memory:` for a throwaway instance |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Listen address |
| `MCP_PATH` | `/mcp` | Endpoint path |
| `TELEGRAM_API_URL` | `https://api.telegram.org` | Override to point at a mock |
| `BOTFLOW_UPSTREAM_URL` | — | Another MCP server whose surface is republished here |
| `BOTFLOW_UPSTREAM_KEY` | — | Bearer token for that server |
| `BOTFLOW_UPSTREAM_NAME` / `_PREFIX` | *(from the host)* | Namespace for its tools |
| `BOTFLOW_UPSTREAMS` | — | JSON array, for more than one upstream |
| `BOTFLOW_UPSTREAM_OAUTH` | — | `1` to authorize with a session from `npm run login` |
| `BOTFLOW_UPSTREAM_CLIENT_ID` / `_SECRET` | — | OAuth client credentials. Setting them implies OAuth |
| `BOTFLOW_UPSTREAM_SCOPE` | — | Scope to ask the authorization server for |
| `BOTFLOW_OAUTH_STORE` | `.botflow-oauth` | Directory holding upstream OAuth sessions |

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

The volume matters: the database holds your bots, flows and subscribers, and
`/data/oauth` holds any upstream sessions. Lose it and you are reconnecting bots
and signing in again.

## Layout

```
spec/tools.json        the tool surface — names, schemas, descriptions
src/handlers/tools.ts  what each tool actually does
src/engine/steps.ts    step definitions, flow validation, {{variable}} interpolation
src/engine/runner.ts   executes a run until it blocks or ends
src/engine/dispatch.ts routes an incoming Telegram update to a run or a trigger
src/store/             SQLite schema, migrations, and all data access
src/upstream.ts        MCP client for another server, and how its surface joins ours
src/oauth.ts           OAuth for an upstream: which grant, and where the session lives
src/handlers/index.ts  the registry a server answers from: tools, prompts, resources
src/telegram.ts        Bot API client, with fetch injected so it can be faked
src/broadcast.ts       paced, resumable background delivery
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

199 tests, no network and no real bot token. `test/fake-telegram.ts` stands in
for the Bot API and can be told to fail the way Telegram does — a user blocking
the bot, a rate limit, a revoked token — so the end-to-end tests in
`test/e2e.test.ts` drive real flows over real SQLite through actual MCP tool
calls.

`test/upstream.test.ts` does the same for the client side: it stands a second
instance of this server up on a loopback port, points the upstream client at it,
and forwards tool calls, prompts and resource reads through both — the same
Streamable HTTP a hosted connector speaks, over a real socket. The two get
separate handler registries, because sharing one in a single process would have
each forward to the other for ever.

`test/oauth.test.ts` puts a real authorization server (`test/fake-oauth.ts`) on
a third port and makes the client earn its token: discovery, dynamic
registration, PKCE — verified, not waved through — the code exchange, and a
refresh after the tokens are expired underneath a running client.

## Requirements

Node 22.5 or newer. The storage layer uses `node:sqlite`, which arrived in
22.5 and still prints an `ExperimentalWarning` when a database is opened. That
warning is emitted while ES modules are being linked, before any application
code runs, so it cannot be silenced from inside the process — the npm scripts
and the Dockerfile pass `--disable-warning=ExperimentalWarning` instead.

## License

MIT
