# Nightly report — 2026-08-06 (desktop-overlay)

## Mission
desktop-overlay — inspect Electron main/preload/renderer, test cross-platform
logic (geometry, state, settings), fix contained low-risk issues. No full redesign.

## Repository health (app/ only — this mission touches nothing else)
- `npm install` — ok
- `npm run typecheck` — clean
- `npm test` — **43/43 pass** (was 31; +12 new)
- `npm run build` — build ok (main + preload + bar/widget/companion)

## Code inspected
- `app/src/main/main.ts` (979 lines) — IPC surface, `settings:set` handler, bar lifecycle
- `app/src/main/windows.ts` (317 lines) — `barBounds` (follow-active-display vs primary),
  `positionBar`, `resizeBar`, snap/clamp geometry
- `app/src/main/settings.ts` (198 lines) — `followActiveDisplay` default `true`, persisted prefs
- `app/src/preload/preload.ts` — sandboxed bridge; no keys/network in renderers
- `app/src/renderer/widget/widget.tsx`, `bar/bar.tsx`, `companion/companion.tsx` — overlay UI

## Problems discovered

### Fixed 1: bar does not move when "Follow active display" is toggled OFF
- **Root cause**: `settings:set` used `else if (patch.followActiveDisplay && ...)`.
  Toggling the setting OFF writes `false`, which is falsy, so the branch never ran
  and `positionBar()` was skipped. The learning strip stayed on the display under
  the pointer instead of returning to the primary display.
- **History**: identified by the 2026-08-04 and 2026-08-05 runs. The 08-05 branch
  contains only a report doc — the fix commit never landed on `main`, and no PR was
  created (Actions PR creation blocked since 2026-07-24). Re-applied here.
- **Fix**: new pure module `app/src/core/barPlacement.ts` — `barPlacementAction()`
  keys on `!== undefined` (a real toggle in either direction), returning
  `none` / `reposition` / `reset-and-reposition`. `main.ts` routes the
  `settings:set` handler through it. `barPosition` precedence is preserved
  (position changes still collapse + reposition).

### Fixed 2: widget keyboard shortcuts break on Windows/Linux and hijack typing
- **Root cause**: `widget.tsx` window-level `keydown` listener used `e.metaKey`
  only (the ⌘ key) and had no form-field guard — `Ctrl+W` / `Ctrl+1`–`5` never
  worked off-macOS, and pressing `Escape` while typing in the follow-up or paste
  textarea collapsed the panel mid-typing.
- **History**: identified by the 2026-08-01 run; that branch also never reached
  `main` (PR creation blocked). Re-applied here.
- **Fix**: new pure module `app/src/core/widgetKeys.ts` — `widgetKeyAction()`
  encodes CommandOrControl semantics (`meta || ctrl`), a form-field guard
  (`input, textarea, select, [contenteditable]`), and per-shortcut rules: close
  stays active while typing (standard window behavior), Escape and level picks
  are suppressed inside form fields. Wired into `widget.tsx`.

### Verified, no change needed
- Preload exposes no network/node to renderers; all I/O stays in main process.
- Backend keys/tokens only live in main-process storage; renderer sees `{ userId, email }` only.
- Widget resize (`applyWidgetResize`, `clampToVisibleArea`) min/max guarded.
- `settings:set` restores the previous shortcut if registration fails.

## Branch / PR
- Branch: `opencode/nightly-desktop-overlay-bar-placement-and-widget-keys`
- Commit: `c4fc7a7` (branch pushed and tracking origin)
- **PR creation blocked**: same as every night since 2026-07-24 — `gh pr create`
  failed with "GitHub Actions is not permitted to create or approve pull
  requests" (GraphQL createPullRequest 403). Pushing to the remote works; only
  PR creation is denied. Branch ready to open manually at
  https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-desktop-overlay-bar-placement-and-widget-keys

## Tests run
- `cd app && npm run typecheck` — clean
- `cd app && npm test` — 43/43 pass (12 new)
  - `test/barPlacement.test.ts` (5): position change → reset-and-reposition,
    followActiveDisplay ON → reposition, followActiveDisplay OFF → reposition,
    combined patch precedence, unrelated fields → none
  - `test/widgetKeys.test.ts` (7): CommandOrControl+W both platforms,
    close-in-form-field, Escape collapse, Escape suppressed in form fields,
    CommandOrControl+1..5 level picks, level picks suppressed in form fields,
    unrelated/out-of-range keys
- `cd app && npm run build` — build ok

## What was not verified
- macOS window/geometry behavior (strip following the pointer vs snapping to
  primary; resize grips; snap) — **unverified on Linux runner**. The decision logic
  is unit-covered; the live Electron display-switch and DOM keydown paths are not
  (no DOM test harness exists for renderer JSX).
- Companion Settings toggle UI unchanged; end-to-end toggle→move not exercised in
  a real window.
- Fix 2's form-field detection relies on `e.target` DOM; the decision logic is
  fully covered by node tests.

## Risk level
Low. Two pure additive helpers + two contained wiring changes (one IPC handler
branch, one renderer keydown listener). No IPC contract, storage format, or
network behavior modified.

## Security & privacy
No credentials or API keys involved. No data leaves the machine. Renderer still
holds no network access.

## Recommended next actions
1. Open the PR from the pushed branch (blocked from automation since 2026-07-24).
2. Merge after review; revert is trivial (two core helpers + two wiring changes).
3. On a Mac, verify: toggle OFF moves the strip to the primary display; toggle ON
   follows the pointer again; ⌘W / ⌘1–5 work in the widget; Escape no longer
   collapses the panel while typing.
4. Founder decision still required: unblock night-lab PR creation so tested fixes
   stop accumulating as unmerged branches (now 8+ nightly branches, some holding
   duplicate fixes that were lost and re-applied here).
