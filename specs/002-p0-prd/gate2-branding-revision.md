# Gate 2 revision package — merchant branding (PD-046)

**Status**: **Proposed, v2, 2026-11-14. Not approved at Gate 2.**
- **Approved at decision level (owner, 2026-11-14):** U-1–U-6 and engineering corrections A–C, recorded in `docs/context/01-decisions.md` (PD-046 and PD-005 A5). That approval authorizes decision documentation, contract revisions and validation only.
- **Still unapproved:** this package, every implementation design detail in §3, every draft block it lists, and the Gate 2 revisions in §5. It authorizes no implementation, migration, Figma edit, staging, commit, push or deployment.
- **No independent review has run.** Sol (`plan-review`) is mandatory: the risk is HIGH (authentication, authorization, rate limiting, stage policy, tenant isolation). It is unavailable and has not run. Fable has not been consulted. The orchestrator's in-session advisor checks are not a review.
- **Evidence base:** the approved plan documents only (`research.md`, `data-model.md`, `contracts/`, `tasks.md`). No `apps/bff` code exists (`research.md` §0, "Missing pieces").
- **v1 → v2:** U-1–U-6 decided; corrections A (CUS-09 reload), B (401 versus 403) and C (validated merchant identifiers); a new owner-attempt limiter table (U-2); tests rewritten (§6).

## 0. Policy and design

| Kind | What | Status |
| --- | --- | --- |
| Policy | MB-01–MB-05, PD-005 A5, U-1–U-6, corrections A–C (§1, §2) | **Approved** (decision level) |
| Design | Table shapes, the limiter function and its grants, check order, retry indication, what counts before the limiter, idempotency storage of other codes (§3) | **Proposed**, needs Gate 2 and Sol review |
| Design-review items | D-1–D-7 (§8) | **Open** |

## 1. MB-02 screen classification (approved U-5, corrections A and C)

| Screen | Theme | Palette source (server-resolved) |
| --- | --- | --- |
| CUS-01 Branch QR landing | Merchant **only after** `GET /branch-qr/{token}` succeeds. Before the response, and on `410 qr_rotated`, `branch_inactive`, an unknown token or any error: platform | `GET /branch-qr/{token}` → `palette` |
| CUS-02 phone entry, CUS-03 one-time code | Platform (Wanees identity), also when reached from a merchant QR | none |
| CUS-04 join details | Merchant, re-resolved after sign-in by calling `GET /branch-qr/{token}` again | `GET /branch-qr/{token}` |
| CUS-05 My cards | Platform page; each tile shows only its own card's palette | `GET /cards` → per-card `palette` |
| CUS-06 card detail, CUS-07 member code, CUS-08 rewards | Merchant | `GET /cards` → that card's `palette` |
| CUS-09 purchase claim | Merchant, **also after a reload** (correction A) | on creation: `GET /branch-qr/{token}`; on reload: `GET /claims/{id}` → `palette` (additive), resolved from the claim's merchant for the signed-in customer's own claim. Not found, not the customer's, or an error → platform |
| CUS-10 pending paper-card migration | Merchant (U-4 option a) | `GET /migrations/pending` → per-item `palette` (additive), resolved from the migration's merchant for the signed-in customer |
| CUS-11–CUS-18 (account, devices, consent, phone change, deletion, support, recovery) | Platform | none |
| Counter (CSH-\*), owner dashboard, operator | Platform (MB-01) | none |
| OWN-08 and the OWN-17 preview | Only the preview area shows the candidate palette; the rest of the page is platform (MB-01) | the owner's in-page input; nothing is sent until the owner saves |

**Rules.**
1. **Merchant context (correction C).**
   - A customer may identify a merchant context by selecting a membership (`card_ref`), opening a claim or pending migration, following a merchant link, or scanning a Branch QR.
   - The server validates each identifier against the signed-in customer, or against the Branch QR credential, and resolves the merchant itself.
   - The server never trusts a client-supplied palette value, tenant or authorization claim, or unverified merchant context (FR-138, PD-014, rule 02 §1).
