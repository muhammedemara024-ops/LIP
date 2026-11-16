import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "./config.js";
import { createApp } from "./server.js";

const config = loadConfig({
  BFF_HOST_CUSTOMER: "app.example.test",
  BFF_HOST_STAFF: "staff.example.test",
  BFF_HOST_OWNER: "dashboard.example.test",
  BFF_HOST_API: "api.example.test",
  BFF_DATABASE_URL: "postgres://bff:bff-pass@db.internal:5432/lip",
  BFF_DIRECTORY_DATABASE_URL: "postgres://dir:dir-pass@db.internal:5432/lip",
  BFF_LIP_RUNTIME_URL: "https://lip.internal",
  BFF_LIP_API_KEY: "lip-key-secret-value",
  BFF_OTP_HMAC_SECRET: "otp-hmac-secret-value"
});

interface ErrorEnvelope {
  error: { code: string; message_key: string; request_id: string; details: Record<string, unknown> };
}

async function call(
  app: ReturnType<typeof createApp>,
  method: string,
  path: string,
  headers: Record<string, string>
): Promise<{ status: number; body: ErrorEnvelope }> {
  const response = await app.request(`http://bff.internal${path}`, { method, headers });
  return { status: response.status, body: (await response.json()) as ErrorEnvelope };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BFF HTTP skeleton", () => {
  it("answers an unknown route on a known host with the error envelope and a request id", async () => {
    const { status, body } = await call(createApp(config), "GET", "/api/v1/customer/unknown", { host: "app.example.test" });
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
    expect(body.error.message_key).toBe("errors.not_found");
    expect(body.error.request_id).toMatch(/^req_[0-9a-f-]{36}$/u);
  });

  it("rejects a state-changing request with a foreign Origin as 403 csrf_failed", async () => {
    for (const [mount, host] of [
      ["customer", "app.example.test"],
      ["staff", "staff.example.test"],
      ["owner", "dashboard.example.test"]
    ] as const) {
      const { status, body } = await call(createApp(config), "POST", `/api/v1/${mount}/anything`, {
        host,
        origin: "https://evil.example.test"
      });
      expect(status).toBe(403);
      expect(body.error.code).toBe("csrf_failed");
    }
  });

  it("rejects a state-changing request carrying neither Origin nor Sec-Fetch-Site same-origin", async () => {
    const { status, body } = await call(createApp(config), "DELETE", "/api/v1/owner/anything", { host: "dashboard.example.test" });
    expect(status).toBe(403);
    expect(body.error.code).toBe("csrf_failed");
  });

  it("rejects a malformed Origin and a Sec-Fetch-Site other than same-origin", async () => {
    const app = createApp(config);
    expect((await call(app, "POST", "/api/v1/customer/x", { host: "app.example.test", origin: "not a url" })).body.error.code).toBe(
      "csrf_failed"
    );
    expect(
      (await call(app, "PUT", "/api/v1/customer/x", { host: "app.example.test", "sec-fetch-site": "cross-site" })).body.error.code
    ).toBe("csrf_failed");
  });

  it("lets a same-origin state-changing request through the CSRF check (no handler: 404)", async () => {
    const app = createApp(config);
    const withOrigin = await call(app, "POST", "/api/v1/customer/x", { host: "app.example.test", origin: "https://app.example.test" });
    expect(withOrigin.status).toBe(404);
    const withFetchSite = await call(app, "PATCH", "/api/v1/staff/x", {
      host: "staff.example.test",
      "sec-fetch-site": "same-origin"
    });
    expect(withFetchSite.status).toBe(404);
  });

  it("does not apply CSRF checks to GET requests", async () => {
    const { status, body } = await call(createApp(config), "GET", "/api/v1/customer/x", {
      host: "app.example.test",
      origin: "https://evil.example.test"
    });
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });

  it("uses X-Forwarded-Host from the private hop before Host", async () => {
    const { status } = await call(createApp(config), "POST", "/api/v1/customer/x", {
      host: "bff.internal",
      "x-forwarded-host": "app.example.test",
      origin: "https://app.example.test"
    });
    expect(status).toBe(404);
  });

  it("does not let customer, staff or owner hosts invoke the operator mount", async () => {
    const app = createApp(config);
    for (const host of ["app.example.test", "staff.example.test", "dashboard.example.test", "unknown.example.test"]) {
      for (const method of ["GET", "POST"]) {
        const { status, body } = await call(app, method, "/operator/v1/anything", {
          host,
          origin: `https://${host}`
        });
        expect(status).toBe(404);
        expect(body.error.code).toBe("not_found");
      }
    }
  });

  it("serves the operator mount only on the api host, without CSRF", async () => {
    const { status, body } = await call(createApp(config), "POST", "/operator/v1/anything", { host: "api.example.test" });
    expect(status).toBe(404);
    expect(body.error.code).toBe("not_found");
  });

  it("does not let the operator host invoke a browser surface mount", async () => {
    const { status } = await call(createApp(config), "GET", "/api/v1/owner/x", { host: "api.example.test" });
    expect(status).toBe(404);
  });

  it("never leaks the text of a thrown upstream error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createApp(config);
    app.get("/api/v1/customer/boom", () => {
      throw new Error("upstream said: secret-token-123 for +201012345678");
    });
    const response = await app.request("http://bff.internal/api/v1/customer/boom", { headers: { host: "app.example.test" } });
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).not.toContain("secret-token-123");
    expect(text).not.toContain("+201012345678");
    const body = JSON.parse(text) as ErrorEnvelope;
    expect(body.error.code).toBe("internal_error");
    expect(body.error.request_id).toMatch(/^req_/u);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain("secret-token-123");
    expect(logged).not.toContain("+201012345678");
    expect(logged).toContain(body.error.request_id);
  });
});
