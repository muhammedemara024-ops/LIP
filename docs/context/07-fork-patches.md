# Fork patches

Every modification to upstream LIP code is logged here (PD-002, golden rule 1).
Upstream remote: `upstream` → `craveup-oss/loyalty-interchange-protocol`.
Changes to `/lip/v1` wire semantics or `spec/` are never allowed and never appear here.

| File | Reason | PD reference | Upgrade impact |
| --- | --- | --- | --- |
| `.gitignore` | Workspace hygiene; ignores `.claude/settings.local.json` (per-machine Claude Code settings) | PD-002 | Trivial merge |
| `packages/storage-postgres/src/index.ts`, `apps/cloud/src/postgres-repository.ts`, `apps/cloud/src/customer-postgres-repository.ts` | Acquire `pg_advisory_xact_lock` before `CREATE TABLE IF NOT EXISTS lip_schema_migrations` / `lip_cloud_schema_migrations` to prevent `23505` (`pg_type_typname_nsp_index`) catalog race on concurrent cold-start migrations | PD-002 | Safe to drop if upstream merges equivalent lock ordering |
| `tests/unit/postgres-storage.test.ts`, `apps/cloud/src/migrate.test.ts` | Regression tests proving 8-way concurrent cold-start migration safety on a fresh PostgreSQL schema | PD-002 | Keep alongside migration lock fix |
| `skills/lip/SKILL.md`, `skills/lip-cli/SKILL.md`, `skills/lip-webhooks/SKILL.md`, `skills/lip-bff/SKILL.md`, `docs/api-docs-gap-analysis.md`, `docs/postgres.md`, `docs-site/guides/postgres.mdx` | Task 0.9 documentation drift fixes (v0.2.0 `/platform/v1` and `/admin/api/v1/program/*` scope, webhook loopback env var + 16-char secret + `balance.changed.v1`, PD-004 BFF OTP note, July 2026 historical banner, 3-service diskless Render blueprint) | PD-002, PD-004, PD-006 | Docs-only merge |
| `package.json`, `package-lock.json`, `packages/mcp/package.json`, `packages/mcp/src/lib.ts`, `packages/mcp/src/server.ts`, `tests/unit/mcp.test.ts`, `apps/admin/package.json` | FP-002: Task 0.12 dependency security remediation eliminating 19 baseline vulnerable package nodes (46 unique advisory URLs) across Core SaaS, MCP tooling, and dev toolchain | PD-002, PD-004 | Reconcile root overrides and packages/mcp manifests on upstream merge |

---

### FP-002: Dependency Security Remediation (Task 0.12)

| Field | Value |
|---|---|
| **Files Modified** | `package.json` (root overrides: `fast-uri`, `proxy-addr`, `body-parser`, `qs`, `ip-address`, `hono`, `@hono/node-server`, `js-yaml`, `browserslist`, `postcss-selector-parser`; devDependencies: `vitest` `^4.1.12`, `@vitest/coverage-v8` `^4.1.12`), `package-lock.json` (dependency graph synchronization), `packages/mcp/package.json` (`@modelcontextprotocol/sdk` `^1.32.2`, `zod` `^4.6.7`), `packages/mcp/src/lib.ts` (`Object.hasOwn` schema lookup guard), `packages/mcp/src/server.ts` (`isMainModule` with `realpathSync` Windows symlink resolution), `tests/unit/mcp.test.ts` (portable regression unit tests), `apps/admin/package.json` (`vite` `^8.1.4` → `^8.3.6`) |
| **Reason** | Task 0.12 — Dependency Security Remediation: 19 vulnerable package nodes (1 Critical, 8 High, 10 Moderate) representing 46 distinct CVE/GHSA advisory URLs (33 production, 13 dev-only) across Core SaaS runtime, MCP developer tool, and dev toolchain |
| **PD Reference** | PD-002 (MCP Reference Only; pinned upstream `8ad93c81a414f5f7521061ddd88009083f4857aa`), Task 0.12 (Dependency Remediation), Task 5.6 (Pilot Readiness) |
| **Upstream Pinned SHA** | `8ad93c81a414f5f7521061ddd88009083f4857aa` (`@loyalty-interchange/*` v0.2.0); Task 0.12 baseline commit `cf1a0df528891bb439a82c44426b6a20b5e3f692` |
| **Upstream Merge Impact** | Root `overrides` block is additive and isolated to fork manifests; upstream merge requires reconciling overrides against upstream package updates. Manifest changes in `packages/mcp` (`@modelcontextprotocol/sdk`, `zod`) will conflict with upstream `0.2.0` versions. Normative protocol wire semantics, OpenAPI schemas, and JSON schema outputs are unchanged (`spec:check` diff: 0). |
| **Test Coverage & Seams** | `npm run spec:check` (zero schema drift), `npm run typecheck` (zero type errors), `npx vitest run tests/unit/mcp.test.ts` (7/7 passed), `npx vitest run apps/admin` (3/3 passed), `npm run build:admin` (Vite 8.3.7 build succeeded), `npm audit --omit=dev` (0 vulnerabilities), `npm audit` (0 vulnerabilities) |

