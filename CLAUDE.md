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

## Explicitly excluded from v1
System-wide desktop capture / always-on desktop bar · IDEs beyond VS Code+Cursor ·
browser extension / web IDEs · security certification · enterprise team admin · social ·
mobile · complex gamification · custom model training / RL · vector search · briefings ·
5-mode explanation set · local-model mode · non-English explanations.

## Architecture summary
- **Extension (TS)** builds context locally, **filters secrets locally**, calls backend over HTTPS.
- **Backend never reads the repo.** It only receives already-filtered context. (Load-bearing rule.)
- Backend: Next.js (App Router) + Supabase (Postgres + Auth + RLS). Streaming review endpoint (SSE).
- AI layer: Vercel AI SDK provider abstraction → Anthropic Claude. Versioned prompt templates,
  structured JSON output, mandatory file/line citations.
- Full detail: `docs/architecture.md`.

## Directory structure
```
extension/   VS Code/Cursor extension (Milestone 1+)
server/      AI explanation service — streaming SSE, swappable provider (Milestone 2).
             Framework-agnostic; its provider/prompt modules migrate into web/ at M5.
web/         Next.js dashboard + backend API (Milestone 5)   [not yet created]
docs/        architecture.md · design-system.md · privacy.md
```

> M2 decision (change-control): the AI service is a dependency-free standalone Node service
> for now rather than the Next.js app, because M2 needs only a streaming endpoint. The
> provider/prompt modules are framework-agnostic and move into Next.js API routes at M5.

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
# extension
cd extension
npm install
npm run build       # esbuild bundle
npm run watch       # rebuild on change
npm run typecheck   # tsc --noEmit
npm test            # node --test unit tests (secret filter, diff parse, parsers)
# then press F5 in VS Code to launch the Extension Development Host

# AI service
cd server
npm install
npm run dev         # http://localhost:8787 (MOCK provider; no key needed)
ANTHROPIC_API_KEY=sk-ant-... npm run dev   # real analysis
```

## Definition of done (strict)
A feature is done only when: happy path works AND loading/empty/error/offline states exist
AND it is keyboard-operable AND secrets never leave the machine AND (if it records learning)
the event is correctly stored. Passing only the happy path is NOT done. Do not claim tests
passed without running them.

## Documentation rules
Keep CLAUDE.md concise and durable. Long procedures go in `docs/` or Claude Code skills, not here.

## Change-control rule
No major dependency or architecture change may be made without first explaining the tradeoff
(decision · why · alternatives · tradeoffs) and getting sign-off. Schema changes are
additive-only unless a destructive change is explicitly justified.
