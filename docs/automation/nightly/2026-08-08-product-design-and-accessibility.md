# Night Lab — Product Design & Accessibility (2026-08-08)

Mission: `product-design-and-accessibility` · Branch:
`opencode/nightly-product-design-and-accessibility-widget-quiz-radiogroup`
Run model: `deepseek/deepseek-v4-flash` · Max risk respected: low (repo
variables unreadable on this runner — API 403 — low default assumed)

## Scope chosen

The widget's **"Test me" comprehension-quiz answer options**
(`app/src/renderer/widget/widget.tsx`, the `.quiz__opts` block in the quiz
phase). This is a contained single-select flow no prior night-lab branch has
touched (its `git log -S quiz__opts` shows only the original D2 milestone
commit). The widget Depth picker (`widget-depth-radiogroup`, 08-07) and the
companion's Quiz-mode switcher (`quiz-radiogroup-keyboard`, 08-05) got
radiogroup semantics, but the in-widget quiz answers were a separate code path
and never audited. No open PR for this mission exists tonight; the three
open PRs are from other agents (claude/codex), not the night lab.

## Audit findings (hierarchy · keyboard · screen-reader · states)

1. **Selection was invisible to screen readers.** The `.quiz__opts` container
   was a plain `div` of plain `<button>` elements. The chosen option was
   conveyed **only** by the `.sel` CSS class — no `role="radiogroup"`, no
   `role="radio"`, no `aria-checked`. Screen readers announced a flat list of
   buttons with no selected state.
2. **No keyboard navigation.** A keyboard user tabbed through every option but
   could not move between answers with ArrowUp/ArrowDown/Home/End, and there
   was no roving tabindex (all options remained tab stops). The WAI-ARIA
   radio-group pattern requires exactly one radio in the tab order plus
   arrow navigation.
3. **Grading result was never announced.** After "Check", the verdict
   ("Correct — that one is understood." / "Not quite — saved to revisit.")
   appeared in a plain `<div>`. No `role="status"`/`aria-live`, so a screen
   reader user heard nothing on grading.
4. States were otherwise present: loading ("Writing you a question…"),
   answering (options enabled), grading (disabled), graded (verdict +
   rationale + "Back to the explanation"). No empty/error/offline gaps in this
   flow. Reduced-motion CSS already covers `.opt`.

## Changes

- `app/src/core/quizPicker.ts` (new): pure `nextQuizOptionIndex(current,
  count, key)` roving-tabindex helper. ArrowUp/ArrowDown move with wrap-around;
  Home/End jump to first/last; handles "nothing selected yet" (start at first /
  last depending on direction); guards empty and single-option lists. Named
  `quizPicker.ts` so it stays disjoint from the pending `rovingRadio.ts`
  (08-05/08-06) and `levelPicker.ts` (08-07) helpers.
- `app/src/renderer/widget/widget.tsx`:
  - `.quiz__opts` is now `role="radiogroup"` with `aria-label="Answer options"`,
    a container ref, and an `onKeyDown` handler.
  - Each option is `type="button" role="radio"` with `aria-checked`, a roving
    `tabIndex` (selected = 0, rest = -1; defaults to the first when nothing is
    chosen), and `onClick` unchanged.
  - ArrowUp/ArrowDown/Home/End (only while `quiz.phase === 'answering'`)
    select the next option and move focus to it.
  - The grading verdict is wrapped in `role="status"` so screen readers
    announce pass/fail.
- `app/test/quizPicker.test.ts` (new): 4 regression tests.
- `app/package-lock.json`: version string synced 0.1.1 → 0.1.2 by `npm
  install` (cosmetic; matches `package.json`, no dependency changes).

## Tests run and results

- `npm run typecheck` — **pass** (strict, no errors)
- `npm test` — **35/35 pass** (32 pre-existing + 4 new):
  - `quiz option index wraps forward and backward on the edges`
  - `quiz option index starts from the first option when none selected yet`
  - `quiz option index jumps to Home and End`
  - `quiz option index guards empty and single-option lists`
- `npm run build` — **pass** ("build ok")

## What was not verified

- Real keyboard/focus movement and screen-reader announcement inside a live
  Electron window on macOS — **unverified on Linux runner**; covered by the pure
  helper unit tests, typecheck, and the manual review steps below.
- No VoiceOver/NVDA pass was run.
- Real AI grading requires an API key; the widget already labels mock-AI
  results as such (`mock AI — set ANTHROPIC_API_KEY for real explanations`).

## PR blocker

`gh pr create` returned
`createPullRequest: GitHub Actions is not permitted to create or approve pull
requests` — the same blocker recorded on 2026-07-24 through 2026-08-07. The
branch was pushed to origin:
`opencode/nightly-product-design-and-accessibility-widget-quiz-radiogroup`
(commit `2348567`). It needs to be opened as a PR against `main` manually
(from https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-product-design-and-accessibility-widget-quiz-radiogroup)
or carried forward by the integration-review run. Full PR template content is
in the commit message.

## Overlap note (for integration review)

The pending `widget-depth-radiogroup` (08-07) branch and this branch both edit
`app/src/renderer/widget/widget.tsx`: each adds one import line at the same
anchor and one `useRef` right after `bodyRef`. Expect a 1–2 line merge
conflict there (same pattern the 08-07 review resolved for `widgetKeys`).
The new helper files (`levelPicker.ts` vs `quizPicker.ts`) are distinct names,
so no file collision.

## Manual review steps

1. Run the app against the local backend (or mock), get an explanation, click
   **Test me**.
2. Tab into the answer options; the selected option is the only radio in the
   tab order. Press ↑/↓ (should wrap around) and Home/End; confirm selection
   updates and focus moves to the newly selected option.
3. Confirm VoiceOver announces "Answer options" and the `aria-checked` state
   of each radio, and that the verdict is announced after Check.
4. Confirm option visuals (hover, `.sel`/`.right`/`.wrong`) look unchanged.

## Recommended next action

Open the PR for the pushed branch once a token with `createPullRequest`
permission is available; then a short manual macOS pass (quiz arrow
navigation + VoiceOver verdict announcement) before merge. A future run could
apply the same radiogroup pattern to the companion's own comprehension
question if one is added there.
