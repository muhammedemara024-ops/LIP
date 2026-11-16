#!/usr/bin/env node
// Self-test for phase-status.mjs. It builds synthetic fixture repos and temp copies of the approved artifacts in the
// OS temp dir. It reads the project's artifacts but never writes to the project.
// Usage: node .agents/skills/wanees-phase/scripts/phase-status.selftest.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "phase-status.mjs");
const LANES = {
  "plan-review": { implementer: "claude", model: "claude-sonnet-5-5", effort: "xhigh", readOnly: true },
  "migration-review": { implementer: "claude", model: "claude-opus-5-5", effort: "high", readOnly: true },
  implementation: { implementer: "agy", model: "gemini-4-hydrogen-high", effort: "high" },
};

// doneEvidence: task IDs recorded done-with-evidence in a merged phase-1 state.json (so [x] counts as verified).
function fixture({ status, cards, register = "", lanes = LANES, trusted = true, state = null, doneEvidence = ["T001"], crlf = false, emptyPhaseDir = false }) {
  const dir = mkdtempSync(join(tmpdir(), "wanees-phase-selftest-"));
  mkdirSync(join(dir, "specs/002-p0-prd"), { recursive: true });
  mkdirSync(join(dir, ".delegate"), { recursive: true });
  let md = `# Tasks\n\n**Status**: ${status}\n\n## Gate register\n\n| Gate | Source / required evidence | Direct blockers |\n|---|---|---|\n| G-IMPLEMENT | scoped | all |\n${register}\n${cards}\n## Dependencies and execution order\n\nConditional parallel opportunities: none.\n`;
  if (crlf) md = md.replace(/\n/g, "\r\n");
  writeFileSync(join(dir, "specs/002-p0-prd/tasks.md"), md);
  const cfg = JSON.stringify({ version: "delegate-fleet.v1", lanes });
  writeFileSync(join(dir, ".delegate/config.json"), cfg);
  execFileSync("git", ["init", "-q"], { cwd: dir });
  if (trusted) {
    mkdirSync(join(dir, ".git/delegate-skills"), { recursive: true });
    writeFileSync(join(dir, ".git/delegate-skills/project-config.sha256"), createHash("sha256").update(cfg).digest("hex") + "\n");
  }
  if (doneEvidence.length) {
    mkdirSync(join(dir, ".scratch/wanees-phases/phase-1"), { recursive: true });
    const t = Object.fromEntries(doneEvidence.map((id) => [id, { status: "done", evidence: ["fixture"] }]));
    writeFileSync(join(dir, ".scratch/wanees-phases/phase-1/state.json"), JSON.stringify({ stage: "merged", tasks: t }));
  }
  if (state !== null) {
    mkdirSync(join(dir, ".scratch/wanees-phases/phase-2"), { recursive: true });
    writeFileSync(join(dir, ".scratch/wanees-phases/phase-2/state.json"), state);
  }
  if (emptyPhaseDir) mkdirSync(join(dir, ".scratch/wanees-phases/phase-3"), { recursive: true });
  return dir;
}
const run = (dir, extra = []) => JSON.parse(execFileSync("node", [SCRIPT, "--repo", dir, "--json", ...extra], { encoding: "utf8" }));
const card = (box, id, readiness, prereq) => `- [${box}] ${id} Task ${id} in src/${id.toLowerCase()}/x.ts\n  - Readiness: ${readiness}\n  - Prerequisites: ${prereq}\n`;
const APPROVED = "Gate 2 content approved 2026-11-13 (scoped).";

let failed = 0, passed = 0;
const check = (name, cond, detail) => { console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ` :: ${JSON.stringify(detail)}`}`); cond ? passed++ : failed++; };
const dirs = [];
const mk = (o) => { const d = fixture(o); dirs.push(d); return d; };

const p1 = `## Phase 1: Setup\n\n${card("x", "T001", APPROVED, "none")}\n## Phase 2: Foundational\n\n`;
const auth = (list) => `**Implementation authorization (owner, 2026-11-14): ${list} only.**`;
const t010 = (prereq = "T001; G-IMPLEMENT", readiness = APPROVED) => p1 + card(" ", "T010", readiness, prereq);

