---
name: wanees-phase
description: Persistent, continuous orchestrator around Spec Kit implement for the Wanees tasks. It loops Load State, Select Eligible Task, /speckit-implement, Test, Independent Review, Deliver, Update State, Select Next Task over the whole dependency graph until the approved queue is exhausted, parks blocked tasks without stopping, and ends with one consolidated blocker report or a run-scoped success flag. Delivery is a fast-forward push to main (PD-050). Force pushes, deployment and unauthorized tasks stay forbidden. Use for "/wanees-phase", "run", "continue", "resume", "next", "phase status".
---

# wanees-phase — continuous orchestrator around Spec Kit implement

**Scope.** This skill executes the approved cards in `specs/002-p0-prd/tasks.md` through the delegate fleet. It is a procedure only: it never sets gates, approvals or routing. `AGENTS.md` §5 (G02, `PD-048`), the constitution, `.agents/rules/` and `.delegate/config.json` own those, and they prevail over this file.

**Default behavior is continuous.** One invocation runs the loop in §0 over the whole dependency graph. Task, Phase and delivery boundaries are checkpoints, never stopping points. The run ends only through `run-state.mjs finish` (§0, §10).

**Lifecycle (per task, repeated by the §0 loop):**
1. Status, then select or resume a Phase.
2. Preflight, then branch.
3. Execute the authorized tasks.
4. Phase verification.
5. Independent Phase review.
6. Pre-push conditions (§7).
7. Commit and fast-forward push to `main` (PD-050); record the SHA.

**Arguments:**
- none or `status`: report only (`phase-status.mjs`); writes nothing.
- `run`, `next`, `resume`, or any owner instruction to continue implementation: the continuous loop (§0) over every eligible task in every Phase. `resume` first adopts the unfinished run (`run-state.mjs init`).
- `phase <n> only`: restrict the loop to Phase `n`; without the word `only`, `phase <n>` means the loop starting there.
- `pr <n>`: prepare the commit package for a Phase that has already passed review (direct delivery; no PR unless the owner asks).

## 0. Continuous run protocol (default)

```
node .agents/skills/wanees-phase/scripts/run-state.mjs init            # new run, or adopt the unfinished one after compaction / restart
LOOP
  node .../run-state.mjs next      -> execute | resume-task | resume-phase | finish
  execute:      run-state start <T>; §4 implement through /speckit-implement; §5 verify; §6 review; §7 deliver;
                run-state done <T> --evidence "<counts>" --sha <main sha>; run-state deliver --sha <sha> --tasks <T,...>; then LOOP at once
  resume-task:  re-verify the working tree and recorded evidence against Git; continue the checkpointed task; never restart reviews of unchanged blobs
  resume-phase: verify state.json against Git (§1 Resume), finish that in-flight Phase work, then LOOP
  finish:       run-state finish   (COMPLETE flag only if the §10 criteria hold; otherwise BLOCKED report with ONE consolidated approval request)
```

**State and selection.** `phase-status.mjs` is the only classifier (candidates, blockers, the single consolidated approval request, the queue). `run-state.mjs` is the only durable run record (`.scratch/wanees-runs/<runId>/run.json`) and writes task evidence into the same `state.json` that `phase-status.mjs` reads. Both resolve state from the primary checkout, so a delivery worktree sees the same state. `tasks.md` ticks, the Gate register and every approval are edited only by their owners (§Hard rules), never by these scripts.

**Never stop at a boundary.** After each completed task, each completed Phase and each successful fast-forward push to `main`, the next action is `run-state.mjs next`. Do not post progress reports, summaries or "shall I continue" questions mid-run: progress goes to `log.md` and `run.json` only. The only exits are:
1. `finish` returning COMPLETE or BLOCKED (§10);
2. a hard safety stop that is not a task failure: fleet not OK (`next` returns `finish` with `environmentFault`), unreadable state, or an instruction in governance that forbids the action. Record it, write the BLOCKED report and end;
3. context compaction or process restart, which resumes through `init` + `next` (nothing is repeated: completed tasks are skipped, an in-progress task resumes, reviews of unchanged blobs stay valid).

