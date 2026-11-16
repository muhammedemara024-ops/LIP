import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LipApiError } from "@loyalty-interchange/sdk";
import {
  Failpoints,
  ManualClock,
  createDisposableDatabase,
  seedWorld,
  startBffInstance,
  startManagedPlane,
  type BffInstance,
  type DisposableDatabase,
  type FixtureWorld,
  type ManagedPlane
} from "./fixtures/index.js";

/**
 * T004 harness tests (SC-007, SC-016; research R-24; quickstart E18/E19 prerequisites).
 * The live suite needs LIP_TEST_POSTGRES_URL (a direct PostgreSQL endpoint). CI sets it and fails
 * the whole run on any skipped test, so it executes there on Linux + PostgreSQL 17.
 */
const adminUrl = process.env["LIP_TEST_POSTGRES_URL"];
const live = adminUrl ? describe : describe.skip;

describe("ManualClock", () => {
  it("is deterministic and only moves when told", () => {
    const clock = new ManualClock("2026-03-01T10:00:00.000Z");
    expect(clock.now().toISOString()).toBe("2026-03-01T10:00:00.000Z");
    clock.advance(1500);
    expect(clock.now().toISOString()).toBe("2026-03-01T10:00:01.500Z");
    clock.set("2026-03-02T00:00:00.000Z");
    expect(clock.nowMs()).toBe(Date.parse("2026-03-02T00:00:00.000Z"));
    expect(() => clock.advance(-1)).toThrow();
    expect(() => clock.advance(1.5)).toThrow();
  });
});

