# D2 — Arabic RTL design system (roadmap 1.5)

**Status**: **Draft v0.6, 2026-11-14. Prototype design only** (PD-045 item 4). It is not accepted.
- Every token value below is **proposed** for owner review.
- **Except** the default brand palette, which the owner set on 2026-11-13 (PD-046). The derivation rule in §1a is proposed.
- It adds no product rule. Its display rules restate approved decisions with citations.
- Brand text appears in no token name (brief §4, AC-08). The product name is supplied as `brand.name.ar` and `brand.name.en`. That mechanism is still Proposed (PD-043 item 3).
- Accessibility target: WCAG 2.2 Level AA (PD-044). Figma evidence here is design-level only (SC-018 covers shipped screens).

## 1. Colour tokens (proposed) and computed contrast

**How the ratios were computed.** WCAG 2.x relative luminance:
- each sRGB channel `c` is linearised as `c/12.92` when `c ≤ 0.03928`, otherwise `((c+0.055)/1.055)^2.4`;
- `L = 0.2126 R + 0.7152 G + 0.0722 B`;
- ratio = `(L1+0.05)/(L2+0.05)`.

The ratios were computed by script on 2026-11-13, not estimated.

**Thresholds** (WCAG 2.2):
- 4.5 : 1 for normal text (SC 1.4.3);
- 3 : 1 for large text, and for UI components and graphics (SC 1.4.11).

| Token | Value | Use |
| --- | --- | --- |
| `color.bg` | `#FFFFFF` | Page background |
| `color.surface` | `#F6F4EF` | Cards and panels |
| `color.text` | `#1F1B16` | Body text |
| `color.text-muted` | `#5C554C` | Secondary text |
| `brand.primary` | `#3A2419` Mocha Brown (default, PD-046) | Headers, primary actions, card face; about 70 % of the brand-coloured area |
| `brand.on-primary` | `#FFFFFF` (derived, §1a) | Text and icons on primary |
| `brand.secondary` | `#E8C88A` Champagne Gold (default, PD-046) | Card panels, chips, secondary fills; about 25 % |
| `brand.on-secondary` | `#1F1B16` (derived) | Text and icons on secondary |
| `brand.secondary-strong` | `#7D6C4B` (derived) | Secondary used as text or a required graphic on light surfaces |
| `brand.accent` | `#F59E0B` Burnt Amber (default, PD-046) | Reward highlight and badges; about 5 %; never the only signal |
| `brand.on-accent` | `#1F1B16` (derived) | Text and icons on accent |
| `brand.accent-strong` | `#9A6407` (derived) | Accent used as text or an icon on light surfaces |
| `color.danger` | `#B42318` | Errors, refusals |
| `color.warning-bg` / `color.warning-text` | `#FEF3C7` / `#7A4A00` | Stage banners, decision-dependent notes |
| `color.success` | `#127A3E` | Confirmed results |
| `color.info` / `color.focus` | `#1D4ED8` | Links, focus ring |
| `color.border` | `#8A8277` | Input borders, separators |

| Pair | Ratio | Requirement | Result |
| --- | --- | --- | --- |
| text / bg | 17.12 | 4.5 | pass |
| text / surface | 15.58 | 4.5 | pass |
| text-muted / bg | 7.35 | 4.5 | pass |
| text-muted / surface | 6.68 | 4.5 | pass |
| on-primary / primary | 14.52 | 4.5 | pass |
| primary / bg (text link, progress) | 14.52 | 4.5 | pass |
| primary / surface | 13.21 | 4.5 | pass |
| on-secondary / secondary | 10.65 | 4.5 | pass |
| secondary / bg (raw) | 1.61 | — | never used as text or a required graphic |
| secondary-strong / bg, surface | 5.10, 4.64 | 4.5 | pass |
| on-accent / accent | 7.97 | 4.5 | pass |
| accent / bg (raw) | 2.15 | — | never used as text or a required graphic |
| accent-strong / bg, surface | 5.00, 4.55 | 4.5 | pass |
| danger / bg | 6.57 | 4.5 | pass |
| warning-text / warning-bg | 6.72 | 4.5 | pass |
| success / bg | 5.41 | 4.5 | pass |
| info / bg | 6.70 | 4.5 | pass |
| border / bg (input boundary) | 3.79 | 3 | pass |
| border / surface | 3.45 | 3 | pass |
| focus / bg | 6.70 | 3 | pass |
| focus / surface | 6.10 | 3 | pass |

