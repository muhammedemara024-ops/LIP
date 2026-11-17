#!/usr/bin/env node
// Regression tests for the continuous execution loop (run-state.mjs on top of phase-status.mjs).
// Builds synthetic repos, a bare "origin" and evidence roots in the OS temp dir; never writes to the project.
// Usage: node .agents/skills/wanees-phase/scripts/run-state.selftest.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNSTATE = join(HERE, "run-state.mjs");
const STATUS = join(HERE, "phase-status.mjs");
const LANES = {
  "plan-review": { implementer: "claude", model: "claude-sonnet-5-5", effort: "xhigh", readOnly: true },
  "migration-review": { implementer: "claude", model: "claude-opus-5-5", effort: "high", readOnly: true },
};
const APPROVED = "Gate 2 content approved 2026-11-13 (scoped).";
const fake = (n) => String(n).repeat(40).slice(0, 40);
const CI = "https://example.invalid/actions/runs/1";
const GIT = ["-c", "user.name=t", "-c", "user.email=t@example.invalid"];

// cards: [{id, phase, prereq?, readiness?}], auth: Status-block text. Always a git repo with a bare origin (main).
function fixture({ cards, auth = "" }) {
  const dir = mkdtempSync(join(tmpdir(), "wanees-run-selftest-"));
  mkdirSync(join(dir, "specs/002-p0-prd"), { recursive: true });
  mkdirSync(join(dir, ".delegate"), { recursive: true });
  const phases = [...new Set(cards.map((c) => c.phase))].sort();
  let md = `# Tasks\n\n**Status**: ${auth}\n\n## Gate register\n\n| Gate | Source / required evidence | Direct blockers |\n|---|---|---|\n| G-IMPLEMENT | scoped | all |\n\n`;
  for (const p of phases) {
    md += `## Phase ${p}: ${p === 8 ? "Gated tracks — no implementation schedule" : `Phase ${p} title`}\n\n`;
    for (const c of cards.filter((x) => x.phase === p)) md += `- [ ] ${c.id} Task ${c.id} in src/${c.id.toLowerCase()}/x.ts\n  - Readiness: ${c.readiness || APPROVED}\n  - Prerequisites: ${c.prereq || "G-IMPLEMENT"}\n`;
    md += "\n";
  }
  md += `## Dependencies and execution order\n\nnone\n`;
  writeFileSync(join(dir, "specs/002-p0-prd/tasks.md"), md);
  const cfg = JSON.stringify({ version: "delegate-fleet.v1", lanes: LANES });
  writeFileSync(join(dir, ".delegate/config.json"), cfg);
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  mkdirSync(join(dir, ".git/delegate-skills"), { recursive: true });
  writeFileSync(join(dir, ".git/delegate-skills/project-config.sha256"), createHash("sha256").update(cfg).digest("hex") + "\n");
  execFileSync("git", ["add", "--", "specs"], { cwd: dir });
  execFileSync("git", [...GIT, "commit", "-q", "-m", "fixture"], { cwd: dir });
  const bare = mkdtempSync(join(tmpdir(), "wanees-origin-selftest-"));
  execFileSync("git", ["init", "-q", "--bare"], { cwd: bare });
  execFileSync("git", ["remote", "add", "origin", bare], { cwd: dir });
  execFileSync("git", ["push", "-q", "origin", "main"], { cwd: dir });
  execFileSync("git", ["fetch", "-q", "origin"], { cwd: dir });
  return { dir, ev: mkdtempSync(join(tmpdir(), "wanees-evidence-selftest-")) };
}
const tasksPath = (f) => join(f.dir, "specs/002-p0-prd/tasks.md");
const tick = (f, id) => writeFileSync(tasksPath(f), readFileSync(tasksPath(f), "utf8").replace(`- [ ] ${id} `, `- [x] ${id} `));
const commitTick = (f, id, msg = "deliver") => { // the delivered commit: ticks the task in tasks.md, pushed fast-forward to origin/main
  tick(f, id);
  execFileSync("git", ["add", "--", "specs/002-p0-prd/tasks.md"], { cwd: f.dir, stdio: "ignore" });
  execFileSync("git", [...GIT, "commit", "-q", "-m", `${msg} ${id}`], { cwd: f.dir, stdio: "ignore" });
  execFileSync("git", ["push", "-q", "origin", "main"], { cwd: f.dir });
  execFileSync("git", ["fetch", "-q", "origin"], { cwd: f.dir });
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: f.dir, encoding: "utf8" }).trim();
};
const realCommit = (f) => { // a real commit pushed to origin/main (the "delivery")
  execFileSync("git", [...GIT, "commit", "-q", "--allow-empty", "-m", `delivery ${Math.random()}`], { cwd: f.dir });
  execFileSync("git", ["push", "-q", "origin", "main"], { cwd: f.dir });
  execFileSync("git", ["fetch", "-q", "origin"], { cwd: f.dir });
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: f.dir, encoding: "utf8" }).trim();
};
const rs = (f, ...args) => {
  const a = [RUNSTATE, ...args, "--repo", f.dir, "--state-root", join(f.dir, ".scratch"), "--evidence-root", f.ev];
  try { return JSON.parse(execFileSync("node", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); }
  catch (e) { return JSON.parse(String(e.stdout)); }
};
const statusOf = (dir) => JSON.parse(execFileSync("node", [STATUS, "--repo", dir, "--json"], { encoding: "utf8", env: { ...process.env, WANEES_STATE_ROOT: "" } }));
// Full task cycle in the order the loop requires: start -> (verify, review) -> delivered commit that ticks the task -> deliver -> done.
const ship = (f, id) => {
  rs(f, "start", id);
  const sha = commitTick(f, id);
  const dl = rs(f, "deliver", "--sha", sha, "--tasks", id, "--ci", CI);
  const d = rs(f, "done", id, "--evidence", `tests ok for ${id}`, "--sha", sha);
  return { ...d, sha, deliverOk: dl.ok };
};

let passed = 0, failed = 0;
const check = (name, cond, detail) => { console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ` :: ${JSON.stringify(detail)}`}`); cond ? passed++ : failed++; };
const AUTH = (list, extra = "") => `**Implementation authorization (owner, 2026-11-17${extra}): ${list} only.**`;
const REVOKE = (list, extra = "") => ` **Implementation authorization revoked (owner, 2026-11-18${extra}): ${list} only.**`;
const files = (f, runId) => existsSync(join(f.ev, "runs", runId)) ? readdirSync(join(f.ev, "runs", runId)) : [];

// 1. Task completed -> next task starts automatically (no stop, no finish).
{
  const f = fixture({ auth: AUTH("T010 and T011"), cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1 }] });
  const run = rs(f, "init");
  const n1 = rs(f, "next");
  check("1. first next executes T010", n1.action === "execute" && n1.task === "T010", n1);
  ship(f, "T010");
  const n2 = rs(f, "next");
  check("1. after T010 done, next executes T011 automatically", n2.action === "execute" && n2.task === "T011" && n2.runId === run.runId, n2);
}

// 2. Phase completed -> the next eligible Phase starts (one queue across all Phases).
{
  const f = fixture({ auth: AUTH("T010 and T020"), cards: [{ id: "T010", phase: 1 }, { id: "T020", phase: 2 }] });
  rs(f, "init");
  ship(f, "T010");
  const n = rs(f, "next");
  check("2. Phase 1 complete -> next is the Phase 2 task", n.action === "execute" && n.task === "T020" && n.phase === 2 && n.branch === "feat/wanees-phase-2", n);
}

// 3. CI passed and main updated -> execution continues. Delivery needs CI evidence; done needs a prior delivery.
{
  const f = fixture({ auth: AUTH("T010 and T011"), cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1 }] });
  rs(f, "init");
  rs(f, "start", "T010");
  check("3. done before delivery is refused", rs(f, "done", "T010", "--evidence", "e", "--sha", fake(2)).ok === false);
  check("3. deliver without --ci is refused", rs(f, "deliver", "--sha", fake(2), "--tasks", "T010").ok === false);
  check("3. deliver rejects a short sha", rs(f, "deliver", "--sha", "abc", "--tasks", "T010", "--ci", CI).ok === false);
  check("3. N1 deliver rejects a sha that is not a commit", rs(f, "deliver", "--sha", fake(2), "--tasks", "T010", "--ci", CI).ok === false);
  const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: f.dir, encoding: "utf8" }).trim();
  check("3. N1 deliver rejects the run's base commit (not newer)", rs(f, "deliver", "--sha", base, "--tasks", "T010", "--ci", CI).ok === false);
  const empty = realCommit(f);
  check("3. N1 deliver rejects a real new commit that does not tick the task", rs(f, "deliver", "--sha", empty, "--tasks", "T010", "--ci", CI).ok === false);
  const sha = commitTick(f, "T010");
  const d1 = rs(f, "deliver", "--sha", sha, "--tasks", "T010", "--ci", CI);
  rs(f, "deliver", "--sha", sha, "--tasks", "T010", "--ci", CI);
  const nrd = rs(f, "next");
  check("3. N2 between deliver and done, next says record-done (never park or redo)", nrd.action === "record-done" && nrd.sha === sha, nrd);
  check("3. done with a sha that is not the recorded delivery is refused", rs(f, "done", "T010", "--evidence", "e", "--sha", fake(9)).ok === false);
  rs(f, "done", "T010", "--evidence", "e", "--sha", sha);
  const n = rs(f, "next");
  check("3. after delivery + done, next still executes", d1.ok === true && n.action === "execute" && n.task === "T011", [d1, n]);
  const rep = rs(f, "report");
  check("3. delivery recorded once with its sha on the completed task", rep.run.deliveries.length === 1 && rep.run.completed[0].sha === sha, rep.run);
}

// 4. Blocked task -> unrelated eligible task proceeds; a parked task never unlocks its dependant; a delivered task cannot be parked.
{
  const f = fixture({ auth: AUTH("T010, T011 and T012"), cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1 }, { id: "T012", phase: 1, prereq: "T010; G-IMPLEMENT" }] });
  rs(f, "init");
  rs(f, "start", "T010");
  const b = rs(f, "block", "T010", "--reason", "CI red on storage tests", "--needs", "fix or owner decision");
  const n = rs(f, "next");
  check("4. T010 parked, unrelated T011 runs", b.ok && n.action === "execute" && n.task === "T011" && n.parked.includes("T010"), [b, n]);
  check("4. dependant T012 is waiting-deps, not selected", n.remainingQueue.every((t) => t !== "T012") && statusOf(f.dir).tasks.T012.status === "waiting-deps", n);
  rs(f, "block", "T010", "--reason", "again", "--needs", "again");
  check("4. blocking twice records one entry", rs(f, "report").run.blocked.length === 1);
  ship(f, "T011");
  const blockDone = rs(f, "block", "T011", "--reason", "late", "--needs", "x");
  check("4. a delivered task cannot be parked (done -> block refused)", blockDone.ok === false, blockDone);
}

// 4b. H1: the dependant unlocks only after the task is delivered, recorded done and ticked.
{
  const f = fixture({ auth: AUTH("T010 and T012"), cards: [{ id: "T010", phase: 1 }, { id: "T012", phase: 1, prereq: "T010; G-IMPLEMENT" }] });
  rs(f, "init");
  rs(f, "start", "T010");
  check("4b. before delivery the dependant is waiting-deps", statusOf(f.dir).tasks.T012.status === "waiting-deps");
  const sha = commitTick(f, "T010");
  rs(f, "deliver", "--sha", sha, "--tasks", "T010", "--ci", CI);
  check("4b. delivered but done not yet recorded: T010 is done-unverified, the dependant still waits", statusOf(f.dir).tasks.T012.status === "waiting-deps" && statusOf(f.dir).tasks.T010.status === "done-unverified");
  rs(f, "done", "T010", "--evidence", "ok", "--sha", sha);
  check("4b. done recorded after delivery: the dependant becomes a candidate", statusOf(f.dir).tasks.T012.status === "candidate");
}

// 5. Existing batch authorization -> no repeat approval prompt; batch label parsed; batch revocation fails closed or revokes the batch.
{
  const f = fixture({ auth: AUTH("T010, T011 and T012", ", batch b2"), cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1 }, { id: "T012", phase: 2 }] });
  const st = statusOf(f.dir);
  check("5. batch label parsed, three tasks authorized", st.authorizations[0].batch === "b2" && st.authorizations[0].tasks.length === 3, st.authorizations);
  rs(f, "init");
  const seen = [];
  for (let i = 0; i < 3; i += 1) {
    const n = rs(f, "next");
    seen.push(`${n.action}:${n.task}`);
    ship(f, n.task);
  }
  check("5. all three batch tasks run without any approval request", seen.join() === "execute:T010,execute:T011,execute:T012", seen);
  check("5. the request, when nothing is eligible, lists no tasks", statusOf(f.dir).consolidatedApprovalRequest.tasks.length === 0);
}
{
  const cards = [{ id: "T010", phase: 1 }, { id: "T011", phase: 1 }];
  const batch = fixture({ auth: AUTH("T010 and T011", ", batch b2") + REVOKE("batch b2"), cards });
  check("5. revoking the batch label revokes its tasks", statusOf(batch.dir).queue.length === 0, statusOf(batch.dir).queue);
  const bad = fixture({ auth: AUTH("T010 and T011") + REVOKE("T010 or maybe T011"), cards });
  check("5. an unparseable revocation blocks every candidate (fail closed)", statusOf(bad.dir).queue.length === 0 && statusOf(bad.dir).warnings.some((w) => w.includes("did not parse")), statusOf(bad.dir).queue);
  const loose = fixture({ auth: AUTH("T010 and T011") + " The authorization for T010 is revoked.", cards });
  check("5. L11 a differently worded revocation also fails closed", statusOf(loose.dir).queue.length === 0, statusOf(loose.dir).queue);
  const ok = fixture({ auth: AUTH("T010 and T011") + REVOKE("T010"), cards });
  check("5. a parsed single revocation removes only that task", statusOf(ok.dir).queue.map((q) => q.id).join() === "T011");
}

// 6. All tasks blocked -> ONE consolidated blocker report, no success marker; also when every candidate is parked.
{
  const f = fixture({ auth: "", cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1, prereq: "T010; G-IMPLEMENT" }, { id: "T020", phase: 2, readiness: "structure only; not approved at Gate 2" }] });
  const run = rs(f, "init");
  const n = rs(f, "next");
  check("6. nothing eligible -> finish BLOCKED with reasons", n.action === "finish" && n.wouldBe === "BLOCKED" && n.reasons.length > 0, n);
  const fin = rs(f, "finish");
  check("6. exactly one BLOCKED report, no COMPLETE flag", fin.outcome === "BLOCKED" && files(f, run.runId).join() === `BLOCKED-${run.runId}.md`, files(f, run.runId));
  const body = readFileSync(fin.report, "utf8");
  check("6. report holds ONE consolidated request (a request, granting nothing) listing every pending task", (body.match(/ONE consolidated approval request/g) || []).length === 1 && body.includes("grants nothing") && ["T010", "T011", "T020"].every((t) => body.includes(t)), body);
  rs(f, "finish");
  check("6. repeating finish does not duplicate the report or write a flag", files(f, run.runId).join() === `BLOCKED-${run.runId}.md`);
}
{
  const f = fixture({ auth: AUTH("T010"), cards: [{ id: "T010", phase: 1 }, { id: "T020", phase: 2, readiness: "structure only; not approved at Gate 2" }] });
  rs(f, "init");
  rs(f, "start", "T010");
  rs(f, "block", "T010", "--reason", "red storage tests", "--needs", "owner decision on the migration");
  const n = rs(f, "next");
  check("6b. every candidate parked -> finish, request present", n.action === "finish" && n.consolidatedApprovalRequest?.kind === "request", n);
  const body = readFileSync(rs(f, "finish").report, "utf8");
  check("6b. report carries the parked task's exact needed decision and the pending task", body.includes("owner decision on the migration") && body.includes("T020"), body);
}

// 7. Interrupted execution -> resumes without repeating work; H2: eligibility is re-checked on resume.
{
  const f = fixture({ auth: AUTH("T010 and T011"), cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1 }] });
  const first = rs(f, "init");
  rs(f, "start", "T010");
  const again = rs(f, "init"); // process restart / context loss
  check("7. init after interruption adopts the same run", again.resumed === true && again.runId === first.runId && again.current.task === "T010", again);
  const n = rs(f, "next");
  check("7. next resumes the in-progress task", n.action === "resume-task" && n.task === "T010", n);
  // crash after delivery + evidence were recorded and the tick landed, before run.current was cleared
  mkdirSync(join(f.dir, ".scratch/wanees-phases/phase-1"), { recursive: true });
  writeFileSync(join(f.dir, ".scratch/wanees-phases/phase-1/state.json"), JSON.stringify({ stage: "tracking", tasks: { T010: { status: "done", evidence: ["recorded before crash"] } } }));
  tick(f, "T010");
  const n2 = rs(f, "next");
  check("7. a task already done in reality is not redone", n2.action === "execute" && n2.task === "T011", n2);
  const shipped = ship(f, "T011");
  const dup = rs(f, "done", "T011", "--evidence", "e again", "--sha", shipped.sha);
  check("7. recording done twice does not duplicate", dup.recorded === false && rs(f, "report").run.completed.filter((c) => c.task === "T011").length === 1, dup);
  const stale = join(f.ev, "PHASE-COMPLETE.flag");
  writeFileSync(stale, "x");
  rs(f, "init", "--new");
  check("7. a leftover generic marker is renamed, never left to trigger shutdown", !existsSync(stale) && readdirSync(f.ev).some((x) => x.startsWith("PHASE-COMPLETE.flag.stale-")), readdirSync(f.ev));
}
{
  const f = fixture({ auth: AUTH("T010 and T011"), cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1 }] });
  rs(f, "init");
  rs(f, "start", "T010");
  writeFileSync(tasksPath(f), readFileSync(tasksPath(f), "utf8").replace("only.**", "only.**" + REVOKE("T010")));
  const n = rs(f, "next");
  check("7. H2 revoked mid-run: the in-progress task is parked, not resumed; T011 runs", n.action === "execute" && n.task === "T011" && n.parked.includes("T010"), n);
  check("7. H2 start of a non-candidate is refused", rs(f, "start", "T010").ok === false);
  const g = fixture({ auth: AUTH("T010"), cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1 }] });
  rs(g, "init");
  check("7. H2 start of an unauthorized task is refused", rs(g, "start", "T011").ok === false);
  check("7. H2 done without start is refused", rs(g, "done", "T010", "--evidence", "e", "--sha", fake(1)).ok === false);
}
{
  const f = fixture({ auth: AUTH("T010 and T020"), cards: [{ id: "T010", phase: 1 }, { id: "T020", phase: 2 }] });
  mkdirSync(join(f.dir, ".scratch/wanees-phases/phase-1"), { recursive: true });
  writeFileSync(join(f.dir, ".scratch/wanees-phases/phase-1/state.json"), JSON.stringify({ stage: "awaiting-owner", branch: "feat/wanees-phase-1", tasks: {} }));
  const st = statusOf(f.dir);
  check("7. M2 a Phase waiting on the owner never forces an endless resume", st.next.action === "run-phase" && st.parkedPhases.includes("phase-1"), st.next);
  rs(f, "init");
  check("7. M2 the loop continues with the queue", rs(f, "next").action === "execute");
}
{
  const f = fixture({ auth: AUTH("T010"), cards: [{ id: "T010", phase: 1 }] });
  mkdirSync(join(f.dir, ".scratch/wanees-phases/phase-1"), { recursive: true });
  writeFileSync(join(f.dir, ".scratch/wanees-phases/phase-1/state.json"), JSON.stringify({ stage: "tracking", tasks: { T010: { status: "done", evidence: ["delivered"] } } }));
  const st = statusOf(f.dir);
  check("7. M8 recorded-done without a local tick is done-pending-tick, never a candidate again", st.tasks.T010.status === "done-pending-tick" && st.queue.length === 0, st.tasks.T010);
}

// 8. Partial completion never writes a success marker; full completion does, only for a verified delivery.
{
  const f = fixture({ auth: AUTH("T010 and T011"), cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1 }] });
  const run = rs(f, "init");
  ship(f, "T010");
  const partial = rs(f, "finish");
  check("8. partial completion -> BLOCKED, no success flag", partial.outcome === "BLOCKED" && !files(f, run.runId).some((n) => n.startsWith("COMPLETE-")), [partial, files(f, run.runId)]);
  ship(f, "T011");
  const tip = execFileSync("git", ["rev-parse", "origin/main"], { cwd: f.dir, encoding: "utf8" }).trim();
  const full = rs(f, "finish");
  const flagPath = join(f.ev, "runs", run.runId, `COMPLETE-${run.runId}.flag`);
  check("8. full completion writes the flag with the exact content (main = verified origin/main tip)", full.outcome === "COMPLETE" && existsSync(flagPath)
    && readFileSync(flagPath, "utf8") === `PHASE_COMPLETE_SUCCESS runId=${run.runId} main=${tip} tasks=T010,T011\n`, full);
  check("8. the superseded BLOCKED report is set aside, not deleted", files(f, run.runId).some((n) => n.includes(".superseded-")), files(f, run.runId));
  const again = rs(f, "finish", "--run-id", run.runId);
  check("8. finish on an already finished run is refused (no stale flag)", again.ok === false, again);
}
{
  const f = fixture({ auth: AUTH("T010"), cards: [{ id: "T010", phase: 1 }] });
  const run = rs(f, "init");
  ship(f, "T010");
  writeFileSync(tasksPath(f), readFileSync(tasksPath(f), "utf8") + "\nlocal edit\n");
  const fin = rs(f, "finish");
  check("8c. a tasks.md that differs from origin/main -> no flag (judged on the delivered file)", fin.outcome === "BLOCKED" && fin.reasons.some((r) => r.includes("differs from origin/main")) && !files(f, run.runId).some((n) => n.startsWith("COMPLETE-")), fin);
}
{
  const f = fixture({ auth: AUTH("T010"), cards: [{ id: "T010", phase: 1 }] });
  rs(f, "init");
  ship(f, "T010");
  unlinkSync(join(f.dir, ".git/delegate-skills/project-config.sha256")); // fleet no longer trusted
  const fin = rs(f, "finish");
  check("8d. a fleet fault -> no flag", fin.outcome === "BLOCKED" && fin.reasons.some((r) => r.includes("fleet not OK")), fin);
}
{
  const f = fixture({ auth: AUTH("T010"), cards: [{ id: "T010", phase: 1 }, { id: "T900", phase: 8 }] });
  rs(f, "init");
  ship(f, "T010");
  const fin = rs(f, "finish");
  check("8e. a gated Phase 8 card keeps the success marker unreachable", fin.outcome === "BLOCKED" && fin.reasons.some((r) => r.includes("not verified done")), fin);
}
{
  const f = fixture({ auth: AUTH("T010 and T011"), cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1 }] });
  rs(f, "init");
  ship(f, "T010");
  rs(f, "start", "T011");
  rs(f, "block", "T011", "--reason", "r", "--needs", "n");
  const fin = rs(f, "finish");
  check("8b. a parked task alone prevents the success marker", fin.outcome === "BLOCKED" && fin.reasons.some((r) => r.includes("T011")), fin);
}

// 9. Run id validation, single writer, blocked Phase parked, worktree state resolution.
{
  const f = fixture({ auth: AUTH("T010"), cards: [{ id: "T010", phase: 1 }] });
  check("9. an invalid run id is refused", rs(f, "init", "--run-id", "../../evil").ok === false);
  const first = rs(f, "init");
  check("9. an existing run id is never overwritten", rs(f, "init", "--run-id", first.runId).ok === false);
  mkdirSync(join(f.dir, ".scratch/wanees-runs"), { recursive: true });
  writeFileSync(join(f.dir, ".scratch/wanees-runs/.lock"), `${process.pid} ${Date.now()}\n`);
  const locked = rs(f, "next");
  check("9. a second writer is refused while the lock is fresh", locked.ok === false && /another process/.test(locked.error), locked);
  unlinkSync(join(f.dir, ".scratch/wanees-runs/.lock"));
  check("9. the lock is released after a command", rs(f, "next").ok === true && !existsSync(join(f.dir, ".scratch/wanees-runs/.lock")));
}
{
  const f = fixture({ auth: AUTH("T010 and T020"), cards: [{ id: "T010", phase: 1 }, { id: "T020", phase: 2 }] });
  mkdirSync(join(f.dir, ".scratch/wanees-phases/phase-1"), { recursive: true });
  const stateFile = join(f.dir, ".scratch/wanees-phases/phase-1/state.json");
  writeFileSync(stateFile, JSON.stringify({ stage: "blocked", branch: "feat/wanees-phase-1", tasks: {} }));
  const st = statusOf(f.dir);
  check("9. blocked Phase is parked, next is not resume/stop", st.next.action === "run-phase" && st.parkedPhases.includes("phase-1"), st.next);
  writeFileSync(stateFile, JSON.stringify({ stage: "executing", branch: "feat/wanees-phase-1", tasks: {} }));
  check("9. an in-flight Phase still resumes", statusOf(f.dir).next.action === "resume");
  const wt = join(f.dir, "..", `wt-${Date.now()}`);
  execFileSync("git", ["worktree", "add", "-q", "-b", "deliver/x", wt], { cwd: f.dir });
  const fromWt = statusOf(wt);
  check("9. a delivery worktree sees the primary checkout's saved state and fleet trust", fromWt.savedPhases["phase-1"]?.stage === "executing" && fromWt.fleet.trusted === true, { saved: fromWt.savedPhases, trusted: fromWt.fleet.trusted });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
