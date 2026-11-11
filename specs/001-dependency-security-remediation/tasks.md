# Tasks: Dependency Security Remediation (Task 0.12)

**Input**: Design documents from `/specs/001-dependency-security-remediation/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Existing test suites are used for regression verification. No new test files are created.

**Organization**: Tasks are strictly sequential because each stage mutates `package-lock.json`. A later stage depends on the lockfile state produced by the previous stage.

## Format: `[ID] Description`

- All tasks are **strictly sequential** — no `[P]` parallelism is possible because every stage mutates shared lockfile state.
- Include exact file paths, exact JSON content, and exact shell commands.
- A cheaper model should be able to execute each task by copy-pasting the commands and JSON edits without judgment.

## Path Conventions

- **Monorepo root**: `d:\Projects\loyalty-interchange-protocol-main\` (Windows host)
- **Root manifest**: `package.json` (at monorepo root)
- **Root lockfile**: `package-lock.json` (at monorepo root)
- **MCP manifest**: `packages/mcp/package.json`
- **Admin manifest**: `apps/admin/package.json`
- **Fork patches**: `docs/context/07-fork-patches.md`

---

## Phase 1: Setup (Environment & Baseline)

**Purpose**: Verify correct Node.js/npm environment, confirm clean working tree, and capture pre-remediation baselines. No files are modified.

---

- [x] T001 Verify Node.js and npm versions on Windows host

**What to do**: Switch to the repository's pinned Node.js version and confirm versions.

**Exact commands** (run in PowerShell from the monorepo root):
```powershell
cd d:\Projects\loyalty-interchange-protocol-main
nvm use 22.22.0
node --version
npm --version
```

**Expected output**:
- `node --version` → `v22.22.0`
- `npm --version` → `10.9.4`

**If versions are wrong**: Run `nvm install 22.22.0` then `nvm use 22.22.0`. If npm is wrong, run `npm install -g npm@10.9.4`.

**Done when**: Both versions match exactly.

---

- [x] T002 Confirm clean working tree and record baseline commit

**What to do**: Verify no tracked files have been modified, capture the HEAD commit hash, and save it for rollback.

**Exact commands**:
```powershell
cd d:\Projects\loyalty-interchange-protocol-main
git status --short --untracked-files=all
git diff --stat
git diff --cached --stat
git rev-parse HEAD
```

**Expected output**:
- `git status` → only `?? specs/` (untracked spec files). No `M`, `A`, `D`, or `U` entries.
- `git diff --stat` → empty (no output).
- `git diff --cached --stat` → empty (no output).
- `git rev-parse HEAD` → `cf1a0df528891bb439a82c44426b6a20b5e3f692`

**Save this value**: Store the HEAD commit hash in a PowerShell variable for the rest of the session:
```powershell
$BASELINE = "cf1a0df528891bb439a82c44426b6a20b5e3f692"
```

**If working tree is dirty**: **STOP. Do not proceed.** Report the unexpected modifications.

**Done when**: Working tree is clean, HEAD matches, `$BASELINE` is saved.

---

- [x] T003 Capture pre-remediation audit baselines and file checksums

**What to do**: Run npm audit to capture the vulnerability baseline, capture the Core SaaS runtime tree, and save SHA-256 checksums of every file this task will modify.

**Exact commands**:
```powershell
cd d:\Projects\loyalty-interchange-protocol-main

# 1. Full monorepo audit (all deps)
npm audit --json > C:\tmp\task-0.12-baseline-audit-full.json

# 2. Production-only monorepo audit (all workspaces, omitting devDeps)
npm audit --omit=dev --json > C:\tmp\task-0.12-baseline-audit-prod.json

# 3. Core SaaS Pilot runtime tree (server + cloud only, NO wallet)
npm ls --omit=dev --workspace=@loyalty-interchange/server --workspace=@loyalty-interchange/cloud --all > C:\tmp\task-0.12-baseline-runtime-tree.txt

# 4. Wallet tree (separate, not part of Pilot gate)
npm ls --omit=dev --workspace=@loyalty-interchange/wallet --all > C:\tmp\task-0.12-baseline-wallet-tree.txt

