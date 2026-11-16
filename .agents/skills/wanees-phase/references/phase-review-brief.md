# Phase review brief template

Send this through `claude-delegate` with `--read-only --lane <plan-review|migration-review>`. Use one brief per change set; SKILL.md §6 defines how the change sets are split.

```text
ROLE: Independent read-only reviewer under AGENTS.md §5 (G02, PD-048).
You authored none of this change set. Do not edit files and do not run write commands.

CHANGE SET: Phase <n> — <title>; authored by <models/lanes>; tasks <Txxx, …>.
BASE: <baseline head sha>. FILES: <exact list>.
DIFF: <path to saved patch(es)> (plus working-tree files listed above).

READ FIRST: AGENTS.md §5; .agents/rules/01..05; each task card in specs/002-p0-prd/tasks.md;
the cited sections of contracts/, data-model.md and execution-briefs.md.

CHECK:
1. Each task meets its card's acceptance criteria, tests and invariants.
2. Nothing falls outside the card Scopes, and no unauthorized task or gated track was touched.
3. Rule 01 §5 compatibility: impact inventory, backward compatibility, data evolution, regression and contract tests.
4. Security and tenant isolation (rule 02): RLS, no client-trusted tenant id, no PII in logs, URLs or idempotency keys,
   integer money, idempotency and the immutable ledger.
5. Migration safety (FP-001 ordering, idempotent, concurrency-safe), if any migration is present.
6. Verification evidence: exact counts and environment. A skipped PostgreSQL test is NOT a pass.
   Windows results do not stand in for required Linux + PG17 results.

OUTPUT:
VERDICT: PASS | FAIL
A findings table with columns id | severity (HIGH/MEDIUM/LOW) | file:line | issue | exact required change.
PASS means no HIGH or MEDIUM finding is open.
End with: "INDEPENDENCE: this session authored none of the reviewed changes and ran read-only."
This is review evidence only. It is not owner approval, and it authorizes no commit, push or merge.
```
