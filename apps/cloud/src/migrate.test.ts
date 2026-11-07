import { describe, expect, it } from "vitest";
import { runSharedClusterMigrations } from "./migrate.js";

const postgresUrl = process.env["LIP_TEST_POSTGRES_URL"];

describe("runSharedClusterMigrations input validation", () => {
  it("rejects an empty control-plane connection string", async () => {
    await expect(runSharedClusterMigrations({ controlPlaneUrl: "  " }))
      .rejects.toThrow("control-plane connection string is required");
  });

  it("rejects non-postgres connection strings", async () => {
    await expect(runSharedClusterMigrations({ controlPlaneUrl: "mysql://nope" }))
      .rejects.toThrow(/PostgreSQL/);
    await expect(runSharedClusterMigrations({
      controlPlaneUrl: "postgres://ok@localhost/db",
      dataPlaneUrl: "file:///tmp/nope"
    })).rejects.toThrow("dataPlaneUrl");
  });
});

describe.skipIf(!postgresUrl)("runSharedClusterMigrations against Postgres", () => {
  it("applies engine and control-plane schemas idempotently", async () => {
    const first = await runSharedClusterMigrations({ controlPlaneUrl: postgresUrl! });
    expect(first).toEqual({
      shared_database: true,
      engine_schema: "applied",
      control_plane_schema: "applied"
    });

    // Second run must be a no-op, not a failure.
    const second = await runSharedClusterMigrations({ controlPlaneUrl: postgresUrl! });
    expect(second.shared_database).toBe(true);

    const { Client } = await import("pg");
    const client = new Client({ connectionString: postgresUrl });
    await client.connect();
    try {
      const tables = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_name IN
           ('lip_schema_migrations', 'lip_cloud_schema_migrations',
            'lip_engine_members', 'lip_cloud_environments')`
      );
      expect(tables.rows.map((row) => row.table_name).sort()).toEqual([
        "lip_cloud_environments",
        "lip_cloud_schema_migrations",
        "lip_engine_members",
        "lip_schema_migrations"
      ]);
      const engineVersions = await client.query<{ version: number }>(
        "SELECT version FROM lip_schema_migrations"
      );
      expect(engineVersions.rows.length).toBeGreaterThanOrEqual(1);
      const cloudVersions = await client.query<{ version: number }>(
        "SELECT version FROM lip_cloud_schema_migrations"
      );
      expect(cloudVersions.rows.length).toBeGreaterThanOrEqual(4);
    } finally {
      await client.end();
    }
  }, 90_000);

  it("serializes concurrent cold-start control-plane and customer migrations on a fresh schema", async () => {
    const { randomUUID } = await import("node:crypto");
    const { Pool } = await import("pg");
    const { PostgresCloudRepository } = await import("./postgres-repository.js");
    const { PostgresCustomerRepository } = await import("./customer-postgres-repository.js");
    const schema = `cloud_cold_start_${randomUUID().replace(/-/g, "_")}`;
    const adminPool = new Pool({ connectionString: postgresUrl! });
    const cloudPools = Array.from({ length: 4 }, () =>
      new Pool({ connectionString: postgresUrl!, max: 2, options: `-c search_path=${schema}` })
    );
    const customerPools = Array.from({ length: 4 }, () =>
      new Pool({ connectionString: postgresUrl!, max: 2, options: `-c search_path=${schema}` })
    );
    const allPools = [...cloudPools, ...customerPools];
    try {
      await adminPool.query(`CREATE SCHEMA ${schema}`);
      await Promise.all(allPools.map((pool) => pool.query("SELECT 1")));
      await Promise.all([
        ...cloudPools.map((pool) => new PostgresCloudRepository({ pool }).migrate()),
        ...customerPools.map((pool) => new PostgresCustomerRepository({ pool }).migrate())
      ]);
      const cloudVersions = await adminPool.query<{ version: number }>(
        `SELECT version FROM ${schema}.lip_cloud_schema_migrations ORDER BY version`
      );
      expect(cloudVersions.rows.map((row) => row.version)).toEqual([1, 2, 3, 4, 5, 6]);
    } finally {
      await Promise.all(allPools.map((pool) => pool.end()));
      await adminPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await adminPool.end();
    }
  }, 90_000);
});
