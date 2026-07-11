# Validation & definition of done

## D2.1 — reliability, settings, onboarding, legal, packaging (2026-07-11)

Verified live (typecheck + build clean; 9/9 app tests):
- **Settings store persists + applies.** Driving `settings:set` over IPC wrote `barPosition`,
  `launchAtLogin`, `notifications`, `onboarded` to `unvibe-settings.json` (confirmed on disk).
- **Configurable global shortcut**, default **`⌘⌥U`** (not `⌥Space`, which types a non-breaking
  space). The default flows settings → UI (hero shows "press ⌘⌥U"). A recorder in Settings
  captures a new chord; the main process re-registers it and reverts on conflict.
- **Onboarding** renders on first run (welcome → what-it-does → permission → shortcut test →
  done) with the logo and step dots; completing it persists `onboarded: true`.
- **Widget** now: sandbox on, window-open denied, bounds persisted (`lastWidgetBounds`), edge
  snapping, inactive dim/stay/collapse from settings.
- **Bar**: position from settings, premium restyle, notification pipeline with 15s rate limit +
  quiet hours.

Security review (this pass): context isolation ✓, nodeIntegration off ✓, **sandbox on** ✓,
`setWindowOpenHandler` denies + routes https to the OS browser ✓, `will-navigate` blocked ✓, CSP
in every renderer ✓, token encrypted at rest ✓, secrets filtered on-device ✓, RLS + policies on
user tables ✓, no service-role key in the renderer ✓, no shell/openExternal of untrusted input ✓.
Dependency licenses: **no copyleft** (see `docs/licenses.md`).

Known limitations (honest):
- **Double-tap-Option is not implemented** — macOS gives Electron no reliable API for it without
  an Input-Monitoring native helper. A dependable configurable global shortcut is used instead.
- `launchAtLogin` logs "Operation not permitted" unpackaged (`electron .`); works in a signed
  packaged bundle.
- Accessibility auto-capture (`⌥`+select) needs the Accessibility grant; clipboard fallback works
  without it. Not exercised end-to-end here (needs a real grant + a second app).
- Packaging is **config-only** — not signed, not notarized, no `.icns` (see `docs/packaging.md`).

## Milestone D2 — learning store, comprehension, accounts (2026-07-11)

Verified live (typecheck + build clean; 9/9 app unit tests; web typecheck clean; driven end
to end against the running app + backend, mock AI):
- **Login screen** with the Unvibe hexagon-U logo (SVG), passwordless email sign-in, and a
  "keep it local" skip. Confirmed by screenshot.
- **Sign-in → gate**: entering an email issues a bearer token, the login gate opens, and the
  identity persists across relaunch (token encrypted at rest via Electron safeStorage —
  confirmed `tokenEncrypted: true` in the store file).
- **In-widget comprehension** ("Test me"): fetches a question, renders options with the answer
  held in the main process (never sent to the renderer until graded), grades on Check, shows
  the correct option + rationale, and records the outcome. Confirmed by screenshots.
- **Real learning data**: a review recorded a local event; answering the check upgraded it to
  `understood` with a concept. Local store showed the event; **outbox drained to 0** (synced).
- **Sync proven end to end**: backend `/profile` for the account returned `totalReviews: 2,
  understood: 1, conceptsUnderstood: 1, streak: 1` — an exact match to the local store; history
  showed both events with correct outcomes.
- **Account lifecycle (App Store rules)**: `DELETE /account` returns 200, wipes the user's data,
  and revokes the token (subsequent `/profile` → 401). Sign-out clears identity locally but
  keeps the user's own learning. Sign-in email validation returns 400 on bad input.

NOT yet verified (needs permissions / a key):
- ⌥Space Accessibility capture (clipboard fallback verified instead).
- Real Anthropic questions/explanations (mock provider only here).
- SupabaseStore account paths (signIn/deleteAccount code-complete, no project/keys here).
- Companion "populated" screenshot — the CDP screenshot tool hangs on a backgrounded window;
  data was verified via the store file + backend API instead (stronger than a screenshot).

## Milestone D1 — desktop app (2026-07-11)

Verified in this environment (typecheck + build clean; 5/5 unit tests; driven live over the
Chrome DevTools Protocol against the running Electron app, mock AI):
- **Floating bar** renders bottom-center (dimmed idle state confirmed by screenshot).
- **Companion app** — Wispr-Flow-style shell confirmed by screenshot: sidebar (9 sections +
  Invite/Free month/Settings/Help), serif-italic hero banner, right-rail stats, dashed
  empty feed, beta card, settings modal. Real first name resolved ("Preston").
- **Streaming widget E2E**: clipboard code → main-process secret scan → SSE from the
  `web/` backend → token-streamed explanation rendered with 5 level pills, action chips
  (Got it / Explain differently / Test me·D2), follow-up input, honest "mock AI" label.
- **Secret gate**: fake AWS key → hard **Blocked** state with masked finding
  (`AKIA************LE`); the request never left the machine. Suspect-consent path implemented.
- Backend accepts the new 5-level scale (`new`/`expert` streamed via curl + widget).

NOT yet verified (needs permissions / a human / a key):
- ⌘C selection capture via Accessibility (permission not grantable headlessly — clipboard
  fallback verified instead). Grant in System Settings → Privacy → Accessibility.
- Real Anthropic output (incl. code-fence syntax highlighting with real fenced output —
  renderer implemented, but the mock emits no fences).
- Widget drag/resize/pin/collapse ergonomics by hand; multi-display placement.
- Learning events are NOT recorded in D1 (store arrives in D2 — deliberately unwired;
  the companion shows real empty states, no fake data).

## Milestone 6 (extension era — parked)

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
