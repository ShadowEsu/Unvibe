# claude-context.md — durable session context

> Purpose: this file exists so each scheduled Claude session does **not** re-scan the
> whole repo to rediscover the same facts. Read this first. If something here is wrong or
> stale, fix it in the same run. Companion files: `claude-branches.md` (branch map),
> `claude-progress.md` (session log). Keep all three concise.

Last verified: **2026-07-23** (branch topology, open PRs, launch-bug status).

---

## What Unvibe actually is (vs. the scheduled prompt's aspiration)

The stored scheduled prompt describes a **native Swift/AppKit** app (NotchPanel,
NSPanel, AXUIElement, etc.). **The real repo is Electron + React + TypeScript.** Treat the
Swift architecture in the prompt as a *design target / vocabulary*, not the current stack.
Do not rewrite the app in Swift — that is a multi-week architectural change requiring
sign-off (see CLAUDE.md change-control rule).

Product: a desktop "learning layer" that explains AI-generated code the developer selects
in another app (Cursor/VS Code/browser), at a chosen depth, without leaving their editor —
then lets them save concepts/snippets and study later. Menu-bar agent → floating bottom
bar ("vibe island") → floating explanation widgets → companion window.

## Directory map (top level)

| Dir | What | Notes |
| --- | --- | --- |
| `app/` | **PRIMARY.** Electron desktop overlay (agent, bar/island, widgets, companion) | Where the island redesign happens. TS strict. |
| `extension/` | VS Code/Cursor extension | **Parked** at the desktop pivot; logic reused in `app/`. |
| `web/` | Next.js backend + dashboard (AI endpoints, auth/sync API) | Shared, mostly unchanged. |
| `server/` | Legacy AI-only dev harness (Milestone 2) | Superseded by `web/`. |
| `marketing/` | Next.js launch website + waitlist/beta invite plumbing | Actively evolving on multiple branches. |
| `docs/` | architecture / design-system / privacy / automation | This file lives in `docs/automation/`. |

## `app/` architecture (Electron)

- **Main process** (`app/src/main/`) owns ALL network I/O + local secret filtering. Renderers
  are sandboxed (CSP: no network) and talk only over the preload bridge (`app/src/preload/preload.ts`).
  - `main.ts` — tray, floating bar, widgets, companion, global shortcut, IPC wiring, account/auth.
  - `windows.ts` — window/panel creation + positioning (`createBar`, `createWidget`, `createCompanion`, `positionBar`).
  - `review.ts` — the explanation session (capture → request → stream → record; comprehension quiz).
  - `selection.ts` — capture selected code + frontmost-app detection.
  - `backend.ts` / `sync.ts` / `store.ts` / `settings.ts` / `notify.ts` — HTTP, learning sync, local store, prefs, notifications.
  - On trunk also: `island.ts` + `core/islandState.ts` (island state machine) and `core/sound.ts` (event sounds).
- **Renderers** (`app/src/renderer/`): `bar/` (the island), `widget/` (explanation card), `companion/` (main window). Built with esbuild → IIFE.
- **Core** (`app/src/core/`): `sse.ts`, `secretFilter.ts`, `learning.ts`, `protocol.ts`, `language.ts` (+ `islandState.ts`, `sound.ts`, `trayIcon.ts` on some branches).
- **Build**: `app/scripts/build.mjs` (esbuild: main+preload cjs, renderers iife, copies `build/*.png|icns` → `dist/assets/`).
  Packaging: `electron-builder`; mac afterSign hook re-signs ad-hoc bundles (see launch bug below).

### Commands (from `app/`)
```
npm install
npm run build       # esbuild
npm run typecheck   # tsc --noEmit
npm test            # build tests + node --test
npm run dist:mac    # electron-builder dmg+zip (mac only)
```
> This automation runs on **Linux**. `node_modules` is NOT pre-installed and the electron
> binary download is blocked, so you generally CANNOT run `npm install`, a full Electron
> build, or macOS packaging here. Verify TS/logic by inspection + pure-module node tests.
> Never claim the packaged macOS app was launched/verified from this environment.

## The launch bug ("app doesn't show in Dock or menu bar") — STATUS: fix authored, awaiting human merge

Root cause (best analysis, from PR #6): on the real trunk the icon assets *do* exist, and
`main.ts` already calls `app.dock?.show()`. The remaining cause is **packaging/signing**:
`app/package.json` sets `mac.hardenedRuntime: true` with `mac.identity: null`. A plain
`npm run dist`/`dist:dmg` produces an **ad-hoc** signature but does not disable library
validation. `hardened-runtime + ad-hoc-signed + library-validation-on` is a combination
**macOS silently kills at launch** — no Dock icon, no menu-bar item, no crash dialog.

- **Fix lives in PR #6** (`claude/determined-curie-l09fo1` → trunk): adds
  `app/scripts/after-sign.mjs` (electron-builder `afterSign` hook) that re-signs any bundle
  lacking a real Team Identifier using `app/build/entitlements.local.plist`
  (`com.apple.security.cs.disable-library-validation`). Real Developer ID signatures are
  left untouched. Verified internally consistent by code inspection (hook + entitlements
  both present and correct). **Cannot be verified on Linux** — needs a real Mac run.
- A second, competing analysis (missing icon assets → empty `Tray`) is in **PR #7**, but it
  targets stale `main` and its own body admits trunk already fixed the asset issue.
- **Do NOT open another Dock-fix PR.** Recommend the founder review + merge PR #6 into trunk.
  Signing changes must NOT be auto-merged (see AGENTS.md / task rules).

## Hard rules (from CLAUDE.md / AGENTS.md — do not violate)
- Backend never reads the repo; extension/app filters secrets locally before any remote call.
- No network calls from renderers/webview. Main process owns all I/O.
- Schema changes additive-only unless a destructive change is explicitly justified.
- No major dependency/architecture change without written tradeoff + sign-off.
- Don't force-push, don't delete branches, don't merge into `main` yourself (open a PR).
- Don't present mock output as real; label unfinished behavior ("Milestone N").
