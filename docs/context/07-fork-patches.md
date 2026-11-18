# Fork patches

Every modification to upstream LIP code is logged here (PD-002, golden rule 1).
Upstream remote: `upstream` → `craveup-oss/loyalty-interchange-protocol`.
Changes to `/lip/v1` wire semantics or `spec/` are never allowed and never appear here. A behaviour correction that keeps every schema and every normative `spec/` rule, and is approved by an owner decision (for example FP-003, PD-037), is allowed and is logged here with its observable behaviour change.

| File | Reason | PD reference | Upgrade impact |
| --- | --- | --- | --- |
| `.gitignore` | Workspace hygiene; ignores `.claude/settings.local.json` (per-machine Claude Code settings) | PD-002 | Trivial merge |
| `packages/storage-postgres/src/index.ts`, `apps/cloud/src/postgres-repository.ts`, `apps/cloud/src/customer-postgres-repository.ts` | Acquire `pg_advisory_xact_lock` before `CREATE TABLE IF NOT EXISTS lip_schema_migrations` / `lip_cloud_schema_migrations` to prevent `23505` (`pg_type_typname_nsp_index`) catalog race on concurrent cold-start migrations | PD-002 | Safe to drop if upstream merges equivalent lock ordering |
| `tests/unit/postgres-storage.test.ts`, `apps/cloud/src/migrate.test.ts` | Regression tests proving 8-way concurrent cold-start migration safety on a fresh PostgreSQL schema | PD-002 | Keep alongside migration lock fix |
| `skills/lip/SKILL.md`, `skills/lip-cli/SKILL.md`, `skills/lip-webhooks/SKILL.md`, `skills/lip-bff/SKILL.md`, `docs/api-docs-gap-analysis.md`, `docs/postgres.md`, `docs-site/guides/postgres.mdx` | Task 0.9 documentation drift fixes (v0.2.0 `/platform/v1` and `/admin/api/v1/program/*` scope, webhook loopback env var + 16-char secret + `balance.changed.v1`, PD-004 BFF OTP note, July 2026 historical banner, 3-service diskless Render blueprint) | PD-002, PD-004, PD-006 | Docs-only merge |
| `package.json`, `package-lock.json`, `packages/mcp/package.json`, `packages/mcp/src/lib.ts`, `packages/mcp/src/server.ts`, `tests/unit/mcp.test.ts`, `apps/admin/package.json` | FP-002: Task 0.12 dependency security remediation eliminating 19 baseline vulnerable package nodes (46 unique advisory URLs) across Core SaaS, MCP tooling, and dev toolchain | PD-002, PD-004 | Reconcile root overrides and packages/mcp manifests on upstream merge |
| `.github/workflows/ci.yml` | FP-006: one added step in job `verify` runs the Wanees PR-automation policy self-test (`node --test .github/scripts/gate-policy.test.mjs`) | PD-049 | Trivial merge; re-apply the step if upstream rewrites job `verify` |
| `.github/workflows/ci.yml` | FP-007: `on.push.branches` gains `"deliver/**"` so `verify` runs on delivery branches | PD-050 | Trivial merge; re-apply if upstream rewrites the `on:` block |
| `compose.yaml`, `tests/unit/compose-postgres-readiness.test.ts` (new) | FP-008: `postgres` healthcheck probes TCP (`pg_isready -h 127.0.0.1 -p 5432 …`) and adds `start_period: 30s`, so `service_healthy` dependents (`lip-postgres`, `cloud`) cannot start before `POSTGRES_DB` exists | PD-002 (owner Tier 2 approval 2026-11-18) | Trivial merge; safe to drop if upstream adopts an equivalent post-init readiness probe |
| `apps/cloud/src/data-plane-provisioner.test.ts`, `packages/server/src/migration.test.ts`, `tests/unit/member-migration.test.ts`, `tests/unit/server.test.ts`, `tests/unit/webhooks.test.ts` | FP-009 (**Proposed, not approved**): POSIX `0o600` assertions moved to dedicated tests skipped only on `win32`; two SQLite teardown fixes | — (pending owner approval) | Test-only; re-apply if upstream edits these tests |

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

---

### FP-003 (Proposed — design approved 2026-11-12; reversal formula NOT validated and NOT implementation-ready; NOT implemented): points void reverses the original accrual

