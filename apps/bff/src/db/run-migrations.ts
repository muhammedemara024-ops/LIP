import { assertSessionLeaseCompatibleUrl } from "@loyalty-interchange/storage-postgres";
import { Pool } from "pg";
import { BffMigrator, type MigrationTarget } from "./migrator.js";

/**
 * Applies the BFF and directory migrations with SEPARATE migrator credentials (data-model.md
 * section 1: `lip_bff_migrator` for schema `bff`; the directory schema has its own role).
 * The environment variable names are chosen by T005 and are not yet part of an approved contract.
 * Connection strings must be direct or session-mode (constitution Article VI, PD-002).
 */
export const MIGRATOR_URL_VARIABLES: Readonly<Record<MigrationTarget, string>> = {
  bff: "BFF_MIGRATOR_DATABASE_URL",
  directory: "BFF_DIRECTORY_MIGRATOR_DATABASE_URL"
};

export async function runMigrations(
  env: Readonly<Record<string, string | undefined>>
): Promise<Record<MigrationTarget, number[]>> {
  const urls = {} as Record<MigrationTarget, string>;
  for (const target of ["bff", "directory"] as const) {
    const name = MIGRATOR_URL_VARIABLES[target];
    const value = env[name]?.trim() ?? "";
    if (value === "") {
      throw new Error(`${name} is required`);
    }
    assertSessionLeaseCompatibleUrl(value, name);
    urls[target] = value;
  }

  const result = { bff: [], directory: [] } as Record<MigrationTarget, number[]>;
  for (const target of ["bff", "directory"] as const) {
    const pool = new Pool({ connectionString: urls[target], max: 1 });
    try {
      result[target] = await new BffMigrator(pool, target).migrate();
    } finally {
      await pool.end();
    }
  }
  return result;
}