2. **Fallback.** When no valid, authorized merchant context can be established, the screen shows the platform theme. It never reuses a previously shown merchant's palette.
3. **Leaving a context.** Leaving a merchant context removes its tokens before the next screen renders.
4. **Caches.** Responses that carry a palette are `Cache-Control: private`. Every cached or offline copy is keyed by account, merchant and palette version, and is cleared on sign-out or device revocation.
5. **JG-08.** The refusal state stays undecided (PD-041). A response without a palette means the platform theme.

## 2. MB-03 policy (approved U-1, U-2, U-3, U-6, correction B)

| # | Rule (approved) | Fit with the existing architecture |
| --- | --- | --- |
| P1 | **Authentication: 401.** A request with no valid owner session → `401 unauthenticated`. This includes staff (the owner staff profile too), customer and operator callers, because session cookies are host-only per surface and the operator host accepts no cookies. | README *Session cookies*; R-10 |
| P1b | **Authorization: 403.** An authenticated owner-surface principal without the branding permission for its session's merchant → `403 forbidden`. Other 403s: `csrf_failed`. `stage_forbidden` never applies, because A5 allows every stage. | Correction B. Which P0 principal can be authenticated but unauthorized is D-3. |
| P2 | **No new one-time code** for ordinary changes in a valid, authorized owner session. The action is not step-up-marked. | FR-012's step-up list does not include the palette |
| P3 | **Reauthentication** when the session is expired, invalid or revoked: `401`, then the existing owner sign-in. No new risk-detection subsystem in P0. Every existing session-security requirement stays. | `owner_sessions` (`expires_at`, `revoked_at`); R-10 revocation |
| P4 | **CSRF and tenant.** `X-CSRF-Token` and the Origin check. The owner's merchant comes from the session. FORCE RLS on `bff.brand_palettes`. | README *CSRF*; PD-014 |
| P5 | **Success cap (U-6): 10 successful saved changes per merchant per rolling 60 minutes.** Resets and the onboarding save count; local previews do not. Enforced atomically. The 11th → `429 rate_limited` with a retry indication. | §3.2 |
| P6 | **Attempt cap (U-2): 30 authenticated palette mutation attempts per owner account per rolling 60 minutes.** Enforced atomically in a dedicated server-side counter table, keyed by the owner account so that changing session, device or merchant context cannot reset it. The 31st → `429 rate_limited` with a retry indication. | New: §3.1 |
| P7 | **Audit.** Each successful change or reset writes one `bff.audit_log` row (append-only): actor, time, operation, and the previous and new palette and version. No PII. | `data-model.md` §4 `audit_log`; FR-150 |
| P8 | **Suspension is not bypassed.** The body accepts exactly the listed fields, and an unknown field → `400`. The handler writes only the palette, the audit row and the counters. Every other action keeps its own A2–A4 cell. | PD-005 A5 |
| P9 | **Idempotency (U-3).** A `401`, `403` or `429` is never stored as a completed idempotency result for the branding mutation endpoints. A retry with the same key is processed against the then-current authentication, authorization and rate-limit state. The request-fingerprint check and the existing idempotency rules stay. | README *Idempotency*; `api_idempotency` |

## 3. Implementation design (PROPOSED; Gate 2 and Sol review)

**3.1 Owner attempt limiter (U-2).**
- **Storage:** a new platform table in schema `bff`, `owner_mutation_limits`:
  - columns: `owner_id uuid` (FK `owner_accounts`), `action text` (`branding.mutation`), `recent_at timestamptz[] NOT NULL DEFAULT '{}'`, `updated_at`;
  - PK (`owner_id`, `action`). No tenant column: the key is the owner account, so the limit cannot be reset by merchant context or session. No PII.
  - P0 has one owner per merchant (`owner_accounts.tenant_id UNIQUE`, PD-014), so the key would also hold if that ever changed.
