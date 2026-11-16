# PD-047 Revision 3 — revised Gate 2 approval package

**Status:** Revised Gate 2 content/structure approved by the owner on 2026-11-15 within §§2-4; §5 exclusions remain binding. PD-047 Revision 3 is owner-approved and its synchronized §9 adoption edits were applied under conditional authorization. This approval does not disposition CHK001-CHK082, complete G01, authorize implementation or grant staging, deployment, commit or push permission. The source validation report retains its historically accurate pre-approval validation status.

**Risk:** HIGH. The package changes implementation entry dependencies across the plan and task graph, including backend, identity, loyalty and UI work.

**Review scope:** This package requests owner approval of the bounded plan/task/test-seam revisions below. The prior independent review of PD-047 Revision 3 remains evidence for that amendment only; it is not owner approval and is not represented here as an independent review of this package. G01 independent review remains open. No review status closes an owner gate.

## 1. Approval requested

Approve the specific revised Gate 2 content and blocked structure listed in §2–§5, to be incorporated in the later synchronized adoption edits after this approval. The source of the proposed text and dependencies is [Revision 3](../../specs/002-p0-prd/backend-first-amendment.md), especially §§2–§4 and §9. Its dependency manifest and graph validator are the proposal baseline.

This Gate 2 request is separate from the already given approval of PD-047. It does not imply checklist disposition, satisfy G01 review, close BE-5/BE-7, or authorize any task.

## 2. Plan and milestone scope submitted for approval

Approve these bounded changes to `specs/002-p0-prd/plan.md`:

1. Replace the blanket M1 implementation-entry condition with **M1-B/backend-entry → T001**, then T001's dated entry record as the inherited prerequisite for subsequent implementation cards; retain each card's own approval and gates.
2. Define **M1-UI/ui-entry** for final UI implementation and **M1-done** for completion evidence. Preserve historical M1/Phase 1 evidence and do not rewrite NOT RUN/NOT SCORED records as passes.
3. Record T084 as a documentation manifest that depends on T002 and precedes `ui-entry`; it does not depend on `ui-entry` or staging UX results.
4. Split PM-S and PM-1–PM-9 into backend implementation entry versus original full UI/staging/milestone completion evidence, exactly as Revision 3 §2 B. In particular, PM-6 backend cards T040/T041/T043 and PM-9 backend card T054 may enter on their own prerequisites; PM-6 UI entry remains `ui-entry`; T055 remains after M4 and full PM-6/7/8 completion.
5. Make real-staging acceptance T085 the owner of implemented UI timing/accessibility/device/camera/live-service evidence. Keep T085 after the implemented UI and live/staging prerequisites, not before them. Keep T085 free of M4, T055 and pilot prerequisites.
6. Keep original milestone completion criteria and all existing backend, security, legal, data-use, cost, deployment, messaging, restore and pilot gates. Do not convert completion criteria into hidden backend-entry conditions or waive them.

## 3. Task-card content and dependency scope

The owner is asked to approve exactly these changes to current task content/dependencies and the three new cards. This is not a blanket approval of every task's implementation or authorization.

