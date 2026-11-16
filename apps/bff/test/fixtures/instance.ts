import { randomBytes, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { serve, type ServerType } from "@hono/node-server";
import { Client, Pool, type PoolClient } from "pg";
import { loadConfig, type BffConfig } from "../../src/config.js";
import { createApp } from "../../src/server.js";
import { Failpoints } from "./support.js";

/**
 * One independently configured BFF instance: its own listener on port 0, its own configuration
 * (including its own OTP secret), its own PostgreSQL pool tagged with a unique `application_name`
 * (so its sessions, and therefore its session advisory locks, are distinct from every other
 * instance), its own failpoints. Instances share only the database.
 *
 * Limitation (recorded, not hidden): an instance is an in-process app, not an OS process. `kill()`
 * simulates a crash by closing the listener and terminating the instance's database sessions
 * server-side, which is what releases its advisory locks.
 */
export const FIXTURE_HOSTS = {
  BFF_HOST_CUSTOMER: "app.fixture.test",
  BFF_HOST_STAFF: "staff.fixture.test",
  BFF_HOST_OWNER: "dashboard.fixture.test",
  BFF_HOST_API: "api.fixture.test"
} as const;

export interface Lease {
  readonly key: string;
  release(): Promise<void>;
}

export interface BffInstance {
  readonly id: string;
  readonly applicationName: string;
  readonly url: string;
  readonly config: BffConfig;
  readonly failpoints: Failpoints;
  readonly pool: Pool;
  readonly alive: boolean;
  /** `pg_try_advisory_lock` on a connection owned by this instance; null when another session holds it. */
  tryLease(key: string): Promise<Lease | null>;
  /** PostgreSQL backend pids currently attributed to this instance. */
  backendPids(): Promise<number[]>;
  /** Graceful stop: close the listener, release leases, end the pool. */
  stop(): Promise<void>;
  /** Crash: close the listener and terminate this instance's database sessions. Other instances are untouched. */
  kill(): Promise<void>;
}

export interface StartBffInstanceOptions {
  readonly databaseUrl: string;
  readonly lipRuntimeUrl: string;
  readonly name?: string;
}

export async function startBffInstance(options: StartBffInstanceOptions): Promise<BffInstance> {
  const id = options.name ?? `bff-${randomUUID().slice(0, 8)}`;
  const applicationName = `bff-fixture-${id}`;
  const config = loadConfig({
    ...FIXTURE_HOSTS,
    BFF_DATABASE_URL: options.databaseUrl,
    BFF_DIRECTORY_DATABASE_URL: options.databaseUrl,
    BFF_LIP_RUNTIME_URL: options.lipRuntimeUrl,
    // Per-instance synthetic values: not real credentials, and different on every instance.
    BFF_LIP_API_KEY: `fixture-lip-key-${randomBytes(8).toString("hex")}`,
    BFF_OTP_HMAC_SECRET: randomBytes(32).toString("hex")
  });

  const pool = new Pool({ connectionString: options.databaseUrl, application_name: applicationName, max: 4 });
  // A killed instance's sessions are terminated server-side; that surfaces as pool/client 'error'
  // events which must not become uncaught exceptions.
  pool.on("error", () => undefined);
  const failpoints = new Failpoints();
  const app = createApp(config);
  let listening = true;
  const server: ServerType = await new Promise((resolve) => {
    const started = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" }, () => resolve(started));
  });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const held = new Map<string, PoolClient>();

  const closeListener = async (): Promise<void> => {
    if (!listening) return;
    listening = false;
    (server as { closeAllConnections?: () => void }).closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };

  const monitor = async <T>(run: (client: Client) => Promise<T>): Promise<T> => {
    const client = new Client({ connectionString: options.databaseUrl, application_name: `bff-fixture-monitor-${id}` });
    await client.connect();
    try {
      return await run(client);
    } finally {
      await client.end();
    }
  };

  const instance: BffInstance = {
    id,
    applicationName,
    url,
    config,
    failpoints,
    pool,
    get alive() {
      return listening;
    },
    async tryLease(key) {
      const client = await pool.connect();
      client.on("error", () => undefined);
      const result = await client.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked",
        [key]
      );
      if (result.rows[0]?.locked !== true) {
        client.release();
        return null;
      }
      held.set(key, client);
      return {
        key,
        async release() {
          const owner = held.get(key);
          if (owner === undefined) return;
          held.delete(key);
          await owner.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [key]);
          owner.release();
        }
      };
    },
    async backendPids() {
      return monitor(async (client) => {
        const result = await client.query<{ pid: number }>(
          "SELECT pid FROM pg_stat_activity WHERE application_name = $1 AND pid <> pg_backend_pid() ORDER BY pid",
          [applicationName]
        );
        return result.rows.map((row) => row.pid);
      });
    },
    async stop() {
      await closeListener();
      for (const [key, client] of held) {
        held.delete(key);
        await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [key]).catch(() => undefined);
        client.release();
      }
      await pool.end().catch(() => undefined);
    },
    async kill() {
      await closeListener();
      await monitor((client) =>
        client.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = $1 AND pid <> pg_backend_pid()",
          [applicationName]
        )
      );
      for (const client of held.values()) {
        client.release(true); // destroy: the backend is already gone
      }
      held.clear();
      await pool.end().catch(() => undefined);
    }
  };
  return instance;
}
