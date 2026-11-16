# Gate 2 owner-decision package — P0 MVP

**Status**: **Decided by the project owner on 2026-11-13** (see *Owner decisions* at the end; they prevail over the proposals below where they differ). Recorded as PD-005 A3 and PD-039 in `docs/context/01-decisions.md`. The proposal text below is kept as the record of what was presented. Opus and Sol agree on this package; Fable has not been invoked, because no material disagreement is open. FP-003 stays blocked; OD-01–OD-18 stay unresolved. No entry gate or approved business rule is changed here.

**How to answer**: for each item, reply "approve as proposed", choose an alternative, or give your own rule. Approved stage answers are recorded as a dated PD-005 amendment in `docs/context/01-decisions.md` and transcribed into execution-briefs.md Stage-policy cells. Other answers are recorded in the Status lines of plan.md and tasks.md.

## A. Stage permissions not covered by PD-005 A2 (Q1–Q6)

The PD-005 A2 pattern (`docs/context/01-decisions.md` §PD-005 A2) has three stages:
- **Grace** allows everything.
- **Read-only** keeps the café operating (accrue, redeem, join) but stops growth and configuration of value (add staff, program changes, bonus/gift/migration).
- **Suspended** stops new value (no accrual, no joins) but always allows protective and corrective actions (redeem, void, correction, revoke, QR rotation).

The proposals below apply that pattern; none changes a row A2 already fixes.

| # | Action | Proposed: Grace / Read-only / Suspended | Rationale | Product impact |
| --- | --- | --- | --- | --- |
| Q1a | Change main language | ✓ / ✓ / ✓ | Presentation only; creates no value or capacity. | Owner can fix a wrong language at any stage. |
| Q1b | Change amount label | ✓ / ✓ / ✓ | Presentation only. | Same as Q1a. |
| Q1c | Change large-bill threshold (FR-025) | ✓ / ✓ / ✓ | A fraud control; tightening it must never be blocked. Accrual is already denied when suspended, so the setting is harmless there. | Owner keeps fraud control. A raised threshold in read-only only affects accruals A2 already allows. |
| Q1d | Change reward expiry 7–90 days (FR-045) | ✓ / ✗ / ✗ | It changes the terms of rewards issued from then on, so it falls under "Program and reward changes" (FR-048), which A2 denies in both stages. | No reward-term changes while unpaid. Issued rewards keep their immutable terms. |
| Q2 | Create a branch | ✓ / ✗ / ✗ | Growth; follows A2's "Add staff" row. Plan limits stay monitoring-only (FR-095), so this is a stage rule, not a limit. | A non-paying café cannot expand. |
| Q3 | Update a branch's names or hours | ✓ / ✓ / ✓ | Hours are used only for alerts (FR-082); names are presentation. No value or capacity. | Data stays accurate in every stage. |
| Q4a | Deactivate a branch | ✓ / ✓ / ✓ | Protective: it revokes devices, sessions and the QR (FR-081), like A2's revoke and QR-rotation rows, which are always allowed. | An owner can always shut a branch, for example after a leak or closure. |
| Q4b | Reactivate a branch | ✓ / ✗ / ✗ | Restores operating capacity; growth-like, so it follows "Add staff". | A branch deactivated by mistake can be restored only after payment. Alternative: allow in read-only. |
| Q5a | Issue a device enrollment code | ✓ / ✓ / ✓ | Redeem, void and correction stay allowed even when suspended (A2), and they need a working device. A replaced phone must be enrollable. It adds no staff or value. | Cafés can always honour customers' rewards. |
| Q5b | Re-verify a phone or reset a PIN for existing staff | ✓ / ✓ / ✓ | Maintains people already allowed to act; not "Add staff". OD-01 (enrollment/reset policy) stays separate and unresolved. | Locked-out staff can still perform permitted actions. |
| Q5c | Issue the owner-profile PIN setup code | ✓ / ✓ / ✓ | The owner needs the counter profile for voids and corrections, which are always allowed. | Owner can always correct mistakes at the counter. |
| Q6 | Edit the program draft without publishing | ✓ / ✓ / ✓ | A draft has no customer effect; publishing stays denied in read-only and suspended (A2, FR-048). | Owner can prepare changes to publish after paying. Alternative: deny, to keep "program" uniformly locked. |
| — | Grace for Q1–Q6 | ✓ for all | A2's grace column allows every action. | None. |

**Blocks**: only implementation, of T023, T046 and any endpoint wiring these actions (the `stage-cells` gate). It does **not** block Gate 2: those cards can be approved as blocked structure. T028 (the fixed 30 cells) is unaffected.

## B. Home of the server-side money parser (`bff-money-home`)

**Proposed decision**: a BFF-local module `apps/bff/src/money/` (with digit normalization) that repeats T010's pinned algorithm and the **same** test vectors, as a new task card. It is added under the already approved `apps/bff` application; this is a small, owner-approved amendment to plan.md Project Structure.

**Rationale**:
- The contract requires server-side normalization (contracts/README Money; staff-api amount input), and the BFF cannot import `apps/web` code.
- The alternative, a shared workspace package, would sit beside `packages/*`. That is the upstream LIP namespace, which the release checks scan (`scripts/check-launch-surface.ts`, verified by Fable). A product helper there would mix our code into the upstream release surface, which is an architecture change.
- The duplicate is about 60 lines of pure code, pinned by identical vectors in both apps, so drift is caught by tests.

