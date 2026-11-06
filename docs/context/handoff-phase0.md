# Handoff — Phase 0 (decision session, 2026-11-06)

All Phase 0 **decisions** are recorded in `01-decisions.md`. What remains are
three execution tasks plus checks that come due later. No application code was
written or changed in this session.

## Commits made in this session

| Commit | Summary |
| --- | --- |
| `3ad38e4` | PD-002 approved (adopt LIP, pin upstream `8ad93c81a414f5f7521061ddd88009083f4857aa`); golden rule 1 rewritten; `07-fork-patches.md` created |
| `0a27a01` | PD-003 approved (staff confirmation is the only path that grants purchase value) |
| `eacef95` | PD-005 amendment A1 (manual billing at launch, Kashier deferred); task 0.11 created |
| `bffac88` | PD-005 A1 follow-ups (grace / read-only / suspended stages, append-only payments) |
| `dd71a37` | PD-003 amendment A1 (device-bound member QR code, offline display) |
| `66dabd6` | PD-004 round 1 recorded; real-number test moved from 0.3 to 2.4 |
| `ab4d3ae` | PD-004 approved (own OTP in the BFF, WhatsApp first + Egyptian SMS) |
| `ab2b4de` | PD-006 round 1 recorded (topology, Frankfurt, design hedge, 0.10 as pilot gate) |
| `fcdd4d5` | PD-006 approved (Render Frankfurt, Pro workspace, Render Postgres) |
| `efc01d2` | PD-007 approved (Arabic-first, English second) |
| `6f2199c` | PD-008 / task 0.6 approved (purchase capture: bill amount only) |

Also done outside commits: git remote `upstream` →
`craveup-oss/loyalty-interchange-protocol` (tags tracked, push disabled).

## Still open in Phase 0

Phase 0 DoD: *PD-002/003/004/006/007 and 0.6 approved; baseline green; drift
fixed.* The decisions are done; these three tasks remain.

| ID | Task | Acceptance criteria (from `06-roadmap.md`) |
| --- | --- | --- |
| 0.7 | Baseline: `npm ci && npm run typecheck && npm test` on Node 22 | All green, result + Node version recorded here |
| 0.8 | Baseline: run Postgres profile + `lip doctor` + `lip test` (depends on 0.7) | Conformance passes against Postgres runtime; idle memory of the LIP process recorded (sizes the instance, PD-006) |
| 0.9 | Fix upstream AI-doc drift (`skills/lip/*`, old gap doc) or mark them non-authoritative; resolve `docs/postgres.md` "attached environment-specific disks" vs diskless `render.yaml` + release runbook | Skills and docs no longer contradict code |

Notes for the execution session:
- 0.7 and 0.8 also gate Phase 2 and **any application code** (PD-002 condition).
- The pinned commit is unreleased upstream `main`, not a tag; treat test
  failures as real until shown otherwise.
- 0.8 must report the LIP process's idle memory: production LIP is sized at
  512 MB in the PD-006 budget, and a larger size triggers PD-006's fallback.
- Record results in the "Done" column of `06-roadmap.md` (date + commit).

## Conditional checks that come due later

| Decision | Check | When | If it fails |
| --- | --- | --- | --- |
| PD-002 | Tasks 0.7 and 0.8 pass | Before Phase 2 / any application code | Reopen PD-002 (exit criterion 1) |
| PD-004 | Real-number delivery test (WhatsApp and SMS to a real Egyptian number) | Task 2.4 (needs 0.11) | Channel/provider choice reopens |
| PD-006 | Postgres lease conformance test + `lip test` pass against the Render staging database | Before task 2.2 is done | Reopen PD-006 |
| PD-006 | Render billing page: Pro fee per workspace or per seat (if per seat, record seats needed — currently 1 — and recompute); PITR billed extra or not; suspended services billed or not; total ≤ $100 after fallback | Before committing to Render (task 2.2) | Apply fallback (suspend staging; $125 only with owner's explicit approval), else reopen PD-006 |
| PD-006 | Restore drill uses Render Postgres point-in-time restore | Task 5.3 | Reopen PD-006 |
| PD-008 | Reserve/capture works with a synthetic order without item lines (or without an order) | Task 3.4 | Raise a new decision; do not patch around it |
| PD-008 | Record LIP stamp reset / balancing behavior when a threshold-crossing order is adjusted | Task 3.6 | — (record findings) |

## Owned by the project owner

| ID | Item | Why it matters |
| --- | --- | --- |
| 0.11 | Legal entity: company commercial registration (none yet; assumed Egyptian-registered) | Blocks SMS sender-ID registration, Meta Business verification, WhatsApp authentication-template approval (Arabic first; English optional), the real-number test in 2.4, and the pilot (5.6) |
| 0.10 | Legal opinion: written opinion from Egyptian counsel on whether hosting personal data in Frankfurt needs a PDPC permit and how to get it, or a permit application filed | Hard gate before the pilot (5.6). Legal facts in PD-006 are unverified (secondary sources). If data must stay in Egypt, PD-006 reopens (design hedge keeps the move limited to the customer directory) |

Also on the owner before task 1.6 (plan pricing): verify the WhatsApp
authentication rate against Meta's official rate card (PD-004, currently
unverified), and collect at least 2 quotes from Egyptian SMS providers before
task 2.4.
