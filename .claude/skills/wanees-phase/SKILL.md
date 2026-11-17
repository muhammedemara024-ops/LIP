---
name: wanees-phase
description: Persistent continuous orchestrator around Spec Kit implement for the Wanees tasks: loops select, implement, test, independent review, deliver, update state across all Phases until the approved queue is exhausted, parks blocked tasks, and ends with one consolidated blocker report or a run-scoped success flag. Use for "/wanees-phase", "run", "continue", "resume", "next", "phase status".
argument-hint: "[status | run | next | resume | phase <n> [only] | pr <n>]"
---

# wanees-phase (Claude Code pointer)

This file only points to the canonical procedure. Read **`.agents/skills/wanees-phase/SKILL.md`** and follow it, passing on the arguments you received (`$ARGUMENTS`).

If you received no arguments or `status`, run only:

```bash
node .agents/skills/wanees-phase/scripts/phase-status.mjs
```

Report the result and stop (status is the only report-and-stop mode). For `run`, `next`, `resume` or `phase <n>`, follow the continuous loop in SKILL.md §0 and do not stop between tasks, Phases or deliveries. Self-tests: `node .agents/skills/wanees-phase/scripts/phase-status.selftest.mjs` and `node .agents/skills/wanees-phase/scripts/run-state.selftest.mjs`.

Governance prevails over the procedure: `AGENTS.md` §5 (G02, `PD-048`), the constitution and `.agents/rules/`.
