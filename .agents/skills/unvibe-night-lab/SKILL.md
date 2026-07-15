---
name: unvibe-night-lab
description: Autonomous overnight engineering system for the Unvibe repository. Inspects code, runs tests, fixes low-risk defects, improves coverage, researches competitors, explores v2 opportunities, and prepares morning summaries.
license: MIT
compatibility: opencode
metadata:
  audience: automation
  workflow: github-actions
---

# Unvibe Night Lab

## Product context

Unvibe (codename: Uncode) is a code-comprehension desktop overlay app.
- **app/** — Electron + React, macOS-first, primary surface
- **web/** — Next.js backend + dashboard, AI endpoints, auth/sync API
- **extension/** — VS Code/Cursor extension (parked, not developed)
- **server/** — Legacy AI dev harness (superseded by web/)
- **marketing/** — Launch website

Key rules:
- Secret filtering happens on-device, never in the backend
- The backend never reads the repository
- Black-and-white design system, no gradients, no color status
- AI provider: Anthropic Codex via Vercel AI SDK

## Mission definitions

### repository-health
Install deps, run typecheck, tests, builds. Inspect recent changes. Add one
regression test. Fix one low-risk defect. If everything passes, update report.

### backend-and-sync
Inspect auth, account lifecycle, sync, storage, RLS, offline queues, retry,
idempotency. Static inspection only — never run production DB commands.

### desktop-overlay
Inspect Electron main process, IPC, preload, accessibility, windows, widget.
Test cross-platform logic. Label macOS-only behavior.

### ai-learning-engine
Inspect context construction, prompt templates, streaming, comprehension
questions, concept extraction. Improve one measurable behavior per run.

### competitor-research-and-v2
Research one focused question about code explanation products, desktop
overlays, or developer education. Store in docs/research/automated/.

### product-design-and-accessibility
Choose one product flow. Audit it. Improve a contained issue. Fix
responsiveness, accessibility, or missing states. No full redesign.

### integration-review-and-morning-summary
Review all PRs and reports from tonight. Create morning summary. Never merge.

## Permissions

- You may read any file in the repository
- You may create branches prefixed `opencode/nightly-`
- You may open PRs, but never auto-merge
- You may create files in `docs/research/automated/`
- You may create files in `docs/` (reports, summaries)
- You may install npm dependencies
- You may run tests, typecheck, build
- You may fix low-risk defects
- You may add regression tests
- You may create isolated prototypes (feature-flagged or in `docs/`)

## Forbidden actions

- Merge into `main` or any non-`opencode/nightly-` branch
- Deploy production, publish release, or run `dist:*` scripts
- Modify billing, credentials, secrets, or deployment config
- Run destructive production database operations
- Delete user data
- Rewrite the entire application
- Change legal or privacy promises
- Add unsupported product claims
- Fabricate users, analytics, traction, integrations, or test results
- Contact users, investors, or partners
- Auto-approve or auto-merge its own PRs
- Commit any real API key or secret to tracked files
- Add any `.env` file to version control
- Modify `.github/workflows/` (night lab setup itself)
- Run `electron-builder`, `dist`, `dmg`, or packaging commands
- Remove or alter supabase migration files without additive-only changes

## Cost controls

- Use `$OPENCODE_SMALL_MODEL` for scanning, tests, documentation, basic fixes
- Use `$OPENCODE_NIGHT_MODEL` for main work
- Use `$OPENCODE_REVIEW_MODEL` only for architecture review or failures
- Stop early when no useful work is available
- Skip work already handled by an open PR
- Avoid sending `node_modules/`, `dist/`, `.next/`, `release/` as context
- Maximum one PR per run
- Maximum one mission per run
- Do not make unnecessary model calls after tests establish the answer

## Verification standards

- Every code change must pass `npm run typecheck` in the changed package
- Every code change must compile (build where applicable)
- Tests must be run and results reported — not assumed
- macOS-only behavior must be labelled "unverified on Linux runner"
- Mock AI results must be labelled "mock AI — real key required for verification"
- PR must include exact test names and results

## PR standards

Every PR description must contain:
- Mission
- Why this was selected
- Evidence
- Root cause
- Changes
- Files changed
- Tests actually run
- Exact results
- What was not verified
- Risk level
- Security and privacy impact
- Performance impact
- Manual review steps
- Rollback plan
- Recommended next action

Branch format: `opencode/nightly-<mission>-<description>`
PR title format: `[OpenCode Night Lab] <specific result>`

## Reporting standards

Morning summary (in `docs/automation/nightly/YYYY-MM-DD-summary.md`):
- Current repository health
- Recent code inspected
- Problems discovered
- PRs created
- Research completed
- Tests run
- Failures
- Unverified behavior
- Security or privacy concerns
- Required founder decisions
- Recommended review order
- Recommended merge order
- Suggested next daytime task

Competitor research (in `docs/research/automated/`):
- Research question
- Dated sources
- Observed product behavior
- User problem addressed
- Why it may work (or not)
- Limitations
- What Unvibe can learn
- What Unvibe should avoid copying
- Original Unvibe interpretation
- Expected user benefit
- Technical difficulty
- Security and privacy considerations
- Smallest validation experiment
- v1, v2, or later recommendation

## Design principles

- Professional, calm, minimal
- Soft white and purple palette (matching existing design system)
- Controlled semantic accent colors
- Generous whitespace
- Clear code presentation
- Subtle purposeful motion
- Not childish, not excessively gamified
- Not copied from another product

## Privacy standards

- No code leaves the repository unmodified (secret filtering is preserved)
- No credentials are committed to tracked files
- No Supabase service-role key is placed in app or renderer code
- No user data is fabricated, reused, or exported
- All research uses public sources only

## Competitor research rules

- Use public sources only (product websites, docs, published research)
- Never copy proprietary text, assets, designs, code, or exact animations
- No fake screenshots or simulated product behavior
- Attribute all observations to their source
- Label speculation clearly

## Morning handoff

The integration-review mission produces the morning handoff. It must:
1. Inspect every PR created during this night's runs
2. Inspect every report created
3. Identify overlapping files, incompatible recommendations, duplicates
4. Identify missing verification, risky code
5. Identify macOS testing requirements
6. Identify required staging credentials
7. Recommend review order, merge order, rejected/deferred changes
8. Rerun safe repository-level checks when appropriate
9. Write summary to `docs/automation/nightly/YYYY-MM-DD-summary.md`
