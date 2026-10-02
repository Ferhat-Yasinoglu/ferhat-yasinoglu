import type { OAuthClientProvider, OAuthDiscoveryState } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * OAuth for an upstream MCP server, for the servers that want it instead of a
 * static API key.
 *
 * Two shapes, because a background server and a person at a keyboard need
 * different things:
 *
 *   client_credentials  A client id and secret issued by the upstream. No
 *                       browser, no expiry to babysit — the right fit for a
 *                       server that starts unattended. Configure the pair and
 *                       nothing else is needed.
 *
 *   authorization_code  A person signs in once with `npm run login`, which
 *                       stores the refresh token. From then on the server
 *                       refreshes it by itself. This is the flow to use when
 *                       the upstream only issues user credentials.
 *
 * Everything else — discovering the authorization server, registering a client
 * when the upstream supports it, PKCE, refreshing on a 401 — is the SDK's
 * `auth()` and the transport's doing. What lives here is where the results are
 * kept and which grant to ask for.
 */

/** What the token file holds. All of it is secret. */
type StoredSession = {
  clientInformation?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  codeVerifier?: string;
  discovery?: OAuthDiscoveryState;
  /**
   * The redirect the session was granted against. Kept because the running
   * server has no callback listener of its own, and a provider that reports no
   * redirect URL at all is read by the SDK as a non-interactive grant — which
   * would take the refresh path away from a session that has a refresh token.
   */
  redirectUrl?: string;
};

export type OAuthSettings = {
  /** Pre-issued credentials. Both present selects the client_credentials grant. */
  clientId?: string;
  clientSecret?: string;
  scope?: string;
  /**
   * Where the redirect lands during an interactive login. Absent means this
   * provider is non-interactive, which is what tells the SDK to use
   * client_credentials rather than starting a browser flow.
   */
  redirectUrl?: string;
  /** Called with the URL a person has to open. Only used by `npm run login`. */
  onAuthorizationUrl?: (url: URL) => void | Promise<void>;
};

export const DEFAULT_STORE_DIR = ".botflow-oauth";

/** Where `npm run login` listens unless told otherwise. */
export const DEFAULT_REDIRECT_URL = "http://127.0.0.1:8765/callback";

/** One file per upstream, named after it rather than after its URL. */
export function storePathFor(name: string, dir: string = process.env.BOTFLOW_OAUTH_STORE ?? DEFAULT_STORE_DIR): string {
  return resolve(dir, `${name.replace(/[^A-Za-z0-9_-]/g, "_")}.json`);
}

/**
 * An `OAuthClientProvider` that keeps its session in a file.
 *
 * The file holds a refresh token, which is a long-lived credential — it is
 * written 0600 inside a 0700 directory, and replaced atomically so a crash
 * mid-write cannot leave a half-written session behind.
 */
export class FileOAuthProvider implements OAuthClientProvider {
  readonly storePath: string;

  #settings: OAuthSettings;
  #session: StoredSession | null = null;

  constructor(storePath: string, settings: OAuthSettings = {}) {
    this.storePath = storePath;
    this.#settings = settings;
  }

