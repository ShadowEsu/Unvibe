'use client';

/**
 * AmbientLightField — original Unvibe "sunlight under moving water" hero atmosphere.
 *
 * A layered, art-directed lighting composite (base glow → caustic light bands →
 * god rays → grain/dither → vignette + product mask). Pure CSS animation + SVG
 * filters; no WebGL and no per-frame React state, so it's cheap, cross-browser,
 * and degrades to a clean static image.
 *
 * Reference study (technique only, nothing copied): docs/research/vibe-island-ambient-light.md
 *
 * Behavior baked in:
 *  - prefers-reduced-motion → static (animations off)
 *  - prefers-reduced-transparency → reduced blur/opacity (handled in CSS)
 *  - touch / reduced-motion → no pointer parallax
 *  - tab hidden or field scrolled offscreen → animation paused (class toggle only)
 *  - mobile → fewer layers + no displacement (CSS media queries)
 *  - ?ambientDebug=1 (dev only) → per-layer toggle panel
 */
import { useEffect, useRef, useState } from 'react';
import styles from './AmbientLightField.module.css';

export type AmbientVariant = 'hero' | 'section' | 'cta';

const LAYERS = ['base', 'bands', 'rays', 'caustic', 'grain', 'vignette', 'mask'] as const;
type Layer = (typeof LAYERS)[number];

export function AmbientLightField({
  variant = 'hero',
  className,
}: {
  variant?: AmbientVariant;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [debug, setDebug] = useState(false);
  const [off, setOff] = useState<Record<Layer, boolean>>({} as Record<Layer, boolean>);

  // --- pause when hidden or offscreen (class toggle only — no re-render churn) ---
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    let onscreen = true;
    const apply = () => {
      const paused = document.hidden || !onscreen;
      el.classList.toggle(styles.paused, paused);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        onscreen = entry.isIntersecting;
        apply();
      },
      { rootMargin: '120px' },
    );
    io.observe(el);
    document.addEventListener('visibilitychange', apply);
    apply();

    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', apply);
    };
  }, []);

  // --- restrained pointer parallax (few px, smoothed; off for touch / reduced-motion) ---
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (reduceMotion || coarse) return;

    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    const MAX = 6; // px — deliberately tiny

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      tx = Math.max(-1, Math.min(1, nx)) * MAX;
      ty = Math.max(-1, Math.min(1, ny)) * MAX;
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
    };

    const tick = () => {
      cx += (tx - cx) * 0.06; // slow lerp toward rest
      cy += (ty - cy) * 0.06;
      el.style.setProperty('--px', `${cx.toFixed(2)}px`);
      el.style.setProperty('--py', `${cy.toFixed(2)}px`);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    window.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  // --- dev-only debug toggles (?ambientDebug=1) ---
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const params = new URLSearchParams(window.location.search);
    setDebug(params.get('ambientDebug') === '1');
  }, []);

  const hidden = (l: Layer) => (off[l] ? ' ' + styles.hide : '');

  return (
    <div
      ref={rootRef}
      className={`${styles.field} ${styles[variant]}${className ? ' ' + className : ''}`}
      aria-hidden="true"
      data-variant={variant}
    >
      {/* SVG filter defs: static grain + one small caustic displacement (desktop only) */}
      <svg className={styles.defs} width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="al-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n" />
            <feColorMatrix in="n" type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.5" intercept="0" />
            </feComponentTransfer>
          </filter>
          <filter id="al-caustic" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="7" result="warp">
              {/* very slow drift of the distortion field — no marching pattern */}
              <animate
                attributeName="baseFrequency"
                dur="38s"
                values="0.012 0.02; 0.016 0.014; 0.012 0.02"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="42" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <div className={styles.base + hidden('base')} />
      <div className={styles.caustic + hidden('caustic')}>
        <div className={styles.bands + hidden('bands')}>
          <span className={styles.band1} />
          <span className={styles.band2} />
          <span className={styles.band3} />
        </div>
      </div>
      <div className={styles.rays + hidden('rays')}>
        <span className={styles.ray1} />
        <span className={styles.ray2} />
        <span className={styles.ray3} />
      </div>
      <div className={styles.mask + hidden('mask')} />
      <div className={styles.grain + hidden('grain')} />
      <div className={styles.vignette + hidden('vignette')} />
      <div className={styles.scrim} />

      {debug && (
        <div className={styles.debug}>
          <strong>ambient debug</strong>
          {LAYERS.map((l) => (
            <label key={l}>
              <input
                type="checkbox"
                checked={!off[l]}
                onChange={() => setOff((o) => ({ ...o, [l]: !o[l] }))}
              />
              {l}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
