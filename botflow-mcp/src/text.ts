/**
 * Text matching for keywords and button labels.
 *
 * Plain `toLowerCase()` is not enough for the languages this is built for.
 * Turkish "İ" (U+0130) lowercases to "i" followed by a combining dot above, so
 * `"İNDİRİM".toLowerCase().includes("indirim")` is false — a keyword trigger
 * written in lowercase would silently never fire on a message typed in caps.
 *
 * So: lowercase, decompose, then drop combining marks. That also makes matching
 * diacritic-insensitive, which is deliberate — people routinely type "indirim"
 * for "İNDİRİM", "gunaydin" for "günaydın", and expect the bot to understand.
 *
 * Decomposition alone is not sufficient either. Turkish dotless "ı" (U+0131) is
 * a distinct base letter, not "i" carrying a mark, so NFD leaves it untouched
 * and "günaydın" would still not match "gunaydin". Letters like that need an
 * explicit fold, which is what FOLD below is for.
 */
const FOLD: Record<string, string> = {
  ı: "i", // dotless i (U+0131)
  ﬁ: "fi",
  œ: "oe",
  æ: "ae",
  ø: "o",
  ß: "ss",
  đ: "d",
  ł: "l",
};

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ıﬁœæøßđł]/g, (ch) => FOLD[ch] ?? ch)
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .trim();
}

/** Case- and diacritic-insensitive substring test. */
export function containsKeyword(haystack: string, keyword: string): boolean {
  const needle = normalizeForMatch(keyword);
  return needle.length > 0 && normalizeForMatch(haystack).includes(needle);
}

/** Case- and diacritic-insensitive equality, for matching a typed button label. */
export function looseEquals(a: string, b: string): boolean {
  return normalizeForMatch(a) === normalizeForMatch(b);
}
