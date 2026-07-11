# Uncode

A code-comprehension layer for AI-generated code. When an AI agent or you change code,
Uncode offers a quiet review and explains **what changed and why**, using your project's
context — then checks that you understood it and tracks what you're learning.

> Codename: "Unvibe". The primary value is understanding, verifying, and retaining
> AI-written code — not generating more of it.

## Status
Early MVP build. **Milestone 1** (extension skeleton + change detection) is in `extension/`.
See [`CLAUDE.md`](CLAUDE.md) for scope and [`docs/`](docs/) for architecture, design, privacy.

## Run the extension (dev)
```
cd extension
npm install
npm run build
```
Open this folder in VS Code or Cursor and press **F5** to launch the Extension Development Host.
A "Uncode" item appears in the status bar and an Uncode view in the Activity Bar.

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
6. ✅ States, polish, validation — offline outbox, retry, hardening, dashboard verified ← current

The MVP loop is complete end-to-end. See [docs/validation.md](docs/validation.md) for what is
verified vs. what still needs real credentials or a live-editor (F5) run.
