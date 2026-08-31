import { describe, expect, it } from "vitest";
import { Auth, readCookie } from "../src/panel/auth.js";

const PASSWORD = "yeterince-uzun-sifre";

describe("Auth", () => {
  it("issues a cookie for the right password and accepts it back", () => {
    const auth = new Auth({ password: PASSWORD });
    const cookie = auth.login(PASSWORD, "1.2.3.4");

    expect(cookie).toBeTruthy();
    expect(auth.valid(cookie)).toBe(true);
  });

  it("refuses the wrong password", () => {
    const auth = new Auth({ password: PASSWORD });
    expect(auth.login("yanlis", "1.2.3.4")).toBeUndefined();
  });

  it("refuses a cookie it did not sign", () => {
    const auth = new Auth({ password: PASSWORD });
    const future = Date.now() + 60_000;

    expect(auth.valid(`${future}.uydurma-imza`)).toBe(false);
    expect(auth.valid(String(future))).toBe(false);
    expect(auth.valid(undefined)).toBe(false);
    expect(auth.valid("")).toBe(false);
  });

  it("refuses a cookie signed with another instance's secret", () => {
    // Which is what makes a restart log everyone out: the secret is new.
    const cookie = new Auth({ password: PASSWORD }).login(PASSWORD, "1.2.3.4");
    expect(new Auth({ password: PASSWORD }).valid(cookie)).toBe(false);
  });

  it("expires a session once its time is up", () => {
    let now = 1_000_000;
    const auth = new Auth({ password: PASSWORD, ttlMs: 1000, now: () => now });
    const cookie = auth.login(PASSWORD, "1.2.3.4");

    expect(auth.valid(cookie)).toBe(true);
    now += 1001;
    expect(auth.valid(cookie)).toBe(false);
  });

  it("locks an address out after repeated failures", () => {
    let now = 1_000_000;
    const auth = new Auth({ password: PASSWORD, maxAttempts: 3, lockoutMs: 5000, now: () => now });

    for (let attempt = 0; attempt < 3; attempt++) auth.login("yanlis", "1.2.3.4");

    expect(auth.lockedFor("1.2.3.4")).toBe(5000);
    // Even the correct password is refused while the lockout holds, otherwise
    // the lockout would only slow down a guesser who was already wrong.
    expect(auth.login(PASSWORD, "1.2.3.4")).toBeUndefined();

    now += 5001;
    expect(auth.lockedFor("1.2.3.4")).toBe(0);
    expect(auth.login(PASSWORD, "1.2.3.4")).toBeTruthy();
  });

  it("locks one address without touching another", () => {
    const auth = new Auth({ password: PASSWORD, maxAttempts: 1, lockoutMs: 5000 });
    auth.login("yanlis", "1.1.1.1");

    expect(auth.lockedFor("1.1.1.1")).toBeGreaterThan(0);
    expect(auth.lockedFor("2.2.2.2")).toBe(0);
  });

  it("lengthens the lockout as failures pile up, but caps it at an hour", () => {
    let now = 1_000_000;
    const auth = new Auth({ password: PASSWORD, maxAttempts: 1, lockoutMs: 1000, now: () => now });

    auth.login("yanlis", "9.9.9.9");
    const first = auth.lockedFor("9.9.9.9");
    now += first + 1;
    auth.login("yanlis", "9.9.9.9");
    const second = auth.lockedFor("9.9.9.9");

    expect(second).toBeGreaterThan(first);

    for (let attempt = 0; attempt < 30; attempt++) {
      now += auth.lockedFor("9.9.9.9") + 1;
      auth.login("yanlis", "9.9.9.9");
    }
    expect(auth.lockedFor("9.9.9.9")).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it("retires a session on logout", () => {
    const auth = new Auth({ password: PASSWORD });
    const cookie = auth.login(PASSWORD, "1.2.3.4");

    auth.revoke(cookie);

    expect(auth.valid(cookie)).toBe(false);
    // A fresh login still works — one session ended, not the password.
    expect(auth.valid(auth.login(PASSWORD, "1.2.3.4"))).toBe(true);
  });

  it("shrugs off a revoke of something that is not a cookie", () => {
    const auth = new Auth({ password: PASSWORD });
    expect(() => {
      auth.revoke(undefined);
      auth.revoke("");
      auth.revoke("nokta-yok");
    }).not.toThrow();
  });

  it("forgets the failures once you get in", () => {
    const auth = new Auth({ password: PASSWORD, maxAttempts: 3, lockoutMs: 5000 });
    auth.login("yanlis", "1.2.3.4");
    auth.login("yanlis", "1.2.3.4");
    auth.login(PASSWORD, "1.2.3.4");

    // Two more failures would have hit the limit had the counter carried over.
    auth.login("yanlis", "1.2.3.4");
    auth.login("yanlis", "1.2.3.4");
    expect(auth.lockedFor("1.2.3.4")).toBe(0);
  });
});

describe("readCookie", () => {
  it("finds one cookie among several", () => {
    expect(readCookie("a=1; reply_bot_panel=abc; b=2", "reply_bot_panel")).toBe("abc");
  });

  it("returns nothing when the header is absent or the name is missing", () => {
    expect(readCookie(undefined, "reply_bot_panel")).toBeUndefined();
    expect(readCookie("a=1", "reply_bot_panel")).toBeUndefined();
  });

  it("does not match a cookie whose name merely ends with the one asked for", () => {
    expect(readCookie("not_reply_bot_panel=abc", "reply_bot_panel")).toBeUndefined();
  });

  it("decodes a percent-encoded value", () => {
    expect(readCookie("x=a%20b", "x")).toBe("a b");
  });
});
