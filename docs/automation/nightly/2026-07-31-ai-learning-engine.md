# Night Lab report — ai-learning-engine (2026-07-31)

Mission: `ai-learning-engine`. Branch: `opencode/nightly-ai-learning-engine-concept-slug-grouping`
(commit `04abe3d`).

## Status
- Code change complete and pushed. PR creation **blocked**: the repo setting "Allow GitHub
  Actions to create and approve pull requests" is disabled, so the automation token receives
  403 on both GraphQL and REST `POST /pulls`. The branch is pushed and ready; a founder (or
  any user with write access) can open the PR from
  https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-ai-learning-engine-concept-slug-grouping

## Change (summary)
Web-side skill aggregation (`web/src/data/skills.ts`) now keys on the machine-facing `concept`
slug instead of the human-facing `conceptLabel`, matching how the on-device learning model
groups concepts (`app/src/core/learning.ts`). Label phrasing drift no longer splits a concept's
mastery evidence. Label-only events (older records without a slug) fall back to a normalized
label. Additive-only; no schema/API/persistence changes.

## Files changed
- `web/src/data/skills.ts`
- `web/test/skills.test.ts` (+3 regression tests)

## Tests (exact)
- `npx tsx --test test/skills.test.ts` (web): 5/5 pass
- `npm test` (web): 34 pass / 5 fail — failures pre-existing on `main` (billing `priceFor`
  signature, auth device-code/session expiry), 0 new
- `npm run typecheck` (web): 8 errors, all pre-existing in `test/billing.test.ts` /
  `test/security.test.ts`; changed files clean
- `npm run build` (web): success
- `npm run typecheck` (app): clean
- `npm test` (app): 31/31 pass

## Founders — decisions required
1. **Enable PR creation for automation**, or open the PR manually from the branch URL above
   (target `main`). The PR body/template is in the commit message; do not auto-merge.
2. **Pre-existing web test/typecheck failures** (billing + auth/security suites) are on `main`
   and out of this mission's scope — schedule a fix.
3. **Stale nightly branches**: five earlier `nightly-ai-learning-engine-*` branches
   (parseQuestion validation ×2, skill decay, deriveSkillState degrade, comprehension
   validation) remain unmerged with no open PRs. Decide merge or close; several touch the same
   files (`web/src/ai/comprehension.ts`, `app/src/core/learning.ts`, `web/src/data/skills.ts`)
   and should be integrated together.
