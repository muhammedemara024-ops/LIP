# P0 execution briefs — documentation refinement

**Status**: Task refinement for independent HIGH-risk review and owner Gate 2 approval, 2026-11-13. Not a new architecture/product decision or implementation authorization. Approved PRD/Planning Gate provenance remains in plan.md. OD-01–OD-18 and FP-003 remain unresolved/unauthorized as recorded.

**Unapproved amendment present.** This file contains a "Proposed amendment (PD-046), not approved at Gate 2" block (2026-11-13). It is outside every approval recorded above.

## Authority and use

These briefs expand existing T010, T013, T028, T035 and T048 using approved sources. They do not replace the approved sources or turn proposals into defaults. Each exact file below is a new descendant of the module boundary enumerated in plan.md, Project Structure, and now in that plan's File-level task refinement. No application file has been created. Tests/commands are future instructions, not executed results. Any required work outside the specified seam stops at the orchestrator; no helper here is a new public API.

## Journal outcome guards

Authority: approved research.md R-07 steps 1, 3, 4 and 5, R-14; data-model.md §6. R-07 step 3 expressly says that call-status updates do **not** use the lease generation. The old data-model summary overstated that guard; it is corrected to match the detailed algorithm.

| Write / operation | Required guard / behavior | Prohibited inference |
| --- | --- | --- |
| Claim/reclaim worker lease and dispatch | Re-check current lease before marking dispatched, commit dispatched/attempt record before HTTP; timeout shorter than lease | A stale worker cannot authorize a new send because it once held a lease |
| Receive attempt result | Record it against the exact call/attempt, even after lease ownership changes | Never discard a genuine late reply solely on generation mismatch |
| Advance call status | Guard `status NOT IN ('confirmed','failed_definite','abandoned')`; assess definitive evidence from **all** attempts using R-07 step 4 | Never mark failed_definite from one refused re-send while another attempt is unanswered |
| Apply definitive outcome and domain effect | One transaction, with the call's non-regression guard and the domain transition; do not apply the effect again on terminal replay | Recording a late reply does not authorize an arbitrary stale-worker domain write |
| Delete member admission slot | Match the exact admission_id recorded on that intent; retain an unrelated/newer slot | Same op_ref or member id alone is insufficient |
| Recover uncertain accrual | Keep the plan's “never re-send” baseline and OD-15 B fail-closed behavior | No lease timeout proves a delayed original cannot commit; no force-release is inferred |

Required T013 vectors on two BFF instances/PG17:

1. Attempt 1 times out, lease changes, attempt 2 is refused, attempt 1 remains unanswered: call stays uncertain, no terminal domain transition and slot remains held.
2. Attempt 1 later succeeds: record that attempt despite its old lease; the call and its domain effect become confirmed atomically once. Replaying either successful result cannot duplicate the effect.
3. All dispatched attempts give definite refusals: failed_definite and the matching slot release may commit; one still unanswered forbids that result.
4. A stale worker merely requests a transition without valid attempt evidence: it cannot cause a new dispatch or overwrite terminal/domain state. A terminal call never regresses after any delayed success/refusal.
5. Undispatched intent lease expires: abandoned, zero sends. A crash after dispatched but before HTTP is uncertain, not abandoned.
6. `expired` plus an unanswered attempt is definitive only after S-2 proves all four expiry conditions; without that evidence retain uncertainty. Never apply this exception to accruals, manual adjustments, migrations or voids.
7. An older completion cannot delete the slot for a later admission_id. Outcome persistence and its domain effect either both commit or both roll back.

This resolves the documentation mismatch, not all executor detail: exact journal filenames, lease-duration constants, pinned `source.system` string and the reviewed per-domain transaction implementation remain part of the reasoning execution brief. No new values are selected here.

## Identifier boundaries

Authority: data-model.md §§1–4 and contracts/lip-integration.md, Identifier formats. The explicit table types and text formats can be restated without choosing new identifier policy.

