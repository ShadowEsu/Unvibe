# Unvibe architecture (current)

Date: 19 SEP 2026. This is an audit of the repository as implemented, not a target-state brochure.

## 1. Current architecture

Unvibe is a desktop-first product. The Electron app in `app/` is the primary surface: menu-bar Island, floating review widget, and companion. The Next.js service in `web/` streams explanations, handles device-code auth, billing, and metadata sync. The VS Code/Cursor extension in `extension/` is parked. Marketing lives in `marketing/`.

Load-bearing rule: the desktop main process builds context and runs the secret filter before any remote request. The backend never reads a repository.

Stack:

- Desktop: Electron + React, local JSON stores, OS `safeStorage` for session tokens
- Backend: Next.js App Router, Supabase Postgres (service role) or in-memory store
- AI: fetch-based `Provider` (OpenRouter, Anthropic, Gemini, mock). Desktop BYOK in `localAi.ts`
- Auth: device-code + opaque bearer, optional sealed trial token
- Billing: Stripe workspaces; Teams checkout is still off

## 2. Current working features

Command U / Control+U selection capture, streaming explanations, depth levels, follow-up questions, multiple-choice Test me, local history, secret filter, onboarding, usage meters, Island, Pro git-diff and agent-change-brief questions, BYOK, device sign-in, plan pages.

## 3. Incomplete features

Companion Briefings/Projects/Concepts pages were placeholder copy. There was no structured Change Brief object, no git blame origin report, no knowledge-object table on device or in Postgres, no change-driven freshness, no voice capture, no free-text teach-it-back, no GitHub App, no Understanding Gap metrics in product.

Reviews SSE did not require a session when a cloud provider was configured.

## 4. Technical debt

Dual usage meters (legacy `usage_counters` vs workspace billing). Skills table is not rebuilt on event upsert. History pagination RPC unused. Device RPCs exist but store still updates tables directly. Token expiry not fully checked in `userForToken`.

## 5. Security concerns

Cloud `/reviews` could be called without a user or trial when API keys were present. Explanation bodies stay local (good). Provider keys must stay server-side. Analytics must never receive source. GitHub App is not implemented and must not be advertised as live.

## 6. Parts suitable for reuse

`gitDiff.ts`, `secretFilter.ts`, `contextBuilder.ts`, `learning.ts`, `Provider` interface, `store.ts`, widget/companion IPC, existing review SSE.

## 7. Required migrations

Additive only. New optional `knowledge_objects` table for future cloud sync of metadata (not explanation bodies). Existing user data must remain.

## 8. Implementation order

1. Local Change Brief from real git
2. Why this exists from blame/log facts
3. Local knowledge objects + change-driven freshness
4. Provider / speech interfaces
5. Reviews auth alignment + secret-filter tests
6. Opt-in voice hold-to-ask
7. Teach it back (free text vs saved explanation)
8. Optional quiet live git watch
9. Docs that describe only what shipped
