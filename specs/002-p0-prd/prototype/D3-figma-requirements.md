# D3 — Figma prototype requirements (roadmap 1.5)

**PD-047/U-b adoption note (2026-11-15):** D3 is preserved as a historical design-research artifact and source of UX/accessibility criteria, not as a requirement to create a pre-implementation Figma prototype. Its states, flows, A1–A10, seven raw timing markers and carry-forward criteria remain inputs to T084 and T085; final acceptance is on the implemented real-staging UI. Existing NOT RUN/NOT SCORED records and unresolved decisions remain unchanged.

**Status**: **Draft v0.8, 2026-11-14. Prototype design only** (PD-045 item 4). It is not accepted.
- **Not reviewed by Sol yet** (two relay attempts failed on the usage limit).
- No Figma file exists yet. It waits for the owner's workspace set-up (PD-044 item 1).
- Everything labelled *proposed* needs owner review. Nothing here changes a requirement, gate or open decision.
- Inputs: `1.5-prototype-brief.md`, `D1-screen-inventory.md` v0.3, `D2-design-system.md` v0.2, `D4-annotation-register.md` v0.1, `figma-workspace-setup.md` v0.1, journeys 1.2–1.4 and `contracts/*.md`.

## 1. Workspace rules (PD-044 item 1, AC-11)

- The work happens in a non-production Figma workspace. Before the first frame, record:
  - the owning account;
  - the access list;
  - the plan and any cost;
  - the file URL.
- Fictional data only (D2 §9). Never store credentials, real phone numbers, merchant keys or real café names in the file.
- Every shared or tested state is a **named Figma version**: `1.5-v<major>.<minor>-<yyyy-mm-dd>`. Measurement records cite this name (§8).
- The file holds no code and is not exported into `apps/` or `packages/`.

## 2. File structure (*proposed*)

| Figma page | Contents |
| --- | --- |
| 00 Cover | Status, version, working-name label (ST-05), legend for the DD and GATED tags |
| 01 Foundations | D2 tokens as Figma variables, with `locale` modes `ar` (RTL, default) and `en` (LTR); type styles; contrast table copied from D2 §1; a `merchant` collection with modes `platform`, `cafe-a` and `cafe-b` holding the D2 §1a brand tokens (PD-046) |
| 02 Components | D2 §6 components; each has variants for state × locale |
| 10 Customer | CUS-01–CUS-18 frames |
| 20 Counter | CSH-01–CSH-16 frames |
| 30 Owner | OWN-01–OWN-07 onboarding and OWN-10–OWN-17 dashboard (exactly 8 pages, FR-100) |
| 40 Flows | The prototype connections of §4 |
| 50 Annotations | D4: DD and GATED tags, tap counts, timing markers, AA notes |
| 90 Review | D5 review comments and dated owner decisions |

Frame names are the D1 IDs plus the state, for example `CSH-06 / retype-required / ar`. **No brand text in any frame, component, variable or flow name** (AC-08).

## 3. Frames and sizes (*proposed*; sources give no device sizes)

| Surface | Base frame | Extra checks |
| --- | --- | --- |
| Customer (web app first; mobile app is P2, product brief) | 360 × 800 | 320 px reflow (SC 1.4.10); 200 % text (SC 1.4.4) |
| Counter (cheap Android phone, roadmap 1.3) | 360 × 800 | 320 px reflow; 48 px targets (D2 §3) |
| Owner dashboard | 1280 × 800 | 360 px and 320 px reflow; tables may scroll on two axes (the SC 1.4.10 exception) |

Each frame exists in **both** `ar` and `en` modes (AC-02).

## 4. Prototype flows

Each flow lists its D1 screens in order. A refusal branch links to the state frame from D1.

