# Quickstart Validation Guide: Dependency Security Remediation (Task 0.12)

**Feature**: `001-dependency-security-remediation` | **Date**: 2026-11-09

## Prerequisites

- Node.js `22.22.0` installed via `nvm` (verify: `node --version`)
- npm `10.9.4` (verify: `npm --version`)
- Docker Desktop with `node:22.22.0` and `postgres:17-alpine` images available
- Repository on branch `main` at HEAD `cf1a0df528891bb439a82c44426b6a20b5e3f692`
- Working tree clean of tracked modifications (spec files may be untracked)

## Validation Procedure

### Step 1: Pre-Remediation Baselines

```bash
nvm use 22.22.0

# 1a. Monorepo audit baseline
npm audit --json > /tmp/baseline-audit.json
npm audit --omit=dev --json > /tmp/baseline-audit-prod.json
# Expected: 19 total vulnerabilities (1 Crit, 8 High, 10 Mod); 9 production-scope (1 Crit, 4 High, 4 Mod)

# 1b. Core SaaS runtime dependency graph baseline
npm ls --omit=dev --workspace=@loyalty-interchange/server --workspace=@loyalty-interchange/cloud --all
# Expected: Shows exactly 1 vulnerability in deployable runtime: fast-uri@3.1.5 via ajv@8.20.0
# MCP packages are completely absent from this tree.
# Wallet is not deployed to Render for the pilot — verify separately:
npm ls --omit=dev --workspace=@loyalty-interchange/wallet --all
# Expected: jose@6.2.3 only, zero vulnerabilities
```

### Step 2: Post-Remediation Security Audits

After implementation stages T-002 through T-005:

```bash
# Full monorepo audit (all workspaces, all scopes)
npm audit
# Expected: found 0 vulnerabilities

# Monorepo production audit (all workspaces' production deps, INCLUDING MCP)
npm audit --omit=dev
# Expected: found 0 vulnerabilities
# NOTE: This is NOT a Core SaaS-only audit — it includes packages/mcp production deps

# Core SaaS Pilot runtime audit (only deployed workspaces)
npm ls --omit=dev --workspace=@loyalty-interchange/server --workspace=@loyalty-interchange/cloud --all
# Expected: All ajv instances resolve fast-uri@3.1.9+. Zero vulnerabilities in tree.
```

### Step 3: Protocol Schema Integrity

```bash
npm run spec:check
# Expected: exit code 0 (zero diff in spec/schemas/, spec/openapi.yaml, etc.)
```
This proves `fast-uri@3.1.9` preserves identical URI normalization behavior for all TypeBox schemas and OpenAPI artifacts.

### Step 4: TypeScript Type Safety

```bash
npm run typecheck
# Expected: exit code 0 across monorepo and apps/admin
```
This proves Zod 4 migration in `packages/mcp/src/server.ts` compiles cleanly and no workspace has broken types.

### Step 5: Test Suites & Coverage

```bash
# Vitest unit test suite (Windows host)
npm test
# Expected: All non-Postgres-gated tests pass.
# Postgres-gated tests skip on Windows (expected without LIP_TEST_POSTGRES_URL).

# Test coverage suite
npm run test:coverage
# Expected: Vitest 4.1.12 with @vitest/coverage-v8@4.1.12 runs cleanly and satisfies thresholds.

# MCP specific tests
npm test -- tests/unit/mcp.test.ts
# Expected: Server factory, path traversal, and JSON payload validation pass with Zod 4.
```

### Step 6: Admin UI Build

```bash
npm run build:admin
# Expected: Vite 8.3.6 builds without errors, outputting assets to packages/server/dist/admin.
```

### Step 7: Standard Repository Checks

```bash
npm run public-safety:check    # No secrets in tracked files
npm run docs:check             # Documentation mirror integrity
npm run launch:check           # Namespace/version surface check
```

### Step 8: Docker Linux Verification (Mandatory Pilot Gate)

```bash
# Start PostgreSQL 17 and Node 22.22.0 container
# Set LIP_TEST_POSTGRES_URL=postgres://lip:lip@postgres:5432/lip_test

# 8a. Clean install from lockfile (verifies cross-platform determinism)
npm ci

# 8b. Typecheck and protocol checks
npm run typecheck
npm run spec:check

# 8c. Full test execution with PostgreSQL 17
npm test

# 8d. Zero skipped tests assertion
npm test -- --reporter=json --outputFile=/tmp/vitest-report.json
node -p "require('/tmp/vitest-report.json').numPendingTests ?? 0"
# Expected: 0

# 8e. Audits in Linux container
npm audit                        # Monorepo full audit
npm audit --omit=dev             # Monorepo production audit (all workspaces incl. MCP)
npm ls --omit=dev --workspace=@loyalty-interchange/server --workspace=@loyalty-interchange/cloud --all  # Core SaaS Pilot runtime

# 8f. Full production build
npm run build
```

### Step 9: Fork-Patch Governance Verification

```bash
# Verify FP-002 entry in fork patches log
grep -E "FP-002|Task 0.12" docs/context/07-fork-patches.md
# Expected: Contains documented entry with modified files and PD-002 reference.
```

## Success Criteria Summary

| Check | Expected Result | Scope | Gate |
|---|---|---|---|
| `npm audit` | 0 vulnerabilities | Monorepo full (all deps, all workspaces) | Monorepo hygiene |
| `npm audit --omit=dev` | 0 vulnerabilities | Monorepo production (all workspaces incl. MCP) | Monorepo hygiene |
| Core SaaS runtime `npm ls` | fast-uri@3.1.9+; MCP dependencies absent from tree | `server` + `cloud` only (deployed to Render) — tree composition only, not a vulnerability scan | **Pilot Blocker** |
| `npm run spec:check` | Exit 0 (zero schema drift) | Protocol | **Pilot Blocker** |
| `npm run typecheck` | Exit 0 | Monorepo | Quality |
| `npm test` (Linux + PG 17) | All pass, **0 skipped** | Full suite | **Pilot Blocker** |
| `npm run build` | Exit 0 | Monorepo | Build |
| `npm ci` (cross-platform) | Clean install on both Windows and Linux | Lockfile | Reproducibility |
| `docs/context/07-fork-patches.md` | Contains `FP-002` entry | Governance | Governance |
