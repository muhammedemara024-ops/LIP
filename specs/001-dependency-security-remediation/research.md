# Research: Dependency Security Remediation (Task 0.12)

**Feature**: `001-dependency-security-remediation` | **Date**: 2026-11-09

## R-001: fast-uri Override Compatibility with Ajv 8.20.0

**Decision**: Override `fast-uri` to `^3.1.9` via root `package.json` `overrides`.

**Rationale**:
- `ajv@8.20.0` declares `"fast-uri": "^3.0.1"` — version `3.1.9` is within this semver range.
- 10 GHSA advisories affect `fast-uri` versions `3.0.0` through `3.1.8`. Version `3.1.9` is the minimum version resolving all 10 cumulatively.
- `fast-uri` is used by Ajv internally for URI parsing during JSON Schema compilation and `$ref` resolution. The 3.x → 3.1.9 upgrade is a patch-level change with no API surface modifications.
- The `@loyalty-interchange/protocol` package uses Ajv + TypeBox for all `/lip/v1` normative protocol schemas. Any change to URI parsing behavior would be detected by `npm run spec:check` (generate schemas → git diff).

**Alternatives considered**:
- `fast-uri@4.x`: Major version bump, not certified with `ajv@8.20.0`. Risk of breaking schema validation. Rejected.
- Upgrading `ajv` itself: `8.20.0` is the latest stable release. No newer version available.

**Evidence source**: npm advisory database, `ajv@8.20.0` `package.json` dependencies field.

---

## R-002: Zod 4 Migration Compatibility for packages/mcp

**Decision**: Migrate `packages/mcp` from `zod@^3.25.76` to `zod@^4.6.7`.

**Rationale**:
- `GHSA-mrhx-c7xc-m3w5` (CVE-2025-32440, CVSS 7.5) — ReDoS / memory exhaustion. No 3.x patch exists.
- Zod usage in `packages/mcp/src/server.ts` is limited to 4 simple schemas:
  - `z.object({})` — empty object
  - `z.object({ path: z.string().describe(...) })` — single string field
  - `z.object({ schema: z.string().describe(...), json: z.string().describe(...) })` — two string fields
  - `z.object({ operation: z.enum([...]) })` — enum of string literals
- No complex Zod features used: no `z.infer`, no custom refinements, no transforms, no recursive types.
- `@modelcontextprotocol/sdk@1.32.2` declares `"zod": "^3.25 || ^4.0"` in both `dependencies` and `peerDependencies`.
- `zod-to-json-schema@3.25.2` declares `"zod": "^3.25.28 || ^4"` as peer dependency.

**Alternatives considered**:
- Accept risk on Zod 3: Rejected at Gate 1 — zero risk acceptance for known High vulnerability.
- Wait for Zod 3.x patch: None exists and none is planned per Zod maintainers.

**Evidence source**: `packages/mcp/src/server.ts` source inspection, npm registry metadata for `@modelcontextprotocol/sdk@1.32.2` and `zod-to-json-schema@3.25.2`.

---

## R-003: MCP SDK 1.29.0 → 1.32.2 Stability

**Decision**: Upgrade `@modelcontextprotocol/sdk` from `^1.29.0` to `^1.32.2`.

**Rationale**:
- Resolves 6 SDK advisories: `GHSA-6qxp` (8.8), `GHSA-22jm` (7.5), `GHSA-46jr` (7.5), `GHSA-f897` (7.5), `GHSA-rvq5` (Moderate), `GHSA-6prh` (Moderate).
- LIP MCP uses only `McpServer` (from `@modelcontextprotocol/sdk/server/mcp.js`) and `StdioServerTransport` (from `@modelcontextprotocol/sdk/server/stdio.js`). These are core stable APIs unchanged between 1.29 and 1.32.
- SDK 1.32.2 natively resolves `@hono/node-server` and `hono` to non-vulnerable versions.

**Alternatives considered**: None — all 6 advisories require minimum SDK 1.30.0+, and 1.32.2 is the current stable.

**Evidence source**: MCP SDK changelog, npm registry, `packages/mcp/src/server.ts` import analysis.

---

## R-004: Transitive HTTP Override Strategy

**Decision**: Apply root `overrides` for Express/Hono transitive dependencies pulled by MCP SDK.

**Rationale**:
- `proxy-addr@2.0.7`, `body-parser@2.3.0`, `qs@6.15.3`, `ip-address@10.5.0` are transitive deps of `@modelcontextprotocol/sdk` via its optional Express and Hono HTTP server transport modules.
- LIP MCP connects exclusively via `StdioServerTransport` — Express and Hono are never booted.
- Root `overrides` ensure clean `npm audit` output without waiting for upstream SDK to update its transitive tree.
- `@hono/node-server` and `hono` are resolved to non-vulnerable versions by SDK 1.32.2 itself (no override needed).

