import { describe, expect, it } from "vitest";
import { clamp, contains, normalize, pick, render } from "../src/text.js";

describe("normalize", () => {
  it("folds Turkish case the way Turkish does", () => {
    expect(normalize("FİYAT")).toBe("fiyat");
    expect(normalize("KAÇ PARA")).toBe("kac para");
    expect(normalize("Iyi")).toBe("iyi");
  });

  it("folds accents so misspellings still match", () => {
    expect(normalize("fıyat")).toBe("fiyat");
    expect(normalize("güzel")).toBe("guzel");
    expect(normalize("şşş")).toBe("sss");
  });

  it("collapses the whitespace people pad comments with", () => {
    expect(normalize("  ne   kadar  ")).toBe("ne kadar");
  });
});

describe("contains", () => {
  it("matches across case and accents", () => {
    expect(contains("FİYAT nedir?", "fiyat")).toBe(true);
    expect(contains("kaç para bu", "kac para")).toBe(true);
    expect(contains("çok güzel", "kargo")).toBe(false);
  });
});

describe("render", () => {
  it("fills placeholders and drops unknown ones", () => {
    expect(render("Merhaba {{username}} 🙂", { username: "ayse" })).toBe("Merhaba ayse 🙂");
    expect(render("Merhaba {{nope}}!", {})).toBe("Merhaba !");
  });
});

describe("pick", () => {
  it("is stable per key and spreads across keys", () => {
    const variants = ["a", "b", "c"];
    expect(pick(variants, "comment-1")).toBe(pick(variants, "comment-1"));
    const seen = new Set(["1", "2", "3", "4", "5", "6"].map((key) => pick(variants, key)));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("clamp", () => {
  it("leaves short text alone", () => {
    expect(clamp("kısa cevap", 280)).toBe("kısa cevap");
  });

  it("cuts on a word boundary and marks the cut", () => {
    const clamped = clamp("bir iki üç dört beş altı yedi sekiz", 20);
    expect(clamped.length).toBeLessThanOrEqual(21);
    expect(clamped.endsWith("…")).toBe(true);
    expect(clamped).not.toContain("dörtb");
  });
});
