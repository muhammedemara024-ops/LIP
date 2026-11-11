# Implementation Plan: Dependency Security Remediation (Task 0.12)

**Branch**: `001-dependency-security-remediation` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-dependency-security-remediation/spec.md`

## Summary

Remediate all 19 known dependency vulnerabilities across the LIP monorepo by applying targeted dependency upgrades and npm root `overrides` in a staged, independently-verifiable sequence. The Core SaaS production runtime has a single vulnerability (`fast-uri@3.1.5` via `ajv@8.20.0`) resolved by overriding to `^3.1.9`. The MCP developer tool (`packages/mcp`) has 8 vulnerabilities resolved by upgrading `@modelcontextprotocol/sdk` to `^1.32.2`, migrating `zod` to `^4.6.7`, and applying root overrides for dormant transitive HTTP dependencies. Development tooling has 10 vulnerabilities resolved by upgrading direct parent devDependencies with overrides as fallback. All modifications to upstream workspace manifests are logged as `FP-002` in `docs/context/07-fork-patches.md`.

## Technical Context

**Language/Version**: TypeScript `^6.0.3` on Node.js `22.22.0` (`.nvmrc`), npm `10.9.4` (`packageManager`)

**Primary Dependencies** (affected):
- `ajv@^8.20.0` → transitive `fast-uri@3.1.5` (vulnerable)
- `@modelcontextprotocol/sdk@^1.29.0` → transitive Express/Hono (vulnerable)
- `zod@^3.25.76` (vulnerable, MCP only)
- `vite@^8.1.4`, `vitest@^4.1.10`, `@vitest/coverage-v8@^4.1.10` (dev, vulnerable)
- `@apidevtools/swagger-parser@^12.1.0` → transitive `js-yaml` (dev, vulnerable)
- `@vitejs/plugin-react@^5.2.0` → transitive `browserslist` (dev, vulnerable)
- `@tailwindcss/typography@^0.5.20` → transitive `postcss-selector-parser` (dev, vulnerable)

**Storage**: PostgreSQL 17 (production, CI); SQLite (reference server, local dev)

**Testing**: Vitest `^4.1.10` (single root `vitest.config.ts`), coverage via `@vitest/coverage-v8`

**Target Platform**: Linux Docker container (`node:22-alpine`), Render.com managed deployment

**Project Type**: Multi-workspace npm monorepo (packages/*, apps/*)

**Performance Goals**: N/A (dependency remediation only)

**Constraints**: Lockfile must be generated under Node.js `22.22.0` + npm `10.9.4` (Hybrid workflow)

**Scale/Scope**: ~60 test files, 19 active vulnerabilities across 4 exposure tiers

---

## 1. Core SaaS Runtime Isolation Proof & Architecture

### 1.1 Multi-Layered Threat & Operational Exposure Classification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       1. MONOREPO INSTALLATION GRAPH                        │
│   (All 19 advisories across packages/*, apps/*, root devDependencies)       │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ 2. CORE SAAS PRODUCTION ARTIFACT     │ 3. MCP DEVELOPER TOOL                │
│    (apps/cloud, packages/server,     │    (packages/mcp)                    │
│     packages/protocol, storage-pg)   │    - Marked "Reference Only" (PD-002)│
│    - Deployed in Render/Docker       │    - StdioServerTransport ONLY       │
│    - Handles EGP money, members, RLS │    - Zero HTTP listeners in code     │
│    - EXPOSURE: 1 High (fast-uri)     │    - EXPOSURE: 1 Crit, 3 High, 4 Mod │
├──────────────────────────────────────┴──────────────────────────────────────┤
│ 4. DEVELOPMENT / BUILD / TEST TOOLCHAIN                                     │
│    (apps/admin devDeps, root devDeps: vite, vitest, js-yaml, source-map-js) │
│    - Executed only during local development, CI checks, or static builds    │
│    - EXPOSURE: 4 High, 6 Moderate                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Core SaaS Runtime Isolation Evidence

An exhaustive investigation of the repository architecture establishes the boundary between monorepo filesystem artifacts and the Core SaaS runtime execution graph:

1. **Workspace Dependency Relationships**:
   - `apps/cloud/package.json` depends on: `@loyalty-interchange/identity`, `@loyalty-interchange/reference`, `@loyalty-interchange/server`, `@loyalty-interchange/sdk`, `@loyalty-interchange/storage-postgres`, `pg`, `stripe`.
   - `packages/server/package.json` depends on: `@loyalty-interchange/protocol`, `@loyalty-interchange/reference`, `@loyalty-interchange/storage-postgres`, `@loyalty-interchange/storage-sqlite`, `@sinclair/typebox`.
   - `apps/wallet/package.json` depends on: `jose`.
   - `packages/protocol/package.json` depends on: `@sinclair/typebox`, `ajv`.
   - `packages/storage-postgres/package.json` depends on: `@loyalty-interchange/reference`, `@loyalty-interchange/storage`, `pg`.
   - **Conclusion**: **Zero production workspaces depend on or import `@loyalty-interchange/mcp`**.

2. **Deployment Manifests & Runtime Entrypoints**:
   - `Dockerfile`: `CMD ["node", "packages/server/dist/cli.js"]`
   - `render.yaml`: `dockerCommand: node apps/cloud/dist/cli.js`, `preDeployCommand: node apps/cloud/dist/migrate-cli.js`
   - `compose.yaml`: `node packages/server/dist/cli.js`, `node apps/cloud/dist/cli.js`, `node apps/wallet/dist/cli.js`
   - **Conclusion**: The only processes executed in production or compose environments are `packages/server`, `apps/cloud`, and `apps/wallet`. None of these processes ever imports, references, or initializes `packages/mcp/dist/server.js`. Under Node.js ESM module semantics, unreferenced files on disk are never loaded into the runtime memory or evaluated.

3. **Container Artifact Exposure — Five-Level Analysis**:
   - `Dockerfile` line 27 executes `COPY --from=build /app/packages ./packages`. Because this copies `/app/packages` in bulk, `packages/mcp` is physically present on the container image disk.
   - `npm prune --omit=dev --workspaces --include-workspace-root` runs monorepo-wide, and `packages/mcp` declares `dependencies` (not `devDependencies`), so MCP's production dependencies (`@modelcontextprotocol/sdk`, `zod`, `express`, `body-parser`, `proxy-addr`, `hono`, etc.) are physically retained inside `/app/node_modules`.

   | Level | Description | MCP Status |
   |---|---|---|
   | 1. Filesystem Presence | Source/compiled files on disk | ✅ PRESENT |
   | 2. Installed Dependency Presence | Production `node_modules` entries on disk | ✅ PRESENT |
   | 3. Runtime Module Loading | Imported by a running process | ❌ NOT LOADED |
   | 4. Executable Entry Points | Directly invocable binary/script | ⚠️ INVOCABLE (`#!/usr/bin/env node` shebang, `"bin": { "lip-mcp": "./dist/server.js" }`) |
   | 5. Network Listener Exposure | Process binds a network port | ❌ NOT EXPOSED (StdioServerTransport only) |

   - **Security Reality**: MCP is present in the container at Levels 1–2, and its entry point **can be directly invoked** (Level 4) by anyone with shell access. However, no production process loads it (Level 3) and it binds no network port (Level 5). Express/Hono dependencies are dead code from the runtime perspective but occupy dormant attack surface.
   - **Future Hardening**: Exclude `packages/mcp` from the Docker image (e.g., per-package COPY, `.dockerignore`, or post-COPY `rm -rf packages/mcp`) to eliminate Levels 1, 2, and 4.