**A blocked task is parked, not terminal.** On a failed test that cannot be fixed within the card's scope, a review finding unresolved after two follow-up rounds, an unmet gate discovered at dispatch, or an owner-only decision: `run-state.mjs block <T> --reason … --needs "<exact approval or fix>"`, then `next`. **Every task-level STOP in §4–§7 (scope violation, failed pre-push condition, agy permission denial, branch error, red verification) stops that task only:** record `block` with the exact `--needs`, then continue with the next eligible task. It never ends the run. Parking never relaxes a security, tenant-isolation, financial, migration or mandatory-verification requirement, and never lets a dependant start (dependants wait on verified `done`). Search the whole graph: `next` already returns the first eligible task in any Phase, so a parked task never hides unrelated work.

**Approvals.** Authorization lines are durable and phase-independent: a task covered by a recorded line (single, or a consolidated batch `**Implementation authorization (owner, YYYY-MM-DD, batch <label>): T…, T… and T… only`) is executed without asking again, for every Phase, commit, push and delivery. PD-050 is the standing authorization for fast-forward delivery of covered, reviewed tasks. A recommendation, a draft, an independent review verdict or silence is never an approval, and the orchestrator never records an authorization the owner did not write (hard rule 2). When `next` finds nothing eligible, do not ask per task: `finish` writes the BLOCKED report with ONE consolidated approval request (`consolidatedApproval`: every approval-pending task that is only waiting on the owner, the gates to close, and what is not yet requestable). That request is the only approval message of the run.

**Spec Kit is the implementation engine.** For each task, invoke the installed `speckit-implement` skill (Skill tool) scoped to that one task id, with the card, gates and brief from §4 as its context, and let it drive implementation. This skill never implements competing code paths. The installed skill is managed by the `specify` CLI and is not edited; its generic stop points are bound as follows for this project:
- *Checklist gate* (`checklists/`): scan read-only. Unchecked reviewer-owned items are logged in `log.md`; the Gate register and the recorded owner authorization decide eligibility (`phase-status.mjs`), so the generic "ask before proceeding" is already answered by the owner's recorded authorization for that task.
- *"Halt if a non-parallel task fails"*: applies to that task only. Fix within scope; otherwise `block` it and continue with the rest of the queue.
- *"Report progress after each task"*: `run-state done` plus `log.md`, never a chat stop.
- *Completion checkbox*: `[x]` in `tasks.md` is part of the delivery commit, after the task's evidence is recorded.

**Delivery per task or independent group.** Deliver each completed, reviewed task (or proven-disjoint parallel group) through §7 on its own `deliver/<slug>` branch; do not hold finished work until a Phase closes. `feat/wanees-phase-<n>` is a label for Phase state, not a required unit of delivery. After the push, `next` immediately.

## Hard rules (never relaxed by this skill)

1. **Phase selection is not authorization.** A task runs only when all four of these hold:
   - its Gate 2 content is approved;
   - a recorded owner implementation authorization names it, in a `tasks.md` Status line of the form "Implementation authorization (owner, YYYY-MM-DD): T… only";
   - its prerequisite tasks are done;
   - every gate on its card is satisfied.
     - "On its card" means the gates named in its Prerequisites, plus every register row whose **Direct cards** column names the card.
     - "Satisfied" means one of two things:
       - the gate is recorded `Closed YYYY-MM-DD …` in the `tasks.md` Gate register (case-sensitive and dated);
       - for the two entry gates, every entry condition in their approved definition is recorded met (§1 *Entry gates*).
     - A register row changes only when the owner records an approval (`AGENTS.md` §5, *Gate record*).
     - Never edit the register, or any approved artifact, to satisfy the script.

   If any of these is unknown, the task is blocked. Never start T001 or any other task without that record. Never schedule Phase 8 (gated tracks).
2. **Recording a new authorization.** When the owner names a new authorization in chat, record it before acting:
   - add a dated line in the same form to the `tasks.md` Status block (`AGENTS.md` §5, *Gate record*);
   - quote the owner's words in `.scratch/wanees-phases/phase-<n>/log.md`.

   Record only what the owner actually wrote.
3. **Commit and push need owner authorization** (constitution X.4; `AGENTS.md` §5 *Approval Boundaries*, §8). `PD-050` is the owner's standing authorization for normal commits and fast-forward pushes to `main` of completed, reviewed, authorized tasks only; it does not authorize deployment, secrets changes, force pushes or any unauthorized task. Anything outside `PD-050` needs a fresh explicit authorization naming each action.
   - None of these counts as authorization:
     - a review verdict;
     - invoking this skill;
     - an earlier Phase's authorization;
     - anything you recorded yourself.
