#!/usr/bin/env node
// wanees-phase: run-level state for the continuous execution loop (SKILL.md section 0).
//   Load State -> Select Eligible Task -> Spec Kit Implement -> Test -> Independent Review -> Deliver -> Update State -> Select Next Task
// This script owns the DURABLE RECORD only. It runs only read-only Git queries (rev-parse, merge-base), never delegates, never touches the network and never edits
// tasks.md, the Gate register or any approval. Task classification always comes from phase-status.mjs (one source of truth).
// Writes only under <state-root>/wanees-runs/<runId>/ (run.json), <state-root>/wanees-phases/phase-<n>/state.json (task
// evidence, the same file phase-status.mjs reads) and <evidence-root>/runs/<runId>/ (COMPLETE/BLOCKED markers).
//
// Usage: node run-state.mjs <command> [options]   (all commands print JSON)
//   init     [--run-id <id>] [--new]            start a run, or adopt the latest unfinished run (resume after compaction/restart)
//   next                                         what to do now: execute | resume-task | finish
//   start    <task>                              checkpoint: <task> is in progress (idempotent)
//   deliver  --sha <sha> --tasks <T> --ci <url>            record a verified fast-forward delivery of the in-progress task to main (idempotent per sha)
//   done     <task> --evidence <text> --sha <sha>          record completion AFTER its delivery; only for the task started in this run
//   block    <task> --reason <text> --needs <text>         park <task> (idempotent); the run continues with other tasks
//   unblock  <task>                              clear a run-level park (for example after the cause is fixed)
//   finish                                       write COMPLETE-<runId>.flag only if the completion criteria hold, else BLOCKED-<runId>.md
//   report                                       print the run record and the consolidated blocker view, writing nothing
// Options: --repo <dir>  --state-root <dir> (default: <primary checkout>/.scratch)  --evidence-root <dir> (default D:\Wanees-Delegation-Evidence)
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync, openSync, closeSync, unlinkSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const has = (n) => argv.includes(n);
const positional = argv[1] && !argv[1].startsWith("--") ? argv[1] : undefined;
const repo = resolve(flag("--repo") || process.cwd());
const STATUS = join(dirname(fileURLToPath(import.meta.url)), "phase-status.mjs");
const EVIDENCE_ROOT = flag("--evidence-root") || process.env.WANEES_EVIDENCE_ROOT || "D:\\Wanees-Delegation-Evidence";