| Cards | Proposed Gate 2 change | Approval boundary |
|---|---|---|
| **T001** | Replace M1 prerequisite with `backend-entry`; its evidence output is BE-8, not a self-prerequisite. Record BE-1–BE-7 and explicitly preserve unfinished UX/name/plan decisions as open at their own gates. | Content approval with field 13; no implementation authority. |
| **T002** | Narrow to backend dependency/module/file/test manifest; mark UI dependencies and UI manifest as unresolved for T084. | Content approval with field 13; no implementation authority. |
| **T010, T035, T048** | Change only blanket M1 wording to the approved backend-entry/T001 rule; preserve their existing scope, field 13 and separate prior implementation authorization. | Approval covers this exact prerequisite wording only; existing authorizations remain blocked by entry gates. |
| **T027** | Remove UI task/gates from backend card; retain API tests and add F-12; move wizard UI/browser acceptance to T083. | Blocked structure/content revision only; no task authorization. |
| **T040** | Remove T026 UI prerequisite; add backend prerequisites T003/T010/T025 and F-10; transfer screen state to T026. | Blocked structure/content revision only. |
| **T043** | Remove T042 UI prerequisite; add T030/T032/T033/T036 and F-10; transfer customer screens to T026 and owner screens to T042. | Blocked structure/content revision only. |
| **T046/T047** | Remove T045 UI prerequisite; replace with backend prerequisites listed in Revision 3 §3.1; transfer plan panel/alert page to T045. Keep plans-values gate on T046. | Blocked structure/content revision only. |
| **T011/T026/T042/T045/T082/T083/T058** | Apply `ui-entry` only to actual UI implementation and T058 inventory; add T084 as prerequisite to UI cards; T058 retains final-name gate. | Revised card/dependency approval only. T058 remains non-executable until its gates close. |
| **T083 (new)** | Owner-onboarding/program-wizard UI card; full 13-field card follows §3.1. Local/disposable and fake-service E1/E1b evidence only; OWN-08 stays in T082; staging measurement belongs to T085. | Full card/content, test seams and rule-05 field 13 submitted for approval; blocked pending gates and separate authorization. |
| **T084 (new)** | UI dependency and component/state/file/test manifest card; full 13-field card follows §3.2. T002 is its task prerequisite. No `ui-entry`, prototype, final 1.5 acceptance or staging-measurement prerequisite. | Full documentation card/content, test seams and field 13 submitted for approval; blocked pending G-IMPLEMENT and named authorization. |
| **T085 (new)** | Real-staging UX/accessibility/device/camera/live-service acceptance card; full 13-field card follows §3.3. Depends on T026/T042/T045/T082/T083/T057/T053 and exact required policy/permission gates; does not depend on M4/T055/pilot. | Full acceptance card and test/evidence seams submitted for approval; remains blocked pending its gates and separate permissions/authorization. |
| **T055/T056** | Add Revision 3's explicit downstream dependencies; preserve T055 after M4/full PM-6/7/8 and T056 after T085/M1-done plus M-01-M5 and all current pilot gates. | Dependency approval only; no security/load, live staging or pilot authorization. |
| **All implementation cards / graph** | Apply Revision 3's exact task and inherited-gate manifest, backend-entry/UI-entry/M1-done definitions, and mixed milestone splits. T080 receives T001 as entry evidence only. | Structural/dependency approval does not approve card content outside the rows above. T080–T082 branding scope remains unapproved. |

### New gate rows and transfers included

Approve the proposed register additions/transfers in Revision 3 §2 D and its exact graph manifest: `F-12`, `F-10`, `JG-08-refusal`, `A11Y-01`, `F-11`, `M-01-staging`, `M-01-M5`, `M1-done`, `M4`, `PM-6-backend-entry`, `PM-9-backend-entry`, `PM-6-UI-entry`, `PM-9-final-entry`, `F-02`, and `data-use-authorization`. Rename prospective `prototype` to `ux-brief`; transfer its and `accessibility` assignments off T027 as specified. These register changes do not resolve the underlying decisions or permissions.

The proposed T085 measurement composite must retain direct F-02 and data-use authorization, F-11, and M-01-staging. M-01-staging expands the exact F-02, F-11, A11Y-01, data-use and protocol/placement evidence; no defaults are invented.

### Proposed complete cards for T083–T085

These are **blocked draft cards** submitted for Gate 2 content/test-seam approval. Their presence does not assign implementation. They are subject to per-card prerequisites and named authorization after the common gates close.

#### T083 — Owner onboarding and program-wizard UI

`- [ ] T083 [US4] Build owner onboarding and program-wizard UI in apps/web/src/app/(owner)/`

