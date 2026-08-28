/**
 * Unvibe motion system.
 *
 * Three tiers, matched to intent:
 *  - micro   (120-180ms): hover, press, toggle, focus. Feedback that must feel instant.
 *  - standard(250-450ms): entrances, layout shifts, panel reveals. Noticed but not narrated.
 *  - story   (700-1200ms): the demo choreography and scroll set pieces. Deliberate storytelling.
 *
 * Only opacity and transform animate. Nothing loops except explicitly labelled
 * ambient loops (marquee, caret, the hero demo). Everything must degrade gracefully
 * when prefers-reduced-motion is set.
 */

export const durations = {
  microFast: 0.12,
  micro: 0.15,
  microSlow: 0.18,
  standardFast: 0.25,
  standard: 0.32,
  standardSlow: 0.45,
  storyFast: 0.7,
  story: 0.9,
  storySlow: 1.2,
} as const;

export const easing = {
  calm: [0.2, 0, 0.2, 1] as [number, number, number, number],
  emphatic: [0.16, 1, 0.3, 1] as [number, number, number, number],
  out: [0, 0, 0.2, 1] as [number, number, number, number],
} as const;

/** Standard entrance used across sections. */
export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.standardSlow, ease: easing.emphatic },
  },
} as const;

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: durations.standard, ease: easing.calm },
  },
} as const;

/** Parent that reveals children in sequence. */
export const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
} as const;

/** Viewport config so entrances play once, slightly early. */
export const inViewOnce = { once: true, margin: "-12% 0px -12% 0px" } as const;

/**
 * Returns true when the user prefers reduced motion.
 * Safe on the server (returns false).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
