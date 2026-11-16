import { randomUUID } from "node:crypto";
import { Pool } from "pg";

/** Deterministic, manually advanced clock for fixtures. Later tasks inject it where a seam takes a clock. */
export class ManualClock {
  private current: number;

  constructor(startIso = "2026-01-01T00:00:00.000Z") {
    this.current = Date.parse(startIso);
  }

  now(): Date {
    return new Date(this.current);
  }

  nowMs(): number {
    return this.current;
  }

  advance(ms: number): void {
    if (!Number.isInteger(ms) || ms < 0) throw new Error("advance(ms) takes a non-negative integer");
    this.current += ms;
  }

  set(iso: string): void {
    this.current = Date.parse(iso);
  }
}

export type FailpointAction = "throw" | "hang" | "once-throw";

/**
 * Named crash-injection points. A fixture or test calls `await failpoints.hit("name")` at a point
 * where a crash can be simulated; tests arm it. Unarmed points cost one Map lookup.
 */
export class Failpoints {
  private readonly armed = new Map<string, { action: FailpointAction; release?: () => void; wait?: Promise<void> }>();
  private readonly hits = new Map<string, number>();

  arm(name: string, action: FailpointAction): void {
    if (action === "hang") {
      let release: () => void = () => undefined;
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      this.armed.set(name, { action, release, wait });
    } else {
      this.armed.set(name, { action });
    }
  }

  disarm(name: string): void {
    this.armed.get(name)?.release?.();
    this.armed.delete(name);
  }

  hitCount(name: string): number {
    return this.hits.get(name) ?? 0;
  }

  async hit(name: string): Promise<void> {
    this.hits.set(name, this.hitCount(name) + 1);
    const entry = this.armed.get(name);
    if (entry === undefined) return;
    if (entry.action === "hang") {
      await entry.wait;
      return;
    }
    if (entry.action === "once-throw") {
      this.armed.delete(name);
    }
    throw new Error(`failpoint ${name}`);
  }
}

/** Replaces the database name in a PostgreSQL URL. */
export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

export interface DisposableDatabase {
  readonly name: string;
  readonly url: string;
  /** Drops the database, terminating any remaining connections. Idempotent. */
  drop(): Promise<void>;
}

/** Creates a uniquely named empty database next to `adminUrl`'s and returns its URL. */
export async function createDisposableDatabase(adminUrl: string): Promise<DisposableDatabase> {
  const name = `bff_fixture_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: adminUrl, max: 1 });
  try {
    await admin.query(`CREATE DATABASE ${name}`);
  } finally {
    await admin.end();
  }
  let dropped = false;
  return {
    name,
    url: withDatabase(adminUrl, name),
    async drop() {
      if (dropped) return;
      dropped = true;
      const pool = new Pool({ connectionString: adminUrl, max: 1 });
      try {
        await pool.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      } finally {
        await pool.end();
      }
    }
  };
}