// 1. Authorized but not content-approved, prerequisites done -> never a candidate (R1).
let j = run(mk({ status: auth("T010"), cards: t010("T001; G-IMPLEMENT", "structure only; not approved at Gate 2") }));
check("authorized + not content-approved -> awaiting-content-approval", j.tasks.T010.status === "awaiting-content-approval", j.tasks.T010);
check("  ...and next is not run-phase", j.next.action !== "run-phase", j.next);

// 2. Missing Readiness line, or unanchored "not content approved" -> not content-approved (N4).
check("no Readiness line -> awaiting-content-approval", run(mk({ status: auth("T010"), cards: p1 + `- [ ] T010 Task in src/a.ts\n  - Prerequisites: T001; G-IMPLEMENT\n` })).tasks.T010.status === "awaiting-content-approval");
check("'not content approved' -> awaiting-content-approval", run(mk({ status: auth("T010"), cards: t010("T001; G-IMPLEMENT", "Gate 2 not content approved 2026-11-13") })).tasks.T010.status === "awaiting-content-approval");

// 3. Malformed authorization ("not") is ignored with a warning (R2).
j = run(mk({ status: "**Implementation authorization (owner, 2026-11-14): T010 not T011 only.**", cards: p1 + card(" ", "T011", APPROVED, "T001; G-IMPLEMENT") }));
check("malformed authorization ignored", j.authorizations.length === 0 && j.tasks.T011.status === "awaiting-authorization", { a: j.authorizations, t: j.tasks.T011 });
check("  ...with a warning", j.warnings.some((w) => /malformed authorization/.test(w)), j.warnings);

// 4. Authorization outside the Status block, or not bold-led, is ignored (R2, N9).
check("authorization outside Status block ignored", run(mk({ status: "none", cards: t010() + "\n" + auth("T010") + "\n" })).tasks.T010.status === "awaiting-authorization");
check("non-bold (quoted) authorization ignored", run(mk({ status: `quoted: "Implementation authorization (owner, 2026-11-14): T010 only"`, cards: t010() })).tasks.T010.status === "awaiting-authorization");

// 5. Revocation subtracts (N9).
check("revocation subtracts", run(mk({ status: `${auth("T010")} **Implementation authorization revoked (owner, 2026-11-15): T010 only.**`, cards: t010() })).tasks.T010.status === "awaiting-authorization");

// 6. Open named gate -> gates-open; single-word gates parsed (R3).
j = run(mk({ status: auth("T010"), cards: t010("T001; G-IMPLEMENT; accessibility; schema-brief") }));
check("open gates -> gates-open, next blocked", j.tasks.T010.status === "gates-open" && j.next.action === "blocked", { t: j.tasks.T010, n: j.next });
check("  ...single-word gate parsed", j.tasks.T010.gates.includes("accessibility"), j.tasks.T010.gates);

// 7. Gate recorded "Closed YYYY-MM-DD" -> candidate; "Closed? No" and undated "Closed" stay open (N1).
j = run(mk({ status: auth("T010"), register: "| schema-brief | Closed 2026-11-13 by PD-039. | T010 |\n", cards: t010("T001; G-IMPLEMENT; schema-brief") }));
check("dated Closed gate + all conditions -> candidate, run-phase", j.tasks.T010.status === "candidate" && j.next.action === "run-phase" && j.next.phase === 2, { t: j.tasks.T010, n: j.next });
check("  ...closed gate cell surfaced for reading", j.readBeforeDispatch.T010?.closedGates?.["schema-brief"]?.startsWith("Closed 2026"), j.readBeforeDispatch);
check("'Closed? No' -> gates-open", run(mk({ status: auth("T010"), register: "| schema-brief | Closed? No. | T010 |\n", cards: t010("T001; G-IMPLEMENT; schema-brief") })).tasks.T010.status === "gates-open");
check("undated 'Closed' -> gates-open", run(mk({ status: auth("T010"), register: "| schema-brief | Closed by PD-039. | T010 |\n", cards: t010("T001; G-IMPLEMENT; schema-brief") })).tasks.T010.status === "gates-open");

