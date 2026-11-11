import { useEffect, useRef, useState } from 'react';

/**
 * A number that counts up once per visit (Design r2-motion SPEC §3 row 6): 700 ms under 100, 1,000 ms under
 * 10,000, --m-ease-smooth (cubic-bezier(.22,1,.36,1)), tabular figures. Later changes count from the last value.
 * The final value is the accessible name; the moving digits are aria-hidden. Reduced motion: the final value at once.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  const first = useRef(true);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = first.current ? 0 : from.current;
    first.current = false;
    from.current = value;
    if (reduced || start === value) {
      setShown(value);
      return;
    }
    const duration = Math.abs(value) < 100 ? 700 : 1000;
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = easeSmooth(p);
      setShown(Math.round(start + (value - start) * e));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <span className={className} aria-label={String(value)} style={{ fontVariantNumeric: 'tabular-nums' }}>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}

/** cubic-bezier(.22, 1, .36, 1) sampled on x by bisection: the same curve as --m-ease-smooth. */
function easeSmooth(x: number) {
  const bx = (t: number) => 3 * 0.22 * t * (1 - t) * (1 - t) + 3 * 0.36 * t * t * (1 - t) + t * t * t;
  const by = (t: number) => 3 * 1 * t * (1 - t) * (1 - t) + 3 * 1 * t * t * (1 - t) + t * t * t;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (bx(mid) < x) lo = mid;
    else hi = mid;
  }
  return by((lo + hi) / 2);
}
