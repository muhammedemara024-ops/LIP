# Figma workspace setup and handoff (roadmap 1.5, deliverable D3)

**Status**: **Draft v0.4, 2026-11-13. Owner action list.** v0.4: the owner named an existing Figma file as the **provisional visual baseline** (§2), pending refinement with Claude Design. It was inspected read-only on 2026-11-13; nothing in it was changed. v0.2 corrects the stale D3 version citation (v0.3 → v0.4) and names the §4a build order in §3. v0.3 adds the PD-046 `merchant` variable collection (3 modes) and the updated document versions.
- Prototype design only (PD-045 item 4). Figma is the approved tool (PD-044 item 1).
- **Not reviewed by Sol yet.**
- **No connector access is assumed.** The Figma connector was authenticated on 2026-11-13, but the file's plan allows very few connector calls (§2), so nothing here relies on it. Every step below works with manual exports.
- **No Figma price, plan limit or feature availability is assumed.** Any such value is read from Figma's own pages when the workspace is set up, and recorded in §2.

## 1. Owner set-up steps

1. **Account.** Choose the Figma account that will own the work. Record whether it is a personal or a business account.
2. **Team.** Create or choose a team, and a project inside it, with a neutral name: `LIP P0 – roadmap 1.5 prototype`.
   - The brand name stays out of team, project, file and page names (brief §4, AC-08). Brand text appears only inside frames as user-visible copy.
3. **Plan and cost.** Read the plan and its monthly cost from Figma's billing page, and record them (§2).
   - Check two things against that plan:
     - **variable modes:** the design needs **2 modes**, `ar` and `en`, in one collection (D3 §2);
     - a second collection, `merchant`, needs **3 modes**: `platform`, `cafe-a` and `cafe-b` (D3 §2, §4b, PD-046);
     - **version history**, for the named versions in D3 §1.
   - If the plan cannot do one of these, record it. The fallback is duplicate `ar` and `en` frames instead of variable modes. That fallback changes no requirement.
   - The PD-006 cost cap covers deployment services, not design tools (PD-044 item 1). Any cost is still recorded and approved by the owner.
4. **Access.**
   - Invite named people only. The link-sharing setting is "only people invited", never "anyone with the link".
   - Roles: owner = admin; designer = editor; reviewers = can view or can comment.
   - Record every person and role (§2).
5. **Fonts.** Check that IBM Plex Sans Arabic and IBM Plex Sans are available in Figma's font list.
   - If they are not, upload them from their official source with the SIL OFL 1.1 licence file.
   - The fallback is Noto Sans Arabic with Noto Sans (D2 §2).
6. **Plugins.** Install no plugin that uploads file content to a third party without owner approval.
7. **File.** Create one design file, `LIP-P0-1.5-prototype`, with the pages in D3 §2. Create no frames until §3 is complete.
8. **Data.** The file holds fictional data only (D2 §9): no real phone numbers, names, café data, credentials or merchant keys.

## 2. Workspace record (the owner fills it in; copy into D5 when done)

| Field | Value |
| --- | --- |
| Owning account (personal or business) | — |
| Team / project | — |
| Plan and monthly cost (from the billing page, with date) | Starter, as reported by the Figma connector's call-limit message (2026-11-13). Cost not read. Check variable modes on this plan (§1 step 3) |
| Variable modes available (≥ 2 for `locale`, ≥ 3 for `merchant`) | — |
| Version history available | — |
| File URL | https://www.figma.com/design/lUyDsbGl7RDbOvyk25fV5q — provisional visual baseline (owner, 2026-11-13); page `04 • Signature Premium — Mocha & Gold`. Not yet the `LIP-P0-1.5-prototype` file of §1 step 7 |
| Link-sharing setting | — |
| Access list (person: role) | — |
| Fonts: available or uploaded (with licence) | — |
| Owner approval of the above (date) | — |

## 3. What the designer (Claude or a person) needs before drawing

- The §2 record filled in and approved by the owner.
- D1 v0.4, D2 v0.3, D3 v0.5 and D4 v0.2 as the specification. Open items stay DD and are never decided in the file.
- **Build order:** D3 §4a iteration 1 first (23 screens, each in `ar` and `en`, plus the §4b merchant theming variants), then iteration 1b (CUS-09, CSH-09). Pages 00–02 (cover, D2 tokens as variables, D2 components) come before the first screen frame.
- **If Claude is to work in the file directly:** the owner authenticates the Figma connector and grants access to that file only. Without that, Claude prepares specifications and the owner or a designer draws the frames.

## 4. Handoff back into the repository (*proposed*; storage location is an owner decision)

Each review cycle hands back:

1. **The named version**, `1.5-v<major>.<minor>-<yyyy-mm-dd>` (D3 §1), and the file URL.
2. **Exports**: one PNG per frame, at 1× for review, named `<D1 ID>__<state>__<ar|en>.png`, plus a PDF of the Flows page.
   - *Proposed* location: `specs/002-p0-prd/prototype/exports/<version>/`, which is outside `apps/` and `packages/` (E4, AC-11).
   - Committing binary exports, and their size, is an owner decision. They stay untracked until then.
3. **Checklists**:
   - an AC-01–AC-12 checklist with evidence links;
   - the D3 §6 A1–A10 status per frame;
   - the D4 DD and GATED tags present per frame.
4. **The working-name check**: every frame shows the ST-05 label. Arabic text is exactly ونيس (U+0648 U+0646 U+064A U+0633), and the full form is "ونيس — Wanees".
   - Check the name **in Figma's own text layers**. A terminal without bidirectional support may draw the same characters in reverse order.
   - Wanees stays a provisional, legally uncleared working name (PD-043, PD-029 A1).
5. **The D5 review record**: the owner's dated comments or approval. Acceptance (AC-12) is not possible under the working name.

## 5. Not covered by this document

- Measurement runs (1.3 (b), 1.4 (b)): D3 §8 and D4 §3–§4. They are NOT RUN, and scoring waits for F-02 and F-11.
- M-01 and A11Y-01: `open-decisions-M01-A11Y01.md`. They are open and not decided here.