1. **Objective:** Implement the owner invitation/onboarding and stamp-program wizard path. Implements FR-040–FR-049, FR-130–FR-134, SC-001/SC-002/SC-018, US4 and the owner flow in `journeys/1.4-owner-onboarding-journey.md`; final official UX acceptance is T085.
2. **Scope:** Owner UI under `apps/web/src/app/(owner)/` and `apps/web/src/lib/`; exact files, components, dependencies and tests are pinned by T084 before this card can become ready. Includes OWN-01–OWN-07 and local browser flow; OWN-08 merchant theming remains T082. No BFF, database, contract, provider, deployment or real-message changes. Preserve existing project files outside the reviewed T084 manifest.
3. **Prerequisites:** T017, T020, T023, T027, T011 and T084; `G-IMPLEMENT`, `ui-entry`, `ux-brief`, `accessibility`, OD-01, OD-02 and F-12; final-name/UI-entry conditions in Revision 3 §6. Every unresolved policy stays blocked. T082/T057/T085 are not prerequisites for this card.
4. **Implementation steps:** (a) Map the approved D1 states and D3 journey to the T084 component/file/test manifest. (b) Implement invitation acceptance and owner onboarding against approved contracts. (c) Implement draft creation, validation, preview, publication confirmation and print-ready QR path using the existing API contracts. (d) Implement localized AR RTL and EN LTR states. (e) Add local/disposable-compose browser flows using fake services, explicitly label those results as local and non-final. (f) Include OWN-08 time only in the SC-001/T085 flow when T082 integrates; do not count OWN-08 toward SC-002's wizard timer.
5. **Contracts:** Inputs, responses and errors follow `contracts/owner-api.md` invitation, program and branch sections; no endpoint/error/schema change. T084 pins UI dependency versions and exact files/commands. No database changes.
6. **Invariants:** Preserve owner authorization and tenant identity from server-verified sessions (PD-014; rule 02); never accept client tenant IDs as authority. Preserve stage refusals (PD-005), idempotency and immutable published program rules. Preserve locale, accessibility and approved screen-state requirements (PD-044, FR-130–FR-134, SC-018); do not claim staff-PIN AA while A11Y-01 is unresolved.
7. **Edge cases:** Expired/reused invite, invalid/expired OTP, resend/wrong-code limits, network timeout/retry, duplicate submission, validation failures, stale draft, denied stage, and unsupported locale must display contract-defined outcomes without duplicate publication or data loss. No live OTP/send or real customer/owner data in local evidence.
8. **Tests:** Playwright on disposable compose for OWN-01–OWN-07: invite accept; fake OTP errors/resend; wizard invalid bounds and recoverable validation; draft save/reload; stale draft; denied publication; retry without duplicate effect. Assert AR RTL and EN LTR, 360/320px and 200% text, keyboard/focus/error semantics, OTP paste/autofill where applicable, and axe/WCAG 2.2 AA for implemented screens. Run on supported Linux/Node 22.22.0; no live staging, real send or real-device claim. Official timing/device tests remain T085.
9. **Acceptance criteria:** All named local browser, state and AA checks pass; each implemented D1 state maps to the approved T084 manifest; E1/E1b local results retain raw timestamps and fake-service label; no unresolved policy is guessed; no local result closes SC-001/SC-002 or roadmap 1.3(b)/1.4(b).
10. **Verification:** `npx --no-install vitest run apps/web`; run the exact T084-pinned Playwright command; `npm test`; `npm run typecheck`; `npm run docs:check`; `npm run launch:check`; `npm run public-safety:check`. Report environment and exact pass/fail/skip counts; no mandatory skip. T085 official staging measurements are explicitly unrun here.
11. **Failure handling (STOP):** Stop on missing/contradictory contract, file or D1/D3 state; unresolved OD/F/A11Y decision; any need to change API/schema or approved behavior; any AA failure; live data/send requirement; or any file outside T084 scope. Do not infer values or unblock a gate.
12. **Risk and review:** HIGH (authentication, tenant-facing screens and policy rendering). Independent `plan-review` Sol High in a separate enforced read-only session; resolve findings with evidence. Executor class: `blocked` until every prerequisite, card approval and named authorization is recorded.
13. **Compatibility and evolution:** Impact is owner web UI and browser tests only, exact files pinned by T084; contracts remain unchanged. No existing shipped UI behavior is removed; new screens call existing contracts. No schema change. Performance is browser interaction and rendering under the supported 320px/200% text cases; no server/load claim. Roll back by reverting the scoped UI changes; no data migration. Regression coverage is the local browser and AA suite in field 8.

#### T084 — UI dependency and component/state/file/test manifest

`- [ ] T084 Pin UI dependency versions and component/state/file/test manifest in specs/002-p0-prd/plan.md`