| Flow | Sequence (D1 IDs) | Journey | Notes |
| --- | --- | --- | --- |
| F-C1 Join | CUS-01 → CUS-02 → CUS-03 → CUS-04 → CUS-06 | 1.2 | Branches: QR rotated or inactive; suspended; send limit; wrong code; JG-08 before first publication (refusal text DD) |
| F-C2 Show code | CUS-05 → CUS-06 → CUS-07 | 1.2 | Offline-installed state; signed-out state |
| F-C3 Claim | CUS-01 (member) → CUS-09 | 1.2 | Expired, cancelled and confirmed states; DD(OD-12) code format |
| F-C4 Redeem (customer side) | CUS-06 → CUS-08 | 1.2 | Code display only (FR-050) |
| F-C5 Account | CUS-11 → CUS-12, CUS-13, CUS-14, CUS-15, CUS-16 | 1.2 | Each OTP step uses the fillable OTP field |
| F-C6 Migration accept | CUS-10 | 1.2 | Accept, decline and expired |
| F-C7 Support and recovery | CUS-17, CUS-18 | 1.2 recovery | Recovery mechanisms all DD (F-03, F-04, F-06, JG-04) |
| F-K1 Counter access | CSH-01 → CSH-02 → CSH-03 | 1.3 S1–S3 | PIN frame DD(OD-01, A11Y-01) |
| F-K2 Award | CSH-04 → CSH-05 → CSH-06 → CSH-07 → CSH-08 | 1.3 S4–S8 | Retype, over-limit, repeat-confirmation and unconfirmed branches |
| F-K3 Claim confirm | CSH-04 → CSH-09 → CSH-06 → CSH-07 → CSH-08 | 1.3 S4 | Wrong-code branch (DD OD-12) |
| F-K4 Redeem | CSH-04 → CSH-10 | 1.3 S9–S11 | "Do not hand over yet" while confirming; hold boundary DD(OD-16) |
| F-K5 Void and re-capture | CSH-04 → CSH-11 → CSH-12 | 1.3 S12 | Points void GATED |
| F-K6 Owner at the counter | CSH-03 (owner profile) → CSH-13 → CSH-14 / CSH-15 / CSH-16 | 1.3, 1.4 O10 | CSH-14 DD(OD-18); migration outside the timed path |
| F-O1 Onboarding (timed path) | OWN-01 → OWN-03 → OWN-08 → OWN-04 → OWN-05 → OWN-07 | 1.4 O2–O8 | Start and stop markers (§8); the start event is DD(F-02) |
| F-O1a Returning owner sign-in | OWN-02 → OWN-10 | 1.4 | Same OTP states as CUS-02 and CUS-03; DD(F-01, OD-05) |
| F-O2 Counter-access setup | OWN-16 → OWN-06 | 1.4 O9 | Outside the timed path |
| F-O3 Dashboard | OWN-10 ↔ OWN-11 (→ OWN-11a) ↔ OWN-12 ↔ OWN-13 ↔ OWN-14 ↔ OWN-15 ↔ OWN-16 ↔ OWN-17 | 1.4 | 8 pages only; stage banner ST-02 in each stage variant |

## 4a. Core prototype: iteration 1 (*proposed* build order; changes no acceptance criterion)

**Why.** It draws first the smallest set of screens that the measured journeys need: 1.3 (b), the cashier path "PIN login → scan → amount → confirm → redeem → undo", and 1.4 (b), the owner path "accept invite + OTP → branch → program wizard → print QR". These are the measurements on the M1 critical path.
- Iteration 1 does **not** complete 1.5. Roadmap 1.5 still needs "Figma/prototype of all P0 screens", the final name and owner approval (AC-01, AC-12).
- The other 26 of the 51 D1 screens come in iteration 2. What fidelity the owner accepts for them is an acceptance question for D5. No gate changes.

| Core flow | Screens (D1) | Journey steps | Key FR | States drawn in iteration 1 |
| --- | --- | --- | --- | --- |
| C1 Customer sign-in and join | CUS-01 → CUS-02 → CUS-03 → CUS-04 | 1.2 | FR-003, FR-005, FR-010, FR-031, FR-032 | Happy path; malformed phone; wrong code; send limit; QR rotated |
| C2 Balance and member code | CUS-05 → CUS-06 → CUS-07 | 1.2 | FR-021, FR-120, FR-121 | Stamps and points cards; code expiry |
| C3 Rewards | CUS-08 | 1.2 | FR-044, FR-050 | Issued reward; points catalogue; code display only |
| K1 Counter sign-in | CSH-02 → CSH-03 | 1.3 S3 | FR-014, FR-016 | PIN frame DD(OD-01, A11Y-01) |
| K2 Identify and award | CSH-04 → CSH-05 → CSH-06 → CSH-07 → CSH-08 | 1.3 S4–S8 | FR-021, FR-023–FR-028, FR-112 | Happy path; code used or expired; retype; over-limit; repeat confirmation; unconfirmed |
| K3 Redeem | CSH-10 | 1.3 S9–S11 | FR-050–FR-055 | Hold; capture; release; insufficient balance |
| K4 Undo | CSH-11 | 1.3 S12 | FR-060 | Own void within 10 min; window expired; points void GATED |
| O1 Onboarding to QR | OWN-01 → OWN-03 → OWN-08 → OWN-04 → OWN-05 → OWN-07 | 1.4 O2–O8 (with O4a) | FR-010, FR-012, FR-015, FR-040–FR-045, FR-082, FR-131, FR-136, FR-137 | Happy path for stamps and points; invite expired; wrong code; publish refused when read-only |

