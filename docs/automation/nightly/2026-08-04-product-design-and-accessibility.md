# Night Lab — Product Design & Accessibility (2026-08-04)

Mission: `product-design-and-accessibility` · Branch: `opencode/nightly-product-design-and-accessibility-history-filter-tabs`
Run model: `deepseek/deepseek-v4-flash` · Max risk respected: low

## Scope chosen

The **History page filter** (`app/src/renderer/companion/companion.tsx`, `History`
component). The All / Understood / Revisit switch declares a WAI-ARIA tabs
pattern (`role="tablist"` + `role="tab"` + `aria-selected`) but implements none
of the keyboard behavior the role promises. It is a core companion page, was
not touched by any prior `opencode/nightly-product-design-*` branch, and no open
PR covers it.

## Audit findings

1. **No roving tabindex.** Every tab was tab-stoppable and none was excluded, so
   Tab traversal did not match the tabs pattern (one stop in, arrows to move).
2. **No arrow-key navigation.** ArrowLeft/ArrowRight/Home/End did nothing —
   keyboard users could only switch filters by tabbing to and pressing each
   button. This is the core interaction the `tab` role advertises.
3. **No `aria-controls` / `tabpanel` linkage.** The buttons announced as tabs
   did not point at the results region, and the results region had no
   `role="tabpanel"` or `aria-labelledby`, so assistive tech could not connect
   tab → panel.
4. **Focus after keyboard selection** was left wherever it was; there was no
   focus move onto the newly selected tab.

## Changes

- `app/src/core/rovingTabs.ts` (new): pure `nextRovingIndex(current, count,
  key)` helper — wraps around on the edges, handles Home/End, guards empty and
  single-tab lists. Kept in `core/` so it is unit-testable without a DOM.
- `app/src/renderer/companion/companion.tsx`:
  - Tab buttons now carry `id`, `aria-controls="history-results"`, and a
    roving `tabIndex` (0 on the active tab, −1 elsewhere).
  - The tablist handles ArrowLeft/ArrowRight/Home/End: it selects the next
    filter and moves focus onto that tab (via `tabsRef`).
  - The results region (`learn-shell`) is now `role="tabpanel"` with
    `aria-labelledby` pointing at the active tab.
- `app/test/rovingTabs.test.ts` (new): regression tests for wrap-around,
  Home/End, and empty/single-tab guards.
- `app/package-lock.json`: version string synced 0.1.1 → 0.1.2 by `npm install`
  (matches `package.json`; no dependency changes).

## Tests run and results

- `npm run typecheck` — pass (strict, no errors)
- `npm test` — 34/34 pass (31 pre-existing + 3 new `nextRovingIndex` tests)
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
`opencode/nightly-product-design-and-accessibility-history-filter-tabs`. Open a
PR against `main` manually, or leave it for the integration-review run to carry
forward.

## Manual review steps

1. Open the companion app → History with 2+ saved lessons.
2. Focus the All tab. Press → to move to Understood, Home/End to jump, ← to
   wrap from All to Revisit.
3. Confirm focus lands on the newly selected tab and the filter count updates.
4. With a screen reader, confirm the tablist/tabpanel relationship is announced
   (selected state + labelled panel).
5. Confirm the visual pill styles (hover, active `.on`) are unchanged.

## Recommended next action

Merge this branch to `main` after a short manual keyboard pass on a real Mac.
Closely-related, un-audited flows worth a future run: the Quiz page's mode bar
(`role="radiogroup"` with no arrow-key handling) and the Study page's level
selector (`level-row` buttons without `aria-pressed`).