4. **No destructive Git operations without explicit owner authorization.**
   - Never force-push and never delete remote branches. Never enable `LIP_AUTOMERGE_ENABLED` or native auto-merge.
   - Never run any of these:
     - `rebase`, `reset`, `stash`, `clean`;
     - `restore` or `checkout -- <path>`;
     - `rm`, `commit --amend`, `gc`, `prune`;
     - `push --force` or `--force-with-lease`;
     - branch deletion or history rewriting.
   - Any other destructive operation also needs explicit owner authorization.
   - Never push to `upstream`.
5. **No Codex and no blocked lanes.**
   - Never invoke `codex-delegate`, Codex or Sol.
   - Never use the blocked `security-review` or `critical-architecture-hydrogen` lanes.
   - Never use Argon or GPT-OSS without explicit owner approval.
   - If `phase-status.mjs` reports `FLEET NOT OK`, stop.
6. **Delegation must be real.**
   - Delegation means a relay run that produced a `result.json`.
   - A delegate's `status: completed` does not complete a task: the orchestrator re-verifies the diff and the tests.
7. **Preserve the working tree.**
   - Never run `git add -A`, `git add .`, `git add -u` or `git commit -a`.
   - `.gitattributes` was staged before this workflow existed. It is never part of a Phase commit and stays staged.
   - Quote every pathspec.
8. **Stricter rule wins.** If this procedure conflicts with governance, follow the stricter rule and report the conflict.

## 1. Status, select, resume

```bash
node .agents/skills/wanees-phase/scripts/phase-status.mjs            # all Phases
node .agents/skills/wanees-phase/scripts/phase-status.mjs --phase 2  # one Phase (next is still computed over all Phases)
node .agents/skills/wanees-phase/scripts/phase-status.mjs --json     # machine-readable
node .agents/skills/wanees-phase/scripts/phase-status.selftest.mjs   # parser self-test: synthetic fixtures plus temp copies of the approved artifacts (live authorizations stripped); never writes to the repo
```

**What the script reads.** It is read-only; Git runs with `--no-optional-locks`.
- From `tasks.md`:
  - the Phase headings and cards;
  - each card's Readiness and Prerequisites lines;
  - the Gate register;
  - authorizations, taken only from the Status block and only in the strict form.
- The fleet: no Codex lanes, the G02 review lanes present, `final-verdict` absent, and the trust hash.
- The Git state and any saved Phase state.

**How it classifies each card.** It fails closed and applies these checks in order:

| Check | Status |
|---|---|
| The card is ticked and a `state.json` records its evidence | `done` |
| The card is ticked but no evidence is recorded (it does not unlock dependants) | `done-unverified` |
| The card is in Phase 8 | `gated-track` |
| Gate 2 content is not approved | `awaiting-content-approval` |
| No recorded authorization names it | `awaiting-authorization` |
| A prerequisite task is not done | `waiting-deps` |
| A gate is unsatisfied: not recorded `Closed YYYY-MM-DD`, and not an entry gate whose conditions are recorded met. Gates come from Prerequisites tokens, from prose clauses that name a register key, and from the register's Direct cards column. | `gates-open` |
| Everything above passes | `candidate` |

**Read before dispatch.**
- Every `WARNING:` line means the card needs a human read.
- For each candidate, the script prints:
  - its unparsed Prerequisites clauses;
  - the full register cell of every closed gate (`READ:`), because a "Closed" row can describe a partial closure.
- Before dispatch, read them and log in `log.md` that you did.

**Authorization lines.** The script accepts only bold-led Status-block lines:
- grant: `**Implementation authorization (owner, YYYY-MM-DD): T… only`
- revocation: `**Implementation authorization revoked (owner, YYYY-MM-DD): T… only`

**Entry gates (T001).** `backend-entry` and `feature-checklist` mix entry conditions with output that T001 itself produces. Their register rows never read `Closed`, by design. The script verifies only their entry conditions, from the approved artifacts:

- **`backend-entry`** = BE-1 to BE-7. Each must be recorded met in the `backend-first-amendment.md` §5.1 table.
  - BE-8 is T001's own entry-evidence record (§2 E, §5.2: "T001 never requires its own output") and never blocks T001.
