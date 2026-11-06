"use client";

/**
 * Select → explain, the money shot (Design row 545, direction A, moment 2). One pinned stage, three marks:
 *   1  the selection is drawn over the debounce function,
 *   2  Control+U (Ctrl+Alt+U) presses,
 *   3  the real panel opens and streams: the 0.1.49 recording, scrubbed by scroll.
 * The step rail on the left lights per mark; a click on a mark scrolls to it.
 *
 * Wide screens (> 900 px, motion allowed): a 250 vh section with a sticky 100 vh stage (spacing reserved in CSS, CLS 0).
 * Scroll progress drives a paused GSAP timeline; the panel's recording is seeked from it (a short-GOP copy of the same
 * cut, so seeks stay cheap). ≤ 900 px: no pin and no scrub; the sequence plays once in view with the marks as tap
 * targets. Reduced motion and no JS: ONE composed still (Design r07 MUST 2): every mark's end state at rest, the drawn
 * selection beside the panel's real finished frame; > 900 px the stage takes the full width so the panel reads ≥ 11 px.
 *
 * `take` is the footage. The default is the live hero's panel-only recording, with the editor and keys drawn by the
 * site (caption says so). When the whole-screen take clears Security, pass it as a `kind: "screen"` take: the whole
 * capture then scrubs across all three marks and the drawn editor steps aside.
 */
import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import { CAPTION, HERO_RECORDING, SHOTS } from "@/site/content";
import type { VisitorDevice } from "@/lib/shortcuts";
import { loadGsap, reducedMotion } from "./gsap";
import { VibeGuide } from "@/site/parts";

export interface Take {
  /** "panel": only the panel is filmed (the site draws the editor and keys). "screen": one capture of all three marks. */
  kind: "panel" | "screen";
  /** The cut that plays (≤ 900 px) and its short-GOP copy that scroll seeks (wide screens). */
  webm: string;
  mp4: string;
  scrubMp4: string;
  poster: { src: string; width: number; height: number };
  alt: string;
  caption: string;
  /** Seconds into the cut: where each mark starts and where the scrub ends ("panel" takes use only `read` and `end`). */
  marks: { select: number; press: number; read: number; end: number };
}

export const PANEL_TAKE: Take = {
  kind: "panel",
  webm: HERO_RECORDING.webm,
  mp4: HERO_RECORDING.mp4,
  scrubMp4: "/unvibe/real/0149/hero-panel-0149-scrub.mp4",
  // At rest (reduced motion, no JS) the panel is the same run's real Follow-up answer ("Short answer"), a different
  // real moment from the hero's Beginner rest frame (Council R08: the tour's RM still repeated the hero's); same
  // 704 × 905 framing, so the rest crops (wide 70 %, phone 0.72) apply unchanged
  poster: SHOTS.followUp,
  alt: SHOTS.followUp.alt,
  caption: HERO_RECORDING.caption,
  // 0149 cut, measured frame by frame (Motion 06 Nov): frame 0 is already mid-request, the first explanation word is
  // frame 26 (1.083 s), and the Beginner switch starts at frame 78 (3.25 s). Mark 3 lands at the first words + 1.5 s, so
  // the reader always sees sentences (Design gate r5 MUST 2); the scrub stops at 3.1 s, the answer still streaming (the
  // cut moves on to Beginner at 3.25 s, before the Intermediate answer finishes).
  marks: { select: 0, press: 0, read: 2.6, end: 3.1 },
};

const LINES: readonly [string, string][] = [
  ["function", " debounce(fn, wait) {"],
  ["  let", " timer;"],
  ["  return", " (...args) => {"],
  ["", "    clearTimeout(timer);"],
  ["", "    timer = setTimeout(() => fn(...args), wait);"],
  ["", "  };"],
  ["", "}"],
];

/** Where each mark starts on the wide scrub, as timeline progress (0-1). The rail lights from these. The recording
 * (panel take) runs from REC to AT.read at its own speed ratio, so mark 3 meets `take.marks.read`; then the panel lifts
 * to reading size (ZOOM) and holds. */
const AT = { select: 0.06, press: 0.3, read: 0.62 } as const;
const REC = 0.4;
const ZOOM = { from: 0.68, to: 0.8 } as const;
const MARKS = ["select", "press", "read"] as const;

const keysFor = (device: VisitorDevice) => (device === "windows" ? ["Ctrl", "Alt", "U"] : ["Control", "U"]);

