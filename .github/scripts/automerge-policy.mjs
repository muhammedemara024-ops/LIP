// Merge decision for Wanees Phase PRs. Pure Node builtins, no dependencies.
// Every input is API data read as plain data; nothing here executes PR content.
// Fail-closed: any missing, malformed or unexpected input denies the merge.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const PHASE_BRANCH = /^feat\/wanees-phase-[0-9]+$/;
export const SHA_RE = /^[0-9a-f]{40}$/;
export const TRUSTED_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
export const MAX_FILES = 2900; // the PR files API stops at 3000; at or over the cap the list may be incomplete
export const MAX_ATTEMPTS = 20; // review-run attempts we are willing to inspect per SHA
export const GITHUB_ACTIONS_APP_ID = 15368;
export const REVIEW_CONTEXT = "Claude PR Review";
export const REVIEW_WORKFLOW = ".github/workflows/claude-pr-review.yml";
export const GATE_STEP = "Gate on review outcome (fail-closed)";
export const REVIEW_STEP = "Run Claude review (read-only)";

// Required status checks: context name -> the trusted workflow file that must produce it.
export const REQUIRED_CHECKS = [
  { context: "verify", workflowPath: ".github/workflows/ci.yml" },
  { context: REVIEW_CONTEXT, workflowPath: REVIEW_WORKFLOW },
];

// Path policy = ALLOWLIST minus DENYLIST. A path must match an allowed area AND no denied
// pattern; anything new or unexpected therefore needs a human merge (fail-closed).
// No application code auto-merges (PD-049). apps/web is one Next.js app whose files may run on
// the server (route handlers, server actions, server components, middleware, instrumentation)
// and a path cannot prove otherwise, so in apps/web only non-executable files are eligible:
// stylesheets, images, fonts and locale message JSON, plus NEW test files outside a routing
// directory. The BFF (apps/bff) and upstream LIP code (packages/*, apps/cloud, apps/admin,
// apps/wallet, conformance) always need a human merge (rule 01 §3: a fork-patch log entry no
// script can verify).
// Test files may only be ADDED; modifying, renaming or removing an existing test needs a human
// merge, so an assertion in a mandatory suite can never be weakened automatically.
export const ALLOWED_PATTERNS = [
  /^apps\/web\/.+\.(css|scss|sass|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf)$/i,
  /^apps\/web\/(.+\/)?(messages|locales?|i18n|translations)\/[^/]+\.json$/i,
  /^apps\/web\/.+\.(test|spec)\.[cm]?[jt]sx?$/i,
  /^packages\/[^/]+\/src\/[^/]+\.test\.ts$/,
  /^tests\//,
  /^examples\//,
  /^docs\//,
  /^docs-site\//,
  /^(README|CHANGELOG)\.md$/,
];