4. **Reproducible Core SaaS Runtime Tree Composition Check**:
   To inspect the deployable Core SaaS runtime dependency tree completely independently from the monorepo-level graph, execute:
   ```bash
   npm ls --omit=dev --workspace=@loyalty-interchange/server --workspace=@loyalty-interchange/cloud --all
   ```
   > **Note**: `npm ls` displays the resolved dependency tree and confirms package versions and graph membership. It does **not** query the npm advisory database and cannot prove zero vulnerabilities. Zero-vulnerability proof requires the separately listed `npm audit` and `npm audit --omit=dev` checks (see §7 Verification Matrix).

   **Empirical Result**:
   - The tree contains ONLY: `@loyalty-interchange/cloud`, `@loyalty-interchange/server`, `@loyalty-interchange/protocol`, `@loyalty-interchange/identity`, `@loyalty-interchange/reference`, `@loyalty-interchange/sdk`, `@loyalty-interchange/storage`, `@loyalty-interchange/storage-postgres`, `@loyalty-interchange/storage-sqlite`, `pg`, `stripe`, `@sinclair/typebox`, `better-sqlite3`, and `ajv@8.20.0`.
   - Under `ajv@8.20.0`, `fast-uri@3.1.5` is the **sole package at a known-vulnerable version** in the entire Core SaaS runtime dependency tree (based on the pre-remediation baseline audit evidence).
   - MCP dependencies do not appear anywhere in this tree.
   - Separate monorepo checks (`npm audit` and `npm audit --omit=dev`) scan the root and all 14 workspaces combined and are the authoritative zero-vulnerability proof.