| Identity / field | Already specified type/format | Required cross-reference |
| --- | --- | --- |
| phone_identity_id, customer_id, membership_id, customer_devices.device_id, staff_person_id, otp challenge_id | UUID where explicitly declared in directory tables | Foreign keys to those declared keys use the same UUID type; `current_customer()` keeps its UUID cast |
| tenant_id | text | Same GUC name `lip.tenant_id`, set transaction-locally from trusted principal |
| LIP member_id | text `m` + 26 Crockford base32 characters, no hyphen | Stamp candidate parsing uses the exact entire member prefix |
| purchase order_id / redemption-only order_id | text `p_<ULID>` / `r_<ULID>` | Separate namespaces; zero-value redemption-only orders never accrued |
| owner adjustment / paper migration business id | text `adj_<ULID>` / `mig_<ULID>` | Stable business ids and byte-identical replay |
| stamp void adjustment/restore/cancel ids | Exact text strings from lip-integration Identifier formats | Not UUID casts and never derived from raw identity/PII |
| member_ops.admission_id and lip_calls.admission_id | Fresh ULID token / reference to that token | Never reused on re-admission even if op_ref is reused |
| session_hash, token_hash, code_hash | Hash/byte storage where specified by the relevant table | Not a UUID/ULID conversion |

**Still unresolved:** the source tables do not spell out every column's SQL type/nullability, every UUID generation version or every unspecified opaque-key representation. The generic “all IDs are ULIDs” statement cannot fill these gaps. T006/T015 remain blocked on a per-column schema/policy manifest; the implementer must not choose the missing types or alter upstream identifiers. OD-08 first-name constraints remain separately unresolved. This is an incomplete technical brief, not a new OD or a selected solution.

## Stage-policy cells

Authority: docs/context/01-decisions.md, PD-005 A2; approved FR-092 and SC-008. The following 30 cells are a direct transcription (three columns, ten action rows). Active means ordinary full service as stated in R-19/FR-093; this table deliberately makes no new active-stage exception.

| Action | Grace | Read-only | Suspended |
| --- | --- | --- | --- |
| Accrue purchase / confirm pending claim | allow | allow | deny |
| Redeem reward | allow | allow | allow |
| Void purchase including permitted stamp restore | allow | allow | allow |
| Owner correction / service_recovery adjustment | allow | allow | allow |
| Owner bonus / gift adjustment | allow | deny | deny |
| Owner migration adjustment (only paper workflow) | allow | deny | deny |
| Revoke staff, devices or sessions | allow | allow | allow |
| Add staff / publish or change program (campaigns outside P0) | allow | deny | deny |
| New customer joins cafe | allow | allow | deny |
| Rotate leaked Branch QR | allow | allow | allow |

Tests must enumerate all 30 cells, plus Cairo day boundaries 0/1/7/8/37/38. Denied BFF operations use `403 stage_forbidden`, with `details.stage`, per contracts/README Error model. Capacity-limit monitoring is not a substitute stage policy and cannot block these actions. Redemption, void, correction, service recovery, revocation and QR rotation remain possible when suspended. No Cloud suspension/write-freeze is introduced.

**PD-005 A3 cells (owner-approved 2026-11-13).** Thirteen further actions, 39 cells, transcribed from `docs/context/01-decisions.md` PD-005 A3:

| Action | Grace | Read-only | Suspended |
| --- | --- | --- | --- |
| Settings: main language | allow | allow | allow |
| Settings: amount label | allow | allow | allow |
| Settings: large-bill threshold | allow | allow | allow |
| Settings: reward expiry (7–90 days) | allow | deny | deny |
| Create branch | allow | deny | deny |
| Update branch names or hours | allow | allow | allow |
| Deactivate branch | allow | allow | allow |
| Reactivate branch | allow | deny | deny |
| Issue device enrollment code | allow | allow | deny |
| Existing staff access recovery (phone re-verification, PIN reset) | allow | allow | allow |
| PIN setup code for the existing owner staff profile | allow | allow | allow |
| First-time owner staff profile setup | allow | allow | deny |
| Edit program draft (no publish) | allow | allow | deny |

Suspended allows only recovery of access for staff profiles and devices that were registered and authorized before suspension; any first registration of a device or staff profile is denied. Publishing stays denied in read-only and suspended. Tests for T023/T046 and the stage middleware enumerate all 39 cells with the same Cairo day boundaries (0/1/7/8/37/38) and `403 stage_forbidden` with `details.stage`. Any owner action not in A2 or A3 is still not wired by inference; it goes to the owner. OD-01 (code lifetimes, step-up) stays unresolved.

