import { useEffect, useRef, useState } from 'react';
import { SharksPool } from './sharksPool';
import { monoPalette } from './violetRenderer';

function themeNow(): 'light' | 'dark' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** The palette follows `html[data-theme]` and `html[data-look]`, live. */
function useLook() {
  const read = () => `${themeNow()}:${document.documentElement.dataset.look ?? ''}`;
  const [look, setLook] = useState(read);
  useEffect(() => {
    const root = document.documentElement;
    const watch = new MutationObserver(() => setLook(read()));
    watch.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-look'] });
    return () => watch.disconnect();
  }, []);
  return look;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A token's colour as `#rrggbb` (the renderer wants hex); `fallback` when the token is not a hex colour. */
function tokenHex(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}

/**
 * The sharks as a calm background on a few sections only (Preston 11 Nov: "the sharks for the background of each
 * section, maybe a few sections like home and chat, but not every, like on the right"): an open run in the page's
 * ground layer on the right of the content area, one colour (the accent) at a low opacity (CSS), nothing drawn
 * behind the text column. Runs while shown and focused; rests on a still after 30 s without input (sharksPool.ts).
 * Reduced motion: one still frame. Follows the Sharks switch (the owner mounts it only when that is on).
 */
export function SharksBackdrop({ label = 'Sharks swimming in the background' }: { label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const look = useLook();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const theme = themeNow();
    const palette = monoPalette(tokenHex('--u-accent', theme === 'dark' ? '#a596ff' : '#6d5ce7'), tokenHex('--u-paper', theme === 'dark' ? '#0b0b0d' : '#ffffff'));
    const pool = new SharksPool(canvas, { theme, palette, idleRest: 30, fish: 18, still: reducedMotion() });
    return () => pool.destroy();
  }, [look]);
  return (
    <div className="sharks-backdrop" role="img" aria-label={label}>
      <canvas ref={canvasRef} className="sharks-band__canvas" aria-hidden="true" />
    </div>
  );
}