// 8. Prose clause naming an open register gate -> gates-open; unknown prose -> candidate but surfaced (N2).
j = run(mk({ status: auth("T010"), register: "| final-name | PD-029 final name pending | T010 |\n", cards: t010("T001; G-IMPLEMENT; the final-name conditions in Revision 3 apply") }));
check("prose naming open gate -> gates-open", j.tasks.T010.status === "gates-open" && j.tasks.T010.gates.includes("final-name"), j.tasks.T010);
j = run(mk({ status: auth("T010"), cards: t010("T001; G-IMPLEMENT; no dependency on unrelated database work") }));
check("unknown prose -> candidate with unparsed clause surfaced", j.tasks.T010.status === "candidate" && j.readBeforeDispatch.T010.unparsed.length === 1, j.readBeforeDispatch);

// 9. Prerequisite not done -> waiting-deps; smallest unblocker reported (N6).
j = run(mk({ status: auth("T010, T002"), doneEvidence: [], cards: `## Phase 1: Setup\n\n${card(" ", "T001", APPROVED, "none")}${card(" ", "T002", APPROVED, "T001")}\n## Phase 2: Foundational\n\n` + card(" ", "T010", APPROVED, "T001; G-IMPLEMENT") }));
check("open prerequisite -> waiting-deps", j.tasks.T010.status === "waiting-deps" && j.next.action === "blocked", j.next);
check("  ...smallest unblocker is T001", JSON.stringify(j.next.smallestUnblockingAuthorizations) === '["T001"]', j.next);

// 10. [x] without recorded evidence -> done-unverified and does not unlock dependants (N3).
j = run(mk({ status: auth("T010"), doneEvidence: [], cards: t010() }));
check("[x] without evidence -> done-unverified", j.tasks.T001.status === "done-unverified" && j.tasks.T010.status === "waiting-deps", { a: j.tasks.T001, b: j.tasks.T010 });
check("  ...and warns", j.warnings.some((w) => /T001 is \[x\]/.test(w)), j.warnings);

// 11. Phase 8 gated track stays gated even if authorized and approved.
check("gated track never scheduled", run(mk({ status: auth("T060"), cards: p1 + `## Phase 8: Gated tracks — no implementation schedule\n\n` + card(" ", "T060", APPROVED, "G-IMPLEMENT") })).tasks.T060.status === "gated-track");

// 12. Fleet problems -> stop, naming the problem (R16, N6).
const stopReason = (o) => { const n = run(mk({ status: auth("T010"), cards: t010(), ...o })).next; return n.action === "stop" ? n.reason : `NOT STOP: ${n.action}`; };
check("untrusted fleet -> stop (not trusted)", /not trusted/.test(stopReason({ trusted: false })));
check("codex lane -> stop (codex)", /codex lanes: x/.test(stopReason({ lanes: { ...LANES, x: { implementer: "codex" } } })));
check("plan-review not Sonnet -> stop (plan-review)", /plan-review is not/.test(stopReason({ lanes: { ...LANES, "plan-review": { ...LANES["plan-review"], model: "claude-opus-5-5" } } })));
check("final-verdict present -> stop (final-verdict)", /final-verdict lane present/.test(stopReason({ lanes: { ...LANES, "final-verdict": { implementer: "claude" } } })));

// 13. Saved state: unreadable or missing state.json -> stop; active Phase -> resume (R4, N8).
check("unreadable state -> stop", /unreadable/.test(stopReason({ state: "{not json" })));
check("Phase dir without state.json -> stop", /phase-3/.test(stopReason({ emptyPhaseDir: true })));
check("saved active Phase -> resume", run(mk({ status: auth("T010"), state: JSON.stringify({ stage: "executing", branch: "feat/wanees-phase-2" }), cards: t010() })).next.action === "resume");

