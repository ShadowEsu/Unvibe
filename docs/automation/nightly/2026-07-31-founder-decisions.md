# Founder Decisions Required — 2026-07-31

**Mission:** competitor-research-and-v2

## Decisions Needed

### 1. PR could not be auto-created (GitHub Actions token lacks PR permissions)
The research branch `opencode/nightly-competitor-research-and-v2-learning-retention` was pushed
successfully, but `gh pr create` failed with:
`GraphQL: GitHub Actions is not permitted to create or approve pull requests (createPullRequest)`.

Same limitation as the 2026-07-24 run (see `2026-07-24-founder-decisions.md`). To create the PR manually:
https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-competitor-research-and-v2-learning-retention

Or, provide a fine-grained PAT with `pull requests: write` scope so future night-lab runs can open PRs autonomously.

### 2. Adopt the v1 "loop closure" recommendation?
The report recommends closing Unvibe's existing learning loop as the next v1 step:
- Wrong quiz answer → lesson appears at the top of the Study queue labelled "Revisit today — 1 min"
- Correct quiz answer → keep the existing 1/3/7/14-day spaced schedule (`computeReviewQueue`)

Most of the pieces already exist (`needs_review` outcome, quiz cards, review queue). The work is
wiring, not new learning science. Approval would make this a v1 scope item.

### 3. Level gating by demonstrated understanding (v2)?
Jiki (Exercism founder's LLM-era product) disables language features until the learner earns them
("foot-gun removal"). The report's v2 recommendation is the analogous Unvibe pattern: keep the
Advanced/Expert explanation level *suggested-but-locked* until the user passes an intermediate-level
"Test me" on that concept — always a gentle suggestion, never a hard block. Requires a UX decision
on how lockouts surface without violating the "never block the user" rule.

### 4. Repo variables not readable by night lab
`gh variable list` returned HTTP 403 (Resource not accessible by integration). NIGHT_LAB_* variables
could not be confirmed; defaults were used (research-only, low risk). If the night lab should read
these, the workflow needs `actions: read` variable access.

## No Critical Issues
- No security or privacy concerns: the report only reuses existing on-device `LocalEvent` fields and
  preserves the secret-filter-before-send boundary and `forSync` local-only lesson bodies.
- No code was modified; no dependencies changed.
