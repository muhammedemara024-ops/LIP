import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BffMigrator, MIGRATION_TARGETS, PendingMigrationsError, loadMigrations } from "./migrator.js";
import { MIGRATOR_URL_VARIABLES, runMigrations } from "./run-migrations.js";

/**
 * Migration runner tests (T005). The PostgreSQL cases run against a disposable database that
 * the suite creates and drops itself, and are skipped without LIP_TEST_POSTGRES_URL (CI sets it
 * and fails the run on any skip, so they execute there on Linux + PostgreSQL 17).
 */
const adminUrl = process.env["LIP_TEST_POSTGRES_URL"];
const live = adminUrl ? describe : describe.skip;

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

async function writeMigrations(directory: string, files: Record<string, string>): Promise<void> {
  for (const [name, sql] of Object.entries(files)) {
    await writeFile(join(directory, name), sql);
  }
}

describe("loadMigrations", () => {
  it("returns numbered files in ascending order and ignores other files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bff-migrations-"));
    try {
      await writeMigrations(directory, {
        "010_second.sql": "SELECT 2;",
        "002_first.sql": "SELECT 1;",
        ".gitkeep": "",
        "notes.txt": "ignored",
        "bad name.sql": "ignored"
      });
      const files = await loadMigrations(directory);
      expect(files.map((file) => [file.version, file.name])).toEqual([
        [2, "first"],
        [10, "second"]
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("refuses a duplicate version", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bff-migrations-"));
    try {
      await writeMigrations(directory, { "001_a.sql": "SELECT 1;", "001_b.sql": "SELECT 2;" });
      await expect(loadMigrations(directory)).rejects.toThrow(/Duplicate migration version 1/u);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("loads the two shipped migration directories (currently empty of SQL)", async () => {
    expect(await loadMigrations(MIGRATION_TARGETS.bff.directory)).toEqual([]);
    expect(await loadMigrations(MIGRATION_TARGETS.directory.directory)).toEqual([]);
  });

  it("uses the lock keys and tables pinned by research R-23", () => {
    expect(MIGRATION_TARGETS.bff.lockKey).toBe("lip:bff:schema-migrations");
    expect(MIGRATION_TARGETS.bff.table).toBe("bff_schema_migrations");
    expect(MIGRATION_TARGETS.directory.lockKey).toBe("lip:directory:schema-migrations");
    expect(MIGRATION_TARGETS.directory.table).toBe("directory_schema_migrations");
  });
});

describe("runMigrations configuration", () => {
  it("requires both migrator URLs and refuses a transaction-pooler endpoint before connecting", async () => {
    await expect(runMigrations({})).rejects.toThrow(`${MIGRATOR_URL_VARIABLES.bff} is required`);
    await expect(
      runMigrations({ [MIGRATOR_URL_VARIABLES.bff]: "postgres://u:p@db.internal:5432/x" })
    ).rejects.toThrow(`${MIGRATOR_URL_VARIABLES.directory} is required`);
    await expect(
      runMigrations({
        [MIGRATOR_URL_VARIABLES.bff]: "postgres://u:p@aws-0-eu.pooler.supabase.com:6543/postgres",
        [MIGRATOR_URL_VARIABLES.directory]: "postgres://u:p@db.internal:5432/x"
      })
    ).rejects.toThrow(/BFF_MIGRATOR_DATABASE_URL must use a direct endpoint/u);
    await expect(
      runMigrations({
        [MIGRATOR_URL_VARIABLES.bff]: "postgres://u:p@db.internal:5432/x",
        [MIGRATOR_URL_VARIABLES.directory]: "postgres://u:p@db.internal:5432/x?pgbouncer=true"
      })
    ).rejects.toThrow(/BFF_DIRECTORY_MIGRATOR_DATABASE_URL must use a direct endpoint/u);
  });
});

live("migration runners against a live PostgreSQL", () => {
  const databaseName = `bff_mig_${randomUUID().replaceAll("-", "")}`;
  let admin: Pool;
  let db: Pool;
  let directory: string;
  const pools: Pool[] = [];
  const newPool = (): Pool => {
    const pool = new Pool({ connectionString: withDatabase(adminUrl!, databaseName), max: 2 });
    pools.push(pool);
    return pool;
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: adminUrl!, max: 1 });
    await admin.query(`CREATE DATABASE ${databaseName}`);
    db = newPool();
    directory = await mkdtemp(join(tmpdir(), "bff-migrations-live-"));
    await writeMigrations(directory, {
      "001_widgets.sql": "CREATE TABLE migration_probe_widgets (id INTEGER PRIMARY KEY, label TEXT NOT NULL);",
      "002_seed.sql": "INSERT INTO migration_probe_widgets (id, label) VALUES (1, 'one');"
    });
  }, 60_000);

  afterAll(async () => {
    await Promise.all(pools.map((pool) => pool.end().catch(() => undefined)));
    await admin.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`).catch(() => undefined);
    await admin.end();
    await rm(directory, { recursive: true, force: true });
  }, 60_000);

  it("reports every file as pending before the table exists, and refuses startup", async () => {
    const migrator = new BffMigrator(newPool(), "bff", { directory });
    expect(await migrator.pending()).toEqual([1, 2]);
    await expect(migrator.assertNoPending()).rejects.toBeInstanceOf(PendingMigrationsError);
    // pending() is read-only: it must not have created the migration table.
    const probe = await db.query<{ present: string | null }>(
      "SELECT to_regclass('bff_schema_migrations')::text AS present"
    );
    expect(probe.rows[0]?.present ?? null).toBeNull();
  });

  it("eight simultaneous cold starts apply each migration exactly once with no DDL race", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => new BffMigrator(newPool(), "bff", { directory }).migrate())
    );
    const appliedCounts = results.map((applied) => applied.length);
    expect(appliedCounts.filter((count) => count === 2)).toHaveLength(1);
    expect(appliedCounts.filter((count) => count === 0)).toHaveLength(7);

    const versions = await db.query<{ version: number }>("SELECT version FROM bff_schema_migrations ORDER BY version");
    expect(versions.rows.map((row) => row.version)).toEqual([1, 2]);
    const seeded = await db.query<{ n: string }>("SELECT count(*)::text AS n FROM migration_probe_widgets");
    expect(seeded.rows[0]?.n).toBe("1");
  });

  it("repeat startup applies nothing twice and passes the pending guard", async () => {
    const migrator = new BffMigrator(newPool(), "bff", { directory });
    expect(await migrator.migrate()).toEqual([]);
    expect(await migrator.pending()).toEqual([]);
    await expect(migrator.assertNoPending()).resolves.toBeUndefined();
  });

  it("detects a newly added migration as pending until it is applied", async () => {
    await writeMigrations(directory, { "003_more.sql": "INSERT INTO migration_probe_widgets (id, label) VALUES (2, 'two');" });
    const migrator = new BffMigrator(newPool(), "bff", { directory });
    expect(await migrator.pending()).toEqual([3]);
    await expect(migrator.assertNoPending()).rejects.toMatchObject({ pendingVersions: [3] });
    expect(await migrator.migrate()).toEqual([3]);
  });

  it("rolls a failed migration back without marking it applied, then recovers once it is fixed", async () => {
    const failing = await mkdtemp(join(tmpdir(), "bff-migrations-fail-"));
    try {
      await writeMigrations(failing, {
        "001_ok.sql": "CREATE TABLE rollback_probe (id INTEGER PRIMARY KEY);",
        "002_boom.sql": "INSERT INTO rollback_probe (id) VALUES (1); SELECT * FROM table_that_does_not_exist;"
      });
      const migrator = new BffMigrator(newPool(), "directory", { directory: failing });
      await expect(migrator.migrate()).rejects.toThrow(/table_that_does_not_exist/u);

      // The whole run is one transaction, so even the migration table's own DDL rolled back:
      // nothing is recorded as applied.
      const recorded = await db.query<{ present: string | null }>("SELECT to_regclass('directory_schema_migrations')::text AS present");
      expect(recorded.rows[0]?.present ?? null).toBeNull();
      const tablePresent = await db.query<{ present: string | null }>("SELECT to_regclass('rollback_probe')::text AS present");
      expect(tablePresent.rows[0]?.present ?? null).toBeNull();
      expect(await migrator.pending()).toEqual([1, 2]);

      await writeFile(join(failing, "002_boom.sql"), "INSERT INTO rollback_probe (id) VALUES (1);");
      expect(await migrator.migrate()).toEqual([1, 2]);
    } finally {
      await rm(failing, { recursive: true, force: true });
    }
  });

  it("keeps the bff and directory migration tables and lock keys separate", async () => {
    const tables = await db.query<{ relname: string }>(
      "SELECT relname FROM pg_class WHERE relname IN ('bff_schema_migrations', 'directory_schema_migrations') ORDER BY relname"
    );
    expect(tables.rows.map((row) => row.relname)).toEqual(["bff_schema_migrations", "directory_schema_migrations"]);
    // The two targets must not contend on one lock: hold the bff lock and migrate the directory target.
    const holder = await newPool().connect();
    try {
      await holder.query("BEGIN");
      await holder.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [MIGRATION_TARGETS.bff.lockKey]);
      const other = await mkdtemp(join(tmpdir(), "bff-migrations-sep-"));
      try {
        await writeMigrations(other, { "001_sep.sql": "SELECT 1;" });
        const applied = await Promise.race([
          new BffMigrator(newPool(), "directory", { directory: other }).migrate(),
          new Promise<"blocked">((resolve) => setTimeout(() => resolve("blocked"), 5000))
        ]);
        expect(applied).not.toBe("blocked");
      } finally {
        await rm(other, { recursive: true, force: true });
      }
    } finally {
      await holder.query("ROLLBACK");
      holder.release();
    }
  });
});