**PD-005 A4 cells (owner-approved 2026-11-13, PD-042).** One further action, 3 cells, transcribed from `docs/context/01-decisions.md` PD-005 A4:

| Action | Grace | Read-only | Suspended |
| --- | --- | --- | --- |
| Customer creates a new pending claim (Method A) | allow | allow | deny |

- **Existing claims:** a stage change cancels no open claim. An open claim cannot be confirmed while suspended (A2), so it expires.
- **Tests:** T028 and T033 enumerate these 3 cells with the same Cairo day boundaries (0/1/7/8/37/38), and each denial returns `403 stage_forbidden` with `details.stage`.
- **Totals:** the stage table has **72 cells**: A2 30, A3 39, A4 3. *(Pending Gate 2 revision to 75 cells for PD-005 A5: [gate2-branding-revision.md](gate2-branding-revision.md) §5.6; not approved.)*
- **Unlisted actions:** any action not in A2, A3 or A4 is still not wired by inference.

**PD-005 A5 cells (owner-approved 2026-11-14, PD-046 MB-03).** One further action, 3 cells, transcribed from `docs/context/01-decisions.md` PD-005 A5. **Not yet in T028's 72-cell transcription**; T028 needs a Gate 2 revision to add them.

| Action | Grace | Read-only | Suspended |
| --- | --- | --- | --- |
| Owner changes or resets the brand palette | allow | allow | allow |

- With A5 the stage table has 75 cells. The save cap and reauthentication for this action are not stage cells; they are owner-approved policy (U-1, U-2, U-6, 2026-11-14) with a proposed design in [gate2-branding-revision.md](gate2-branding-revision.md) §2–§3 (not approved at Gate 2).

## T010 — pure digits and piaster seam

**Files, all new:** `apps/web/src/lib/digits/normalize.ts`, `normalize.test.ts`; `apps/web/src/lib/money/piasters.ts`, `piasters.test.ts`. No package, framework config, route, API serialization, browser component, schema or migration change. This core is usable under the existing root Vitest include `apps/**/*.test.ts`; package wiring remains a separate reasoning task. No new dependency.

**Sources:** PD-007 Numbers, money, direction; FR-132; contracts/README Money; quickstart E3. Use strict TypeScript with `.js` relative imports, no `any`.

**Local typed contract:** export `normalizeDigits(text: string): string`, which replaces only U+0660–0669 and U+06F0–06F9 by ASCII 0–9 and preserves other characters. Export `parseBillPiasters(text: string): bigint`, taking that normalized string in the already specified nonnegative bill-decimal representation (digits, optional decimal `.` or the E3 Arabic decimal `٫`, at most two fractional digits). Export `formatPiasters(piasters: bigint, language: 'ar' | 'en'): string`, returning exactly the PD-007 money text. Invalid core input throws without rounding or truncation; tests assert failure rather than a new HTTP error model. More expansive raw-input policies (grouping, signs, whitespace conventions or route limits) are outside this card and must not be invented in it.

**Steps:** map the two digit ranges; split the accepted decimal separator without Number/parseFloat; multiply integer pounds by 100 and right-pad the fraction to two digits using integer arithmetic; format zero fractional part without `.00`, otherwise keep two fraction digits. Use `ج.م` suffix in Arabic and `EGP` prefix in English, both with Western digits. Keep bidi markup in the UI task, not control characters in the result. Never implement earn rounding/preview calculations here.

The core formatter's input domain is the nonnegative bill piasters used in these vectors; negative core inputs fail without producing formatted output. This precondition does not forbid negative point balances or decide a refund/adjustment input policy. Those are outside this bill-formatting helper.

**Vectors:** empty/malformed decimal and >2 fractional digits fail with no truncated result; `0`→0, `45`→4500, `45.5`/`45.50`→4550, `٤٥٫٥٠` and Persian digit equivalent→4550; a large whole string must preserve exact bigint precision beyond the JS safe-integer range. Formatting 4500→`45 ج.م`/`EGP 45`; 4550→`45.50 ج.م`/`EGP 45.50`; no Arabic-Indic output digits. Unit normalizer preserves punctuation and other non-digit characters; it is not a phone validator.

