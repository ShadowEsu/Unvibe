# Founder Decisions Required — 2026-08-05

**Mission:** competitor-research-and-v2

## Decisions Needed

### 1. PR creation / manual review
The research branch `opencode/nightly-competitor-research-and-v2-metacognition-calibration` was
pushed and a PR was attempted. Known limitation from prior nights (2026-07-24, 2026-07-31,
2026-08-01, 2026-08-02): the GitHub Actions token reports `pull-requests: read` in practice even
though the workflow grants `pull-requests: write`, so PR creation may fail. If no PR link appears,
create it manually:
https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-competitor-research-and-v2-metacognition-calibration

### 2. Adopt the "I understand is not verification" data-model rule (v1)
The report recommends separating two event types in the learning store: `understood_self`
(user clicked "I understand" — a self-report subject to the illusion of explanatory depth) and
`demonstrated_check` (outcome of a "Test me" check). Currently the confirmation may be recorded
as a single comprehension signal. This is schema-additive and makes the dashboard's claims honest.
Decision needed: confirm "I understand" stays as a non-blocking UX affordance but is no longer
counted as verified comprehension.

### 3. Add one generation-style "Test me" prompt (v1 or v2)?
Evidence (Rozenblit & Keil 2002; Lekshmi-Narayanan et al. 2026) says *generation/self-explanation*
prompts calibrate self-assessment far better than multiple-choice recognition. A single short-answer
prompt ("In one sentence, what does this change do?") graded via the existing AI path (mock-first,
clearly labelled) is the smallest intervention with demonstrated effect. Decision needed: v1 (core
mechanism) or v2 (defer to Companion phase).

### 4. Confidence vs. result calibration readout (v2)
Show users their own calibration ("you were X% confident; you got Y/Z right") in the Companion.
Teaches self-assessment accuracy (the Dunning–Kruger cure). Decision needed: approve as v2 surface.

### 5. Hold any "we check understanding" marketing claim until a real-AI evaluation
The report's claims rest on peer-reviewed mechanisms, but Unvibe's own "Test me" must be verified
with a real provider (mock AI must be labelled "mock AI — real key required for verification")
before the marketing site claims verification reduces overreliance in Unvibe specifically.

---

## Why this mission was selected
The prior research night already found the industry gap ("competitors stop where Unvibe begins" —
2026-08-01). This night's question is the *scientific* floor underneath that gap: can developers
reliably self-assess their understanding of AI-generated code, and which comprehension-check
designs actually work? The answer determines whether "Test me" is a feature or the product.

## Risk level
Low. Research-only branch; one new report and one founder-decisions log. No code, schema, or
dependency changes.

## What was not verified
- No live product testing; all product-behavior claims come from cited public sources (fetched
  2026-08-05).
- The Dunning–Kruger statistical critique (regression to the mean) is reported as a caveat, not
  resolved.
- Unvibe's "Test me" efficacy on real users is untested (mock AI only, per AGENTS.md).