# 5. SHA-256 checksums of every file Task 0.12 will modify
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
# Also record HEAD
Write-Output "git HEAD: $BASELINE"
```

**Save all output**: Copy the entire output (audit counts + checksums + HEAD) into `C:\tmp\task-0.12-baseline.txt`.

**Expected**: ~19 total vulnerabilities, ~9 production vulnerabilities. All 6 files should have checksums (none should be NOT_PRESENT).

**Done when**: All baseline files saved to `C:\tmp\`.

---

**Phase 1 Checkpoint**: Environment verified, baseline captured. No files modified yet. Proceed to Phase 2.

---

## Phase 2: User Story 1 — Core SaaS Production Pilot Security (Priority: P1) 🎯 MVP

**Goal**: Eliminate the sole Core SaaS production vulnerability (`fast-uri@3.1.5` → `^3.1.9`) so the pilot deployment in Egypt cafés has zero known Critical/High vulnerabilities.

**Independent Test**: After this phase, `npm ls fast-uri` shows `3.1.9+` everywhere, `npm run spec:check` exits 0, `npm run typecheck` exits 0, and `npm test` passes all non-Postgres tests.

**Why this is MVP**: This is the only vulnerability in the actual deployed production artifact. If only this phase is completed, the Core SaaS Pilot can proceed.

---

- [x] T004 [US1] Add `fast-uri` override to root `package.json`

**What to do**: Open `package.json` at the monorepo root. Add an `"overrides"` key at the top level (sibling of `"dependencies"`, `"devDependencies"`, etc.) with exactly this content:

**Exact JSON to add to `package.json`**:
```json
"overrides": {
  "fast-uri": "^3.1.9"
}
```

**Where to add it**: After the `"devDependencies"` block (or after `"workspaces"` — the exact position doesn't matter as long as it's a top-level key in the root `package.json`).

**IMPORTANT**: Do NOT modify any other key in `package.json`. Do NOT change `"dependencies"`, `"devDependencies"`, `"workspaces"`, `"scripts"`, or any other field. Only add the `"overrides"` block.

**File**: `package.json` (monorepo root)

**Done when**: `package.json` has an `"overrides"` block containing `"fast-uri": "^3.1.9"`.

---

- [x] T005 [US1] Install dependencies and verify `fast-uri` resolution

**What to do**: Run `npm install` to regenerate the lockfile with the new override, then verify `fast-uri` resolved correctly.

**Exact commands**:
```powershell
cd d:\Projects\loyalty-interchange-protocol-main

# 1. Install with the new override
npm install

# 2. Verify fast-uri resolves to 3.1.9+ everywhere
npm ls fast-uri

# 3. Verify Core SaaS runtime tree shows fast-uri 3.1.9+
npm ls --omit=dev --workspace=@loyalty-interchange/server --workspace=@loyalty-interchange/cloud --all | Select-String "fast-uri"
```

**Expected output**:
- `npm install` → exits 0, no errors.
- `npm ls fast-uri` → every instance shows `fast-uri@3.1.9` (or higher 3.x patch). No `3.1.5` or `3.1.6` or `3.1.7` or `3.1.8` should appear.
- The Core SaaS runtime tree search → `fast-uri@3.1.9` (or higher).

**If fast-uri still shows old version**: Check that the `"overrides"` block is correctly placed as a top-level key in `package.json`. npm overrides must be at root level.

**Done when**: All `fast-uri` instances are `3.1.9+`.

---

- [x] T006 [US1] Run Core SaaS regression tests

**What to do**: Run the full verification suite to confirm `fast-uri` upgrade didn't break anything.

**Exact commands**:
```powershell
cd d:\Projects\loyalty-interchange-protocol-main

# 1. Protocol schema integrity (CRITICAL — proves fast-uri change doesn't alter schemas)
npm run spec:check

# 2. TypeScript type checking across all workspaces
npm run typecheck

# 3. Production audit (should show fewer vulnerabilities now)
npm audit --omit=dev

