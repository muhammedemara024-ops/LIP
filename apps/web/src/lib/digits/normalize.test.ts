import { describe, expect, it } from "vitest";
import { normalizeDigits } from "./normalize.js";

describe("normalizeDigits", () => {
  it("maps Arabic-Indic digits to ASCII", () => {
    expect(normalizeDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });
  it("maps Persian digits to ASCII", () => {
    expect(normalizeDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });
  it("preserves every other character, including the Arabic decimal separator", () => {
    expect(normalizeDigits("۱۲a٫٣")).toBe("12a٫3");
    expect(normalizeDigits("٤٥٫٥٠")).toBe("45٫50");
    expect(normalizeDigits(" -+,. x")).toBe(" -+,. x");
  });
  it("leaves ASCII digits and the empty string unchanged and never throws", () => {
    expect(normalizeDigits("")).toBe("");
    expect(normalizeDigits("45.50")).toBe("45.50");
    expect(() => normalizeDigits("\ud800")).not.toThrow();
  });
  it("inserts no bidi control characters", () => {
    expect(normalizeDigits("٤٥")).not.toMatch(/[‎‏‪-‮⁦-⁩]/u);
  });
});
