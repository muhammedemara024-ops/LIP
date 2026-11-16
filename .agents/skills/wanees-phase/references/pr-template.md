# Phase PR template

Title: `feat(wanees): Phase <n> — <Phase title> (<Txxx, …>)`

```markdown
## Phase <n> — <Phase title>

**Tasks in this PR:** <Txxx — title> (one line each, with the owner authorization date)
**Deferred in this Phase (not in this PR):** <Txxx — reason: awaiting authorization / content approval / dependency / gate>

## Summary
<What changed and why, per task, citing FR-/SC-/PD- IDs.>

## Verification
| Command | Environment | Passed | Failed | Skipped (reason) |
|---|---|---|---|---|
| npm run typecheck | Windows host | … | … | … |
| … | Linux node:22.22.0 + postgres:17-alpine | … | … | … |

## Independent review (AGENTS.md §5, G02)
| Change set | Author | Reviewer lane / model | Verdict | Evidence |
|---|---|---|---|---|

## Security, tenant isolation and migrations
<RLS, authz, PII, idempotency, ledger and migration notes; or "none touched" with the reason.>

## Compatibility (rule 01 §5)
<Impact, backward compatibility, data evolution, rollback.>

## Known limitations and open owner decisions
<…>

The owner merges. Do not auto-merge.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Every commit message ends with:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
