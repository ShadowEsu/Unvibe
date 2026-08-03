# Night Lab report — ai-learning-engine (2026-08-03)

Mission: `ai-learning-engine`. Branch: `opencode/nightly-ai-learning-engine-sse-spec-compliance`.

## Status
Code change complete, verified, and pushed. See PR-creation note under Founders.

## Why this was selected
The mission scope includes inspecting `app/src/core/` (protocol, learning, secret filter,
SSE). The SSE parser (`app/src/core/sse.ts`) is the only module there never touched by a
nightly run, and it had a real spec-compliance gap that could drop an entire explanation
stream silently. All other ai-learning-engine areas (parseQuestion validation, skill decay,
deriveSkillState, review queue ordering) were already covered by earlier branches.

## Evidence
- `app/src/core/sse.ts` only split events on `\n\n` and only accepted `data: ` (with a
  space). The WHATWG SSE spec allows CRLF event separators (`\r\n\r\n`) and `data:` with no
  leading space.
- If a server or proxy emitted CRLF, `indexOf('\n\n')` never matched: the whole stream would
  buffer forever and the widget would render an empty explanation with no error.
- The web backend (`web/app/api/v1/reviews/route.ts`) and legacy server emit LF today, so this
  was latent — but any proxy/normalizer, or a future provider, could switch framing and break
  the learning flow end-to-end.

## Root cause
`feed()` used `this.buffer.indexOf('\n\n')` (LF-only framing) and `line.startsWith('data: ')`
(mandatory space). Both are narrower than the spec.

## Changes
- `app/src/core/sse.ts` — frame events on `/(?:\r\n|\r|\n){2}/`, accept any `data:` line
  (space optional), trim each line and payload before JSON.parse. Malformed events still
  skipped without killing the stream.
- `app/test/sse.test.ts` — +3 regression tests: CRLF separators, CRLF split across chunks,
  no-space `data:`.

## Files changed
- `app/src/core/sse.ts`
- `app/test/sse.test.ts`
- `app/package-lock.json` (version sync 0.1.1 → 0.1.2, matches `package.json`)

## Tests actually run
- `npm run typecheck` (app): clean
- `npm test` (app): **34/34 pass** (31 prior + 3 new)
- `npm run build` (app): success (`build ok`)

New tests, exact names:
- `parses CRLF (\r\n\r\n) event separators per the SSE spec` — pass
- `parses a CRLF event stream split mid-line across chunks` — pass
- `parses data: payloads without the optional leading space` — pass

## What was not verified
- No live backend run (no credentials/backend process on this runner). Parser is pure and
  unit-covered; framing matches the SSE spec.
- macOS widget render path not exercised on this runner (Linux). The parser is
  platform-independent; no macOS-specific behaviour involved.

## Risk level
Low. Pure parser change, additive tolerance, existing LF framing and `data: ` inputs still
parse (covered by the 3 pre-existing tests, unchanged and passing).

## Security and privacy impact
None. Parses the already-filtered SSE payloads; no data leaves the app and nothing is logged.

## Performance impact
Negligible. Regex framing over the same buffer; per-block work is proportional to stream size.

## Manual review steps
1. Read the diff in `app/src/core/sse.ts` and `app/test/sse.test.ts`.
2. Run `npm test` and `npm run typecheck` in `app/`.
3. Optionally point `UNVIBE_BACKEND` at any SSE service that emits CRLF and confirm
   explanations stream.

## Rollback plan
Revert the single commit on this branch; the parser returns to LF-only framing.

## Founders — decisions required
1. **PR creation**: the automation token cannot open PRs (repo setting "Allow GitHub Actions
   to create and approve pull requests" is disabled — 403 on the variables/PR APIs). Open the
   PR from
   https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-ai-learning-engine-sse-spec-compliance
   targeting `main`. Do not auto-merge.
2. **Stale nightly branches**: `web/src/ai/comprehension.ts` and `app/src/core/learning.ts`
   still have several unmerged nightly branches (parseQuestion ×2, comprehension-validation,
   skill-decay, deriveSkillState-degrade). This branch touches neither, so it merges
   independently.
