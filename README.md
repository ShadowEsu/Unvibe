# Unvibe

A code-comprehension layer for AI-generated code. When an AI agent or you change code,
Uncode offers a quiet review and explains **what changed and why**, using your project's
context — then checks that you understood it and tracks what you're learning.

> Codename: "Unvibe". The primary value is understanding, verifying, and retaining
> AI-written code — not generating more of it.

## Status
**Desktop-first since July 2026** — Unvibe is a desktop overlay app (`app/`): a menu-bar agent,
a tiny floating bar, movable streaming explanation widgets, and a Wispr-Flow-style companion
app. The VS Code extension (M1–M6) is parked; its logic lives on inside the desktop agent.
See [`CLAUDE.md`](CLAUDE.md) for scope and [`docs/`](docs/) for architecture, design, privacy.

## Run the desktop app (dev)
```
cd app
npm install
npm run dev          # builds + launches: ◆ in the menu bar, floating bar bottom-center
```
Select code anywhere and press **⌥ Space** (grant Accessibility when asked), or use the
clipboard fallback in the widget. Requires the backend below on localhost:8787.

## Run the backend + dashboard (dev)
```
cd web
npm install
npm run dev          # http://localhost:8787 — dashboard + AI + sync API
```
- No keys needed for dev: a **mock AI provider** and an **in-memory dev store** are used.
- `ANTHROPIC_API_KEY` → real explanations. `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → real DB.
- The extension talks to this origin (`uncode.backendUrl`, default `http://localhost:8787`).
  Run **Uncode: Sign In** in the editor to connect and sync your learning to the dashboard.

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

See [docs/validation.md](docs/validation.md) for what is verified vs. what still needs real
credentials or permissions.
