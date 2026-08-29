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
    expect(matchRule(example, "Bunu NE İLE YAPTIN?")?.rule.name).toBe("teknoloji-tr");
    expect(matchRule(example, "Eline saglik, harika olmus")?.rule.name).toBe("ovgu-tr");
    expect(matchRule(example, "Sehr schön gemacht")?.rule.name).toBe("ovgu-de");
  });

  it("matches patterns", () => {
    expect(matchRule(example, "bedava takipçi kazan")?.rule.name).toBe("spam");
    expect(matchRule(example, "@ayse @mehmet")?.rule.name).toBe("sadece-etiket");
  });

  it("answers each language with its own rule", () => {
    expect(matchRule(example, "was kostet so eine Seite?")?.rule.name).toBe("is-de");
    expect(matchRule(example, "can i hire you for a project")?.rule.name).toBe("is-en");
    expect(matchRule(example, "پروژه دارم، همکاری می‌کنی؟")?.rule.name).toBe("is-fa");
    expect(matchRule(example, "با چی نوشتی؟")?.rule.name).toBe("teknoloji-fa");
    expect(matchRule(example, "از کجا شروع کنم؟")?.rule.name).toBe("ogrenme-fa");
  });

  it("does not let one language's rule catch another's comment", () => {
    // "open source" in the German rule would answer an English comment in German.
    expect(matchRule(example, "is it open source?")?.rule.name).toBe("kaynak-en");
    expect(matchRule(example, "gibt es den code irgendwo?")?.rule.name).toBe("kaynak-de");
    expect(matchRule(example, "kaynak kodu paylaşır mısın")?.rule.name).toBe("kaynak-tr");
  });

  it("answers the question in a comment that also carries praise", () => {
    expect(matchRule(example, "harika olmuş, kaynak kodu var mı?")?.rule.name).toBe("kaynak-tr");
  });

  it("returns nothing when no rule applies", () => {
    expect(matchRule(example, "bu fotoğrafı nerede çektiniz?")).toBeUndefined();
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
