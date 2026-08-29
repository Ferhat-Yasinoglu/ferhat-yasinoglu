import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, loadRules, missingForServe } from "../src/config.js";

const dir = mkdtempSync(join(tmpdir(), "reply-bot-"));

function write(name: string, contents: string): string {
  const path = join(dir, name);
  writeFileSync(path, contents);
  return path;
}

describe("loadConfig", () => {
  it("configures no channel from an empty environment", () => {
    const config = loadConfig({});
    expect(config).toMatchObject({ port: 3000, rulesFile: "rules.json", model: "claude-opus-5" });
    expect(config.instagram).toBeUndefined();
    expect(config.whatsapp).toBeUndefined();
  });

  it("turns a channel on as soon as it has credentials of its own", () => {
    const config = loadConfig({ WA_ACCESS_TOKEN: "t", WA_PHONE_NUMBER_ID: "p1", WA_VERIFY_TOKEN: "v" });

    expect(config.instagram).toBeUndefined();
    expect(config.whatsapp).toMatchObject({
      phoneNumberId: "p1",
      path: "/webhook/whatsapp",
      windowHours: 24,
    });
  });

  it("runs both channels side by side", () => {
    const config = loadConfig({
      IG_ACCESS_TOKEN: "t",
      IG_USER_ID: "ig1",
      IG_VERIFY_TOKEN: "v",
      WA_ACCESS_TOKEN: "t",
      WA_PHONE_NUMBER_ID: "p1",
      WA_VERIFY_TOKEN: "v",
      WA_WINDOW_HOURS: "12",
    });

    expect(config.instagram?.path).toBe("/webhook/instagram");
    expect(config.whatsapp?.windowHours).toBe(12);
  });

  it("reads the shared settings", () => {
    const config = loadConfig({ PORT: "8080", BOT_DRY_RUN: "1", BOT_MAX_REPLY_CHARS: "140" });
    expect(config).toMatchObject({ port: 8080, dryRun: true, maxChars: 140 });
  });
});

describe("missingForServe", () => {
  it("asks for a channel when none is configured", () => {
    expect(missingForServe(loadConfig({})).join(" ")).toMatch(/en az bir kanal/);
  });

  it("names what each configured channel still needs", () => {
    const config = loadConfig({ IG_VERIFY_TOKEN: "v", WA_VERIFY_TOKEN: "v" });
    expect(missingForServe(config)).toEqual([
      "IG_ACCESS_TOKEN",
      "IG_USER_ID",
      "WA_ACCESS_TOKEN",
      "WA_PHONE_NUMBER_ID",
    ]);
  });

  it("asks only for the verify token in a dry run, since nothing is sent", () => {
    const config = loadConfig({ IG_ACCESS_TOKEN: "t", BOT_DRY_RUN: "1" });
    expect(missingForServe(config)).toEqual(["IG_VERIFY_TOKEN"]);
  });

  it("is happy once one channel is complete", () => {
    const config = loadConfig({ WA_ACCESS_TOKEN: "t", WA_PHONE_NUMBER_ID: "p1", WA_VERIFY_TOKEN: "v" });
    expect(missingForServe(config)).toEqual([]);
  });
});

describe("loadRules", () => {
  it("points a first-time user at the example file", () => {
    expect(() => loadRules(join(dir, "nope.json"))).toThrow(/cp rules.example.json/);
  });

  it("names the file when the JSON is broken", () => {
    expect(() => loadRules(write("broken.json", "{ not json"))).toThrow(/broken\.json/);
  });

  it("names the file when a rule is invalid", () => {
    const path = write("invalid.json", JSON.stringify([{ name: "x", keywords: ["a"] }]));
    expect(() => loadRules(path)).toThrow(/invalid\.json: x: needs reply/);
  });

  it("rejects a rule scoped to a channel that does not exist", () => {
    const path = write("channel.json", JSON.stringify([{ name: "x", keywords: ["a"], reply: "b", channels: ["sms"] }]));
    expect(() => loadRules(path)).toThrow(/unknown channel "sms"/);
  });

  it("loads a good file", () => {
    const path = write("good.json", JSON.stringify([{ name: "x", keywords: ["fiyat"], reply: "DM" }]));
    expect(loadRules(path)).toHaveLength(1);
  });
});
