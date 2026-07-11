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

## Run the AI service (dev)
```
cd server
npm install
npm run dev          # http://localhost:8787 — MOCK provider, no API key needed
```
Set `ANTHROPIC_API_KEY` for real explanations. The extension calls this service; configure
its URL with the `uncode.backendUrl` setting (default `http://localhost:8787`).

## Milestones
1. ✅ Extension skeleton + detection
2. ✅ AI layer + context builder + secret filter (streaming explanations) ← current
3. Review scopes + levels + citations (polish + AST-precise scoping)
4. Comprehension + follow-ups + persistence
5. Dashboard + auth + sync (migrate service into Next.js)
6. States, polish, validation
