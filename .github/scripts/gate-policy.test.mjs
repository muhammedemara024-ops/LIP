// Run: node --test .github/scripts/gate-policy.test.mjs
// Mocked GitHub event/API data only; no network.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate, renderReport, parseFilesTsv } from "./claude-review-gate.mjs";
import {
  checkEligibility, verifyBranchRules, verifyChecks, verifyReviewAttempts, verifyReviews, decide, deniedHits, notAllowed, pathPolicy, isCheckboxOnlyPatch,
  normalizePr, parseLines, GITHUB_ACTIONS_APP_ID, REQUIRED_CHECKS,
} from "./automerge-policy.mjs";

const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);

// ---------- Review gate (claude-review-gate.mjs) ----------
const finding = (o = {}) => ({ severity: "low", kind: "potential_risk", category: "correctness", file: "a.ts", title: "t", evidence: "e", recommendation: "r", ...o });
const CHANGED = ["a.ts", "docs/x.md"];
const good = (o = {}) => JSON.stringify({ head_sha: SHA, review_complete: true, files_reviewed: CHANGED, verdict: "PASS", summary: "ok", findings: [], ...o });
const run = (o = {}) => evaluate({ structuredOutput: good(), conclusion: "success", outcome: "success", expectedHeadSha: SHA, liveHeadSha: SHA, changedFiles: CHANGED, ...o });

test("gate: clean PASS", () => assert.equal(run().pass, true));
test("gate: low/medium findings do not block", () => assert.equal(run({ structuredOutput: good({ findings: [finding(), finding({ severity: "medium" })] }) }).pass, true));
for (const sev of ["critical", "high"])
  for (const kind of ["confirmed_defect", "potential_risk"])
    test(`gate: ${sev}/${kind} blocks even if verdict PASS`, () => assert.equal(run({ structuredOutput: good({ findings: [finding({ severity: sev, kind })] }) }).pass, false));
test("gate: security-class findings block at ANY severity; other classes only at high/critical", () => {
  for (const category of ["security", "tenant_isolation", "auth", "privacy", "secrets", "migration", "data_integrity", "dependency", "prompt_injection"])
    for (const severity of ["low", "medium"]) assert.equal(run({ structuredOutput: good({ findings: [finding({ category, severity })] }) }).pass, false, category + "/" + severity);
  for (const category of ["correctness", "tests", "style", "docs", "performance", "compatibility", "concurrency"])
    assert.equal(run({ structuredOutput: good({ findings: [finding({ category, severity: "medium" })] }) }).pass, true, category);
});
test("gate: unknown or missing category is malformed and blocks", () => {
  assert.equal(run({ structuredOutput: good({ findings: [finding({ category: "x" })] }) }).pass, false);
  assert.equal(run({ structuredOutput: good({ findings: [finding({ category: undefined })] }) }).pass, false);
});
test("gate: verdict FAIL blocks", () => assert.equal(run({ structuredOutput: good({ verdict: "FAIL" }) }).pass, false));
test("gate: unknown verdict blocks", () => assert.equal(run({ structuredOutput: good({ verdict: "MAYBE" }) }).pass, false));
test("gate: incomplete review blocks", () => assert.equal(run({ structuredOutput: good({ review_complete: false }) }).pass, false));
test("gate: action conclusion failure / missing blocks (auth failure, max-turns, no structured output)", () => {
  assert.equal(run({ conclusion: "failure" }).pass, false);
  assert.equal(run({ conclusion: "" }).pass, false);
  assert.equal(run({ conclusion: undefined }).pass, false);
});
test("gate: step outcome failure / cancelled / skipped / missing blocks (continue-on-error masking)", () => {
  for (const outcome of ["failure", "cancelled", "skipped", "", undefined]) assert.equal(run({ outcome }).pass, false, String(outcome));
});
test("gate: missing / garbled / non-object output blocks", () => {
  for (const structuredOutput of [undefined, "", "not json", "[]", "null", "42", '"PASS"']) assert.equal(run({ structuredOutput }).pass, false, String(structuredOutput));
});
test("gate: missing summary or findings blocks", () => {
  assert.equal(run({ structuredOutput: good({ summary: " " }) }).pass, false);
  assert.equal(run({ structuredOutput: good({ findings: undefined }) }).pass, false);
  assert.equal(run({ structuredOutput: good({ findings: {} }) }).pass, false);
});
test("gate: wrong head_sha in output blocks (forged/reused review)", () => assert.equal(run({ structuredOutput: good({ head_sha: OTHER }) }).pass, false));
test("gate: head SHA changed during review blocks", () => assert.equal(run({ liveHeadSha: OTHER }).pass, false));
test("gate: unreadable live head blocks", () => assert.equal(run({ liveHeadSha: "" }).pass, false));
test("gate: malformed expected SHA blocks", () => { assert.equal(run({ expectedHeadSha: "abc", structuredOutput: good({ head_sha: "abc" }), liveHeadSha: "abc" }).pass, false); });
test("gate: unknown severity / kind / malformed finding blocks", () => {
  assert.equal(run({ structuredOutput: good({ findings: [finding({ severity: "info" })] }) }).pass, false);
  assert.equal(run({ structuredOutput: good({ findings: [finding({ kind: "nit" })] }) }).pass, false);
  assert.equal(run({ structuredOutput: good({ findings: [{}] }) }).pass, false);
  assert.equal(run({ structuredOutput: good({ findings: [null] }) }).pass, false);
});
test("gate: report neutralizes mentions, HTML, links and table breaks in AI text", () => {
  const r = run({ structuredOutput: good({ summary: "@owner <img src=x> a|b\nnext ![x](y) [click](http://e)", findings: [finding({ title: "@team" })] }) });
  const md = renderReport(r, SHA);
  assert.ok(!/@owner|@team/.test(md));
  assert.ok(!md.includes("<img"));
  assert.ok(!md.includes("![x]") && !md.includes("[click]("));
  assert.ok(md.includes("a\\|b"));
});
test("gate: every changed path (including rename sources) must be in files_reviewed", () => {
  assert.equal(run({ structuredOutput: good({ files_reviewed: ["a.ts"] }) }).pass, false);
  assert.equal(run({ structuredOutput: good({ files_reviewed: undefined }) }).pass, false);
  assert.equal(run({ changedFiles: null }).pass, false);
  assert.equal(run({ changedFiles: [] }).pass, false);
  assert.equal(run({ structuredOutput: good({ files_reviewed: [...CHANGED, "extra.ts"] }) }).pass, true);
  assert.deepEqual(parseFilesTsv("modified\ta.ts\t\nrenamed\tnew.ts\told.ts\n"), ["a.ts", "new.ts", "old.ts"]);
  assert.equal(parseFilesTsv("garbage-without-tabs\n"), null);
});

