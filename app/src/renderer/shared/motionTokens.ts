/**
 * Design MOTION-SPEC §1 for code that animates in JS (the count-up). Seconds, as in motion-foundations; the CSS
 * twin is the --m-* block in tokens.css. No other duration or easing is used by new motion.
 */
export const motionTokens = {
  duration: { instant: 0.08, fast: 0.18, exit: 0.15, normal: 0.35, slow: 0.6, crawl: 1.0 },
  stagger: { children: 0.07 },
  easing: {
    smooth: [0.22, 1, 0.36, 1],
    sharp: [0.4, 0, 0.2, 1],
    pop: [0.34, 1.56, 0.64, 1],
  },
  distance: { sm: 8, md: 16 },
  scale: { press: 0.95, pop: 1.04 },
} as const;

/** MOTION-SPEC §2 count-up length in ms: 700 under 100, 1000 under 10k, 1200 at most. */
export function countUpMs(to: number): number {
  const size = Math.abs(to);
  return size < 100 ? 700 : size < 10_000 ? 1000 : 1200;
}

/** MOTION-SPEC §2: the skeleton shows only once a wait has lasted this long, so a fast answer never flashes it. */
export const SKELETON_DELAY_MS = 200;