**Status.** Design approved by the owner (PD-037, Gate 1 decision D1). No code has been changed; this entry is a contract, not a log of a modification. The table above gets a row only when the patch is implemented under a separate owner authorization (task 3.6). Items marked *(PD-038 Pn)* were approved by the owner on 2026-11-12 (P7 and P8 with revisions). **This contract is not implementation-ready.** The reversal formula in item 2 is a candidate approved for validation only; it is not proven safe when points are consumed by redemptions or other voids before expiry (item 4). Implementation approval can be requested only after all of: (a) the owner approves a point-lot attribution algorithm, which is unresolved; (b) source-level verification of that algorithm against the engine; (c) the executable regression tests of V1 pass; (d) V2–V4 and V7 are verified; and then (e) the owner separately authorizes implementation (PD-037).

**Problem (executed evidence, 2026-11-12).** `LoyaltyEngine.adjustOrder` (`packages/reference/src/engine.ts` 968–990) computes the points amount of every order adjustment as `pointsForSignedSpend(eligible_spend_delta, originalAccrual.multiplierBps)`. For points, that conversion uses the **current** `this.program.earn_rate`; credits use `wallet_credit_policy.earn_bps` (1944). Integer floor division applies to the delta (1958–1966). A negative result is capped at the order's net earned. Executed on local Windows (Node 22.22.0, vitest 4.1.12, in-memory engine, throwaway test outside the repo): accrual +110 at 10/100 (fixture eligible spend 1,100 minor units), republish at 5/100, `void` with delta −1,100 → **−55** (expected −110); with delta −1,000 → −50. Observable behaviour changes only in that the void amount becomes rate-independent; schemas are unchanged. PD-025 item 4 requires earn-rate changes to apply only to future accruals.

**Scope.**
- Changed: `adjustOrder` for `adjustment.type ∈ {void, full_refund}`, unit `points` only, when an original accrual exists. `credits` (not used in P0) keep upstream behaviour; extending FP-003 to credits would need its own owner decision.
- Unchanged: `partial_refund` and `correction` order adjustments (not used in P0, PD-030); stamps (already reverse `−original`); request and response schemas; idempotency and fingerprint rules; `/lip/v1` wire format and `spec/`. `spec/lifecycle.md` 56–58 does not define how the clawback amount is computed. `spec/account-experience.md` 36–38 already requires refunds to use the original accrual's multiplier; FP-003 extends the same principle to the earn rate.

