# Staff API (`staff.` → `/api/v1/staff`)

Conventions and errors: [README.md](README.md).

**Who calls it.** Ordinary cashiers and the owner staff profile (FR-016).

**Scope.** Every call needs a registered-device credential (`__Host-device`) and, except the bootstrap operations (enrollment, PIN setup completion and sign-in, which use the pre-session CSRF token), a staff session (`__Host-staff`). Tenant and branch come from them (PD-014).

**Gate order.** Every write checks, in order:
1. CSRF.
2. Session, device, branch and staff active.
3. Stage policy (PD-005 A2).
4. Role and branch permission.
5. Branch, device and session re-checked under the branch row lock (taken first, global lock order in data-model §6) **in the transaction that commits the journal intent** (step 1c for operations admitted in two transactions), so an operation racing a branch deactivation is refused with `403 branch_inactive` (R-16a).
6. Durable member admission slot and void block for balance-changing writes (`409 member_busy` / `void_in_progress`, R-07).

## Device and sign-in

| Method & path | Request | Success | Rules |
| --- | --- | --- | --- |
| `GET /session` | — | `{signed_in, language, csrf_token}` (+ `__Host-pre` when signed out) | README *Session endpoints* |
| `POST /devices/enroll` | `{enrollment_code}` | `201` + `__Host-device` | Single-use code created by the owner for one branch (R-12); OD-01 lifetime |
| `GET /profiles` | — | staff first names usable on this device | Cashiers of the device's branch, plus the owner staff profile; names come from the directory |
| `POST /profiles/{staff_id}/pin` | `{pin_setup_code, new_pin}` | `204` | First PIN, reset or unlock with an owner-issued single-use setup code bound to that profile (R-12); revokes the profile's other sessions; audited |
| `POST /sessions` | `{staff_id, pin}` | `201` + `__Host-staff` | PIN checked with scrypt; `409 pin_not_set` / `profile_locked` (OD-01 lockout); refused if the device is revoked, the branch is inactive or the staff member is inactive (FR-014, FR-081) |
| `PUT /sessions/current/pin` | `{current_pin, new_pin}` | `204` | Staff changes their own PIN; audited |
| `DELETE /sessions/current` | — | `204` | — |

## Awarding a purchase (Method B and confirmed claims)

| Method & path | Request | Success | Rules / errors |
| --- | --- | --- | --- |
| `POST /captures` | `{member_code}` **or** `{claim_code}` | `201 {capture_id, first_name, progress, requires_repeat_confirmation}` | **Member code:** verifies the code (≤ 60 s, single-use per device, card and purpose, same café, active device), returning `410 code_expired`/`code_used` or `403 device_revoked`. **Claim code:** must identify an open claim at **this branch**; how a wrong code is attributed to a claim, and the third wrong attempt cancels it (FR-029), follows **OD-12** (recommended two-part code: claim number + check part). **Both:** self-dealing → `403 self_dealing_forbidden` (FR-028), except an owner self-award from the owner staff profile, which is allowed and audited as one; stage must allow accrual (`403 stage_forbidden` when suspended); member blocked → `409 void_in_progress`. Assigns the server `order_id`. Shows only the first name and progress (FR-006). |
| `POST /captures/{id}/preview` | `{amount, amount_confirmation?}` | `200 {amount, earn:{unit, amount}}` | Digit normalization to piasters; above the café threshold `amount_confirmation` must match (`409 amount_retype_required`); above 5 × the threshold → `409 amount_over_cashier_limit` (FR-025); the earn preview comes **only** from LIP `orders/evaluate` (FR-024) |
| `POST /captures/{id}/confirm` | `{amount, amount_confirmation?, repeat_confirmed?}` | `200 {status:"confirmed", earned, new_progress}` or `202 {status:"confirming"}` | Same amount as the preview, otherwise `409 conflict`; repeat-award rule (`409 repeat_award_confirmation_required`, PD-027); member slot admitted, then the pre-accrual snapshot and journal intent in one transaction; `accruals` with key `accrue:<order_id>` (FR-026); no offline path (FR-027); the customer sees the result within 2 s (SC-004). Re-submitting returns the current state and never re-sends to LIP. |
| `GET /captures/{id}` | — | status (`confirming`, `confirmed`, `unconfirmed`, `failed`) | Polled after a 202. `unconfirmed` is final for the cashier: the accrual is never re-sent (PD-038 P8, FR-069); what the cashier may do next is OD-10 (R-14) |

