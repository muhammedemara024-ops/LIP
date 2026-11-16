/**
 * Pure per-operation availability classification (SC-012, PD-038 P6).
 * M = expected minutes, O = minutes with observations, S = successful minutes. Bigint integer comparisons only;
 * a missing minute is never treated as success. Stateless: results depend only on the input.
 */

export interface AvailabilityInput {
  readonly M: bigint;
  readonly O: bigint;
  readonly S: bigint;
  readonly partial: boolean;
}

export interface Ratio {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export interface AvailabilityResult {
  readonly status: "PASS" | "FAIL" | "INSUFFICIENT DATA";
  readonly M: bigint;
  readonly O: bigint;
  readonly S: bigint;
  readonly gapMinutes: bigint;
  readonly coverage: Ratio | null;
  readonly worstCaseAvailability: Ratio | null;
  readonly partial: boolean;
}

export function classifyAvailability(input: AvailabilityInput): AvailabilityResult {
  const { M, O, S, partial } = input;
  if (M < 0n || O < 0n || S < 0n || S > O || O > M) {
    throw new Error("invalid availability counts");
  }
  const gapMinutes = M - O;
  if (M === 0n) {
    return { status: "INSUFFICIENT DATA", M, O, S, gapMinutes, coverage: null, worstCaseAvailability: null, partial };
  }
  let status: AvailabilityResult["status"];
  if (1000n * O >= 995n * M && 1000n * S >= 995n * M) {
    status = "PASS";
  } else if (1000n * (S + M - O) < 995n * M) {
    status = "FAIL";
  } else {
    status = "INSUFFICIENT DATA";
  }
  return {
    status,
    M,
    O,
    S,
    gapMinutes,
    coverage: { numerator: O, denominator: M },
    worstCaseAvailability: { numerator: S, denominator: M },
    partial,
  };
}
