#!/usr/bin/env node
// Regression tests for the continuous execution loop (run-state.mjs on top of phase-status.mjs).
// Builds synthetic repos and evidence roots in the OS temp dir; never writes to the project.
// Usage: node .agents/skills/wanees-phase/scripts/run-state.selftest.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
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
const sha = (n) => String(n).repeat(40).slice(0, 40);

// cards: [{id, phase, prereq?, readiness?}], auth: Status-block text
function fixture({ cards, auth = "", git = false }) {
  const dir = mkdtempSync(join(tmpdir(), "wanees-run-selftest-"));
  mkdirSync(join(dir, "specs/002-p0-prd"), { recursive: true });
  mkdirSync(join(dir, ".delegate"), { recursive: true });
  const phases = [...new Set(cards.map((c) => c.phase))].sort();
  let md = `# Tasks\n\n**Status**: ${auth}\n\n## Gate register\n\n| Gate | Source / required evidence | Direct blockers |\n|---|---|---|\n| G-IMPLEMENT | scoped | all |\n\n`;
  for (const p of phases) {
    md += `## Phase ${p}: Phase ${p} title\n\n`;
    for (const c of cards.filter((x) => x.phase === p)) md += `- [ ] ${c.id} Task ${c.id} in src/${c.id.toLowerCase()}/x.ts\n  - Readiness: ${c.readiness || APPROVED}\n  - Prerequisites: ${c.prereq || "G-IMPLEMENT"}\n`;
    md += "\n";
  }
  md += `## Dependencies and execution order\n\nnone\n`;
  writeFileSync(join(dir, "specs/002-p0-prd/tasks.md"), md);
  const cfg = JSON.stringify({ version: "delegate-fleet.v1", lanes: LANES });
  writeFileSync(join(dir, ".delegate/config.json"), cfg);
  execFileSync("git", ["init", "-q"], { cwd: dir });
  mkdirSync(join(dir, ".git/delegate-skills"), { recursive: true });
  writeFileSync(join(dir, ".git/delegate-skills/project-config.sha256"), createHash("sha256").update(cfg).digest("hex") + "\n");
  if (git) {
    execFileSync("git", ["add", "--", "specs"], { cwd: dir });
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", "fixture"], { cwd: dir });
  }
  const ev = mkdtempSync(join(tmpdir(), "wanees-evidence-selftest-"));
  return { dir, ev };
}
const tick = (f, id) => {
  const p = join(f.dir, "specs/002-p0-prd/tasks.md");
  writeFileSync(p, readFileSync(p, "utf8").replace(`- [ ] ${id} `, `- [x] ${id} `));
};
const rs = (f, ...args) => {
  const a = [RUNSTATE, ...args, "--repo", f.dir, "--evidence-root", f.ev];
  try { return JSON.parse(execFileSync("node", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })); }
  catch (e) { return JSON.parse(String(e.stdout)); }
};
const statusOf = (dir) => JSON.parse(execFileSync("node", [STATUS, "--repo", dir, "--json"], { encoding: "utf8", env: { ...process.env, WANEES_STATE_ROOT: "" } }));

