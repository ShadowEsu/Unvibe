# Desktop Overlay Report — 2026-07-23

## Mission

Inspect the desktop overlay architecture: Electron main process, IPC bridge, preload,
bar (floating island), widget (explanation panel), companion (full app). Test cross-platform
logic. Fix one contained low-risk issue.

## Scope covered

### Main process (`app/src/main/`)
- `main.ts` — All IPC handlers, window lifecycle, account, settings, sync, shortcut
- `windows.ts` — Bar, widget, companion window creation, positioning, resize, snapping
- `review.ts` — Review pipeline: capture → build context → secret filter → stream → record → sync
- `settings.ts` — Persisted settings with revision-based migration
- `store.ts` — Local encrypted store, outbox, sync model, daily limits
- `backend.ts`, `sync.ts`, `selection.ts`, `contextBuilder.ts`, `notify.ts`, `usage.ts`, `aiKey.ts`,
  `localAi.ts`, `studyQuiz.ts`, `integrations.ts`, `trial.ts` — Supporting modules

### Preload bridge (`app/src/preload/`)
- `preload.ts` — Context bridge exposing `window.unvibe` with 40+ IPC channels
- Renderers are sandboxed (`secureWebPrefs`); no `nodeIntegration`, no network

### Renderer (`app/src/renderer/`)
- `widget/widget.tsx` — Single review panel with tabs, streaming, quiz, resize grips
- `bar/bar.tsx` — Floating Island: compact stats, hover expansion, context menu, sound cues
- `companion/companion.tsx` — Full app: Home, Study, History, Quiz, Progress, Plan, Settings
- `shared/richText.tsx` — Markdown-ish renderer with code highlighting, citations
- `shared/logo.tsx` — Unvibe logo mark component

### Core (`app/src/core/`)
- `protocol.ts` — Wire types (ReviewScope, ExplanationLevel, StreamEvent, ComprehensionQuestion)
- `learning.ts` — Profile computation, concept evidence, streak, review queue
- `secretFilter.ts` — Credential pattern scanning
- `sse.ts` — SSE stream parser
- `tokenVault.ts` — Encrypted token storage
- `syncModel.ts` — Remote event merge logic
- `language.ts` — Code language guessing

## Fix applied

**`companion.tsx` line 1373**: Changed fallback `plan: 'local'` to `plan: 'free'`.
The `UsageChip` display logic only recognizes `'free'`, `'pro'`, `'teams'`, or `'trial'`.
The undocumented `'local'` value fell through to the default `'Free'` label, which was
correct behavior by accident rather than intent. This fixes the inconsistency.

## Findings

### Architecture strengths
- All network I/O lives in the main process — renderers are fully sandboxed
- Secret filtering blocks credentials before any remote request
- Preload bridge exposes a clean, typed API surface
- Settings and learning store use separate files, so wiping learning never touches preferences
- Token encryption uses Electron `safeStorage` (OS keychain) via `tokenVault`
- Commitment to `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`

### Cross-platform notes (unverified on Linux runner)
- `titleBarStyle: 'hiddenInset'` in `windows.ts:305` — Electron ignores this on Linux; window appears with standard frame
- `systemPreferences.isTrustedAccessibilityClient()` — returns true without prompting on Linux; capture selection may not work as on macOS
- `app.dock` — guarded by `process.platform === 'darwin'`
- `app.setLoginItemSettings` — guarded by `process.platform === 'darwin'`
- `tray.setTemplateImage(true)` — guarded by `isMac`
- `backgroundColor: '#faf7f0'` in companion window — hardcoded; may flash before theme JS loads on Linux
- Custom resize grips (`ResizeGrips` in widget.tsx) — work on all platforms via mouse events
- Global shortcut registration — works on Linux but selection capture requires macOS accessibility

### State coverage
- **Loading**: Companion has `gate === 'checking'` state → renders titlebar only
- **Empty**: Feed empty state, history empty, quiz empty, study empty all have dedicated UI
- **Error**: Review pipeline handles network errors, timeout (45s), pro-gating, plan-limit, blocked secrets
- **Offline**: Sync status shows `offline` / `auth_required` states with retry button

### Security
- Bearer token encrypted at rest with Electron `safeStorage`
- Token never reaches renderer code
- Secret filter runs before every remote request (consent/blocked flow)
- Legacy unencrypted tokens are silently deleted on load (`store.ts:67-70`)
- Outbox is cleared when signing into a different account (`store.ts:206-209`)

### Missing test coverage
- `windows.ts` — No tests for barBounds, snap, clampToVisibleArea, applyWidgetResize
- `settings.ts` — No tests for settings migration, quiet hours, hover delay clamping
- `review.ts` — No tests for ensurePayload, scanPayload, initWidget, recordReview
- `store.ts` — No tests for updateLesson, file snapshots, daily usage, beta prompt quota

## Verification
- `npm run typecheck` — passed
- `npm run build` — passed (build ok)
- `npm test` — 31/31 tests passed (all subtests: 31 passed, 0 failed)
- No macOS, production, billing, AI, or signing identity was used

## Risk level
**Low** — single character change (`'local'` → `'free'`) in a fallback plan label.
Pathological behavior: label shows "Free" instead of an undefined plan name (identical to before).
