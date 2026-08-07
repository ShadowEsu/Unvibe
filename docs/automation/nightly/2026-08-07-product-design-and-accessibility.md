# Night Lab — Product Design & Accessibility (2026-08-07)

Mission: `product-design-and-accessibility` · Branch: `opencode/nightly-product-design-and-accessibility-widget-depth-radiogroup`
Run model: `deepseek/deepseek-v4-flash` · Max risk respected: low

## Scope chosen

The **widget Depth level picker** (`app/src/renderer/widget/widget.tsx` +
`widget.css`), the five-level "Depth" row in the floating explanation panel
(New / Beginner / Intermediate / Advanced / Expert). This is a contained,
single-select control with a clear keyboard/screen-reader defect that no prior
night-lab branch has touched. No open PR for this mission exists tonight; the
three currently-open PRs are from other agents (claude/codex), not the night
lab.

## Audit findings

1. **Not a radiogroup.** `.levels` is a `<div aria-label="Explanation depth">`
   wrapping five `<button>` elements. Screen readers announce a flat list of
   five ungrouped buttons with no "selected" state — the active depth is only
   conveyed by the `.on` CSS class.
2. **No arrow-key navigation.** A keyboard user tabs through all five buttons
   but cannot move between depths with ArrowLeft/ArrowRight/Home/End, and there
   is no roving tabindex (all five remain tab stops).
3. **Locked levels were invisible to keyboard users.** Expert (Pro-gated) and
   out-of-allowance depths are `disabled`, but nothing stopped focus landing on
   them; navigation did not skip them.

## Changes

- `app/src/core/levelPicker.ts` (new): pure `nextLevelIndex(current, count,
  key, isLocked)` roving-tabindex helper — wrap-around on the edges,
  Home/End, skips locked levels, guards empty/single lists and all-locked
  groups.
- `app/src/renderer/widget/widget.tsx`:
  - `.levels` is now `role="radiogroup"` with `aria-label="Explanation depth"`,
    a container ref, and an `onKeyDown` handler.
  - Each depth is `role="radio"` with `aria-checked`, a roving `tabIndex`
    (active = 0, rest = -1), and `type="button"`.
  - ArrowLeft/ArrowRight/Home/End select the next unlocked depth, update the
    active tab's level (`pick`), and move focus to the newly selected radio.
  - The Expert Pro-gate / out-of-allowance disabled behavior is unchanged.
- `app/test/levelPicker.test.ts` (new): 5 regression tests for wrap-around,
  Home/End, locked-skipping, empty/single guards, and all-locked fallback.
- `app/package-lock.json`: version string synced 0.1.1 → 0.1.2 by `npm install`
  (matches `package.json`; no dependency changes).

## Tests run and results

- `npm run typecheck` — **pass** (strict, no errors)
- `npm test` — **36/36 pass** (31 pre-existing + 5 new `nextLevelIndex` tests):
  `level index wraps forward and backward on the edges`,
  `level index jumps to Home and End`,
  `level index skips locked levels`,
  `level index guards empty and single-level lists`,
  `level index keeps current when every option is locked`
- `npm run build` — **pass** ("build ok")

## What was not verified

- Real keyboard interaction and focus movement inside a live Electron window on
  macOS — **unverified on Linux runner**; covered by the pure helper unit tests,
  typecheck, and the manual review steps below.
- No VoiceOver/NVDA screen-reader pass was run.
- The companion's existing roving-radio fixes (Quiz mode, Study restudy level)
  remain on unmerged branches (`rovingRadio.ts`); this fix intentionally used a
  distinct helper name (`levelPicker.ts`) so the three branches stay disjoint.

## PR blocker

The GitHub Actions token on this runner cannot create or approve pull requests
("GitHub Actions is not permitted to create or approve pull requests") — the
same limitation recorded on 2026-07-31, 08-01, 08-02, 08-03, 08-05, and 08-06.
The branch has been pushed to origin:
`opencode/nightly-product-design-and-accessibility-widget-depth-radiogroup`. It
needs to be opened as a PR against `main` manually, or carried forward by the
integration-review run. Full PR template content is in this report's fields
above.

## Manual review steps

1. Open the widget with a ready/done review. Tab to the active depth; it is the
   only radio in the tab order.
2. Press ←/→ to move between depths (should wrap around); Home/End jump to
   first/last. Confirm focus moves to the newly selected depth and it is
   announced as selected by the screen reader.
3. On Free plan with Expert locked, confirm ArrowRight from Advanced skips
   Expert and wraps to New; confirm Enter on Expert still opens the Pro gate.
4. Confirm Depth pill visuals (hover, active state) look unchanged.

## Recommended next action

Open the PR for the pushed branch once a token with `createPullRequest`
permission is available, then run a quick manual pass on a real Mac (widget
Depth arrow navigation + VoiceOver announcement) before merging. A future
night-lab run could extend the same radiogroup pattern to the widget Quiz
answer options if desired.
