# Nightly run: ai-learning-engine — 2026-08-08

## Mission
`ai-learning-engine`: inspect context construction, prompt templates, streaming,
comprehension questions, concept extraction and mastery logic. Improve one
measurable behavior per run. (Branch: `opencode/nightly-ai-learning-engine-comprehension-guard`)

## Why this was selected
Prior ai-learning-engine nightly runs hardened the **server-side** `parseQuestion`
(integer answerIndex, duplicate-option rejection, non-empty validation — all still
unmerged on `main`) and the comprehension prompt. Reviewing this run's areas
(`app/src/core/`, `web/src/ai/`) surfaced a different, unhardened link in the same
chain: the **app-side trust boundary**. `studyQuiz.ts` and `review.ts` store the
`answerIndex` returned by the backend and grade the user's pick against it with no
validation of the received question. Grading compares `choice === answerIndex`, so a
malformed question (float index like `1.5`, index ≥ options length, empty or duplicate
options) silently grades a correct pick as wrong and writes `needs_review` into the
mastery record. No hardcoded mastery claims were introduced.

## Evidence
- `app/src/main/studyQuiz.ts:249` — `answerQuizCard` graded `choice === pending.answerIndex` with only `Number.isInteger(choice) && choice < 0` on the choice and no bounds on `answerIndex`.
- `app/src/main/review.ts:448` — `gradeComprehension` graded `choice === a.answerIndex` with zero validation of choice or the received question.
- Both sites stored the fetched question's `answerIndex`/`options` verbatim from `fetchQuestion`.
- The web backend already validates via `parseQuestion`, but the app cannot trust the wire blindly (defence in depth), and the local fallback `localLessonQuiz` is always well-formed.

## Root cause
A missing validation guard between the network boundary and the grading step. The
learning record (outcome written to `store().setOutcome(...)`) is derived from a
comparison against an unvalidated server-supplied index.

## Changes
1. `app/src/core/protocol.ts` — new `isValidComprehensionQuestion(value)` type guard: non-empty question, ≥2 options, non-empty options, distinct options (case/whitespace-insensitive), integer in-range `answerIndex`, string `rationale`/`concept`/`conceptLabel`.
2. `app/src/main/studyQuiz.ts`:
   - `startQuizCard` validates the fetched question and falls back to the deterministic local card when invalid (same path as network failure).
   - `answerQuizCard` bounds the picked choice to `pending.optionsLength`.
3. `app/src/main/review.ts`:
   - `startComprehension` validates the fetched question and sends a friendly error instead of storing a bad `pendingAnswer`.
   - `gradeComprehension` bounds the picked choice to `pendingAnswer.optionsLength`.
4. `app/test/protocol.test.ts` — 5 regression tests: accepts well-formed question; rejects float/out-of-range/negative/string answerIndex; rejects duplicate/empty/<2 options; rejects blank question and non-string fields.

## Files changed
- `app/src/core/protocol.ts`
- `app/src/main/studyQuiz.ts`
- `app/src/main/review.ts`
- `app/test/protocol.test.ts`

## Tests actually run (exact results)
- `cd app && npm run typecheck` — clean (0 errors).
- `cd app && npm test` — **35 pass / 0 fail / 0 skipped** (node --test). New: `protocol.test.ts` 5 tests (accepts well-formed; rejects float/out-of-range answerIndex; rejects empty/duplicate options; rejects blank question/non-string fields).
- `cd app && npm run build` — `build ok` (esbuild main + preload + renderers).

## What was NOT verified
- Real AI path: no `ANTHROPIC_API_KEY` on this runner. The comprehension endpoint was not exercised against a live provider; only the guard logic is unit-tested. Any provider-specific behaviour is **mock AI — real key required for verification**.
- macOS behaviour (widget windows, focus, safeStorage): unchanged by this PR, still **unverified on Linux runner**.
- Server-side `parseQuestion` hardening from prior nightly branches remains unmerged on `main` and is unaffected by this change.

## Risk level
Low. Pure additive guard; existing happy path unchanged when the backend returns a
well-formed question. Fallbacks reuse the already-existing local-quiz path.

## Security and privacy impact
None negative. No new network calls; secret filtering untouched. The guard only
rejects ungradable server responses before they can corrupt local mastery evidence.

## Performance impact
Negligible — a single O(options) validation per question.

## Manual review steps
1. Run the app with a backend (or the mock, via `ENABLE_MOCK_AI=true`).
2. Open a lesson → Start a quiz card → answer correctly → confirm "understood" and no error.
3. Point `UNVIBE_BACKEND` at a stub that returns `{"answerIndex": 5, "options": [...]}` and confirm the app falls back to the local card instead of grading.

## Rollback plan
Revert the four files; the app returns to trusting the backend verbatim (previous behaviour).

## Recommended next action
Review and merge the pending server-side `parseQuestion` hardening branches
(`parsequestion-integer-validation`, `duplicate-option-rejection`,
`comprehension-validation`) so both ends of the wire validate, then close this
nightly branch after review.

## PR-creation blocker (founder decision required)
Branch `opencode/nightly-ai-learning-engine-comprehension-guard` was pushed to
origin, but `gh pr create` failed with `GitHub Actions is not permitted to create
or approve pull requests (createPullRequest)`. This is the same blocker noted in
prior nightly reports (2026-07-29, 07-31, 08-01, 08-03, 08-04). The changes are
reviewable directly on the branch. **Required decision:** grant the Actions
`contents: write`/`pull-requests: write` permission (or run the night lab with a
PAT) so nightly runs can open PRs, or review the branch manually.