const gateCli = (env) => spawnSync(process.execPath, [fileURLToPath(new URL("./claude-review-gate.mjs", import.meta.url))], { env: { PATH: process.env.PATH, ...env }, encoding: "utf8" });
test("gate CLI: exits 0 on pass and 1 on block, missing files.tsv or empty environment", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-"));
  const tsv = join(dir, "files.tsv");
  writeFileSync(tsv, "modified\ta.ts\t\nadded\tdocs/x.md\t\n");
  const env = { STRUCTURED_OUTPUT: good(), CLAUDE_CONCLUSION: "success", CLAUDE_OUTCOME: "success", EXPECTED_HEAD_SHA: SHA, LIVE_HEAD_SHA: SHA, FILES_TSV: tsv };
  assert.equal(gateCli(env).status, 0);
  assert.equal(gateCli({ ...env, CLAUDE_OUTCOME: undefined }).status, 1);
  assert.equal(gateCli({ ...env, FILES_TSV: join(dir, "missing.tsv") }).status, 1);
  assert.equal(gateCli({}).status, 1);
  rmSync(dir, { recursive: true, force: true });
});

// ---------- Merge policy (automerge-policy.mjs) ----------
const REPO = "o/LIP";
const PR_NUMBER = 7;
const BRANCH = "feat/wanees-phase-2";
const ROUTINE = "apps/web/src/styles/menu.css";
const rawPr = (o = {}) => ({
  number: PR_NUMBER, state: "open", draft: false, author_association: "OWNER", changed_files: 1,
  mergeable: true, mergeable_state: "clean",
  base: { ref: "main" }, head: { ref: BRANCH, sha: SHA, repo: { full_name: REPO } }, ...o,
});
const pr = (o = {}, head = {}) => normalizePr(rawPr({ ...o, head: { ref: BRANCH, sha: SHA, repo: { full_name: REPO }, ...head } }));
const files = (...names) => names.map((filename) => ({ filename, previous_filename: null, status: "modified" }));
const elig = (o, h, fl = files(ROUTINE)) => checkEligibility(pr({ changed_files: fl?.length, ...o }, h), REPO, fl).eligible;

