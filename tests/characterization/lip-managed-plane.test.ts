import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FoodserviceOrderBuilder, LipApiError, money, type LipClient } from "@loyalty-interchange/sdk";
import type { ProgramDefinition } from "@loyalty-interchange/reference";
import { makeHybridProgram } from "../fixtures.js";

/**
 * T008 characterization tests (contracts/lip-integration.md "Characterization tests").
 * They run through LipClient against a REAL managed data plane on PostgreSQL (the T004 fixtures).
 * Needs LIP_TEST_POSTGRES_URL; CI sets it and fails the run on any skipped test.
 *
 * The T004 fixtures live under apps/bff/test and are outside the root tsc graph, so they are loaded
 * by dynamic import through constant paths (vitest resolves them; tsc does not follow them).
 */
const adminUrl = process.env["LIP_TEST_POSTGRES_URL"];
const live = adminUrl ? describe : describe.skip;

const FIXTURES: string = "../../apps/bff/test/fixtures/index.js";
const RESERVATION_TTL_SECONDS = 6;

/** The slice of the T004 fixtures this suite uses (typed locally so tsc need not follow the dynamic import). */
interface Cafe {
  readonly tenantId: string;
  readonly programId: string;
  readonly merchantApiKey: string;
  readonly lipBaseUrl: string;
  readonly client: LipClient;
}
interface Plane {
  readonly cafes: readonly Cafe[];
  close(): Promise<void>;
}
interface FixtureCafe {
  readonly cafe: Cafe;
  readonly branches: readonly [{ readonly branchId: string }, { readonly branchId: string }];
}
interface World {
  readonly cafes: readonly [FixtureCafe, FixtureCafe];
}
interface Database {
  readonly url: string;
  drop(): Promise<void>;
}
interface Fixtures {
  createDisposableDatabase(adminUrl: string): Promise<Database>;
  startManagedPlane(url: string, options?: { program?: (programId: string) => ProgramDefinition }): Promise<Plane>;
  seedWorld(cafes: readonly Cafe[]): Promise<World>;
  memberId(seed: string): string;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pinned LIP finding: on the managed PostgreSQL plane an authenticated request can answer 500
 * `internal_error` because the key's last-used write loses a state-revision race. A 500 from
 * authenticate happens before any effect, so retrying with the SAME idempotency key is safe.
 */
async function retry500<T>(run: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      last = error;
      if ((error as { status?: number } | null)?.status !== 500) throw error;
      await sleep(250);
    }
  }
  throw last;
}

async function refusal(run: () => Promise<unknown>): Promise<{ status: number; code: string | undefined }> {
  try {
    await retry500(run);
  } catch (error) {
    if (error instanceof LipApiError) return { status: error.status, code: error.code };
    throw error;
  }
  throw new Error("expected the request to be refused");
}

