---
name: wanees-phase
description: Run one Wanees Spec Kit Phase end to end with the delegate fleet. It inspects Phase status, picks the next eligible Phase or resumes one, executes only owner-authorized tasks, runs Phase verification and one independent Phase review, then prepares one PR per Phase. Commit, push and PR need explicit owner authorization. Use for "/wanees-phase", "run the next phase", "resume phase N", "phase status".
---

# wanees-phase — one Phase, one branch, one PR

**Scope.** This skill executes the approved cards in `specs/002-p0-prd/tasks.md` through the delegate fleet. It is a procedure only: it never sets gates, approvals or routing. `AGENTS.md` §5 (G02, `PD-048`), the constitution, `.agents/rules/` and `.delegate/config.json` own those, and they prevail over this file.

**Lifecycle:**
1. Status, then select or resume a Phase.
2. Preflight, then branch.
3. Execute the authorized tasks.
4. Phase verification.
5. Independent Phase review.
6. **Owner authorization.**
7. Commit, push, open one PR.
8. The owner merges.

**Arguments:**
- none or `status`: report only.
- `next`: select and run the next eligible Phase.
- `phase <n>`: run or resume Phase `n`.
- `resume`: continue the Phase recorded in state.
- `pr <n>`: prepare the commit and PR package for a Phase that has already passed review.

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
3. **Commit, push and PR creation each need the owner's explicit authorization for this Phase** (constitution X.4; `AGENTS.md` §5 *Approval Boundaries*, §8).
   - One owner message may grant several of them only if it names each one.
   - None of these counts as authorization:
     - a review verdict;
     - invoking this skill;
     - an earlier Phase's authorization;
     - anything you recorded yourself.
4. **No destructive Git operations without explicit owner authorization.**
   - Never merge.
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
1. `stop`: the fleet is not OK, or a saved state is unreadable.
2. `resume`: a saved Phase is not merged.
3. `run-phase`.
4. `blocked`.

Finish or close the active Phase before you select another.

**Next Phase.**
- It is the lowest-numbered Phase with a `candidate`. Phases are the `## Phase N` headings; never invent boundaries or reorder prerequisites.
- Later Phases that also have candidates run afterwards, one branch at a time.
- Read every clause the script reports as unparsed or warned before you dispatch.
- If nothing is eligible, report `smallestUnblockingAuthorizations` and the tasks that are authorized but waiting, then stop.

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
- Until then, `tasks.md` checkbox edits and any other edits to baseline files stay in the working tree only, and the PR lists them as "not committed".
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

## 7. Commit, push, PR (owner-gated)

1. **Assemble the package.** It contains:
   - the exact Phase-owned files, with unrelated and baseline files excluded and `baseline-not-in-git` resolved;
   - proof that each file's current SHA-256 equals the hash recorded by its passing review;
   - a secrets and PII scan;
   - the passing checks;
   - the proposed conventional commits;
   - the PR body from `references/pr-template.md`.
2. **Ask the owner** in one message, naming three separate actions:
   - commit these files with these messages;
   - push `feat/wanees-phase-<n>` to `origin`;
   - open one PR against `main`.

   Stop until the owner answers. Record the answer verbatim in `log.md`.
3. **Commit**, once per planned commit:
   1. `git add -- "<file1>" "<file2>" …` (exact files only).
   2. Check that `git diff --cached --name-only` equals exactly those files plus `.gitattributes`. If not, STOP.
   3. `git commit -m "<msg>" -- "<file1>" "<file2>" …`. The pathspec uses `--only` semantics, so `.gitattributes` stays staged and stays out of the commit.
   4. Check all of the following:
      - `git show --stat HEAD` lists exactly the presented files;
      - `git rev-parse HEAD:"<path>"` equals each file's reviewed blob id;
      - `git diff --cached --name-only` still shows `.gitattributes`.

   If any check fails, STOP and do not push. The push and PR authorizations become void; report to the owner. Do not amend or reset without owner authorization.
4. **Push:** `git push -u origin "feat/wanees-phase-<n>"`. Never force.
5. **PR.**
   - First check for an existing one: `gh pr list --repo muhammedemara024-ops/LIP --head "feat/wanees-phase-<n>" --state all`.
   - Only if none exists: `gh pr create --repo muhammedemara024-ops/LIP --base main --head "feat/wanees-phase-<n>" --title "<title>" --body-file "<file>"`.
   - Record the URL and leave the PR open. **The owner merges.**
6. **Later tasks in the same Phase.**
   - Authorized while the PR is open: add them to the same branch and PR. They need the same verification, a re-review of the new content, and fresh owner commit and push authorization.
   - The PR has already merged: stop and ask the owner about a continuation branch, because the one-PR-per-Phase target cannot hold.

## 8. State and resume

State lives in `.scratch/wanees-phases/phase-<n>/`. That directory is currently untracked and not gitignored, so never stage it. `state.json` (`stage: selected`) is the first file written in a new Phase directory:

| Entry | Contents |
|---|---|
| `state.json` | Phase state; schema in `references/state-schema.md` |
| `log.md` | Append-only and dated: preflight, dispatches, owner answers quoted verbatim, decisions |
| `runs/` | Briefs, relay output, snapshots and patches |
| `baseline/` | Copies of Scope files that were already modified or untracked |

Update `state.json` after every step. On resume, restart at the first step whose recorded evidence no longer matches reality. Never repeat completed work, re-review unchanged content, recreate an existing PR or duplicate a commit.

## 9. Report (every invocation)

- Phase and branch.
- Tasks run, done and blocked, each with the reason.
- Delegate runs: lane, model and status.
- Checks, with counts and environment.
- Review verdicts.
- The smallest set of owner decisions needed now.
- The PR URL, if there is one.
