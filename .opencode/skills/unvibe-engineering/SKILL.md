---
name: unvibe-engineering
description: Unvibe-specific engineering architecture, Electron IPC, backend boundaries, privacy, and testing standards. Loaded when implementing or reviewing any Electron, backend, auth, sync, or privacy-sensitive code.
license: MIT
---

# Unvibe Engineering

## Product Context

Unvibe is a desktop overlay app for understanding AI-written code. Key architecture:
- **app/** — Electron + React (macOS-first). Menu-bar agent → floating bar → explanation widgets → companion app.
- **web/** — Next.js backend + dashboard. AI endpoints, auth/sync API. Supabase (Postgres + RLS).
- **extension/** — VS Code/Cursor extension. Parked at desktop pivot.
- **server/** — Legacy AI dev harness. Superseded by `web/`.

## Electron Architecture Boundaries

### Process Separation
- **Main process** (`app/src/main/`): Window management, IPC handlers, network I/O, local secret filter.
- **Preload bridge** (`app/src/preload/`): Exposes limited API to renderers via `contextBridge`.
- **Renderer** (`app/src/renderer/`): UI only (bar, widget, companion). No direct network access, no filesystem access, no secret access.

### IPC Validation
- Every IPC channel must be explicitly registered in main and exposed through preload.
- Validate message origin — reject unexpected message shapes at the boundary.
- The `protocol.ts` file in `app/src/core/` defines serialisable types for IPC. These are the source of truth — never bypass them.
- Secret filtering (`secretFilter.ts`) must run in the main process, never in the renderer.

### Overlay Focus Rules
- The floating bar appears at bottom-center, dims when idle.
- Widgets are movable/pinnable floating panels.
- Companion app is a separate BrowserWindow (not a panel).

### Multiple-Display Behavior
- Widgets appear on the display where code was selected.
- Bar follows the active display.
- Companion opens on the primary display.

### Secure Token Storage
- Auth tokens: stored in the main process memory, not in renderer or localStorage.
- Supabase keys: backend-only (in `web/`), never in Electron or browser code.
- API keys: backend-only, never shipped with the app.

## Backend Boundaries

| Concern | Location | Notes |
|---------|----------|-------|
| AI calls | `web/src/ai/` | Vercel AI SDK provider abstraction |
| Auth | `web/src/lib/auth.ts` | Device-code flow, bearer tokens |
| Session | `web/src/lib/session.ts` | Cookie-based |
| Store | `web/src/data/` | SupabaseStore (prod) or MemoryStore (dev) |
| Sync | `web/src/data/` | Idempotent, offline-capable |

## Backend Never Reads the Repo (Load-Bearing Rule)
- Context is built and secret-filtered **locally** (in the app/extension).
- Backend (`web/`) only receives already-filtered context.
- No Supabase service-role key or repo content in Electron code.

### Supabase Ownership and RLS
- Row-Level Security is the data-access boundary.
- User-scoped: users can only read/write their own data.
- Backend API routes verify ownership before returning data.
- Migration files in `web/supabase/migrations/` — additive-only changes.

### Sync Idempotency
- All sync operations must be idempotent — re-applying the same event is safe.
- Offline queue must not replay events out of order.
- Conflict resolution uses last-writer-wins with server timestamp.

### AI Provider Privacy
- Context sent to the AI provider is the filtered context only.
- No prompts include repository name, file paths, or user identity unless explicitly included in filtered context.
- The provider abstraction in `web/src/ai/` allows swapping Anthropic ↔ mock without code changes.

### Account Deletion
- `POST /api/v1/account` with DELETE method.
- Deletes all user data (reviews, explanations, projects, profile).
- Must cascade through Supabase RLS policies.

## Testing Requirements by Subsystem

| Subsystem | Test Level | Tool | Required |
|-----------|-----------|------|----------|
| SSE parser | Unit | `node --test` | app/tests/ |
| Secret filter | Unit | `node --test` | app/tests/ |
| Diff parser | Unit | `node --test` | app/tests/ |
| Protocol types | Unit | `node --test` | app/tests/ |
| IPC handlers | Integration | Manual/staging | macOS testing required |
| Auth flow | Integration | Manual/staging | device-code flow |
| UI components | Visual | Manual | All viewport sizes |
| API routes | Integration | `npm run build` | web/ (typecheck) |
| Supabase RLS | Staging | Manual | Requires Supabase project |

### macOS Testing Requirements
- Window positioning, multi-display, menu-bar behavior.
- Preload bridge security.
- Native dialogs and permissions.
- Build and packaging (dmg/electron-builder).
- **Physical macOS test required** — CI runners are Linux.

## Verification Commands
```
cd app && npm run typecheck && npm test && npm run build
cd web && npm run typecheck && npm run build
```
