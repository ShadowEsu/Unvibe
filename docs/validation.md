# Validation & definition of done (Milestone 6)

## Definition of done (per feature)
A feature is done only when: happy path works AND loading/empty/error/offline states exist
AND it is keyboard-operable AND secrets never leave the machine AND (if it records learning)
the event is stored and, when signed in, synced. Happy-path-only is NOT done.

## What is verified (in this environment)
- **Extension**: `tsc --noEmit` clean · esbuild bundle builds · **34/34 unit tests pass**
  (secret filter, diff parse, parsers, citations, learning model/streak, sync outbox).
- **Backend (web)**: `tsc --noEmit` clean · `next build` green (17 routes).
- **AI service (server)**: `tsc --noEmit` clean; SSE streaming, `done` event, 400 validation,
  and comprehension JSON verified via curl (mock provider).
- **End-to-end API round-trip (dev store)**: device → `202 pending` → approve → token →
  `POST /events` → `GET /profile` (correct computed summary) → `401` unauthorized.
- **Dashboard visually verified** (production build, in-browser):
  - Home — signed-out empty state and populated stat tiles (light).
  - `/activate` — code entry + "Connected" state; sets the session cookie.
  - History — reverse-chronological list with outcome badges.
  - Profile — full breakdown, rendered in **dark mode** (theme-awareness confirmed).
  - No console errors.

## Offline / resilience
- Reviews are recorded locally first; sync is best-effort.
- A durable **outbox** queues events; on failure they stay queued and are **backfilled** on the
  next successful flush (on activation and after sign-in).
- Stream errors show a **Retry** affordance in the panel.

## Security posture (this milestone)
- Session cookie: `HttpOnly`, `SameSite=Lax`, `Secure` over HTTPS / in production.
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`.
- Secrets filtered locally before any request; backend never reads the repo.

## NOT yet verified (needs real credentials / a live editor)
- **SupabaseStore** (prod DB path) — code-complete, no project/keys here; SQL migration
  unapplied.
- **Real Anthropic API** (streaming + comprehension) — mock only; no key here.
- **Extension inside a live editor (F5)** — detection, webview rendering, consent flow,
  comprehension UI, and sign-in polling are typechecked + logic-tested but not run in VS Code.
- **Auth hardening** — `/auth/approve` still auto-creates a user without a real login gate;
  production must gate approval behind real Supabase Auth.

## How to reproduce the E2E
1. `cd web && npm install && npm run dev` (dev store + mock AI; no keys).
2. `cd extension && npm install && npm run build`, open in VS Code/Cursor, press F5.
3. In the dev host: run **Uncode: Sign In**, approve in the browser, review code, use
   **Test me**, then **Uncode: Open Dashboard** to see synced progress.
