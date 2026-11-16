# Review handoff: roadmap 1.5 amendments, complete final diff (for Sol, round 1)

**Review state.**
- No Sol review has completed on any of this work. Rounds 0 and 0b failed on the usage limit (`review-report.md`).
- Nothing below is approved by a reviewer. Nothing is staged, committed or pushed. The index holds only `.gitattributes`.

**Complete final diff.**
- File: `final-diff.patch`, 1384 lines, regenerated 2026-11-13 after §G.
- It covers each baseline file in `baseline/` against the current file, plus 6 new files.

## A. Applied with owner approval (unchanged since round 0)

| File | What changed |
| --- | --- |
| `docs/context/01-decisions.md` | PD-029 heading and A1; PD-039 item 4 clarification; PD-043 update note; new PD-044 and PD-045 |
| `docs/context/06-roadmap.md` | Phase 1 approvals note; rows 1.2–1.5 |
| `specs/002-p0-prd/plan.md` | Entry gates item 4, final-name bullet |
| `specs/002-p0-prd/tasks.md` | Status line; `final-name` row; new `accessibility` gate |
| `specs/002-p0-prd/spec.md` | Status line; FR-134; SC-018; traceability row; Dependencies final-name line |
| `specs/002-p0-prd/journeys/*` (6 files) | Conditional-acceptance status; measurement-prototype wording; 1.3 scoring rule |
| `prototype/1.5-prototype-brief.md`, `prototype/1.5-entry-amendment-impact.md` | Aligned with the approvals |

## B. Changed since the failed round 0b (no owner approval needed: prototype-design documentation)

| File | Change | Evidence |
| --- | --- | --- |
| `prototype/D1-screen-inventory.md` | v0.1 → v0.2 (+33/−18). Its §8 change log lists: JG-08 corrected to Approved, with only its refusal contract DD; CUS-07 and CUS-08 unspecified behaviour labelled *proposed*; CSH-01 suspended enrollment refusal; DD(OD-13); PD-039 amount grammar; OWN-03 main language from provisioning; new CLI-08, CLI-09 and CLI-10; US9.3 and US11.6 cited | PD-040 C3 and the PD-041 table (`01-decisions.md` ~1943, ~1970); journey 1.3 S2, S5–S7; journey 1.4 O1; `operator-api.md` `POST /cafes`, `/owner-invites`, `/unconfirmed-captures`, `/slo/report`; PD-005 A3 (~493) |
| `prototype/D2-design-system.md` | v0.1 → v0.2 (+17/−6): §5 states the PD-007 money format and the PD-039 grammar and no-grouping rule; §7 reflow covers every surface; PIN keypad note | PD-007 (`01-decisions.md` ~628); PD-039 items 2–3 (~1913); W3C SC 1.4.10 |
| `prototype/D3-figma-requirements.md` | **New**: Figma workspace rules, file structure, frames, flows F-C1…F-O3, RTL and LTR rules, AA design criteria A1–A10, measurement-prototype rules, proposed carry-forward register | D1, D2, journeys 1.2–1.4, PD-028, roadmap 2.4 and M5 |
| `prototype/open-decisions-M01-A11Y01.md` | **New**: analysis of M-01 and A11Y-01 with options, plus agent recommendations that are **not** defaults (M-01 option A; A11Y-01 option 1) | Roadmap M1 and M5; `plan.md` Entry gates; PD-028; W3C *Understanding SC 3.3.8* (fetched 2026-11-13) |

## C. Verification since round 0b (Windows host, Node per repository; documentation only)

- **Coverage.** A script found every one of the 111 FRs in `spec.md` in D1 §6, with 0 missing. All 99 US acceptance scenarios are cited by ID in D1 §1–§5. Before the fix, 2 were not cited by ID: US9.3 and US11.6.
- **Contrast.** 8 D2 pairs were recomputed independently (WCAG 2.2 linearisation constant 0.04045). All 8 match D2 §1.
- **Working name.**
  - All 11 occurrences in `docs/` and `specs/` are ونيس (U+0648 U+0646 U+064A U+0633) followed by " — Wanees" (U+2014), or sit in a table cell.
  - "سينو": 0 occurrences.
  - The only permutation of those letters is "سنوي" ("annual") at `docs/context/03-gap-analysis.md:18`. It is a genuine word, not a typo.
