"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";
import { observeMotion } from "@/lib/motionInView";
import { countUpFrame } from "@/lib/motionMoments";

// Layout effect in the browser (so a number that arrives after hydration never paints final, then 0);
// plain effect on the server, where layout effects do nothing.
const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Counters that have already run on this page view; each counts up once. */
const played = new Set<string>();

const SKIP_EVENTS = ["pointerdown", "keydown", "wheel", "touchmove"] as const;

interface CountUpProps {
  /** Names this counter so it runs once per page view, even if it mounts again. */
  name: string;
  value: number;
  suffix?: string;
  /**
   * The number loaded after hydration (a fetch), so it counts as it arrives. Without it the number is in
   * the server HTML: it counts only if it starts below the fold, the first time it scrolls into view.
   */
  arrived?: boolean;
}

/**
 * A real count counting up from 0 (motion spec §2): 700 / 1000 / 1200 ms by size, --m-ease-smooth,
 * tabular figures. The final value is what the server renders and what the aria-label says; the moving
 * digits are aria-hidden. Any click, key, wheel or touch scroll ends it at the final value. Reduced
 * motion: the final value, still.
 */
export function CountUp({ name, value, suffix = "", arrived = false }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useClientLayoutEffect(() => {
    setShown(value);
    const node = ref.current;
    if (!node || played.has(name) || value === 0 || prefersReducedMotion()) return;
    if (!arrived && node.getBoundingClientRect().top < window.innerHeight) return;

    let frame = 0;
    const finish = () => {
      cancelAnimationFrame(frame);
      for (const type of SKIP_EVENTS) window.removeEventListener(type, finish, true);
      setShown(value);
    };
    const run = () => {
      played.add(name);
      setShown(0);
      for (const type of SKIP_EVENTS) window.addEventListener(type, finish, { capture: true, passive: true });
      const start = performance.now();
      const tick = (now: number) => {
        const next = countUpFrame(0, value, now - start);
        setShown(next);
        if (next === value) finish();
        else frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    if (arrived) {
      run();
      return finish;
    }
    const stop = observeMotion(node, () => {
      stop();
      run();
    });
    return () => {
      stop();
      finish();
    };
  }, [arrived, name, value]);

  const final = `${value.toLocaleString("en-US")}${suffix}`;
  return (
    <span ref={ref} data-tabular="" role="img" aria-label={final}>
      <span aria-hidden="true">{shown.toLocaleString("en-US")}{suffix}</span>
    </span>
  );
}
