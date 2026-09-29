# Performance audit

Measured 19 SEP 2026 on this checkout.

## Before this pass

- Desktop renderer CSS: companion 113KB, widget 28KB, Island 14KB
- golden-gate.png: 206KB
- app icon: 165KB
- UI libraries: none beyond React 19
- Electron (dev) ~263MB; this dominates install size, not the overlay UI

## After this pass

- Added `tokens.css` (~1.3KB), prepended into the three renderer stylesheets
- No new npm dependencies
- No new image or font files
- No Framer Motion, charts, or icon packs
- Island window is wider when expanded (420x312 vs 276x148). That is a window bounds change, not bundle weight.

## Largest dependencies (unchanged)

Electron, React, TypeScript/esbuild at build time. Renderer JS stays a single IIFE per surface.

## Changes made

Shared tokens instead of extra CSS frameworks. Motion stays on transform/opacity. golden-gate.png left as-is (already under 250KB).

## Remaining

Companion CSS still contains unused explainer rules. Trimming that is a later cleanup, not a size emergency.