These checks do not cover:
- colours inside imported images or QR artwork;
- merchant palettes, which use the §1a derivation and are checked per palette;
- the default palette's tie to the final name (PD-029 A1). A name change does not change these values unless the owner decides so.

Every new pair is computed the same way before it is used.

## 1a. Merchant palettes (PD-046): derivation rule (*proposed*) and demo palettes

Each merchant supplies three colours (FR-135–FR-137). A merchant colour is never used in a pair that has not been derived and checked. The rule is *proposed*; implementation pins it with test vectors (task T080).

1. `brand.<role>` is the merchant colour, used as a fill.
2. `brand.on-<role>` is `#FFFFFF` or `color.text` (`#1F1B16`), whichever contrasts more. If that is below 4.5 : 1, it is `#FFFFFF` or `#000000`, whichever contrasts more. A sweep of sampled sRGB colours (step 5 per channel) found a worst case of 4.50 : 1.
3. `brand.<role>-strong` is the merchant colour darkened toward black in 1 % steps (each channel × (1 − t)) until it reaches 4.5 : 1 on both `color.bg` and `color.surface`. It is unchanged when it already does. It is used for text, icons, progress fill and other required graphics on light surfaces.
4. **Never themed:** `color.text`, `color.text-muted`, `color.bg`, `color.surface`, `color.border`, `color.danger`, `color.success`, `color.warning-*`, `color.info` / `color.focus`, and QR modules (black on white). Themes change the brand roles only.
5. **Proportions:** about 70 / 25 / 5 of the brand-coloured area, not of the whole screen. This is guidance only (FR-139).

**Demo palettes.** These are fictional merchants for the D3 §4b demo (test data only; PD-046 applies to any business category), named "مقهى تجريبي أ / Demo Café A" and "مقهى تجريبي ب / Demo Café B". Values were computed by script on 2026-11-13 and cross-checked with the 0.04045 constant.

| Palette | Role | Colour | on-colour (ratio) | Colour on bg / surface | strong (bg / surface) |
| --- | --- | --- | --- | --- | --- |
| Default | primary | `#3A2419` | `#FFFFFF` (14.52) | 14.52 / 13.21 | = colour |
| Default | secondary | `#E8C88A` | `#1F1B16` (10.65) | 1.61 / 1.46 | `#7D6C4B` (5.10 / 4.64) |
| Default | accent | `#F59E0B` | `#1F1B16` (7.97) | 2.15 / 1.95 | `#9A6407` (5.00 / 4.55) |
| Demo Café A | primary | `#0F4C5C` | `#FFFFFF` (9.51) | 9.51 / 8.65 | = colour |
| Demo Café A | secondary | `#F1E3C8` | `#1F1B16` (13.50) | 1.27 / 1.15 | `#766F62` (4.98 / 4.53) |
| Demo Café A | accent | `#E36414` | `#1F1B16` (4.97) | 3.44 / 3.13 | `#B85110` (4.97 / 4.52) |
| Demo Café B | primary | `#F4A6B8` | `#1F1B16` (8.96) | 1.91 / 1.74 | `#90626D` (5.06 / 4.60) |
| Demo Café B | secondary | `#2E3A59` | `#FFFFFF` (11.26) | 11.26 / 10.24 | = colour |
| Demo Café B | accent | `#7CB518` | `#1F1B16` (6.91) | 2.48 / 2.25 | `#547B10` (4.98 / 4.53) |

Demo Café B is deliberately hard: its light primary needs the derived dark text and the darkened `primary-strong`. The demo therefore proves the rule, not a palette that would pass anyway.

## 1b. Premium identity under merchant themes (*proposed*, v0.4)

The owner named the Figma "Signature Premium" page as a provisional visual direction (D3 §4c). This section states how that direction survives any merchant palette. It changes no approved requirement and no §1 or §1a value.

**Two identity layers.** Placement follows MB-02 (owner-approved 2026-11-14, PD-046). The screen lists below are the classification owner-approved on 2026-11-14 (U-5). CUS-01 is merchant-themed only after successful server-side Branch QR validation. CUS-09 and CUS-10 restore the merchant identity after a reload from a server-resolved context (correction A, U-4). Without a valid context, the platform theme is shown, never a previous merchant's.

