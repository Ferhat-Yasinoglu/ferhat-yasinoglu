/**
 * Text helpers shared by rule matching and reply rendering.
 *
 * Comments arrive as people type them — "FİYAT?", "fiyat", "fıyat nedir" — so
 * matching folds case and accents before comparing. Turkish needs the locale
 * lowercase (İ → i, I → ı) before the accents come off, otherwise "İ" folds to
 * "i̇" and stops matching "i".
 */

const COMBINING_MARKS = /[̀-ͯ]/g;

export function normalize(input: string): string {
  return input
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/ı/g, "i")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whether `needle` occurs in `haystack` once both are normalized. */
export function contains(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle));
}

/** Fill `{{name}}` placeholders, leaving unknown ones as empty string. */
export function render(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => vars[key] ?? "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * A stable index for a key, so the same comment always draws the same reply
 * from a rule's variants while different commenters see different ones.
 */
export function pick<T>(items: readonly T[], key: string): T {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return items[hash % items.length]!;
}

/** Instagram rejects comments over 2200 characters; keep replies far shorter. */
export function clamp(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}
