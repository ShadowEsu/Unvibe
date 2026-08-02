# Night Lab — Product Design & Accessibility (2026-08-02)

Mission: `product-design-and-accessibility` · Branch: `opencode/nightly-product-design-and-accessibility-widget-reduced-motion`
Run model: `deepseek/deepseek-v4-flash` · Max risk respected: low

## Scope chosen

A contained flow not fully covered by previous night-lab a11y PRs: the **explanation
widget's progressive text reveal** (`app/src/renderer/widget/widget.tsx`). The CSS
already disables reveal-related animation under `prefers-reduced-motion`, and the
companion's `playSetupTone` skips setup sounds under reduced motion, but the
JavaScript `requestAnimationFrame` reveal loop itself did **not** respect the setting.

## Audit findings

### 1. Widget text reveal animates under reduced motion
The widget streams explanations token-by-token, then runs a JS "typewriter"
reveal (`requestAnimationFrame`) to progressively reveal buffered text
(widget.tsx). Under `prefers-reduced-motion: reduce` the CSS kills the
accompanying motion (`widget.css` reduced-motion block), but the **content
itself still unveiled gradually** — animation-like behavior a vestibular /
attention-sensitive user explicitly opted out of. This violates the design
system baseline ("Honor `prefers-reduced-motion`") and WCAG 2.2.2 intent:
motion should be replaced with an immediate static result.

### 2. Behavior discrepancy across surfaces
The companion (`playSetupTone`) and both CSS files already honored
`prefers-reduced-motion`; the widget's JS reveal was the one surface where the
setting was checked only in CSS and therefore not consistently applied to
stateful, JS-driven motion.

## Changes

- `app/src/renderer/widget/widget.tsx`
  - The reveal effect now reads `prefers-reduced-motion: reduce` via
    `matchMedia`. When active, the full buffered text is displayed
    immediately and the `requestAnimationFrame` loop is skipped entirely
    (`stillTyping` stays false, so "Understand ✓" is immediately available).
  - Logic extracted into a pure, testable helper `revealInitialState`.
- `app/src/core/reveal.ts` (new)
  - Pure function returning `{ initial, animate }` given
    `(reduceMotion, phase, text)`, so the decision is unit-testable without a
    DOM.
- `app/test/reveal.test.ts` (new)
  - 4 regression tests: reduced-motion full-text instant reveal; animated
    reveal from empty otherwise; non-streaming phase resets; empty text never
    animates.

No CSS changes, no visual changes, no redesign.

## Evidence

- `npm run typecheck` (app): clean.
- `npm run build` (app, esbuild main+preload+renderers): `build ok`.
- `npm test` (app): **35/35 pass, 0 fail, 0 skipped**, including 4 new
  `reveal.test.ts` tests (reduced-motion instant reveal confirmed: test #18).
- New test names: `reduced motion reveals full text instantly, no animation`,
  `streaming without reduced motion animates from empty`, `non-streaming phases
  reset revealed text`, `empty text never animates`.

## What was not verified

- Visual behavior under macOS "Reduce motion" is **unverified on Linux
  runner**. `matchMedia('(prefers-reduced-motion: reduce)')` is standard
  Chromium API; behavior on a real Mac with the system toggle enabled was not
  observed.
- Screen-reader behavior not exercised on a real assistive device.

## Risk, security, privacy, performance

- **Risk level: low.** Renderer-only, additive, behavior-preserving for users
  who do not enable reduced motion. No IPC, no store, no network, no layout
  change.
- **Security/privacy:** none. No data flow changed; no secrets touched.
- **Performance:** strictly fewer `requestAnimationFrame` frames under reduced
  motion; unchanged otherwise.

## Manual review steps

1. Run Unvibe, trigger an explanation so the widget streams.
2. Turn on macOS "Reduce motion" (System Settings → Accessibility → Display)
   or emulate `prefers-reduced-motion: reduce` in DevTools.
3. Confirm the full explanation appears instantly with no typewriter effect,
   and "Understand ✓" is enabled immediately.
4. Repeat with reduced motion off; confirm the gradual reveal still works.

## Rollback plan

Revert this branch's single commit; delete `app/src/core/reveal.ts` and
`app/test/reveal.test.ts`. No migration or data involved.

## Recommended next action

Open the PR for
`opencode/nightly-product-design-and-accessibility-widget-reduced-motion`;
safe to merge after one reviewer confirms reduced-motion reveal on macOS.

## PR blocker

If the GitHub Actions token cannot create pull requests, push the branch and
open the PR manually with the required template (mission, why, evidence, root
cause, changes, files, tests run + results, what was not verified, risk,
security/privacy impact, performance impact, manual review steps, rollback
plan, recommended next action).