// Always a human merge (case-insensitive; the owner works on a case-insensitive filesystem):
// governance, CI/CD, agent configuration, approval records, protocol contracts, build/test
// configuration that decides what "verify" proves, dependencies, deployment, schema,
// migrations, RLS, auth, sessions, credentials, tenant isolation, PII, money, points, ledger,
// billing and security primitives. Keyword patterns match any path segment.
export const DENIED_PATTERNS = [
  /^\.github\//i,
  /(^|\/)(AGENTS|CLAUDE|CLAUDE\.local|SECURITY|CODE_OF_CONDUCT|GOVERNANCE|MAINTAINERS|CODEOWNERS)(\.md)?$/i,
  /(^|\/)\.(claude|agents|delegate|specify|husky|vscode|devcontainer|github|cursor)(\/|$)/i,
  /(^|\/)\.?mcp\.json$/i,
  /(^|\/)\.(gitattributes|gitignore|gitmodules|npmrc|nvmrc|node-version|env[^/]*)$/i,
  /^docs\/(context|agents)\//i,
  /^spec\//i,
  /^specs\//i,                          // approval records; tasks.md checkbox ticks are handled separately
  /(^|\/)package(-lock)?\.json$/i,
  /(^|\/)(npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock)$/i,
  /(^|\/)tsconfig[^/]*\.json$/i,
  /(^|\/)(vite|vitest|jest|playwright|next|eslint|prettier|babel|postcss|tailwind|webpack|rollup|esbuild|tsup)[^/]*\.(config|setup|workspace)[^/]*$/i,
  /(^|\/)(vitest|jest)\.setup[^/]*$/i,
  /(^|\/)(eslint|prettier|babel)[^/]*\.(c|m)?(js|ts|json)$/i,
  /(^|\/)\.(eslintrc|prettierrc|babelrc)[^/]*$/i,
  /(^|\/)(setup-?tests?|global-?setup|test-?setup)[^/]*$/i,
  /^scripts\//i,
  /(^|\/)(Dockerfile[^/]*|compose[^/]*\.ya?ml|docker-compose[^/]*\.ya?ml|render\.yaml|Procfile|vercel\.json|netlify\.toml|fly\.toml)$/i,
  /^deploy\//i,
  // Next.js routing directories: every file there can become a route or server code.
  /^apps\/web\/(src\/)?(pages|app\/api)\//i,
  /(^|\/)migrations?\//i,
  /\.sql$/i,
  // Substrings that are distinctive enough to match anywhere in a path segment.
  /(^|\/)[^/]*(auth|session|csrf|tenant|webhook|billing|payment|ledger|wallet|redeem|redemption|access-control|permission|crypto|hmac|signature|secret|token|credential|password|login|cookie|header|middleware|consent|privacy|erasure|operator|deploy|provision|database|config|outbound|customer|phone|points|stamp|balance|money|price|reward|api-?key|merchant|lip-?client|postgres|storage|lease|migrat|engine|conformance|fixture|isolation|schema|prisma|drizzle|seed|sql|repositor|idempot)[^/]*(\/|$)/i,
  // Short words only as whole words inside a segment (so "feedback" is not "db").
  /(^|[/._-])(otp|rls|jwt|cors|csp|pii|db|env|keys?|roles?|acl|qr)([/._-]|$)/i,
  // ...and as camelCase / PascalCase words (otpService, OtpInput, useDbPool, apiKeyForm, QRScanner).
  // Case-sensitive on purpose, so "feedbackForm", "envelope" and "monkey" stay allowed.
  /(^|[/._-])(otp|rls|jwt|cors|csp|pii|db|env|keys?|roles?|acl|qr)(?=[A-Z0-9])/,
  /(^|[/._-]|[a-z0-9])(Otp|OTP|Rls|RLS|Jwt|JWT|Cors|CORS|Csp|CSP|Pii|PII|Db|DB|Env|ENV|Keys?|KEYS?|Roles?|ROLES?|Acl|ACL|Qr|QR)(?=[A-Z0-9]|[/._-]|$)/,
];

export function deniedHits(paths) {
  return paths.filter((p) => DENIED_PATTERNS.some((re) => re.test(p)));
}
export function notAllowed(paths) {
  return paths.filter((p) => !ALLOWED_PATTERNS.some((re) => re.test(p)));
}

// specs/<feature>/tasks.md may change only by ticking checkboxes ("- [ ]" -> "- [x]").
export const TASKS_FILE = /^specs\/[^/]+\/tasks\.md$/;
export function isCheckboxOnlyPatch(patch) {
  if (typeof patch !== "string" || !patch.trim()) return false;
  const removed = [], added = [];
  for (const line of patch.split("\n")) {
    if (line.startsWith("@@") || line.startsWith("\\ No newline")) continue;
    if (line.startsWith("-")) removed.push(line.slice(1));
    else if (line.startsWith("+")) added.push(line.slice(1));
    else if (!line.startsWith(" ") && line !== "") return false;
  }
  if (removed.length === 0 || removed.length !== added.length) return false;
  // Only task lines (T###) may be ticked, never a checkbox-style gate or approval line.
  return removed.every((r, i) => /^\s*- \[ \] T\d{3}\b/.test(r) && r.replace("- [ ] ", "- [x] ") === added[i]);
}