**Iteration 1b (needed before 1.3 (b) is complete):** the claim branch of step S4, CUS-09 and CSH-09. It stays DD(OD-12).

**For every core frame:**
- an `ar` and an `en` variant (§5);
- the A1–A10 notes (§6);
- the D4 DD and GATED tags;
- the ST-05 working-name label "اسم عمل — غير نهائي / Working name — not final";
- the name written as ونيس — Wanees only.

**Done when** (testable, design level):
1. Every screen and state in the table exists in both modes.
2. Every flow can be clicked end to end in prototype mode.
3. A1–A10 are recorded per frame.
4. The D4 tags are present.
5. The named version is recorded (§1).

**Test readiness:**
- The core flows can be **run** as soon as they are drawn.
- 1.3 (b) is **scored** only after F-11 and JG-11, M-01, OD-01 (PIN length) and A11Y-01 (PIN input form) are decided. The last two change the S3 tap count.
- 1.4 (b) is scored only after F-02 and M-01 are decided.

## 4b. Merchant theming demo (PD-046; part of iteration 1)

The demo shows that one shared app takes on each merchant's palette (any business category; the two demo merchants are fictional test data), with no leakage between merchants and no loss of AA conformance.
- **Palettes** (D2 §1a):
  - the platform default;
  - Demo Café A, which passes as it is;
  - Demo Café B, whose light primary needs derived colours.

  Only fictional café names are used (D2 §9).
- **Mechanism:** the `merchant` variable collection (§2), with modes `platform`, `cafe-a` and `cafe-b`. If the plan lacks a third mode, the fallback is duplicate frames per palette. That changes no requirement.
- **Frames**, each in `ar` and `en`:
  1. CUS-05, the card list, in platform mode, with two merchant tiles each in its own merchant's colours (MB-02);
  2. CUS-06, CUS-07 and CUS-08, once for merchant A and once for merchant B;
  3. the OWN-08 preview with merchant B's colours, showing the derived text, the `primary-strong` variant and the invalid-value error.
- **Flow F-D1:** CUS-05 → merchant A tile → CUS-06 (A) → back → merchant B tile → CUS-06 (B). No frame shows merchant A colours in merchant B's context.
- **Fixed across palettes:** status colours, the focus ring, QR modules, text and surfaces (D2 §1a rule 4).
- **Done when:**
  - the frames exist in both modes and for each palette;
  - the flow clicks through end to end;
  - each themed frame records its D2 §1a pairs (A1);
  - the frames follow MB-01 and MB-02 (owner-approved 2026-11-14).

## 4c. Provisional visual baseline: "Signature Premium" (owner, 2026-11-13)

The owner approved the Figma page `04 • Signature Premium — Mocha & Gold` (file `lUyDsbGl7RDbOvyk25fV5q`, node 13:2) as a **temporary visual direction**. It is **not** a functional specification and it does not override D1, D2, this document or the PRD. It is expected to be refined later (Claude Design).

**Evidence read (read-only, 2026-11-13).** Layer names, positions and sizes of page 13:2, and the Page 1 drafts. **Not read:** fills, fonts, type sizes, radii, effects, variables, text content, screenshots and page 03. The Figma Starter plan's connector call limit was reached. Every visual property not listed below is **unknown**.

**Measured (from geometry):**
- Three Arabic frames at 410 × 868: "CUS-05 Home", "CUS-07 Member code", "CUS-08 Rewards". A brand board, and an 84 × 66 universal W mark master as editable vectors.
- A 24 px side margin and 362 px content width. Section gaps of 21–23 px. Card and tile gaps of 14 px, which is not on the D2 §3 scale.
- Components:
  - hero balance card (362 × 183) with a 1.3 px trim, coin medallion and 8 px progress bar;
  - three shortcut tiles (110 × 104);
  - featured-reward card;
  - five-tab bottom bar (374 × 70) with a raised 51 px centre "my code" item;
  - filter chips 35 px high;
  - reward cards 123 px high with a 25 px cost tag;
  - an "explore rewards" button 38 px high;
  - membership details and a three-figure stats row.