5. **Wallet Pilot Scope Determination**:
   - `render.yaml` defines exactly 3 services: `crave-loyalty-development`, `crave-loyalty-sandbox`, `crave-loyalty-production`. All 3 run `node apps/cloud/dist/cli.js`. **Wallet is not deployed to Render.**
   - `compose.yaml` includes a `wallet` service for local development and testing only.
   - `apps/wallet/package.json` depends solely on `jose@6.2.3` (zero vulnerabilities).
   - **Conclusion**: `@loyalty-interchange/wallet` is **not part of the Core SaaS Pilot deployment** (Task 5.6). It is excluded from the Core SaaS Pilot gate runtime audit command. Its dependency health (`jose@6.2.3`, zero vulnerabilities) is independently verified but does not gate the pilot.
   - If wallet is later added to `render.yaml` for the pilot, it must be re-included in the runtime audit command at that time.

---

## 2. Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Requirement | Status |
|---|---|---|
| **I — Context Supremacy** | Aligned with `docs/context/01-decisions.md` (PD-002, PD-006, PD-008), `04-business-rules.md`, `06-roadmap.md` Task 0.12. | ✅ PASS |
| **II — Upstream Preservation** | `/lip/v1` wire semantics and `spec/` are never modified. All upstream manifest changes logged as `FP-002` in `07-fork-patches.md`. | ✅ PASS |
| **III — Decision Governance** | Only Approved decisions applied. PD-002 (MCP Reference Only) and PD-006 consulted. No new PD entries required. | ✅ PASS |
| **IV — Multi-Tenant Isolation** | No changes to RLS policies, migrations, or tenant isolation code. Mandatory PostgreSQL 17 tenant-isolation regression test in verification. | ✅ PASS |
| **V — Monetary/Phone/Locale** | No changes to monetary representation, phone validation, or localization code. | ✅ PASS |
| **VI — PostgreSQL & Migration Safety** | No changes to migration files or advisory lock ordering. `FP-001` preserved. | ✅ PASS |
| **VII — Verification Transparency** | Exact environment, pass/fail/skip counts, and skip reasons will be reported. | ✅ PASS |
| **VIII — Privacy & PDPL** | No changes to privacy, OTP, session, or webhook security code. | ✅ PASS |
| **IX — Task Classification** | Tier 3 Spec-Driven workflow with Gate 1 (spec approved) and Gate 2 (plan/tasks approved). | ✅ PASS |
| **X — Git & Deployment Safety** | No auto-commit, no push without authorization, no production deployment. | ✅ PASS |

---

## 3. Lockfile Lifecycle Across Implementation Stages

The lifecycle of `package-lock.json` is strictly partitioned into three operational phases:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. INTERMEDIATE DEPENDENCY RESOLUTION (T-002 through T-005)                 │
│    - Incremental `npm install` runs on Windows under Node 22.22.0 / npm 10.9.4│
│    - Mutates `package-lock.json` predictably for the specific stage         │
│    - Establishes concrete, reproducible dependency state for stage tests   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. LOCKFILE REVIEW & STABILIZATION (T-007 on Windows Host)                  │
│    - Surgical diff audit via `git diff package-lock.json`                   │
│    - Verifies zero unintended package churn or unauthorized updates         │
│    - Clean installation verification via `npm ci` on Windows host           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. CLEAN CROSS-PLATFORM REPRODUCIBILITY VERIFICATION (T-008 on Linux Docker)│
│    - `npm ci` executes in clean Linux `node:22.22.0` container from lockfile │
│    - Verifies platform-specific optional binaries (@rollup, @esbuild)       │
│    - Full test suite execution with PostgreSQL 17 (zero skipped tests)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Root Override Justification Matrix

Every proposed root override in `package.json` is justified by its dependency path, declaring package, semver compatibility range, and test seam:

| Package | Introducing Workspace | Exact Dependency Path | Vulnerability Resolved | Target Override | Declaring Package Range & Compatibility | Required Regression Tests |
|---|---|---|---|---|---|---|
| **`fast-uri`** | `@loyalty-interchange/protocol` | Core SaaS & root &rarr; `ajv@8.20.0` &rarr; `fast-uri@3.1.5` | 10 advisories (`GHSA-5jgf` .. `GHSA-333x`) | `^3.1.9` | `ajv@8.20.0` declares `"fast-uri": "^3.0.1"`. `3.1.9` is natively semver-compatible. | `npm run spec:check` (zero schema drift), `tests/unit/validation.test.ts`, `tests/unit/spec.test.ts` |
| **`proxy-addr`** | `packages/mcp` | `@loyalty-interchange/mcp` &rarr; SDK `1.32.2` &rarr; `express@5.2.1` &rarr; `proxy-addr@2.0.7` | `GHSA-jqcg-44mw-7w3h` (Critical 9.1) | `^2.0.8` | `express@5.2.1` declares `"proxy-addr": "^2.0.7"`. `2.0.8` is semver-compatible. | `tests/unit/mcp.test.ts`, `npm audit --omit=dev` |
| **`body-parser`** | `packages/mcp` | `@loyalty-interchange/mcp` &rarr; SDK `1.32.2` &rarr; `express@5.2.1` &rarr; `body-parser@2.3.0` | `GHSA-27r3-jxmh-p828` (High 7.5) | `^2.4.0` | `express@5.2.1` declares `"body-parser": "^2.3.0"`. `2.4.0` is semver-compatible. | `tests/unit/mcp.test.ts`, `npm audit --omit=dev` |
| **`qs`** | `packages/mcp` | `@loyalty-interchange/mcp` &rarr; SDK `1.32.2` &rarr; `express@5.2.1` / `body-parser` &rarr; `qs@6.15.3` | `GHSA-x5fp-wj9c-mxmx` (+2 advisories, Moderate) | `^6.17.1` | `body-parser` and `express` declare `"qs": "6.15.3" / "^6.15.0"`. `6.17.1` resolves cleanly via npm overrides. | `tests/unit/mcp.test.ts`, `npm audit --omit=dev` |
| **`ip-address`** | `packages/mcp` | `@loyalty-interchange/mcp` &rarr; SDK `1.32.2` &rarr; `express-rate-limit` &rarr; `ip-address@10.5.0` | `GHSA-rpw4-54j3-4h4q` (+4 advisories, Moderate) | `^10.7.6` | `express-rate-limit` transitive tree. `10.7.6` resolves cleanly via npm overrides. | `tests/unit/mcp.test.ts`, `npm audit --omit=dev` |

### Fallback Dev Tooling Overrides (Applied ONLY if parent bump fails)
- **`js-yaml`**: Root &rarr; `@apidevtools/swagger-parser@12.1.0` &rarr; `js-yaml@4.3.1` (`GHSA-2883-xcg3-v3hh`, High). Fallback override: `"js-yaml": "^4.3.2"`. Test: `npm run generate && npm run spec:check`.
- **`source-map-js`**: Root &rarr; `@vitest/coverage-v8` / `vite` &rarr; `source-map-js@1.2.1` (`GHSA-68fv-2mgg-jv7q`, High). Fallback override: `"source-map-js": "^1.2.2"`. Test: `npm run test:coverage`.
- **`browserslist`**: `apps/admin` &rarr; `@vitejs/plugin-react` &rarr; `browserslist@4.28.6` (`GHSA-c83g-rgw3-j3cx`, High). Fallback override: `"browserslist": "^4.29.5"`. Test: `npm run build:admin`.
- **`postcss-selector-parser`**: `apps/admin` &rarr; `@tailwindcss/typography` &rarr; `postcss-selector-parser@<6.1.5` (`GHSA-rj75-hqrm-r3gf`, Moderate). Fallback override: `"postcss-selector-parser": "^6.1.6"`. Test: `npm run build:admin`.

---

## 5. Development Tooling Compatibility Validation

### Vite 8 Compatibility
- `apps/admin/package.json` already uses `"vite": "^8.1.4"`.
- Target version: `"vite": "^8.3.6"` (within-major patch update resolving `GHSA-698v-4r3x-3vcv`).
- Plugins in `apps/admin/vite.config.ts`:
  - `@vitejs/plugin-react@^5.2.0` — native Vite 8 plugin.
  - `@tailwindcss/vite@^4.3.2` — native Vite 8 plugin.
- Configuration: Standard `base`, `build.outDir` (`../../packages/server/dist/admin`), `build.sourcemap`, `server.proxy`.
- Verification command: `npm run build:admin` (runs `tsc --noEmit && vite build`).
- Unit tests: `apps/admin/src/admin-path.test.ts`, `apps/admin/src/format.test.ts`.

### Vitest 4 Compatibility
- Root `package.json` already uses `"vitest": "^4.1.10"` and `"@vitest/coverage-v8": "^4.1.10"`.
- Target version: `"vitest": "^4.1.12"` and `"@vitest/coverage-v8": "^4.1.12"` (within-major patch update resolving `GHSA-82fw-gwwq-j7x9`).
- Configuration in `vitest.config.ts`: Uses standard `defineConfig`, package aliases, `coverage.provider: "v8"`, thresholds (85% lines/funcs/stmts, 75% branches), and include patterns.
- Both `vitest` and `@vitest/coverage-v8` must be bumped in lockstep to `4.1.12`.
- Verification commands:
  - `npm test` (`vitest run`)
  - `npm run test:coverage` (`vitest run --coverage`)
  - CI command: `npm run test -- --reporter=json --outputFile="$RUNNER_TEMP/vitest-report.json"`