const TEST_FILE = /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$/i;
const list = (items) => `${items.slice(0, 5).join(", ")}${items.length > 5 ? ", …" : ""}`;

export function pathPolicy(files) {
  const reasons = [];
  const ticks = [], paths = [];
  for (const f of files) {
    const prev = typeof f.previous_filename === "string" && f.previous_filename ? f.previous_filename : null;
    if (TASKS_FILE.test(f.filename) && f.status === "modified" && !prev) {
      if (isCheckboxOnlyPatch(f.patch)) { ticks.push(f.filename); continue; }
      reasons.push(`${f.filename} changes more than checkbox ticks (or its patch is unavailable)`);
      continue;
    }
    if ((TEST_FILE.test(f.filename) || (prev && TEST_FILE.test(prev))) && f.status !== "added")
      reasons.push(`changes an existing test file (${f.status}; only new test files may auto-merge): ${prev ?? f.filename}`);
    paths.push(f.filename);
    if (prev) paths.push(prev);
  }
  const denied = deniedHits(paths);
  if (denied.length) reasons.push(`touches governance/security paths (human merge required): ${list(denied)}`);
  const outside = notAllowed(paths).filter((p) => !denied.includes(p));
  if (outside.length) reasons.push(`touches paths outside the auto-merge allowlist: ${list(outside)}`);
  return { ok: reasons.length === 0, reasons, ticks };
}

// pr: normalized from GET /repos/{r}/pulls/{n}.
// files: [{filename, previous_filename?, status, patch?}] from GET .../pulls/{n}/files.
export function checkEligibility(pr, repo, files) {
  const reasons = [];
  if (!pr || typeof pr !== "object") return { eligible: false, reasons: ["PR data is missing"] };
  if (pr.state !== "open") reasons.push("PR is not open");
  if (pr.baseRef !== "main") reasons.push("base branch is not main");
  if (!repo || pr.headRepo !== repo) reasons.push("PR is not from this repository");
  if (!PHASE_BRANCH.test(pr.headRef ?? "")) reasons.push("head branch is not feat/wanees-phase-<n>");
  if (pr.draft !== false) reasons.push("PR is a draft (or draft state unknown)");
  if (!TRUSTED_ASSOCIATIONS.has(pr.authorAssociation)) reasons.push("author is not OWNER/MEMBER/COLLABORATOR");
  if (!Array.isArray(files) || files.length === 0) reasons.push("changed-file list is empty or unavailable");
  else if (files.some((f) => !f || typeof f.filename !== "string" || !f.filename)) reasons.push("changed-file list is malformed");
  else if (files.length >= MAX_FILES) reasons.push("changed-file list too large to verify");
  else if (!Number.isInteger(pr.changedFiles) || files.length !== pr.changedFiles)
    reasons.push(`changed-file list is incomplete (${files.length} listed, PR reports ${pr.changedFiles})`);
  else reasons.push(...pathPolicy(files).reasons);
  return { eligible: reasons.length === 0, reasons };
}