- **`feature-checklist`** = BE-5. Two things must hold:
  - BE-5 is recorded met in §5.1;
  - `checklists/entry-gate-assessment.md` §G carries a dated owner approval.

  Recording the checklist run in `quickstart.md` is T001's output.

This entry evidence satisfies the gates for T001 only. Any other card that names either gate also needs T001 verified done, because BE-8 is T001's output and later cards inherit T001. Any missing, duplicated or not-met element, or any unreadable file, keeps the gate open. Neither gate is ever reported or recorded as `Closed`. T001 still needs its separate named authorization (G-IMPLEMENT). Read the `READ: … entry gate` lines before dispatch.

**`next.action`.** It takes the first of these that applies:
1. `stop`: the fleet is not OK, or a saved state is unreadable (environment faults; `run-state.mjs` turns them into a BLOCKED report, not a retry loop).
2. `resume`: a saved Phase is in a non-terminal stage (not `merged`, `blocked` or `tracking`).
3. `run-phase`: carries the whole-graph `queue`.
4. `blocked`: carries `consolidatedApproval` (the single owner request) and `blockers` (each not-done card with the exact approval or dependency it needs).

A saved Phase in a non-terminal stage (not `merged`, `blocked` or `tracking`) is resumed first, then the loop continues. A `blocked` Phase is parked and never stops selection.

**Next Phase.**
- It is the lowest-numbered Phase with a `candidate`. Phases are the `## Phase N` headings; never invent boundaries or reorder prerequisites.
- Later Phases that also have candidates run afterwards, automatically, through the §0 queue (`queue` in the JSON output).
- Read every clause the script reports as unparsed or warned before you dispatch.
- If nothing is eligible, do not stop at one task: `run-state.mjs finish` writes the BLOCKED report with the single consolidated approval request (§0). `smallestUnblockingAuthorizations` and the tasks that are authorized but waiting go into it.

**Resume.** Read `.scratch/wanees-phases/phase-<n>/state.json`. Before trusting it, verify reality:
- the branch exists and is checked out;
- the recorded commits exist;
- the recorded file hashes still match;
- the recorded run directories exist;
- whether a PR exists: `gh pr list --repo muhammedemara024-ops/LIP --head "<branch>" --state all`.

Redo only what reality contradicts, and say why.

## 2. Preflight (once per session, before any dispatch)

1. Read `AGENTS.md` §5 (G02) and rules 01–05.
2. Run `claude auth status` and `agy models`. **Never probe Codex.**
3. Resolve each lane you will use: `node "$HOME/.claude/skills/delegate-setup/scripts/lane.mjs" resolve --cwd . --lane <lane> --implementer <impl>`.
4. Check the verification environment.
   - Linux + PostgreSQL 17 (`node:22.22.0` + `postgres:17-alpine`) needs a running Docker daemon (`docker info`) or an owner-chosen CI.
   - If neither is available, tasks that touch storage, migrations, RLS, auth, leases or tenant isolation cannot pass the Phase gate (rule 03 §2). Record that as a blocker.
5. Record the results in `log.md`.

## 3. Branch and baseline

**Inspect first:** run `git status`, `git branch -a` and check existing PRs. Branch only from `main`.

**Branch:**
- New branch: `git switch -c "feat/wanees-phase-<n>"` from the current `main` HEAD. Uncommitted changes carry over; nothing is discarded.
- Existing branch: `git switch "feat/wanees-phase-<n>"`. Never add `-f`, `--discard-changes` or `--merge`. On any error, STOP and report.

**Baseline record** (`state.json` → `baseline`):
- the HEAD SHA;
- the digest of `git status --porcelain=v1 -uall`;
- the SHA-256 and state (clean, modified, untracked or absent) of every file in each candidate card's Scope;
- a copy of every Scope file that is already modified or untracked, saved under `baseline/`.

**`baseline-not-in-git` blocker.** Raise it at branch time when a file the Phase must commit is untracked or modified before the Phase starts. Today this applies to `specs/002-p0-prd/`, including `tasks.md` and `quickstart.md`, and to the uncommitted governance edits. Committing those files in a Phase commit would carry non-Phase content.
- Work may continue on the working tree.
- Commit packaging (§7) stays blocked until the owner decides how the approved baseline lands.
- Until then, `tasks.md` checkbox edits and any other edits to baseline files stay in the working tree only, and the delivery report (§9) lists them as "not committed".
- Never fold them silently into a Phase commit.