  /** True when this provider can get a token with no person involved. */
  get isClientCredentials(): boolean {
    return Boolean(this.#settings.clientId && this.#settings.clientSecret);
  }

  get redirectUrl(): string | undefined {
    // A missing redirect URL is how the SDK is told to use a non-interactive
    // grant, so only client_credentials may leave it out. Everything else
    // reports the redirect the stored session was granted against.
    if (this.isClientCredentials) return undefined;
    return this.#settings.redirectUrl ?? this.#read().redirectUrl ?? DEFAULT_REDIRECT_URL;
  }

  /** Whether there is anything stored worth trying to authorize with. */
  get hasSession(): boolean {
    return this.#read().tokens !== undefined;
  }

  get clientMetadata(): OAuthClientMetadata {
    const redirect = this.redirectUrl;
    return {
      client_name: "botflow-mcp",
      redirect_uris: redirect ? [redirect] : [],
      grant_types: this.isClientCredentials ? ["client_credentials"] : ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: this.#settings.clientSecret ? "client_secret_post" : "none",
      ...(this.#settings.scope ? { scope: this.#settings.scope } : {}),
    };
  }

  clientInformation(): OAuthClientInformationMixed | undefined {
    const { clientId, clientSecret } = this.#settings;
    // Credentials from configuration win: an upstream that issued them is not
    // expecting us to register a second client behind its back.
    if (clientId) {
      return { client_id: clientId, ...(clientSecret ? { client_secret: clientSecret } : {}) };
    }
    return this.#read().clientInformation;
  }

  saveClientInformation(clientInformation: OAuthClientInformationMixed): void {
    this.#write({ clientInformation });
  }

  tokens(): OAuthTokens | undefined {
    return this.#read().tokens;
  }

  saveTokens(tokens: OAuthTokens): void {
    // Record the redirect alongside the tokens: this is the moment a session
    // becomes real, and the running server has to report the same one later.
    // The code verifier has done its job by now and is dropped with it.
    this.#write({
      tokens,
      codeVerifier: undefined,
      ...(this.#settings.redirectUrl ? { redirectUrl: this.#settings.redirectUrl } : {}),
    });
  }

  codeVerifier(): string {
    const verifier = this.#read().codeVerifier;
    if (!verifier) throw new Error(`No PKCE verifier saved in ${this.storePath}. Start the login again.`);
    return verifier;
  }

  saveCodeVerifier(codeVerifier: string): void {
    this.#write({ codeVerifier });
  }

  discoveryState(): OAuthDiscoveryState | undefined {
    return this.#read().discovery;
  }

  saveDiscoveryState(discovery: OAuthDiscoveryState): void {
    this.#write({ discovery });
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    if (!this.#settings.onAuthorizationUrl) {
      // Reached when a server with no stored session starts up. There is nobody
      // to send to a browser, so say what would fix it instead of hanging.
      throw new Error(
        `This upstream wants a person to sign in, and no session is stored in ${this.storePath}. ` +
          `Run \`npm run login -- --url <upstream url>\` once, or configure a client id and secret ` +
          `for the client_credentials grant.`,
      );
    }
    await this.#settings.onAuthorizationUrl(authorizationUrl);
  }

  /**
   * Ask for a client_credentials token.
   *
   * Returning nothing leaves the SDK on its default authorization_code path,
   * which is what the interactive flow wants.
   */
  prepareTokenRequest(scope?: string): URLSearchParams | undefined {
    if (!this.isClientCredentials) return undefined;
    const params = new URLSearchParams({ grant_type: "client_credentials" });
    const wanted = scope ?? this.#settings.scope;
    if (wanted) params.set("scope", wanted);
    return params;
  }

  /** Called by the SDK when the upstream rejects what we hold. */
  invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery"): void {
    const session = this.#read();
    const next: StoredSession =
      scope === "all"
        ? {}
        : {
            ...session,
            ...(scope === "client" ? { clientInformation: undefined } : {}),
            ...(scope === "tokens" ? { tokens: undefined } : {}),
            ...(scope === "verifier" ? { codeVerifier: undefined } : {}),
            ...(scope === "discovery" ? { discovery: undefined } : {}),
          };
    this.#replace(next);
  }

  #read(): StoredSession {
    if (this.#session) return this.#session;
    try {
      this.#session = JSON.parse(readFileSync(this.storePath, "utf8")) as StoredSession;
    } catch {
      // No file yet, or one we cannot parse. Either way there is no session.
      this.#session = {};
    }
    return this.#session;
  }

  #write(patch: Partial<StoredSession>): void {
    this.#replace({ ...this.#read(), ...patch });
  }

  #replace(session: StoredSession): void {
    this.#session = session;
    const dir = dirname(this.storePath);
    mkdirSync(dir, { recursive: true, mode: 0o700 });

    // Write beside the target and rename, so a reader never sees a partial file.
    const temporary = join(dir, `.${Date.now()}-${process.pid}.tmp`);
    writeFileSync(temporary, `${JSON.stringify(session, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, this.storePath);
    chmodSync(this.storePath, 0o600);
  }
}
