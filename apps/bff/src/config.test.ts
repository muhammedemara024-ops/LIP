import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config.js";

const GOOD: Record<string, string> = {
  BFF_HOST_CUSTOMER: "app.example.test",
  BFF_HOST_STAFF: "staff.example.test",
  BFF_HOST_OWNER: "dashboard.example.test",
  BFF_HOST_API: "api.example.test",
  BFF_DATABASE_URL: "postgres://bff:bff-pass@db.internal:5432/lip",
  BFF_DIRECTORY_DATABASE_URL: "postgres://dir:dir-pass@db.internal:5432/lip",
  BFF_LIP_RUNTIME_URL: "https://lip.internal",
  BFF_LIP_API_KEY: "lip-key-secret-value",
  BFF_OTP_HMAC_SECRET: "otp-hmac-secret-value"
};

function issuesFor(env: Record<string, string | undefined>): readonly string[] {
  try {
    loadConfig(env);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return (error as ConfigError).issues;
  }
  throw new Error("expected loadConfig to throw");
}

describe("loadConfig", () => {
  it("accepts a complete configuration and defaults the port", () => {
    const config = loadConfig(GOOD);
    expect(config.port).toBe(8080);
    expect(config.hosts.api).toBe("api.example.test");
  });

  it("lower-cases hosts and honours BFF_PORT", () => {
    const config = loadConfig({ ...GOOD, BFF_HOST_API: "API.Example.Test", BFF_PORT: "9090" });
    expect(config.hosts.api).toBe("api.example.test");
    expect(config.port).toBe(9090);
  });

  it.each(["BFF_LIP_API_KEY", "BFF_OTP_HMAC_SECRET", "BFF_DATABASE_URL", "BFF_DIRECTORY_DATABASE_URL", "BFF_LIP_RUNTIME_URL"])(
    "refuses to start without %s",
    (name) => {
      expect(issuesFor({ ...GOOD, [name]: undefined })).toContain(`${name} is required`);
      expect(issuesFor({ ...GOOD, [name]: "   " })).toContain(`${name} is required`);
    }
  );

  it("refuses a transaction-pooler database URL (pooler host)", () => {
    const issues = issuesFor({ ...GOOD, BFF_DATABASE_URL: "postgres://u:p@aws-0-eu.pooler.supabase.com:6543/postgres" });
    expect(issues.join(" ")).toContain("BFF_DATABASE_URL must use a direct endpoint");
  });

  it("refuses a pgbouncer=true directory database URL", () => {
    const issues = issuesFor({ ...GOOD, BFF_DIRECTORY_DATABASE_URL: "postgres://u:p@db.internal:5432/lip?pgbouncer=true" });
    expect(issues.join(" ")).toContain("BFF_DIRECTORY_DATABASE_URL must use a direct endpoint");
  });

  it("refuses a non-PostgreSQL database URL", () => {
    expect(issuesFor({ ...GOOD, BFF_DATABASE_URL: "mysql://u:p@db.internal/lip" }).join(" ")).toContain(
      "BFF_DATABASE_URL must be a PostgreSQL connection string"
    );
  });

  it("refuses a surface host written with a port, scheme, path or trailing dot, naming only the variable", () => {
    for (const bad of ["app.example.test:8443", "https://app.example.test", "app.example.test/x", "app.example.test."]) {
      const issues = issuesFor({ ...GOOD, BFF_HOST_CUSTOMER: bad });
      expect(issues.some((issue) => issue.includes("BFF_HOST_CUSTOMER"))).toBe(true);
      expect(issues.join(" ")).not.toContain(bad);
    }
  });

  it("refuses duplicate surface hosts and an invalid port", () => {
    expect(issuesFor({ ...GOOD, BFF_HOST_STAFF: "app.example.test" }).join(" ")).toContain("must be distinct");
    expect(issuesFor({ ...GOOD, BFF_PORT: "70000" }).join(" ")).toContain("BFF_PORT");
    expect(issuesFor({ ...GOOD, BFF_PORT: "80x" }).join(" ")).toContain("BFF_PORT");
  });

  it("never copies a secret or connection string value into an error message", () => {
    let message = "";
    try {
      loadConfig({
        ...GOOD,
        BFF_DATABASE_URL: "postgres://bff:bff-pass@aws-0-eu.pooler.supabase.com:6543/postgres",
        BFF_LIP_RUNTIME_URL: "ftp://lip-key-secret-value"
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toBe("");
    for (const secret of ["bff-pass", "dir-pass", "lip-key-secret-value", "otp-hmac-secret-value"]) {
      expect(message).not.toContain(secret);
    }
  });
});