**Verification:** `npx --no-install vitest run apps/web/src/lib/digits/normalize.test.ts apps/web/src/lib/money/piasters.test.ts`; `npx --no-install tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext --noUncheckedIndexedAccess --exactOptionalPropertyTypes --noUnusedLocals --noUnusedParameters --noImplicitOverride --noFallthroughCasesInSwitch apps/web/src/lib/digits/normalize.ts apps/web/src/lib/money/piasters.ts`; standard four repository checks. Expect exit 0 and exact vector results. No live DB/browser call is needed for this pure seam. Real Cairo/PG time-zone probes are T044/T054 reasoning evidence, not a hidden dependency of these arithmetic helpers.

**Lower-cost executor pins (orchestrator, 2026-11-13).** These remove remaining executor choices; each is either read directly from the cited source or an internal-helper detail that changes no product rule.

- `normalizeDigits` maps U+0660–U+0669 and U+06F0–U+06F9 to `0`–`9` code point by code point and returns every other character unchanged (including U+066B `٫`, spaces and signs). It never throws.
- `parseBillPiasters` accepts only ASCII digits, so callers normalize first; tests call `parseBillPiasters(normalizeDigits(x))` for Arabic-Indic/Persian vectors. Accepted grammar (whole string, no trimming): `^[0-9]+(?:[.٫][0-9]{1,2})?$`. Leading zeros are allowed (`045`→`4500n`, `0.00`→`0n`). Anything else throws, including `""`, `"45."`, `".5"`, `"45.555"`, `"4,500"`, `"-1"`, `"+1"`, `" 45"`, `"٤٥"` (un-normalized) and `"45,50"`. Rejecting `45.` and `.5` is owner-approved (PD-039 item 2, 2026-11-13).
- Conversion: `BigInt(intPart) * 100n + BigInt(frac.padEnd(2, "0"))` (empty fraction → `0n`). No `Number`, `parseFloat`, `Math.*` or floating arithmetic anywhere.
- `formatPiasters`: throws for `piasters < 0n`. Let `p = piasters / 100n`, `q = piasters % 100n`. Amount text = `p.toString()` when `q === 0n`, else `p.toString() + "." + q.toString().padStart(2, "0")`. Arabic result = amount + U+0020 + `ج.م`; English result = `EGP` + U+0020 + amount. No thousands grouping (owner-approved, PD-039 item 3). No bidi control characters.
- Errors: throw an `Error` (any subclass); tests assert with `toThrow()` and never on message text.
- Additional exact vectors: `parseBillPiasters("9007199254740993")` → `900719925474099300n`; `parseBillPiasters("0.5")` → `50n`; `parseBillPiasters("045")` → `4500n`; `formatPiasters(5n,"en")` → `EGP 0.05`; `formatPiasters(123456789n,"ar")` → `1234567.89 ج.م`; `formatPiasters(0n,"en")` → `EGP 0`; `formatPiasters(-1n,"ar")` throws; `normalizeDigits("۱۲a٫٣")` → `"12a٫3"`.
- Each test file imports its subject with a relative `.js` specifier (`./normalize.js`, `./piasters.js`), as existing repository tests do. `piasters.test.ts` also imports `normalizeDigits` from `../digits/normalize.js` for the composed vectors. `piasters.ts` itself does not import `normalize.ts`.

**Typecheck flags.** Every standalone `tsc` command for T010, T035 and T048 carries the strictness flags of `tsconfig.base.json` (`--noUncheckedIndexedAccess --exactOptionalPropertyTypes --noUnusedLocals --noUnusedParameters --noImplicitOverride --noFallthroughCasesInSwitch`), so the code still passes once the app gets a tsconfig that extends the base.

## T035 — pure stamp-void planning seam

**Files, both new:** `apps/bff/src/voids/stamp-plan.ts`, `stamp-plan.test.ts`. No endpoint, storage, lock, journal, LIP write, candidate-query implementation or new dependency. This task does not wait on a real award; inputs are synthetic authoritative-fact fixtures. Live C1–C8/checks(a)–(f) remain required in T036 before stamp void completion.

