import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { countUpMs, motionTokens } from './motionTokens';

/**
 * The motion moments shared by the panel and the companion (Design MOTION-SPEC §2-§3): the celebration and the
 * count-up. Both are skippable, both are static under reduced motion, and neither ever delays what they decorate.
 */

/** The OS "Reduce motion" setting, live. False on the server and in tests, where nothing animates anyway. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return reduced;
}

/** Any click, key or scroll ends a running moment at its final state (MOTION-SPEC §3.3). */
function useSkip(active: boolean, skip: () => void): void {
  const latest = useRef(skip);
  latest.current = skip;
  useEffect(() => {
    if (!active) return undefined;
    const end = () => latest.current();
    const events = ['pointerdown', 'keydown', 'wheel'] as const;
    for (const name of events) window.addEventListener(name, end, { capture: true, passive: true });
    return () => {
      for (const name of events) window.removeEventListener(name, end, { capture: true });
    };
  }, [active]);
}

/* ------------------------------- celebration ------------------------------ */

/** The real wins that may celebrate: Got it, a right Test me answer, and finishing first-run setup. */
export type CelebrationTrigger = 'gotIt' | 'testCorrect' | 'firstRun';

/** Where the last celebration day per trigger is kept (localStorage in the windows). */
export interface DayStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Whether `trigger` may celebrate now, recording it when it may: at most once per trigger per day (`today` is the
 * local YYYY-MM-DD), and never while the Celebrations setting is off. Storage that fails means no celebration.
 */
export function claimCelebration(trigger: CelebrationTrigger, opts: { enabled: boolean; today: string; store: DayStore }): boolean {
  if (!opts.enabled) return false;
  const key = `unvibe.celebrated.${trigger}`;
  try {
    if (opts.store.getItem(key) === opts.today) return false;
    opts.store.setItem(key, opts.today);
    return true;
  } catch {
    return false;
  }
}

/** Where each of the 8 shapes flies: an angle and a share of the 48 px reach, so none travels further. */
const SHAPES = [
  { angle: -90, reach: 1 }, { angle: -45, reach: 0.75 }, { angle: 0, reach: 0.9 }, { angle: 45, reach: 0.7 },
  { angle: 90, reach: 0.85 }, { angle: 135, reach: 0.7 }, { angle: 180, reach: 0.95 }, { angle: 225, reach: 0.75 },
] as const;

/**
 * The burst of a celebration: 8 small mint shapes that fly at most 48 px from the middle of their host and fade,
 * in --m-slow. The host is the verdict row or the action button, so it never covers the window. `run` is a
 * fresh number per celebration (null when none); it ends by itself, or at the first click, key or scroll.
 * Reduced motion renders nothing: the static check and the colour change are the whole moment.
 */
export function Celebration({ run, reduced, onEnd }: { run: number | null; reduced: boolean; onEnd: () => void }) {
  const active = run !== null && !reduced;
  useSkip(active, onEnd);
  if (!active) return null;
  return (
    <span className="celebrate" aria-hidden="true" key={run} onAnimationEnd={(event) => { if (event.target !== event.currentTarget) onEnd(); }}>
      {SHAPES.map((shape, index) => (
        <i
          key={index}
          className={`celebrate__shape celebrate__shape--${index % 2 ? 'dot' : 'chip'}`}
          style={{ '--celebrate-angle': `${shape.angle}deg`, '--celebrate-reach': shape.reach } as CSSProperties}
        />
      ))}
    </span>
  );
}

/** The check that marks a win. It pops to --m-scale-pop once while `pop` is set; reduced motion never sets it. */
export function CheckMark({ pop = false }: { pop?: boolean }) {
  return (
    <svg className={`check-mark${pop ? ' check-mark--pop' : ''}`} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="10" />
      <path d="M5.8 10.2 8.7 13l5.5-6" />
    </svg>
  );
}

/* -------------------------------- count-up -------------------------------- */

/** A CSS cubic-bezier timing function, so the count-up eases on the same curve as --m-ease-smooth. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-6) return sampleY(t);
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (hi - lo > 1e-6) {
      if (sampleX(t) < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

const easeSmooth = cubicBezier(...motionTokens.easing.smooth);

/** The whole number a count-up from `from` to `to` shows `elapsed` ms in. */
export function countUpValue(from: number, to: number, elapsed: number): number {
  const duration = countUpMs(to);
  if (elapsed >= duration) return to;
  return Math.round(from + (to - from) * easeSmooth(Math.max(0, elapsed) / duration));
}

/**
 * Counts from the last value this `storageKey` showed (kept across opens) up to `value`, then remembers `value`.
 * Reduced motion, a lower value (a new week) or a click, key or scroll shows the final value at once.
 */
function useCountUp(value: number, storageKey: string, reduced: boolean): number {
  const [shown, setShown] = useState(() => {
    if (reduced || typeof window === 'undefined') return value;
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(storageKey); } catch { /* storage blocked: no previous value */ }
    const from = saved === null ? Number.NaN : Number(saved);
    return Number.isFinite(from) && from >= 0 && from < value ? from : value;
  });
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const [running, setRunning] = useState(false);
  const frame = useRef(0);

  const finish = () => {
    cancelAnimationFrame(frame.current);
    setRunning(false);
    setShown(value);
    writeStored(storageKey, String(value));
  };
  useSkip(running, finish);

  useEffect(() => {
    const from = shownRef.current;
    if (reduced || from >= value) {
      setShown(value);
      writeStored(storageKey, String(value));
      return undefined;
    }
    setRunning(true);
    const start = performance.now();
    const step = (now: number) => {
      const next = countUpValue(from, value, now - start);
      setShown(next);
      if (next === value) {
        setRunning(false);
        writeStored(storageKey, String(value));
      } else frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [value, reduced, storageKey]);
  return shown;
}

function writeStored(key: string, value: string): void {
  try { window.localStorage.setItem(key, value); } catch { /* storage blocked: it counts from the value next time */ }
}

/**
 * A number that counts up to `value` (MOTION-SPEC §2), in tabular figures. Screen readers get only the final
 * number in the label; the moving digits are hidden from them. Never used for "explanations left".
 */
export function CountUp({ value, label, storageKey, reduced }: { value: number; label: (n: number) => string; storageKey: string; reduced: boolean }) {
  const shown = useCountUp(value, storageKey, reduced);
  const text = label(shown);
  const digits = String(shown);
  const at = text.indexOf(digits);
  return (
    <span className="count-up" role="img" aria-label={label(value)}>
      <span aria-hidden="true">
        {at < 0 ? text : <>{text.slice(0, at)}<b className="count-up__n">{digits}</b>{text.slice(at + digits.length)}</>}
      </span>
    </span>
  );
}