- **Checks.**
  - `docs:check`: OK (10 pairs).
  - `public-safety:check`: passed (703 files).
  - `launch:check`: OK.
  - `typecheck`: exit 0.
  - `git diff --check`: clean.
  - `npm test`: not run (documentation only).
- **Line endings.** Line endings match the baseline in every edited file. The new files use LF.

## D. Open points for the reviewer (not fixed; outside the authorized D1/D2 scope or needing the owner)

1. `docs/context/01-decisions.md:1477`: PD-029's original wording, "approved before task 1.5 and any branding-dependent work", has no inline pointer to A1. A candidate fix appends "*(Timing amended by A1, 2026-11-13: before 1.5 acceptance.)*" and leaves the original text unchanged.
2. `prototype/1.5-prototype-brief.md` §7 lists "JG-08 (join before first publication)" among the decision-dependent items. JG-08 is Approved; only its refusal contract is open. A wording fix is needed.
3. In my earlier report D1 v0.1 had 15 owner screens. The correct count is 16: 7 onboarding screens, 8 pages and OWN-11a.

## E. Changed after `brief-r1.md` was first prepared (local work while Sol was usage-limited; Opus only, no Codex)

The pre-change copies are in `pre-r2-fixes/`.

| File | Change | Evidence |
| --- | --- | --- |
| `prototype/open-decisions-M01-A11Y01.md` | **Corrected an overstatement.**<br>Before: M-F5 said the pilot re-measures onboarding time "on real pilot transactions". Only the award flow is stated that way.<br>Now: M-F5 (award flow, SC-003), M-F5a (onboarding has no stated real-app basis; PD-028 ties it to task 1.4) and M-F6 (real-app checks 2.4, 3.3, 3.7, 4.6, M4, 5.2). Option A now names two homes the owner must decide (+8/−5) | PD-028 text; `spec.md` SC-001–SC-004, SC-009; roadmap 3.3, 3.7, 4.6 and the M4 DoD |
| `prototype/D3-figma-requirements.md` | v0.1 → v0.2 (+24/−5). §8 timing now uses the seven JG-02 events, SC-001 endpoint DD(F-02), separate SC-002 and the diagnostic, and the raw-time rule. v0.1 had fixed the stop marker on OWN-07. §9 register corrected, with three real-app rows added | Journey 1.4 protocol items 1–5 and its run table |
| `prototype/D1-screen-inventory.md` | v0.2 → v0.3 (+12/−5): DD(F-01) on CUS-02 and CUS-03; DD(OD-07) on OWN-10; DD(OD-06) on CLI-01; the sweep is recorded in the change log | `research.md` §5 OD-05–OD-07; `jg-consolidation-review.md` F-01 |
| `prototype/D4-annotation-register.md` | **New**, generated by script from D1 v0.3: 27 DD items, GATED screens (CSH-11, OWN-13), tap slots S3–S12, timing events. All NOT RUN or NOT SCORED | D1; journeys 1.3 and 1.4 |

**Verification after §E.**
- `docs:check` OK (10 pairs); `public-safety:check` passed (703 files); `launch:check` OK; `typecheck` exit 0; `git diff --check` clean. Only `.gitattributes` is staged. `npm test` was not run (documentation only).
- **Working name.**
  - All 11 occurrences of ونيس are spelt correctly (U+0648 U+0646 U+064A U+0633). Where the name is written in full, it is "ونيس — Wanees".
  - "سينو": 0 occurrences.
  - One Latin-only mention ("Wanees appears only in planning text") is in the brief's historical options table, Option A (`1.5-prototype-brief.md:36`). It is not a misspelling.

## F. Working-name correction request and Figma handoff (2026-11-13; Opus only)