# 4. Full test suite (Windows, no Postgres — Postgres tests will skip, that's expected)
npm test
```

**Expected output**:
- `npm run spec:check` → exits 0, zero schema drift.
- `npm run typecheck` → exits 0, zero type errors.
- `npm audit --omit=dev` → fast-uri advisories should be gone. Remaining MCP-related advisories are expected (fixed in Phase 3).
- `npm test` → all non-Postgres tests pass. Postgres-gated tests skip on Windows (expected without `LIP_TEST_POSTGRES_URL`).

**If `spec:check` fails**: **STOP.** The `fast-uri` override broke protocol schema generation. This is a critical regression. Report the error.

**If `typecheck` fails**: **STOP.** Report the type errors.

**Done when**: All four checks pass.

---

**Phase 2 Checkpoint (MVP)**: Core SaaS production vulnerability eliminated. `fast-uri@3.1.9+` verified in runtime tree. Protocol schemas intact. If nothing else is done, the pilot can proceed.

**Rollback for Phase 2** (if needed — reverts to pre-implementation baseline):
```powershell
git restore --source=$BASELINE -- package.json package-lock.json
npm ci
npm run typecheck
# Verify checksums match C:\tmp\task-0.12-baseline.txt for these 2 files
```

---

## Phase 3: User Story 2 — MCP Developer Tool Modernization (Priority: P1)

**Goal**: Upgrade `@modelcontextprotocol/sdk` to `^1.32.2`, migrate `zod` to `^4.6.7`, and apply root overrides for dormant Express/Hono transitive HTTP vulnerabilities. This eliminates all 8 MCP-tier vulnerabilities.

**Independent Test**: `npm test -- tests/unit/mcp.test.ts` passes and `npm run typecheck` exits 0.

**Why separate from MVP**: MCP (`packages/mcp`) is marked "Reference Only" (`PD-002`). It is NOT deployed in production. Its vulnerabilities do not block the pilot. But it must be remediated before distributing or using MCP in untrusted environments.

---

### Sub-phase 3A: MCP SDK Upgrade & Transitive HTTP Overrides

- [x] T007 [US2] Upgrade `@modelcontextprotocol/sdk` to `^1.32.2` in `packages/mcp/package.json`

**What to do**: Open `packages/mcp/package.json`. Find the `"dependencies"` section. Change the `@modelcontextprotocol/sdk` version.

**Exact change in `packages/mcp/package.json`**:
```
BEFORE: "@modelcontextprotocol/sdk": "^1.29.0"
AFTER:  "@modelcontextprotocol/sdk": "^1.32.2"
```

**IMPORTANT**: Change ONLY this one line. Do NOT modify any other dependency in this file yet (zod is changed in T009).

**File**: `packages/mcp/package.json`

**Done when**: The `@modelcontextprotocol/sdk` version reads `"^1.32.2"`.

---

- [x] T008 [US2] Add MCP transitive HTTP overrides to root `package.json`

**What to do**: Open `package.json` at the monorepo root. Find the `"overrides"` block (created in T004). Add four new entries.

**Exact JSON — the `"overrides"` block should now look like this**:
```json
"overrides": {
  "fast-uri": "^3.1.9",
  "proxy-addr": "^2.0.8",
  "body-parser": "^2.4.0",
  "qs": "^6.17.1",
  "ip-address": "^10.7.6"
}
```

**IMPORTANT**: Keep the existing `"fast-uri": "^3.1.9"` entry from T004. Add the four new entries below it. Do NOT change any other key in `package.json`.

**File**: `package.json` (monorepo root)

**Done when**: The `"overrides"` block contains all 5 entries.

---

- [x] T009 [US2] Install dependencies and verify MCP SDK + HTTP overrides

**What to do**: Run `npm install` and verify all MCP-related dependencies resolved correctly.

**Exact commands**:
```powershell
cd d:\Projects\loyalty-interchange-protocol-main

# 1. Install
npm install

# 2. Verify all target packages resolved
npm ls @modelcontextprotocol/sdk
npm ls proxy-addr
npm ls body-parser
npm ls qs
npm ls ip-address

# 3. TypeScript check
npm run typecheck

# 4. MCP-specific tests
npm test -- tests/unit/mcp.test.ts

# 5. Production audit (MCP HTTP advisories should now be gone)
npm audit --omit=dev
```

**Expected output**:
- `@modelcontextprotocol/sdk` → `1.32.2` (or higher 1.x)
- `proxy-addr` → `2.0.8+`
- `body-parser` → `2.4.0+`
- `qs` → `6.17.1+`
- `ip-address` → `10.7.6+`
- `npm run typecheck` → exits 0
- `tests/unit/mcp.test.ts` → passes
- `npm audit --omit=dev` → all proxy-addr/body-parser/qs/ip-address advisories gone

**Done when**: All versions correct, typecheck passes, MCP tests pass.

---

### Sub-phase 3B: Zod 4 Migration

- [x] T010 [US2] Migrate `zod` from `^3.25.76` to `^4.6.7` in `packages/mcp/package.json`

**What to do**: Open `packages/mcp/package.json`. Find `"zod"` in the `"dependencies"` section. Change its version.

**Exact change in `packages/mcp/package.json`**:
```
BEFORE: "zod": "^3.25.76"
AFTER:  "zod": "^4.6.7"
```

**IMPORTANT**: Change ONLY this one line. The SDK version should already be `^1.32.2` from T007.

**File**: `packages/mcp/package.json`

**Done when**: The `zod` version reads `"^4.6.7"`.

---

- [x] T011 [US2] Install dependencies, verify Zod 4, and run MCP tests

**What to do**: Run `npm install` and verify the Zod 4 migration compiled and tests pass.

**Exact commands**:
```powershell
cd d:\Projects\loyalty-interchange-protocol-main

