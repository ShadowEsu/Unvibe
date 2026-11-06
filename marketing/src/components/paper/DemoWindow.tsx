"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { HERO_RECORDING } from "@/data/homeGallery";
import { SHORTCUTS } from "@/lib/shortcuts";

/**
 * One selected line of the demo: a lime bar sweeps under it, and the ink copy of the text is revealed with it (a
 * transform-only window), so the swept part is ink on lime from its first frame, never white on lime (Design). All
 * 7 lines of the function are selected, top to bottom, 70 ms apart (`--ln`), because the recorded panel explains
 * those 7 lines (Security + Design #197 MUST). `children` is the line as the editor colours it before the sweep.
 */
function Selected({ line, text, children }: { line: number; text: string; children: ReactNode }) {
  return (
    <span className="ndemo__sel" style={{ "--ln": line } as CSSProperties}>
      <i className="ndemo__bar" />
      <span className="ndemo__plain">{children}</span>
      <span className="ndemo__ink" aria-hidden="true"><span>{text}</span></span>
    </span>
  );
}

/** When the drawn shortcut press lands in the demo loop (n.css `d-key2` at 4.417% of 24 s, after a 1 s delay). */
const LOOP_MS = 24000;
const LOOP_DELAY_MS = 1000;
const PRESS_MS = 1060;

/**
 * Keeps the recording in step with the drawn editor: it starts from its first frame at the shortcut press of each
 * loop, holds its last frame until the loop starts again, and stops whenever the demo is paused (off screen or a
 * hidden tab). It shows only while it plays, so before each press the poster underneath is what is seen.
 */
function useRecordingSync(key: RefObject<HTMLSpanElement>, video: RefObject<HTMLVideoElement>, on: boolean) {
  useEffect(() => {
    const node = video.current;
    const press = key.current?.getAnimations?.()[0];
    if (!on || !node || !press) return undefined;
    // A browser that refuses to play it (iPhone Low Power Mode refuses muted autoplay) keeps the poster: no frozen
    // frame that jumps on every re-sync.
    let refused = false;
    /** Where the recording should be now: seconds since this loop's drawn press (negative before it). */
    const wanted = () => {
      const local = Number(press.currentTime ?? 0) - LOOP_DELAY_MS;
      return local < 0 ? -1 : ((local % LOOP_MS) - PRESS_MS) / 1000;
    };
    const tick = () => {
      const into = wanted();
      if (refused || press.playState !== "running" || into < 0) {
        node.pause();
        node.classList.remove("is-on");
        if (into < 0 && node.currentTime !== 0) node.currentTime = 0;
        return;
      }
      const want = Math.min(into, HERO_RECORDING.seconds);
      // Shown only once it has a frame to show: a recording still loading leaves the poster in view.
      if (node.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      // A paused recording starts exactly where the loop is: this tick can come up to 200 ms after the press, and
      // starting from 0 then left it that far behind the drawn press for the whole loop (0.19 s at 1440 on
      // 55756d55's preview). A playing one is re-seeked only when it is well off, so it never stutters.
      const starting = node.paused && want < HERO_RECORDING.seconds;
      if (Math.abs(node.currentTime - want) > (starting ? 0.04 : 0.35)) node.currentTime = want;
      if (want < HERO_RECORDING.seconds && node.paused) {
        node.play().then(() => {
          // play() settles once the decoder runs; catch up the time that took, once.
          const now = Math.min(wanted(), HERO_RECORDING.seconds);
          if (now >= 0 && Math.abs(node.currentTime - now) > 0.06) node.currentTime = now;
          node.classList.add("is-on");
        }, () => { refused = true; node.classList.remove("is-on"); });
        return;
      }
      node.classList.add("is-on");
    };
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [key, video, on]);
}

/**
 * The window over the field: the selection drawn as editor text, and beside it the real panel at work (Unvibe
 * 0.1.49's own recording, data/homeGallery HERO_RECORDING). CSS plays the editor in a 24 s loop (n.css `d-*`); the
 * recording starts at its shortcut press. Off screen both pause. Reduced motion and no JS show the poster, the
 * recording's finished Advanced answer, and request no video at all.
 */
export function DemoWindow({ shortcut }: { shortcut: "mac" | "windows" }) {
  const ref = useRef<HTMLDivElement>(null);
  const keyRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    // The recording is mounted only after the page has loaded and the main thread is idle, so its download never
    // competes with the first paint (Design #197 SHOULD). It joins the loop wherever the drawn demo is by then.
    let idle = 0;
    let timer = 0;
    const mount = () => {
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(() => setMoving(true), { timeout: 2000 });
      else timer = window.setTimeout(() => setMoving(true), 200);
    };
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (document.readyState === "complete") mount();
      else window.addEventListener("load", mount, { once: true });
    }
    const node = ref.current;
    const io = node && typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => node.classList.toggle("is-paused", !entry.isIntersecting))
      : null;
    if (node && io) io.observe(node);
    return () => {
      window.removeEventListener("load", mount);
      if (idle) window.cancelIdleCallback(idle);
      window.clearTimeout(timer);
      io?.disconnect();
    };
  }, []);
  useRecordingSync(keyRef, videoRef, moving);
  const poster = HERO_RECORDING.poster;
  const keys = shortcut === "windows" ? ["Ctrl", "Alt", "U"] : ["Control", "U"];
  return (
    <div className="ndemo" ref={ref}>
      <div className="ndemo__frame">
        <div className="ndemo__editor" aria-hidden="true">
          <p className="ndemo__path">src › debounce.js</p>
          <pre className="ndemo__code">
            <Selected line={0} text="function debounce(fn, wait) {"><span className="k">function</span> debounce(fn, wait) {"{"}</Selected>{"\n"}
            <Selected line={1} text="  let timer;">{"  "}<span className="k">let</span> timer;</Selected>{"\n"}
            <Selected line={2} text="  return (...args) => {">{"  "}<span className="k">return</span> (...args) =&gt; {"{"}</Selected>{"\n"}
            <Selected line={3} text="    clearTimeout(timer);">{"    clearTimeout(timer);"}</Selected>{"\n"}
            <Selected line={4} text="    timer = setTimeout(() => fn(...args), wait);">{"    timer = setTimeout(() => fn(...args), wait);"}</Selected>{"\n"}
            <Selected line={5} text="  };">{"  };"}</Selected>{"\n"}
            <Selected line={6} text="}">{"}"}</Selected>
          </pre>
          <div className="ndemo__keys">
            {keys.map((key, index) => {
              const last = index === keys.length - 1;
              return <span key={key} ref={last ? keyRef : undefined} className={`ndemo__key ndemo__key--${last ? 2 : 1}`}>{key}</span>;
            })}
          </div>
        </div>
        <div className="ndemo__panel">
          {/* eslint-disable-next-line @next/next/no-img-element -- the recording's poster, a fixed-size real frame */}
          <img src={poster.src} width={poster.width} height={poster.height} alt={HERO_RECORDING.alt} decoding="async" />
          {moving ? (
            <video ref={videoRef} className="ndemo__rec" width={poster.width} height={poster.height} muted playsInline preload="auto" aria-hidden="true">
              <source src={HERO_RECORDING.webm} type="video/webm" />
              <source src={HERO_RECORDING.mp4} type="video/mp4" />
            </video>
          ) : null}
        </div>
      </div>
    </div>
  );
}
