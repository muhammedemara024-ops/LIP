import { randomUUID } from "node:crypto";
import { LipApiError, type LipClient } from "@loyalty-interchange/sdk";
import { registerBranch, type Cafe } from "./managed-plane.js";

/**
 * The deterministic world the integration tests share: two cafes, two branches each, two customers
 * and two staff per cafe. Customers exist in LIP as opaque members enrolled with a synthetic token
 * identity. NO phone number, name or real credential is seeded anywhere (FR-004; constitution
 * Article IV): staff carry only opaque ids and obviously synthetic secrets.
 *
 * BFF-owned rows (cafes, branches, staff, devices in schema `bff`) cannot be seeded yet because
 * that schema does not exist until its migrations land; this descriptor is what those later seeds
 * will be generated from.
 */
export interface FixtureBranch {
  readonly branchId: string;
  readonly name: string;
}

export interface FixtureCustomer {
  readonly memberId: string;
  readonly customerId: string;
}

export interface FixtureStaff {
  readonly staffId: string;
  readonly role: "cashier" | "owner";
  /** Synthetic, never valid anywhere. */
  readonly syntheticSecret: string;
}

export interface FixtureCafe {
  readonly cafe: Cafe;
  readonly branches: readonly [FixtureBranch, FixtureBranch];
  readonly customers: readonly [FixtureCustomer, FixtureCustomer];
  readonly staff: readonly [FixtureStaff, FixtureStaff];
}

export interface FixtureWorld {
  readonly cafes: readonly [FixtureCafe, FixtureCafe];
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** `m` + 26 Crockford base32 characters (contracts/lip-integration.md, Identifier formats). */
export function memberId(seed: string): string {
  let hash = 2166136261;
  let out = "m";
  for (let i = 0; out.length < 27; i += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(i % seed.length) ^ i, 16777619) >>> 0;
    out += CROCKFORD[hash % 32];
  }
  return out;
}

async function enroll(client: LipClient, programId: string, member: string): Promise<void> {
  // Pinned LIP can answer 500 when the key's last-used write loses a state-revision race
  // (see managed-plane.ts). A fixed idempotency key makes the retry safe.
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await client.members.enroll(
        {
          program_id: programId,
          identity: { type: "token", value: `fixture-identity-${member}`, issuer: "fixture-identity" },
          member_id: member
        },
        { idempotencyKey: `enroll:${member}` }
      );
      return;
    } catch (error) {
      lastError = error;
      if (!(error instanceof LipApiError) || error.status !== 500) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw lastError;
}

export async function seedWorld(cafes: readonly Cafe[]): Promise<FixtureWorld> {
  const [a, b] = cafes;
  if (a === undefined || b === undefined) throw new Error("seedWorld needs exactly two cafes");
  const run = randomUUID().slice(0, 8);
  const build = async (cafe: Cafe, tag: string): Promise<FixtureCafe> => {
    const branches = [
      { branchId: `${tag}-branch-1-${run}`, name: `${tag} branch 1` },
      { branchId: `${tag}-branch-2-${run}`, name: `${tag} branch 2` }
    ] as const;
    for (const branch of branches) {
      await registerBranch(cafe, { location_id: branch.branchId, name: branch.name });
    }
    const customers = [
      { memberId: memberId(`${tag}-customer-1-${run}`), customerId: `${tag}-customer-1-${run}` },
      { memberId: memberId(`${tag}-customer-2-${run}`), customerId: `${tag}-customer-2-${run}` }
    ] as const;
    for (const customer of customers) {
      await enroll(cafe.client, cafe.programId, customer.memberId);
    }
    return {
      cafe,
      branches,
      customers,
      staff: [
        { staffId: `${tag}-cashier-${run}`, role: "cashier", syntheticSecret: `synthetic-not-a-secret-${tag}-cashier` },
        { staffId: `${tag}-owner-${run}`, role: "owner", syntheticSecret: `synthetic-not-a-secret-${tag}-owner` }
      ]
    };
  };
  return { cafes: [await build(a, "cafe-a"), await build(b, "cafe-b")] };
}