// rules: GET /repos/{r}/rules/branches/main (active rules only).
// Classic branch protection is not accepted: GITHUB_TOKEN cannot read its "strict" flag,
// so the up-to-date requirement would be unverifiable. The repository's native auto-merge
// setting is deliberately NOT required: this automation never arms native auto-merge, and
// the recommended setting is allow_auto_merge=false so no request can be armed at all.
export function verifyBranchRules({ rules }) {
  const reasons = [];
  if (!Array.isArray(rules)) return { ok: false, reasons: ["branch rules for main could not be read (unverifiable)"] };
  const rsc = rules.filter((r) => r?.type === "required_status_checks");
  if (rsc.length === 0) reasons.push("no ruleset required_status_checks rule is active on main");
  const pinned = new Map();
  let strict = false;
  for (const r of rsc) {
    if (r.parameters?.strict_required_status_checks_policy === true) strict = true;
    for (const c of r.parameters?.required_status_checks ?? []) {
      if (c?.integration_id === GITHUB_ACTIONS_APP_ID) pinned.set(c.context, true);
      else if (!pinned.has(c?.context)) pinned.set(c?.context, false);
    }
  }
  if (rsc.length && !strict) reasons.push("main does not require branches to be up to date (strict status checks)");
  for (const { context } of REQUIRED_CHECKS) {
    if (!pinned.has(context)) reasons.push(`required check "${context}" is not enforced on main`);
    else if (pinned.get(context) !== true) reasons.push(`required check "${context}" is not pinned to the GitHub Actions app`);
  }
  const prRules = rules.filter((r) => r?.type === "pull_request");
  if (prRules.length === 0) reasons.push("main has no active pull_request rule (direct pushes unprotected)");
  // PD-049: conversation resolution must be required, so an unresolved AI or human comment blocks the merge.
  else if (!prRules.some((r) => r.parameters?.required_review_thread_resolution === true)) reasons.push("main does not require conversation resolution");
  return { ok: reasons.length === 0, reasons };
}

// Workflow runs of `workflowPath` that belong to THIS PR at THIS SHA: triggered by
// pull_request from the PR's own head branch in this repository, with the PR (base main)
// attached. Check runs belong to a SHA, not a PR; this binding stops a twin PR on the same
// commit (another branch, another base) from lending its result.
export function trustedRuns({ workflowRuns, workflowPath, expectedSha, pr, repo }) {
  return workflowRuns.filter((w) => w && w.path === workflowPath && w.event === "pull_request" && w.head_sha === expectedSha &&
    w.head_branch === pr.headRef && w.head_repository?.full_name === repo &&
    Array.isArray(w.pull_requests) && w.pull_requests.some((p) => p?.number === pr.number && p?.base?.ref === "main"));
}

// checkRuns: GET /repos/{r}/commits/{sha}/check-runs?filter=all (all pages, flattened).
// workflowRuns: GET /repos/{r}/actions/runs?head_sha={sha} (all pages, flattened).
// The latest trusted check run of each required context must be completed + success.
export function verifyChecks({ expectedSha, pr, repo, checkRuns, workflowRuns }) {
  const reasons = [];
  if (!SHA_RE.test(expectedSha ?? "")) return { ok: false, reasons: ["expected head SHA is missing or malformed"] };
  if (!pr || !PHASE_BRANCH.test(pr.headRef ?? "")) return { ok: false, reasons: ["PR head branch unknown or not a phase branch"] };
  if (!Array.isArray(checkRuns) || !Array.isArray(workflowRuns)) return { ok: false, reasons: ["check runs or workflow runs could not be read"] };
  for (const { context, workflowPath } of REQUIRED_CHECKS) {
    const suites = new Set(trustedRuns({ workflowRuns, workflowPath, expectedSha, pr, repo }).map((w) => w.check_suite_id).filter(Number.isInteger));
    const candidates = checkRuns
      .filter((c) => c && c.name === context && c.head_sha === expectedSha && c.app?.id === GITHUB_ACTIONS_APP_ID &&
        Number.isInteger(c.check_suite?.id) && suites.has(c.check_suite.id))
      .sort((a, b) => String(b.started_at ?? "").localeCompare(String(a.started_at ?? "")) || (b.id ?? 0) - (a.id ?? 0));
    const latest = candidates[0];
    if (!latest) reasons.push(`required check "${context}" has no trusted run for ${expectedSha}`);
    else if (latest.status !== "completed") reasons.push(`required check "${context}" is still ${latest.status ?? "pending"}`);
    else if (latest.conclusion !== "success") reasons.push(`required check "${context}" concluded ${latest.conclusion ?? "without a result"}, not success`);
  }
  return { ok: reasons.length === 0, reasons };
}

