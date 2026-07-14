# Uncode

> Codename during design: "Unvibe". Product name: **Uncode**. Rename is trivial (search `uncode`).

## Product purpose
A code-comprehension layer for AI-generated code. When an AI agent or developer changes
code, Uncode detects it, offers a quiet review, explains the change **using project context**,
checks understanding, and records the learning. The value is understanding/verifying/retaining
AI-written code — not generating more code.

## Approved MVP scope (v1)
The 9-step loop: change → detect → quiet prompt → review → context-aware explanation →
level select → follow-up → (I understand / Explain differently / Test me) → save to dashboard.

- VS Code **and Cursor** extension (single extension, distributed via VSIX + Open VSX)
- Review scopes: selected code, active file, git diff (uncommitted), lightweight project summary
- 3 explanation levels: Beginner / Intermediate / Advanced
- Follow-up Q&A; one comprehension question ("Test me")
- Black-and-white companion dashboard: history, saved explanations, projects, profile
- Secret filtering **before** any remote request; per-repo consent

## v2 pivot — desktop-first (approved 2026-07-11)
Unvibe is now a **desktop overlay app** (`app/` — Electron + React, macOS-first), not
extension-first. Menu-bar agent (owns ALL network I/O + local secret filter) → tiny floating
bar (bottom-center, dim when idle) → movable/pinnable floating explanation widgets → companion
app (Home, Insights, Projects, Study, Concepts, Snippets, Briefings, Library, Profile).
**Wispr Flow is the design benchmark**: same layout system and interaction quality, ORIGINAL
assets/wording/fonts — never copy theirs. Explanations stream token-by-token; code renders as
real syntax-highlighted snippet cards. 5 levels: New/Beginner/Intermediate/Advanced/Expert.
The VS Code extension is parked (kept, not developed); backend (`web/`) is shared unchanged.

## Explicitly excluded (current)
Screen recording / OCR capture · Windows/Linux (macOS-first) · browser extension / web IDEs ·
security certification · enterprise team admin · social · mobile · complex gamification ·
custom model training / RL · vector search · local-model mode.

## Architecture summary
- **Extension (TS)** builds context locally, **filters secrets locally**, calls backend over HTTPS.
- **Backend never reads the repo.** It only receives already-filtered context. (Load-bearing rule.)
- Backend: Next.js (App Router) + Supabase (Postgres + Auth + RLS). Streaming review endpoint (SSE).
- AI layer: Vercel AI SDK provider abstraction → Anthropic Codex. Versioned prompt templates,
  structured JSON output, mandatory file/line citations.
- Full detail: `docs/architecture.md`.

## Directory structure
```
app/         Unvibe desktop overlay app (Milestone D1+) — PRIMARY surface. Electron + React:
             menu-bar agent, floating bar, explanation widgets, Wispr-Flow-style companion.
extension/   VS Code/Cursor extension (M1–M6). PARKED at the desktop pivot; logic reused in app/.
web/         Next.js backend + black-and-white dashboard (Milestone 5). Hosts the AI
             endpoints AND the learning-sync/auth API. Data layer: SupabaseStore (prod) or
             MemoryStore (dev). SQL in web/supabase/migrations.
server/      Legacy standalone AI-only dev harness (Milestone 2). Superseded by web/ for the
             full backend; kept for quick AI iteration without Next.js.
docs/        architecture.md · design-system.md · privacy.md
```

> M5 note: the AI provider/prompt modules were migrated into web/src/ai (Next.js API routes).
> The data layer is an abstraction — Supabase in prod (needs SUPABASE_URL + service-role key),
> a labelled in-memory dev store otherwise. Auth is a device-code flow issuing bearer tokens.

## Coding conventions
- TypeScript strict. No `any` without a comment justifying it.
- Small modules, single responsibility. Dispose everything (`vscode.Disposable`).
- No network calls from the webview — the extension host owns all I/O so secret filtering
  cannot be bypassed.
- Label unfinished behavior explicitly in code and UI (e.g. "Milestone 2"). Never present
  mock output as real.

## Design rules (see docs/design-system.md)
Strict black / white / restrained grays. No gradients, no color status, no AI glow, no
shadow-heavy cards. Calm, minimal, high-readability. Every surface handles loading, empty,
error, and offline states. Keyboard-operable. Respects editor light/dark.

## Privacy rules (see docs/privacy.md)
Default-exclude `.env`, keys, tokens, `node_modules`, build output, binaries. Support
`.gitignore` + `.unvibeignore`. Secret scan before every remote request. User can preview
exactly what will be transmitted before enabling cloud analysis per repo. No training on
private repos. Metadata-only logging.

## Testing requirements
Unit (diff parse, secret filter, context build, mastery, prompt-output parse) · extension
(selection, git, panel, commands, keyboard) · AI eval (correctness, hallucination, citations,
level fit) · privacy (.env exclusion, token detection, delete flow) · UI states · one E2E of
the full loop. See `docs/` for the strategy as it lands.

## Commands
```
# desktop app (primary)
cd app
npm install
npm run build       # esbuild: main + preload + renderers
npm run typecheck   # tsc --noEmit
npm test            # node --test (SSE parser, secret filter)
npm start           # launch — expects backend at localhost:8787 (UNVIBE_BACKEND overrides)

# extension (parked)
cd extension
npm install
npm run build       # esbuild bundle
npm run watch       # rebuild on change
npm run typecheck   # tsc --noEmit
npm test            # node --test unit tests (secret filter, diff parse, parsers)
# then press F5 in VS Code to launch the Extension Development Host

# backend + dashboard (full)
cd web
npm install
npm run dev         # http://localhost:8787 — dashboard + AI + sync API
npm run build       # next build
npm run typecheck   # tsc --noEmit
# env: ANTHROPIC_API_KEY (real AI, else mock) · SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
#      (prod store, else dev MemoryStore). See web/.env.example.

# AI-only dev harness (optional)
cd server
npm install && npm run dev   # http://localhost:8787 (mock unless ANTHROPIC_API_KEY set)
```

## Definition of done (strict)
A feature is done only when: happy path works AND loading/empty/error/offline states exist
AND it is keyboard-operable AND secrets never leave the machine AND (if it records learning)
the event is correctly stored. Passing only the happy path is NOT done. Do not claim tests
passed without running them.

## Documentation rules
Keep AGENTS.md concise and durable. Long procedures go in `docs/` or Codex skills, not here.

## Change-control rule
No major dependency or architecture change may be made without first explaining the tradeoff
(decision · why · alternatives · tradeoffs) and getting sign-off. Schema changes are
additive-only unless a destructive change is explicitly justified.
