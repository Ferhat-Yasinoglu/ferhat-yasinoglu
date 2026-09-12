import { describe, expect, it } from "vitest";
import { applyDefaults, validate } from "../src/jsonschema.js";

describe("validate", () => {
  it("passes a value that satisfies the schema", () => {
    const schema = { type: "object", properties: { a: { type: "string" } }, required: ["a"] };
    expect(validate({ a: "x" }, schema)).toEqual([]);
  });

  it("reports a missing required property by path", () => {
    const schema = { type: "object", properties: { a: { type: "string" } }, required: ["a"] };
    expect(validate({}, schema)).toEqual([{ path: "a", message: "is required" }]);
  });

  it("reports a nested type error by path", () => {
    const schema = {
      type: "object",
      properties: { outer: { type: "object", properties: { inner: { type: "number" } } } },
    };
    const errors = validate({ outer: { inner: "no" } }, schema);
    expect(errors[0]?.path).toBe("outer.inner");
  });

  it("distinguishes integer from number", () => {
    expect(validate(1.5, { type: "integer" })).toHaveLength(1);
    expect(validate(1.5, { type: "number" })).toHaveLength(0);
  });

  it("does not treat an array as an object", () => {
    expect(validate([], { type: "object" })).toHaveLength(1);
  });

  it("does not treat null as an object", () => {
    expect(validate(null, { type: "object" })).toHaveLength(1);
  });

  it("checks enum membership", () => {
    expect(validate("d", { enum: ["a", "b"] })).toHaveLength(1);
    expect(validate("a", { enum: ["a", "b"] })).toHaveLength(0);
  });

  it("checks numeric bounds", () => {
    expect(validate(0, { type: "integer", minimum: 1 })).toHaveLength(1);
    expect(validate(500, { type: "integer", maximum: 100 })).toHaveLength(1);
  });

  it("checks string length and pattern", () => {
    expect(validate("", { type: "string", minLength: 1 })).toHaveLength(1);
    expect(validate("abc", { type: "string", pattern: "^\\d+$" })).toHaveLength(1);
  });

  it("validates array items and bounds", () => {
    const schema = { type: "array", items: { type: "string" }, minItems: 1 };
    expect(validate([], schema)).toHaveLength(1);
    expect(validate([1], schema)[0]?.path).toBe("[0]");
    expect(validate(["ok"], schema)).toHaveLength(0);
  });

  it("rejects unknown properties when additionalProperties is false", () => {
    const schema = { type: "object", properties: { a: { type: "string" } }, additionalProperties: false };
    expect(validate({ a: "x", b: 1 }, schema)[0]?.path).toBe("b");
  });

  it("stops after a type mismatch instead of piling on keyword errors", () => {
    const schema = { type: "object", properties: { a: { type: "string" } }, required: ["a"] };
    expect(validate("not an object", schema)).toHaveLength(1);
  });

  it("handles anyOf", () => {
    const schema = { anyOf: [{ type: "string" }, { type: "number" }] };
    expect(validate(true, schema)).toHaveLength(1);
    expect(validate("s", schema)).toHaveLength(0);
  });

  it("treats an absent schema as permissive", () => {
    expect(validate({ anything: true }, undefined)).toEqual([]);
  });
});

describe("applyDefaults", () => {
  it("fills an absent property from its default", () => {
    const schema = { type: "object", properties: { limit: { type: "integer", default: 20 } } };
    expect(applyDefaults({}, schema)).toEqual({ limit: 20 });
  });

  it("leaves a supplied value alone", () => {
    const schema = { type: "object", properties: { limit: { type: "integer", default: 20 } } };
    expect(applyDefaults({ limit: 5 }, schema)).toEqual({ limit: 5 });
  });

  it("recurses into nested objects", () => {
    const schema = {
      type: "object",
      properties: { page: { type: "object", properties: { size: { type: "integer", default: 10 } } } },
    };
    expect(applyDefaults({ page: {} }, schema)).toEqual({ page: { size: 10 } });
  });

  it("does not invent absent parent objects", () => {
    const schema = {
      type: "object",
      properties: { page: { type: "object", properties: { size: { type: "integer", default: 10 } } } },
    };
    expect(applyDefaults({}, schema)).toEqual({});
  });
});
