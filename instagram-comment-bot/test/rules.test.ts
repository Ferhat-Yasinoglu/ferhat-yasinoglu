import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchRule, parseRules, RuleError } from "../src/rules.js";

const example = parseRules(JSON.parse(readFileSync(new URL("../rules.example.json", import.meta.url), "utf8")));

describe("parseRules", () => {
  it("accepts the shipped example file", () => {
    expect(example.length).toBeGreaterThan(0);
  });

  it("rejects a rule with no way to match", () => {
    expect(() => parseRules([{ name: "empty", reply: "hi" }])).toThrow(RuleError);
  });

  it("rejects a rule that matches but does nothing", () => {
    expect(() => parseRules([{ name: "mute", keywords: ["fiyat"] }])).toThrow(/reply, privateReply/);
  });

  it("rejects a broken pattern at load time, not at 3am", () => {
    expect(() => parseRules([{ name: "bad", pattern: "([", reply: "hi" }])).toThrow(/invalid pattern/);
  });

  it("rejects anything that isn't a list", () => {
    expect(() => parseRules({ name: "x" })).toThrow(/JSON array/);
  });
});

describe("matchRule", () => {
  it("matches keywords regardless of case and accents", () => {
    expect(matchRule(example, "FİYAT nedir acaba?")?.rule.name).toBe("price");
    expect(matchRule(example, "bu kac para")?.rule.name).toBe("price");
    expect(matchRule(example, "How much is it?")?.rule.name).toBe("price");
  });

  it("matches patterns", () => {
    expect(matchRule(example, "bedava takipçi kazan")?.rule.name).toBe("spam-links");
    expect(matchRule(example, "@ayse @mehmet")?.rule.name).toBe("tag-a-friend");
  });

  it("returns nothing when no rule applies", () => {
    expect(matchRule(example, "bu ürünü nerede çektiniz?")).toBeUndefined();
  });

  it("takes the first match, so narrow rules can be put first", () => {
    const rules = parseRules([
      { name: "narrow", keywords: ["kargo ücreti"], reply: "ücretsiz" },
      { name: "broad", keywords: ["kargo"], reply: "1-3 gün" },
    ]);
    expect(matchRule(rules, "kargo ücreti ne kadar?")?.rule.name).toBe("narrow");
    expect(matchRule(rules, "kargo ne zaman?")?.rule.name).toBe("broad");
  });

  it("normalizes a single reply into the variant list", () => {
    const rules = parseRules([{ name: "one", keywords: ["selam"], reply: "merhaba" }]);
    expect(matchRule(rules, "selam")?.replies).toEqual(["merhaba"]);
  });
});