---

## 6. Implementation Sequence & Surgical Rollback Procedures

### Safety & Rollback Principles

- **No Broad Destructive Cleanups**: Never execute `git clean -fd`, `git reset --hard`, or wildcards that could wipe untracked spec files (`specs/001-dependency-security-remediation/*`), `.specify/`, or unrelated working-tree files.
- **Baseline-Aware Rollback**: Before each implementation stage, capture the SHA-256 checksums of every file that stage will modify. This establishes ownership of changes — only Task 0.12-owned modifications are reverted.
- **Preserve Unrelated Work**: Rollback procedures never touch files outside the stage's declared scope. Untracked files, Spec Kit artifacts, and any unrelated tracked modifications are always preserved.

#### Baseline Capture Procedure (Execute Once Before Stage 1)

```bash
# Record SHA-256 of every file Task 0.12 may modify across all stages
# Save this output — it is the rollback reference for the entire feature
$files = @(
  "package.json",
  "package-lock.json",
  "packages/mcp/package.json",
  "packages/mcp/src/server.ts",
  "apps/admin/package.json",
  "docs/context/07-fork-patches.md"
)
foreach ($f in $files) {
  if (Test-Path $f) {
    $hash = (Get-FileHash $f -Algorithm SHA256).Hash
    Write-Output "${f}: ${hash}"
  } else {
    Write-Output "${f}: NOT_PRESENT"
  }
}
# Also record the current HEAD commit for git restore --source
git rev-parse HEAD
# Expected output example: cf1a0df528891bb439a82c44426b6a20b5e3f692
```

Save the output as `/tmp/task-0.12-baseline.txt`. This is the single source of truth for all rollback operations.

#### Per-Stage Rollback Template

For any failed stage, revert ONLY the files that stage modified:

```bash
# 1. Identify the baseline commit (from baseline capture)
$BASELINE="cf1a0df528891bb439a82c44426b6a20b5e3f692"  # or whatever HEAD was

# 2. Restore ONLY the specific files this stage modified
git restore --source=$BASELINE -- <file1> <file2> ...

# 3. Verify checksums match the baseline
# Compare current checksums against /tmp/task-0.12-baseline.txt

# 4. Reinstall from restored lockfile
npm ci

# 5. Verify restoration
npm run typecheck
```

**Critical**: `git restore --source=<commit>` restores files to their state at that specific commit. Unlike `git checkout HEAD -- <file>`, it is explicit about the source commit. If prior stages have already modified a file (e.g., `package.json` was changed in Stage 1 and Stage 2), use the appropriate source:
- To revert to pre-Stage-1 state: `--source=$BASELINE`
- To revert to post-Stage-1 state (keeping Stage 1 changes): `--source=<post-stage-1-stash>` or manually re-apply Stage 1 changes

---

### Stage 0: Environment Setup & Baseline Capture

**Objective**: Verify Node.js `22.22.0` / npm `10.9.4` and record pre-remediation baseline audits.

**Files changed**: None.

**Commands**:
```bash
nvm use 22.22.0
node --version   # Must output: v22.22.0
npm --version    # Must output: 10.9.4
npm audit --json > /tmp/baseline-audit.json
npm audit --omit=dev --json > /tmp/baseline-audit-prod.json
npm ls --omit=dev --workspace=@loyalty-interchange/server --workspace=@loyalty-interchange/cloud --all > /tmp/baseline-runtime-tree.txt
# Note: Wallet is excluded from Core SaaS Pilot gate (not deployed to Render). Verify independently:
npm ls --omit=dev --workspace=@loyalty-interchange/wallet --all > /tmp/baseline-wallet-tree.txt
git status --short --untracked-files=all
git diff --stat
```

**Expected results**: Pinned toolchain confirmed; 19 total / 9 production vulnerabilities captured; working tree clean of tracked modifications.

**Rollback**: N/A.

---

### Stage 1: Core SaaS Production Override (`fast-uri`)

**Objective**: Eliminate the sole Core SaaS production vulnerability by overriding `fast-uri` to `^3.1.9`.

**Files changed**: `package.json`, `package-lock.json`.

**Commands**:
```bash
# Add overrides block to package.json: { "overrides": { "fast-uri": "^3.1.9" } }
npm install
npm ls fast-uri
npm audit --omit=dev
npm run typecheck
npm run spec:check
npm test
```

**Expected results**:
- `npm ls fast-uri` resolves to `3.1.9` across all workspaces.
- `npm run spec:check` exits 0 (zero protocol schema drift).
- `npm run typecheck` exits 0.
- `npm test` passes all non-Postgres tests.

