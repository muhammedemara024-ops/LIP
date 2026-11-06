# Project context pack

Upload these files to the Claude Project knowledge, and keep `CLAUDE.md` at the
repo root for Claude Code. Order of authority when files disagree:

1. `01-decisions.md` (approved decisions)  
2. `spec/` (LIP normative protocol)  
3. `04-business-rules.md`  
4. Everything else

| File | Purpose |
| --- | --- |
| `00-product-brief.md` | What we are building, for whom, MVP vs vision |
| `01-decisions.md` | Decision log (approved + proposed) |
| `02-lip-architecture-map.md` | Our modules ↔ LIP code, tables and endpoints |
| `03-gap-analysis.md` | Full review: what LIP gives us and what is missing (Arabic) |
| `04-business-rules.md` | Invariants for loyalty, QR, transactions, messaging, tenancy |
| `05-glossary.md` | Arabic/English terms used across the project |
| `06-roadmap.md` | Phases, tasks, dependencies, acceptance criteria, milestones |
| `claude-project-instructions.md` | Paste into the Claude Project "Instructions" box |

Update rule: when a decision is made in chat, add it to `01-decisions.md` the
same day; stale context is worse than no context.
