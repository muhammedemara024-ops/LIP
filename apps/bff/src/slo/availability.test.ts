import { describe, expect, it } from "vitest";
import { classifyAvailability } from "./availability.js";

const c = (M: bigint, O: bigint, S: bigint, partial = false) => classifyAvailability({ M, O, S, partial });

describe("classifyAvailability", () => {
  it("matches the approved vectors", () => {
    expect(c(1000n, 1000n, 995n).status).toBe("PASS");
    expect(c(1000n, 990n, 990n).status).toBe("INSUFFICIENT DATA");
    expect(c(1000n, 100n, 0n).status).toBe("FAIL");
    expect(c(1000n, 0n, 0n).status).toBe("INSUFFICIENT DATA");
    expect(c(1000n, 1000n, 994n).status).toBe("FAIL");
  });
  it("handles M=0 with no ratios", () => {
    const r = c(0n, 0n, 0n);
    expect(r.status).toBe("INSUFFICIENT DATA");
    expect(r.coverage).toBeNull();
    expect(r.worstCaseAvailability).toBeNull();
    expect(r.gapMinutes).toBe(0n);
  });
  it("is exact at 99.5 percent equality", () => {
    expect(c(1000n, 995n, 995n).status).toBe("PASS");
    expect(c(1000n, 994n, 994n).status).toBe("INSUFFICIENT DATA");
  });
  it("classifies DST-length month fixtures without claiming enumeration proof", () => {
    expect(c(1020n, 1020n, 1015n).status).toBe("PASS");
    expect(c(1140n, 1140n, 1134n).status).toBe("FAIL");
  });
  it("returns counts unchanged, gap minutes, unreduced ratios and the partial label", () => {
    const r = c(1000n, 990n, 980n, true);
    expect(r.M).toBe(1000n);
    expect(r.O).toBe(990n);
    expect(r.S).toBe(980n);
    expect(r.gapMinutes).toBe(10n);
    expect(r.coverage).toEqual({ numerator: 990n, denominator: 1000n });
    expect(r.worstCaseAvailability).toEqual({ numerator: 980n, denominator: 1000n });
    expect(r.partial).toBe(true);
    const p = c(1000n, 1000n, 995n, true);
    expect(p.status).toBe("PASS");
    expect(p.partial).toBe(true);
  });
  it("preserves exact precision beyond the safe-integer range", () => {
    const big = 10n ** 20n;
    expect(c(big, big, big).status).toBe("PASS");
    expect(c(big, big, (big * 994n) / 1000n).status).toBe("FAIL");
  });
  it("throws on invalid counts", () => {
    expect(() => c(10n, 11n, 0n)).toThrow();
    expect(() => c(10n, 5n, 6n)).toThrow();
    expect(() => c(-1n, 0n, 0n)).toThrow();
    expect(() => c(10n, -1n, -1n)).toThrow();
    expect(() => c(10n, 5n, -1n)).toThrow();
  });
  it("keeps award and redemption classification independent of call order", () => {
    const award = { M: 1000n, O: 1000n, S: 995n, partial: false } as const;
    const redemption = { M: 1000n, O: 100n, S: 0n, partial: false } as const;
    const a1 = classifyAvailability(award);
    const r1 = classifyAvailability(redemption);
    const r2 = classifyAvailability(redemption);
    const a2 = classifyAvailability(award);
    expect(a1).toEqual(a2);
    expect(r1).toEqual(r2);
    expect(a1.status).toBe("PASS");
    expect(r1.status).toBe("FAIL");
  });
});
