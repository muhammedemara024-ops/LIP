import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

// FP-008 regression: the postgres image's docker-entrypoint.sh creates POSTGRES_DB while running a
// temporary server with listen_addresses='' (Unix socket only). pg_isready exits 0 for any responding
// server, even when the requested database does not exist, so a socket probe reports healthy before
// CREATE DATABASE runs. Only a TCP probe is bound to the final, post-init server.

interface ComposeService {
  environment?: Record<string, string>;
  healthcheck?: { test?: string[]; start_period?: string };
  depends_on?: Record<string, { condition?: string }>;
  volumes?: string[];
}

const compose = parse(
  readFileSync(fileURLToPath(new URL("../../compose.yaml", import.meta.url)), "utf8")
) as { services: Record<string, ComposeService> };

const postgres = compose.services["postgres"]!;

describe("compose.yaml PostgreSQL readiness (FP-008)", () => {
  it("probes the final server over TCP for the configured user and database", () => {
    const test = postgres.healthcheck?.test ?? [];
    expect(test[0]).toBe("CMD-SHELL");
    const command = test[1] ?? "";
    expect(command).toMatch(/^pg_isready\s/);
    expect(command).toMatch(/(^|\s)-h\s+127\.0\.0\.1(\s|$)/);
    expect(command).not.toMatch(/(^|\s)-h\s+(\/|localhost(\s|$))/);
    expect(command).toContain(`-U ${postgres.environment?.["POSTGRES_USER"]}`);
    expect(command).toContain(`-d ${postgres.environment?.["POSTGRES_DB"]}`);
    expect(postgres.healthcheck?.start_period).toBe("30s");
  });

  it("keeps the existing database, credentials and volume configuration", () => {
    expect(postgres.environment).toEqual({
      POSTGRES_DB: "loyalty",
      POSTGRES_USER: "loyalty",
      POSTGRES_PASSWORD: "${LIP_POSTGRES_PASSWORD:-lip-local-password}"
    });
    expect(postgres.volumes).toEqual(["lip-postgres-data:/var/lib/postgresql/data"]);
  });

  it("gates every dependent service on postgres health", () => {
    const dependents = Object.entries(compose.services).filter(
      ([, service]) => service.depends_on?.["postgres"] !== undefined
    );
    expect(dependents.map(([name]) => name).sort()).toEqual(["cloud", "lip-postgres"]);
    for (const [, service] of dependents) {
      expect(service.depends_on?.["postgres"]?.condition).toBe("service_healthy");
    }
  });
});
