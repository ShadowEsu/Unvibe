# Nightly report — 2026-08-01 (desktop-overlay)

## Mission
desktop-overlay — inspect Electron main/preload/renderer, test cross-platform logic
(geometry, state, settings), fix contained low-risk issues. No full redesign.

## Repository health (app/ only — this mission touches nothing else)
- `npm install` — ok
- `npm run typecheck` — clean
- `npm test` — **37/37 pass** (was 31; +6 new)
- `npm run build` — build ok (main + preload + bar/widget/companion)

## Code inspected
- `app/src/main/main.ts` (979 lines) — IPC surface, widget lifecycle, settings side effects
- `app/src/main/windows.ts` (317 lines) — bar/widget/companion geometry, resize, snap/clamp
- `app/src/main/settings.ts` (198 lines) — persisted prefs, shortcut, quiet hours
- `app/src/main/review.ts` (467 lines) — review pipeline, secret filter, comprehension
- `app/src/preload/preload.ts` (111 lines) — sandboxed bridge; no keys/network in renderers
- `app/src/renderer/widget/widget.tsx` (847 lines) — review panel, tabs, quiz, resize grips
- `app/src/renderer/bar/bar.tsx` (256 lines) — learning island
- `app/src/renderer/companion/companion.tsx` (1514 lines) — companion app, settings

## Problems discovered

### Fixed: widget keyboard shortcuts hijack typing and ignore non-Apple command keys
- **Root cause**: `widget.tsx` attached a window-level `keydown` listener that
  (a) treated `Escape` as collapse and `⌘1`–`⌘5` as level picks **even while the
  user was typing in the follow-up textarea or paste textarea** — pressing Escape
  mid-typing collapsed the panel; and (b) only read `e.metaKey`, so `Ctrl+W` /
  `Ctrl+1`–`5` never worked on Windows/Linux.
- **Fix**: new pure module `app/src/core/widgetKeys.ts` `widgetKeyAction()`
  encoding CommandOrControl semantics (`meta || ctrl`), a form-field guard
  (`input, textarea, select, [contenteditable]`), and per-shortcut rules:
  close stays active while typing (standard window behavior), but Escape and
  level picks are suppressed inside form fields. Wired into `widget.tsx`.
- **Result**: `app/` 37/37 tests pass, typecheck clean, build ok.

### Verified, no change needed
- Preload exposes no network/node to renderers; all I/O stays in main process.
- Backend keys/tokens only live in main-process storage; renderer sees `{ userId, email }` only.
- Widget resize (`applyWidgetResize`, `clampToVisibleArea`) is min/max guarded.
- `settings:set` IPC restores the previous shortcut if registration fails.
- Bar `positionBar`/`resizeBar` geometry is display-aware with snap/clamp.

## Branch / PR
- Branch: `opencode/nightly-desktop-overlay-20260801`
- Commit: `0a3fc49` (report: `34678dd`)
- **PR creation blocked**: same as every night since 2026-07-24 — "GitHub Actions
  is not permitted to create or approve pull requests" (GraphQL 403). Branch
  `opencode/nightly-desktop-overlay-20260801` is pushed and ready.
- **PR NOT created**: the runner token is restricted by the repo ("GitHub Actions
  is not permitted to create or approve pull requests", HTTP 403). The branch is
  pushed and ready to open manually at
  https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-desktop-overlay-20260801

## Tests run
- `cd app && npm run typecheck` — clean
- `cd app && npm test` — 37/37 pass (6 new: CommandOrControl+W on both platforms,
  close-in-form-field, level mapping, level suppression in form fields,
  Escape suppression in form fields, unrelated/out-of-range keys)
- `cd app && npm run build` — build ok

## What was not verified
- macOS window/geometry behavior (island positioning, resize grips, snap) —
  **unverified on Linux runner**; the change is renderer keyboard logic only.
- The fix relies on `e.target.matches()` which is renderer DOM; the pure decision
  logic is fully covered by node tests.
- Real keydown DOM dispatch not exercised in an Electron window (no DOM test
  harness exists for renderer JSX).

## Risk level
Low. Pure additive helper + a contained renderer listener change; no IPC or
main-process behavior modified.

## Security & privacy
No credentials or API keys involved. No data leaves the machine. Renderer still
holds no network access.

## Recommended next actions
1. Open the PR from the pushed branch (blocked from automation).
2. Merge after review; revert is trivial (one core helper + one listener).
3. Consider extracting the same form-field guard to the bar/companion global
   keydown handlers if the same class of bug appears there.