**Name audit.** On 2026-11-13 the owner reported "سينو" as a mistake for "ونيس" and asked for correction.
- **Scope of the scan:** 934 text files across the repository, including `.scratch/`, excluding `node_modules` and `.git`.
- **Correctly spelt:** every occurrence of ونيس in the project documents (13 after this round) is U+0648 U+0646 U+064A U+0633.
- **"سينو" in project documents:** 0 occurrences.
- **"سينو" elsewhere:** it appears only in these review records (`brief-r0b.md`, `brief-r1.md` and this file), quoted as the typo being searched for. It is never used as branding.
- **Variants:** no variant with tatweel, a zero-width or bidirectional control character, Persian yeh or alef maksura was found. No Latin misspelling of Wanees was found.
- **Result:** **no correction was needed or made.** A terminal without bidirectional support draws ونيس (و-ن-ي-س) in reverse order, so it can look like "سينو". The stored text is correct.
- Wanees stays a provisional, legally uncleared working name (PD-043, PD-029 A1).

**Changed.** The pre-change copy is `pre-r2-fixes/D3-figma-requirements.v02.md`.

| File | Change | Evidence |
| --- | --- | --- |
| `prototype/D3-figma-requirements.md` | v0.2 → v0.3: inputs cite D1 v0.3, D4 and the set-up document; added flow F-O1a (OWN-02 → OWN-10) | Script check: every D1 ID cited in D2, D3, D4, the M-01/A11Y-01 file and the brief exists in D1, and OWN-02 was the only screen in no flow. The D4 markers equal the D1 DD set |
| `prototype/figma-workspace-setup.md` | **New**: owner set-up steps, workspace record, designer prerequisites, *proposed* handoff and export conventions. It assumes no connector access and no Figma price or plan feature | PD-044 item 1; brief §4 and AC-08, AC-11; D2 §2 and §9; D3 §1–§2 |

**Verification after §F.**
- `docs:check` OK (10 pairs); `public-safety:check` passed (703 files); `launch:check` OK; `typecheck` exit 0; `git diff --check` clean. Only `.gitattributes` is staged. `npm test` was not run.
- Nothing in this round decided M-01, A11Y-01, F-02 or F-11.

## G. Core prototype build order (2026-11-13; Opus only)

| File | Change | Evidence |
| --- | --- | --- |
| `prototype/D3-figma-requirements.md` | v0.3 → v0.4: new §4a, the core prototype. Iteration 1 is 22 screens covering 1.3 S3–S12 and 1.4 O2–O8; iteration 1b adds the claim branch (CUS-09, CSH-09). It sets done-when criteria and the decisions each score depends on. It states that iteration 1 does not complete 1.5; the other 26 of the 50 D1 screens stay required. The pre-change copy is `pre-r2-fixes/D3-figma-requirements.v03.md` | Roadmap 1.3, 1.4, 1.5; journey 1.3 S3–S12; journey 1.4 O2–O8; D1 (50 screens, counted by script) |

The OD-01 and A11Y-01 effect on the S3 tap count is the reviewer's to confirm: PIN length and the input form change the number of deliberate taps.

## H. PD-046 merchant branding (2026-11-13; Opus only; pending Sol)

- The owner approved the requirement (items 1–9). Open: MB-01–MB-04.
- Updated in place: PD-046; spec FR-135–FR-139, SC-019, US1.8, US4.9–US4.10; journey 1.4 O4a; D1 v0.4 (51 screens; OWN-08, ST-07); D2 v0.3 (default palette as `brand.*`; §1a derivation and demo palettes); D3 v0.5 (§4b demo, F-D1); D4 v0.2; brief AC-13; workspace setup v0.3; tasks T080–T082 with two gates.
- Not edited: `plan.md`, `data-model.md`, `contracts/` and the roadmap. They are the `branding-contracts` gate.
- Checks: D1 §6 has 0 of 116 FRs unmapped; D1 and D4 MB markers match; each new card has all 13 fields; docs:check passes (10 pairs); public-safety passes (703 files); launch and typecheck exit 0; `git diff --check` exits 0; only `.gitattributes` is staged.
- Contrast: computed by script with the 0.03928 constant and cross-checked with 0.04045, with identical results. The worst sampled on-colour is 4.50.

## I. PD-046 scope correction and Figma baseline (2026-11-13, pending Sol)

