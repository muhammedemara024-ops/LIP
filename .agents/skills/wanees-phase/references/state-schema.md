# wanees-phase state schema

File: `.scratch/wanees-phases/phase-<n>/state.json`. It is untracked. Write it after every step. On resume, always re-check it against Git and the filesystem (SKILL.md §1).

```json
{
  "schema": "wanees-phase.v1",
  "phase": { "id": 2, "title": "Foundational …", "tasksSha256": "<sha256 of specs/002-p0-prd/tasks.md at start>" },
  "branch": "feat/wanees-phase-2",
  "stage": "selected | preflight | executing | verifying | reviewing | awaiting-owner | committed | pushed | pr-open | merged | blocked | tracking",
  "delivery": "direct-main | pr",
  "mainSha": "<sha on main after a direct push; for direct delivery, stage merged means pushed to main>",
  "baseline": {
    "head": "<sha>",
    "statusDigest": "<sha256 of git status --porcelain=v1 -uall>",
    "stagedAtStart": [".gitattributes"],
    "scopeFiles": { "<path>": { "sha256": "<hash or null if absent>", "state": "clean | modified | untracked | absent" } }
  },
  "preflight": { "at": "<ISO>", "claudeAuth": true, "agyModels": true, "fleetSha256": "<sha>", "fleetOk": true, "linuxPg17": "available | unavailable | ci" },
  "authorizations": [ { "scope": "T010", "date": "2026-11-14", "source": "tasks.md Status line" } ],
  "tasks": {
    "T010": {
      "status": "pending | running | delegate-returned | verifying | done | blocked",
      "executor": "mechanical | reasoning",
      "author": { "lane": "implementation", "implementer": "agy", "model": "<from result.json>" },
      "allowedFiles": ["<path>"],
      "readinessEvidence": "<rule 05 §4 evidence logged before executor was recorded>",
      "runs": [ { "dir": ".scratch/wanees-phases/phase-2/runs/T010-1", "status": "completed", "touchedFiles": [], "readOnlyViolation": null } ],
      "snapshots": { "pre": "runs/T010-1/pre/", "postDelegate": "runs/T010-1/post-delegate/", "postFix": "runs/T010-1/post-fix/" },
      "patches": { "delegate": "runs/T010-1/delegate.patch", "orchestrator": "runs/T010-1/orchestrator.patch" },
      "evidence": ["<command> → <exact counts>"],
      "blocker": null
    }
  },
  "verification": [ { "command": "npm test", "env": "Windows host | Linux node:22.22.0 + postgres:17-alpine | CI <url>", "passed": 0, "failed": 0, "skipped": 0, "skipReasons": [] } ],
  "reviews": [ { "changeSet": "opus+agy", "lane": "plan-review", "dir": "<run dir>", "verdict": "PASS | FAIL | no-review", "round": 0, "openFindings": [], "files": { "<path>": "<sha256 of reviewed content>" }, "blobs": { "<path>": "<git hash-object of reviewed content>" }, "cardsCovered": ["T010"] } ],
  "ownerDecisions": [ { "at": "<ISO>", "asked": "commit | push | pr | baseline | agy-permissions | env", "answerVerbatim": "<quote>" } ],
  "commits": [ { "sha": "<sha>", "message": "<subject>", "files": ["<path>"] } ],
  "pr": { "url": null, "number": null, "state": null },
  "blockers": [ { "id": "baseline-not-in-git", "detail": "<text>", "needs": "owner" } ]
}
```

**Stages that never gate selection.** `merged` (delivered), `blocked` (parked Phase) and `tracking` (evidence ledger written by `run-state.mjs`, holding no in-flight Phase work) never force `resume`. Every other stage means in-flight Phase work that must be verified against Git and finished first.

**Run record** (`.scratch/wanees-runs/<runId>/run.json`, written only by `run-state.mjs`): `{ schema: "wanees-run.v1", runId, startedAt, finished, current: {task, phase, since} | null, completed: [{task, phase, evidence, sha?}], blocked: [{task, reason, needs}], deliveries: [{sha, tasks, ci?}], checkpoints: [] }`. Task evidence itself is written into the Phase `state.json` below.

**Rules**

- A `done` task requires both of these:
  - `evidence` that satisfies the card's acceptance criteria;
  - `[x]` in `tasks.md`.
- A review whose `result.json` fails the G02 validity checks is recorded as `"verdict": "no-review"`.
- `ownerDecisions[].answerVerbatim` is the owner's exact words. Never paraphrase it.
- **Packaging.** A commit is packaged only if each file's SHA-256 equals the `files` hash recorded by a passing review. Otherwise the file needs re-review.
- **After the commit.** `git rev-parse HEAD:<path>` must equal the reviewed `blobs` id.
- **Completion evidence.** A `[x]` card counts as `done` for dependants only when a `state.json` records it with `status: "done"` and non-empty `evidence`.
- `tasks.<id>.executor` is set only after `readinessEvidence` is logged. Every card starts as `Executor: blocked`.
