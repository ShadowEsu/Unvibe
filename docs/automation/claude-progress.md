# Claude automation progress log

Newest entries on top. Append a short entry each session so the next one starts instantly.

---

## 2026-07-22 — Fix: app invisible in Dock & menu bar (`claude/brave-heisenberg-atsilf`)

**Status:** Done, committed, pushed. Typecheck + build + 15/15 unit tests pass on Linux.
macOS runtime (Dock/menu-bar appearance, packaging) not runnable in this Linux env — verified by
reasoning + the asset/build pipeline, not a live launch.

**Root cause found.** The build shipped with **no bundled icon assets**. `dist/assets/` was empty
because the root `.gitignore` rule `build/` also matched `app/build/`, so the source icons were
never committed on this branch. At runtime `trayTemplate.png` loaded as an empty image →
`new Tray(emptyImage)` = a zero-width, invisible menu-bar item; and there was no Dock icon. Codex
trunk (`codex/design-pixel-launch-experiment`) had already fixed this (committed assets +
`app.dock?.show()`); this branch had simply never caught up (it diverged before that work).

**What I did (surgical, not a blind cross-trunk merge):**
- Brought the real designed assets from codex trunk into `app/build/`: `icon.png` (1024),
  `icon.icns`, `trayTemplate.png` (32px template), `entitlements.mac.plist`.
- Fixed root `.gitignore` to re-include `app/build/` + whitelist those assets (matches codex
  trunk); dropped the now-redundant `build/icon.icns` line from `app/.gitignore`.
- `main.ts`: added `app.dock?.show()` on macOS; extracted a resilient `createTray()` that falls
  back to an **embedded** glyph if the asset is missing and is wrapped in try/catch so a tray
  failure never aborts bar/companion/shortcut setup.
- New pure module `app/src/core/trayIcon.ts` (embedded base64 of the real 32px glyph + a tiny PNG
  validator) and `app/test/trayIcon.test.ts` — guarantees the fallback is always a valid,
  non-empty, square PNG.
- `scripts/build.mjs`: warn loudly on missing assets instead of silently swallowing.
- Docs: created `app/CHANGELOG.md` (Unreleased), `claude-context.md`, `claude-branches.md`, this
  log.

**Files changed:** `.gitignore`, `app/.gitignore`, `app/scripts/build.mjs`,
`app/src/main/main.ts`, `app/src/core/trayIcon.ts` (new), `app/test/trayIcon.test.ts` (new),
`app/build/*` (new, from codex trunk), `app/CHANGELOG.md` (new), `docs/automation/*` (new).

**Env notes for next session:** Linux runner. `npm install` fails on Electron's binary download
(proxy 403) — use `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install`. Can't launch the GUI or run
`electron-builder --mac` here.

**What's next (highest value first):**
1. **Verify on a real Mac**: build the `.app`, confirm the Dock icon + menu-bar item show, then
   package the DMG. This is the one thing this Linux run couldn't prove.
2. **Decide the branch strategy.** This branch is behind codex trunk on `app/` (trunk's `main.ts`
   is ~722 lines vs the state this branch fixed). Either keep surgically porting, or do a
   reviewed merge from codex trunk. Don't merge blind.
3. Continue the vibe-island redesign per the plan (state machine: dormant→micro→compact→expanded;
   Glance completion; motion timing; Reduce Motion) — but do it against codex trunk's island code,
   not the older lineage, to avoid wasted/duplicated work.
4. Open the PR into `main` for this fix (link below) and keep it review-ready.

**PR:** _(created this session — see repo PR list for `claude/brave-heisenberg-atsilf` → `main`)_
