# Unvibe UI audit

Date: 19 SEP 2026. Desktop renderers only. Marketing was not inspected.

## Island

The compact notch pill is structurally right and visually empty. No wordmark, almost no purple, no recent learning, and the expanded drawer is two usage rings plus a 10px caption. Existing CSS already defines metrics, heat, recent, and actions, but `bar.tsx` does not render them. Compact width (276px) leaves each wing too short for a logo plus status. Chip colors are grey. Camera-gap math is fine.

## Typography

Companion keeps Newsreader + JetBrains Mono. Island uses SF Pro. Widget mixes Newsreader with 11 to 13.5px sizes. Random sizes appear throughout: 8px, 9px, 10px, 10.5px, 12.5px. Island meta at 8 to 10px is hard to read. Companion muted text in dark mode is acceptable; widget muted grey on #111 is weaker.

## Spacing and radius

Companion and widget use many one-off values (7, 11, 14, 19, 35). Island chips use 26/28/30. No shared spacing or radius tokens across the three surfaces.

## Color

Island is near-black with white borders. Brand purple exists on the logo SVG and unused drawer buttons, not on the compact pill. Companion dark theme washed the accent to warm grey. Widget is monochrome. No single token file.

## Motion

Island expand/collapse is a real window resize (correct). Drawer fade is 200ms. Bottom pill animates width. Unused CSS still has pixel loaders and idle blink. `prefers-reduced-motion` exists on the Island only.

## States

Island loading is a five-bar pixel loader with no words. Empty expanded state says "Select code to explain" and nothing else. Widget empty picker is clearer. Briefings empty states are already instructional.

## Accessibility

Island chips have labels. Drawer content is not keyboard-reachable as a small panel. Focus rings are inconsistent. Companion headings are generally semantic.

## Performance

No extra UI libraries. golden-gate.png is 206KB (acceptable). Companion CSS is 113KB of rules, a lot unused. Electron itself dominates install size, not the renderer.

## Fix order

1. Island identity, length, and expanded content
2. Shared tokens
3. Contrast and radius consistency
4. Informative loading/empty copy
5. Reduced motion on companion/widget