test("eligibility: eligible phase PR", () => assert.equal(elig(), true));
test("eligibility: non-phase branch", () => {
  for (const ref of ["feat/other", "feat/wanees-phase-2-extra", "x/feat/wanees-phase-2", "feat/wanees-phase-", "feat/wanees-phase-2\n"]) assert.equal(elig({}, { ref }), false, ref);
});
test("eligibility: fork / untrusted actor / draft / wrong base / closed", () => {
  assert.equal(elig({}, { repo: { full_name: "evil/LIP" } }), false);
  assert.equal(elig({}, { repo: null }), false);
  for (const author_association of ["CONTRIBUTOR", "FIRST_TIME_CONTRIBUTOR", "NONE", undefined]) assert.equal(elig({ author_association }), false, String(author_association));
  assert.equal(elig({ draft: true }), false);
  assert.equal(elig({ draft: undefined }), false);
  assert.equal(elig({ base: { ref: "dev" } }), false);
  assert.equal(elig({ state: "closed" }), false);
});
test("eligibility: empty, oversized, malformed or incomplete file list blocks", () => {
  assert.equal(elig({}, {}, []), false);
  assert.equal(elig({}, {}, null), false);
  const many = (n) => Array.from({ length: n }, (_, i) => ({ filename: `apps/web/src/styles/f${i}.css`, status: "modified" }));
  assert.equal(elig({ changed_files: 2899 }, {}, many(2899)), true);   // control: under the cap and complete
  assert.equal(elig({ changed_files: 2900 }, {}, many(2900)), false);
  assert.equal(elig({}, {}, [{ filename: "" }]), false);
  assert.equal(elig({ changed_files: 2 }, {}, files("apps/web/src/styles/a.css", "apps/web/src/styles/b.css")), true);   // control
  assert.equal(elig({ changed_files: 3 }, {}, files("apps/web/src/styles/a.css", "apps/web/src/styles/b.css")), false); // pagination lost a page
  assert.equal(elig({ changed_files: undefined }, {}, files(ROUTINE)), false);
});
test("paths: governance / security / schema / contract / build paths block, anywhere in the tree", () => {
  for (const f of [
    ".github/workflows/ci.yml", ".github/scripts/automerge-policy.mjs", ".github/CODEOWNERS", "AGENTS.md", "CLAUDE.md", "GOVERNANCE.md",
    "apps/web/AGENTS.md", "packages/x/CLAUDE.md", "apps/web/.claude/settings.json", "apps/web/.mcp.json",
    ".specify/memory/constitution.md", ".specify/templates/overrides/tasks-template.md", ".agents/rules/02-security-and-tenant-isolation.md",
    ".claude/settings.json", ".delegate/config.json", ".gitattributes", ".gitmodules", ".mcp.json", "mcp.json", "apps/web/.env.local",
    "docs/context/README.md", "docs/context/06-roadmap.md", "docs/context/01-decisions.md", "docs/agents/domain.md",
    "spec/core.md", "specs/002-p0-prd/spec.md", "specs/002-p0-prd/plan.md", "specs/002-p0-prd/contracts/bff.md",
    "package.json", "package-lock.json", "apps/bff/package.json", ".npmrc", "vitest.config.ts", "apps/admin/vite.config.ts",
    "tsconfig.base.json", "tsconfig.json", "apps/web/tsconfig.json", "packages/server/tsconfig.build.json",
    "scripts/check-docs.mjs", "Dockerfile", "apps/web/Dockerfile", "render.yaml", "compose.yaml", "deploy/x.yaml",
    "apps/cloud/migrations/007_x.sql", "apps/bff/migrations/bff/001_init.sql", "packages/storage-postgres/migrations/009_x.sql", "apps/web/src/seed.sql",
    "packages/storage-postgres/src/index.ts", "apps/cloud/src/postgres-repository.ts", "apps/cloud/src/customer-postgres-repository.ts",
    "apps/cloud/src/billing.ts", "apps/cloud/src/migrate.ts", "packages/server/src/webhooks.ts", "packages/server/src/migration.ts",
    "packages/identity/src/x.ts", "packages/server/src/access-control.ts", "packages/protocol/src/types.ts", "packages/reference/src/engine.ts",
    "apps/bff/src/otp-service.ts", "apps/web/src/session.ts", "packages/x/tenant-isolation.test.ts", "apps/bff/src/csrf.cjs",
    "apps/bff/src/auth/guards.ts", "apps/bff/src/tenant-context.ts", "apps/bff/src/permissions.ts", "apps/bff/src/hmac.ts",
    "apps/bff/src/ledger/post.ts", "apps/web/src/consent-banner.tsx", "packages/sdk/src/webhooks.ts"]) {
    assert.equal(elig({ changed_files: 2 }, {}, files(ROUTINE, f)), false, f);
    if (f.startsWith("apps/web/")) assert.ok(deniedHits([f]).length > 0, f);   // denied by rule, not only by the code allowlist
  }
  assert.equal(elig({}, {}, [{ filename: "apps/web/src/moved.ts", previous_filename: ".github/workflows/ci.yml", status: "renamed" }]), false);
});
test("paths: anything outside the allowlist blocks (fail-closed for new top-level areas)", () => {
  for (const f of ["landing/index.html", "llms.txt", "PLAN.md", "skills/lip/SKILL.md", "newdir/x.ts", ".scratch/x.md", "coverage/x.json"])
    assert.equal(elig({ changed_files: 1 }, {}, files(f)), false, f);
  assert.deepEqual(notAllowed(["apps/web/src/styles/a.css", "apps/web/public/logo.png", "apps/web/messages/ar.json", "apps/web/src/i18n/en.json",
    "apps/web/src/menu.test.tsx", "packages/server/src/campaigns.test.ts", "tests/unit/x.test.ts", "docs/guide.md", "docs-site/a.mdx", "README.md"]), []);
});
test("paths: no apps/web code auto-merges: Next.js server-side or uncertain code needs a human (PD-049, R3-2)", () => {
  for (const f of ["apps/web/app/api/menu/route.ts", "apps/web/src/app/api/x/route.ts", "apps/web/app/page.tsx", "apps/web/app/layout.tsx",
    "apps/web/src/app/menu/page.tsx", "apps/web/src/actions.ts", "apps/web/src/lib/server/menu.ts", "apps/web/middleware.ts", "apps/web/instrumentation.ts",
    "apps/web/src/components/MenuCard.tsx", "apps/web/src/hooks/useMenu.ts", "apps/web/src/menu.js", "apps/web/pages/index.tsx", "apps/web/src/pages/api/x.ts",
    "apps/web/scripts/build.mjs", "apps/web/public/icon.svg", "apps/web/public/index.html", "apps/web/content/menu.mdx", "apps/web/README.md",
    "apps/web/src/menu.json", "apps/web/src/styles/menu.less", "apps/web/src/__snapshots__/menu.test.tsx.snap", "apps/web/src/__mocks__/menu.ts", "apps/web/src/test-utils.ts"])
    assert.equal(elig({ changed_files: 1 }, {}, files(f)), false, f);
  // New test files inside a Next routing directory can become routes: never eligible.
  for (const f of ["apps/web/pages/menu.test.tsx", "apps/web/src/pages/menu.test.tsx", "apps/web/app/api/menu.test.ts"])
    assert.equal(elig({ changed_files: 1 }, {}, [added(f)]), false, f);
  // Non-executable apps/web files remain eligible.
  for (const f of ["apps/web/src/styles/menu.module.css", "apps/web/public/logo.png", "apps/web/public/fonts/cairo.woff2", "apps/web/messages/ar.json"])
    assert.equal(elig({ changed_files: 1 }, {}, files(f)), true, f);
  assert.equal(elig({ changed_files: 1 }, {}, [added("apps/web/src/components/menu-card.test.tsx")]), true);
  assert.deepEqual(deniedHits(["apps/web/src/menu.tsx", "apps/web/src/feedback-form.tsx", "apps/web/src/envelope-icon.tsx", "tests/unit/menu.test.ts", "docs/guide.md",
    "apps/web/src/feedbackForm.tsx", "apps/web/src/envelope.tsx", "apps/web/src/Monkey.tsx", "apps/web/src/KeyboardHints.tsx", "apps/web/src/MenuCard.tsx"]), []);
});
test("paths: the BFF (apps/bff) always needs a human merge (owner decision)", () => {
  for (const f of ["apps/bff/src/menu.ts", "apps/bff/src/postgres-pool.ts", "apps/bff/src/repository.ts", "apps/bff/src/migrate.ts", "apps/bff/README.md"])
    assert.equal(elig({ changed_files: 1 }, {}, files(f)), false, f);
});
test("paths: camelCase/PascalCase security words are denied; look-alikes are not", () => {
  for (const f of ["otpService.ts", "OtpInput.tsx", "useOtpInput.ts", "OTPInput.tsx", "dbPool.ts", "useDbPool.ts", "DBConnection.ts", "envLoader.ts",
    "rolesGuard.ts", "jwtVerify.ts", "rlsContext.ts", "piiFilter.ts", "apiKeyForm.tsx", "KeysList.tsx", "QRScanner.tsx", "OrderQrCode.tsx", "qr-scanner.tsx"])
    assert.ok(deniedHits(["apps/web/src/" + f]).length > 0, f);           // the keyword rule itself, not the allowlist
  for (const f of ["OtpInput.module.css", "qr-scanner.css"]) assert.equal(elig({ changed_files: 1 }, {}, files("apps/web/src/" + f)), false, f);
});
test("paths: storage, schema, merchant and ORM keywords are denied", () => {
  for (const f of ["apps/web/src/schema.ts", "apps/web/src/seed-data.ts", "apps/web/src/merchant-card.tsx", "apps/web/src/lip-client.ts", "apps/web/src/sqlHelpers.ts",
    "apps/web/prisma/x.ts", "apps/web/src/drizzle.ts", "apps/web/src/idempotency.ts", "apps/web/src/storage.ts"])
    assert.ok(deniedHits([f]).length > 0, f);
});
test("paths: upstream LIP code (packages/*, apps/cloud, apps/admin, apps/wallet, conformance) always needs a human merge", () => {
  for (const f of ["packages/server/src/server.ts", "packages/server/src/outbound-url.ts", "packages/server/src/campaigns.ts", "packages/server/src/customer-data.ts",
    "apps/cloud/src/server.ts", "apps/cloud/src/service.ts", "apps/cloud/src/credential-operations.ts", "apps/cloud/src/credential-operation-store.ts",
    "apps/cloud/src/operator-service.ts", "apps/cloud/src/customer-service.ts", "apps/cloud/src/database-configuration.ts", "apps/cloud/src/provisioning.ts",
    "apps/cloud/src/data-plane-provisioner.ts", "apps/cloud/src/deployment-verification-cli.ts", "apps/admin/src/App.tsx", "apps/wallet/src/index.ts",
    "packages/server/src/helpers/x.test.ts", "conformance/x.ts"])
    assert.equal(elig({ changed_files: 1 }, {}, files(f)), false, f);
  assert.equal(elig({ changed_files: 1 }, {}, [{ filename: "packages/server/src/campaigns.test.ts", status: "added" }]), true);
});
const added = (filename) => ({ filename, previous_filename: null, status: "added" });
test("paths: only NEW test files may auto-merge; modifying, renaming or removing an existing test needs a human", () => {
  assert.equal(elig({ changed_files: 1 }, {}, [added("tests/unit/menu.test.ts")]), true);
  assert.equal(elig({ changed_files: 1 }, {}, [added("apps/web/src/menu.test.tsx")]), true);
  for (const status of ["modified", "removed", "changed", "copied", undefined]) {
    assert.equal(elig({ changed_files: 1 }, {}, [{ filename: "tests/unit/menu.test.ts", status }]), false, String(status));
    assert.equal(elig({ changed_files: 1 }, {}, [{ filename: "packages/server/src/campaigns.test.ts", status }]), false, String(status));
    assert.equal(elig({ changed_files: 1 }, {}, [{ filename: "apps/web/src/menu.test.tsx", status }]), false, String(status));
  }
  assert.equal(elig({ changed_files: 1 }, {}, [{ filename: "apps/web/src/menu.ts", previous_filename: "apps/web/src/menu.test.ts", status: "renamed" }]), false);
  assert.equal(elig({ changed_files: 1 }, {}, [{ filename: "tests/unit/menu2.test.ts", previous_filename: "tests/unit/menu.test.ts", status: "renamed" }]), false);
  assert.equal(elig({ changed_files: 1 }, {}, [{ filename: "apps/web/src/styles/old-menu.css", status: "removed" }]), true);
});
test("paths: mandatory security/storage suites and shared fixtures can never auto-merge, even as added files", () => {
  for (const f of ["tests/conformance/postgres-lease-conformance.test.ts", "tests/conformance/http-lifecycle.test.ts", "tests/unit/postgres-storage.test.ts",
    "tests/unit/storage.test.ts", "tests/unit/engine.test.ts", "tests/unit/member-migration.test.ts", "packages/server/src/migration.test.ts",
    "tests/unit/tenant-isolation-live.test.ts", "tests/fixtures.ts", "tests/fixtures/orders.json", "tests/conformance/new-case.test.ts"]) {
    assert.equal(elig({ changed_files: 1 }, {}, files(f)), false, f + " modified");
    assert.equal(elig({ changed_files: 1 }, {}, [added(f)]), false, f + " added");
  }
});
test("paths: deny rules are case-insensitive and cover nested config/build/setup files", () => {
  for (const f of ["apps/web/.Claude/settings.json", ".GitHub/workflows/x.yml", "apps/web/Agents.md", "apps/bff/migrations/README.md",
    "apps/web/eslint.config.mjs", "apps/web/compose.yaml", "apps/web/next.config.mjs", "apps/web/vitest.setup.ts", "apps/web/playwright.config.ts",
    "apps/web/.eslintrc.json", "apps/web/src/setupTests.ts", "apps/bff/src/db/pool.ts", "apps/bff/src/env.ts", "apps/web/src/api-key-form.tsx"])
    assert.ok(deniedHits([f]).length > 0, f);
});
const tick = (patch, o = {}) => ({ filename: "specs/002-p0-prd/tasks.md", previous_filename: null, status: "modified", patch, ...o });
test("paths: specs/<feature>/tasks.md may only tick checkboxes", () => {
  const ok = "@@ -10,3 +10,3 @@\n context\n-- [ ] T001 Do a thing\n+- [x] T001 Do a thing\n more";
  assert.equal(isCheckboxOnlyPatch(ok), true);
  assert.equal(pathPolicy([tick(ok)]).ok, true);
  assert.equal(elig({ changed_files: 2 }, {}, [files(ROUTINE)[0], tick(ok)]), true);
  for (const bad of [
    "@@ -1 +1 @@\n-**Status**: draft\n+**Status**: Approved by owner",            // approval record edit
    "@@ -1 +1 @@\n-- [ ] T001 Do a thing\n+- [x] T001 Do another thing",        // text changed with tick
    "@@ -1 +1 @@\n-- [x] T001 Do a thing\n+- [ ] T001 Do a thing",              // un-tick
    "@@ -1 +1,2 @@\n-- [ ] T001 Do a thing\n+- [x] T001 Do a thing\n+- [ ] T999 New task", // added task
    "@@ -1,0 +1 @@\n+- [x] T999 New",                                            // pure addition
    "@@ -1 +1 @@\n-- [ ] Gate 2 approved by owner\n+- [x] Gate 2 approved by owner", // non-task checkbox (gate record)
    "@@ -1 +1 @@\n-- [ ] Tasks approved\n+- [x] Tasks approved",
    "", undefined])
    assert.equal(pathPolicy([tick(bad)]).ok, false, String(bad));
  assert.equal(pathPolicy([tick(ok, { status: "renamed", previous_filename: "specs/x/tasks.md" })]).ok, false);
  assert.equal(pathPolicy([tick(ok, { status: "added" })]).ok, false);
});