export function SelectExplain({ device, take = PANEL_TAKE, title = "Select. Press. Read." }: { device: VisitorDevice; take?: Take; title?: string }) {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"rest" | "scrub" | "play">("rest");
  const [active, setActive] = useState(-1);
  // Vibe's one happy reaction each time the reader reaches the panel (mark 3) from an earlier mark
  const [happy, setHappy] = useState(0);
  const prevActive = useRef(-1);
  useEffect(() => {
    if (active === 2 && prevActive.current < 2) setHappy((n) => n + 1);
    prevActive.current = active;
  }, [active]);
  const jump = useRef<(mark: number) => void>(() => undefined);
  const keys = keysFor(device);
  // Design's copy diet (row 551): step labels only, no body text
  const labels = ["Select code", `Press ${device === "windows" ? "Ctrl+Alt+U" : "Control+U"}`, "Read it beside your editor"];

  useEffect(() => {
    if (reducedMotion()) return undefined;
    const wide = window.matchMedia("(min-width: 901px)");
    const pick = () => setMode(wide.matches ? "scrub" : "play");
    pick();
    wide.addEventListener("change", pick);
    return () => wide.removeEventListener("change", pick);
  }, []);

  // The recording loads only once the section is within a viewport of the screen. GSAP is fetched and parsed when the
  // browser is idle after load, not on approach: at 390 with 4× CPU its parse is a ~66 ms task, which landed mid-scroll
  // in r6 (5 dropped frames); right after load it made 150-207 ms long tasks in r3. Idle keeps it out of both.
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (mode === "rest" || !el) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); setNear(true); } }, { rootMargin: "100% 0px 100% 0px" });
    io.observe(el);
    let idle = 0;
    const prefetch = () => { idle = window.requestIdleCallback ? window.requestIdleCallback(() => void loadGsap(), { timeout: 4000 }) : window.setTimeout(() => void loadGsap(), 1500); };
    if (document.readyState === "complete") prefetch(); else window.addEventListener("load", prefetch, { once: true });
    return () => { io.disconnect(); window.removeEventListener("load", prefetch); if (window.cancelIdleCallback) window.cancelIdleCallback(idle); window.clearTimeout(idle); };
  }, [mode]);

  useEffect(() => {
    const el = root.current;
    const rec = video.current;
    if (mode === "rest" || !near || !el || !rec) return undefined;
    let dead = false;
    let cleanup = () => undefined as void;
    const q = <T extends Element>(s: string) => Array.from(el.querySelectorAll<T>(s));

    void loadGsap().then(({ gsap }) => {
      if (dead) return;
      const ctx = gsap.context(() => {
        const bars = q<HTMLElement>(".mx-se__bar"), inks = q<HTMLElement>(".mx-se__ink"), caps = q<HTMLElement>(".mx-se__bigkeys .mx-key__face");
        // the face moves into its fixed ink block: 4 px at 1440 (hard shadow 6 → 2), 3 px at 390 (4 → 1)
        const press = caps[0] ? parseFloat(getComputedStyle(caps[0]).getPropertyValue("--press")) || 4 : 4;
        const panel = el.querySelector<HTMLElement>(".mx-se__panel");
        const screen = take.kind === "screen";
        gsap.set(rec, { opacity: 1 });
        const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
        if (!screen) {
          gsap.set(bars, { scaleX: 0 });
          gsap.set(inks, { clipPath: "inset(0 100% 0 0)" });
          gsap.set(panel, { clipPath: "inset(0 0 0 100%)" });
          tl.to(bars, { scaleX: 1, duration: 0.03, stagger: 0.032 }, AT.select)
            .to(inks, { clipPath: "inset(0 0% 0 0)", duration: 0.03, stagger: 0.032 }, AT.select)
            .to(caps, { x: press, y: press, duration: 0.012, stagger: 0.016, ease: "power2.in" }, AT.press + 0.01)
            .to(caps, { x: 0, y: 0, duration: 0.02, stagger: 0.016, ease: "power2.out" }, AT.press + 0.045)
            .to(panel, { clipPath: "inset(0 0 0 0%)", duration: 0.05, ease: "expo.out" }, AT.press + 0.05)
            .set(panel, { clipPath: "none" }, AT.press + 0.1); // a finished wipe must not clip the lift's shadow
        }
        // the recording: panel take from 0 at REC, reaching marks.read at AT.read and marks.end after; screen take whole
        const clock = { t: screen ? take.marks.select : 0 };
        const recSpan = screen ? 0.94 : ((AT.read - REC) * take.marks.end) / take.marks.read;
        tl.to(clock, { t: take.marks.end, duration: recSpan }, screen ? AT.select : REC);
        // ≥ 901 px: once the explanation is up, the panel lifts to reading size (text ≥ 11 px; Design gate r5), the
        // editor steps back; transform and opacity only
        const zoom = parseFloat(getComputedStyle(el).getPropertyValue("--mx-se-zoom")) || 1;
        if (mode === "scrub" && zoom > 1 && panel) {
          const fit = Math.min(zoom, (innerHeight - 64) / Math.max(1, panel.offsetHeight));
          tl.to(panel, { scale: fit, duration: ZOOM.to - ZOOM.from, ease: "power2.inOut" }, ZOOM.from)
            .to(el.querySelector(".mx-se__lift"), { opacity: 1, duration: ZOOM.to - ZOOM.from }, ZOOM.from)
            .to(el.querySelector(".mx-se__editor"), { opacity: 0.35, duration: ZOOM.to - ZOOM.from }, ZOOM.from)
            .to(el.querySelector(".mx-se__vibe"), { x: -panel.offsetWidth * (fit - 1), duration: ZOOM.to - ZOOM.from, ease: "power2.inOut" }, ZOOM.from);
        }
        tl.to({}, { duration: 1 - tl.duration() > 0 ? 1 - tl.duration() : 0 });

        const markAt = (p: number) => (p >= AT.read ? 2 : p >= AT.press ? 1 : p >= AT.select ? 0 : -1);
        if (mode === "scrub") {
          // Seek the recording to the clock, at most once per frame and never while a seek is still landing.
          let raf = 0;
          let want = -1;
          const seek = () => {
            raf = 0;
            if (want < 0 || rec.seeking || rec.readyState < HTMLMediaElement.HAVE_METADATA) return;
            if (Math.abs(rec.currentTime - want) > 1 / 48) rec.currentTime = want;
          };
          tl.eventCallback("onUpdate", () => { want = clock.t; raf ||= requestAnimationFrame(seek); });
          rec.addEventListener("seeked", () => { raf ||= requestAnimationFrame(seek); });
          const progress = () => {
            const r = el.getBoundingClientRect();
            return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
          };
          let tick = 0;
          const onScroll = () => {
            tick ||= requestAnimationFrame(() => {
              tick = 0;
              const p = progress();
              tl.progress(p);
              setActive(markAt(p));
            });
          };
          onScroll();
          window.addEventListener("scroll", onScroll, { passive: true });
          jump.current = (mark) => {
            const r = el.getBoundingClientRect();
            const top = r.top + scrollY + (r.height - innerHeight) * (AT[MARKS[mark]] + 0.04);
            window.scrollTo({ top, behavior: "smooth" });
          };
          cleanup = () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(tick); cancelAnimationFrame(raf); };
        } else {
          // ≤ 900 px: the same choreography in real time, once, when the stage is half in view; marks replay from there.
          // Mark 3 lights when the recording reaches marks.read (sentences on screen), and it stops on marks.end.
          const live = gsap.timeline({ paused: true });
          const span = (a: number, b: number) => (b - a) * 3; // 1 unit of scrub progress = 3 s here
          if (!screen) {
            live.to(bars, { scaleX: 1, duration: 0.25, stagger: 0.08, ease: "power2.out" }, "select")
              .to(inks, { clipPath: "inset(0 0% 0 0)", duration: 0.25, stagger: 0.08, ease: "power2.out" }, "select")
              .addLabel("press", "+=0.15")
              .to(caps, { x: press, y: press, duration: 0.12, stagger: 0.06, ease: "power2.in" }, "press")
              .to(caps, { x: 0, y: 0, duration: 0.18, stagger: 0.06, ease: "power2.out" }, "press+=0.15")
              .to(panel, { clipPath: "inset(0 0 0 0%)", duration: 0.42, ease: "expo.out" }, "press+=0.2")
              .addLabel("rec", "press+=0.2")
              .addLabel("read", `rec+=${take.marks.read}`);
          } else live.addLabel("rec", 0).addLabel("press", span(0, AT.press)).addLabel("read", span(0, AT.read));
          const startRec = (at: number) => { rec.currentTime = at; void rec.play().catch(() => undefined); };
          live.call(() => startRec(screen ? take.marks.select : 0), [], "rec");
          const marksAt = ["select", "press", "read"];
          marksAt.forEach((label, i) => live.call(() => setActive(i), [], label));
          const stop = () => { if (rec.currentTime >= take.marks.end) { rec.pause(); rec.currentTime = take.marks.end; } };
          rec.addEventListener("timeupdate", stop);
          const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); live.play(0); } }, { threshold: 0.5 });
          io.observe(el.querySelector(".mx-se__stage")!);
          // a tap lands on that mark's end state: mark 3 = the whole panel in, the recording on its sentences
          jump.current = (mark) => {
            rec.pause();
            live.play(marksAt[mark]);
            setActive(mark);
            if (mark === 2) startRec(take.marks.read);
            else rec.currentTime = screen ? take.marks.select : 0;
          };
          cleanup = () => { io.disconnect(); rec.pause(); rec.removeEventListener("timeupdate", stop); };
        }
      }, el);
      const prev = cleanup;
      cleanup = () => { prev(); ctx.revert(); };
    });
    return () => { dead = true; cleanup(); };
  }, [mode, take, near]);

  const live = mode !== "rest";
  return (
    <section ref={root} className={`mx-se${live ? ` is-${mode}` : ""}`} aria-labelledby="mx-se-title">
      <div className="mx-se__pin">
        <div className="mx-se__rail">
          <h2 id="mx-se-title" className="mx-se__h2">{title}</h2>
          <ol className="mx-se__marks">
            {MARKS.map((mark, i) => (
              <li key={mark} className={`mx-se__mark${live && i <= active ? " is-on" : ""}${live && i === active ? " is-now" : ""}`}>
                <button type="button" className="mx-se__go" onClick={() => jump.current(i)} disabled={!live} aria-current={live && i === active ? "step" : undefined}>
                  <span className="mx-se__n" aria-hidden="true">{i + 1}</span>
                  <span className="mx-se__t">{labels[i]}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <figure className="mx-se__stage">
          {/* Vibe on the stage's top edge, beside the panel: one happy hop each time the reader reaches the panel
              (re-keyed to replay). It sits clear of the panel even at full lift. */}
          <span className="mx-se__vibe"><span key={happy} className={happy ? "mx-se__react" : undefined}><VibeGuide mood="happy" size={48} look={[1.2, 0.6]} /></span></span>
          <div className={`mx-se__frame mx-se__frame--${take.kind}`}>
            {take.kind === "panel" ? (
              <div className="mx-se__editor" aria-hidden="true">
                <p className="mx-se__path">src › debounce.js</p>
                <pre className="mx-se__code">
                  {LINES.map(([kw, rest], i) => (
                    <Fragment key={i}>
                      <span className="mx-se__line" style={{ "--ln": i } as CSSProperties}>
                        <i className="mx-se__bar" />
                        <span className="mx-se__plain">{kw ? <span className="k">{kw}</span> : null}{rest}</span>
                        <span className="mx-se__ink">{kw}{rest}</span>
                      </span>
                      {i < LINES.length - 1 ? "\n" : null}
                    </Fragment>
                  ))}
                </pre>
              </div>
            ) : null}
            <div className="mx-se__slot">
            {take.kind === "panel" ? (
              <span className="mx-se__bigkeys" aria-hidden="true">
                {keys.map((key, i) => (
                  <kbd key={key} className={`mx-key mx-se__bigkey${i === keys.length - 1 ? " mx-se__bigkey--last" : ""}`}><span className="mx-key__face">{key}</span></kbd>
                ))}
              </span>
            ) : null}
            <div className="mx-se__panel">
              <i className="mx-se__lift" aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element -- the rest frame (the run's Follow-up still), fixed size */}
              <img src={take.poster.src} width={take.poster.width} height={take.poster.height} alt={take.alt} decoding="async" loading="lazy" />
              {live && near ? (
                <video ref={video} className="mx-se__rec" width={take.poster.width} height={take.poster.height} muted playsInline preload="auto" aria-hidden="true">
                  {mode === "scrub" ? <source src={take.scrubMp4} type="video/mp4" /> : (
                    <>
                      <source src={take.webm} type="video/webm" />
                      <source src={take.mp4} type="video/mp4" />
                    </>
                  )}
                </video>
              ) : null}
            </div>
            </div>
          </div>
          {/* live, the recording plays here; at rest the panel is a still: each gets its own caption, stacked (no shift) */}
          <figcaption className="mx-se__cap mx-cap2"><span className="lx-cap mx-cap2__rec">{take.caption}</span><span className="lx-cap mx-cap2__still">{CAPTION.v0149}</span></figcaption>
        </figure>
      </div>
    </section>
  );
}