- **Authorization:**
  - No runtime role has table grants.
  - Access is only through `bff.consume_owner_attempt(p_owner_id, p_action, p_limit, p_window)`, a `SECURITY DEFINER` function owned by `bff_definer`, with `REVOKE EXECUTE … FROM PUBLIC` and EXECUTE granted to `lip_bff_tenant_runtime` only (the `data-model.md` §1 pattern).
  - The function raises unless `p_owner_id` is the owner of `current_setting('lip.tenant_id')`. The server passes `p_owner_id` from the verified session principal, never from the request.
  - The `bff_definer` grants grow (D-2).
- **Concurrency (atomic):**
  1. `INSERT … ON CONFLICT DO NOTHING`, then `SELECT … FOR UPDATE` of the row.
  2. Prune entries older than the window. If the count has reached `p_limit`, return `retry_after_s` = the oldest entry + the window − now, without appending. Otherwise append the database time and return OK.
  3. One short transaction, committed **before** the mutation transaction, so an attempt still counts when the mutation later fails (400 or 409).
- **Expiry and cleanup:** pruning on every call keeps at most `p_limit` entries per row. A row with only expired entries behaves as empty, so no sweeper is needed. Rows are deleted with their owner account (FK `ON DELETE CASCADE`).
- **Clock:** database time only.
- **Failure:** if the limiter call fails, the request fails closed with nothing written (README server error).

**3.2 Merchant success cap (U-6).**
- Inside the mutation transaction, after `SELECT … FOR UPDATE` of the merchant's `brand_palettes` row (inserted first if absent) and the version check, count the merchant's `audit_log` rows with operation `branding.update` or `branding.reset` in the last 60 minutes of database time, using the existing (`tenant_id`, `at`) index. At 10 → roll back with `429`. Otherwise write the palette and the audit row and commit.
- **Why it is atomic:** the row lock serializes every save for that merchant, from any session, so the count and the write cannot interleave. `audit_log` is the single source of truth for successful changes, so no second counter is kept.
- The tenant runtime role has INSERT and SELECT on append-only tables (`data-model.md` §1).
- The onboarding step (OWN-08) saves through the same `PUT /branding`, so a save there writes a `branding.update` audit row and counts toward both caps (U-2). Keeping the default sends no request, writes nothing and counts nothing (proposed).

**3.3 Check order on a mutation.**

| Step | Check | Result | Stored as idempotent result? | Counted (P6)? |
| --- | --- | --- | --- | --- |
| 1 | owner session | `401 unauthenticated` | no | no |
| 2 | CSRF and Origin | `403 csrf_failed` | no | no |
| 3 | authorization (P1b) | `403 forbidden` | no | no |
| 4 | idempotency lookup | completed + same fingerprint → replay the stored response; completed + different fingerprint → `409 idempotency_conflict` | (existing record) | no (D-1) |
| 5 | attempt limiter (§3.1) | `429 rate_limited` | no | yes, every request that reaches it |
| 6 | stage (A5 allows) | — | — | — |
| 7 | body validation | `400 validation_failed` | no (D-4) | already counted |
| 8 | transaction: insert-if-absent, lock, version (`409 conflict`), success cap (`429`), write, audit, idempotency record | `200` | only `200` commits a record (D-4) | — |

- **Concurrent requests with the same key:** the idempotency record commits with the write. The losing request sees the unique key and returns the stored result (same fingerprint) or `409 idempotency_conflict` (different fingerprint).
- **Retry indication:** `429` carries `details.retry_after_s` (README) and the proposed additive `details.limit`: `"owner_attempts"` or `"merchant_saves"`.

**3.4 Customer palette reads.** `GET /branch-qr/{token}`, `GET /cards`, `GET /claims/{id}` and `GET /migrations/pending` resolve the palette from the merchant of the validated QR credential, membership, claim or migration. How the customer runtime, and the pre-sign-in Branch QR path, are granted read access to `brand_palettes` is D-5.