| Layer | What it is | Where it appears |
| --- | --- | --- |
| Platform | The universal W mark, the wordmark (working name, ST-05), the default palette | Platform screens: CUS-02, CUS-03, CUS-05 page, CUS-11–CUS-18; the counter and the dashboard (MB-01) |
| Merchant | The merchant's display name as text, and its palette | Merchant-context screens: CUS-01, CUS-04, CUS-06–CUS-10; each CUS-05 tile |
| Both | A small "on Wanees" platform mark on merchant screens | Merchant-context screen footers or headers; never larger than the merchant name |

- No merchant logo in P0 (MB-05, owner-approved 2026-11-14): the merchant name is shown as text. The name slot is sized and placed so that a logo could occupy it in a later phase without a layout change. This is a layout rule only: P0 adds no logo field, upload, image storage or image processing.
- The working name is provisional and legally uncleared (PD-043, PD-029 A1). The W mark is one replaceable component.

**The fixed premium frame.** These never change with a merchant palette:
- typography (§2), the spacing scale (§3), corner radii, elevation and shadow, motion, the icon set, and layout;
- the never-themed colours (§1a item 4).

The premium look comes from this frame plus the role mapping below, so it holds for any business category.

**Role mapping (about 70 / 25 / 5 of the brand-coloured area).**

| Role | Used for | Text on it |
| --- | --- | --- |
| `brand.primary` (≈ 70 %) | Hero card face, header band, active tab, primary button | `brand.on-primary` |
| `brand.secondary` (≈ 25 %) | Trims, medallions, selected chip, panels, progress track accents | `brand.on-secondary` |
| `brand.accent` (≈ 5 %) | One focal element per screen: a badge, a sparkle or the main call-to-action marker | `brand.on-accent`; never body text |

**Brand colour as text on another brand colour** (for example gold numerals on the mocha hero). Allowed only when the computed pair reaches 4.5 : 1, or 3 : 1 for large text (≥ 24 px, or ≥ 18.66 px bold) and for non-text graphics (SC 1.4.3, 1.4.11). Otherwise use `brand.on-<role>`. Computed 2026-11-13:

| Palette | secondary on primary | accent on primary |
| --- | --- | --- |
| Default | 9.03 (allowed) | 6.76 (allowed) |
| Demo Café A | 7.50 (allowed) | 2.76 (not allowed; use `brand.on-primary`) |
| Demo Café B | 5.89 (allowed) | 1.30 (not allowed; use `brand.on-primary`) |

So "gold on mocha" is a property of the default palette, not of the design. The rule must be computed per palette, never assumed.

**Decorative effects** (halos, pinstripes, gold trims, bevels):
- built only from `brand.secondary` and `brand.accent` with opacity, so a teal or pink merchant gets the same effect in its own hue;
- purely decorative: they carry no text or meaning, are hidden from assistive technology, and never sit under text;
- outside the QR quiet zone;
- removable with no loss of information.

**Category neutrality** (PD-046 item 10):
- icons, illustrations and sample copy fit any business (gift, star, check, card), never a category object such as a coffee cup;
- copy says "visit" and "purchase", never "cup" or "order of coffee";
- sample rewards are stamp or points rewards only. No tiers, levels or discount rewards (FR-049, PD-012).

**QR codes** (CUS-07 member code, CUS-08 reward code):
- black modules on white, never themed (§1a item 4);
- a quiet zone of **at least 4 modules** on every side;
- **no logo or mark over the code in P0**. Codes are scanned by a cheap Android counter phone (roadmap 1.3), so no scan margin is spent on decoration;
- any glow or frame sits outside the quiet zone.

**Icons.** Vector components with an accessible name (or hidden when decorative). No emoji or text-glyph icons: they render differently across Android fonts, and screen readers read their character names.

**Device chrome.** Frames do not draw a status bar, camera island or home indicator as content. Safe areas are annotations only.

## 2. Typography (proposed)

- **Arabic:** IBM Plex Sans Arabic. **Latin:** IBM Plex Sans. One family keeps Arabic and Latin metrics consistent.
  - Both are published under the SIL Open Font License 1.1.
  - The licence file is checked when the fonts are imported into the workspace.
  - Alternative: Noto Sans Arabic with Noto Sans (also OFL).
- **Scale (CSS px):** 14 caption, 16 body (minimum for body), 18 body-large, 20 title, 24 heading, 32 display (amounts, progress).
- **Line height:** 1.6 for Arabic body text, 1.5 for Latin.
- **Text spacing:** text must stay readable when users override line height (1.5×), paragraph spacing (2×), letter spacing (0.12×) and word spacing (0.16×) (SC 1.4.12). So there are no fixed-height text boxes.
- **Resize:** usable at 200 % text size and at a 320 CSS px viewport width without two-dimensional scrolling (SC 1.4.4, 1.4.10).

