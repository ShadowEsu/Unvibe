"use client";

/**
 * The hero stage, direction A's one visual idea (Design gate A round 1): a contained, lit stage holding the real demo
 * window (#197's DemoWindow: the drawn editor and the 0.1.49 panel recording), never cropped, with 64 px Control / U
 * keycaps in its bottom-left padding, inside the card at every width (Design pre-S-1). The keys press in step with the
 * recording: their CSS loop is pinned to the demo's own key animation (same start time, same pause), so they land on
 * the frame the recording starts.
 *
 * Load: the stage tilts in and settles flat (kit sx-stage-hero: rotateX 10° / 48 px / .96 → none, 1.2 s expo.out,
 * 200 ms after the H1 starts), then one 1 px edge light crosses the top. CSS only: it runs from the first paint and
 * needs no GSAP. The recording is opacity 1 from its first frame (DemoWindow). Reduced motion and no JS: the settled
 * stage, keys at rest, the rest frame below.
 *
 * Rest frame (Design r08 MUST, Council R07: learners felt "behind" landing on Advanced): the recording itself runs
 * Intermediate → Beginner → Advanced → Test me, but its poster, seen at first paint, between loops and under reduced
 * motion, is the Advanced answer. Over it sits the same run's real Beginner still (panel-beginner: same CI run, same
 * debounce.js, same 0.778 framing, one request earlier), preloaded; it cross-fades out while the recording plays
 * (`.ndemo__rec.is-on`) and back in before the next press. DemoWindow (production) is untouched.
 */
import { useEffect, useRef, type CSSProperties } from "react";
import { DemoWindow } from "@/components/paper/DemoWindow";
import type { VisitorDevice } from "@/lib/shortcuts";
import { VibeGuide } from "@/site/parts";
import { CAPTION, SHOTS } from "@/site/content";

// Both sets are in the server HTML; the page's pre-paint `html.os-win` class shows one (lab.css .lx-mac / .lx-win), so
// a Windows visitor never sees Control + U swap to Ctrl + Alt + U after hydration (that swap moved U: CLS 0.0008).
const KEYSETS = [{ os: "mac", keys: ["Control", "U"] }, { os: "win", keys: ["Ctrl", "Alt", "U"] }] as const;

export function HeroStage({ device, caption }: { device: VisitorDevice; caption: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    const demo = el?.querySelector<HTMLElement>(".ndemo");
    if (!el || !demo) return undefined;
    const theirs = Array.from(demo.querySelectorAll<HTMLElement>(".ndemo__key"));
    // only the set this page shows (the other is display: none and has no animations)
    const ours = Array.from(el.querySelectorAll<HTMLElement>(".mx-hs .mx-key__face")).filter((k) => k.getClientRects().length > 0);
    // Pin each of our presses to the demo key it mirrors (last ↔ last), then follow the demo's pause.
    const align = () => {
      ours.forEach((key, i) => {
        const mirror = theirs[theirs.length - ours.length + i]?.getAnimations()[0];
        const anim = key.getAnimations()[0];
        if (mirror && anim && mirror.startTime !== null) anim.startTime = mirror.startTime;
      });
    };
    align();
    const sync = () => el.classList.toggle("is-paused", demo.classList.contains("is-paused"));
    const mo = new MutationObserver(() => { sync(); align(); });
    mo.observe(demo, { attributes: true, attributeFilter: ["class"] });
    sync();
    return () => mo.disconnect();
  }, [device]);

  return (
    <div className="mx-hs" ref={root} style={{ "--mx-hs-rest": `url(${SHOTS.beginner.src})` } as CSSProperties}>
      {/* Low priority, like any image: Lighthouse's simulated LCP waits for every image fetched above Low before the
          first paint, and fetchPriority="high" here cost #225 about 400 ms (3426 → 3009 ms with it blocked). */}
      <link rel="preload" as="image" href={SHOTS.beginner.src} />
      <div className="mx-hs__stage sx-stage-hero" style={{ "--stage-d": "200ms" } as CSSProperties}>
        <span className="mx-hs__light" aria-hidden="true" />
        {/* Vibe at the stage (the site's own Vibe, blinking), watching the selection being made: over its top edge,
            and at ≤ 600 px in the stage's flow above the window, clear of the tab row */}
        <VibeGuide mood="watch" size={72} look={[-1.4, 0.9]} className="mx-hs__vibe" />
        <DemoWindow shortcut={device === "windows" ? "windows" : "mac"} />
        {KEYSETS.map(({ os, keys }) => (
          <span key={os} className={`mx-hs__keys lx-${os}`} role="img" aria-label={`The shortcut: ${keys.join(" + ")}`}>
            {keys.map((key, i) => (
              <kbd key={key} className={`mx-key mx-hs__key mx-hs__key--${i === keys.length - 1 ? "last" : "mod"}`} aria-hidden="true"><span className="mx-key__face">{key}</span></kbd>
            ))}
          </span>
        ))}
      </div>
      {/* the still's caption while a still shows (load, between loops, phone, reduced motion), the recording's only
          while the recording plays (Design r10 ruling); both stacked in one cell, so the swap never moves anything */}
      <p className="mx-hs__cap mx-cap2"><span className="lx-cap mx-cap2__rec">{caption}</span><span className="lx-cap mx-cap2__still">{CAPTION.v0149}</span></p>
    </div>
  );
}
