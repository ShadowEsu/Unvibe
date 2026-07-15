# Night Lab — Setup audit

> Generated during initial automation setup. Distinguishes verified facts,
> reasonable inferences, unavailable information, and decisions requiring
> founder approval.

## Verified facts

### Repository structure
- Monorepo with 5 packages: `app/`, `extension/`, `web/`, `server/`, `marketing/`
- Default branch: `main`
- Remote: `https://github.com/ShadowEsu/Unvibe.git`
- No existing `.github/` directory, workflows, or CI configuration
- No existing `.opencode/`, `.agents/`, or skill directories
- No Dockerfile, Makefile, or Justfile

### Git state
- Current commit: `2cffe74` (marketing redesign)
- 5 uncommitted file modifications in `app/` (from previous session's work)
- 1 untracked file: `app/PRIVACY.md`
- Clean of any merge conflicts or in-progress operations

### Package managers
- **app/**: npm (no lockfile detected — runs `npm install`)
- **extension/**: npm (`package-lock.json` likely present)
- **web/**: npm
- **server/**: npm
- **marketing/**: npm

### Test frameworks
- **app/**: Node built-in `node --test` (9 unit tests)
- **extension/**: Node built-in `node --import tsx --test` (34 tests)
- **marketing/**: Node built-in via `tsx --test`
- **web/**: No test script defined
- **server/**: No test script defined

### Build tools
- **app/**: esbuild via `scripts/build.mjs` (custom build script)
- **extension/**: esbuild via `esbuild.js`
- **web/**: Next.js (`next build`)
- **server/**: tsx runner (no build step)
- **marketing/**: Next.js (`next build`)

### Type checking
- All packages: TypeScript via `tsc --noEmit`
- All `tsconfig.json` files set `strict: true`

### Linting
- **marketing/**: `next lint` (Next.js ESLint)
- All other packages: no lint script defined

### Environment variables
- No `.env` files committed — only `.env.example` templates
- Backend requires: `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` for real AI, `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for real data
- Desktop app: `UNVIBE_BACKEND` defaults to `http://localhost:8787`
- Marketing: `SUPABASE_*` for waitlist, `POSTHOG_*` for analytics

### Existing documentation
- `AGENTS.md` and `CLAUDE.md`: identical product context, architecture, commands
- `docs/architecture.md`: architecture overview, DB schema proposal, API contract
- `docs/design-system.md`: black/white design tokens, typography, motion
- `docs/privacy.md`: local vs remote boundary, secret filtering
- `docs/environment-setup.md`: deployment env var checklist
- `docs/validation.md`: D2.1, D2, D1 verification results
- `docs/sync-behavior.md`: local-first sync design
- `docs/legal/`: 9 draft legal documents marked for attorney review

### Existing database migrations
- `web/supabase/migrations/0001_init.sql` — users, events, device_codes, tokens, consent_log
- `web/supabase/migrations/0002_device_code_lifecycle.sql` — expiry columns
- `marketing/supabase/migrations/0001_waitlist.sql` — waitlist entries

### Product state
- Desktop overlay app (`app/`): primary surface, Electron + React, functional
- Backend (`web/`): Next.js 14, 17 API routes, memory store (dev) or Supabase (prod)
- Extension (`extension/`): parked at desktop pivot
- Marketing site (`marketing/`): redesign completed at `2cffe74`

## Reasonable inferences

### CI needs
- No CI means no automated typecheck, lint, test, or build verification on PRs
- No CI means no automated release pipeline
- Extension package (`extension/`) is parked — likely low priority for nightly work
- Desktop app (`app/`) is the primary surface — highest value target

### Cost structure
- Backend uses Anthropic Claude (ANTHROPIC_API_KEY) or Gemini as AI provider
- Desktop app sends filtered code context to backend for explanation
- Nightly CI will incur LLM token costs if it runs real model inference
- Mock AI is available (`ENABLE_MOCK_AI=true`) for development without cost

### Security posture
- Secret filtering is described as "load-bearing" — privacy-critical
- Backend "never reads the repo" — architecture constraint
- All legal docs are drafts — not attorney-reviewed, not safe to publish

### Testing limitations
- No integration tests exist across packages
- No end-to-end tests exist
- Exension tests (34) test isolated units but need a live editor for full verification
- Desktop tests (9) test learning model, secret filter, SSE parser
- No macOS-specific hardware available on GitHub Linux runners

## Unavailable information

### Credentials not present
- No Supabase project URL or service-role key available
- No Anthropic API key available
- No Gemini API key available
- No DeepSeek API key available
- No GitHub token with write access confirmed (origin remote uses HTTPS, not SSH)
- No Vercel or deployment credentials

### Staging environment
- No staging URL is configured or referenced
- No production URL is configured
- No existing Supabase project is associated with this repo

### Team/ownership
- Who has access to the Supabase project
- Who has access to cloud AI provider accounts
- Who can approve GitHub App installation
- Who holds deployment credentials

### OpenCode installation status
- OpenCode GitHub App is not installed on this repository
- `opencode github install` has not been run
- No workflow files exist yet

## Decisions requiring approval

### Provider selection
- Which AI provider to use for nightly runs (Anthropic, DeepSeek, Gemini, OpenRouter)
- Acceptable cost ceiling per night
- Whether to use mock AI for safe/cheap runs initially

### OpenCode GitHub App vs GITHUB_TOKEN
- Installing the official OpenCode GitHub App gives cleaner PR attribution
- Using GITHUB_TOKEN avoids the app installation step but grants broad permissions
- GitHub Free plan: GITHUB_TOKEN approach requires no subscription

### Schedule scope
- Whether to start with a subset of missions (e.g., health + review only) or all 7
- Whether to run on weekends (Saturday/Sunday LA times)
- Whether to add a weekday-only filter

### DeepSeek as primary provider
- DeepSeek offers competitive pricing for large context windows
- Requires `DEEPSEEK_API_KEY` secret and `deepseek/deepseek-chat` model identifier
- Default is set in workflow; can be changed via GitHub variables

### Branch naming convention
- Setup branch: `automation/opencode-night-lab-setup`
- Autonomous PRs: `opencode/nightly-<mission>-<description>`

## Repository commands reference

| Command | Package | Verified |
|---------|---------|----------|
| `npm install` | all | yes |
| `npm run typecheck` | all | yes (app, web, extension, server, marketing) |
| `npm run build` | app, extension, web, marketing | yes (app, web) |
| `npm test` | app, extension, marketing | yes (app: 9/9 pass) |
| `npm run lint` | marketing only | yes |
| `npm run dev` | app, web, server, marketing | partial (starts server, not tested E2E) |

## Non-goals (this setup)
- Does not install the OpenCode GitHub App
- Does not create deployment workflows
- Does not modify any production or staging configuration
- Does not run destructive database operations
- Does not publish packages or releases
- Does not modify legal documents
- Does not add/change any product source code