# 1. Install
npm install

# 2. Verify Zod resolved to 4.x
npm ls zod

# 3. TypeScript check (CRITICAL — Zod 4 is a major version change)
npm run typecheck

# 4. MCP tests (verify tool schemas still work with Zod 4)
npm test -- tests/unit/mcp.test.ts

# 5. Full audit to check Zod advisory resolved
npm audit
```

**Expected output**:
- `npm ls zod` → `zod@4.6.7` (or higher 4.x)
- `npm run typecheck` → exits 0 (Zod 4 compiles cleanly — the MCP code uses only `z.object`, `z.string().describe()`, `z.enum()`, which are stable across Zod 3→4)
- `tests/unit/mcp.test.ts` → passes
- `npm audit` → `zod` advisory (`GHSA-mrhx-c7xc-m3w5`) should be gone

**If `typecheck` fails on a Zod import**: The import path may have changed in Zod 4. Open `packages/mcp/src/server.ts` and check the `import { z } from "zod"` line. If the error is about the import specifier, try changing it to `import { z } from "zod/v4"` (Zod 4 compatibility path). Then re-run `npm run typecheck`.

**Done when**: Zod 4.x resolved, typecheck passes, MCP tests pass.

---

**Phase 3 Checkpoint**: All 8 MCP vulnerabilities eliminated. SDK upgraded, Zod migrated, transitive HTTP overrides applied.

**Rollback for Phase 3** (reverts Phases 2+3 to baseline):
```powershell
git restore --source=$BASELINE -- package.json packages/mcp/package.json package-lock.json
# If packages/mcp/src/server.ts was modified for Zod 4 import:
git restore --source=$BASELINE -- packages/mcp/src/server.ts
npm ci
npm run typecheck
```

**Rollback for Phase 3 only** (keeps Phase 2 fast-uri override):
```powershell
git restore --source=$BASELINE -- packages/mcp/package.json
# If packages/mcp/src/server.ts was modified:
git restore --source=$BASELINE -- packages/mcp/src/server.ts
# Manually remove proxy-addr, body-parser, qs, ip-address from the "overrides" block in package.json
# Keep "fast-uri": "^3.1.9"
npm install
npm run typecheck
```

---

## Phase 4: User Story 3 — Development Toolchain Protection (Priority: P2)

**Goal**: Remediate all 10 development tooling vulnerabilities using a parent-bump-first strategy with root override fallback.

**Independent Test**: `npm audit` reports 0 total vulnerabilities, `npm run build:admin` succeeds, `npm test` passes.

**Why P2**: Dev tooling vulnerabilities only affect local developer machines and CI pipelines, not the deployed production artifact.

---

- [x] T012 [US3] Upgrade `vitest` and `@vitest/coverage-v8` in root `package.json`

**What to do**: Open `package.json` at the monorepo root. Find these two entries in `"devDependencies"` and change their versions.

**Exact changes in `package.json` `"devDependencies"`**:
```
BEFORE: "vitest": "^4.1.10"
AFTER:  "vitest": "^4.1.12"