## 4. Changes written in place (text that is not Gate 2-approved; still marked unapproved)

| File | Change |
| --- | --- |
| `contracts/owner-api.md`, Brand palette block | §2 P1–P9; §3.3 check order; both caps; the 401/403 split |
| `contracts/customer-api.md`, palette block | Correction C wording; CUS-09 `GET /claims/{id}` and CUS-10 `GET /migrations/pending` additive `palette`; fallback; caches |
| `contracts/README.md` | A marked "proposed amendment, not approved at Gate 2" note for the branding 429 causes, `details.limit` and the U-3 idempotency exception |
| `data-model.md` §4, Merchant branding block | `owner_mutation_limits` and the definer function (§3.1); the success cap (§3.2); the reads wording (correction C) |
| `plan.md`, Project Structure block | The migration also creates the limiter table and function |
| `execution-briefs.md`, A5 note | Points to §2 and §3 |
| `research.md` R-19; `tasks.md` T028, T046, `stage-cells` row | A marked pointer to the pending Gate 2 revision in §5; the approved text is unchanged |
| `tasks.md` T081 | Prerequisites (T024, T033, T043); steps, contracts, edge cases, tests (§6), STOP conditions, field 13 |
| `tasks.md` T082 | Correction C invariant; CUS-09 and CUS-10 restore; tests (§6) |
| `tasks.md` T080 | Reviewed; no change (no MB-03 dependency) |
| `tasks.md` gate rows `branding-decisions`, `branding-contracts`; the PD-046 dependency note (~line 1537) | U-1–U-6 recorded as decided; `branding-contracts` stays open pending Gate 2 approval of this package and D-1–D-7 |
| `execution-briefs.md` totals | A marked pointer to §5.6; the approved text is unchanged |
| Draft headers of `plan.md`, `data-model.md`, `execution-briefs.md`, `contracts/owner-api.md`, `contracts/customer-api.md` | Cite U-1–U-6 and corrections A–C; the drafts stay UNAPPROVED |

**Approved-decision text updated in place** (records owner decisions; not Gate 2 material): `docs/context/01-decisions.md` (PD-046 approval block; PD-005 A5 refinement, with the superseded bullets kept and marked); `spec.md` Status, FR-136, FR-138 and Dependencies; journey 1.4 (O4a and the stage row); D1 v0.7, D2 v0.6, D3 v0.8, D4 v0.5 (the OWN-17 DD marker removed, D4 re-verified 27/27); roadmap row 4.8.

## 5. Gate 2 revisions to approved text (NOT applied; on Gate 2 approval)

Each item gives the current text and its replacement. When an item is applied, the pending-revision pointer added in §4 next to that text is removed too.

**5.1 T028.**
- Readiness: "PD-005 A2 (30), A3 (39) and A4 (3) cells are pinned; actions outside A2–A4 remain excluded" → "… A2 (30), A3 (39), A4 (3) and A5 (3) … outside A2–A5 …".
- Objective: "§ PD-005 A2, A3 and A4" → "§ PD-005 A2, A3, A4 and A5".
- Prerequisites: "the A2 (30), A3 (39) and A4 (3) cells; actions outside A2–A4" → "… and A5 (3) cells; actions outside A2–A5".
- Steps: "the 72 approved cells … (PD-005 A2: 30; PD-005 A3: 39; PD-005 A4: 3)" → "the 75 approved cells … (A2: 30; A3: 39; A4: 3; A5: 3)"; "outside A2–A4" → "outside A2–A5".
- Contracts: "approved PD-005 A2, A3 and A4" → "… A2, A3, A4 and A5"; "Actions outside A2–A4" → "outside A2–A5".
- Edge cases: "the 72 A2–A4 cells" → "the 75 A2–A5 cells".
- Tests: "all 72 … (PD-005 A2: 30; A3: 39; A4: 3)" → "all 75 … (A2: 30; A3: 39; A4: 3; A5: 3)"; "outside A2–A4" → "outside A2–A5".
- Field 13: "Impact: one added action (`branding.change`, allowed in every stage). Regression: the 72 existing cells keep their values."

