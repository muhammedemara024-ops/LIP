# CLAUDE.md — Claude Code Entry Point

[`AGENTS.md`](AGENTS.md) is the canonical, agent-neutral operating manual, and [`.specify/memory/constitution.md`](.specify/memory/constitution.md) is the highest governing authority. This file only loads them, plus the always-on rules, into every Claude Code session. Do not add workflow rules here: change `AGENTS.md`, the rules or the constitution instead.

@AGENTS.md
@.specify/memory/constitution.md
@.agents/rules/01-architecture-and-upstream.md
@.agents/rules/02-security-and-tenant-isolation.md
@.agents/rules/03-testing-and-verification.md
@.agents/rules/04-git-and-deployment-governance.md
@.agents/rules/05-implementation-task-quality.md

## Claude Code specifics

- **Skills.** Claude Code loads `.claude/skills/`, which holds the legacy Phase 0 skills and Spec Kit's Claude integration copies of `speckit-*`. The curated, LIP-adapted skills live in `.agents/skills/`. When a skill of the same name exists in both, or only in `.agents/skills/` (for example `to-spec`, `to-tickets`), read and follow `.agents/skills/<name>/SKILL.md`.
- **Delegation.** Dispatch lanes from `.delegate/config.json` with the user-level `codex-delegate`, `claude-delegate` or `agy-delegate` skills (`AGENTS.md` §5).