BEFORE: "@vitest/coverage-v8": "^4.1.10"
AFTER:  "@vitest/coverage-v8": "^4.1.12"
```

**IMPORTANT**: Change ONLY these two lines in `"devDependencies"`. Do NOT modify the `"overrides"` block in this step.

**File**: `package.json` (monorepo root)

**Done when**: Both versions read `"^4.1.12"`.

---

- [x] T013 [US3] Upgrade `vite` in `apps/admin/package.json`

**What to do**: Open `apps/admin/package.json`. Find `"vite"` in the `"devDependencies"` section. Change its version.

**Exact change in `apps/admin/package.json` `"devDependencies"`**:
```
BEFORE: "vite": "^8.1.4"
AFTER:  "vite": "^8.3.6"
```

**IMPORTANT**: Change ONLY this one line. Do NOT modify any other dependency in this file.

**File**: `apps/admin/package.json`

**Done when**: The `vite` version reads `"^8.3.6"`.

---

- [x] T014 [US3] Install and run initial dev tooling verification

**What to do**: Install updated dependencies and run the first round of checks.

**Exact commands**:
```powershell
cd d:\Projects\loyalty-interchange-protocol-main

# 1. Install
npm install

# 2. TypeScript check
npm run typecheck

# 3. Full test suite with Vitest 4.1.12
npm test

# 4. Test coverage (verifies @vitest/coverage-v8@4.1.12)
npm run test:coverage

# 5. Admin UI build (verifies Vite 8.3.6)
npm run build:admin
```

**Expected output**:
- `npm run typecheck` → exits 0
- `npm test` → all non-Postgres tests pass
- `npm run test:coverage` → exits 0, generates coverage
- `npm run build:admin` → exits 0, outputs assets to `packages/server/dist/admin`

**Done when**: All four checks pass.

---

- [x] T015 [US3] Investigate and remediate transitive dev vulnerabilities

**What to do**: Check if any transitive dev vulnerabilities remain. If they do, attempt parent bumps first, then fall back to root overrides.

**Step 1 — Check remaining transitive versions**:
```powershell
cd d:\Projects\loyalty-interchange-protocol-main
npm ls js-yaml source-map-js browserslist postcss-selector-parser
npm audit
```

**Step 2 — Decision tree**:

Look at the `npm audit` output. For each remaining vulnerability:

**If `js-yaml@4.3.1` is still vulnerable** (advisory `GHSA-2883-xcg3-v3hh`):
- Try: check if `@apidevtools/swagger-parser` has a newer version that pulls `js-yaml@4.3.2+`. If yes, upgrade `@apidevtools/swagger-parser` in root `devDependencies`.
- If no parent bump resolves it: add `"js-yaml": "^4.3.2"` to the `"overrides"` block in root `package.json`.

**If `source-map-js@1.2.1` is still vulnerable** (advisory `GHSA-68fv-2mgg-jv7q`):
- The Vitest 4.1.12 upgrade may have pulled a newer `source-map-js`. If it's still `1.2.1`: add `"source-map-js": "^1.2.2"` to `"overrides"`.

**If `browserslist@4.28.6` is still vulnerable** (advisory `GHSA-c83g-rgw3-j3cx`):
- Try: check if `@vitejs/plugin-react` has a newer version that pulls `browserslist@4.29.5+`. If yes, upgrade `@vitejs/plugin-react` in `apps/admin/package.json` `devDependencies`.
- If no parent bump resolves it: add `"browserslist": "^4.29.5"` to `"overrides"`.

**If `postcss-selector-parser` is still vulnerable** (advisory `GHSA-rj75-hqrm-r3gf`):
- Try: check if `@tailwindcss/typography` has a newer version. If yes, upgrade it in `apps/admin/package.json` `devDependencies`.
- If no parent bump resolves it: add `"postcss-selector-parser": "^6.1.6"` to `"overrides"`.

**Step 3 — After all changes**:
```powershell
npm install
npm audit
npm run typecheck
npm test
npm run build:admin
```

**Expected final output**:
- `npm audit` → **0 total vulnerabilities** across the entire monorepo
- All other checks pass

**If 0 vulnerabilities cannot be achieved**: **STOP.** Report which vulnerabilities remain and what you tried.

**Done when**: `npm audit` reports 0 vulnerabilities and all checks pass.

---

**Phase 4 Checkpoint**: All 19 vulnerabilities eliminated. Full monorepo clean.

**Rollback for Phase 4 only** (keeps Phases 2+3):
```powershell
git restore --source=$BASELINE -- apps/admin/package.json
# Manually revert vitest/coverage versions in root package.json devDependencies back to "^4.1.10"
# Manually remove any dev-tooling overrides (js-yaml, source-map-js, browserslist, postcss-selector-parser) from the "overrides" block
# Keep fast-uri + MCP overrides
npm install
npm run typecheck
```

---

## Phase 5: Governance — Fork-Patch Documentation (FP-002)

**Goal**: Record all upstream manifest modifications as `FP-002` in the fork patches log, per Constitution Article II.3.

**Independent Test**: `grep -E "FP-002|Task 0.12" docs/context/07-fork-patches.md` shows the entry.

---

- [x] T016 Append FP-002 entry to `docs/context/07-fork-patches.md`

**What to do**: Open `docs/context/07-fork-patches.md`. Append a new entry after the existing `FP-001` entry. Use the table format already present in the file.

**Content to append** (adapt the table row format to match the existing file structure):

```markdown
### FP-002: Dependency Security Remediation (Task 0.12)