**5.2 T046** (also verifies SC-008).
- "Stage cells fixed by PD-005 A2–A4." → "… A2–A5.".
- Prerequisites (T046 only): "Stage cells: PD-005 A2–A4 as transcribed" → "… A2–A5 …". The same sentence in T023 stays (branch actions; A5 does not touch them).

**5.3 `stage-cells` row.** Append: "PD-005 A5 (3 cells, owner-approved 2026-11-14) is transcribed in execution-briefs.md. Any action outside A2–A5 still goes to the owner."

**5.4 PD-046 dependency note (`tasks.md`, ~line 1537).** "T028 transcribes 72 and must be revised at Gate 2 before T081 enforces A5" → "T028 transcribes the 75 cells (revised at Gate 2)".

**5.5 `research.md` R-19.** "mirrors the PD-005 A2, A3 and A4 tables cell for cell (72 cells)" → "… A2, A3, A4 and A5 … (75 cells)".

**5.6 `execution-briefs.md`.**
- "the stage table has **72 cells**: A2 30, A3 39, A4 3." → "**75 cells**: A2 30, A3 39, A4 3, A5 3."
- "not in A2, A3 or A4" → "not in A2–A5".
- Delete "**Not yet in T028's 72-cell transcription**; T028 needs a Gate 2 revision to add them."

**5.7 `contracts/README.md`.**
- Row 429: "OTP, PIN or IP limits; `details.retry_after_s`" → "OTP, PIN or IP limits, or the brand-palette limits (owner-api, Brand palette); `details.retry_after_s`". Then remove the proposed-amendment note.
- Row 403 `stage_forbidden` stays: A5 denies nothing.

**5.8 `contracts/owner-api.md` provenance (~line 54).** Add "plus PD-005 A5 (brand palette change and reset)"; "not covered by A2, A3 or A4" → "not covered by A2–A5".

**5.9 `data-model.md` §1 roles.** Add `bff.consume_owner_attempt` to the definer functions, with EXECUTE for the tenant runtime only, and the `bff_definer` grants on `owner_mutation_limits` and `owner_accounts` (D-2).

**5.10 Left unchanged on purpose** (denials or other actions; A5 adds no denial):
- T033's stage references and T023's stage-cells prerequisite;
- README row 403 `stage_forbidden`;
- journeys 1.3 and 1.4 "a denial in an approved A2–A4 cell";
- `checklists/entry-gate*.md` CHK029 (historical);
- PD-005 A4 consequences (history).

**5.11 `branding-contracts` row.** On Gate 2 approval: "closed by Gate 2 (date)".

## 6. Acceptance tests

Run on Linux, Node 22.22.0 and PostgreSQL 17 with zero skipped mandatory tests (rule 03), unless marked browser. Owner is T081 unless marked T082.

