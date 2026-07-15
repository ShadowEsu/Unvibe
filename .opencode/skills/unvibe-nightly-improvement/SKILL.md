---
name: unvibe-nightly-improvement
description: Scheduled overnight improvement for the Unvibe repository. Inspects code, runs checks, fixes low-risk defects, and prepares a morning handoff. Loaded by the Night Lab GitHub Action.
license: MIT
---

# Unvibe Nightly Improvement

## Every Run

1. Read AGENTS.md.
2. Inspect recent commits (`git log --oneline -10`).
3. Inspect open automated PRs.
4. Read the previous nightly summary from `docs/automation/nightly/`.
5. Select one focused mission (based on cron schedule or manual override).
6. Load only the skills relevant to that mission — never load all skills.
7. Avoid duplicate work — if an open PR already covers the issue, skip it.
8. Run applicable checks.
9. Make one contained improvement.
10. Use a branch named `opencode/nightly-<mission>-<description>`.
11. Create no more than one PR per run.
12. Report exact verification results.
13. Leave a morning handoff summary.

## Available Missions

### repository-health
Install deps, run typecheck, tests, builds. Inspect recent changes. Add one regression test. Fix one low-risk defect. If everything passes, update report.

### backend-and-sync
Inspect auth, account lifecycle, sync, storage, RLS, offline queues, retry, idempotency. Static inspection only — never run production DB commands.

### desktop-overlay
Inspect Electron main process, IPC, preload, accessibility, windows, widget. macOS behaviour must be labelled "unverified on Linux runner".

### ai-learning-engine
Inspect context construction, prompt templates, streaming, comprehension questions, concept extraction. Improve one measurable behaviour per run.

### competitor-research-and-v2
Research one focused question about code explanation products, desktop overlays, or developer education. Store in `docs/research/automated/`.

### product-design-and-accessibility
Choose one product flow. Audit it. Improve a contained issue. Fix responsiveness, accessibility, or missing states. No full redesign.

### integration-review-and-morning-summary
Review all PRs and reports from tonight. Create morning summary. Never merge.

## Verification Standards

- Every code change must pass `npm run typecheck` in the changed package.
- Every code change must compile.
- Tests must be run and results reported — not assumed.
- macOS-only behaviour must be labelled "unverified on Linux runner".
- Mock AI results must be labelled "mock AI — real key required for verification".
- PR must include exact test names and results.

## PR Requirements

Every PR description must contain:
- Mission.
- Why this was selected.
- Evidence.
- Root cause.
- Changes.
- Files changed.
- Tests actually run.
- Exact results.
- What was not verified.
- Risk level.
- Security and privacy impact.
- Performance impact.
- Manual review steps.
- Rollback plan.
- Recommended next action.

Branch format: `opencode/nightly-<mission>-<description>`.
PR title format: `[OpenCode Night Lab] <specific result>`.

## Forbidden Actions

- Merge PRs.
- Modify `.github/workflows/` files.
- Commit API keys, `.env` files, or credentials.
- Run production database commands.
- Deploy or publish.
- Rewrite the entire application.
- Change legal or privacy promises.
- Contact users, investors, or partners.