const PINNED = REQUIRED_CHECKS.map(({ context }) => ({ context, integration_id: GITHUB_ACTIONS_APP_ID }));
const rscRule = (p = {}) => ({ type: "required_status_checks", parameters: { strict_required_status_checks_policy: true, required_status_checks: PINNED, ...p } });
const goodRules = () => [rscRule(), { type: "pull_request", parameters: { required_review_thread_resolution: true } }];
const rulesOk = (o = {}) => verifyBranchRules({ rules: goodRules(), ...o }).ok;

test("rules: verified ruleset passes", () => assert.equal(rulesOk(), true));
test("rules: unavailable or empty rules block", () => {
  assert.equal(rulesOk({ rules: null }), false);
  assert.equal(rulesOk({ rules: [] }), false);
});
const PR_RULE = { type: "pull_request", parameters: { required_review_thread_resolution: true } };
test("rules: missing required check, unpinned check, non-strict, no PR rule block", () => {
  assert.equal(rulesOk({ rules: [rscRule({ required_status_checks: [PINNED[0]] }), PR_RULE] }), false);
  assert.equal(rulesOk({ rules: [rscRule({ required_status_checks: PINNED.map(({ context }) => ({ context })) }), PR_RULE] }), false);
  assert.equal(rulesOk({ rules: [rscRule({ strict_required_status_checks_policy: false }), PR_RULE] }), false);
  // PD-049 item 8: conversation resolution must be required on the pull_request rule (D6)
  for (const p of [undefined, {}, { required_review_thread_resolution: false }, { required_review_thread_resolution: "true" }])
    assert.equal(rulesOk({ rules: [rscRule(), { type: "pull_request", parameters: p }] }), false, JSON.stringify(p));
  assert.equal(rulesOk({ rules: [rscRule(), { type: "pull_request", parameters: { required_review_thread_resolution: true } }] }), true);
  assert.equal(rulesOk({ rules: [rscRule()] }), false);
});