| ID | Area | Test | Expected |
| --- | --- | --- | --- |
| BT-01 | Merchant isolation | Owner of A reads, saves and resets | Only A's row; no request field can address B; `tenant-isolation-live` includes `brand_palettes` |
| BT-02 | Merchant isolation | No `lip.tenant_id` set | No palette row visible; a write fails (FORCE RLS) |
| BT-03 | Owner isolation | `consume_owner_attempt` called with another owner's id, or with no tenant scope | Raises; no counter change. A runtime role selecting `owner_mutation_limits` directly is denied |
| BT-04 | Unauthenticated | No cookie; a staff, owner-staff-profile, customer or operator credential on the owner paths | `401`; nothing written; no count; no idempotency record |
| BT-05 | Revoked or expired | Expired session; a session revoked by sign-out-all or a phone change | `401`; then a fresh sign-in succeeds |
| BT-06 | Authenticated but unauthorized | An owner-surface principal without the branding permission (D-3: a real P0 principal if one exists, otherwise an authorization-layer test) | `403 forbidden`; nothing written; no count; no record |
| BT-07 | CSRF | Missing or wrong `X-CSRF-Token`; foreign Origin | `403 csrf_failed`; no write; no count |
| BT-08 | Success cap | 10 saves within 60 min, an 11th, then one after the oldest leaves the window | 10 × `200`; the 11th `429` (`limit: merchant_saves`, correct `retry_after_s`); later `200` |
| BT-09 | Resets and onboarding | The onboarding save plus resets in the window | Each counts; a reset as the 11th → `429` |
| BT-10 | Attempt cap | 30 attempts (any mix of valid, invalid and stale), then a 31st | 30 processed; the 31st `429` (`limit: owner_attempts`); a 400 or 409 still counted |
| BT-11 | Attempt cap is not reset | Exhaust it on session 1, then use session 2 and a new device | Still `429` until the window passes |
| BT-12 | Multiple editors, same merchant | P0 allows one owner account per merchant (`owner_accounts.tenant_id` UNIQUE, PD-014), so a second owner cannot exist; the case is tested as two concurrent sessions of that owner saving at 9 successes. The success cap is keyed by merchant, so it would also hold for several owners | Exactly one 10th success; the other gets `409` or `429`; never 11 |
| BT-13 | Concurrent counters | 40 parallel attempts at 0 | Exactly 30 counted; 10 × `429`; the stored array never holds more than 30 entries |
| BT-14 | Same-key retry after 401 | 401, sign in, retry with the same key and body | Processed normally (counted, can succeed) |
| BT-15 | Same-key retry after 403 | 403, then the same key once permitted | Processed normally |
| BT-16 | Same-key retry after 429 | 429 (either cap), then the same key after the window | Processed normally; the earlier 429 was not stored |
| BT-17 | Completed replay | The same key and body after a `200`, 20 times | The stored `200` each time; one write, one audit row, one success, one attempt |
| BT-18 | Fingerprint mismatch | The same key with a different body after a `200` | `409 idempotency_conflict`; no write |
| BT-19 | Audit integrity | Each success; then try to UPDATE or DELETE an audit row | Exact actor, time, operation and before/after; the UPDATE or DELETE fails (append-only) |
| BT-20 | Suspension | Suspended stage: save, then the A2–A4 denied cells | The save succeeds; denied cells still `403 stage_forbidden` (T028 table level plus the branding endpoint) |
| BT-21 | Unknown fields | A body with `plan`, `stage`, `tenant_id` or `css` | `400`; nothing changes |
| BT-22 | Customer contexts | `GET /cards`, `/claims/{id}`, `/migrations/pending`, `/branch-qr/{token}` | The palette is the validated context's merchant; another customer's claim id → `404 not_found` with no palette; `/migrations/pending` lists only the customer's own; old clients still validate (additive) |
| BT-23 | Private cache | Every palette-bearing response | `Cache-Control: private`; no shared-cache reuse between two customers |
| BT-24 (browser, T082) | Merchant switching | A → B → A, online and offline | Only the current merchant's tokens; computed style shows no A token in B |
| BT-25 (browser, T082) | Branch QR | Valid, then rotated, inactive, unknown and network error | Merchant only after success; otherwise platform, with no earlier merchant's tokens |
| BT-26 (browser, T082) | Join flow | CUS-01 → CUS-02/03 → CUS-04 | Platform on CUS-02/03; CUS-04 re-resolved from the server |
| BT-27 (browser, T082) | CUS-09 and CUS-10 reload | Reload each screen; then with the claim or migration gone or not the customer's | Merchant identity restored from `GET /claims/{id}` or `/migrations/pending`; otherwise platform, never the previous merchant |
| BT-28 (browser, T082) | Sign-out | Sign out; revoke the device | Every cached palette is cleared |
| BT-29 (browser, T082) | Preview | OWN-17 previews without saving | No request is sent; no count |

**Traceability to the owner's test list (2026-11-14).**