- Owner clarification: branding applies to any merchant (tenant) of any business category. PD-046 item 10 added; PD-046 lines in spec, D1–D3, the brief and T080–T082 now say "merchant". Demo Café A/B, `cafe-a`/`cafe-b` mode names and non-branding café text are unchanged. Target market (PD-001) not amended; flagged to the owner.
- MB-05 (optional merchant logo upload) recorded as open; spec out-of-scope row now cites it. No task change.
- Figma file lUyDsbGl7RDbOvyk25fV5q inspected read-only: page 13:2 metadata (structure, names, geometry) and page 0:1 only. Page 7:2, screenshots, variables, styles and text content were NOT read: the Starter plan's connector call limit was reached. figma-workspace-setup.md v0.4 records the file as the provisional baseline.
- Backups: pre-pd046-scope/.

## J. Autonomous session under owner delegation (2026-11-13), pending Sol

| Item | Change | Verification |
| --- | --- | --- |
| MB-01–MB-05 | Agent decisions recorded in PD-046, each "owner confirmation pending" (still Proposed; gate `branding-decisions` open). MB-01 customer merchant screens + owner preview; MB-02 screen list (auth screens platform-styled); MB-03 all stages, owner session, no step-up, audited → proposed PD-005 A5; MB-04 none in P0; MB-05 no logo in P0 | Text review |
| Pilot vs platform | PD-046 item 10 records the owner's category-agnostic statement; proposed PD-001 A1; term mapping merchant = tenant = "Business" | — |
| Spec / tasks / brief | MB status text; Dependencies list adds MB-05; gate row adds MB-05; logo row cites MB-05; traceability row cites roadmap 4.8 | docs:check |
| D1 v0.5, D4 v0.3 | ST-07 DD(MB-05); D4 §1 regenerated by script (reproduced all v0.2 rows) | 116/116 FR mapped; D1↔D4 32/32 |
| D2 v0.4 | §1b premium identity under themes; brand-on-brand text rule with computed ratios (default 9.03/6.76; A 7.50/2.76; B 5.89/1.30); QR ≥ 4 modules, no overlay; icon, chip rows | ratios by script |
| D3 v0.6 | §4c Signature Premium baseline: measured / inferred / unknown; reconciliation table (CUS-05 Home → CUS-06; tiers and discount not usable as P0 evidence; QR; ar/en; sizes; targets) | — |
| branding-contracts drafts | "Proposed amendment (PD-046), not approved at Gate 2" blocks in plan.md, data-model.md §4, owner-api.md, customer-api.md, execution-briefs.md § T080 (14 vectors, integer half-up rule); Status notes added; scoped-approval sentences untouched | vectors.py: 0.03928 vs 0.04045 agree; half-up = banker's for all vectors |
| Roadmap | Row 4.8, marked Proposed | docs:check |

Checks: docs:check OK (10 pairs); public-safety passed (703); launch 0; typecheck 0; git diff --check 0; staged: .gitattributes only. npm test not run (documentation only). Figma not retried (Starter call limit). Sol not run (unavailable per owner instruction). Backups: pre-mb-decisions/, pre-branding-contracts/.
Not touched: OD-01–OD-18, F-xx, JG-xx, M-01, A11Y-01, FP-003, all gates.
- Self-review fixes (same session): first-save version 0 (data-model ≥ 0, placeholder at 0); CUS-05 tiles read only their own card palette (customer-api, T082 step 3); T081 steps 2/3/5 aligned with the data-model draft (nullable all-or-none, is_default, reset never deletes); palette header narrowed to `Cache-Control: private` (added header, FR-121 offline unaffected); spec Status records item 10. Re-checked: docs:check OK, git diff --check 0, staged .gitattributes only. Advisor consulted was the in-session Opus 5.5 advisor, not Fable and not a §5 review lane. Fable: not consulted.

## K. Owner approval of merchant branding decisions (2026-11-14)

