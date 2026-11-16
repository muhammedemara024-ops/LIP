# Customer API (`app.` → `/api/v1/customer`)

Conventions and errors: [README.md](README.md). Customer sessions are created by our own OTP (PD-004). They never reach LIP.

## Sign-in and session

| Method & path | Auth | Request | Success | Rules / errors |
| --- | --- | --- | --- | --- |
| `GET /session` | optional | — | `{signed_in, language, csrf_token}` (+ `__Host-pre` cookie when signed out) | Pre-sign-in language comes from a cookie (PD-007); pre-sign-in CSRF per README |
| `POST /otp/send` | none | `{phone, purpose:"sign_in", turnstile_token}` | `202 {challenge_id, resend_after_s}` | Egyptian mobile only (`^\+20(10\|11\|12\|15)\d{8}$` after digit normalization); Turnstile; per-phone (5 sends in any rolling 60 minutes across WhatsApp, SMS and all purposes, and 10/day; PD-020, PD-042), per-IP and per-device limits; circuit breaker → `503 otp_paused`; FR-010 |
| `POST /otp/verify` | none | `{challenge_id, code}` | `200 {needs_first_name}` + `__Host-cust` cookie | Constant-time HMAC check; 5 wrong attempts; 5-minute validity; creates the universal account on first sign-in (FR-002) |
| `PUT /profile/first-name` | cust | `{first_name}` | `200` | Stored once on the account (FR-019, PD-023); OD-08 length cap |
| `PUT /profile/language` | cust | `{language:"ar"\|"en"}` | `200` | FR-130 |
| `POST /sessions/revoke-all` | cust | — | `204` | Ends every session and blocks member codes on signed-out devices (FR-017) |
| `POST /phone-change/send` | cust | `{new_phone, turnstile_token}` | `202 {challenge_id}` | OTP goes to the **new** number (FR-018) |
| `POST /phone-change/verify` | cust | `{challenge_id, code}` | `204` | On success, revokes every session and device secret |
| `POST /account/delete/send` | cust | — | `202 {challenge_id}` | Fresh OTP to the customer's own phone (FR-009) |
| `POST /account/delete/confirm` | cust | `{challenge_id, code}` | `202 {status:"completed"\|"queued"}` | Queued while a void is in progress for any membership (FR-008) |

## Devices and member code

| Method & path | Auth | Request | Success | Rules / errors |
| --- | --- | --- | --- | --- |
| `POST /devices` | cust | `{label}` | `201 {device_id, secret, secret_version, step_seconds:30}` | Refused with `409 device_limit` if 3 devices are already active (FR-022); the secret is returned once and imported non-extractable (R-11) |
| `POST /devices/{id}/rotate` | cust (that device) | — | `200 {secret, secret_version}` | Called whenever the app is online (PD-003 A1) |
| `GET /devices` | cust | — | list of devices (label, registered_at, last_seen) | — |
| `DELETE /devices/{id}` | cust | — | `204` | Codes from that device then fail with `device_revoked` |

The member QR payload is computed on the device (research R-11). No server call is made to display it.

## Joining and cards

| Method & path | Auth | Request | Success | Rules / errors |
| --- | --- | --- | --- | --- |
| `GET /branch-qr/{token}` | optional | — | `{cafe_display, branch_display, is_member}` | The token is the Branch QR credential; rotated or deactivated → `410 qr_rotated` / `branch_inactive` (FR-032). No PII. |
| `POST /branch-qr/{token}/join` | cust | `{marketing_consent: boolean}` (default false) | `201 {card_ref}` | Creates the membership attributed to that branch and enrolls it in LIP (`members/enroll`); grants nothing (FR-031); suspended stage → `403 stage_forbidden` (PD-005 A2); consent recorded per café with policy version (FR-005) |
| `GET /cards` | cust | — | for each café: card_ref, café/branch display text (current language with fallback), program type, progress, issued rewards with terms snapshot, points balance, expiring-soon items with exact moment | Balances from LIP `accounts/get` per café (merchant key server-side); expiring items come from LIP lots (PD-007 C1, FR-120) |
| `GET /cards/{card_ref}/history` | cust | `?cursor` | visits with branch | Purchases (customer RLS policy) grouped per FR-159 |
| `PUT /cards/{card_ref}/consent` | cust | `{marketing: boolean}` | `200` | Append-only consent row |
| (no endpoint) reward code | — | — | — | **Display only**; the app cannot reserve or capture (FR-050, PD-003). LIP stores no bearer code for automatically issued stamp rewards, so every reward code is generated **on the device**: `v1r.<device_id>.<card_ref>.<reward_ref>.<counter>.<mac>` (R-11, domain-separated from the member code). `reward_ref` is the random BFF reference returned in `GET /cards` for each issued stamp reward and each points catalogue reward; the predictable `stamp-<member>-<n>` id is never exposed. Device-bound, single-use, valid at most 60 s, never logged. |

