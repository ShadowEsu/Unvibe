# Unvibe website audit

Audited July 15, 2026 against the current `marketing/` implementation and local browser rendering.

## Critical

- The global “Watch demo” and hero “Try the demo” links target `#demo`, but the homepage does not render a section with that ID. The primary proof CTA appears broken.
- The Free pricing card links to `#download`, but the focused beta page does not render a download section.
- The footer contains several anchors for sections that are not on the current homepage (`#works-where`, `#learn`, `#depth`, `#study`, and `#students`).

## High impact

- The complete interactive demo and five-depth demonstration already exist in source, but neither is included in the page narrative. Visitors are asked to join before receiving the strongest proof.
- The current story jumps from a three-step scroll sequence to a quiz. It does not demonstrate the differentiator: how Unvibe expands from a selected line into project context.
- The `HowItWorks` desktop treatment consumes roughly 280 viewport heights for three short steps. The scroll cost is disproportionate to the information revealed.
- Pricing says “Local-only mode is always available,” while current product documentation says local-model/local-only operation is not implemented. This damages trust.
- Tool and language marks can read as partnership proof without an explicit “designed to work beside” explanation.

## Medium impact

- The hero animation has pause but no replay or manual step navigation.
- The hero’s timed explanation takes too long to reach its proof state.
- The hero supports four displayed depths while the product supports five.
- Navigation gives pricing equal prominence to product learning proof during an invitation-stage launch.
- Product screenshots appear as a carousel without a clear connection back to the learning loop.

## Polish

- The hero relies on multiple radial gradients and animated status dots despite the restrained product direction.
- Several headings explain product mechanics well but do not consistently tie the mechanic to maintaining code later.
- Marquee motion needs a clear static/reduced-motion treatment.

## Prioritized redesign

1. Repair every dead primary and footer anchor.
2. Place the complete interactive demo immediately after the problem statement.
3. Add the existing five-depth demonstration to prove personalization.
4. Replace the oversized three-step scroll treatment with a compact line-to-project context ladder.
5. Connect screenshots to the “project becomes the curriculum” story.
6. Correct invitation, pricing, download, and local-mode claims.
7. Add hero replay/manual controls and shorten the animation timeline.
8. Visually inspect all required breakpoints, then refine mobile wrapping and tap targets.