## 4. Execute authorized tasks

**Lift `Executor: blocked` first.** Every card starts as `Executor: blocked; planned target: X`. Before any dispatch:
1. Log the rule 05 §4 readiness evidence: all gates closed, paths verified, contracts resolved.
2. Then record `tasks.<id>.executor` in `state.json`.

**Routing.** Routing follows the card and `.delegate/config.json`, never file paths.

| Card | Author |
|---|---|
| documentation or record cards (T001, T002, gate records) | the orchestrator writes directly (`planning` is read-only) |
| `reasoning` (rule 05 §3: concurrency, RLS and authorization, ledger, security primitives, upstream or fork-patch work, migrations on existing data) | the orchestrator. This is stricter than lane availability, because no writable lane is stronger than Hydrogen High or Sonnet High |
| `mechanical` code with a fully pinned brief | the `implementation` lane (agy, Hydrogen High) |
| UI cards whose Scope is `apps/web/src/app/**` (for example T083) | the `ui` lane (Sonnet 5.5) |

The `tests`, `complex-fix`, `bugfix`, `refactor`, `migrations` and `fast` lanes are used only when the card names the lane or the owner has recorded authorization. `backend-first-amendment.md` §8 says `tests` and `complex-fix` "remain unavailable for implementation without separate owner authorization".