**Brand palette in responses — proposed amendment (PD-046).** **Proposed amendment (PD-046), not approved at Gate 2.** Drafted 2026-11-13 in the autonomous session under owner delegation. It authorizes nothing, closes no gate (`branding-contracts` stays open) and follows MB-01–MB-05, PD-005 A5, U-1–U-6 and corrections A–C (owner-approved 2026-11-14; decisions only, this draft itself stays UNAPPROVED; design in [gate2-branding-revision.md](../gate2-branding-revision.md)). No Sol review has run.

- `GET /branch-qr/{token}`, each card in `GET /cards`, `GET /claims/{id}` (correction A) and each item of `GET /migrations/pending` (U-4) gain an **additive** field `palette: {primary, secondary, accent, version}`. It is always present and resolved on the server from the merchant of the validated Branch QR credential, membership, claim or migration (the platform default when the merchant has none). `GET /claims/{id}` for a claim that is not the signed-in customer's returns `404 not_found` (README error model: cross-tenant and foreign objects are indistinguishable from missing), with no palette; `GET /migrations/pending` lists only the signed-in customer's own pending migrations. Clients that ignore the field keep working.
- **Merchant context (correction C, owner-approved 2026-11-14):** a customer may identify a merchant context by selecting a membership, opening a claim or pending migration, following a merchant link or scanning a Branch QR. The server validates the identifier for the signed-in customer or the QR credential and resolves the merchant itself. A client-supplied palette, tenant or authorization claim, or unverified merchant context is never trusted (FR-138, PD-014).
- Responses that carry a palette add the header `Cache-Control: private` (never stored by a shared cache). The existing responses state no cache policy; this adds a header and changes no field. Offline display (FR-121) stays with the app: it keys every cached or offline copy by card and palette version and clears all of them on sign-out (T082).
- The platform page chrome applies no merchant palette (MB-02). On CUS-05 each card tile applies only its own card's palette, inside the tile.
- **Palette source per screen (classification owner-approved 2026-11-14, U-5; package §1):** CUS-01 and CUS-04 use `GET /branch-qr/{token}` (CUS-04 calls it again after sign-in); CUS-06–CUS-08 use the card from `GET /cards`; CUS-09 uses `GET /branch-qr/{token}` on creation and `GET /claims/{id}` after a reload; CUS-10 uses `GET /migrations/pending`. CUS-02, CUS-03 and CUS-11–CUS-18 use none.
- When no valid, authorized merchant context can be established (before a response; `410 qr_rotated`, `branch_inactive`, an unknown token, `404` or any error), the screen uses the platform theme, never a previously shown merchant's palette.

## Pending claims (Method A)

| Method & path | Auth | Request | Success | Rules / errors |
| --- | --- | --- | --- | --- |
| `POST /branch-qr/{token}/claims` | cust | — | `201 {claim_id, claim_code, first_name, expires_at}` | Explicit action, separate from joining (FR-031); at most one open claim per customer per branch; `claim_code` unique among the branch's open claims, with its format and wrong-attempt attribution per OD-12; 15-minute life (FR-029); suspended stage → `403 stage_forbidden` with `details.stage` (PD-005 A4), and a stage change cancels no open claim |
| `GET /claims/{id}` | cust | — | status | — |
| `DELETE /claims/{id}` | cust | — | `204` | Customer cancels their own open claim |

## Paper-card migration (customer side)

| Method & path | Auth | Request | Success | Rules / errors |
| --- | --- | --- | --- | --- |
| `GET /migrations/pending` | cust | — | pending migration(s): café, stamps, expires_at | — |
| `POST /migrations/{id}/accept` / `/decline` | cust | — | `200` | Only while pending and unexpired (FR-072, FR-122) |
