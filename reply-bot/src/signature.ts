/**
 * Meta signs every webhook delivery with the app secret. Without checking it,
 * the endpoint is a public "post this comment reply" button for anyone who
 * finds the URL — so an unverified body is dropped before it reaches the bot.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Constant-time compare of `X-Hub-Signature-256` against the raw request body. */
export function verifySignature(rawBody: Buffer, header: string | undefined, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;

  const expected = Buffer.from(
    "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex"),
    "utf8",
  );
  const received = Buffer.from(header, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** The header Meta would send for this body — used by the tests and by `--sign`. */
export function sign(rawBody: Buffer | string, appSecret: string): string {
  return "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
}