**Evidence source**: `npm ls proxy-addr`, `npm ls body-parser`, `npm ls qs`, `npm ls ip-address`, `packages/mcp/src/server.ts` source.

---

## R-005: Development Tooling — Vite 8 & Vitest 4 Compatibility Validation

**Decision**: Perform within-major upgrades for direct devDependencies (`vite@8.1.4 -> ^8.3.6`, `vitest@4.1.10 -> ^4.1.12`), then upgrade parent devDependencies of transitive findings with root `overrides` as fallback.

**Rationale & Compatibility Analysis**:
1. **Vite Upgrade (`8.1.4 -> ^8.3.6`)**:
   - `apps/admin/package.json` already uses Vite 8 (`"vite": "^8.1.4"`).
   - Vulnerability `GHSA-698v-4r3x-3vcv` affects Vite `>= 8.0.0, <= 8.1.5` and is patched in `8.1.6` and `8.3.6`.
   - Upgrading from `8.1.4` to `8.3.6` is a **within-major patch/minor update**.
   - Inspection of `apps/admin/vite.config.ts`:
     - Uses standard `defineConfig` with `@vitejs/plugin-react@^5.2.0` and `@tailwindcss/vite@^4.3.2`.
     - Both plugins already natively support Vite 8.
     - Configuration uses standard properties (`base`, `build.outDir`, `build.sourcemap`, `server.proxy`). No deprecated Vite APIs are used.
   - Verification command: `npm run build:admin` (runs `tsc --noEmit && vite build`).
2. **Vitest & Coverage Upgrade (`4.1.10 -> ^4.1.12`)**:
   - Root `package.json` already uses Vitest 4 (`"vitest": "^4.1.10"`, `"@vitest/coverage-v8": "^4.1.10"`).
   - Vulnerabilities `GHSA-82fw-gwwq-j7x9` and `GHSA-qxg6-3p2g-6x2p` affect Vitest `<= 4.1.11` and are patched in `4.1.12`.
   - Upgrading from `4.1.10` to `4.1.12` is a **within-major patch update**.
   - Both `vitest` and `@vitest/coverage-v8` must be upgraded simultaneously to `4.1.12` to maintain exact package parity.
   - Inspection of `vitest.config.ts`: Uses standard `defineConfig`, aliases, `coverage.provider: "v8"`, thresholds, and include patterns. No breaking configuration changes exist in patch 4.1.12.
   - Verification commands: `npm test` (`vitest run`), `npm run test:coverage` (`vitest run --coverage`), and CI command `npm run test -- --reporter=json --outputFile="$RUNNER_TEMP/vitest-report.json"`.

**Parent Bump Investigation Targets**:
| Vulnerable Transitive | Parent Package | Current Parent Version | Action | Fallback Override |
|---|---|---|---|---|
| `js-yaml@4.3.1` | `@apidevtools/swagger-parser` | `^12.1.0` | Check if latest parent resolves `js-yaml >= 4.3.2` | `"js-yaml": "^4.3.2"` |
| `source-map-js@1.2.1` | `vitest` / `@vitest/coverage-v8` | `^4.1.10` → `^4.1.12` | Resolved by Vitest 4.1.12 update | `"source-map-js": "^1.2.2"` |
| `browserslist@4.28.6` | `@vitejs/plugin-react` | `^5.2.0` | Check if latest parent resolves `browserslist >= 4.29.5` | `"browserslist": "^4.29.5"` |
| `postcss-selector-parser@<6.1.5` | `@tailwindcss/typography` | `^0.5.20` | Check if latest parent resolves `postcss-selector-parser >= 6.1.6` | `"postcss-selector-parser": "^6.1.6"` |
| `baseline-browser-mapping@<2.11.0` | `browserslist` | (transitive) | Resolved automatically when browserslist resolves | N/A |

**Runtime verification required**: After each step, run `npm ls <package>` to verify the exact resolved version.

---

## R-006: Lockfile Lifecycle Across Stages

**Decision**: Clearly distinguish intermediate dependency resolution during testing from final stabilization and clean verification.

**Lifecycle Stages**:
1. **Intermediate Resolution (T-002 through T-005)**:
   - When manifests or overrides change, `npm install` runs under Node.js `22.22.0` / npm `10.9.4` on the Windows host.
   - This mutates `package-lock.json` incrementally, establishing an exact, reproducible installation state required for stage-level testing (`npm run typecheck`, `npm test`, `npm run build:admin`).
