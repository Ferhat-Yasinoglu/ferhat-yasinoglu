import { describe, expect, it } from "vitest";
import { SettingsStore, type FileIO } from "../src/store.js";

/** A filesystem that lives in a Map, so nothing here touches a disk. */
function memoryIO(seed: Record<string, string> = {}) {
  const files = new Map<string, string>(Object.entries(seed));
  const io: FileIO = {
    read: (file) => {
      const content = files.get(file);
      if (content === undefined) {
        const error = new Error(`ENOENT: ${file}`) as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return content;
    },
    write: (file, content) => void files.set(file, content),
  };
  return { io, files };
}

const FILE = "data/settings.json";

describe("SettingsStore", () => {
  it("is empty and quiet when there is no file yet", () => {
    const { io } = memoryIO();
    const store = new SettingsStore({ dir: "data", env: {}, io });

    expect(store.error).toBeUndefined();
    expect(store.environment()).toEqual({});
  });

  it("lays saved values over the environment", () => {
    const { io } = memoryIO({ [FILE]: JSON.stringify({ IG_USER_ID: "panel-id" }) });
    const store = new SettingsStore({
      dir: "data",
      env: { IG_USER_ID: "env-id", IG_VERIFY_TOKEN: "env-verify" },
      io,
    });

    const env = store.environment();
    expect(env.IG_USER_ID).toBe("panel-id");
    // Untouched keys still come through, so a Fly secret keeps working.
    expect(env.IG_VERIFY_TOKEN).toBe("env-verify");
  });

  it("clears a key when it is saved empty, falling back to the environment", () => {
    const { io } = memoryIO({ [FILE]: JSON.stringify({ IG_USER_ID: "panel-id" }) });
    const store = new SettingsStore({ dir: "data", env: { IG_USER_ID: "env-id" }, io });

    store.save({ IG_USER_ID: "" });

    expect(store.environment().IG_USER_ID).toBe("env-id");
    expect(store.state().find((field) => field.key === "IG_USER_ID")?.source).toBe("ortam");
  });

  it("leaves keys the patch does not mention alone", () => {
    const { io } = memoryIO();
    const store = new SettingsStore({ dir: "data", env: {}, io });

    store.save({ IG_USER_ID: "one", IG_VERIFY_TOKEN: "two" });
    store.save({ IG_USER_ID: "three" });

    expect(store.environment()).toMatchObject({ IG_USER_ID: "three", IG_VERIFY_TOKEN: "two" });
  });

  it("refuses keys outside the writable list", () => {
    const { io } = memoryIO();
    const store = new SettingsStore({ dir: "data", env: {}, io });

    // PORT and BOT_RULES_FILE belong to the host: a panel that could move its
    // own port is a panel that can lock you out of itself.
    store.save({ PORT: "9999", BOT_RULES_FILE: "/etc/passwd" } as never);

    expect(store.environment().PORT).toBeUndefined();
    expect(store.environment().BOT_RULES_FILE).toBeUndefined();
  });

  it("trims values and treats whitespace as empty", () => {
    const { io } = memoryIO();
    const store = new SettingsStore({ dir: "data", env: {}, io });

    store.save({ IG_USER_ID: "  spaced  ", IG_VERIFY_TOKEN: "   " });

    expect(store.environment().IG_USER_ID).toBe("spaced");
    expect(store.environment().IG_VERIFY_TOKEN).toBeUndefined();
  });

  it("survives a corrupt file instead of taking the bot down", () => {
    const { io } = memoryIO({ [FILE]: "{ not json" });
    const store = new SettingsStore({ dir: "data", env: { IG_USER_ID: "env-id" }, io });

    expect(store.error).toContain(FILE);
    // The environment still works, which is what keeps the bot answering.
    expect(store.environment().IG_USER_ID).toBe("env-id");
  });

  it("ignores non-string values in the file rather than coercing them", () => {
    const { io } = memoryIO({ [FILE]: JSON.stringify({ BOT_DRY_RUN: false, IG_USER_ID: 42 }) });
    const store = new SettingsStore({ dir: "data", env: {}, io });

    expect(store.environment().BOT_DRY_RUN).toBeUndefined();
    expect(store.environment().IG_USER_ID).toBeUndefined();
  });

  it("never exposes a secret's value, only its last four characters", () => {
    const { io } = memoryIO();
    const store = new SettingsStore({ dir: "data", env: {}, io });
    store.save({ IG_ACCESS_TOKEN: "EAAG-super-secret-9821", IG_USER_ID: "17841400000000000" });

    const token = store.state().find((field) => field.key === "IG_ACCESS_TOKEN");
    expect(token).toMatchObject({ set: true, source: "panel", hint: "…9821" });
    expect(token).not.toHaveProperty("value");

    // A plain field is safe to show in full — you have to be able to read it
    // back to check it against the Meta dashboard.
    const id = store.state().find((field) => field.key === "IG_USER_ID");
    expect(id).toMatchObject({ set: true, value: "17841400000000000" });
  });

  it("reports where each value came from", () => {
    const { io } = memoryIO({ [FILE]: JSON.stringify({ IG_USER_ID: "panel" }) });
    const store = new SettingsStore({ dir: "data", env: { WA_PHONE_NUMBER_ID: "env" }, io });

    const by = Object.fromEntries(store.state().map((field) => [field.key, field.source]));
    expect(by.IG_USER_ID).toBe("panel");
    expect(by.WA_PHONE_NUMBER_ID).toBe("ortam");
    expect(by.WA_VERIFY_TOKEN).toBe("yok");
  });

  it("restores a snapshot without absorbing environment values", () => {
    const { io } = memoryIO();
    const store = new SettingsStore({ dir: "data", env: { IG_USER_ID: "ortamdan" }, io });
    const before = store.snapshot();

    store.save({ IG_USER_ID: "panelden", WA_ACCESS_TOKEN: "yeni" });
    store.restore(before);

    // Both keys are back where they started: one on the environment, one unset.
    expect(store.state().find((field) => field.key === "IG_USER_ID")).toMatchObject({
      source: "ortam",
      value: "ortamdan",
    });
    expect(store.state().find((field) => field.key === "WA_ACCESS_TOKEN")).toMatchObject({ set: false });
  });

  it("keeps a snapshot immune to later saves", () => {
    const { io } = memoryIO();
    const store = new SettingsStore({ dir: "data", env: {}, io });
    store.save({ IG_USER_ID: "ilk" });

    const before = store.snapshot();
    store.save({ IG_USER_ID: "ikinci" });
    store.restore(before);

    expect(store.environment().IG_USER_ID).toBe("ilk");
  });

  it("writes valid JSON that a later load reads back", () => {
    const { io, files } = memoryIO();
    new SettingsStore({ dir: "data", env: {}, io }).save({ IG_USER_ID: "abc" });

    expect(JSON.parse(files.get(FILE) as string)).toEqual({ IG_USER_ID: "abc" });
    expect(new SettingsStore({ dir: "data", env: {}, io }).environment().IG_USER_ID).toBe("abc");
  });
});