## 3. Spacing, size and shape (proposed)

- Spacing scale: 4, 8, 12, 16, 24, 32, 48.
- **Target size.** The WCAG 2.2 AA minimum is 24 × 24 CSS px, or the spacing exception (SC 2.5.8). **Proposed design size:** 48 × 48 for counter actions and 44 × 44 elsewhere. Counter targets are larger because the 1.3 cashier flow runs on a cheap Android phone.
- Radii 8 (inputs, buttons) and 16 (cards). Elevation uses borders and surfaces, not shadow alone.

## 4. RTL and locale rules (restating approved decisions)

| Rule | Source |
| --- | --- |
| Arabic RTL is the default whatever the device language; English LTR is second; the choice is remembered | FR-130, PD-007 |
| Layout mirrors in RTL. Directional icons (back, next) mirror. Media controls, clocks, check marks, QR codes and numbers do not | proposed convention |
| Digits always display as Western digits (0–9). Arabic-Indic and Persian input digits are normalized | FR-132, PD-007 |
| Phone, amount and code fields are LTR-isolated inside RTL text (`dir="ltr"` / bidi isolation) so the digit order never flips | proposed convention, supports FR-132 |
| Café content (program, reward, branch names) shows in the viewer's language, with fallback to the café's main language | FR-131 |
| Times and dates display in `Africa/Cairo`, never a fixed offset | FR-133, PD-007 |

## 5. Amount and number display

- Amounts are integer piasters in data (FR-132). Display follows PD-007 as refined by PD-039 item 3:
  - Arabic: `45 ج.م` and `45.50 ج.م`. English: `EGP 45` and `EGP 45.50`.
  - Zero piasters are hidden. Two decimals show only when piasters are non-zero.
  - **No thousands grouping**: `1250 ج.م` and `EGP 1250`. Any later grouping is a separate display decision made with the prototype.
- Amount input (PD-039 item 2): digits only, optionally followed by `.` or `٫` and one or two digits, after Arabic-Indic and Persian digits are normalized. Signs, separators, spaces, `45.` and `.5` are rejected with an error, never guessed.
- An earn preview always shows the value returned by the engine (PD-008, PD-039). The prototype never computes one. In fictional frames the value is labelled "engine value (sample)".
- Points and stamp counts are whole numbers.

## 6. Core components and required states

Every component has default, focus-visible, pressed, disabled and error states. Each has an accessible name, and colour is never the only signal (SC 1.4.1).

| Component | Notes | Used on (D1) |
| --- | --- | --- |
| Button (primary, secondary, danger) | 48 px on the counter | all |
| Phone field | Egyptian prefix hint; LTR-isolated; normalization; error text linked to the field | CUS-02, OWN-02 |
| One-time-code field | **Paste and autofill allowed** (`autocomplete="one-time-code"`); no blocking of paste (PD-044 item 4); resend timer announced politely | CUS-03, CUS-14, CUS-16, OWN-01, CSH-13 |
| PIN pad | Length, lockout and SC 3.3.8 handling are **DD(OD-01, A11Y-01)**; frames carry the marker. An on-screen keypad on its own cannot be filled by a password manager or paste. See `open-decisions-M01-A11Y01.md` for the options | CSH-03 |
| Amount field | Numeric keypad; LTR-isolated; retype pattern above the threshold | CSH-06 |
| Code display (member and reward) | 60 s timer shown as text plus a visual cue; an expiry state; black-on-white QR with a quiet zone of at least 4 modules and no overlaid mark (§1b); no static identifier presented as the code | CUS-07, CUS-08 |
| Countdown (claim 15 min, hold 120 s) | Text value, not colour alone; announced at key moments, not every second | CUS-09, CSH-10 |
| Progress (stamps or points) | Numeric text plus a visual; never colour-only | CUS-06, CSH-05 |
| Stage banner | grace, read-only or suspended; disabled actions explain why | ST-02 |
| Decision-dependent tag | "يتوقف على قرار / Decision-dependent: <ID>" | D4 annotations |
| Gated tag | "غير متاح / Not available" (FP-003) | CSH-11, OWN-13 |
| Working-name label | ST-05 text | every screen |
| Result panel (confirmed, confirming, unconfirmed, refused) | Icon plus text plus colour; refusal reason in plain language | CSH-08, CSH-10 |
| Table and list with branch filter | Header semantics; filter state announced | OWN-10, OWN-13 |
| Merchant-themed card | Card face `brand.primary` with `brand.on-primary` text; panels `brand.secondary`; reward badge `brand.accent` with a text label; progress fill `brand.primary-strong` on `color.surface` with numeric text | CUS-05 tiles, CUS-06, CUS-08, OWN-08 preview |
| Icon | Vector component; accessible name, or hidden when decorative; no emoji or text-glyph icons (§1b) | all |
| Filter chip | Target ≥ 44 × 44 px (§3); selected state shown by text or shape as well as colour | CUS-08 |
| Colour picker | Three labelled `#RRGGBB` text fields with error text, plus swatches; live preview; no free CSS (FR-137) | OWN-08, OWN-17 |