1. **Objective:** Produce the reviewed UI implementation manifest required by FR-130 and SC-015, mapping preserved D1–D4 and journey states to exact UI modules, files, components, tests and commands.
2. **Scope:** `specs/002-p0-prd/plan.md` and a scoped manifest section there; inspect existing `apps/web/` and package manifests read-only. No package installation/update, source/test creation, dependency changes, runtime edits or changes outside the named plan section.
3. **Prerequisites:** T002 complete; G-IMPLEMENT; T084 content approval, field 13 and separate named authorization. No ui-entry, prototype acceptance, final 1.5 acceptance, accessibility completion or staging measurement is a prerequisite.
4. **Implementation steps:** (a) Record current UI framework/i18n/QR/Playwright versions from lock/manifests. (b) For any needed version change, record proposed version/rationale and leave unresolved for its own approval; do not edit manifests. (c) Map every relevant D1 state and D3 flow to planned component, route, exact existing/new file path, test and requirement. (d) Identify AR RTL/EN LTR, responsive, 200% text, keyboard/AA and OTP paste/autofill coverage for each applicable screen. (e) Mark policy-dependent D4 items DD/GATED and cite their blocking gate. (f) Check that UI/backend boundaries and Revision 3 task prerequisites remain acyclic; report findings, do not silently alter the approved graph.
5. **Contracts:** Read `spec.md`, `contracts/README.md`, relevant owner/customer/staff API contracts and D1–D4. This is documentation only; it changes no HTTP request/response, status/error, database table, migration or dependency.
6. **Invariants:** Do not invent product policy or finalize unresolved OD/F/A11Y decisions; do not move UI entry ahead of backend-ready; T084 remains before and independent of ui-entry; maintain tenant/security/AA source rules and GATED annotations.
7. **Edge cases:** Missing state, absent/ambiguous API contract, proposed dependency absent from the lockfile, stale source version, duplicate state mapping, unowned test, or apparent dependency cycle is recorded as blocked/open and escalated; no default is selected.
8. **Tests:** Documentation assertions that every included D1 state maps to a component/file/test or has an explicit documented exclusion; all D4 DD/GATED states cite unresolved gates; versions match lock/manifests; graph has no cycles and matches Revision 3's exact dependency manifest; links resolve. No application test is run or represented as executed by this document-only card.
9. **Acceptance criteria:** Reviewed manifest in plan.md is complete, exact, traceable, and identifies unresolved values without choosing them; every UI card can use its file/test scope; dependency check is acyclic; review evidence is attached.
10. **Verification:** Run scoped document/link/graph checks and `npm run docs:check`; report commands, environment and exact pass/fail/skip counts. Do not install dependencies or modify lock/manifests. Application test suites are outside this card.
11. **Failure handling (STOP):** Stop if an exact path/version cannot be verified, a contract/state is ambiguous, a UI decision is unresolved, a check finds a cycle/missing gate, or scope requires changing code, package manifests, APIs, schema or historical artifacts.
12. **Risk and review:** HIGH because the manifest controls implementation scope and gate edges. Independent `plan-review` Sol High in a separate enforced read-only session; findings require evidence. Executor class: `blocked` until T002, Gate 2 approval, all prerequisites and named authorization close; then `reasoning` for the authoring/review.
13. **Compatibility and evolution:** Impact is the plan's UI manifest section and subsequent implementation scope; APIs, persisted data and runtime behavior remain unchanged. No compatibility change and no schema evolution. Performance/operations are n/a for documentation; the manifest must preserve existing run/test interfaces. Failure recovery is to revise the document and rerun graph/link checks; no data rollback. Each affected state-to-contract behavior has a mapping/test entry in field 8.

#### T085 — Real-staging UX, accessibility, device, camera and live-service acceptance

`- [ ] T085 Validate final UI/UX on the real staging application in specs/002-p0-prd/quickstart.md`

