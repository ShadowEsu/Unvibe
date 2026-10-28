# Unvibe
unvibe.site

A code-comprehension layer for AI-generated code. When an AI agent or you change code,
Unvibe offers a quiet review and explains **what changed and why**, using your project's
context, then checks that you understood it and tracks what you're learning.

**Just want the app?** Download it free for Mac or Windows at [unvibe.site](https://unvibe.site).
No API key is needed. Select code and press **Control+U** on Mac or **Ctrl+Alt+U** on Windows.

> The primary value is understanding, verifying, and retaining AI-written code, not
> generating more of it.

## Status
**Desktop-first since July 2026** — Unvibe is a desktop overlay app (`app/`): a menu-bar agent,
a tiny floating bar, movable streaming explanation widgets, and a Wispr-Flow-style companion
app. The VS Code extension (M1–M6) is parked; its logic lives on inside the desktop agent.
See [`CLAUDE.md`](CLAUDE.md) for scope and [`docs/`](docs/) for architecture, design, privacy.

## Run the launch website (marketing)
```
cd marketing
npm install
npm run dev          # http://localhost:3000 — waitlist + product storytelling
```
See [`marketing/README.md`](marketing/README.md) for env vars, Supabase waitlist migration,
and Vercel deploy steps. This site is separate from the product backend in `web/`.

## Run the desktop app (dev)
```
cd app
npm install
npm run dev          # builds + launches: ◆ in the menu bar, floating bar bottom-center
```
Select code anywhere and press **Control+U** on Mac or **Ctrl+Alt+U** on Windows (on Mac,
grant Accessibility when asked; the shortcut can be changed in Settings), or use the clipboard
fallback in the widget. Expects the backend below on localhost:8787 (`UNVIBE_BACKEND` overrides).

## Run the backend + dashboard (dev)
```
cd web
npm install
npm run dev          # http://localhost:8787 — dashboard + AI + sync API
```
- No keys needed for dev: a **mock AI provider** and an **in-memory dev store** are used.
- Real explanations need one provider key on the backend only (first one set wins):
  `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY` / `GOOGLE_API_KEY`
  (see `web/src/ai/index.ts`). App users never supply a key.
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → real DB.
- The VS Code / Cursor Desktop Bridge (`extension/`) only hands the editor's selection to the
  desktop app; it makes no network calls of its own.

`server/` is an optional AI-only dev harness (superseded by `web/`).

## Milestones
1. ✅ Extension skeleton + detection
2. ✅ AI layer + context builder + secret filter (streaming explanations)
3. ✅ Project-summary scope + clickable, validated file/line citations
4. ✅ Comprehension checks + local persistence (streak, mastery, history)
5. ✅ Dashboard + auth + sync (AI endpoints migrated into Next.js)
6. ✅ States, polish, validation — offline outbox, retry, hardening, dashboard verified

**Desktop milestones (v2 pivot):**

- D1. ✅ Electron agent + floating bar + streaming explanation widget + companion shell
- D2. ✅ Local learning store + in-widget comprehension + accounts (login / sign-out /
  delete-account) + sync + real data in Home & Progress + logo ← current
- D3. Repo indexing + git-diff reviews + project scope from the desktop agent
- D4. Change Brief (real git scopes), Why this exists (blame/log facts), local knowledge objects + change-driven freshness, opt-in voice, Teach it back

See [docs/validation.md](docs/validation.md) for what is verified vs. what still needs real
credentials or permissions.
