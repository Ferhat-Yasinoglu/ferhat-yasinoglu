/**
 * Flow step definitions and their validation.
 *
 * Validation lives apart from execution because a broken flow should be caught
 * when it is authored, not halfway through a real conversation with someone.
 */

export type Choice = { label: string; value?: string; goto?: number };

export type Step =
  | { type: "message"; text: string }
  | { type: "question"; text: string; save_as?: string }
  | { type: "buttons"; text: string; save_as?: string; choices: Choice[] }
  | { type: "delay"; seconds: number }
  | { type: "tag"; add_tags?: string[]; remove_tags?: string[] }
  | { type: "goto"; goto: number }
  | { type: "end" };

export const STEP_TYPES = ["message", "question", "buttons", "delay", "tag", "goto", "end"] as const;

/**
 * Check a whole flow. Returns human-readable problems; an empty array means the
 * flow is safe to store and run.
 */
export function validateSteps(steps: unknown): string[] {
  if (!Array.isArray(steps)) return ["steps must be an array"];
  if (steps.length === 0) return ["steps must contain at least one step"];

  const errors: string[] = [];
  const at = (i: number) => `steps[${i}]`;

  steps.forEach((raw, i) => {
    if (typeof raw !== "object" || raw === null) {
      errors.push(`${at(i)}: must be an object`);
      return;
    }
    const step = raw as Record<string, unknown>;
    const type = step.type;

    if (typeof type !== "string" || !(STEP_TYPES as readonly string[]).includes(type)) {
      errors.push(`${at(i)}: type must be one of ${STEP_TYPES.join(", ")}`);
      return;
    }

    switch (type) {
      case "message":
      case "question":
        if (!nonEmptyString(step.text)) errors.push(`${at(i)}: ${type} needs a non-empty text`);
        break;

      case "buttons": {
        if (!nonEmptyString(step.text)) errors.push(`${at(i)}: buttons needs a non-empty text`);
        const choices = step.choices;
        if (!Array.isArray(choices) || choices.length === 0) {
          errors.push(`${at(i)}: buttons needs at least one choice`);
          break;
        }
        const labels = new Set<string>();
        choices.forEach((c, j) => {
          const choice = c as Record<string, unknown>;
          if (!nonEmptyString(choice?.label)) {
            errors.push(`${at(i)}.choices[${j}]: needs a label`);
            return;
          }
          if (labels.has(choice.label as string)) {
            // Duplicate labels are indistinguishable once pressed.
            errors.push(`${at(i)}.choices[${j}]: duplicate label "${String(choice.label)}"`);
          }
          labels.add(choice.label as string);
          checkTarget(choice.goto, `${at(i)}.choices[${j}].goto`, steps.length, errors);
        });
        break;
      }

      case "delay": {
        const seconds = step.seconds;
        if (typeof seconds !== "number" || !Number.isInteger(seconds) || seconds < 0) {
          errors.push(`${at(i)}: delay needs a non-negative integer seconds`);
        }
        break;
      }

      case "tag": {
        const add = step.add_tags;
        const remove = step.remove_tags;
        if (!isStringArray(add) && add !== undefined) errors.push(`${at(i)}: add_tags must be an array of strings`);
        if (!isStringArray(remove) && remove !== undefined) {
          errors.push(`${at(i)}: remove_tags must be an array of strings`);
        }
        if (!hasEntries(add) && !hasEntries(remove)) {
          errors.push(`${at(i)}: tag needs add_tags or remove_tags`);
        }
        break;
      }

      case "goto":
        if (step.goto === undefined) {
          errors.push(`${at(i)}: goto needs a target step index`);
        } else {
          checkTarget(step.goto, `${at(i)}.goto`, steps.length, errors);
          if (step.goto === i) errors.push(`${at(i)}: goto cannot point at itself`);
        }
        break;

      case "end":
        break;
    }
  });

  return errors;
}

function checkTarget(value: unknown, label: string, length: number, errors: string[]): void {
  if (value === undefined) return;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    errors.push(`${label}: must be an integer step index`);
    return;
  }
  if (value < 0 || value >= length) {
    errors.push(`${label}: step ${value} does not exist (flow has ${length} steps)`);
  }
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function hasEntries(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Substitute `{{name}}` with captured answers.
 *
 * An unknown variable is left as written rather than blanked, so a typo shows up
 * in the conversation instead of silently producing an empty sentence.
 */
export function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name]! : whole,
  );
}