**Surgical Rollback** (Stage 1 only — reverts to pre-Task-0.12 baseline):
```bash
# Stage 1 modified: package.json, package-lock.json
git restore --source=$BASELINE -- package.json package-lock.json
npm ci
npm run typecheck
# Verify: checksums of package.json and package-lock.json match baseline
```
*Preserves: untracked spec files, unrelated working-tree changes, all other files.*

---

### Stage 2: MCP SDK Upgrade & Transitive HTTP Overrides

**Objective**: Upgrade `@modelcontextprotocol/sdk` to `^1.32.2` and apply root overrides for dormant Express/Hono transitive vulnerabilities.

**Files changed**: `packages/mcp/package.json`, `package.json`, `package-lock.json`.

**Commands**:
```bash
# In packages/mcp/package.json: "@modelcontextprotocol/sdk": "^1.32.2"
# In package.json overrides: "proxy-addr": "^2.0.8", "body-parser": "^2.4.0", "qs": "^6.17.1", "ip-address": "^10.7.6"
npm install
npm ls @modelcontextprotocol/sdk proxy-addr body-parser qs ip-address
npm run typecheck
npm test -- tests/unit/mcp.test.ts
npm audit --omit=dev
```

**Expected results**:
- SDK resolves to `1.32.2`.
- Transitive overrides resolve to non-vulnerable versions.
- `tests/unit/mcp.test.ts` passes.
- `npm run typecheck` exits 0.

**Surgical Rollback** (Stage 2 — reverts to post-Stage-1 state):
```bash
# Stage 2 modified: packages/mcp/package.json (new), package.json (added overrides), package-lock.json
# To revert Stage 2 while keeping Stage 1:
# 1. Restore packages/mcp/package.json to baseline (Stage 1 did not touch it)
git restore --source=$BASELINE -- packages/mcp/package.json
# 2. Re-apply Stage 1's package.json (fast-uri override only)
#    Manually remove proxy-addr/body-parser/qs/ip-address from overrides, keeping fast-uri
# 3. Regenerate lockfile
npm install
npm run typecheck
# To revert ALL (Stages 1+2) to baseline:
git restore --source=$BASELINE -- package.json packages/mcp/package.json package-lock.json
npm ci
npm run typecheck
```
*Preserves: untracked spec files, unrelated working-tree changes, all other files.*

---

### Stage 3: Zod 4 Migration

**Objective**: Migrate `packages/mcp` from `zod@^3.25.76` to `zod@^4.6.7`, eliminating `GHSA-mrhx-c7xc-m3w5`.

**Files changed**: `packages/mcp/package.json`, `packages/mcp/src/server.ts` (conditional), `package-lock.json`.

**Commands**:
```bash
# In packages/mcp/package.json: "zod": "^4.6.7"
npm install
npm ls zod
npm run typecheck
npm test -- tests/unit/mcp.test.ts
npm audit
```

**Expected results**:
- `zod` resolves to `4.6.7+`.
- `npm run typecheck` exits 0 (Zod 4 compiles without type errors).
- `tests/unit/mcp.test.ts` passes.

**Surgical Rollback** (Stage 3 — reverts Zod migration only):
```bash
# Stage 3 modified: packages/mcp/package.json (zod version), packages/mcp/src/server.ts (conditional), package-lock.json
# To revert Stage 3 while keeping Stages 1+2:
# 1. Restore packages/mcp/package.json to post-Stage-2 state (has SDK ^1.32.2 but zod ^3.25.76)
#    Manually revert "zod": "^4.6.7" back to "zod": "^3.25.76" in packages/mcp/package.json
# 2. If packages/mcp/src/server.ts was modified, restore it:
git restore --source=$BASELINE -- packages/mcp/src/server.ts
# 3. Regenerate lockfile
npm install
npm run typecheck
# To revert ALL (Stages 1+2+3) to baseline:
git restore --source=$BASELINE -- package.json packages/mcp/package.json packages/mcp/src/server.ts package-lock.json
npm ci
npm run typecheck
```
*Preserves: untracked spec files, unrelated working-tree changes, all other files.*

---

### Stage 4: Development Tooling Remediation

**Objective**: Remediate all 10 development tooling vulnerabilities using parent-bump-first strategy with override fallback.

**Files changed**: `package.json`, `apps/admin/package.json`, `package-lock.json`.

**Sub-steps**:
1. Direct upgrades: `vitest@^4.1.12`, `@vitest/coverage-v8@^4.1.12` in root; `vite@^8.3.6` in `apps/admin`.
2. Run `npm install`, `npm run typecheck`, `npm test`, `npm run build:admin`.
3. Check transitive versions via `npm ls js-yaml source-map-js browserslist postcss-selector-parser`.
4. Attempt parent bumps (`@apidevtools/swagger-parser`, `@vitejs/plugin-react`, `@tailwindcss/typography`). If any transitive remains vulnerable, add to root `overrides`.
5. Final checks: `npm audit`, `npm run typecheck`, `npm test`, `npm run build:admin`.

