import { describe, expect, it } from "vitest";
import { planStampVoid, type StampCandidate, type StampVoidFacts } from "./stamp-plan.js";

const M = "m01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OTHER = "mAAAAAAAAAAAAAAAAAAAAAAAAAA";
const cand = (n: number, over: Partial<StampCandidate> = {}): StampCandidate => ({
  id: `stamp-${M}-${n}`,
  sequence: BigInt(n),
  status: "issued",
  activeReservation: false,
  ...over,
});
const facts = (over: Partial<StampVoidFacts> = {}): StampVoidFacts => ({
  memberId: M,
  marker: 0n,
  originalProgramRevision: "r1",
  currentProgramRevision: "r1",
  a: 1n,
  cur: 2n,
  t: 5n,
  candidates: [],
  ...over,
});

describe("planStampVoid arithmetic", () => {
  it("k=0 when the balance still covers the earned stamps", () => {
    expect(planStampVoid(facts({ a: 1n, cur: 2n, t: 5n }))).toEqual({ ok: true, k: 0n, restore: 0n, finalBalance: 1n, rewardIds: [] });
  });
  it("k=1 restores one threshold", () => {
    expect(planStampVoid(facts({ a: 1n, cur: 0n, t: 5n, candidates: [cand(1)] }))).toEqual({
      ok: true,
      k: 1n,
      restore: 5n,
      finalBalance: 4n,
      rewardIds: [`stamp-${M}-1`],
    });
  });
  it("k=3 with three free candidates picks newest first", () => {
    const r = planStampVoid(facts({ a: 11n, cur: 0n, t: 5n, candidates: [cand(1), cand(2), cand(3)] }));
    expect(r).toEqual({ ok: true, k: 3n, restore: 15n, finalBalance: 4n, rewardIds: [`stamp-${M}-3`, `stamp-${M}-2`, `stamp-${M}-1`] });
  });
  it("a=0, cur=0 gives k0 and final 0", () => {
    expect(planStampVoid(facts({ a: 0n, cur: 0n }))).toEqual({ ok: true, k: 0n, restore: 0n, finalBalance: 0n, rewardIds: [] });
  });
  it("final balance is always within [0,t) on success", () => {
    for (let a = 0n; a <= 17n; a++) {
      for (let cur = 0n; cur < 5n; cur++) {
        const cands = [1, 2, 3, 4, 5].map((n) => cand(n));
        const r = planStampVoid(facts({ a, cur, t: 5n, candidates: cands }));
        if (r.ok) {
          expect(r.finalBalance >= 0n && r.finalBalance < 5n).toBe(true);
          expect(BigInt(r.rewardIds.length)).toBe(r.k);
        }
      }
    }
  });
});

describe("planStampVoid candidate selection", () => {
  it("skips reserved and redeemed newest candidates when enough others remain", () => {
    const r = planStampVoid(
      facts({
        a: 6n,
        cur: 0n,
        t: 5n,
        marker: 1n,
        candidates: [cand(4, { activeReservation: true }), cand(5, { status: "redeemed" }), cand(3), cand(2)],
      }),
    );
    expect(r).toEqual({ ok: true, k: 2n, restore: 10n, finalBalance: 4n, rewardIds: [`stamp-${M}-3`, `stamp-${M}-2`] });
  });
  it("excludes the exact marker and anything below it", () => {
    expect(planStampVoid(facts({ a: 6n, cur: 0n, t: 5n, marker: 2n, candidates: [cand(1), cand(2), cand(3)] }))).toEqual({ ok: false });
  });
  it("excludes gift and foreign-member ids without failing", () => {
    const gift: StampCandidate = { id: "adj_01ARZ3NDEKTSV4RRFFQ69G5FAV", sequence: 0n, status: "issued", activeReservation: false };
    const foreign: StampCandidate = { id: `stamp-${OTHER}-3`, sequence: 3n, status: "issued", activeReservation: false };
    const r = planStampVoid(facts({ a: 1n, cur: 0n, t: 5n, candidates: [gift, foreign, cand(3)] }));
    expect(r).toEqual({ ok: true, k: 1n, restore: 5n, finalBalance: 4n, rewardIds: [`stamp-${M}-3`] });
  });
  it("does not let a prefix-confusable member id qualify", () => {
    const confusable: StampCandidate = { id: `stamp-${M}x-1`, sequence: 1n, status: "issued", activeReservation: false };
    expect(planStampVoid(facts({ a: 1n, cur: 0n, t: 5n, candidates: [confusable] }))).toEqual({ ok: false });
  });
  it("orders by sequence, not by input order or timestamps", () => {
    const r = planStampVoid(facts({ a: 6n, cur: 0n, t: 5n, candidates: [cand(2), cand(9), cand(5)] }));
    expect(r.ok && r.rewardIds).toEqual([`stamp-${M}-9`, `stamp-${M}-5`]);
  });
  it("fails with too few candidates", () => {
    expect(planStampVoid(facts({ a: 11n, cur: 0n, t: 5n, candidates: [cand(1), cand(2)] }))).toEqual({ ok: false });
  });
});

