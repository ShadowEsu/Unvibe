# Founder Decisions Required — 2026-08-07

**Mission:** product-design-and-accessibility

## Decisions Needed

### 1. PR creation / manual review (blocker)
The branch `opencode/nightly-product-design-and-accessibility-widget-depth-radiogroup`
was pushed. PR creation was attempted and **failed** with `GitHub Actions is not
permitted to create or approve pull requests (createPullRequest)` — the known limitation
from every prior night (2026-07-24, 07-31, 08-01, 08-02, 08-03, 08-05, 08-06). The Actions
token reports `pull-requests: read` in practice. Create the PR manually:
https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-product-design-and-accessibility-widget-depth-radiogroup

### 2. macOS manual verification of the Depth radiogroup
The fix (Arrow/Home/End navigation, roving tabindex, focus-follows-selection) is
unit-tested but **unverified on Linux runner** in a live Electron window. Recommend one
real-Mac pass: focus Depth, ←/→ wrap, Home/End, VoiceOver announces `radio selected`,
Expert stays Pro-gated. Decision needed: approve merge after that manual pass, or merge
now with the unit-test evidence and defer the Mac pass.

---

## Why this mission was selected
The widget Depth picker (New→Expert) is the primary "choose your depth" interaction in
the main surface and was the one single-select control with no radiogroup semantics or
keyboard navigation that no prior night-lab branch had audited. It is a contained,
low-risk a11y fix that matches the established roving-radio pattern used in the Companion
(Quiz mode, Study restudy level).

## Risk level
Low. One renderer file + one pure helper + one test file; no I/O, no data, no schema, no
dependency changes.

## What was not verified
- Live keyboard/focus behavior in an Electron window on macOS (unverified on Linux runner).
- No VoiceOver/NVDA screen-reader pass.
- The Companion roving-radio branches (`rovingRadio.ts`) remain unmerged; this fix uses a
  distinct helper name (`levelPicker.ts`) so branches stay disjoint.