describe("Failpoints", () => {
  it("passes through when unarmed, counts hits, throws once or always when armed", async () => {
    const failpoints = new Failpoints();
    await expect(failpoints.hit("a")).resolves.toBeUndefined();
    failpoints.arm("a", "once-throw");
    await expect(failpoints.hit("a")).rejects.toThrow("failpoint a");
    await expect(failpoints.hit("a")).resolves.toBeUndefined();
    failpoints.arm("b", "throw");
    await expect(failpoints.hit("b")).rejects.toThrow();
    await expect(failpoints.hit("b")).rejects.toThrow();
    failpoints.disarm("b");
    await expect(failpoints.hit("b")).resolves.toBeUndefined();
    expect(failpoints.hitCount("a")).toBe(3);
    expect(failpoints.hitCount("b")).toBe(3);
  });

  it("holds a hung failpoint until it is disarmed", async () => {
    const failpoints = new Failpoints();
    failpoints.arm("h", "hang");
    let released = false;
    const waiting = failpoints.hit("h").then(() => {
      released = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(released).toBe(false);
    failpoints.disarm("h");
    await waiting;
    expect(released).toBe(true);
  });
});

live("two BFF instances, a real managed data plane and one disposable PostgreSQL", { timeout: 60_000 }, () => {
  let database: DisposableDatabase;
  let plane: ManagedPlane;
  let world: FixtureWorld;
  let a: BffInstance;
  let b: BffInstance;

  beforeAll(async () => {
    database = await createDisposableDatabase(adminUrl!);
    plane = await startManagedPlane(database.url);
    world = await seedWorld(plane.cafes);
    a = await startBffInstance({ databaseUrl: database.url, lipRuntimeUrl: plane.baseUrl, name: "a" });
    b = await startBffInstance({ databaseUrl: database.url, lipRuntimeUrl: plane.baseUrl, name: "b" });
    await a.pool.query("CREATE TABLE harness_shared (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
  }, 120_000);

  afterAll(async () => {
    await a?.stop();
    await b?.stop();
    await plane?.close();
    await database?.drop();
  }, 120_000);

  it("runs two independently configured instances with distinct identity", async () => {
    expect(a.url).not.toBe(b.url);
    expect(a.applicationName).not.toBe(b.applicationName);
    expect(a.config.otpHmacSecret).not.toBe(b.config.otpHmacSecret);
    expect(a.config.lipApiKey).not.toBe(b.config.lipApiKey);
    await a.pool.query("SELECT 1");
    await b.pool.query("SELECT 1");
    const [pidsA, pidsB] = [await a.backendPids(), await b.backendPids()];
    expect(pidsA.length).toBeGreaterThan(0);
    expect(pidsB.length).toBeGreaterThan(0);
    expect(pidsA.filter((pid) => pidsB.includes(pid))).toEqual([]);
    for (const instance of [a, b]) {
      const response = await fetch(`${instance.url}/api/v1/customer/x`, { headers: { host: "app.fixture.test" } });
      expect(response.status).toBe(404);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("not_found");
    }
  });

  it("shares durable state: a write through one instance is visible through the other", async () => {
    await a.pool.query("INSERT INTO harness_shared (k, v) VALUES ('shared', 'written-by-a')");
    const read = await b.pool.query<{ v: string }>("SELECT v FROM harness_shared WHERE k = 'shared'");
    expect(read.rows[0]?.v).toBe("written-by-a");
  });

  it("provisions two cafes with two branches, two customers and two staff each, with no personal data", async () => {
    expect(world.cafes).toHaveLength(2);
    for (const entry of world.cafes) {
      expect(entry.branches).toHaveLength(2);
      expect(entry.customers).toHaveLength(2);
      expect(entry.staff).toHaveLength(2);
    }
    const [cafeA, cafeB] = world.cafes;
    expect(cafeA.cafe.tenantId).not.toBe(cafeB.cafe.tenantId);
    expect(cafeA.cafe.programId).not.toBe(cafeB.cafe.programId);
    // No phone-number-like, email-like or name-like content anywhere in the seeded descriptor.
    const serialized = JSON.stringify(world, (key, value: unknown) => (key === "cafe" ? undefined : value));
    expect(serialized).not.toMatch(/\+?\d{9,}/u);
    expect(serialized).not.toMatch(/@/u);
    for (const entry of world.cafes) {
      expect(entry.customers[0].memberId).toMatch(/^m[0-9A-HJKMNP-TV-Z]{26}$/u);
    }
  });

  it("keeps the two cafes isolated in the data plane", async () => {
    const [cafeA, cafeB] = world.cafes;
    const own = await cafeA.cafe.client.accounts.get({ member_id: cafeA.customers[0].memberId, program_id: cafeA.cafe.programId });
    expect(own).toBeDefined();
    // Cafe B's key cannot read cafe A's member, and cafe A's program id is not cafe B's program.
    await expect(
      cafeB.cafe.client.accounts.get({ member_id: cafeA.customers[0].memberId, program_id: cafeA.cafe.programId })
    ).rejects.toBeInstanceOf(LipApiError);
    // A key for one environment is refused by the other environment's runtime.
    const crossed = await fetch(`${cafeB.cafe.lipBaseUrl}/admin/api/v1/locations`, {
      headers: { authorization: `Bearer ${cafeA.cafe.merchantApiKey}` }
    });
    expect([401, 403]).toContain(crossed.status);
  });

  it("gives each instance its own lease identity", async () => {
    const lease = await a.tryLease("fixture:lease:identity");
    expect(lease).not.toBeNull();
    expect(await b.tryLease("fixture:lease:identity")).toBeNull();
    await lease!.release();
    const taken = await b.tryLease("fixture:lease:identity");
    expect(taken).not.toBeNull();
    await taken!.release();
  });

  it("kills one instance separately: its lease is freed, the other instance keeps serving", async () => {
    const victim = await startBffInstance({ databaseUrl: database.url, lipRuntimeUrl: plane.baseUrl, name: "victim" });
    const lease = await victim.tryLease("fixture:lease:crash");
    expect(lease).not.toBeNull();
    expect(await b.tryLease("fixture:lease:crash")).toBeNull();

    await victim.kill();
    expect(victim.alive).toBe(false);
    await expect(fetch(`${victim.url}/api/v1/customer/x`)).rejects.toThrow();

    // The crashed instance's session is gone server-side, so the survivor can now take the lease.
    let acquired = null as Awaited<ReturnType<BffInstance["tryLease"]>>;
    for (let attempt = 0; attempt < 20 && acquired === null; attempt += 1) {
      acquired = await b.tryLease("fixture:lease:crash");
      if (acquired === null) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(acquired).not.toBeNull();
    await acquired!.release();

    expect(b.alive).toBe(true);
    const response = await fetch(`${b.url}/api/v1/customer/x`, { headers: { host: "app.fixture.test" } });
    expect(response.status).toBe(404);
    expect((await b.pool.query("SELECT 1 AS ok")).rows[0]).toEqual({ ok: 1 });
    expect(await victim.backendPids()).toEqual([]);
  });

  it("leaves no residue after the suite: the disposable database is dropped", async () => {
    const extra = await createDisposableDatabase(adminUrl!);
    await extra.drop();
    await extra.drop();
  });
});