**Sources:** PD-008 A1 Plan, Preconditions, C1–C5; approved US5 scenario 2; R-17. Input is a typed read-only set of facts: member id, saved marker, original and current program revision, authoritative earned stamps `a`, current balance `cur`, threshold `t`, and candidates with exact id, sequence, issued status and active-reservation state. All arithmetic values are bigint; threshold positive, earned amount nonnegative. Do not fetch or reconstruct any input.

Export `planStampVoid(facts: StampVoidFacts): StampVoidPlanResult`. `StampVoidFacts` has readonly fields `memberId: string`, `marker: bigint`, `originalProgramRevision: string`, `currentProgramRevision: string`, `a: bigint`, `cur: bigint`, `t: bigint`, `candidates: readonly StampCandidate[]`; each candidate has readonly `id: string`, `sequence: bigint`, `status: string`, `activeReservation: boolean`. The result is `{ok:true, k:bigint, restore:bigint, finalBalance:bigint, rewardIds:readonly string[]}` or `{ok:false}`. The mapper of real LIP revision/status fields remains reasoning work in T036; these are internal authoritative-fact fixture types, not a new wire schema. The helper neither accepts nor calculates HTTP request bodies.

**Output/algorithm:** a typed local success plan containing `k`, `restore`, final balance and chosen reward ids, or a typed local precondition failure. This internal result does not add a wire error code; T036 maps its authorized precondition refusal to existing `409 void_needs_owner`. Reject republish or `cur` outside `[0,t)`. For `d=a-cur`, `k=0` when `d<=0`, otherwise `k=(d+t-1)/t` using integer division; `restore=k*t`; final=`cur+restore-a`. Only exact `stamp-<entire-member-id>-<sequence>` candidates above marker, issued and unreserved qualify. Sort newest sequence first, choose k; insufficient candidates fails. No amount from current earn-rate settings; no timestamp-based selection and no gift ids. Wire bodies/idempotency keys belong to T036, not this helper.

Candidate facts form a set, with unique ids and sequences for that member. The supplied sequence must agree with the exact candidate id's sequence; inconsistent or duplicate facts produce the local precondition failure, rather than duplicate cancellation targets. Tests include these malformed fixture cases. This is validation of the helper's authoritative-fact input, not a new LIP parsing or eligibility policy.

**Vectors:** t5/a1/cur2→k0/restore0/final1; t5/a1/cur0→k1/restore5/final4; t5/a11/cur0 and three free candidates→k3/restore15/final4. Reserved/redeemed newest candidates are skipped if enough others remain; exact marker is excluded; gift or prefix-confusable member id is excluded; same timestamps do not affect sequence ordering; too few candidates, republish, cur=-1 or cur=t fails. Successful result always satisfies `[0,t)`. Inputs are not mutated; running helper twice on identical saved facts returns identical plan. Persistence/replay safety cannot be proven by this pure test and stays in T036.

**Verification:** `npx --no-install vitest run apps/bff/src/voids/stamp-plan.test.ts`; standalone strict tsc with the same flags as T010 and source `apps/bff/src/voids/stamp-plan.ts`; standard four checks. Expected exit 0; report exact pass/fail/skip counts. No LIP/PG setup is needed for this pure function; no claim that it passes C6–C8 live proof or enables FP-003.

**Lower-cost executor pins (orchestrator, 2026-11-13).** Read from PD-008 A1 (Plan, Preconditions) and `packages/reference/src/engine.ts` `issueThresholdRewards` (ids are `stamp-${memberId}-${n}`, `n` a decimal integer from 1).

