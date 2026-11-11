import { useEffect, useRef, useState } from 'react';
import { SharksPool } from './sharksPool';

/**
 * A band of ocean on a companion page (Design r2-motion, in-app sharks): empty states (above the copy, never behind
 * it), the quiz's done card (one short visit above the heading) and Today's pool (the free area under the last card,
 * an 8 s visit, the pointer wakes it). The palette follows `html[data-theme]`; prefers-reduced-motion draws one still
 * frame; the loop pauses while the window is hidden or blurred (sharksPool.ts). `strength` sets the ink's opacity:
 * Design picks between the two from stills. After a visit the canvas fades out over --m-normal (`is-resting`), and
 * with `wakeOnHover` a pointer entering the band starts another.
 */
export function SharksBand({ height, strength = 'present', visit, wakeOnHover = false, className = '', fish, label = 'Sharks swimming' }: {
  height: number;
  strength?: 'quiet' | 'present';
  visit?: number;
  wakeOnHover?: boolean;
  className?: string;
  fish?: number;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 'swim' → 'resting' (the canvas fades over --m-normal) → 'gone' (no canvas, no loop; SPEC §4: canvas count 0 after
  // a visit). A wake mounts a fresh canvas and pool.
  const [phase, setPhase] = useState<'swim' | 'resting' | 'gone'>('swim');
  const [run, setRun] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));

  useEffect(() => {
    const root = document.documentElement;
    const watch = new MutationObserver(() => setTheme(root.dataset.theme === 'dark' ? 'dark' : 'light'));
    watch.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => watch.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer = 0;
    const pool = new SharksPool(canvas, {
      theme, visit, fish, still: reduced,
      onRest: () => {
        setPhase('resting');
        timer = window.setTimeout(() => setPhase('gone'), reduced ? 0 : 400);
      },
    });
    return () => {
      window.clearTimeout(timer);
      pool.destroy();
    };
  }, [theme, visit, fish, run]);

  const wake = () => {
    if (!wakeOnHover || phase === 'swim') return;
    setPhase('swim');
    setRun((n) => n + 1);
  };

  return (
    <div
      className={`sharks-band sharks-band--${strength}${phase === 'resting' ? ' is-resting' : ''}${className ? ` ${className}` : ''}`}
      style={{ height }}
      role="img"
      aria-label={label}
      onPointerEnter={wake}
    >
      {phase === 'gone' ? null : <canvas key={run} ref={canvasRef} className="sharks-band__canvas" aria-hidden="true" />}
    </div>
  );
}

/**
 * Today's pool: the free area between the last card and the ask bar. The slot is the page's last block; its height
 * is what is left of the scroller's content box below it (the page's bottom padding already clears the ask bar), so
 * the page never grows a scrollbar for it. Mounted only when that is at least `minHeight` tall (no pool on a full
 * page), with an 8 s visit, the pointer waking it.
 */
export function SharksPoolSlot({ enabled, minHeight = 140 }: { enabled: boolean; minHeight?: number }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || !enabled) return;
    const page = slot.closest<HTMLElement>('.page') ?? slot.parentElement;
    if (!page) return;
    const measure = () => {
      const padBottom = parseFloat(getComputedStyle(page).paddingBottom) || 0;
      const free = page.getBoundingClientRect().bottom - padBottom - (slot.getBoundingClientRect().top + page.scrollTop);
      setHeight(Math.max(0, Math.floor(free)));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(page);
    if (slot.parentElement) watch.observe(slot.parentElement);
    return () => watch.disconnect();
  }, [enabled]);
  if (!enabled) return null;
  return (
    <div ref={slotRef} className="home-pool" style={{ height: height >= minHeight ? height : 0 }} aria-hidden={height < minHeight ? true : undefined}>
      {height >= minHeight ? <SharksBand height={height} visit={8} wakeOnHover strength="quiet" fish={40} className="sharks-band--pool" label="Sharks swimming in the pool" /> : null}
    </div>
  );
}
