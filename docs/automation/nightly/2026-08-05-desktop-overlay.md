# Nightly report — 2026-08-05 (desktop-overlay)

## Mission
desktop-overlay — inspect Electron main/preload/renderer, test cross-platform logic
(geometry, state, settings), fix contained low-risk issues. No full redesign.

## Repository health (app/ only — this mission touches nothing else)
- `npm install` — ok
- `npm run typecheck` — clean
- `npm test` — **36/36 pass** (was 31; +5 new)
- `npm run build` — build ok (main + preload + bar/widget/companion)

## Code inspected
- `app/src/main/main.ts` (979 lines) — IPC surface, `settings:set` handler, bar lifecycle
- `app/src/main/windows.ts` (317 lines) — `barBounds` (follow-active-display vs primary),
  `positionBar`, `resizeBar`, snap/clamp geometry
- `app/src/main/settings.ts` (198 lines) — `followActiveDisplay` default `true`, persisted prefs
- `app/src/preload/preload.ts` — sandboxed bridge; no keys/network in renderers
- `app/src/renderer/widget/widget.tsx`, `bar/bar.tsx`, `companion/companion.tsx` — overlay UI

## Problems discovered

### Fixed: bar does not move when "Follow active display" is toggled OFF
- **Root cause**: `settings:set` used `else if (patch.followActiveDisplay && ...)`.
  Toggling the setting OFF writes `false`, which is falsy, so the branch never ran
  and `positionBar()` was skipped. The learning strip stayed on the display under
  the pointer instead of returning to the primary display.
- **History**: this exact fix was identified in the 2026-08-04 run but the branch
  was lost (push blocked); the 08-04 summary flagged it as "must be re-applied
  manually". Re-applied here.
- **Fix**: new pure module `app/src/core/barPlacement.ts` — `barPlacementAction()`
  keys on `!== undefined` (a real toggle in either direction), returning
  `none` / `reposition` / `reset-and-reposition`. `main.ts` routes the
  `settings:set` handler through it. `barPosition` precedence is preserved
  (position changes still collapse + reposition).
- **Result**: app/ 36/36 tests pass, typecheck clean, build ok.

### Verified, no change needed
- Preload exposes no network/node to renderers; all I/O stays in main process.
- Backend keys/tokens only live in main-process storage.
- Widget resize (`applyWidgetResize`, `clampToVisibleArea`) min/max guarded.
- `settings:set` restores the previous shortcut if registration fails.
- `barBounds` display selection (`getDisplayNearestPoint` vs `getPrimaryDisplay`)
  was correct; only the IPC trigger condition was wrong.

## Branch / PR
- Branch: `opencode/nightly-desktop-overlay-bar-placement-toggle-off`
- Commit: `pushed` (see branch)
- **PR creation blocked**: same as every night since 2026-07-24 — "GitHub Actions
  is not permitted to create or approve pull requests" (GraphQL 403). Branch
  pushed and ready at
  https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-desktop-overlay-bar-placement-toggle-off

## Tests run
- `cd app && npm run typecheck` — clean
- `cd app && npm test` — 36/36 pass (5 new: position change →
  reset-and-reposition, followActiveDisplay ON → reposition, followActiveDisplay
  OFF → reposition, unrelated fields → none, barPosition precedence)
- `cd app && npm run build` — build ok

## What was not verified
- macOS multi-display motion (strip following the pointer vs snapping to primary) —
  **unverified on Linux runner**; the decision logic is unit-covered, the live
  Electron display-switch path is not.
- Companion Settings toggle UI is unchanged; end-to-end toggle→move not exercised
  in a real window (no DOM test harness for renderer JSX).

## Risk level
Low. Pure additive helper + a contained condition change in one IPC handler. No
IPC contract, storage format, or network behavior modified.

## Security & privacy
No credentials or API keys involved. No data leaves the machine. Renderer still
holds no network access.

## Recommended next actions
1. Open the PR from the pushed branch (blocked from automation).
2. Merge after review; revert is trivial (one core helper + one wiring change).
3. On a Mac, verify: toggle OFF moves the strip to the primary display; toggle ON
   follows the pointer again.
4. Founder decision still required: unblock night-lab PR creation (persistent
   since 2026-07-24) so tested fixes stop accumulating as unmerged branches.
