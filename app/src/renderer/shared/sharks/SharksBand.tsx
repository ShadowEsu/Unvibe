import { useEffect, useRef, useState } from 'react';
import { SharksPool } from './sharksPool';

function themeNow(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** The palette follows `html[data-theme]`, live. */
function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(themeNow);
  useEffect(() => {
    const root = document.documentElement;
    const watch = new MutationObserver(() => setTheme(themeNow()));
    watch.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => watch.disconnect();
  }, []);
  return theme;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * §6.1 A: a band of ocean above an empty state's copy (Library empty, Quiz empty), the column's width and `height`
 * tall; not mounted at all when that is under 200 px. Runs while shown and the window is focused; rests on a still
 * after 30 s without input (sharksPool.ts). Reduced motion: one still frame. `strength` sets the ink's opacity (CSS);
 * Design picks between the two from stills.
 */
export function SharksBand({ height = 240, strength = 'present', label = 'Sharks swimming' }: {
  height?: number;
  strength?: 'quiet' | 'present';
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pool = new SharksPool(canvas, { theme, idleRest: 30, still: reducedMotion() });
    return () => pool.destroy();
  }, [theme]);
  if (height < 200) return null;
  return (
    <div className={`sharks-band sharks-band--${strength}`} style={{ height }} role="img" aria-label={label}>
      <canvas ref={canvasRef} className="sharks-band__canvas" aria-hidden="true" />
    </div>
  );
}

/**
 * §6.1 B and C: a visit in a page's ground layer (under the glass cards). Mounted by its owner for one visit of
 * `seconds`: in over --m-normal (B) or --m-fast (C), swim, out over --m-slow (B) or --m-normal (C), then `onDone()`
 * and the owner unmounts it: no canvas, no loop. A pause (window hidden or blurred) ends the visit. Reduced motion:
 * the owner never mounts it (the visit is absent). The element is positioned by its owner's CSS (`className`).
 */
export function SharksVisit({ seconds, kind, strength = 'present', className = '', height, onDone, label = 'Sharks passing' }: {
  seconds: number;
  kind: 'today' | 'quiz';
  strength?: 'quiet' | 'present';
  className?: string;
  /** Today: the measured water height (the owner's CSS fills the box when omitted). */
  height?: number;
  onDone: () => void;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  // The out fade starts before the visit's end so the canvas is gone at `seconds` (C: out over --m-normal from
  // 1,650 ms of 2,000; B: out over --m-slow at the end of the 8 s).
  const outMs = kind === 'quiz' ? 350 : 600;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let timer = 0;
    const pool = new SharksPool(canvas, {
      theme, visit: Math.max(0.1, seconds - outMs / 1000), fish: kind === 'quiz' ? 16 : 40,
      onEnd: () => {
        setLeaving(true);
        timer = window.setTimeout(() => doneRef.current(), outMs);
      },
    });
    return () => {
      window.clearTimeout(timer);
      pool.destroy();
    };
    // One visit per mount: a theme change mid-visit keeps the pool it started with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className={`sharks-visit sharks-visit--${kind} sharks-band--${strength}${leaving ? ' is-leaving' : ''}${className ? ` ${className}` : ''}`} style={height ? { height } : undefined} role="img" aria-label={label}>
      <canvas ref={canvasRef} className="sharks-band__canvas" aria-hidden="true" />
    </div>
  );
}

export { reducedMotion as sharksReducedMotion };
