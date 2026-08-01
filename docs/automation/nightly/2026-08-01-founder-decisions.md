# Founder Decisions Required — 2026-08-01

**Mission:** competitor-research-and-v2

## Decisions Needed

### 1. PR could not be auto-created (GitHub Actions token lacks PR permissions)
The research branch `opencode/nightly-competitor-research-and-v2-ai-change-communication` was pushed
successfully, but `gh pr create` failed with:
`GitHub Actions is not permitted to create or approve pull requests (createPullRequest)`.

Same known limitation as the 2026-07-24 and 2026-07-31 runs. The workflow grants `pull-requests: write`
at the job level (`.github/workflows/unvite-autonomous-night-lab.yml`), but the repo-level Actions token
policy appears to forbid PR creation — the token reports `pull-requests: read` in practice. To create
the PR manually:
https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-competitor-research-and-v2-ai-change-communication

Or, provide a fine-grained PAT with `pull requests: write` scope (or enable "Allow GitHub Actions to
create and approve pull requests" in repo settings) so future night-lab runs can open PRs autonomously.

### 2. Adopt the v1 "understand-before-approve" framing?
The report recommends three cheap, low-risk v1 changes to Unvibe's overlay widget:
- **Bottleneck-framing copy** in the quiet prompt: "The AI changed N files. Verify you understand
  before you approve — revert anytime with git." (Industry's own framing: Devin Review's docs say
  "the bottleneck shifts from writing code to reviewing it.")
- **Provenance labelling** on the explanation widget: mark reviews as an "independent read of the
  change" (honest only if the backend truly uses a distinct review context/prompt — otherwise it must
  not be called independent).
- **Hunk-grouped change presentation**: group git hunks by semantic change instead of raw file order.

These are copy/presentation changes on existing code paths (`app/src/core/gitDiff.ts`, quiet-prompt
template, widget) — no new backend surface. Approval would make them v1 scope items.

### 3. Explicit decision: do NOT compete on the correctness-review niche?
The report observes Devin Review (ACU-billed), Cursor Bugbot, and Devin Quick Review all compete in
"AI reviews AI code for bugs/security." The recommendation is that Unvibe stay in the comprehension
lane (explain-for-understanding + "Test me") and not add bug-catching/security-scanning features.
This keeps Unvibe adjacent to, not competing with, entrenched players — but it is a product-direction
call the founder should ratify.

### 4. Repo variables not readable by night lab
`gh variable list` returned HTTP 403 (Resource not accessible by integration). NIGHT_LAB_* variables
could not be confirmed; defaults were used (research-only, low risk). If the night lab should read
these, the workflow needs `actions: read` variable access.

## No Critical Issues
- No security or privacy concerns: the report preserves the secret-filter-before-send boundary and
  explicitly defers reversion machinery to Git rather than building checkpoints.
- No code was modified; no dependencies changed.