2. **Review & Stabilization (T-007 on Windows)**:
   - Perform a surgical inspection of `git diff package-lock.json` to ensure only target packages and their transitive dependencies were modified.
   - Run `npm ci` on the Windows host to verify the lockfile is internally consistent and installs without error.
   - Execute the complete Windows verification suite.
3. **Clean Reproducibility Verification (T-008 on Linux Docker)**:
   - Execute `npm ci` inside the `node:22.22.0` container directly from the Windows-stabilized lockfile.
   - Confirms that platform-specific optional dependencies (`@rollup/rollup-win32-*`, `@esbuild/win32-*`) do not break Linux container installation.
   - Execute the complete Linux + PostgreSQL 17 test suite with zero skipped tests.

---

## R-007: Test File Path Corrections

**Finding**: The spec references test files at incorrect paths.

| Spec Reference | Actual Path | Content |
|---|---|---|
| `packages/protocol/src/validation.test.ts` | `tests/unit/validation.test.ts` | Protocol validation logic |
| `tests/unit/protocol.test.ts` | `tests/unit/validation.test.ts` + `tests/unit/spec.test.ts` | Validation + schema generation |

**Impact**: Implementation stages reference the correct actual paths. No spec amendment needed (the intent is clear).

**Additional test context**:
- MCP tests: `tests/unit/mcp.test.ts` (41 lines) — not inside `packages/mcp/`.
- `packages/mcp/src/**` is excluded from coverage thresholds in `vitest.config.ts`.
- CI (`ci.yml`) enforces zero skipped tests via JSON reporter re-run.

---

## R-008: Core SaaS Runtime Isolation Proof & Reproducible Audit

**Objective**: Mathematically and architecturally prove whether `packages/mcp` is part of the deployable Core SaaS runtime artifact, distinguishing container filesystem presence from active process execution, and establishing an independent reproducible audit command.

### 1. Workspace Dependency Graph Proof
An exhaustive inspection of every package manifest in the repository proves:
- `apps/cloud/package.json` depends on: `@loyalty-interchange/identity`, `@loyalty-interchange/reference`, `@loyalty-interchange/server`, `@loyalty-interchange/sdk`, `@loyalty-interchange/storage-postgres`, `pg`, `stripe`.
- `packages/server/package.json` depends on: `@loyalty-interchange/protocol`, `@loyalty-interchange/reference`, `@loyalty-interchange/storage-postgres`, `@loyalty-interchange/storage-sqlite`, `@sinclair/typebox`.
- `apps/wallet/package.json` depends on: `jose`.
- `packages/protocol/package.json` depends on: `@sinclair/typebox`, `ajv`.
- `packages/storage-postgres/package.json` depends on: `@loyalty-interchange/reference`, `@loyalty-interchange/storage`, `pg`.
- **Finding**: **Zero workspaces in the monorepo depend on or import `@loyalty-interchange/mcp`**.

### 2. Deployment Manifests & Process Execution Proof
- `Dockerfile`:
  - `CMD ["node", "packages/server/dist/cli.js"]`
- `render.yaml`:
  - `dockerCommand: node apps/cloud/dist/cli.js`
  - `preDeployCommand: node apps/cloud/dist/migrate-cli.js`
- `compose.yaml`:
  - `lip`: runs default CMD `node packages/server/dist/cli.js`
  - `wallet`: `node apps/wallet/dist/cli.js`
  - `cloud`: `node apps/cloud/dist/cli.js`
- **Finding**: Every deployed production process executes either `packages/server/dist/cli.js`, `apps/cloud/dist/cli.js`, or `apps/wallet/dist/cli.js`. None of these entry points ever imports, references, or starts `packages/mcp/dist/server.js`. In Node.js ECMAScript Modules (ESM), unreferenced code is never loaded, evaluated, or bound to any network port.

### 3. Container Artifact Exposure — Five-Level Analysis

The Dockerfile produces a runtime image that is analyzed at five distinct levels of exposure:

- `Dockerfile` lines 24–27:
  ```dockerfile
  COPY --from=build /app/node_modules ./node_modules
  COPY --from=build /app/apps/cloud ./apps/cloud
  COPY --from=build /app/apps/wallet ./apps/wallet
  COPY --from=build /app/packages ./packages
  ```