// jobs: for every attempt (1..run_attempt) of every review-workflow run on this SHA,
// GET /repos/{r}/actions/runs/{id}/attempts/{n}/jobs, flattened to
// {run_id, run_attempt, name, steps:[{name, conclusion}]}. Step-level evidence decides:
//   - an attempt whose gate step concluded "failure" is a FAILED AI REVIEW. Any such attempt
//     on this SHA denies, so a failed review cannot be re-run into a pass;
//   - attempts that never reached the gate (scope "not applicable", draft, missing key,
//     setup failure, cancellation) are not reviews and are ignored;
//   - the newest attempt of the newest trusted run must have a gate step that SUCCEEDED, so
//     a scope-out pass can never stand in for a review.
export function verifyReviewAttempts({ expectedSha, pr, repo, workflowRuns, jobs }) {
  const reasons = [];
  if (!Array.isArray(workflowRuns) || !Array.isArray(jobs)) return { ok: false, reasons: ["review run attempts could not be read"] };
  if (!pr) return { ok: false, reasons: ["PR data is missing"] };
  const runs = trustedRuns({ workflowRuns, workflowPath: REVIEW_WORKFLOW, expectedSha, pr, repo });
  if (runs.length === 0) return { ok: false, reasons: ["no trusted AI review run for this SHA"] };
  const runIds = new Set(runs.map((w) => w.id));
  for (const w of runs) {
    if (!Number.isInteger(w.run_attempt) || w.run_attempt < 1 || w.run_attempt > MAX_ATTEMPTS) reasons.push(`review run ${w.id} has an unusable attempt count`);
    for (let n = 1; n <= Math.min(w.run_attempt || 0, MAX_ATTEMPTS); n++)
      if (!jobs.some((j) => j?.run_id === w.id && j?.run_attempt === n && j?.name === REVIEW_CONTEXT)) reasons.push(`review run ${w.id} attempt ${n} could not be inspected`);
  }
  const reviewJobs = jobs.filter((j) => j && runIds.has(j.run_id) && j.name === REVIEW_CONTEXT);
  const stepOf = (j, name) => (Array.isArray(j.steps) ? j.steps.find((s) => s?.name === name) : undefined);
  const gateOf = (j) => stepOf(j, GATE_STEP);
  // A failed review: the gate failed, OR the Claude step started and the gate did not succeed.
  // The second clause covers a force-cancel, which skips always() steps, so a writer cannot
  // cancel a review that is about to fail and re-run it. Fail-closed: the step counts as started
  // unless it is positively shown not to have run (conclusion "skipped", or a queued/pending
  // status). A null or missing conclusion (force-cancel, lost runner) counts as started.
  const NOT_RUN_STATUS = new Set(["queued", "pending", "waiting", "requested"]);
  const started = (j) => {
    const s = stepOf(j, REVIEW_STEP);
    // No review step listed but a gate step present is an unexpected shape: treat as started (D5).
    if (!s) return gateOf(j) !== undefined;
    return s.conclusion !== "skipped" && !NOT_RUN_STATUS.has(s.status);
  };
  const failed = reviewJobs.filter((j) => gateOf(j)?.conclusion === "failure" || (started(j) && gateOf(j)?.conclusion !== "success"));
  if (failed.length) reasons.push(`the AI review failed on this SHA in ${failed.length} attempt(s); a re-run cannot override it (human merge or new commit)`);
  const newestRun = runs.reduce((a, b) => (b.id > a.id ? b : a));
  const newest = reviewJobs.filter((j) => j.run_id === newestRun.id).reduce((a, b) => (!a || b.run_attempt > a.run_attempt ? b : a), null);
  if (!newest) reasons.push("the newest AI review attempt could not be found");
  else if (newest.run_attempt !== newestRun.run_attempt) reasons.push("the newest AI review attempt is missing from the job data");
  else if (gateOf(newest)?.conclusion !== "success") reasons.push(`the newest AI review attempt did not pass its gate step (gate: ${gateOf(newest)?.conclusion ?? "not run"})`);
  return { ok: reasons.length === 0, reasons };
}

