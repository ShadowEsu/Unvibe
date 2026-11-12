# Unvibe

Select code in any app, press Control+U (Ctrl+Alt+U on Windows), and Unvibe explains it in plain English beside your editor, at the depth you pick.

**[Download free for Mac and Windows](https://unvibe.site/?utm_source=github&utm_medium=readme&utm_campaign=repo-readme)** · [Releases](https://github.com/ShadowEsu/Unvibe/releases) · [First-open help](https://unvibe.site/install-help?utm_source=github&utm_medium=readme&utm_campaign=repo-readme)

Unvibe is a free desktop app for Mac and Windows that explains code in plain English. Select code in any app, press Control+U (Ctrl+Alt+U on Windows), and a panel opens beside your editor with an explanation at the depth you pick, from New to Advanced. Ask follow-up questions, check yourself with Test me, and save what you learn to your Library. Keys and tokens are checked for on your computer before anything is sent. No API key and no card. AI explanations can be wrong, so check them against the code.

Apple hasn't verified Unvibe yet, so the first open takes a few extra steps in System Settings. The [first-open help](https://unvibe.site/install-help?utm_source=github&utm_medium=readme&utm_campaign=repo-readme) walks through them for Mac and Windows.

**Or try it in your browser first:** paste a snippet at [unvibe.site/explain](https://unvibe.site/explain?utm_source=github&utm_medium=readme&utm_campaign=repo-readme) and Vibe explains what it does in plain English, free, no account. There is a page per language and tool, each with its own sample: [Explain git rebase code](https://unvibe.site/explain/git-rebase?utm_source=github&utm_medium=readme&utm_campaign=repo-readme), [Explain Python tracebacks](https://unvibe.site/explain/python-traceback?utm_source=github&utm_medium=readme&utm_campaign=repo-readme), [Explain CORS errors](https://unvibe.site/explain/cors-error?utm_source=github&utm_medium=readme&utm_campaign=repo-readme) and [Explain Bash code](https://unvibe.site/explain/bash?utm_source=github&utm_medium=readme&utm_campaign=repo-readme).

## Develop

### Status
**Desktop-first since July 2026.** Unvibe is a desktop overlay app (`app/`): a menu-bar agent,
a tiny floating bar, movable streaming explanation widgets, and a Wispr-Flow-style companion
app. The VS Code extension (M1 to M6) is parked; its logic lives on inside the desktop agent.
See [`CLAUDE.md`](CLAUDE.md) for scope and [`docs/`](docs/) for architecture, design, privacy.

### Run the launch website (marketing)
```
cd marketing
npm install
npm run dev          # http://localhost:3000: waitlist + product storytelling
```
See [`marketing/README.md`](marketing/README.md) for env vars, Supabase waitlist migration,
and Vercel deploy steps. This site is separate from the product backend in `web/`.

### Run the desktop app (dev)
```
cd app
npm install
npm run dev          # builds + launches: ◆ in the menu bar, floating bar bottom-center
```
Select code anywhere and press **Control+U** on Mac or **Ctrl+Alt+U** on Windows (on Mac,
grant Accessibility when asked; the shortcut can be changed in Settings), or use the clipboard
fallback in the widget. Expects the backend below on localhost:8787 (`UNVIBE_BACKEND` overrides).

### Run the backend + dashboard (dev)
```
cd web
npm install
npm run dev          # http://localhost:8787: dashboard + AI + sync API
```
- No keys needed for dev: set `ENABLE_MOCK_AI=true` for the labelled **mock AI provider**; an
  **in-memory dev store** is used.
- Real explanations need `ANTHROPIC_API_KEY` on the backend only: every AI route uses Anthropic's
  Claude API and no other provider (see `web/src/ai/index.ts`). App users never supply a key.
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → real DB.
- The parked VS Code extension talks to this origin (setting `uncode.backendUrl`, default
  `http://localhost:8787`; its sign-in command still uses the old name, **Uncode: Sign In**).

`server/` is an optional AI-only dev harness (superseded by `web/`).

### Milestones
1. ✅ Extension skeleton + detection
2. ✅ AI layer + context builder + secret filter (streaming explanations)
3. ✅ Project-summary scope + clickable, validated file/line citations
4. ✅ Comprehension checks + local persistence (mastery, history)
5. ✅ Dashboard + auth + sync (AI endpoints migrated into Next.js)
6. ✅ States, polish, validation: offline outbox, retry, hardening, dashboard verified

**Desktop milestones (v2 pivot):**

- D1. ✅ Electron agent + floating bar + streaming explanation widget + companion shell
- D2. ✅ Local learning store + in-widget comprehension + accounts (login / sign-out /
  delete-account) + sync + real data in Home & Progress + logo ← current
- D3. Repo indexing + git-diff reviews + project scope from the desktop agent
- D4. Change Brief (real git scopes), Why this exists (blame/log facts), local knowledge objects + change-driven freshness, opt-in voice, Teach it back

See [docs/validation.md](docs/validation.md) for what is verified vs. what still needs real
credentials or permissions.
