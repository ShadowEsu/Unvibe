# Night Lab — Product Design & Accessibility (2026-08-03)

Mission: `product-design-and-accessibility` · Branch: `opencode/nightly-product-design-and-accessibility-widget-tabs`
Run model: `deepseek/deepseek-v4-flash` · Max risk respected: low

## Scope chosen

The **widget tab bar** (`app/src/renderer/widget/widget.tsx` + `widget.css`),
the floating explanation panel's multi-tab strip. This is a contained flow with
a clear, previously un-audited keyboard/screen-reader defect. No open PR and no
prior `opencode/nightly-*` branch touches the widget tabs.

## Audit findings

1. **Close "×" was a mouse-only control.** Each tab was a `<button role="tab">`
   containing a nested `<span className="tab__x" onClick=…>×</span>`. A span is
   not focusable and its `aria-label` is invisible to screen readers, so
   keyboard and assistive-technology users could not close a review tab at all.
   Nested interactive markup inside a button is also an anti-pattern.
2. **No arrow-key navigation between tabs.** The tablist used `role="tablist"` /
   `role="tab"` but tabs only switched on mouse click; no WAI-ARIA roving
   tabindex, no `ArrowLeft`/`ArrowRight`/`Home`/`End` handling.
3. **No focus recovery after closing a tab.** Closing a tab left focus wherever
   the click happened; a keyboard user closing the active tab would be left with
   no sensible focus target.

## Changes

- `app/src/core/tabs.ts` (new): pure `nextTabIndex(current, count, key)`
  roving-tabindex helper (wrap-around on the edges, Home/End, single-tab and
  empty-list guards).
- `app/src/renderer/widget/widget.tsx`:
  - Each tab is now a `role="presentation"` wrapper containing two real buttons:
    a tab select button (`role="tab"`, roving `tabIndex`, `id` for focus
    targeting) and a dedicated close button (`aria-label="Close <label>"`).
  - `onTabsKeyDown` on the tablist implements ArrowLeft/ArrowRight/Home/End.
  - After a close, focus is restored to the newly active tab.
- `app/src/renderer/widget/widget.css`: `.tab` split into wrapper pill,
  `.tab__select`, and real `.tab__x` button styling; focus-visible styles for
  the close button; new controls covered under `prefers-reduced-motion`.
- `app/test/tabs.test.ts` (new): regression tests for wrap-around, Home/End,
  single-tab, empty-list behavior of `nextTabIndex`.
- `app/package-lock.json`: version string synced 0.1.1 → 0.1.2 by `npm install`
  (matches `package.json`; no dependency changes).

## Tests run and results

- `npm run typecheck` — pass (strict, no errors)
- `npm test` — 37/37 pass (31 pre-existing + 6 new `nextTabIndex` tests)
- `npm run build` — pass ("build ok")

## What was not verified

- Visual layout and real keyboard interaction in a live Electron window on
  macOS — **unverified on Linux runner**; covered by static render, unit tests,
  and the manual review steps below.
- No VoiceOver/NVDA screen-reader pass was run.

## PR blocker

The GitHub Actions token on this runner cannot create or approve pull requests
("GitHub Actions is not permitted to create or approve pull requests"). The
branch has been pushed to origin:
`opencode/nightly-product-design-and-accessibility-widget-tabs`. It needs to be
opened as a PR against `main` manually (mission, why, evidence, root cause,
changes, files, tests run + results, what was not verified, risk, security /
privacy impact, performance impact, manual review steps, rollback plan,
recommended next action) — or left for the integration-review run to carry
forward.

## Manual review steps

1. Open the widget with 2+ tabs. Tab to the active tab, use ←/→ to move between
   tabs, Home/End to jump to first/last.
2. Tab past a tab select to reach its close "×", press Enter/Space to close it,
   confirm focus lands on the newly active tab.
3. With "Reduce motion" enabled, confirm no tab transition animation plays.
4. Confirm tab pill visuals (hover, active state) look unchanged.

## Recommended next action

Open the PR for the pushed branch once a token with `createPullRequest`
permission is available, then run a quick manual pass on a real Mac (widget tab
keyboard nav) before merging. A future night-lab run could extend the same
roving-tabindex pattern to the companion History filters.
