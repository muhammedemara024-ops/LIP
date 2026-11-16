/**
 * Pure bill-amount helpers in integer piasters (bigint). No floating point, no earn calculation.
 * Source: PD-007, PD-039, FR-132; execution-briefs.md T079 (authoritative BFF mirror of the T010 module, PD-039 item 1).
 */

const BILL_PATTERN = /^[0-9]+(?:[.٫][0-9]{1,2})?$/;

/**
 * Parse an already digit-normalized bill string such as "45", "45.5", "45.50" or "45٫50" into piasters.
 * Accepted grammar (whole string, no trimming): ^[0-9]+(?:[.٫][0-9]{1,2})?$. Anything else throws.
 */
export function parseBillPiasters(text: string): bigint {
  if (!BILL_PATTERN.test(text)) {
    throw new Error("invalid bill amount");
  }
  const parts = text.split(/[.٫]/);
  const intPart = parts[0] ?? "";
  const frac = parts[1] ?? "";
  const fraction = frac === "" ? 0n : BigInt(frac.padEnd(2, "0"));
  return BigInt(intPart) * 100n + fraction;
}

/**
 * Format non-negative piasters for display. The zero fractional part is hidden, otherwise two digits are kept.
 * Arabic: "<amount> ج.م" ; English: "EGP <amount>". Western digits, no grouping, no bidi control characters.
 */
export function formatPiasters(piasters: bigint, language: "ar" | "en"): string {
  if (piasters < 0n) {
    throw new Error("negative piasters are not formattable");
  }
  const pounds = piasters / 100n;
  const rest = piasters % 100n;
  const amount = rest === 0n ? pounds.toString() : `${pounds.toString()}.${rest.toString().padStart(2, "0")}`;
  return language === "ar" ? `${amount} ج.م` : `EGP ${amount}`;
}
