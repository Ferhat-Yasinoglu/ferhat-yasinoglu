import { describe, expect, it } from "vitest";
import { interpolate, validateSteps } from "../src/engine/steps.js";
import { containsKeyword, looseEquals, normalizeForMatch } from "../src/text.js";

describe("normalizeForMatch", () => {
  /**
   * The Turkish dotted capital İ is the case that motivated this module:
   * "İ".toLowerCase() is "i" plus a combining dot, not "i".
   */
  it("folds Turkish dotted capital I onto plain i", () => {
    expect(normalizeForMatch("İNDİRİM")).toBe("indirim");
    expect("İNDİRİM".toLowerCase()).not.toBe("indirim");
  });

  /**
   * Dotless "ı" is a separate base letter, so NFD does not touch it — it needs
   * an explicit fold, unlike "ş"/"ğ"/"ö" which decompose into letter + mark.
   */
  it("folds Turkish dotless i, which decomposition alone does not reach", () => {
    expect("ı".normalize("NFD")).toBe("ı");
    expect(normalizeForMatch("günaydın")).toBe("gunaydin");
    expect(normalizeForMatch("GÜNAYDIN")).toBe("gunaydin");
  });

  it("folds the remaining Turkish diacritics", () => {
    expect(normalizeForMatch("Şşğçö")).toBe("ssgco");
  });

  it("folds a few non-decomposing Latin letters too", () => {
    expect(normalizeForMatch("straße")).toBe("strasse");
    expect(normalizeForMatch("Ø")).toBe("o");
  });

  it("leaves plain ascii alone apart from case", () => {
    expect(normalizeForMatch("  Hello World  ")).toBe("hello world");
  });
});

describe("containsKeyword", () => {
  it("matches across case and diacritics", () => {
    expect(containsKeyword("bugün İNDİRİM var mı?", "indirim")).toBe(true);
    expect(containsKeyword("Günaydın!", "gunaydin")).toBe(true);
    expect(containsKeyword("fiyat listesi", "FİYAT")).toBe(true);
  });

  it("does not match an unrelated message", () => {
    expect(containsKeyword("merhaba", "indirim")).toBe(false);
  });

  it("treats an empty keyword as no match rather than matching everything", () => {
    expect(containsKeyword("anything", "")).toBe(false);
    expect(containsKeyword("anything", "   ")).toBe(false);
  });
});

describe("looseEquals", () => {
  it("ignores case and diacritics", () => {
    expect(looseEquals("Öğrenme", "ogrenme")).toBe(true);
    expect(looseEquals("Learning", "learning")).toBe(true);
  });

  it("still distinguishes different words", () => {
    expect(looseEquals("Learning", "Business")).toBe(false);
  });
});

describe("interpolate", () => {
  it("substitutes captured answers", () => {
    expect(interpolate("Hi {{name}}", { name: "Ayse" })).toBe("Hi Ayse");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(interpolate("Hi {{ name }}", { name: "Ayse" })).toBe("Hi Ayse");
  });

  it("leaves an unknown variable visible instead of blanking it", () => {
    // A typo should be obvious in the conversation, not silently empty.
    expect(interpolate("Hi {{nmae}}", { name: "Ayse" })).toBe("Hi {{nmae}}");
  });

  it("substitutes the same variable more than once", () => {
    expect(interpolate("{{a}}-{{a}}", { a: "x" })).toBe("x-x");
  });
});

describe("validateSteps", () => {
  const ok = (steps: unknown) => expect(validateSteps(steps)).toEqual([]);
  const fails = (steps: unknown, pattern: RegExp) =>
    expect(validateSteps(steps).join("\n")).toMatch(pattern);

  it("accepts a well-formed flow", () => {
    ok([
      { type: "message", text: "hi" },
      { type: "question", text: "name?", save_as: "name" },
      { type: "buttons", text: "pick", choices: [{ label: "A", goto: 0 }] },
      { type: "delay", seconds: 60 },
      { type: "tag", add_tags: ["x"] },
      { type: "goto", goto: 0 },
      { type: "end" },
    ]);
  });

  it("rejects an empty flow", () => {
    fails([], /at least one step/);
  });

  it("rejects an unknown step type", () => {
    fails([{ type: "teleport" }], /type must be one of/);
  });

  it("requires text on message and question steps", () => {
    fails([{ type: "message" }], /needs a non-empty text/);
    fails([{ type: "question", text: "   " }], /needs a non-empty text/);
  });

  it("requires at least one choice on a buttons step", () => {
    fails([{ type: "buttons", text: "pick", choices: [] }], /at least one choice/);
  });

  it("rejects duplicate button labels", () => {
    // Two identical labels are indistinguishable once pressed.
    fails(
      [{ type: "buttons", text: "pick", choices: [{ label: "A" }, { label: "A" }] }],
      /duplicate label "A"/,
    );
  });

  it("rejects a goto that points past the end", () => {
    fails([{ type: "message", text: "a" }, { type: "goto", goto: 9 }], /step 9 does not exist/);
  });

  it("rejects a negative goto", () => {
    fails([{ type: "goto", goto: -1 }], /does not exist/);
  });

  it("rejects a goto pointing at itself", () => {
    fails([{ type: "message", text: "a" }, { type: "goto", goto: 1 }], /cannot point at itself/);
  });

  it("rejects a choice goto that points nowhere", () => {
    fails(
      [{ type: "buttons", text: "pick", choices: [{ label: "A", goto: 7 }] }],
      /choices\[0\]\.goto: step 7 does not exist/,
    );
  });

  it("rejects a negative delay", () => {
    fails([{ type: "delay", seconds: -5 }], /non-negative integer/);
  });

  it("accepts a zero delay", () => {
    ok([{ type: "delay", seconds: 0 }]);
  });

  it("requires a tag step to actually change something", () => {
    fails([{ type: "tag" }], /needs add_tags or remove_tags/);
    fails([{ type: "tag", add_tags: [] }], /needs add_tags or remove_tags/);
  });

  it("rejects a non-array steps value", () => {
    fails("nope", /must be an array/);
  });

  it("reports every problem at once rather than stopping at the first", () => {
    const problems = validateSteps([{ type: "message" }, { type: "delay", seconds: -1 }]);
    expect(problems).toHaveLength(2);
  });
});