#### Baseline Vulnerability Evidence & Remediation Mapping

Archived baseline audit logs (`task-0.12-baseline-audit-full.json`, `task-0.12-baseline-audit-prod.json`) at HEAD `cf1a0df528891bb439a82c44426b6a20b5e3f692`:

- **Production Graph (`--omit=dev`)**: 9 vulnerable package nodes (1 Critical, 4 High, 4 Moderate) comprising **33 distinct advisory instances (unique URLs)**:
  - `proxy-addr` (1 advisory, Critical 9.1): `GHSA-jqcg-44mw-7w3h`
  - `fast-uri` (10 advisories, High): `GHSA-5jgf-p345-68v8`, `GHSA-f65p-4m7j-42xc`, `GHSA-fph4-wmhf-6fwf`, `GHSA-jqff-g426-hqxp`, `GHSA-qw65-cvwx-89v3`, `GHSA-hrr3-gc8f-f4qj`, `GHSA-w74x-v6f9-j3xg`, `GHSA-xhq7-xmqj-769h`, `GHSA-wjr9-j795-jxcr`, `GHSA-333x-w4r6-6crp`
  - `@modelcontextprotocol/sdk` (6 advisories, High): `GHSA-6qxp-vccf-f47h`, `GHSA-22jm-h49p-29qw`, `GHSA-46jr-4wx8-v453`, `GHSA-rvq5-wwqv-78pq`, `GHSA-f897-62hf-6gxq`, `GHSA-6prh-2h8m-c8cw`
  - `body-parser` (1 advisory, High 7.5): `GHSA-27r3-jxmh-p828`
  - `zod` (1 advisory, High): `GHSA-mrhx-c7xc-m3w5`
  - `hono` (5 advisories, Moderate): `GHSA-gqvv-2mrq-wpjv`, `GHSA-g6gw-c38x-mqfc`, `GHSA-crvj-82cr-hjcx`, `GHSA-hxh3-vqpv-xpqv`, `GHSA-5r4p-p66f-jhc7`
  - `ip-address` (5 advisories, Moderate): `GHSA-rpw4-54j3-4h4q`, `GHSA-2vr4-cq9g-pvrc`, `GHSA-j6r3-76f7-8jcv`, `GHSA-h3mg-xc3c-68pw`, `GHSA-rxp7-6hxx-x8q5`
  - `qs` (3 advisories, Moderate): `GHSA-x5fp-wj9c-mxmx`, `GHSA-4mjr-xmp4-gh2g`, `GHSA-6pq8-jhm2-2vcw`
  - `@hono/node-server` (1 advisory, Moderate): `GHSA-rmxm-3fg6-px4f`
- **Development Toolchain Graph (Dev-only)**: 10 vulnerable package nodes (0 Critical, 4 High, 6 Moderate) comprising **13 distinct advisory instances (unique URLs)**:
  - `vite` (5 advisories, High): `GHSA-698v-4r3x-3vcv`, `GHSA-r825-w8mm-5pxw`, `GHSA-587h-7wmj-h5pm`, `GHSA-9jrq-w75r-8gcw`, `GHSA-rq7h-c2jc-7f22`
  - `browserslist` (2 advisories, High): `GHSA-c83g-rgw3-j3cx`, `GHSA-73wf-gq98-2v4g`
  - `js-yaml` (1 advisory, High): `GHSA-2883-xcg3-v3hh`
  - `source-map-js` (1 advisory, High): `GHSA-68fv-2mgg-jv7q`
  - `@vitest/mocker` / `vitest` (2 advisories, Moderate): `GHSA-82fw-gwwq-j7x9`, `GHSA-qxg6-89mg-rqv8`
  - `baseline-browser-mapping` (1 advisory, Moderate): `GHSA-w5vr-8v7q-w6rv`
  - `postcss-selector-parser` (1 advisory, Moderate): `GHSA-rj75-hqrm-r3gf`
- **Total Monorepo Baseline**: 19 vulnerable package nodes, **46 distinct advisory instances (unique URLs: 33 production + 13 dev-only)**.
- **Remediated Status**: **0 vulnerabilities** on both `npm audit --omit=dev` and monorepo `npm audit`.

#### Parent-First Upgrade Investigation Results

