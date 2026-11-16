import { describe, expect, it } from "vitest";
import { normalizeDigits } from "./normalize.js";
import { formatPiasters, parseBillPiasters } from "./piasters.js";

describe("parseBillPiasters", () => {
  it("parses whole and decimal amounts into piasters", () => {
    expect(parseBillPiasters("0")).toBe(0n);
    expect(parseBillPiasters("0.00")).toBe(0n);
    expect(parseBillPiasters("45")).toBe(4500n);
    expect(parseBillPiasters("45.5")).toBe(4550n);
    expect(parseBillPiasters("45.50")).toBe(4550n);
    expect(parseBillPiasters("0.5")).toBe(50n);
    expect(parseBillPiasters("045")).toBe(4500n);
  });
  it("accepts the Arabic decimal separator after digit normalization", () => {
    expect(parseBillPiasters(normalizeDigits("٤٥٫٥٠"))).toBe(4550n);
    expect(parseBillPiasters(normalizeDigits("۴۵٫۵۰"))).toBe(4550n);
  });
  it("keeps exact bigint precision beyond the safe-integer range", () => {
    expect(parseBillPiasters("9007199254740993")).toBe(900719925474099300n);
  });
  it("rejects malformed input without producing a truncated result", () => {
    for (const bad of ["", "45.", ".5", "45.555", "4,500", "-1", "+1", " 45", "45 ", "٤٥", "45,50", "1e3", "abc", "45..5"]) {
      expect(() => parseBillPiasters(bad), bad).toThrow();
    }
  });
});

describe("formatPiasters", () => {
  it("hides a zero fractional part and keeps two digits otherwise", () => {
    expect(formatPiasters(4500n, "ar")).toBe("45 ج.م");
    expect(formatPiasters(4500n, "en")).toBe("EGP 45");
    expect(formatPiasters(4550n, "ar")).toBe("45.50 ج.م");
    expect(formatPiasters(4550n, "en")).toBe("EGP 45.50");
    expect(formatPiasters(5n, "en")).toBe("EGP 0.05");
    expect(formatPiasters(0n, "en")).toBe("EGP 0");
    expect(formatPiasters(123456789n, "ar")).toBe("1234567.89 ج.م");
  });
  it("outputs Western digits, no grouping and no bidi control characters", () => {
    for (const lang of ["ar", "en"] as const) {
      const out = formatPiasters(123456789n, lang);
      expect(out).not.toMatch(/[٠-٩۰-۹]/u);
      expect(out).not.toMatch(/[‎‏‪-‮⁦-⁩]/u);
      expect(out).not.toContain(",");
    }
  });
  it("throws for negative piasters", () => {
    expect(() => formatPiasters(-1n, "ar")).toThrow();
    expect(() => formatPiasters(-1n, "en")).toThrow();
  });
  it("round-trips through parse for display amounts", () => {
    expect(parseBillPiasters("45.50")).toBe(4550n);
    expect(formatPiasters(parseBillPiasters("45.5"), "en")).toBe("EGP 45.50");
  });
});