- Owner approved MB-01–MB-05, PD-001 A1 and PD-005 A5 on 2026-11-14 (decisions only; not Gate 2; no implementation, contract, migration, Figma or Sol waiver).
- Recorded: PD-001 A1 subsection; PD-005 A5 subsection (1 action, 3 cells, stage table 75); PD-046 "Owner approval" block (prevails over the agent proposals, kept as history).
- Updated: 00-product-brief (target market), 05-glossary (Business row), 06-roadmap row 4.8 (MB dependency removed; row still Proposed), spec.md (Status, clarification incl. PD-001 A1 terminology, roles row, FR-135/136/138, out-of-scope rows, dependencies), journey 1.4 (O4a, stage row), tasks.md (`branding-decisions` satisfied; MB-03 open details moved to `branding-contracts`; T081/T082 readiness, prereqs, STOP lines; line ~1537), execution-briefs (A5 cells block), five draft-block headers, owner-api/customer-api, D1 v0.6, D2 v0.5, D3 v0.7, D4 v0.4 (regenerated, 28/28), 1.5 brief.
- Not edited: T028 and research.md stage enforcement (both say 72 cells; need a Gate 2 revision for A5); AGENTS.md §1 and constitution Article I ("cafés and restaurants"; separate process).
- Open: MB-03 risk trigger for step-up and the palette rate-limit value (branding-contracts gate). Sol review of the branding drafts (HIGH: authentication/stage policy) has not run.
- Backups: `.scratch/entry-1.5-apply-20261113/pre-mb-approval/`.
- This section supersedes the MB-01–MB-05 row in the status table above ("owner confirmation pending", gate open).
- Agent-written text not separately approved (owner may object): the MB-02 screen classification (CUS-01, CUS-04, CUS-05 tiles, CUS-06–CUS-10 merchant; CUS-02, CUS-03, CUS-05 page, CUS-11–CUS-18 platform); the PD-001 A1 "recorded consequences"; the PD-005 A5 agent note.

## L. Gate 2 branding revision package (2026-11-14, proposed)

- New file `specs/002-p0-prd/gate2-branding-revision.md`: proposed MB-02 screen/palette-source policy, MB-03 policy P1–P9, in-place change list (§3), not-applied old→new text for approved artifacts (§4: T028 72→75, stage-cells row, research R-19, execution-briefs totals, README 429 row, owner-api provenance, and the owner-approved text that changes only if P2–P3 are approved), tests BT-01–BT-20, owner decisions U-1–U-6.
- In place (unapproved drafts and blocked cards only): owner-api and customer-api branding blocks, data-model branding block (cap counted from audit_log under the row lock), plan block, execution-briefs A5 note, T081/T082 prerequisites/edge cases/tests/STOP lines, tasks `branding-contracts` row pointer; 01-decisions PD-001 A1 consequence qualifier (LIP `merchant_id`/`brand_id`).
- Key findings: palette is not in FR-012's step-up list; owner_sessions has no creation/auth time; no BFF-side rate-counter store (directory.rate_counters is unreachable to lip_bff_app, R-06); README is silent on storing error responses under idempotency keys.
- Backups: `.scratch/entry-1.5-apply-20261113/pre-gate2-branding-package/`. No Sol review; Fable not consulted.

## M. Owner approval of U-1–U-6 and corrections A–C (2026-11-14)

