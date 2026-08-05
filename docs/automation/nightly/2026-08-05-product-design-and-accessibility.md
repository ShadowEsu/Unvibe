# Night Lab — Product Design & Accessibility (2026-08-05)

Mission: `product-design-and-accessibility` · Branch: `opencode/nightly-product-design-and-accessibility-quiz-radiogroup-keyboard`
Run model: `deepseek/deepseek-v4-flash` · Max risk respected: low

## Scope chosen

The **Quiz page mode bar** (`app/src/renderer/companion/companion.tsx`, `Quiz`
component). The Quick check / Recall / Scenario switch declares a WAI-ARIA
radio pattern (`role="radiogroup"` + `role="radio"` + `aria-checked`) but
implements none of the keyboard behavior the radio role promises. It is a core
companion page, was not touched by any prior `opencode/nightly-product-design-*`
branch (verified against all 17 product-design branches and all nightly
branches), and was explicitly called out as the next un-audited flow by the
2026-08-04 product-design report.

## Audit findings

1. **No roving tabindex.** All three radios were tab-stoppable; Tab traversal
   did not match the radio pattern (one stop in, arrows to move).
2. **No arrow-key navigation.** ArrowLeft/ArrowRight/ArrowUp/ArrowDown/Home/End
   did nothing — keyboard users could only switch modes by tabbing to and
   pressing each button. This is the core interaction the `radio` role
   advertises.
3. **No disabled-aware navigation.** The group disables all radios during a
   quiz build (`busy`), and the pattern has no handling for that state.
4. **Focus after keyboard selection** was left wherever it was; there was no
   focus move onto the newly selected radio.

## Changes

- `app/src/core/rovingRadio.ts` (new): pure `nextRadioIndex(current, count,
  key, isDisabled)` helper — wraps around on the edges, treats ArrowUp as
  ArrowLeft and ArrowDown as ArrowRight, handles Home/End, skips disabled
  radios, keeps the current index when every radio is disabled, and guards
  empty/single-radio groups. Kept in `core/` so it is unit-testable without a
  DOM. (Mirrors the `rovingTabs.ts` helper added for the History filter.)
- `app/src/renderer/companion/companion.tsx`:
  - The mode bar (radiogroup) now handles ArrowLeft/ArrowRight/ArrowUp/
    ArrowDown/Home/End: it selects the next mode and moves focus onto that
    radio (via `modeBarRef`).
  - Radio buttons now carry a roving `tabIndex` (0 on the checked radio, −1
    elsewhere).
  - The three mode entries are now driven by a shared `MODES` tuple so the
    keyboard handler and the rendered buttons cannot drift apart.
- `app/test/rovingRadio.test.ts` (new): regression tests for wrap-around,
  up/down mapping, Home/End, disabled skipping, all-disabled guard, and
  empty/single-radio guards.

## Tests run and results

- `npm run typecheck` — pass (strict, no errors)
- `npm test` — 37/37 pass (31 pre-existing + 6 new `nextRadioIndex` tests)
- `npm run build` — pass ("build ok")

## What was not verified

- Real keyboard interaction and focus movement in a live Electron window on
  macOS — **unverified on Linux runner**; covered by static review, the pure
  helper's unit tests, and the manual steps below.
- No VoiceOver/NVDA screen-reader pass was run.

## PR blocker

The GitHub Actions token on this runner cannot create or approve pull requests
("GitHub Actions is not permitted to create or approve pull requests"). The
branch is pushed to origin:
`opencode/nightly-product-design-and-accessibility-quiz-radiogroup-keyboard`.
Open a PR against `main` manually, or leave it for the integration-review run to
carry forward.

## Manual review steps

1. Open the companion app → Quiz with at least one saved lesson.
2. Focus the Quick check radio. Press → to move to Recall, ↓ to move down,
   Home/End to jump, ← to wrap from Quick check back to Scenario.
3. Confirm focus lands on the newly selected radio and the mode label under the
   "Quiz this lesson" flow updates.
4. Start a quiz (radios disable while building) and confirm arrow keys no-op
   rather than switching mode mid-build.
5. With a screen reader, confirm the radiogroup/radio relationship is announced
   (checked state per radio).
6. Confirm the visual underline styles (hover, active `.on`) are unchanged.

## Recommended next action

Merge this branch to `main` after a short manual keyboard pass on a real Mac.
Closely-related, un-audited flows worth a future run: the Study page's level
selector (`level-row` buttons without `aria-pressed`) and the widget's level
picker (`LEVELS` buttons with `data-level` but no roving group semantics).