// 14. --phase filter does not change next (R14).
j = run(mk({ status: auth("T010, T020"), cards: t010() + `\n## Phase 3: Identity\n\n` + card(" ", "T020", APPROVED, "T001; G-IMPLEMENT") }), ["--phase", "3"]);
check("--phase 3 still reports next = Phase 2", j.next.action === "run-phase" && j.next.phase === 2 && j.next.laterPhasesWithCandidates.includes(3), j.next);

// 15. CRLF tasks.md parses identically.
j = run(mk({ status: auth("T010"), cards: t010(), crlf: true }));
check("CRLF file -> same candidate result", j.tasks.T010.status === "candidate" && j.authorizations.length === 1, j.tasks.T010);

// 16. IDs inside a Prerequisites parenthetical warn.
check("parenthetical IDs warn", run(mk({ status: auth("T010"), cards: t010("T001; G-IMPLEMENT (see OD-05)") })).warnings.some((w) => /OD-05/.test(w)));

// ================= T001 entry gates (circular-dependency regression) =================
const BE_TABLE = (rows) => `# Amendment\n\n**5.1 Entry conditions: the \`backend-entry\` gate that T001 needs**\n\n| # | Condition | Evidence | State |\n|---|---|---|---|\n${rows}\n\n**5.2 Produced by T001, not required by it.**\n- **BE-8:** T001's own record. not met\n`;
const beRow = (id, state) => `| ${id} | cond | ev | ${state} |`;
const ALL_MET = ["BE-1", "BE-2", "BE-3", "BE-4"].map((i) => beRow(i, "met")).concat([beRow("BE-5", "**met for run/disposition only (2026-11-15)**; item statuses preserved"), beRow("BE-6", "met by the prior separate approvals"), beRow("BE-7", "historical findings preserved; **BE-7 met 2026-11-16** (PD-048 item 6)")]).join("\n");
const SEC_G = "# Assessment\n\n## G. BE-5 owner disposition — approved 2026-11-15\n\n**Status:** Approved by the project owner on 2026-11-15 for disposition of CHK001–CHK082 only.\n\n## H. Next\n";
const ENTRY_REG = "| backend-entry | PD-047 M1-B BE-1–BE-7; T001 produces BE-8, not a prerequisite to itself. | T001 |\n| feature-checklist | Run/disposition requirement met; T001 records BE-8. | T001 |\n";
function entryFixture({ authT001 = true, rows = ALL_MET, secG = SEC_G, amendment = true }) {
  const d = mk({ status: authT001 ? auth("T001") : "none", register: ENTRY_REG, doneEvidence: [],
    cards: `## Phase 1: Setup\n\n${card(" ", "T001", "Revised Gate 2 content/structure approved 2026-11-15; still blocked.", "no task prerequisites; G-IMPLEMENT ; backend-entry, feature-checklist. Every task inherits prerequisites/gates transitively")}` });
  if (amendment) writeFileSync(join(d, "specs/002-p0-prd/backend-first-amendment.md"), BE_TABLE(rows));
  mkdirSync(join(d, "specs/002-p0-prd/checklists"), { recursive: true });
  if (secG !== null) writeFileSync(join(d, "specs/002-p0-prd/checklists/entry-gate-assessment.md"), secG);
  return run(d);
}
j = entryFixture({});
check("T001: authorized + BE-1..7 met + §G approved -> candidate (no BE-8 needed)", j.tasks.T001.status === "candidate" && j.next.action === "run-phase", j.tasks.T001);
check("  ...entry evidence surfaced, gates not reported closed", Object.keys(j.readBeforeDispatch.T001.entryEvidence).join() === "backend-entry,feature-checklist" && Object.keys(j.readBeforeDispatch.T001.closedGates).length === 0, j.readBeforeDispatch.T001);
check("T001: not authorized -> awaiting-authorization", entryFixture({ authT001: false }).tasks.T001.status === "awaiting-authorization");
const be7open = ALL_MET.replace("**BE-7 met 2026-11-16** (PD-048 item 6)", "G01-review remains open, so BE-7 is not satisfied");
check("T001: BE-7 open -> gates-open (backend-entry)", /backend-entry/.test(entryFixture({ rows: be7open }).tasks.T001.why || ""));
check("T001: BE-6 missing -> gates-open", entryFixture({ rows: ALL_MET.split("\n").filter((l) => !/BE-6/.test(l)).join("\n") }).tasks.T001.status === "gates-open");
check("T001: BE row duplicated -> gates-open", entryFixture({ rows: ALL_MET + "\n" + beRow("BE-3", "met") }).tasks.T001.status === "gates-open");
check("T001: BE-5 'met' but 'pending' -> both entry gates open", /backend-entry, feature-checklist/.test(entryFixture({ rows: ALL_MET.replace("**met for run/disposition only (2026-11-15)**", "met; owner disposition pending") }).tasks.T001.why || ""));
j = entryFixture({ secG: null });
check("T001: assessment §G missing -> feature-checklist open only", j.tasks.T001.status === "gates-open" && /feature-checklist/.test(j.tasks.T001.why) && !/backend-entry/.test(j.tasks.T001.why), j.tasks.T001);
check("T001: §G not approved -> feature-checklist open", entryFixture({ secG: SEC_G.replace("— approved 2026-11-15", "— proposed").replace("Approved by the project owner on 2026-11-15", "Proposed") }).tasks.T001.status === "gates-open");
check("T001: amendment missing -> gates-open", entryFixture({ amendment: false }).tasks.T001.status === "gates-open");
// Not-met lexicon (review F4): each phrase in any BE-1..BE-7 cell keeps backend-entry open.
// Every phrase starts with "met", so only NOT_MET (not the leading-"met" anchor) can reject it.
for (const [be, phrase] of [["BE-1", "met; not met for staging"], ["BE-2", "met, not yet met for staging"], ["BE-3", "met; unmet for staging"], ["BE-5", "met; not yet"], ["BE-4", "met; still open"], ["BE-1", "met; blocked"], ["BE-2", "met but incomplete"], ["BE-3", "met; revoked 2026-11-20"], ["BE-4", "met; withdrawn"], ["BE-6", "met; reopened"], ["BE-7", "met; not approved"], ["BE-1", "met; unresolved"], ["BE-2", "met; no longer valid"]]) {
  const rows = ALL_MET.split("\n").map((l) => (l.startsWith(`| ${be} |`) ? beRow(be, phrase) : l)).join("\n");
  check(`T001: ${be} '${phrase}' -> backend-entry open`, /backend-entry/.test(entryFixture({ rows }).tasks.T001.why || ""));
}
check("T001: real BE-6 wording ('not granted by BE-5') still counts as met", entryFixture({}).tasks.T001.status === "candidate");
// Entry evidence satisfies T001 only (review F3): another card naming backend-entry also needs T001 verified done.
function otherCardFixture(t001Done) {
  const d = mk({ status: auth("T001, T020"), register: ENTRY_REG, doneEvidence: t001Done ? ["T001"] : [],
    cards: `## Phase 1: Setup\n\n${card(t001Done ? "x" : " ", "T001", APPROVED, "no task prerequisites; G-IMPLEMENT ; backend-entry, feature-checklist")}\n## Phase 2: Foundational\n\n${card(" ", "T020", APPROVED, "G-IMPLEMENT; backend-entry")}` });
  writeFileSync(join(d, "specs/002-p0-prd/backend-first-amendment.md"), BE_TABLE(ALL_MET));
  mkdirSync(join(d, "specs/002-p0-prd/checklists"), { recursive: true });
  writeFileSync(join(d, "specs/002-p0-prd/checklists/entry-gate-assessment.md"), SEC_G);
  return run(d);
}
check("entry gate on a non-T001 card without T001 done -> gates-open", /backend-entry/.test(otherCardFixture(false).tasks.T020.why || ""));
check("entry gate on a non-T001 card with T001 verified done -> candidate", otherCardFixture(true).tasks.T020.status === "candidate");

