import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, loadRules, missingForServe } from "../src/config.js";

const dir = mkdtempSync(join(tmpdir(), "ig-bot-"));

function write(name: string, contents: string): string {
  const path = join(dir, name);
  writeFileSync(path, contents);
  return path;
}

describe("loadConfig", () => {
  it("falls back to defaults on an empty environment", () => {
    const config = loadConfig({});
    expect(config).toMatchObject({ port: 3000, path: "/webhook", rulesFile: "rules.json", model: "claude-opus-5" });
    expect(config.dryRun).toBe(false);
  });

  it("reads what is set", () => {
    const config = loadConfig({ PORT: "8080", IG_DRY_RUN: "1", IG_MAX_REPLY_CHARS: "140", IG_USER_ID: "ig1" });
    expect(config).toMatchObject({ port: 8080, dryRun: true, maxChars: 140, igUserId: "ig1" });
  });
});

describe("missingForServe", () => {
  it("names every credential the webhook needs", () => {
    expect(missingForServe(loadConfig({}))).toEqual(["IG_VERIFY_TOKEN", "IG_ACCESS_TOKEN", "IG_USER_ID"]);
  });

  it("asks only for the verify token in a dry run, since nothing is posted", () => {
    expect(missingForServe(loadConfig({ IG_DRY_RUN: "1" }))).toEqual(["IG_VERIFY_TOKEN"]);
  });

  it("is happy once everything is set", () => {
    const env = { IG_VERIFY_TOKEN: "v", IG_ACCESS_TOKEN: "t", IG_USER_ID: "ig1" };
    expect(missingForServe(loadConfig(env))).toEqual([]);
  });
});

describe("loadRules", () => {
  it("points a first-time user at the example file", () => {
    expect(() => loadRules(join(dir, "nope.json"))).toThrow(/cp rules.example.json/);
  });

  it("names the file when the JSON is broken", () => {
    const path = write("broken.json", "{ not json");
    expect(() => loadRules(path)).toThrow(/broken\.json/);
  });

  it("names the file when a rule is invalid", () => {
    const path = write("invalid.json", JSON.stringify([{ name: "x", keywords: ["a"] }]));
    expect(() => loadRules(path)).toThrow(/invalid\.json: x: needs reply/);
  });

  it("loads a good file", () => {
    const path = write("good.json", JSON.stringify([{ name: "x", keywords: ["fiyat"], reply: "DM" }]));
    expect(loadRules(path)).toHaveLength(1);
  });
});
