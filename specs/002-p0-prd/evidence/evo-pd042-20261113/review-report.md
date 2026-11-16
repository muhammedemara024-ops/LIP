# Review record: PD-042 owner follow-up decisions (2026-11-13)

**Risk:** HIGH (decision register, stage permissions, OTP rate rule, approved task cards).

**Reviewer:** `plan-review`, `gpt-6.1-sol`, read-only sandbox (confirmed in each relay's `result.json`). `git status` and the governance/spec file SHA-256 snapshot were identical before and after every run.

## Initial review: CHANGES REQUIRED

| ID | Severity | Location | Finding | Resolution |
| --- | --- | --- | --- | --- |
| R-01 | HIGH | T016 | Rolling-window tests missing | Added: sixth send within 60 minutes refused across a clock-hour boundary, mixed WhatsApp/SMS and purposes; send allowed again once the oldest send ages out; F-01 cases excluded |
| R-02 | MEDIUM | T010, T035, T048 field 13 | Cited an `npm test` step that is not in Verification | Changed to "no existing behaviour affected", with justification (Sol accepted; the approved Verification is not changed) |
| R-03 | MEDIUM | T001, T002 field 13 | Preservation mapped to checks that do not exist | Snapshot plus `git diff --no-index` review (the files are untracked) |
| R-04 | MEDIUM | `jg-consolidation-review.md` JG-01 row | Stale "SMS-only proposed" text | Replaced with the approved all-channel rolling limit |
| R-05 | MEDIUM | T058 field 13 | Overbroad approval requirement for contract-bearing names | Narrowed to changes found to be breaking (rule 01 §5 item 3) |

Sol confirmed:
- A2 has 30 cells and A3 has 39, both unchanged; total is 72 cells with A4.
- A4's grace and read-only cells and its reuse of `403 stage_forbidden` are consistent with A2/A3.
- No F-01 mechanism was invented, and the 10/day cap is unchanged.
- PRD edits are confined to the approved items.
- OD-01 to OD-18 are unchanged and FP-003 is unauthorized.
- JG counts are still 3 / 7 / 2.
- The constitution edit is history-only, at version 1.2.0.

## Follow-up rounds

- **Round 1:** R-01, R-02, R-04 and R-05 closed. R-03 open: `git diff` cannot show an untracked file.
- **Round 2:** R-03 closed. Verdict **APPROVED**; no new findings, and no owner decision needed.

Fable was not required: no Opus–Sol disagreement remained. The Fable review before any push is still mandatory.

## Verification

Windows host, Node 22.22.0:

| Check | Result |
| --- | --- |
| `npm run docs:check` | OK, 10 pairs |
| `npm run public-safety:check` | 703 tracked files |
| `npm run launch:check` | OK |
| `npm run typecheck` | exit 0 |
| `git diff --check` | clean |

The index holds only `.gitattributes`. `npm test` was not run, because the change is documentation only.
