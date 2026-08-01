# Night Lab report — ai-learning-engine (2026-08-01)

Mission: `ai-learning-engine`. Branch: `opencode/nightly-ai-learning-engine-review-queue-due-order`
(commit `76b33a5`).

## Status
- Code change complete and pushed. PR creation **blocked**: the repo setting "Allow GitHub
  Actions to create and approve pull requests" is disabled, so the automation token receives
  403 on GraphQL `createPullRequest` (same blocker as the 2026-07-31 run). The branch is ready;
  a founder (or any user with write access) can open the PR from
  https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-ai-learning-engine-review-queue-due-order
  targeting `main`.

## Change (summary)
The spaced review queue (`computeReviewQueue` in `app/src/core/learning.ts`) sorted
due-understood lessons **oldest-first**, so an ancient lesson permanently held a queue slot
while a lesson that had just crossed its 1-day interval was pushed past the `limit` and never
shown. The queue now sorts most-recently-due first, so fresh material is reinforced before
stale material and the limit graduates old items out. Pure ordering change; no schema, API, or
network impact.

## Files changed
- `app/src/core/learning.ts` — sort direction for due-understood items (+ comment)
- `app/test/learning.test.ts` — +1 regression test pinning the ordering with `limit = 1`

## Tests (exact)
- `npm test` (app): **32/32 pass** (31 prior + 1 new regression test)
- `npm run typecheck` (app): clean
- `npm run build` (app): success
- `npm test` (web): 31/36 — 5 pre-existing failures (billing pricing/seat, auth device
  idempotency, session expiry) unchanged on `main`; out of scope.

## Why this path (not the orphaned branches)
Earlier `nightly-ai-learning-engine-*` branches covered parseQuestion validation, skill
decay/degrade, and concept-slug grouping. This run targets `computeReviewQueue`, which none of
them touched.

## Founders — decisions required
1. **Enable PR creation for automation** (repo setting), or open the PR manually from the
   branch URL above (target `main`). Do not auto-merge.
2. **Stale nightly branches**: six earlier `nightly-ai-learning-engine-*` branches remain
   unmerged with no open PRs (parseQuestion validation ×2, skill decay, deriveSkillState
   degrade, comprehension validation, concept-slug grouping). Several touch the same files
   (`web/src/ai/comprehension.ts`, `app/src/core/learning.ts`, `web/src/data/skills.ts`) and
   should be integrated together, including this new branch.
3. **Pre-existing web test/typecheck failures** (billing + auth/security suites) are on `main`
   and out of this mission's scope — schedule a fix.
