# Unvibe (codename: Uncode)

## Product
A code-comprehension desktop overlay app. Detects AI-written code changes, explains them in project context, and records learning.

## Repository
- `app/` — Electron + React (macOS-first, primary surface)
- `web/` — Next.js backend + Supabase dashboard
- `extension/` — VS Code/Cursor extension (parked)
- `server/` — Legacy AI dev harness (superseded by web/)
- `marketing/` — Launch website
- `docs/` — Architecture, design, privacy, automation

## Commands
```
app:   npm run typecheck && npm test && npm run build
web:   npm run typecheck && npm run build
       npm run dev (http://localhost:8787)
```

## Key Rules
- TypeScript strict. No `any` without justification.
- Secret filtering on-device. Backend never reads the repo.
- Strict B&W design system. Restrained semantic accent colours.
- Every surface: loading, empty, error, offline, keyboard-operable.
- Done = happy path + states + keyboard + privacy + persistence. Happy path alone is NOT done.
- No upstream dependency or architecture change without sign-off.
- Schema changes: additive-only unless justified destructive.

## Agent System
- Skills: `.opencode/skills/` and `.agents/skills/`
- Agents: architect, implementer, test-engineer, security-reviewer, product-designer, researcher, integration-reviewer
- MCP: Context7 (docs), GitHub MCP (PRs, issues, repos)
- Default model: DeepSeek V4 Flash. Configured in `opencode.json`.
- Branch policy: No direct commits to main. PRs only.
