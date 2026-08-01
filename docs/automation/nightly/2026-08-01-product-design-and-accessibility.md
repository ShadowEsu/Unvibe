# Night Lab — Product Design & Accessibility (2026-08-01)

Mission: `product-design-and-accessibility` · Branch: `opencode/nightly-product-design-and-accessibility-login-a11y-announcements`
Run model: `deepseek/deepseek-v4-flash` · Max risk respected: low

## Scope chosen

The **login flow** — `LoginScreen` + `SignInForm` in
`app/src/renderer/companion/companion.tsx`. This is the device-code Google
sign-in surface shown when the app is first opened un-onboarded, and the same
`SignInForm` is reused for the "Sign in" row inside Settings → Account & Plan.

It had not been audited by any previous night-lab a11y PR (those covered the
sidebar, settings modal, Plan page, onboarding headings, `.sr-only` utility,
floating bar, and widget quiz flow).

## Audit findings

### 1. Sign-in errors were not announced to screen readers (regression)
`SignInForm` renders failures as a `.field-err` div with no `role="alert"`.
Night-lab commit `405faba` had added `role="alert"` to all four `.field-err`
spots, but that change was lost when the companion was redesigned; on `main`
every `.field-err` had no alert semantics. A screen-reader user who starts a
device-code sign-in gets no announcement if the device flow fails or times out.

The same regression applied to the other three `.field-err` instances
(account deletion, AI key save, shortcut capture).

### 2. The device code was never announced
After clicking "Continue with Google", the main process starts a device-code
flow and the renderer swaps the note text to
"Browser open — sign in with Google, then approve code XXXXXX." The `.field-note`
had no `aria-live`, so the code appearing (and the browser handoff) was visual-only.

### 3. Reviewed and OK (no change needed)
- **Keyboard**: both buttons are native `<button>`; focus ring exists
  (`button:focus-visible`). The sign-in card contains no custom-keyboard flow.
- **Hierarchy**: `h1` (story headline) → `h2` (card tagline) is correct; no skips.
- **Reduced motion**: login ribbons/grid are static; the `fadeIn` entry is
  neutralized by the existing global `@media (prefers-reduced-motion: reduce)`
  block in companion.css.
- **States**: busy ("Waiting for Google sign-in…"), error (`.field-err`), and
  the code handoff state all exist. Loading is shown by the disabled button.
- **Color/contrast**: `.login .field-err` (#ffd2cc on the dark card) and
  `.field-note` (white at 48% on near-black) read clearly; unchanged.

## Changes

`app/src/renderer/companion/companion.tsx` (attribute-only, no visual change):

- `SignInForm`:
  - `role="alert"` on the sign-in error so failures/timeouts are announced.
  - `aria-live="polite"` on the note so the device code and browser-handoff
    text is announced when it appears.
- `AccountPanel` (account deletion error), `AiSettingsPanel` (API-key save
  error), and `Settings` shortcut capture error: restored `role="alert"` that
  `405faba` originally added.

`app/package-lock.json`: lockfile version synced 0.1.1 → 0.1.2 to match
`package.json` (stale before this run; no dependency change).

No CSS changes. Preserves the shipped (purple/gradient) design language.

## Evidence

- `npm run typecheck` (app): clean.
- `npm run build` (app, esbuild main+preload+renderers): `build ok`.
- `npm test` (app): **31/31 pass, 0 fail, 0 skipped**. Renderer JSX has no DOM
  test harness (existing suites cover core only), so no new renderer test was
  added; the change is static JSX attributes verified by build + typecheck.

## What was not verified

- macOS window behavior **unverified on Linux runner** — no macOS-specific API
  is touched; the change is plain ARIA attributes on the companion renderer.
- VoiceOver/NVDA announcement behavior not exercised on a real assistive device.
- The device-code flow itself was not run end-to-end (no network/auth in CI).

## Risk, security, privacy, performance

- **Risk level: low.** Renderer-only, additive ARIA attributes; no behavior
  change for non-assistive users. No IPC, store, or network changes.
- **Security/privacy:** none. No data flow changed; no secrets touched.
- **Performance:** none (no new listeners, timers, or DOM work).

## Manual review steps

1. Run Unvibe, stay logged out.
2. Enable VoiceOver (macOS) or open the companion in a browser with an SR tool.
3. Click "Continue with Google" and confirm the device code is announced when
   the note text changes.
4. Force a failure (e.g. start the flow with the backend down) and confirm the
   error is announced.
5. Settings → Account & Plan → Sign in: repeat; also exercise the delete-
   account and AI-key error paths and confirm each is announced.

## Rollback plan

Revert this branch's single commit; no migration or data involved.

## Recommended next action

Safe to merge after a human confirms the announcement behavior on macOS. Note
the design-system drift decision still pending (see
`docs/product/design-system-drift-decision.md` from 2026-07-31) — unrelated to
this fix, but the a11y audit baseline should be updated once the spec is
settled.
