import { createHash } from "node:crypto";
import { isPlainObject } from "../jsonschema.js";
import type { JsonSchema, ToolContext, ToolResult } from "../types.js";

/**
 * The default handler for every tool that has no real implementation yet.
 *
 * It answers in the shape the tool's own `outputSchema` promises, so a client
 * exercising the cloned surface gets structurally valid results instead of an
 * error. Values are derived deterministically from the tool name and argument
 * path, which keeps repeated calls stable and test assertions cheap.
 */
export function mockHandler(args: Record<string, unknown>, ctx: ToolContext): ToolResult {
  const { tool } = ctx;
  const structured = tool.outputSchema
    ? (sample(tool.outputSchema, tool.name, "") as Record<string, unknown>)
    : undefined;

  const summary = [
    `[stub] ${tool.name} accepted the call but has no live implementation yet.`,
    ``,
    `Arguments received:`,
    JSON.stringify(args, null, 2),
    ``,
    structured
      ? `Returned a sample response matching this tool's outputSchema.`
      : `This tool declares no outputSchema, so no structured content was produced.`,
    `Implement it in src/handlers/index.ts to make it real.`,
  ].join("\n");

  return {
    content: [{ type: "text", text: summary }],
    ...(structured && isPlainObject(structured) ? { structuredContent: structured } : {}),
  };
}

/** Build a deterministic value that satisfies `schema`. */
export function sample(schema: JsonSchema | undefined, seed: string, path: string): unknown {
  if (!schema || typeof schema !== "object") return null;

  if (schema.default !== undefined) return schema.default;
  if (schema.const !== undefined) return schema.const;
  if (Array.isArray(schema.examples) && schema.examples.length > 0) return schema.examples[0];
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  if (schema.anyOf?.length) return sample(schema.anyOf[0], seed, path);
  if (schema.oneOf?.length) return sample(schema.oneOf[0], seed, path);
  if (schema.allOf?.length) {
    return schema.allOf.reduce<Record<string, unknown>>((acc, sub) => {
      const value = sample(sub, seed, path);
      return isPlainObject(value) ? { ...acc, ...value } : acc;
    }, {});
  }

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  switch (type) {
    case "object":
      return sampleObject(schema, seed, path);
    case "array": {
      const items = Array.isArray(schema.items) ? schema.items[0] : schema.items;
      const count = Math.max(schema.minItems ?? 1, 1);
      return Array.from({ length: Math.min(count, 3) }, (_, i) => sample(items, seed, `${path}[${i}]`));
    }
    case "boolean":
      return true;
    case "integer":
      return clampNumber(Math.abs(hashInt(`${seed}:${path}`)) % 1000, schema);
    case "number":
      return clampNumber(Math.round(Math.abs(hashInt(`${seed}:${path}`)) % 10000) / 100, schema);
    case "null":
      return null;
    case "string":
      return sampleString(schema, seed, path);
    default:
      // No declared type: an object with properties is still an object.
      return schema.properties ? sampleObject(schema, seed, path) : sampleString(schema, seed, path);
  }
}

function sampleObject(schema: JsonSchema, seed: string, path: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  for (const [key, sub] of Object.entries(properties)) {
    // Include everything: a fuller sample is more useful than a minimal one.
    out[key] = sample(sub, seed, path ? `${path}.${key}` : key);
  }
  for (const key of required) {
    if (!(key in out)) out[key] = sample(undefined, seed, key);
  }
  return out;
}

function sampleString(schema: JsonSchema, seed: string, path: string): string {
  const id = hashHex(`${seed}:${path}`, 8);
  switch (schema.format) {
    case "date-time":
      return "2026-01-01T00:00:00.000Z";
    case "date":
      return "2026-01-01";
    case "uri":
    case "url":
      return `https://example.invalid/${id}`;
    case "email":
      return `sample-${id}@example.invalid`;
    case "uuid":
      return formatUuid(hashHex(`${seed}:${path}`, 32));
    default:
      break;
  }
  const leaf = path.split(/[.[\]]/).filter(Boolean).pop() ?? "value";
  const value = `sample_${leaf}_${id}`;
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    return value.slice(0, schema.maxLength);
  }
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    return value.padEnd(schema.minLength, "x");
  }
  return value;
}

function clampNumber(value: number, schema: JsonSchema): number {
  let out = value;
  if (schema.minimum !== undefined && out < schema.minimum) out = schema.minimum;
  if (schema.maximum !== undefined && out > schema.maximum) out = schema.maximum;
  return out;
}

function hashHex(input: string, length: number): string {
  return createHash("sha256").update(input).digest("hex").slice(0, length);
}

function hashInt(input: string): number {
  return parseInt(hashHex(input, 8), 16);
}

function formatUuid(hex: string): string {
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join("-");
}