let passed = 0, failed = 0;
const check = (name, cond, detail) => { console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ` :: ${JSON.stringify(detail)}`}`); cond ? passed++ : failed++; };
const AUTH = (list, extra = "") => `**Implementation authorization (owner, 2026-11-17${extra}): ${list} only.**`;
const flagFiles = (f, runId) => existsSync(join(f.ev, "runs", runId)) ? readdirSync(join(f.ev, "runs", runId)) : [];

// 1. Task completed -> next task starts automatically (no stop, no finish).
{
  const f = fixture({ auth: AUTH("T010 and T011"), cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1 }] });
  const run = rs(f, "init");
  const n1 = rs(f, "next");
  check("1. first next executes T010", n1.action === "execute" && n1.task === "T010", n1);
  rs(f, "start", "T010");
  rs(f, "done", "T010", "--evidence", "tests 3/3");
  const n2 = rs(f, "next");
  check("1. after T010 done, next executes T011 automatically", n2.action === "execute" && n2.task === "T011", n2);
  check("1. run id is stable", n2.runId === run.runId, [run, n2]);
}

// 2. Phase completed -> the next eligible Phase starts (one queue across all Phases).
{
  const f = fixture({ auth: AUTH("T010 and T020"), cards: [{ id: "T010", phase: 1 }, { id: "T020", phase: 2 }] });
  rs(f, "init");
  rs(f, "start", "T010");
  rs(f, "done", "T010", "--evidence", "ok");
  rs(f, "deliver", "--sha", sha(1), "--tasks", "T010");
  tick(f, "T010"); // the delivered commit on main carries the tick
  const n = rs(f, "next");
  check("2. Phase 1 complete -> next is Phase 2 task", n.action === "execute" && n.task === "T020" && n.phase === 2 && n.branch === "feat/wanees-phase-2", n);
}

// 3. CI passed and main updated -> execution continues; delivery is idempotent.
{
  const f = fixture({ auth: AUTH("T010 and T011"), cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1 }] });
  rs(f, "init");
  rs(f, "start", "T010");
  rs(f, "done", "T010", "--evidence", "ok");
  const d1 = rs(f, "deliver", "--sha", sha(2), "--tasks", "T010", "--ci", "https://example.invalid/run/1");
  rs(f, "deliver", "--sha", sha(2), "--tasks", "T010");
  const n = rs(f, "next");
  check("3. delivery recorded, next still executes (not finish)", d1.ok === true && n.action === "execute" && n.task === "T011", [d1, n]);
  const rep = rs(f, "report");
  check("3. delivery is recorded once", rep.run.deliveries.length === 1 && rep.run.completed[0].sha === sha(2), rep.run);
  const bad = rs(f, "deliver", "--sha", "abc", "--tasks", "T010");
  check("3. deliver rejects a short sha", bad.ok === false, bad);
}

// 4. Blocked task -> unrelated eligible task proceeds; its dependant is not selected.
{
  const f = fixture({ auth: AUTH("T010, T011 and T012"), cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1 }, { id: "T012", phase: 1, prereq: "T010; G-IMPLEMENT" }] });
  rs(f, "init");
  rs(f, "start", "T010");
  const b = rs(f, "block", "T010", "--reason", "CI red on storage tests", "--needs", "fix or owner decision");
  const n = rs(f, "next");
  check("4. T010 parked, T011 runs", b.ok && n.action === "execute" && n.task === "T011" && n.parked.includes("T010"), [b, n]);
  check("4. dependant T012 is not selected", n.remainingQueue.every((t) => t !== "T012"), n);
  rs(f, "block", "T010", "--reason", "again", "--needs", "again");
  check("4. blocking twice records one entry", rs(f, "report").run.blocked.length === 1);
}

// 5. Existing batch authorization -> no repeat approval prompt; batch label parsed.
{
  const f = fixture({ auth: AUTH("T010, T011 and T012", ", batch b2"), cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1 }, { id: "T012", phase: 2 }] });
  const st = statusOf(f.dir);
  check("5. batch label parsed, three tasks authorized", st.authorizations[0].batch === "b2" && st.authorizations[0].tasks.length === 3, st.authorizations);
  rs(f, "init");
  const seen = [];
  for (let i = 0; i < 3; i += 1) {
    const n = rs(f, "next");
    seen.push(n.action + ":" + n.task);
    rs(f, "start", n.task);
    rs(f, "done", n.task, "--evidence", "ok");
  }
  check("5. all three batch tasks run without any approval request", seen.join() === "execute:T010,execute:T011,execute:T012", seen);
  check("5. no consolidated approval while tasks are eligible", statusOf(f.dir).next.consolidatedApproval === undefined);
}

// 6. All tasks blocked -> ONE consolidated blocker report, no success marker.
{
  const f = fixture({ auth: "", cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1, prereq: "T010; G-IMPLEMENT" }, { id: "T020", phase: 2, readiness: "structure only; not approved at Gate 2" }] });
  const run = rs(f, "init");
  const n = rs(f, "next");
  check("6. nothing eligible -> finish BLOCKED with reasons", n.action === "finish" && n.wouldBe === "BLOCKED" && n.reasons.length > 0, n);
  const fin = rs(f, "finish");
  const files = flagFiles(f, run.runId);
  check("6. exactly one BLOCKED report, no COMPLETE flag", fin.outcome === "BLOCKED" && files.join() === `BLOCKED-${run.runId}.md`, files);
  const body = readFileSync(fin.report, "utf8");
  check("6. report is ONE consolidated request listing every pending task", (body.match(/ONE consolidated approval request/g) || []).length === 1 && ["T010", "T011", "T020"].every((t) => body.includes(t)), body);
  rs(f, "finish");
  check("6. repeating finish does not duplicate the report or write a flag", flagFiles(f, run.runId).join() === `BLOCKED-${run.runId}.md`);
}

// 7. Interrupted execution -> resumes without repeating work.
{
  const f = fixture({ auth: AUTH("T010 and T011"), cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1 }] });
  const first = rs(f, "init");
  rs(f, "start", "T010");
  // process restart / context loss: a new init adopts the unfinished run
  const again = rs(f, "init");
  check("7. init after interruption adopts the same run", again.resumed === true && again.runId === first.runId && again.current.task === "T010", again);
  const n = rs(f, "next");
  check("7. next resumes the in-progress task", n.action === "resume-task" && n.task === "T010", n);
  // crash after the evidence was recorded in the phase state and the tick landed, but before run.current was cleared
  mkdirSync(join(f.dir, ".scratch/wanees-phases/phase-1"), { recursive: true });
  writeFileSync(join(f.dir, ".scratch/wanees-phases/phase-1/state.json"), JSON.stringify({ stage: "tracking", tasks: { T010: { status: "done", evidence: ["recorded before crash"] } } }));
  tick(f, "T010");
  const n2 = rs(f, "next");
  check("7. a task already done in reality is not redone", n2.action === "execute" && n2.task === "T011", n2);
  rs(f, "start", "T011");
  rs(f, "done", "T011", "--evidence", "e");
  const dup = rs(f, "done", "T011", "--evidence", "e again");
  check("7. recording done twice does not duplicate", dup.recorded === false && rs(f, "report").run.completed.filter((c) => c.task === "T011").length === 1, dup);
  const stale = join(f.ev, "PHASE-COMPLETE.flag");
  writeFileSync(stale, "x");
  rs(f, "init", "--new");
  check("7. a leftover generic marker is renamed, never left to trigger shutdown", !existsSync(stale) && readdirSync(f.ev).some((n) => n.startsWith("PHASE-COMPLETE.flag.stale-")), readdirSync(f.ev));
}

// 8. Partial completion never writes a success marker; full completion does, with the exact line.
{
  const f = fixture({ auth: AUTH("T010 and T011"), cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1 }] });
  const run = rs(f, "init");
  rs(f, "start", "T010");
  rs(f, "done", "T010", "--evidence", "ok");
  rs(f, "deliver", "--sha", sha(3), "--tasks", "T010");
  tick(f, "T010");
  const partial = rs(f, "finish");
  check("8. partial completion -> BLOCKED, no success flag", partial.outcome === "BLOCKED" && !flagFiles(f, run.runId).some((n) => n.startsWith("COMPLETE-")), [partial, flagFiles(f, run.runId)]);
  rs(f, "start", "T011");
  rs(f, "done", "T011", "--evidence", "ok");
  const undelivered = rs(f, "finish");
  check("8. completed but undelivered work -> still BLOCKED", undelivered.outcome === "BLOCKED" && undelivered.reasons.some((r) => r.includes("not delivered")), undelivered);
  rs(f, "deliver", "--sha", sha(4), "--tasks", "T011");
  tick(f, "T011");
  const full = rs(f, "finish");
  const flagPath = join(f.ev, "runs", run.runId, `COMPLETE-${run.runId}.flag`);
  check("8. full completion writes the flag with the exact content", full.outcome === "COMPLETE" && existsSync(flagPath)
    && readFileSync(flagPath, "utf8") === `PHASE_COMPLETE_SUCCESS runId=${run.runId} main=${sha(4)} tasks=T010,T011\n`, full);
  check("8. the superseded BLOCKED report is set aside, not deleted", readdirSync(join(f.ev, "runs", run.runId)).some((n) => n.includes(".superseded-")), readdirSync(join(f.ev, "runs", run.runId)));
}

// 8b. A blocked task alone prevents the success marker even if everything else is done.
{
  const f = fixture({ auth: AUTH("T010 and T011"), cards: [{ id: "T010", phase: 1 }, { id: "T011", phase: 1 }] });
  rs(f, "init");
  rs(f, "start", "T010"); rs(f, "done", "T010", "--evidence", "ok"); rs(f, "deliver", "--sha", sha(5), "--tasks", "T010"); tick(f, "T010");
  rs(f, "block", "T011", "--reason", "r", "--needs", "n");
  const fin = rs(f, "finish");
  check("8b. blocked task -> no success marker", fin.outcome === "BLOCKED" && fin.reasons.some((r) => r.includes("T011")), fin);
}

// 9. A blocked Phase is parked (never forces resume); an active Phase still resumes; state resolves from a delivery worktree.
{
  const f = fixture({ auth: AUTH("T010 and T020"), cards: [{ id: "T010", phase: 1 }, { id: "T020", phase: 2 }], git: true });
  mkdirSync(join(f.dir, ".scratch/wanees-phases/phase-1"), { recursive: true });
  writeFileSync(join(f.dir, ".scratch/wanees-phases/phase-1/state.json"), JSON.stringify({ stage: "blocked", branch: "feat/wanees-phase-1", tasks: {} }));
  const st = statusOf(f.dir);
  check("9. blocked Phase is parked, next is not resume/stop", st.next.action === "run-phase" && st.parkedPhases.includes("phase-1"), st.next);
  writeFileSync(join(f.dir, ".scratch/wanees-phases/phase-1/state.json"), JSON.stringify({ stage: "executing", branch: "feat/wanees-phase-1", tasks: {} }));
  check("9. an active Phase still resumes", statusOf(f.dir).next.action === "resume");
  const wt = join(f.dir, "..", `wt-${Date.now()}`);
  execFileSync("git", ["worktree", "add", "-q", "-b", "deliver/x", wt], { cwd: f.dir });
  const fromWt = statusOf(wt);
  check("9. a delivery worktree sees the primary checkout's saved state and fleet trust", fromWt.savedPhases["phase-1"]?.stage === "executing" && fromWt.fleet.trusted === true, { saved: fromWt.savedPhases, trusted: fromWt.fleet.trusted });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