- The QR: a 244 px white canvas, about 8.3 px modules, a quiet zone of about 21 px (about 2.5 modules), and a 49 × 49 px patch with the W mark over the centre.

**Inferred from geometry, unverified:** icons are text layers, probably emoji or glyphs; bottom-bar labels and the romanized name may be under the D2 14 px caption minimum; how the 70/25/5 split is applied.

**Reconciliation.** Each row must be fixed before a baseline frame counts as AC evidence. Nothing was changed in Figma; edits need a separate design-edit authorization.

| Baseline element | Requirement | Required change |
| --- | --- | --- |
| "CUS-05 Home": one merchant's balance hero, shortcuts and featured reward | D1: CUS-05 is "My cards", one card per merchant; card detail is CUS-06 | Treat the frame as **CUS-06** (merchant context). Draw CUS-05 as the platform card list (MB-02). Mapping note only; no Figma rename yet |
| "Membership tier", "Level", "Gold tier benefits" reward, crown | Tiers are not in P0 (FR-049, PD-012) | Remove. **Not usable as P0 evidence until replaced** |
| "20 % discount" reward | Discount rewards are not in P0 (FR-049, PD-008, PD-012, PD-015) | Replace with a stamp or points reward. **Not usable as P0 evidence until replaced** |
| CUS-07 has no timer or expiry layer; shows a "Membership ID" | CUS-07: device-generated, 60 s, device-bound (FR-021, PD-003 A1); static customer barcodes are rejected | Add the 60 s timer as text plus a cue and the expiry and offline states (D2 §6). Show no static identifier as the code |
| W mark over the QR centre; quiet zone about 2.5 modules | D2 §1a item 4 and §1b: black on white, at least 4 modules of quiet zone, no overlay in P0 | Remove the overlay; widen the quiet zone; keep any glow outside it |
| W mark and wordmark on every customer screen | MB-02 (owner-approved 2026-11-14; classification U-5): merchant name on merchant screens, W mark on platform screens | Merchant screens show the merchant name plus a small "on Wanees" mark |
| Gold and amber used as fixed decoration | PD-046: brand roles are per merchant | Bind trims, halos and pinstripes to `brand.secondary` / `brand.accent` (D2 §1b) |
| Arabic only | AC-02: `ar` and `en` for every frame | Add `en` frames (variable modes, §2) |
| 410 × 868 frames | §3: 360 × 800 base; 320 px reflow; 200 % text | Keep 410 as exploration if wanted; acceptance frames use §3 sizes |
| Chips 35 px, button 38 px, cost tag 25 px (if tappable) | D2 §3: 44 × 44 proposed (WCAG minimum 24) | Raise to 44 px targets |
| Text-layer icons | D2 §1b, §6: vector icons with accessible names | Replace with icon components |
| Drawn status bar and camera island | D2 §1b: no device chrome as content | Remove, or move it into a device-frame annotation |
| No ST-05 label, DD tags or status layer; layers named "Wanees / …" | D2 §6; §2 and AC-08 (no brand text in layer or frame names) | Add the label and tags; rename the layers to neutral names |
| 14 px gaps | D2 §3 scale: 4, 8, 12, 16, 24, 32, 48 | Use 12 or 16 |

**Kept from the baseline as direction:**
- the hero card with a fine trim;
- medallion and progress composition;
- three shortcut tiles;
- a centred "my code" tab;
- generous 24 px margins;
- restrained ornament;
- the universal W mark for platform surfaces.

How these survive arbitrary merchant palettes is D2 §1b.

## 5. RTL and LTR behaviour in Figma (D2 §4)

- **Auto layout.** Every horizontal auto layout follows the `locale` mode direction. Frames are not mirrored by hand.
- **Icons.** Directional icons have `ar` and `en` variants. Non-directional icons, QR codes, clocks and media symbols never mirror.
- **Numbers.** Phone, amount, code and time values sit in LTR-isolated text layers. Digits are Western in both modes (FR-132). Arabic-Indic sample input is shown only on the normalization annotation.
- **Money.** Money strings follow D2 §5 exactly: `45 ج.م` / `EGP 45.50`, with no grouping.
- **Times.** Times are labelled Cairo time (FR-133).
- **Language switch.** The switch appears in CUS-11 and on the first screen. The default is always `ar` (FR-130).

