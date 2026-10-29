"use client";

import { useEffect, useRef, useState } from "react";
import { AutoPlayVideo } from "@/components/paper/AutoPlayVideo";
import { DotGrid } from "@/components/paper/DotGrid";

/** When the kicker's shortcut key has finished its press (vibe.css `uKeyPress`: 900 ms delay + ~110 ms down). */
const KEY_PRESSED_AT = 1010;

/**
 * The site demo cut (1920x1080, music only). Files in public/videos are named by the first 8 hex of the
 * MP4's SHA-256: `.mp4`, `-poster.webp` (1280 wide), `-poster-720.webp` and `.en.vtt` captions.
 * Source and licence: docs/licenses.md.
 */
const DEMO = "/videos/unvibe-demo-v1-36f2e404";
/** The cut opens on its bare background; the title is on screen from about 0.5 s (ffmpeg). */
const TITLE_FRAME_AT = 0.6;

/** Real app recordings and screenshots, directly under the hero promise. */
export function AppTour() {
  const posterRef = useRef<HTMLImageElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  // undefined until the poster image settles; then its chosen file (or null if it failed).
  const [poster, setPoster] = useState<string | null>();
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);

  // The window opens once a quarter of it is on screen, but never before the hero's key press lands.
  useEffect(() => {
    const node = windowRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setOpen(true);
      return;
    }
    let timer = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      timer = window.setTimeout(() => setOpen(true), Math.max(0, KEY_PRESSED_AT - performance.now()));
    }, { threshold: 0.25 });
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const img = posterRef.current;
    if (!img) return;
    const settle = () => setPoster(img.naturalWidth ? img.currentSrc || img.src : null);
    if (img.complete) {
      settle();
      return;
    }
    img.addEventListener("load", settle, { once: true });
    img.addEventListener("error", settle, { once: true });
    return () => {
      img.removeEventListener("load", settle);
      img.removeEventListener("error", settle);
    };
  }, []);

  return (
    <section className="vtour" id="tour" aria-labelledby="tour-title">
      <DotGrid />
      <div className="vtour__head">
        <h2 id="tour-title">
          Watch Unvibe <em>in action.</em>
        </h2>
      </div>
      <div ref={windowRef} className={open ? "vtour__window is-open" : "vtour__window"}>
        <div className="vtour__bar" aria-hidden="true">
          <i /><i /><i />
          <span>Unvibe 0.1.43 and 0.1.44</span>
        </div>
        <div
          className={playing ? "vtour__media is-playing" : "vtour__media"}
          onTimeUpdateCapture={(event) => {
            if ((event.target as HTMLVideoElement).currentTime >= TITLE_FRAME_AT) setPlaying(true);
          }}
          onPauseCapture={(event) => {
            if ((event.target as HTMLVideoElement).currentTime < TITLE_FRAME_AT) setPlaying(false);
          }}
          onEndedCapture={() => setPlaying(false)}
          onEmptiedCapture={() => setPlaying(false)}
        >
          {/* The responsive poster stays above the video until playback is past the cut's first frames, which
              are the bare background (the title lands at about 0.5 s), and comes back whenever the video stops
              before that point or ends. It does not intercept controls, so reduced-motion visitors can still
              start playback themselves. Once the image settles, the video uses its already cached file for the
              native poster too.
              loading="lazy": on phones the headline, not the poster, is the largest paint, so the poster waits for
              layout instead of sharing the first round trips with the stylesheets and fonts (still fetched at once when on screen). */}
          <img
            ref={posterRef}
            className="vtour__poster"
            src={`${DEMO}-poster.webp`}
            srcSet={`${DEMO}-poster-720.webp 720w, ${DEMO}-poster.webp 1280w`}
            sizes="(max-width: 1120px) calc(100vw - 2.5rem), 1080px"
            width={1280}
            height={720}
            loading="lazy"
            alt=""
          />
          <AutoPlayVideo
            src={`${DEMO}.mp4`}
            poster={poster ?? undefined}
            controls={poster !== undefined}
            preload="none"
            width={1920}
            height={1080}
            captions={`${DEMO}.en.vtt`}
            label="Unvibe demo with music and no voice: select code and press the shortcut, an explanation at different depths, a follow-up question, Test me, a React hook explained, a Change Brief (the brief is free; the AI explanation of a change is Pro), the Library, a saved lesson, a review quiz, Why does this exist?, the same panel on Windows, privacy settings, and Try it in the browser"
          />
        </div>
        <p className="vtour__caption">
          Unvibe 0.1.43 and 0.1.44 on Mac and Windows: explain at your depth, a follow-up, Test me, a Change Brief (free; the AI explanation of a change is Pro), the Library and a review quiz, Why does this exist?, privacy settings and Try it. Real screen recordings at 1x and real screenshots, waits cut, sample code. Music only.
        </p>
      </div>
    </section>
  );
}