const workflowRun = (path, o = {}) => ({ id: path.includes("ci.yml") ? 1000 : 2000, run_attempt: 1, path, event: "pull_request", head_sha: SHA, head_branch: BRANCH, head_repository: { full_name: REPO },
  check_suite_id: path.includes("ci.yml") ? 100 : 200, pull_requests: [{ number: PR_NUMBER, base: { ref: "main" } }], ...o });
const checkRun = (name, o = {}) => ({ id: name === "verify" ? 1 : 2, name, head_sha: SHA, status: "completed", conclusion: "success", started_at: "2026-11-16T10:00:00Z",
  app: { id: GITHUB_ACTIONS_APP_ID }, check_suite: { id: name === "verify" ? 100 : 200 }, ...o });
const goodWorkflowRuns = () => [workflowRun(".github/workflows/ci.yml"), workflowRun(".github/workflows/claude-pr-review.yml")];
const goodCheckRuns = () => [checkRun("verify"), checkRun("Claude PR Review")];
const checksOk = (o = {}) => verifyChecks({ expectedSha: SHA, pr: pr(), repo: REPO, checkRuns: goodCheckRuns(), workflowRuns: goodWorkflowRuns(), ...o }).ok;
const reviewRun = (o) => [workflowRun(".github/workflows/ci.yml"), workflowRun(".github/workflows/claude-pr-review.yml", o)];