const gitQuiet = (...a) => { try { return execFileSync("git", ["--no-optional-locks", ...a], { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; } };
const common = gitQuiet("rev-parse", "--git-common-dir");
const primary = common ? dirname(resolve(repo, common)) : repo;
const STATE_ROOT = resolve(flag("--state-root") || process.env.WANEES_STATE_ROOT || join(primary, ".scratch"));
const RUNS = join(STATE_ROOT, "wanees-runs");
const PHASES = join(STATE_ROOT, "wanees-phases");

const now = () => new Date().toISOString();
const RUN_ID = /^wanees-\d{8}T\d{6}Z-[0-9a-f]{8}$/;
// Single writer: an exclusive lock file for the whole command (a stale lock older than 2 minutes is replaced).
if (cmd !== "report" && cmd !== undefined) {
  mkdirSync(RUNS, { recursive: true });
  const lock = join(RUNS, ".lock");
  const take = () => { const fd = openSync(lock, "wx"); writeFileSync(fd, `${process.pid} ${Date.now()}\n`); closeSync(fd); };
  try { take(); } catch (e) {
    if (e.code !== "EEXIST") throw e;
    let age = 0;
    try { age = Date.now() - statSync(lock).mtimeMs; } catch { age = Infinity; } // the lock vanished between EEXIST and stat: retry below
    if (age < 120000) { console.log(JSON.stringify({ ok: false, error: "another process is writing this run; retry once it finishes" })); process.exit(1); }
    try { unlinkSync(lock); } catch { /* released meanwhile */ }
    take();
  }
  process.on("exit", () => { try { unlinkSync(lock); } catch { /* already gone */ } });
}
const fail = (msg, extra = {}) => { console.log(JSON.stringify({ ok: false, error: msg, ...extra }, null, 2)); process.exit(1); };
const out = (o) => { console.log(JSON.stringify({ ok: true, ...o }, null, 2)); process.exit(0); };
// Atomic write: temporary file in the same directory, then rename.
const atomic = (path, data) => { mkdirSync(dirname(path), { recursive: true }); const tmp = `${path}.tmp-${process.pid}`; writeFileSync(tmp, data); renameSync(tmp, path); };
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

function status() {
  const env = { ...process.env, WANEES_STATE_ROOT: STATE_ROOT };
  try { return JSON.parse(execFileSync("node", [STATUS, "--repo", repo, "--json"], { encoding: "utf8", env, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 })); }
  catch (e) { return fail("phase-status.mjs failed; repair before any task work", { detail: String(e.message || e).slice(0, 300) }); }
}

// ---------- run record ----------
const runDir = (id) => join(RUNS, id);
const runFile = (id) => join(runDir(id), "run.json");
function latestUnfinished() {
  if (!existsSync(RUNS)) return null;
  const ids = readdirSync(RUNS, { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(runFile(e.name))).map((e) => e.name).sort();
  for (const id of ids.reverse()) { const r = readJson(runFile(id)); if (!r.finished) return r; }
  return null;
}
function activeRun() {
  const id = flag("--run-id");
  if (id) { if (!RUN_ID.test(id) || !existsSync(runFile(id))) return fail(`unknown run ${id}`); return readJson(runFile(id)); }
  const r = latestUnfinished();
  return r || fail("no unfinished run; call init first");
}
const save = (r) => { r.updatedAt = now(); atomic(runFile(r.runId), JSON.stringify(r, null, 2) + "\n"); };
const evidenceDir = (r) => join(EVIDENCE_ROOT, "runs", r.runId);

// ---------- task evidence lives in the Phase state.json files that phase-status.mjs reads ----------
function phaseStateFile(phase) { return join(PHASES, `phase-${phase}`, "state.json"); }
function recordTaskDone(phase, id, evidence) {
  const f = phaseStateFile(phase);
  let s = { schema: "wanees-phase.v1", phase: { id: phase }, branch: `feat/wanees-phase-${phase}`, stage: "tracking", delivery: "direct-main", tasks: {}, blockers: [] };
  if (existsSync(f)) s = readJson(f);
  s.tasks = s.tasks || {};
  const t = s.tasks[id] || {};
  if (t.status === "done" && (t.evidence || []).length) return false; // never record completion twice
  s.tasks[id] = { ...t, status: "done", evidence: [...(t.evidence || []), evidence] };
  atomic(f, JSON.stringify(s, null, 2) + "\n");
  return true;
}
const phaseOf = (st, id) => st.tasks[id]?.phase;
const isDoneInState = (st, id) => st.tasks[id]?.status === "done";

// ---------- decision ----------
function decide(r, st) {
  // A task recorded done (this run, or verified done in tasks.md plus evidence) is never re-queued, even if run.current still names it
  // (interrupted before the clear) or its tasks.md tick has not landed on main yet.
  const doneHere = new Set(r.completed.map((c) => c.task));
  const parkedNow = () => new Set(r.blocked.map((b) => b.task));
  if (r.current && (doneHere.has(r.current.task) || isDoneInState(st, r.current.task))) { r.current = null; }
  if (r.current && r.deliveries.some((d) => d.tasks.includes(r.current.task))) {
    const d = r.deliveries.find((x) => x.tasks.includes(r.current.task));
    return { action: "record-done", task: r.current.task, sha: d.sha, call: `run-state.mjs done ${r.current.task} --evidence "<counts>" --sha ${d.sha}`, note: "delivered; record it, fast-forward this checkout to origin/main, then next" };
  }
  if (r.current) {
    const cs = st.tasks[r.current.task];
    if (cs && (cs.status === "done" || cs.status === "done-pending-tick")) r.current = null; // finished elsewhere: never redone
    else if (!cs || cs.status !== "candidate") {
      // Authorization revoked, gate reopened or card changed since the checkpoint: it must not resume.
      const why = cs ? `no longer eligible (${cs.status}): ${cs.why || "reclassified"}` : "task no longer exists in tasks.md";
      r.blocked.push({ task: r.current.task, reason: why, needs: "owner decision or restored eligibility", at: now() });
      r.checkpoints.push({ at: now(), event: "auto-park", task: r.current.task });
      r.current = null;
    }
  }
  if (r.current) return { action: "resume-task", task: r.current.task, phase: r.current.phase, since: r.current.since, note: "continue this task from its recorded checkpoint; re-verify the working tree, do not restart reviews of unchanged content" };
  if (st.next.action === "stop") return { action: "finish", reason: st.next.reason, needsOwner: false, environmentFault: true };
  if (st.next.action === "resume") return { action: "resume-phase", state: st.next.state, stage: st.next.stage, queue: st.queue.filter((q) => !parkedNow().has(q.id) && !doneHere.has(q.id)), note: "an active Phase is recorded: verify it against Git, then finish it before selecting" };
  const parked = parkedNow();
  const candidate = st.queue.find((q) => !parked.has(q.id) && !doneHere.has(q.id));
  if (candidate) return { action: "execute", task: candidate.id, phase: candidate.phase, branch: candidate.branch, remainingQueue: st.queue.filter((q) => q.id !== candidate.id && !parked.has(q.id) && !doneHere.has(q.id)).map((q) => q.id), parked: [...parked] };
  return { action: "finish", reason: "no eligible task remains in the whole dependency graph", needsOwner: true };
}

function completion(r, st) {
  const reasons = [];
  if (r.completed.length === 0) reasons.push("no task was executed in this run");
  if (r.current) reasons.push(`task ${r.current.task} is still in progress`);
  if (r.blocked.length) reasons.push(`blocked tasks recorded: ${r.blocked.map((b) => b.task).join(", ")}`);
  if (st.totals.done !== st.totals.cards) reasons.push(`${st.totals.cards - st.totals.done} of ${st.totals.cards} cards are not verified done`);
  const eligible = st.queue.filter((q) => !r.completed.some((c) => c.task === q.id));
  if (eligible.length) reasons.push(`eligible tasks remain: ${eligible.map((q) => q.id).join(", ")}`);
  if (!r.deliveries.length) reasons.push("no verified delivery to main is recorded");
  if (gitQuiet("diff", "--quiet", "origin/main", "--", "specs/002-p0-prd/tasks.md") === null) reasons.push("this checkout's tasks.md differs from origin/main (fast-forward first): completion is judged on the delivered file");
  if (st.parkedPhases.length) reasons.push(`Phases parked on the owner: ${st.parkedPhases.join(", ")}`);
  const tip = gitQuiet("rev-parse", "origin/main");
  if (!tip) reasons.push("origin/main is not resolvable (fetch first)");
  else {
    const notOnMain = r.deliveries.filter((d) => gitQuiet("merge-base", "--is-ancestor", d.sha, "origin/main") === null);
    if (notOnMain.length) reasons.push(`recorded delivery not an ancestor of origin/main: ${notOnMain.map((d) => d.sha.slice(0, 12)).join(", ")}`);
  }
  if (r.deliveries.some((d) => !d.ci)) reasons.push("a recorded delivery has no CI evidence");
  const undelivered = r.completed.filter((c) => !r.deliveries.some((d) => d.tasks.includes(c.task)));
  if (undelivered.length) reasons.push(`completed but not delivered: ${undelivered.map((c) => c.task).join(", ")}`);
  if (!st.fleet.ok) reasons.push(`fleet not OK: ${st.fleet.problems.join("; ")}`);
  return { complete: reasons.length === 0, reasons };
}

function blockedReport(r, st, why) {
  const L = [];
  L.push(`# BLOCKED — run ${r.runId}`, "", `Written ${now()}. This run did not complete. Reasons:`, ...why.map((x) => `- ${x}`), "");
  L.push("## Completed in this run", ...(r.completed.length ? r.completed.map((c) => `- ${c.task}: ${c.evidence}${c.sha ? ` (main ${c.sha})` : ""}`) : ["- none"]), "");
  L.push("## Deliveries to main", ...(r.deliveries.length ? r.deliveries.map((d) => `- ${d.sha}: ${d.tasks.join(", ")}${d.ci ? ` (CI ${d.ci})` : ""}`) : ["- none"]), "");
  L.push("## Run-level blocked tasks", ...(r.blocked.length ? r.blocked.map((b) => `- ${b.task}: ${b.reason} | needs: ${b.needs}`) : ["- none"]), "");
  L.push("## Everything not done (exact approvals or dependencies needed)", ...st.blockers.map((b) => `- ${b.id} [P${b.phase}] ${b.status}: ${b.needs}${b.ownerNeeded ? " (OWNER)" : ""}`), "");
  const c = st.consolidatedApprovalRequest;
  L.push("## ONE consolidated approval request (owner) — a request only; it grants nothing", `Tasks (${c.tasks.length}): ${c.tasks.map((t) => t.id).join(", ") || "none"}`, `Gates to close: ${c.gatesToClose.join(", ") || "none"}`,
    ...(c.entryGatesAfterT001.length ? [`Entry gates satisfied only through T001: ${c.entryGatesAfterT001.join(", ")}`] : []),
    ...(c.authorizedTasksWaitingOnGates.length ? ["Authorized tasks waiting only on gates:", ...c.authorizedTasksWaitingOnGates.map((t) => `- ${t.id}: ${t.gates.join(", ")}`)] : []),
    ...(r.blocked.length ? ["Run-level parked tasks and the exact decision each needs:", ...r.blocked.map((b) => `- ${b.task}: ${b.needs}`)] : []),
    ...(c.excluded.length ? ["Not requestable yet:", ...c.excluded.map((e) => `- ${e.id}: ${e.why}`)] : []), "");
  if (st.parkedPhases.length) L.push("## Phases parked on the owner", ...st.parkedPhases.map((x) => `- ${x}`), "");
  L.push(`Totals: ${st.totals.done}/${st.totals.cards} cards done; ${st.totals.candidates} eligible; ${st.totals.blocked} not done.`, "");
  return L.join("\n");
}

// ---------- commands ----------
if (cmd === "init") {
  if (flag("--run-id") && (!RUN_ID.test(flag("--run-id")) || existsSync(runFile(flag("--run-id"))))) fail("--run-id is invalid or already exists; init without --run-id adopts the unfinished run");
  let r = has("--new") ? null : latestUnfinished();
  const resumed = !!r;
  if (!r) {
    const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const runId = flag("--run-id") || `wanees-${ts}-${randomBytes(4).toString("hex")}`;
    if (!RUN_ID.test(runId)) fail("--run-id must match wanees-<yyyymmddThhmmssZ>-<8 hex>");
    if (existsSync(runFile(runId))) fail(`run ${runId} already exists; init without --run-id adopts the unfinished run`);
    r = { schema: "wanees-run.v1", runId, startedAt: now(), baseMain: gitQuiet("rev-parse", "origin/main"), finished: null, current: null, completed: [], blocked: [], deliveries: [], checkpoints: [] };
    // A leftover generic marker is renamed (never deleted) so it can never trigger shutdown for this run.
    const generic = join(EVIDENCE_ROOT, "PHASE-COMPLETE.flag");
    if (existsSync(generic)) renameSync(generic, `${generic}.stale-${ts}`);
    mkdirSync(evidenceDir(r), { recursive: true });
    save(r);
  }
  out({ runId: r.runId, resumed, completed: r.completed.map((c) => c.task), blocked: r.blocked.map((b) => b.task), current: r.current });
}

const r = activeRun();
const requireTask = () => positional || fail("task id required");

if (cmd === "next") {
  const st = status();
  const d = decide(r, st);
  save(r);
  if (d.action === "finish") {
    const c = completion(r, st);
    out({ ...d, runId: r.runId, wouldBe: c.complete ? "COMPLETE" : "BLOCKED", reasons: c.reasons, consolidatedApprovalRequest: st.consolidatedApprovalRequest, call: "run-state.mjs finish" });
  }
  out({ ...d, runId: r.runId, totals: st.totals });
}
if (cmd === "start") {
  const id = requireTask();
  const st = status();
  const c = st.tasks[id];
  if (!c) fail(`unknown task ${id}`);
  if (r.current && r.current.task !== id) fail(`task ${r.current.task} is in progress; finish or block it first`);
  if (c.status === "done" || c.status === "done-pending-tick") out({ task: id, note: "already done; nothing to start", skipped: true });
  if (r.blocked.some((b) => b.task === id)) fail(`${id} is parked; unblock it first`);
  if (c.status !== "candidate") fail(`${id} is not eligible (${c.status}): ${c.why || ""}`);
  if (r.current && r.current.session && flag("--session") && r.current.session !== flag("--session")) fail(`${id} is held by another session`);
  if (!r.current) { r.current = { task: id, phase: c.phase, since: now(), ...(flag("--session") ? { session: flag("--session") } : {}) }; r.checkpoints.push({ at: now(), event: "start", task: id }); save(r); }
  out({ task: id, phase: c.phase, current: r.current });
}
if (cmd === "done") {
  const id = requireTask();
  const evidence = flag("--evidence");
  if (!evidence || !evidence.trim()) fail("--evidence is required: a task is done only with recorded acceptance evidence");
  const doneSha = flag("--sha");
  if (!r.completed.some((x) => x.task === id)) {
    if (!r.deliveries.some((d) => d.sha === doneSha && d.tasks.includes(id))) fail(`${id} has no recorded delivery with --sha ${doneSha}: done is recorded only after verification, review and delivery`);
  }
  const st = status();
  const c = st.tasks[id];
  if (!c) fail(`unknown task ${id}`);
  const fresh = recordTaskDone(c.phase, id, evidence);
  if (!r.completed.some((x) => x.task === id)) r.completed.push({ task: id, phase: c.phase, evidence, at: now(), sha: doneSha });
  r.blocked = r.blocked.filter((b) => b.task !== id);
  if (r.current && r.current.task === id) r.current = null;
  r.checkpoints.push({ at: now(), event: "done", task: id });
  save(r);
  out({ task: id, recorded: fresh, completed: r.completed.map((x) => x.task), note: "tasks.md [x] edit is still required in the delivery commit" });
}
if (cmd === "block") {
  const id = requireTask();
  if (r.completed.some((x) => x.task === id)) fail(`${id} is already done and delivered; a delivered task cannot be parked`);
  const reason = flag("--reason"), needs = flag("--needs");
  if (!reason || !needs) fail("--reason and --needs are required (the exact approval or fix that unblocks it)");
  if (!r.blocked.some((b) => b.task === id)) r.blocked.push({ task: id, reason, needs, at: now() });
  if (r.current && r.current.task === id) r.current = null;
  r.checkpoints.push({ at: now(), event: "block", task: id });
  save(r);
  out({ task: id, blocked: r.blocked.map((b) => b.task), note: "the run continues with other eligible tasks" });
}
if (cmd === "unblock") {
  const id = requireTask();
  r.blocked = r.blocked.filter((b) => b.task !== id);
  save(r);
  out({ task: id, blocked: r.blocked.map((b) => b.task) });
}
if (cmd === "deliver") {
  const sha = flag("--sha"), tasks = (flag("--tasks") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!/^[0-9a-f]{40}$/.test(sha || "")) fail("--sha must be a full 40-hex commit id");
  if (!tasks.length) fail("--tasks is required");
  if (!flag("--ci") || !flag("--ci").trim()) fail("--ci is required: the URL or id of the green verify run on this exact sha");
  if (tasks.some((t) => !r.current || r.current.task !== t) && !tasks.every((t) => r.completed.some((x) => x.task === t))) fail(`deliver covers only the task in progress (${r.current ? r.current.task : "none"}); the loop is serial`);
  if (!r.deliveries.some((d) => d.sha === sha)) {
    // Verified, not merely well-formed (read-only Git): a real commit, now on origin/main, newer than the run's base and than every earlier
    // delivery, whose tasks.md carries the [x] of every listed task.
    if (gitQuiet("cat-file", "-e", `${sha}^{commit}`) === null) fail(`${sha} is not a commit in this repository (fetch first)`);
    if (gitQuiet("merge-base", "--is-ancestor", sha, "origin/main") === null) fail(`${sha} is not on origin/main: push it fast-forward first`);
    const older = [r.baseMain, ...r.deliveries.map((d) => d.sha)].filter(Boolean);
    const stale = older.find((o) => gitQuiet("merge-base", "--is-ancestor", sha, o) !== null);
    if (stale) fail(`${sha} is not newer than ${stale.slice(0, 12)} (the run base or an earlier delivery); a delivery must be a new commit`);
    const tm = gitQuiet("show", `${sha}:specs/002-p0-prd/tasks.md`) || "";
    const unticked = tasks.filter((t) => !new RegExp(`^- \\[[xX]\\] ${t}\\b`, "m").test(tm.replace(/\r\n/g, "\n")));
    if (unticked.length) fail(`tasks.md at ${sha.slice(0, 12)} has no [x] for ${unticked.join(", ")}: the delivered commit must tick the task`);
  }
  if (!r.deliveries.some((d) => d.sha === sha)) r.deliveries.push({ sha, tasks, ...(flag("--ci") ? { ci: flag("--ci") } : {}), at: now() });
  for (const c of r.completed) if (tasks.includes(c.task) && !c.sha) c.sha = sha;
  r.checkpoints.push({ at: now(), event: "deliver", sha });
  save(r);
  out({ delivered: sha, tasks, note: `delivery recorded; now: run-state.mjs done ${tasks[0]} --evidence "<counts>" --sha ${sha}, then fast-forward this checkout to origin/main, then next` });
}
if (cmd === "report") {
  const st = status();
  out({ run: r, completion: completion(r, st), next: decide(r, st), consolidatedApprovalRequest: st.consolidatedApprovalRequest, blockers: st.blockers, totals: st.totals });
}
if (cmd === "finish") {
  if (r.finished) fail(`run ${r.runId} already finished (${r.finished.outcome}); start a new run`);
  const st = status();
  decide(r, st);
  const c = completion(r, st);
  const dir = evidenceDir(r);
  mkdirSync(dir, { recursive: true });
  const flagPath = join(dir, `COMPLETE-${r.runId}.flag`);
  const blockedPath = join(dir, `BLOCKED-${r.runId}.md`);
  if (c.complete) {
    const mainSha = gitQuiet("rev-parse", "origin/main");
    if (existsSync(blockedPath)) renameSync(blockedPath, `${blockedPath}.superseded-${Date.now()}`);
    atomic(flagPath, `PHASE_COMPLETE_SUCCESS runId=${r.runId} main=${mainSha} tasks=${r.completed.map((x) => x.task).join(",")}\n`);
    r.finished = { at: now(), outcome: "COMPLETE" };
    save(r);
    out({ outcome: "COMPLETE", flag: flagPath });
  }
  // Never a success marker for partial work. A marker left from an earlier call is set aside, not deleted.
  if (existsSync(flagPath)) renameSync(flagPath, `${flagPath}.stale-${Date.now()}`);
  atomic(blockedPath, blockedReport(r, st, c.reasons));
  // Not marked finished: a later call (after owner decisions) resumes the same run and may still complete it.
  save(r);
  out({ outcome: "BLOCKED", report: blockedPath, reasons: c.reasons, consolidatedApprovalRequest: st.consolidatedApprovalRequest });
}
fail(`unknown command ${cmd || "(none)"}`, { usage: "init|next|start|done|block|unblock|deliver|finish|report" });
