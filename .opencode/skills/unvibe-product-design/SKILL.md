---
name: unvibe-product-design
description: Unvibe-specific design critique and UI review. Loaded when critiquing UI, evaluating flows, or proposing visual changes to the desktop overlay or dashboard.
license: MIT
---

# Unvibe Product Design

## Process

Before proposing any design change:

### 1. Inspect Current Implementation
- Read the relevant component file(s).
- Run the app or check screenshots.
- Identify the screen's purpose.
- Identify the primary user action on that screen.

### 2. Identify Problems
- Visual hierarchy: Is the most important action obvious?
- Clarity: Can a new user understand this screen in 3 seconds?
- Consistency: Does it match the rest of the product?
- Motion: Does animation explain state changes or is it decorative?
- States: Are loading, empty, error, and offline states handled?
- Accessibility: Can it be operated by keyboard? Does it have proper ARIA labels and roles?

### 3. Evaluate Against Design Tokens
Check existing CSS custom properties and class names before adding new ones.
The design system uses:
- Strict black/white with restrained grays.
- Semantic accent colours (green, orange, purple, cyan, blue, red) only for specific meaning.
- No gradients except the hero section's subtle purple+cyan radial background.
- No AI glow or shadow-heavy cards.
- Generous whitespace.

### 4. Prepare Alternatives
For subjective changes, prepare 2-3 original alternatives.
Each alternative must include:
- Description of the change.
- Visual mockup or description.
- Which design problem it solves.
- Trade-offs.

### 5. Evaluate Motion
Every animation must serve one of these purposes:
- Explain a state change (e.g., widget appearing after review).
- Guide attention (e.g., bar dimming when idle).
- Confirm an action (e.g., button press feedback).
- Reduce perceived latency (e.g., streaming text appearing token-by-token).

Rules:
- Fast animations only (100-300ms for micro-interactions, 300-500ms for transitions).
- No decorative bounce, glow, or parallax.
- Respect `prefers-reduced-motion`.

### 6. Review Accessibility
- Keyboard-operable: every interactive element reachable and usable via keyboard.
- Screen reader: proper landmarks, ARIA labels, live regions for streaming content.
- Contrast: text meets WCAG AA (4.5:1 for normal text, 3:1 for large).
- Focus indicators visible.
- Touch targets minimum 44x44px on interactive elements.

### 7. Test Viewports
- Dashboard: 320px, 480px, 768px, 1024px, 1440px.
- Desktop overlay: common window sizes on macOS.

### 8. Feature Flags
Experimental redesigns must be behind a feature flag.
Never replace the entire visual system in one change.

### 9. Request Approval
For anything beyond a contained fix (colour, spacing, typography):
- Present before/after comparison.
- List what improved and what regressed.
- Request human approval before implementing.

## Visual Direction

- Calm, premium, minimal, professional.
- Soft white and purple identity (matching existing design).
- Restrained semantic accent colours.
- Generous whitespace.
- Clean code presentation (monospace font for code, syntax highlighting).
- Subtle purposeful motion.
- Clear hierarchy.
- Not childish, not overly gamified, not a generic AI dashboard.
- Not copied from Fable, Linear, Apple, or Wispr Flow.

## Anti-Patterns

- Do not add colour just to make it "less boring".
- Do not add animation without a functional purpose.
- Do not sacrifice usability for visual flair.
- Do not copy another product's exact design, layout, or wording.
- Do not redesign the entire application unattended.
- Do not use fake product content in mockups.
