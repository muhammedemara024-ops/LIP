---
name: wanees-phase
description: Run one Wanees Spec Kit Phase end to end with the delegate fleet. It inspects Phase status, picks the next eligible Phase or resumes one, executes only owner-authorized tasks, runs Phase verification and one independent Phase review, then prepares one PR per Phase. Commit, push and PR need explicit owner authorization. Use for "/wanees-phase", "run the next phase", "resume phase N", "phase status".
argument-hint: "[status | next | phase <n> | resume | pr <n>]"
---

# wanees-phase (Claude Code pointer)

This file only points to the canonical procedure. Read **`.agents/skills/wanees-phase/SKILL.md`** and follow it, passing on the arguments you received (`$ARGUMENTS`).

If you received no arguments or `status`, run only:

```bash
node .agents/skills/wanees-phase/scripts/phase-status.mjs
```

Report the result and stop. (To check the parser, run `node .agents/skills/wanees-phase/scripts/phase-status.selftest.mjs`.)

Governance prevails over the procedure: `AGENTS.md` §5 (G02, `PD-048`), the constitution and `.agents/rules/`.
