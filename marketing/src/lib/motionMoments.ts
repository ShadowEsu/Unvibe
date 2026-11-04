/**
 * The site's motion moments (Design motion spec, 4 Nov 2026, §2), as pure rules the components follow:
 * the Try it wait, the staggered arrival of a list and the count-up. The CSS side uses the --m-* tokens
 * in globals.css; the few numbers JS needs are here.
 */

export type TryPhase = "idle" | "thinking" | "done" | "error";

/** A skeleton shows only once loading has lasted this long, so a fast answer never flashes it. */
export const SKELETON_AFTER_MS = 200;

/** The one step line while a Try it request is out. */
export const TRY_STEP = "Asking Vibe";

export interface TryWaitView {
  /** The visible step line, or null once there is an answer or an error to show instead. */
  step: string | null;
  /** Whether the shimmer bars show. */
  skeleton: boolean;
  /** aria-busy on the answer region. */
  busy: boolean;
}

/**
 * What the answer area shows for the request's real state. The /api/v1/try response is one JSON body,
 * so the browser can't tell the server reading the code from the model writing: one step line covers
 * the whole wait, and the answer replaces it the moment the text arrives.
 */
export function tryWaitView(phase: TryPhase, waitedMs: number): TryWaitView {
  if (phase !== "thinking") return { step: null, skeleton: false, busy: false };
  return { step: TRY_STEP, skeleton: waitedMs >= SKELETON_AFTER_MS, busy: true };
}

/** Only the first 8 items of a list arrive one after another; the rest are simply there. */
export const ARRIVE_LIMIT = 8;

/** The indexes of the children that animate in, in order. */
export function arrivingItems(count: number): number[] {
  return Array.from({ length: Math.max(0, Math.min(ARRIVE_LIMIT, Math.floor(count))) }, (_, i) => i);
}

/**
 * A list gets its hidden start state only when motion is allowed and its top starts below the fold, so
 * nothing already on screen ever disappears and fades back. Anything else stays as the server drew it.
 */
export function stageArrival({ reducedMotion, hasObserver, top, viewportHeight }: {
  reducedMotion: boolean;
  hasObserver: boolean;
  top: number;
  viewportHeight: number;
}): boolean {
  return !reducedMotion && hasObserver && top >= viewportHeight;
}

/** Count-up length by the size of the number: 700 ms under 100, 1000 ms under 10,000, 1200 ms at most. */
export function countUpDuration(value: number): number {
  const size = Math.abs(value);
  return size < 100 ? 700 : size < 10_000 ? 1000 : 1200;
}

// --m-ease-smooth, cubic-bezier(.22, 1, .36, 1), for the count-up's JS frames.
const bezier = (u: number, a: number, b: number) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;

/** --m-ease-smooth at progress t (0 to 1): find the curve point whose x is t, return its y. */
export function easeSmooth(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (bezier(mid, 0.22, 0.36) < t) lo = mid;
    else hi = mid;
  }
  return bezier((lo + hi) / 2, 1, 1);
}

/** The number a count-up shows `elapsedMs` after it starts from `from`; exactly `to` once its time is up. */
export function countUpFrame(from: number, to: number, elapsedMs: number): number {
  const duration = countUpDuration(to);
  if (!(elapsedMs < duration)) return to;
  return Math.round(from + (to - from) * easeSmooth(Math.max(0, elapsedMs) / duration));
}
