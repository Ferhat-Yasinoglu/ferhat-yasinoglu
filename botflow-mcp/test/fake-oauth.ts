import express from "express";
import { createHash, randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * An authorization server, small but real enough to authorize against.
 *
 * It does the parts the SDK actually exercises: metadata discovery, dynamic
 * client registration, the authorization-code grant with PKCE, refresh, and
 * client credentials. It verifies rather than waves through — a fake that
 * accepted any code verifier would let a broken PKCE implementation pass.
 */
export type FakeAuthServer = {
  url: string;
  /** Grants it was asked for, in order, so a test can assert the flow taken. */
  grants: string[];
  /** Access tokens currently valid. The resource server checks against this. */
  validTokens: Set<string>;
  /** Registrations it handed out through dynamic client registration. */
  registrations: { client_id: string; redirect_uris: string[] }[];
  clientCredentials: { clientId: string; clientSecret: string };
  /** Make every token it has issued stop working, as expiry would. */
  expireAll(): void;
  close(): Promise<void>;
};

export async function startFakeAuthServer(): Promise<FakeAuthServer> {
  const grants: string[] = [];
  const validTokens = new Set<string>();
  const registrations: { client_id: string; redirect_uris: string[] }[] = [];
  const clientCredentials = { clientId: "fixed-client", clientSecret: "fixed-secret" };

  const codes = new Map<string, { challenge: string; redirectUri: string; clientId: string }>();
  const refreshTokens = new Set<string>();
  const knownClients = new Set<string>([clientCredentials.clientId]);

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  let base = "";

  app.get("/.well-known/oauth-authorization-server", (_req, res) => {
    res.json({
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      registration_endpoint: `${base}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
    });
  });

  app.post("/register", (req, res) => {
    const clientId = `dyn-${randomUUID()}`;
    const redirectUris: string[] = req.body?.redirect_uris ?? [];
    knownClients.add(clientId);
    registrations.push({ client_id: clientId, redirect_uris: redirectUris });
    res.status(201).json({
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: redirectUris,
      grant_types: req.body?.grant_types ?? ["authorization_code", "refresh_token"],
      token_endpoint_auth_method: req.body?.token_endpoint_auth_method ?? "none",
    });
  });

  app.get("/authorize", (req, res) => {
    const { client_id, redirect_uri, response_type, code_challenge, code_challenge_method, state } = req.query as Record<
      string,
      string
    >;

    if (response_type !== "code") return void res.status(400).json({ error: "unsupported_response_type" });
    if (!client_id || !knownClients.has(client_id)) return void res.status(400).json({ error: "invalid_client" });
    if (code_challenge_method !== "S256" || !code_challenge) {
      return void res.status(400).json({ error: "invalid_request", error_description: "PKCE S256 required" });
    }
    if (!redirect_uri) return void res.status(400).json({ error: "invalid_request" });

    const code = randomUUID();
    codes.set(code, { challenge: code_challenge, redirectUri: redirect_uri, clientId: client_id });

    const target = new URL(redirect_uri);
    target.searchParams.set("code", code);
    if (state) target.searchParams.set("state", state);
    res.redirect(302, target.toString());
  });

  app.post("/token", (req, res) => {
    const body = req.body as Record<string, string>;
    const grant = body.grant_type ?? "";
    grants.push(grant);

    const presented = clientAuth(req.headers.authorization, body);

    if (grant === "client_credentials") {
      if (presented.id !== clientCredentials.clientId || presented.secret !== clientCredentials.clientSecret) {
        return void res.status(401).json({ error: "invalid_client" });
      }
      return void res.json(issue({ withRefresh: false }));
    }

    if (grant === "authorization_code") {
      const record = codes.get(body.code ?? "");
      if (!record) return void res.status(400).json({ error: "invalid_grant" });
      codes.delete(body.code!);

      if (challengeFor(body.code_verifier ?? "") !== record.challenge) {
        return void res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
      }
      if (body.redirect_uri !== record.redirectUri) {
        return void res.status(400).json({ error: "invalid_grant", error_description: "redirect_uri mismatch" });
      }
      return void res.json(issue({ withRefresh: true }));
    }

    if (grant === "refresh_token") {
      if (!body.refresh_token || !refreshTokens.has(body.refresh_token)) {
        return void res.status(400).json({ error: "invalid_grant" });
      }
      return void res.json({ ...issue({ withRefresh: false }), refresh_token: body.refresh_token });
    }

    res.status(400).json({ error: "unsupported_grant_type" });
  });

  function issue({ withRefresh }: { withRefresh: boolean }) {
    const accessToken = `at-${randomUUID()}`;
    validTokens.add(accessToken);
    const refreshToken = withRefresh ? `rt-${randomUUID()}` : undefined;
    if (refreshToken) refreshTokens.add(refreshToken);
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
    };
  }

  const server: HttpServer = await new Promise((resolvePromise, reject) => {
    const listening = app.listen(0, "127.0.0.1", () => resolvePromise(listening));
    listening.on("error", reject);
  });
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;

  return {
    url: base,
    grants,
    validTokens,
    registrations,
    clientCredentials,
    expireAll: () => validTokens.clear(),
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    },
  };
}

/** Client credentials arrive either in the body or as HTTP Basic. */
function clientAuth(authorization: string | undefined, body: Record<string, string>): { id?: string; secret?: string } {
  const basic = /^Basic\s+(.+)$/i.exec(authorization?.trim() ?? "");
  if (basic) {
    const [id, secret] = Buffer.from(basic[1]!, "base64").toString("utf8").split(":");
    return { id: decodeURIComponent(id ?? ""), secret: decodeURIComponent(secret ?? "") };
  }
  return { id: body.client_id, secret: body.client_secret };
}

export function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