- Owner approved U-1 (existing owner auth, re-sign-in on invalid session, no new OTP or risk subsystem), U-2 option B (owner attempt limiter: 30/owner account/rolling hour in a dedicated table), U-3 (401/403/429 never stored as idempotent results), U-4 option A (CUS-10 merchant via server-resolved context), U-5 (MB-02 classification), U-6 (10 successful saves/merchant/rolling hour, atomic), corrections A (CUS-09 reload keeps merchant), B (401 vs 403), C (validated merchant identifiers allowed). Decisions only; not Gate 2.
- Recorded: PD-046 approval block; PD-005 A5 refinement (old bullets kept, marked superseded). Updated: spec.md (Status, FR-136, FR-138, Dependencies), journey 1.4, D1 v0.7, D2 v0.6, D3 v0.8, D4 v0.5 (27/27 re-verified), roadmap 4.8, drafts (owner-api, customer-api, README note, data-model, plan, execution-briefs), T081/T082, gate rows, pointer notes on T028, T046, stage-cells, research R-19, execution-briefs totals.
- Package v2 (`gate2-branding-revision.md`): §3 proposed design (limiter table + definer function, success cap from audit_log under row lock, check order); §5 Gate 2 revisions not applied; §6 BT-01–BT-29; §8 D-1–D-7 open.
- Still open: Gate 2 approval of the package and D-1–D-7; Sol review (mandatory, HIGH) not run; Fable not consulted; T028 72→75 not applied.
- Backups: `.scratch/entry-1.5-apply-20261113/pre-u1-u6-approval/` (and `round2/`).
- This section supersedes the "Open" line in K (MB-03 risk trigger, rate-limit value) and the open U-items in L.
- Checkpoint 2026-11-14 (resume): U-1–U-6 alignment re-verified on the Windows host (typecheck, docs:check, public-safety:check, launch:check, git diff --check: all exit 0; only `.gitattributes` staged). The delegate lane config (global + project `.delegate/config.json`) was read only, not changed. No Spec Kit card is eligible: tasks.md shows 0 ready / 82 blocked; G-IMPLEMENT needs a separate, named implementation authorization for each card, and T001 is also blocked by M1. No implementation started. Next action: the owner names implementation-authorized cards (and closes M1 for T001), or approves the Gate 2 branding package after Sol's review.
- Checkpoint 2026-11-14 (implementation batch): the owner authorized implementation of T010, T035 and T048 only (prerequisites not approved). All three list `T001; G-IMPLEMENT` as prerequisites; T001 is blocked by M1 (roadmap 1.3(b) and 1.4(b) not run, 1.5 prototype not accepted, 1.6 open, final name) and the feature-checklist gate. All three are therefore BLOCKED; no code was written and no lane was dispatched. Recorded in the tasks.md Status line and G-IMPLEMENT row. This supersedes the previous "Next action": naming cards alone is not enough. Next action (owner): close M1 and feature-checklist and run T001, or record an explicit waiver of the T001 prerequisite for T010/T035/T048. Even then all three are HIGH risk; Sol (Codex) is unavailable, so finished work would be recorded as awaiting review.

### PD-047 / U-b adoption record (2026-11-15)

The owner approved PD-047 Revision 3 and the revised Gate 2 content/structure package within §§2-4; §5 exclusions remain binding. The synchronized Revision 3 §9 adoption edits were applied after Gate 2 approval. Earlier prototype-first next-action text in this historical handoff records the pre-adoption state and is superseded prospectively by M1-B → M1-UI → M1-done and T085 real-staging validation after UI implementation. Historical prototype evidence, owner approvals and NOT RUN/NOT SCORED outcomes remain unchanged. CHK001-CHK082 disposition, G01 independent review and separate named task authorization remain outstanding; no implementation was authorized by adoption.
- Checkpoint 2026-11-14 (M1 preparation): (1) Roadmap 1.6 rate part verified against Meta's official USD list-rate card effective 2026-10-01: Egypt authentication $0.0036, authentication-international $0.065 per message; recorded in roadmap row 1.6 (plan numbers not approved); source copy in `.scratch/m1-prep-20261114/`. (2) `/speckit-checklist` re-run for requirements changed since 2026-11-13: CHK065–CHK082 appended to `checklists/entry-gate.md` (82 items, all unchecked); agent assessment in `entry-gate-assessment.md` §F (0 CRITICAL, 0 HIGH, 4 MEDIUM; none blocks T001 or the first batch). (3) No clickable prototype exists: D3 says no Figma prototype file exists; only the owner's provisional visual baseline file (figma-workspace-setup.md §2) and the D1–D4 drafts. M1 still needs owner decisions: final name, F-02, F-11, F-12, 1.6 plan values, M-01, A11Y-01, the journeys' acceptance basis, prototype acceptance, the checklist review; and owner authorization of Figma work to build the prototype. Checks: docs, public-safety and launch checks exit 0; only `.gitattributes` staged. Backups in `.scratch/m1-prep-20261114/`.

## N. Figma prototype build attempt (2026-11-14), BLOCKED by the Figma MCP plan limit

