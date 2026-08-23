import { timingSafeEqual } from "node:crypto";

/**
 * ChatPlace authenticates its MCP connector with an API key the user generates
 * in their account and can revoke at any time. We mirror that: a bearer token
 * checked against a configured allowlist.
 */

export type AuthConfig = {
  /** Accepted API keys. Empty means auth is disabled. */
  keys: Set<string>;
  disabled: boolean;
};

export function authFromEnv(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const keys = new Set(
    (env.CHATPLACE_API_KEYS ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  );
  const disabled = env.CHATPLACE_AUTH_DISABLED === "1" || keys.size === 0;
  return { keys, disabled };
}

export type AuthResult = { ok: true; apiKey: string | null } | { ok: false; status: 401; message: string };

export function authenticate(headers: Record<string, unknown>, config: AuthConfig): AuthResult {
  if (config.disabled) return { ok: true, apiKey: null };

  const presented = readBearer(headers) ?? readApiKeyHeader(headers);
  if (!presented) {
    return { ok: false, status: 401, message: "Missing API key. Send it as `Authorization: Bearer <key>`." };
  }
  for (const known of config.keys) {
    if (constantTimeEqual(presented, known)) return { ok: true, apiKey: presented };
  }
  return { ok: false, status: 401, message: "Invalid API key." };
}

function readBearer(headers: Record<string, unknown>): string | null {
  const raw = headerValue(headers, "authorization");
  if (!raw) return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match ? match[1]!.trim() : null;
}

function readApiKeyHeader(headers: Record<string, unknown>): string | null {
  return headerValue(headers, "x-api-key");
}

function headerValue(headers: Record<string, unknown>, name: string): string | null {
  // Node lowercases incoming header names, but be tolerant of hand-built objects.
  const direct = headers[name] ?? headers[name.toLowerCase()];
  const value = direct ?? Object.entries(headers).find(([k]) => k.toLowerCase() === name)?.[1];
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : null;
  return typeof value === "string" ? value : null;
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch, so compare lengths separately.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