| Field | Value |
|---|---|
| **Files Modified** | `package.json` (root overrides: `fast-uri`, `proxy-addr`, `body-parser`, `qs`, `ip-address`, and any dev-tooling fallback overrides), `packages/mcp/package.json` (`@modelcontextprotocol/sdk` `^1.29.0` → `^1.32.2`, `zod` `^3.25.76` → `^4.6.7`), `apps/admin/package.json` (`vite` `^8.1.4` → `^8.3.6`), `packages/mcp/src/server.ts` (Zod 4 import path if changed) |
| **Reason** | Task 0.12 — Dependency Security Remediation: 19 advisories (1 Critical, 8 High, 10 Moderate) |
| **PD Reference** | PD-002 (MCP Reference Only), Task 0.12, Task 5.6 (Pilot Readiness) |
| **Upstream Merge Impact** | Root `overrides` block is additive. Upstream merge requires reconciling `overrides` with upstream's dependency resolution. `packages/mcp` manifest changes (SDK, Zod) will conflict with upstream `0.2.0` versions. |
| **Test Coverage** | `npm run spec:check`, `npm run typecheck`, `npm test`, `npm audit`, `npm run build:admin` |
```

**IMPORTANT**: Read the existing file first to match its exact table format. If it uses a different format (e.g., a single-row table per patch), adapt accordingly. The content above should be included regardless of format.

**File**: `docs/context/07-fork-patches.md`

**Done when**: `FP-002` entry is present with all fields.

---

**Phase 5 Rollback** (documentation only, no lockfile changes):
```powershell
git restore --source=$BASELINE -- docs/context/07-fork-patches.md
```

---

## Phase 6: Polish & Cross-Cutting Verification

**Purpose**: Final verification on Windows, then mandatory cross-platform verification on Linux Docker with PostgreSQL 17.

---

### Sub-phase 6A: Windows Host Final Verification

- [x] T017 Run complete Windows verification suite — **Closed by owner-approved Windows platform exception**

> **Administrative Closure Note**: Closed `[x]` administratively under an explicit project-owner-approved Windows platform exception (NOT as a successful Windows test run). Raw Windows `npm test` execution result is preserved as **452 passed, 6 failed, 25 skipped** out of 483 tests. The exception covers strictly the six documented, pre-existing Windows host limitations identical to baseline commit `cf1a0df528891bb439a82c44426b6a20b5e3f692`. On the target Linux deployment platform (verified in T018), all 483 tests pass with 0 failures and 0 skips.

**What to do**: Execute every standard verification command on the Windows host. This is a read-only verification phase — no files should be modified.

**Exact commands**:
```powershell
cd d:\Projects\loyalty-interchange-protocol-main

# 1. Audit the lockfile diff for unexpected changes
git diff package-lock.json | Select-Object -First 100

# 2. Clean install from lockfile
npm ci

# 3. All 5 standard verification suites
npm run public-safety:check
npm run typecheck
npm run docs:check
npm run launch:check
npm run spec:check

# 4. Full test suite
npm test

# 5. Audits
npm audit --json > C:\tmp\task-0.12-final-audit-full.json
npm audit --omit=dev --json > C:\tmp\task-0.12-final-audit-prod.json

# 6. Core SaaS runtime tree composition check
npm ls --omit=dev --workspace=@loyalty-interchange/server --workspace=@loyalty-interchange/cloud --all