- Owner authorized building the M1 clickable prototype in the connected Figma workspace (prototype design, interactions, verification and evidence preparation only; not M1, Gate 2, cards or code).
- Done: created an empty design file `LIP-P0-1.5-prototype`, key `n4Ca7i3KnOhvL0z0GEM1yZ` (https://www.figma.com/design/n4Ca7i3KnOhvL0z0GEM1yZ), and opened a session. The file has no confirmed content. The visual reference file `lUyDsbGl7RDbOvyk25fV5q` was not touched.
- Blocked: the first `use_figma` call (a test that creates two frames and one click-to-navigate reaction) was refused before running: "You've reached the Figma MCP tool call limit on the Starter plan. Upgrade your plan for more tool calls". So no screen, flow or reaction exists, and whether this tool can create real prototype connections is **untested** (not proven either way).
- Account (`whoami`): one plan, Starter tier, **View** seat. Figma's rate-limit page (fetched 2026-11-14): Starter View/Collab 20 calls per month; Full/Dev seats are "not included" on Starter; Professional Full/Dev 200 per day and 10 per minute. Exempt write tools listed: `add_code_connect_map`, `create_new_file`, `generate_figma_design`, `whoami`. The page does not mention `use_figma` and does not say when limits reset.
- Owner action to unblock: a Full (or Dev) seat on a Professional or higher plan for this account, or wait for the monthly Starter quota to reset (date not published) knowing 20 calls cannot build 51 screens in AR and EN. Not used without a new owner decision: an HTML prototype in the repo, `generate_figma_design` captures (static frames, no reactions), Figma Make, or driving the Figma UI in a browser.
- Offline only (not M1 evidence, not Figma-verified): palette contrast. Gold #E8C88A on Mocha #3A2419 9.03:1; white on Mocha 14.52:1; black on Amber #F59E0B 9.78:1; Amber on white 2.15:1 and Gold on white 1.61:1 fail for text, so Amber/Gold need dark text or a darker derived tone on light backgrounds (#B45309 5.02:1 on white, 4.67:1 on #FBF6EE; #92400E 7.09:1 on white).
- Unchanged: M1 not accepted; T001, T010, T035, T048 blocked; 1.3(b) and 1.4(b) NOT RUN; open decisions F-02, F-11, F-12, M-01, A11Y-01 and the final name unchanged. No staging, commit or push.
- Next action (owner): unblock Figma (above) or choose another prototype medium; then the build resumes from D3 §4a (iteration 1 core) in this file.

## O. Backend-first, UI-last restructuring proposal (2026-11-14), PROPOSED, nothing applied

- Owner direction: backend first, one consolidated UI phase last; keep all UX research, decisions, journeys, D1–D4 and acceptance criteria.
- Proposal: `specs/002-p0-prd/backend-first-amendment.md`. It proposes PD-047: a new milestone M1-B "Backend entry" gates backend cards; M1 (prototype, 1.3 (b), 1.4 (b), 1.6, final name) gates UI cards; PD-039 item 4 is superseded in part; PD-045 M-01 is answered in part.
- Finding: besides M1, five backend cards wait on UI cards or the `prototype` gate (T027 via T011, T040 via T026, T043 via T042, T046 and T047 via T045). Each UI prerequisite is replaced by that UI card's own backend prerequisites. T049, T051 and T057 stay in the later phase with their UI or live-channel dependencies.
- Graph check (`.scratch/backend-first-20261114/graph.py`, output beside it): acyclic; no backend card reaches a UI card or inherits a UI gate. Executable batch after approval: T001, then T002 pass A, T010, T035 and T048. These are the only cards that are content-approved and have field 13. Reachable next, each needing Gate 2 content approval, field 13 and named authorization: T003, T079, T004, T005, T008, T039. After that come the stops at `schema-brief`, `benchmark-profile`, `journal-execution-brief` and OD-08/05/06/01. Reverse edges (UI cards wait for T040, T043, T046, T047), the new wizard UI card and the T002 two-pass split were added; the workstream graph has no backward edge.
- No constitution, AGENTS or rules amendment is needed: none mentions M1 or the prototype.
- Owner approvals needed: PD-047; the Gate 2 revision of `tasks.md` and `plan.md` (one new blocked wizard-UI card); `feature-checklist` closure; a Sol review (Codex restricted, not run); named authorization for T001 and T002 (then content approval with field 13 for the next wave); later the UX-artifact form, final name, A11Y-01, F-02, F-11, F-12 and M-01 for the UI phase.
- Unchanged: M1 open; all 82 cards blocked; no edits to decisions, roadmap, plan or tasks; no code, Figma, staging, commit or push.
