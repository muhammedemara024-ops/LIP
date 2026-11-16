import { assertSessionLeaseCompatibleUrl } from "@loyalty-interchange/storage-postgres";

/**
 * BFF startup configuration (T003; research R-03, R-05, R-25; contracts/README.md
 * "Transport and authentication").
 *
 * The environment variable names below are chosen by T003 and are not yet part of an
 * approved contract. Validation reports variable NAMES only: a secret or connection
 * string value is never copied into an error message, a log line or a response.
 */
export interface BffConfig {
  readonly port: number;
  /** Surface hosts, bare lower-case host names (no port, no trailing dot: the audience check compares them with the request `Host` after the port is stripped). The BFF serves each audience only on its own host. */
  readonly hosts: {
    readonly customer: string;
    readonly staff: string;
    readonly owner: string;
    readonly api: string;
  };
  readonly databaseUrl: string;
  readonly directoryDatabaseUrl: string;
  readonly lipRuntimeUrl: string;
  readonly lipApiKey: string;
  readonly otpHmacSecret: string;
}

export class ConfigError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid BFF configuration: ${issues.join("; ")}`);
    this.name = "ConfigError";
    this.issues = issues;
  }
}

const REQUIRED_SECRETS = ["BFF_LIP_API_KEY", "BFF_OTP_HMAC_SECRET"] as const;
const REQUIRED_HOSTS = ["BFF_HOST_CUSTOMER", "BFF_HOST_STAFF", "BFF_HOST_OWNER", "BFF_HOST_API"] as const;
const DATABASE_URLS = ["BFF_DATABASE_URL", "BFF_DIRECTORY_DATABASE_URL"] as const;
const DEFAULT_PORT = 8080;

export function loadConfig(env: Readonly<Record<string, string | undefined>>): BffConfig {
  const issues: string[] = [];
  const read = (name: string): string => {
    const value = env[name]?.trim() ?? "";
    if (value === "") {
      issues.push(`${name} is required`);
    }
    return value;
  };

  const hosts = REQUIRED_HOSTS.map((name) => {
    const host = read(name).toLowerCase();
    if (host !== "" && !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/u.test(host)) {
      issues.push(`${name} must be a bare host name (no port, scheme, path or trailing dot)`);
    }
    return host;
  });
  const urls = DATABASE_URLS.map((name) => {
    const value = read(name);
    if (value !== "") {
      try {
        assertSessionLeaseCompatibleUrl(value, name);
      } catch (error) {
        // The policy messages name the variable only; they never echo the value.
        issues.push(error instanceof Error ? error.message : `${name} is invalid`);
      }
    }
    return value;
  });
  const lipRuntimeUrl = read("BFF_LIP_RUNTIME_URL");
  if (lipRuntimeUrl !== "") {
    try {
      const parsed = new URL(lipRuntimeUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        issues.push("BFF_LIP_RUNTIME_URL must be an http(s) URL");
      }
    } catch {
      issues.push("BFF_LIP_RUNTIME_URL must be an http(s) URL");
    }
  }
  const secrets = REQUIRED_SECRETS.map((name) => read(name));

  let port = DEFAULT_PORT;
  const rawPort = env["BFF_PORT"]?.trim();
  if (rawPort !== undefined && rawPort !== "") {
    const parsedPort = Number(rawPort);
    if (!/^\d+$/u.test(rawPort) || parsedPort < 1 || parsedPort > 65535) {
      issues.push("BFF_PORT must be an integer from 1 to 65535");
    } else {
      port = parsedPort;
    }
  }

  const present = hosts.filter((host) => host !== "");
  if (new Set(present).size !== present.length) {
    issues.push("BFF_HOST_CUSTOMER, BFF_HOST_STAFF, BFF_HOST_OWNER and BFF_HOST_API must be distinct");
  }

  if (issues.length > 0) {
    throw new ConfigError(issues);
  }
  const [customer = "", staff = "", owner = "", api = ""] = hosts;
  const [databaseUrl = "", directoryDatabaseUrl = ""] = urls;
  const [lipApiKey = "", otpHmacSecret = ""] = secrets;
  return {
    port,
    hosts: { customer, staff, owner, api },
    databaseUrl,
    directoryDatabaseUrl,
    lipRuntimeUrl,
    lipApiKey,
    otpHmacSecret
  };
}
