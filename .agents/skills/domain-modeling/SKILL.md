---
name: domain-modeling
description: Build and sharpen a project's domain model. Use when discussing codebase terminology, updating docs/context/05-glossary.md, or recording or reviewing decisions in docs/context/01-decisions.md.
---

# Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the *active* discipline: challenging terms, inventing edge-case scenarios, and writing the glossary and decisions down the moment they crystallise. (Merely *reading* `docs/context/05-glossary.md` for vocabulary is not this skill: that's a one-line habit any skill can do. This skill is for when you're changing the model, not just consuming it.)

## LIP File Structure (`docs/agents/domain.md`)

This repository uses an authoritative context pack under `docs/context/`. **Never** create a duplicate root `GLOSSARY.md`, `GLOSSARY-MAP.md`, or `docs/adr/` directory:

```
docs/
├── agents/
│   ├── domain.md                  ← Domain model & decision pointers
│   └── issue-tracker.md           ← Local `.scratch/<feature-slug>/` tracker config
└── context/
    ├── 01-decisions.md            ← Decision Log (PD-001 through PD-009+)
    ├── 04-business-rules.md       ← Binding MUST invariants
    ├── 05-glossary.md             ← Canonical Arabic/English domain & protocol glossary
    └── 07-fork-patches.md         ← Upstream LIP fork patch log (FP-001+)
```

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `docs/context/05-glossary.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term (in both English and Egyptian Arabic where applicable per `docs/context/05-glossary.md`). "You're saying 'account': do you mean the Customer (`ProgramAccount`) or the Merchant Tenant? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code and `spec/`

When the user states how something works, check whether the code, `spec/`, and `docs/context/04-business-rules.md` agree. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"

### Update `docs/context/05-glossary.md` inline

When a term is resolved, update `docs/context/05-glossary.md` right there, preserving its existing Arabic/English table structure and supplement sections (also keeping [GLOSSARY-FORMAT.md](./GLOSSARY-FORMAT.md) principles in mind: definitions must be crisp domain language, not implementation scratch pads).

### Offer Product Decisions (`PD-NNN`) sparingly

Only offer to record a new Product Decision entry (`PD-NNN`) in `docs/context/01-decisions.md` when all three are true:

1. **Hard to reverse**: the cost of changing your mind later is meaningful
2. **Surprising without context**: a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off**: there were genuine alternatives and you picked one for specific reasons

**Governance Rule (`AGENTS.md` Section 4)**:
- New candidate decisions MUST be recorded with status **Proposed** until the user explicitly approves them.
- Never modify or override an existing **Approved** decision in `docs/context/01-decisions.md` without explicit user approval.
- Consult [ADR-FORMAT.md](./ADR-FORMAT.md) for trade-off framing while matching the table/section structure of `docs/context/01-decisions.md`.