**Per task:**
1. Read the card in full: acceptance, tests, invariants, STOP conditions and field 13. Read its `execution-briefs.md` section too.
2. Write a self-contained brief at `runs/<task>-<k>/brief.md`. It must contain:
   - the exact allowed files (the card's Scope);
   - the forbidden files;
   - the acceptance criteria;
   - the test commands;
   - "do not commit, stage or run destructive Git";
   - "stop and report on any STOP condition".
3. **Pre-snapshot.** Copy each allowed file and record its SHA-256 under `runs/<task>-<k>/pre/`. Files that do not exist yet are recorded as absent.
4. **Dispatch** through the user-level relays, in the background:
   - `node "$HOME/.claude/skills/agy-delegate/scripts/relay.mjs" --brief "<brief>" --cd . --lane implementation --out-dir ".scratch/wanees-phases/phase-<n>/runs/<task>-<k>"`
   - `node "$HOME/.claude/skills/claude-delegate/scripts/relay.mjs" --brief "<brief>" --cd . --lane ui --out-dir "…"`

   Do not pass `--dangerously-skip-permissions`. If headless agy denies a write, record the denial and ask the owner whether to allow that flag for this task. Never add it on your own.
5. **Parallel dispatch.** Allowed only within the current Phase, for `candidate`s that meet both conditions:
   - `tasks.md` names them as conditional parallel opportunities;
   - you have proved their full Scope file sets disjoint, including overlapping directory prefixes. The script's `parallelAdvisory` is only a hint.

   Otherwise run tasks serially. `tasks.md` names T010, T035 and T048 as parallel opportunities, but they sit in Phases 2, 5 and 6, so they run one Phase after another.
6. **Verify the run.**
   - `touchedFiles` must be a subset of the allowed files. If not, STOP and report. Never auto-revert.
   - Snapshot again under `runs/<task>-<k>/post-delegate/`.
   - Write `delegate.patch` from `pre/` to `post-delegate/` with `git diff --no-index` (`/dev/null` for new files), because plain `git diff` omits untracked files.
   - Re-run the card's tests yourself.
7. **Fix within scope**, either by a delta brief (`--resume-last`) or directly as the orchestrator. After an orchestrator fix:
   - snapshot again under `post-fix/`;
   - write `orchestrator.patch` from `post-delegate/` to `post-fix/`.

   These patches keep the §6 review splittable by author.
8. **Complete the task** only when its acceptance evidence holds.
   - Record the evidence in `state.json`, then mark `- [x]` in `tasks.md`. That edit stays in the working tree only while `baseline-not-in-git` is open.
   - A blocked task gets its reason recorded. Continue with the other independent authorized tasks.

A card's own Review clause, for example the mandatory independent review on HIGH cards T010, T035 and T048, is satisfied by the §6 Phase review, as long as that review names every such card and the file hashes it reviewed. An earlier review happens only when a card, a gate or the owner requires one.

## 5. Phase verification

Record exact pass, fail and skip counts with the environment (rule 03; constitution VII).

**Always run:**
- `npm run typecheck`
- `npm run docs:check`
- `npm run launch:check`
- `npm run public-safety:check`
- `npm test`

Label the environment of each result, for example "Windows host".

**Also run:**
- the affected workspace's build and lint, where they exist;
- each card's own acceptance and security checks;
- for storage, migration, RLS, auth, lease or tenant changes: Linux + PG17 runs of `tenant-isolation-live`, PostgreSQL storage tenant isolation and `postgres-lease-conformance`, with zero skipped mandatory tests. Windows results never substitute for these.

A required check that was skipped or failed blocks the Phase. Never report a skipped PostgreSQL test as passing.

## 6. Independent Phase review (G02 author→reviewer table)

Build the change sets from the recorded patches. Each reviewer runs read-only in a fresh session through `claude-delegate --read-only --lane <lane>`.

| Change set authored by | Reviewer lane |
|---|---|
| Opus (orchestrator), Hydrogen or Flash, with no Sonnet-authored part | `plan-review` (Sonnet 5.5 XHigh) |
| Sonnet (`ui`, or a Sonnet fallback) | `migration-review` (Opus 5.5 High), in a fresh session, never this orchestrator session |
| Mixed, including Sonnet | Split by the saved patches. If the parts cannot be separated, the work is blocked for the owner. |

- **Brief:** `references/phase-review-brief.md`. It covers the diff, the cards and their evidence, verification, migration safety and security.
- **Bind the review to content.** For exactly the content reviewed, record:
  - `files: {path: sha256}`;
  - `blobs: {path: <git hash-object -- path>}`. The Git blob id is immune to eol conversion.
- **Review clauses.** The review names every HIGH card whose Review clause it satisfies.
- **No review.** The review counts as no review if any of these holds:
  - the init event shows a write-capable tool;
  - `readOnlyViolation` is not `false`;
  - the init event's or `result.json`'s model or effort differs from the lane's.
- **Blocking findings** go back to the authoring lane. Re-run the affected checks, then get a follow-up review of the corrected change set.
- **Limits:**
  - At most two follow-up rounds. A material disagreement that remains stays blocked for the owner.
  - Never package while a HIGH or MEDIUM finding is open.
  - Any edit made after a review needs a re-review of the changed content.

## 7. Commit and push to main (direct delivery, PD-050)

Routine Phase delivery lands directly on `main` by fast-forward push. Do not open a PR for routine delivery. The owner's standing authorization (PD-050) covers normal commits and fast-forward pushes to `main` only for completed, reviewed, authorized tasks; it never covers force pushes, deployment, secrets or any unauthorized task.

1. **Assemble the package.** It contains the exact Phase-owned files (unrelated and baseline files excluded), proof that each file's current SHA-256 equals the hash recorded by its passing review, a secrets and PII scan, the passing checks, and the proposed conventional commits.
2. **Pre-push conditions (all required, in order):**
   - every task in the commit is authorized and its gates are closed (hard rule 1);
   - Phase verification (§5) passed in the delivery worktree, with exact counts and environment;
   - the independent review (§6) passed on exactly the content to be pushed (blobs equal);
   - `verify` is green on that exact SHA on `origin/deliver/<slug>[-r<k>]` (step 5);
   - `git fetch origin` done and the delivery branch contains `origin/main` (fast-forward possible).
   If any fails, STOP and do not push.
3. **Deliver from a separate worktree** based on the latest `origin/main` when the local checkout is behind or dirty: `git worktree add -b "deliver/<slug>" "<path>" origin/main`, cherry-pick or commit the Phase files there, re-verify, re-confirm blobs.
4. **Commit**, once per planned commit: `git add -- "<files>"`; check `git diff --cached --name-only` equals exactly those files (plus a pre-staged `.gitattributes` only in the primary checkout); `git commit -m "<msg>" -- "<files>"`; check `git show --stat HEAD` and each `git rev-parse HEAD:"<path>"` equals the reviewed blob id.
5. **Push (two steps, fast-forward only).** First `git push origin "HEAD:refs/heads/deliver/<slug>"` and wait for the `verify` run on that SHA (`gh run list --branch "deliver/<slug>"`); it must be green. Then `git push origin "<sha>:main"`, where `<sha>` is that same SHA. Never force, never `--force-with-lease`, never delete a branch on `origin`. If a push is rejected because `main` moved (non-fast-forward): `git fetch origin`; rebuild on a fresh ref and path, `git worktree add -b "deliver/<slug>-r<k>" "<path>-r<k>" origin/main` (cherry-pick only, never rebase or merge); re-run every §7.2 pre-push condition in full (§5 verification, blob equality, a fresh `verify` on the new ref; any reviewed file whose content or base context changed needs a §6 re-review); push again once; if rejected again, STOP. If the rejection cites required status checks instead, STOP: never change the ruleset, `verify`, strict mode or bypass actors; report to the owner (a PR is possible only under §7.8).
6. **After the push:** record the new `main` SHA in `state.json` (`stage: merged`, `delivery: "direct-main"`) and `log.md`; inspect the GitHub Actions run for that SHA and report its result.
7. **Later tasks:** record `run-state done` and `run-state deliver`, then continue the §0 loop at once. Each new set of authorized tasks repeats §4–§7 with its own review.
8. **Exception:** a PR is opened only if the owner explicitly asks for one for a specific change.

## 8. State and resume

State lives in `.scratch/wanees-phases/phase-<n>/`. That directory is currently untracked and not gitignored, so never stage it. `state.json` (`stage: selected`) is the first file written in a new Phase directory:

| Entry | Contents |
|---|---|
| `state.json` | Phase state and task evidence ledger (stage `tracking` when it only records completed tasks); schema in `references/state-schema.md` |
| `.scratch/wanees-runs/<runId>/run.json` | Run record: current task, completed tasks with evidence and SHAs, parked tasks with the exact approval needed, deliveries, checkpoints (written only by `run-state.mjs`) |
| `log.md` | Append-only and dated: preflight, dispatches, owner answers quoted verbatim, decisions |
| `runs/` | Briefs, relay output, snapshots and patches |
| `baseline/` | Copies of Scope files that were already modified or untracked |

Update `state.json` after every step. On resume, restart at the first step whose recorded evidence no longer matches reality. Never repeat completed work, re-review unchanged content, recreate an existing PR or duplicate a commit.

## 9. Report (end of run, or on an explicit status request)

- Phase and branch.
- Tasks run, done and blocked, each with the reason.
- Delegate runs: lane, model and status.
- Checks, with counts and environment.
- Review verdicts.
- The smallest set of owner decisions needed now.
- The PR URL, if there is one.

## 10. Completion signal (unattended runs; per-execution marker)

A completion marker belongs to exactly one execution. A stale or generic marker must never be able to trigger shutdown.

0. **Mechanics.** `run-state.mjs init` generates the run id, renames a leftover generic marker and creates the evidence directory; `run-state.mjs finish` applies items 2–4 mechanically. Do not write a marker by hand.
1. **Run id.** At the start of an unattended execution, generate `runId = wanees-<UTC yyyymmddThhmmssZ>-<8 random hex>` and record it in `log.md`. Evidence for the run goes under `D:\Wanees-Delegation-Evidence\runs\<runId>\` (report and evidence copies).
2. **Success marker.** Write `D:\Wanees-Delegation-Evidence\runs\<runId>\COMPLETE-<runId>.flag` only when every one of these is true: at least one task was executed in this run; every card in `tasks.md` is verified `done` with evidence in `state.json` (Phase 8 gated tracks keep this unreachable until the owner un-gates them: a partial run, a blocked task or a finished intermediate Phase never earns a marker); no task is in progress or parked; every completed task is covered by a recorded delivery; Phase verification, independent review and the delivery steps of §7 (including the green `verify` on the pushed SHA and the verified fast-forward) succeeded; no blocker is recorded. Its content is exactly one line: `PHASE_COMPLETE_SUCCESS runId=<runId> main=<full sha> tasks=<comma-separated task ids>`. Write it atomically (temporary file, then rename) as the last operation, after the report is saved.
3. **Blocked or incomplete.** Write `BLOCKED-<runId>.md` in the same directory (exact blockers, owner decisions needed, completed task ids and SHAs) and never a success marker. Doing no work because nothing is eligible is a blocked outcome, not a success.
4. **Never reuse.** Do not write, overwrite, rename into place or leave behind a generic `PHASE-COMPLETE.flag`. A leftover marker from an earlier run is renamed with a `.stale-<timestamp>` suffix (never deleted) before a new run starts. A watchdog must accept only a marker whose `runId` equals the id of the execution it started.
