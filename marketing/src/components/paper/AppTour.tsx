"use client";

import { useEffect, useRef, useState } from "react";
import demo from "@/data/demoMedia.json";
import { AutoPlayVideo } from "@/components/paper/AutoPlayVideo";
import { DotGrid } from "@/components/paper/DotGrid";

/** When the kicker's shortcut key has finished its press (vibe.css `uKeyPress`: 900 ms delay + ~110 ms down). */
const KEY_PRESSED_AT = 1010;

/** The real app, recorded in one session, directly under the hero promise. */
export function AppTour() {
  const posterRef = useRef<HTMLImageElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  // undefined until the poster image settles; then its chosen file (or null if it failed).
  const [poster, setPoster] = useState<string | null>();
  const [open, setOpen] = useState(false);

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
          <span>Unvibe {demo.version}</span>
        </div>
        <div className="vtour__media">
          {/* The poster at the size it renders (a <video poster> can't pick one). Until it loads, the video has no
              controls and no poster, so it stays transparent over it. Then the video takes the same, already cached
              file as its poster and shows its controls. The video itself loads only once it is on screen. */}
          <img
            ref={posterRef}
            className="vtour__poster"
            src="/videos/unvibe-real-demo-poster.webp"
            srcSet="/videos/unvibe-real-demo-poster-720.webp 720w, /videos/unvibe-real-demo-poster.webp 1280w"
            sizes="(max-width: 1120px) calc(100vw - 2.5rem), 1080px"
            width={1280}
            height={800}
            alt=""
          />
          <AutoPlayVideo
            src="/videos/unvibe-real-demo.mp4"
            poster={poster ?? undefined}
            controls={poster !== undefined}
            preload="none"
            label="Screen recording of Unvibe: a code explanation streaming in, switching to Beginner depth, a follow-up question, then a Test me question"
          />
        </div>
        <p className="vtour__caption">
          Screen recording of Unvibe {demo.version} on a {demo.platform}. Every explanation was generated live; only the waits between steps are cut.
        </p>
      </div>
    </section>
  );
}