1. **Objective:** Measure and record the final implemented Arabic/English application against roadmap 1.3(b), 1.4(b), 1.5, SC-001/SC-002/SC-004/SC-009/SC-018 and D3 §6/§8/§9; retain all original thresholds and seven raw timing markers.
2. **Scope:** Dated evidence/protocol record in `specs/002-p0-prd/quickstart.md` and approved real-staging test execution only. Do not change application behavior, APIs, schema, test identities/data beyond the approved permission, or production settings. Target build, device, endpoints and exact evidence files must be named in the authorized run record.
3. **Prerequisites:** T026, T042, T045, T082, T083, T057 and T053; `G-IMPLEMENT`; F-02; F-11/JG-11; `data-use-authorization`; `M-01-staging`; `live-messaging-authorization`; `deployment-authorization`; inherited legal/company and all task-specific gates. T085 does not depend on M4, T055, M1-done or pilot authorization. F-02/data-use, F-11 and M-01-staging remain explicitly unresolved until owner-approved.
4. **Implementation steps:** (a) Record build/version, test accounts, device/browser/network, fixture provenance and approvals. (b) Run the invite-acceptance-to-owner-ready journey on versioned real staging with live OTP only to the explicitly authorized test recipient. (c) Capture every D3 §8 raw timing marker, including OTP waits/errors/assistance; preserve invite-acceptance start and separately time the <3-minute wizard. (d) Include OWN-08 in SC-001 elapsed time and exclude it from SC-002. (e) Measure each cashier step's taps on the approved cheap Android/reference convention; assess camera scan speed/reliability and rendering. (f) Test SC-004 balance visibility and SC-009 unaided journeys. (g) Audit every implemented screen for AR RTL/EN LTR, 360/320px, 200% text, WCAG 2.2 AA, keyboard/focus/errors and OTP paste/autofill; annotate any A11Y-01 exclusion and never claim its unresolved PIN path passed. (h) Record pass/fail/not-scored against protocol; do not turn missing data into a pass. (i) T056 remains responsible for real-pilot SC-003.
5. **Contracts:** Exercise the approved customer, staff, owner and OTP provider contracts as implemented; no contract modification. Use only authorized staging services and test identities/fixtures. No production database or end-user data.
6. **Invariants:** Preserve PII minimization, tenant isolation, server-authoritative tenant identity, no secret disclosure, no cross-tenant state, stage-policy refusal, no marketing/transactional messages, no production writes; follow data-use/legal approval and live-message authorization. WCAG 2.2 AA remains required; A11Y-01 unresolved means staff PIN is not scored as passing.
7. **Edge cases:** OTP delivery failure/latency and retries; invite expiry; assistance; interrupted network; camera permission denial/poor light; unsupported viewport/zoom; RTL layout overflow; AA failure; staging outage; incomplete timing samples. Report failure/NOT SCORED and stop if an authorization, fixture or protocol is absent; never substitute fake service/local result for real staging.
8. **Tests:** Controlled staging runs for SC-001 <15 minutes from the F-02-defined start, SC-002 <3-minute wizard, ≤2 taps per cashier step under F-11, SC-004 balance ≤2 seconds, SC-009 unaided journey and SC-018 WCAG 2.2 AA audit; camera and live OTP evidence; D3 seven raw markers and all responsive/locale/text-scale cases. Report sample count and each raw observation; no invented statistical minimum or protocol default. Run only after explicit staging/data/live-send authorizations.
9. **Acceptance criteria:** Evidence is reproducible from versioned build and authorized fixture/device; every result is scored only under the owner-approved protocol; all thresholds unchanged; failed/uncaptured criteria remain failed or not-scored, never waived. Evidence supports roadmap completion only where the owner accepts it. SC-003 is excluded and remains real-pilot evidence in T056.
10. **Verification:** Attach dated logs/screenshots/accessibility audit and raw timing/device results with PII redacted; report build, environment, device, sample counts, pass/fail/not-scored and any skipped checks. No source test command substitutes for this acceptance run. Do not access production.
11. **Failure handling (STOP):** Stop on missing consent/data-use/live-message/deployment permission, wrong or unapproved recipient, production routing, unexpected real-data exposure, security/tenant leak, protocol ambiguity, unresolved required policy, AA failure requiring code change, or staging/build mismatch. Escalate; do not retry sends or alter settings without authorization.
12. **Risk and review:** HIGH (real identities/messages, deployed staging, accessibility and customer/tenant behavior). Independent `plan-review` Sol High for the acceptance protocol/card in enforced read-only mode; any implementation fix gets its own required review. Executor class: `blocked` until every precondition and explicit operation authorization closes; execution class `reasoning` due to real-service evidence and judgment.
13. **Compatibility and evolution:** Impact is acceptance evidence, not application modules, API/schema/migration or existing runtime behavior; no compatibility or data evolution change. Operational impact is controlled staging/live OTP/device use and must use named authorization and owner-approved spend limits. Rollback is stop the run, revoke/clean test fixture per approved procedure and preserve redacted evidence; no production data changes. Any defect maps to a separately authorized fix and regression/contract test; this card does not patch it.

## 4. UX, accessibility and historical evidence carried unchanged

Approval is conditioned on retaining all source acceptance criteria and evidence, including:

- D1's 58 states; D2 tokens; D3 flows, A1–A10 and seven raw timing markers; D4 DD/GATED annotations; all journeys and existing owner approvals.
- <15-minute owner onboarding and separately measured <3-minute wizard; invite-acceptance start and OTP wait/error/assistance time; OWN-08 inside SC-001 timing and outside SC-002.
- ≤2 taps for each cashier step using the approved cheap-Android reference and convention once F-11/JG-11 is decided.
- Arabic RTL and English LTR; 360/320px and 200% text; WCAG 2.2 AA; OTP paste/autofill. A11Y-01 remains unresolved until separately decided; no staff-PIN AA claim is inferred.
- SC-003's real-pilot median remains a real-pilot measure. Local/fake-service evidence cannot satisfy T085 real-staging acceptance.
- Historical prototype research, observations, NOT RUN/NOT SCORED records and approval history remain intact. No evidence is relabeled as a pass.

