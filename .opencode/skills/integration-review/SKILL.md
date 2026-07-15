---
name: integration-review
description: Cross-branch review, merge ordering, and morning handoff preparation. Loaded by the integration-reviewer agent when inspecting multiple changes or preparing a daily summary.
license: MIT
---

# Integration Review

## Process

1. **Collect** — Identify all branches, PRs, and reports created since the last review.
2. **Inspect** — For each change, read:
   - The diff (`git diff main...branch`).
   - The test results.
   - The PR description.
3. **Detect conflicts** — Identify:
   - Overlapping files between branches.
   - Incompatible recommendations.
   - Missing verification.
   - Risky code (auth, security, data, Electron IPC).
   - macOS-only behaviour labelled as unverified.
4. **Assess readiness** — For each change, determine:
   - Changes are safe and isolated.
   - Tests pass.
   - Typecheck passes.
   - Build passes.
   - No secrets committed.
   - No unintended files changed.
5. **Recommend order** — Merge order by risk:
   - Documentation and CI changes first (lowest risk).
   - Bug fixes second.
   - Features third.
   - Architecture changes last (highest risk).
6. **Write morning summary** — Must be readable in under 5 minutes:
   - Repository health (builds, tests, typecheck).
   - Changes inspected.
   - Problems discovered.
   - PRs created (with links).
   - Research completed.
   - Tests run and results.
   - Failures and unresolved issues.
   - Security or privacy concerns.
   - Required founder decisions.
   - Recommended review order.
   - Recommended merge order.
   - Suggested next daytime task.

## Output

Write the summary to `docs/automation/nightly/YYYY-MM-DD-summary.md`.

## Restrictions

- Never merge PRs.
- Never modify code — this agent is read-only.
- Never deploy or publish.
- Never modify `.github/workflows/`.