## 7. WCAG 2.2 AA design checklist per frame (D4 annotation)

| SC | What each frame records |
| --- | --- |
| 1.3.1, 4.1.2 | Names, roles and headings annotated |
| 1.3.2, 2.4.3 | Reading and focus order, RTL and LTR |
| 1.4.1, 1.4.3, 1.4.11 | Only token pairs from §1, §1a derived pairs for the palette shown, or a newly computed pair |
| 1.4.4, 1.4.10, 1.4.12 | 320 CSS px reflow on every surface (customer, counter and owner). Only content that needs a two-dimensional layout, such as data tables, is exempt (SC 1.4.10). No fixed text heights |
| 2.4.7, 2.4.11 | Focus ring `color.focus`, 2 px, not hidden by sticky elements |
| 2.5.7 | Every drag has a single-pointer alternative (none planned) |
| 2.5.8 | Targets ≥ 24 px; proposed sizes per §3 |
| 3.3.1, 3.3.3 | Error text names the field and how to fix it |
| 3.3.7 | Redundant entry: the first name is not asked again (FR-019); the large-amount retype (FR-025) is treated as covered by the SC 3.3.7 "essential or security" exception (*proposed reading*, to be confirmed at review) |
| 3.3.8 | One-time-code fields allow paste and autofill. **PIN: DD(A11Y-01)** |

## 8. Change log

**v0.2 (2026-11-13).** No Sol review has run on v0.1 or v0.2.
- §5 restates the PD-007 money format and the PD-039 input grammar and no-grouping rule. v0.1 deferred them without stating them, and missed PD-039 item 3.
- §7 reflow applies to every surface, not only customer screens (SC 1.4.10 applies to all content).
- §6 PIN pad: added the paste and autofill limitation of a keypad-only design.
- §1 ratios were recomputed independently on 2026-11-13 with no differences. The evidence is in `specs/002-p0-prd/evidence/entry-1.5-apply-20261113/handoff.md`.

**v0.3 (2026-11-13).** PD-046 (merchant branding). No Sol review has run.
- §1: the `color.primary` and `color.accent` proposals (`#0B6E4F`, `#B45309`) are replaced by the owner-set default palette as `brand.*` role tokens. The pairs were recomputed.
- New §1a: the proposed derivation rule and the demo palettes.
- §6: the themed card and the colour picker.
- §7: derived pairs are allowed.

**v0.4 (2026-11-13).** Autonomous session under owner delegation. No Sol review has run.
- New §1b: the platform and merchant identity layers (MB-02, pending owner confirmation), the fixed premium frame, the 70/25/5 role mapping, the rule for brand-on-brand text with computed ratios, decorative effects, category neutrality, QR, icon and device-chrome rules.
- §6: the code display now requires a quiet zone of at least 4 modules and no overlaid mark; new icon and filter-chip rows.
- No §1 or §1a value changed.

**v0.5 (2026-11-14).** MB-01–MB-05 owner-approved. No Sol review has run.
- §1b: MB-02 is no longer decision-dependent. MB-05 adds a layout rule: the name slot can take a future logo without a layout change. No value changed.

**v0.6 (2026-11-14).** U-5 and corrections A and C approved: §1b records the approved classification and the fallback rule. No value changed. No Sol review has run.

## 9. Fictional sample data rules (AC-05, AC-11)

- Names are fictional Arabic first names only, for example "سلمى" and "عمر".
- Phone numbers appear only as last 3 digits, for example "•••• 427".
- No real café, branch, merchant key, credential or customer record appears.
- Sample amounts and earn values are labelled as samples.