describe("planStampVoid preconditions", () => {
  it("fails on republish, cur out of range, bad scalars", () => {
    expect(planStampVoid(facts({ currentProgramRevision: "r2" }))).toEqual({ ok: false });
    expect(planStampVoid(facts({ cur: -1n }))).toEqual({ ok: false });
    expect(planStampVoid(facts({ cur: 5n, t: 5n }))).toEqual({ ok: false });
    expect(planStampVoid(facts({ t: 0n }))).toEqual({ ok: false });
    expect(planStampVoid(facts({ a: -1n }))).toEqual({ ok: false });
    expect(planStampVoid(facts({ marker: -1n }))).toEqual({ ok: false });
  });
  it("fails on malformed own-prefix candidate facts", () => {
    const base = { a: 1n, cur: 0n, t: 5n } as const;
    expect(planStampVoid(facts({ ...base, candidates: [cand(3), cand(3)] }))).toEqual({ ok: false });
    expect(planStampVoid(facts({ ...base, candidates: [cand(3), { ...cand(4), sequence: 3n }] }))).toEqual({ ok: false });
    expect(planStampVoid(facts({ ...base, candidates: [{ ...cand(3), id: `stamp-${M}-03` }] }))).toEqual({ ok: false });
    expect(planStampVoid(facts({ ...base, candidates: [{ ...cand(3), sequence: 4n }] }))).toEqual({ ok: false });
    expect(planStampVoid(facts({ ...base, candidates: [{ ...cand(1), sequence: 0n, id: `stamp-${M}-0` }] }))).toEqual({ ok: false });
  });
  it("validates candidate facts before the k=0 early return", () => {
    expect(planStampVoid(facts({ a: 1n, cur: 2n, t: 5n, candidates: [cand(3), cand(3)] }))).toEqual({ ok: false });
  });
  it("never validates foreign candidates even when malformed or duplicated", () => {
    const gift: StampCandidate = { id: "adj_x", sequence: 0n, status: "weird", activeReservation: true };
    expect(planStampVoid(facts({ a: 1n, cur: 0n, t: 5n, candidates: [gift, gift, cand(1)] })).ok).toBe(true);
  });
  it("does not mutate inputs and is deterministic", () => {
    const candidates = [cand(2), cand(9), cand(5)];
    const f = facts({ a: 6n, cur: 0n, t: 5n, candidates });
    const r1 = planStampVoid(f);
    const r2 = planStampVoid(f);
    expect(r1).toEqual(r2);
    expect(candidates.map((c) => c.sequence)).toEqual([2n, 9n, 5n]);
    expect(candidates.map((c) => c.id)).toEqual([`stamp-${M}-2`, `stamp-${M}-9`, `stamp-${M}-5`]);
  });
});
