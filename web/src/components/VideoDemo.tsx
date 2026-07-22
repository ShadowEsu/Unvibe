'use client';

/**
 * VideoDemo — the product demo section.
 *
 * A poster/video frame with a Vibe-Island-style row of simple chapters underneath
 * (number · label · one-line detail). Clicking a chapter seeks the video; the active
 * chapter highlights as playback crosses its start time.
 *
 * The demo video is Unvibe's hosted pitch-deck recording (Vercel Blob) — the same URL
 * the marketing site's HeroVideo/HeroDemo use. Override with NEXT_PUBLIC_DEMO_VIDEO_URL,
 * or drop a local file at `web/public/demo/unvibe-demo.mp4` and set that env to
 * `/demo/unvibe-demo.mp4`. If no source resolves, a labelled placeholder shows instead
 * of a broken <video>.
 *
 * Chapter `t` values are PLACEHOLDERS. Once the real video exists, set each `t` to the
 * second where that section begins (watch the video, read the timestamps off the
 * scrubber) — the UI updates automatically.
 */
import { useEffect, useRef, useState } from 'react';
import styles from './VideoDemo.module.css';
import { AmbientLightField } from './AmbientLightField';

export interface DemoChapter {
  t: number; // start time in seconds (placeholder until the real video lands)
  label: string;
  detail: string;
}

/** Unvibe's hosted demo recording — same source the marketing site defaults to. */
const DEFAULT_DEMO_SRC =
  process.env.NEXT_PUBLIC_DEMO_VIDEO_URL?.trim() ||
  'https://kgtnwm7mfrhop6vj.public.blob.vercel-storage.com/investors/unvibe-demo.mp4';

const DEFAULT_CHAPTERS: DemoChapter[] = [
  { t: 0, label: 'Select code', detail: 'Highlight AI-written code in any app — Cursor, VS Code, a browser.' },
  { t: 8, label: 'Choose depth', detail: 'Pick New → Expert. The explanation meets you where you are.' },
  { t: 18, label: 'Understand it', detail: 'A context-aware explanation streams in without leaving your editor.' },
  { t: 30, label: 'Keep the knowledge', detail: 'Save the concept or snippet — it becomes part of your dictionary.' },
  { t: 42, label: 'Study later', detail: 'Review, test yourself, and build a real mental model over time.' },
];

export function VideoDemo({
  src = DEFAULT_DEMO_SRC,
  poster,
  chapters = DEFAULT_CHAPTERS,
}: {
  /** Defaults to Unvibe's hosted demo; pass "" to force the placeholder. */
  src?: string;
  poster?: string;
  chapters?: DemoChapter[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(0);

  // Track which chapter the playhead is in.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      const now = v.currentTime;
      let idx = 0;
      for (let i = 0; i < chapters.length; i++) if (now >= chapters[i].t) idx = i;
      setActive(idx);
    };
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, [chapters]);

  const seek = (i: number) => {
    setActive(i);
    const v = videoRef.current;
    if (v && src) {
      v.currentTime = chapters[i].t;
      void v.play().catch(() => {});
    }
  };

  return (
    <section className={styles.wrap} aria-label="Product demo">
      <AmbientLightField variant="section" className={styles.bg} />
      <div className={styles.inner}>
        <p className={styles.kicker}>See it work</p>
        <h2 className={styles.title}>Understand code without leaving your flow.</h2>

        <div className={styles.stage}>
          <div className={styles.deviceGlow} aria-hidden="true" />
          <div className={styles.device}>
            {src ? (
              <video
                ref={videoRef}
                className={styles.video}
                src={src}
                poster={poster}
                controls
                playsInline
                preload="metadata"
              />
            ) : (
              <div className={styles.placeholder} role="img" aria-label="Demo video coming soon">
                <div className={styles.playBadge} aria-hidden="true">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5.4c-.7-.4-1.5.1-1.5.9v11.4c0 .8.8 1.3 1.5.9l9.8-5.7c.7-.4.7-1.4 0-1.8L8 5.4z" />
                  </svg>
                </div>
                <p className={styles.placeholderText}>Pitch-deck demo lands here</p>
                <p className={styles.placeholderHint}>
                  Add <code>public/demo/unvibe-demo.mp4</code> and the chapters below sync to it.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Vibe-Island-style simple chapter row: label + one line of detail. */}
        <ol className={styles.chapters}>
          {chapters.map((c, i) => (
            <li key={c.label}>
              <button
                type="button"
                className={`${styles.chip}${i === active ? ' ' + styles.on : ''}`}
                onClick={() => seek(i)}
                aria-current={i === active}
              >
                <span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.chapLabel}>{c.label}</span>
                <span className={styles.chapDetail}>{c.detail}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
