import { describe, expect, it } from "vitest";
import { authenticate, authFromEnv } from "../src/auth.js";

const config = authFromEnv({ BOTFLOW_API_KEYS: "key-one, key-two" } as NodeJS.ProcessEnv);

describe("authenticate", () => {
  it("accepts a configured key as a bearer token", () => {
    expect(authenticate({ authorization: "Bearer key-one" }, config)).toEqual({ ok: true, apiKey: "key-one" });
  });

  it("accepts the scheme case-insensitively", () => {
    expect(authenticate({ authorization: "bearer key-two" }, config).ok).toBe(true);
  });

  it("accepts the x-api-key header as an alternative", () => {
    expect(authenticate({ "x-api-key": "key-two" }, config)).toEqual({ ok: true, apiKey: "key-two" });
  });

  it("rejects a missing key", () => {
    const result = authenticate({}, config);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe(401);
  });

  it("rejects an unknown key", () => {
    expect(authenticate({ authorization: "Bearer nope" }, config).ok).toBe(false);
  });

  it("rejects a key that is a prefix of a valid one", () => {
    expect(authenticate({ authorization: "Bearer key-on" }, config).ok).toBe(false);
  });

  it("is disabled when no keys are configured", () => {
    const open = authFromEnv({} as NodeJS.ProcessEnv);
    expect(open.disabled).toBe(true);
    expect(authenticate({}, open)).toEqual({ ok: true, apiKey: null });
  });

  it("can be disabled explicitly even with keys present", () => {
    const open = authFromEnv({ BOTFLOW_API_KEYS: "key-one", BOTFLOW_AUTH_DISABLED: "1" } as NodeJS.ProcessEnv);
    expect(authenticate({}, open).ok).toBe(true);
  });
});