## 6. Accessibility acceptance criteria (design level, PD-044; AC-10)

A frame is **AA-ready (design)** only when every row holds.

| # | Criterion | Evidence in the file |
| --- | --- | --- |
| A1 | Text and non-text colours use only D2 §1 pairs, D2 §1a derived pairs for the palette shown, or a newly computed pair recorded in 01 Foundations | Variable bindings; contrast note |
| A2 | Targets ≥ 24 × 24 CSS px (SC 2.5.8); counter actions 48 px and others 44 px (*proposed*) | Size annotation |
| A3 | Focus order annotated for `ar` and `en`; visible focus ring; focus not hidden by sticky bars (SC 2.4.3, 2.4.7, 2.4.11) | Numbered focus overlay |
| A4 | Every control has a name and role; headings marked (SC 1.3.1, 4.1.2) | Annotation layer |
| A5 | No meaning by colour alone, including progress, stage banners and result panels (SC 1.4.1) | Visual check |
| A6 | 320 px reflow and 200 % text variants for the screens listed in §3 (SC 1.4.4, 1.4.10, 1.4.12) | Variant frames |
| A7 | Errors name the field and the fix (SC 3.3.1, 3.3.3) | Error-state frames |
| A8 | OTP fields are drawn as fillable inputs that allow paste and autofill (SC 3.3.8; PD-044 item 4) | Component spec |
| A9 | PIN frames carry **DD(A11Y-01)** and make no AA claim until A11Y-01 is decided | Tag present |
| A10 | Countdowns (60 s, 120 s, 15 min) are shown as text, and announcements are annotated sparingly | Annotation |

These are design-level criteria only. **Shipped-UI conformance (SC-018) is assessed later, on implemented screens.**

## 7. Content and decision markers (AC-05–AC-07)

- **DD tags.** Every value that depends on an open item shows a DD tag with the item ID (D1 markers). Placeholders are written as `—` or "value per decision X", never as a number that looks decided.
- **GATED.** Points void, and any FP-003-dependent action, appear only as GATED "Not available".
- **Data visible to each role.** Cashier frames show only the first name and progress. Owner frames show only the first name, progress, last 3 digits and visit history (FR-006).

## 8. Measurement-prototype requirements (1.3 (b), 1.4 (b); PD-045)

- A measurement run cites the named Figma version (§1), the participant, the device and browser, and the scenario fixture. Without these, the result is not valid.
- **Tap annotations** on F-K1–F-K5 record every deliberate tap per step (journey 1.3 protocol). Results are **NOT SCORED** until F-11 (convention, reference device) and JG-11 are decided.
- **Timing markers** on F-O1 follow the journey 1.4 protocol (JG-02, approved principle; F-02 open). Each event is instrumented separately:
  1. invite link opened (OWN-01);
  2. acceptance interaction started (OWN-01);
  3. acceptance and OTP committed (OWN-01);
  4. wizard opened (OWN-04);
  5. publish committed (OWN-05);
  6. print-ready QR displayed (OWN-07);
  7. first stamp (counter flow, recorded separately).
- OWN-08 (brand colours, PD-046) lies between events 3 and 4. It adds no event; its time counts in raw SC-001 time and not in SC-002.
- **Scoring.** SC-001 runs from invite acceptance, with the exact start event and the endpoint rule DD(F-02); until then it is **NOT SCORED**. SC-002, the stamp wizard in under 3 min, is recorded separately. The setup-entry → published + printable QR diagnostic is recorded separately and never replaces SC-001.
- **Raw time.** Record raw wall-clock time, including OTP wait, resend, step-up, errors and assistance. Never subtract it to reach a passing total (journey 1.4 protocol, items 3–4).
- Staff, device and PIN setup, paper migration and first purchase stay visible but outside the proposed SC-001 core (journey 1.4 item 5).
- **Evidence class.** Every record is labelled "prototype — provisional" (PD-045 item 3). Prototype runs never stand in for device performance, camera, OTP delivery or service timing.

## 9. Carry-forward register (*proposed*, pending M-01)