1. **`js-yaml`**:
   - Parent package: `@apidevtools/swagger-parser@12.1.0` -> `@apidevtools/json-schema-ref-parser@14.0.1` -> `js-yaml@4.3.1`.
   - Tested candidate: `@apidevtools/swagger-parser@13.1.0`.
   - Result: 13.x is a major breaking bump requiring `node >= 22.19.0`, pulls `js-yaml@5.4.2`, and introduces 77 new transitive dependencies including WASM runtimes (`@tybys/wasm-util`, `@emnapi/*`).
   - Root override justification: `@apidevtools/json-schema-ref-parser@14.0.1` declares `"js-yaml": "^4.1.0"`. Override `"js-yaml": "^4.3.2"` is within the declaring package's semver range, eliminates the vulnerability with zero dependency bloat, and passes `npm run spec:check`.
2. **`browserslist`**:
   - Parent package: `apps/admin` -> `@vitejs/plugin-react@5.2.0` -> `@babel/core@7.29.7` -> `@babel/helper-compilation-targets@7.29.7` -> `browserslist@4.28.6`.
   - Tested candidate: `@vitejs/plugin-react@6.3.0`.
   - Result: `@vitejs/plugin-react@6.x` is a major version bump with breaking changes. Furthermore, `@babel/helper-compilation-targets@7.29.7` declares `"browserslist": "^4.22.2"`.
   - Root override justification: `"browserslist": "^4.29.5"` is within Babel's declared range, resolves `GHSA-c83g-rgw3-j3cx` and `GHSA-73wf-gq98-2v4g`, pulls patched `baseline-browser-mapping@2.11.13` (resolving `GHSA-w5vr-8v7q-w6rv`), and builds cleanly.
3. **`postcss-selector-parser`**:
   - Parent package: `apps/admin` -> `@tailwindcss/typography@0.5.20` -> `postcss-selector-parser@6.0.10`.
   - Tested candidate: `@tailwindcss/typography` latest (`0.5.20` is already the highest release on npm; no parent bump exists).
   - Exact pin constraint: Notice that `@tailwindcss/typography@0.5.20` explicitly pins `"postcss-selector-parser": "6.0.10"` (exact string pin, not a caret range `^6.0.10`), which prevents npm from resolving any patched 6.0.x/6.1.x version via standard semver resolution.
   - Forced root override justification: Root override `"postcss-selector-parser": "^6.1.6"` was applied to force npm to resolve the patched version and eliminate advisory `GHSA-rj75-hqrm-r3gf`. This forced override is verified safe based on: (1) full semver backward compatibility across the 6.x selector parser processor API; (2) clean production build via `npm run build:admin` (Vite 8.3.7 transforms 1,783 modules and emits typography CSS `index-CJq4ofmG.css` without errors or warnings); (3) passing Admin unit tests (3/3); and (4) clean execution of the full monorepo build and test suites (483/483 passed on Linux).

#### PD-002 Patch Replay Procedure

When syncing the fork with upstream `upstream/main` (`8ad93c81a414f5f7521061ddd88009083f4857aa`):

```bash
# 1. Export Task 0.12 changes as a clean unified 3-way patch:
git diff cf1a0df528891bb439a82c44426b6a20b5e3f692 -- \
  apps/admin/package.json \
  package.json \
  packages/mcp/package.json \
  packages/mcp/src/lib.ts \
  packages/mcp/src/server.ts \
  tests/unit/mcp.test.ts > fp-002-dependency-remediation.patch

# 2. Apply patch onto target rebase/merge branch using 3-way merge:
git apply -3 fp-002-dependency-remediation.patch

# 3. Regenerate lockfile under Node 22.22.0 / npm 10.9.4:
npm install

# 4. Verify protocol contract and typecheck:
npm run spec:check
npm run typecheck
npm audit
```

#### Preserve / Reconcile / Retire Criteria