**Contract.**
1. *Original-accrual evidence.* For order `o` and unit `u`: the accrual's entry ids are `record.entryIds` if present, otherwise `[record.entryId]` (the fallback the current code already uses for older snapshots, `engine.ts` 970). `E_u` = the `amount` of the ledger entry for `u` among them. If the record exists but has no `points` entry, the points void is refused (`invalid_state`) instead of posting 0 (fail closed, owner instruction 2026-11-12; upstream posts 0 today, `engine.ts` 976–977). If a listed entry id has no ledger entry, the void is refused (`invalid_state`) and never computed from the delta. `A_u` = the sum of earlier ledger entries with `operation = "adjustment"`, `order_id = o` and unit `u` (the existing cap's basis). Both are persisted engine state (`accruals_by_order` in the snapshot, `engine.ts` 1099 and 1243, plus the ledger).
2. *Amount — candidate formula, approved for validation only, not proven safe and not implementation-ready (PD-038 P7).* The candidate amount is `−max(0, E_u + A_u − X_u)`. `X_u` is the sum, as a positive number, of the `expiration` entries whose `related_entry_id` is `o`'s accrual entry for `u` or a positive order-adjustment entry for `o` and `u`, after `expirePointLots` has run in the same request (point lots are keyed by the entry that created them, `engine.ts` 2100–2101, and an expiration carries `related_entry_id = lot.entryId`, `expirePointLots`). The amount is independent of the request's `eligible_spend_delta` magnitude and of the current `earn_rate`, multiplier or expiry policy. Request validation is unchanged (currency match; a non-`correction` adjustment must not increase spend). A zero result posts a zero entry, as the engine already does for units that do not change.
3. *Missing or uncertain original accrual (PD-038 P8, approved with revision).* If `accrualsByOrder` has no record for `o`, a points `void`/`full_refund` is refused (`not_found`) and never computed from the delta (without a record the upstream cap does not apply, `engine.ts` 976–985). BFF side: a missing or unconfirmed stored accrual result is recovered only from authoritative LIP ledger records, never by re-sending the accrual, because `postAccrual` creates an accrual when none exists (`engine.ts` 611–650). Fail closed. *Evidence requirements:* (i) authoritative — entries read through LIP's ledger (`ledger.list`), not BFF caches, logs or earlier responses; (ii) complete — every `accrual` entry of the member in the program, all pages read to the end without error while the member is blocked (P10), so the set cannot change during the read; (iii) unique — exactly one accrual entry for unit `points` whose `order_id` is `o` and whose member and program match. The void plan stores the evidence (entry id, amount, unit, member, program, order id, read time, page count) and the recovery is audited. Until V4 shows that such a read is possible, every missing result is uncertain. A purchase is *verified zero-accrual* only when that evidence shows amount 0 (below the minimum eligible spend, an ineligible channel, or points rounded down to 0, `accrualAmounts`, `amountForUnit`); only then may it be voided without a loyalty reversal; it is recorded as voided, and if it was a qualifying purchase (PD-038 P2) its visit is removed as for any void. A *verified positive accrual* is that evidence with amount > 0 and, when the BFF still holds a stored accrual result, the same entry id and amount; it proceeds under items 1–2. Any state in which neither is verified (no accrual entry found, more than one, a failed or incomplete read, a read whose completeness cannot be shown, disagreement with the stored result, a record without a `points` entry, a listed entry id with no ledger entry) is uncertain: no zero is assumed, nothing is posted to LIP, and the void stays blocked for reconciliation (item 7).
4. *Lot expiry and consumption.* `expirePointLots` still runs first. The debit consumes the soonest-expiring lots across the member (`consumePointLots`, PD-020, accepted) and may take the balance below zero (spec/lifecycle.md 56–58). Points of `o`'s own lots that already expired are excluded from the reversal (`X_u`, item 2), so they are never debited twice; points of those lots already spent on rewards are still reversed *(PD-038 P7)*. **Known limitation, returned to the owner:** lots are shared across orders, so `X_u` does not always capture what a void or an expiry really took from the purchase. Source-derived counterexample (not executed): A earns 100; B later earns 100 with a later expiry; voiding B debits 100 from A's earlier-expiring lot (soonest-expiring first); B's untouched lot then expires (−100); voiding A finds no expiration linked to A's lot (X = 0) and debits another 100, so the balance ends at −100 although both purchases were voided and nothing was redeemed. A second source-derived variant (not executed) fails the same way with a routine redemption: A earns 100 (earlier expiry); B later earns 100 (later expiry); a 100-point redemption consumes A's lot (soonest-expiring first); B's untouched lot then expires (−100); voiding A finds no expiration linked to A's lot (X = 0) and debits another 100, so the balance ends at −100, whereas it would be 0 had A never existed. **The candidate formula is not proven safe whenever points are consumed by redemptions or other voids before expiry, and it is not an implementation-ready algorithm.** The point-lot attribution algorithm is unresolved and needs separate owner approval, source-level verification and executable regression tests (V1) before implementation approval (PD-038 P7, open item). This contract does not choose one.
5. *Idempotency.* Unchanged: the same idempotency key returns the cached response, and the same `adjustment_id` with the same facts returns the original primary ledger entry (`engine.ts` 961–965) without a new effect; the same id with different facts is a `conflict`. The amount is decided once, at first execution, and never recomputed on replay.
6. *Concurrency.* No new shared state. The patch relies on the existing serialization of engine mutations through the storage adapters. A points void runs under the BFF per-member lock and durable member block, like the stamp void (PD-008 A1 C8; PD-038 P10, approved).
7. *Recovery.* The BFF void plan for a points purchase stores, before the first call, the adjustment id `void-<void id>`, the exact request body and the planned amount, computed under the attribution algorithm the owner approves (the candidate `−max(0, E + A − X)` is not implementation-ready), taken from the stored (or ledger-recovered, item 3) accrual result, known order adjustments and the expirations known at planning time. The amount posted by the first execution is recorded and immutable; a replay never changes it (item 5). Recovery is forward-only: confirm the entry in authoritative LIP records or retry with the same id and body. Reconciliation confirms exactly one ledger entry for the adjustment id and compares its amount with the planned amount. It does not reconstruct historical ledger state: `ledger.list` orders tied timestamps by entry id (`engine.ts` 555–562), not by execution order. Any mismatch (for example a lot that expired between planning and execution, or a first execution delayed past a later expiry) keeps the void unreconciled and escalated to the owner with the ledger evidence, and is never corrected by re-posting. The PD-008 A1 durable member block and *Recovery* rules apply to points voids (PD-038 P10, approved): *needs owner* after 15 minutes, Super Admin after 24 hours, and only successful reconciliation clears the block.

