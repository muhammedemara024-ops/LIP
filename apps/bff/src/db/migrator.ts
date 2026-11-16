import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Pool, PoolClient } from "pg";

/**
 * BFF and directory migration runners (T005; research R-23; data-model.md section 1;
 * constitution Article VI; FP-001 pattern).
 *
 * Each runner owns one numbered, forward-only SQL directory, one migration table and one
 * advisory-lock key. The lock is taken with `pg_advisory_xact_lock` INSIDE `BEGIN ... COMMIT`
 * and BEFORE the migration-table DDL, so concurrent cold starts serialize instead of racing
 * on `CREATE TABLE IF NOT EXISTS`. The whole run is one transaction: a failing migration
 * rolls everything back, and nothing is recorded as applied.
 */
export type MigrationTarget = "bff" | "directory";

export interface MigrationTargetSpec {
  readonly lockKey: string;
  readonly table: string;
  readonly directory: URL;
}

export const MIGRATION_TARGETS: Readonly<Record<MigrationTarget, MigrationTargetSpec>> = {
  bff: {
    lockKey: "lip:bff:schema-migrations",
    table: "bff_schema_migrations",
    directory: new URL("../../migrations/bff/", import.meta.url)
  },
  directory: {
    lockKey: "lip:directory:schema-migrations",
    table: "directory_schema_migrations",
    directory: new URL("../../migrations/directory/", import.meta.url)
  }
};

export interface MigrationFile {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

export class PendingMigrationsError extends Error {
  readonly target: MigrationTarget;
  readonly pendingVersions: readonly number[];

  constructor(target: MigrationTarget, pendingVersions: readonly number[]) {
    super(`${target} schema has pending migrations: ${pendingVersions.join(", ")}`);
    this.name = "PendingMigrationsError";
    this.target = target;
    this.pendingVersions = pendingVersions;
  }
}

const FILE_PATTERN = /^(\d{3,})_([a-z0-9][a-z0-9_-]*)\.sql$/u;

/**
 * Reads `NNN_name.sql` files in ascending version order. Anything else in the directory
 * (for example `.gitkeep`) is ignored. A duplicate version is refused.
 */
export async function loadMigrations(directory: URL | string): Promise<MigrationFile[]> {
  const path = typeof directory === "string" ? directory : fileURLToPath(directory);
  const entries = await readdir(path);
  const parsed: { version: number; name: string; file: string }[] = [];
  for (const file of entries) {
    const match = FILE_PATTERN.exec(file);
    if (match === null) continue;
    parsed.push({ version: Number(match[1]), name: match[2] ?? "", file });
  }
  parsed.sort((a, b) => a.version - b.version);
  for (let i = 1; i < parsed.length; i += 1) {
    if (parsed[i]?.version === parsed[i - 1]?.version) {
      throw new Error(`Duplicate migration version ${parsed[i]?.version} in ${path}`);
    }
  }
  const files: MigrationFile[] = [];
  for (const item of parsed) {
    files.push({
      version: item.version,
      name: item.name,
      sql: await readFile(`${path.replace(/[\\/]+$/u, "")}/${item.file}`, "utf8")
    });
  }
  return files;
}

export interface BffMigratorOptions {
  /** Overrides the target's SQL directory. Intended for tests. */
  readonly directory?: URL | string;
}

export class BffMigrator {
  private readonly pool: Pool;
  private readonly target: MigrationTarget;
  private readonly spec: MigrationTargetSpec;
  private readonly directory: URL | string;

  public constructor(pool: Pool, target: MigrationTarget, options: BffMigratorOptions = {}) {
    this.pool = pool;
    this.target = target;
    this.spec = MIGRATION_TARGETS[target];
    this.directory = options.directory ?? this.spec.directory;
  }

  /** Applies every pending migration in one transaction. Returns the versions applied by this call. */
  public async migrate(): Promise<number[]> {
    const files = await loadMigrations(this.directory);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // FP-001: the lock comes first, inside the transaction, before the table DDL.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [this.spec.lockKey]);
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.spec.table} (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      const existing = await client.query<{ version: number }>(`SELECT version FROM ${this.spec.table}`);
      const applied = new Set(existing.rows.map((row) => row.version));
      const appliedNow: number[] = [];
      for (const file of files) {
        if (applied.has(file.version)) continue;
        await client.query(file.sql);
        await client.query(`INSERT INTO ${this.spec.table} (version, name) VALUES ($1, $2)`, [file.version, file.name]);
        appliedNow.push(file.version);
      }
      await client.query("COMMIT");
      return appliedNow;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  /** Versions on disk that the database has not recorded. A missing migration table means all are pending. Read-only. */
  public async pending(): Promise<number[]> {
    const files = await loadMigrations(this.directory);
    const table = await this.pool.query<{ present: string | null }>("SELECT to_regclass($1)::text AS present", [this.spec.table]);
    if (table.rows[0]?.present == null) {
      return files.map((file) => file.version);
    }
    const existing = await this.pool.query<{ version: number }>(`SELECT version FROM ${this.spec.table}`);
    const applied = new Set(existing.rows.map((row) => row.version));
    return files.filter((file) => !applied.has(file.version)).map((file) => file.version);
  }

  /** Startup guard: throws `PendingMigrationsError` instead of letting the service boot on an old schema. */
  public async assertNoPending(): Promise<void> {
    const pending = await this.pending();
    if (pending.length > 0) {
      throw new PendingMigrationsError(this.target, pending);
    }
  }
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // The connection is already unusable; the original error is the one to report.
  }
}
