# Night Lab report — ai-learning-engine (2026-08-04)

Mission: `ai-learning-engine`. Branch: `opencode/nightly-ai-learning-engine-comprehension-task-fix`.

## Status
- Code change complete, committed (`94a136d`), and **pushed** to
  `origin/opencode/nightly-ai-learning-engine-comprehension-task-fix`.
- PR creation **attempted and blocked**: `gh pr create` failed with "GitHub Actions is not
  permitted to create or approve pull requests" — the same repo setting blocker documented
  nightly since 2026-07-24 (the Actions token cannot create/approve PRs). The branch is pushed
  and ready; a founder (or any user with write access) can open the PR from
  https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-ai-learning-engine-comprehension-task-fix
- Branch contents verified: exactly one commit touching only `web/src/ai/prompt.ts`,
  `web/test/prompt.test.ts` (new), and this report.

## Why this was selected
The 9 previously-pushed `nightly-ai-learning-engine-*` branches (all unmerged, no PRs) already
cover `parseQuestion` validation (non-empty, integer answerIndex, duplicate options), skill
decay/degrade, concept-slug grouping, review-queue ordering, and SSE parsing. **`web/src/ai/prompt.ts`
is untouched by all of them** — and it contains a real, measurable defect in the comprehension
endpoint.

## Root cause
`buildComprehensionPrompt` (web/src/ai/prompt.ts:107) built its user message by reusing
`buildUserPrompt({ ...payload, question: undefined })`. With `question` undefined,
`buildUserPrompt` fell through to its `else` branch and emitted the **scope-derived review task**
("Explain what this code does and why, at the requested level …"). So the comprehension request
sent the model a system prompt commanding "Generate ONE multiple-choice question … Return ONLY a
JSON object" while the user message simultaneously demanded a natural-language **explanation** of
the code. Contradictory instructions measurably degrade question quality (the model can answer
the wrong task or blend both), and there was no test pinning the comprehension user prompt.

## Evidence
- Confirmed on `main` before the change: `buildComprehensionPrompt`'s `user` contained
  "Explain what this code does and why" (the review task), contradicting the system prompt.
- After the change, the comprehension user message asks to "Generate ONE multiple-choice
  comprehension question about the code. Do NOT explain what the code does — that is a separate
  task," and the regression test asserts the review task line is **absent**.
- Two of the new tests fail against the unpatched source and pass against the patched source,
  proving they are real regression guards, not tautologies.

## Changes
- `web/src/ai/prompt.ts`
  - `buildUserPrompt` gains an optional `task` override that replaces the scope-derived task
    line when supplied (backwards-compatible; the reviews endpoint passes none and is unchanged).
  - `buildComprehensionPrompt` now passes an explicit question-generation task, removing the
    contradiction.
- `web/test/prompt.test.ts` (new, +6 regression tests):
  1. `buildUserPrompt` defaults to the scope-derived explanation task.
  2. `buildUserPrompt` uses the follow-up question when present.
  3. `buildUserPrompt` honours an explicit task override.
  4. Comprehension prompt asks for a question, not an explanation (asserts no review-task line).
  5. Comprehension prompt keeps the quiz-mode instruction (RECALL/SCENARIO).
  6. System prompt cites audience level + cite syntax.

## Files changed
- `web/src/ai/prompt.ts`
- `web/test/prompt.test.ts` (new)

## Tests actually run (web/)
- `npm run typecheck`: 8 errors, **all pre-existing on `main`** (missing `priceFor`,
  `proAnnualSavingsPercent`, `teamsAnnualSavingsPercent`, `SESSION_TTL_MS`; planLimit/MemoryStore
  arity — the known billing/security breakage first flagged 2026-07-29). Changed files clean.
- `npm test`: **37 pass / 5 fail** — the 5 failures are the same pre-existing billing + security
  tests that fail on `main` (verified by re-running stashed). 6/6 new prompt tests pass; 2 of the
  6 fail against the unpatched source.
- `npm run build`: success (`next build` completed).
- `app/`, `extension/`, `marketing/`: untouched by this change.

## What was not verified
- Real-model output quality (requires ANTHROPIC_API_KEY/GEMINI_API_KEY). Prompt-contract tests
  only; model behaviour is **mock AI — real key required for verification**.
- No changes to app/, extension/, marketing/ — nothing to verify there.

## Risk level
**Low.** Pure prompt-text change in one backend module; additive optional parameter;
no schema/API/persistence changes; no dependency changes; fully unit-covered.

## Security and privacy impact
None. No secrets touched; no new data flows; comprehension payloads still go through the
existing auth/metering path unchanged.

## Performance impact
None (single prompt string constructed per request).

## Manual review steps
1. Review the diff of `web/src/ai/prompt.ts`.
2. Confirm the reviews endpoint (`web/app/api/v1/reviews/route.ts`) still calls
   `buildUserPrompt(payload)` with no second argument (unchanged behaviour).
3. Optionally start `npm run dev` in `web/` and POST a comprehension request to
   `/api/v1/comprehension` with a real API key set.

## Rollback plan
Revert the single commit; `buildUserPrompt` reverts to the old signature and the reviews
endpoint is unaffected.

## Recommended next action
Merge this small, self-contained branch after the pre-existing `web/` billing/security breakage
is fixed (or alongside the `nightly-backend-and-sync-web-contract-alignment` carrier branch —
the files do not overlap). Founder decision needed on unblocking PR creation for the automation
token (open PR manually from the URL above otherwise).

## Related stale branches (not superseded by this change)
The 9 prior `nightly-ai-learning-engine-*` branches remain unmerged with no PRs. Several touch
the same `web/src/ai/comprehension.ts` and `app/src/core/learning.ts` files and should be
reconciled together (see 2026-08-03 summary, "hand-reconciliation flagged on 2026-08-02").