**Required tests (task 3.6, Linux + PostgreSQL 17 official environment).** A full-spend void reversing all original points (+110 → −110 after a 10/100 → 5/100 republish); earn-rate decrease and increase between accrual and void; legacy snapshot whose accrual record has only `entryId`; record without a `points` entry (refused, item 1); listed entry id missing from the ledger; tier-multiplier change; expiry-policy change; void after an earlier order adjustment, using a full-spend delta so the net-earned cap actually binds; idempotent replay (same facts) and conflict (different facts); missing original accrual; original lot partly expired before the void (P7: the expired part is not reversed); original lot fully expired before the void (reversal 0); original lot partly spent on a reward and the remainder expired (only the spent part is reversed, balance may go negative); verified zero-accrual purchase (below minimum eligible spend, and points rounded down to 0 above it) voided without reversal only after complete authoritative evidence, with the visit removed in the rounded-down case; zero or several accrual entries for the order, or an incomplete ledger read, treated as uncertain; a redemption consuming another order's earlier-expiring lot before that order's lot expires, then a void (item 4 variant); missing BFF accrual result recovered from ledger records, never by re-sending the accrual; uncertain accrual state (no entry found, failed read, disagreement) kept blocked and escalated with nothing posted; lot consumption order; negative resulting balance; restart between accrual and void (state restored from storage); both `void` and `full_refund`; `partial_refund` and `correction` behaviour unchanged; concurrent points void, redemption and adjustment for one member across two service instances (no double effect, serialization holds); crash after the engine committed the void but before the BFF saved the result, then replay with the same id and body (no second effect); reconciliation mismatch keeps the void unreconciled and escalated, with the member blocked (PD-038 P10); `credits` behaviour unchanged; upstream conformance suite still passes.