- Evaluate in this order, returning `{ok:false}` (never throwing) at the first failure:
  1. Scalar checks: `t <= 0n`; `a < 0n`; `marker < 0n`; `originalProgramRevision !== currentProgramRevision`; `cur < 0n || cur >= t`.
  2. **Own-prefix filter first:** drop every candidate whose `id` does not start with `` `stamp-${memberId}-` `` (gift `adj_…`, another member's reward). Dropped candidates are never validated and never cause a failure, whatever their `sequence`, `status` or duplicates.
  3. Structural checks on the remaining own-prefix candidates only: duplicate `id`; duplicate `sequence`; `sequence < 1n`; `id` not exactly `` `stamp-${memberId}-${sequence.toString()}` ``.
  4. Qualification and count: fewer qualifying candidates (below) than `k`.
- A candidate *qualifies* iff `id === `` `stamp-${memberId}-${sequence.toString()}` `` and `sequence > marker` and `status === "issued"` and `activeReservation === false`. A candidate whose id does not start with `` `stamp-${memberId}-` `` (gift `adj_…`, another member's id, including one that merely shares a prefix) is silently excluded, not a failure.
- `d = a - cur`; `k = d <= 0n ? 0n : (d + t - 1n) / t`; `restore = k * t`; `finalBalance = cur + restore - a`. When `k === 0n` the result is `{ok:true, k:0n, restore:0n, finalBalance:cur - a, rewardIds:[]}` regardless of candidates (but still after all validity checks above).
- `rewardIds` = qualifying candidates sorted by `sequence` descending, first `k` ids, in that order. Copy before sorting; never mutate the input array or its objects.
- Additional exact vectors: a gift candidate `adj_01ARZ3NDEKTSV4RRFFQ69G5FAV` with `sequence: 0n`, plus a foreign member's reward sharing sequence 3 with an own candidate → both excluded, plan still `{ok:true}`; marker 2 with candidates seq 1,2,3 (all issued, unreserved), t5/a6/cur0 → k2 needs two qualifying but only seq 3 qualifies → `{ok:false}`; seq 4 reserved and seq 3,2 free, marker 1, t5/a6/cur0 → `rewardIds` `[seq3-id, seq2-id]`, final 4; id `stamp-<memberId>-03` with sequence 3n → `{ok:false}`; id of member `mAAAA…` (another 27-char id) → excluded; `t=0n` → `{ok:false}`; `a=0n, cur=0n` → k0, final 0.
- Tests use fixture member ids of the form `m` + 26 Crockford base32 characters (for example `m01ARZ3NDEKTSV4RRFFQ69G5FAV`). The test imports `./stamp-plan.js`.

## T048 — pure availability classification seam

**Files, both new:** `apps/bff/src/slo/availability.ts`, `availability.test.ts`. No probe deployment, scheduler, minute import/storage, time-zone library or database. No OD-03 choice. Inputs come from the separate reasoning window/enumeration work and use already deduplicated, clipped counts per operation; that work remains T049 plus T044 time-zone proof and cannot be skipped at pilot readiness.

**Sources:** approved SC-012 and PD-038 P6. Input: integer counts M/O/S with `0<=S<=O<=M` and a partial-period flag. Output: status PASS/FAIL/INSUFFICIENT DATA; original counts; gap minutes `M-O`; exact ratios as numerator/denominator pairs (null when M=0); partial label unchanged. No output formatting or statistical/causal claim. Invalid counts fail as an internal input-contract error, not a selected business fallback.

Export `classifyAvailability(input: AvailabilityInput): AvailabilityResult`. Input fields are readonly `M:bigint`, `O:bigint`, `S:bigint`, `partial:boolean`. Result fields are `status:'PASS'|'FAIL'|'INSUFFICIENT DATA'`, `M`, `O`, `S`, `gapMinutes:bigint`, `coverage:{numerator:bigint,denominator:bigint}|null`, `worstCaseAvailability:{numerator:bigint,denominator:bigint}|null`, `partial:boolean`. These are local helper types; network JSON serialization and browser formatting are outside this task. Tests assert thrown failure for invalid integer counts without selecting a new client error code.

**Algorithm:** if M=0, return INSUFFICIENT DATA and no numeric ratios. Otherwise PASS iff `1000*O >= 995*M` and `1000*S >= 995*M`; else FAIL iff `1000*(S+M-O) < 995*M`; otherwise INSUFFICIENT DATA. Use bigint integer comparisons; do not round a rate before classification. Preserve FAIL despite poor coverage. Missing minutes are never success.

**Vectors:** M1000/O1000/S995 PASS; M1000/O990/S990 INSUFFICIENT DATA; M1000/O100/S0 FAIL; M1000/O0/S0 INSUFFICIENT DATA; M0/O0/S0 no ratio; M1000/O1000/S994 FAIL. Include exact 99.5% equality, values beyond safe-integer range, invalid order/counts, independent award/redemption reports and partial label propagation. Derived count fixtures M1020/M1140 test the classifier without claiming to prove IANA DST enumeration; full window deduplication/month attribution remains the reasoning integration test.

**Verification:** `npx --no-install vitest run apps/bff/src/slo/availability.test.ts`; standalone strict tsc with T010 flags and source `apps/bff/src/slo/availability.ts`; standard four checks. Expect exit 0, exact vector outcomes and no skips. No live DB/prober test is substituted by these unit tests.

**Lower-cost executor pins (orchestrator, 2026-11-13).** Read from spec.md SC-012 (coverage = O ÷ M; worst-case availability = S ÷ M).

- Throw (`toThrow()` in tests) when `M < 0n`, `O < 0n`, `S < 0n`, `S > O` or `O > M`. No other validation.
- `coverage = {numerator: O, denominator: M}` and `worstCaseAvailability = {numerator: S, denominator: M}`, unreduced; both `null` when `M === 0n`. `gapMinutes = M - O` (so `0n` when M is 0). `M`, `O`, `S` and `partial` are returned unchanged.
- "Operation separation" means: the function is stateless; a test calls it for an award fixture and a redemption fixture and asserts each result depends only on its own input (and that calling in either order gives identical results).
- Additional exact vectors: M1020/O1020/S1015 → PASS (`1015000 >= 1014900`); M1140/O1140/S1134 → FAIL (`1134000 < 1134300`); M1000/O1000/S995 with `partial:true` → PASS and `partial:true`; M1000/O995/S995 → PASS (exact 99.5% equality); M1000/O994/S994 → INSUFFICIENT DATA (`994+6=1000`, best case meets the target); M0/O0/S0 → INSUFFICIENT DATA, ratios `null`, gap `0n`; M10n**20n/O same/S same → PASS; O>M, S>O, M=-1n each throw.
- The test imports `./availability.js`.

## T079 — authoritative BFF money module (PD-039)

**Files, all new:** `apps/bff/src/money/normalize.ts`, `normalize.test.ts`, `piasters.ts`, `piasters.test.ts`. No package, route, schema or dependency change.

**Contract:** identical to T010 — the same exported names (`normalizeDigits`, `parseBillPiasters`, `formatPiasters`), signatures, grammar, failure rules and every T010 vector (original and pinned), copied verbatim into the BFF tests. BFF tests import `./normalize.js` and `./piasters.js` (the composed vectors import `normalizeDigits` from `./normalize.js`, not T010's `../digits/normalize.js`). The BFF result is authoritative for every recorded amount (PD-039 item 1). Never import from `apps/web`, and never add a shared package or anything under `packages/*`.

**Verification:** `npx --no-install vitest run apps/bff/src/money/normalize.test.ts apps/bff/src/money/piasters.test.ts`; standalone strict `tsc` with the T010 flags on the two sources; the standard four checks. T010's and T079's vector tables must stay identical; a reviewer diffs them.

## T080 — merchant palette derivation seam (proposed amendment, PD-046)

**Proposed amendment (PD-046), not approved at Gate 2.** Drafted 2026-11-13 in the autonomous session under owner delegation. It authorizes nothing, closes no gate (`branding-contracts` stays open) and follows MB-01–MB-05, PD-005 A5, U-1–U-6 and corrections A–C (owner-approved 2026-11-14; decisions only, this draft itself stays UNAPPROVED; design in [gate2-branding-revision.md](gate2-branding-revision.md)). No Sol review has run.

**Files, all new:** `apps/web/src/lib/theme/derive.ts`, `derive.test.ts`. No dependency, no other file.

**Sources:** FR-137, FR-139; D2 §1 (contrast formula), §1a (rule).

**Pinned algorithm (removes every executor choice):**
- `parseHex(input: string)`: returns `{ ok: true, hex }` with `hex` upper case only when the whole string matches `^#[0-9A-Fa-f]{6}$` (no trimming); otherwise `{ ok: false, reason: "invalid_colour" }`.
- `contrast(a, b)`: WCAG 2.x relative luminance with the 0.03928 linearisation constant and coefficients 0.2126 / 0.7152 / 0.0722; ratio `(L1 + 0.05) / (L2 + 0.05)` with `L1 ≥ L2`. Comparisons use the unrounded value.
- `on(c)`: the higher-contrast of `#FFFFFF` and `#1F1B16`; on a tie, `#FFFFFF`. If that is below 4.5, the higher-contrast of `#FFFFFF` and `#000000` (tie → `#FFFFFF`).
- `strong(c)`: for `s = 0, 1, …, 100`, each channel `v` becomes `Math.floor((v * (100 - s) + 50) / 100)` in integer arithmetic (round half up). The first candidate whose contrast is at least 4.5 on both `#FFFFFF` and `#F6F4EF` is the result. `s = 100` gives `#000000`, which always passes.
- `deriveTheme({ primary, secondary, accent })` takes three parsed hex strings and returns, per role, `{ base, on, strong }`.

**Vectors** (computed 2026-11-13 by script; the 0.04045 constant gives the same ratios to 2 dp; integer half-up and banker's rounding give the same `strong` for every vector):

| Set | Role | Input | `on` | on ratio | `strong` | s (%) | strong on `#FFFFFF` / `#F6F4EF` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Default | primary | `#3A2419` | `#FFFFFF` | 14.52 | `#3A2419` | 0 | 14.52 / 13.21 |
| Default | secondary | `#E8C88A` | `#1F1B16` | 10.65 | `#7D6C4B` | 46 | 5.10 / 4.64 |
| Default | accent | `#F59E0B` | `#1F1B16` | 7.97 | `#9A6407` | 37 | 5.00 / 4.55 |
| Demo A | primary | `#0F4C5C` | `#FFFFFF` | 9.51 | `#0F4C5C` | 0 | 9.51 / 8.65 |
| Demo A | secondary | `#F1E3C8` | `#1F1B16` | 13.50 | `#766F62` | 51 | 4.98 / 4.53 |
| Demo A | accent | `#E36414` | `#1F1B16` | 4.97 | `#B85110` | 19 | 4.97 / 4.52 |
| Demo B | primary | `#F4A6B8` | `#1F1B16` | 8.96 | `#90626D` | 41 | 5.06 / 4.60 |
| Demo B | secondary | `#2E3A59` | `#FFFFFF` | 11.26 | `#2E3A59` | 0 | 11.26 / 10.24 |
| Demo B | accent | `#7CB518` | `#1F1B16` | 6.91 | `#547B10` | 32 | 4.98 / 4.53 |
| Hard | - | `#FFFFFF` | `#1F1B16` | 17.12 | `#707070` | 56 | 4.95 / 4.51 |
| Hard | - | `#000000` | `#FFFFFF` | 21.00 | `#000000` | 0 | 21.00 / 19.11 |
| Hard | - | `#777777` | `#000000` | 4.69 | `#707070` | 6 | 4.95 / 4.51 |
| Hard | - | `#BE64A0` | `#1F1B16` | 4.50 | `#A25588` | 15 | 5.01 / 4.56 |
| Hard | - | `#FFFF00` | `#1F1B16` | 15.94 | `#737300` | 55 | 5.02 / 4.57 |

- `#BE64A0` is the boundary case: its `on` ratio is 4.5001 (unrounded), so `#1F1B16` is kept.
- Rejection vectors: `#abc`, `abc123`, `#GGGGGG`, ` #3A2419`, `#3A2419;`, `red`, `url(x)`, `var(--x)`, empty string → `invalid_colour`. `#3a2419` → `#3A2419`.

**Verification:** `npx --no-install vitest run apps/web/src/lib/theme`; standalone strict `tsc` with the T010 flags on `derive.ts`; the standard documentation checks.

## Remaining execution details and routing

Only the pure seams above have a pinned file/test/algorithm brief in this refinement. Complex RLS, journal/erasure recovery, provider-backed authentication, migrations, full UI/PWA flows and deployment remain reasoning work with unresolved prerequisites. Do not choose Next.js/i18n/QR/Playwright versions or TTL600 from suggestions; T002 must record the reviewed choices and exact file/command manifest before affected implementation cards become ready. T002 produces that brief and must not require its own completed brief as an entry gate. No routing configuration is changed.

The broad T006/T045/T055 cards still need per-file/vertical decomposition once the missing source decisions are available. They are blocked reasoning work, not Flash-ready merely because their fields exist. File naming of the three pure seams is a routine decomposition within already approved modules; it does not ratify new dependencies, database types, raw-input UX rules or stage cells.