**Expected results**:
- Full `npm audit` reports 0 vulnerabilities.
- `npm run build:admin` succeeds.
- `npm test` passes.

**Surgical Rollback** (Stage 4 — reverts dev tooling changes only):
```bash
# Stage 4 modified: package.json (vitest/coverage versions + possible overrides), apps/admin/package.json (vite), package-lock.json
# To revert Stage 4 while keeping Stages 1+2+3:
# 1. Restore apps/admin/package.json to baseline (Stages 1–3 did not touch it)
git restore --source=$BASELINE -- apps/admin/package.json
# 2. In package.json, manually revert vitest/coverage versions and remove dev-tooling overrides,
#    keeping fast-uri + MCP overrides from Stages 1+2
# 3. Regenerate lockfile
npm install
npm run typecheck
# To revert ALL (Stages 1–4) to baseline:
git restore --source=$BASELINE -- package.json packages/mcp/package.json packages/mcp/src/server.ts apps/admin/package.json package-lock.json
npm ci
npm run typecheck
```
*Preserves: untracked spec files, unrelated working-tree changes, `docs/context/07-fork-patches.md`.*

---

### Stage 5: Fork-Patch Documentation (`FP-002`)

**Objective**: Record all upstream manifest modifications as `FP-002` in `docs/context/07-fork-patches.md` per Constitution Article II.3.

**Files changed**: `docs/context/07-fork-patches.md`.

**Content**:
Append row documenting `package.json` overrides, `packages/mcp/package.json` SDK and Zod upgrades, and `packages/mcp/src/server.ts` (if edited) with reference to Task 0.12 and PD-002.

**Surgical Rollback** (Stage 5 — reverts FP-002 documentation only):
```bash
# Stage 5 modified: docs/context/07-fork-patches.md (appended FP-002 entry)
git restore --source=$BASELINE -- docs/context/07-fork-patches.md
# No npm ci needed — Stage 5 does not modify manifests or lockfile
```
*Preserves: all dependency changes from Stages 1–4, untracked spec files, all other files.*

---

### Stage 6: Lockfile Finalization & Windows Verification

**Objective**: Verify lockfile consistency on Windows host under pinned Node 22.22.0 / npm 10.9.4.

**Files changed**: None.

**Commands**:
```bash
git diff package-lock.json      # Audit lockfile diff for unexpected changes
npm ci                          # Verify clean install from lockfile
npm run public-safety:check
npm run typecheck
npm run docs:check
npm run launch:check
npm run spec:check
npm test
npm audit --json
npm audit --omit=dev --json
npm ls --omit=dev --workspace=@loyalty-interchange/server --workspace=@loyalty-interchange/cloud --all
# Wallet (not deployed to Render, excluded from Pilot gate):
npm ls --omit=dev --workspace=@loyalty-interchange/wallet --all
```

**Expected results**: Clean install succeeds; all 5 verification checks pass; 0 audit vulnerabilities; Core SaaS runtime tree confirmed clean.

**Surgical Rollback** (Stage 6 — lockfile-only recovery):

T-007 is a verification-only stage; it modifies no files. If `npm ci` fails because the lockfile is corrupted or inconsistent, use the following baseline-aware procedure:

```bash
# 0. STOP if package.json files have unexpected unowned changes — do not proceed
git diff packages/mcp/package.json apps/admin/package.json package.json
# Expected: only intentional T-002–T-005 changes should appear

# 1. Retrieve the baseline commit recorded in T-001
#    (read from /tmp/task-0.12-baseline.txt or the value saved during T-001)
$BASELINE="cf1a0df528891bb439a82c44426b6a20b5e3f692"  # Windows / PowerShell

# 2. Restore ONLY package-lock.json to its pre-implementation state
#    This does NOT touch package.json or workspace manifests; T-002–T-005 changes are preserved
git restore --source=$BASELINE -- package-lock.json

# 3. Regenerate the lockfile from the current post-T-005 manifests (Node 22.22.0 / npm 10.9.4)
nvm use 22.22.0
npm install

# 4. Re-verify clean install and types
npm ci
npm run typecheck
```

*Preserves: all manifest changes from T-002–T-005, untracked spec files, unrelated working-tree changes.*

---

### Stage 7: Docker Linux Verification (Mandatory)

**Objective**: Verify complete remediation under production-equivalent Linux container with PostgreSQL 17, matching CI parity.

**Files changed**: None.