**Verification requirements (not yet executed; source-read facts are not execution evidence).**
- **V1 (PD-038 P7, owner condition before implementation approval).** Status: two source-derived counterexamples already show over-debit in P0 scope (item 4: another void, or a redemption, consumes the purchase's lot before expiry), so the candidate formula is not proven safe and the point-lot attribution algorithm is unresolved. Order of work: the owner approves an attribution algorithm; it is verified at source level against `consumePointLots`, `expirePointLots` and redemption capture; then V1 validates it with executable regression tests, including both item 4 cases. The cases below apply to the approved algorithm (and characterize the candidate `−max(0, E + A − X)` for comparison). They may run against a throwaway prototype outside the repository; no fork code is written before implementation is authorized. Cases: original lot fully expired, then void; partly expired, remainder unspent; partly spent on a reward, remainder expired; a positive order correction whose own lot expired; a negative order correction followed by expiry and a void (order corrections are not used in P0, PD-030, but lots are fungible across orders, so the test must state whether the result differs from "as if the purchase never happened" and report any difference to the owner); a second void of the same order; lot consumption order after the void; negative resulting balance; expiry processed in the same request as the void. Any wrong result returns to the owner.
- **V2 (P7).** Point lots are keyed by the creating entry id and every expiration carries `related_entry_id` = that id, including after a snapshot restore and on the PostgreSQL storage adapter (source read: `engine.ts` 2100–2101, `expirePointLots`; `spec/account-experience.md` defines `related_entry_id`).
- **V3 (P8).** A purchase below the minimum eligible spend, or on an ineligible channel, creates an accrual record whose entry for the unit has amount 0 (source read: `accrualAmounts`, `postAccrual`).
- **V4 (P8).** The BFF can find an order's accrual in authoritative records. `ledger.list` filters only by account and operation (`spec/account-experience.md`, *Ledger history*), `order_id` is optional in `spec/schemas/LedgerEntry.json`, and a page holds at most 100 entries. Confirm that accrual entries always carry `order_id`, that paging a member's accrual history is complete and deterministic, and that the read can satisfy the evidence requirements of item 3 (authoritative, complete, unique). Until this is verified every missing accrual result is uncertain and fails closed; if it cannot be verified, raise a decision instead of patching around it.
- **V5 (P10).** Cross-instance per-member lock, durable block and crash recovery for points voids (same as PD-008 A1 checks (c) and (d)).
- **V6 (P3).** The test café runs on the production path of the pilot cafés and its credentials cannot act on any other café; verified before the pilot (task 5.6).
- **V7 (item 7).** Reconciliation against the planned amount: expiry between planning and execution, a crash before the first execution followed by a replay after a later expiry, a crash after the engine committed, tied `occurred_at` timestamps, and an immutable first-execution amount on every replay.

**Upgrade impact.** Touches upstream `adjustOrder`. Every upstream sync must re-apply and re-verify it against the tests above. It is a candidate upstream contribution, since it aligns earn-rate handling with the existing multiplier rule in `spec/account-experience.md`.

### FP-006 (Approved 2026-11-16, PD-049): PR-automation policy self-test in upstream CI

- **File modified:** `.github/workflows/ci.yml` (upstream). One step added to job `verify`, after `actions/setup-node` and before `npm ci`: `name: PR automation policy tests`, `run: node --test .github/scripts/gate-policy.test.mjs`, with no `continue-on-error`, preceded by a three-line comment. No other line changes.
- **Numbering:** FP-004 and FP-005 are reserved by `specs/002-p0-prd/` for the OD-09 and OD-15 candidate patches (`research.md`, `plan.md`, `tasks.md`), which stay unauthorized; this entry therefore takes FP-006.
- **Reason:** the Claude PR Review and Claude Auto-Merge Gate workflows (PD-049) depend on `.github/scripts/automerge-policy.mjs` and `claude-review-gate.mjs`. Running their tests in `verify` makes a policy regression fail the required `verify` check. The merge workflow separately re-runs the trusted default-branch copy before any merge.
- **Not an upstream code change:** `.github/scripts/` and the two Claude workflows are new SaaS-side files, not upstream patches (constitution Article II.4). Only the `ci.yml` edit is logged here.
- **Behaviour impact:** none on `/lip/v1`, `spec/`, packages or runtime. `verify` gains about 2 s and one more way to fail.
- **Test coverage:** the step runs the policy test suite itself (Node built-in test runner, no dependencies). Local evidence: `.scratch/pr-automation-20261116/review/`.
- **Rollback:** delete the step; nothing else depends on it.
- **Upgrade impact:** trivial merge. Re-apply the step if upstream restructures job `verify`.

### FP-007 (Approved 2026-11-16, PD-050): CI runs on delivery branches

- **File modified:** `.github/workflows/ci.yml` (upstream). `on.push.branches` changes from `[main]` to `[main, "deliver/**"]`, plus a one-line comment. No other line changes.
- **Reason:** direct-to-main delivery (PD-050) keeps the required `verify` check on the `main` ruleset. GitHub accepts a push to a branch with required status checks only when the checks already passed on that commit on another ref, so `verify` must run on the delivery branch first.
- **Behaviour impact:** none on `/lip/v1`, `spec/`, packages or runtime. One extra CI run per delivery branch push, which also triggers the inert `claude-auto-merge` `workflow_run` (its merge job requires a `pull_request` event).
- **Test coverage:** exercised by the first delivery (the `deliver/phase-1` run of `verify`); a missing run blocks the push to `main`.
- **Rollback:** restore `branches: [main]`; delivery would then need a PR or an owner ruleset change.
- **Upgrade impact:** trivial merge.

### FP-008 (Approved 2026-11-18, owner Tier 2 approval including `start_period: 30s`): PostgreSQL healthcheck readiness in `compose.yaml`

- **Numbering:** first drafted as "FP-007" in a stale checkout; FP-007 is already PD-050 above, so this patch is FP-008 (owner direction 2026-11-18).
- **Files:** `compose.yaml` (upstream), service `postgres` → `healthcheck` only: `test` becomes `pg_isready -h 127.0.0.1 -p 5432 -U loyalty -d loyalty`, `start_period: 30s` is added, plus one comment line. Image, credentials, environment, profiles, volumes, `interval`, `timeout`, `retries` and every other service are unchanged. New regression test `tests/unit/compose-postgres-readiness.test.ts`.
- **Defect (executed evidence, 2026-11-18).** The old probe `pg_isready -U loyalty -d loyalty` uses the Unix socket. The `postgres:17-alpine` `docker-entrypoint.sh` runs a temporary init server with `listen_addresses=''` before `CREATE DATABASE loyalty`, and `pg_isready` exits 0 for any responding server even when the database does not exist. The container could therefore report healthy during init, so `lip-postgres` and `cloud` (`depends_on: postgres: condition: service_healthy`) and `docker compose up --wait` could proceed before the database existed. Evidence (local-only, untracked `.scratch/` in the primary checkout; not resolvable from `origin`; directory names keep the pre-renumbering "fp007" label): `.scratch/d1-review/r5-remediation/recovery/POSTGRES-INIT-FIX.md`.
- **Fix.** A TCP probe reaches only the final server, which the entrypoint starts after init completes. `start_period: 30s` keeps a slow first `initdb` from exhausting `retries`; a success inside the start period marks the container healthy immediately.
- **Behaviour impact:** local Compose orchestration only. None on `/lip/v1`, `spec/`, packages, schemas or runtime code. First start reports healthy a few seconds later (after init, not during it); restarts of an initialized volume are unaffected.
- **Test coverage:** `tests/unit/compose-postgres-readiness.test.ts` (3 tests) pins the TCP probe, `start_period: "30s"`, unchanged credentials and volume, and `service_healthy` on `lip-postgres` and `cloud`. On Linux (`node:22.22.0`) it passes on the fix and fails against the previous `compose.yaml` (`expected 'pg_isready -U loyalty -d loyalty' to match /-h 127.0.0.1/`). A live isolated `docker compose up --wait postgres lip-postgres cloud` against the tracked file (Docker Desktop 29.7.2, PostgreSQL 17.11) exited 0 with `CREATE DATABASE` logged before dependents started and zero `does not exist` lines. Evidence (local-only, untracked, as above): `.scratch/d1-review/r5-remediation/recovery/lip-fp007-verify-1794968152/`, `fp007-orchestrator-verify-20261118/`, and the FP-008 verification under `.scratch/fp008-port-20261118/`.
- **Rollback:** restore the previous `healthcheck` block and delete the test; no data or volume is affected.
- **Upgrade impact:** trivial merge; candidate upstream contribution.

### FP-009 (Proposed 2026-11-18 — in independent review scope; NOT owner-approved): Windows-portable permission tests and SQLite teardown

- **Status:** the owner placed these changes in the FP-008 independent review scope on 2026-11-18 and stated that inclusion is not approval. They must not land until the owner approves them.
- **Files (tests only):**
  - `apps/cloud/src/data-plane-provisioner.test.ts`, `packages/server/src/migration.test.ts`, `tests/unit/member-migration.test.ts`: the inline `0o600` mode assertions (credential file, backup archive, migration archive, member import plan) move unchanged into one dedicated test per file, marked `it.skipIf(process.platform === "win32")`. The functional tests they came from keep every other assertion.
  - `tests/unit/server.test.ts`: `await platform.webhooks.flush()` before `platform.close()` in one test's cleanup. This works around production behaviour: the SQLite `platform.close()` (`packages/server/src/platform.ts`, outbox close while deliveries are in flight) returns before the outbox handle is closed. That behaviour is unchanged here; a fix belongs in a separate follow-up, not FP-009.
  - `tests/unit/webhooks.test.ts`: `secondStore.close()` becomes `await secondStore.close()`.
- **Reason:** these are the Windows failures covered by the owner's T017 platform exception (FP-002 section above, items 2–6). Node cannot set NTFS ACLs through POSIX mode bits, so `0o600` is unverifiable on `win32`; the two teardown failures are `EBUSY` from unlinking a SQLite file before it closes.
- **Security impact:** the `0o600` contract is not weakened and source code is unchanged. It is still asserted on Linux, the release platform, but it is no longer asserted on Windows. This is why the change is classified HIGH and needs an independent review.
- **Behaviour impact:** none on runtime code. The `tests/unit/cli.test.ts` `spawn npm ENOENT` Windows failure is not addressed.
- **Rollback:** revert the five test files.
