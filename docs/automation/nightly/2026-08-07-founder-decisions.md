# Founder Decisions Required — 2026-08-07

**Mission:** competitor-research-and-v2 (auto run)

## Decisions Needed

### 1. PR creation / manual review
The research branch
`opencode/nightly-competitor-research-onboarding-activation-20260807` was pushed. PR creation was
attempted and **failed** with `GitHub Actions is not permitted to create or approve pull requests
(createPullRequest)` — the known limitation from prior nights (since 2026-07-24). Create the PR
manually:
https://github.com/ShadowEsu/Unvibe/pull/new/opencode/nightly-competitor-research-onboarding-activation-20260807

This is the same persistent blocker flagged in every summary since 2026-07-24. The fix
(enable "Allow GitHub Actions to create and approve pull requests", or supply a fine-grained PAT
with `pull requests: write`) is still pending and unblocks every night-lab mission.

### 2. Free-tier quota feels like a trial clock (v1 or v2?)
The report notes Wispr Flow (2,000 words/week free, no trial countdown) and Raycast (free core)
deliberately avoid trial clocks so the habit forms before monetization. Unvibe's private-beta
quota is 30 selected-code prompts/month (`usage.ts` / `trial.ts`). The current framing is
acceptable **if explicitly positioned as a beta gate**, but the copy must not read as a 30-day
trial. Decision needed: keep quota as beta gate (v1) vs. align generosity to the
competitor habit-forming pattern (v2, needs budget).

### 3. Shortcut-on-bar + trust-architecture copy (v1, renderer-only)
Two low-risk v1 recommendations from the report: (a) show the ⌘U shortcut on the floating bar
and in every onboarding step; (b) lead onboarding's privacy signal with the *architectural*
claim ("secret scan before every request; backend never reads the repo") instead of a
certification badge Unvibe does not hold. Decision needed: approve as a renderer/copy change in
the desktop-overlay or product-design mission's next pass.

### 4. Per-repo consent surfaced during onboarding (v2)
The consent flow already exists (`review.ts` secret-findings → consent event). The report
recommends surfacing a per-repo, previewable, revocable consent choice during first-run
onboarding, as the strongest answer to "what do you do with my code". Decision needed: approve
as a v2 desktop-pivot item.

### 5. Hard boundary: no always-on capture
Competitor evidence (Crush parked at crush.ai; Rewind pivoted away from desktop recording to a
browser AI-tools aggregator) reinforces the existing product rule. The report recommends keeping
selected-code + explicit-review as a hard boundary, never adding screen/mic recording. Decision
needed: confirm the boundary stays.

---

## Why this mission was selected
Auto run tonight. The 08-07 integration review had already re-verified repository health and
covered backend-and-sync + product-design. The competitor-research slot was **cancelled
tonight**, and no prior night-lab report covered first-run onboarding/activation for desktop AI
assistants — the closest analogues to Unvibe's v2 menu-bar agent → floating bar → widget
surface. Research is docs-only and low-risk.

## Risk level
Low. Research-only branch; one new report + one founder-decisions log. No code, schema, or
dependency changes.

## What was not verified
- No installed-app observation of competitor permission sheets, tooltips, or onboarding metrics;
  all product-behavior claims come from public pages (fetched 2026-08-07).
- No public activation/permission-dropout metrics exist for any cited product.
- Unvibe's own onboarding behavior is grounded in code inspection; macOS permission-flow
  behavior remains "unverified on Linux runner".
