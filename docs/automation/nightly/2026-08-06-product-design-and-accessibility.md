# Night Lab — Product Design & Accessibility (2026-08-06)

Mission: `product-design-and-accessibility` · Branch: `opencode/nightly-product-design-and-accessibility-study-level-radio`
Run model: `deepseek/deepseek-v4-flash` · Max risk respected: low (repo variables unreadable — 403 — so defaults assumed; contained, additive-only change)

## Scope chosen

The **Study page restudy level selector** (`app/src/renderer/companion/companion.tsx`, `Study`
component). The New / Beginner / Intermediate / Advanced / Expert buttons in the
`.level-row` are single-select level choices but expose no radio semantics — no
`role`, no `aria-checked`, no roving tabindex, and no arrow-key navigation. This
was explicitly named as the next un-audited flow by the 2026-08-05 product-design
report ("the Study page's level selector (`level-row` buttons without
`aria-pressed`)"), and it is the same defect class the 2026-08-05 run fixed on the
Quiz mode bar.

## Audit findings

1. **No radio semantics.** The `.level-row` buttons declared selection only via
   the `.on` CSS class. Screen readers announced five plain buttons with no
   selected state — a single-choice group with no `radiogroup`/`radio`/`aria-checked`.
2. **No keyboard navigation.** ArrowLeft/ArrowRight/ArrowUp/ArrowDown/Home/End
   did nothing. Keyboard users had to Tab to every button to compare levels;
   there was no roving-tabindex pattern (all buttons were tab stops).
3. **No focus management.** After a keyboard selection there was no focus move,
   and no pattern for moving between levels without re-tabbing through the whole
   row.
4. The group has no `aria-label` describing what the level buttons control.

## Changes

- `app/src/core/rovingRadio.ts` (new): pure `nextRadioIndex(current, count, key,
  isDisabled)` helper — wrap-around, Up/Down mapped to Left/Right, Home/End,
  disabled-aware, all-disabled/single/empty guards. **Content is byte-identical**
  to the `rovingRadio.ts` introduced on the (unmerged) 2026-08-05 quiz-radiogroup
  branch, so when both eventually merge the file resolves cleanly instead of
  conflicting.
- `app/src/renderer/companion/companion.tsx` (`Study`):
  - `.level-row` is now a `role="radiogroup"` with `aria-label="Restudy level"`.
  - Each level button is `role="radio"` with `aria-checked`, and a roving
    `tabIndex` (0 on the checked level, −1 elsewhere).
  - The group handles ArrowLeft/ArrowRight/ArrowUp/ArrowDown/Home/End: it selects
    the next level and moves focus onto that radio (via `levelRowRef`).
  - Uses the shared `STUDY_LEVELS` tuple so the handler and the rendered buttons
    cannot drift apart.
- `app/test/rovingRadio.test.ts` (new): regression tests for wrap-around,
  up/down mapping, Home/End, disabled skipping, all-disabled guard, and
  empty/single-radio guards. Identical to the quiz-radiogroup branch's test file.

No CSS change was needed: the existing global
`button:focus-visible { outline: 2px solid var(--accent) }` (companion.css:79)
already gives every level button a visible focus ring, and the black-and-white
design system is untouched.

## Tests run and results

- `npm run typecheck` — pass (strict, no errors)
- `npm test` — 37/37 pass (31 pre-existing + 6 new `nextRadioIndex` tests)
- `npm run build` — pass ("build ok")

## What was not verified

- Real keyboard interaction and focus movement in a live Electron window on
  macOS — **unverified on Linux runner**; covered by static review, the pure
  helper's unit tests, and the manual steps below.
- No VoiceOver/NVDA screen-reader pass was run.
- Repo variables (`NIGHT_LAB_ALLOW_CODE_CHANGES`, `NIGHT_LAB_MAX_RISK`) were
  unreachable via the Actions token (HTTP 403); defaulted to contained,
  low-risk behavior.

## Manual review steps

1. Open the companion app → Study with at least one saved lesson.
2. Focus the currently checked level radio. Press → to move to the next level, ↓
   (same direction), Home/End to jump, ← to wrap from New back to Expert.
3. Confirm focus lands on the newly selected radio and the selected level is
   used by "Explain again at this level".
4. With a screen reader, confirm the radiogroup/radio relationship and the
   checked state per level are announced.
5. Confirm the visual `.on` styling and focus ring are unchanged.

## Recommended next action

Merge after a short manual keyboard pass on a real Mac. Remaining un-audited
flow in the same class: the widget's depth picker (`widget.tsx` `.levels` /
`data-level` buttons, no roving group semantics), plus the onboarding depth
choice cards (currently plain buttons toggling via `.selected`).
