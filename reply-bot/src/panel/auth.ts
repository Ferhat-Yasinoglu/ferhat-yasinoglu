/**
 * The lock on the panel.
 *
 * The panel can read and write Meta access tokens, so the whole of it sits
 * behind one password. There is no user list and no signup: this is one
 * person's bot, and every account system I could add here would be a bigger
 * surface than the thing it guards.
 *
 * Rules the rest of the panel relies on:
 *
 *   - No `PANEL_PASSWORD`, no panel. It is not mounted at all, so a deployment
 *     that never sets one cannot be reached even by guessing.
 *   - The password is compared in constant time. A byte-at-a-time comparison
 *     leaks its length and prefix to anyone patient enough to measure.
 *   - The session cookie is an HMAC over an expiry, signed with a secret made
 *     fresh at boot. Nothing is stored server-side, and a restart logs you out.
 *   - Failed attempts are counted per address and locked out with a growing
 *     delay, so a short password is not simply enumerated.
 *   - Writes require a header no cross-site form can set, which together with
 *     SameSite is what keeps another page from driving the panel through your
 *     browser.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "reply_bot_panel";
/** Any mutating request must carry this; a cross-origin <form> cannot add it. */
export const CSRF_HEADER = "x-reply-bot-panel";

export type AuthOptions = {
  password: string;
  /** How long a session lasts. */
  ttlMs?: number;
  /** Fresh per boot unless a test pins it. */
  secret?: Buffer;
  now?: () => number;
  /** Failed attempts from one address before it is locked out. */
  maxAttempts?: number;
  /** Base lockout, doubled for each further failure past the limit. */
  lockoutMs?: number;
};

type Attempt = { failures: number; until: number };

export class Auth {
  private readonly password: Buffer;
  private readonly secret: Buffer;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly maxAttempts: number;
  private readonly lockoutMs: number;
  private readonly attempts = new Map<string, Attempt>();
  /**
   * Sessions ended by pressing "çıkış". A signed cookie is otherwise valid
   * until it expires, so without this, logging out on a borrowed laptop would
   * only hide the cookie rather than retire it. Keyed by signature and swept
   * once the underlying expiry has passed, so it cannot grow without bound.
   */
  private readonly revoked = new Map<string, number>();

  constructor(options: AuthOptions) {
    this.password = Buffer.from(options.password, "utf8");
    this.secret = options.secret ?? randomBytes(32);
    this.ttlMs = options.ttlMs ?? 12 * 60 * 60 * 1000;
    this.now = options.now ?? Date.now;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.lockoutMs = options.lockoutMs ?? 30_000;
  }

  /** Milliseconds left on a lockout for this address, 0 when it may try. */
  lockedFor(address: string): number {
    const attempt = this.attempts.get(address);
    if (!attempt) return 0;
    const left = attempt.until - this.now();
    return left > 0 ? left : 0;
  }

  /**
   * Check a password. Returns a cookie value on success. A locked-out address
   * gets `undefined` without the password being looked at, so waiting out the
   * lockout is the only way forward.
   */
  login(candidate: string, address: string): string | undefined {
    if (this.lockedFor(address) > 0) return undefined;

    if (!this.matches(candidate)) {
      this.fail(address);
      return undefined;
    }

    this.attempts.delete(address);
    return this.issue();
  }

  private matches(candidate: string): boolean {
    const given = Buffer.from(candidate ?? "", "utf8");
    // timingSafeEqual throws on a length mismatch, which would itself be a
    // timing signal; both sides are hashed to a fixed width first.
    const a = createHmac("sha256", this.secret).update(given).digest();
    const b = createHmac("sha256", this.secret).update(this.password).digest();
    return timingSafeEqual(a, b);
  }

  private fail(address: string): void {
    const attempt = this.attempts.get(address) ?? { failures: 0, until: 0 };
    attempt.failures++;
    if (attempt.failures >= this.maxAttempts) {
      const over = attempt.failures - this.maxAttempts;
      // Doubling, but capped: an hour is already "come back later", and an
      // unbounded delay would let one attacker lock the owner out for a week.
      const wait = Math.min(this.lockoutMs * 2 ** over, 60 * 60 * 1000);
      attempt.until = this.now() + wait;
    }
    this.attempts.set(address, attempt);
  }

  private issue(): string {
    const expires = this.now() + this.ttlMs;
    // The nonce is what makes two sessions distinct. Without it the payload is
    // just an expiry, so two logins in the same millisecond are the same
    // cookie — and logging out of one would log out of the other.
    const payload = `${expires}.${randomBytes(9).toString("base64url")}`;
    return `${payload}.${this.sign(payload)}`;
  }

  /** Whether a cookie value is one we issued, unexpired and not logged out. */
  valid(cookie: string | undefined): boolean {
    if (!cookie) return false;
    const dot = cookie.lastIndexOf(".");
    if (dot <= 0) return false;

    const payload = cookie.slice(0, dot);
    const signature = cookie.slice(dot + 1);
    const expected = this.sign(payload);
    if (signature.length !== expected.length) return false;
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;

    const expires = expiryOf(payload);
    if (expires === undefined || expires <= this.now()) return false;
    return !this.revoked.has(signature);
  }

  /** End a session for good, not just in the browser that held it. */
  revoke(cookie: string | undefined): void {
    if (!cookie) return;
    const dot = cookie.lastIndexOf(".");
    if (dot <= 0) return;

    const expires = expiryOf(cookie.slice(0, dot));
    if (expires === undefined) return;
    this.revoked.set(cookie.slice(dot + 1), expires);

    // An entry is only useful until the cookie would have expired anyway.
    const now = this.now();
    for (const [signature, until] of this.revoked) {
      if (until <= now) this.revoked.delete(signature);
    }
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.secret).update(payload).digest("base64url");
  }

  get maxAgeSeconds(): number {
    return Math.floor(this.ttlMs / 1000);
  }
}

/** The expiry out of an `expires.nonce` payload, or nothing if it is malformed. */
function expiryOf(payload: string): number | undefined {
  const dot = payload.indexOf(".");
  const expires = Number(dot === -1 ? payload : payload.slice(0, dot));
  return Number.isFinite(expires) ? expires : undefined;
}

/** Read one cookie out of a Cookie header without pulling in a parser. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}
