# Founder decision — design-system drift (logged by Night Lab, 2026-07-31)

## Context

`docs/design-system.md` (and AGENTS.md) specify a strict black/white/grays
monochrome system: "No gradients, no colored status, no AI glow." The shipped
desktop app has since moved to a purple/gradient visual language (bar,
widget, companion, marketing): colored stat tones (streak amber, understood
green, lines violet), gradient ribbons, colored focus rings, `.lvl` pills
colored per depth, teal/amber/blue semantic accents.

## Decision needed

Which is the source of truth?

- **Option A — re-enforce monochrome:** revert the gradient/colored surface
  work to match `docs/design-system.md`. Large, cross-cutting visual change;
  would re-open the earlier pixel/launch work.
- **Option B — adopt the shipped design (recommended):** officially update
  `docs/design-system.md` and AGENTS.md to describe the current purple/gradient
  system (tokens, allowed accents, focus rings), keeping the existing
  accessibility baseline (2px focus ring, contrast AA, reduced motion,
  keyboard). Night-lab a11y work then audits against the *actual* shipped
  system rather than a stale spec.

## Guidance applied this run

No decision was made in this run (mission = contained a11y fix, not a redesign).
I preserved the shipped design language while fixing reduced-motion and ARIA
issues, and flag the spec drift here so the a11y/design direction stays coherent.

## Alternatives considered

- Doing nothing: leaves the spec contradicting the shipped product; future
  audits will keep tripping on it.
- Partial monochrome in the new surfaces only: creates visual inconsistency.

## Tradeoffs

- **Option A:** safer visually for "calm/minimal" positioning, but throws away
  shipped, reviewed work and re-opens the desktop redesign.
- **Option B:** keeps the current product coherent; requires a doc update and
  explicit contrast AA checks on the new colored pairs (verified: focus ring
  `#a78bfa` on `#14111c` and fill `#6f45d2` with white text pass AA).

## Runner note

The 2026-07-31 Night Lab runner's GitHub Actions token could not create the
PR for this mission's branch
(`opencode/nightly-product-design-and-accessibility-reduced-motion-rotation`).
The branch is pushed; the PR must be opened manually.