No threshold or acceptance criterion is modified by this package.

## 5. Explicit exclusions

This Gate 2 request does **not**:

- Apply the synchronized adoption edits in Revision 3 §9. Those may be applied only after this separate Gate 2 approval.
- Approve T080–T082 branding content/structure, `branding-contracts`, or D-1–D-7. T080's T001 edge is entry evidence only.
- Approve or resolve OD-01–OD-18, F-01/F-02/F-10/F-11/F-12, JG-08, A11Y-01, plans-values, F-03–F-07, M-01-staging or M-01-M5. Existing explicit gates remain.
- Change the 21-lane Delegate Fleet, G01 or any review routing. G01 independent review remains open. The plan-review verdict on Revision 3 is review evidence, not Gate 2 approval.
- Authorize implementation, migrations, real-data use, live messaging, staging/service creation, deployment, pilot/production operations, commit or push.
- Authorize or enable FP-003; its verification gates and separate authorization remain.

## 6. Separate gates still required before execution

Even after this package is approved, execution remains blocked until the applicable independent and owner gates close:

1. **BE-5:** explicit owner disposition of CHK001–CHK082. The checklist run and agent assessment are not that disposition.
2. **BE-7:** completed independent G01 review, in addition to the already completed PD-047 plan-review. The five-file comparison is not the independent review.
3. **Task authorization:** separate named authorization for T001; after T001, separate named authorization for revised T002. Existing T010/T035/T048 authorizations stay limited to their approved scope and blocked until prerequisites close.
4. **Per-task gates:** all ODs, execution briefs, approvals, review, verification, permissions and task-specific prerequisites continue to block their affected tasks.

Gate 2 approval is not task authorization. Task authorization is not staging, deployment, commit or push authorization.

## 7. Owner response requested

Choose one:

**Approve this bounded Gate 2 package:**

> I approve the PD-047 Revision 3 revised Gate 2 plan/task package exactly within §§2–§4 of `.scratch/backend-first-20261115-revision3/gate2-approval-package.md`, including the listed task content/dependency changes, T083–T085 cards and test seams, new gate-register rows, and preserved UX/accessibility criteria and historical evidence. The exclusions in §5 remain binding. This approval is Gate 2 content/structure approval only. Apply the synchronized adoption edits in Revision 3 §9 only after this approval is recorded. No implementation, staging, deployment, commit or push is authorized; checklist disposition, G01 review and separate named task authorization remain outstanding.

**Or defer / request specific changes:**

> I defer Gate 2 approval and request these specific changes: [list]. No adoption edits or implementation are authorized.

## 8. Status record

| Gate/decision | State at package preparation |
|---|---|
| PD-047 Revision 3 | Owner-approved and adopted on 2026-11-15 |
| Revised Gate 2 package | Owner-approved 2026-11-15 within §§2-4; §5 exclusions binding |
| CHK001–CHK082 disposition | Pending; separate BE-5 requirement |
| Current PD-047 independent plan-review | Completed PASS for review only; not owner approval |
| G01 independent review | Open; BE-7 remains blocked |
| T001 authorization | Not granted |
| Revised T002 authorization | Not granted; card also waits for T001 |
| Branding Gate 2 T080–T082 | Not approved by this package |

**Independent review evidence:** The configured `plan-review` lane (`gpt-6.1-sol`, high, enforced read-only) reviewed the package and returned CHANGES REQUIRED (one HIGH, one MEDIUM). The author added complete 13-field T083–T085 cards and cited the owner's dated PD-047 approval. The same reviewer session completed focused follow-up 1: **PASS — REVIEW ONLY; both findings closed, no remaining finding in the follow-up scope**. This is review evidence only; it does not approve Gate 2. G01 remains open. The content reviewed in the follow-up before this provenance note had SHA-256 `3fae2e65c8323687660db113e5160f9f447cf27f0f5367c4d8e11f49ba5d35a3`. External artifacts: `D:/Wanees-Delegation-Evidence/2026-11-15/pd047-gate2-package-review/result.json`, `final.txt`; follow-up: `D:/Wanees-Delegation-Evidence/2026-11-15/pd047-gate2-package-review-followup1/result.json`, `final.txt`.

**Owner approval recorded 2026-11-15:** The owner approved the package exactly within §§2-4, with §5 exclusions binding, and authorized applying Revision 3 §9 synchronized adoption edits. Checklist disposition, G01 independent review, and separate named implementation authorization remain open. No implementation or operational permission is granted.