# 7. Wallet tree (separate, not part of Pilot gate)
npm ls --omit=dev --workspace=@loyalty-interchange/wallet --all
```

**Expected output**:
- `npm ci` → exits 0 (clean install from lockfile)
- All 5 verification suites → exit 0
- `npm test` → all non-Postgres tests pass (report exact pass/fail/skip counts)
- `npm audit` → 0 total vulnerabilities
- `npm audit --omit=dev` → 0 production vulnerabilities
- Core SaaS runtime tree → shows `fast-uri@3.1.9+`, NO MCP packages
- Wallet tree → shows `jose@6.2.3` only (zero vulnerabilities)

**If any check fails**: **STOP.** Report the failure. Do not proceed to Docker verification.

**Done when**: All checks pass on Windows host.

---

### Sub-phase 6B: Docker Linux Verification (Mandatory Pilot Gate)

- [x] T018 Run mandatory Docker Linux verification with PostgreSQL 17

**What to do**: Start a Linux Docker environment with `node:22.22.0` and `postgres:17-alpine`. Run the complete verification suite including all PostgreSQL-gated tests.

**How to start the environment**: Use the repository's existing `compose.yaml` or start containers manually:
```bash
# Option A: If compose.yaml has a test service, use it
# Option B: Manual Docker run
docker run -d --name lip-postgres -e POSTGRES_USER=lip -e POSTGRES_PASSWORD=lip -e POSTGRES_DB=lip_test postgres:17-alpine
docker run -it --link lip-postgres:postgres -v "d:\Projects\loyalty-interchange-protocol-main:/app" -w /app -e LIP_TEST_POSTGRES_URL=postgres://lip:lip@postgres:5432/lip_test node:22.22.0 bash
```

**Exact commands inside the Linux container**:
```bash
# 1. Clean install from Windows-generated lockfile
npm ci

# 2. TypeScript check
npm run typecheck

# 3. Protocol schema integrity
npm run spec:check

# 4. Full test suite WITH PostgreSQL 17
npm test

# 5. Zero skipped tests assertion
npm test -- --reporter=json --outputFile=/tmp/vitest-report.json
node -p "require('/tmp/vitest-report.json').numPendingTests ?? 0"
# MUST output: 0

# 6. Full audits
npm audit --json
npm audit --omit=dev --json

# 7. Full build (includes Admin UI)
npm run build

# 8. Core SaaS runtime tree
npm ls --omit=dev --workspace=@loyalty-interchange/server --workspace=@loyalty-interchange/cloud --all

