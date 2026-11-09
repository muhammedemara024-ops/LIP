# CLAUDE.md — Claude Code Compatibility Bridge

> **Canonical Operating Manual**: [`AGENTS.md`](AGENTS.md) is the primary, agent-neutral operating manual for this repository.
> **Engineering Constitution**: [`.specify/memory/constitution.md`](.specify/memory/constitution.md) is the binding engineering charter for all specifications, plans, tasks, and code changes.

---

## 1. Mandatory Reading Order & Authority

Before proposing plans, writing specifications, or modifying code, read these files in order:

1. [`AGENTS.md`](AGENTS.md) — Canonical agent workflow, 3-tier task classification, approval gates, codebase map, and golden rules.
2. [`.specify/memory/constitution.md`](.specify/memory/constitution.md) — Binding 10-article engineering constitution.
3. [`docs/agents/domain.md`](docs/agents/domain.md) and [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md) — LIP skill configuration for domain vocabulary, decisions, and local `.scratch/<feature-slug>/` spec/ticket tracking.
4. [`docs/context/README.md`](docs/context/README.md) — Context pack index and order of authority:
   - (1) [`docs/context/01-decisions.md`](docs/context/01-decisions.md) (`PD-001` through `PD-009`+; only **Approved** decisions are binding)
   - (2) [`spec/`](spec/) (`/lip/v1` normative protocol specification)
   - (3) [`docs/context/04-business-rules.md`](docs/context/04-business-rules.md) (binding `MUST` domain invariants)
   - (4) [`docs/context/00-product-brief.md`](docs/context/00-product-brief.md), [`02-lip-architecture-map.md`](docs/context/02-lip-architecture-map.md), [`03-gap-analysis.md`](docs/context/03-gap-analysis.md) (`G-01`..`G-14`), [`05-glossary.md`](docs/context/05-glossary.md), [`06-roadmap.md`](docs/context/06-roadmap.md), and [`07-fork-patches.md`](docs/context/07-fork-patches.md) (`FP-001`+).

---

## 2. Agent Environment & Skill Compatibility

- **Primary Coding Agent**: Google Antigravity (`agy`).
- **Default Day-to-Day Workflow Skills (Matt Pocock Suite)**: Curated and adapted in [`.agents/skills/`](.agents/skills/) (`ask-matt`, `grilling`, `grill-with-docs`, `domain-modeling`, `diagnosing-bugs`, `tdd`, `codebase-design`, `code-review`, `improve-codebase-architecture`, `implement`, `to-spec`, `to-tickets`, `research`, `prototype`, `pr`, `retro`, `wait-what`, `handoff`).
- **Optional Workflow for Large / Complex Features (Spec Kit)**: Located in [`.agents/skills/speckit-*`](.agents/skills/).
- **Published Upstream Consumer Skills**: Located in [`skills/lip*`](skills/) (for external developers integrating with LIP).
- **Legacy Claude Code Skills**: Preserved untouched in [`.claude/skills/`](.claude/skills/). Where any skill instruction differs from the approval gates, domain paths, or git rules in [`AGENTS.md`](AGENTS.md) and [`.specify/memory/constitution.md`](.specify/memory/constitution.md), **`AGENTS.md` and the Constitution prevail**.
