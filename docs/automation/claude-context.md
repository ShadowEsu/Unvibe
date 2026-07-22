# Claude automation context (read this first each session)

_Maintained by the autonomous Claude sessions. Keep concise and durable._

## What Unvibe is
A native-feeling macOS desktop **learning layer** for developers using AI coding tools. Select
AI-written code in any app → Unvibe explains it at a chosen depth without pulling you away →
save concepts/snippets, ask follow-ups, study later. It is a code-**comprehension** product, not
an agent monitor and not a code generator. Product name is "Uncode"; codename "Unvibe".

## Reality check on the stack
The primary surface (`app/`) is **Electron + React + TypeScript**, not native Swift. Ambitious
"Swift/AppKit Dynamic Island" task prompts are aspirational — implement their *intent* within the
Electron app. The overlay = a frameless, transparent, non-focusable `BrowserWindow` ("the bar")
plus floating widget windows; the menu bar = an Electron `Tray`; the dashboard = the companion
`BrowserWindow`.

## Directory map
```
app/        PRIMARY. Electron desktop app.
  src/main/     main process — owns tray, windows, global shortcut, selection capture,
                secret filter, learning store, settings, account/auth, ALL network I/O.
    main.ts       app lifecycle, IPC handlers, tray/dock, shortcut, review orchestration
    windows.ts    createBar / createWidget / createCompanion, positioning, snap, clamp
    selection.ts  captureSelection (AXUIElement/clipboard), frontmostApp
    review.ts     runReview (SSE streaming), comprehension quiz
    settings.ts / store.ts / sync.ts / backend.ts / notify.ts
  src/renderer/ bar/ widget/ companion/ — sandboxed React UIs (CSP: no network)
  src/core/     pure, testable logic (sse, secretFilter, learning, protocol, language,
                trayIcon). No electron imports → unit-testable under `node --test`.
  src/preload/  contextIsolation bridge
  build/        SOURCE assets: icon.png (1024), icon.icns, trayTemplate.png (32px template),
                entitlements.mac.plist. (See gitignore gotcha below.)
  scripts/build.mjs  esbuild: main+preload (cjs), renderers (iife), copies html/css + assets
  test/         node --test suites over src/core
extension/  VS Code/Cursor extension — PARKED (kept, not developed).
web/        Next.js backend + dashboard + AI endpoints + sync/auth API. Backend NEVER reads the
            repo — only receives already-secret-filtered context (load-bearing rule).
server/     legacy AI-only dev harness.
marketing/  launch website; has real brand icon PNGs under public/brand/.
docs/       architecture.md, design-system.md, privacy.md, automation/ (these files).
```

## Commands (run inside `app/`)
```
# Install without the proxy-blocked Electron binary download (proxy returns 403 on the binary):
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install
npm run typecheck   # tsc --noEmit          — runs on Linux
npm run build       # esbuild bundle+assets  — runs on Linux
npm test            # node --test on core    — runs on Linux
npm start           # electron .             — needs the Electron binary + a GUI (macOS); NOT runnable here
npm run dist:dmg    # electron-builder --mac  — needs macOS
```
This automation runs on **Linux**, so it cannot launch the GUI or run `electron-builder --mac`.
Validate via typecheck + build + core unit tests, and reason about runtime behavior.

## Load-bearing rules
- Secrets are filtered locally before any remote request; renderers have no network access.
- TypeScript strict; no `any` without justification. Dispose everything. Small modules.
- Design: strict black/white/gray + restrained purple accent; handle loading/empty/error/offline;
  keyboard-operable; respect Reduce Motion.
- Schema changes additive-only unless a destructive change is explicitly justified.

## Known gitignore gotcha (fixed on this branch 2026-07-22)
Root `.gitignore` `build/` also matched `app/build/`, hiding the app's **source** icon assets —
which is why builds shipped with an empty tray image (invisible menu-bar item) and no Dock icon.
Fixed by re-including `app/build/` and whitelisting the asset files, matching codex trunk.

## Branch topology
See `claude-branches.md`. TL;DR: `codex/design-pixel-launch-experiment` is the real trunk;
`main` is stale; push only to `claude/brave-heisenberg-atsilf`; PR into main, never merge.