# 9. Wallet tree
npm ls --omit=dev --workspace=@loyalty-interchange/wallet --all
```

**Expected output**:
- `npm ci` → exits 0 (proves cross-platform lockfile determinism)
- `npm run typecheck` → exits 0
- `npm run spec:check` → exits 0
- `npm test` → **ALL tests pass**, including:
  - `tests/unit/tenant-isolation-live.test.ts` (RLS, row visibility, write refusal)
  - `packages/storage-postgres/src/tenant-isolation.test.ts` (SQL conversation shape)
  - `tests/conformance/postgres-lease-conformance.test.ts` (advisory lease contention)
- `numPendingTests` → `0` (**zero skipped tests**)
- `npm audit` → 0 vulnerabilities
- `npm audit --omit=dev` → 0 vulnerabilities
- `npm run build` → exits 0
- Core SaaS tree → `fast-uri@3.1.9+`, no MCP packages

**CRITICAL**: Report exact counts:
- Total tests passed: ___
- Total tests failed: ___
- Total tests skipped: ___
- Execution environment: Linux `node:22.22.0` + `postgres:17-alpine`

**If any test fails**: **STOP.** Report the failure with the test name and error message.

**If any test is skipped**: **STOP.** Report which test was skipped and why.

**Done when**: All tests pass, zero skipped, zero vulnerabilities, build succeeds.

---

- [x] T019 Produce final verification report

**What to do**: Write a summary report with all verification results. Do NOT commit or push anything.

**Report must include**:
1. **Environment**: Node.js version, npm version, OS (Windows + Linux Docker)
2. **Audit results**: Exact vulnerability counts for `npm audit` and `npm audit --omit=dev` (both should be 0)
3. **Core SaaS runtime tree**: Confirm fast-uri@3.1.9+ and MCP absent
4. **Test results**: Exact pass/fail/skip counts from both Windows and Linux runs
5. **Verification suites**: Exit codes for `spec:check`, `typecheck`, `docs:check`, `launch:check`, `public-safety:check`
6. **Build**: Exit code for `npm run build` and `npm run build:admin`
7. **Files modified**: List every file that was changed during implementation
8. **Git status**: Output of `git status --short` and `git diff --stat`

**Exact commands for git status**:
```powershell
cd d:\Projects\loyalty-interchange-protocol-main
git status --short --untracked-files=all
git diff --stat
git rev-parse HEAD
```

**Expected**:
- `git status` → Modified files: `package.json`, `package-lock.json`, `packages/mcp/package.json`, `apps/admin/package.json`, `docs/context/07-fork-patches.md`, and possibly `packages/mcp/src/server.ts`. Plus `?? specs/` untracked.
- `git diff --stat` → shows only the above files.
- HEAD → still `cf1a0df528891bb439a82c44426b6a20b5e3f692` (no commits made).

**Done when**: Report written with all data. No commits made.

---

## Dependencies & Execution Order

### Phase Dependencies

```
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019
```

**ALL tasks are strictly sequential.** Every task depends on the successful completion of the previous task. This is because:
- Tasks T004–T015 mutate `package.json` and `package-lock.json`
- Each `npm install` regenerates the lockfile based on the previous state
- Running tasks out of order will produce an incorrect lockfile

### Phase Summary

- **Phase 1** (T001–T003): Setup — no file changes
- **Phase 2** (T004–T006): Core SaaS `fast-uri` override — **MVP / Pilot Blocker**
- **Phase 3** (T007–T011): MCP SDK + Zod 4 + HTTP overrides — MCP Tooling Gate
- **Phase 4** (T012–T015): Dev tooling upgrades — Monorepo hygiene
- **Phase 5** (T016): Fork-patch documentation — Governance
- **Phase 6** (T017–T019): Final verification — Pilot gate proof

### Rollback Reference

Every rollback uses the baseline commit `$BASELINE` recorded in T002:
```powershell
$BASELINE = "cf1a0df528891bb439a82c44426b6a20b5e3f692"
```

**Full feature rollback** (reverts ALL Task 0.12 changes):
```powershell
git restore --source=$BASELINE -- package.json apps/admin/package.json packages/mcp/package.json packages/mcp/src/server.ts docs/context/07-fork-patches.md package-lock.json
npm ci
npm run typecheck
# Verify checksums match C:\tmp\task-0.12-baseline.txt
```
*Preserves: untracked spec files (`specs/001-dependency-security-remediation/*`), `.specify/` artifacts, and any unrelated tracked or untracked changes not owned by Task 0.12.*

---

## Implementation Strategy

### MVP First (Phase 2 Only — User Story 1)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Core SaaS fast-uri override (T004–T006)
3. **STOP and VALIDATE**: `fast-uri@3.1.9+` in runtime tree, `spec:check` passes, all tests pass
4. This alone satisfies the Core SaaS Pilot Blocker gate

### Full Remediation (All Phases)

1. Phase 1: Setup (T001–T003)
2. Phase 2: Core SaaS fast-uri (T004–T006) → **MVP checkpoint**
3. Phase 3: MCP modernization (T007–T011) → **MCP Tooling Gate checkpoint**
4. Phase 4: Dev tooling (T012–T015) → **0 total vulnerabilities checkpoint**
5. Phase 5: FP-002 documentation (T016) → **Governance checkpoint**
6. Phase 6: Final verification (T017–T019) → **Pilot gate proof**

---

## Critical Rules for the Implementing Agent

1. **Do NOT skip any task.** Execute them in exact order T001 through T019.
2. **Do NOT auto-commit.** No `git commit`, `git push`, or deployment at any point.
3. **Do NOT modify files not listed in the task.** Each task says exactly which file(s) to change.
4. **Do NOT use `--force` or `--legacy-peer-deps`** with npm install.
5. **Do NOT modify** `spec/`, migration files, RLS policies, or any file in `packages/protocol/src/` or `packages/storage-postgres/migrations/`.
6. **STOP and report** if any command fails unexpectedly. Do not try to fix it creatively.
7. **Report exact test counts** (passed/failed/skipped) for every `npm test` run.
8. **Report exact audit counts** for every `npm audit` run.
9. **Use Node.js 22.22.0 and npm 10.9.4** for ALL commands. Run `nvm use 22.22.0` at the start of each new shell session.

---

## Notes

- All tasks are strictly sequential — no parallelism possible due to shared lockfile state.
- Verify tests fail before implementing → Not applicable (this is dependency remediation, not feature development).
- Stop at any checkpoint to validate independently.
- The implementing agent should treat every `STOP` instruction as a hard gate. Do not proceed past a STOP.