// ================= Direct-card gates (finding M1) =================
const UI4 = ["T011", "T026", "T042", "T045"];
const uiCards = p1 + UI4.map((id) => card(" ", id, APPROVED, "T001; G-IMPLEMENT")).join("");
const uiReg = (cell) => `| ui-entry | ${cell} | ${UI4.join(", ")}, T058 |\n| bff-money-home | Closed 2026-11-13 by PD-039 item 1. | none (T011 now depends on T079) |\n`;
j = run(mk({ status: auth(UI4.join(", ")), register: uiReg("M1-UI conditions are met; T084 is a predecessor"), cards: uiCards }));
for (const id of UI4) check(`direct-card: ${id} open ui-entry (not in its Prerequisites) -> gates-open`, j.tasks[id].status === "gates-open" && j.tasks[id].gates.includes("ui-entry"), j.tasks[id]);
check("direct-card: 'none (…)' cell adds no edge", !j.tasks.T011.gates.includes("bff-money-home"), j.tasks.T011.gates);
check("direct-card: next is blocked", j.next.action === "blocked", j.next);
j = run(mk({ status: auth(UI4.join(", ")), register: uiReg("Closed 2026-12-01 by owner record."), cards: uiCards }));
check("direct-card: ui-entry dated Closed -> candidates", UI4.every((id) => j.tasks[id].status === "candidate"), UI4.map((id) => j.tasks[id].status));