| Level | Description | MCP Status | Evidence |
|---|---|---|---|
| **1. Filesystem Presence** | Source files and compiled output exist on disk | ✅ **PRESENT** | `COPY --from=build /app/packages ./packages` copies all packages including `packages/mcp/dist/server.js` |
| **2. Installed Dependency Presence** | Production `node_modules` entries exist on disk | ✅ **PRESENT** | `npm prune --omit=dev` retains MCP's `dependencies` (`@modelcontextprotocol/sdk`, `zod`, `express`, `body-parser`, `proxy-addr`, `hono`, etc.) in `/app/node_modules` |
| **3. Runtime Module Loading** | Code is `import`ed or `require`d by a running process | ❌ **NOT LOADED** | Zero production workspaces import `@loyalty-interchange/mcp`. Node.js ESM never evaluates unreferenced modules. |
| **4. Executable Entry Points** | A binary or script can be directly invoked | ⚠️ **INVOCABLE** | `packages/mcp/src/server.ts` line 1: `#!/usr/bin/env node`. The compiled `packages/mcp/dist/server.js` has a shebang and is declared as `"bin": { "lip-mcp": "./dist/server.js" }`. A user with shell access inside the container **can** run `node packages/mcp/dist/server.js` directly. |
| **5. Network Listener Exposure** | A process binds a network port | ❌ **NOT EXPOSED** | MCP uses `StdioServerTransport` exclusively (stdin/stdout). No HTTP server, no port binding. Even if invoked, MCP does not listen on any network interface. |

- **Security Assessment**: MCP and its transitive HTTP dependencies are physically present in the production container image at Levels 1–2, and Level 4 confirms the MCP server **can be directly invoked** by anyone with shell access to the container. However, no production process loads it (Level 3) and it binds no network port (Level 5). The dormant Express/Hono dependencies are dead code from the runtime perspective but occupy attack surface as installed packages.
- **Future Hardening Recommendation**: Exclude `packages/mcp` from the Docker image by either adding `packages/mcp` to `.dockerignore`, replacing the bulk `COPY --from=build /app/packages ./packages` with per-package COPY commands for only deployed workspaces, or adding an `rm -rf packages/mcp` step after the COPY. This would eliminate Levels 1, 2, and 4 entirely.

### 4. Reproducible Core SaaS Runtime Tree Composition Check
To inspect the deployable Core SaaS Pilot runtime dependency tree completely independently from the monorepo-level graph, execute:
```bash
npm ls --omit=dev --workspace=@loyalty-interchange/server --workspace=@loyalty-interchange/cloud --all
```
> **Note**: `npm ls` displays the resolved dependency tree and confirms package versions and graph membership. It does **not** query the npm advisory database and cannot prove zero vulnerabilities. Zero-vulnerability proof requires the separately run `npm audit` and `npm audit --omit=dev` checks (which cover all 14 workspaces, including MCP production dependencies).

**Verification Evidence**:
The output of this command proves that the complete Core SaaS Pilot dependency tree consists strictly of:
- `apps/cloud` (`identity`, `reference`, `sdk`, `server`, `storage-postgres`, `pg`, `stripe`)
- `packages/server` (`protocol` with `ajv@8.20.0` and `fast-uri@3.1.5`, `reference`, `storage-postgres`, `storage-sqlite` with `better-sqlite3`)

This confirms: (a) `fast-uri@3.1.5` is the sole package at a known-vulnerable version in the Core SaaS runtime tree (based on baseline audit evidence), and (b) MCP dependencies are entirely absent from this tree.

### 5. Wallet Pilot Scope Determination
- `render.yaml` defines exactly 3 services: `crave-loyalty-development`, `crave-loyalty-sandbox`, `crave-loyalty-production`. All 3 run `node apps/cloud/dist/cli.js`. **Wallet is not deployed to Render.**
- `compose.yaml` includes a `wallet` service for local development and testing only.
- `apps/wallet/package.json` depends solely on `jose@6.2.3` (zero vulnerabilities).
- **Conclusion**: `@loyalty-interchange/wallet` is **not part of the Core SaaS Pilot deployment** (Task 5.6). Excluded from the Core SaaS Pilot gate. Its dependency health is verified independently:
  ```bash
  npm ls --omit=dev --workspace=@loyalty-interchange/wallet --all
  ```

**Conclusion**:
- **Sole Core SaaS Pilot Vulnerability**: `fast-uri@3.1.5` via `ajv@8.20.0`.
- All other 8 "production" vulnerabilities reported by monorepo-level `npm audit --omit=dev` originate exclusively from `packages/mcp` and are absent from the Core SaaS runtime execution graph.
- `npm audit --omit=dev` scans **all 14 workspaces'** production dependencies (including MCP's) — it is NOT a Core SaaS-only audit.
