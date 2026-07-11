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

## Milestones
1. **Extension skeleton + detection** ← current
2. AI layer + context builder + secret filter (streaming explanations)
3. Review scopes + levels + citations
4. Comprehension + follow-ups + persistence
5. Dashboard + auth + sync
6. States, polish, validation
