# Unvibe Implementation Report

## Completed

- Architecture audit at `docs/UNVIBE_ARCHITECTURE_CURRENT.md`
- Change Brief from real git: working tree, staged, latest commit, branch vs base
- Companion Briefings page (no longer placeholder copy)
- Why this exists: git blame + log facts, separate inference, no invented rationale
- Local knowledge objects with PRIVATE/TEAM, verification, change-driven freshness
- Teach it back free-text evidence (not an intelligence score)
- Opt-in voice hold-to-ask using system speech recognition
- Quiet Live git watch (flagged, debounced, snoozable, respects quiet hours)
- Provider aliases plus speech/embedding interfaces (cloud speech not wired)
- Reviews API session/trial gate and context size limit
- Feature flags in settings without resetting onboarding
- Unit tests for brief, origin, freshness, teach-back, metrics, citations
- Additive Supabase tables for future knowledge sync

## Partially Completed

- Understanding Coverage / Gap / Risk: formulas and tests only, no org dashboard
- TEAM visibility stored locally, not synced
- Live mode: Island text only, no 30-second briefing UI
- Voice: system STT only; Deepgram/local providers are interfaces
- Local/private weights inference: BYOK only
- Reviews still use legacy `consumeUsage` for signed-in users (plus the new gate)

## Not Implemented

- GitHub App, org install, PR Intelligence page, Ask Engineering
- Shared team accounts, member profiles, knowledge concentration UI
- Engineering onboarding, context handoff, weekly brief, decision capture
- Local embeddings / offline model runtime
- PostHog product-event wiring from the desktop (events are named, not sent)

## Architecture Changes

Desktop gained `changeBrief`, `codeOrigin`, `knowledge`, `teachBack`, `understandingMetrics`, `knowledgeStore`, and `liveWatch`. Companion Briefings is a real git surface. Widget gained origin, teach-back, and optional voice.

## Database Changes

Additive `knowledge_objects` and `understanding_checks` with RLS. Desktop JSON remains the live store.

## New APIs

IPC only: `brief:build`, `origin:lookup`, `knowledge:list|verify|refresh`, `teachback:grade`, `live:snooze`. No new public HTTP routes.

## New UI

Companion Briefings. Widget Why this exists, Teach it back, Hold to ask. Settings Learning flags.

## Security Improvements

Cloud reviews require session or trial when not mock. Context cap. Human-verified knowledge is not overwritten by AI upserts. Voice default off. Analytics helpers reject source-shaped keys.

## Tests Added

`app/test/changeBrief.test.ts`, `web/test/knowledge.test.ts`. Existing secret-filter and git parse tests remain.

## Migrations Required

Apply `web/supabase/migrations/20260919010000_knowledge_objects.sql` on Supabase. Safe if unused; desktop does not depend on it yet.

## Environment Variables Required

No new required variables. Existing: `OPENROUTER_API_KEY` or `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`, optional `UNVIBE_TRIAL_TOKEN`, Supabase keys for sync.

## External Setup Preston Must Complete

- Apply the knowledge migration if you want cloud-ready tables
- Do not create a GitHub App until product is ready to install one
- Grant Accessibility (existing) and Microphone only if enabling voice

## Known Limitations

- Change Brief needs a remembered or picked git root
- Blame fails on untracked files and reports no documented rationale
- Branch compare needs `origin/main`, `main`, or an upstream
- Chromium speech may send audio to the system speech service
- Teams metrics and GitHub ingest are intentionally unshipped

## Recommended Next 5 Engineering Tasks

1. GitHub App (read-only) with per-repo selection and incremental PR ingest
2. Upload knowledge metadata (not bodies) when signed in, with tenant checks
3. PR Intelligence page using ingested PR + local brief
4. Ask Engineering with inspectable citations
5. Wire named product events to PostHog without source or prompts
