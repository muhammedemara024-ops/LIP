/**
 * Pure stamp-void planning (PD-008 A1 Plan and Preconditions, C1-C5; R-17; US5 scenario 2).
 * Inputs are synthetic or already-authoritative facts; this helper never fetches or reconstructs them,
 * never mutates its input and never throws. Persistence, locks and LIP writes belong to T036.
 */

export interface StampCandidate {
  readonly id: string;
  readonly sequence: bigint;
  readonly status: string;
  readonly activeReservation: boolean;
}

export interface StampVoidFacts {
  readonly memberId: string;
  readonly marker: bigint;
  readonly originalProgramRevision: string;
  readonly currentProgramRevision: string;
  readonly a: bigint;
  readonly cur: bigint;
  readonly t: bigint;
  readonly candidates: readonly StampCandidate[];
}

export type StampVoidPlanResult =
  | { readonly ok: true; readonly k: bigint; readonly restore: bigint; readonly finalBalance: bigint; readonly rewardIds: readonly string[] }
  | { readonly ok: false };

const FAIL: StampVoidPlanResult = { ok: false };

export function planStampVoid(facts: StampVoidFacts): StampVoidPlanResult {
  const { memberId, marker, originalProgramRevision, currentProgramRevision, a, cur, t, candidates } = facts;

  // 1. Scalar checks.
  if (t <= 0n || a < 0n || marker < 0n) return FAIL;
  if (originalProgramRevision !== currentProgramRevision) return FAIL;
  if (cur < 0n || cur >= t) return FAIL;

  // 2. Own-prefix filter first: foreign or gift candidates are never validated.
  const prefix = `stamp-${memberId}-`;
  const own = candidates.filter((c) => c.id.startsWith(prefix));

  // 3. Structural checks on own-prefix candidates only.
  const ids = new Set<string>();
  const sequences = new Set<bigint>();
  for (const c of own) {
    if (ids.has(c.id) || sequences.has(c.sequence)) return FAIL;
    if (c.sequence < 1n) return FAIL;
    if (c.id !== `${prefix}${c.sequence.toString()}`) return FAIL;
    ids.add(c.id);
    sequences.add(c.sequence);
  }

  // 4. Plan.
  const d = a - cur;
  const k = d <= 0n ? 0n : (d + t - 1n) / t;
  const restore = k * t;
  const finalBalance = cur + restore - a;
  if (k === 0n) return { ok: true, k, restore, finalBalance, rewardIds: [] };

  const qualifying = own
    .filter((c) => c.sequence > marker && c.status === "issued" && !c.activeReservation)
    .slice()
    .sort((x, y) => (x.sequence > y.sequence ? -1 : x.sequence < y.sequence ? 1 : 0));
  if (BigInt(qualifying.length) < k) return FAIL;

  return { ok: true, k, restore, finalBalance, rewardIds: qualifying.slice(0, Number(k)).map((c) => c.id) };
}
