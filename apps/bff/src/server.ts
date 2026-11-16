import { randomUUID } from "node:crypto";
import { serve, type ServerType } from "@hono/node-server";
import { Hono, type Context } from "hono";
import { loadConfig, type BffConfig } from "./config.js";

/**
 * BFF HTTP skeleton (T003; research R-03, R-05; contracts/README.md "Transport and
 * authentication" and "Error model"). Registers the four audience mounts with NO
 * business handlers; later tasks add routes under these mounts.
 *
 * Audience is bound to the surface host. Browser surfaces reach the BFF through the
 * private Next.js hop (R-05), which forwards the original host in `X-Forwarded-Host`;
 * the BFF is reachable only on that private network, so the header is read first and
 * `Host` is the fallback. A mount requested on another audience's host is
 * indistinguishable from a missing route (`404 not_found`).
 */
export type Audience = "customer" | "staff" | "owner" | "operator";

const MOUNTS: Readonly<Record<Audience, string>> = {
  customer: "/api/v1/customer",
  staff: "/api/v1/staff",
  owner: "/api/v1/owner",
  operator: "/operator/v1"
};
const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

interface Env {
  Variables: { requestId: string };
}

function errorBody(c: Context<Env>, code: string, details: Record<string, unknown> = {}) {
  return {
    error: { code, message_key: `errors.${code}`, request_id: c.get("requestId"), details }
  };
}

function effectiveHost(c: Context<Env>): string {
  const forwarded = c.req.header("x-forwarded-host")?.split(",")[0]?.trim();
  return (forwarded !== undefined && forwarded !== "" ? forwarded : (c.req.header("host") ?? "")).toLowerCase();
}

function originMatches(c: Context<Env>, surfaceHost: string): boolean {
  const origin = c.req.header("origin");
  if (origin !== undefined) {
    try {
      return new URL(origin).host.toLowerCase() === surfaceHost;
    } catch {
      return false;
    }
  }
  return c.req.header("sec-fetch-site")?.toLowerCase() === "same-origin";
}

export function createApp(config: BffConfig): Hono<Env> {
  const app = new Hono<Env>();

  app.use("*", async (c, next) => {
    c.set("requestId", `req_${randomUUID()}`);
    await next();
  });

  const audienceHost: Readonly<Record<Audience, string>> = {
    customer: config.hosts.customer,
    staff: config.hosts.staff,
    owner: config.hosts.owner,
    operator: config.hosts.api
  };

  for (const audience of Object.keys(MOUNTS) as Audience[]) {
    const mount = MOUNTS[audience];
    app.use(`${mount}/*`, async (c, next) => {
      const host = effectiveHost(c);
      if (host !== audienceHost[audience]) {
        return c.json(errorBody(c, "not_found"), 404);
      }
      // Browser surfaces: Origin (or Sec-Fetch-Site: same-origin) must match the surface host
      // on every state-changing request. The operator host takes bearer tokens only: no CSRF.
      if (audience !== "operator" && STATE_CHANGING.has(c.req.method) && !originMatches(c, host)) {
        return c.json(errorBody(c, "csrf_failed"), 403);
      }
      await next();
      return undefined;
    });
  }

  app.notFound((c) => c.json(errorBody(c, "not_found"), 404));

  app.onError((error, c) => {
    // Never return or log upstream error text: log the error class and request id only.
    console.error(JSON.stringify({ level: "error", request_id: c.get("requestId"), error: error.name }));
    return c.json(errorBody(c, "internal_error"), 500);
  });

  return app;
}

export function startServer(
  env: Readonly<Record<string, string | undefined>> = process.env
): { readonly config: BffConfig; readonly server: ServerType } {
  const config = loadConfig(env);
  const app = createApp(config);
  const server = serve({ fetch: app.fetch, port: config.port });
  return { config, server };
}
