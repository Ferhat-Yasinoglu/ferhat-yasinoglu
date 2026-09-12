/**
 * Sign in to an upstream MCP server that authorizes with OAuth.
 *
 *   npm run login -- --url https://mcp.chatplace.io/mcp
 *
 * Opens the upstream's own sign-in page, catches the redirect on a loopback
 * port, and stores the resulting session so the server can refresh it by itself
 * from then on. Run it once per upstream; after that `npm start` needs nothing.
 *
 * With a client id and secret there is nothing to sign in to — pass them and
 * this only checks that they work:
 *
 *   npm run login -- --url https://… --client-id abc --client-secret shh
 */
import { auth, UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { OAuthError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { FileOAuthProvider, storePathFor, type OAuthSettings } from "../src/oauth.js";
import { nameFromUrl } from "../src/upstream.js";

async function main(argv: string[]): Promise<void> {
  const url = valueOf(argv, "--url") ?? process.env.BOTFLOW_UPSTREAM_URL;
  if (!url) throw new Error("Pass the upstream URL: npm run login -- --url https://mcp.example.com/mcp");

  const serverUrl = new URL(url);
  const name = valueOf(argv, "--name") ?? process.env.BOTFLOW_UPSTREAM_NAME ?? nameFromUrl(serverUrl);
  const storePath = storePathFor(name, valueOf(argv, "--store") ?? process.env.BOTFLOW_OAUTH_STORE);
  const scope = valueOf(argv, "--scope") ?? process.env.BOTFLOW_UPSTREAM_SCOPE;

  const clientId = valueOf(argv, "--client-id") ?? process.env.BOTFLOW_UPSTREAM_CLIENT_ID;
  const clientSecret = valueOf(argv, "--client-secret") ?? process.env.BOTFLOW_UPSTREAM_CLIENT_SECRET;

  if (clientId && clientSecret) {
    await checkClientCredentials({ storePath, settings: { clientId, clientSecret, ...(scope ? { scope } : {}) }, serverUrl, name });
    return;
  }

  await signIn({ storePath, serverUrl, name, port: Number(valueOf(argv, "--port") ?? 0), ...(scope ? { scope } : {}) });
}

/** No browser involved: ask for a token and report whether the pair works. */
async function checkClientCredentials(options: {
  storePath: string;
  settings: OAuthSettings;
  serverUrl: URL;
  name: string;
}): Promise<void> {
  const provider = new FileOAuthProvider(options.storePath, options.settings);
  const result = await auth(provider, { serverUrl: options.serverUrl });
  if (result !== "AUTHORIZED") throw new Error(`Unexpected result from the authorization server: ${result}`);

  console.log(`These client credentials work against ${options.serverUrl}.`);
  console.log(`\nThe token it just fetched is cached in ${options.storePath}, but the server does`);
  console.log(`not need it — it fetches its own at startup. Configure only:`);
  console.log(`  BOTFLOW_UPSTREAM_URL=${options.serverUrl}`);
  console.log(`  BOTFLOW_UPSTREAM_CLIENT_ID=…`);
  console.log(`  BOTFLOW_UPSTREAM_CLIENT_SECRET=…`);
}

/** The interactive half: authorization code with PKCE, redirect on loopback. */
async function signIn(options: {
  storePath: string;
  serverUrl: URL;
  name: string;
  port: number;
  scope?: string;
}): Promise<void> {
  const { callbackUrl, waitForCode, close } = await listenForCallback(options.port);

  const provider = new FileOAuthProvider(options.storePath, {
    redirectUrl: callbackUrl,
    ...(options.scope ? { scope: options.scope } : {}),
    onAuthorizationUrl: (authorizationUrl) => {
      console.log(`Open this in a browser and sign in:\n\n  ${authorizationUrl}\n`);
      console.log(`Waiting for the redirect to ${callbackUrl} …`);
    },
  });

  try {
    const started = await auth(provider, { serverUrl: options.serverUrl });
    if (started === "AUTHORIZED") {
      console.log(`Already authorized. Session is in ${options.storePath}.`);
      return;
    }

    const code = await waitForCode;
    const finished = await auth(provider, { serverUrl: options.serverUrl, authorizationCode: code });
    if (finished !== "AUTHORIZED") throw new Error(`Authorization did not complete: ${finished}`);

    const tokens = provider.tokens();
    console.log(`\nSigned in. Session stored in ${options.storePath} (0600).`);
    if (!tokens?.refresh_token) {
      // Without one, the stored access token expires and there is nothing to
      // renew it with — better to say so now than at 3am.
      console.log(
        `\nWarning: the upstream issued no refresh token, so this will stop working when the\n` +
          `access token expires and you will have to run this again.`,
      );
    }
    console.log(`\nNow start the server with:`);
    console.log(`  BOTFLOW_UPSTREAM_URL=${options.serverUrl} BOTFLOW_UPSTREAM_OAUTH=1 npm start`);
  } catch (cause) {
    if (cause instanceof UnauthorizedError) {
      throw new Error(`${options.serverUrl} refused the authorization: ${cause.message}`, { cause });
    }
    throw cause;
  } finally {
    close();
  }
}

/**
 * A one-shot HTTP server for the redirect.
 *
 * Bound to loopback: the authorization code is a credential, and it has no
 * business travelling anywhere but back to this process.
 */
async function listenForCallback(port: number): Promise<{
  callbackUrl: string;
  waitForCode: Promise<string>;
  close: () => void;
}> {
  let resolveCode: (code: string) => void;
  let rejectCode: (error: Error) => void;
  const waitForCode = new Promise<string>((resolvePromise, reject) => {
    resolveCode = resolvePromise;
    rejectCode = reject;
  });

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const requested = new URL(req.url ?? "/", "http://127.0.0.1");
    if (requested.pathname !== "/callback") {
      res.writeHead(404).end("Not here.");
      return;
    }

    const error = requested.searchParams.get("error");
    const code = requested.searchParams.get("code");
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });

    if (error) {
      res.end(`Authorization failed: ${error}. You can close this tab.`);
      rejectCode(new Error(`The authorization server returned "${error}".`));
      return;
    }
    if (!code) {
      res.end("No authorization code in the redirect. You can close this tab.");
      rejectCode(new Error("The redirect carried no authorization code."));
      return;
    }

    res.end("Signed in. You can close this tab and go back to the terminal.");
    resolveCode(code);
  });

  await new Promise<void>((resolvePromise, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolvePromise());
  });

  const { port: bound } = server.address() as AddressInfo;
  return {
    callbackUrl: `http://127.0.0.1:${bound}/callback`,
    waitForCode,
    close: () => {
      server.closeAllConnections();
      server.close();
    },
  };
}

function valueOf(argv: string[], flag: string): string | undefined {
  const inline = argv.find((a) => a.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(describe(error));
  process.exit(1);
});

/**
 * OAuth errors carry a code and often no message at all, so print the code.
 * "invalid_client" is a bad secret; an empty line is nothing anyone can act on.
 */
function describe(error: unknown): string {
  if (error instanceof OAuthError) {
    return `The authorization server rejected this: ${error.errorCode}${error.message ? ` — ${error.message}` : ""}`;
  }
  if (error instanceof Error) return error.message || String(error);
  return String(error);
}
