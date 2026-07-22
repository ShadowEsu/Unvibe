# Claude session progress log

Append-only. Newest entry on top. Each entry: date · branch · what changed · status · what's next.

> Note: the scheduled prompt refers to `docs/automation/claude-context.md` and
> `docs/automation/claude-branches.md`. Those do not exist in the repo yet. The real
> automation docs are under `docs/automation/overnight/` (current-status.md, backlog.md)
> and `docs/automation/nightly/`. Read those for architecture/branch context until the
> `claude-*` files are authored.

---

## 2026-07-22 (live session, later) · branch `claude/determined-curie-l09fo1`

- User asked that **all future scheduled tasks run on this branch** (`claude/determined-curie-l09fo1`).
  Noting it here; the actual schedule config lives outside the repo.
- **Website demo video**: wired the homepage demo section (`web/`) to Unvibe's hosted
  pitch-deck recording — `https://kgtnwm7mfrhop6vj.public.blob.vercel-storage.com/investors/unvibe-demo.mp4`
  (the same URL the `marketing/` site's HeroVideo/HeroDemo already default to), overridable
  via `NEXT_PUBLIC_DEMO_VIDEO_URL`. There is **no committed video file** in the repo — it's
  hosted on Vercel Blob; the sandbox can't fetch that host (egress 403) but it plays in a real
  browser / on Vercel. Verified the `<video src=…>` element renders server-side with controls.
- New reusable **`AmbientLightField`** hero background (underwater-light composite: base glow →
  caustic bands → god rays → grain → vignette; CSS+SVG, no WebGL; reduced-motion static,
  offscreen/hidden pause, mobile-lighter, `?ambientDebug=1` dev panel) + **`VideoDemo`** chaptered
  demo section. Research doc: `docs/research/vibe-island-ambient-light.md`. typecheck + build +
  36 web tests green. NOT verified: Safari/Firefox, Lighthouse, live vibeisland.com compare
  (network-blocked here).

---

## 2026-07-22 · branch `claude/determined-curie-l09fo1` (from `codex/design-pixel-launch-experiment`)

**Primary fix — built app didn't show in Dock / menu bar on macOS.**

Root cause: `app/package.json` builds with `mac.hardenedRuntime: true` and
`mac.identity: null`. A plain `npm run dist` / `npm run dist:dmg` (the exact command in
README's install section) makes electron-builder fall back to an **ad-hoc** signature but
does **not** disable macOS library validation. The combination
`hardenedRuntime + ad-hoc signature + library-validation-on` is killed by macOS at launch,
before the process ever reaches the Dock or the menu bar — no crash dialog, nothing appears.
Only `scripts/package-local.mjs` had a manual re-sign workaround; the documented
`dist`/`dist:dmg` path had none.

Fix: added `app/scripts/after-sign.mjs`, wired as electron-builder's `build.afterSign`
hook. It re-signs any bundle **without** a real Team Identifier using
`build/entitlements.local.plist` (which sets `com.apple.security.cs.disable-library-validation`),
so every packaging path (`dist`, `dist:dmg`, `package:local`, `package:release`) produces a
launchable app. A real Developer ID signature (`package:release` with `CSC_NAME`) is detected
by its TeamIdentifier and left untouched. Removed the now-duplicate manual re-sign block from
`package-local.mjs`.

**Island / bar redesign progress (this session):**
- Added a **native right-click context menu** on the floating bar (acceptance criterion).
  Right-click → `bar:contextMenu` IPC → `Menu.popup({ window: bar })`. Same menu is used by
  the tray, via a shared `buildAppMenu()` in `main.ts`.
- Added **Pause / Resume Unvibe**: new `paused` setting; `startReview()` and
  `explainClipboard()` no-op while paused; the bar dims and reads "Paused"; tray + context
  menu toggle it; state broadcast to the bar over `bar:paused`.
- Added **Explain Clipboard** menu action (`explainClipboard()`), seeding a review from the
  clipboard without a text selection.
- Added **Settings…** menu item that opens the companion and jumps to Settings via a new
  `open:settings` event (companion listens with `onOpenSettings`).
- Bar snapshot now carries `paused`; bar shows a paused visual state (`.strip--paused`).

**Status:** `npm run typecheck`, `npm run build`, and `npm test` (31 pass) all green.
Could NOT run the packaged app or exercise the GUI here (sandbox has no macOS `codesign`
and no network access to Electron's binary release, so `electron-builder`'s download step
403s). The afterSign hook was validated for syntax and ESM default-export shape; the config
change loads correctly. **The Dock/menu-bar fix and the native context-menu popup still need
a real macOS run to confirm.**

**What's next (highest priority first):**
1. On a real Mac: `cd app && npm ci && npm run dist:dmg`, install, confirm the app now
   appears in Dock + menu bar and launches. Confirm right-click on the bar shows the native
   menu and Pause/Resume/Settings all work.
2. Continue the island state-machine redesign from the scheduled brief: distinct
   presentation states (dormant/micro/compact/expanded) driven by one coordinator, the
   depth-before-generation flow, and the staged "generating" copy.
3. Full-screen onboarding using the production bar/island component (not a duplicate).
4. Native Settings sections still missing controls (Island dwell/hover, Notifications
   categories, Shortcuts recorder set, Integrations repair).

**Git:** committed to `claude/determined-curie-l09fo1`; opened
[PR #6](https://github.com/ShadowEsu/Unvibe/pull/6) into `codex/design-pixel-launch-experiment`
(the real trunk — a PR into stale `main` would carry hundreds of unrelated commits). Not
self-merged, per prompt rules.
