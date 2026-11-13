import { useEffect, useRef, useState } from 'react';
import { SharksPool } from './sharksPool';
import { monoPalette } from './violetRenderer';

/** `html[data-theme]`, live: the palette is rebuilt when it changes. */
function useTheme() {
  const root = document.documentElement;
  const [theme, setTheme] = useState(root.dataset.theme);
  useEffect(() => {
    const watch = new MutationObserver(() => setTheme(root.dataset.theme));
    watch.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => watch.disconnect();
  }, [root]);
  return theme;
}

/** `prefers-reduced-motion: reduce`, live. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(media.matches);
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return reduced;
}

/** A token's colour as `#rrggbb` (the renderer wants hex); `fallback` when the token is not a hex colour. */
function tokenHex(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}

/**
 * The sharks behind everything (Design r3-flat OPTIONS.md "Sharks: behind everything", as Mono amends it): one
 * window-sized canvas behind every page of the main window, two sharks in the sharks' purple (`--u-accent`) on the
 * ground (`--u-paper`), the canvas at `--u-sharks-alpha` (mono.css). Swims at 30 frames a second focused, 15 visible
 * but not focused, stops while hidden (sharksPool.ts). Reduced motion: one still frame. The owner mounts it only while
 * the Sharks switch is on, so with it off there is no canvas.
 */
export function SharksBackdrop({ label = 'Sharks swimming in the background' }: { label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();
  const still = useReducedMotion();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dark = theme === 'dark';
    const palette = monoPalette(tokenHex('--u-accent', dark ? '#7357f6' : '#6f52f2'), tokenHex('--u-paper', dark ? '#000000' : '#ffffff'));
    const pool = new SharksPool(canvas, { palette, still });
    // The evidence harness poses a still through this (SharksPool.pose / poseAll); nothing in the app reads it.
    (canvas as HTMLCanvasElement & { sharksPool?: SharksPool }).sharksPool = pool;
    return () => {
      delete (canvas as HTMLCanvasElement & { sharksPool?: SharksPool }).sharksPool;
      pool.destroy();
    };
  }, [theme, still]);
  return (
    <div className="sharks-backdrop" role="img" aria-label={label}>
      <canvas ref={canvasRef} className="sharks-band__canvas" aria-hidden="true" />
    </div>
  );
}
