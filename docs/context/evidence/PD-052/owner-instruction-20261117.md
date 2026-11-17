# Owner instruction (verbatim opening + condensed requirement list), 2026-11-17

The first three paragraphs below are verbatim; the numbered requirement list is a faithful condensation (headings as written by the owner) and the closing sentence is verbatim. The owner's message named model Claude Opus 5.5 High; this implementation was authored by a Sonnet 5.5 session and reviewed by the Opus 5.5 High `migration-review` lane (owner confirmation of that deviation and of the Proposed mechanics is requested in the run report).

Source: the project owner's message to the orchestrator session, 2026-11-17. Recorded for PD-052.

# Wanees — Permanent Spec Kit Workflow Repair

**Model: Claude Opus 5.5 High**

**Task: FIX THE WORKFLOW ITSELF. Do not merely run another implementation task or produce another execution prompt.**

The current workflow repeatedly stops after tasks, phases, deliveries and approval checks. The owner requires continuous Spec Kit implementation across the entire dependency graph.

Requirements (headings as written by the owner): 1. Diagnose the actual workflow. 2. Implement persistent continuous execution (`Load State → Select Eligible Task → Spec Kit Implement → Test → Independent Review → Deliver → Update State → Select Next Task`, repeated until the full approved execution queue is exhausted; automatic continuation after each Task, Phase and successful fast-forward push; resume from persisted state; never reimplement completed tasks; never restart completed reviews without a concrete reason; a blocked task is blocked, not a reason to terminate; search the complete dependency graph; keep a durable record of blocked tasks and the exact approvals needed). 3. Correct the approval system ("Preserve the owner's authority over unapproved scopes and decisions. Support consolidated, explicitly approved task batches as first-class authorizations. Do not request individual approval again for tasks covered by an existing valid approval. Do not treat a recommendation, draft or independent review as owner approval. If no authorized tasks remain, generate ONE consolidated approval request covering all remaining unblocked-by-technical-dependency scopes, instead of repeatedly stopping at individual tasks. Do not silently grant authorization to yourself."). 4. Integrate Spec Kit properly (`/speckit.implement` as the implementation engine; `/wanees-phase` as the persistent orchestrator around it). 5. Git delivery (preserve PD-050: scoped commit on `deliver/<slug>`, green required CI on the exact SHA, independent review when required, fast-forward push to main, never force-push, continue automatically; preserve unrelated work and the pre-staged `.gitattributes`). 6. Completion and unattended operation (one execution-scoped runId; success flag only when the explicitly defined full-run completion criteria are genuinely satisfied; never for partial work, a blocked Task or a successful intermediate Phase; checkpoints; no unrestricted permission bypasses or infinite polling/retry loops). 7. Verification (regression tests for the eight listed scenarios; run existing self-tests and the new tests; independent read-only review; deliver through the existing verified Git process). 8. Resume implementation after delivery.

"Deliver a functioning persistent workflow, not another plan, explanation or prompt."