| Component / Change | Policy | Criteria & Action |
|---|---|---|
| `packages/mcp/src/lib.ts` (`Object.hasOwn` schema guard) | **PRESERVE** | Permanent security invariant against prototype pollution in MCP tool JSON validation. Retain across all upstream merges. |
| `packages/mcp/src/server.ts` (`isMainModule` realpath) | **PRESERVE** | Runtime invariant for Windows npm workspace symlink execution (`lip-mcp.cmd`). Retain across all upstream merges. |
| `tests/unit/mcp.test.ts` (portable regression tests) | **PRESERVE** | Tests for prototype pollution and entry-point path detection. Retain across all upstream merges. |
| `package.json` overrides (`fast-uri@^3.1.9`) | **RECONCILE** | Reconcile when upstream bumps `ajv` or dependencies so that `fast-uri >= 3.1.9` resolves natively without override. |
| `package.json` overrides (transitive HTTP: `proxy-addr`, `body-parser`, `qs`, `ip-address`, `hono`, `@hono/node-server`) | **RECONCILE** | Reconcile when upstream `@modelcontextprotocol/sdk` updates its transitive Express/Hono dependency tree to patched versions. |
| `packages/mcp/package.json` (`@modelcontextprotocol/sdk@^1.32.2`, `zod@^4.6.7`) | **RECONCILE** | Reconcile against upstream `packages/mcp` manifest upon upstream version alignment. |
| `apps/admin/package.json` (`vite@^8.3.6`) | **RECONCILE** | Reconcile against upstream `apps/admin` manifest upon upstream Vite bump. |
| `package.json` dev overrides (`js-yaml@^4.3.2`, `browserslist@^4.29.5`, `postcss-selector-parser@^6.1.6`) | **RETIRE** | Retire when parent packages (`@apidevtools/swagger-parser`, `@vitejs/plugin-react`, `@tailwindcss/typography`) release upstream versions that natively resolve these vulnerabilities. |

#### Verification Boundaries & Outstanding Limitations

- **Windows T017 Execution Status**: Task T017 is **CLOSED (`[x]`) administratively under an owner-approved Windows platform exception**. On the Windows host, the raw `npm test` execution outcome is preserved as **53 passed suites, 6 failed suites, 3 skipped suites (62 total)** and **452 passed tests, 6 failed tests, 25 skipped tests (483 total)** (exit code 1). The project owner explicitly granted a limited platform exception covering strictly these six pre-existing Windows-specific failing suites (7 error blocks):
  1. `tests/unit/cli.test.ts`: `beforeAll` hook error `spawn npm ENOENT` (missing `.cmd` wrapper on Windows, causing 2 suite tests to skip).
  2. `tests/unit/member-migration.test.ts`: POSIX `0o600` mode bit assertion returning `0o666` (`438` vs `384`) on Windows NTFS.
  3. `packages/server/src/migration.test.ts`: POSIX `0o600` mode bit assertion returning `0o666` (`438` vs `384`) on Windows NTFS.
  4. `apps/cloud/src/data-plane-provisioner.test.ts` (2 failed assertions): POSIX `0o600` mode bit assertions returning `0o666` on NTFS for credentials and backup archives.
  5. `tests/unit/server.test.ts`: SQLite file handle release timing `EBUSY` error unlinking `reference.db` during `afterAll` tempdir cleanup.
  6. `tests/unit/webhooks.test.ts`: SQLite file handle release timing `EBUSY` error unlinking `reference.db` during `afterAll` tempdir cleanup.
  *Justification & Scope*: These failures are pre-existing host limitations documented since Task 0.7, representing OS-level filesystem and process-lookup characteristics of Windows NTFS rather than application or security defects (the remaining 23 skipped tests are Postgres-gated suites without `LIP_TEST_POSTGRES_URL` set on the Windows host). On the target Linux release platform (`node:22.22.0` + `postgres:17-alpine`), 100% of test suites pass cleanly (**483 passed, 0 failed, 0 skipped**, verified in T018).
  *Limitations*: This exception is strictly limited to these six pre-existing Windows host failing suites. It does not waive failures on Linux, nor does it relax any protocol schema, typecheck, or vulnerability audit requirement. T017 is closed as an administrative exception, NOT as a successful Windows test execution.
- **Linux Docker Verification (T018)**: Executed in an isolated container environment (`node:22.22.0` + `postgres:17-alpine`). All 62 test files and **483/483 tests passed (0 failed, 0 skipped)** with active PostgreSQL 17 tenant isolation and advisory lease conformance. Initial execution under Vitest's default 5,000ms timeout experienced 5 timeout aborts due to container virtualization CPU scheduling during cold-start migrations; executing with `--test-timeout=30000` allowed all asynchronous operations to complete deterministically.
- **Code Coverage Results**: Verified on Linux with `@vitest/coverage-v8@4.1.12` with `--test-timeout=30000`: Statements: **86.53%** (Threshold: 85%), Branches: **77.70%** (Threshold: 75%), Functions: **93.67%** (Threshold: 85%), Lines: **87.98%** (Threshold: 85%).
- **Container Image & Cloud Runtime Boundaries**: The production Docker image (`Dockerfile`) built cleanly (`node:22-alpine` multi-stage build), and `npm audit --omit=dev` inside the image reported 0 vulnerabilities. However, a binary OS-package container filesystem scan (Trivy/Snyk/Docker Scout) was not completed due to external authentication requirements, and live long-running multi-tenant Cloud daemon deployment was not executed. These remain unverified release-pipeline gates.
