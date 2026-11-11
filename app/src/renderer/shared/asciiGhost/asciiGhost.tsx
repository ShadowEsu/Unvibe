import { useEffect, useRef } from 'react';
import { AsciiGhost, type AsciiGhostOptions, type GhostMode, type GhostTheme } from './ghost';

export type { GhostMode, GhostTheme };

/** The theme the renderer is showing: `data-theme` on <html>, light until it is set. */
export function currentGhostTheme(): GhostTheme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/**
 * A canvas with the ASCII ghost. With prefers-reduced-motion the ghost is one still frame and `onDone`
 * fires after `stillMs` (default 900) so a start screen still leaves. Click or any key skips a start.
 */
export function AsciiGhostCanvas({
  mode,
  height,
  fontSize,
  companions,
  seed,
  className,
  label,
  stillMs = 900,
  onDone,
}: {
  mode: GhostMode;
  height?: number;
  fontSize?: number;
  companions?: number;
  seed?: number;
  className?: string;
  label?: string;
  stillMs?: number;
  onDone?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ghostRef = useRef<AsciiGhost | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const effective: GhostMode = reduced ? 'still' : mode;
    const opts: AsciiGhostOptions = {
      theme: currentGhostTheme(),
      mode: effective,
      height,
      fontSize,
      companions,
      seed,
      onDone: () => doneRef.current?.(),
    };
    const ghost = new AsciiGhost(canvas, opts);
    ghostRef.current = ghost;
    let timer = 0;
    if (reduced && mode === 'start') timer = window.setTimeout(() => doneRef.current?.(), stillMs);
    const skip = () => ghost.skip();
    if (mode === 'start') {
      window.addEventListener('keydown', skip);
      window.addEventListener('pointerdown', skip);
    }
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
      ghost.destroy();
      ghostRef.current = null;
    };
  }, [mode, height, fontSize, companions, seed, stillMs]);

  return <canvas ref={ref} className={className} role="img" aria-label={label ?? 'Vibe, drawn in code'} />;
}