test("checks: both trusted checks succeeded on the SHA", () => assert.equal(checksOk(), true));
test("checks: pending, failed, skipped, cancelled, timed out, neutral or missing checks block", () => {
  for (const o of [{ status: "in_progress", conclusion: null }, { status: "queued", conclusion: null }, { conclusion: "failure" }, { conclusion: "skipped" },
    { conclusion: "cancelled" }, { conclusion: "timed_out" }, { conclusion: "neutral" }, { conclusion: "action_required" }, { conclusion: "stale" }]) {
    assert.equal(checksOk({ checkRuns: [checkRun("verify", o), checkRun("Claude PR Review")] }), false, "verify " + JSON.stringify(o));
    assert.equal(checksOk({ checkRuns: [checkRun("verify"), checkRun("Claude PR Review", o)] }), false, "review " + JSON.stringify(o));
  }
  assert.equal(checksOk({ checkRuns: [checkRun("verify")] }), false);
  assert.equal(checksOk({ checkRuns: [] }), false);
  assert.equal(checksOk({ checkRuns: null }), false);
  assert.equal(checksOk({ workflowRuns: null }), false);
});
test("checks: latest trusted verify run wins; a re-run of verify after a failure may pass", () => {
  assert.equal(checksOk({ checkRuns: [checkRun("verify"), checkRun("verify", { id: 9, conclusion: "failure", started_at: "2026-11-16T11:00:00Z" }), checkRun("Claude PR Review")] }), false);
  assert.equal(checksOk({ checkRuns: [checkRun("verify", { id: 9, conclusion: "failure", started_at: "2026-11-16T09:00:00Z" }), checkRun("verify"), checkRun("Claude PR Review")] }), true);
});
test("checks: a missing/null check-suite id never matches a missing/null workflow-run suite id", () => {
  const nullRuns = [workflowRun(".github/workflows/ci.yml", { check_suite_id: null }), workflowRun(".github/workflows/claude-pr-review.yml", { check_suite_id: null })];
  const nullChecks = [checkRun("verify", { check_suite: { id: null } }), checkRun("Claude PR Review", { check_suite: { id: null } })];
  assert.equal(checksOk({ workflowRuns: nullRuns, checkRuns: nullChecks }), false);
  assert.equal(checksOk({ workflowRuns: nullRuns.map((w) => ({ ...w, check_suite_id: undefined })), checkRuns: nullChecks.map((c) => ({ ...c, check_suite: undefined })) }), false);
});
const GATE = "Gate on review outcome (fail-closed)";
const REVIEW = "Run Claude review (read-only)";
const SCOPE = { name: "Decide scope", conclusion: "success" };
const job = (o = {}) => ({ run_id: 2000, run_attempt: 1, name: "Claude PR Review", conclusion: "success",
  steps: [SCOPE, { name: REVIEW, conclusion: "success" }, { name: GATE, conclusion: "success" }], ...o });
const gateJob = (gate, o = {}) => job({ conclusion: gate === "success" ? "success" : "failure", steps: [SCOPE, { name: REVIEW, conclusion: "success" }, { name: GATE, conclusion: gate }], ...o });
const attemptsOk = (o = {}) => verifyReviewAttempts({ expectedSha: SHA, pr: pr(), repo: REPO, workflowRuns: goodWorkflowRuns(), jobs: [job()], ...o }).ok;
const runs2 = (attempt) => [workflowRun(".github/workflows/ci.yml"), workflowRun(".github/workflows/claude-pr-review.yml", { run_attempt: attempt })];

