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
  spring: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
} as const;

/** Standard entrance used across sections. */
export const fadeUp = {
  hidden: { opacity: 0, y: 20 },
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

/** Scale entrance for cards and modals. */
export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: durations.standard, ease: easing.emphatic },
  },
} as const;

/** Slide from left. */
export const slideInLeft = {
  hidden: { opacity: 0, x: -24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: durations.standardSlow, ease: easing.emphatic },
  },
} as const;

/** Slide from right. */
export const slideInRight = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: durations.standardSlow, ease: easing.emphatic },
  },
} as const;

/** Parent that reveals children in sequence. */
export const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
} as const;

/** Faster stagger for tight grids. */
export const staggerFast = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.03 },
  },
} as const;

/** Viewport config so entrances play once, slightly early. */
export const inViewOnce = { once: true, margin: "-10% 0px -10% 0px" } as const;

/** Viewport config for larger sections. */
export const inViewLarge = {
  once: true,
  margin: "-15% 0px -15% 0px",
} as const;

/**
 * Returns true when the user prefers reduced motion.
 * Safe on the server (returns false).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Count-up hook values: given a target number and duration, returns
 * the current value that animates from 0 to target.
 */
export function countUpConfig(target: number, duration = 1.2) {
  return {
    initial: { opacity: 0, y: 8 },
    whileInView: { opacity: 1, y: 0 },
    viewport: inViewOnce,
    transition: { duration, ease: easing.emphatic },
  } as const;
}