## Redemption

| Method & path | Request | Success | Rules / errors |
| --- | --- | --- | --- |
| `POST /redemptions` | `{reward_code, capture_id?}` | `201 {redemption_id, reward_display, cost, release_after}` | The reward code is the device-generated `v1r` code (R-11); its `reward_ref` maps to an issued reward or catalogue reward. Hold via `redemptions/reserve`; the hold's terms are the **actual reservation response**; a revision or cost mismatch with the displayed mirror releases the hold → `409 reward_terms_changed` (R-16). **Stamp rewards** reserve only through `issued_reward_id` (PD-012). **Points rewards** use the cost at hold time (FR-046, PD-025). **Order:** the capture's `order_id` when given, otherwise a zero-value synthetic order `r_<ULID>` (FR-055). **Refusals:** a second reward on the same order → `409 one_reward_per_order`; a balance below cost → `409 insufficient_balance`; the reward of another café → `404`. The suspended stage is allowed (PD-005 A2). |
| `POST /redemptions/{id}/capture` | — | `200 {status:"captured"}` or `202 {status:"confirming"}` | Only from a session of the same café and branch that holds the redemption; concurrent captures → exactly one succeeds (FR-051). Once a capture intent exists the hold is never released by the timer; an uncertain capture is resolved forward with the same key. The UI says "do not hand over yet" until `captured`. LIP expiry → `410 reservation_expired` |
| `POST /redemptions/{id}/release` | — | `200 {status:"released"}` | Refused once a capture intent exists. Otherwise the 120 s sweeper releases the hold (FR-054) |

## Voids

| Method & path | Request | Success | Rules / errors |
| --- | --- | --- | --- |
| `GET /purchases/recent` | — | this staff member's purchases from the last 10 minutes | — |
| `POST /purchases/{id}/void` | — | `202 {void_id, status}` | **Who:** a cashier may void only their own purchase younger than 10 min (`409 void_window_expired`/`void_not_own_purchase`, FR-060). From the owner staff profile, other purchases need step-up (`401 step_up_required`, audited override, FR-016). **Stamps:** the PD-008 A1 plan; a failed precondition → `409 void_needs_owner`. Admission per R-17: `409 member_busy` while another operation for the member is unresolved or the member has an open reward hold (retryable), `409 void_in_progress` while another void is unreconciled, `410 member_erased` (final) if the customer account was erased. **Points:** `409 points_void_unavailable` until the FP-003 gates pass (R-18). All stages are allowed. |
| `GET /voids/{id}` | — | status | — |
| `POST /purchases/{id}/recapture` | → returns a new capture session flow | — | Only after the void is `completed` (FR-171); the audit links original, void and re-capture; refused with `409 void_in_progress` while unresolved |

## Owner-only actions from the owner staff profile (step-up)

| Method & path | Request | Success | Rules |
| --- | --- | --- | --- |
| `POST /step-up/send` | `{action, target_ref}` | `202 {challenge_id}` | OTP to the owner's own phone; purpose `owner_step_up` (FR-012) |
| `POST /step-up/verify` | `{challenge_id, code}` | `200 {grant_id}` | Grant bound to one action and target, single-use (R-13) |
| `POST /captures/{id}/confirm` with `{grant_id}` | — | — | Amount above 5 × the threshold, awarded by the owner (PD-008, FR-016). Classification, stage policy and the stamp-program case are **OD-18**; not assumed |
| `POST /migrations` | `{member_code, stamps, reference, grant_id}` | `201 {migration_id, expires_at}` | Stamp program, first 60 days, stage grace or active, balance + n ≤ t − 1, one pending per member (FR-070–FR-073). This is the **only** way a `migration` adjustment is ever posted; the generic owner adjustment endpoint refuses that classification |
| `POST /migrations/{id}/attest` | `{paper_card:"collected"\|"marked_void"}` | `200 {status}` | Posting happens after both the customer acceptance and the attestation; atomic re-check with the member admission slot (R-07) |