test("attempts: newest attempt passed its gate => ok", () => assert.equal(attemptsOk(), true));
test("attempts: a failed AI review cannot be re-run into a pass (any attempt, any run, any check suite)", () => {
  assert.equal(attemptsOk({ workflowRuns: runs2(2), jobs: [gateJob("failure", { run_attempt: 1 }), job({ run_attempt: 2 })] }), false);
  // an earlier, separate review run on the same SHA (e.g. a 'reopened' event) that failed its gate
  assert.equal(attemptsOk({ workflowRuns: [...goodWorkflowRuns(), workflowRun(".github/workflows/claude-pr-review.yml", { id: 1999 })],
    jobs: [gateJob("failure", { run_id: 1999 }), job()] }), false);
});
test("attempts: attempts that never reached the gate are not reviews and do not block a later pass", () => {
  const scopeFail = job({ run_attempt: 1, conclusion: "failure", steps: [{ name: "Decide scope", conclusion: "failure" }, { name: REVIEW, conclusion: "skipped" }, { name: GATE, conclusion: "skipped" }] });
  const cancelled = job({ run_attempt: 2, conclusion: "cancelled", steps: [SCOPE, { name: REVIEW, conclusion: "skipped" }, { name: GATE, conclusion: "cancelled" }] });
  assert.equal(attemptsOk({ workflowRuns: runs2(3), jobs: [scopeFail, cancelled, job({ run_attempt: 3 })] }), true);
  const neverStarted = job({ run_attempt: 1, conclusion: "cancelled", steps: [SCOPE, { name: REVIEW, conclusion: "skipped" }, { name: GATE, conclusion: "cancelled" }] });
  assert.equal(attemptsOk({ workflowRuns: runs2(2), jobs: [neverStarted, job({ run_attempt: 2 })] }), true);
});
test("attempts: a review that STARTED but whose gate did not succeed is a failed review (force-cancel cannot hide a verdict)", () => {
  for (const [review, gate] of [["cancelled", "skipped"], ["cancelled", "cancelled"], ["cancelled", undefined], ["failure", "skipped"], ["success", "cancelled"], ["success", "skipped"]]) {
    const steps = [SCOPE, { name: REVIEW, conclusion: review }, ...(gate ? [{ name: GATE, conclusion: gate }] : [])];
    assert.equal(attemptsOk({ workflowRuns: runs2(2), jobs: [job({ run_attempt: 1, conclusion: "cancelled", steps }), job({ run_attempt: 2 })] }), false, review + "/" + gate);
  }
});
test("attempts: a force-cancelled review step with a null or missing conclusion counts as started (fail-closed, R3-1)", () => {
  for (const review of [{ name: REVIEW, conclusion: null, status: "completed" }, { name: REVIEW, conclusion: null, status: "in_progress" },
    { name: REVIEW, conclusion: null }, { name: REVIEW }, { name: REVIEW, conclusion: "neutral", status: "completed" }]) {
    for (const gate of [[], [{ name: GATE, conclusion: null }], [{ name: GATE, conclusion: "skipped" }]]) {
      const steps = [SCOPE, review, ...gate];
      assert.equal(attemptsOk({ workflowRuns: runs2(2), jobs: [job({ run_attempt: 1, conclusion: "cancelled", steps }), job({ run_attempt: 2 })] }), false, JSON.stringify(steps));
    }
  }
  // Only a review step that provably never ran (skipped, or still queued/pending/waiting/requested) is ignored.
  for (const status of ["queued", "pending", "waiting", "requested"]) {
    const steps = [SCOPE, { name: REVIEW, conclusion: null, status }, { name: GATE, conclusion: null, status }];
    assert.equal(attemptsOk({ workflowRuns: runs2(2), jobs: [job({ run_attempt: 1, conclusion: "cancelled", steps }), job({ run_attempt: 2 })] }), true, status);
  }
});
test("attempts: a gate step without any review step is an unexpected shape and counts as a failed review (D5)", () => {
  for (const gate of ["cancelled", "skipped", null]) {
    const steps = [SCOPE, { name: GATE, conclusion: gate }];
    assert.equal(attemptsOk({ workflowRuns: runs2(2), jobs: [job({ run_attempt: 1, conclusion: "cancelled", steps }), job({ run_attempt: 2 })] }), false, String(gate));
  }
  // control: no review step and no gate step (job cancelled before either was listed) is not a review
  assert.equal(attemptsOk({ workflowRuns: runs2(2), jobs: [job({ run_attempt: 1, conclusion: "cancelled", steps: [SCOPE] }), job({ run_attempt: 2 })] }), true);
});
test("attempts: a scope-out pass (gate skipped or absent) is never a review, even when the check is green", () => {
  assert.equal(attemptsOk({ jobs: [job({ steps: [SCOPE, { name: GATE, conclusion: "skipped" }] })] }), false);
  assert.equal(attemptsOk({ jobs: [job({ steps: [SCOPE] })] }), false);
  assert.equal(attemptsOk({ jobs: [job({ steps: null })] }), false);
});
test("attempts: missing attempt data, newest attempt missing, untrusted run, or too many attempts deny", () => {
  assert.equal(attemptsOk({ workflowRuns: runs2(2), jobs: [job({ run_attempt: 2 })] }), false);   // attempt 1 not inspected
  assert.equal(attemptsOk({ workflowRuns: runs2(2), jobs: [job({ run_attempt: 1 })] }), false);   // newest attempt missing
  assert.equal(attemptsOk({ workflowRuns: runs2(21), jobs: Array.from({ length: 21 }, (_, i) => job({ run_attempt: i + 1 })) }), false);
  assert.equal(attemptsOk({ workflowRuns: runs2(0) }), false);
  assert.equal(attemptsOk({ jobs: null }), false);
  assert.equal(attemptsOk({ jobs: [] }), false);
  assert.equal(attemptsOk({ jobs: [job({ run_id: 1 })] }), false);                                 // job of an untrusted run
  assert.equal(attemptsOk({ jobs: [job({ name: "other" })] }), false);
  assert.equal(attemptsOk({ workflowRuns: reviewRun({ head_branch: "feat/x" }) }), false);         // twin PR's run is not trusted
  assert.equal(attemptsOk({ pr: null }), false);
});
test("checks: check run on another SHA, from another app, or from an untrusted workflow does not count", () => {
  assert.equal(checksOk({ checkRuns: [checkRun("verify", { head_sha: OTHER }), checkRun("Claude PR Review")] }), false);
  assert.equal(checksOk({ checkRuns: [checkRun("verify", { app: { id: 1 } }), checkRun("Claude PR Review")] }), false);
  assert.equal(checksOk({ workflowRuns: [workflowRun(".github/workflows/evil.yml", { check_suite_id: 100 }), workflowRun(".github/workflows/claude-pr-review.yml")] }), false);
  assert.equal(checksOk({ workflowRuns: [workflowRun(".github/workflows/ci.yml", { event: "push" }), workflowRun(".github/workflows/claude-pr-review.yml")] }), false);
  assert.equal(checksOk({ workflowRuns: [workflowRun(".github/workflows/ci.yml", { head_sha: OTHER }), workflowRun(".github/workflows/claude-pr-review.yml")] }), false);
  assert.equal(checksOk({ workflowRuns: [workflowRun(".github/workflows/ci.yml", { path: ".github/workflows/ci.yml@refs/heads/main" }), workflowRun(".github/workflows/claude-pr-review.yml")] }), false);
});
test("checks: a review produced for another PR, base, branch or repository does not count", () => {
  assert.equal(checksOk({ workflowRuns: reviewRun({ pull_requests: [{ number: 99, base: { ref: "main" } }] }) }), false);
  assert.equal(checksOk({ workflowRuns: reviewRun({ pull_requests: [{ number: PR_NUMBER, base: { ref: "dev" } }] }) }), false);
  assert.equal(checksOk({ workflowRuns: reviewRun({ pull_requests: [] }) }), false);
  assert.equal(checksOk({ workflowRuns: reviewRun({ pull_requests: null }) }), false);
  // Twin PR at the same SHA from a non-phase branch: GitHub may list this PR in its pull_requests.
  assert.equal(checksOk({ workflowRuns: reviewRun({ head_branch: "feat/x" }) }), false);
  assert.equal(checksOk({ workflowRuns: reviewRun({ head_branch: "feat/wanees-phase-3" }) }), false);
  assert.equal(checksOk({ workflowRuns: reviewRun({ head_repository: { full_name: "evil/LIP" } }) }), false);
  assert.equal(checksOk({ workflowRuns: reviewRun({ head_repository: null }) }), false);
  assert.equal(verifyChecks({ expectedSha: SHA, pr: pr({}, { ref: "feat/x" }), repo: REPO, checkRuns: goodCheckRuns(), workflowRuns: goodWorkflowRuns() }).ok, false);
});

test("reviews: changes requested blocks until superseded by the same reviewer", () => {
  assert.equal(verifyReviews([]).ok, true);
  assert.equal(verifyReviews([{ state: "CHANGES_REQUESTED", user: { login: "x" } }]).ok, false);
  assert.equal(verifyReviews([{ state: "CHANGES_REQUESTED", user: { login: "x" } }, { state: "COMMENTED", user: { login: "x" } }]).ok, false);
  assert.equal(verifyReviews([{ state: "CHANGES_REQUESTED", user: { login: "x" } }, { state: "APPROVED", user: { login: "x" } }]).ok, true);
  // another reviewer's approval never clears someone else's change request
  assert.equal(verifyReviews([{ state: "APPROVED", user: { login: "x" } }, { state: "CHANGES_REQUESTED", user: { login: "y" } }]).ok, false);
  assert.equal(verifyReviews([{ state: "CHANGES_REQUESTED", user: { login: "x" } }, { state: "APPROVED", user: { login: "y" } }]).ok, false);
  assert.equal(verifyReviews(null).ok, false);
});