**Alternative**: a shared product package outside `packages/*`. This is an architecture decision, deferred to P1.

**Product impact**: none visible; the web and the BFF produce identical results.

**Blocks**: only implementation of T029 (bill-amount preview) and T044 (analytics), not Gate 2.

## C. Two amount rules the contract leaves open

| Rule | Proposed decision | Rationale | Product impact | Blocks |
| --- | --- | --- | --- | --- |
| C1. Input grammar | The core parser accepts only `digits` or `digits` + `.`/`٫` + 1–2 digits (after digit normalization). It **rejects** `45.`, `.5`, grouping (`4,500`), signs and surrounding spaces. | Fail-closed for money: no guessing what a cashier meant. contracts/README Money says only "at most 2 decimals". | A malformed entry gets a validation error. The cashier UI (prototype, roadmap 1.5) should use a numeric keypad that cannot produce these forms, and may trim spaces before calling the parser. | Implementation of T010 only (its vectors include these cases). Gate 2 can approve T010 with this rule or with your change. |
| C2. Display grouping | No thousands separators: `1250 ج.م` / `EGP 1250`, exactly the PD-007 literal format. | PD-007 shows no grouping. Adding grouping raises a separate Arabic-separator question. Café bills rarely reach 4 digits of pounds. | Large owner-dashboard totals read as `1234567 ج.م`. Grouping can be added later as a UI-only display decision with the prototype, without changing stored amounts. | Same as C1. |

## D. Can T010, T035 and T048 start before the plan entry gates?

**Evidence**:
- **Approved gate.** plan.md "Entry gates" requires **all** of the following before *any* implementation task: Gate 2, roadmap 1.2–1.6, the final name and `/speckit-checklist`. Fable and Sol both confirmed this reading. Starting early therefore needs an explicit owner amendment; it cannot be read in.
- **Technical safety (low risk).** All three are pure functions in new files with no I/O, no package.json, no dependency and no schema.
  - The release check reads only `packages/`.
  - vitest already includes `apps/**/*.test.ts`.
  - Nothing deployable changes.
- **Rework risk differs.**
  - T010's display output could be revisited by the prototype (roadmap 1.5).
  - T035 (PD-008 A1) and T048 (SC-012) rest only on approved, stable sources.
- **Schedule value is about zero.** Every downstream card stays blocked by other gates: I3 schema manifest, prototype, ODs, `bff-money-home`, characterization. Starting early shortens no critical path.
- **Precedent cost.** Amending an approved entry gate for little gain weakens the gate model the governance relies on.

**Proposed decision**: **do not start early; keep the entry gates as written.**
- Meanwhile, do the non-implementation work the gates allow:
  - run `/speckit-checklist` (entry gate 5, a documentation step);
  - prepare the T001 evidence record as roadmap 1.2–1.6 complete.
- T010 + T035 + T048 remain the first batch the moment the gates close.

**Alternative, if you want code moving now**: a dated, narrowly scoped entry-gate exception for **T035 and T048 only**.
- These two are pure and rest only on approved sources.
- T010 would wait for the prototype.
- This is an amendment to an approved gate and needs your explicit wording; it is not recommended.

**Product impact**: none either way. These helpers ship nothing a user sees.

**Blocks**: neither Gate 2 nor anything else. This choice only decides *when* implementation may begin.

## E. Proposed scope of Gate 2 approval

Approve `plan.md` + `tasks.md` (+ execution-briefs.md) as follows:
- **Executable content once implementation is separately authorized and the entry gates close**:
  - T010, T035 and T048 (with C1/C2 as decided);
  - T001, T002 and T058 (documentation).
- **Gate records**: T059–T078, keeping OD-01–OD-18 unresolved and FP-003 blocked in the order of its gates (a)–(e), then V5/V6 and SC-017.
- **Blocked structure only**: every other card, until its gates (I3, Q1–Q6, `bff-money-home`, ODs, prototype, plans values and others) close and it is reviewed again.

Gate 2 approval authorizes **no** implementation, staging, commit, push or deployment. Each of those needs its own explicit owner approval. Each implementation diff is reviewed under AGENTS §5: Sol is mandatory for HIGH work, findings close with evidence and tests, and Fable is invoked only for an unresolved material disagreement and before any push.

## Owner decisions (2026-11-13)

| Item | Owner decision | Recorded in |
| --- | --- | --- |
| Q1–Q4 | Approved as proposed (Q4b reactivate: grace only). | PD-005 A3 |
| Q5 | **Refined:** suspended allows only recovery of access for existing, already authorized staff and devices; no enrollment of new staff or devices. Device enrollment codes are therefore ✓ / ✓ / ✗, and first-time owner staff profile setup is ✓ / ✓ / ✗. | PD-005 A3 |
| Q6 | **Refined:** draft edits allowed in grace and read-only, **denied in suspended**. Publishing stays denied where A2 denies it. | PD-005 A3 |
| B | `apps/bff/src/money/`; the BFF is authoritative and passes the T010 vectors. | PD-039 item 1; new card T079 |
| C1 / C2 | Strict amount input and no-grouping display approved. | PD-039 items 2–3 |
| D | All existing entry gates retained; no early-implementation exception. | PD-039 item 4 |
| Gate 2 | Scoped approval: content T001, T002, T010, T035, T048, T058; gate records T059–T078; all other cards blocked structure. No implementation authorization. | tasks.md and plan.md Status lines |

OD-01–OD-18 are not resolved by any of these decisions; FP-003 stays not authorized.