// reviews: GET /repos/{r}/pulls/{n}/reviews (all pages). A reviewer's latest decisive review counts.
export function verifyReviews(reviews) {
  if (!Array.isArray(reviews)) return { ok: false, reasons: ["PR reviews could not be read"] };
  const latest = new Map();
  for (const r of reviews) {
    if (!r?.user?.login || !["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(r.state)) continue;
    latest.set(r.user.login, r.state);
  }
  const blocking = [...latest].filter(([, s]) => s === "CHANGES_REQUESTED").map(([u]) => u);
  return { ok: blocking.length === 0, reasons: blocking.length ? [`changes requested by: ${list(blocking)}`] : [] };
}

// The whole decision. Every input is required; anything missing denies.
export function decide({ enabled, repo, expectedSha, pr, files, rules, checkRuns, workflowRuns, jobs, reviews }) {
  const reasons = [];
  if (enabled !== "true") reasons.push("LIP_AUTOMERGE_ENABLED is not exactly 'true' (kill switch off)");
  if (!SHA_RE.test(expectedSha ?? "")) reasons.push("expected head SHA is missing or malformed");
  else if (pr?.headSha !== expectedSha) reasons.push(`head SHA changed: checks ran on ${expectedSha}, PR head is ${pr?.headSha ?? "unknown"}`);
  reasons.push(...checkEligibility(pr, repo, files).reasons);
  if (pr?.mergeable !== true) reasons.push(`PR is not mergeable (mergeable=${pr?.mergeable})`);
  if (pr?.mergeableState !== "clean") reasons.push(`PR merge state is "${pr?.mergeableState ?? "unknown"}", not "clean"`);
  reasons.push(...verifyBranchRules({ rules }).reasons);
  reasons.push(...verifyChecks({ expectedSha, pr, repo, checkRuns, workflowRuns }).reasons);
  reasons.push(...verifyReviewAttempts({ expectedSha, pr, repo, workflowRuns, jobs }).reasons);
  reasons.push(...verifyReviews(reviews).reasons);
  return { merge: reasons.length === 0, reasons };
}

export function normalizePr(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    number: raw.number,
    state: raw.state,
    draft: raw.draft,
    baseRef: raw.base?.ref,
    headRef: raw.head?.ref,
    headRepo: raw.head?.repo?.full_name,
    headSha: raw.head?.sha,
    authorAssociation: raw.author_association,
    changedFiles: raw.changed_files,
    mergeable: raw.mergeable,
    mergeableState: raw.mergeable_state,
  };
}

// Parses `gh api --paginate --jq`-style output: one JSON value per line.
export function parseLines(s) {
  if (typeof s !== "string") return null;
  const out = [];
  for (const line of s.split("\n")) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { return null; }
  }
  return out;
}

// CLI. Data is passed in FILES (not env vars, which Linux caps at 128 KiB each):
// env AUTOMERGE_ENABLED, REPO, EXPECTED_SHA, and paths PR_FILE (raw REST PR JSON), FILES_FILE,
// RULES_FILE, CHECK_RUNS_FILE, WORKFLOW_RUNS_FILE, JOBS_FILE, REVIEWS_FILE (JSON lines).
// Exit 0 = merge allowed, 3 = deny. Any other exit is a crash and must fail the job.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const read = (p) => { try { return readFileSync(p ?? "", "utf8"); } catch { return undefined; } };
  const parse = (s) => { try { return JSON.parse(s ?? ""); } catch { return null; } };
  const e = process.env;
  const result = decide({
    enabled: e.AUTOMERGE_ENABLED,
    repo: e.REPO,
    expectedSha: e.EXPECTED_SHA,
    pr: normalizePr(parse(read(e.PR_FILE))),
    files: parseLines(read(e.FILES_FILE)),
    rules: parseLines(read(e.RULES_FILE)),
    checkRuns: parseLines(read(e.CHECK_RUNS_FILE)),
    workflowRuns: parseLines(read(e.WORKFLOW_RUNS_FILE)),
    jobs: parseLines(read(e.JOBS_FILE)),
    reviews: parseLines(read(e.REVIEWS_FILE)),
  });
  console.log(JSON.stringify(result));
  process.exit(result.merge ? 0 : 3);
}