const decision = (o = {}) => decide({ enabled: "true", repo: REPO, expectedSha: SHA, pr: pr(), files: files(ROUTINE),
  rules: goodRules(), checkRuns: goodCheckRuns(), workflowRuns: goodWorkflowRuns(), jobs: [job()], reviews: [], ...o });

test("decide: everything verified => merge", () => assert.deepEqual(decision(), { merge: true, reasons: [] }));
test("decide: auto-merge is disabled by default (kill switch not exactly 'true')", () => {
  for (const enabled of [undefined, "", "false", "TRUE", "True", " true", "1", "yes"]) assert.equal(decision({ enabled }).merge, false, String(enabled));
});
test("decide: head SHA changed after the checks ran blocks", () => assert.equal(decision({ pr: pr({}, { sha: OTHER }) }).merge, false));
test("decide: not mergeable / blocked / behind / unstable / unknown merge state blocks", () => {
  for (const o of [{ mergeable: false }, { mergeable: null }, { mergeable_state: "blocked" }, { mergeable_state: "behind" }, { mergeable_state: "unstable" },
    { mergeable_state: "dirty" }, { mergeable_state: "unknown" }, { mergeable_state: "has_hooks" }, { mergeable_state: undefined }])
    assert.equal(decision({ pr: pr(o) }).merge, false, JSON.stringify(o));
});
test("decide: every individual failure denies", () => {
  assert.equal(decision({ pr: null }).merge, false);
  assert.equal(decision({ files: null }).merge, false);
  assert.equal(decision({ files: files(".github/workflows/claude-pr-review.yml") }).merge, false);
  assert.equal(decision({ rules: null }).merge, false);
  assert.equal(decision({ checkRuns: [checkRun("verify")] }).merge, false);
  assert.equal(decision({ jobs: [gateJob("failure")] }).merge, false);
  assert.equal(decision({ jobs: null }).merge, false);
  assert.equal(decision({ reviews: [{ state: "CHANGES_REQUESTED", user: { login: "x" } }] }).merge, false);
  assert.equal(decision({ expectedSha: "" }).merge, false);
  assert.equal(decision({ repo: "" }).merge, false);
});
test("parseLines: JSON lines, empty, and garbage", () => {
  assert.deepEqual(parseLines('{"a":1}\n{"a":2}\n'), [{ a: 1 }, { a: 2 }]);
  assert.deepEqual(parseLines(""), []);
  assert.equal(parseLines("{oops"), null);
  assert.equal(parseLines(undefined), null);
});

const lines = (arr) => arr.map((x) => JSON.stringify(x)).join("\n");
const policyCli = (env) => spawnSync(process.execPath, [fileURLToPath(new URL("./automerge-policy.mjs", import.meta.url))], { env: { PATH: process.env.PATH, ...env }, encoding: "utf8" });
// The CLI reads API data from files (PR_FILE, *_FILE); a null entry leaves that file out.
const cli = ({ env = {}, data = {} } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), "policy-"));
  const all = { PR_FILE: JSON.stringify(rawPr()), FILES_FILE: lines(files(ROUTINE)), RULES_FILE: lines(goodRules()), CHECK_RUNS_FILE: lines(goodCheckRuns()),
    WORKFLOW_RUNS_FILE: lines(goodWorkflowRuns()), JOBS_FILE: lines([job()]), REVIEWS_FILE: "", ...data };
  const e = { AUTOMERGE_ENABLED: "true", REPO, EXPECTED_SHA: SHA, ...env };
  for (const [k, v] of Object.entries(all)) { if (v === null) continue; const p = join(dir, k); writeFileSync(p, v); e[k] = p; }
  try { return policyCli(e).status; } finally { rmSync(dir, { recursive: true, force: true }); }
};
test("policy CLI: mocked API data in files => exit 0 only when everything verifies, else 3", () => {
  assert.equal(cli(), 0);
  assert.equal(policyCli({}).status, 3);
  assert.equal(cli({ env: { AUTOMERGE_ENABLED: "" } }), 3);
  assert.equal(cli({ data: { RULES_FILE: "" } }), 3);
  for (const k of ["PR_FILE", "FILES_FILE", "RULES_FILE", "CHECK_RUNS_FILE", "WORKFLOW_RUNS_FILE", "JOBS_FILE", "REVIEWS_FILE"])
    assert.equal(cli({ data: { [k]: null } }), 3, k + " missing");
  assert.equal(cli({ data: { CHECK_RUNS_FILE: "{garbage" } }), 3);
  assert.equal(cli({ data: { JOBS_FILE: lines([gateJob("failure")]) } }), 3);
  assert.equal(cli({ data: { PR_FILE: JSON.stringify(rawPr({ head: { ref: BRANCH, sha: OTHER, repo: { full_name: REPO } } })) } }), 3);
});
test("policy CLI: a large PR (2000 files, ~600 KB tasks.md patch) is evaluated from files, not crashed", () => {
  const many = Array.from({ length: 2000 }, (_, i) => ({ filename: `apps/web/src/styles/c${i}.css`, previous_filename: null, status: "modified", patch: null }));
  const pad = "x".repeat(300000);
  const big = { filename: "specs/002-p0-prd/tasks.md", previous_filename: null, status: "modified", patch: `@@ -1 +1 @@\n-- [ ] T001 ${pad}\n+- [x] T001 ${pad}` };
  assert.equal(cli({ data: { PR_FILE: JSON.stringify(rawPr({ changed_files: 2001 })), FILES_FILE: lines([...many, big]) } }), 0);
});