**Commands** (Linux `node:22.22.0` + `postgres:17-alpine`):
```bash
npm ci                          # Verify cross-platform lockfile validity
npm run typecheck
npm run spec:check
npm test                        # With LIP_TEST_POSTGRES_URL set
npm test -- --reporter=json --outputFile=/tmp/vitest-report.json
node -p "require('/tmp/vitest-report.json').numPendingTests ?? 0" # Must output: 0
npm audit --json
npm audit --omit=dev --json
npm run build
npm ls --omit=dev --workspace=@loyalty-interchange/server --workspace=@loyalty-interchange/cloud --all
# Wallet (not deployed to Render, excluded from Pilot gate):
npm ls --omit=dev --workspace=@loyalty-interchange/wallet --all
```

**Expected results**:
- `npm ci` succeeds from Windows-generated lockfile.
- All tests pass including `tests/unit/tenant-isolation-live.test.ts`, `packages/storage-postgres/src/tenant-isolation.test.ts`, `tests/conformance/postgres-lease-conformance.test.ts`.
- **Zero skipped tests**.
- 0 vulnerabilities across all audit scopes.
- Full build succeeds.

**Surgical Rollback** (Full Feature Rollback — reverts ALL Task 0.12 changes to pre-implementation baseline):
```bash
# Restore every file Task 0.12 modified, using the baseline commit recorded in Stage 0
git restore --source=$BASELINE -- package.json apps/admin/package.json packages/mcp/package.json packages/mcp/src/server.ts docs/context/07-fork-patches.md package-lock.json
npm ci
npm run typecheck
# Verify checksums match /tmp/task-0.12-baseline.txt
```
*Preserves: untracked spec files (`specs/001-dependency-security-remediation/*`), `.specify/` artifacts, and any unrelated tracked or untracked changes not owned by Task 0.12.*

---

## 7. Verification Matrix

| Verification | Command | Stage | Environment | Scope | Purpose |
|---|---|---|---|---|---|
| Core SaaS Runtime Tree Composition | `npm ls --omit=dev --workspace=@loyalty-interchange/server --workspace=@loyalty-interchange/cloud --all` | 0, 1, 6, 7 | Both | Only the actual Core SaaS deployment workspaces (`packages/server`, `apps/cloud`, and their transitive production dependencies) | Confirm Core SaaS runtime tree composition: fast-uri version ≥ 3.1.9, MCP dependencies absent. Zero-vulnerability proof requires the separately listed npm audit checks. |
| Monorepo Production Audit | `npm audit --omit=dev --json` | 1, 2, 6, 7 | Both | All production dependencies across **all 14 workspaces** including `packages/mcp` production deps (`@modelcontextprotocol/sdk`, `zod`, `express`, etc.) | Zero production-scope vulnerabilities monorepo-wide; this is NOT a Core SaaS-only audit |
| Monorepo Full Audit | `npm audit --json` | 4, 6, 7 | Both | Complete monorepo dependency graph including all development tooling (`vitest`, `vite`, `@apidevtools/swagger-parser`, etc.) | Zero total vulnerabilities across all dependency scopes |
| TypeScript typecheck | `npm run typecheck` | 1–4, 6, 7 | Both | No type errors from dependency changes |
| Protocol schema integrity | `npm run spec:check` | 1, 6, 7 | Both | `fast-uri` change preserves schema generation |
| Full test suite | `npm test` | 1–4, 6 | Windows (no PG) | All non-Postgres tests pass |
| Full test suite + Postgres | `npm test` (with `LIP_TEST_POSTGRES_URL`) | 7 | Linux Docker | All tests pass including tenant isolation |
| Tenant isolation (live) | `tests/unit/tenant-isolation-live.test.ts` | 7 | Linux + PG 17 | RLS, row visibility, write refusal |
| Tenant isolation (static) | `packages/storage-postgres/src/tenant-isolation.test.ts` | 6, 7 | Both | SQL conversation shape, transaction scope |
| Lease conformance | `tests/conformance/postgres-lease-conformance.test.ts` | 7 | Linux + PG 17 | Advisory lease contention, recovery |
| MCP unit tests | `tests/unit/mcp.test.ts` | 2, 3 | Windows | MCP helpers, JSON validation, server factory |
| Admin UI build | `npm run build:admin` | 4, 7 | Both | Vite upgrade doesn't break build |
| Docs mirror | `npm run docs:check` | 6 | Windows | No doc drift |
| Launch surface | `npm run launch:check` | 6 | Windows | Namespace/version integrity |
| Public safety | `npm run public-safety:check` | 6 | Windows | No secrets in tracked files |
| Zero skipped tests | `npm test -- --reporter=json` | 7 | Linux + PG 17 | CI parity: zero skipped |
| Clean lockfile install | `npm ci` | 6, 7 | Both | Lockfile determinism across platforms |
