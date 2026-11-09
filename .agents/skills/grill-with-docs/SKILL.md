---
name: grill-with-docs
description: A relentless interview to sharpen a plan or design, updating LIP's domain docs (docs/context/05-glossary.md and docs/context/01-decisions.md) as we go.
---

Read and apply both [`.agents/skills/grilling/SKILL.md`](../grilling/SKILL.md) and [`.agents/skills/domain-modeling/SKILL.md`](../domain-modeling/SKILL.md), together with [`docs/agents/domain.md`](../../../docs/agents/domain.md):

1. Use the existing LIP documentation structure:
   - **Glossary**: `docs/context/05-glossary.md`
   - **Decisions**: `docs/context/01-decisions.md` (`PD-001`..`PD-009`+)
   - **Business Rules**: `docs/context/04-business-rules.md`
   - **Upstream Fork Patches**: `docs/context/07-fork-patches.md`
2. Do **not** create a duplicate root `GLOSSARY.md` or `docs/adr/` directory.
3. Respect all **Approved** decisions in `docs/context/01-decisions.md`; record new candidate decisions as **Proposed** until the user explicitly approves them.
