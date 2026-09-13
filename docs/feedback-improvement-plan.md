# Unvibe improvement plan

Prepared 2026-09-13. This is a public engineering plan; correspondence, contact details,
private reports and the complete evidence register remain outside Git history.

## Baseline and boundaries

App starting point: `main` at `9df8e45c85b825a4f0d6a2cff284cda773a17bef`.
Marketing reference: `marketing` at `7cb6c151f2fabc4835cfe05368dae63c2d1bb3a6`.
These identify the inspected source, not proof that every installed binary or deployment
comes from those commits. Verify runtime provenance before fixing a reported UI defect.

Preserve the current app's DM Sans typography, dark translucent panels, ambient palette,
floating bar, movable widgets and companion navigation. Preserve the website's Golden Gate
photography, current colors, serif headline, page composition and existing product imagery.
Do not restore historical monochrome layouts or rebuild either surface from an old screenshot.
The latest approved implementation is the baseline even when older design documents disagree.

Allow focused improvements to readability, wrapping, scrolling, language labels, playback,
keyboard operation and truthful copy when supported by a reproducible problem. For each visual
change record the problem, affected component, before/after screenshots and the intended delta.
An AI suggestion alone is a hypothesis to evaluate, not grounds for a wholesale redesign.

No architecture/dependency migration, price change, model expansion, repository-permission
expansion or new product direction is required by this plan. Retain local secret filtering
before remote requests and main-process ownership of network I/O.

## Ordered delivery

| Stage | Work | Exit evidence |
| --- | --- | --- |
| 1. Trust and release | Match source SHA, advertised version, binary version and backend. Verify privacy and credit/readiness claims. Test canonical survey links. | Clean install and first review on each supported OS; version matrix; verified claims and survey completion. |
| 2. Core usability | Fix C++ inference; reproduce Settings wrapping/overflow, glass contrast, scrollbars and notch placement on the current build. Test selected-code capture with companion closed. | Narrow regression tests, actual-device evidence and before/after visual comparison. |
| 3. Website reliability | Verify entire demo playback, seeking, slow-network recovery, FAQ keyboard behavior and image/reveal loading. Measure text contrast. | Desktop/mobile and two-engine checks; usable fallback; original assets and composition preserved. |
| 4. Learning quality | Verify safe heading/code rendering; assess compact personal notes and optional next quiz question within existing controls. Reuse existing library and quiz machinery. | Persistence/restart, offline/error, keyboard and duplicate-submission checks; accurate explanations and questions. |
| 5. Product value | Demonstrate selection → contextual explanation → understanding check → saved recall on a real task. Pilot existing individual/team workflows. | Task comprehension, later retrieval, repeat use and explicit willingness to pay with denominators; no demand claims from polite replies. |

Priorities express sequence, not promised delivery dates. Check whether a reported problem
is already fixed before writing code: current source already includes display-bound anchoring,
an "Another card" action and recent marketing revisions.

## Current implementation slice

Content-only language inference now recognizes C++ `constexpr`, scoped enums and vector
reference/pointer declarations before the generic JavaScript `const` rule. No widget or
website UI changes are part of this patch. Regression cases cover the affected selections
and representative JavaScript, TypeScript, Python, Rust, Go and plain-text inputs.

This remains heuristic detection. It does not establish full language accuracy, change the
editor metadata path, migrate saved records, or prove the behavior in a packaged release.
Verify selection → label → save → reopen in the intended binary before telling a reporter
the released problem is fixed.

## Acceptance checklist for subsequent changes

- Capture the exact build, theme, viewport/device and reproduction before editing.
- Preserve existing images, palette, type, layout and widget geometry unless the specific
  defect requires a documented local adjustment.
- Test loading, empty, error, offline and keyboard paths applicable to the change.
- Check normal text contrast at 4.5:1 and large text at 3:1 against actual composited
  backgrounds ([W3C guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
- Verify wrapping/reflow without suppressing intentional code-card horizontal scrolling
  ([W3C guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)).
- Record checks actually run; distinguish source tests, browser checks and native-device tests.
- Commit narrow changes on a reviewable branch. Route marketing edits through the current
  marketing branch; never use an old checkout as a visual rollback target.
- Close a feedback item only with release evidence or an explicit documented disposition.

## Deferred until evidence supports them

New major navigation, a large tutorial catalog, mandatory multi-question quizzes, local-model
mode, expanded GitHub ingestion and new enterprise analytics are not inferred requirements.
First establish that the present workflow improves understanding or handoff for an identified
user group. Preserve useful existing functionality while validating these questions.
