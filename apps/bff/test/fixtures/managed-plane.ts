import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { LipClient } from "@loyalty-interchange/sdk";
import { createDemoProgram } from "@loyalty-interchange/server";
import { ManagedPostgresDataPlaneManager } from "../../../cloud/src/managed-data-plane.js";
import type { CloudEnvironment } from "../../../cloud/src/types.js";

/**
 * A REAL managed data plane: apps/cloud `ManagedPostgresDataPlaneManager` on a real PostgreSQL,
 * mounted behind an in-process HTTP listener, with tenant runtimes addressed by
 * `/runtime/v1/environments/<environment_id>` (contracts/lip-integration.md; research R-24).
 * Nothing here is mocked. Recipe source: apps/cloud/src/managed-data-plane.ts.
 */
export interface Cafe {
  readonly key: "cafe-a" | "cafe-b";
  readonly environment: CloudEnvironment;
  readonly tenantId: string;
  readonly programId: string;
  readonly merchantApiKey: string;
  readonly lipBaseUrl: string;
  readonly client: LipClient;
}

export interface ManagedPlane {
  readonly baseUrl: string;
  readonly cafes: readonly Cafe[];
  close(): Promise<void>;
}

function environmentRecord(suffix: string, cafe: string, nowIso: string): CloudEnvironment {
  return {
    environment_id: `env-${cafe}-${suffix}`,
    project_id: `project-${cafe}-${suffix}`,
    slug: "development",
    name: `Fixture ${cafe}`,
    kind: "development",
    region: "render-oregon",
    tenant_id: `tenant-${cafe}-${suffix}`,
    program_id: `program-${cafe}-${suffix}`,
    status: "ready",
    created_at: nowIso,
    updated_at: nowIso
  };
}

async function admin(
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  body: unknown
): Promise<Record<string, unknown>> {
  // Observed against pinned LIP (recorded for T008): two back-to-back requests with the same key can
  // answer 500 internal_error when the key's last-used write loses a state-revision race
  // (StateRevisionConflictError in AccessControlService.authenticate). The fixture retries; the
  // admin writes used here are idempotent.
  let last = "";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const text = await response.text();
    if (response.ok) {
      return JSON.parse(text) as Record<string, unknown>;
    }
    last = `admin ${method} ${path} -> ${response.status}: ${text.slice(0, 300)}`;
    if (response.status !== 500) break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(last);
}

/**
 * Starts the plane and provisions two cafes (two tenants, two environments) on one database.
 * Each cafe publishes the demo points program under its own program id.
 */
export async function startManagedPlane(connectionString: string, nowIso = "2026-01-01T00:00:00.000Z"): Promise<ManagedPlane> {
  const suffix = randomUUID().slice(0, 8);
  const environments = [
    ["cafe-a", environmentRecord(suffix, "a", nowIso)],
    ["cafe-b", environmentRecord(suffix, "b", nowIso)]
  ] as const;
  const byId = new Map(environments.map(([, environment]) => [environment.environment_id, environment]));

  let manager: ManagedPostgresDataPlaneManager | undefined;
  const server: Server = createServer((request, response) => {
    void manager?.handleRuntimeRequest(request, response).then((handled) => {
      if (!handled) {
        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ code: "not_found" }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  manager = new ManagedPostgresDataPlaneManager({
    connectionString,
    publicBaseUrl: baseUrl,
    environmentById: async (id) => byId.get(id),
    readyEnvironments: async () => [...byId.values()],
    onEvent: () => undefined
  });

  const cafes: Cafe[] = [];
  try {
    for (const [key, environment] of environments) {
      const credential = await manager.issueMerchantCredential(environment.environment_id, { subject: "fixture" });
      const lipBaseUrl = credential.api_url;
      const program = { ...createDemoProgram(), program_id: environment.program_id };
      const draft = await admin(lipBaseUrl, credential.merchant_api_key, "PUT", "/admin/api/v1/program/draft", { program });
      const version = (draft["draft"] as { version: number }).version;
      await admin(lipBaseUrl, credential.merchant_api_key, "POST", "/admin/api/v1/program/publish", { expected_draft_version: version });
      cafes.push({
        key,
        environment,
        tenantId: environment.tenant_id,
        programId: environment.program_id,
        merchantApiKey: credential.merchant_api_key,
        lipBaseUrl,
        client: new LipClient({ baseUrl: lipBaseUrl, apiKey: credential.merchant_api_key, retry: { attempts: 8 } })
      });
    }
  } catch (error) {
    await manager.close().catch(() => undefined);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw error;
  }

  return {
    baseUrl,
    cafes,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await manager?.close();
    }
  };
}

export async function registerBranch(cafe: Cafe, branch: { location_id: string; name: string }): Promise<void> {
  await admin(cafe.lipBaseUrl, cafe.merchantApiKey, "PUT", "/admin/api/v1/locations", branch);
}
