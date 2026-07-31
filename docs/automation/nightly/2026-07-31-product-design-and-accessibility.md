# Night Lab — Product Design & Accessibility (2026-07-31)

Mission: `product-design-and-accessibility` · Branch: `opencode/nightly-product-design-and-accessibility-reduced-motion-rotation`
Run model: `deepseek/deepseek-v4-flash` · Max risk respected: low

## Scope chosen

Two contained flows that had not been audited by previous night-lab a11y PRs
(sidebar, settings modal, Plan page, onboarding headings, `.sr-only` utility,
companion landmarks):

1. **Floating bar (bar.tsx)** — the compact "Island" stat.
2. **Widget quiz flow (widget.tsx)** — the "Test me" comprehension loop.

## Audit findings

### 1. Bar stat rotation ignores `prefers-reduced-motion`
`bar.tsx` rotates the compact stat (streak → lines → understood) on a
3-second `setInterval` whenever `rotateIslandStats` is enabled. The existing
CSS already disables the swap animation under `prefers-reduced-motion: reduce`,
but the JS interval kept rotating the *content* every 3 s regardless. This
violates WCAG 2.2.2 (auto-updating content must be pausable) and is
disorienting for vestibular-sensitive users. There was no programmatic escape
under reduced motion — only the separate visual setting.

### 2. Widget quiz selection and result are visual-only
In the quiz options, the currently-selected answer was communicated only by
the `.opt.sel` border color; no ARIA state exposed the selection to a screen
reader. After grading, the verdict ("Correct — …" / "Not quite — …") rendered
as static text with no live-region role, so the outcome was not announced.

## Changes

- `app/src/renderer/bar/bar.tsx`
  - Track `prefers-reduced-motion: reduce` via a `matchMedia` listener.
  - Pause the 3-second stat rotation (and pin the stat to streak) when reduced
    motion is active. The explicit "Rotate learning stats" setting still works
    for users who prefer it; reduced motion now overrides auto-rotation.
- `app/src/renderer/widget/widget.tsx`
  - `aria-pressed={...}` on quiz answer buttons while in the `answering`
    phase, so screen readers announce the selected option.
  - `role="status"` on the graded verdict so the result is announced on change.

No CSS changes, no visual changes, no redesign. The bar's existing
`@media (prefers-reduced-motion: reduce)` block already covered the CSS side.

## Evidence

- `npm run typecheck` (app): clean.
- `npm run build` (app, esbuild main+preload+renderers): `build ok`.
- `npm test` (app): **31/31 pass, 0 fail, 0 skipped** (existing suites; no DOM
  test harness exists for renderer JSX, so no new renderer test was added).
- Full renderer build compiles both edited files.

## What was not verified

- macOS window behavior is **unverified on Linux runner**. No macOS-specific
  APIs are touched by this change; `matchMedia` and `aria-*` are
  Chromium/React-standard. Visual behavior of the paused rotation was not
  observed on a real Mac.
- Screen-reader announcement behavior (VoiceOver / NVDA) not exercised on a
  real assistive device.

## Risk, security, privacy, performance

- **Risk level: low.** Two renderer-only, additive accessibility attributes
  plus one guarded interval. No IPC, no store, no network, no behavior change
  for users who do not enable reduced motion.
- **Security/privacy:** none. No data flow changed; no secrets touched.
- **Performance:** one `matchMedia` listener added; interval now cleared when
  reduced motion is active (strictly fewer timer ticks).

## Manual review steps

1. Run Unvibe, enable the attached bar. Watch the compact stat rotate.
2. Turn on macOS "Reduce motion" (System Settings → Accessibility → Display)
   or set `prefers-reduced-motion: reduce` in DevTools emulation.
3. Confirm the stat stops rotating and is pinned to the streak value.
4. Open the widget, run a review, choose "Test me"; confirm the chosen answer
   is announced by the screen reader and the verdict is read on change.

## Rollback plan

Revert the single commit `7ffd764` on this branch; no migration or data
involved.

## Recommended next action

Open the PR for `opencode/nightly-product-design-and-accessibility-reduced-motion-rotation`
when a token with `createPullRequest` permission is available; the fixes are
safe to merge after one reviewer confirms the reduced-motion behavior on macOS.

## PR blocker

The GitHub Actions token on this runner cannot create or approve pull requests
("GitHub Actions is not permitted to create or approve pull requests"). The
branch has been pushed to origin and the PR description is written out above;
it needs to be opened manually with the PR template (mission, why, evidence,
root cause, changes, files, tests run + results, what was not verified, risk,
security/privacy impact, performance impact, manual review steps, rollback
plan, recommended next action).