live("LIP managed data plane characterization (real PostgreSQL)", { timeout: 120_000 }, () => {
  let database: Database;
  let plane: Plane;
  let world: World;
  let fx: Fixtures;
  let counter = 0;

  beforeAll(async () => {
    fx = (await import(FIXTURES)) as Fixtures;
    database = await fx.createDisposableDatabase(adminUrl!);
    plane = await fx.startManagedPlane(database.url, {
      program: (programId) => ({ ...makeHybridProgram(), program_id: programId, reservation_ttl_seconds: programId.startsWith("program-b") ? 60 : RESERVATION_TTL_SECONDS })
    });
    world = await fx.seedWorld(plane.cafes);
  }, 180_000);

  afterAll(async () => {
    await plane?.close();
    await database?.drop();
  }, 120_000);

  const cafe = () => world.cafes[0];
  const client = () => cafe().cafe.client;
  const programId = () => cafe().cafe.programId;
  const scope = (location: string) => ({ program_id: programId(), brand_id: "b1", merchant_id: "m1", location_id: location });
  const branch = () => cafe().branches[0].branchId;

  function order(memberId: string, orderId: string, amount: number, status: "open" | "paid" = "paid", location = branch()) {
    const builder = new FoodserviceOrderBuilder({
      orderId,
      scope: scope(location),
      memberId,
      currency: "USD",
      channel: "counter",
      businessDate: "2026-07-14",
      status
    }).addItem({ lineId: "l1", productId: "meal", name: "Meal", unitPrice: money(amount, "USD") });
    if (status === "paid") builder.addTender({ tenderId: "t1", type: "cash", amount: money(amount, "USD") }).close("2026-07-14T10:08:00.000Z");
    return builder.build();
  }

  /** A fresh member per test keeps balances independent. */
  async function freshMember(): Promise<string> {
    counter += 1;
    const id = fx.memberId(`char-${counter}-${Date.now()}`);
    await retry500(() =>
      client().members.enroll(
        { program_id: programId(), identity: { type: "token", value: `fixture-identity-${id}`, issuer: "fixture-identity" }, member_id: id },
        { idempotencyKey: `enroll:${id}` }
      )
    );
    return id;
  }

  const accrue = (member: string, orderId: string, amount: number, location = branch()) =>
    retry500(() => client().accruals.post({ member_id: member, order: order(member, orderId, amount, "paid", location) }, { idempotencyKey: `accrue:${orderId}` }));

  const balances = async (member: string) => {
    const account = await retry500(() => client().accounts.get({ member_id: member, program_id: programId() }));
    return Object.fromEntries(account.balances.map((b) => [b.unit, { amount: b.amount, reserved: b.reserved }]));
  };

  const reserve = (member: string, redemptionId: string, rewardId: string, orderId: string, amount: number, issuedRewardId?: string) =>
    retry500(() =>
      client().redemptions.reserve(
        {
          redemption_id: redemptionId,
          member_id: member,
          reward_id: rewardId,
          ...(issuedRewardId === undefined ? {} : { issued_reward_id: issuedRewardId }),
          order: order(member, orderId, amount, "open")
        } as never,
        { idempotencyKey: `reserve:${redemptionId}` }
      )
    );

  async function reachThreeStamps(member: string, tag: string): Promise<void> {
    for (let i = 1; i <= 3; i += 1) await accrue(member, `${tag}-o${i}`, 1000);
  }

  it("names automatic stamp rewards stamp-<member>-<n> and the reset adjustment stamp-<member>-<n>-reset (PD-008 A1 f)", async () => {
    const member = await freshMember();
    await reachThreeStamps(member, "stamp");
    const rewards = await retry500(() => client().issuedRewards.list({ member_id: member, program_id: programId() } as never));
    expect(rewards.issued_rewards.map((r) => r.issued_reward_id)).toEqual([`stamp-${member}-1`]);
    const ledger = await retry500(() => client().ledger.list({ member_id: member, program_id: programId(), limit: 50 } as never));
    const reset = ledger.entries.find((entry) => entry.entry_id === `stamp-${member}-1-reset` || (entry as { adjustment_id?: string }).adjustment_id === `stamp-${member}-1-reset`);
    expect(reset, "reset ledger entry present").toBeDefined();
    expect(reset!.amount).toBe(-3);
    expect(reset!.unit).toBe("stamps");
  });

  it("issues automatic stamp rewards with no bearer artifact and a defined reservation shape (R-16)", async () => {
    const member = await freshMember();
    await reachThreeStamps(member, "bearer");
    const rewards = await retry500(() => client().issuedRewards.list({ member_id: member, program_id: programId() } as never));
    const reward = rewards.issued_rewards[0] as unknown as Record<string, unknown>;
    expect(Object.keys(reward).sort()).toEqual(["expires_at", "issued_at", "issued_reward_id", "member_id", "program_id", "reward_id", "status"]);
    for (const forbidden of ["code", "barcode", "token", "bearer", "qr", "redemption_code"]) expect(reward).not.toHaveProperty(forbidden);

    const reserved = await reserve(member, `r-bearer-${member}`, "free-entree", `ro-bearer-${member}`, 1200, `stamp-${member}-1`);
    const reservation = reserved.reservation as unknown as Record<string, unknown>;
    expect(Object.keys(reservation).sort()).toEqual(
      ["cost", "created_at", "effect", "expires_at", "funding", "issued_reward_id", "location_id", "member_id", "order_id", "redemption_id", "reservation_id", "reward_id", "status"].sort()
    );
    expect(reservation["status"]).toBe("reserved");
    expect(reservation["cost"]).toEqual({ unit: "points", amount: 0 });
  });

  it("refuses cancelling an issued reward that has an active reservation (check a, active case)", async () => {
    const member = await freshMember();
    await reachThreeStamps(member, "cancel");
    await reserve(member, `r-cancel-${member}`, "free-entree", `ro-cancel-${member}`, 1200, `stamp-${member}-1`);
    const refused = await refusal(() =>
      client().issuedRewards.cancel({ issued_reward_id: `stamp-${member}-1`, reason: "characterization" } as never, { idempotencyKey: `cancel:${member}` })
    );
    expect(refused).toEqual({ status: 409, code: "invalid_state" });
  });

  it("records accruals below the minimum spend with amount 0 and order_id; pages the ledger newest first (FP-003 V3, V4)", async () => {
    const member = await freshMember();
    await accrue(member, `below-${member}`, 99); // one minor unit under the program minimum spend (100)
    await accrue(member, `above-${member}`, 1000);
    const seen: Array<{ order_id?: string; amount: number; operation: string; unit: string; occurred_at: string }> = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await retry500(() => client().ledger.list({ member_id: member, program_id: programId(), limit: 1, ...(cursor === undefined ? {} : { cursor }) } as never));
      expect(page.entries.length).toBeLessThanOrEqual(1);
      seen.push(...(page.entries as unknown as typeof seen));
      cursor = page.next_cursor ?? undefined;
      pages += 1;
    } while (cursor !== undefined && pages < 40);
    expect(pages).toBeGreaterThan(1);
    // newest first
    const times = seen.map((entry) => Date.parse(entry.occurred_at));
    expect([...times].sort((x, y) => y - x)).toEqual(times);
    // the below-minimum order is recorded with its order id; its points entry has amount 0
    const below = seen.filter((entry) => entry.order_id === `below-${member}`);
    expect(below.length).toBeGreaterThan(0);
    // The points entry exists with amount 0 (the credit-cents entry is a separate wallet-credit accrual).
    const belowPoints = below.filter((entry) => entry.unit === "points");
    expect(belowPoints).toHaveLength(1);
    expect(belowPoints[0]!.operation).toBe("accrual");
    expect(belowPoints[0]!.amount).toBe(0);
    expect(seen.some((entry) => entry.order_id === `above-${member}` && entry.unit === "points" && entry.amount > 0)).toBe(true);
  });

  it("answers 409 idempotency_conflict to a same-key replay carrying a new request_id, and 409 conflict to a re-accrual with new facts (R-07)", async () => {
    const member = await freshMember();
    const first = await accrue(member, `idem-${member}`, 1000);
    expect(first.entry.amount).toBeGreaterThan(0);
    const replay = await refusal(() => client().accruals.post({ member_id: member, order: order(member, `idem-${member}`, 1000) }, { idempotencyKey: `accrue:idem-${member}` }));
    expect(replay).toEqual({ status: 409, code: "idempotency_conflict" });
    const reaccrual = await refusal(() => client().accruals.post({ member_id: member, order: order(member, `idem-${member}`, 1000) }, { idempotencyKey: `accrue:idem-${member}:second` }));
    expect(reaccrual.status).toBe(409);
    expect(reaccrual.code).toBe("conflict");
    const ledger = await retry500(() => client().ledger.list({ member_id: member, program_id: programId(), limit: 50 } as never));
    // One accrual produces one entry per balance unit; the replay and the re-accrual added none.
    const forOrder = ledger.entries.filter((entry) => entry.order_id === `idem-${member}`);
    expect(forOrder).toHaveLength((first.entries ?? []).length);
    expect(forOrder.filter((entry) => entry.unit === "points")).toHaveLength(1);
  });

  it("serializes concurrent accruals for one member: every order lands exactly once (check c)", async () => {
    const member = await freshMember();
    const ids = Array.from({ length: 6 }, (_, i) => `conc-${member}-${i}`);
    await Promise.all(ids.map((id) => accrue(member, id, 1000)));
    const ledger = await retry500(() => client().ledger.list({ member_id: member, program_id: programId(), limit: 100 } as never));
    const accrued = ledger.entries.filter((entry) => entry.operation === "accrual" && entry.unit === "points" && ids.includes(entry.order_id ?? ""));
    expect(accrued.map((entry) => entry.order_id).sort()).toEqual([...ids].sort());
    const state = await balances(member);
    expect(state["points"]!.amount).toBe(accrued.reduce((sum, entry) => sum + entry.amount, 0));
  });

  it("pins what LIP does with an accrual at a location registered inactive (PD-026 input; observed: accepted, not refused)", async () => {
    const member = await freshMember();
    const dead = `dead-${member}`.slice(0, 40);
    await retry500(async () => {
      const response = await fetch(`${cafe().cafe.lipBaseUrl}/admin/api/v1/locations`, {
        method: "PUT",
        headers: { authorization: `Bearer ${cafe().cafe.merchantApiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ location_id: dead, name: "inactive branch", active: false })
      });
      if (response.status === 500) throw Object.assign(new Error("retry"), { status: 500 });
      expect(response.ok).toBe(true);
      expect(await response.json()).toMatchObject({ location_id: dead, active: false });
    });
    // Observed against pinned LIP: the accrual is ACCEPTED (no refusal). PD-026 therefore needs a BFF-side check; recorded for the owner.
    const outcome = await retry500(() => client().accruals.post({ member_id: member, order: order(member, `dead-${member}`, 1000, "paid", dead) }, { idempotencyKey: `accrue:dead-${member}` }));
    expect(outcome.entry.location_id).toBe(dead);
  });

  it("holds the cost quoted at reserve time and restores the reserved amount exactly once on expiry (PD-025; R-16)", async () => {
    const member = await freshMember();
    await accrue(member, `cost-${member}`, 5000);
    const before = await balances(member);
    const reserved = await reserve(member, `r-exp-${member}`, "one-dollar-off", `ro-exp-${member}`, 1000);
    expect(reserved.reservation.cost).toEqual({ unit: "credits", amount: 50 });
    const held = await balances(member);
    expect(held["credits"]!.reserved).toBe(50);
    await sleep((RESERVATION_TTL_SECONDS + 1.5) * 1000);
    const lateCapture = await refusal(() =>
      client().redemptions.capture({ reservation_id: reserved.reservation.reservation_id, order_id: `ro-exp-${member}` } as never, { idempotencyKey: `capture:r-exp-${member}` })
    );
    expect(lateCapture).toEqual({ status: 409, code: "expired" });
    const resend = await refusal(() =>
      client().redemptions.capture({ reservation_id: reserved.reservation.reservation_id, order_id: `ro-exp-${member}` } as never, { idempotencyKey: `capture:r-exp-${member}` })
    );
    expect(resend).toEqual({ status: 409, code: "expired" });
    const lateReverse = await refusal(() =>
      client().redemptions.reverse({ reservation_id: reserved.reservation.reservation_id, reason: "late" } as never, { idempotencyKey: `reverse:r-exp-${member}` })
    );
    expect(lateReverse).toEqual({ status: 409, code: "expired" });
    const after = await balances(member);
    expect(after["credits"]!.reserved).toBe(0);
    expect(after["credits"]!.amount).toBe(before["credits"]!.amount);
    // After a successful balance-computing call has committed the expiry, the reservation is still not capturable.
    const afterCommit = await refusal(() =>
      client().redemptions.capture({ reservation_id: reserved.reservation.reservation_id, order_id: `ro-exp-${member}` } as never, { idempotencyKey: `capture2:r-exp-${member}` })
    );
    expect(afterCommit).toEqual({ status: 409, code: "expired" });
    // The idempotency fingerprint ignores the context envelope (source read: engine.ts); this re-send differs in its
    // business payload because the order builder stamps placed_at with the current time, hence the conflict.
    const replay = await refusal(() => reserve(member, `r-exp-${member}`, "one-dollar-off", `ro-exp-${member}`, 1000));
    expect(replay).toEqual({ status: 409, code: "idempotency_conflict" });
  });

  it("reserves and captures against a zero-value synthetic order (PD-008)", async () => {
    const member = await freshMember();
    await accrue(member, `zero-${member}`, 5000);
    const reserved = await reserve(member, `r-zero-${member}`, "one-dollar-off", `ro-zero-${member}`, 0);
    expect(reserved.reservation.status).toBe("reserved");
    const captured = await retry500(() =>
      client().redemptions.capture({ reservation_id: reserved.reservation.reservation_id, order_id: `ro-zero-${member}` } as never, { idempotencyKey: `capture:r-zero-${member}` })
    );
    expect(captured.reservation.status).toBe("captured");
  });
  it("keeps the plane open for a ready environment with no subscription or usage record and refuses it once the environment is not ready (PD-005 A2 input)", async () => {
    // The managed data plane consults only the environment status and the write freeze. It reads no
    // subscription, usage event or billing state, so it cannot refuse an active manual subscription that
    // has no usage events. Source read: apps/cloud/src/managed-data-plane.ts (status gate, isWriteFrozen).
    // Executed here: a ready environment serves, a suspended one is refused.
    const member = await freshMember();
    await accrue(member, `sub-${member}`, 1000);
    const holder = cafe().cafe as unknown as { environment: { status: string } };
    holder.environment.status = "suspended";
    try {
      const refused = await refusal(() => client().accounts.get({ member_id: member, program_id: programId() }));
      expect(refused).toEqual({ status: 409, code: "environment_not_ready" });
    } finally {
      holder.environment.status = "ready";
    }
    expect((await balances(member))["points"]!.amount).toBeGreaterThan(0);
  });

  it("does not cache a refused request: the same idempotency key succeeds once the refusal cause is gone (R-07, OD-15)", async () => {
    const member = await freshMember();
    const attempt = () => reserve(member, `r-refused-${member}`, "one-dollar-off", `ro-refused-${member}`, 1000);
    const refused = await refusal(attempt); // no credits yet
    expect(refused).toEqual({ status: 409, code: "insufficient_balance" });
    await accrue(member, `fund-${member}`, 5000);
    const reserved = await attempt(); // identical key and redemption id
    expect(reserved.reservation.status).toBe("reserved");
  });

  it("keeps a stored reserved reservation blocking cancel and re-reserve after its expiry until a successful balance-computing call commits the expiry (check a)", async () => {
    // Source read: cancel and reserve read the STORED status (engine.ts cancelIssuedReward / reserve), while a
    // refused capture or reverse rolls back and persists nothing; any successful call that computes a balance
    // re-derives and commits the expiry of every reservation in the program.
    const member = await freshMember();
    await reachThreeStamps(member, "stale");
    const reserved = await reserve(member, `r-stale-${member}`, "free-entree", `ro-stale-${member}`, 1200, `stamp-${member}-1`);
    await sleep((RESERVATION_TTL_SECONDS + 1.5) * 1000);
    const cancel = (key: string) =>
      refusal(() => client().issuedRewards.cancel({ issued_reward_id: `stamp-${member}-1`, reason: "characterization" } as never, { idempotencyKey: key }));
    expect(await cancel(`cancel-stale-1:${member}`)).toEqual({ status: 409, code: "invalid_state" });
    // A capture re-derives the expiry but its transaction rolls back, so nothing is committed.
    const late = await refusal(() =>
      client().redemptions.capture({ reservation_id: reserved.reservation.reservation_id, order_id: `ro-stale-${member}` } as never, { idempotencyKey: `capture-stale:${member}` })
    );
    expect(late).toEqual({ status: 409, code: "expired" });
    expect(await cancel(`cancel-stale-2:${member}`)).toEqual({ status: 409, code: "invalid_state" });
    const reReserve = () => reserve(member, `r-stale-again-${member}`, "free-entree", `ro-stale-again-${member}`, 1200, `stamp-${member}-1`);
    expect(await refusal(reReserve)).toEqual({ status: 409, code: "conflict" });
    // A successful balance-computing call commits the expiry; the reward is then usable again.
    await balances(member);
    const again = await reReserve();
    expect(again.reservation.status).toBe("reserved");
  });

  it("leaves exactly one accrual after a client abort and a same-key, same-body retry (R-07 input; the abort may precede receipt)", async () => {
    // Source read: no application-level bound. Once the body is received the handler runs to completion
    // regardless of client disconnect (no close/aborted handling), it may queue behind the per-program lock,
    // and PostgreSQL has no statement_timeout, so a write can commit after an unbounded delay (R-07 stays
    // fail-closed; bounding it needs a separate decision). This test executes only the safe property: after a
    // client abort and a same-key, same-body retry the ledger holds exactly one accrual.
    const member = await freshMember();
    const orderId = `abort-${member}`;
    const body = JSON.stringify({
      context: { protocol_version: "1.0", profile: "foodservice/1.0", request_id: `request_${member}`, idempotency_key: `accrue:${orderId}`, occurred_at: "2026-07-14T10:08:00.000Z", source: { system: "lip-sdk" } },
      member_id: member,
      order: order(member, orderId, 1000)
    });
    const send = (signal?: AbortSignal) =>
      fetch(`${cafe().cafe.lipBaseUrl}/lip/v1/accruals`, {
        method: "POST",
        headers: { authorization: `Bearer ${cafe().cafe.merchantApiKey}`, "content-type": "application/json" },
        body,
        ...(signal === undefined ? {} : { signal })
      });
    const controller = new AbortController();
    const first = send(controller.signal).catch(() => undefined);
    setTimeout(() => controller.abort(), 15);
    await first;
    await sleep(3000);
    let status = 500;
    for (let i = 0; i < 12 && status === 500; i += 1) {
      status = (await send()).status;
      if (status === 500) await sleep(250);
    }
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(300);
    const ledger = await retry500(() => client().ledger.list({ member_id: member, program_id: programId(), limit: 100 } as never));
    const points = ledger.entries.filter((entry) => entry.order_id === orderId && entry.unit === "points");
    expect(points).toHaveLength(1);
  });

  it("keeps the quoted hold cost when the program is republished with a different reward cost before capture (PD-025)", async () => {
    const other = world.cafes[1].cafe;
    const member = fx.memberId(`republish-${Date.now()}`);
    await retry500(() =>
      other.client.members.enroll(
        { program_id: other.programId, identity: { type: "token", value: `fixture-identity-${member}`, issuer: "fixture-identity" }, member_id: member },
        { idempotencyKey: `enroll:${member}` }
      )
    );
    const location = world.cafes[1].branches[0].branchId;
    const buildOrder = (orderId: string, amount: number, status: "open" | "paid") => {
      const builder = new FoodserviceOrderBuilder({
        orderId,
        scope: { program_id: other.programId, brand_id: "b1", merchant_id: "m1", location_id: location },
        memberId: member,
        currency: "USD",
        channel: "counter",
        businessDate: "2026-07-14",
        status
      }).addItem({ lineId: "l1", productId: "meal", name: "Meal", unitPrice: money(amount, "USD") });
      if (status === "paid") builder.addTender({ tenderId: "t1", type: "cash", amount: money(amount, "USD") }).close("2026-07-14T10:08:00.000Z");
      return builder.build();
    };
    await retry500(() => other.client.accruals.post({ member_id: member, order: buildOrder(`rp-fund-${member}`, 5000, "paid") }, { idempotencyKey: `accrue:rp-fund-${member}` }));
    const reserved = await retry500(() =>
      other.client.redemptions.reserve(
        { redemption_id: `r-rp-${member}`, member_id: member, reward_id: "one-dollar-off", order: buildOrder(`ro-rp-${member}`, 1000, "open") } as never,
        { idempotencyKey: `reserve:r-rp-${member}` }
      )
    );
    expect(reserved.reservation.cost).toEqual({ unit: "credits", amount: 50 });
    // The 60 s reservation TTL of cafe B keeps the republish well inside the hold window.
    expect(Date.parse(reserved.reservation.expires_at) - Date.parse(reserved.reservation.created_at)).toBe(60_000);

    const admin = async (method: string, path: string, requestBody: unknown): Promise<Record<string, unknown>> => {
      for (let i = 0; i < 12; i += 1) {
        const response = await fetch(`${other.lipBaseUrl}${path}`, {
          method,
          headers: { authorization: `Bearer ${other.merchantApiKey}`, "content-type": "application/json" },
          body: JSON.stringify(requestBody)
        });
        if (response.status === 500) {
          await sleep(250);
          continue;
        }
        expect(response.ok).toBe(true);
        return (await response.json()) as Record<string, unknown>;
      }
      throw new Error("admin request kept answering 500");
    };
    const base = makeHybridProgram();
    const republished = {
      ...base,
      program_id: other.programId,
      reservation_ttl_seconds: RESERVATION_TTL_SECONDS,
      rewards: base.rewards.map((reward) => (reward.reward_id === "one-dollar-off" ? { ...reward, cost: { unit: "credits", amount: 80 } } : reward))
    };
    const draft = (await admin("PUT", "/admin/api/v1/program/draft", { program: republished }))["draft"] as { version: number };
    await admin("POST", "/admin/api/v1/program/publish", { expected_draft_version: draft.version });

    const credits = async () => {
      const account = await retry500(() => other.client.accounts.get({ member_id: member, program_id: other.programId }));
      return account.balances.find((entry) => entry.unit === "credits")!.amount;
    };
    const beforeCapture = await credits();
    const captured = await retry500(() =>
      other.client.redemptions.capture({ reservation_id: reserved.reservation.reservation_id, order_id: `ro-rp-${member}` } as never, { idempotencyKey: `capture:r-rp-${member}` })
    );
    expect(captured.reservation.cost).toEqual({ unit: "credits", amount: 50 });
    expect(beforeCapture - (await credits())).toBe(50);
    // Positive control: the republish took effect, so a NEW hold is quoted at the new cost.
    const fresh = await retry500(() =>
      other.client.redemptions.reserve(
        { redemption_id: `r-rp2-${member}`, member_id: member, reward_id: "one-dollar-off", order: buildOrder(`ro-rp2-${member}`, 1000, "open") } as never,
        { idempotencyKey: `reserve:r-rp2-${member}` }
      )
    );
    expect(fresh.reservation.cost).toEqual({ unit: "credits", amount: 80 });
  });
  it("replays the cached accrual for a same-key re-send whose business payload is identical (placed_at pinned) (R-07, OD-15)", async () => {
    const member = await freshMember();
    const orderId = `replay-${member}`;
    const build = () =>
      new FoodserviceOrderBuilder({
        orderId,
        scope: scope(branch()),
        memberId: member,
        currency: "USD",
        channel: "counter",
        businessDate: "2026-07-14",
        status: "paid",
        placedAt: "2026-07-14T10:00:00.000Z"
      })
        .addItem({ lineId: "l1", productId: "meal", name: "Meal", unitPrice: money(1000, "USD") })
        .addTender({ tenderId: "t1", type: "cash", amount: money(1000, "USD") })
        .close("2026-07-14T10:08:00.000Z")
        .build();
    const post = () => retry500(() => client().accruals.post({ member_id: member, order: build() }, { idempotencyKey: `accrue:${orderId}` }));
    const first = await post();
    const second = await post();
    expect(second.entry.entry_id).toBe(first.entry.entry_id);
    const ledger = await retry500(() => client().ledger.list({ member_id: member, program_id: programId(), limit: 100 } as never));
    expect(ledger.entries.filter((entry) => entry.order_id === orderId && entry.unit === "points")).toHaveLength(1);
  });
});