| Item | Why the prototype cannot show it | Proposed later evidence (owner to confirm) |
| --- | --- | --- |
| Camera scan speed and reliability on a cheap Android phone | No real camera pipeline | No exact existing roadmap row: 4.6 checks only the PWA install. The owner names a home (`open-decisions-M01-A11Y01.md`) |
| Device rendering performance | No app code | Same as above |
| OTP delivery time (WhatsApp/SMS) | No live sending | Roadmap 2.4 (needs 0.11) |
| Award flow time on real transactions | No service latency | PD-028 / M5: median ≤ 10 s on real pilot transactions |
| Onboarding time with live OTP and services | Timing of OTP and services | **No stated real-app basis** (M-01 analysis M-F5a). The owner decides whether the PD-028 M5 onboarding gate uses the 1.4 (b) result or a pilot re-measure |
| Stamp wizard on the real app | No implemented wizard | Roadmap 3.7, SC-002 |
| Customer sees the award within 2 s | No service latency | Roadmap 3.3, SC-004 |
| Unassisted onboarding and join → earn → redeem | Real app needed | M4, SC-009 |
| Shipped-UI WCAG 2.2 AA | Design-level only | SC-018 on implemented screens |

## 10. Mapping to the 1.5 acceptance criteria

| AC | Where D3 meets it |
| --- | --- |
| AC-01 | §4 flows cover D1. D1 §6–§7 hold the traceability |
| AC-02 | §3 and §5: every frame has an `ar` and an `en` mode |
| AC-03 | §5 money; D2 §5 earn-preview rule |
| AC-04 | D1 states drawn as state variants |
| AC-05, AC-11 | §1 and §7; D2 §9 |
| AC-06, AC-07 | §7 |
| AC-08 | §2 naming rule; ST-05 label |
| AC-09 | §8 |
| AC-10 | §6 |
| AC-13 | §4b; D2 §1a |
| AC-12 | Not D3: owner approval under the final name (PD-029 A1) |

## 11. Change log

**v0.2 (2026-11-13).** No Sol review has run.
- §8 timing markers now follow journey 1.4 exactly: seven separate JG-02 events, the SC-001 endpoint DD(F-02), the separate SC-002 and diagnostic, and the raw-time rule. v0.1 had placed the stop marker on OWN-07 as if it were decided.
- §9: the onboarding real-app basis is corrected. PD-028 ties the onboarding gate to task 1.4, and only the award flow is stated as "real pilot transactions". Real-app rows were added for 3.3, 3.7 and M4.

**v0.3 (2026-11-13).** No Sol review has run.
- Inputs updated to D1 v0.3, D4 and the workspace set-up document.
- Added flow F-O1a, so OWN-02 is in a flow. A script check found it was the only D1 screen in no flow.

**v0.4 (2026-11-13).** No Sol review has run. Added §4a, the core prototype build order (iteration 1: 22 screens; 1b: 2 screens). It changes no acceptance criterion.

**v0.5 (2026-11-13).** PD-046. No Sol review has run.
- OWN-08 joins F-O1 and core flow O1. Iteration 1 now has 23 screens; 26 of 51 remain for iteration 2.
- New §4b, the merchant theming demo.
- §2: the `merchant` collection.
- A1 allows D2 §1a pairs; AC-13 is mapped.

**v0.6 (2026-11-13).** Autonomous session under owner delegation. No Sol review has run.
- New §4c: the owner's provisional visual baseline, with the evidence read, measured and unknown properties, and the reconciliation table.
- §4b: "café A/B" in the frame list now reads "merchant A/B" (PD-046 item 10).

**v0.7 (2026-11-14).** MB-01–MB-05 owner-approved. §4b and §4c cite MB-01/MB-02 as decided. No Sol review has run.

**v0.8 (2026-11-14).** U-1–U-6 and corrections A–C approved: §12 no longer lists a PD-046 DD item. No Sol review has run.

## 12. What blocks starting the frames

- The owner's Figma workspace and its record (§1; steps and the record table are in `figma-workspace-setup.md`).
- No other blocker for drawing. Open items are drawn as DD and never resolved in the file.
- PD-046 MB-01–MB-05 were owner-approved on 2026-11-14 and are drawn as decided. OWN-17 draws the "too many changes" (429) and signed-out (401) states (U-1, U-2, U-6). No PD-046 item is drawn as DD.