| Owner topic | Tests |
| --- | --- |
| Merchant and owner isolation | BT-01, BT-02, BT-03 |
| Authenticated but unauthorized | BT-06 |
| Unauthenticated | BT-04 |
| CSRF | BT-07 |
| Revoked and expired sessions | BT-05 |
| 10 saves, then the 11th blocked | BT-08 |
| 30 attempts, then the 31st blocked | BT-10, BT-11 |
| Multiple owners on the same merchant | BT-12 (not reachable in P0; tested as concurrent sessions) |
| Concurrent changes and atomic counters | BT-12, BT-13 |
| Resets and onboarding | BT-09 |
| Same-key retries after 401, 403, 429 | BT-14, BT-15, BT-16 (and BT-17 for a completed replay) |
| Fingerprint mismatches | BT-18 |
| Merchant-context switching | BT-24 (customer); BT-11 (owner limiter across sessions) |
| Invalid and rotated QR | BT-25 |
| CUS-09 and CUS-10 reload | BT-22, BT-27 |
| Private cache boundaries | BT-23, BT-28 |
| Audit integrity | BT-19 |

## 7. Scope and estimate impact

- `tasks.md` and the roadmap record no time estimates, so the impact is stated as scope.
- U-2 adds a platform table, a `SECURITY DEFINER` function, a `bff_definer` grant extension, its positive and negative grant tests, and BT-03, BT-10, BT-11 and BT-13 to T081.
- Corrections A and C and U-4 add two additive response fields and their owners: T033 (claims) and T043 (paper migrations) become T081 prerequisites.
- T081 now likely exceeds one context window (rule 05 §2). D-6 proposes splitting the limiter into its own card at Gate 2.
- Roadmap row 4.8 notes the added scope.

## 8. Design-review items (open; resolve at Gate 2 with Sol)

| ID | Item | Proposal |
| --- | --- | --- |
| D-1 | Whether a `409 idempotency_conflict` (step 4) counts toward the attempt cap | Not counted: no work is done, and the fingerprint rule is preserved |
| D-2 | Extending `bff_definer` with grants on `owner_mutation_limits` and `owner_accounts` | Column-scoped grants, positive and negative tests (`data-model.md` §1 pattern) |
| D-3 | Which P0 principal produces `403 forbidden` (for example an owner account whose `status` is not active) | Confirm against the owner authorization rules; otherwise test at the authorization layer |
| D-4 | Whether 400 and version-409 responses are stored as idempotent results | Only `200` commits a record (branding endpoints); no global rule |
| D-5 | Customer-runtime and pre-sign-in read access to `brand_palettes` | A narrow definer read, or a customer policy through membership; no broad grant |
| D-6 | Card sizing | Split T081 into palette storage and API (T081) and the owner limiter (new card) |
| D-7 | `details.limit` | Additive field; the names above |

## 9. Compatibility and evolution (rule 01 §5)

- **Impact:**
  - new tables `bff.brand_palettes` (tenant, FORCE RLS) and `bff.owner_mutation_limits` (platform), plus one definer function;
  - three owner endpoints;
  - an additive `palette` on four customer responses;
  - one stage action (A5);
  - README 429 causes and the additive `details.limit`.
  - No `/lip/v1`, upstream package, LIP call or existing table changes.
- **Compatibility:** additive. Clients that ignore `palette` keep working. No stage cell changes. Idempotency behaviour changes only for the new branding endpoints.
- **Data evolution:** an additive, idempotent migration with no backfill.
- **Performance and operations:** each mutation adds one locked single-row limiter update, at most 30 timestamps, and one indexed count over the merchant's last hour of audit rows. Load assumption: at most 30 attempts per owner and 10 saves per merchant per hour (P5, P6).
- **Failure and rollback:**
  - Revert the code. Drop the new tables only if no release reads them; otherwise forward-fix.
  - Both caps fail closed, and the limiter commits nothing else.
  - Rollback loses only rate-limit history, which is non-critical.