// ================= Copies of the real approved artifacts (sanitized: live authorization lines stripped and live T001/T002 ticks reset) =================
// Each copy starts with NO recorded authorization, so these tests do not depend on today's Status line (review F5);
// every authorization a test needs is added explicitly.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const REAL = ["specs/002-p0-prd/tasks.md", "specs/002-p0-prd/backend-first-amendment.md", "specs/002-p0-prd/checklists/entry-gate-assessment.md"];
const stripAuth = (s) => { const [head, ...rest] = s.split("\n## "); return [head.replace(/\*\*Implementation authorization( revoked)? \(owner,/g, "**Historical note (owner,"), ...rest].join("\n## "); };
function realCopy(edit = (s) => s, doneEvidence = []) {
  const d = mk({ status: "none", cards: "", doneEvidence });
  for (const rel of REAL) { mkdirSync(dirname(join(d, rel)), { recursive: true }); writeFileSync(join(d, rel), readFileSync(join(ROOT, rel), "utf8")); }
  const tp = join(d, REAL[0]);
  writeFileSync(tp, edit(stripAuth(readFileSync(tp, "utf8").replace(/\r\n/g, "\n").replace(/^- \[x\] (T00[12]) /gm, "- [ ] $1 "))));
  return run(d);
}
const addAuth = (list) => (s) => s.replace("**Status**: ", `**Status**: **Implementation authorization (owner, 2026-12-01): ${list} only.** `);
const tickT001 = (s) => s.replace(/^- \[ \] T001 /m, "- [x] T001 ");
const cands = (j) => Object.entries(j.tasks).filter(([, t]) => t.status === "candidate").map(([id]) => id).sort().join(",");
const SEED = "T001, T010, T035 and T048";
j = realCopy();
check("real copy: no authorizations -> no candidates, T001 is the only unblocker", j.authorizations.length === 0 && cands(j) === "" && JSON.stringify(j.next.smallestUnblockingAuthorizations) === '["T001"]', j.next);
check("real copy: T001 entry evidence verifies from the approved artifacts", j.entryEvidence["backend-entry"].met && j.entryEvidence["feature-checklist"].met, j.entryEvidence);
j = realCopy(addAuth(SEED));
check("real copy: T001+T010/T035/T048 authorized -> candidates exactly T001", cands(j) === "T001", cands(j));
check("  ...T010/T035/T048 still waiting on T001", ["T010", "T035", "T048"].every((t) => j.tasks[t].status === "waiting-deps"));
j = realCopy((s) => tickT001(addAuth(SEED)(s)), ["T001"]);
check("real copy: T001 done with evidence -> candidates exactly T010,T035,T048", cands(j) === "T010,T035,T048", cands(j));
check("  ...T002 and T058 still need authorization", j.tasks.T002.status === "awaiting-authorization" && j.tasks.T058.status === "awaiting-authorization");
j = realCopy((s) => tickT001(addAuth(SEED)(s)), []);
check("real: T001 [x] without evidence -> dependants stay waiting", cands(j) === "" && j.tasks.T010.status === "waiting-deps", cands(j));
// Force T011/T026/T042/T045 content-approved and authorized, and strip ui-entry from their own Prerequisites lines:
// the register's Direct cards column alone must keep them blocked.
const forceUI = (s) => {
  const lines = s.split("\n"); let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^- \[[ xX]\] (T\d{3}) /); if (h) { cur = h[1]; continue; }
    if (!UI4.includes(cur)) continue;
    if (/^\s+- Readiness:/.test(lines[i])) lines[i] = "  - Readiness: Gate 2 content approved 2026-12-01 (test copy).";
    if (/^\s+- Prerequisites:/.test(lines[i])) lines[i] = lines[i].replace(/\b(PM-6-)?UI-entry\b|\bui-entry\b/gi, "");
  }
  return lines.join("\n");
};
// Close every OTHER register gate in the copy (test-only), so ui-entry is the only thing that can block (review F1).
const closeAllButUiEntry = (s) => {
  const [head, ...rest] = s.split("\n## Gate register");
  const [reg, ...after] = rest.join("\n## Gate register").split("\n## ");
  const reg2 = reg.split("\n").map((l) => { const m = l.match(/^\|\s*`?([A-Za-z][\w/-]*)`?\s*\|([^|]*)\|(.*)$/); return m && !["Gate", "ui-entry", "G-IMPLEMENT"].includes(m[1]) ? `| ${m[1]} | Closed 2026-12-01 (test copy). |${m[3]}` : l; }).join("\n");
  return [head, [reg2, ...after].join("\n## ")].join("\n## Gate register");
};
const openGates = (t) => (t.status === "gates-open" ? t.why.replace(/^[^:]*:\s*/, "").split(", ").sort() : []);
// One copy per UI card: every other card is ticked with recorded evidence, so only gates can block it
// (T026 depends on T011 and T045 on T042, so the four cannot share one copy).
const realIds = [...readFileSync(join(ROOT, REAL[0]), "utf8").matchAll(/^- \[[ xX]\] (T\d{3}) /gm)].map((m) => m[1]);
for (const id of UI4) {
  const others = realIds.filter((x) => x !== id);
  const tickOthers = (s) => s.replace(/^- \[ \] (T\d{3}) /gm, (m, x) => (x === id ? m : `- [x] ${x} `));
  j = realCopy((s) => closeAllButUiEntry(forceUI(tickOthers(addAuth(id)(s)))), others);
  const t = j.tasks[id];
  check(`real copy: forced ${id} (approved, authorized, all prerequisites done, every other gate closed, ui-entry stripped from its card) is blocked by register ui-entry alone`,
    t.taskDeps.every((d) => j.tasks[d]?.status === "done") && JSON.stringify(openGates(t)) === '["ui-entry"]' && cands(j) === "", { open: openGates(t), why: t.why, c: cands(j) });
  // Control: the same copy with ui-entry also closed makes the card runnable, proving ui-entry was the only blocker.
  j = realCopy((s) => closeAllButUiEntry(forceUI(tickOthers(addAuth(id)(s)))).replace(/^\| ui-entry \|[^|]*\|/m, "| ui-entry | Closed 2026-12-01 (test copy). |"), others);
  check(`  ...control: ${id} with ui-entry also closed -> candidate`, j.tasks[id].status === "candidate", j.tasks[id]);
}

for (const x of dirs) rmSync(x, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
