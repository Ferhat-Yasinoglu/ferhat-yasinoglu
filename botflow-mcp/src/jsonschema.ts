import type { JsonSchema } from "./types.js";

/**
 * A small JSON Schema validator covering the keywords MCP tool schemas actually
 * use. We validate rather than trust so that a cloned tool rejects bad input the
 * same way the real one does, instead of forwarding garbage to a handler.
 *
 * This is deliberately not a complete Draft 2020-12 implementation; unknown
 * keywords are ignored rather than treated as failures.
 */

export type ValidationError = { path: string; message: string };

export function validate(value: unknown, schema: JsonSchema | undefined, path = ""): ValidationError[] {
  if (!schema || typeof schema !== "object") return [];
  const errors: ValidationError[] = [];
  const at = path || "(root)";

  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    errors.push({ path: at, message: `must equal ${JSON.stringify(schema.const)}` });
  }

  if (schema.enum && !schema.enum.some((option) => deepEqual(value, option))) {
    errors.push({ path: at, message: `must be one of ${schema.enum.map((o) => JSON.stringify(o)).join(", ")}` });
  }

  if (schema.anyOf && !schema.anyOf.some((sub) => validate(value, sub, path).length === 0)) {
    errors.push({ path: at, message: "does not match any of the allowed schemas" });
  }

  if (schema.oneOf) {
    const matches = schema.oneOf.filter((sub) => validate(value, sub, path).length === 0).length;
    if (matches !== 1) {
      errors.push({ path: at, message: `must match exactly one allowed schema (matched ${matches})` });
    }
  }

  for (const sub of schema.allOf ?? []) errors.push(...validate(value, sub, path));

  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.length > 0 && !types.some((t) => matchesType(value, t))) {
    errors.push({ path: at, message: `expected ${types.join(" or ")}, got ${describe(value)}` });
    // Type is wrong, so the keyword checks below would only produce noise.
    return errors;
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({ path: at, message: `must be >= ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({ path: at, message: `must be <= ${schema.maximum}` });
    }
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({ path: at, message: `must be at least ${schema.minLength} characters` });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({ path: at, message: `must be at most ${schema.maxLength} characters` });
    }
    if (schema.pattern !== undefined) {
      // An imported spec can carry a pattern this engine cannot compile. Report
      // that as a validation problem rather than throwing out of the validator.
      try {
        if (!new RegExp(schema.pattern).test(value)) {
          errors.push({ path: at, message: `must match /${schema.pattern}/` });
        }
      } catch {
        errors.push({ path: at, message: `schema has an invalid pattern: ${schema.pattern}` });
      }
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({ path: at, message: `must have at least ${schema.minItems} items` });
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({ path: at, message: `must have at most ${schema.maxItems} items` });
    }
    const items = schema.items;
    if (Array.isArray(items)) {
      items.forEach((sub, i) => {
        if (i < value.length) errors.push(...validate(value[i], sub, `${path}[${i}]`));
      });
    } else if (items) {
      value.forEach((entry, i) => errors.push(...validate(entry, items, `${path}[${i}]`)));
    }
  }

  if (isPlainObject(value)) {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push({ path: join(path, key), message: "is required" });
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in value) errors.push(...validate(value[key], sub, join(path, key)));
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) errors.push({ path: join(path, key), message: "is not an allowed property" });
      }
    } else if (isPlainObject(schema.additionalProperties)) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const [key, entry] of Object.entries(value)) {
        if (!allowed.has(key)) {
          errors.push(...validate(entry, schema.additionalProperties as JsonSchema, join(path, key)));
        }
      }
    }
  }

  return errors;
}

export function formatErrors(errors: ValidationError[]): string {
  return errors.map((e) => `  - ${e.path || "(root)"}: ${e.message}`).join("\n");
}

/** Fill in `default` values for absent properties, so handlers see what upstream would. */
export function applyDefaults(value: unknown, schema: JsonSchema | undefined): unknown {
  if (!schema || !isPlainObject(value)) return value;
  const out: Record<string, unknown> = { ...value };
  for (const [key, sub] of Object.entries(schema.properties ?? {})) {
    if (!(key in out) && sub.default !== undefined) {
      out[key] = sub.default;
    } else if (key in out) {
      out[key] = applyDefaults(out[key], sub);
    }
  }
  return out;
}

function matchesType(value: unknown, type: string): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return isPlainObject(value);
    case "null":
      return value === null;
    default:
      return true;
  }
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, i) => deepEqual(entry, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}
