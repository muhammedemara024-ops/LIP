#!/usr/bin/env node
// wanees-phase: read-only Phase status for specs/002-p0-prd/tasks.md.
// Never writes files, never runs a delegate, never touches the network.
// Git is called with --no-optional-locks, so no index refresh or lock happens.
// Usage: node phase-status.mjs [--repo <dir>] [--phase <n>] [--json]
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const repo = opt("--repo", process.cwd());
const onlyPhase = opt("--phase", null);
const asJson = args.includes("--json");

const TASKS = join(repo, "specs/002-p0-prd/tasks.md");
const GATED_PHASE = /gated tracks/i; // "Phase 8: Gated tracks — no implementation schedule"
const warnings = [];

const git = (...a) => {
  try { return execFileSync("git", ["--no-optional-locks", ...a], { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return null; }
};
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
// Untracked state (.scratch), the delegate config and the delegate trust record live in the PRIMARY checkout. A delivery
// worktree has none of them, so resolve the primary root through the shared Git directory, never the worktree's own.
const commonDirRaw = git("rev-parse", "--git-common-dir");
const commonDir = commonDirRaw ? resolve(repo, commonDirRaw) : null;
const primary = commonDir ? dirname(commonDir) : repo;
const STATE_DIR = process.env.WANEES_STATE_ROOT ? join(process.env.WANEES_STATE_ROOT, "wanees-phases") : join(primary, ".scratch/wanees-phases");
const CONFIG = existsSync(join(repo, ".delegate/config.json")) ? join(repo, ".delegate/config.json") : join(primary, ".delegate/config.json");

// ---------- parse tasks.md ----------
const text = readFileSync(TASKS, "utf8").replace(/\r\n/g, "\n");
const phases = [];
const tasks = new Map();
let phase = null, card = null;
for (const line of text.split("\n")) {
  const ph = line.match(/^## Phase (\d+): (.+)$/);
  if (ph) { phase = { id: Number(ph[1]), title: ph[2].trim(), gated: GATED_PHASE.test(ph[2]), tasks: [] }; phases.push(phase); card = null; continue; }
  if (/^## /.test(line)) { phase = null; card = null; continue; }
  const hd = line.match(/^- \[([ xX])\] (T\d{3})\s+(.*)$/);
  if (hd && phase) {
    const pathM = hd[3].match(/ in (\S+)\s*$/);
    card = { id: hd[2], done: hd[1] !== " ", title: hd[3], primaryPath: pathM ? pathM[1] : null, phase: phase.id,
      prerequisites: "", readiness: "", risk: null, plannedTarget: null };
    tasks.set(card.id, card); phase.tasks.push(card.id); continue;
  }
  if (!card) continue;
  const f = line.match(/^\s+- (Prerequisites|Readiness|Executor|Executor class|Risk and review):\s*(.*)$/);
  if (!f) continue;
  if (f[1] === "Prerequisites") card.prerequisites = f[2];
  if (f[1] === "Readiness") card.readiness = f[2];
  const risk = f[2].match(/\bRisk:\s*(LOW|MEDIUM|HIGH|CRITICAL)\b/) || (f[1] === "Risk and review" && f[2].match(/^(LOW|MEDIUM|HIGH|CRITICAL)\b/));
  if (risk && !card.risk) card.risk = risk[1];
  const tgt = f[2].match(/planned target:\s*(mechanical|reasoning)/) || f[2].match(/then `?(mechanical|reasoning)`?/);
  if (tgt && !card.plannedTarget) card.plannedTarget = tgt[1];
}

// ---------- Gate register: gate -> evidence cell. Only a cell starting with "Closed" counts as closed. ----------
// The third column ("Direct cards") names the cards each gate blocks directly. Cells starting "none" or
// "all cards", and gate-to-gate entries, add no card edge.
const register = new Map();
const directCards = new Map(); // gate -> [T###]
const regSection = text.split("\n## Gate register")[1]?.split("\n## ")[0] || "";
for (const line of regSection.split("\n")) {
  const m = line.match(/^\|\s*`?([A-Za-z][\w/-]*)`?\s*\|\s*([^|]*)\|\s*([^|]*)\|?/);
  if (!m || m[1] === "Gate") continue;
  register.set(m[1], m[2].trim());
  const cell = m[3].trim();
  if (!/^(none|all cards)\b/i.test(cell)) directCards.set(m[1], [...new Set(cell.match(/\bT\d{3}\b/g) || [])]);
}

// ---------- Entry-evidence verifiers (approved definitions; fail closed) ----------
// Some gates are "entry gates" whose approved definition lists the conditions T001 needs to START, while the gate's
// remaining element is T001's own output. The register cell therefore never reads "Closed", by design.
//   backend-entry = BE-1..BE-7 only; BE-8 is T001's output, "T001 never requires its own output"
//     (backend-first-amendment.md §2 E line "`backend-entry` is BE-1 to BE-7 only", §5.1 table, §5.2; register row).
//   feature-checklist = BE-5: checklist run recorded AND owner disposition of CHK001–CHK082
//     (amendment §5.1 BE-5; checklists/entry-gate-assessment.md §G); recording the run in quickstart.md is T001's output.
// A verifier passes only when every listed condition is recorded "met" in the approved artifact. Nothing is closed.
const readOpt = (rel) => { try { return readFileSync(join(repo, rel), "utf8").replace(/\r\n/g, "\n"); } catch { return null; } };
const AMENDMENT = "specs/002-p0-prd/backend-first-amendment.md";
const ASSESSMENT = "specs/002-p0-prd/checklists/entry-gate-assessment.md";
// No bare "not": the real BE-6 cell reads "met by the prior separate approvals; not granted by BE-5 disposition".
const NOT_MET = /\bnot (yet )?(met|satisfied)\b|\bnot yet\b|\bunmet\b|\bremains? open\b|\bstill (open|blocked)\b|\boutstanding\b|\bpending\b|\bblocked\b|\bincomplete\b|\brevoked\b|\bwithdrawn\b|\breopened\b|\bnot (complete|approved|closed|recorded)\b|\bunresolved\b|\bno longer\b/i;
const isMet = (id, cell) => !NOT_MET.test(cell) && (/^\**\s*met\b/i.test(cell) || new RegExp(`\\*\\*${id} met \\d{4}-\\d{2}-\\d{2}\\*\\*`).test(cell));
function beTable() {
  const a = readOpt(AMENDMENT);
  if (!a) return { error: `${AMENDMENT} unreadable` };
  const sec = a.split("**5.1 Entry conditions")[1]?.split("**5.2")[0];
  if (!sec) return { error: `${AMENDMENT} §5.1 entry-conditions table not found` };
  const rows = {};
  for (const line of sec.split("\n")) {
    const cells = line.split("|").map((s) => s.trim());
    const id = cells[1];
    if (!/^BE-\d+$/.test(id || "")) continue;
    if (rows[id]) return { error: `${AMENDMENT} §5.1 lists ${id} twice` };
    rows[id] = cells.filter((s, i) => i > 1 && s !== "").pop() || "";
  }
  return { rows };
}
function verifyBE(ids) {
  const t = beTable();
  if (t.error) return { met: false, detail: t.error };
  const bad = ids.filter((id) => !(id in t.rows) || !isMet(id, t.rows[id]));
  return bad.length ? { met: false, detail: `not recorded met in ${AMENDMENT} §5.1: ${bad.join(", ")}` }
    : { met: true, detail: `${ids[0]}..${ids[ids.length - 1]} recorded met in ${AMENDMENT} §5.1` };
}
const ENTRY_EVIDENCE = {
  "backend-entry": () => {
    const r = verifyBE(["BE-1", "BE-2", "BE-3", "BE-4", "BE-5", "BE-6", "BE-7"]);
    return r.met ? { ...r, detail: `${r.detail}; BE-8 is T001's own output (amendment §5.2), never its entry condition` } : r;
  },
  "feature-checklist": () => {
    const r = verifyBE(["BE-5"]);
    if (!r.met) return r;
    const s = readOpt(ASSESSMENT);
    const g = s && s.split("\n## G. BE-5 owner disposition")[1]?.split("\n## ")[0];
    if (!g || !/^ — approved \d{4}-\d{2}-\d{2}\b/.test(g) || !/\*\*Status:\*\* Approved by the project owner on \d{4}-\d{2}-\d{2}/.test(g))
      return { met: false, detail: `${ASSESSMENT} §G owner disposition (approved, dated) not found` };
    return { met: true, detail: `BE-5 run/disposition met (${AMENDMENT} §5.1) and owner disposition approved (${ASSESSMENT} §G); recording the run is T001's own output` };
  },
};
const entryEvidence = Object.fromEntries(Object.entries(ENTRY_EVIDENCE).map(([g, f]) => [g, f()]));

// ---------- Prerequisites: task IDs vs named gates (fail closed) ----------
// Parentheticals and known boilerplate prose are dropped. Every remaining single-token item that is
// not a T### is treated as a gate. Multi-word prose is kept as "unparsed" for the orchestrator to read.
const PROSE = [/Every task inherits prerequisites\/gates transitively/g, /roadmap completion rules in plan Milestones apply/g,
  /Follow plan Entry gates\/?/g, /Entry gates in plan\.md apply/g, /no task prerequisites/gi];
for (const c of tasks.values()) {
  const parens = [...c.prerequisites.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  for (const p of parens) {
    const ids = p.match(/\b(T\d{3}|OD-\d+|[A-Z][\w]*-[\w-]+)\b/g);
    if (ids) warnings.push(`${c.id}: IDs inside a Prerequisites parenthetical were not parsed (${[...new Set(ids)].join(", ")}); read the card`);
  }
  let head = c.prerequisites.replace(/\([^)]*\)/g, "");
  for (const re of PROSE) head = head.replace(re, "");
  head = head.replace(/[\w./-]+\.(md|json|ts|tsx|sql|mjs|js)\b/g, ""); // file names are not gates
  c.taskDeps = [...new Set((head.match(/\bT\d{3}\b/g) || []).filter((t) => t !== c.id))];
  c.gates = []; c.unparsed = [];
  for (let s of head.replace(/\bT\d{3}\b( complete)?/g, "").split(/[;,.]| and /)) {
    s = s.replace(/`/g, "").trim();
    if (!s) continue;
    if (/^[A-Za-z][\w/-]*$/.test(s)) c.gates.push(...s.split("/").filter(Boolean));
    else c.unparsed.push(s);
  }
  // A multi-word clause that names a register gate (whole-word, case-insensitive) adds that gate.
  for (const clause of c.unparsed) for (const key of register.keys()) {
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^\\w-])${esc}($|[^\\w-])`, "i").test(clause)) c.gates.push(key);
  }
  // Direct-card edges from the register's third column (finding M1).
  for (const [g, ids] of directCards) if (ids.includes(c.id)) c.gates.push(g);
  c.gates = [...new Set(c.gates)];
}

// ---------- Owner implementation authorizations (Status block only, strict form) ----------
// Accepted form (bold-led): "**Implementation authorization (owner, YYYY-MM-DD): T010, T035 and T048 only"
// Revocation form:          "**Implementation authorization revoked (owner, YYYY-MM-DD): T010 only"
// The list between ":" and "only" may hold only T### IDs, commas, "and" and spaces. Anything else is ignored with a warning.
const statusBlock = text.split("\n## ")[0];
const LIST = /^(T\d{3})(\s*(,|,?\s*and)\s*T\d{3})*$/;
const authorizations = [], revocations = [];
// A consolidated batch is the same line with a label: "(owner, YYYY-MM-DD, batch <label>)". It authorizes exactly the listed tasks
// for as long as the line stands; no per-phase, per-task or per-delivery re-approval is ever requested for them.
for (const m of statusBlock.matchAll(/\*\*Implementation authorization( revoked)? \(owner, (\d{4}-\d{2}-\d{2})(?:, batch ([A-Za-z0-9._-]+))?\):\s*([^.\n]*?)\s*\bonly\b/g)) {
  const list = m[4].trim();
  const batchRef = m[1] && list.match(/^batch ([A-Za-z0-9._-]+)$/);
  if (batchRef) {
    const tasksOfBatch = authorizations.filter((a) => a.batch === batchRef[1]).flatMap((a) => a.tasks);
    if (!tasksOfBatch.length) { warnings.push(`ignored a revocation of unknown batch "${batchRef[1]}" (${m[2]}); candidates stay blocked until it is restated`); continue; }
    revocations.push({ date: m[2], batch: batchRef[1], tasks: [...new Set(tasksOfBatch)] });
    continue;
  }
  if (!LIST.test(list)) { warnings.push(`ignored a malformed authorization line (${m[2]}): "${list}"; ask the owner to restate it`); continue; }
  (m[1] ? revocations : authorizations).push({ date: m[2], ...(m[3] ? { batch: m[3] } : {}), tasks: [...new Set(list.match(/\bT\d{3}\b/g))] });
}
// Fail closed: a line that says "authorization revoked" but did not parse as a revocation blocks every candidate until restated.
const revocationMentions = statusBlock.split("\n").filter((l) => /authori[sz]ation\b.*\brevoked\b|\brevok(e|ed|ing)\b.*\bauthori[sz]ation/i.test(l)).reduce((n, l) => n + Math.max(1, (l.match(/Implementation authorization revoked/g) || []).length), 0);
const revocationFault = revocationMentions > revocations.length;
if (revocationFault) warnings.push(`${revocationMentions - revocations.length} authorization revocation line(s) did not parse: every candidate is blocked until the owner restates them`);
const revoked = new Set(revocations.flatMap((a) => a.tasks));
const authorized = new Set(authorizations.flatMap((a) => a.tasks).filter((t) => !revoked.has(t)));

// ---------- Gate 2 content approval, from each card's Readiness line (absent line = not approved) ----------
for (const c of tasks.values()) {
  const r = c.readiness;
  c.contentApproved = /not approved at Gate 2|not yet as content|structure only/i.test(r) ? false
    : /^(Revised )?Gate 2 content(\/structure)? approved \d{4}-\d{2}-\d{2}\b/.test(r);
}

// Conditional parallel opportunities named in "Dependencies and execution order".
const depSection = text.split("## Dependencies and execution order")[1]?.split("\n## ")[0] || "";
const parLine = depSection.split("\n").find((l) => l.startsWith("Conditional parallel opportunities")) || "";
const parallelNamed = new Set(parLine.match(/\bT\d{3}\b/g) || []);

// ---------- git + saved Phase state (read before classifying: done needs recorded evidence) ----------
const gitState = {
  branch: git("rev-parse", "--abbrev-ref", "HEAD"),
  head: git("rev-parse", "--short", "HEAD"),
  staged: (git("diff", "--cached", "--name-only") || "").split("\n").filter(Boolean),
  dirtyCount: (git("status", "--porcelain=v1") || "").split("\n").filter(Boolean).length,
  phaseBranches: (git("branch", "--list", "feat/wanees-phase-*", "--format=%(refname:short)") || "").split("\n").filter(Boolean),
};
const saved = {};
const doneWithEvidence = new Set();
if (existsSync(STATE_DIR)) for (const d of readdirSync(STATE_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
  const p = join(STATE_DIR, d, "state.json");
  if (!existsSync(p)) { saved[d] = { stage: "unreadable", error: "Phase directory has no state.json: an interrupted Phase may exist" }; continue; }
  try {
    const s = JSON.parse(readFileSync(p, "utf8"));
    for (const [id, t] of Object.entries(s.tasks || {})) if (t && t.status === "done" && (t.evidence || []).length) doneWithEvidence.add(id);
    saved[d] = { stage: s.stage || "unknown", branch: s.branch, branchExists: s.branch ? gitState.phaseBranches.includes(s.branch) : null,
      commitsInGit: (s.commits || []).every((c) => git("cat-file", "-e", `${c.sha || c}^{commit}`) !== null), pr: s.pr?.url || null, blockers: (s.blockers || []).length };
  } catch { saved[d] = { stage: "unreadable", error: "unreadable state.json: stop and repair it before any Phase work" }; }
}
for (const c of tasks.values()) {
  c.verifiedDone = c.done && doneWithEvidence.has(c.id);
  if (c.done && !c.verifiedDone) warnings.push(`${c.id} is [x] in tasks.md but no wanees-phase state records its evidence: treated as done-unverified and does not satisfy dependants`);
}

// ---------- classify (fail closed; order matters) ----------
// A gate is closed only by a register cell that starts "Closed YYYY-MM-DD" (case-sensitive); G-IMPLEMENT only by authorization.
const CLOSED = /^Closed \d{4}-\d{2}-\d{2}\b/;
const gateOpen = (c, g) => {
  if (g === "G-IMPLEMENT") return !authorized.has(c.id);
  if (CLOSED.test(register.get(g) || "")) return false;
  // Entry gates: their verified entry conditions satisfy T001 only. Any other card naming them also needs T001
  // verified done (BE-8 is T001's output, and later cards inherit T001: amendment §5.2).
  if (entryEvidence[g]) return !(entryEvidence[g].met && (c.id === "T001" || tasks.get("T001")?.verifiedDone === true));
  return true;
};
function classify(c) {
  if (c.verifiedDone) return { status: "done" };
  if (!c.done && doneWithEvidence.has(c.id)) return { status: "done-pending-tick", why: "state.json records it done with evidence but [x] is not in this tasks.md: fast-forward this checkout to the delivered origin/main (never re-implement)" };
  if (c.done) return { status: "done-unverified", why: "[x] without recorded wanees-phase evidence; verify, then record evidence in state.json" };
  if (phases.find((p) => p.id === c.phase)?.gated) return { status: "gated-track", why: "Phase 8 has no implementation schedule" };
  if (!c.contentApproved) return { status: "awaiting-content-approval", why: "Gate 2 content not approved for this card; content approval precedes implementation authorization" };
  if (!authorized.has(c.id)) return { status: "awaiting-authorization", why: "content approved; no owner implementation authorization names this task (G-IMPLEMENT)" };
  const open = c.taskDeps.filter((t) => !tasks.get(t)?.verifiedDone);
  if (open.length) return { status: "waiting-deps", why: `prerequisite tasks not done: ${open.join(", ")}` };
  const openGates = c.gates.filter((g) => gateOpen(c, g));
  if (openGates.length) return { status: "gates-open", why: `named gates not recorded Closed in the Gate register: ${openGates.join(", ")}` };
  if (revocationFault) return { status: "awaiting-authorization", why: "an authorization revocation line did not parse; the owner must restate it before any candidate runs (fail closed)" };
  return { status: "candidate", why: c.unparsed.length ? `read these Prerequisites clauses before dispatch: ${c.unparsed.join(" | ")}` : "authorized; content approved; prerequisites done; named gates closed" };
}
for (const c of tasks.values()) Object.assign(c, classify(c));

// Parallel (advisory only): candidates named by the dependency section with different primary directories.
// The orchestrator must still prove the full Scope file sets are disjoint (SKILL.md §4).
function parallelGroup(ids) {
  const seen = new Set(); const group = [];
  for (const c of ids.map((i) => tasks.get(i)).filter((c) => c.status === "candidate" && parallelNamed.has(c.id))) {
    const dir = (c.primaryPath || "").split("/").slice(0, -1).join("/");
    if (!seen.has(dir)) { seen.add(dir); group.push(c.id); }
  }
  return group.length > 1 ? group : [];
}

// ---------- fleet ----------
const fleet = { ok: false, lanes: {}, codexLanes: [], trusted: null, sha256: null, problems: [], error: null };
try {
  const cfg = JSON.parse(readFileSync(CONFIG, "utf8"));
  const lanes = cfg.lanes || {};
  for (const [n, l] of Object.entries(lanes)) fleet.lanes[n] = `${l.implementer} ${l.model || "-"} ${l.effort || "-"}${l.readOnly ? " ro" : ""}`;
  fleet.codexLanes = Object.entries(lanes).filter(([, l]) => l.implementer === "codex").map(([n]) => n);
  if (fleet.codexLanes.length) fleet.problems.push(`codex lanes: ${fleet.codexLanes.join(", ")}`);
  const want = { "plan-review": ["claude", "claude-sonnet-5-5", "xhigh"], "migration-review": ["claude", "claude-opus-5-5", "high"] };
  for (const [n, [impl, model, effort]] of Object.entries(want)) {
    const l = lanes[n];
    if (!l || l.implementer !== impl || l.model !== model || l.effort !== effort || l.readOnly !== true) fleet.problems.push(`${n} is not ${impl} ${model} ${effort} read-only (G02)`);
  }
  if (lanes["final-verdict"]) fleet.problems.push("final-verdict lane present (retired under G02)");
  fleet.sha256 = sha256(CONFIG);
  const gitDir = git("rev-parse", "--absolute-git-dir");
  const trust = (commonDir || gitDir) && join(commonDir || gitDir, "delegate-skills/project-config.sha256");
  if (trust && existsSync(trust)) fleet.trusted = readFileSync(trust, "utf8").includes(fleet.sha256);
  if (fleet.trusted !== true) fleet.problems.push("project config not trusted (sha256 not approved)");
  fleet.ok = fleet.problems.length === 0;
} catch (e) { fleet.error = String(e.message || e); fleet.problems.push(`config unreadable: ${fleet.error}`); }

// ---------- summary + next action (next is always computed over all Phases) ----------
const summarize = (p) => {
  const by = (s) => p.tasks.filter((i) => tasks.get(i).status === s);
  return { id: p.id, title: p.title, gated: p.gated, branch: `feat/wanees-phase-${p.id}`, tasks: p.tasks, done: by("done"),
    candidates: by("candidate"), doneUnverified: by("done-unverified"), gatesOpen: by("gates-open"), waitingDeps: by("waiting-deps"), awaitingAuthorization: by("awaiting-authorization"),
    awaitingContentApproval: by("awaiting-content-approval"), gatedTrack: by("gated-track"), parallelAdvisory: parallelGroup(p.tasks) };
};
const all = phases.map(summarize);
const summary = all.filter((p) => !onlyPhase || String(p.id) === String(onlyPhase));
const nextPhase = all.find((p) => p.candidates.length);
const laterPhasesWithCandidates = all.filter((p) => p.candidates.length && p !== nextPhase).map((p) => p.id);
const unreadable = Object.entries(saved).find(([, st]) => st.stage === "unreadable");
// "tracking" is the evidence-ledger stage written by run-state.mjs: it records completed tasks and holds no in-flight Phase work
// (in-flight work is run-state.json current), so it never forces a resume. "blocked" is parked.
const OWNER_WAIT = new Set(["blocked", "awaiting-owner", "pr-open"]);
const NON_ACTIVE = new Set(["merged", "tracking", ...OWNER_WAIT]);
const activeSaved = Object.entries(saved).find(([, st]) => !NON_ACTIVE.has(st.stage));
const parkedPhases = Object.entries(saved).filter(([, st]) => OWNER_WAIT.has(st.stage)).map(([d]) => d);
const unblockers = [...tasks.values()].filter((c) => c.status === "awaiting-authorization" && c.taskDeps.every((t) => tasks.get(t)?.verifiedDone)).map((c) => c.id);
// For every candidate: the closed-gate cells and unparsed clauses a human must read before dispatch.
const readBeforeDispatch = Object.fromEntries([...tasks.values()].filter((c) => c.status === "candidate").map((c) => [c.id, {
  closedGates: Object.fromEntries(c.gates.filter((g) => g !== "G-IMPLEMENT" && !entryEvidence[g]).map((g) => [g, register.get(g)])),
  entryEvidence: Object.fromEntries(c.gates.filter((g) => entryEvidence[g]).map((g) => [g, entryEvidence[g].detail])), unparsed: c.unparsed }]));
const waiting = [...tasks.values()].filter((c) => c.status === "waiting-deps" || c.status === "gates-open").map((c) => `${c.id} (${c.why})`);

// ---------- continuous-run view: the whole dependency graph, not one Phase ----------
const allCards = [...tasks.values()];
const queue = allCards.filter((c) => c.status === "candidate").map((c) => ({ id: c.id, phase: c.phase, branch: `feat/wanees-phase-${c.phase}` }))
  .sort((a, b) => a.phase - b.phase || a.id.localeCompare(b.id));
const NEEDS = {
  "done-unverified": () => "evidence record (orchestrator): verify the card and record its evidence in a state.json",
  "gated-track": () => "owner un-gates the track; never schedulable by the workflow",
  "awaiting-content-approval": () => "owner Gate 2 content approval, then implementation authorization",
  "awaiting-authorization": () => "owner implementation authorization",
  "done-pending-tick": () => "this checkout must fast-forward to the delivered origin/main so tasks.md carries the [x]",
  "waiting-deps": (c) => `prerequisite tasks: ${c.why.replace(/^.*?: /, "")}`,
  "gates-open": (c) => `gates: ${c.why.replace(/^.*?: /, "")}`,
};
const blockers = allCards.filter((c) => c.status !== "done" && c.status !== "candidate").map((c) => ({ id: c.id, phase: c.phase, status: c.status, needs: NEEDS[c.status](c), ownerNeeded: ["awaiting-content-approval", "awaiting-authorization", "gated-track", "gates-open"].includes(c.status) }));
// ONE request covering every scope that only waits for an owner approval; tasks that wait on other approval-pending tasks follow in the same request.
const APPROVAL = new Set(["awaiting-content-approval", "awaiting-authorization"]);
const pending = allCards.filter((c) => APPROVAL.has(c.status));
const pendingIds = new Set(pending.map((c) => c.id));
const requestable = pending.filter((c) => c.taskDeps.every((t) => tasks.get(t)?.verifiedDone || pendingIds.has(t)));
const requestIds = new Set(requestable.map((c) => c.id));
const gateWaiting = allCards.filter((c) => c.status === "gates-open");
const consolidatedApprovalRequest = {
  kind: "request", grantsNothing: true, single: true,
  tasks: requestable.map((c) => ({ id: c.id, phase: c.phase, needs: c.status === "awaiting-content-approval" ? ["gate2-content", "implementation-authorization"] : ["implementation-authorization"],
    afterTasks: c.taskDeps.filter((t) => requestIds.has(t)), openGates: c.gates.filter((g) => g !== "G-IMPLEMENT" && gateOpen(c, g)) })),
  gatesToClose: [...new Set([...requestable, ...gateWaiting].flatMap((c) => c.gates.filter((g) => g !== "G-IMPLEMENT" && !entryEvidence[g] && gateOpen(c, g))))],
  entryGatesAfterT001: [...new Set([...requestable, ...gateWaiting].flatMap((c) => c.gates.filter((g) => entryEvidence[g] && gateOpen(c, g))))],
  authorizedTasksWaitingOnGates: gateWaiting.map((c) => ({ id: c.id, phase: c.phase, gates: c.gates.filter((g) => g !== "G-IMPLEMENT" && gateOpen(c, g)) })),
  excluded: pending.filter((c) => !requestIds.has(c.id)).map((c) => ({ id: c.id, why: `depends on tasks that are neither done nor requestable: ${c.taskDeps.filter((t) => !tasks.get(t)?.verifiedDone && !pendingIds.has(t)).join(", ")}` })),
};
const totals = { cards: allCards.length, done: allCards.filter((c) => c.status === "done").length, candidates: queue.length, blocked: blockers.length };

const out = {
  generatedFrom: { tasks: "specs/002-p0-prd/tasks.md", tasksSha256: sha256(TASKS), cards: tasks.size },
  authorizations, revocations, entryEvidence, fleet, git: gitState, savedPhases: saved, parkedPhases, warnings, readBeforeDispatch, phases: summary, queue, blockers, totals, consolidatedApprovalRequest,
  next: !fleet.ok
    ? { action: "stop", reason: `fleet not OK: ${fleet.problems.join("; ")}. Stop before any dispatch` }
    : unreadable
    ? { action: "stop", reason: `${unreadable[0]}/state.json is unreadable; repair it against Git before any Phase work` }
    : activeSaved
    ? { action: "resume", state: activeSaved[0], stage: activeSaved[1].stage, note: "verify recorded state against Git before acting (SKILL.md §1)" }
    : nextPhase
    ? { action: "run-phase", phase: nextPhase.id, branch: nextPhase.branch, candidates: nextPhase.candidates, parallelAdvisory: nextPhase.parallelAdvisory, laterPhasesWithCandidates, queue }
    : { action: "blocked", smallestUnblockingAuthorizations: unblockers, authorizedButWaiting: waiting, consolidatedApprovalRequest },
  tasks: Object.fromEntries([...tasks.values()].filter((c) => !onlyPhase || String(c.phase) === String(onlyPhase)).map((c) => [c.id,
    { phase: c.phase, status: c.status, why: c.why || null, contentApproved: c.contentApproved, risk: c.risk, plannedTarget: c.plannedTarget,
      primaryPath: c.primaryPath, taskDeps: c.taskDeps, gates: c.gates, unparsed: c.unparsed }])),
};

if (asJson) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
const pr = (s = "") => console.log(s);
pr(`tasks.md ${out.generatedFrom.cards} cards, sha256 ${out.generatedFrom.tasksSha256.slice(0, 12)}`);
pr(`authorizations: ${authorizations.map((a) => `${a.date}: ${a.tasks.join(", ")}`).join(" | ") || "none recorded"}`);
pr(`fleet: ${Object.keys(fleet.lanes).length} lanes, trusted=${fleet.trusted}, codex lanes=${fleet.codexLanes.join(",") || "none"}${fleet.ok ? ", G02 review lanes OK" : `  << FLEET NOT OK: ${fleet.problems.join("; ")}`}`);
pr(`git: ${gitState.branch}@${gitState.head}, staged=[${gitState.staged.join(", ")}], dirty entries=${gitState.dirtyCount}, phase branches=[${gitState.phaseBranches.join(", ")}]`);
pr(`saved phase state: ${Object.keys(saved).length ? JSON.stringify(saved) : "none"}`);
if (revocations.length) pr(`revocations: ${revocations.map((a) => `${a.date}: ${a.tasks.join(", ")}`).join(" | ")}`);
for (const w of warnings) pr(`WARNING: ${w}`);
for (const [id, r] of Object.entries(readBeforeDispatch)) {
  for (const u of r.unparsed) pr(`WARNING: ${id} unparsed Prerequisites clause (read and log before dispatch): ${u}`);
  for (const [g, cell] of Object.entries(r.closedGates)) pr(`READ: ${id} gate ${g} register cell: ${cell}`);
  for (const [g, d] of Object.entries(r.entryEvidence)) pr(`READ: ${id} entry gate ${g} (entry conditions met, gate not closed): ${d}`);
}
pr();
for (const p of summary) {
  pr(`Phase ${p.id}: ${p.title}${p.gated ? "  [gated track, never scheduled]" : ""}`);
  pr(`  done=[${p.done.join(", ")}]${p.doneUnverified.length ? ` done-unverified=[${p.doneUnverified.join(", ")}]` : ""} candidates=[${p.candidates.join(", ")}] gates-open=[${p.gatesOpen.join(", ")}] waiting-deps=[${p.waitingDeps.join(", ")}] awaiting-authorization=[${p.awaitingAuthorization.join(", ")}] awaiting-content-approval=${p.awaitingContentApproval.length} gated=${p.gatedTrack.length}${p.parallelAdvisory.length ? ` parallel(advisory)=[${p.parallelAdvisory.join(", ")}]` : ""}`);
}
pr();
const n = out.next;
if (n.action === "stop") pr(`NEXT: STOP. ${n.reason}`);
else if (n.action === "resume") pr(`NEXT: resume ${n.state} (stage ${n.stage}); ${n.note}`);
else if (n.action === "run-phase") pr(`NEXT: Phase ${n.phase} on ${n.branch}: ${n.candidates.join(", ")}${n.parallelAdvisory.length ? ` (parallel, advisory: ${n.parallelAdvisory.join(", ")}; prove disjoint Scope sets first)` : ""}; read the WARNING/READ lines above and log them before dispatch${n.laterPhasesWithCandidates.length ? `; later Phases with candidates (run after this Phase, one branch at a time): ${n.laterPhasesWithCandidates.join(", ")}` : ""}`);
else {
  pr("NEXT: no eligible task. Do not stop on a single task: write ONE consolidated approval request and the run-level BLOCKED report (run-state.mjs finish).");
  pr(`  smallest unblocking authorization(s): ${unblockers.join(", ") || "none"}`);
  for (const w of waiting) pr(`  authorized but waiting: ${w}`);
  pr(`  consolidated approval request: ${consolidatedApprovalRequest.tasks.map((t) => t.id).join(", ") || "none"}; gates to close: ${consolidatedApprovalRequest.gatesToClose.join(", ") || "none"}`);
}
pr(`QUEUE (all Phases): ${queue.map((q) => `${q.id}[P${q.phase}]`).join(", ") || "empty"}; parked Phases: ${parkedPhases.join(", ") || "none"}; done ${totals.done}/${totals.cards}`);
